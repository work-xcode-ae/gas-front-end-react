import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, Row, Select, Steps, Switch, Typography, message } from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, DatabaseOutlined, DollarOutlined, FileTextOutlined, FireOutlined, HomeOutlined,
  IdcardOutlined, InboxOutlined, MailOutlined, PhoneOutlined, PlusCircleOutlined, SafetyCertificateOutlined, TeamOutlined,
  ToolOutlined, UserAddOutlined, UserOutlined, PrinterOutlined, StopOutlined, WalletOutlined, OrderedListOutlined, WarningOutlined,
  ArrowRightOutlined, AlertOutlined, UnorderedListOutlined, UserSwitchOutlined, SearchOutlined, DashboardOutlined, PoweroffOutlined, SwapOutlined, EllipsisOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference } from '../../api/reference';
import type { UnitDto } from '../../api/units';
import { openPrintWindow, printInvoice, printReceipt } from '../../utils/printDocs';
import ContractTermsPicker from '../../components/ContractTermsPicker';
import { toTermInputs, type ContractTermItem } from '../../api/terms';
import ServiceRequestTracker, { AssigneePicker, PRIORITY_STYLE, SR_FLOW_CSS, SrFlow, useAssignees } from './ServiceRequestTracker';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

/** Set when the user is sent from «add tenant» to «install meter»: after the meter is installed the tenant form opens. */
let tenantAfterMeter = false;

/** Actions that can be started from a unit's details drawer. */
/** 'service' opens the service panel on «new request», 'services' on «track requests». */
export type UnitAction = 'tenant' | 'meter' | 'reading' | 'service' | 'services' | 'payment' | 'terminate' | 'invoice';

interface Props {
  action: UnitAction | null;
  unit: UnitDto;
  onClose: () => void;
  /** called after a successful save so the drawer and the building drawing reload; `next` opens another action */
  onDone: (next?: UnitAction) => void;
  /** a change that keeps the panel open (service request created / moved) — reload the drawer behind it */
  onSaved?: () => void;
  tenantPhone?: string;
}

interface TenantOption { id: number; code?: string; name?: string; phone?: string }
interface MeterOption { id: number; meterNo: string; serial?: string; typeLabel?: string; status?: string; statusLabel?: string; brand?: string | null }
interface OpenInvoice { id: number; no: string; dueDate: string; total: number; paid: number; balance: number }
interface ContractInfo { contract: { contractNo: string; startDate: string; endDate?: string | null; balanceAmount?: number; overdueAmount?: number } }

const dateStr = (v?: dayjs.Dayjs | null) => (v ? v.format('YYYY-MM-DD') : undefined);
const d = (v?: string | null) => (v ? String(v).slice(0, 10) : '—');
const money = (v?: number | null) => (v == null || v === 0 ? '—' : `${Number(v).toLocaleString()} د.إ`);
const floorLabel = (f?: number | null) => (f == null ? '' : f === 0 ? 'الطابق الأرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `الطابق ${f}`);

const META: Record<UnitAction, { icon: React.ReactNode; title: string; ok: string; color: string }> = {
  tenant:  { icon: <UserAddOutlined />, title: 'إضافة مستأجر وعقد توريد غاز', ok: 'حفظ المستأجر والعقد', color: PRIMARY },
  meter:   { icon: <FireOutlined />, title: 'تركيب عداد غاز', ok: 'تركيب العداد', color: '#d46b08' },
  reading: { icon: <DatabaseOutlined />, title: 'تسجيل قراءة عداد', ok: 'حفظ القراءة', color: '#1565c0' },
  service: { icon: <ToolOutlined />, title: 'طلب خدمة جديد', ok: 'إرسال الطلب', color: PRIMARY },
  services: { icon: <UnorderedListOutlined />, title: 'متابعة طلبات الخدمة', ok: 'إرسال الطلب', color: PRIMARY },
  payment: { icon: <WalletOutlined />, title: 'تسجيل دفعة من العميل', ok: 'حفظ الدفعة', color: PRIMARY },
  terminate: { icon: <StopOutlined />, title: 'إنهاء عقد المستأجر الحالي', ok: 'إنهاء العقد', color: '#c62828' },
  invoice: { icon: <FileTextOutlined />, title: 'إصدار فاتورة استهلاك غاز', ok: 'إصدار الفاتورة', color: PRIMARY },
};

/** Common service request types: label, icon and the priority they suggest. */
const SR_TYPES = [
  { value: 'leak', label: 'تسريب / رائحة غاز', icon: <AlertOutlined />, priority: 'urgent', color: '#c62828' },
  { value: 'outage', label: 'انقطاع الغاز', icon: <PoweroffOutlined />, priority: 'high', color: '#d46b08' },
  { value: 'meter', label: 'صيانة / عطل عداد', icon: <DashboardOutlined />, priority: 'medium', color: '#1565c0' },
  { value: 'inspection', label: 'فحص دوري', icon: <SearchOutlined />, priority: 'low', color: PRIMARY },
  { value: 'install', label: 'تركيب / نقل', icon: <SwapOutlined />, priority: 'medium', color: '#6d4c41' },
  { value: 'other', label: 'أخرى', icon: <EllipsisOutlined />, priority: 'medium', color: '#555' },
];
const VISIT_SLOTS = [
  { value: 'morning', label: 'صباحاً (8 – 12)' },
  { value: 'afternoon', label: 'ظهراً (12 – 4)' },
  { value: 'evening', label: 'مساءً (4 – 8)' },
  { value: 'any', label: 'أي وقت' },
];

/** Service request type cards (form control: value = type code). */
const SrTypeCards: React.FC<{ value?: string; onChange?: (v: string) => void; onPick?: (t: typeof SR_TYPES[number]) => void }> = ({ value, onChange, onPick }) => (
  <div className="ua-types" role="radiogroup">
    {SR_TYPES.map(t => {
      const on = value === t.value;
      const pick = () => { onChange?.(t.value); onPick?.(t); };
      return (
        <div key={t.value} role="radio" aria-checked={on} tabIndex={0} className={`ua-type${on ? ' on' : ''}`}
          style={on ? { borderColor: t.color, background: `${t.color}0f` } : undefined}
          onClick={pick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') pick(); }}>
          <span className="ua-type-icon" style={{ color: t.color, background: `${t.color}14` }}>{t.icon}</span>
          <span className="ua-type-label">{t.label}</span>
          {on && <CheckCircleOutlined className="ua-type-check" style={{ color: t.color }} />}
        </div>
      );
    })}
  </div>
);

/** Coloured priority selector (low / medium / high / urgent). */
const PriorityPills: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value, onChange }) => (
  <div className="ua-pills" role="radiogroup">
    {Object.entries(PRIORITY_STYLE).map(([k, p]) => (
      <span key={k} role="radio" aria-checked={value === k} tabIndex={0} className={`ua-pill${value === k ? ' on' : ''}`}
        style={value === k ? { background: p.color, borderColor: p.color, color: '#fff' } : { color: p.color, background: p.bg, borderColor: `${p.color}33` }}
        onClick={() => onChange?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onChange?.(k); }}>
        {k === 'urgent' && <AlertOutlined />} {p.label}
      </span>
    ))}
  </div>
);

/** Titled card that groups related fields. */
const Section: React.FC<{ icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; tone?: string }> = ({ icon, title, hint, children, tone = PRIMARY }) => (
  <div className="ua-section">
    <div className="ua-section-head">
      <span className="ua-section-icon" style={{ background: `${tone}14`, color: tone }}>{icon}</span>
      <div>
        <div className="ua-section-title" style={{ color: tone }}>{title}</div>
        {hint && <div className="ua-section-hint">{hint}</div>}
      </div>
    </div>
    {children}
  </div>
);

/** Two big selectable cards (e.g. new tenant / existing tenant). */
const ChoiceCards: React.FC<{ value?: string; onChange?: (v: string) => void; options: { value: string; icon: React.ReactNode; title: string; desc: string }[] }> = ({ value, onChange, options }) => (
  <div className="ua-choices">
    {options.map(o => (
      <div key={o.value} role="radio" aria-checked={value === o.value} tabIndex={0}
        className={`ua-choice${value === o.value ? ' on' : ''}`}
        onClick={() => onChange?.(o.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onChange?.(o.value); }}>
        <span className="ua-choice-icon">{o.icon}</span>
        <div>
          <div className="ua-choice-title">{o.title}</div>
          <div className="ua-choice-desc">{o.desc}</div>
        </div>
        <span className="ua-choice-check">{value === o.value && <CheckCircleOutlined />}</span>
      </div>
    ))}
  </div>
);

/** Quick contract-length picker (months). Controlled by Form.Item (value / onChange); onPick recalculates the end date. */
const DurationPills: React.FC<{ value?: number; onChange?: (v?: number) => void; onPick: (months: number) => void }> = ({ value, onChange, onPick }) => (
  <div className="ua-pills">
    {[6, 12, 24, 36].map(m => {
      const on = value === m;
      return (
        <button type="button" key={m} className="ua-pill" onClick={() => { onChange?.(m); onPick(m); }}
          style={{ borderColor: on ? PRIMARY : '#dfe6df', background: on ? PRIMARY : '#fff', color: on ? '#fff' : '#3d4a40' }}>
          {m === 6 ? '6 أشهر' : m === 12 ? 'سنة' : m === 24 ? 'سنتان' : '3 سنوات'}
        </button>
      );
    })}
  </div>
);

const UnitActionModal: React.FC<Props> = ({ action, unit, onClose, onDone, onSaved, tenantPhone }) => {
  const { i18n } = useTranslation();
  const { data: ref } = useReference(i18n.language);
  const lk = (t: string) => (ref?.lookups?.[t] ?? []).map(v => ({ value: v.code, label: v.label }));
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [meters, setMeters] = useState<MeterOption[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [credit, setCredit] = useState(0);
  const [contractInfo, setContractInfo] = useState<ContractInfo['contract'] | null>(null);
  /** Last reading of the unit's meter — the opening / closing reading cannot be lower. */
  const [lastRead, setLastRead] = useState<{ value: number; date?: string | null } | null>(null);
  /** terms & conditions of the new tenant contract (undefined → the Settings defaults are pre-selected) */
  const [contractTerms, setContractTerms] = useState<ContractTermItem[] | undefined>(undefined);
  // service requests: «new» form or «track» list, optional assignment on creation
  const isService = action === 'service' || action === 'services';
  const [srTab, setSrTab] = useState<'new' | 'track'>('new');
  const [srHighlight, setSrHighlight] = useState<number | null>(null);
  const [srCounts, setSrCounts] = useState<{ open: number; total: number } | null>(null);
  const [srAssignKind, setSrAssignKind] = useState<'none' | 'user' | 'vendor'>('none');
  const [srAssignId, setSrAssignId] = useState<number | undefined>();
  const assignees = useAssignees(isService);

  // defaults + dropdown data whenever a form opens
  useEffect(() => {
    if (!action) return;
    if (action !== 'meter') tenantAfterMeter = false;
    form.resetFields();
    setStep(0);
    if (action === 'tenant') {
      setContractTerms(undefined);
      form.setFieldsValue({ mode: 'new', nationality: 'AE', startDate: dayjs(), duration: 12, endDate: dayjs().add(12, 'month').subtract(1, 'day'), status: 'active', depositPaid: false, autoRenew: false, issueInitialInvoice: true });
      api<Paged<TenantOption>>('/tenants', { query: { pageSize: 0 } }).then(r => setTenants(r.items)).catch(() => setTenants([]));
    }
    setLastRead(null);
    if ((action === 'tenant' || action === 'terminate') && unit.meterId) {
      api<{ meter: { lastReadValue?: number; lastRead?: string | null } }>(`/meters/${unit.meterId}`)
        .then(r => {
          const lr = { value: Number(r.meter?.lastReadValue ?? 0), date: r.meter?.lastRead };
          setLastRead(lr);
          form.setFieldsValue(action === 'tenant' ? { openingReading: lr.value } : { closingReading: undefined });
        })
        .catch(() => setLastRead(null));
    }
    if (action === 'meter') {
      form.setFieldsValue({ mode: 'new', type: 'smart', installDate: dayjs(), initialReading: 0, addTenantNext: tenantAfterMeter && !unit.contractId });
      // stock = meters not installed anywhere; faulty / maintenance / disconnected ones cannot be installed
      api<Paged<MeterOption>>('/meters', { query: { unassigned: true, pageSize: 0 } })
        .then(r => {
          const stock = r.items.filter(m => !m.status || m.status === 'in_stock' || m.status === 'active');
          setMeters(stock);
          if (stock.length) form.setFieldsValue({ mode: 'existing' }); // stock first
        })
        .catch(() => setMeters([]));
    }
    if (action === 'reading') form.setFieldsValue({ readingDate: dayjs(), method: 'manual', allowReset: false });
    if (action === 'service' || action === 'services') {
      form.setFieldsValue({ srType: undefined, priority: 'medium', visitSlot: 'any' });
      setSrTab(action === 'services' ? 'track' : 'new'); setSrHighlight(null); setSrAssignKind('none'); setSrAssignId(undefined);
      api<Paged<{ status?: string }>>('/service-requests', { query: { unitId: unit.id, pageSize: 100 } })
        .then(r => setSrCounts({ open: r.items.filter(x => x.status === 'pending' || x.status === 'in_progress').length, total: r.items.length }))
        .catch(() => setSrCounts(null));
    }
    if (action === 'payment' && unit.tenantId) {
      form.setFieldsValue({ alloc: 'auto', date: dayjs(), method: 'cash', print: true });
      api<{ invoices: OpenInvoice[]; credit: number }>('/payments/open-invoices', { query: { tenantId: unit.tenantId } })
        .then(r => {
          setOpenInvoices(r.invoices); setCredit(r.credit ?? 0);
          const due = r.invoices.reduce((t, i) => t + i.balance, 0);
          if (due > 0) form.setFieldsValue({ amount: Math.round(due * 100) / 100 });
        })
        .catch(() => setOpenInvoices([]));
    }
    if (action === 'terminate' && unit.contractId) {
      form.setFieldsValue({ date: dayjs(), addNext: true, confirm: false, finalInvoice: true, print: true });
      api<ContractInfo>(`/supply-contracts/${unit.contractId}`).then(r => setContractInfo(r.contract)).catch(() => setContractInfo(null));
    }
    if (action === 'invoice') form.setFieldsValue({ periodStart: dayjs().startOf('month'), periodEnd: dayjs(), issue: true, print: true });
  }, [action, form, unit.id, unit.tenantId, unit.contractId, unit.meterId]);

  const save = async () => {
    if (!action) return;
    try { await form.validateFields(); } catch { return; }
    const v = form.getFieldsValue(true);
    // pop-up blockers only allow window.open directly inside the click → open it now, fill it after saving
    const printWin = ((action === 'payment' || action === 'invoice') && v.print) || (action === 'terminate' && v.finalInvoice && v.print) ? openPrintWindow() : null;
    const ctx = { unitNo: unit.no, buildingName: unit.buildingName, tenantPhone };
    let next: UnitAction | undefined;
    setSaving(true);
    try {
      if (action === 'tenant') {
        const fees = [
          v.gasPrice != null ? { type: 'gas_price', cycle: 'per_m3', amount: v.gasPrice, effectiveFrom: dateStr(v.startDate) } : null,
          v.monthlyFee ? { type: 'maintenance', cycle: 'monthly', amount: v.monthlyFee, effectiveFrom: dateStr(v.startDate) } : null,
          v.connectionFee ? { type: 'connection', cycle: 'one_time', amount: v.connectionFee, effectiveFrom: dateStr(v.startDate) } : null,
          v.disconnectionFee ? { type: 'disconnection', cycle: 'one_time', amount: v.disconnectionFee, effectiveFrom: dateStr(v.startDate) } : null,
        ].filter(Boolean);
        const contract = {
          unitId: unit.id,
          startDate: dateStr(v.startDate), endDate: dateStr(v.endDate), status: v.status,
          openingReading: v.status === 'active' ? v.openingReading : undefined,
          depositAmount: v.depositAmount ?? null, depositPaid: !!v.depositPaid, depositDate: v.depositPaid ? dateStr(dayjs()) : undefined,
          autoRenew: !!v.autoRenew, issueInitialInvoice: !!v.issueInitialInvoice, fees,
          termItems: toTermInputs(contractTerms ?? []),
        };
        if (v.mode === 'new') {
          await api('/tenants', { body: {
            nameAr: v.nameAr?.trim(), nameEn: v.nameEn?.trim() || undefined, phone: v.phone?.trim(), email: v.email?.trim() || undefined,
            emiratesId: v.emiratesId?.trim() || undefined, nationality: v.nationality, unitId: unit.id, contract,
          } });
        } else {
          await api('/supply-contracts', { body: { ...contract, tenantId: v.tenantId } });
        }
        message.success(`تم ربط المستأجر بالوحدة ${unit.no}`);
      }
      if (action === 'meter') {
        if (v.mode === 'new') {
          await api('/meters', { body: {
            unitId: unit.id, serial: v.serial?.trim(), meterNo: v.meterNo?.trim() || undefined, type: v.type, brand: v.brand?.trim() || undefined,
            installDate: dateStr(v.installDate), initialReading: v.initialReading ?? 0, calibrationDate: dateStr(v.calibrationDate),
            location: v.location?.trim() || undefined,
          } });
        } else {
          await api(`/meters/${v.meterId}/assign`, { body: { unitId: unit.id, fromDate: dateStr(v.installDate) } });
        }
        message.success(v.mode === 'new'
          ? `تم تسجيل العداد في المخزون ثم تركيبه في الوحدة ${unit.no}`
          : `تم تركيب العداد من المخزون في الوحدة ${unit.no}`);
        if (v.addTenantNext && !unit.contractId) next = 'tenant';
      }
      if (action === 'reading') {
        const picked = v.readingDate as dayjs.Dayjs;
        // today → the current time (a later hour would be in the future); a past day → noon of that day
        const date = picked.isSame(dayjs(), 'day') ? dayjs() : picked.hour(12).minute(0).second(0);
        const r = await api<{ consumption?: number }>(`/meters/${unit.meterId}/readings`, { body: {
          readingValue: v.readingValue, readingDate: date.toISOString(), method: v.method, notes: v.notes?.trim() || undefined, allowReset: !!v.allowReset,
        } });
        message.success(`تم تسجيل القراءة${r?.consumption != null ? ` — استهلاك ${r.consumption} م³` : ''}`);
      }
      if (action === 'service' || action === 'services') {
        if (srAssignKind !== 'none' && !srAssignId) { message.warning('اختر الفني / المقاول أو «بدون إسناد الآن»'); setSaving(false); return; }
        const r = await api<{ id: number; requestNo: string }>('/service-requests', { body: {
          buildingId: unit.buildingId, unitId: unit.id, tenantId: unit.tenantId ?? undefined, meterId: unit.meterId ?? undefined,
          description: [SR_TYPES.find(t => t.value === v.srType)?.label, v.description?.trim()].filter(Boolean).join(' — '),
          priority: v.priority,
          notes: [
            v.visitDate ? `الموعد المفضل: ${dateStr(v.visitDate)} — ${VISIT_SLOTS.find(x => x.value === v.visitSlot)?.label ?? ''}` : null,
            v.contactPhone?.trim() ? `هاتف التواصل: ${v.contactPhone.trim()}` : null,
            v.notes?.trim() || null,
          ].filter(Boolean).join('\n') || undefined,
          assignedTo: srAssignKind === 'user' ? srAssignId : undefined,
          assignedVendorId: srAssignKind === 'vendor' ? srAssignId : undefined,
        } });
        message.success(`تم إنشاء طلب الخدمة ${r.requestNo}${srAssignId ? ' وإسناده — الحالة: قيد التنفيذ' : ' — الحالة: معلق'}`);
        // stay in the panel and show the new request in the tracker
        onSaved?.();
        form.resetFields();
        form.setFieldsValue({ srType: undefined, priority: 'medium', visitSlot: 'any' });
        setSrAssignKind('none'); setSrAssignId(undefined);
        setSrHighlight(r.id); setSrTab('track');
        return;
      }
      if (action === 'payment') {
        const r = await api<{ id: number; receiptNo: string; unallocated?: number }>('/payments', { body: {
          tenantId: unit.tenantId, amount: v.amount, date: dateStr(v.date), method: v.method, reference: v.reference?.trim() || undefined,
          notes: v.notes?.trim() || undefined, invoiceId: v.alloc === 'invoice' ? v.invoiceId : undefined,
        } });
        message.success(`تم تسجيل الدفعة — إيصال ${r.receiptNo}`);
        if (printWin) printReceipt(printWin, r.id, ctx);
      }
      if (action === 'terminate') {
        const r = await api<{ invoiceId?: number | null }>(`/supply-contracts/${unit.contractId}/terminate`, { body: {
          date: dateStr(v.date), reason: v.reason?.trim(), closingReading: unit.meterId ? v.closingReading : undefined, issueFinalInvoice: !!v.finalInvoice,
        } });
        message.success(`تم إنهاء العقد ${unit.contractNo ?? ''} — الوحدة ${unit.no} أصبحت شاغرة`);
        if (r?.invoiceId) { if (printWin) printInvoice(printWin, r.invoiceId, ctx); }
        else { printWin?.close(); if (v.finalInvoice) message.info('لا يوجد استهلاك غير مفوتر — لم تُصدر فاتورة نهائية.', 5); }
        if (v.addNext) next = 'tenant';
      }
      if (action === 'invoice') {
        const r = await api<{ created: boolean; id?: number; invoiceNo?: string; totalAmount?: number; message?: string }>(
          `/supply-contracts/${unit.contractId}/generate-invoice`, { body: { periodStart: dateStr(v.periodStart), periodEnd: dateStr(v.periodEnd), issue: !!v.issue } });
        if (!r.created) {
          printWin?.close();
          message.info('لا يوجد استهلاك أو رسوم غير مفوترة في هذه الفترة.', 5);
          setSaving(false);
          return;
        }
        message.success(`تم إصدار الفاتورة ${r.invoiceNo} — ${Number(r.totalAmount ?? 0).toLocaleString()} د.إ`);
        if (printWin && r.id) printInvoice(printWin, r.id, ctx);
      }
      onDone(next);
      onClose();
    } catch (e) {
      printWin?.close();
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  if (!action) return null;
  const meta = META[action];
  const isTenant = action === 'tenant';
  const lastStep = isTenant ? 1 : 0;
  const noMeter = isTenant && !unit.meterId;
  const blocked = (action === 'tenant' && (!!unit.contractId || !unit.meterId)) || (action === 'meter' && !!unit.meterId) || (action === 'reading' && !unit.meterId)
    || ((action === 'payment' || action === 'terminate' || action === 'invoice') && !unit.contractId && !unit.tenantId);
  const totalDue = openInvoices.reduce((t, i) => t + i.balance, 0);

  const next = async () => {
    if (noMeter) return;
    const fields = form.getFieldValue('mode') === 'existing' ? ['tenantId'] : ['nameAr', 'phone', 'email'];
    try { await form.validateFields(fields); setStep(1); } catch { /* shown inline */ }
  };

  const unitLine = [unit.buildingName, floorLabel(unit.floor), unit.typeLabel].filter(Boolean).join(' · ');
  const amount = (name: string, label: string, extra?: string) => (
    <Form.Item name={name} label={label} extra={extra}>
      <InputNumber min={0} style={{ width: '100%' }} placeholder="0" addonAfter="د.إ"
        formatter={x => `${x ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={x => (x ? Number(x.replace(/,/g, '')) : (null as any))} />
    </Form.Item>
  );

  return (
    <div className="ua-panel">
      <style>{`
        .ua-panel { border-radius: 14px; overflow: hidden; border: 1px solid #e3e8e3; background: #f7f8fa; box-shadow: 0 1px 6px rgba(0,0,0,.06); }
        .ua-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; color: rgba(255,255,255,.85); cursor: pointer; font-size: 13px;
          background: rgba(255,255,255,.12); border: none; border-radius: 8px; padding: 4px 12px; font-family: inherit; }
        .ua-back:hover { background: rgba(255,255,255,.2); color: #fff; }
        .ua-head { background: linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%); padding: 18px 22px; border-bottom: 3px solid ${GOLD}; }
        .ua-head-row { display: flex; align-items: center; gap: 12px; }
        .ua-head-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(201,168,76,.18); color: ${GOLD}; font-size: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ua-head-title { color: #fff; font-weight: 700; font-size: 16px; }
        .ua-head-sub { color: rgba(255,255,255,.7); font-size: 12px; }
        .ua-unit-chip { margin-inline-start: auto; background: rgba(255,255,255,.12); color: #fff; border-radius: 10px; padding: 4px 12px; font-family: monospace; font-weight: 700; font-size: 15px; }
        .ua-steps { margin-top: 14px; }
        .ua-steps .ant-steps-item-title { color: rgba(255,255,255,.85) !important; font-size: 13px; }
        .ua-steps .ant-steps-item-wait .ant-steps-item-icon { background: rgba(255,255,255,.15); border-color: transparent; }
        .ua-steps .ant-steps-item-wait .ant-steps-icon { color: rgba(255,255,255,.7) !important; }
        .ua-steps .ant-steps-item-process .ant-steps-item-icon, .ua-steps .ant-steps-item-finish .ant-steps-item-icon { background: ${GOLD}; border-color: ${GOLD}; }
        .ua-steps .ant-steps-item-process .ant-steps-icon, .ua-steps .ant-steps-item-finish .ant-steps-icon { color: ${DARK} !important; }
        .ua-steps .ant-steps-item-tail::after { background: rgba(255,255,255,.25) !important; }
        .ua-body { padding: 16px 16px 4px; background: #f7f8fa; }
        .ua-body .ant-form-item { margin-bottom: 14px; }
        .ua-body .ant-form-item-label > label { font-weight: 600; color: #444; font-size: 13px; }
        .ua-section { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 14px 16px 2px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.03); }
        .ua-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .ua-section-icon { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .ua-section-title { font-weight: 700; font-size: 14px; }
        .ua-section-hint { color: #999; font-size: 11.5px; }
        .ua-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .ua-choice { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 2px solid #e6e8e6; background: #fff; cursor: pointer; transition: all .15s; outline: none; }
        .ua-choice:hover, .ua-choice:focus-visible { border-color: #a5d6a7; }
        .ua-choice.on { border-color: ${PRIMARY}; background: #f3faf3; box-shadow: 0 2px 8px rgba(26,92,42,.12); }
        .ua-choice-icon { width: 38px; height: 38px; border-radius: 10px; background: #eef5ee; color: ${PRIMARY}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .ua-choice.on .ua-choice-icon { background: ${PRIMARY}; color: ${GOLD}; }
        .ua-choice-title { font-weight: 700; font-size: 13.5px; color: #222; }
        .ua-choice-desc { font-size: 11.5px; color: #888; }
        .ua-choice-check { margin-inline-start: auto; color: ${PRIMARY}; font-size: 18px; }
        .ua-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #f7f8fa; border: 1px solid #eef0ee; margin-bottom: 14px; }
        .ua-toggle-title { font-weight: 600; font-size: 13px; color: #333; }
        .ua-toggle-desc { font-size: 11.5px; color: #999; }
        .ua-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: linear-gradient(135deg, #f3faf3, #fbf6e8); border: 1px dashed #c9d8c9; border-radius: 12px; padding: 12px; margin-bottom: 14px; }
        .ua-summary div { text-align: center; }
        .ua-summary .k { font-size: 11px; color: #888; }
        .ua-summary .v { font-size: 14px; font-weight: 700; color: ${PRIMARY}; }
        .ua-types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .ua-type { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px 12px; border: 2px solid #e8ece8;
          border-radius: 12px; background: #fff; cursor: pointer; transition: all .15s; outline: none; text-align: center; }
        .ua-type:hover, .ua-type:focus-visible { border-color: #b7d3b9; transform: translateY(-1px); }
        .ua-type-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; }
        .ua-type-label { font-size: 12.5px; font-weight: 600; color: #333; }
        .ua-type-check { position: absolute; top: 6px; inset-inline-start: 6px; font-size: 15px; }
        .ua-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .ua-pill { padding: 6px 16px; border-radius: 20px; border: 1.5px solid; font-size: 13px; font-weight: 600; cursor: pointer; user-select: none; transition: all .15s; outline: none; }
        .ua-pill:hover { filter: brightness(.97); }
        .ua-foot { position: sticky; bottom: -24px; z-index: 3; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; background: #fff; border-top: 1px solid #eee; box-shadow: 0 -4px 12px rgba(0,0,0,.05); }
        .ua-dots { display: flex; gap: 5px; }
        .ua-nometer { text-align: center; padding: 34px 24px 30px; background: linear-gradient(180deg, #fffaf0 0%, #fff 100%); border: 1.5px dashed ${GOLD}; border-radius: 14px; margin-bottom: 14px; }
        .ua-nometer-icon { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; background: #fff3d6; color: #b8860b; display: flex; align-items: center; justify-content: center; font-size: 30px; }
        .ua-nometer-title { font-size: 16px; font-weight: 700; color: ${DARK}; margin-bottom: 6px; }
        .ua-nometer-desc { font-size: 13px; color: #6b7a6e; line-height: 1.9; margin-bottom: 18px; }
        .ua-nometer-steps { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .ua-nometer-steps > span { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; background: #f3f5f3; color: #6b7a6e; font-size: 12px; font-weight: 600; }
        .ua-nometer-steps > span > span { width: 18px; height: 18px; border-radius: 50%; background: #dfe6df; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
        .ua-nometer-steps > span.on { background: #e8f5e9; color: ${PRIMARY}; }
        .ua-nometer-steps > span.on > span { background: ${PRIMARY}; }
        .ua-lastread { background: #f5f8fc; border: 1px solid #dbe6f3; border-radius: 10px; padding: 10px 14px; }
        .ua-lastread .k { font-size: 11px; color: #6b7a8e; }
        .ua-lastread .v { font-size: 18px; font-weight: 700; color: #1565c0; direction: ltr; text-align: right; }
        .ua-lastread .d { font-size: 11px; color: #9aa6b4; }
        .ua-note { margin-top: 10px; padding: 8px 12px; border-radius: 8px; background: #f5f0e8; color: #5b5240; font-size: 12px; display: flex; gap: 8px; align-items: center; }
        .ua-dots span { height: 6px; width: 6px; border-radius: 3px; background: #dfe6df; transition: all .2s; }
        .ua-dots span.on { width: 20px; background: ${PRIMARY}; }
        ${SR_FLOW_CSS}
        .ua-srtabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #eef1ee; padding: 4px; border-radius: 12px; margin-bottom: 14px; }
        .ua-srtab { border: none; background: transparent; border-radius: 9px; padding: 8px 10px; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #5d6b60; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px; transition: all .15s; }
        .ua-srtab.on { background: #fff; color: ${PRIMARY}; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .ua-srtab .cnt { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #d46b08; color: #fff; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
        .ua-srtab .cnt.zero { background: #c5ccc6; }
        .ua-flowcard { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 8px 12px 10px; margin-bottom: 14px; }
        .ua-flowcard-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #7a857c; }
      `}</style>

      {/* header */}
      <div className="ua-head" style={action === 'terminate' ? { background: 'linear-gradient(135deg, #8e1c1c 0%, #4a0e0e 100%)' } : undefined}>
        <button type="button" className="ua-back" onClick={onClose} disabled={saving}><ArrowRightOutlined /> رجوع لتفاصيل الوحدة</button>
        <div className="ua-head-row">
          <span className="ua-head-icon">{meta.icon}</span>
          <div>
            <div className="ua-head-title">{isService ? (srTab === 'track' ? 'متابعة طلبات الخدمة' : 'طلب خدمة جديد') : meta.title}</div>
            <div className="ua-head-sub">{unitLine}</div>
          </div>
          <span className="ua-unit-chip"><HomeOutlined style={{ marginInlineEnd: 6, color: GOLD }} />{unit.no}</span>
        </div>
        {isTenant && !noMeter && (
          <Steps className="ua-steps" size="small" current={step}
            items={[{ title: 'بيانات المستأجر', icon: <UserOutlined /> }, { title: 'العقد والرسوم', icon: <SafetyCertificateOutlined /> }]} />
        )}
      </div>

      <Form form={form} layout="vertical">
        <div className="ua-body">
          {/* ───────── add tenant + contract ───────── */}
          {noMeter && (
            <div className="ua-nometer">
              <div className="ua-nometer-icon"><DashboardOutlined /></div>
              <div className="ua-nometer-title">لا يوجد عداد غاز في الوحدة {unit.no}</div>
              <div className="ua-nometer-desc">
                العداد يتبع الوحدة وليس المستأجر، ويجب تركيبه قبل تسجيل أي مستأجر.<br />
                بعد التركيب يُفتح نموذج المستأجر مباشرة لتسجيل العقد والقراءة الافتتاحية.
              </div>
              <div className="ua-nometer-steps">
                <span className="on"><span>1</span>تركيب العداد</span>
                <span><span>2</span>المستأجر والعقد</span>
                <span><span>3</span>القراءة الافتتاحية</span>
              </div>
              <Button type="primary" size="large" icon={<FireOutlined />} onClick={() => { tenantAfterMeter = true; onDone('meter'); }}
                style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, minWidth: 200 }}>تركيب عداد أولاً</Button>
            </div>
          )}
          {isTenant && !noMeter && (
            <>
              {unit.contractId && <Alert type="warning" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message={`الوحدة عليها عقد نشط (${unit.contractNo}) — أنهِ العقد الحالي أولاً.`} />}
              <div style={{ display: step === 0 ? 'block' : 'none' }}>
                <Form.Item name="mode" noStyle>
                  <ChoiceCards options={[
                    { value: 'new', icon: <UserAddOutlined />, title: 'مستأجر جديد', desc: 'تسجيل بيانات مستأجر لأول مرة' },
                    { value: 'existing', icon: <TeamOutlined />, title: 'مستأجر موجود', desc: 'اختيار مستأجر مسجّل في النظام' },
                  ]} />
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(a, b) => a.mode !== b.mode}>
                  {({ getFieldValue }) => getFieldValue('mode') === 'existing' ? (
                    <Section icon={<TeamOutlined />} title="اختيار المستأجر" hint="ابحث بالاسم أو رمز المستأجر أو رقم الهاتف">
                      <Form.Item name="tenantId" rules={[{ required: true, message: 'اختر المستأجر' }]}>
                        <Select size="large" showSearch optionFilterProp="label" placeholder="ابحث عن مستأجر…" suffixIcon={<UserOutlined />}
                          notFoundContent={<Text type="secondary">لا يوجد مستأجرون — اختر «مستأجر جديد»</Text>}
                          options={tenants.map(x => ({ value: x.id, label: `${x.name ?? ''} — ${x.code ?? ''}${x.phone ? ` — ${x.phone}` : ''}` }))} />
                      </Form.Item>
                    </Section>
                  ) : (
                    <>
                      <Section icon={<UserOutlined />} title="البيانات الشخصية">
                        <Row gutter={12}>
                          <Col xs={24} md={12}><Form.Item name="nameAr" label="الاسم الكامل (عربي)" rules={[{ required: true, whitespace: true, message: 'الرجاء إدخال الاسم' }]}><Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="مثال: أحمد علي محمد" /></Form.Item></Col>
                          <Col xs={24} md={12}><Form.Item name="nameEn" label="Full name (English)"><Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="e.g. Ahmed Ali" style={{ direction: 'ltr' }} /></Form.Item></Col>
                          <Col xs={24} md={12}><Form.Item name="emiratesId" label="رقم الهوية الإماراتية"><Input prefix={<IdcardOutlined style={{ color: '#bbb' }} />} placeholder="784-YYYY-XXXXXXX-X" style={{ direction: 'ltr' }} /></Form.Item></Col>
                          <Col xs={24} md={12}><Form.Item name="nationality" label="الجنسية"><Select showSearch optionFilterProp="label" options={lk('NATIONALITY')} /></Form.Item></Col>
                        </Row>
                      </Section>
                      <Section icon={<PhoneOutlined />} title="بيانات التواصل">
                        <Row gutter={12}>
                          <Col xs={24} md={12}><Form.Item name="phone" label="رقم الهاتف" rules={[{ required: true, whitespace: true, message: 'الرجاء إدخال رقم الهاتف' }]}><Input prefix={<PhoneOutlined style={{ color: '#bbb' }} />} placeholder="+971 50 000 0000" style={{ direction: 'ltr' }} /></Form.Item></Col>
                          <Col xs={24} md={12}><Form.Item name="email" label="البريد الإلكتروني" rules={[{ type: 'email', message: 'بريد غير صالح' }]}><Input prefix={<MailOutlined style={{ color: '#bbb' }} />} placeholder="name@email.com" style={{ direction: 'ltr' }} /></Form.Item></Col>
                        </Row>
                      </Section>
                    </>
                  )}
                </Form.Item>
              </div>

              <div style={{ display: step === 1 ? 'block' : 'none' }}>
                <Section icon={<CalendarOutlined />} title="مدة العقد" hint="العقد «النشط» يجعل الوحدة مؤجرة فوراً">
                  <Form.Item name="duration" label="المدة" style={{ marginBottom: 12 }}>
                    <DurationPills onPick={months => {
                      const start = form.getFieldValue('startDate') ?? dayjs();
                      form.setFieldsValue({ endDate: dayjs(start).add(months, 'month').subtract(1, 'day') });
                    }} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col xs={24} md={8}><Form.Item name="startDate" label="تاريخ البداية" rules={[{ required: true, message: 'مطلوب' }]}>
                      <DatePicker style={{ width: '100%' }} onChange={d => {
                        const months = form.getFieldValue('duration');
                        if (d && months) form.setFieldsValue({ endDate: d.add(months, 'month').subtract(1, 'day') });
                      }} /></Form.Item></Col>
                    <Col xs={24} md={8}><Form.Item name="endDate" label="تاريخ الانتهاء" dependencies={['startDate']}
                      rules={[{ required: true, message: 'مدة العقد مطلوبة' }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || !getFieldValue('startDate') || v.isAfter(getFieldValue('startDate'), 'day') ? Promise.resolve() : Promise.reject(new Error('يجب أن يكون بعد تاريخ البداية'))) })]}>
                      <DatePicker style={{ width: '100%' }} onChange={() => form.setFieldsValue({ duration: undefined })} /></Form.Item></Col>
                    <Col xs={24} md={8}><Form.Item name="status" label="حالة العقد"><Select options={[{ value: 'active', label: 'نشط — تفعيل الآن' }, { value: 'draft', label: 'مسودة' }]} /></Form.Item></Col>
                  </Row>
                  <div className="ua-toggle">
                    <div><div className="ua-toggle-title">تجديد تلقائي</div><div className="ua-toggle-desc">يُجدَّد العقد تلقائياً عند انتهائه</div></div>
                    <Form.Item name="autoRenew" valuePropName="checked" noStyle><Switch /></Form.Item>
                  </div>
                </Section>

                <Form.Item noStyle shouldUpdate={(a, b) => a.status !== b.status}>
                  {({ getFieldValue }) => getFieldValue('status') === 'active' ? (
                    <Section icon={<DashboardOutlined />} title={`القراءة الافتتاحية — العداد ${unit.meter ?? ''}`} tone="#1565c0"
                      hint="قراءة العداد يوم استلام الوحدة — بداية احتساب استهلاك هذا المستأجر">
                      <Row gutter={12} align="middle" style={{ paddingBottom: 16 }}>
                        <Col xs={24} md={12}>
                          <Form.Item name="openingReading" label="قراءة العداد عند الاستلام" style={{ marginBottom: 0 }}
                            rules={[{ required: true, message: 'القراءة الافتتاحية مطلوبة' },
                              { validator: (_, val) => (val == null || !lastRead || val >= lastRead.value ? Promise.resolve() : Promise.reject(new Error(`لا يمكن أن تكون أقل من آخر قراءة (${lastRead.value.toLocaleString()})`))) }]}>
                            <InputNumber min={0} size="large" style={{ width: '100%' }} addonAfter="م³" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <div className="ua-lastread">
                            <div className="k">آخر قراءة مسجّلة للعداد</div>
                            <div className="v">{lastRead ? `${lastRead.value.toLocaleString()} م³` : '—'}</div>
                            <div className="d">{lastRead?.date ? dayjs(lastRead.date).format('YYYY-MM-DD') : 'لا توجد قراءات بعد'}</div>
                          </div>
                        </Col>
                      </Row>
                    </Section>
                  ) : (
                    <Alert type="info" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message="العقد كمسودة — تُسجَّل القراءة الافتتاحية عند تفعيل العقد." />
                  )}
                </Form.Item>

                <Section icon={<DollarOutlined />} title="الرسوم" hint="اترك الحقل فارغاً إذا لم تنطبق الرسوم" tone="#8a6d1f">
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item name="gasPrice" label="سعر الغاز" dependencies={['status']}
                        rules={[({ getFieldValue }) => ({ validator: (_, v) => (getFieldValue('status') !== 'active' || (v != null && v > 0) ? Promise.resolve() : Promise.reject(new Error('سعر الغاز مطلوب للعقد النشط'))) })]}>
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="0.00" addonAfter="د.إ / م³" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>{amount('monthlyFee', 'رسوم شهرية')}</Col>
                    <Col xs={24} md={12}>{amount('connectionFee', 'رسوم التوصيل', 'مرة واحدة — في الفاتورة الأولية')}</Col>
                    <Col xs={24} md={12}>{amount('disconnectionFee', 'رسوم القطع', 'مرة واحدة — في الفاتورة الأولية')}</Col>
                  </Row>
                </Section>

                <Section icon={<FileTextOutlined />} title="الشروط والأحكام" tone={PRIMARY}
                  hint="من إعدادات الشروط لعقود توريد الغاز — يمكنك تعديل أي بند أو إضافة بنود خاصة بهذا المستأجر">
                  <div style={{ marginBottom: 12 }}>
                    <ContractTermsPicker contractType="supply" value={contractTerms} onChange={setContractTerms} />
                  </div>
                </Section>

                <Section icon={<SafetyCertificateOutlined />} title="الوديعة والفوترة" tone="#1565c0">
                  <Row gutter={12} align="bottom">
                    <Col xs={24} md={12}>{amount('depositAmount', 'مبلغ الوديعة')}</Col>
                    <Col xs={24} md={12}>
                      <div className="ua-toggle">
                        <div><div className="ua-toggle-title">الوديعة مسددة</div><div className="ua-toggle-desc">تم استلام مبلغ الوديعة</div></div>
                        <Form.Item name="depositPaid" valuePropName="checked" noStyle><Switch /></Form.Item>
                      </div>
                    </Col>
                  </Row>
                  <div className="ua-toggle">
                    <div><div className="ua-toggle-title"><FileTextOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />إصدار فاتورة أولية</div><div className="ua-toggle-desc">برسوم التوصيل ورسوم القطع والوديعة غير المسددة</div></div>
                    <Form.Item name="issueInitialInvoice" valuePropName="checked" noStyle><Switch /></Form.Item>
                  </div>
                </Section>

                <Form.Item noStyle shouldUpdate>
                  {({ getFieldsValue }) => {
                    const v = getFieldsValue(true);
                    const tenantName = v.mode === 'existing' ? tenants.find(t => t.id === v.tenantId)?.name : v.nameAr;
                    return (
                      <div className="ua-summary">
                        <div><div className="k">المستأجر</div><div className="v">{tenantName || '—'}</div></div>
                        <div><div className="k">من</div><div className="v">{v.startDate ? dayjs(v.startDate).format('YYYY-MM-DD') : '—'}</div></div>
                        <div><div className="k">إلى</div><div className="v">{v.endDate ? dayjs(v.endDate).format('YYYY-MM-DD') : '—'}</div></div>
                        <div><div className="k">القراءة الافتتاحية</div><div className="v">{v.status === 'active' && v.openingReading != null ? `${Number(v.openingReading).toLocaleString()} م³` : '—'}</div></div>
                      </div>
                    );
                  }}
                </Form.Item>
              </div>
            </>
          )}

          {/* ───────── install meter ───────── */}
          {action === 'meter' && (
            <>
              {unit.meterId && <Alert type="warning" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message={`الوحدة بها عداد مركّب (${unit.meter}) — فك العداد الحالي أولاً.`} />}
              <Form.Item name="mode" noStyle>
                <ChoiceCards options={[
                  { value: 'existing', icon: <InboxOutlined />, title: `من المخزون${meters.length ? ` (${meters.length})` : ''}`, desc: 'اختيار عداد متوفر في المخزون' },
                  { value: 'new', icon: <PlusCircleOutlined />, title: 'عداد جديد', desc: 'يُسجَّل في المخزون ثم يُركّب هنا مباشرة' },
                ]} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.mode !== b.mode}>
                {({ getFieldValue }) => getFieldValue('mode') === 'existing' ? (
                  <Section icon={<InboxOutlined />} title="اختيار العداد" tone="#d46b08">
                    <Form.Item name="meterId" rules={[{ required: true, message: 'اختر العداد' }]} extra={meters.length ? undefined : 'لا توجد عدادات غير مركّبة — اختر «عداد جديد»'}>
                      <Select size="large" showSearch optionFilterProp="label" placeholder="اختر عداداً…"
                        options={meters.map(x => ({ value: x.id, label: `${x.meterNo}${x.serial ? ` — ${x.serial}` : ''}${x.typeLabel ? ` — ${x.typeLabel}` : ''}${x.brand ? ` — ${x.brand}` : ''}` }))} />
                    </Form.Item>
                  </Section>
                ) : (
                  <Section icon={<FireOutlined />} title="بيانات العداد" tone="#d46b08">
                    <Row gutter={12}>
                      <Col xs={24} md={12}><Form.Item name="serial" label="الرقم التسلسلي" rules={[{ required: true, whitespace: true, message: 'الرجاء إدخال الرقم التسلسلي' }]}><Input placeholder="SN-XXXXXXXX" style={{ direction: 'ltr' }} /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="meterNo" label="رقم العداد" extra="فارغ = ترقيم تلقائي (M-0001)"><Input placeholder="تلقائي" style={{ direction: 'ltr' }} /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="type" label="نوع العداد"><Select options={lk('METER_TYPE')} /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="brand" label="الشركة المصنعة"><Input placeholder="مثال: Itron" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="initialReading" label="القراءة الابتدائية"><InputNumber min={0} style={{ width: '100%' }} addonAfter="م³" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="calibrationDate" label="تاريخ المعايرة"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={24}><Form.Item name="location" label="موقع العداد"><Input placeholder="مثال: غرفة الغاز — الطابق 1" /></Form.Item></Col>
                    </Row>
                  </Section>
                )}
              </Form.Item>
              <Section icon={<CalendarOutlined />} title="التركيب" tone="#d46b08">
                <Row gutter={12} align="bottom">
                  <Col xs={24} md={12}><Form.Item name="installDate" label="تاريخ التركيب" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  {!unit.contractId && (
                    <Col xs={24} md={12}>
                      <div className="ua-toggle">
                        <div><div className="ua-toggle-title"><UserAddOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />إضافة مستأجر بعد التركيب</div><div className="ua-toggle-desc">يُفتح نموذج المستأجر والعقد مباشرة</div></div>
                        <Form.Item name="addTenantNext" valuePropName="checked" noStyle><Switch /></Form.Item>
                      </div>
                    </Col>
                  )}
                </Row>
                <div className="ua-note"><HomeOutlined style={{ color: PRIMARY }} /> العداد يُركّب في الوحدة {unit.no} ويبقى فيها عند تغيير المستأجر — كل مستأجر له قراءة افتتاحية وختامية خاصة به.</div>
              </Section>
            </>
          )}

          {/* ───────── record reading ───────── */}
          {action === 'reading' && (
            unit.meterId ? (
              <Section icon={<DatabaseOutlined />} title={`العداد ${unit.meter}`} hint="الاستهلاك يُحسب تلقائياً = القراءة − القراءة السابقة" tone="#1565c0">
                <Row gutter={12}>
                  <Col xs={24} md={12}><Form.Item name="readingValue" label="القراءة الحالية" rules={[{ required: true, message: 'الرجاء إدخال القراءة' }]}><InputNumber min={0} size="large" style={{ width: '100%' }} addonAfter="م³" autoFocus /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="readingDate" label="تاريخ القراءة" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker size="large" style={{ width: '100%' }} disabledDate={x => x.isAfter(dayjs(), 'day')} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="method" label="طريقة القراءة"><Select options={lk('READING_METHOD')} /></Form.Item></Col>
                  <Col xs={24} md={12}>
                    <div className="ua-toggle" style={{ marginTop: 30 }}>
                      <div><div className="ua-toggle-title">عداد جديد / تصفير</div><div className="ua-toggle-desc">فقط إذا كانت القراءة أقل من السابقة</div></div>
                      <Form.Item name="allowReset" valuePropName="checked" noStyle><Switch /></Form.Item>
                    </div>
                  </Col>
                  <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} placeholder="اختياري" /></Form.Item></Col>
                </Row>
              </Section>
            ) : <Alert type="warning" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message="لا يوجد عداد مركّب في هذه الوحدة — قم بتركيب عداد أولاً." />
          )}

          {/* ───────── service requests: new / track ───────── */}
          {isService && (
            <div className="ua-srtabs" role="tablist">
              <button type="button" role="tab" aria-selected={srTab === 'new'} className={`ua-srtab${srTab === 'new' ? ' on' : ''}`} onClick={() => setSrTab('new')}>
                <ToolOutlined /> طلب جديد
              </button>
              <button type="button" role="tab" aria-selected={srTab === 'track'} className={`ua-srtab${srTab === 'track' ? ' on' : ''}`} onClick={() => setSrTab('track')}>
                <UnorderedListOutlined /> متابعة الطلبات
                {srCounts && <span className={`cnt${srCounts.open ? '' : ' zero'}`} title="الطلبات المفتوحة">{srCounts.open}</span>}
              </button>
            </div>
          )}
          {isService && srTab === 'track' && (
            <ServiceRequestTracker unitId={unit.id} highlightId={srHighlight} onChanged={onSaved}
              onNew={() => { setSrHighlight(null); setSrTab('new'); }} onCounts={(open, total) => setSrCounts({ open, total })} />
          )}
          {isService && srTab === 'new' && (
            <>
              <div className="ua-flowcard">
                <div className="ua-flowcard-head">
                  <span>مسار الطلب</span>
                  <span>يبدأ بحالة: <b style={{ color: srAssignId ? '#1565c0' : '#d46b08' }}>{srAssignId ? 'قيد التنفيذ' : 'معلق'}</b></span>
                </div>
                <SrFlow status={srAssignId ? 'in_progress' : 'pending'} preview />
              </div>
              <div className="ua-summary" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div><div className="k">الوحدة</div><div className="v">{unit.no}</div></div>
                <div><div className="k">المستأجر</div><div className="v">{unit.tenant ?? '—'}</div></div>
                <div><div className="k">العداد</div><div className="v" style={{ fontFamily: 'monospace' }}>{unit.meter ?? '—'}</div></div>
              </div>

              <Section icon={<ToolOutlined />} title="نوع الطلب" hint="اختر النوع — تُضبط الأولوية تلقائياً ويمكنك تغييرها">
                <Form.Item name="srType" rules={[{ required: true, message: 'اختر نوع الطلب' }]}>
                  <SrTypeCards onPick={t => form.setFieldsValue({ priority: t.priority })} />
                </Form.Item>
              </Section>

              <Section icon={<FileTextOutlined />} title="التفاصيل">
                <Form.Item name="description" label="وصف المشكلة"
                  dependencies={['srType']}
                  rules={[({ getFieldValue }) => ({ validator: (_, v) => (getFieldValue('srType') !== 'other' || (v && v.trim()) ? Promise.resolve() : Promise.reject(new Error('الرجاء وصف الطلب'))) })]}>
                  <Input.TextArea rows={3} placeholder="اكتب تفاصيل المشكلة أو الخدمة المطلوبة…" showCount maxLength={500} />
                </Form.Item>
                <Form.Item label="الأولوية" style={{ marginBottom: 14 }}>
                  <Form.Item name="priority" noStyle>
                    <PriorityPills />
                  </Form.Item>
                </Form.Item>
              </Section>

              <Section icon={<ClockCircleOutlined />} title="الموعد المفضل للزيارة" hint="اختياري — يظهر لفريق الصيانة في ملاحظات الطلب">
                <Row gutter={12}>
                  <Col xs={24} md={8}><Form.Item name="visitDate" label="التاريخ"><DatePicker style={{ width: '100%' }} disabledDate={x => x.isBefore(dayjs(), 'day')} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="visitSlot" label="الوقت"><Select options={VISIT_SLOTS} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="contactPhone" label="هاتف التواصل"><Input prefix={<PhoneOutlined style={{ color: '#bbb' }} />} placeholder="+971 50 000 0000" style={{ direction: 'ltr' }} /></Form.Item></Col>
                  <Col span={24}><Form.Item name="notes" label="ملاحظات إضافية"><Input.TextArea rows={2} placeholder="مثال: الاتصال قبل الحضور / المفتاح لدى الحارس" /></Form.Item></Col>
                </Row>
              </Section>

              <Section icon={<UserSwitchOutlined />} title="الإسناد" hint="اختياري — إسناد الطلب الآن ينقله مباشرة إلى «قيد التنفيذ»، ويمكن إسناده لاحقاً من «متابعة الطلبات»" tone="#1565c0">
                <div style={{ marginBottom: 14 }}>
                  <AssigneePicker allowNone assignees={assignees} kind={srAssignKind} onKind={setSrAssignKind} value={srAssignId} onChange={setSrAssignId} />
                </div>
              </Section>
            </>
          )}

          {/* ───────── record payment ───────── */}
          {action === 'payment' && (
            !unit.tenantId ? <Alert type="warning" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message="لا يوجد مستأجر في هذه الوحدة." /> : (
            <>
              <div className="ua-summary" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div><div className="k">العميل</div><div className="v">{unit.tenant}</div></div>
                <div><div className="k">الفواتير المفتوحة</div><div className="v">{openInvoices.length}</div></div>
                <div><div className="k">إجمالي المستحق</div><div className="v" style={{ color: totalDue > 0 ? '#c62828' : PRIMARY }}>{`${totalDue.toLocaleString()} د.إ`}</div></div>
              </div>
              {credit > 0 && <Alert type="info" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message={`للعميل رصيد دائن غير مخصص: ${money(credit)}`} />}
              <Form.Item name="alloc" noStyle>
                <ChoiceCards options={[
                  { value: 'auto', icon: <OrderedListOutlined />, title: 'سداد تلقائي', desc: 'تُسدَّد الفواتير الأقدم أولاً' },
                  { value: 'invoice', icon: <FileTextOutlined />, title: 'فاتورة محددة', desc: 'اختيار الفاتورة التي تُسدَّد' },
                ]} />
              </Form.Item>
              <Section icon={<WalletOutlined />} title="بيانات الدفعة">
                <Row gutter={12}>
                  <Form.Item noStyle shouldUpdate={(a, b) => a.alloc !== b.alloc}>
                    {({ getFieldValue }) => getFieldValue('alloc') === 'invoice' && (
                      <Col span={24}>
                        <Form.Item name="invoiceId" label="الفاتورة" rules={[{ required: true, message: 'اختر الفاتورة' }]}>
                          <Select placeholder={openInvoices.length ? 'اختر فاتورة مفتوحة' : 'لا توجد فواتير مفتوحة'}
                            onChange={(id: number) => { const inv = openInvoices.find(i => i.id === id); if (inv) form.setFieldsValue({ amount: inv.balance }); }}
                            options={openInvoices.map(i => ({ value: i.id, label: `${i.no} — مستحق ${money(i.balance)} — يستحق ${d(i.dueDate)}` }))} />
                        </Form.Item>
                      </Col>
                    )}
                  </Form.Item>
                  <Col xs={24} md={12}>
                    <Form.Item name="amount" label="المبلغ المستلم" rules={[{ required: true, message: 'أدخل المبلغ' }, { type: 'number', min: 0.01, message: 'المبلغ يجب أن يكون أكبر من صفر' }]}>
                      <InputNumber min={0} size="large" style={{ width: '100%' }} addonAfter="د.إ" autoFocus
                        formatter={x => `${x ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={x => (x ? Number(x.replace(/,/g, '')) : (null as any))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}><Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker size="large" style={{ width: '100%' }} disabledDate={x => x.isAfter(dayjs(), 'day')} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="method" label="طريقة الدفع"><Select options={lk('PAYMENT_METHOD')} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="reference" label="المرجع" extra="رقم الشيك / التحويل"><Input style={{ direction: 'ltr' }} /></Form.Item></Col>
                  <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} placeholder="اختياري" /></Form.Item></Col>
                </Row>
                <div className="ua-toggle">
                  <div><div className="ua-toggle-title"><PrinterOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />طباعة سند القبض بعد الحفظ</div><div className="ua-toggle-desc">يُفتح الإيصال جاهزاً للطباعة</div></div>
                  <Form.Item name="print" valuePropName="checked" noStyle><Switch /></Form.Item>
                </div>
              </Section>
            </>
          ))}

          {/* ───────── terminate contract ───────── */}
          {action === 'terminate' && (
            !unit.contractId ? <Alert type="info" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message="لا يوجد عقد نشط لهذه الوحدة." /> : (
            <>
              <div className="ua-summary" style={{ gridTemplateColumns: 'repeat(3, 1fr)', background: '#fff5f5', borderColor: '#ffccc7' }}>
                <div><div className="k">المستأجر</div><div className="v">{unit.tenant ?? '—'}</div></div>
                <div><div className="k">العقد</div><div className="v">{unit.contractNo}</div></div>
                <div><div className="k">الرصيد المستحق</div><div className="v" style={{ color: (contractInfo?.balanceAmount ?? 0) > 0 ? '#c62828' : PRIMARY }}>{contractInfo ? `${Number(contractInfo.balanceAmount ?? 0).toLocaleString()} د.إ` : '…'}</div></div>
              </div>
              {(contractInfo?.balanceAmount ?? 0) > 0 && (
                <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 14, borderRadius: 10 }}
                  message={`على المستأجر رصيد مستحق ${money(contractInfo!.balanceAmount)} — يبقى الرصيد على حسابه بعد إنهاء العقد.`} />
              )}
              {unit.meterId && (
                <Section icon={<DashboardOutlined />} title={`القراءة الختامية — العداد ${unit.meter ?? ''}`} tone="#1565c0"
                  hint="قراءة العداد يوم تسليم الوحدة — نهاية احتساب استهلاك المستأجر">
                  <Row gutter={12} align="middle">
                    <Col xs={24} md={12}>
                      <Form.Item name="closingReading" label="قراءة العداد عند التسليم" style={{ marginBottom: 0 }}
                        rules={[{ required: true, message: 'القراءة الختامية مطلوبة' },
                          { validator: (_, val) => (val == null || !lastRead || val >= lastRead.value ? Promise.resolve() : Promise.reject(new Error(`لا يمكن أن تكون أقل من آخر قراءة (${lastRead.value.toLocaleString()})`))) }]}>
                        <InputNumber min={0} size="large" style={{ width: '100%' }} addonAfter="م³" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(a, b) => a.closingReading !== b.closingReading}>
                        {({ getFieldValue }) => {
                          const cr = getFieldValue('closingReading');
                          const diff = cr != null && lastRead ? Math.max(0, cr - lastRead.value) : null;
                          return (
                            <div className="ua-lastread">
                              <div className="k">آخر قراءة: {lastRead ? `${lastRead.value.toLocaleString()} م³` : '—'}</div>
                              <div className="v">{diff != null ? `+${diff.toLocaleString()} م³` : '—'}</div>
                              <div className="d">استهلاك منذ آخر قراءة</div>
                            </div>
                          );
                        }}
                      </Form.Item>
                    </Col>
                  </Row>
                  <div className="ua-toggle" style={{ marginTop: 12 }}>
                    <div><div className="ua-toggle-title"><FileTextOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />إصدار الفاتورة النهائية</div><div className="ua-toggle-desc">فوترة كل الاستهلاك غير المفوتر حتى القراءة الختامية</div></div>
                    <Form.Item name="finalInvoice" valuePropName="checked" noStyle><Switch /></Form.Item>
                  </div>
                  <Form.Item noStyle shouldUpdate={(a, b) => a.finalInvoice !== b.finalInvoice}>
                    {({ getFieldValue }) => getFieldValue('finalInvoice') && (
                      <div className="ua-toggle">
                        <div><div className="ua-toggle-title"><PrinterOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />طباعة الفاتورة النهائية</div><div className="ua-toggle-desc">تُفتح جاهزة للطباعة بعد الإنهاء</div></div>
                        <Form.Item name="print" valuePropName="checked" noStyle><Switch /></Form.Item>
                      </div>
                    )}
                  </Form.Item>
                </Section>
              )}
              <Section icon={<StopOutlined />} title="بيانات الإنهاء" hint="تصبح الوحدة شاغرة ويبقى العداد مركّباً فيها" tone="#c62828">
                <Row gutter={12}>
                  <Col xs={24} md={12}><Form.Item name="date" label="تاريخ الإنهاء" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={24}><Form.Item name="reason" label="سبب الإنهاء" rules={[{ required: true, whitespace: true, message: 'الرجاء ذكر السبب' }]}><Input.TextArea rows={2} placeholder="مثال: انتقال المستأجر / انتهاء الإيجار" /></Form.Item></Col>
                </Row>
                <div className="ua-toggle">
                  <div><div className="ua-toggle-title"><UserAddOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />إضافة مستأجر جديد بعد الإنهاء</div><div className="ua-toggle-desc">يُفتح نموذج المستأجر الجديد مباشرة</div></div>
                  <Form.Item name="addNext" valuePropName="checked" noStyle><Switch /></Form.Item>
                </div>
                <Form.Item name="confirm" valuePropName="checked" rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('يجب تأكيد الإنهاء'))) }]}>
                  <Checkbox>أؤكد إنهاء عقد {unit.contractNo} للمستأجر {unit.tenant}</Checkbox>
                </Form.Item>
              </Section>
            </>
          ))}

          {/* ───────── consumption invoice ───────── */}
          {action === 'invoice' && (
            !unit.contractId ? <Alert type="info" showIcon style={{ marginBottom: 14, borderRadius: 10 }} message="لا يوجد عقد نشط — لا يمكن إصدار فاتورة." /> : (
            <Section icon={<FileTextOutlined />} title="فترة الفوترة" hint="تُفوتر القراءات غير المفوترة × سعر الغاز + الرسوم الشهرية للفترة">
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item name="periodStart" label="من" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="periodEnd" label="إلى" dependencies={['periodStart']}
                  rules={[{ required: true, message: 'مطلوب' }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || !getFieldValue('periodStart') || !v.isBefore(getFieldValue('periodStart'), 'day') ? Promise.resolve() : Promise.reject(new Error('يجب أن تكون بعد تاريخ البداية'))) })]}>
                  <DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <div className="ua-toggle">
                <div><div className="ua-toggle-title">إصدار الفاتورة مباشرة</div><div className="ua-toggle-desc">إيقافها يحفظ الفاتورة كمسودة</div></div>
                <Form.Item name="issue" valuePropName="checked" noStyle><Switch /></Form.Item>
              </div>
              <div className="ua-toggle">
                <div><div className="ua-toggle-title"><PrinterOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />طباعة الفاتورة بعد الإصدار</div><div className="ua-toggle-desc">فاتورة ضريبية جاهزة للعميل</div></div>
                <Form.Item name="print" valuePropName="checked" noStyle><Switch /></Form.Item>
              </div>
            </Section>
          ))}
        </div>
      </Form>

      {/* footer */}
      <div className="ua-foot">
        <Button onClick={onClose} disabled={saving} style={{ borderRadius: 8 }}>{isService && srTab === 'track' ? 'رجوع لتفاصيل الوحدة' : 'إلغاء'}</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isTenant && !noMeter && <div className="ua-dots"><span className={step === 0 ? 'on' : ''} /><span className={step === 1 ? 'on' : ''} /></div>}
          {isTenant && step > 0 && <Button onClick={() => setStep(0)} disabled={saving} style={{ borderRadius: 8 }}>السابق</Button>}
          {isService && srTab === 'track' ? null : noMeter ? null : step < lastStep
            ? <Button type="primary" onClick={next} style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, minWidth: 110, fontWeight: 600 }}>التالي</Button>
            : <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} disabled={blocked} onClick={save}
                danger={action === 'terminate'}
                style={{ background: blocked ? undefined : action === 'terminate' ? '#c62828' : PRIMARY, borderColor: blocked ? undefined : action === 'terminate' ? '#c62828' : PRIMARY, borderRadius: 8, minWidth: 140, fontWeight: 600 }}>{meta.ok}</Button>}
        </div>
      </div>
    </div>
  );
};

export default UnitActionModal;
