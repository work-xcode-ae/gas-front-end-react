import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as AntCalendar, Card, Row, Col, Segmented, Select, DatePicker, Button, Space, Table, Tag, Typography, Empty, Modal, Form, Input, InputNumber,
  Switch, Popconfirm, Descriptions, Alert, Tooltip, message, Badge, Divider,
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, WarningOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, BellOutlined, CalendarOutlined, LineChartOutlined,
  UnorderedListOutlined, FieldTimeOutlined, ProfileOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useGlobalFilters } from '../../context/GlobalFilters';
import { PRIMARY, GOLD, money, BuildingSelect } from './shared';
import { InvoiceDrawer } from './SalesInvoices';
import { VoucherDrawer } from './Vouchers';

const { Text } = Typography;
const IN = '#389e0d';
const OUT = '#cf1322';

export interface CfItem {
  date: string; direction: 'in' | 'out'; source: string; sourceLabel: string; reference: string; counterparty?: string | null; buildingId?: number | null;
  building?: string | null; amount: number; paid: number; remaining: number; status: string; confidence: 'confirmed' | 'committed' | 'estimate';
  linkType: string; linkId: number; daysLate: number; branchId: number; note?: string | null;
}
interface ScheduleResp {
  from: string; to: string; items: CfItem[];
  totals: { expectedIn: number; expectedOut: number; overdueIn: number; overdueOut: number; overdueInCount: number; overdueOutCount: number };
  bySource: { source: string; label: string; direction: string; count: number; amount: number }[];
}

const SOURCES = [
  { value: 'invoice', label: 'فواتير العملاء' }, { value: 'installment', label: 'أقساط الفواتير' }, { value: 'amc', label: 'أقساط عقود الصيانة' },
  { value: 'contract_fee', label: 'رسوم عقود التوريد (تقديري)' }, { value: 'cheque', label: 'شيكات قيد التحصيل' }, { value: 'vendor_bill', label: 'فواتير الموردين' },
  { value: 'refill_po', label: 'أوامر شراء الغاز' }, { value: 'manual', label: 'بنود متوقعة يدوية' },
];
const STATUS: Record<string, { color: string; label: string }> = {
  due: { color: 'blue', label: 'مستحق' }, partial: { color: 'cyan', label: 'مسدد جزئياً' }, paid: { color: 'success', label: 'مسدد' },
  overdue: { color: 'error', label: 'متأخر' }, on_hold: { color: 'default', label: 'معلّق' },
};
const CONF: Record<string, { color: string; label: string }> = {
  confirmed: { color: 'green', label: 'مؤكد' }, committed: { color: 'gold', label: 'ملتزم به' }, estimate: { color: 'default', label: 'تقديري' },
};
const CATEGORIES = [
  { value: 'rent', label: 'إيجار' }, { value: 'salaries', label: 'رواتب' }, { value: 'owner_payment', label: 'دفعات ملاك المباني' }, { value: 'utilities', label: 'خدمات ومرافق' },
  { value: 'government', label: 'رسوم حكومية' }, { value: 'loan', label: 'قروض / تمويل' }, { value: 'other_income', label: 'إيرادات أخرى' }, { value: 'other', label: 'أخرى' },
];
const RECURRENCE: Record<string, string> = { none: 'مرة واحدة', monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي' };
const LINK_HINT: Record<string, string> = {
  amc: 'المباني ← عقود الغاز ← عقد الصيانة، أو صفحة عقود الصيانة', supply_contract: 'صفحة عقود الغاز',
  vendor_bill: 'الفواتير والسندات ← فواتير المشتريات', refill: 'المباني ← طلبات التعبئة', manual: 'التقويم ← بنود متوقعة',
};
const catLabel = (c?: string) => CATEGORIES.find(x => x.value === c)?.label ?? c ?? '—';
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : Math.round(n).toLocaleString());
const weekStart = (d: Dayjs) => d.subtract((d.day() + 1) % 7, 'day').startOf('day'); // weeks start on Saturday
const sumRem = (list: CfItem[], dir: 'in' | 'out') => list.filter(i => i.direction === dir).reduce((s, i) => s + Number(i.remaining), 0);

// ═════════════ item table (shared by every list) ═════════════
function ItemsTable({ items, onOpen, compact }: { items: CfItem[]; onOpen: (i: CfItem) => void; compact?: boolean }) {
  return (
    <Table<CfItem> size="small" rowKey={(i) => `${i.source}-${i.linkId}-${i.reference}-${i.date}`} dataSource={items}
      pagination={compact ? false : { pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 900 }}
      locale={{ emptyText: <Empty description="لا توجد بنود" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      onRow={i => ({ onClick: () => onOpen(i), style: { cursor: 'pointer', background: i.status === 'overdue' ? '#fff1f0' : undefined, opacity: i.confidence === 'estimate' ? 0.8 : 1 } })}
      columns={[
        { title: 'التاريخ', dataIndex: 'date', width: 100, render: (v, i) => <div>{v}{i.daysLate > 0 && <div style={{ fontSize: 10, color: OUT }}>متأخر {i.daysLate} يوم</div>}</div> },
        { title: '', dataIndex: 'direction', width: 70, render: d => (d === 'in' ? <Tag color="green" icon={<ArrowDownOutlined />}>قبض</Tag> : <Tag color="red" icon={<ArrowUpOutlined />}>صرف</Tag>) },
        { title: 'المصدر', dataIndex: 'sourceLabel', width: 150 },
        { title: 'المرجع', dataIndex: 'reference', render: (v, i) => <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>{i.note && <div style={{ fontSize: 11, color: '#999' }}>{i.note}</div>}</div> },
        { title: 'الطرف', dataIndex: 'counterparty', render: (v, i) => <div>{v ?? '—'}{i.building && <div style={{ fontSize: 11, color: '#888' }}>{i.building}</div>}</div> },
        { title: 'المبلغ', dataIndex: 'amount', align: 'end' as const, render: v => money(v) },
        { title: 'المدفوع', dataIndex: 'paid', align: 'end' as const, render: v => (Number(v) ? money(v) : '—') },
        { title: 'المتبقي', dataIndex: 'remaining', align: 'end' as const, render: (v, i) => <Text strong style={{ color: i.direction === 'in' ? IN : OUT }}>{money(v)}</Text> },
        { title: 'الحالة', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> },
        { title: 'الدقة', dataIndex: 'confidence', width: 90, render: c => <Tag color={CONF[c]?.color}>{CONF[c]?.label ?? c}</Tag> },
      ]}
      summary={rows => (rows.length ? (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={7}><b>الصافي</b> — قبض {money(sumRem([...rows], 'in'))} · صرف {money(sumRem([...rows], 'out'))}</Table.Summary.Cell>
          <Table.Summary.Cell index={7} align="end"><b>{money(sumRem([...rows], 'in') - sumRem([...rows], 'out'))}</b></Table.Summary.Cell>
          <Table.Summary.Cell index={8} colSpan={2} />
        </Table.Summary.Row>) : null)} />
  );
}

// ═════════════ forecast ═════════════
function Forecast({ branchId }: { branchId?: number }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs().add(3, 'month')]);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');
  const [scenario, setScenario] = useState<'confirmed' | 'all'>('confirmed');
  const [includeOverdue, setIncludeOverdue] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    api<any>('/cashflow/forecast', { query: { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), granularity, scenario, includeOverdue, branchId } })
      .then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [range, granularity, scenario, includeOverdue, branchId]);
  useEffect(() => { load(); }, [load]);
  const periods: any[] = data?.periods ?? [];
  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={r => r && r[0] && r[1] && setRange([r[0], r[1]])} allowClear={false} />
        <Segmented value={granularity} onChange={v => setGranularity(v as 'day' | 'week' | 'month')} options={[{ value: 'day', label: 'يومي' }, { value: 'week', label: 'أسبوعي' }, { value: 'month', label: 'شهري' }]} />
        <Segmented value={scenario} onChange={v => setScenario(v as 'confirmed' | 'all')} options={[{ value: 'confirmed', label: 'المؤكد فقط' }, { value: 'all', label: 'مع التقديرات' }]} />
        <Space size={4}><Switch size="small" checked={includeOverdue} onChange={setIncludeOverdue} /><Text style={{ fontSize: 12 }}>إدراج المتأخرات في الفترة الأولى</Text></Space>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
      </Space>
      {data && (
        <>
          <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
            {[
              { l: `النقد الفعلي (${dayjs(data.actualCashDate).format('YYYY-MM-DD')})`, v: data.actualCash, c: PRIMARY },
              { l: 'الرصيد الافتتاحي للتوقع', v: data.opening, c: '#555' },
              { l: 'مقبوضات متوقعة', v: data.totals.expectedIn, c: IN },
              { l: 'مدفوعات متوقعة', v: data.totals.expectedOut, c: OUT },
              { l: 'الرصيد المتوقع في النهاية', v: data.closing, c: data.closing < 0 ? OUT : PRIMARY },
              { l: 'أدنى رصيد متوقع', v: data.lowestClosing, c: data.lowestClosing < 0 ? OUT : '#d48806' },
            ].map(k => (
              <Col key={k.l} xs={12} md={8} xl={4}><Card size="small" style={{ borderRadius: 12 }}><div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{money(k.v)}</div><div style={{ fontSize: 11, color: '#777' }}>{k.l}</div></Card></Col>
            ))}
          </Row>
          {data.lowestClosing < 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={`تحذير: يُتوقع أن ينخفض الرصيد إلى ${money(data.lowestClosing)} خلال الفترة — راجع مواعيد الدفع أو التحصيل.`} />}
          {(data.overdue.receivables > 0 || data.overdue.payables > 0) && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message={`متأخرات ${includeOverdue ? 'مدرجة في الفترة الأولى' : 'غير مدرجة'}: مستحقات من العملاء ${money(data.overdue.receivables)} (${data.overdue.receivablesCount}) · مستحقات للموردين ${money(data.overdue.payables)} (${data.overdue.payablesCount})`} />
          )}
          {data.cashAccounts.length === 0 && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="لم تُربط حسابات النقد والبنوك بطرق الدفع (المحاسبة ← ربط الحسابات)، لذلك الرصيد الفعلي صفر." />}
          <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }}>
            <ReactApexChart type="line" height={320}
              series={[
                { name: 'مقبوضات', type: 'column', data: periods.map(p => Math.round(p.expectedIn)) },
                { name: 'مدفوعات', type: 'column', data: periods.map(p => -Math.round(p.expectedOut)) },
                { name: 'الرصيد المتوقع', type: 'line', data: periods.map(p => Math.round(p.closing)) },
              ]}
              options={{
                chart: { stacked: false, toolbar: { show: false }, fontFamily: 'inherit' }, colors: [IN, OUT, GOLD], stroke: { width: [0, 0, 3], curve: 'smooth' },
                plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } }, dataLabels: { enabled: false }, legend: { position: 'top' },
                xaxis: { categories: periods.map(p => p.label) }, yaxis: { labels: { formatter: (v: number) => short(v) } },
                tooltip: { y: { formatter: (v: number) => money(Math.abs(v)) } },
                annotations: { yaxis: [{ y: 0, borderColor: '#999' }] },
              }} />
          </Card>
          <Table size="small" rowKey="label" pagination={false} dataSource={periods} scroll={{ x: 900 }}
            columns={[
              { title: 'الفترة', key: 'p', render: (_, p) => <div><b>{p.label}</b><div style={{ fontSize: 11, color: '#888' }}>{p.from} → {p.to}</div></div> },
              { title: 'الرصيد الافتتاحي', dataIndex: 'opening', align: 'end' as const, render: v => money(v) },
              { title: 'مقبوضات', dataIndex: 'expectedIn', align: 'end' as const, render: (v, p) => <div style={{ color: IN }}>{money(v)}{p.estimateIn > 0 && <div style={{ fontSize: 10, color: '#999' }}>منها تقديري {money(p.estimateIn)}</div>}</div> },
              { title: 'مدفوعات', dataIndex: 'expectedOut', align: 'end' as const, render: (v, p) => <div style={{ color: OUT }}>{money(v)}{p.estimateOut > 0 && <div style={{ fontSize: 10, color: '#999' }}>منها تقديري {money(p.estimateOut)}</div>}</div> },
              { title: 'الصافي', dataIndex: 'net', align: 'end' as const, render: v => <span style={{ color: v < 0 ? OUT : IN }}>{money(v)}</span> },
              { title: 'الرصيد الختامي', dataIndex: 'closing', align: 'end' as const, render: v => <b style={{ color: v < 0 ? OUT : undefined }}>{money(v)}</b> },
              { title: 'بنود', dataIndex: 'count', width: 60 },
            ]} />
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
            الرصيد الفعلي = أرصدة حسابات النقد والبنوك المرحّلة في الأستاذ العام. التوقع لا يغيّر أي قيد. «المؤكد» يشمل الفواتير والأقساط والشيكات وأوامر الشراء؛ «التقديرات» تشمل الرسوم الشهرية غير المفوترة والبنود اليدوية التقديرية.
          </div>
        </>
      )}
    </div>
  );
}

// ═════════════ manual expected items ═════════════
function ManualItems({ onChanged }: { onChanged: () => void }) {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const recurrence = Form.useWatch('recurrence', form);
  const load = useCallback(() => {
    setLoading(true);
    api<any[]>('/cashflow/items', { query: { includeInactive: showInactive } }).then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [showInactive]);
  useEffect(() => { load(); }, [load]);

  const open = (r: any | 'new') => {
    form.resetFields();
    if (r === 'new') form.setFieldsValue({ direction: 'out', category: 'rent', recurrence: 'monthly', confidence: 'confirmed', startDate: dayjs().startOf('month').add(1, 'month'), isActive: true });
    else form.setFieldsValue({ ...r, startDate: dayjs(r.startDate), endDate: r.endDate ? dayjs(r.endDate) : undefined });
    setEditing(r);
  };
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body = { ...v, startDate: v.startDate.format('YYYY-MM-DD'), endDate: v.endDate?.format('YYYY-MM-DD') ?? null, buildingId: v.buildingId ?? null };
      if (editing === 'new') await api('/cashflow/items', { method: 'POST', body });
      else await api(`/cashflow/items/${editing.id}`, { method: 'PUT', body });
      message.success('تم الحفظ');
      setEditing(null); load(); onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const remove = async (r: any) => {
    try { await api(`/cashflow/items/${r.id}`, { method: 'DELETE' }); message.success('تم الحذف'); load(); onChanged(); } catch (e) { message.error(errorMessage(e)); }
  };
  const canManage = can('payments.manage');
  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="بنود متوقعة ليس لها مستند بعد — مثل الإيجار والرواتب ودفعات ملاك المباني والرسوم الحكومية. تظهر في التقويم والتوقعات فقط ولا تؤثر على الحسابات." />
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space size={4}><Switch size="small" checked={showInactive} onChange={setShowInactive} /><Text style={{ fontSize: 12 }}>إظهار الموقوفة</Text></Space>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>بند متوقع</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={false} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="لا توجد بنود متوقعة" /> }}
        columns={[
          { title: '', dataIndex: 'direction', width: 70, render: d => (d === 'in' ? <Tag color="green">قبض</Tag> : <Tag color="red">صرف</Tag>) },
          { title: 'التصنيف', dataIndex: 'category', render: v => catLabel(v) },
          { title: 'الطرف', dataIndex: 'counterparty', render: (v, r) => <div>{v ?? '—'}{r.building && <div style={{ fontSize: 11, color: '#888' }}>{r.building}</div>}</div> },
          { title: 'المبلغ', dataIndex: 'amount', align: 'end' as const, render: v => money(v) },
          { title: 'التكرار', dataIndex: 'recurrence', render: v => RECURRENCE[v] ?? v },
          { title: 'من / إلى', key: 'd', render: (_, r) => `${r.startDate}${r.endDate ? ` → ${r.endDate}` : r.recurrence !== 'none' ? ' → مفتوح' : ''}` },
          { title: 'الموعد القادم', dataIndex: 'nextDate', render: v => v ?? '—' },
          { title: 'الدقة', dataIndex: 'confidence', render: c => <Tag color={CONF[c]?.color}>{CONF[c]?.label}</Tag> },
          { title: 'الحالة', dataIndex: 'isActive', render: v => (v ? <Tag color="success">نشط</Tag> : <Tag>موقوف</Tag>) },
          ...(canManage ? [{ title: '', key: 'a', width: 80, render: (_: any, r: any) => (
            <Space size={0}>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} />
              <Popconfirm title="حذف البند؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(r)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
            </Space>) }] : []),
        ]} />
      <Modal open={editing != null} title={editing === 'new' ? 'بند متوقع جديد' : 'تعديل البند'} okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnHidden width={640}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="direction" label="النوع" rules={[{ required: true }]}><Segmented block options={[{ value: 'in', label: 'قبض' }, { value: 'out', label: 'صرف' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="التصنيف"><Select options={CATEGORIES} /></Form.Item></Col>
            <Col span={8}><Form.Item name="amount" label="المبلغ (د.إ)" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="counterparty" label="الطرف"><Input placeholder="مثال: مالك مبنى الرحاب" /></Form.Item></Col>
            <Col span={12}><Form.Item name="buildingId" label="المبنى (اختياري)"><BuildingSelect style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="recurrence" label="التكرار"><Select options={Object.entries(RECURRENCE).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="startDate" label={recurrence === 'none' ? 'التاريخ' : 'أول موعد'} rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            {recurrence !== 'none' && <Col span={8}><Form.Item name="endDate" label="آخر موعد (اختياري)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>}
            <Col span={12}><Form.Item name="confidence" label="الدقة"><Segmented block options={[{ value: 'confirmed', label: 'مؤكد' }, { value: 'estimate', label: 'تقديري' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="البيان"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ═════════════ side list (reminders / overdue) ═════════════
function SideList({ items, onOpen, late }: { items: CfItem[]; onOpen: (i: CfItem) => void; late?: boolean }) {
  return (
    <>
      {items.map((i, n) => (
        <div key={n} onClick={() => onOpen(i)} style={{ cursor: 'pointer', padding: '6px 0', borderBottom: '1px dashed #eee', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12 }}><Tag color={i.direction === 'in' ? 'green' : 'red'} style={{ marginInlineEnd: 4 }}>{i.direction === 'in' ? 'قبض' : 'صرف'}</Tag>{i.counterparty ?? i.reference}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{late ? `${i.reference} · متأخر ${i.daysLate} يوم` : `${i.date} · ${i.sourceLabel}`}</div>
          </div>
          <Tooltip title={i.direction === 'in' ? 'مستحق لنا' : 'مستحق علينا'}><b style={{ color: i.direction === 'in' ? (late ? '#d48806' : IN) : OUT, whiteSpace: 'nowrap', fontSize: 12 }}>{money(i.remaining)}</b></Tooltip>
        </div>
      ))}
    </>
  );
}

// ═════════════ main page ═════════════
type View = 'month' | 'week' | 'day' | 'forecast' | 'items';

/** Payment calendar + cash-flow forecast (BRD §16). */
export default function CashflowCalendar() {
  const { branchId } = useGlobalFilters();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all');
  const [sources, setSources] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<string[]>([]);
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [data, setData] = useState<ScheduleResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState<CfItem[]>([]);
  const [remDays, setRemDays] = useState<7 | 30>(7);
  const [reloadKey, setReloadKey] = useState(0);
  const [openInvoice, setOpenInvoice] = useState<number | null>(null);
  const [openReceipt, setOpenReceipt] = useState<number | null>(null);
  const [detail, setDetail] = useState<CfItem | null>(null);

  const [from, to] = useMemo<[Dayjs, Dayjs]>(() => {
    if (view === 'week') { const s = weekStart(date); return [s, s.add(6, 'day')]; }
    if (view === 'day') return [date.startOf('day'), date.startOf('day')];
    return [date.startOf('month'), date.endOf('month')];
  }, [view, date]);

  const query = useMemo(() => ({
    direction: direction === 'all' ? undefined : direction, source: sources.length ? sources.join(',') : undefined,
    confidence: confidence.length ? confidence.join(',') : undefined, buildingId, branchId,
  }), [direction, sources, confidence, buildingId, branchId]);

  const load = useCallback(() => {
    if (view === 'forecast' || view === 'items') return;
    setLoading(true);
    api<ScheduleResp>('/cashflow/schedule', { query: { ...query, from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD'), includePaid: true } })
      .then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [view, from, to, query]);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => {
    api<ScheduleResp>('/cashflow/schedule', { query: { ...query, from: dayjs().format('YYYY-MM-DD'), to: dayjs().add(remDays, 'day').format('YYYY-MM-DD') } })
      .then(r => setReminders(r.items.filter(i => i.remaining > 0 && i.status !== 'overdue'))).catch(() => setReminders([]));
  }, [query, remDays, reloadKey]);

  const items = data?.items ?? [];
  const inRange = useMemo(() => items.filter(i => !dayjs(i.date).isBefore(from, 'day')), [items, from]);
  const overdue = useMemo(() => items.filter(i => i.status === 'overdue').sort((a, b) => b.daysLate - a.daysLate), [items]);
  const byDay = useMemo(() => {
    const m = new Map<string, { in: number; out: number; n: number; late: boolean }>();
    inRange.forEach(i => {
      const k = i.date.slice(0, 10);
      const v = m.get(k) ?? { in: 0, out: 0, n: 0, late: false };
      if (i.direction === 'in') v.in += Number(i.remaining); else v.out += Number(i.remaining);
      v.n++; if (i.status === 'overdue') v.late = true;
      m.set(k, v);
    });
    return m;
  }, [inRange]);
  const dayItems = inRange.filter(i => dayjs(i.date).isSame(date, 'day'));

  const openItem = (i: CfItem) => {
    if (i.linkType === 'invoice') setOpenInvoice(i.linkId);
    else if (i.linkType === 'receipt') setOpenReceipt(i.linkId);
    else setDetail(i);
  };

  const sumIn = sumRem(inRange, 'in');
  const sumOut = sumRem(inRange, 'out');
  const step = (n: number) => setDate(d => (view === 'month' ? d.add(n, 'month') : view === 'week' ? d.add(n * 7, 'day') : d.add(n, 'day')));

  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Segmented value={view} onChange={v => setView(v as View)} options={[
          { value: 'month', label: <span><CalendarOutlined /> شهر</span> }, { value: 'week', label: <span><UnorderedListOutlined /> أسبوع</span> },
          { value: 'day', label: <span><FieldTimeOutlined /> يوم</span> }, { value: 'forecast', label: <span><LineChartOutlined /> التدفق النقدي المتوقع</span> },
          { value: 'items', label: <span><ProfileOutlined /> بنود متوقعة</span> },
        ]} />
        {view !== 'forecast' && view !== 'items' && (
          <Space wrap>
            <Button onClick={() => step(-1)}>السابق</Button>
            <DatePicker picker={view === 'month' ? 'month' : 'date'} value={date} onChange={d => d && setDate(d)} allowClear={false} />
            <Button onClick={() => step(1)}>التالي</Button>
            <Button onClick={() => setDate(dayjs())}>اليوم</Button>
          </Space>
        )}
      </Space>

      {view === 'forecast' ? <Forecast branchId={branchId} /> : view === 'items' ? <ManualItems onChanged={() => setReloadKey(k => k + 1)} /> : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Segmented value={direction} onChange={v => setDirection(v as 'all' | 'in' | 'out')} options={[{ value: 'all', label: 'الكل' }, { value: 'in', label: 'مقبوضات' }, { value: 'out', label: 'مدفوعات' }]} />
            <Select mode="multiple" allowClear placeholder="المصدر" style={{ minWidth: 220 }} value={sources} onChange={setSources} options={SOURCES} maxTagCount="responsive" />
            <Select mode="multiple" allowClear placeholder="الدقة" style={{ minWidth: 160 }} value={confidence} onChange={setConfidence}
              options={Object.entries(CONF).map(([k, v]) => ({ value: k, label: v.label }))} />
            <BuildingSelect value={buildingId} onChange={setBuildingId} style={{ width: 200 }} />
            <Button icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)} loading={loading} />
          </Space>

          <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
            {[
              { l: 'مقبوضات متوقعة في الفترة', v: sumIn, c: IN },
              { l: 'مدفوعات متوقعة في الفترة', v: sumOut, c: OUT },
              { l: 'الصافي', v: sumIn - sumOut, c: sumIn - sumOut < 0 ? OUT : PRIMARY },
              { l: `متأخرات من العملاء (${data?.totals.overdueInCount ?? 0})`, v: data?.totals.overdueIn ?? 0, c: '#d48806' },
              { l: `متأخرات للموردين (${data?.totals.overdueOutCount ?? 0})`, v: data?.totals.overdueOut ?? 0, c: OUT },
            ].map(k => (
              <Col key={k.l} xs={12} md={8} style={{ flex: '1 1 160px' }}>
                <Card size="small" style={{ borderRadius: 12 }}><div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{money(k.v)}</div><div style={{ fontSize: 11, color: '#777' }}>{k.l}</div></Card>
              </Col>
            ))}
          </Row>

          <Row gutter={12}>
            <Col xs={24} xl={17}>
              {view === 'month' && (
                <>
                  <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }}>
                    <AntCalendar value={date} onSelect={(d, info) => { setDate(d); if (info.source === 'date') setView('day'); }}
                      headerRender={() => <div style={{ padding: '4px 8px', fontWeight: 700 }}>{date.format('YYYY-MM')}</div>}
                      cellRender={(d, info) => {
                        if (info.type !== 'date' || !d.isSame(date, 'month')) return null;
                        const v = byDay.get(d.format('YYYY-MM-DD'));
                        if (!v) return null;
                        return (
                          <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                            {v.in > 0 && <div style={{ color: IN }}>▼ {short(v.in)}</div>}
                            {v.out > 0 && <div style={{ color: OUT }}>▲ {short(v.out)}</div>}
                            {v.late && <Badge status="error" text={<span style={{ fontSize: 10 }}>متأخر</span>} />}
                          </div>
                        );
                      }} />
                  </Card>
                  <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }} title={`بنود ${date.format('YYYY-MM')} (${inRange.length})`}>
                    <ItemsTable items={inRange} onOpen={openItem} />
                  </Card>
                </>
              )}
              {view === 'week' && (
                <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }} title={`الأسبوع ${from.format('YYYY-MM-DD')} → ${to.format('YYYY-MM-DD')}`}>
                  {Array.from({ length: 7 }, (_, n) => from.add(n, 'day')).map(d => {
                    const list = inRange.filter(i => dayjs(i.date).isSame(d, 'day'));
                    const v = byDay.get(d.format('YYYY-MM-DD'));
                    return (
                      <div key={d.format('YYYY-MM-DD')} style={{ marginBottom: 10 }}>
                        <Divider titlePlacement="start" style={{ margin: '6px 0' }}>
                          <a onClick={() => { setDate(d); setView('day'); }}>{d.format('dddd YYYY-MM-DD')}</a>
                          {v && <span style={{ fontSize: 12, marginInlineStart: 8 }}><span style={{ color: IN }}>▼ {money(v.in)}</span> · <span style={{ color: OUT }}>▲ {money(v.out)}</span></span>}
                        </Divider>
                        {list.length > 0 ? <ItemsTable items={list} onOpen={openItem} compact /> : <Text type="secondary" style={{ fontSize: 12 }}>لا شيء</Text>}
                      </div>
                    );
                  })}
                </Card>
              )}
              {view === 'day' && (
                <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }} title={date.format('dddd YYYY-MM-DD')}>
                  <ItemsTable items={dayItems} onOpen={openItem} />
                </Card>
              )}
            </Col>
            <Col xs={24} xl={7}>
              <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }}
                title={<span><BellOutlined style={{ color: GOLD }} /> التذكيرات</span>}
                extra={<Segmented size="small" value={remDays} onChange={v => setRemDays(v as 7 | 30)} options={[{ value: 7, label: '7 أيام' }, { value: 30, label: '30 يوم' }]} />}>
                {reminders.length === 0 ? <Empty description="لا توجد مواعيد قريبة" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <SideList items={reminders.slice(0, 40)} onOpen={openItem} />}
              </Card>
              <Card size="small" style={{ borderRadius: 12, marginBottom: 12, borderColor: overdue.length ? '#ffccc7' : undefined }}
                title={<span><WarningOutlined style={{ color: OUT }} /> المتأخرات ({overdue.length})</span>}>
                {overdue.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>لا توجد متأخرات</Text> : <SideList items={overdue.slice(0, 40)} onOpen={openItem} late />}
              </Card>
              <Card size="small" style={{ borderRadius: 12 }} title="حسب المصدر">
                {(data?.bySource ?? []).length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : (data?.bySource ?? []).map(s => (
                  <div key={`${s.source}-${s.direction}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                    <span>{s.direction === 'in' ? '▼' : '▲'} {s.label} ({s.count})</span><b style={{ color: s.direction === 'in' ? IN : OUT }}>{money(s.amount)}</b>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </>
      )}

      <InvoiceDrawer id={openInvoice} onClose={() => setOpenInvoice(null)} onChanged={() => setReloadKey(k => k + 1)} />
      <VoucherDrawer party={openReceipt ? 'customer' : null} id={openReceipt} onClose={() => setOpenReceipt(null)} onChanged={() => setReloadKey(k => k + 1)} />
      <Modal open={!!detail} title={detail ? `${detail.sourceLabel} — ${detail.reference}` : ''} footer={null} onCancel={() => setDetail(null)}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="النوع">{detail.direction === 'in' ? 'قبض متوقع' : 'صرف متوقع'}</Descriptions.Item>
            <Descriptions.Item label="التاريخ">{detail.date}</Descriptions.Item>
            <Descriptions.Item label="الطرف">{detail.counterparty ?? '—'}</Descriptions.Item>
            {detail.building && <Descriptions.Item label="المبنى">{detail.building}</Descriptions.Item>}
            <Descriptions.Item label="المبلغ">{money(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="المدفوع">{money(detail.paid)}</Descriptions.Item>
            <Descriptions.Item label="المتبقي"><b>{money(detail.remaining)}</b></Descriptions.Item>
            <Descriptions.Item label="الحالة"><Tag color={STATUS[detail.status]?.color}>{STATUS[detail.status]?.label ?? detail.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="الدقة"><Tag color={CONF[detail.confidence]?.color}>{CONF[detail.confidence]?.label}</Tag></Descriptions.Item>
            {detail.note && <Descriptions.Item label="ملاحظة">{detail.note}</Descriptions.Item>}
            <Descriptions.Item label="أين تجده">{LINK_HINT[detail.linkType] ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
