import { useCallback, useEffect, useMemo, useState } from 'react';
import VillaServiceTab from './VillaServiceTab';
import SiteVisitsTab from './SiteVisitsTab';
import { Row, Col, Card, Descriptions, Tag, Table, Button, Space, Typography, Progress, Empty, Modal, Input, Popconfirm, Spin, Tooltip, Avatar, Tabs, Form, Select, DatePicker, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import {
  ShopOutlined, UserOutlined, PhoneOutlined, EditOutlined, PlusOutlined, StopOutlined, FileDoneOutlined, FireOutlined, ArrowLeftOutlined,
  DatabaseOutlined, FileProtectOutlined, DollarOutlined, PauseCircleOutlined, PlayCircleOutlined, TeamOutlined, BankOutlined, FileTextOutlined,
  ToolOutlined, CalendarOutlined, EnvironmentOutlined, PrinterOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleOutlined, UploadOutlined, EyeOutlined, DownloadOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api, apiUpload, authFetch, API_BASE, errorMessage, type Paged } from '../../api/client';
import { premisesApi } from '../../api/premises';
import { useAuth } from '../../auth/AuthContext';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { RefillRequestDrawer, NewRefillRequestModal, mapLiveRefill, type RefillRequestItem } from '../Buildings/RefillRequestDrawer';
import { PremisesFormModal, ContractModal, SignatoryModal, InvoiceRefillModal, PRIMARY, money, litres, d10 } from './forms';
import SiteTanksYard, { type SiteTank } from './SiteTanksYard';
import { PremisesAmcModal } from './premisesAmc';
import SiteContractsTab from './SiteContractsTab';
import { RecordPaymentModal } from '../Invoices/shared';
import { openPrintWindow, printInvoice, printDeliveryContract } from '../../utils/printDocs';

const { Title, Text } = Typography;
const cardStyle = { borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' } as const;
const CONTRACT_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: 'نشط' }, expired: { color: 'default', label: 'منتهي' },
  terminated: { color: 'red', label: 'منهى' }, draft: { color: 'blue', label: 'مسودة' }, pending: { color: 'orange', label: 'معلق' },
};
const INV_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, overdue: { color: 'error', label: 'متأخرة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const REFILL_STAGE = ['طلب', 'أمر شراء', 'دفع للمورد', 'استلام', 'فاتورة شراء', 'جدولة', 'تعبئة الخزان', 'موافقة الإدارة', 'مكتمل'];
const DOC_TYPES = [
  { value: 'trade_license', label: 'الرخصة التجارية' }, { value: 'contract', label: 'عقد' }, { value: 'emirates_id', label: 'الهوية' },
  { value: 'certificate', label: 'شهادة' }, { value: 'photo', label: 'صورة' }, { value: 'invoice', label: 'فاتورة' }, { value: 'other', label: 'أخرى' },
];
const kb = (n?: number) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

async function openBlob(url: string, fileName?: string, mime?: string, download = false) {
  const w = download ? null : window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'الملف غير موجود' : `تعذر تحميل الملف (${res.status})`);
    const obj = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(mime ?? '')) w.location.href = obj;
    else { w?.close(); const a = document.createElement('a'); a.href = obj; a.download = fileName ?? 'file'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(obj), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

function MiniKpi({ title, value, sub, color, bg, icon, onClick }: { title: string; value: React.ReactNode; sub?: React.ReactNode; color: string; bg: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <Card style={{ ...cardStyle, cursor: onClick ? 'pointer' : undefined }} styles={{ body: { padding: '16px 18px' } }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 11 }}>{sub}</Text></div>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color }}>{icon}</div>
      </div>
    </Card>
  );
}

/**
 * Restaurant profile in the Buildings style: green header with stats, grouped navigation
 * (المطعم · العقود والمالية · الخزان والتعبئة · البيانات والوثائق), tanks diagram, refills → invoices.
 * A restaurant shares its building, so this is its own screen (the host building profile is not changed).
 */
export default function RestaurantProfile({ restaurantId, initialTab, onBack, onOpenBuilding }: { restaurantId: number; initialTab?: string; onBack: () => void; onOpenBuilding?: (buildingId: number) => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const canInvoice = can('invoices.manage');
  const canRefill = can('tanks.manage');
  const [s, setS] = useState<any>(null);
  const [refills, setRefills] = useState<any[]>([]);
  const [requests, setRequests] = useState<RefillRequestItem[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab ?? 'site');
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [editContract, setEditContract] = useState<any>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [editSig, setEditSig] = useState<any>(null);
  const [invoiceRow, setInvoiceRow] = useState<any>(null);
  const [newRefillOpen, setNewRefillOpen] = useState(false);
  const [refill, setRefill] = useState<RefillRequestItem | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docFiles, setDocFiles] = useState<UploadFile[]>([]);
  const [docSaving, setDocSaving] = useState(false);
  const [docForm] = Form.useForm();
  const [amcs, setAmcs] = useState<any[]>([]);
  const [amcOpen, setAmcOpen] = useState(false);
  const [payFor, setPayFor] = useState<{ invoiceId?: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([premisesApi.get(restaurantId), premisesApi.refills({ premisesId: restaurantId })]);
      setS(d); setRefills(r);
      const tankIds: number[] = (d.tanks ?? []).map((t: any) => (t.tank ?? t).id);
      const reqs = await Promise.all(tankIds.map(id => api<Paged<any>>('/refill-requests', { query: { tankId: id, pageSize: 0 } }).then(x => x.items).catch(() => [])));
      setRequests(reqs.flat().map(mapLiveRefill).sort((a, b) => b.requestDate.localeCompare(a.requestDate)));
      const contractIds: number[] = (d.contracts ?? []).map((c: any) => c.id);
      const inv = await Promise.all(contractIds.map(id => api<Paged<any>>('/invoices', { query: { contractId: id, pageSize: 0 } }).then(x => x.items).catch(() => [])));
      setInvoices(inv.flat().sort((a: any, b: any) => String(b.date ?? b.issueDate).localeCompare(String(a.date ?? a.issueDate))));
      setDocs(await api<any[]>('/documents', { query: { entityType: 'restaurant', entityId: restaurantId } }).catch(() => []));
      // the restaurant's own service & maintenance contracts (not the host building's)
      setAmcs(await api<Paged<any>>('/amc-contracts', { query: { premisesId: restaurantId, pageSize: 0 } }).then(x => x.items).catch(() => []));
    } catch (e) { message.error(errorMessage(e)); }
    finally { setLoading(false); }
  }, [restaurantId]);
  useEffect(() => { load(); }, [load, key]);
  const changed = () => setKey(k => k + 1);
  useTrackView('Restaurant', restaurantId, s?.name);

  const invIdByNo: Record<string, number> = useMemo(() => Object.fromEntries(invoices.map((x: any) => [x.no ?? x.invoiceNo, x.id])), [invoices]);
  const tanks: SiteTank[] = useMemo(() => (s?.tanks ?? []).map((t: any) => t.tank ?? t), [s]);
  const openReq: Record<number, string> = useMemo(() => Object.fromEntries((s?.tanks ?? []).map((t: any) => [(t.tank ?? t).id, t.openRequest])), [s]);

  if (!s) return <Card style={cardStyle}><div style={{ textAlign: 'center', padding: 60 }}>{loading ? <Spin /> : <Empty />}</div></Card>;

  const r = s.restaurant ?? {};
  const cap = tanks.reduce((n, t) => n + Number(t.capacityLitres ?? 0), 0);
  const lvl = tanks.reduce((n, t) => n + Number(t.currentLevel ?? 0), 0);
  const pct = cap > 0 ? Math.round((lvl / cap) * 1000) / 10 : null;
  const active = (s.contracts ?? []).find((c: any) => c.status === 'active');
  const ready = refills.filter(x => x.readyToInvoice);
  const invoiced = refills.reduce((n, x) => n + Number(x.invoicedAmount ?? 0), 0);
  const signers = (s.signatories ?? []).filter((x: any) => x.isActive && x.canSignContracts);
  const openRequests = requests.filter(x => x.status !== 'completed' && x.status !== 'cancelled');
  const licenceExpired = r.tradeLicenseExpiry && dayjs(r.tradeLicenseExpiry).isBefore(dayjs(), 'day');

  const terminate = (c: any) => {
    let reason = '';
    Modal.confirm({
      title: `إنهاء العقد ${c.contractNo}؟`, centered: true, okText: 'إنهاء', okType: 'danger', cancelText: 'إلغاء',
      content: <Input.TextArea rows={2} placeholder="السبب (اختياري)" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => { try { await premisesApi.terminateContract(c.id, undefined, reason || undefined); message.success('تم إنهاء العقد'); changed(); } catch (e) { message.error(errorMessage(e), 6); } },
    });
  };
  const toggleActive = async () => {
    try { await premisesApi.setActive(s.id, !s.isActive); message.success(s.isActive ? 'تم إيقاف المطعم' : 'تم تفعيل المطعم'); changed(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = () => Modal.confirm({
    title: `حذف المطعم ${s.code}؟`, content: 'يُسمح فقط إذا لم يُستخدم (لا عقود ولا تعبئات ولا فواتير). المطعم المستخدم يُوقف بدلاً من الحذف.', centered: true,
    okText: 'حذف', okType: 'danger', cancelText: 'إلغاء',
    onOk: async () => { try { await premisesApi.remove(s.id); message.success('تم حذف المطعم'); onBack(); } catch (e) { message.error(errorMessage(e), 7); } },
  });
  const openRefill = async (id: string | number) => {
    try { setRefill(mapLiveRefill(await api<any>(`/refill-requests/${id}`))); } catch (e) { message.error(errorMessage(e)); }
  };
  const uploadDocs = async () => {
    const v = await docForm.validateFields();
    if (!docFiles.length) { message.warning('اختر ملفاً'); return; }
    setDocSaving(true);
    try {
      for (const f of docFiles) {
        const fd = new FormData();
        fd.append('file', f.originFileObj as File);
        fd.append('entityType', 'restaurant');
        fd.append('entityId', String(s.id));
        fd.append('documentType', v.documentType);
        if (v.expiryDate) fd.append('expiryDate', v.expiryDate.format('YYYY-MM-DD'));
        fd.append('branchId', String(s.branchId));
        await apiUpload('/documents', fd);
      }
      message.success('تم رفع الوثائق'); setDocOpen(false); setDocFiles([]); changed();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setDocSaving(false); }
  };

  // ── header (same look as the building profile) ──
  const header = (
    <Card variant="borderless" style={{ marginBottom: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, #2e7d32 100%)`, borderRadius: 12 }} styles={{ body: { padding: '12px 20px' } }}>
      <Row align="middle" gutter={[12, 8]}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff', borderRadius: 8 }}>رجوع</Button>
        </Col>
        <Col flex="auto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Avatar size={40} icon={<ShopOutlined />} style={{ background: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Title level={5} style={{ margin: 0, color: '#fff', fontSize: 17 }}>{s.name}</Title>
                <Tag color={s.isActive ? 'success' : 'default'} style={{ borderRadius: 8, fontWeight: 600 }}>{s.isActive ? 'نشط' : 'موقوف'}</Tag>
                <Tag style={{ borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}>مطعم</Tag>
              </div>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                {[r.tradeName, s.code].filter(Boolean).join(' · ')}
                {s.building && <> · <BankOutlined style={{ marginInlineEnd: 4 }} />
                  <a style={{ color: '#ffe58f' }} onClick={() => onOpenBuilding?.(s.building.id)}>{s.building.code} — {s.building.name}</a>{s.unit ? ` · وحدة ${s.unit.unitNo}` : ''}</>}
                {(s.building?.city || s.branch) && <> · <EnvironmentOutlined style={{ marginInlineEnd: 4 }} />{[s.building?.city, s.branch].filter(Boolean).join('، ')}</>}
              </Text>
            </div>
          </div>
        </Col>
        <Col>
          <Space>
            {canManage && <Tooltip title="تعديل بيانات المطعم"><Button icon={<EditOutlined />} onClick={() => setEditOpen(true)} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }} /></Tooltip>}
            {canManage && (s.isActive
              ? <Tooltip title="إيقاف المطعم (دون حذف)"><Button icon={<PauseCircleOutlined />} onClick={toggleActive} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#ffd591' }} /></Tooltip>
              : <Tooltip title="تفعيل المطعم"><Button icon={<PlayCircleOutlined />} onClick={toggleActive} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#b7eb8f' }} /></Tooltip>)}
            {canManage && <Tooltip title="حذف المطعم"><Button icon={<DeleteOutlined />} onClick={remove} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#ffa39e' }} /></Tooltip>}
            <HistoryButton entityType="Restaurant" id={s.id} title={`${s.code} — ${s.name}`} size="middle" label={null} type="default" />
            <Tooltip title="طباعة"><Button icon={<PrinterOutlined />} onClick={() => window.print()} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }} /></Tooltip>
          </Space>
        </Col>
      </Row>
      <Row style={{ marginTop: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 16px' }}>
        {[
          { label: 'الخزانات', value: tanks.length, icon: <DatabaseOutlined /> },
          { label: 'مستوى الخزان', value: pct != null ? `${pct}%` : '—', icon: <FireOutlined /> },
          { label: 'طلبات التعبئة', value: requests.length, icon: <ToolOutlined /> },
          { label: 'جاهزة للفوترة', value: ready.length, icon: <FileDoneOutlined /> },
          { label: 'المخولون بالتوقيع', value: signers.length, icon: <TeamOutlined /> },
          { label: 'سعر اللتر', value: active ? Number(active.pricePerLitre).toLocaleString() : '—', icon: <FileProtectOutlined /> },
        ].map((k, i) => (
          <Col key={i} flex="1" style={{ textAlign: 'center', borderRight: i < 5 ? '1px solid rgba(255,255,255,0.15)' : undefined, padding: '2px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{k.icon} {k.label}</span>
            <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{k.value}</span>
          </Col>
        ))}
      </Row>
    </Card>
  );

  // ── tabs ──
  const contractsTable = (
    <Table<any> rowKey="id" size="small" dataSource={s.contracts ?? []} pagination={false}
      locale={{ emptyText: <Empty description="لا يوجد عقد — أضف عقد التوريد بسعر اللتر ليوقّعه أحد المخولين" /> }}
      columns={[
        { title: 'العقد', dataIndex: 'contractNo', render: x => <Text code>{x}</Text> },
        { title: 'الفترة', render: (_, c) => `${d10(c.startDate)} → ${d10(c.endDate)}${c.autoRenew ? ' (تجديد تلقائي)' : ''}` },
        { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: x => <Text strong>{Number(x).toLocaleString()} د.إ</Text> },
        { title: 'الضريبة', dataIndex: 'taxCode', render: x => x ?? 'افتراضي' },
        { title: 'الموقّع', dataIndex: 'signedByName', render: (x, c) => <span>{x ?? '—'}{c.signedDate && <div style={{ fontSize: 11, color: '#888' }}>{d10(c.signedDate)}</div>}</span> },
        { title: 'المفوتر', render: (_, c) => <span>{money(c.invoicedTotal)}<div style={{ fontSize: 11, color: '#888' }}>{litres(c.invoicedLitres)}</div></span> },
        { title: 'الحالة', dataIndex: 'status', render: x => <Tag color={CONTRACT_STATUS[x]?.color}>{CONTRACT_STATUS[x]?.label ?? x}</Tag> },
        { title: '', render: (_, c) => canManage && c.status === 'active' ? <Space size={0}>
          <Tooltip title="طباعة العقد"><Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => printDeliveryContract(openPrintWindow(), c.id)} /></Tooltip>
          <Tooltip title="تعديل"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditContract(c); setContractOpen(true); }} /></Tooltip>
          <Tooltip title="إنهاء العقد"><Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => terminate(c)} /></Tooltip>
        </Space> : <Space size={0}><Tooltip title="طباعة العقد"><Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => printDeliveryContract(openPrintWindow(), c.id)} /></Tooltip><HistoryButton entityType="DeliveryContract" id={c.id} label={null} type="text" /></Space> },
      ]} />
  );
  const newContractBtn = canManage && s.isActive && !active && <Button size="small" type="primary" style={{ background: PRIMARY }} icon={<PlusOutlined />}
    onClick={() => { if (!signers.length) { message.warning('أضف شخصاً مخولاً بالتوقيع من طاقم المطعم أولاً'); setActiveTab('signatories'); return; } setEditContract(null); setContractOpen(true); }}>عقد جديد</Button>;

  const AMC_STATUS: Record<string, { color: string; label: string }> = { active: { color: 'green', label: 'ساري' }, pending: { color: 'orange', label: 'لم يبدأ' }, expired: { color: 'default', label: 'منتهي' }, cancelled: { color: 'red', label: 'ملغى' } };
  const activeAmc = amcs.find(a => a.status === 'active' && dayjs(a.startDate).isBefore(dayjs().add(1, 'day'), 'day') && dayjs(a.endDate).isAfter(dayjs().subtract(1, 'day'), 'day'));
  const amcTable = (
    <Table<any> rowKey="id" size="small" dataSource={amcs} pagination={false}
      locale={{ emptyText: <Empty description="لا يوجد عقد صيانة للمطعم — بدون عقد ساري لا يمكن فتح طلبات الخدمة" /> }}
      columns={[
        { title: 'العقد', dataIndex: 'contractNo', render: x => <Text code>{x}</Text> },
        { title: 'الفترة', render: (_, a) => `${d10(a.startDate)} → ${d10(a.endDate)}` },
        { title: 'القيمة السنوية', dataIndex: 'annualValue', render: x => <Text strong>{money(x)}</Text> },
        { title: 'الزيارات', render: (_, a) => `${a.visitsDone ?? 0} / ${a.visitsTotal ?? 0}${a.nextVisit ? ` · القادمة ${d10(a.nextVisit)}` : ''}` },
        { title: 'الاستجابة', dataIndex: 'responseTime', render: (x, a) => <span>{x ?? '—'}{a.emergencyIncluded && <Tag color="red" style={{ marginInlineStart: 4 }}>طوارئ</Tag>}</span> },
        { title: 'الحالة', dataIndex: 'status', render: (x, a) => <Tag color={AMC_STATUS[x]?.color}>{a.statusLabel ?? AMC_STATUS[x]?.label ?? x}</Tag> },
        { title: '', render: (_, a) => <HistoryButton entityType="AmcContract" id={a.id} label={null} type="text" /> },
      ]} />
  );
  const newAmcBtn = canManage && s.isActive && !activeAmc && s.building && <Button size="small" type="primary" style={{ background: '#1d39c4' }} icon={<PlusOutlined />}
    onClick={() => setAmcOpen(true)}>عقد صيانة جديد</Button>;
  const amcCard = (
    <Card style={cardStyle} title={<Space><ToolOutlined style={{ color: '#1d39c4' }} /><Text strong>عقد الخدمة والصيانة (AMC)</Text>{activeAmc ? <Tag color="green">ساري حتى {d10(activeAmc.endDate)}</Tag> : <Tag color="red">لا يوجد عقد ساري</Tag>}</Space>}
      extra={newAmcBtn}>{amcTable}</Card>
  );

  const refillsInvoicesTable = (
    <Table<any> rowKey="refillRequestId" size="small" dataSource={refills} pagination={{ pageSize: 8, size: 'small' }}
      locale={{ emptyText: <Empty description="لا توجد تعبئات بعد — أنشئ طلب تعبئة من «الخزان والتعبئة»" /> }}
      onRow={x => ({ onClick: () => openRefill(x.refillRequestId), style: { cursor: 'pointer' } })}
      columns={[
        { title: 'الطلب', dataIndex: 'requestNo', render: x => <Text code>{x}</Text> },
        { title: 'الخزان', dataIndex: 'tankNo' },
        { title: 'التاريخ', dataIndex: 'requestDate', render: d10 },
        { title: 'التوصيل', dataIndex: 'deliveredAt', render: x => x ? d10(x) : <Tag>لم يُسلَّم</Tag> },
        { title: 'الكمية المورّدة', dataIndex: 'deliveredLitres', render: x => x != null ? litres(x) : '—' },
        { title: 'الفاتورة', render: (_, x) => x.invoiceNo
          ? <Space orientation="vertical" size={0}><Space size={2}><Tag color="green">{x.invoiceNo}</Tag>{invIdByNo[x.invoiceNo] && <Tooltip title="طباعة الفاتورة / PDF"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={e => { e.stopPropagation(); printInvoice(openPrintWindow(), invIdByNo[x.invoiceNo]); }} /></Tooltip>}</Space><Text style={{ fontSize: 12 }}>{money(x.invoicedAmount)}</Text></Space>
          : x.readyToInvoice ? <Tag color="orange">جاهزة{x.estimatedAmount != null ? ` · ${money(x.estimatedAmount)}` : ''}</Tag>
          : x.missingContract ? <Tag color="red">لا يوجد عقد</Tag> : '—' },
        { title: '', render: (_, x) => x.readyToInvoice && canInvoice
          ? <Button size="small" type="primary" icon={<FileDoneOutlined />} style={{ background: PRIMARY }} disabled={x.missingContract}
              onClick={e => { e.stopPropagation(); setInvoiceRow(x); }}>إصدار فاتورة</Button> : null },
      ]} />
  );

  const siteTab = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}><MiniKpi title="مستوى الخزان" value={pct != null ? `${pct}%` : '—'} color={pct != null && pct < 25 ? '#ff4d4f' : PRIMARY} bg="#e8f5e9" icon={<DatabaseOutlined />}
          sub={tanks.length ? `${tanks.length} خزان · ${litres(lvl)} من ${litres(cap)}` : 'لا يوجد خزان'} onClick={() => setActiveTab('tanks')} /></Col>
        <Col xs={24} sm={12} lg={6}><MiniKpi title="سعر اللتر (العقد النشط)" value={active ? `${Number(active.pricePerLitre).toLocaleString()} د.إ` : '—'} color="#13c2c2" bg="#e6fffb" icon={<FileProtectOutlined />}
          sub={active ? `${active.contractNo} · حتى ${d10(active.endDate)}` : <Text type="danger" style={{ fontSize: 11 }}>لا يوجد عقد نشط</Text>} onClick={() => setActiveTab('contracts')} /></Col>
        <Col xs={24} sm={12} lg={6}><MiniKpi title="تعبئات جاهزة للفوترة" value={ready.length} color="#fa8c16" bg="#fff7e6" icon={<FireOutlined />}
          sub={ready.length ? litres(ready.reduce((n, x) => n + Number(x.deliveredLitres ?? 0), 0)) : 'لا شيء بانتظار الفاتورة'} /></Col>
        <Col xs={24} sm={12} lg={6}><MiniKpi title="إجمالي المفوتر" value={money(invoiced)} color="#722ed1" bg="#f9f0ff" icon={<DollarOutlined />}
          sub={`${refills.filter(x => x.invoiceNo).length} فاتورة تعبئة`} onClick={() => setActiveTab('financials')} /></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card style={cardStyle} title={<Space><ShopOutlined style={{ color: PRIMARY }} /><Text strong>بيانات المطعم</Text><Tag color="volcano">{s.code}</Tag></Space>}
            extra={canManage && <Button size="small" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>تعديل</Button>}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" styles={{ label: { color: '#888' } }}>
              <Descriptions.Item label="الاسم">{s.name}</Descriptions.Item>
              <Descriptions.Item label="الاسم التجاري">{r.tradeName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="المبنى">{s.building ? `${s.building.code} — ${s.building.name}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="الوحدة">{s.unit?.unitNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الرخصة التجارية">{r.tradeLicenseNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="انتهاء الرخصة">{r.tradeLicenseExpiry ? <Tag color={licenceExpired ? 'red' : 'default'}>{d10(r.tradeLicenseExpiry)}</Tag> : '—'}</Descriptions.Item>
              <Descriptions.Item label="الفرع">{s.branch ?? '—'}</Descriptions.Item>
              {s.notes && <Descriptions.Item label="ملاحظات" span={2}>{s.notes}</Descriptions.Item>}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card style={{ ...cardStyle, height: '100%' }} title={<Space><UserOutlined style={{ color: PRIMARY }} /><Text strong>مالك المطعم (العميل)</Text></Space>}>
            {s.owner ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#fff2e8', color: '#d4380d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
                  {(s.owner.name ?? '?').slice(0, 1)}
                </div>
                <div style={{ lineHeight: 1.9 }}>
                  <Text strong style={{ fontSize: 15 }}>{s.owner.name}</Text> {s.owner.isCustomer && <Tag color="blue">عميل</Tag>}
                  <div style={{ fontSize: 12, color: '#888' }}>{[s.owner.partyCode, s.owner.tradeLicenseNo, s.owner.trn && `TRN ${s.owner.trn}`].filter(Boolean).join(' · ')}</div>
                  {s.owner.phone && <div dir="ltr" style={{ textAlign: 'start', fontSize: 13 }}><PhoneOutlined /> {s.owner.phone}</div>}
                  {s.owner.email && <div style={{ fontSize: 12, color: '#666' }}>{s.owner.email}</div>}
                </div>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا يوجد مالك" />}
            <div style={{ marginTop: 14, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
              <Text type="secondary" style={{ fontSize: 12 }}><SafetyCertificateOutlined /> المخولون بالتوقيع: </Text>
              {signers.length ? signers.map((x: any) => <Tag key={x.id} color="green">{x.name}{x.position ? ` — ${x.position}` : ''}</Tag>)
                : <Tag color="red" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('signatories')}>لا يوجد — أضف من طاقم المطعم</Tag>}
            </div>
          </Card>
        </Col>
        <Col xs={24}>
          <Card style={cardStyle} title={<Space><FileProtectOutlined style={{ color: PRIMARY }} /><Text strong>عقد توريد الغاز (سعر اللتر)</Text></Space>} extra={newContractBtn}>{contractsTable}</Card>
          <div style={{ marginTop: 16 }}>{amcCard}</div>
        </Col>
        <Col xs={24}>
          <Card style={cardStyle} title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><Text strong>التعبئات والفواتير</Text>{ready.length > 0 && <Tag color="orange">{ready.length} جاهزة للفوترة</Tag>}</Space>}
            extra={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('refill')}>طلبات التعبئة</Button>}>
            {refillsInvoicesTable}
            {tanks.length > 0 && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
                {tanks.map(t => (
                  <div key={t.id} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => setActiveTab('tanks')}>
                    <Text style={{ fontSize: 12 }}><DatabaseOutlined /> {t.tankNo} — {litres(t.currentLevel)} / {litres(t.capacityLitres)}</Text>
                    <Progress percent={Number(t.levelPct ?? 0)} size="small" status={Number(t.levelPct) < 25 ? 'exception' : 'normal'} strokeColor={Number(t.levelPct) < 25 ? undefined : PRIMARY} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );

  const financialsTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}><MiniKpi title="إجمالي المفوتر" value={money(invoices.reduce((n, x) => n + Number(x.amount ?? x.total ?? x.totalAmount ?? 0), 0))} color={PRIMARY} bg="#e8f5e9" icon={<DollarOutlined />} sub={`${invoices.length} فاتورة`} /></Col>
      <Col xs={24} md={8}><MiniKpi title="المحصّل" value={money(invoices.reduce((n, x) => n + Number(x.paid ?? 0), 0))} color="#52c41a" bg="#f6ffed" icon={<CheckCircleOutlined />} /></Col>
      <Col xs={24} md={8}><MiniKpi title="المستحق" value={money(invoices.reduce((n, x) => n + Number(x.balance ?? x.outstanding ?? 0), 0))} color="#fa8c16" bg="#fff7e6" icon={<ClockCircleOutlined />} /></Col>
      <Col xs={24}>
        <Card style={cardStyle} title={<Text strong><FileTextOutlined /> فواتير المطعم</Text>}
          extra={<Space size={6}>
            {invoices.some((x: any) => Number(x.balance ?? 0) > 0) && <Button size="small" icon={<DollarOutlined />} style={{ borderColor: '#52c41a', color: '#389e0d' }} onClick={() => setPayFor({})}>تسجيل دفعة</Button>}
            <Button size="small" onClick={() => navigate('/invoices')}>مركز الفواتير</Button></Space>}>
          <Table<any> rowKey="id" size="small" dataSource={invoices} pagination={{ pageSize: 10, size: 'small' }} locale={{ emptyText: <Empty description="لا توجد فواتير بعد" /> }}
            columns={[
              { title: 'الفاتورة', render: (_, x) => <Text code>{x.no ?? x.invoiceNo}</Text> },
              { title: 'التاريخ', render: (_, x) => d10(x.date ?? x.issueDate) },
              { title: 'الاستحقاق', dataIndex: 'dueDate', render: d10 },
              { title: 'العقد', dataIndex: 'contractNo', render: x => x ?? '—' },
              { title: 'قبل الضريبة', dataIndex: 'subtotal', render: x => money(x) },
              { title: 'الضريبة', dataIndex: 'vat', render: (x, row) => money(x ?? row.vatAmount) },
              { title: 'الإجمالي', render: (_, x) => <Text strong>{money(x.amount ?? x.total ?? x.totalAmount)}</Text> },
              { title: 'الحالة', dataIndex: 'status', render: x => <Tag color={INV_STATUS[x]?.color}>{INV_STATUS[x]?.label ?? x}</Tag> },
              { title: 'المدفوع', dataIndex: 'paid', render: x => <Text style={{ color: '#389e0d' }}>{money(x)}</Text> },
              { title: 'الرصيد', dataIndex: 'balance', render: x => <Text strong style={{ color: Number(x) > 0 ? '#d4380d' : '#52c41a' }}>{money(x)}</Text> },
              { title: '', key: 'print', width: 150, render: (_, x) => <Space size={4}>
                {Number(x.balance ?? 0) > 0 && x.status !== 'cancelled' && <Button size="small" icon={<DollarOutlined />} style={{ borderColor: '#52c41a', color: '#389e0d' }} onClick={() => setPayFor({ invoiceId: x.id })}>دفعة</Button>}
                <Tooltip title="طباعة الفاتورة / PDF"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => printInvoice(openPrintWindow(), x.id)} /></Tooltip></Space> },
            ]} />
        </Card>
      </Col>
    </Row>
  );

  const refillTab = (
    <Card style={cardStyle} title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><Text strong>طلبات تعبئة خزانات المطعم</Text>{openRequests.length > 0 && <Tag color="orange">{openRequests.length} نشطة</Tag>}</Space>}
      extra={canRefill && tanks.length > 0 && <Button type="primary" icon={<PlusOutlined />} style={{ background: '#fa8c16', borderColor: '#fa8c16' }} onClick={() => setNewRefillOpen(true)}>طلب تعبئة جديد</Button>}>
      <Table<RefillRequestItem> rowKey="id" size="small" dataSource={requests} pagination={{ pageSize: 10, size: 'small' }}
        locale={{ emptyText: <Empty description="لا توجد طلبات تعبئة" /> }}
        onRow={x => ({ onClick: () => openRefill(x.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'الطلب', dataIndex: 'requestNo', render: x => <Text code>{x}</Text> },
          { title: 'الخزان', dataIndex: 'tankLabel' },
          { title: 'التاريخ', dataIndex: 'requestDate' },
          { title: 'الكمية المطلوبة', dataIndex: 'requestedQty', render: x => litres(x) },
          { title: 'المرحلة', dataIndex: 'stage', render: (x, row) => row.status === 'cancelled' ? <Tag>ملغي</Tag>
            : <Space><Progress type="circle" size={26} percent={Math.round((x / 8) * 100)} showInfo={false} strokeColor={PRIMARY} /><span>{REFILL_STAGE[x] ?? x}</span></Space> },
          { title: 'الكمية المسلّمة', dataIndex: 'deliveredQty', render: x => x != null ? litres(x) : '—' },
          { title: 'الفاتورة', key: 'inv', render: (_, row) => { const f = refills.find(x => String(x.refillRequestId) === row.id);
            return f?.invoiceNo ? <Tag color="green">{f.invoiceNo}</Tag> : f?.readyToInvoice ? <Tag color="orange">جاهزة</Tag> : '—'; } },
        ]} />
    </Card>
  );

  const signatoriesTab = (
    <Card style={cardStyle} title={<Space><TeamOutlined style={{ color: PRIMARY }} /><Text strong>المخولون بالتوقيع (من طاقم المطعم)</Text></Space>}
      extra={canManage && <Button size="small" type="primary" style={{ background: PRIMARY }} icon={<PlusOutlined />} onClick={() => { setEditSig(null); setSigOpen(true); }}>إضافة شخص</Button>}>
      <Table<any> rowKey="id" size="small" dataSource={s.signatories ?? []} pagination={false}
        locale={{ emptyText: <Empty description="لا يوجد مخولون — أضف من طاقم المطعم من يحق له توقيع العقود" /> }}
        columns={[
          { title: 'الاسم', dataIndex: 'name', render: (x, row) => <span style={{ opacity: row.isActive ? 1 : 0.5 }}>{x}</span> },
          { title: 'المنصب', dataIndex: 'position', render: x => x ?? '—' },
          { title: 'الهوية', dataIndex: 'emiratesId', render: x => <span dir="ltr">{x ?? '—'}</span> },
          { title: 'الهاتف', dataIndex: 'phone', render: x => <span dir="ltr">{x ?? '—'}</span> },
          { title: 'البريد', dataIndex: 'email', render: x => x ?? '—' },
          { title: 'التوقيع', render: (_, row) => row.canSignContracts && row.isActive ? <Tag color="green">مخول</Tag> : <Tag>غير مخول</Tag> },
          { title: '', render: (_, row) => canManage && <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditSig(row); setSigOpen(true); }} />
            <Popconfirm title="حذف؟ (إن وقّع عقداً يُلغى تخويله فقط)" okText="نعم" cancelText="لا"
              onConfirm={async () => { try { await premisesApi.removeSignatory(s.id, row.id); changed(); } catch (e) { message.error(errorMessage(e), 6); } }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space> },
        ]} />
    </Card>
  );

  const infoTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={14}>
        <Card style={cardStyle} title={<Space><BankOutlined style={{ color: PRIMARY }} /><Text strong>الموقع داخل المبنى</Text></Space>}
          extra={s.building && <Button size="small" icon={<BankOutlined />} onClick={() => onOpenBuilding?.(s.building.id)}>فتح المبنى</Button>}>
          <Descriptions column={{ xs: 1, sm: 2 }} size="small" styles={{ label: { color: '#888' } }}>
            <Descriptions.Item label="المبنى">{s.building ? `${s.building.code} — ${s.building.name}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="نوع المبنى">{s.building?.buildingTypeLabel ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="الوحدة">{s.unit?.unitNo ?? '—'}{s.unit?.floorNo != null ? ` (طابق ${s.unit.floorNo})` : ''}</Descriptions.Item>
            <Descriptions.Item label="المدينة">{s.building?.city ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="المنطقة">{s.building?.zone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="العنوان">{[s.building?.street, s.building?.address].filter(Boolean).join('، ') || '—'}</Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
            شهادة الدفاع المدني وعقد الصيانة على مستوى المبنى — من ملف المبنى. خزانات المطعم منفصلة عن خزانات المبنى.
          </Text>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card style={{ ...cardStyle, height: '100%' }} title={<Space><ClockCircleOutlined style={{ color: PRIMARY }} /><Text strong>السجل</Text></Space>}>
          <Space orientation="vertical">
            <Text type="secondary">كل التغييرات على المطعم وعقوده والمخولين ومن قام بها ومتى.</Text>
            <HistoryButton entityType="Restaurant" id={s.id} title={`${s.code} — ${s.name}`} size="middle" label="السجل الكامل للمطعم" />
            <Text type="secondary" style={{ fontSize: 12 }}>أُنشئ في {d10(s.createdAt)}</Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  const docsTab = (
    <Card style={cardStyle}>
      <Table<any> size="small" rowKey="id" dataSource={docs} pagination={false} locale={{ emptyText: <Empty description="لا توجد وثائق للمطعم (رخصة تجارية، عقد موقّع…)" /> }}
        columns={[
          { title: 'الوثيقة', dataIndex: 'fileName', render: (x, d) => <a onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType)}><FileTextOutlined /> {x}</a> },
          { title: 'النوع', dataIndex: 'typeLabel', width: 130 },
          { title: 'الحجم', dataIndex: 'sizeBytes', width: 90, render: x => kb(x) },
          { title: 'تاريخ الرفع', dataIndex: 'createdAt', width: 120, render: x => d10(x) },
          { title: 'الانتهاء', dataIndex: 'expiryDate', width: 120, render: x => !x ? '—' : <span style={{ color: dayjs(x).isBefore(dayjs()) ? '#ff4d4f' : undefined }}>{x}</span> },
          { title: '', width: 120, render: (_, d) => <Space size={2}>
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType)} />
            <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType, true)} />
            {can('documents.manage') && <Popconfirm title="حذف الوثيقة؟" okText="حذف" cancelText="إلغاء"
              onConfirm={async () => { try { await api(`/documents/${d.id}`, { method: 'DELETE' }); changed(); } catch (e) { message.error(errorMessage(e)); } }}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
          </Space> },
        ]} />
      {can('documents.manage') && <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 12 }}
        onClick={() => { docForm.resetFields(); docForm.setFieldsValue({ documentType: 'trade_license' }); setDocFiles([]); setDocOpen(true); }}>رفع وثيقة جديدة</Button>}
    </Card>
  );

  const tabs: Record<string, { label: React.ReactNode; children: React.ReactNode }> = {
    site: { label: <span><ShopOutlined /> المطعم والعقد</span>, children: siteTab },
    contracts: { label: <span><FileProtectOutlined /> العقود ({(s.contracts?.length ?? 0) + amcs.length})</span>,
      // same look as the building / villa contracts tab (switcher cards, AMC cards, gas contracts)
      children: <SiteContractsTab site={s} reloadKey={key} onChanged={changed} onNeedSignatory={() => setActiveTab('signatories')} /> },
    financials: { label: <span><DollarOutlined /> الفواتير والمالية ({invoices.length})</span>, children: financialsTab },
    tanks: { label: <span><DatabaseOutlined /> الخزانات ({tanks.length})</span>,
      children: <SiteTanksYard premisesId={s.id} siteName={s.name} tanks={tanks} openRequests={openReq} canManage={canManage} canRefill={canRefill}
        onChanged={changed} onRequestRefill={() => setNewRefillOpen(true)} /> },
    refill: { label: <span><FireOutlined style={{ color: '#fa8c16' }} /> طلبات التعبئة ({requests.length})</span>, children: refillTab },
    visits: { label: <span><CalendarOutlined /> زيارات الصيانة</span>,
      children: s.building ? <SiteVisitsTab kind="restaurant" premisesId={restaurantId} buildingId={s.building.id} reloadKey={key} /> : <Empty description="المطعم غير مرتبط بمبنى" /> },
    service: { label: <span><ToolOutlined /> طلبات الخدمة</span>,
      children: s.building ? <VillaServiceTab kind="restaurant" villaId={restaurantId} buildingId={s.building.id} reloadKey={key}
        onChanged={() => setKey(k => k + 1)} onOpenContracts={() => setActiveTab('contracts')} />
        : <Empty description="المطعم غير مرتبط بمبنى" /> },
    invoicing: { label: <span><FileDoneOutlined /> التعبئات والفواتير {ready.length > 0 && <Tag color="orange">{ready.length}</Tag>}</span>,
      children: <Card style={cardStyle}>{refillsInvoicesTable}</Card> },
    info: { label: <span><BankOutlined /> الموقع والسجل</span>, children: infoTab },
    signatories: { label: <span><TeamOutlined /> المخولون بالتوقيع ({s.signatories?.length ?? 0})</span>, children: signatoriesTab },
    docs: { label: <span><FileTextOutlined /> الوثائق ({docs.length})</span>, children: docsTab },
  };
  const counts: Record<string, number> = { contracts: (s.contracts?.length ?? 0) + amcs.length, financials: invoices.length, tanks: tanks.length, refill: requests.length, signatories: s.signatories?.length ?? 0, docs: docs.length };
  const groups = [
    { key: 'g-site', label: 'المطعم', icon: <ShopOutlined />, tabs: ['site'] },
    { key: 'g-finance', label: 'العقود والمالية', icon: <FileTextOutlined />, tabs: ['contracts', 'financials', 'invoicing'] },
    { key: 'g-ops', label: 'الخزان والخدمات', icon: <ToolOutlined />, tabs: ['tanks', 'refill', 'visits', 'service'] },
    { key: 'g-data', label: 'البيانات والوثائق', icon: <BankOutlined />, tabs: ['signatories', 'info', 'docs'] },
  ];
  const activeGroup = groups.find(g => g.tabs.includes(activeTab)) ?? groups[0];
  const groupCount = (g: typeof groups[number]) => g.tabs.reduce((n, k) => n + (counts[k] ?? 0), 0);

  return (
    <div style={{ padding: '0 0 24px' }}>
      {header}
      <style>{`
        .rp-nav { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 12px; }
        .rp-groups { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; }
        .rp-group { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; border: none; background: transparent;
          font-family: inherit; font-size: 13px; font-weight: 600; color: #444; cursor: pointer; transition: background .15s, color .15s; }
        .rp-group:hover { background: #f3f7f3; color: #1a5c2a; }
        .rp-group.on { background: linear-gradient(135deg, #1a5c2a, #0b2e18); color: #c9a84c; box-shadow: 0 2px 6px rgba(26,92,42,.3); }
        .rp-group .n { font-size: 11px; opacity: .7; }
        .rp-sub > .ant-tabs-nav { margin: 0 !important; padding: 0 20px; border-top: 1px solid #f0f0f0; }
        .rp-sub > .ant-tabs-nav::before { border-bottom: none !important; }
        .rp-sub .ant-tabs-tab { padding: 10px 2px; font-size: 13px; }
        .rp-sub .ant-tabs-tab-active .ant-tabs-tab-btn { font-weight: 700; }
      `}</style>
      <div className="rp-nav">
        <div className="rp-groups" role="tablist">
          {groups.map(g => {
            const n = groupCount(g);
            return (
              <button key={g.key} type="button" role="tab" aria-selected={g === activeGroup} className={`rp-group${g === activeGroup ? ' on' : ''}`}
                onClick={() => { if (g !== activeGroup) setActiveTab(g.tabs[0]); }}>
                {g.icon}{g.label}{n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
        </div>
        {activeGroup.tabs.length > 1 && (
          <Tabs className="rp-sub" activeKey={activeTab} onChange={setActiveTab} tabBarGutter={22}
            items={activeGroup.tabs.map(k => ({ key: k, label: tabs[k].label, children: null }))} />
        )}
      </div>
      <Spin spinning={loading}><div key={activeTab}>{tabs[activeTab]?.children ?? siteTab}</div></Spin>

      <RecordPaymentModal open={!!payFor} tenantId={s.owner?.id} invoiceId={payFor?.invoiceId} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); changed(); }} />
      <PremisesAmcModal site={s} open={amcOpen} onClose={() => setAmcOpen(false)} onSaved={() => { setAmcOpen(false); changed(); }} />
      <PremisesFormModal type="restaurant" open={editOpen} editing={s} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); changed(); }} />
      <ContractModal site={s} contract={editContract} open={contractOpen} onClose={() => setContractOpen(false)} onSaved={() => { setContractOpen(false); changed(); }} />
      <SignatoryModal siteId={s.id} signatory={editSig} open={sigOpen} onClose={() => setSigOpen(false)} onSaved={() => { setSigOpen(false); changed(); }} />
      <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); changed(); }} />
      <NewRefillRequestModal open={newRefillOpen} onClose={() => setNewRefillOpen(false)} onSave={() => undefined}
        onCreate={async v => {
          const res = await api<{ id: number }>('/refill-requests', { method: 'POST', body: v });
          setNewRefillOpen(false); changed(); await openRefill(res.id);
        }}
        tanks={tanks.map(t => ({ id: String(t.id), label: `${t.tankNo}${t.gasTypeName ? ` — ${t.gasTypeName}` : ''}`,
          currentLevel: Number(t.currentLevel ?? 0), capacity: Number(t.capacityLitres ?? 0), levelPct: Math.round(Number(t.levelPct ?? 0)), unit: 'لتر' }))} />
      <RefillRequestDrawer open={!!refill} request={refill} live onClose={() => { setRefill(null); changed(); }} onUpdate={u => setRefill(u)} />
      <Modal open={docOpen} title="رفع وثيقة للمطعم" okText="رفع" cancelText="إلغاء" onOk={uploadDocs} confirmLoading={docSaving} onCancel={() => setDocOpen(false)} destroyOnHidden>
        <Form form={docForm} layout="vertical">
          <Form.Item name="documentType" label="نوع الوثيقة" rules={[{ required: true }]}><Select options={DOC_TYPES} /></Form.Item>
          <Form.Item name="expiryDate" label="تاريخ الانتهاء (إن وجد)"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Upload multiple fileList={docFiles} beforeUpload={() => false} onChange={({ fileList }) => setDocFiles(fileList)} maxCount={10}>
            <Button icon={<UploadOutlined />}>اختر الملفات</Button>
          </Upload>
        </Form>
      </Modal>
    </div>
  );
}
