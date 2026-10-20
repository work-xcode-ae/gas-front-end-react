import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, message, Popconfirm, Divider, Alert, Checkbox, Segmented,
} from 'antd';
import {
  FileDoneOutlined, PlusOutlined, ThunderboltOutlined, ReloadOutlined, PrinterOutlined, DollarOutlined, StopOutlined, CheckOutlined, DeleteOutlined,
  ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, SearchOutlined, RollbackOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { API_BASE, api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { openPrintWindow, printInvoice } from '../../utils/printDocs';
import {
  PRIMARY, DARK, GOLD, money, INVOICE_STATUS, INVOICE_TYPES, PRINT_CSS, CustomerSelect, BuildingSelect, RecordPaymentModal, methodLabel,
  useTaxOptions, syncTaxLines, newTaxLine, TaxRateSelect,
} from './shared';
import {
  InstallmentsSection, CreditNoteModal, CreditNoteDrawer, CreditNotesList, RefundModal, RefundsList, ScheduleEditor, scheduleBody, CN_STATUS, type ScheduleRow,
} from './Receivables';

const { Text, Title } = Typography;

export interface InvoiceRow {
  id: number; invoiceNo: string; tenantId: number; customer?: string; buildingId?: number; buildingCode?: string; building?: string;
  contractId?: number; contractNo?: string; unit?: string; date: string; dueDate: string; period?: string; type?: string; typeLabel?: string;
  subtotal: number; vat: number; amount: number; paid: number; balance: number; status?: string; statusLabel?: string; paidDate?: string; notes?: string; journalEntryId?: number;
  credited?: number; nextInstallmentDue?: string; nextInstallmentAmount?: number; installmentCount?: number; overdueInstallments?: number;
}

// ═════════════ invoice drawer (printable) ═════════════
export function InvoiceDrawer({ id, onClose, onChanged, startCancel }: { id: number | null; onClose: () => void; onChanged: () => void; startCancel?: boolean }) {
  const { can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [release, setRelease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cnOpen, setCnOpen] = useState(false);
  const [cnView, setCnView] = useState<number | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api<any>(`/invoices/${id}`).then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);

  const inv = data?.invoice as InvoiceRow | undefined;
  const company = data?.company;
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); message.success(ok); load(); onChanged(); } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  const st = INVOICE_STATUS[inv?.status ?? ''];
  useTrackView('Invoice', id, inv?.invoiceNo);
  const canCancel = !!inv && inv.status !== 'cancelled' && inv.status !== 'draft' && can('invoices.cancel');
  useEffect(() => { if (startCancel && canCancel) { setReason(''); setRelease(false); setCancelOpen(true); } }, [startCancel, canCancel]);

  return (
    <Drawer open={!!id} onClose={onClose} width={Math.min(window.innerWidth - 40, 880)} destroyOnClose
      title={<Space><FileDoneOutlined style={{ color: PRIMARY }} /><span>فاتورة {inv?.invoiceNo ?? ''}</span>{st && <Tag color={st.color}>{st.label}</Tag>}</Space>}
      extra={inv && (
        <Space wrap className="no-print">
          <HistoryButton entityType="Invoice" id={inv.id} title={`فاتورة ${inv.invoiceNo}`} size="middle" />
          <Button icon={<PrinterOutlined />} onClick={() => printInvoice(openPrintWindow(), inv.id)}>طباعة / PDF</Button>
          {inv.status === 'draft' && can('invoices.post') && <Button type="primary" icon={<CheckOutlined />} loading={busy} onClick={() => act(() => api(`/invoices/${inv.id}/issue`, { method: 'POST' }), 'تم إصدار الفاتورة')}>إصدار</Button>}
          {inv.status === 'draft' && can('invoices.manage') && (
            <Popconfirm title="حذف المسودة؟" okText="حذف" cancelText="إلغاء" onConfirm={() => act(async () => { await api(`/invoices/${inv.id}`, { method: 'DELETE' }); onClose(); }, 'تم حذف المسودة')}>
              <Button danger icon={<DeleteOutlined />}>حذف</Button>
            </Popconfirm>)}
          {inv.balance > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && can('payments.manage') &&
            <Button type="primary" icon={<DollarOutlined />} style={{ background: GOLD, borderColor: GOLD, color: DARK }} onClick={() => setPayOpen(true)}>تسجيل دفعة</Button>}
          {inv.status !== 'cancelled' && inv.status !== 'draft' && can('invoices.cancel') && (
            <Button danger icon={<StopOutlined />} onClick={() => { setReason(''); setRelease(false); setCancelOpen(true); }}>إلغاء الفاتورة</Button>)}
          {inv.status !== 'cancelled' && inv.status !== 'draft' && can('invoices.manage') &&
            <Button icon={<RollbackOutlined />} onClick={() => setCnOpen(true)}>إشعار دائن</Button>}
          {Number(data?.customerCredit ?? 0) > 0 && can('payments.manage') &&
            <Tooltip title={`رصيد دائن للعميل ${money(data.customerCredit)}`}><Button icon={<RollbackOutlined />} onClick={() => setRefundOpen(true)}>استرداد للعميل</Button></Tooltip>}
        </Space>
      )}>
      <style>{PRINT_CSS}</style>
      {loading || !inv ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <div className="print-sheet" style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${GOLD}`, paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <Title level={4} style={{ margin: 0, color: PRIMARY }}>{company?.nameAr ?? company?.nameEn ?? ''}</Title>
              {company?.nameEn && <div style={{ fontSize: 12, color: '#888', direction: 'ltr', textAlign: 'start' }}>{company.nameEn}</div>}
              <div style={{ fontSize: 12, color: '#666' }}>{company?.address}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{[company?.phone, company?.email].filter(Boolean).join(' · ')}</div>
              {company?.trn && <div style={{ fontSize: 12 }}>الرقم الضريبي: <b>{company.trn}</b></div>}
            </div>
            <div style={{ textAlign: 'end' }}>
              {company?.logoPath && <img src={`${API_BASE}/files/${company.logoPath}`} alt="" style={{ height: 48, marginBottom: 6 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              <div style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>فاتورة ضريبية</div>
              <div style={{ fontSize: 12, color: '#888' }}>TAX INVOICE</div>
              <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 14 }}>{inv.invoiceNo}</div>
            </div>
          </div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <div style={{ fontSize: 11, color: '#888' }}>العميل</div>
              <div style={{ fontWeight: 700 }}>{inv.customer}</div>
              {inv.building && <div style={{ fontSize: 12 }}>{inv.buildingCode} — {inv.building}{inv.unit ? ` · وحدة ${inv.unit}` : ''}</div>}
              {inv.contractNo && <div style={{ fontSize: 12 }}>العقد: {inv.contractNo}</div>}
            </Col>
            <Col span={12} style={{ fontSize: 12 }}>
              <div>تاريخ الإصدار: <b>{inv.date}</b></div>
              <div>تاريخ الاستحقاق: <b style={{ color: inv.status === 'overdue' ? '#ff4d4f' : undefined }}>{inv.dueDate}</b></div>
              {inv.period && <div>الفترة: <b>{inv.period}</b></div>}
              <div>النوع: <b>{inv.typeLabel ?? inv.type}</b></div>
              {data.journal && <div className="no-print">القيد: <b>{data.journal.journalNo}</b></div>}
            </Col>
          </Row>
          <Table size="small" rowKey="id" pagination={false} dataSource={data.items ?? []} bordered
            columns={[
              { title: '#', key: 'n', width: 40, render: (_, __, i) => i + 1 },
              { title: 'البيان', dataIndex: 'description', render: (v, r: any) => <div>{v}<div style={{ fontSize: 11, color: '#888' }}>{r.typeLabel}</div></div> },
              { title: 'الكمية', dataIndex: 'quantity', width: 80, render: (v, r: any) => `${Number(v).toLocaleString()} ${r.uom ?? ''}` },
              { title: 'سعر الوحدة', dataIndex: 'unitPrice', width: 110, render: v => Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) },
              { title: 'المبلغ', dataIndex: 'amount', width: 110, render: v => money(v) },
              { title: 'الضريبة', key: 'vat', width: 110, render: (_, r: any) => <span>{money(r.vat)} <span style={{ fontSize: 10, color: '#888' }}>({r.vatRate}%)</span></span> },
            ]} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <table style={{ fontSize: 13, minWidth: 280 }}>
              <tbody>
                <tr><td style={{ padding: 4, color: '#666' }}>المجموع قبل الضريبة</td><td style={{ padding: 4, textAlign: 'end' }}>{money(inv.subtotal)}</td></tr>
                <tr><td style={{ padding: 4, color: '#666' }}>ضريبة القيمة المضافة</td><td style={{ padding: 4, textAlign: 'end' }}>{money(inv.vat)}</td></tr>
                <tr style={{ borderTop: '2px solid #333' }}><td style={{ padding: 4, fontWeight: 700 }}>الإجمالي</td><td style={{ padding: 4, textAlign: 'end', fontWeight: 800, color: PRIMARY }}>{money(inv.amount)}</td></tr>
                <tr><td style={{ padding: 4, color: '#52c41a' }}>المدفوع</td><td style={{ padding: 4, textAlign: 'end', color: '#52c41a' }}>{money(inv.paid - Number(inv.credited ?? 0))}</td></tr>
                {Number(inv.credited ?? 0) > 0 && <tr><td style={{ padding: 4, color: '#1677ff' }}>إشعارات دائنة</td><td style={{ padding: 4, textAlign: 'end', color: '#1677ff' }}>{money(inv.credited)}</td></tr>}
                <tr><td style={{ padding: 4, fontWeight: 700 }}>الرصيد المستحق</td><td style={{ padding: 4, textAlign: 'end', fontWeight: 700, color: inv.balance > 0 ? '#d4380d' : '#888' }}>{money(inv.balance)}</td></tr>
              </tbody>
            </table>
          </div>
          {(data.payments ?? []).length > 0 && (
            <>
              <Divider titlePlacement="right" style={{ fontSize: 13 }}>الدفعات</Divider>
              <Table size="small" rowKey="id" pagination={false} dataSource={data.payments}
                columns={[
                  { title: 'سند القبض', dataIndex: 'receiptNo' }, { title: 'التاريخ', dataIndex: 'date' },
                  { title: 'الطريقة', dataIndex: 'method', render: methodLabel }, { title: 'المرجع', dataIndex: 'reference', render: v => v ?? '—' },
                  { title: 'المبلغ', dataIndex: 'amount', render: money },
                  { title: 'الحالة', dataIndex: 'status', render: s => s === 'completed' ? <Tag color="success">مكتملة</Tag> : <Tag>{s}</Tag> },
                ]} />
            </>
          )}
          <InstallmentsSection invoice={inv} rows={data.installments ?? []} onChanged={() => { load(); onChanged(); }} />
          {(data.creditNotes ?? []).length > 0 && (
            <>
              <Divider titlePlacement="right" style={{ fontSize: 13 }}>الإشعارات الدائنة</Divider>
              <Table size="small" rowKey="id" pagination={false} dataSource={data.creditNotes}
                onRow={(c: any) => ({ onClick: () => setCnView(c.id), style: { cursor: 'pointer' } })}
                columns={[
                  { title: 'رقم الإشعار', dataIndex: 'creditNoteNo' }, { title: 'التاريخ', dataIndex: 'issueDate' },
                  { title: 'السبب', dataIndex: 'reason', ellipsis: true }, { title: 'الإجمالي', dataIndex: 'totalAmount', render: money },
                  { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={CN_STATUS[s]?.color}>{CN_STATUS[s]?.label ?? s}</Tag> },
                ]} />
            </>
          )}
          {inv.notes && <div style={{ marginTop: 12, fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>ملاحظات: {inv.notes}</div>}
        </div>
      )}
      <RecordPaymentModal open={payOpen} tenantId={inv?.tenantId} invoiceId={inv?.id} onClose={() => setPayOpen(false)} onSaved={() => { load(); onChanged(); }} />
      <CreditNoteModal open={cnOpen} invoiceId={inv?.id} onClose={() => setCnOpen(false)} onSaved={cid => { load(); onChanged(); setCnView(cid); }} />
      <CreditNoteDrawer id={cnView} onClose={() => setCnView(null)} onChanged={() => { load(); onChanged(); }} />
      <RefundModal open={refundOpen} tenantId={inv?.tenantId} onClose={() => setRefundOpen(false)} onSaved={() => { load(); onChanged(); }} />
      <Modal open={cancelOpen} title={`إلغاء الفاتورة ${inv?.invoiceNo ?? ''}`} okText="إلغاء الفاتورة" cancelText="رجوع"
        okButtonProps={{ danger: true, disabled: !reason.trim() || (!!inv && inv.paid > 0 && !release) }}
        confirmLoading={busy} onCancel={() => setCancelOpen(false)}
        onOk={() => act(async () => {
          const r = await api<{ releasedToCredit?: number }>(`/invoices/${inv!.id}/cancel`, { method: 'POST', body: { reason, releasePayments: release } });
          setCancelOpen(false);
          if (r?.releasedToCredit) message.info(`أصبح ${money(r.releasedToCredit)} رصيداً دائناً للعميل — يمكن تخصيصه لفاتورة أخرى من سند القبض`, 8);
        }, 'تم إلغاء الفاتورة')}>
        {inv && (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            {inv.customer} — {money(inv.amount)}{inv.paid > 0 ? ` (مدفوع ${money(inv.paid)})` : ''}
          </div>
        )}
        <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="ماذا يحدث عند الإلغاء"
          description={<ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12 }}>
            <li>يُعكس القيد المحاسبي للفاتورة بقيد عكسي بتاريخ اليوم.</li>
            <li>تُحرر قراءات العدادات المرتبطة لتدخل في فاتورة جديدة.</li>
            <li>إن كانت فاتورة قسط صيانة AMC يعود القسط «جاهزاً للإصدار».</li>
            <li>تبقى الفاتورة في السجل بحالة «ملغاة» مع السبب، ولا يمكن التراجع.</li>
          </ul>} />
        {inv && inv.paid > 0 && (
          <Alert type="error" showIcon style={{ marginBottom: 10 }}
            message={`على الفاتورة دفعات بقيمة ${money(inv.paid)}`}
            description={<Checkbox checked={release} onChange={e => setRelease(e.target.checked)}>
              تحويل المبلغ المدفوع إلى رصيد دائن للعميل (سندات القبض تبقى صحيحة، ويُلغى تخصيصها لهذه الفاتورة)
            </Checkbox>} />
        )}
        <Input.TextArea rows={3} placeholder="سبب الإلغاء (إلزامي)" value={reason} onChange={e => setReason(e.target.value)} />
      </Modal>
    </Drawer>
  );
}

// ═════════════ manual invoice ═════════════
function NewInvoiceModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: number) => void }) {
  const { can } = useAuth();
  const [form] = Form.useForm();
  const [tenantId, setTenantId] = useState<number | undefined>();
  const [contracts, setContracts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [withSchedule, setWithSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const items = Form.useWatch('items', form) as any[] | undefined;
  const issueDate = Form.useWatch('issueDate', form) as Dayjs | undefined;
  const issueNow = Form.useWatch('issue', form) as boolean | undefined;
  const tax = useTaxOptions(issueDate, 'sales');
  useEffect(() => { if (open) syncTaxLines(form, 'items', tax); }, [tax, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setTenantId(undefined);
    setWithSchedule(false);
    setSchedule([]);
    form.setFieldsValue({ type: 'other', issueDate: dayjs(), dueDate: dayjs().add(30, 'day'), issue: can('invoices.post'), items: [{ quantity: 1, uom: 'each', ...newTaxLine(tax) }] });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!tenantId) { setContracts([]); return; }
    api<Paged<any>>('/supply-contracts', { query: { tenantId, pageSize: 0 } }).then(r => setContracts(r.items)).catch(() => setContracts([]));
  }, [tenantId]);
  const totals = (items ?? []).reduce((s, i) => {
    const a = Number(i?.quantity ?? 0) * Number(i?.unitPrice ?? 0);
    return { sub: s.sub + a, vat: s.vat + a * Number(i?.vatRate ?? 0) / 100 };
  }, { sub: 0, vat: 0 });

  const save = async () => {
    const v = await form.validateFields();
    if (!tenantId) { message.warning('اختر العميل'); return; }
    // VAT is rounded per line on the server; the schedule must match the rounded total
    const invTotal = Math.round((v.items as any[]).reduce((s, i) => { const a = Math.round(Number(i.quantity) * Number(i.unitPrice) * 100) / 100; return s + a + Math.round(a * Number(i.vatRate ?? 0)) / 100; }, 0) * 100) / 100;
    if (withSchedule) {
      const sum = Math.round(schedule.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;
      if (!schedule.length || Math.abs(sum - invTotal) > 0.01) { message.warning(`مجموع الأقساط (${money(sum)}) يجب أن يساوي إجمالي الفاتورة (${money(invTotal)})`); return; }
    }
    setSaving(true);
    try {
      const r = await api<{ id: number; invoiceNo: string }>('/invoices', {
        method: 'POST', body: {
          tenantId, contractId: v.contractId ?? null, buildingId: v.buildingId ?? null, type: v.type, issueDate: v.issueDate.format('YYYY-MM-DD'),
          dueDate: v.dueDate?.format('YYYY-MM-DD') ?? null, periodStart: v.period?.[0]?.format('YYYY-MM-DD') ?? null, periodEnd: v.period?.[1]?.format('YYYY-MM-DD') ?? null,
          notes: v.notes || null, issue: !!v.issue, installments: withSchedule && v.issue ? scheduleBody(schedule) : null,
          items: v.items.map((i: any) => ({ itemType: i.itemType ?? null, description: i.description, quantity: i.quantity, uom: i.uom || null, unitPrice: i.unitPrice, vatRate: i.vatRate ?? 0, taxRateId: i.taxRateId ?? null })),
        },
      });
      message.success(`تم إنشاء الفاتورة ${r.invoiceNo}`);
      onSaved(r.id);
      onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title="فاتورة يدوية جديدة" okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} width={900} destroyOnClose>
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={8}><Form.Item label="العميل" required><CustomerSelect value={tenantId} onChange={v => { setTenantId(v); form.setFieldsValue({ contractId: undefined }); }} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="contractId" label="العقد (اختياري)">
            <Select allowClear placeholder="بدون عقد" options={contracts.map(c => ({ value: c.id, label: `${c.contractNo} — وحدة ${c.unit ?? ''}` }))} />
          </Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="buildingId" label="المبنى (اختياري)"><BuildingSelect style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="type" label="النوع"><Select options={INVOICE_TYPES} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="issueDate" label="تاريخ الإصدار" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="dueDate" label="تاريخ الاستحقاق"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="period" label="فترة الفوترة"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(f => (
                <Row gutter={8} key={f.key} align="bottom">
                  <Col xs={24} md={9}><Form.Item name={[f.name, 'description']} label="البيان" rules={[{ required: true, message: 'مطلوب' }]} style={{ marginBottom: 8 }}><Input /></Form.Item></Col>
                  <Col xs={6} md={3}><Form.Item name={[f.name, 'quantity']} label="الكمية" rules={[{ required: true }]} style={{ marginBottom: 8 }}><InputNumber min={0.001} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col xs={6} md={3}><Form.Item name={[f.name, 'uom']} label="الوحدة" style={{ marginBottom: 8 }}><Input placeholder="each / م³" /></Form.Item></Col>
                  <Col xs={6} md={4}><Form.Item name={[f.name, 'unitPrice']} label="سعر الوحدة" rules={[{ required: true }]} style={{ marginBottom: 8 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col xs={4} md={3}>
                    <Form.Item name={[f.name, 'taxCode']} hidden><Input /></Form.Item>
                    <Form.Item name={[f.name, 'vatRate']} hidden><InputNumber /></Form.Item>
                    <Form.Item name={[f.name, 'taxRateId']} label="الضريبة" style={{ marginBottom: 8 }}
                      rules={[{ validator: (_, v) => (tax.items.length === 0 || v != null ? Promise.resolve() : Promise.reject(new Error('غير سارية'))) }]}>
                      <TaxRateSelect tax={tax} form={form} listName="items" index={f.name} />
                    </Form.Item>
                  </Col>
                  <Col xs={2} md={2}><Button danger type="text" icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => remove(f.name)} style={{ marginBottom: 8 }} /></Col>
                </Row>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1, uom: 'each', ...newTaxLine(tax) })}>إضافة بند</Button>
            </>
          )}
        </Form.List>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, margin: '12px 0', fontSize: 13 }}>
          <span>قبل الضريبة: <b>{money(totals.sub)}</b></span><span>الضريبة: <b>{money(totals.vat)}</b></span>
          <span>الإجمالي: <b style={{ color: PRIMARY }}>{money(totals.sub + totals.vat)}</b></span>
        </div>
        <Row gutter={12}>
          <Col xs={24} md={18}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="issue" label="إصدار مباشرة" valuePropName="checked" extra={!can('invoices.post') ? 'تُحفظ كمسودة (لا تملك صلاحية الإصدار)' : 'وإلا تُحفظ كمسودة'}>
            <Switch disabled={!can('invoices.post')} /></Form.Item></Col>
        </Row>
        <div style={{ borderTop: '1px dashed #e5e5e5', paddingTop: 10 }}>
          <Space><Switch checked={withSchedule} disabled={!issueNow} onChange={setWithSchedule} /><CalendarOutlined /><span>جدول أقساط (اختياري)</span>
            {!issueNow && <Text type="secondary" style={{ fontSize: 12 }}>متاح للفواتير الصادرة فقط</Text>}</Space>
          {withSchedule && issueNow && (
            <div style={{ marginTop: 10 }}>
              <ScheduleEditor total={Math.round((totals.sub + totals.vat) * 100) / 100} start={issueDate ?? dayjs()} rows={schedule} onChange={setSchedule} />
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
}

// ═════════════ billing run ═════════════
function BillingRunModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { can } = useAuth();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue({ month: dayjs().subtract(1, 'month'), issue: can('invoices.post') }); setResult(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const m = v.month as Dayjs;
      const r = await api<any>('/invoices/generate', {
        method: 'POST', body: { buildingId: v.buildingId ?? null, periodStart: m.startOf('month').format('YYYY-MM-DD'), periodEnd: m.endOf('month').format('YYYY-MM-DD'), issue: !!v.issue },
      });
      setResult(r);
      message.success(`تمت الفوترة: ${r.created} فاتورة من ${r.contracts} عقد`);
      onDone();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="تشغيل الفوترة الشهرية" onCancel={onClose} width={720} destroyOnClose
      footer={[<Button key="c" onClick={onClose}>إغلاق</Button>, <Button key="r" type="primary" icon={<ThunderboltOutlined />} loading={busy} onClick={run}>تشغيل</Button>]}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message="تُنشأ فواتير استهلاك الغاز لكل عقد توريد نشط من القراءات غير المفوترة والرسوم الشهرية للفترة المختارة. كل عقد يُعالج بشكل مستقل." />
      <Form form={form} layout="vertical">
        <Space wrap>
          <Form.Item name="month" label="الشهر" rules={[{ required: true }]}><DatePicker picker="month" /></Form.Item>
          <Form.Item name="buildingId" label="المبنى (فارغ = كل المباني)"><BuildingSelect style={{ width: 260 }} /></Form.Item>
          <Form.Item name="issue" label="إصدار الفواتير" valuePropName="checked"><Switch disabled={!can('invoices.post')} /></Form.Item>
        </Space>
      </Form>
      {result && (
        <Table size="small" rowKey="contractId" pagination={{ pageSize: 8, hideOnSinglePage: true }} dataSource={result.results}
          columns={[
            { title: 'العقد', dataIndex: 'contractNo' },
            { title: 'النتيجة', key: 'r', render: (_, r: any) => r.created ? <Tag color="success">{r.invoiceNo}</Tag> : r.error ? <Tag color="error">خطأ</Tag> : <Tag>لا يوجد ما يفوتر</Tag> },
            { title: 'المبلغ', dataIndex: 'amount', render: v => (v != null ? money(v) : '—') },
            { title: 'ملاحظة', dataIndex: 'error', render: v => <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> },
          ]} />
      )}
    </Modal>
  );
}

// ═════════════ page ═════════════
const SalesInvoices: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { can } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('year'), dayjs()]);
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [tenantId, setTenantId] = useState<number | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [cancelMode, setCancelMode] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [payFor, setPayFor] = useState<InvoiceRow | null>(null);
  const [view, setView] = useState<'invoices' | 'credit_notes' | 'refunds'>('invoices');

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<InvoiceRow>>('/invoices', {
      query: {
        pageSize: 0, buildingId, tenantId, type, status: status === 'overdue' ? undefined : status, overdueOnly: status === 'overdue' || undefined,
        from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD'), search: search || undefined, desc: true,
      },
    }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId, tenantId, type, status, range, search]);
  useEffect(() => { load(); }, [load]);

  const kpi = useMemo(() => {
    const valid = rows.filter(r => r.status !== 'cancelled' && r.status !== 'draft');
    const m0 = dayjs().startOf('month');
    const month = valid.filter(r => !dayjs(r.date).isBefore(m0));
    const sum = (l: InvoiceRow[], f: keyof InvoiceRow) => l.reduce((s, r) => s + Number(r[f] ?? 0), 0);
    return {
      month: sum(month, 'amount'), monthCount: month.length, paid: sum(valid, 'paid'), balance: sum(valid, 'balance'),
      overdue: sum(valid.filter(r => r.status === 'overdue'), 'balance'), overdueCount: valid.filter(r => r.status === 'overdue').length,
      drafts: rows.filter(r => r.status === 'draft').length,
    };
  }, [rows]);

  const tiles = [
    { label: `صادرة هذا الشهر (${kpi.monthCount})`, value: money(kpi.month), color: PRIMARY, bg: '#e8f5e9', icon: <FileDoneOutlined /> },
    { label: 'المحصّل', value: money(kpi.paid), color: '#389e0d', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
    { label: 'المستحق', value: money(kpi.balance), color: '#d46b08', bg: '#fff7e6', icon: <ClockCircleOutlined /> },
    { label: `متأخر (${kpi.overdueCount})`, value: money(kpi.overdue), color: '#cf1322', bg: '#fff1f0', icon: <WarningOutlined />, onClick: () => setStatus('overdue') },
  ];

  return (
    <div style={{ padding: embedded ? 0 : '20px 24px' }}>
      <div style={embedded ? { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 } : { background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {!embedded && (<>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileDoneOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>الفواتير</div>
          <div style={{ color: 'rgba(255,255,255,.72)', fontSize: 12.5 }}>فواتير المستأجرين وعقود الصيانة — الإصدار والتحصيل والإلغاء</div>
        </div>
        </>)}
        <Space style={{ marginInlineStart: 'auto' }} wrap>
          {can('invoices.manage') && <Button icon={<ThunderboltOutlined />} onClick={() => setRunOpen(true)}>الفوترة الشهرية</Button>}
          {can('invoices.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)} style={{ background: GOLD, borderColor: GOLD, color: DARK, fontWeight: 700 }}>فاتورة جديدة</Button>}
        </Space>
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {tiles.map(t => (
          <Col key={t.label} xs={12} md={6}>
            <Card size="small" hoverable={!!t.onClick} onClick={t.onClick} style={{ borderRadius: 12, background: t.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><div style={{ fontSize: 18, fontWeight: 800, color: t.color }}>{t.value}</div><div style={{ fontSize: 11.5, color: t.color }}>{t.label}</div></div>
                <span style={{ fontSize: 22, color: t.color, opacity: .7 }}>{t.icon}</span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card styles={{ body: { padding: 14 } }} style={{ borderRadius: 12 }}>
        <Segmented style={{ marginBottom: 12 }} value={view} onChange={v => setView(v as typeof view)}
          options={[{ value: 'invoices', label: 'الفواتير' }, { value: 'credit_notes', label: 'الإشعارات الدائنة' }, { value: 'refunds', label: 'الاستردادات' }]} />
        {view === 'credit_notes' && <CreditNotesList />}
        {view === 'refunds' && <RefundsList />}
        {view === 'invoices' && (<>
        <Space wrap style={{ marginBottom: 12 }}>
          <DatePicker.RangePicker value={range as any} onChange={v => setRange(v as any)} />
          <BuildingSelect value={buildingId} onChange={setBuildingId} style={{ width: 200 }} />
          <CustomerSelect allowClear value={tenantId} onChange={v => setTenantId(v)} style={{ width: 200 }} />
          <Select allowClear placeholder="النوع" style={{ width: 150 }} value={type} onChange={setType} options={INVOICE_TYPES} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus}
            options={Object.entries(INVOICE_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input.Search allowClear placeholder="رقم الفاتورة / العميل" prefix={<SearchOutlined />} style={{ width: 220 }} onSearch={setSearch} />
          <Button icon={<ReloadOutlined />} onClick={load} />
          {kpi.drafts > 0 && <Tag color="default" style={{ cursor: 'pointer' }} onClick={() => setStatus('draft')}>{kpi.drafts} مسودة</Tag>}
        </Space>
        <Table<InvoiceRow> size="small" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showTotal: t => `${t} فاتورة`, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="لا توجد فواتير" /> }}
          onRow={r => ({ onClick: () => { setCancelMode(false); setOpenId(r.id); }, style: { cursor: 'pointer', background: r.status === 'overdue' ? '#fff1f0' : undefined } })}
          columns={[
            { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text> },
            { title: 'العميل', dataIndex: 'customer', render: (v, r) => <div>{v}<div style={{ fontSize: 11, color: '#888' }}>{[r.buildingCode, r.unit ? `وحدة ${r.unit}` : null].filter(Boolean).join(' · ')}</div></div> },
            { title: 'النوع', dataIndex: 'typeLabel', render: (v, r) => <Tag color={r.type === 'maintenance' ? 'purple' : 'blue'}>{r.type === 'maintenance' && !r.contractId ? 'صيانة AMC' : v}</Tag> },
            { title: 'التاريخ', dataIndex: 'date', width: 100 },
            { title: 'الاستحقاق', dataIndex: 'dueDate', width: 100, render: (v, r) => <span style={{ color: r.status === 'overdue' ? '#ff4d4f' : undefined }}>{v}</span> },
            { title: 'القسط القادم', key: 'next', width: 130, render: (_, r) => !r.installmentCount ? <Text type="secondary">—</Text> : (
              <div style={{ fontSize: 12 }}>
                {r.nextInstallmentDue ? <><div>{r.nextInstallmentDue}</div><div style={{ color: '#888' }}>{money(r.nextInstallmentAmount)}</div></> : <Text type="secondary">مكتمل</Text>}
                {Number(r.overdueInstallments) > 0 && <Tag color="error" style={{ fontSize: 10 }}>{r.overdueInstallments} متأخر</Tag>}
              </div>) },
            { title: 'الإجمالي', dataIndex: 'amount', align: 'end' as const, render: money },
            { title: 'المدفوع', dataIndex: 'paid', align: 'end' as const, render: v => <span style={{ color: '#389e0d' }}>{money(v)}</span> },
            { title: 'الرصيد', dataIndex: 'balance', align: 'end' as const, render: v => <Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#999' }}>{money(v)}</Text> },
            { title: 'الحالة', dataIndex: 'status', render: (s, r) => (
              <div><Tag color={INVOICE_STATUS[s ?? '']?.color}>{INVOICE_STATUS[s ?? '']?.label ?? r.statusLabel}</Tag>
                {s === 'overdue' && <div style={{ fontSize: 10, color: '#ff4d4f' }}>{dayjs().diff(dayjs(r.dueDate), 'day')} يوم</div>}</div>) },
            { title: '', key: 'a', width: 110, render: (_, r) => (
              <Space size={0}>
                <Tooltip title="طباعة الفاتورة"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={e => { e.stopPropagation(); printInvoice(openPrintWindow(), r.id); }} /></Tooltip>
                {r.balance > 0 && r.status !== 'draft' && r.status !== 'cancelled' && can('payments.manage') && (
                  <Tooltip title="تسجيل دفعة"><Button size="small" type="text" icon={<DollarOutlined />} onClick={e => { e.stopPropagation(); setPayFor(r); }} /></Tooltip>)}
                {r.status !== 'draft' && r.status !== 'cancelled' && can('invoices.cancel') && (
                  <Tooltip title="إلغاء الفاتورة"><Button size="small" type="text" danger icon={<StopOutlined />} onClick={e => { e.stopPropagation(); setCancelMode(true); setOpenId(r.id); }} /></Tooltip>)}
              </Space>) },
          ]}
          summary={data => {
            const s = (f: keyof InvoiceRow) => data.filter(r => r.status !== 'cancelled').reduce((a, r) => a + Number(r[f] ?? 0), 0);
            return data.length ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6}><Text strong>مجموع الصفحة</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="end"><Text strong>{money(s('amount'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="end"><Text strong>{money(s('paid'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="end"><Text strong>{money(s('balance'))}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={9} colSpan={2} />
              </Table.Summary.Row>) : null;
          }} />
        </>)}
      </Card>

      <InvoiceDrawer id={openId} startCancel={cancelMode} onClose={() => { setOpenId(null); setCancelMode(false); }} onChanged={load} />
      <NewInvoiceModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={id => { load(); setOpenId(id); }} />
      <BillingRunModal open={runOpen} onClose={() => setRunOpen(false)} onDone={load} />
      <RecordPaymentModal open={!!payFor} tenantId={payFor?.tenantId} invoiceId={payFor?.id} onClose={() => setPayFor(null)} onSaved={load} />
    </div>
  );
};

export default SalesInvoices;
