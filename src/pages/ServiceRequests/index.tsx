import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Select, Space, Drawer, Descriptions, Typography, Modal, Form, Input, DatePicker, Upload, message, Empty, Timeline, Spin, Alert,
} from 'antd';
import {
  ToolOutlined, PlusOutlined, ReloadOutlined, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, WarningOutlined, UserAddOutlined, StopOutlined,
  RollbackOutlined, UploadOutlined, PaperClipOutlined, FireOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { API_BASE, api, apiUpload, errorMessage, type Paged, authFetch } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { SR_STATUS, PRIORITY_STYLE, SrFlow, SR_FLOW_CSS, AssigneePicker, useAssignees, type SrStatus } from '../Buildings/ServiceRequestTracker';
import { PageHeader, KpiRow, useBuildings, buildingLabel, PRIMARY } from '../MaintenanceContracts/shared';

const { Text } = Typography;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';
const isOpen = (s?: string) => s === 'pending' || s === 'in_progress';
const late = (r: any) => isOpen(r.status) && dayjs().diff(dayjs(r.requestedAt), 'hour') > (PRIORITY_STYLE[r.priority ?? 'medium']?.slaHours ?? 72);
const fmt = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—');

async function openFile(a: any) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/service-requests/attachments/${a.id}`);
    if (!res.ok) throw new Error(`تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(a.mimeType ?? '')) w.location.href = url;
    else { w?.close(); const l = document.createElement('a'); l.href = url; l.download = a.fileName ?? 'file'; l.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

type Act = { kind: 'assign' | 'complete' | 'cancel' | 'reopen' | 'start'; row: any } | null;

const ServiceRequestsPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('service_requests.manage');
  const buildings = useBuildings();
  const assignees = useAssignees(true);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>('open');
  const [priority, setPriority] = useState<string | undefined>();
  const [assignedTo, setAssignedTo] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  const [selId, setSelId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [hLoading, setHLoading] = useState(false);
  const [act, setAct] = useState<Act>(null);
  const [kind, setKind] = useState<'none' | 'user' | 'vendor'>('user');
  const [who, setWho] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [doneAt, setDoneAt] = useState<dayjs.Dayjs | null>(null);
  const [upl, setUpl] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newUnits, setNewUnits] = useState<any[]>([]);
  const [newKind, setNewKind] = useState<'none' | 'user' | 'vendor'>('none');
  const [newWho, setNewWho] = useState<number | undefined>();
  const [form] = Form.useForm();
  const refresh = () => setReload(k => k + 1);

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/service-requests', { query: {
      pageSize: 0, buildingId, priority, assignedTo, search: search || undefined,
      status: status && status !== 'open' && status !== 'late' ? status : undefined, openOnly: status === 'open' || status === 'late' ? true : undefined,
    } }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId, status, priority, assignedTo, search]);
  useEffect(() => { load(); }, [load, reload]);

  // all requests (for the KPI cards, independent of the status filter)
  const [all, setAll] = useState<any[]>([]);
  useEffect(() => {
    api<Paged<any>>('/service-requests', { query: { pageSize: 0, buildingId } }).then(r => setAll(r.items)).catch(() => setAll([]));
  }, [buildingId, reload]);

  const sel = rows.find(r => r.id === selId) ?? all.find(r => r.id === selId) ?? null;
  useEffect(() => {
    if (!selId) return;
    setHLoading(true);
    Promise.all([api<any[]>(`/service-requests/${selId}/history`).catch(() => []), api<any[]>(`/service-requests/${selId}/attachments`).catch(() => [])])
      .then(([h, f]) => { setHistory(h); setFiles(f); }).finally(() => setHLoading(false));
  }, [selId, reload]);

  const shown = status === 'late' ? rows.filter(late) : rows;
  const kpi = useMemo(() => ({
    open: all.filter(r => isOpen(r.status)).length,
    pending: all.filter(r => r.status === 'pending').length,
    progress: all.filter(r => r.status === 'in_progress').length,
    late: all.filter(late).length,
    urgent: all.filter(r => isOpen(r.status) && (r.priority === 'urgent' || r.priority === 'high')).length,
    done30: all.filter(r => r.status === 'completed' && r.closedAt && dayjs().diff(dayjs(r.closedAt), 'day') <= 30).length,
  }), [all]);

  const openAct = (kindName: NonNullable<Act>['kind'], row: any) => {
    setNote(''); setUpl([]); setDoneAt(dayjs());
    setKind(row.assignedVendorId ? 'vendor' : 'user'); setWho(row.assignedVendorId ?? row.assignedTo ?? undefined);
    setAct({ kind: kindName, row });
  };
  const submitAct = async () => {
    if (!act) return;
    if (act.kind === 'cancel' && !note.trim()) { message.warning('اكتب سبب الإلغاء'); return; }
    setBusy(true);
    try {
      const id = act.row.id;
      if (act.kind === 'assign') {
        if (!who) { message.warning('اختر الفني أو المقاول'); setBusy(false); return; }
        await api(`/service-requests/${id}/assign`, { body: { assignedTo: kind === 'user' ? who : null, assignedVendorId: kind === 'vendor' ? who : null, notes: note.trim() || undefined } });
      } else if (act.kind === 'complete') {
        const fd = new FormData();
        if (note.trim()) fd.append('notes', note.trim());
        if (doneAt) fd.append('completedAt', doneAt.toISOString());
        upl.forEach(f => f.originFileObj && fd.append('files', f.originFileObj as File));
        await apiUpload(`/service-requests/${id}/complete`, fd);
      } else {
        const st = act.kind === 'cancel' ? 'cancelled' : act.kind === 'reopen' ? 'pending' : 'in_progress';
        await api(`/service-requests/${id}/status`, { body: { status: st, notes: note.trim() || undefined } });
      }
      message.success('تم تحديث الطلب');
      setAct(null); refresh();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  const createNew = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const unit = newUnits.find(u => u.id === v.unitId);
      const r = await api<any>('/service-requests', { method: 'POST', body: {
        buildingId: v.buildingId, unitId: v.unitId ?? null, tenantId: unit?.tenantId ?? null, meterId: unit?.meterId ?? null,
        description: v.description, priority: v.priority, notes: v.notes || null,
        assignedTo: newKind === 'user' ? newWho ?? null : null, assignedVendorId: newKind === 'vendor' ? newWho ?? null : null,
      } });
      message.success(`تم إنشاء الطلب ${r?.requestNo ?? ''}`);
      setNewOpen(false); refresh();
      if (r?.id) setSelId(r.id);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  const rowActions = (r: any) => !canManage ? null : (
    <Space size={4} wrap onClick={e => e.stopPropagation()}>
      {isOpen(r.status) && <Button size="small" icon={<UserAddOutlined />} onClick={() => openAct('assign', r)}>{r.assignee || r.vendor ? 'إعادة إسناد' : 'إسناد'}</Button>}
      {r.status === 'pending' && (r.assignee || r.vendor) && <Button size="small" icon={<SyncOutlined />} onClick={() => openAct('start', r)}>بدء التنفيذ</Button>}
      {isOpen(r.status) && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openAct('complete', r)}>إكمال</Button>}
      {isOpen(r.status) && <Button size="small" danger icon={<StopOutlined />} onClick={() => openAct('cancel', r)}>إلغاء</Button>}
      {!isOpen(r.status) && <Button size="small" icon={<RollbackOutlined />} onClick={() => openAct('reopen', r)}>إعادة فتح</Button>}
    </Space>
  );

  const statusTag = (r: any) => {
    const s = SR_STATUS[r.status as SrStatus];
    return <Space size={2} wrap>
      <Tag color={s?.color} icon={s?.icon} style={{ background: s?.bg, borderColor: s?.color }}>{s?.label ?? r.statusLabel}</Tag>
      {late(r) && <Tag color="error" icon={<WarningOutlined />}>تجاوز المهلة</Tag>}
    </Space>;
  };
  const prTag = (p?: string) => { const x = PRIORITY_STYLE[p ?? 'medium']; return <Tag style={{ color: x?.color, background: x?.bg, borderColor: x?.color }}>{x?.label ?? p}</Tag>; };

  return (
    <div>
      <style>{SR_FLOW_CSS}</style>
      <PageHeader icon={<ToolOutlined />} title="طلبات الخدمة" subtitle="كل طلبات الصيانة والأعطال في المباني — الإسناد، المتابعة، الإغلاق"
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh}>تحديث</Button>
          {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: '#c9a84c', borderColor: '#c9a84c', color: '#0b2e18', fontWeight: 600 }}
            onClick={() => { form.resetFields(); form.setFieldsValue({ priority: 'medium', buildingId }); setNewUnits([]); setNewKind('none'); setNewWho(undefined); if (buildingId) api<Paged<any>>('/units', { query: { buildingId, pageSize: 0 } }).then(r => setNewUnits(r.items)).catch(() => undefined); setNewOpen(true); }}>طلب خدمة جديد</Button>}
        </Space>} />

      <KpiRow items={[
        { label: 'مفتوحة', value: kpi.open, color: PRIMARY, bg: '#e8f5e9', icon: <ToolOutlined />, onClick: () => setStatus('open'), active: status === 'open' },
        { label: 'معلقة (بانتظار الإسناد)', value: kpi.pending, color: '#d46b08', bg: '#fff3e0', icon: <ClockCircleOutlined />, onClick: () => setStatus('pending'), active: status === 'pending' },
        { label: 'قيد التنفيذ', value: kpi.progress, color: '#1565c0', bg: '#e3f2fd', icon: <SyncOutlined />, onClick: () => setStatus('in_progress'), active: status === 'in_progress' },
        { label: 'تجاوزت المهلة', value: kpi.late, color: '#c62828', bg: '#ffebee', icon: <WarningOutlined />, onClick: () => setStatus('late'), active: status === 'late' },
        { label: 'عاجلة / عالية مفتوحة', value: kpi.urgent, color: '#ad2102', bg: '#fff2e8', icon: <FireOutlined /> },
        { label: 'أُنجزت آخر 30 يوماً', value: kpi.done30, color: '#2e7d32', bg: '#f6ffed', icon: <CheckCircleOutlined />, onClick: () => setStatus('completed'), active: status === 'completed' },
      ]} />

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select allowClear showSearch optionFilterProp="label" placeholder="المبنى" style={{ width: 230 }} value={buildingId} onChange={setBuildingId}
            options={buildings.map(b => ({ value: b.id, label: buildingLabel(b) }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 160 }} value={status} onChange={setStatus}
            options={[{ value: 'open', label: 'المفتوحة' }, { value: 'late', label: 'تجاوزت المهلة' }, ...Object.entries(SR_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <Select allowClear placeholder="الأولوية" style={{ width: 130 }} value={priority} onChange={setPriority}
            options={Object.entries(PRIORITY_STYLE).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="الفني المسند" style={{ width: 180 }} value={assignedTo} onChange={setAssignedTo}
            options={assignees.users.map(u => ({ value: u.id, label: u.name }))} />
          <Input.Search allowClear placeholder="رقم الطلب / الوصف" style={{ width: 220 }} onSearch={setSearch} />
        </Space>
        <Table size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1150 }} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="لا توجد طلبات" /> }}
          onRow={r => ({ onClick: () => setSelId(r.id), style: { cursor: 'pointer', background: late(r) ? '#fff8f8' : undefined } })}
          columns={[
            { title: 'رقم الطلب', dataIndex: 'requestNo', render: v => <Text strong style={{ fontFamily: 'monospace', color: PRIMARY }}>{v}</Text> },
            { title: 'الموقع', dataIndex: 'location', render: (v, r) => <div>{v}{r.tenant && <div style={{ fontSize: 11, color: '#888' }}>{r.tenant}</div>}</div> },
            { title: 'الوصف', dataIndex: 'description', ellipsis: true },
            { title: 'الأولوية', dataIndex: 'priority', render: prTag },
            { title: 'المسند إليه', key: 'as', render: (_, r) => r.assignee ?? r.vendor ?? <Text type="secondary">غير مسند</Text> },
            { title: 'تاريخ الطلب', dataIndex: 'requestedAt', render: v => <span style={{ fontSize: 12 }}>{fmt(v)}</span> },
            { title: 'الحالة', key: 'st', render: (_, r) => statusTag(r) },
            { title: '', key: 'a', render: (_, r) => rowActions(r) },
          ]} />
      </Card>

      <Drawer open={!!sel} onClose={() => setSelId(null)} width={Math.min(760, window.innerWidth - 40)} destroyOnClose
        title={sel && <Space wrap><ToolOutlined style={{ color: PRIMARY }} />{sel.requestNo}{prTag(sel.priority)}{statusTag(sel)}</Space>}
        extra={sel && rowActions(sel)}>
        {sel && (
          <div>
            <SrFlow status={sel.status as SrStatus} />
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginTop: 14 }} labelStyle={{ width: 120, background: '#fafafa' }}>
              <Descriptions.Item label="الموقع" span={2}>{sel.location}</Descriptions.Item>
              <Descriptions.Item label="الوصف" span={2}>{sel.description}</Descriptions.Item>
              <Descriptions.Item label="المستأجر">{sel.tenant ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="العداد">{sel.meterNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الفني">{sel.assignee ? `${sel.assignee}${sel.assigneePhone ? ` · ${sel.assigneePhone}` : ''}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="المقاول">{sel.vendor ? `${sel.vendor}${sel.vendorPhone ? ` · ${sel.vendorPhone}` : ''}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="تاريخ الطلب">{fmt(sel.requestedAt)}</Descriptions.Item>
              <Descriptions.Item label="الإغلاق">{fmt(sel.closedAt)}</Descriptions.Item>
              {sel.notes && <Descriptions.Item label="ملاحظات" span={2}>{sel.notes}</Descriptions.Item>}
            </Descriptions>
            {late(sel) && <Alert style={{ marginTop: 12 }} type="error" showIcon message={`تجاوز مهلة الأولوية (${PRIORITY_STYLE[sel.priority ?? 'medium']?.slaHours} ساعة)`} />}
            <Card size="small" title="سجل الحالة" style={{ marginTop: 14, borderRadius: 10 }}>
              {hLoading ? <Spin /> : history.length === 0 ? <Text type="secondary">لا يوجد سجل</Text> : (
                <Timeline items={history.map(h => ({
                  color: h.to === 'completed' ? 'green' : h.to === 'cancelled' ? 'gray' : h.action === 'assign' ? 'purple' : 'blue',
                  children: <div style={{ fontSize: 12 }}>
                    <Text strong style={{ fontSize: 12 }}>{h.description ?? h.action}</Text>
                    {(h.assignee || h.vendor) && <div>إسناد إلى: {h.assignee ?? h.vendor}</div>}
                    {h.note && <div style={{ color: '#555' }}>{h.note}</div>}
                    {h.attachments ? <div><PaperClipOutlined /> {h.attachments} مرفق</div> : null}
                    <div style={{ color: '#999', fontSize: 11 }}>{fmt(h.at)}{h.user ? ` · ${h.user}` : ''}</div>
                  </div>,
                }))} />
              )}
            </Card>
            <Card size="small" title={`المرفقات (${files.length})`} style={{ marginTop: 14, borderRadius: 10 }}>
              {files.length === 0 ? <Text type="secondary">لا توجد مرفقات</Text> : files.map(f => (
                <div key={f.id} style={{ fontSize: 12, padding: '3px 0' }}><PaperClipOutlined /> <a onClick={() => openFile(f)}>{f.fileName}</a></div>
              ))}
            </Card>
          </div>
        )}
      </Drawer>

      <Modal open={!!act} confirmLoading={busy} onOk={submitAct} onCancel={() => setAct(null)} cancelText="رجوع" destroyOnClose
        okText={act?.kind === 'assign' ? 'إسناد' : act?.kind === 'complete' ? 'إكمال الطلب' : act?.kind === 'cancel' ? 'إلغاء الطلب' : act?.kind === 'reopen' ? 'إعادة فتح' : 'بدء التنفيذ'}
        okButtonProps={{ danger: act?.kind === 'cancel' }}
        title={act && `${act.row.requestNo} — ${act.kind === 'assign' ? 'إسناد الطلب' : act.kind === 'complete' ? 'إكمال الطلب' : act.kind === 'cancel' ? 'إلغاء الطلب' : act.kind === 'reopen' ? 'إعادة فتح الطلب' : 'بدء التنفيذ'}`}>
        {act?.kind === 'assign' && <div style={{ marginBottom: 12 }}><AssigneePicker assignees={assignees} kind={kind} onKind={setKind} value={who} onChange={setWho} /></div>}
        {act?.kind === 'complete' && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>تاريخ الإنجاز</Text>
            <DatePicker showTime value={doneAt} onChange={setDoneAt} style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day') || d.isBefore(dayjs(act.row.requestedAt), 'day')} />
            <Upload multiple accept={ACCEPT} fileList={upl} beforeUpload={() => false} maxCount={10} onChange={({ fileList }) => setUpl(fileList)}>
              <Button icon={<UploadOutlined />}>مرفقات (صور / تقرير) — اختياري</Button>
            </Upload>
          </Space>
        )}
        <Input.TextArea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={act?.kind === 'cancel' ? 'سبب الإلغاء (مطلوب)' : 'ملاحظة (اختياري)'} />
      </Modal>

      <Modal open={newOpen} title="طلب خدمة جديد" okText="إنشاء الطلب" cancelText="إلغاء" onOk={createNew} confirmLoading={busy} onCancel={() => setNewOpen(false)} destroyOnClose width={620}>
        <SrFlow status="pending" preview />
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space style={{ display: 'flex' }} align="start" wrap>
            <Form.Item name="buildingId" label="المبنى" rules={[{ required: true, message: 'اختر المبنى' }]} style={{ width: 260 }}>
              <Select showSearch optionFilterProp="label" placeholder="المبنى" options={buildings.map(b => ({ value: b.id, label: buildingLabel(b) }))}
                onChange={(id: number) => { form.setFieldsValue({ unitId: undefined }); api<Paged<any>>('/units', { query: { buildingId: id, pageSize: 0 } }).then(r => setNewUnits(r.items)).catch(() => setNewUnits([])); }} />
            </Form.Item>
            <Form.Item name="unitId" label="الوحدة (اختياري — مرافق عامة)" style={{ width: 250 }}>
              <Select allowClear showSearch optionFilterProp="label" placeholder="الوحدة"
                options={newUnits.map(u => ({ value: u.id, label: `وحدة ${u.no}${u.tenant ? ` — ${u.tenant}` : ''}` }))} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="وصف المشكلة" rules={[{ required: true, message: 'اكتب الوصف' }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="priority" label="الأولوية">
            <Select options={Object.entries(PRIORITY_STYLE).map(([k, v]) => ({ value: k, label: `${v.label} — مهلة ${v.slaHours} ساعة` }))} />
          </Form.Item>
          <Form.Item label="الإسناد"><AssigneePicker assignees={assignees} kind={newKind} onKind={setNewKind} value={newWho} onChange={setNewWho} allowNone /></Form.Item>
          <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceRequestsPage;
