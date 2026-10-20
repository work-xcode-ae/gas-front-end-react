import React, { useState } from 'react';
import {
  Drawer, Typography, Tag, Button, Table, Space, Tabs,
  Row, Col, Modal, Form, Input, InputNumber, Select,
  DatePicker, message, Tooltip, Timeline, Divider,
} from 'antd';
import {
  CreditCardOutlined, PlusOutlined, PrinterOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  DollarOutlined, FileTextOutlined, UserOutlined, HistoryOutlined,
  BankOutlined, WalletOutlined, MobileOutlined, MoneyCollectOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

/* ─── Types ─────────────────────────────────────────── */
export interface TenantInvoice {
  id: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  type: 'gas_consumption' | 'maintenance' | 'deposit' | 'connection' | 'other';
  typeLabel: string;
  paidDate?: string;
  notes?: string;
  period?: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'cheque' | 'online' | 'card';
  methodLabel: string;
  invoiceId: string;
  invoiceLabel: string;
  reference?: string;
  receivedBy?: string;
  notes?: string;
}

export interface TenantInvoicesDrawerProps {
  open: boolean;
  onClose: () => void;
  tenant: {
    id: string; name: string; nameEn?: string; avatar: string;
    unit: string; floor: number; meterNo: string | null;
    contractNo: string; paymentStatus: string; gasBalance?: number;
  } | null;
  buildingName?: string;
}

/* ─── Static maps ────────────────────────────────────── */
const STATUS_MAP: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  paid:      { color: 'success', label: 'مدفوعة',  icon: <CheckCircleOutlined /> },
  pending:   { color: 'warning', label: 'معلقة',   icon: <ClockCircleOutlined /> },
  overdue:   { color: 'error',   label: 'متأخرة',  icon: <ExclamationCircleOutlined /> },
  cancelled: { color: 'default', label: 'ملغاة',   icon: <ExclamationCircleOutlined /> },
};

const TYPE_MAP: Record<string, { color: string }> = {
  gas_consumption: { color: 'blue' },
  maintenance:     { color: 'orange' },
  deposit:         { color: 'purple' },
  connection:      { color: 'cyan' },
  other:           { color: 'default' },
};

const METHOD_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  cash:          { label: 'نقداً',         color: 'green',   icon: <MoneyCollectOutlined /> },
  bank_transfer: { label: 'تحويل بنكي',   color: 'blue',    icon: <BankOutlined /> },
  cheque:        { label: 'شيك',           color: 'purple',  icon: <FileTextOutlined /> },
  online:        { label: 'دفع إلكتروني', color: 'cyan',    icon: <MobileOutlined /> },
  card:          { label: 'بطاقة',         color: 'geekblue',icon: <CreditCardOutlined /> },
};

/* ─── Demo data generators ───────────────────────────── */
const generateDemoInvoices = (contractNo: string): TenantInvoice[] => [
  { id: `${contractNo}-INV-004`, date: '2024-12-01', dueDate: '2024-12-15', amount: 3850, status: 'pending',  type: 'gas_consumption', typeLabel: 'استهلاك الغاز', period: 'ديسمبر 2024' },
  { id: `${contractNo}-INV-003`, date: '2024-11-01', dueDate: '2024-11-15', amount: 3650, status: 'paid',     type: 'gas_consumption', typeLabel: 'استهلاك الغاز', period: 'نوفمبر 2024', paidDate: '2024-11-10' },
  { id: `${contractNo}-INV-002`, date: '2024-10-01', dueDate: '2024-10-15', amount: 4100, status: 'paid',     type: 'gas_consumption', typeLabel: 'استهلاك الغاز', period: 'أكتوبر 2024', paidDate: '2024-10-08' },
  { id: `${contractNo}-INV-001`, date: '2024-09-01', dueDate: '2024-09-15', amount: 3200, status: 'paid',     type: 'gas_consumption', typeLabel: 'استهلاك الغاز', period: 'سبتمبر 2024', paidDate: '2024-09-12' },
  { id: `${contractNo}-MNT-001`, date: '2024-07-01', dueDate: '2024-07-10', amount: 800,  status: 'paid',     type: 'maintenance',      typeLabel: 'رسوم صيانة',     paidDate: '2024-07-09' },
  { id: `${contractNo}-DEP-001`, date: '2024-01-01', dueDate: '2024-01-07', amount: 5000, status: 'paid',     type: 'deposit',          typeLabel: 'وديعة ضمان',      paidDate: '2024-01-05' },
  { id: `${contractNo}-CON-001`, date: '2024-01-01', dueDate: '2024-01-07', amount: 500,  status: 'paid',     type: 'connection',       typeLabel: 'رسوم توصيل',      paidDate: '2024-01-05' },
];

const generateDemoPayments = (contractNo: string): PaymentRecord[] => [
  { id: `PAY-006`, date: '2024-11-10', amount: 3650, method: 'bank_transfer', methodLabel: 'تحويل بنكي',   invoiceId: `${contractNo}-INV-003`, invoiceLabel: 'استهلاك الغاز - نوفمبر 2024', reference: 'TRF-20241110-884', receivedBy: 'النظام' },
  { id: `PAY-005`, date: '2024-10-08', amount: 4100, method: 'online',        methodLabel: 'دفع إلكتروني', invoiceId: `${contractNo}-INV-002`, invoiceLabel: 'استهلاك الغاز - أكتوبر 2024', reference: 'ONL-20241008-221', receivedBy: 'النظام' },
  { id: `PAY-004`, date: '2024-09-12', amount: 3200, method: 'cash',          methodLabel: 'نقداً',         invoiceId: `${contractNo}-INV-001`, invoiceLabel: 'استهلاك الغاز - سبتمبر 2024', receivedBy: 'أحمد المدير' },
  { id: `PAY-003`, date: '2024-07-09', amount: 800,  method: 'card',          methodLabel: 'بطاقة',         invoiceId: `${contractNo}-MNT-001`, invoiceLabel: 'رسوم صيانة', reference: 'CARD-202407-112', receivedBy: 'سارة المحاسبة' },
  { id: `PAY-002`, date: '2024-01-05', amount: 5000, method: 'cheque',        methodLabel: 'شيك',           invoiceId: `${contractNo}-DEP-001`, invoiceLabel: 'وديعة ضمان', reference: 'CHQ-000445', receivedBy: 'إدارة المبنى', notes: 'شيك مصرف أبوظبي الأول' },
  { id: `PAY-001`, date: '2024-01-05', amount: 500,  method: 'cheque',        methodLabel: 'شيك',           invoiceId: `${contractNo}-CON-001`, invoiceLabel: 'رسوم توصيل', reference: 'CHQ-000446', receivedBy: 'إدارة المبنى' },
];

/* ─── Record Payment Modal ───────────────────────────── */
interface RecordPaymentModalProps {
  open: boolean;
  tenantName: string;
  invoices: TenantInvoice[];
  onClose: () => void;
  onSave: (p: PaymentRecord) => void;
}
const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({ open, tenantName, invoices, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const unpaid = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');

  const handleSave = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      await new Promise(r => setTimeout(r, 500));
      const inv = invoices.find(i => i.id === v.invoiceId);
      onSave({
        id: `PAY-${String(Date.now()).slice(-4)}`,
        date: (v.date as Dayjs).format('YYYY-MM-DD'),
        amount: v.amount,
        method: v.method,
        methodLabel: METHOD_MAP[v.method]?.label ?? v.method,
        invoiceId: v.invoiceId,
        invoiceLabel: inv ? `${inv.typeLabel}${inv.period ? ' - ' + inv.period : ''}` : v.invoiceId,
        reference: v.reference,
        receivedBy: v.receivedBy,
        notes: v.notes,
      });
      message.success('تم تسجيل الدفعة بنجاح');
      form.resetFields();
      onClose();
    } catch { /* validation */ }
    finally { setLoading(false); }
  };

  return (
    <Modal
      open={open} onCancel={onClose} destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${PRIMARY},#2e7d32)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarOutlined style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>تسجيل دفعة</div>
            <div style={{ fontSize: 11, color: '#888' }}>{tenantName}</div>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>إلغاء</Button>
          <Button type="primary" loading={loading} onClick={handleSave}
            icon={<CheckCircleOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }}>
            تسجيل الدفعة
          </Button>
        </div>
      }
      width={500} style={{ direction: 'rtl' }}
    >
      <Form form={form} layout="vertical" style={{ direction: 'rtl', marginTop: 16 }}
        initialValues={{ date: dayjs(), method: 'bank_transfer' }}>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="invoiceId" label="الفاتورة" rules={[{ required: true, message: 'اختر الفاتورة' }]}>
              <Select placeholder="اختر الفاتورة">
                {unpaid.map(inv => (
                  <Option key={inv.id} value={inv.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{inv.typeLabel}{inv.period ? ` · ${inv.period}` : ''}</span>
                      <Text strong style={{ color: PRIMARY }}>{inv.amount.toLocaleString()} د.إ</Text>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="amount" label="المبلغ المدفوع (د.إ)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" addonAfter="د.إ" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}>
              <Select>
                {Object.entries(METHOD_MAP).map(([k, v]) => (
                  <Option key={k} value={k}>{v.icon} {v.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reference" label="رقم المرجع / الشيك">
              <Input placeholder="TRF-xxx / CHQ-xxx" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="receivedBy" label="استلم بواسطة">
              <Input placeholder="اسم المستلم" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="notes" label="ملاحظات">
              <Input placeholder="ملاحظات اختيارية" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

/* ─── New Invoice Modal ──────────────────────────────── */
interface NewInvoiceModalProps {
  open: boolean; tenantName: string; contractNo: string;
  onClose: () => void; onSave: (inv: TenantInvoice) => void;
}
const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({ open, tenantName, contractNo, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const typeOptions = [
    { value: 'gas_consumption', label: 'استهلاك الغاز' },
    { value: 'maintenance',     label: 'رسوم صيانة' },
    { value: 'deposit',         label: 'وديعة ضمان' },
    { value: 'connection',      label: 'رسوم توصيل' },
    { value: 'other',           label: 'أخرى' },
  ];
  const handleSave = async () => {
    try {
      const v = await form.validateFields();
      setLoading(true);
      await new Promise(r => setTimeout(r, 500));
      onSave({
        id: `${contractNo}-INV-${String(Date.now()).slice(-4)}`,
        date: dayjs().format('YYYY-MM-DD'),
        dueDate: (v.dueDate as Dayjs).format('YYYY-MM-DD'),
        amount: v.amount, status: 'pending', type: v.type,
        typeLabel: typeOptions.find(t => t.value === v.type)?.label ?? v.type,
        period: v.period, notes: v.notes,
      });
      message.success('تم إصدار الفاتورة بنجاح');
      form.resetFields(); onClose();
    } catch { /* validation */ }
    finally { setLoading(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${PRIMARY},#2e7d32)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileTextOutlined style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>إصدار فاتورة جديدة</div>
            <div style={{ fontSize: 11, color: '#888' }}>{tenantName}</div>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>إلغاء</Button>
          <Button type="primary" loading={loading} onClick={handleSave}
            icon={<CheckCircleOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }}>
            إصدار الفاتورة
          </Button>
        </div>
      }
      width={480} style={{ direction: 'rtl' }}>
      <Form form={form} layout="vertical" style={{ direction: 'rtl', marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="type" label="نوع الفاتورة" rules={[{ required: true }]}>
              <Select placeholder="اختر النوع">
                {typeOptions.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="amount" label="المبلغ (د.إ)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" addonAfter="د.إ" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dueDate" label="تاريخ الاستحقاق" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="اختر التاريخ" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="period" label="الفترة / الشهر">
              <Input placeholder="مثال: يناير 2025" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="notes" label="ملاحظات">
              <Input.TextArea rows={2} placeholder="ملاحظات اختيارية..." maxLength={200} showCount />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

/* ─── Main Drawer ───────────────────────────────────── */
const TenantInvoicesDrawer: React.FC<TenantInvoicesDrawerProps> = ({ open, onClose, tenant, buildingName }) => {
  const [newInvoiceOpen, setNewInvoiceOpen]     = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [invoices,  setInvoices]  = useState<TenantInvoice[]>([]);
  const [payments,  setPayments]  = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState('invoices');

  React.useEffect(() => {
    if (tenant) {
      setInvoices(generateDemoInvoices(tenant.contractNo));
      setPayments(generateDemoPayments(tenant.contractNo));
    }
  }, [tenant]);

  if (!tenant) return null;

  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  /* print single invoice */
  const handlePrint = (inv: TenantInvoice) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${inv.id}</title>
      <style>body{font-family:Arial,sans-serif;direction:rtl;padding:40px;color:#222;font-size:14px}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1a5c2a;padding-bottom:16px;margin-bottom:24px}
      .logo{font-size:22px;font-weight:700;color:#1a5c2a}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}
      .label{color:#888;font-size:13px}.value{font-weight:600}
      .total{background:#f6ffed;border:1px solid #b7eb8f;border-radius:8px;padding:16px;margin:20px 0;text-align:center}
      .footer{margin-top:40px;text-align:center;color:#aaa;font-size:11px}
      .status-paid{color:#52c41a}.status-pending{color:#fa8c16}.status-overdue{color:#ff4d4f}
      </style></head><body>
      <div class="header"><div class="logo">🔥 ${buildingName ?? ''}</div>
        <div><div style="font-size:12px;color:#888">رقم الفاتورة</div><div style="font-weight:700;font-size:16px">${inv.id}</div></div>
      </div>
      <h3 style="color:#1a5c2a;margin-bottom:16px">فاتورة ${inv.typeLabel}</h3>
      <div class="row"><span class="label">المستأجر</span><span class="value">${tenant.name}</span></div>
      <div class="row"><span class="label">الوحدة</span><span class="value">وحدة ${tenant.unit} · طابق ${tenant.floor}</span></div>
      <div class="row"><span class="label">رقم العداد</span><span class="value">${tenant.meterNo ?? '—'}</span></div>
      <div class="row"><span class="label">العقد</span><span class="value">${tenant.contractNo}</span></div>
      ${inv.period ? `<div class="row"><span class="label">الفترة</span><span class="value">${inv.period}</span></div>` : ''}
      <div class="row"><span class="label">تاريخ الإصدار</span><span class="value">${inv.date}</span></div>
      <div class="row"><span class="label">تاريخ الاستحقاق</span><span class="value">${inv.dueDate}</span></div>
      ${inv.paidDate ? `<div class="row"><span class="label">تاريخ الدفع</span><span class="value status-paid">${inv.paidDate}</span></div>` : ''}
      <div class="total">
        <div style="font-size:13px;color:#888;margin-bottom:4px">إجمالي المبلغ</div>
        <div style="font-size:28px;font-weight:700;color:#1a5c2a">${inv.amount.toLocaleString()} د.إ</div>
      </div>
      <div class="row"><span class="label">الحالة</span><span class="value status-${inv.status}">${STATUS_MAP[inv.status]?.label}</span></div>
      ${inv.notes ? `<div style="margin-top:12px;padding:12px;background:#fffbe6;border-radius:6px"><span style="color:#888;font-size:12px">ملاحظات: </span>${inv.notes}</div>` : ''}
      <div class="footer">طُبع بتاريخ ${new Date().toLocaleDateString('ar-AE')} · ${buildingName ?? ''}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  /* ── Invoices tab ── */
  const invoiceColumns = [
    { title: 'رقم الفاتورة', dataIndex: 'id', render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11, color: PRIMARY }}>{v}</Text> },
    { title: 'النوع', dataIndex: 'type', render: (v: string, r: TenantInvoice) => <Tag color={TYPE_MAP[v]?.color} style={{ fontSize: 11 }}>{r.typeLabel}</Tag> },
    { title: 'الفترة', dataIndex: 'period', render: (v?: string) => <Text style={{ fontSize: 12 }}>{v ?? '—'}</Text> },
    { title: 'المبلغ', dataIndex: 'amount', render: (v: number) => <Text strong style={{ color: PRIMARY }}>{v.toLocaleString()} <small>د.إ</small></Text> },
    { title: 'الاستحقاق', dataIndex: 'dueDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={STATUS_MAP[v]?.color} icon={STATUS_MAP[v]?.icon} style={{ fontSize: 11 }}>{STATUS_MAP[v]?.label}</Tag> },
    { title: '', key: 'actions', width: 50, render: (_: unknown, r: TenantInvoice) => (
      <Tooltip title="طباعة"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => handlePrint(r)} /></Tooltip>
    )},
  ];

  /* ── Payments tab — Timeline view + summary table ── */
  const paymentMethodTotals = Object.keys(METHOD_MAP).map(m => ({
    method: m, ...METHOD_MAP[m],
    total: payments.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0),
    count: payments.filter(p => p.method === m).length,
  })).filter(m => m.count > 0);

  const paymentsContent = (
    <div>
      {/* Summary by method */}
      <div style={{ marginBottom: 20 }}>
        <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 10 }}>
          <WalletOutlined style={{ marginInlineEnd: 6 }} />ملخص طرق الدفع
        </Text>
        <Row gutter={10}>
          {paymentMethodTotals.map(m => (
            <Col span={Math.floor(24 / Math.min(paymentMethodTotals.length, 4))} key={m.method}>
              <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, color: '#595959', marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{m.total.toLocaleString()} <small style={{ fontWeight: 400 }}>د.إ</small></div>
                <div style={{ fontSize: 11, color: '#888' }}>{m.label} · {m.count} دفعة</div>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      <Divider style={{ margin: '0 0 16px' }} />

      {/* Timeline */}
      <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 14 }}>
        <HistoryOutlined style={{ marginInlineEnd: 6 }} />سجل المدفوعات
      </Text>
      <Timeline
        style={{ direction: 'rtl' }}
        items={payments.map(p => ({
          color: METHOD_MAP[p.method]?.color === 'green' ? 'green' : 'blue',
          dot: <div style={{ fontSize: 14 }}>{METHOD_MAP[p.method]?.icon}</div>,
          content: (
            <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: '12px 14px', marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{p.amount.toLocaleString()} <small style={{ fontWeight: 400, color: '#888' }}>د.إ</small></Text>
                  <Tag color={METHOD_MAP[p.method]?.color} style={{ marginInlineStart: 8, fontSize: 11 }}>{p.methodLabel}</Tag>
                </div>
                <Text style={{ fontSize: 11, color: '#aaa' }}>{p.date}</Text>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#595959' }}>
                <FileTextOutlined style={{ marginInlineEnd: 4, color: PRIMARY }} />
                {p.invoiceLabel}
              </div>
              {p.reference && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                  مرجع: <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.reference}</Text>
                </div>
              )}
              {p.receivedBy && (
                <div style={{ marginTop: 2, fontSize: 11, color: '#888' }}>
                  <UserOutlined style={{ marginInlineEnd: 4 }} />استلم: {p.receivedBy}
                </div>
              )}
              {p.notes && <div style={{ marginTop: 4, fontSize: 11, color: '#fa8c16' }}>{p.notes}</div>}
            </div>
          ),
        }))}
      />
    </div>
  );

  return (
    <>
      <Drawer
        open={open} onClose={onClose} placement="left" width={700}
        styles={{ header: { display: 'none' }, body: { padding: 0 } }}
      >
        {/* ── Header ── */}
        <div style={{ background: `linear-gradient(135deg,${PRIMARY},#2e7d32)`, padding: '20px 24px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
                {tenant.avatar}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{tenant.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  <UserOutlined style={{ marginInlineEnd: 4 }} />
                  وحدة {tenant.unit} · طابق {tenant.floor} · {tenant.contractNo}
                </div>
              </div>
            </div>
            <Space>
              <Button icon={<DollarOutlined />} onClick={() => setRecordPaymentOpen(true)}
                style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                تسجيل دفعة
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewInvoiceOpen(true)}
                style={{ background: GOLD, borderColor: GOLD, color: '#fff', fontWeight: 600 }}>
                فاتورة جديدة
              </Button>
            </Space>
          </div>

          {/* KPIs */}
          <Row gutter={12} style={{ marginTop: 16 }}>
            {[
              { label: 'إجمالي المدفوع', value: `${totalPaid.toLocaleString()} د.إ`, color: '#95f985' },
              { label: 'المستحق', value: `${totalPending.toLocaleString()} د.إ`, color: overdueCount > 0 ? '#ffccc7' : '#ffe58f' },
              { label: 'إجمالي الدفعات', value: `${totalPayments.toLocaleString()} د.إ`, color: '#91caff' },
              { label: 'رصيد الغاز', value: `${tenant.gasBalance ?? 0} م³`, color: '#d3f261' },
            ].map(k => (
              <Col span={6} key={k.label}>
                <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{k.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        {/* ── Tabs ── */}
        <div style={{ padding: '0 24px 24px' }}>
          {overdueCount > 0 && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px', margin: '16px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text style={{ color: '#ff4d4f', fontSize: 13 }}>
                يوجد <Text strong style={{ color: '#ff4d4f' }}>{overdueCount}</Text> فاتورة متأخرة السداد
              </Text>
            </div>
          )}

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ direction: 'rtl' }}
            items={[
              {
                key: 'invoices',
                label: <span><CreditCardOutlined /> الفواتير <Tag style={{ marginInlineStart: 4 }}>{invoices.length}</Tag></span>,
                children: (
                  <Table dataSource={invoices} columns={invoiceColumns} rowKey="id"
                    size="small" pagination={false} style={{ direction: 'rtl' }}
                    rowClassName={(r: TenantInvoice) => r.status === 'overdue' ? 'ant-table-row-danger' : ''} />
                ),
              },
              {
                key: 'payments',
                label: <span><HistoryOutlined /> سجل المدفوعات <Tag style={{ marginInlineStart: 4 }}>{payments.length}</Tag></span>,
                children: paymentsContent,
              },
            ]}
          />
        </div>
      </Drawer>

      <NewInvoiceModal open={newInvoiceOpen} tenantName={tenant.name} contractNo={tenant.contractNo}
        onClose={() => setNewInvoiceOpen(false)}
        onSave={(inv) => setInvoices(prev => [inv, ...prev])} />

      <RecordPaymentModal open={recordPaymentOpen} tenantName={tenant.name} invoices={invoices}
        onClose={() => setRecordPaymentOpen(false)}
        onSave={(p) => setPayments(prev => [p, ...prev])} />
    </>
  );
};

export default TenantInvoicesDrawer;
