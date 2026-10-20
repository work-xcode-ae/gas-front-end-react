import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Button, Space, Card, Row, Col, Input, Select, DatePicker, Segmented, Dropdown, Drawer, Modal, Form, InputNumber, Typography,
  message, Divider, Switch, Empty, Alert,
} from 'antd';
import {
  PlusOutlined, PrinterOutlined, StopOutlined, UserOutlined, ShopOutlined, BankOutlined, ArrowDownOutlined, ArrowUpOutlined, ReloadOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useReference } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { useGlobalFilters } from '../../context/GlobalFilters';
import { PRIMARY, DARK, GOLD, money, PAYMENT_METHODS, methodLabel, PRINT_CSS, RecordPaymentModal, BuildingSelect } from './shared';
import { amountInWords } from './amountWords';

const { Text } = Typography;
export type VoucherType = 'receipt' | 'payment';
type Party = 'customer' | 'supplier' | 'account';

interface Row {
  party: Party; id: number; no: string; type: VoucherType; date: string; partyId?: number; partyName: string; account?: string | null;
  amount: number; method?: string; reference?: string | null; status?: string; statusLabel?: string; description?: string | null; journalNo?: string | null;
}

const PARTY: Record<Party, { label: string; color: string; icon: React.ReactNode }> = {
  customer: { label: 'عميل', color: 'blue', icon: <UserOutlined /> },
  supplier: { label: 'مورد', color: 'orange', icon: <ShopOutlined /> },
  account: { label: 'حساب', color: 'purple', icon: <BankOutlined /> },
};
const STATUS: Record<string, { color: string; label: string }> = {
  completed: { color: 'success', label: 'مكتمل' }, posted: { color: 'success', label: 'مرحّل' }, pending: { color: 'gold', label: 'قيد التحصيل' },
  bounced: { color: 'magenta', label: 'مرتجع' }, cancelled: { color: 'default', label: 'ملغى' },
};
const TITLE: Record<VoucherType, string> = { receipt: 'سند قبض', payment: 'سند صرف' };

// ═══════════════════════════ printable voucher ═══════════════════════════
export function VoucherDrawer({ party, id, onClose, onChanged }: { party: Party | null; id: number | null; onClose: () => void; onChanged: () => void }) {
  const [v, setV] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { can } = useAuth();
  useEffect(() => {
    if (!party || !id) { setV(null); return; }
    api<any>(`/vouchers/${party}/${id}`).then(setV).catch(e => message.error(errorMessage(e)));
  }, [party, id]);

  const cancel = async () => {
    if (!reason.trim()) { message.warning('اكتب سبب الإلغاء'); return; }
    setBusy(true);
    try {
      const path = party === 'customer' ? `/payments/${id}/cancel` : party === 'supplier' ? `/vendor-payments/${id}/cancel` : `/vouchers/account/${id}/cancel`;
      await api(path, { method: 'POST', body: { reason } });
      message.success('تم إلغاء السند وعكس القيد');
      setCancelOpen(false); setReason('');
      onChanged(); onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  const receipt = v?.type === 'receipt';
  const cancelled = v?.status === 'cancelled' || v?.status === 'bounced';
  const canCancel = party === 'customer' ? can('payments.cancel') : party === 'supplier' ? can('payables.manage') : can('payments.manage');
  useTrackView(party === 'customer' ? 'Payment' : party === 'supplier' ? 'VendorPayment' : 'Voucher', party ? id : null);
  return (
    <Drawer open={!!party && !!id} onClose={onClose} width={Math.min(window.innerWidth - 24, 820)} title={v ? `${TITLE[v.type as VoucherType]} ${v.no}` : 'السند'}
      extra={v && <Space className="no-print">
        <HistoryButton entityType={party === 'customer' ? 'Payment' : party === 'supplier' ? 'VendorPayment' : 'Voucher'} id={id} title={`${TITLE[v.type as VoucherType]} ${v.no}`} size="middle" />
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة / PDF</Button>
        {!cancelled && canCancel && <Button danger icon={<StopOutlined />} onClick={() => setCancelOpen(true)}>إلغاء السند</Button>}
      </Space>}>
      <style>{PRINT_CSS}</style>
      {!v ? null : (
        <div className="print-sheet" style={{ border: `2px solid ${receipt ? PRIMARY : '#d46b08'}`, borderRadius: 12, padding: 24, position: 'relative', background: '#fff' }}>
          {cancelled && <div style={{ position: 'absolute', top: '40%', left: '20%', transform: 'rotate(-20deg)', fontSize: 64, color: 'rgba(255,0,0,.15)', fontWeight: 900 }}>ملغى</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{v.company?.nameAr ?? v.company?.nameEn}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{v.company?.address}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{v.company?.phone}{v.company?.trn ? ` · الرقم الضريبي ${v.company.trn}` : ''}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: receipt ? PRIMARY : '#d46b08' }}>{TITLE[v.type as VoucherType]}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{receipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}</div>
            </div>
            <div style={{ textAlign: 'left', fontSize: 13 }}>
              <div>رقم السند: <b style={{ fontFamily: 'monospace' }}>{v.no}</b></div>
              <div>التاريخ: <b>{v.date}</b></div>
              {v.journalNo && <div style={{ color: '#888', fontSize: 11 }}>القيد: {v.journalNo}</div>}
            </div>
          </div>
          <Divider style={{ margin: '14px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ border: `2px solid ${GOLD}`, borderRadius: 8, padding: '6px 16px', fontSize: 20, fontWeight: 800, fontFamily: 'monospace' }}>{money(v.amount)}</div>
            <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{amountInWords(Number(v.amount))}</div>
          </div>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                [receipt ? 'استلمنا من السيد/السادة' : 'صرفنا إلى السيد/السادة', `${v.partyName ?? ''}${v.partyCode ? ` (${v.partyCode})` : ''}`],
                ['الحساب', v.account],
                ['طريقة الدفع', `${methodLabel(v.method)}${v.chequeNo ? ` — شيك رقم ${v.chequeNo}${v.chequeDate ? ` تاريخ ${v.chequeDate}` : ''}${v.bankName ? ` — ${v.bankName}` : ''}` : ''}`],
                ['المرجع', v.reference],
                ['المبنى', v.building],
                ['وذلك عن', v.description],
              ].filter(r => r[1]).map(([k, val]) => (
                <tr key={k as string} style={{ borderBottom: '1px dashed #ddd' }}>
                  <td style={{ padding: '8px 4px', width: 190, color: '#666' }}>{k}</td><td style={{ padding: '8px 4px', fontWeight: 600 }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(v.allocations ?? []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong style={{ fontSize: 13 }}>{receipt ? 'سداد الفواتير' : 'سداد فواتير المورد'}</Text>
              <table style={{ width: '100%', fontSize: 12.5, marginTop: 4, borderCollapse: 'collapse' }}>
                <tbody>{v.allocations.map((a: any) => (
                  <tr key={a.no} style={{ borderBottom: '1px solid #f0f0f0' }}><td style={{ padding: 4, fontFamily: 'monospace' }}>{a.no}</td><td style={{ padding: 4, textAlign: 'left' }}>{money(a.amount)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {v.cancelReason && <Alert type="error" style={{ marginTop: 12 }} message={`سبب الإلغاء: ${v.cancelReason}`} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, fontSize: 13, textAlign: 'center' }}>
            {['المحاسب', receipt ? 'أمين الصندوق' : 'المدير المالي', receipt ? 'توقيع الدافع' : 'توقيع المستلم'].map(s => (
              <div key={s} style={{ width: '30%' }}><div style={{ borderTop: '1px solid #999', paddingTop: 6 }}>{s}</div></div>
            ))}
          </div>
          {v.by && <div style={{ fontSize: 11, color: '#999', marginTop: 12 }}>أُنشئ بواسطة: {v.by}</div>}
        </div>
      )}
      <Modal open={cancelOpen} title="إلغاء السند" okText="إلغاء السند" okButtonProps={{ danger: true }} cancelText="رجوع" confirmLoading={busy} onOk={cancel} onCancel={() => setCancelOpen(false)}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="سيُعكس القيد المحاسبي للسند، ويُعاد فتح الفواتير المسددة به إن وجدت." />
        <Input.TextArea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإلغاء (مطلوب)" />
      </Modal>
    </Drawer>
  );
}

// ═══════════════════════════ branch picker (default = header branch / first branch) ═══════════════════════════
function useBranchDefault() {
  const { i18n } = useTranslation();
  const ref = useReference(i18n.language);
  const { branchId } = useGlobalFilters();
  const branches = ref.data?.branches ?? [];
  return { branches, defaultBranch: branchId ?? (branches.length === 1 ? branches[0].id : undefined) };
}

// ═══════════════════════════ voucher against any account ═══════════════════════════
export function AccountVoucherModal({ type, open, onClose, onSaved }: { type: VoucherType; open: boolean; onClose: () => void; onSaved: (id: number) => void }) {
  const [form] = Form.useForm();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const { branches, defaultBranch } = useBranchDefault();
  const method = Form.useWatch('method', form);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), method: 'cash', branchId: defaultBranch });
    api<any[]>('/vouchers/accounts').then(setAccounts).catch(() => setAccounts([]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<{ id: number; voucherNo: string }>('/vouchers', {
        method: 'POST', body: {
          branchId: v.branchId ?? null, voucherType: type, date: v.date.format('YYYY-MM-DD'), accountId: v.accountId, partyName: v.partyName, amount: v.amount,
          method: v.method, reference: v.reference || null, chequeNo: v.chequeNo || null, chequeDate: v.chequeDate?.format('YYYY-MM-DD') ?? null,
          bankName: v.bankName || null, buildingId: v.buildingId ?? null, description: v.description || null,
        },
      });
      message.success(`تم إنشاء ${TITLE[type]} ${r.voucherNo}`);
      onSaved(r.id);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    accounts.forEach(a => { const k = a.typeLabel ?? 'أخرى'; m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()].map(([label, list]) => ({ label, options: list.map(a => ({ value: a.id, label: `${a.accountCode} — ${a.name}` })) }));
  }, [accounts]);

  return (
    <Modal open={open} width={680} title={`${TITLE[type]} — ${type === 'receipt' ? 'من حساب آخر' : 'لحساب آخر'}`} okText="حفظ وترحيل" cancelText="إلغاء"
      onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="partyName" label={type === 'receipt' ? 'استلمنا من' : 'صرفنا إلى'} rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="accountId" label={type === 'receipt' ? 'الحساب الدائن (مثل: إيرادات أخرى، جاري المالك)' : 'الحساب المدين (مثل: مصروف، سلفة موظف)'} rules={[{ required: true, message: 'اختر الحساب' }]}>
            <Select showSearch optionFilterProp="label" options={grouped} placeholder="ابحث بالرقم أو الاسم…" notFoundContent="لا توجد حسابات — أنشئ دليل الحسابات أولاً" />
          </Form.Item></Col>
          <Col span={8}><Form.Item name="amount" label="المبلغ (د.إ)" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="date" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item></Col>
          <Col span={8}><Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}><Select options={PAYMENT_METHODS} /></Form.Item></Col>
          {method === 'cheque' && (
            <>
              <Col span={8}><Form.Item name="chequeNo" label="رقم الشيك" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="chequeDate" label="تاريخ الشيك"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="bankName" label="البنك"><Input /></Form.Item></Col>
            </>
          )}
          <Col span={12}><Form.Item name="reference" label="المرجع"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="buildingId" label="المبنى (اختياري)"><BuildingSelect style={{ width: '100%' }} /></Form.Item></Col>
          {branches.length > 1 && <Col span={12}><Form.Item name="branchId" label="الفرع" rules={[{ required: true }]}><Select options={branches.map(b => ({ value: b.id, label: b.nameAr ?? b.nameEn ?? b.code }))} /></Form.Item></Col>}
          <Col span={24}><Form.Item name="description" label="وذلك عن" rules={[{ required: true, message: 'اكتب البيان' }]}><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}

// ═══════════════════════════ payment to a supplier (with bill allocation) ═══════════════════════════
export function SupplierPaymentModal({ open, vendorId, billId, onClose, onSaved }: { open: boolean; vendorId?: number; billId?: number; onClose: () => void; onSaved: (id: number) => void }) {
  const [form] = Form.useForm();
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendor, setVendor] = useState<number | undefined>(vendorId);
  const [bills, setBills] = useState<any[]>([]);
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const { branches, defaultBranch } = useBranchDefault();
  const amount = Form.useWatch('amount', form) as number | undefined;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), method: 'bank_transfer', vendorId, branchId: defaultBranch });
    setVendor(vendorId);
    api<any[]>('/vendors/options').then(r => setVendors(r.filter(v => v.code !== 'OWN-COMPANY'))).catch(() => setVendors([]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !vendor) { setBills([]); return; }
    api<Paged<any>>('/vendor-bills', { query: { vendorId: vendor, openOnly: true, pageSize: 0 } }).then(r => {
      const list = [...r.items].sort((a, b) => String(a.dueDate ?? a.billDate).localeCompare(String(b.dueDate ?? b.billDate)));
      setBills(list);
      if (billId) { const b = list.find(x => x.id === billId); if (b) form.setFieldsValue({ amount: Number(b.balance) }); }
    }).catch(() => setBills([]));
  }, [open, vendor]); // eslint-disable-line react-hooks/exhaustive-deps

  // oldest first, or the chosen bill first
  useEffect(() => {
    let left = Number(amount ?? 0);
    const order = billId ? [...bills.filter(b => b.id === billId), ...bills.filter(b => b.id !== billId)] : bills;
    const a: Record<number, number> = {};
    order.forEach(b => { const x = Math.min(left, Number(b.balance)); if (x > 0) { a[b.id] = Math.round(x * 100) / 100; left -= x; } });
    setAlloc(a);
  }, [amount, bills, billId]);

  const allocated = Object.values(alloc).reduce((s, x) => s + Number(x || 0), 0);
  const save = async () => {
    const v = await form.validateFields();
    if (allocated > Number(v.amount) + 0.001) { message.error('التخصيص أكبر من المبلغ'); return; }
    setSaving(true);
    try {
      const r = await api<{ id: number; paymentNo: string }>('/vendor-payments', {
        method: 'POST', body: {
          branchId: v.branchId ?? null, vendorId: v.vendorId, amount: v.amount, date: v.date.format('YYYY-MM-DD'), method: v.method, reference: v.reference || null,
          notes: v.notes || null, allocations: Object.entries(alloc).filter(([, x]) => Number(x) > 0).map(([id, x]) => ({ vendorBillId: Number(id), amount: Number(x) })),
        },
      });
      message.success(`تم إنشاء سند الصرف ${r.paymentNo}`);
      onSaved(r.id);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} width={720} title="سند صرف — دفعة لمورد" okText="حفظ وترحيل" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="vendorId" label="المورد" rules={[{ required: true, message: 'اختر المورد' }]}>
            <Select showSearch optionFilterProp="label" onChange={(x: number) => setVendor(x)} options={vendors.map(v => ({ value: v.id, label: v.name }))} />
          </Form.Item></Col>
          <Col span={6}><Form.Item name="amount" label="المبلغ" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="date" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item></Col>
          <Col span={8}><Form.Item name="method" label="طريقة الدفع"><Select options={PAYMENT_METHODS} /></Form.Item></Col>
          <Col span={8}><Form.Item name="reference" label="المرجع / رقم الشيك"><Input /></Form.Item></Col>
          {branches.length > 1 && <Col span={8}><Form.Item name="branchId" label="الفرع" rules={[{ required: true }]}><Select options={branches.map(b => ({ value: b.id, label: b.nameAr ?? b.nameEn ?? b.code }))} /></Form.Item></Col>}
          <Col span={24}><Form.Item name="notes" label="البيان"><Input /></Form.Item></Col>
        </Row>
      </Form>
      <Text strong>فواتير المورد المفتوحة</Text>
      <Table size="small" rowKey="id" pagination={false} dataSource={bills} locale={{ emptyText: vendor ? 'لا توجد فواتير مفتوحة — سيُسجل المبلغ كدفعة مقدمة' : 'اختر المورد' }}
        columns={[
          { title: 'الفاتورة', dataIndex: 'billNo' }, { title: 'التاريخ', dataIndex: 'billDate' }, { title: 'الاستحقاق', dataIndex: 'dueDate' },
          { title: 'الرصيد', dataIndex: 'balance', render: x => money(x) },
          { title: 'المخصص', key: 'a', render: (_, b) => <InputNumber size="small" min={0} max={Number(b.balance)} value={alloc[b.id]} onChange={x => setAlloc(s => ({ ...s, [b.id]: Number(x ?? 0) }))} /> },
        ]} />
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>المخصص: {money(allocated)} · غير مخصص: {money(Math.max(0, Number(amount ?? 0) - allocated))}</div>
    </Modal>
  );
}

// ═══════════════════════════ list page (one per voucher type) ═══════════════════════════
export default function Vouchers({ type }: { type: VoucherType }) {
  const { can } = useAuth();
  const [data, setData] = useState<{ items: Row[]; total: number; count: number; byParty: any[]; byMethod: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('year'), dayjs()]);
  const [party, setParty] = useState<Party | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(true);
  const [view, setView] = useState<{ party: Party; id: number } | null>(null);
  const [newKind, setNewKind] = useState<Party | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<any>('/vouchers', { query: { type, party: party === 'all' ? undefined : party, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD'), search: search || undefined, includeCancelled: showCancelled } })
      .then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [type, party, range, search, showCancelled]);
  useEffect(() => { load(); }, [load]);

  const receipt = type === 'receipt';
  const sumParty = (p: Party) => data?.byParty.find((x: any) => x.party === p)?.amount ?? 0;
  const newItems = receipt
    ? [{ key: 'customer', label: 'من عميل (سداد فواتير)', icon: <UserOutlined />, disabled: !can('payments.manage') }, { key: 'account', label: 'من حساب آخر (إيرادات أخرى، مالك…)', icon: <BankOutlined />, disabled: !can('payments.manage') }]
    : [{ key: 'supplier', label: 'لمورد (سداد فواتير مشتريات)', icon: <ShopOutlined />, disabled: !can('payables.manage') }, { key: 'account', label: 'لحساب آخر (مصروف، سلفة…)', icon: <BankOutlined />, disabled: !can('payments.manage') }];
  const opened = (p: Party, id: number) => { setNewKind(null); load(); setView({ party: p, id }); };

  return (
    <div>
      <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
        {[
          { label: `إجمالي ${receipt ? 'المقبوضات' : 'المدفوعات'} (${data?.count ?? 0} سند)`, value: data?.total ?? 0, color: receipt ? PRIMARY : '#d46b08', icon: receipt ? <ArrowDownOutlined /> : <ArrowUpOutlined /> },
          receipt ? { label: 'من العملاء', value: sumParty('customer'), color: '#1677ff', icon: <UserOutlined /> } : { label: 'للموردين', value: sumParty('supplier'), color: '#fa8c16', icon: <ShopOutlined /> },
          { label: receipt ? 'إيرادات وحسابات أخرى' : 'مصروفات وحسابات أخرى', value: sumParty('account'), color: '#722ed1', icon: <BankOutlined /> },
          ...(data?.byMethod ?? []).slice(0, 3).map((m: any) => ({ label: methodLabel(m.method), value: m.amount, color: '#555', icon: null as React.ReactNode })),
        ].map(t => (
          <Col key={t.label} xs={12} md={8} xl={4}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.color }}>{money(t.value)}</div>
              <div style={{ fontSize: 11.5, color: '#777' }}>{t.icon} {t.label}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <DatePicker.RangePicker value={range as any} onChange={r => setRange(r as any)} />
          <Segmented value={party} onChange={v => setParty(v as any)} options={[{ value: 'all', label: 'الكل' },
            ...(receipt ? [{ value: 'customer', label: 'عملاء' }] : [{ value: 'supplier', label: 'موردون' }]), { value: 'account', label: 'حسابات أخرى' }]} />
          <Input.Search allowClear placeholder="رقم السند، الاسم، المرجع…" style={{ width: 240 }} onSearch={setSearch} />
          <Space size={4}><Switch size="small" checked={showCancelled} onChange={setShowCancelled} /><Text style={{ fontSize: 12 }}>إظهار الملغاة</Text></Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        <Dropdown menu={{ items: newItems, onClick: ({ key }) => setNewKind(key as Party) }}>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: receipt ? PRIMARY : '#d46b08', borderColor: receipt ? PRIMARY : '#d46b08' }}>{TITLE[type]} جديد</Button>
        </Dropdown>
      </Space>
      <Table<Row> size="small" rowKey={r => `${r.party}-${r.id}`} loading={loading} dataSource={data?.items ?? []} scroll={{ x: 1000 }}
        pagination={{ pageSize: 20, showTotal: t => `${t} سند` }} locale={{ emptyText: <Empty description="لا توجد سندات في هذه الفترة" /> }}
        onRow={r => ({ onClick: () => setView({ party: r.party, id: r.id }), style: { cursor: 'pointer', opacity: r.status === 'cancelled' || r.status === 'bounced' ? 0.55 : 1 } })}
        summary={rows => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={5}><b>المجموع (بدون الملغاة)</b></Table.Summary.Cell>
            <Table.Summary.Cell index={5}><b>{money(rows.filter(r => r.status !== 'cancelled' && r.status !== 'bounced').reduce((s, r) => s + Number(r.amount), 0))}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={6} colSpan={4} />
          </Table.Summary.Row>
        )}
        columns={[
          { title: 'رقم السند', dataIndex: 'no', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
          { title: 'التاريخ', dataIndex: 'date', width: 100 },
          { title: 'النوع', dataIndex: 'party', width: 90, render: (p: Party) => <Tag color={PARTY[p].color} icon={PARTY[p].icon}>{PARTY[p].label}</Tag> },
          { title: receipt ? 'استلمنا من' : 'صرفنا إلى', dataIndex: 'partyName' },
          { title: 'الحساب / البيان', key: 'acc', render: (_, r) => <div style={{ fontSize: 12 }}>{r.account ?? (r.party === 'customer' ? 'ذمم العملاء' : 'ذمم الموردين')}{r.description && <div style={{ color: '#888', fontSize: 11 }}>{r.description}</div>}</div> },
          { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong>{money(v)}</Text> },
          { title: 'الطريقة', dataIndex: 'method', width: 100, render: m => methodLabel(m) },
          { title: 'المرجع', dataIndex: 'reference', render: v => v ?? '—' },
          { title: 'الحالة', dataIndex: 'status', width: 100, render: (s, r) => <Tag color={STATUS[s ?? '']?.color}>{STATUS[s ?? '']?.label ?? r.statusLabel ?? s}</Tag> },
          { title: '', key: 'v', width: 50, render: () => <Button size="small" type="text" icon={<EyeOutlined />} /> },
        ]} />

      <VoucherDrawer party={view?.party ?? null} id={view?.id ?? null} onClose={() => setView(null)} onChanged={load} />
      <RecordPaymentModal open={newKind === 'customer'} onClose={() => setNewKind(null)} onSaved={rc => { if (rc) opened('customer', rc.id); else { setNewKind(null); load(); } }} />
      <SupplierPaymentModal open={newKind === 'supplier'} onClose={() => setNewKind(null)} onSaved={id => opened('supplier', id)} />
      <AccountVoucherModal type={type} open={newKind === 'account'} onClose={() => setNewKind(null)} onSaved={id => opened('account', id)} />
    </div>
  );
}
