import { useEffect, useState } from 'react';
import { Select, Card, Tabs, Table, Button, Space, DatePicker, InputNumber, Input, Tag, Alert, Upload, Typography, Row, Col, Statistic, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, SaveOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AccountSelect, BranchSelect, JOURNAL_STATUS, PRIMARY, downloadCsv, num, parseCsv, useAccounts } from './shared';

const { Text } = Typography;
interface GlRow { key: number; accountId?: number; debit?: number; credit?: number; description?: string }
interface PartyRow { key: number; id?: number; code?: string; name?: string; amount?: number; dueDate?: string; reference?: string; notes?: string }
let seq = 1;

const readFile = (file: File) => new Promise<string[][]>((res, rej) => { const r = new FileReader(); r.onload = () => res(parseCsv(String(r.result ?? ''))); r.onerror = rej; r.readAsText(file, 'utf-8'); });
const isHeader = (row: string[]) => row.some(c => /code|account|amount|رقم|الحساب|المبلغ|الرمز/i.test(c));
const n = (s?: string) => { const v = Number(String(s ?? '').replace(/,/g, '').trim()); return isFinite(v) && v !== 0 ? v : undefined; };

function PartyEditor({ partyType, date, branchId, onDone }: { partyType: 'customer' | 'supplier'; date: Dayjs; branchId?: number; onDone: () => void }) {
  const [rows, setRows] = useState<PartyRow[]>([{ key: seq++ }]);
  const [opts, setOpts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const search = (s?: string) => api<any[]>('/statements/parties', { query: { partyType, search: s || undefined } }).then(setOpts).catch(() => setOpts([]));
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key: number, p: Partial<PartyRow>) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...p } : r));
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const importCsv = async (file: File) => {
    try {
      let data = await readFile(file);
      if (data.length && isHeader(data[0])) data = data.slice(1);
      const parsed = data.filter(r => r[0]).map(r => ({ key: seq++, code: r[0].trim(), amount: n(r[1]), dueDate: r[2]?.trim() || undefined, reference: r[3]?.trim() || undefined, notes: r[4]?.trim() || undefined }));
      setRows(parsed.length ? parsed : [{ key: seq++ }]);
      message.success(`تم استيراد ${parsed.length} سطر — راجعها ثم احفظ`);
    } catch { message.error('تعذر قراءة الملف'); }
    return false;
  };
  const save = async () => {
    const valid = rows.filter(r => (r.id || r.code) && (r.amount ?? 0) > 0);
    if (!valid.length) { message.warning('لا توجد أسطر صالحة'); return; }
    setSaving(true);
    try {
      await api(`/opening-balances/${partyType === 'customer' ? 'customers' : 'suppliers'}`, { method: 'POST', body: { branchId, date: date.format('YYYY-MM-DD'),
        lines: valid.map(r => ({ id: r.id, code: r.id ? undefined : r.code, amount: r.amount, dueDate: r.dueDate, reference: r.reference, notes: r.notes })) } });
      message.success('تم تسجيل الأرصدة الافتتاحية'); setRows([{ key: seq++ }]); onDone();
    } catch (e) { message.error(errorMessage(e), 8); } finally { setSaving(false); }
  };
  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={importCsv}><Button icon={<UploadOutlined />}>استيراد CSV</Button></Upload>
        <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadCsv(`نموذج-${partyType}`, ['code', 'amount', 'dueDate', 'reference', 'notes'], [['C-0001', 1500, dayjs().format('YYYY-MM-DD'), 'INV-OLD-1', '']])}>نموذج الملف</Button>
        <Text type="secondary" style={{ fontSize: 12 }}>الأعمدة: الرمز، المبلغ، تاريخ الاستحقاق، المرجع، ملاحظات</Text>
      </Space>
      <Table<PartyRow> size="small" rowKey="key" pagination={false} dataSource={rows} scroll={{ x: 900 }}
        columns={[
          { title: partyType === 'customer' ? 'العميل' : 'المورد', key: 'p', width: 280, render: (_, r) => r.code && !r.id
            ? <Space><Tag>{r.code}</Tag><Button size="small" type="link" onClick={() => set(r.key, { code: undefined })}>تغيير</Button></Space>
            : <PartyPicker opts={opts} onSearch={search} value={r.id} onChange={(id, o) => set(r.key, { id, code: o?.code, name: o?.name })} /> },
          { title: 'المبلغ', key: 'a', width: 140, render: (_, r) => <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.amount} onChange={v => set(r.key, { amount: v ?? undefined })} /> },
          { title: 'الاستحقاق', key: 'd', width: 150, render: (_, r) => <DatePicker size="small" value={r.dueDate ? dayjs(r.dueDate) : null} onChange={d => set(r.key, { dueDate: d?.format('YYYY-MM-DD') })} /> },
          { title: 'المرجع', key: 'r', width: 150, render: (_, r) => <Input size="small" value={r.reference} onChange={e => set(r.key, { reference: e.target.value })} /> },
          { title: 'ملاحظات', key: 'n', render: (_, r) => <Input size="small" value={r.notes} onChange={e => set(r.key, { notes: e.target.value })} /> },
          { title: '', key: 'x', width: 40, render: (_, r) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setRows(rs => rs.length > 1 ? rs.filter(x => x.key !== r.key) : rs)} /> },
        ]}
        summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0}><b>الإجمالي ({rows.filter(r => r.amount).length})</b></Table.Summary.Cell>
          <Table.Summary.Cell index={1} colSpan={5}><b>{num(total)}</b></Table.Summary.Cell>
        </Table.Summary.Row>} />
      <Space style={{ marginTop: 8 }}>
        <Button size="small" icon={<PlusOutlined />} onClick={() => setRows(rs => [...rs, { key: seq++ }])}>سطر</Button>
        <Popconfirm title={`تسجيل ${rows.filter(r => r.amount).length} رصيد بإجمالي ${num(total)}؟`} okText="تسجيل" cancelText="إلغاء" onConfirm={save}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving}>تسجيل الأرصدة</Button>
        </Popconfirm>
      </Space>
    </div>
  );
}

function PartyPicker({ opts, onSearch, value, onChange }: { opts: any[]; onSearch: (s?: string) => void; value?: number; onChange: (id?: number, o?: any) => void }) {
  return <Select size="small" allowClear showSearch filterOption={false} onSearch={onSearch} style={{ width: 260 }} value={value} placeholder="بحث…"
    onChange={(v?: number) => onChange(v, opts.find(o => o.id === v))}
    options={opts.map(o => ({ value: o.id, label: `${o.code ? `${o.code} — ` : ''}${o.name ?? ''}` }))} />;
}

export default function OpeningBalances() {
  const { can } = useAuth();
  const accounts = useAccounts();
  const [status, setStatus] = useState<any>(null);
  const [date, setDate] = useState<Dayjs>(dayjs().startOf('year'));
  const [branchId, setBranchId] = useState<number>();
  const [gl, setGl] = useState<GlRow[]>([{ key: seq++ }, { key: seq++ }]);
  const [saving, setSaving] = useState(false);
  const load = () => api<any>('/opening-balances').then(setStatus).catch(e => message.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const control: number[] = status?.controlAccounts ?? [];
  const postable = accounts.filter(a => a.isPostable !== false && !a.isGroup && !control.includes(a.id));
  const setLine = (key: number, p: Partial<GlRow>) => setGl(rs => rs.map(r => r.key === key ? { ...r, ...p } : r));
  const dr = gl.reduce((s, r) => s + (r.debit ?? 0), 0), cr = gl.reduce((s, r) => s + (r.credit ?? 0), 0), diff = Math.round((dr - cr) * 100) / 100;

  const importGl = async (file: File) => {
    try {
      let data = await readFile(file);
      if (data.length && isHeader(data[0])) data = data.slice(1);
      const missing: string[] = [];
      const parsed = data.filter(r => r[0]).map(r => {
        const acc = accounts.find(a => a.accountCode === r[0].trim());
        if (!acc) missing.push(r[0]);
        return { key: seq++, accountId: acc?.id, debit: n(r[1]), credit: n(r[2]), description: r[3]?.trim() || undefined };
      });
      setGl(parsed.length ? parsed : [{ key: seq++ }]);
      if (missing.length) message.warning(`حسابات غير موجودة: ${missing.join('، ')}`, 8); else message.success(`تم استيراد ${parsed.length} سطر`);
    } catch { message.error('تعذر قراءة الملف'); }
    return false;
  };
  const saveGl = async () => {
    const lines = gl.filter(r => r.accountId && ((r.debit ?? 0) > 0 || (r.credit ?? 0) > 0));
    if (!lines.length) { message.warning('لا توجد أسطر'); return; }
    setSaving(true);
    try {
      const r = await api<any>('/opening-balances/gl', { method: 'POST', body: { branchId, date: date.format('YYYY-MM-DD'),
        lines: lines.map(l => ({ accountId: l.accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, description: l.description })) } });
      message.success(`تم إنشاء القيد الافتتاحي ${r.journalNo}${r.difference ? ` — الفرق ${num(r.difference)} حُمّل على حساب الأرصدة الافتتاحية` : ''}`, 6);
      setGl([{ key: seq++ }, { key: seq++ }]); load();
    } catch (e) { message.error(errorMessage(e), 8); } finally { setSaving(false); }
  };

  if (!can('accounting.post')) return <Alert type="info" showIcon message="إدخال الأرصدة الافتتاحية يتطلب صلاحية الترحيل (accounting.post)." />;

  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="الأرصدة الافتتاحية تُسجّل مرة واحدة لكل طرف/فرع في تاريخ البداية. الفرق يُحمّل على حساب «أرصدة افتتاحية» ضمن حقوق الملكية."
        description={<span>حساب الأرصدة الافتتاحية: <b>{status?.openingEquityAccount ?? 'سيُنشأ تلقائياً (3301)'}</b>. أرصدة العملاء والموردين تُدخل من تبويبيهما (ذمم مدينة/دائنة) وليس ضمن قيد الحسابات.</span>} />
      <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
        <Space wrap>
          <span>تاريخ الأرصدة:</span><DatePicker value={date} onChange={d => d && setDate(d)} allowClear={false} />
          <span>الفرع:</span><BranchSelect allowClear placeholder="الفرع الافتراضي" style={{ width: 180 }} value={branchId} onChange={(v: any) => setBranchId(v)} />
        </Space>
      </Card>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={8}><Card size="small"><Statistic title="قيود افتتاحية" value={status?.journals?.filter((j: any) => !j.reversed).length ?? 0} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="أرصدة العملاء" value={num(status?.customersTotal)} suffix={<Text type="secondary" style={{ fontSize: 12 }}>({status?.customers?.length ?? 0})</Text>} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="أرصدة الموردين" value={num(status?.suppliersTotal)} suffix={<Text type="secondary" style={{ fontSize: 12 }}>({status?.suppliers?.length ?? 0})</Text>} /></Card></Col>
      </Row>
      <Card size="small" style={{ borderRadius: 12 }}>
        <Tabs items={[
          { key: 'gl', label: 'أرصدة الحسابات', children: <div>
            <Space wrap style={{ marginBottom: 8 }}>
              <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={importGl}><Button icon={<UploadOutlined />}>استيراد CSV</Button></Upload>
              <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadCsv('نموذج-أرصدة-الحسابات', ['accountCode', 'debit', 'credit', 'description'], [['1101', 5000, '', 'رصيد الصندوق']])}>نموذج الملف</Button>
            </Space>
            <Table<GlRow> size="small" rowKey="key" pagination={false} dataSource={gl}
              columns={[
                { title: 'الحساب', key: 'a', width: 320, render: (_, r) => <AccountSelect size="small" accounts={postable} value={r.accountId} onChange={(v: any) => setLine(r.key, { accountId: v })} style={{ width: '100%' }} /> },
                { title: 'البيان', key: 'd', render: (_, r) => <Input size="small" value={r.description} onChange={e => setLine(r.key, { description: e.target.value })} /> },
                { title: 'مدين', key: 'dr', width: 140, render: (_, r) => <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.debit} onChange={v => setLine(r.key, { debit: v ?? undefined, credit: v ? undefined : r.credit })} /> },
                { title: 'دائن', key: 'cr', width: 140, render: (_, r) => <InputNumber size="small" min={0} style={{ width: '100%' }} value={r.credit} onChange={v => setLine(r.key, { credit: v ?? undefined, debit: v ? undefined : r.debit })} /> },
                { title: '', key: 'x', width: 40, render: (_, r) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setGl(rs => rs.length > 1 ? rs.filter(x => x.key !== r.key) : rs)} /> },
              ]}
              summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={2}><Space><b>الإجمالي</b>{diff !== 0 && <Tag color="gold">الفرق {num(diff)} → حساب الأرصدة الافتتاحية</Tag>}</Space></Table.Summary.Cell>
                <Table.Summary.Cell index={2}><b>{num(dr)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3}><b>{num(cr)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
              </Table.Summary.Row>} />
            <Space style={{ marginTop: 8 }}>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setGl(rs => [...rs, { key: seq++ }])}>سطر</Button>
              <Popconfirm title="إنشاء وترحيل القيد الافتتاحي؟" okText="ترحيل" cancelText="إلغاء" onConfirm={saveGl}>
                <Button type="primary" icon={<SaveOutlined />} loading={saving}>ترحيل القيد الافتتاحي</Button>
              </Popconfirm>
            </Space>
            {status?.journals?.length > 0 && <Table size="small" style={{ marginTop: 16 }} rowKey="id" pagination={false} dataSource={status.journals} title={() => <b style={{ color: PRIMARY }}>القيود الافتتاحية المسجلة</b>}
              columns={[{ title: 'رقم القيد', dataIndex: 'journalNo' }, { title: 'التاريخ', dataIndex: 'entryDate' }, { title: 'المبلغ', dataIndex: 'total', render: num },
                { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={JOURNAL_STATUS[s]?.color}>{JOURNAL_STATUS[s]?.label ?? s}</Tag> }]} />}
          </div> },
          { key: 'customers', label: 'أرصدة العملاء', children: <div>
            <PartyEditor partyType="customer" date={date} branchId={branchId} onDone={load} />
            {status?.customers?.length > 0 && <Table size="small" style={{ marginTop: 16 }} rowKey="id" dataSource={status.customers} pagination={{ pageSize: 20 }} title={() => <b style={{ color: PRIMARY }}>المسجّل</b>}
              columns={[{ title: 'الفاتورة', dataIndex: 'invoiceNo' }, { title: 'العميل', key: 'n', render: (_, c: any) => <span>{c.name} {c.code && <Tag>{c.code}</Tag>}</span> },
                { title: 'التاريخ', dataIndex: 'date' }, { title: 'الاستحقاق', dataIndex: 'dueDate' }, { title: 'المبلغ', dataIndex: 'amount', render: num }]} />}
          </div> },
          { key: 'suppliers', label: 'أرصدة الموردين', children: <div>
            <PartyEditor partyType="supplier" date={date} branchId={branchId} onDone={load} />
            {status?.suppliers?.length > 0 && <Table size="small" style={{ marginTop: 16 }} rowKey="id" dataSource={status.suppliers} pagination={{ pageSize: 20 }} title={() => <b style={{ color: PRIMARY }}>المسجّل</b>}
              columns={[{ title: 'الفاتورة', dataIndex: 'billNo' }, { title: 'المورد', key: 'n', render: (_, c: any) => <span>{c.name} {c.code && <Tag>{c.code}</Tag>}</span> },
                { title: 'التاريخ', dataIndex: 'date' }, { title: 'الاستحقاق', dataIndex: 'dueDate' }, { title: 'المبلغ', dataIndex: 'amount', render: num }]} />}
          </div> },
        ]} />
      </Card>
    </div>
  );
}
