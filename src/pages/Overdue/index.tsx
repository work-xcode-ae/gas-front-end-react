import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Table, Tag, Button, Typography, Space, Segmented, Select, Input, Modal, Form, InputNumber, DatePicker, message, Statistic, Empty } from 'antd';
import { WarningOutlined, DollarOutlined, DownloadOutlined, ReloadOutlined, TeamOutlined, BankOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useGlobalFilters } from '../../context/GlobalFilters';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';
const money = (n?: number) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Bucket = 'b30' | 'b60' | 'b90' | 'b90p';
const BUCKETS: { key: Bucket; label: string; color: string; bg: string; test: (d: number) => boolean }[] = [
  { key: 'b30', label: '1 - 30 يوم', color: '#faad14', bg: '#fffbe6', test: d => d <= 30 },
  { key: 'b60', label: '31 - 60 يوم', color: '#fa8c16', bg: '#fff7e6', test: d => d > 30 && d <= 60 },
  { key: 'b90', label: '61 - 90 يوم', color: '#f5222d', bg: '#fff1f0', test: d => d > 60 && d <= 90 },
  { key: 'b90p', label: 'أكثر من 90 يوم', color: '#a8071a', bg: '#ffccc7', test: d => d > 90 },
];
const bucketOf = (days: number) => BUCKETS.find(b => b.test(days))!;
const METHODS = [
  { value: 'cash', label: 'نقداً' }, { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'cheque', label: 'شيك' }, { value: 'card', label: 'بطاقة' }, { value: 'online', label: 'إلكتروني' },
];

interface Inv {
  id: number; invoiceNo: string; tenantId: number; customer?: string; buildingId?: number; buildingCode?: string; building?: string; contractNo?: string; unit?: string;
  date: string; dueDate: string; typeLabel?: string; amount: number; paid: number; balance: number; status: string;
}

const OverduePage: React.FC = () => {
  const { can } = useAuth();
  const canPay = can('payments.manage');
  const { branchId } = useGlobalFilters();
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [view, setView] = useState<'invoices' | 'customers' | 'buildings'>('invoices');
  const [bucket, setBucket] = useState<Bucket | undefined>();
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [payInv, setPayInv] = useState<Inv | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const today = dayjs().startOf('day');

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<Inv>>('/invoices', { query: { overdueOnly: true, pageSize: 0, branchId, sort: 'dueDate' } })
      .then(r => setRows(r.items.filter(i => Number(i.balance) > 0)))
      .catch(e => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [branchId]);
  useEffect(() => { load(); }, [load, key]);

  const enriched = useMemo(() => rows.map(r => ({ ...r, days: Math.max(1, today.diff(dayjs(r.dueDate), 'day')) })), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const buildings = useMemo(() => {
    const m = new Map<number, string>();
    enriched.forEach(r => r.buildingId && m.set(r.buildingId, `${r.buildingCode ?? ''} — ${r.building ?? ''}`));
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [enriched]);
  const filtered = enriched.filter(r =>
    (!bucket || bucketOf(r.days).key === bucket) && (!buildingId || r.buildingId === buildingId) &&
    (!search || `${r.invoiceNo} ${r.customer ?? ''} ${r.unit ?? ''} ${r.contractNo ?? ''}`.toLowerCase().includes(search.toLowerCase())));

  const total = filtered.reduce((s, r) => s + Number(r.balance), 0);
  const byBucket = BUCKETS.map(b => {
    const list = enriched.filter(r => bucketOf(r.days).key === b.key && (!buildingId || r.buildingId === buildingId));
    return { ...b, count: list.length, amount: list.reduce((s, r) => s + Number(r.balance), 0) };
  });
  const group = (keyOf: (r: typeof filtered[number]) => string, label: (r: typeof filtered[number]) => string) => {
    const m = new Map<string, { key: string; name: string; invoices: number; total: number; maxDays: number; b30: number; b60: number; b90: number; b90p: number; sample: typeof filtered[number] }>();
    filtered.forEach(r => {
      const k = keyOf(r);
      const g = m.get(k) ?? { key: k, name: label(r), invoices: 0, total: 0, maxDays: 0, b30: 0, b60: 0, b90: 0, b90p: 0, sample: r };
      g.invoices++; g.total += Number(r.balance); g.maxDays = Math.max(g.maxDays, r.days); g[bucketOf(r.days).key] += Number(r.balance);
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  };
  const byCustomer = useMemo(() => group(r => String(r.tenantId), r => r.customer ?? `#${r.tenantId}`), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const byBuilding = useMemo(() => group(r => String(r.buildingId ?? 0), r => (r.building ? `${r.buildingCode ?? ''} — ${r.building}` : 'بدون مبنى')), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPay = (r: Inv) => { form.setFieldsValue({ amount: Number(r.balance), date: today, method: 'cash', reference: undefined, notes: undefined }); setPayInv(r); };
  const pay = async () => {
    if (!payInv) return;
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<any>('/payments', { method: 'POST', body: {
        tenantId: payInv.tenantId, invoiceId: payInv.id, amount: v.amount, date: v.date.format('YYYY-MM-DD'), method: v.method, reference: v.reference || null, notes: v.notes || null,
      } });
      message.success(`تم تسجيل الدفعة${r?.receiptNo ? ` — سند ${r.receiptNo}` : ''}`);
      setPayInv(null);
      load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ['رقم الفاتورة', 'العميل', 'المبنى', 'الوحدة', 'العقد', 'تاريخ الفاتورة', 'تاريخ الاستحقاق', 'أيام التأخير', 'الفئة', 'الإجمالي', 'المدفوع', 'المتبقي'];
    const lines = [head.join(','), ...filtered.map(r => [r.invoiceNo, r.customer, r.building, r.unit, r.contractNo, r.date, r.dueDate, r.days, bucketOf(r.days).label, r.amount, r.paid, r.balance].map(esc).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `المتأخرات ${today.format('YYYY-MM-DD')}.csv`;
    a.click();
  };

  const bucketCols = BUCKETS.map(b => ({ title: b.label, dataIndex: b.key, align: 'end' as const, render: (v: number) => (v ? <span style={{ color: b.color }}>{money(v)}</span> : '—') }));
  const groupColumns = (title: string) => [
    { title, dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'عدد الفواتير', dataIndex: 'invoices', align: 'center' as const },
    ...bucketCols,
    { title: 'الإجمالي', dataIndex: 'total', align: 'end' as const, sorter: (a: any, b: any) => a.total - b.total, render: (v: number) => <Text strong style={{ color: '#d4380d' }}>{money(v)}</Text> },
    { title: 'أقدم تأخير', dataIndex: 'maxDays', align: 'center' as const, render: (v: number) => <Tag color={bucketOf(v).color}>{v} يوم</Tag> },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: `linear-gradient(135deg, #a8071a 0%, #5c0011 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><WarningOutlined /></span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>المتأخرات</div>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 12.5 }}>الفواتير التي تجاوزت تاريخ الاستحقاق ولم تُسدد بالكامل — حتى {today.format('YYYY-MM-DD')}</div>
        </div>
        <Statistic value={enriched.reduce((s, r) => s + Number(r.balance), 0)} precision={2} valueStyle={{ color: '#fff', fontWeight: 700 }} suffix={<span style={{ fontSize: 13 }}>د.إ</span>}
          title={<span style={{ color: 'rgba(255,255,255,.75)' }}>إجمالي المتأخرات ({enriched.length} فاتورة · {new Set(enriched.map(r => r.tenantId)).size} عميل)</span>} />
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        {byBucket.map(b => (
          <Col xs={12} lg={6} key={b.key}>
            <Card size="small" hoverable onClick={() => setBucket(bucket === b.key ? undefined : b.key)}
              style={{ borderRadius: 10, background: b.bg, border: bucket === b.key ? `2px solid ${b.color}` : '1px solid transparent' }}>
              <div style={{ fontSize: 12, color: '#666' }}>{b.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: b.color }}>{money(b.amount)} <span style={{ fontSize: 12 }}>د.إ</span></div>
              <div style={{ fontSize: 11, color: '#888' }}>{b.count} فاتورة{bucket === b.key ? ' · مُصفّى' : ''}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={24} lg={10}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title={<Text strong>توزيع المتأخرات حسب العمر</Text>}>
            {enriched.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد متأخرات" /> : (
              <ReactApexChart type="donut" height={240} series={byBucket.map(b => Math.round(b.amount))}
                options={{ labels: byBucket.map(b => b.label), colors: byBucket.map(b => b.color), legend: { position: 'bottom' }, chart: { fontFamily: 'inherit' },
                  tooltip: { y: { formatter: (v: number) => `${money(v)} د.إ` } }, dataLabels: { formatter: (v: number) => `${Math.round(v)}%` } }} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card bordered={false} style={{ borderRadius: 12, height: '100%' }} title={<Text strong>أعلى 10 مبانٍ في المتأخرات</Text>}>
            {byBuilding.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد متأخرات" /> : (
              <ReactApexChart type="bar" height={240} series={[{ name: 'المتأخر', data: byBuilding.slice(0, 10).map(b => Math.round(b.total)) }]}
                options={{ chart: { toolbar: { show: false }, fontFamily: 'inherit' }, colors: ['#d4380d'], dataLabels: { enabled: false },
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } }, xaxis: { categories: byBuilding.slice(0, 10).map(b => b.name) },
                  tooltip: { y: { formatter: (v: number) => `${money(v)} د.إ` } }, grid: { borderColor: '#f0f0f0' } }} />
            )}
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}
        title={<Segmented value={view} onChange={v => setView(v as any)} options={[
          { value: 'invoices', label: <span><FileTextOutlined /> الفواتير ({filtered.length})</span> },
          { value: 'customers', label: <span><TeamOutlined /> حسب العميل ({byCustomer.length})</span> },
          { value: 'buildings', label: <span><BankOutlined /> حسب المبنى ({byBuilding.length})</span> },
        ]} />}
        extra={<Space wrap>
          <Input.Search allowClear placeholder="رقم الفاتورة، العميل، الوحدة…" style={{ width: 220 }} onSearch={setSearch} onChange={e => !e.target.value && setSearch('')} />
          <Select allowClear placeholder="كل المباني" style={{ width: 200 }} value={buildingId} onChange={setBuildingId} options={buildings} showSearch optionFilterProp="label" />
          <Select allowClear placeholder="كل الأعمار" style={{ width: 140 }} value={bucket} onChange={setBucket} options={BUCKETS.map(b => ({ value: b.key, label: b.label }))} />
          <Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)}>تحديث</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!filtered.length}>تصدير</Button>
        </Space>}>
        {view === 'invoices' && (
          <Table<typeof filtered[number]> size="small" rowKey="id" loading={loading} dataSource={filtered} scroll={{ x: 1000 }}
            pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} فاتورة · ${money(total)} د.إ` }}
            locale={{ emptyText: <Empty description="لا توجد فواتير متأخرة 🎉" /> }}
            columns={[
              { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: (v, r) => <div><Text style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text><div style={{ fontSize: 11, color: '#888' }}>{r.typeLabel}</div></div> },
              { title: 'العميل', dataIndex: 'customer', render: (v, r) => <div>{v}{r.unit && <div style={{ fontSize: 11, color: '#888' }}>{r.buildingCode} · وحدة {r.unit}</div>}</div> },
              { title: 'المبنى', dataIndex: 'building', responsive: ['lg'] },
              { title: 'التاريخ', dataIndex: 'date', width: 100 },
              { title: 'الاستحقاق', dataIndex: 'dueDate', width: 100, sorter: (a, b) => a.dueDate.localeCompare(b.dueDate) },
              { title: 'التأخير', dataIndex: 'days', width: 110, sorter: (a, b) => a.days - b.days, defaultSortOrder: 'descend',
                render: (v: number) => <Tag color={bucketOf(v).color}>{v} يوم</Tag> },
              { title: 'الإجمالي', dataIndex: 'amount', align: 'end', render: v => money(v) },
              { title: 'المدفوع', dataIndex: 'paid', align: 'end', render: v => <span style={{ color: '#52c41a' }}>{money(v)}</span> },
              { title: 'المتبقي', dataIndex: 'balance', align: 'end', sorter: (a, b) => a.balance - b.balance, render: v => <Text strong style={{ color: '#d4380d' }}>{money(v)}</Text> },
              ...(canPay ? [{ title: '', key: 'pay', width: 110, render: (_: any, r: Inv) => <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => openPay(r)}>تسجيل دفعة</Button> }] : []),
            ]} />
        )}
        {view === 'customers' && (
          <Table size="small" rowKey="key" loading={loading} dataSource={byCustomer} columns={groupColumns('العميل')} scroll={{ x: 900 }} pagination={{ pageSize: 20 }}
            expandable={{ expandedRowRender: g => (
              <Table size="small" rowKey="id" pagination={false} dataSource={filtered.filter(r => String(r.tenantId) === g.key)}
                columns={[{ title: 'الفاتورة', dataIndex: 'invoiceNo' }, { title: 'المبنى / الوحدة', render: (_: any, r: any) => `${r.buildingCode ?? ''} ${r.unit ? `· ${r.unit}` : ''}` },
                  { title: 'الاستحقاق', dataIndex: 'dueDate' }, { title: 'التأخير', dataIndex: 'days', render: (v: number) => <Tag color={bucketOf(v).color}>{v} يوم</Tag> },
                  { title: 'المتبقي', dataIndex: 'balance', render: (v: number) => money(v) },
                  ...(canPay ? [{ title: '', key: 'p', render: (_: any, r: Inv) => <Button size="small" type="link" icon={<DollarOutlined />} onClick={() => openPay(r)}>دفعة</Button> }] : [])]} />
            ) }} />
        )}
        {view === 'buildings' && (
          <Table size="small" rowKey="key" loading={loading} dataSource={byBuilding} columns={groupColumns('المبنى')} scroll={{ x: 900 }} pagination={{ pageSize: 20 }} />
        )}
      </Card>

      <Modal open={!!payInv} title={`تسجيل دفعة — ${payInv?.invoiceNo ?? ''}`} okText="حفظ الدفعة" cancelText="إلغاء" onOk={pay} confirmLoading={saving} onCancel={() => setPayInv(null)} destroyOnClose>
        {payInv && <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>{payInv.customer} — المتبقي <Text strong style={{ color: '#d4380d' }}>{money(payInv.balance)} د.إ</Text> · متأخرة منذ {payInv.dueDate}</div>}
        <Form form={form} layout="vertical">
          <Form.Item name="amount" label="المبلغ" rules={[{ required: true, message: 'أدخل المبلغ' }]}><InputNumber min={0.01} max={Number(payInv?.balance ?? 0)} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(today, 'day')} /></Form.Item>
          <Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}><Select options={METHODS} /></Form.Item>
          <Form.Item name="reference" label="رقم المرجع / الشيك"><Input dir="ltr" /></Form.Item>
          <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OverduePage;
