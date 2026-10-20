import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, Row, Col, Input, Select, DatePicker, Modal, Form, InputNumber, Typography, message, Empty, Drawer, Descriptions, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, DollarOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { money, useTaxOptions, syncTaxLines, newTaxLine, TaxRateSelect } from './shared';
import { SupplierPaymentModal, VoucherDrawer } from './Vouchers';

const { Text } = Typography;
/** Expense type of a bill line — decides the cost account it posts to (Settings → account mapping). */
const BILL_ITEM_TYPES = [
  { value: 'gas_purchase', label: 'مشتريات غاز' },
  { value: 'maintenance', label: 'صيانة / مقاول' },
  { value: 'fixed_asset', label: 'أصل ثابت (يُرسمل)' },
  { value: 'gov_fees', label: 'رسوم حكومية' },
  { value: 'other', label: 'مصروفات أخرى' },
];
const BILL_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'غير مسددة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const SOURCE: Record<string, string> = { refill_request: 'طلب تعبئة', cd_renewal: 'رسوم الدفاع المدني', other: 'يدوية' };

export default function PurchaseBills() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('year'), dayjs()]);
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [payFor, setPayFor] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [voucher, setVoucher] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { api<any[]>('/vendors/options').then(r => setVendors(r.filter(v => v.code !== 'OWN-COMPANY'))).catch(() => setVendors([])); }, []);
  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/vendor-bills', { query: { pageSize: 0, vendorId, status, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD'), search: search || undefined } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [vendorId, status, range, search]);
  useEffect(() => { load(); }, [load]);

  const live = rows.filter(r => r.status !== 'cancelled' && r.status !== 'draft');
  const sum = (f: string, list = live) => list.reduce((s, r) => s + Number(r[f] ?? 0), 0);
  const overdue = live.filter(r => Number(r.balance) > 0 && r.dueDate && dayjs(r.dueDate).isBefore(dayjs(), 'day'));

  const openNew = () => { form.resetFields(); form.setFieldsValue({ billDate: dayjs(), dueDate: dayjs().add(30, 'day'), items: [{ description: '', quantity: 1, unitPrice: 0, ...newTaxLine(tax) }] }); setNewOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api('/vendor-bills', { method: 'POST', body: {
        vendorId: v.vendorId, billNo: v.billNo, billDate: v.billDate.format('YYYY-MM-DD'), dueDate: v.dueDate?.format('YYYY-MM-DD') ?? null, notes: v.notes || null,
        items: (v.items ?? []).map((i: any) => ({ itemType: i.itemType ?? 'other', description: i.description, quantity: i.quantity, uom: 'each', unitPrice: i.unitPrice, vatRate: i.vatRate ?? 0, taxRateId: i.taxRateId ?? null })),
      } });
      message.success('تم تسجيل فاتورة المشتريات');
      setNewOpen(false); load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const cancel = (b: any) => {
    let reason = '';
    Modal.confirm({
      title: `إلغاء الفاتورة ${b.billNo}؟`, okText: 'إلغاء الفاتورة', okButtonProps: { danger: true }, cancelText: 'رجوع',
      content: <Input.TextArea rows={2} placeholder="السبب" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => {
        if (!reason.trim()) { message.warning('اكتب السبب'); throw new Error('reason'); }
        try { await api(`/vendor-bills/${b.id}/cancel`, { method: 'POST', body: { reason } }); message.success('تم الإلغاء'); load(); setView(null); }
        catch (e) { message.error(errorMessage(e), 6); throw e; }
      },
    });
  };
  const items = Form.useWatch('items', form) as any[] | undefined;
  useTrackView('VendorBill', view?.id, view?.billNo);
  const billDate = Form.useWatch('billDate', form) as Dayjs | undefined;
  const tax = useTaxOptions(billDate, 'purchases');
  useEffect(() => { if (newOpen) syncTaxLines(form, 'items', tax); }, [tax, newOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = (items ?? []).reduce((t, i) => { const a = Number(i?.quantity ?? 0) * Number(i?.unitPrice ?? 0); return { sub: t.sub + a, vat: t.vat + a * Number(i?.vatRate ?? 0) / 100 }; }, { sub: 0, vat: 0 });

  return (
    <div>
      <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
        {[
          { label: `إجمالي المشتريات (${live.length})`, v: sum('totalAmount'), c: '#1a5c2a' },
          { label: 'المسدد', v: sum('paid'), c: '#389e0d' },
          { label: 'المستحق للموردين', v: sum('balance'), c: '#d46b08' },
          { label: `متأخر (${overdue.length})`, v: sum('balance', overdue), c: '#cf1322' },
        ].map(t => (
          <Col key={t.label} xs={12} md={6}><Card size="small" style={{ borderRadius: 12 }}><div style={{ fontSize: 17, fontWeight: 800, color: t.c }}>{money(t.v)}</div><div style={{ fontSize: 11.5, color: '#777' }}>{t.label}</div></Card></Col>
        ))}
      </Row>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <DatePicker.RangePicker value={range as any} onChange={r => setRange(r as any)} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="المورد" style={{ width: 200 }} value={vendorId} onChange={setVendorId} options={vendors.map(v => ({ value: v.id, label: v.name }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus} options={Object.entries(BILL_STATUS).map(([k, s]) => ({ value: k, label: s.label }))} />
          <Input.Search allowClear placeholder="رقم الفاتورة، المورد…" style={{ width: 220 }} onSearch={setSearch} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        {can('payables.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>فاتورة مشتريات</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 950 }} pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="لا توجد فواتير مشتريات" /> }}
        onRow={r => ({ onClick: () => setView(r), style: { cursor: 'pointer', background: overdue.includes(r) ? '#fff1f0' : undefined } })}
        columns={[
          { title: 'رقم الفاتورة', dataIndex: 'billNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
          { title: 'المورد', dataIndex: 'vendor' },
          { title: 'المصدر', dataIndex: 'sourceType', render: s => <Tag>{SOURCE[s] ?? s ?? 'يدوية'}</Tag> },
          { title: 'التاريخ', dataIndex: 'billDate' },
          { title: 'الاستحقاق', dataIndex: 'dueDate', render: (v, r) => <span style={{ color: overdue.includes(r) ? '#cf1322' : undefined }}>{v ?? '—'}</span> },
          { title: 'الإجمالي', dataIndex: 'totalAmount', render: v => money(v) },
          { title: 'المسدد', dataIndex: 'paid', render: v => <span style={{ color: '#389e0d' }}>{money(v)}</span> },
          { title: 'الرصيد', dataIndex: 'balance', render: v => <Text strong style={{ color: Number(v) > 0 ? '#d46b08' : '#888' }}>{money(v)}</Text> },
          { title: 'الحالة', dataIndex: 'status', render: (s, r) => <Tag color={BILL_STATUS[s]?.color}>{BILL_STATUS[s]?.label ?? r.statusLabel}</Tag> },
          { title: '', key: 'a', render: (_, r) => Number(r.balance) > 0 && r.status !== 'cancelled' && can('payables.manage') && (
            <Button size="small" icon={<DollarOutlined />} onClick={e => { e.stopPropagation(); setPayFor(r); }}>سداد</Button>) },
        ]} />

      <Drawer open={!!view} onClose={() => setView(null)} width={560} title={view ? `فاتورة مورد ${view.billNo}` : ''}
        extra={view && <Space>
          <HistoryButton entityType="VendorBill" id={view.id} title={`فاتورة مورد ${view.billNo}`} size="middle" />
          {Number(view.balance) > 0 && view.status !== 'cancelled' && can('payables.manage') && <Button type="primary" icon={<DollarOutlined />} onClick={() => setPayFor(view)}>سداد</Button>}
          {view.status !== 'cancelled' && Number(view.paid) === 0 && view.sourceType !== 'refill_request' && can('payables.manage') && <Button danger icon={<StopOutlined />} onClick={() => cancel(view)}>إلغاء</Button>}
        </Space>}>
        {view && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="المورد">{view.vendor}</Descriptions.Item>
            <Descriptions.Item label="المصدر">{SOURCE[view.sourceType] ?? view.sourceType ?? 'يدوية'}</Descriptions.Item>
            <Descriptions.Item label="التاريخ / الاستحقاق">{view.billDate} / {view.dueDate ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="قبل الضريبة">{money(view.subtotal)}</Descriptions.Item>
            <Descriptions.Item label="الضريبة">{money(view.vatAmount)}</Descriptions.Item>
            <Descriptions.Item label="الإجمالي"><b>{money(view.totalAmount)}</b></Descriptions.Item>
            <Descriptions.Item label="المسدد">{money(view.paid)}</Descriptions.Item>
            <Descriptions.Item label="الرصيد"><b style={{ color: '#d46b08' }}>{money(view.balance)}</b></Descriptions.Item>
            <Descriptions.Item label="الحالة"><Tag color={BILL_STATUS[view.status]?.color}>{BILL_STATUS[view.status]?.label ?? view.statusLabel}</Tag></Descriptions.Item>
            {view.notes && <Descriptions.Item label="ملاحظات"><span style={{ whiteSpace: 'pre-line' }}>{view.notes}</span></Descriptions.Item>}
          </Descriptions>
        )}
        {view?.sourceType === 'refill_request' && <Alert style={{ marginTop: 12 }} type="info" showIcon message="فاتورة مرتبطة بطلب تعبئة — تُدار من مراحل الطلب." />}
      </Drawer>

      <Modal open={newOpen} width={820} title="فاتورة مشتريات جديدة" okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={() => setNewOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={10}><Form.Item name="vendorId" label="المورد" rules={[{ required: true, message: 'مطلوب' }]}><Select showSearch optionFilterProp="label" options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Form.Item></Col>
            <Col span={6}><Form.Item name="billNo" label="رقم فاتورة المورد" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={4}><Form.Item name="billDate" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={4}><Form.Item name="dueDate" label="الاستحقاق"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(f => (
                  <Row gutter={8} key={f.key} align="middle">
                    <Col span={4}><Form.Item name={[f.name, 'itemType']} initialValue="other" style={{ marginBottom: 8 }}><Select options={BILL_ITEM_TYPES} /></Form.Item></Col>
                    <Col span={7}><Form.Item name={[f.name, 'description']} rules={[{ required: true, message: 'البيان' }]} style={{ marginBottom: 8 }}><Input placeholder="البيان" /></Form.Item></Col>
                    <Col span={3}><Form.Item name={[f.name, 'quantity']} style={{ marginBottom: 8 }}><InputNumber min={0.001} placeholder="الكمية" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={4}><Form.Item name={[f.name, 'unitPrice']} style={{ marginBottom: 8 }}><InputNumber min={0} placeholder="السعر" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={3}>
                      <Form.Item name={[f.name, 'taxCode']} hidden><Input /></Form.Item>
                      <Form.Item name={[f.name, 'vatRate']} hidden><InputNumber /></Form.Item>
                      <Form.Item name={[f.name, 'taxRateId']} style={{ marginBottom: 8 }}
                        rules={[{ validator: (_, v) => (tax.items.length === 0 || v != null ? Promise.resolve() : Promise.reject(new Error('غير سارية'))) }]}>
                        <TaxRateSelect tax={tax} form={form} listName="items" index={f.name} />
                      </Form.Item>
                    </Col>
                    <Col span={3}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(f.name)} disabled={fields.length === 1} /></Col>
                  </Row>
                ))}
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ quantity: 1, unitPrice: 0, ...newTaxLine(tax) })}>إضافة بند</Button>
              </>
            )}
          </Form.List>
          <div style={{ textAlign: 'left', marginTop: 8 }}>قبل الضريبة {money(totals.sub)} · الضريبة {money(totals.vat)} · <b>الإجمالي {money(totals.sub + totals.vat)}</b></div>
          <Form.Item name="notes" label="ملاحظات" style={{ marginTop: 8 }}><Input /></Form.Item>
        </Form>
      </Modal>

      <SupplierPaymentModal open={!!payFor} vendorId={payFor?.vendorId} billId={payFor?.id} onClose={() => setPayFor(null)}
        onSaved={id => { setPayFor(null); setView(null); load(); setVoucher(id); }} />
      <VoucherDrawer party={voucher ? 'supplier' : null} id={voucher} onClose={() => setVoucher(null)} onChanged={load} />
    </div>
  );
}
