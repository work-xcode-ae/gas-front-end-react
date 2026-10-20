import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Select, Input, Space, Drawer, Descriptions, Typography, Tabs, Modal, Form, DatePicker, InputNumber, message, Empty, Progress, Dropdown,
} from 'antd';
import {
  ToolOutlined, PlusOutlined, CheckCircleOutlined, WarningOutlined, CalendarOutlined, FileDoneOutlined, ReloadOutlined, EditOutlined,
  UploadOutlined, MoreOutlined, ThunderboltOutlined, ClockCircleOutlined, SafetyCertificateOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import AmcInvoicesPanel from '../Buildings/AmcInvoicesPanel';
import { RecordVisitModal, UploadReportModal } from '../Buildings/AmcVisitModals';
import AddAmcContractModal from '../Buildings/AddAmcContractModal';
import { openPrintWindow, printAmcContract } from '../../utils/printDocs';
import { PageHeader, KpiRow, useBuildings, buildingLabel, PRIMARY } from './shared';

const { Text } = Typography;
const STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: 'نشط' }, pending: { color: 'gold', label: 'معلق' }, expired: { color: 'error', label: 'منتهي' }, terminated: { color: 'default', label: 'ملغي' },
};
const FREQ: Record<string, string> = { monthly: 'شهري', bimonthly: 'كل شهرين', quarterly: 'ربع سنوي', semi_annual: 'نصف سنوي', annual: 'سنوي' };
const VISIT_STATUS: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'مجدولة' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' }, completed: { color: 'success', label: 'مكتملة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const money = (n?: number) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} د.إ`;
const today = dayjs().startOf('day');
const daysLeft = (c: any) => (c.endDate ? dayjs(c.endDate).diff(today, 'day') : null);
const overdueVisits = (c: any) => (c.visits ?? []).filter((v: any) => v.status === 'scheduled' && dayjs(v.scheduledDate).isBefore(today)).length;
const readyLines = (c: any) => (c.paymentSchedule ?? []).filter((l: any) => l.status === 'ready').length;
const overdueLines = (c: any) => (c.paymentSchedule ?? []).filter((l: any) => l.status === 'overdue');

type Quick = 'all' | 'active' | 'expiring' | 'visits' | 'ready' | 'overdue';

const MaintenanceContractsPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('amc.manage');
  const buildings = useBuildings();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<Quick>('all');
  const [reload, setReload] = useState(0);
  const [selId, setSelId] = useState<number | null>(null);
  const [visitFor, setVisitFor] = useState<any>(null);
  const [reportFor, setReportFor] = useState<any>(null);
  const [renewFor, setRenewFor] = useState<any>(null);
  const [newPick, setNewPick] = useState(false);
  const [newBuilding, setNewBuilding] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renewForm] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/amc-contracts', { query: { pageSize: 0, buildingId, status, search: search || undefined } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId, status, search]);
  useEffect(() => { load(); }, [load, reload]);
  const refresh = () => setReload(k => k + 1);
  const sel = rows.find(r => r.id === selId) ?? null;

  const kpi = useMemo(() => ({
    active: rows.filter(c => c.status === 'active').length,
    expiring: rows.filter(c => c.status === 'active' && (daysLeft(c) ?? 999) <= 60).length,
    visits: rows.reduce((s, c) => s + overdueVisits(c), 0),
    ready: rows.reduce((s, c) => s + readyLines(c), 0),
    overdue: rows.reduce((s, c) => s + overdueLines(c).reduce((x: number, l: any) => x + Number(l.balance ?? 0), 0), 0),
  }), [rows]);

  const shown = rows.filter(c => quick === 'all' ? true
    : quick === 'active' ? c.status === 'active'
    : quick === 'expiring' ? c.status === 'active' && (daysLeft(c) ?? 999) <= 60
    : quick === 'visits' ? overdueVisits(c) > 0
    : quick === 'ready' ? readyLines(c) > 0
    : overdueLines(c).length > 0);

  const openRenew = (c: any) => {
    const start = c.endDate ? dayjs(c.endDate).add(1, 'day') : today;
    renewForm.setFieldsValue({ startDate: start, endDate: start.add(1, 'year').subtract(1, 'day'), annualValue: c.annualValue });
    setRenewFor(c);
  };
  const submitRenew = async () => {
    const v = await renewForm.validateFields();
    setBusy(true);
    try {
      const r = await api<any>(`/amc-contracts/${renewFor.id}/renew`, { method: 'POST', body: {
        startDate: v.startDate.format('YYYY-MM-DD'), endDate: v.endDate.format('YYYY-MM-DD'), annualValue: v.annualValue ?? null } });
      message.success(`تم إنشاء العقد المجدد ${r?.contractNo ?? ''}`);
      setRenewFor(null); refresh();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  const issueDue = async (c: any) => {
    try {
      const r = await api<any[]>(`/amc-contracts/${c.id}/invoice-due`, { method: 'POST' });
      message.success(`تم إصدار ${r.length} فاتورة`); refresh();
    } catch (e) { message.error(errorMessage(e), 6); }
  };
  const setContractStatus = async (c: any, st: string) => {
    try { await api(`/amc-contracts/${c.id}/status`, { method: 'PATCH', body: { status: st } }); message.success('تم تحديث الحالة'); refresh(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  const actions = (c: any) => {
    const items = [
      { key: 'visit', label: 'تسجيل زيارة', icon: <CalendarOutlined />, disabled: !canManage },
      { key: 'report', label: 'رفع تقرير', icon: <UploadOutlined />, disabled: !canManage },
      { key: 'invoice', label: `إصدار الفواتير المستحقة${readyLines(c) ? ` (${readyLines(c)})` : ''}`, icon: <ThunderboltOutlined />, disabled: !canManage || readyLines(c) === 0 },
      { key: 'renew', label: 'تجديد العقد', icon: <EditOutlined />, disabled: !canManage },
      ...(c.status === 'active' ? [{ key: 'terminate', label: 'إلغاء العقد', icon: <WarningOutlined />, danger: true, disabled: !canManage }] : []),
    ];
    return (
      <Dropdown trigger={['click']} menu={{ items, onClick: ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === 'visit') setVisitFor(c);
        if (key === 'report') setReportFor(c);
        if (key === 'invoice') issueDue(c);
        if (key === 'renew') openRenew(c);
        if (key === 'terminate') Modal.confirm({ title: `إلغاء العقد ${c.contractNo}؟`, okText: 'إلغاء العقد', okType: 'danger', cancelText: 'رجوع', onOk: () => setContractStatus(c, 'terminated') });
      } }}>
        <Button size="small" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
      </Dropdown>
    );
  };

  return (
    <div>
      <PageHeader icon={<ToolOutlined />} title="عقود الصيانة السنوية (AMC)" subtitle="كل عقود الصيانة في المباني — الزيارات، الفواتير، التجديد"
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh}>تحديث</Button>
          {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: '#c9a84c', borderColor: '#c9a84c', color: '#0b2e18', fontWeight: 600 }}
            onClick={() => { setNewBuilding(null); setNewPick(true); }}>عقد صيانة جديد</Button>}
        </Space>} />

      <KpiRow items={[
        { label: 'إجمالي العقود', value: rows.length, color: PRIMARY, bg: '#e8f5e9', icon: <ToolOutlined />, onClick: () => setQuick('all'), active: quick === 'all' },
        { label: 'نشطة', value: kpi.active, color: '#389e0d', bg: '#f6ffed', icon: <CheckCircleOutlined />, onClick: () => setQuick('active'), active: quick === 'active' },
        { label: 'تنتهي خلال 60 يوماً', value: kpi.expiring, color: '#d48806', bg: '#fffbe6', icon: <ClockCircleOutlined />, onClick: () => setQuick('expiring'), active: quick === 'expiring' },
        { label: 'زيارات متأخرة', value: kpi.visits, color: '#cf1322', bg: '#fff1f0', icon: <CalendarOutlined />, onClick: () => setQuick('visits'), active: quick === 'visits' },
        { label: 'فواتير جاهزة للإصدار', value: kpi.ready, color: '#1677ff', bg: '#e6f4ff', icon: <FileDoneOutlined />, onClick: () => setQuick('ready'), active: quick === 'ready' },
        { label: 'مستحقات متأخرة', value: money(kpi.overdue), color: '#a8071a', bg: '#fff1f0', icon: <WarningOutlined />, onClick: () => setQuick('overdue'), active: quick === 'overdue' },
      ]} />

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select allowClear showSearch optionFilterProp="label" placeholder="المبنى" style={{ width: 240 }} value={buildingId} onChange={setBuildingId}
            options={buildings.map(b => ({ value: b.id, label: buildingLabel(b) }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus}
            options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input.Search allowClear placeholder="رقم العقد / المزود" style={{ width: 220 }} onSearch={setSearch} />
          {quick !== 'all' && <Tag closable color="green" onClose={() => setQuick('all')}>فلتر سريع مفعّل</Tag>}
        </Space>
        <Table size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1100 }} pagination={{ pageSize: 15, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="لا توجد عقود صيانة" /> }}
          onRow={c => ({ onClick: () => setSelId(c.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'رقم العقد', dataIndex: 'contractNo', render: v => <Text strong style={{ fontFamily: 'monospace', color: PRIMARY }}>{v}</Text> },
            { title: 'المبنى', key: 'b', render: (_, c) => <div>{c.building}<div style={{ fontSize: 11, color: '#888' }}>{c.buildingCode}</div></div> },
            { title: 'العميل (المالك)', dataIndex: 'ownerName', render: v => v ?? '—' },
            { title: 'الفترة', key: 'p', render: (_, c) => {
              const d = daysLeft(c);
              return <div style={{ fontSize: 12 }}>{c.startDate} → {c.endDate}
                {c.status === 'active' && d != null && d <= 60 && <div><Tag color={d < 0 ? 'error' : 'warning'} style={{ fontSize: 10 }}>{d < 0 ? 'منتهي' : `ينتهي خلال ${d} يوم`}</Tag></div>}</div>;
            } },
            { title: 'القيمة السنوية', dataIndex: 'annualValue', render: v => money(v) },
            { title: 'الزيارات', key: 'v', render: (_, c) => (
              <div style={{ minWidth: 110 }}>
                <Progress percent={c.visitsTotal ? Math.round(c.visitsDone * 100 / c.visitsTotal) : 0} size="small" format={() => `${c.visitsDone}/${c.visitsTotal}`} />
                <div style={{ fontSize: 10, color: '#888' }}>{FREQ[c.visitFrequency] ?? c.visitFrequency}{overdueVisits(c) ? <span style={{ color: '#cf1322' }}> · {overdueVisits(c)} متأخرة</span> : ''}</div>
              </div>) },
            { title: 'الفواتير', key: 'i', render: (_, c) => {
              const od = overdueLines(c); const rd = readyLines(c);
              return <Space size={2} wrap>
                {rd > 0 && <Tag color="gold" style={{ fontSize: 10 }}>{rd} جاهزة</Tag>}
                {od.length > 0 && <Tag color="error" style={{ fontSize: 10 }}>{od.length} متأخرة</Tag>}
                {!rd && !od.length && <Text type="secondary" style={{ fontSize: 11 }}>منتظمة</Text>}
              </Space>;
            } },
            { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> },
            { title: '', key: 'a', width: 50, render: (_, c) => actions(c) },
          ]} />
      </Card>

      {/* ── contract drawer ── */}
      <Drawer open={!!sel} onClose={() => setSelId(null)} width={Math.min(960, window.innerWidth - 40)} destroyOnClose
        title={sel && <Space wrap><SafetyCertificateOutlined style={{ color: PRIMARY }} /><span>{sel.contractNo}</span><Tag color={STATUS[sel.status]?.color}>{STATUS[sel.status]?.label}</Tag><Text type="secondary" style={{ fontSize: 12 }}>{sel.building}</Text></Space>}
        extra={sel && <Space>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => printAmcContract(openPrintWindow(), sel.id)}>طباعة العقد</Button>
          {canManage && <>
          <Button size="small" icon={<CalendarOutlined />} onClick={() => setVisitFor(sel)}>تسجيل زيارة</Button>
          <Button size="small" icon={<UploadOutlined />} onClick={() => setReportFor(sel)}>رفع تقرير</Button>
          <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => openRenew(sel)}>تجديد</Button>
          </>}
        </Space>}>
        {sel && (
          <Tabs items={[
            { key: 'info', label: 'بيانات العقد', children: (
              <div>
                <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} labelStyle={{ width: 150, background: '#fafafa' }}>
                  <Descriptions.Item label="المبنى">{sel.building} ({sel.buildingCode})</Descriptions.Item>
                  <Descriptions.Item label="الفترة">{sel.startDate} → {sel.endDate}</Descriptions.Item>
                  <Descriptions.Item label="العميل (المالك)">{sel.ownerName ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="هاتف / بريد العميل">{[sel.ownerPhone, sel.ownerEmail].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
                  <Descriptions.Item label="مقدم الخدمة">{sel.vendor}</Descriptions.Item>
                  <Descriptions.Item label="اتصال المزود">{[sel.vendorContact, sel.vendorEmail].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
                  <Descriptions.Item label="القيمة السنوية">{money(sel.annualValue)}</Descriptions.Item>
                  <Descriptions.Item label="الزيارات">{FREQ[sel.visitFrequency] ?? sel.visitFrequency} — {sel.visitsDone}/{sel.visitsTotal}</Descriptions.Item>
                  <Descriptions.Item label="زمن الاستجابة">{sel.responseTime ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="الطوارئ">{sel.emergencyIncluded ? 'مشمولة' : 'غير مشمولة'}</Descriptions.Item>
                  {sel.notes && <Descriptions.Item label="ملاحظات" span={2}>{sel.notes}</Descriptions.Item>}
                </Descriptions>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
                  <Card size="small" title="نطاق الصيانة" style={{ borderRadius: 10 }}>
                    {(sel.scope ?? []).length === 0 ? <Text type="secondary">—</Text> : (sel.scope as string[]).map((s, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}><CheckCircleOutlined style={{ color: '#52c41a' }} /> {s}</div>)}
                    {(sel.excludedScope ?? []).length > 0 && <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 11 }}>غير مشمول:</Text>
                      {(sel.excludedScope as string[]).map((s, i) => <div key={i} style={{ fontSize: 12, color: '#999' }}>✕ {s}</div>)}</div>}
                  </Card>
                  <Card size="small" title="الشروط والأحكام" style={{ borderRadius: 10 }}>
                    {[...(sel.terms ?? []), ...(sel.customTerms ?? [])].length === 0 ? <Text type="secondary">—</Text>
                      : [...(sel.terms ?? []), ...(sel.customTerms ?? [])].map((t: string, i: number) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{i + 1}. {t}</div>)}
                  </Card>
                </div>
              </div>) },
            { key: 'visits', label: `الزيارات (${(sel.visits ?? []).length})`, children: (
              <Table size="small" rowKey="id" pagination={false} dataSource={sel.visits ?? []}
                columns={[
                  { title: 'الزيارة', key: 'n', render: (_, v: any) => <div>{v.periodLabel || v.visitNo}<div style={{ fontSize: 11, color: '#888' }}>{v.visitNo}</div></div> },
                  { title: 'الموعد', dataIndex: 'scheduledDate' },
                  { title: 'التنفيذ', dataIndex: 'visitDate', render: v => v ?? '—' },
                  { title: 'الحالة', dataIndex: 'status', render: (s, v: any) => s === 'scheduled' && dayjs(v.scheduledDate).isBefore(today)
                    ? <Tag color="error">متأخرة</Tag> : <Tag color={VISIT_STATUS[s]?.color}>{VISIT_STATUS[s]?.label ?? s}</Tag> },
                ]} />) },
            { key: 'invoices', label: <span>الفواتير والأقساط{overdueLines(sel).length ? <Tag color="error" style={{ marginInlineStart: 6 }}>{overdueLines(sel).length}</Tag> : null}</span>,
              children: <AmcInvoicesPanel contractId={sel.id} schedule={sel.paymentSchedule ?? []} onChanged={refresh} /> },
          ]} />
        )}
      </Drawer>

      <RecordVisitModal open={!!visitFor} contract={visitFor} onClose={() => setVisitFor(null)} onDone={refresh} />
      <UploadReportModal open={!!reportFor} contract={reportFor} onClose={() => setReportFor(null)} onDone={refresh} />

      <Modal open={!!renewFor} title={`تجديد العقد ${renewFor?.contractNo ?? ''}`} okText="تجديد" cancelText="إلغاء" onOk={submitRenew} confirmLoading={busy}
        onCancel={() => setRenewFor(null)} destroyOnClose>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
          يُنشأ عقد جديد بنفس مقدم الخدمة والعميل والنطاق والشروط وتكرار الزيارات، مع توليد الزيارات وجدول الدفعات للفترة الجديدة.
        </Text>
        <Form form={renewForm} layout="vertical">
          <Space wrap>
            <Form.Item name="startDate" label="البداية" rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="endDate" label="النهاية" rules={[{ required: true }]}><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="annualValue" label="القيمة السنوية (د.إ)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={newPick} title="عقد صيانة جديد — اختر المبنى" okText="متابعة" cancelText="إلغاء" okButtonProps={{ disabled: !newBuilding }}
        onCancel={() => setNewPick(false)} onOk={() => { setNewPick(false); setNewOpen(true); }}>
        <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="اختر المبنى…" value={newBuilding ?? undefined} onChange={setNewBuilding}
          options={buildings.map(b => ({ value: b.id, label: buildingLabel(b) }))} />
      </Modal>
      {newBuilding && (
        <AddAmcContractModal open={newOpen} buildingId={newBuilding} buildingName={buildings.find(b => b.id === newBuilding)?.name ?? ''}
          onClose={() => setNewOpen(false)} onSave={() => { setNewOpen(false); refresh(); }} />
      )}
    </div>
  );
};

export default MaintenanceContractsPage;
