import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Button, Card, Col, Descriptions, Divider, Drawer, Empty, Row, Space, Spin, Table, Tabs, Tag, Timeline, Tooltip, Typography,
} from 'antd';
import {
  AppstoreOutlined, BankOutlined, BarChartOutlined, CalendarOutlined, ClockCircleOutlined,
  DatabaseOutlined, DeleteOutlined, DesktopOutlined, DollarOutlined, EditOutlined, ExclamationCircleOutlined,
  FileTextOutlined, FireOutlined, HomeOutlined, MailOutlined, PhoneOutlined, SafetyCertificateOutlined,
  PlusOutlined, PrinterOutlined, ShopOutlined, StopOutlined, ToolOutlined, UserAddOutlined, UserOutlined, WalletOutlined,
  HistoryOutlined, TeamOutlined, DownOutlined, UpOutlined, DashboardOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import type { UnitDto } from '../../api/units';
import UnitActionModal, { type UnitAction } from './UnitActionModal';
import UnitMetersTab from './UnitMetersTab';
import ContractTermsCard, { type ContractTermRow } from './ContractTermsCard';
import { openPrintWindow, printInvoice, printReceipt } from '../../utils/printDocs';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';
const SUCCESS = '#52c41a';
const WARNING = '#fa8c16';
const DANGER = '#ff4d4f';

// ── API shapes (only the fields this window uses) ──
interface ContractDetail {
  contract: {
    id: number; contractNo: string; startDate: string; endDate?: string | null; status?: string; statusLabel?: string; isActive: boolean;
    monthlyFee?: number; gasUnitPrice?: number | null; connectionFee?: number | null; disconnectionFee?: number | null; depositAmount?: number | null; depositPaid: boolean;
    balanceM3?: number; balanceAmount?: number; overdueAmount?: number; paymentStatus?: string; lastReading?: number | null; lastReadDate?: string | null;
  };
  /** terms & conditions copied into this contract */
  terms?: ContractTermRow[];
}
interface TenantDetail {
  id: number; code?: string; name?: string; phone?: string; email?: string; emiratesId?: string; nationality?: string; avatar?: string;
  paymentStatus?: string; balance?: number; overdue?: number;
}
interface MeterDetail {
  meter: { id: number; meterNo: string; serial?: string; type?: string; typeLabel?: string; status?: string; statusLabel?: string;
    lastRead?: string | null; lastReadValue?: number; monthlyAvg?: number; unbilledM3?: number; brand?: string; calibrationDate?: string | null; installDate?: string | null };
  readings: { id: number; readingDate: string; readingValue: number; consumption?: number | null; method?: string; type?: string | null; typeLabel?: string | null; billed: boolean; readBy?: string; notes?: string }[];
}
interface InvoiceRow { id: number; invoiceNo: string; date: string; dueDate: string; typeLabel?: string; amount: number; paid: number; balance: number; status?: string; statusLabel?: string; paidDate?: string | null }
interface PaymentRow { id: number; receiptNo: string; date: string; amount: number; methodLabel?: string; reference?: string; invoiceLabel?: string; status?: string; statusLabel?: string }
/** Row of GET /supply-contracts?unitId= (current and past contracts of the unit) */
interface HistoryRow {
  id: number; contractNo: string; tenantId: number; tenant?: string; startDate: string; endDate?: string | null; terminatedAt?: string | null;
  status?: string; statusLabel?: string; isActive: boolean; monthlyFee?: number; depositAmount?: number | null; depositPaid: boolean;
  invoiced?: number; paid?: number; balanceAmount?: number; terms?: string | null; meter?: string | null;
}
interface ServiceRow { id: number; requestNo: string; description?: string; status?: string; statusLabel?: string; requestedAt: string; closedAt?: string | null }

const UNIT_STATUS: Record<string, { color: string; label: string; bg: string }> = {
  occupied:    { color: SUCCESS,   label: 'مؤجرة',  bg: '#f6ffed' },
  vacant:      { color: '#1565c0', label: 'شاغرة',  bg: '#e3f2fd' },
  maintenance: { color: WARNING,   label: 'صيانة',  bg: '#fff7e6' },
  reserved:    { color: '#722ed1', label: 'محجوزة', bg: '#f9f0ff' },
};
const PAY_STATUS: Record<string, { color: string; label: string }> = {
  paid: { color: 'success', label: 'مسدد' }, partial: { color: 'processing', label: 'مسدد جزئياً' },
  pending: { color: 'warning', label: 'معلق' }, overdue: { color: 'error', label: 'متأخر' }, none: { color: 'default', label: 'لا توجد فواتير' },
};
const TYPE_ICON: Record<string, React.ReactNode> = { residential: <HomeOutlined />, commercial: <ShopOutlined />, office: <DesktopOutlined /> };

/** whole months between two dates (end = today when missing) */
const months = (start?: string | null, end?: string | null) =>
  start ? Math.max(0, dayjs(end ?? undefined).diff(dayjs(start), 'month')) : 0;
const occupancyText = (m: number) => (m >= 12 ? `${Math.floor(m / 12)} سنة${m % 12 ? ` و${m % 12} شهر` : ''}` : `${m} شهر`);
/** "[Terminated 2026-10-17] reason" written into contract terms by the API */
const terminationReason = (terms?: string | null) => {
  const m = terms?.match(/\[Terminated [^\]]*\]\s*(.+)$/m);
  return m ? m[1].trim() : null;
};
const initials = (name?: string | null) => (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');
const d = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '—');
const money = (v?: number | null) => (v == null ? '—' : `${Number(v).toLocaleString()} د.إ`);
const floorLabel = (f?: number | null) => (f == null ? '—' : f === 0 ? 'الطابق الأرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `الطابق ${f}`);

interface Props {
  unit: UnitDto | null;
  buildingName?: string;
  canManage?: boolean;
  onClose: () => void;
  onEdit?: (u: UnitDto) => void;
  onDelete?: (u: UnitDto) => void;
  /** deactivate / re-activate the unit */
  onToggleActive?: (u: UnitDto) => void;
  /** after a tenant / meter / reading / service request was added (reload the building drawing) */
  onChanged?: () => void;
  /** open the panel directly on an action form (nonce changes on every request) */
  openAction?: { action: UnitAction; nonce: number } | null;
}

/** Reading type → tag (opening / closing readings frame each tenancy; replacement readings frame each meter). */
const READING_TYPE_TAG: Record<string, { label: string; color: string }> = {
  opening: { label: 'افتتاحية', color: 'green' },
  periodic: { label: 'دورية', color: 'default' },
  closing: { label: 'ختامية', color: 'red' },
  replacement_out: { label: 'استبدال – قديم', color: 'orange' },
  replacement_in: { label: 'استبدال – جديد', color: 'blue' },
  removal: { label: 'فك العداد', color: 'volcano' },
};

const UnitProfileDrawer: React.FC<Props> = ({ unit, buildingName, canManage, onClose, onEdit, onDelete, onToggleActive, onChanged, openAction }) => {
  const [action, setAction] = useState<UnitAction | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  /** number of meter installations (tab label) */
  const [meterCount, setMeterCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [meter, setMeter] = useState<MeterDetail | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  /** contract id → its invoices (loaded when the row is expanded in the history tab) */
  const [historyInvoices, setHistoryInvoices] = useState<Record<number, InvoiceRow[] | 'loading'>>({});

  // Load everything about the unit in parallel when it opens.
  useEffect(() => {
    if (!unit) return;
    let alive = true;
    if (refreshKey === 0) setActiveTab('overview');
    setLoading(true); setError(null);
    setContract(null); setTenant(null); setMeter(null); setInvoices([]); setPayments([]); setServices([]); setHistory([]); setHistoryInvoices({});
    const soft = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    Promise.all([
      unit.contractId ? soft(api<ContractDetail>(`/supply-contracts/${unit.contractId}`), null) : Promise.resolve(null),
      unit.tenantId ? soft(api<TenantDetail>(`/tenants/${unit.tenantId}`), null) : Promise.resolve(null),
      unit.meterId ? soft(api<MeterDetail>(`/meters/${unit.meterId}`), null) : Promise.resolve(null),
      unit.contractId ? soft(api<Paged<InvoiceRow>>('/invoices', { query: { contractId: unit.contractId, pageSize: 50 } }), null) : Promise.resolve(null),
      unit.tenantId ? soft(api<Paged<PaymentRow>>('/payments', { query: { tenantId: unit.tenantId, pageSize: 50 } }), null) : Promise.resolve(null),
      soft(api<Paged<ServiceRow>>('/service-requests', { query: { unitId: unit.id, pageSize: 20 } }), null),
      soft(api<Paged<HistoryRow>>('/supply-contracts', { query: { unitId: unit.id, pageSize: 0 } }), null),
    ]).then(([c, t, m, inv, pay, sr, hist]) => {
      if (!alive) return;
      setContract(c); setTenant(t); setMeter(m);
      setInvoices(inv?.items ?? []); setPayments(pay?.items ?? []); setServices(sr?.items ?? []); setHistory(hist?.items ?? []);
    }).catch(e => { if (alive) setError(errorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [unit?.id, unit?.contractId, unit?.tenantId, unit?.meterId, refreshKey]);
  useEffect(() => { setRefreshKey(0); setAction(null); setMeterCount(null); }, [unit?.id]);
  useEffect(() => { if (openAction && canManage) setAction(openAction.action); }, [openAction?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = contract?.contract;
  const printCtx = { unitNo: unit?.no, buildingName: unit?.buildingName ?? buildingName, tenantPhone: tenant?.phone };
  const doPrintInvoice = (id: number) => printInvoice(openPrintWindow(), id, printCtx);
  const doPrintReceipt = (id: number) => printReceipt(openPrintWindow(), id, printCtx);
  const m = meter?.meter;
  const readings = useMemo(() => (meter?.readings ?? []).map(r => ({
    ...r, previous: r.consumption != null ? r.readingValue - r.consumption : null,
  })), [meter]);
  const lastService = services[0];
  const openServices = services.filter(s => s.status === 'pending' || s.status === 'in_progress').length;
  const daysToExpiry = c?.endDate ? dayjs(c.endDate).startOf('day').diff(dayjs().startOf('day'), 'day') : null;

  // Activity: readings, invoices, payments, service requests and the contract start, newest first.
  const activity = useMemo(() => {
    const items: { date: string; color: string; text: React.ReactNode }[] = [];
    readings.slice(0, 6).forEach(r => items.push({ date: r.readingDate, color: SUCCESS, text: <>قراءة عداد الغاز — {r.readingValue.toLocaleString()} م³{r.consumption != null && <Text type="secondary"> (استهلاك {r.consumption} م³)</Text>}</> }));
    invoices.slice(0, 6).forEach(i => items.push({ date: i.date, color: i.status === 'overdue' ? DANGER : '#1677ff', text: <>فاتورة {i.invoiceNo} — {money(i.amount)} <Tag color={PAY_STATUS[i.status ?? '']?.color} style={{ fontSize: 10 }}>{i.statusLabel ?? i.status}</Tag></> }));
    payments.slice(0, 6).forEach(p => items.push({ date: p.date, color: SUCCESS, text: <>دفعة مستلمة {p.receiptNo} — {money(p.amount)}</> }));
    services.slice(0, 6).forEach(s => items.push({ date: s.requestedAt, color: WARNING, text: <>طلب خدمة {s.requestNo}{s.description ? ` — ${s.description}` : ''}</> }));
    if (c) items.push({ date: c.startDate, color: '#888', text: <>بداية العقد — {c.contractNo}</> });
    return items.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()).slice(0, 20);
  }, [readings, invoices, payments, services, c]);

  useTrackView('Unit', unit?.id, unit ? `وحدة ${unit.no}` : undefined);
  if (!unit) return null;
  const st = UNIT_STATUS[unit.status ?? ''] ?? UNIT_STATUS.vacant;
  const typeIcon = TYPE_ICON[unit.type ?? ''] ?? <HomeOutlined />;
  const statCard = (label: string, value: React.ReactNode, color: string, bg: string, icon?: React.ReactNode, span = 6) => (
    <Col span={span} key={label}>
      <Card size="small" variant="borderless" style={{ borderRadius: 8, background: bg, textAlign: icon ? 'start' : 'center' }}>
        {icon ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 20, color }}>{icon}</div>
            <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{label}</Text><Text strong style={{ fontSize: 15, color }}>{value}</Text></div>
          </div>
        ) : (
          <><Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text><Text strong style={{ fontSize: 16, color }}>{value}</Text></>
        )}
      </Card>
    </Col>
  );
  const noContract = (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f', fontSize: 12 }}>
      <SafetyCertificateOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />
      لا يوجد عقد توريد غاز نشط لهذه الوحدة — تصبح «مؤجرة» تلقائياً عند تفعيل عقد لها.
    </div>
  );

  const toggleHistoryInvoices = (contractId: number) => {
    if (historyInvoices[contractId] && historyInvoices[contractId] !== 'loading') {
      setHistoryInvoices(x => { const n = { ...x }; delete n[contractId]; return n; });
      return;
    }
    setHistoryInvoices(x => ({ ...x, [contractId]: 'loading' }));
    api<Paged<InvoiceRow>>('/invoices', { query: { contractId, pageSize: 100 } })
      .then(r => setHistoryInvoices(x => ({ ...x, [contractId]: r.items })))
      .catch(() => setHistoryInvoices(x => ({ ...x, [contractId]: [] })));
  };

  const tabs = [
    {
      key: 'overview', label: <span><BarChartOutlined /> نظرة عامة</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card variant="borderless" style={{ borderRadius: 10, background: '#f6faf6', border: '1px solid #e1efe3' }}>
            <Row gutter={[16, 12]}>
              {[
                { l: 'المبنى', v: unit.buildingName ?? buildingName ?? '—', icon: <BankOutlined /> },
                { l: 'رقم الوحدة', v: unit.no, icon: <HomeOutlined /> },
                { l: 'الطابق', v: floorLabel(unit.floor), icon: <BarChartOutlined /> },
                { l: 'النوع', v: unit.typeLabel ?? unit.type ?? '—', icon: typeIcon },
                { l: 'المساحة', v: unit.area ? `${unit.area} م²` : '—', icon: <AppstoreOutlined /> },
                { l: 'الغرف', v: unit.bedrooms || unit.bathrooms ? `${unit.bedrooms ?? 0} غرف · ${unit.bathrooms ?? 0} حمامات` : '—', icon: <HomeOutlined /> },
              ].map(f => (
                <Col span={8} key={f.l}>
                  <Space>
                    <span style={{ color: PRIMARY }}>{f.icon}</span>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{f.l}</Text><Text style={{ fontSize: 13 }}>{f.v}</Text></div>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>

          <Row gutter={[12, 12]}>
            {[
              { label: 'الحالة', v: <Tag color={st.color}>{unit.statusLabel ?? st.label}</Tag> },
              { label: 'الإيجار السنوي', v: <Text strong style={{ color: PRIMARY }}>{money(unit.rent)}</Text> },
              { label: 'حالة الدفع', v: c?.paymentStatus ? <Tag color={PAY_STATUS[c.paymentStatus]?.color}>{PAY_STATUS[c.paymentStatus]?.label ?? c.paymentStatus}</Tag> : <Text type="secondary">—</Text> },
              { label: 'الوديعة', v: !c ? <Text type="secondary">—</Text> : c.depositPaid ? <Tag color="success">مسددة — {money(c.depositAmount)}</Tag> : c.depositAmount ? <Tag color="error">غير مسددة — {money(c.depositAmount)}</Tag> : <Tag>لا توجد</Tag> },
            ].map(s => (
              <Col span={6} key={s.label}>
                <Card size="small" variant="borderless" style={{ borderRadius: 8, textAlign: 'center', background: '#fafafa' }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{s.label}</Text>
                  <div style={{ marginTop: 4 }}>{s.v}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {c ? (
            <Card size="small" variant="borderless" style={{ borderRadius: 10, border: `1px solid ${daysToExpiry !== null && daysToExpiry < 60 ? DANGER : '#d9ead9'}`, background: '#f6faf6' }}>
              <Row align="middle" gutter={[12, 8]}>
                <Col flex="1">
                  <Text strong style={{ display: 'block', fontSize: 13 }}><SafetyCertificateOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />{c.contractNo}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{d(c.startDate)} → {c.endDate ? d(c.endDate) : 'مفتوح'}</Text>
                </Col>
                {c.statusLabel && <Col><Tag color={c.isActive ? 'green' : 'default'}>{c.statusLabel}</Tag></Col>}
                {daysToExpiry !== null && (
                  <Col><Tag color={daysToExpiry < 0 ? 'error' : daysToExpiry < 60 ? 'warning' : 'success'}>{daysToExpiry < 0 ? 'منتهي' : `${daysToExpiry} يوم متبقي`}</Tag></Col>
                )}
              </Row>
            </Card>
          ) : noContract}

          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, background: '#fff7e6', border: '1px solid #ffd591', height: '100%' }}>
                <Space>
                  <FireOutlined style={{ fontSize: 22, color: WARNING }} />
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>استهلاك غير مفوتر</Text>
                    <Text strong style={{ fontSize: 18, color: WARNING }}>{m ? `${(m.unbilledM3 ?? 0).toLocaleString()} م³` : '—'}</Text>
                  </div>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
                {m ? (
                  <>
                    <Row gutter={[8, 4]}>
                      {[
                        { l: 'العداد', v: m.meterNo },
                        { l: 'النوع', v: m.typeLabel ?? m.type ?? '—' },
                        { l: 'آخر قراءة', v: m.lastReadValue != null ? `${Number(m.lastReadValue).toLocaleString()} م³` : '—' },
                        { l: 'تاريخ القراءة', v: d(m.lastRead) },
                      ].map(f => (
                        <Col span={12} key={f.l}><Text type="secondary" style={{ fontSize: 10 }}>{f.l}: </Text><Text style={{ fontSize: 11 }}>{f.v}</Text></Col>
                      ))}
                    </Row>
                    {m.statusLabel && <div style={{ marginTop: 8 }}><Tag color={m.status === 'active' ? 'success' : 'default'}>{m.statusLabel}</Tag></div>}
                  </>
                ) : <Text type="secondary" style={{ fontSize: 12 }}>لا يوجد عداد غاز مركّب لهذه الوحدة</Text>}
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" variant="borderless" style={{ borderRadius: 10, background: (c?.overdueAmount ?? 0) > 0 ? '#fff1f0' : '#f6ffed', border: `1px solid ${(c?.overdueAmount ?? 0) > 0 ? '#ffccc7' : '#d9f7be'}`, height: '100%' }}>
                <Space>
                  <DollarOutlined style={{ fontSize: 22, color: (c?.overdueAmount ?? 0) > 0 ? DANGER : SUCCESS }} />
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>المبالغ المتأخرة</Text>
                    <Text strong style={{ fontSize: 18, color: (c?.overdueAmount ?? 0) > 0 ? DANGER : SUCCESS }}>{(c?.overdueAmount ?? 0) > 0 ? money(c!.overdueAmount) : 'لا يوجد'}</Text>
                  </div>
                </Space>
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={[8, 4]}>
                  <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>الرسوم الشهرية: </Text><Text style={{ fontSize: 11 }}>{c?.monthlyFee ? money(c.monthlyFee) : '—'}</Text></Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>رسوم القطع: </Text><Text style={{ fontSize: 11 }}>{c?.disconnectionFee ? money(c.disconnectionFee) : '—'}</Text></Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>الرصيد المستحق: </Text><Text style={{ fontSize: 11 }}>{c ? money(c.balanceAmount ?? 0) : '—'}</Text></Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>طلبات خدمة: </Text><Text style={{ fontSize: 11 }}>{services.length} طلب{openServices > 0 ? ` (${openServices} مفتوح)` : ''}</Text>
                    {canManage && services.length > 0 && <Button type="link" size="small" style={{ fontSize: 11, padding: '0 4px', height: 'auto' }} onClick={() => setAction('services')}>متابعة</Button>}</Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize: 10 }}>آخر طلب خدمة: </Text><Text style={{ fontSize: 11 }}>{lastService ? d(lastService.requestedAt) : '—'}</Text></Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {unit.notes && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff7e6', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              <ExclamationCircleOutlined style={{ color: WARNING, marginInlineEnd: 6 }} />{unit.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'tenant', label: <span><UserOutlined /> المستأجر</span>,
      children: tenant ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card variant="borderless" style={{ borderRadius: 10, background: '#f6faf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <Avatar size={64} style={{ background: PRIMARY, color: GOLD, fontSize: 20 }}>{tenant.avatar ?? tenant.name?.substring(0, 2)}</Avatar>
              <div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>{tenant.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{[tenant.nationality, tenant.code].filter(Boolean).join(' · ')}</Text>
                {tenant.paymentStatus && <div style={{ marginTop: 4 }}><Tag color={PAY_STATUS[tenant.paymentStatus]?.color}>{PAY_STATUS[tenant.paymentStatus]?.label ?? tenant.paymentStatus}</Tag></div>}
              </div>
            </div>
            <Row gutter={[16, 10]}>
              {[
                { label: 'الهاتف', value: tenant.phone ?? '—', icon: <PhoneOutlined /> },
                { label: 'البريد الإلكتروني', value: tenant.email ?? '—', icon: <MailOutlined /> },
                { label: 'بداية العقد', value: d(c?.startDate), icon: <CalendarOutlined /> },
                { label: 'نهاية العقد', value: c?.endDate ? d(c.endDate) : '—', icon: <CalendarOutlined /> },
                { label: 'الإيجار', value: unit.rent ? `${money(unit.rent)} / سنة` : '—', icon: <DollarOutlined /> },
                { label: 'الوديعة', value: !c ? '—' : c.depositPaid ? `${money(c.depositAmount)} (مسددة)` : 'غير مسددة', icon: <SafetyCertificateOutlined /> },
                { label: 'رسوم التوصيل', value: c?.connectionFee ? money(c.connectionFee) : '—', icon: <DollarOutlined /> },
                { label: 'رسوم القطع', value: c?.disconnectionFee ? money(c.disconnectionFee) : '—', icon: <StopOutlined /> },
                { label: 'الهوية الإماراتية', value: tenant.emiratesId ?? '—', icon: <UserOutlined /> },
                { label: 'الرصيد المستحق', value: money(tenant.balance ?? 0), icon: <DollarOutlined /> },
              ].map(f => (
                <Col span={12} key={f.label}>
                  <Space>
                    <span style={{ color: PRIMARY }}>{f.icon}</span>
                    <div><Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{f.label}</Text><Text style={{ fontSize: 12 }}>{f.value}</Text></div>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
          {c && contract && (
            <ContractTermsCard contractId={c.id} contractNo={c.contractNo} terms={contract.terms ?? []} canManage={canManage}
              onSaved={() => setRefreshKey(k => k + 1)} />
          )}
          <Row gutter={[12, 0]}>
            <Col span={12}><Button block icon={<PhoneOutlined />} href={tenant.phone ? `tel:${tenant.phone}` : undefined} disabled={!tenant.phone}>اتصال</Button></Col>
            <Col span={12}><Button block type="primary" ghost icon={<MailOutlined />} href={tenant.email ? `mailto:${tenant.email}` : undefined} disabled={!tenant.email}>إرسال بريد</Button></Col>
          </Row>
          {canManage && unit.contractId && (
            <Row gutter={[12, 0]}>
              <Col span={12}><Button block icon={<WalletOutlined />} onClick={() => setAction('payment')}>تسجيل دفعة</Button></Col>
              <Col span={12}><Button block danger icon={<StopOutlined />} onClick={() => setAction('terminate')}>إنهاء العقد / تغيير المستأجر</Button></Col>
            </Row>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <UserOutlined style={{ fontSize: 40, color: '#ccc', display: 'block', marginBottom: 12 }} />
          <Text type="secondary">لا يوجد مستأجر حالياً</Text>
          <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>يُربط المستأجر بالوحدة عبر عقد توريد الغاز.</div>
          {canManage && <Button type="primary" icon={<UserAddOutlined />} style={{ marginTop: 16, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAction('tenant')}>إضافة مستأجر وعقد</Button>}
        </div>
      ),
    },
    {
      key: 'history', label: <span><HistoryOutlined /> سجل المستأجرين{history.length ? ` (${history.length})` : ''}</span>,
      children: history.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row gutter={[12, 12]}>
            {statCard('عدد المستأجرين', new Set(history.map(h => h.tenantId)).size, PRIMARY, '#e8f5e9')}
            {statCard('عدد العقود', history.length, '#1565c0', '#e3f2fd')}
            {statCard('مدة الإشغال', occupancyText(history.reduce((t, h) => t + months(h.startDate, h.terminatedAt ?? (h.isActive ? null : h.endDate)), 0)), '#8a6d1f', '#fbf3dc')}
            {statCard('مستحق على السابقين', money(history.filter(h => !h.isActive).reduce((t, h) => t + (h.balanceAmount ?? 0), 0)), DANGER, '#fff1f0')}
          </Row>
          <Timeline style={{ marginTop: 8 }} items={history.map(h => {
            const reason = terminationReason(h.terms);
            const end = h.terminatedAt ?? h.endDate;
            const statusColor = h.isActive ? 'green' : h.status === 'terminated' ? 'red' : 'default';
            const open = historyInvoices[h.id];
            return {
              color: h.isActive ? SUCCESS : h.status === 'terminated' ? DANGER : '#999',
              children: (
                <Card size="small" variant="borderless" style={{ borderRadius: 10, border: `1px solid ${h.isActive ? '#b7eb8f' : '#eee'}`, background: h.isActive ? '#f6ffed' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar size={42} style={{ background: h.isActive ? PRIMARY : '#bfbfbf', color: h.isActive ? GOLD : '#fff', flexShrink: 0 }}>{initials(h.tenant)}</Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Space size={6} wrap>
                        <Text strong style={{ fontSize: 14 }}>{h.tenant ?? '—'}</Text>
                        {h.isActive && <Tag color="green" style={{ fontWeight: 600 }}>المستأجر الحالي</Tag>}
                        <Tag color={statusColor}>{h.statusLabel ?? h.status}</Tag>
                      </Space>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        <SafetyCertificateOutlined /> <bdi>{h.contractNo}</bdi>
                        <span style={{ margin: '0 6px' }}>·</span>
                        <CalendarOutlined /> <bdi>{d(h.startDate)}</bdi> ← <bdi>{h.isActive && !h.endDate ? 'حتى الآن' : d(end)}</bdi>
                        <Tag style={{ marginInlineStart: 8, fontSize: 11 }}><bdi>{occupancyText(months(h.startDate, h.isActive ? null : end))}</bdi></Tag>
                      </div>
                    </div>
                  </div>
                  <Row gutter={[8, 4]} style={{ marginTop: 10 }}>
                    <Col span={6}><Text type="secondary" style={{ fontSize: 10, display: 'block' }}>المفوتر</Text><Text style={{ fontSize: 12 }}>{money(h.invoiced ?? 0)}</Text></Col>
                    <Col span={6}><Text type="secondary" style={{ fontSize: 10, display: 'block' }}>المدفوع</Text><Text style={{ fontSize: 12, color: SUCCESS }}>{money(h.paid ?? 0)}</Text></Col>
                    <Col span={6}><Text type="secondary" style={{ fontSize: 10, display: 'block' }}>الرصيد</Text><Text strong style={{ fontSize: 12, color: (h.balanceAmount ?? 0) > 0 ? DANGER : SUCCESS }}>{money(h.balanceAmount ?? 0)}</Text></Col>
                    <Col span={6}><Text type="secondary" style={{ fontSize: 10, display: 'block' }}>الوديعة</Text><Text style={{ fontSize: 12 }}>{h.depositAmount ? `${money(h.depositAmount)}${h.depositPaid ? ' ✓' : ''}` : '—'}</Text></Col>
                  </Row>
                  {reason && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: '#fff1f0', fontSize: 12, color: '#a8071a' }}>
                      <StopOutlined style={{ marginInlineEnd: 6 }} />سبب الإنهاء: {reason}
                    </div>
                  )}
                  <Button type="link" size="small" style={{ padding: 0, marginTop: 6 }} icon={open && open !== 'loading' ? <UpOutlined /> : <DownOutlined />}
                    loading={open === 'loading'} onClick={() => toggleHistoryInvoices(h.id)}>
                    {open && open !== 'loading' ? 'إخفاء الفواتير' : 'عرض فواتير هذا العقد'}
                  </Button>
                  {open && open !== 'loading' && (
                    <Table<InvoiceRow> size="small" style={{ marginTop: 6 }} dataSource={open} rowKey="id" pagination={open.length > 6 ? { pageSize: 6, size: 'small' } : false}
                      locale={{ emptyText: 'لا توجد فواتير لهذا العقد' }}
                      columns={[
                        { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontSize: 11 }}>{v}</Text> },
                        { title: 'التاريخ', dataIndex: 'date', render: v => <Text style={{ fontSize: 11 }}>{d(v)}</Text>, width: 95 },
                        { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong style={{ fontSize: 11, color: PRIMARY }}>{money(v)}</Text>, width: 100 },
                        { title: 'الحالة', dataIndex: 'status', render: (v, r) => <Tag color={PAY_STATUS[v]?.color} style={{ fontSize: 10 }}>{r.statusLabel ?? v}</Tag>, width: 85 },
                        { title: '', key: 'p', width: 40, render: (_, r) => <Tooltip title="طباعة"><Button size="small" type="text" icon={<PrinterOutlined />} style={{ color: PRIMARY }} onClick={() => doPrintInvoice(r.id)} /></Tooltip> },
                      ]} />
                  )}
                </Card>
              ),
            };
          })} />
        </div>
      ) : (
        <Empty image={<TeamOutlined style={{ fontSize: 40, color: '#ccc' }} />} description="لم يسكن هذه الوحدة أي مستأجر بعد" />
      ),
    },
    {
      key: 'gas', label: <span><FireOutlined /> الغاز</span>,
      children: m ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row gutter={[12, 12]}>
            {statCard('استهلاك غير مفوتر', `${(m.unbilledM3 ?? 0).toLocaleString()} م³`, WARNING, '#fff7e6', <FireOutlined />, 12)}
            {statCard('آخر قراءة', `${Number(m.lastReadValue ?? 0).toLocaleString()} م³`, PRIMARY, '#e8f5e9', <DatabaseOutlined />, 12)}
            {statCard('متوسط الاستهلاك الشهري', `${m.monthlyAvg ?? 0} م³`, '#1565c0', '#e3f2fd', <BarChartOutlined />, 12)}
            {statCard('سعر الغاز', c?.gasUnitPrice != null ? `${c.gasUnitPrice} د.إ / م³` : '—', SUCCESS, '#f6ffed', <DollarOutlined />, 12)}
          </Row>
          <Card size="small" variant="borderless" style={{ borderRadius: 10 }}>
            <Descriptions size="small" column={2} title={<Text strong><DatabaseOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />تفاصيل العداد</Text>}>
              <Descriptions.Item label="رقم العداد">{m.meterNo}</Descriptions.Item>
              <Descriptions.Item label="الرقم التسلسلي">{m.serial ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="النوع">{m.typeLabel ?? m.type ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الشركة المصنعة">{m.brand ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="تاريخ التركيب">{d(m.installDate)}</Descriptions.Item>
              <Descriptions.Item label="تاريخ المعايرة">{d(m.calibrationDate)}</Descriptions.Item>
              <Descriptions.Item label="تاريخ آخر قراءة">{d(m.lastRead)}</Descriptions.Item>
              <Descriptions.Item label="الحالة"><Tag color={m.status === 'active' ? 'success' : 'default'}>{m.statusLabel ?? m.status}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      ) : (
        <Empty image={<FireOutlined style={{ fontSize: 40, color: '#ccc' }} />} description="لا يوجد عداد غاز مركّب لهذه الوحدة">
          {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: WARNING, borderColor: WARNING }} onClick={() => setAction('meter')}>تركيب عداد</Button>}
        </Empty>
      ),
    },
    {
      key: 'meters', label: <span><DashboardOutlined /> العدادات{meterCount ? ` (${meterCount})` : ''}</span>,
      children: (
        <UnitMetersTab unitId={unit.id} refreshKey={refreshKey} canManage={canManage} onCount={setMeterCount}
          onInstall={() => setAction('meter')} onReading={() => setAction('reading')} />
      ),
    },
    {
      key: 'activity', label: <span><ClockCircleOutlined /> النشاط</span>,
      children: activity.length ? (
        <Timeline style={{ paddingTop: 8 }} items={activity.map(a => ({
          color: a.color,
          children: <div><Text style={{ fontSize: 12 }}>{a.text}</Text><div style={{ fontSize: 11, color: '#888' }}>{d(a.date)}</div></div>,
        }))} />
      ) : <Empty description="لا يوجد نشاط مسجّل لهذه الوحدة بعد" />,
    },
    {
      key: 'invoices', label: <span><FileTextOutlined /> الفواتير</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row gutter={[12, 12]}>
            {statCard('إجمالي الفواتير', invoices.length, PRIMARY, '#e8f5e9')}
            {statCard('مسددة', invoices.filter(i => i.status === 'paid').length, SUCCESS, '#f6ffed')}
            {statCard('متأخرة / معلقة', invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length, DANGER, '#fff1f0')}
            {statCard('إجمالي المبالغ', money(invoices.reduce((s, i) => s + (i.amount ?? 0), 0)), '#00695c', '#e0f2f1')}
          </Row>
          <Table<InvoiceRow> size="small" dataSource={invoices} rowKey="id" pagination={invoices.length > 8 ? { pageSize: 8, size: 'small' } : false}
            locale={{ emptyText: c ? 'لا توجد فواتير لهذا العقد بعد' : 'لا يوجد عقد — لا توجد فواتير' }}
            columns={[
              { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontSize: 11 }}>{v}</Text>, width: 140 },
              { title: 'التاريخ', dataIndex: 'date', render: v => <Text style={{ fontSize: 11 }}>{d(v)}</Text>, width: 95 },
              { title: 'النوع', dataIndex: 'typeLabel', render: v => <Text style={{ fontSize: 11 }}>{v ?? '—'}</Text> },
              { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong style={{ fontSize: 12, color: PRIMARY }}>{money(v)}</Text>, width: 110 },
              { title: 'الحالة', dataIndex: 'status', render: (v, r) => <Tag color={PAY_STATUS[v]?.color} style={{ fontSize: 10 }}>{r.statusLabel ?? PAY_STATUS[v]?.label ?? v}</Tag>, width: 90 },
              { title: 'تاريخ السداد', dataIndex: 'paidDate', render: v => <Text style={{ fontSize: 11 }}>{d(v)}</Text>, width: 100 },
              { title: '', key: 'print', width: 44, render: (_, r) => <Tooltip title="طباعة الفاتورة"><Button size="small" type="text" icon={<PrinterOutlined />} style={{ color: PRIMARY }} onClick={() => doPrintInvoice(r.id)} /></Tooltip> },
            ]} />
          {canManage && c && (
            <Row gutter={[12, 0]}>
              <Col span={12}><Button block type="primary" ghost icon={<FileTextOutlined />} onClick={() => setAction('invoice')}>إصدار فاتورة استهلاك</Button></Col>
              <Col span={12}><Button block type="primary" icon={<WalletOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAction('payment')}>تسجيل دفعة</Button></Col>
            </Row>
          )}
        </div>
      ),
    },
    {
      key: 'payments', label: <span><DollarOutlined /> المدفوعات</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row gutter={[12, 12]}>
            {statCard('إجمالي المدفوعات', payments.length, PRIMARY, '#e8f5e9', undefined, 12)}
            {statCard('إجمالي المبالغ', money(payments.reduce((s, p) => s + (p.amount ?? 0), 0)), SUCCESS, '#f6ffed', undefined, 12)}
          </Row>
          <Table<PaymentRow> size="small" dataSource={payments} rowKey="id" pagination={payments.length > 8 ? { pageSize: 8, size: 'small' } : false}
            locale={{ emptyText: tenant ? 'لا توجد مدفوعات مسجّلة' : 'لا يوجد مستأجر — لا توجد مدفوعات' }}
            columns={[
              { title: 'رقم الإيصال', dataIndex: 'receiptNo', render: v => <Text style={{ fontSize: 11 }}>{v}</Text>, width: 140 },
              { title: 'التاريخ', dataIndex: 'date', render: v => <Text style={{ fontSize: 11 }}>{d(v)}</Text>, width: 95 },
              { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong style={{ fontSize: 12, color: SUCCESS }}>{money(v)}</Text>, width: 110 },
              { title: 'الطريقة', dataIndex: 'methodLabel', render: v => <Tag color="green" style={{ fontSize: 10 }}>{v ?? '—'}</Tag>, width: 100 },
              { title: 'المرجع', dataIndex: 'reference', render: v => <Text style={{ fontSize: 10, color: '#888' }}>{v ?? '—'}</Text> },
              { title: 'الفاتورة', dataIndex: 'invoiceLabel', render: v => <Text style={{ fontSize: 10, color: PRIMARY }}>{v || '—'}</Text>, width: 130 },
              { title: 'الحالة', dataIndex: 'statusLabel', render: (v, r) => <Tag color={r.status === 'cancelled' ? 'default' : 'success'} style={{ fontSize: 10 }}>{v ?? r.status}</Tag>, width: 80 },
              { title: '', key: 'print', width: 44, render: (_, r) => <Tooltip title="طباعة سند القبض"><Button size="small" type="text" icon={<PrinterOutlined />} style={{ color: PRIMARY }} onClick={() => doPrintReceipt(r.id)} /></Tooltip> },
            ]} />
          {canManage && c && <Button block type="primary" icon={<WalletOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAction('payment')}>تسجيل دفعة جديدة</Button>}
        </div>
      ),
    },
    {
      key: 'readings', label: <span><DatabaseOutlined /> القراءات</span>,
      children: m ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row gutter={[12, 12]}>
            {statCard('آخر قراءة', `${(readings[0]?.readingValue ?? m.lastReadValue ?? 0).toLocaleString()} م³`, WARNING, '#fff7e6')}
            {statCard('آخر استهلاك', `${readings[0]?.consumption ?? 0} م³`, PRIMARY, '#e8f5e9')}
            {statCard('متوسط الاستهلاك', `${readings.length ? Math.round(readings.reduce((s, r) => s + (r.consumption ?? 0), 0) / readings.length) : 0} م³`, SUCCESS, '#f6ffed')}
            {statCard('عدد القراءات', readings.length, '#00695c', '#e0f2f1')}
          </Row>
          <Table size="small" dataSource={readings} rowKey="id" pagination={readings.length > 8 ? { pageSize: 8, size: 'small' } : false}
            locale={{ emptyText: 'لا توجد قراءات مسجّلة لهذا العداد' }}
            footer={canManage ? () => <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setAction('reading')}>تسجيل قراءة جديدة</Button> : undefined}
            columns={[
              { title: 'التاريخ', dataIndex: 'readingDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{d(v)}</Text>, width: 100 },
              { title: 'القراءة الحالية', dataIndex: 'readingValue', render: (v: number) => <Text strong style={{ fontSize: 12, color: PRIMARY }}>{v.toLocaleString()} م³</Text>, width: 120 },
              { title: 'القراءة السابقة', dataIndex: 'previous', render: (v: number | null) => <Text style={{ fontSize: 11 }}>{v == null ? '—' : `${v.toLocaleString()} م³`}</Text>, width: 120 },
              { title: 'الاستهلاك', dataIndex: 'consumption', render: (v: number | null) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FireOutlined style={{ color: WARNING, fontSize: 12 }} /><Text strong style={{ fontSize: 12, color: WARNING }}>{v ?? 0} م³</Text></span>
              ), width: 100 },
              { title: 'النوع', dataIndex: 'type', render: (v: string | null, r: any) => {
                const t = READING_TYPE_TAG[v ?? 'periodic'] ?? READING_TYPE_TAG.periodic;
                return <Tag color={t.color} style={{ fontSize: 10 }}>{r.typeLabel ?? t.label}</Tag>;
              }, width: 96 },
              { title: 'القارئ', dataIndex: 'readBy', render: (v?: string) => <Text style={{ fontSize: 11 }}>{v ?? '—'}</Text> },
              { title: 'الفوترة', dataIndex: 'billed', render: (v: boolean) => <Tag color={v ? 'success' : 'warning'} style={{ fontSize: 10 }}>{v ? 'مفوترة' : 'غير مفوترة'}</Tag>, width: 90 },
            ]} />
        </div>
      ) : <Empty image={<DatabaseOutlined style={{ fontSize: 40, color: '#ccc' }} />} description="لا يوجد عداد — لا توجد قراءات" />,
    },
  ];

  return (
    <Drawer open={!!unit} onClose={onClose} width={820} placement="left" destroyOnHidden
      extra={unit && <HistoryButton entityType="Unit" id={unit.id} title={`وحدة ${unit.no}`} size="middle" />}
      styles={{ body: { paddingTop: 8 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 10, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: st.color }}>
            {typeIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong style={{ fontSize: 16, display: 'block' }}>وحدة {unit.no} — {unit.buildingName ?? buildingName}</Text>
            <Space size={6} wrap>
              <Tag color={st.color} style={{ fontSize: 11 }}>{unit.statusLabel ?? st.label}</Tag>
              {unit.isActive === false && <Tag color="default" icon={<StopOutlined />} style={{ fontSize: 11 }}>موقوفة</Tag>}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {[unit.typeLabel, unit.area ? `${unit.area} م²` : null, unit.bedrooms ? `${unit.bedrooms} غرف` : null, floorLabel(unit.floor)].filter(Boolean).join(' · ')}
              </Text>
            </Space>
          </div>
          {canManage && (
            <Space>
              <Tooltip title="تعديل بيانات الوحدة"><Button icon={<EditOutlined />} onClick={() => onEdit?.(unit)}>تعديل</Button></Tooltip>
              {onToggleActive && (unit.isActive === false
                ? <Tooltip title="تفعيل الوحدة"><Button icon={<CheckCircleOutlined />} style={{ color: PRIMARY, borderColor: PRIMARY }} onClick={() => onToggleActive(unit)}>تفعيل</Button></Tooltip>
                : <Tooltip title="إيقاف الوحدة دون حذفها (لا يمكن إضافة مستأجر لها)"><Button icon={<StopOutlined />} style={{ color: '#d46b08', borderColor: '#ffd591' }} onClick={() => onToggleActive(unit)}>إيقاف</Button></Tooltip>)}
              <Tooltip title="حذف الوحدة (حذف آمن — تبقى سجلاتها محفوظة)"><Button danger icon={<DeleteOutlined />} onClick={() => onDelete?.(unit)} /></Tooltip>
            </Space>
          )}
        </div>
      }
    >
      {unit.isActive === false && !action && (
        <Alert type="warning" showIcon icon={<StopOutlined />} style={{ marginBottom: 8, borderRadius: 10 }}
          message="هذه الوحدة موقوفة — سجلاتها محفوظة، ولا يمكن إضافة مستأجر جديد لها حتى يتم تفعيلها." />
      )}
      {canManage && action ? (
        /* the action form replaces the unit details inside this side panel (no pop-up on top) */
        <UnitActionModal action={action} unit={unit} tenantPhone={tenant?.phone} onClose={() => setAction(null)}
          onSaved={() => { setRefreshKey(k => k + 1); onChanged?.(); }}
          onDone={next => { setRefreshKey(k => k + 1); onChanged?.(); setAction(null); if (next) setTimeout(() => setAction(next), 400); }} />
      ) : (
        <>
        {canManage && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', marginBottom: 8, borderRadius: 10, background: '#f5f0e8', border: '1px solid #e6e0d2' }}>
            <Text strong style={{ color: '#8a6d1f', alignSelf: 'center', marginInlineEnd: 4 }}>إجراءات سريعة:</Text>
            {!unit.contractId && <Button size="small" type="primary" icon={<UserAddOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAction('tenant')}>إضافة مستأجر وعقد</Button>}
            {!unit.meterId && <Button size="small" type="primary" icon={<FireOutlined />} style={{ background: WARNING, borderColor: WARNING }} onClick={() => setAction('meter')}>تركيب عداد</Button>}
            {unit.meterId && <Button size="small" icon={<DatabaseOutlined />} onClick={() => setAction('reading')}>تسجيل قراءة</Button>}
            {unit.contractId && <Button size="small" type="primary" icon={<WalletOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAction('payment')}>تسجيل دفعة</Button>}
            {unit.contractId && <Button size="small" icon={<FileTextOutlined />} onClick={() => setAction('invoice')}>إصدار فاتورة</Button>}
            <Button size="small" icon={<ToolOutlined />} onClick={() => setAction('service')}>طلب خدمة</Button>
            {services.length > 0 && (
              <Button size="small" icon={<HistoryOutlined />} onClick={() => setAction('services')}>
                متابعة الطلبات{openServices > 0 && <Tag color="orange" style={{ marginInlineStart: 6, marginInlineEnd: 0 }}>{openServices} مفتوح</Tag>}
              </Button>
            )}
            {unit.contractId && <Button size="small" danger icon={<StopOutlined />} onClick={() => setAction('terminate')}>إنهاء العقد / تغيير المستأجر</Button>}
          </div>
        )}
        {error && <div style={{ color: DANGER, marginBottom: 8 }}><ToolOutlined /> {error}</div>}
        <Spin spinning={loading}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" items={tabs} />
        </Spin>
        </>
      )}
    </Drawer>
  );
};

export default UnitProfileDrawer;
