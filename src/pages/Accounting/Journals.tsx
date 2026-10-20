import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, DatePicker, Drawer, Descriptions, Modal, Form, InputNumber, Row, Col, Alert, Popconfirm, Typography, Timeline, Badge, Card, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, CheckOutlined, CloseOutlined, RollbackOutlined, SendOutlined, SafetyCertificateOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { AccountSelect, BranchSelect, JOURNAL_STATUS, SOURCE_TYPES, downloadCsv, money, num, useAccounts } from './shared';

const { Text } = Typography;
const APPROVAL: Record<string, { label: string; color: string }> = {
  pending: { label: 'بانتظار الاعتماد', color: 'gold' }, approved: { label: 'معتمد', color: 'green' }, rejected: { label: 'مرفوض', color: 'red' },
};

function PartySelect({ partyType, ...rest }: { partyType: 'customer' | 'supplier'; value?: number; onChange?: (v?: number) => void }) {
  const [opts, setOpts] = useState<any[]>([]);
  const search = (s?: string) => api<any[]>('/statements/parties', { query: { partyType, search: s || undefined } }).then(setOpts).catch(() => setOpts([]));
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Select allowClear showSearch filterOption={false} onSearch={search} size="small" style={{ width: '100%' }} placeholder={partyType === 'customer' ? 'عميل' : 'مورد'}
    options={opts.map(o => ({ value: o.id, label: `${o.code ? `${o.code} — ` : ''}${o.name ?? ''}` }))} {...rest} />;
}

export function JournalDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const { can, user } = useAuth();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rf] = Form.useForm();
  const load = () => { if (id) api<any>(`/journal-entries/${id}`).then(setD).catch(e => message.error(errorMessage(e))); };
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (path: string, body?: any, ok = 'تم') => {
    setBusy(true);
    try { await api(`/journal-entries/${id}${path}`, { method: path ? 'POST' : 'DELETE', body }); message.success(ok); onChanged(); if (path) load(); else onClose(); }
    catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  const j = d?.entry;
  const pending = d?.approvals?.find((a: any) => a.status === 'pending');
  const isCreator = j && user && j.createdBy === user.id;
  const totalDr = d?.lines?.reduce((s: number, l: any) => s + Number(l.debit ?? 0), 0) ?? 0;
  const totalCr = d?.lines?.reduce((s: number, l: any) => s + Number(l.credit ?? 0), 0) ?? 0;

  useTrackView('JournalEntry', id, j?.journalNo);
  return (
    <Drawer open={id != null} onClose={onClose} width={860} title={j ? <Space>قيد {j.journalNo}<Tag color={JOURNAL_STATUS[d.status]?.color}>{JOURNAL_STATUS[d.status]?.label ?? d.status}</Tag></Space> : 'قيد'}
      extra={d && <Space wrap>
        <HistoryButton entityType="JournalEntry" id={id} title={`قيد ${j?.journalNo ?? ''}`} size="middle" />
        {d.status === 'draft' && !d.needsApproval && can('accounting.post') && <Button type="primary" loading={busy} icon={<CheckOutlined />} onClick={() => act('/post', undefined, 'تم ترحيل القيد')}>ترحيل</Button>}
        {d.status === 'draft' && d.needsApproval && !pending && <Button loading={busy} icon={<SendOutlined />} onClick={() => act('/submit', undefined, 'تم إرسال القيد للاعتماد')}>إرسال للاعتماد</Button>}
        {pending && can('accounting.post') && !isCreator && <>
          <Button type="primary" loading={busy} icon={<SafetyCertificateOutlined />} onClick={() => act('/approve', {}, 'تم اعتماد وترحيل القيد')}>اعتماد وترحيل</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => { rf.resetFields(); setRejectOpen(true); }}>رفض</Button></>}
        {d.status === 'posted' && !j.reversedEntryId && can('accounting.post') && <Button danger icon={<RollbackOutlined />} onClick={() => { rf.resetFields(); rf.setFieldsValue({ date: dayjs() }); setReverseOpen(true); }}>عكس القيد</Button>}
        {d.status === 'draft' && can('accounting.manage') && <Popconfirm title="حذف المسودة؟" okText="حذف" cancelText="إلغاء" onConfirm={() => act('', undefined, 'تم الحذف')}><Button danger icon={<DeleteOutlined />} /></Popconfirm>}
      </Space>}>
      {d && <>
        {d.needsApproval && d.status === 'draft' && <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`قيمة القيد تتجاوز حد الاعتماد (${money(d.approvalThreshold)}) — يجب اعتماده من مستخدم آخر لديه صلاحية الترحيل.`} />}
        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="التاريخ">{j.entryDate}</Descriptions.Item>
          <Descriptions.Item label="المصدر">{SOURCE_TYPES[j.sourceType] ?? j.sourceType}{j.sourceId ? ` #${j.sourceId}` : ''}</Descriptions.Item>
          <Descriptions.Item label="البيان" span={2}>{j.description}</Descriptions.Item>
          <Descriptions.Item label="أنشأه">{d.createdBy ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="رحّله">{d.postedBy ?? '—'}{j.postedAt ? ` · ${dayjs(j.postedAt).format('YYYY-MM-DD HH:mm')}` : ''}</Descriptions.Item>
          {j.reversedEntryId && <Descriptions.Item label="قيد العكس" span={2}>#{j.reversedEntryId}</Descriptions.Item>}
        </Descriptions>
        <Table size="small" rowKey="id" pagination={false} dataSource={d.lines} scroll={{ x: 700 }}
          columns={[
            { title: 'الحساب', key: 'acc', render: (_, l: any) => <span><Text style={{ fontFamily: 'monospace' }}>{l.accountCode}</Text> {l.account}</span> },
            { title: 'البيان', dataIndex: 'description' },
            { title: 'مدين', dataIndex: 'debit', width: 120, render: v => Number(v) ? num(v) : '' },
            { title: 'دائن', dataIndex: 'credit', width: 120, render: v => Number(v) ? num(v) : '' },
          ]}
          summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
            <Table.Summary.Cell index={0} colSpan={2}><b>الإجمالي</b></Table.Summary.Cell>
            <Table.Summary.Cell index={2}><b>{num(totalDr)}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={3}><b>{num(totalCr)}</b></Table.Summary.Cell>
          </Table.Summary.Row>} />
        {d.approvals?.length > 0 && <Card size="small" title="سجل الاعتماد" style={{ marginTop: 12 }}>
          <Timeline items={d.approvals.map((a: any) => ({ color: APPROVAL[a.status]?.color === 'gold' ? 'orange' : APPROVAL[a.status]?.color,
            children: <div><Tag color={APPROVAL[a.status]?.color}>{APPROVAL[a.status]?.label ?? a.status}</Tag> طلب {a.requestedBy ?? ''} في {dayjs(a.requestedAt).format('YYYY-MM-DD HH:mm')} · مبلغ {money(a.amount)} (الحد {money(a.threshold)})
              {a.decidedAt && <div style={{ fontSize: 12, color: '#666' }}>القرار: {a.decidedBy ?? ''} في {dayjs(a.decidedAt).format('YYYY-MM-DD HH:mm')}{a.reason ? ` — ${a.reason}` : ''}</div>}</div> }))} />
        </Card>}
      </>}
      <Modal open={reverseOpen} title="عكس القيد" okText="عكس" okButtonProps={{ danger: true, loading: busy }} cancelText="إلغاء" onCancel={() => setReverseOpen(false)}
        onOk={async () => { const v = await rf.validateFields(); await act('/reverse', { date: v.date.format('YYYY-MM-DD'), reason: v.reason }, 'تم عكس القيد'); setReverseOpen(false); }}>
        <Form form={rf} layout="vertical">
          <Form.Item name="date" label="تاريخ قيد العكس" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="السبب" rules={[{ required: true, message: 'السبب مطلوب' }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={rejectOpen} title="رفض القيد" okText="رفض" okButtonProps={{ danger: true, loading: busy }} cancelText="إلغاء" onCancel={() => setRejectOpen(false)}
        onOk={async () => { const v = await rf.validateFields(); await act('/reject', { reason: v.reason }, 'تم رفض القيد'); setRejectOpen(false); }}>
        <Form form={rf} layout="vertical"><Form.Item name="reason" label="سبب الرفض" rules={[{ required: true, message: 'السبب مطلوب' }]}><Input.TextArea rows={2} /></Form.Item></Form>
      </Modal>
    </Drawer>
  );
}

interface Line { key: number; accountId?: number; description?: string; debit?: number; credit?: number; tenantId?: number; vendorId?: number }

function NewJournal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: number) => void }) {
  const { can } = useAuth();
  const accounts = useAccounts();
  const [form] = Form.useForm();
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTags, setShowTags] = useState(false);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue({ entryDate: dayjs() }); setLines([{ key: 1 }, { key: 2 }]); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key: number, patch: Partial<Line>) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l));
  const dr = lines.reduce((s, l) => s + (l.debit ?? 0), 0), cr = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const diff = Math.round((dr - cr) * 100) / 100;
  const save = async (post: boolean) => {
    const v = await form.validateFields();
    const valid = lines.filter(l => l.accountId && ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0));
    if (valid.length < 2) { message.warning('أدخل سطرين على الأقل'); return; }
    if (valid.some(l => (l.debit ?? 0) > 0 && (l.credit ?? 0) > 0)) { message.warning('كل سطر إما مدين أو دائن'); return; }
    if (diff !== 0) { message.warning('القيد غير متوازن'); return; }
    setSaving(true);
    try {
      const r = await api<any>('/journal-entries', { method: 'POST', body: { branchId: v.branchId, entryDate: v.entryDate.format('YYYY-MM-DD'), description: v.description, post,
        lines: valid.map(l => ({ accountId: l.accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, description: l.description || v.description, tenantId: l.tenantId, vendorId: l.vendorId })) } });
      message.success(r?.pendingApproval ? 'القيد يتجاوز حد الاعتماد — حُفظ كمسودة وأُرسل للاعتماد' : post ? 'تم ترحيل القيد' : 'تم حفظ المسودة', 5);
      onSaved(r?.id);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} width={1050} title="قيد يومية يدوي" destroyOnClose
      footer={<Space>
        <Button onClick={onClose}>إلغاء</Button>
        <Button loading={saving} onClick={() => save(false)}>حفظ كمسودة</Button>
        {can('accounting.post') && <Button type="primary" loading={saving} disabled={diff !== 0 || dr === 0} onClick={() => save(true)}>حفظ وترحيل</Button>}
      </Space>}>
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={6}><Form.Item name="entryDate" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="branchId" label="الفرع"><BranchSelect allowClear placeholder="الفرع الافتراضي" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="description" label="البيان" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
        </Row>
      </Form>
      <Table<Line> size="small" rowKey="key" pagination={false} dataSource={lines} scroll={{ x: 900 }}
        columns={[
          { title: 'الحساب', key: 'a', width: 300, render: (_, l) => <AccountSelect size="small" accounts={accounts} value={l.accountId} onChange={(v: any) => set(l.key, { accountId: v })} style={{ width: '100%' }} /> },
          { title: 'البيان', key: 'd', render: (_, l) => <Input size="small" value={l.description} onChange={e => set(l.key, { description: e.target.value })} /> },
          ...(showTags ? [
            { title: 'عميل', key: 't', width: 170, render: (_: any, l: Line) => <PartySelect partyType="customer" value={l.tenantId} onChange={v => set(l.key, { tenantId: v })} /> },
            { title: 'مورد', key: 'v', width: 170, render: (_: any, l: Line) => <PartySelect partyType="supplier" value={l.vendorId} onChange={v => set(l.key, { vendorId: v })} /> },
          ] : []),
          { title: 'مدين', key: 'dr', width: 130, render: (_, l) => <InputNumber size="small" min={0} style={{ width: '100%' }} value={l.debit} onChange={v => set(l.key, { debit: v ?? undefined, credit: v ? undefined : l.credit })} /> },
          { title: 'دائن', key: 'cr', width: 130, render: (_, l) => <InputNumber size="small" min={0} style={{ width: '100%' }} value={l.credit} onChange={v => set(l.key, { credit: v ?? undefined, debit: v ? undefined : l.debit })} /> },
          { title: '', key: 'x', width: 40, render: (_, l) => <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={lines.length <= 2} onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} /> },
        ]}
        summary={() => <Table.Summary.Row style={{ background: diff === 0 ? '#f6ffed' : '#fff1f0' }}>
          <Table.Summary.Cell index={0} colSpan={showTags ? 4 : 2}>
            <Space><b>الإجمالي</b>{diff === 0 ? <Tag color="green">متوازن</Tag> : <Tag color="red">الفرق {num(diff)}</Tag>}</Space>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1}><b>{num(dr)}</b></Table.Summary.Cell>
          <Table.Summary.Cell index={2}><b>{num(cr)}</b></Table.Summary.Cell>
          <Table.Summary.Cell index={3} />
        </Table.Summary.Row>} />
      <Space style={{ marginTop: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setLines(ls => [...ls, { key: Math.max(0, ...ls.map(x => x.key)) + 1 }])}>سطر</Button>
        <Button size="small" type="link" onClick={() => setShowTags(s => !s)}>{showTags ? 'إخفاء' : 'إظهار'} ربط العملاء/الموردين</Button>
      </Space>
    </Modal>
  );
}

export default function Journals() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Paged<any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [status, setStatus] = useState<string>();
  const [sourceType, setSourceType] = useState<string>();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);

  const query = (p: number, pageSize = 20) => ({ page: p, pageSize, search: search || undefined, status, sourceType,
    from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD') });
  const load = (p = page) => {
    setLoading(true);
    api<Paged<any>>('/journal-entries', { query: query(p) }).then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
    api<any[]>('/journal-entries/approvals').then(setApprovals).catch(() => setApprovals([]));
  };
  useEffect(() => { setPage(1); load(1); }, [range, status, sourceType, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportCsv = async () => {
    try {
      const all = await api<Paged<any>>('/journal-entries', { query: query(1, 5000) });
      downloadCsv('القيود', ['رقم القيد', 'التاريخ', 'البيان', 'المصدر', 'الحالة', 'المبلغ', 'أنشأه'],
        all.items.map(j => [j.journalNo, j.entryDate, j.description, SOURCE_TYPES[j.sourceType] ?? j.sourceType, JOURNAL_STATUS[j.status]?.label ?? j.status, j.total, j.createdBy]));
    } catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      {approvals.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={<span>قيود بانتظار الاعتماد: <b>{approvals.length}</b></span>}
        description={<Space wrap>{approvals.map(a => <Button key={a.id} size="small" onClick={() => setOpen(a.journalEntryId)}>
          {a.journalNo} · {money(a.amount)} · {a.requestedBy ?? ''}{a.canDecide && can('accounting.post') ? ' ✓' : ''}</Button>)}</Space>} />}
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input.Search allowClear placeholder="رقم القيد أو البيان…" style={{ width: 220 }} onSearch={setSearch} />
          <DatePicker.RangePicker value={range as any} onChange={r => setRange(r as any)} />
          <Select allowClear placeholder="الحالة" style={{ width: 130 }} value={status} onChange={setStatus}
            options={Object.entries(JOURNAL_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select allowClear placeholder="المصدر" style={{ width: 160 }} value={sourceType} onChange={setSourceType}
            options={Object.entries(SOURCE_TYPES).map(([k, v]) => ({ value: k, label: v }))} />
          <Button icon={<ReloadOutlined />} onClick={() => load()} />
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Excel</Button>
        </Space>
        {can('accounting.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>قيد يدوي</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows?.items} scroll={{ x: 900 }}
        onRow={j => ({ onClick: () => setOpen(j.id), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: 20, total: rows?.total, showSizeChanger: false, onChange: p => { setPage(p); load(p); } }}
        columns={[
          { title: 'رقم القيد', dataIndex: 'journalNo', width: 140, render: v => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
          { title: 'التاريخ', dataIndex: 'entryDate', width: 105 },
          { title: 'البيان', dataIndex: 'description', ellipsis: true },
          { title: 'المصدر', dataIndex: 'sourceType', width: 130, render: v => <Tag>{SOURCE_TYPES[v] ?? v}</Tag> },
          { title: 'المبلغ', dataIndex: 'total', width: 130, render: v => num(v) },
          { title: 'الحالة', dataIndex: 'status', width: 170, render: (v, j: any) => <Space size={2}>
            <Tag color={JOURNAL_STATUS[v]?.color}>{JOURNAL_STATUS[v]?.label ?? v}</Tag>
            {v === 'draft' && j.approval && <Badge status={j.approval === 'pending' ? 'warning' : j.approval === 'rejected' ? 'error' : 'success'} text={<span style={{ fontSize: 11 }}>{APPROVAL[j.approval]?.label}</span>} />}
          </Space> },
          { title: 'أنشأه', dataIndex: 'createdBy', width: 130 },
        ]} />
      <JournalDrawer id={open} onClose={() => setOpen(null)} onChanged={() => load()} />
      <NewJournal open={creating} onClose={() => setCreating(false)} onSaved={id => { setCreating(false); load(1); if (id) setOpen(id); }} />
    </div>
  );
}
