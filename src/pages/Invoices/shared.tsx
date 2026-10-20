import { useEffect, useMemo, useState } from 'react';
import { Select, Modal, Form, InputNumber, DatePicker, Input, Table, Typography, message, Alert, Space, Button } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { api, errorMessage, type Paged } from '../../api/client';

const { Text } = Typography;
export const PRIMARY = '#1a5c2a';
export const DARK = '#0b2e18';
export const GOLD = '#c9a84c';
export const money = (n?: number | null) => `${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`;

export const INVOICE_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, overdue: { color: 'error', label: 'متأخرة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
export const INVOICE_TYPES = [
  { value: 'gas_consumption', label: 'استهلاك غاز' }, { value: 'maintenance', label: 'صيانة (AMC)' }, { value: 'deposit', label: 'تأمين' },
  { value: 'connection', label: 'توصيل' }, { value: 'other', label: 'أخرى' },
];
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقداً' }, { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'cheque', label: 'شيك' },
  { value: 'card', label: 'بطاقة' }, { value: 'online', label: 'إلكتروني' },
];
export const methodLabel = (m?: string) => PAYMENT_METHODS.find(x => x.value === m)?.label ?? m ?? '—';
export const PAYMENT_STATUS: Record<string, { color: string; label: string }> = {
  completed: { color: 'success', label: 'مكتملة' }, pending: { color: 'gold', label: 'قيد التحصيل' },
  bounced: { color: 'magenta', label: 'مرتجعة' }, cancelled: { color: 'default', label: 'ملغاة' },
};

/** Print only the element with class «print-sheet». */
export const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .print-sheet, .print-sheet * { visibility: visible !important; }
  .print-sheet { position: absolute; inset: 0 0 auto 0; width: 100%; padding: 24px; background: #fff; direction: rtl; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 12mm; }
}`;

/** Customer (tenant) picker with server search. */
export function CustomerSelect({ value, onChange, style, allowClear, placeholder }: {
  value?: number; onChange?: (v?: number, row?: any) => void; style?: React.CSSProperties; allowClear?: boolean; placeholder?: string;
}) {
  const [opts, setOpts] = useState<any[]>([]);
  const search = (s?: string) => api<Paged<any>>('/tenants', { query: { search: s || undefined, pageSize: 30 } }).then(r => setOpts(r.items)).catch(() => setOpts([]));
  useEffect(() => { search(); }, []);
  // keep the selected customer in the list after a search
  useEffect(() => {
    if (value && !opts.some(o => o.id === value)) api<any>(`/tenants/${value}`).then(t => { const x = t.tenant ?? t; setOpts(o => [{ id: x.id ?? value, name: x.name ?? x.nameAr ?? x.nameEn, code: x.code ?? x.tenantCode }, ...o]); }).catch(() => undefined);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Select showSearch allowClear={allowClear} filterOption={false} onSearch={search} value={value} style={style} placeholder={placeholder ?? 'العميل / المستأجر'}
      onChange={(v: number | undefined) => onChange?.(v, opts.find(o => o.id === v))}
      options={opts.map(o => ({ value: o.id, label: `${o.name ?? o.nameAr ?? o.nameEn ?? ''}${o.code ? ` (${o.code})` : ''}` }))} />
  );
}

/** Buildings picker (all buildings). */
export function BuildingSelect({ value, onChange, style }: { value?: number; onChange?: (v?: number) => void; style?: React.CSSProperties }) {
  const [opts, setOpts] = useState<any[]>([]);
  useEffect(() => { api<Paged<any>>('/buildings', { query: { pageSize: 0 } }).then(r => setOpts(r.items)).catch(() => setOpts([])); }, []);
  return (
    <Select showSearch allowClear optionFilterProp="label" value={value} onChange={onChange} style={style} placeholder="المبنى"
      options={opts.map(b => ({ value: b.id, label: `${b.code ?? b.no ?? ''} — ${b.name ?? b.nameAr ?? ''}` }))} />
  );
}

// ═════════════ record payment (receipt) with allocation to open invoices ═════════════
interface PayProps { open: boolean; tenantId?: number; invoiceId?: number; onClose: () => void; onSaved: (receipt?: { id: number; receiptNo: string }) => void }

export function RecordPaymentModal({ open, tenantId, invoiceId, onClose, onSaved }: PayProps) {
  const [form] = Form.useForm();
  const [customer, setCustomer] = useState<number | undefined>(tenantId);
  const [openInv, setOpenInv] = useState<{ id: number; no: string; dueDate: string; total: number; paid: number; balance: number }[]>([]);
  const [credit, setCredit] = useState(0);
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const amount = Form.useWatch('amount', form) as number | undefined;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), method: 'bank_transfer', status: 'completed' });
    setCustomer(tenantId);
    setAlloc({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !customer) { setOpenInv([]); setCredit(0); return; }
    api<any>('/payments/open-invoices', { query: { tenantId: customer } })
      .then(r => {
        setOpenInv(r.invoices ?? []); setCredit(Number(r.credit ?? 0));
        const only = invoiceId ? (r.invoices ?? []).find((i: any) => i.id === invoiceId) : null;
        const total = only ? Number(only.balance) : (r.invoices ?? []).reduce((s: number, i: any) => s + Number(i.balance), 0);
        form.setFieldsValue({ amount: total > 0 ? Math.round(total * 100) / 100 : undefined });
      })
      .catch(() => { setOpenInv([]); setCredit(0); });
  }, [open, customer, invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIFO fill (or only the chosen invoice) whenever the amount changes
  useEffect(() => {
    let left = Number(amount ?? 0);
    const next: Record<number, number> = {};
    const list = invoiceId ? openInv.filter(i => i.id === invoiceId) : openInv;
    for (const i of list) {
      if (left <= 0) break;
      const a = Math.min(left, Number(i.balance));
      next[i.id] = Math.round(a * 100) / 100;
      left -= a;
    }
    setAlloc(next);
  }, [amount, openInv, invoiceId]);

  const allocated = useMemo(() => Object.values(alloc).reduce((s, v) => s + Number(v || 0), 0), [alloc]);

  const save = async () => {
    const v = await form.validateFields();
    if (!customer) { message.warning('اختر العميل'); return; }
    if (allocated - Number(v.amount) > 0.001) { message.error('مجموع التخصيص أكبر من مبلغ الدفعة'); return; }
    setSaving(true);
    try {
      const allocations = Object.entries(alloc).filter(([, a]) => Number(a) > 0).map(([id, a]) => ({ invoiceId: Number(id), amount: Number(a) }));
      const r = await api<{ id: number; receiptNo: string; unallocated: number }>('/payments', {
        method: 'POST', body: {
          tenantId: customer, amount: v.amount, date: v.date.format('YYYY-MM-DD'), method: v.method, reference: v.reference || null,
          notes: v.notes || null, status: v.status, allocations: allocations.length ? allocations : null,
        },
      });
      message.success(`تم تسجيل سند القبض ${r.receiptNo}${r.unallocated > 0 ? ` — رصيد دائن غير مخصص ${money(r.unallocated)}` : ''}`);
      onSaved(r);
      onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title="تسجيل دفعة / سند قبض" okText="حفظ السند" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} width={760} destroyOnClose>
      <Form form={form} layout="vertical">
        <Space wrap style={{ display: 'flex' }} align="start">
          <Form.Item label="العميل" required style={{ minWidth: 260 }}>
            <CustomerSelect value={customer} onChange={v => setCustomer(v)} style={{ width: 260 }} />
          </Form.Item>
          <Form.Item name="amount" label="المبلغ (د.إ)" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: 160 }} /></Form.Item>
          <Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true }]}><DatePicker disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item>
        </Space>
        <Space wrap style={{ display: 'flex' }} align="start">
          <Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}>
            <Select style={{ width: 150 }} options={PAYMENT_METHODS}
              onChange={m => form.setFieldsValue({ status: m === 'cheque' ? 'pending' : 'completed' })} />
          </Form.Item>
          <Form.Item name="status" label="الحالة"><Select style={{ width: 150 }} options={[{ value: 'completed', label: 'مكتملة' }, { value: 'pending', label: 'قيد التحصيل (شيك)' }]} /></Form.Item>
          <Form.Item name="reference" label="المرجع / رقم الشيك"><Input style={{ width: 200 }} dir="ltr" /></Form.Item>
        </Space>
        {credit > 0 && <Alert type="info" showIcon style={{ marginBottom: 8 }} message={`لدى العميل رصيد دائن غير مخصص ${money(credit)}`} />}
        <Text strong style={{ fontSize: 13 }}>التخصيص على الفواتير المفتوحة</Text>
        <Table size="small" rowKey="id" pagination={false} style={{ marginTop: 6 }} dataSource={invoiceId ? openInv.filter(i => i.id === invoiceId) : openInv}
          locale={{ emptyText: customer ? 'لا توجد فواتير مفتوحة — ستُسجل الدفعة كرصيد دائن' : 'اختر العميل' }}
          columns={[
            { title: 'الفاتورة', dataIndex: 'no', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
            { title: 'الاستحقاق', dataIndex: 'dueDate', render: v => <span style={{ color: dayjs(v).isBefore(dayjs(), 'day') ? '#ff4d4f' : undefined }}>{v}</span> },
            { title: 'الإجمالي', dataIndex: 'total', render: money },
            { title: 'الرصيد', dataIndex: 'balance', render: v => <Text strong>{money(v)}</Text> },
            { title: 'المخصص', key: 'a', width: 150, render: (_, i) => (
              <InputNumber size="small" min={0} max={Number(i.balance)} value={alloc[i.id] ?? 0} style={{ width: 130 }}
                onChange={v => setAlloc(a => ({ ...a, [i.id]: Number(v ?? 0) }))} />) },
          ]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
          <span>المخصص: <Text strong>{money(allocated)}</Text></span>
          <span>غير مخصص (رصيد دائن): <Text strong style={{ color: '#1677ff' }}>{money(Math.max(0, Number(amount ?? 0) - allocated))}</Text></span>
          <Button size="small" type="link" onClick={() => setAlloc({})}>مسح التخصيص (توزيع تلقائي FIFO)</Button>
        </div>
        <Form.Item name="notes" label="ملاحظات" style={{ marginTop: 8 }}><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}

// ---------- tax codes valid on the document date ----------
export type TaxOption = { id: number; code: string; name?: string; category: string; rate: number; isDefault: boolean; validFrom: string; validTo?: string | null };

/** Tax codes valid on `date` for a side (sales | purchases). `fallbackRate` is set only when no tax codes are configured. */
export function useTaxOptions(date: dayjs.Dayjs | undefined, side: 'sales' | 'purchases') {
  const [state, setState] = useState<{ items: TaxOption[]; fallbackRate: number | null; loaded: boolean }>({ items: [], fallbackRate: null, loaded: false });
  const d = (date ?? dayjs()).format('YYYY-MM-DD');
  useEffect(() => {
    let alive = true;
    api<any>('/tax-rates/options', { query: { date: d, side } })
      .then(r => alive && setState({ items: r.items ?? [], fallbackRate: r.fallbackRate ?? null, loaded: true }))
      .catch(() => alive && setState({ items: [], fallbackRate: 5, loaded: true }));
    return () => { alive = false; };
  }, [d, side]);
  const def = state.items.find(t => t.isDefault) ?? state.items.find(t => t.category === 'standard');
  return { ...state, defaultOption: def };
}

/**
 * Keeps the tax of every line in sync with the codes valid on the document date: a line keeps its code (taxCode) but switches
 * to the version valid on the new date; lines without a code get the default. vatRate follows the chosen version.
 */
export function syncTaxLines(form: any, listName: string, tax: ReturnType<typeof useTaxOptions>) {
  if (!tax.loaded) return;
  const lines = (form.getFieldValue(listName) ?? []) as any[];
  let changed = false;
  const next = lines.map(l => {
    if (!l) return l;
    if (tax.items.length === 0) {
      if (l.taxRateId != null) { changed = true; return { ...l, taxRateId: null, taxCode: null, vatRate: tax.fallbackRate ?? l.vatRate }; }
      return l;
    }
    const opt = (l.taxCode && tax.items.find(t => t.code === l.taxCode)) || (l.taxRateId == null && !l.taxCode ? tax.defaultOption : undefined)
      || (l.taxCode ? undefined : tax.items.find(t => t.id === l.taxRateId));
    if (!opt) {
      if (l.taxCode) { changed = true; return { ...l, taxRateId: null }; }   // code not valid on this date → user must pick
      return l;
    }
    if (opt.id !== l.taxRateId || Number(opt.rate) !== Number(l.vatRate) || opt.code !== l.taxCode) { changed = true; return { ...l, taxRateId: opt.id, taxCode: opt.code, vatRate: Number(opt.rate) }; }
    return l;
  });
  if (changed) form.setFieldValue(listName, next);
}

/** New line defaults for the current date. */
export const newTaxLine = (tax: ReturnType<typeof useTaxOptions>) =>
  tax.defaultOption ? { taxRateId: tax.defaultOption.id, taxCode: tax.defaultOption.code, vatRate: Number(tax.defaultOption.rate) } : { taxRateId: null, taxCode: null, vatRate: tax.fallbackRate ?? 5 };

const CAT_SHORT: Record<string, string> = { standard: '', zero_rated: 'صفري', exempt: 'معفى', out_of_scope: 'خارج النطاق', reverse_charge: 'احتساب عكسي' };

/** Tax select for one line (Form.Item name = [field, 'taxRateId']); also writes taxCode and vatRate of the line. */
export function TaxRateSelect({ value, onChange, tax, form, listName, index, style }: {
  value?: number | null; onChange?: (v: number | null) => void; tax: ReturnType<typeof useTaxOptions>; form: any; listName: string; index: number; style?: React.CSSProperties;
}) {
  if (tax.loaded && tax.items.length === 0)
    return <InputNumber min={0} max={100} addonAfter="%" style={style ?? { width: '100%' }} value={form.getFieldValue([listName, index, 'vatRate'])}
      onChange={v => form.setFieldValue([listName, index, 'vatRate'], v ?? 0)} />;
  return (
    <Select value={value ?? undefined} style={style ?? { width: '100%' }} placeholder="الضريبة" status={tax.loaded && value == null ? 'warning' : undefined}
      popupMatchSelectWidth={false}
      onChange={(id: number) => {
        const t = tax.items.find(x => x.id === id);
        form.setFieldValue([listName, index, 'taxCode'], t?.code ?? null);
        form.setFieldValue([listName, index, 'vatRate'], Number(t?.rate ?? 0));
        onChange?.(id);
      }}
      options={tax.items.map(t => ({ value: t.id, label: `${Number(t.rate)}%${CAT_SHORT[t.category] ? ` ${CAT_SHORT[t.category]}` : ''}`,
        title: `${t.code} — ${t.name ?? ''} (${t.validFrom} → ${t.validTo ?? 'مفتوح'})` }))}
      optionRender={o => <span>{o.label} <Text type="secondary" style={{ fontSize: 11 }}>{(o.data as any).title}</Text></span>} />
  );
}
