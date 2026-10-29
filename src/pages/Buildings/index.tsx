import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BuildingProfile from './BuildingProfile';
import {
  Row, Col, Card, Table, Button, Tag, Input, Select, Space, InputNumber,
  Modal, Form, Typography, Statistic, Divider, Tooltip, Badge, Steps, Result, Upload, Alert, message, Segmented
} from 'antd';
import {
  BankOutlined, PlusOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined, PauseCircleOutlined, PlayCircleOutlined,
  EnvironmentOutlined, HomeOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  NumberOutlined, ApartmentOutlined, FileTextOutlined, ShopOutlined, UserOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, SafetyCertificateOutlined, UploadOutlined, BuildOutlined, StarFilled, StarOutlined, DatabaseOutlined
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import { useTranslation } from 'react-i18next';
import { buildingsApi, uploadDocument } from '../../api/buildings';
import type { BuildingInput, BuildingKpis, BuildingListItem, OwnerInput, TankInput, UnitInput } from '../../api/buildings';
import { useReference, locName } from '../../api/reference';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import EditBuildingModal from './EditBuildingModal';
import { useGlobalFilters } from '../../context/GlobalFilters';
import { useSearchParams } from 'react-router-dom';
import { premisesApi } from '../../api/premises';

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY = '#1a5c2a';
const PRIMARY_LIGHT = '#e8f5e9';

const barOptions = (categories: string[]): any => ({
  chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
  colors: [PRIMARY],
  plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
  dataLabels: { enabled: false },
  xaxis: { categories, labels: { style: { fontSize: '12px' } } },
  grid: { borderColor: '#f5f5f5', strokeDashArray: 4 },
  tooltip: { y: { formatter: (v: number) => `${v} مبنى` } },
  noData: { text: 'لا توجد بيانات' },
});

const pieOptions: any = {
  chart: { type: 'donut', fontFamily: 'inherit' },
  colors: [PRIMARY, '#ff4d4f'],
  labels: ['مشغولة', 'شاغرة'],
  legend: { position: 'bottom', fontSize: '13px' },
  plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'المشغولة', color: PRIMARY, fontSize: '14px', fontWeight: 700, formatter: (w: any) => String(w.globals.seriesTotals[0] ?? 0) } } } } },
  dataLabels: { enabled: false },
  stroke: { width: 0 },
};

const STEPS = [
  { title: 'معلومات المبنى', icon: <BankOutlined /> },
  { title: 'معلومات المالك', icon: <UserOutlined /> },
  { title: 'معلومات الخزانات', icon: <DatabaseOutlined /> },
  { title: 'الوحدات والحالة', icon: <ApartmentOutlined /> },
  { title: 'العنوان والملاحظات', icon: <FileTextOutlined /> },
];

// ── helpers: wizard form values → API payload ───────────────────────────────

/** antd Upload inside Form.Item: keep the fileList as the field value. */
const normFile = (e: any) => (Array.isArray(e) ? e : e?.fileList);
const firstFile = (list: any): File | undefined => (Array.isArray(list) && list[0]?.originFileObj) || undefined;

const clean = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  return s ? s : undefined;
};
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const parseFloor = (v: unknown): number | undefined => {
  if (v === 'أرضي' || v === 'G' || v === 'g') return 0;
  const m = String(v ?? '').match(/^\s*(?:بدروم\s*)?(-?\d+)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return String(v).includes('بدروم') ? -Math.abs(n) : n;
};
/** "24.4539° N, 54.3773° E" or "24.4539, 54.3773" → { latitude, longitude } */
const parseCoordinates = (v: unknown): { latitude?: number; longitude?: number } => {
  const s = String(v ?? '').trim();
  if (!s) return {};
  const parts = s.split(/[,،]/).map(p => p.trim());
  if (parts.length !== 2) return {};
  const one = (p: string) => {
    const m = p.match(/(-?\d+(?:\.\d+)?)/);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    return /[SW]/i.test(p) ? -Math.abs(n) : n;
  };
  const latitude = one(parts[0]); const longitude = one(parts[1]);
  if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return {};
  return { latitude, longitude };
};
/** Put the chosen default value first. */
const defaultFirst = (list: unknown, idx: number | undefined): string[] => {
  const arr = (Array.isArray(list) ? list : []).map(clean).filter((x): x is string => !!x);
  const i = idx ?? 0;
  if (i > 0 && i < arr.length) { const [d] = arr.splice(i, 1); arr.unshift(d); }
  return arr;
};

const Buildings: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const { data: ref, error: refError } = useReference(i18n.language);

  // ── list state ──
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  // header toolbar: branch / building type / search apply to this list
  const global = useGlobalFilters();
  const [typeFilter, setTypeFilter] = useState<string | undefined>(global.buildingType);
  useEffect(() => { setBranchFilter(global.branchId); setPage(1); }, [global.branchId]);
  useEffect(() => { setTypeFilter(global.buildingType); setPage(1); }, [global.buildingType]);
  // Restaurants & Villas: optional filter (undefined = everything, as before) + villa / restaurant tags per row
  const [kindFilter, setKindFilter] = useState<string | undefined>();
  const [siteMap, setSiteMap] = useState<Record<number, { villaId?: number | null; restaurants: number }>>({});
  useEffect(() => { if (global.searchNonce) { setSearchInput(global.search); setSearch(global.search); setPage(1); } }, [global.searchNonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<BuildingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [kpiData, setKpiData] = useState<BuildingKpis | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  // ── wizard state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: number; code: string; warnings: string[] } | null>(null);
  const [primaryOwnerIdx, setPrimaryOwnerIdx] = useState(0);
  const [defaultPhones, setDefaultPhones] = useState<Record<number, number>>({ 0: 0 });
  const [defaultEmails, setDefaultEmails] = useState<Record<number, number>>({ 0: 0 });

  // Quick unit generator state
  const [genFloors, setGenFloors] = useState(1);
  const [genStartFloor, setGenStartFloor] = useState(1);
  const [genUnitsPerFloor, setGenUnitsPerFloor] = useState(1);
  const [genNaming, setGenNaming] = useState<'floor_unit' | 'floor_letter' | 'sequential' | 'floor_dash'>('floor_unit');
  const [genUnitType, setGenUnitType] = useState('residential');
  const [viewModal, setViewModal] = useState<BuildingListItem | null>(null);
  /** building whose details form is open */
  const [editId, setEditId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'units' | 'overview' | 'contracts'>('units');
  const openProfile = (r: BuildingListItem, tab: 'units' | 'overview' | 'contracts') => { setViewModal(r); setProfileTab(tab); setShowProfile(true); window.scrollTo({ top: 0 }); };
  const [form] = Form.useForm();

  // ── reference lists ──
  const lk = (type: string) => ref?.lookups?.[type] ?? [];
  const buildingTypes = lk('BUILDING_TYPE');
  const buildingStatuses = lk('BUILDING_STATUS');
  const unitTypes = lk('UNIT_TYPE');
  const unitStatuses = lk('UNIT_STATUS');
  const tankStatuses = lk('TANK_STATUS');
  const citiesOf = (emirateId?: number) => (ref?.cities ?? []).filter(c => !emirateId || c.emirateId === emirateId);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // load the table
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    buildingsApi.list({ page, pageSize, search: search || undefined, branchId: branchFilter, status: statusFilter, type: typeFilter, kind: kindFilter }, ctrl.signal)
      .then(res => { setRows(res.items); setTotal(res.total); setListError(null); })
      .catch(e => { if (e?.name !== 'AbortError') setListError(errorMessage(e)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [page, pageSize, search, branchFilter, statusFilter, typeFilter, kindFilter, reloadKey, i18n.language]);
  useEffect(() => {
    premisesApi.byBuilding().then(r => setSiteMap(Object.fromEntries(r.map(x => [x.buildingId, x])))).catch(() => setSiteMap({}));
  }, [reloadKey]);

  // load KPIs + charts
  useEffect(() => {
    const ctrl = new AbortController();
    buildingsApi.kpis(branchFilter, ctrl.signal)
      .then(setKpiData)
      .catch(e => { if (e?.name !== 'AbortError') setKpiData(null); });
    return () => ctrl.abort();
  }, [branchFilter, reloadKey, i18n.language]);

  const kpis = useMemo(() => {
    const k = kpiData;
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    return [
      { title: 'إجمالي المباني', value: k?.total ?? 0, sub: k ? `${k.newThisMonth} جديد هذا الشهر` : '—', icon: <BankOutlined />, color: PRIMARY, bg: PRIMARY_LIGHT },
      { title: 'مباني نشطة', value: k?.active ?? 0, sub: k ? `${pct(k.active, k.total)}% من الإجمالي` : '—', icon: <CheckCircleOutlined />, color: '#1565c0', bg: '#e3f2fd' },
      { title: 'إجمالي الوحدات', value: k?.totalUnits ?? 0, sub: k ? `نسبة الإشغال ${k.occupancyRate}%` : '—', icon: <HomeOutlined />, color: '#6a1b9a', bg: '#f3e5f5' },
      { title: 'وحدات شاغرة', value: k?.vacantUnits ?? 0, sub: k ? `${pct(k.vacantUnits, k.totalUnits)}% من الإجمالي` : '—', icon: <ExclamationCircleOutlined />, color: '#c62828', bg: '#ffebee' },
    ];
  }, [kpiData]);

  const openModal = () => {
    setCurrentStep(0);
    setDone(false);
    setCreated(null);
    setPrimaryOwnerIdx(0);
    setDefaultPhones({ 0: 0 });
    setDefaultEmails({ 0: 0 });
    form.resetFields();
    form.setFieldsValue({ owners: [{ ownerType: 'individual', phones: [''], emails: [''] }] });
    setModalOpen(true);
  };
  // «إضافة سريع ← مبنى جديد» opens the wizard (/buildings?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') { openModal(); searchParams.delete('new'); setSearchParams(searchParams, { replace: true }); }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeModal = () => { setModalOpen(false); setDone(false); setCreated(null); setPrimaryOwnerIdx(0); setDefaultPhones({ 0: 0 }); setDefaultEmails({ 0: 0 }); form.resetFields(); };

  const confirmCancel = () => {
    if (saving) return;
    Modal.confirm({
      title: 'إلغاء إضافة المبنى؟',
      content: 'سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟',
      okText: 'نعم، إلغاء',
      cancelText: 'لا، متابعة',
      okType: 'danger',
      centered: true,
      onOk: closeModal,
    });
  };

  const nextStep = () => {
    if (currentStep === 0) {
      form.validateFields(['name', 'nameEn', 'branch', 'type']).then(() => setCurrentStep(s => s + 1));
    } else if (currentStep === 1) {
      form.validateFields().then(() => setCurrentStep(s => s + 1));
    } else if (currentStep === 2) {
      form.validateFields().then(() => setCurrentStep(s => s + 1));
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const prevStep = () => setCurrentStep(s => s - 1);

  const generateUnits = () => {
    const units: { unitNo: string; floor: number | string; type: string; area: string; status: string }[] = [];
    let seq = 1;
    for (let f = genStartFloor; f < genStartFloor + genFloors; f++) {
      for (let u = 1; u <= genUnitsPerFloor; u++) {
        let unitNo = '';
        if (genNaming === 'floor_unit') {
          unitNo = `${f}${u.toString().padStart(2, '0')}`;
        } else if (genNaming === 'floor_letter') {
          unitNo = `${f}${String.fromCharCode(64 + u)}`;
        } else if (genNaming === 'floor_dash') {
          unitNo = `${f}-${u}`;
        } else {
          unitNo = `${seq}`;
        }
        units.push({ unitNo, floor: f === 0 ? 'أرضي' : f, type: genUnitType, area: '', status: 'vacant' });
        seq++;
      }
    }
    form.setFieldsValue({ unitsList: units });
    if (!form.getFieldValue('totalFloors')) form.setFieldsValue({ totalFloors: genFloors });
  };

  /** Wizard values → POST /buildings body. */
  const toPayload = (v: any): BuildingInput => {
    const owners: OwnerInput[] = (v.owners ?? []).map((o: any, i: number) => {
      const isCompany = o.ownerType === 'company';
      const phones = defaultFirst(o.phones, defaultPhones[i]);
      const emails = defaultFirst(o.emails, defaultEmails[i]);
      return {
        isPrimary: i === primaryOwnerIdx,
        party: {
          partyType: isCompany ? 'company' : 'individual',
          // a company owner is registered under the company name
          nameAr: clean(isCompany ? o.companyName ?? o.ownerName : o.ownerName),
          nameEn: clean(isCompany ? o.companyNameEn ?? o.ownerNameEn : o.ownerNameEn),
          emiratesId: clean(o.emiratesId),
          tradeLicenseNo: isCompany ? clean(o.tradeLicenseNo) : undefined,
          taxNumber: isCompany ? clean(o.taxNo) : undefined,
          cityId: isCompany ? o.companyCity ?? o.ownerCity : o.ownerCity,
          poBox: isCompany ? clean(o.companyPO) : undefined,
          address: isCompany ? clean(o.companyAddress) : undefined,
          bankName: clean(o.bankName),
          iban: clean(o.bankIban),
          phones,
          emails,
        },
      };
    });
    const tanks: TankInput[] = (v.tanks ?? []).map((t: any) => ({
      tankNo: clean(t.tankNo),
      gasType: t.gasType,
      capacityLitres: Number(t.capacity),
      currentLevelLitres: num(t.currentLevel),
      serialNo: clean(t.serialNo),
      manufacturer: clean(t.manufacturer),
      installDate: clean(t.installDate),
      lastInspectionDate: clean(t.lastInspection),
      nextInspectionDate: clean(t.nextInspection),
      status: t.status,
    }));
    const units: UnitInput[] = (v.unitsList ?? [])
      .filter((u: any) => clean(u.unitNo))
      .map((u: any) => ({ no: clean(u.unitNo), floor: parseFloor(u.floor), type: u.type, area: num(u.area), status: u.status }));
    return {
      branchId: v.branch,
      nameAr: clean(v.name),
      nameEn: clean(v.nameEn),
      buildingType: v.type,
      status: v.status ?? 'active',
      cityId: v.city,
      zone: clean(v.zone),
      street: clean(v.street),
      poBox: clean(v.poBox),
      address: clean(v.address),
      ...parseCoordinates(v.coordinates),
      totalFloors: num(v.totalFloors),
      notes: clean(v.notes),
      owners,
      tanks,
      units,
    };
  };

  /** Upload the owners' attachments once the building (and its parties) exist. Returns warnings. */
  const uploadOwnerFiles = async (buildingId: number, branchId: number | undefined, v: any): Promise<string[]> => {
    const owners: any[] = v.owners ?? [];
    const jobs = owners.flatMap((o, i) => [
      { i, file: firstFile(o.emiratesIdFile), type: 'emirates_id', label: 'الهوية' },
      { i, file: firstFile(o.tradeLicenseFile), type: 'trade_license', label: 'الرخصة التجارية' },
      { i, file: firstFile(o.taxFile), type: 'certificate', label: 'شهادة الضريبة' },
    ]).filter(j => j.file);
    if (!jobs.length) return [];
    const warnings: string[] = [];
    try {
      const b = await buildingsApi.get(buildingId);
      // owners are created in the order sent → ascending owner id
      const byOrder = [...b.owners].sort((a, c) => a.id - c.id);
      for (const j of jobs) {
        const partyId = byOrder[j.i]?.partyId;
        if (!partyId) { warnings.push(`لم يتم رفع ${j.label} للمالك ${j.i + 1}`); continue; }
        try {
          await uploadDocument({ file: j.file!, entityType: 'party', entityId: partyId, documentType: j.type, branchId });
        } catch (e) {
          warnings.push(`فشل رفع ${j.label} للمالك ${j.i + 1}: ${errorMessage(e)}`);
        }
      }
    } catch (e) {
      warnings.push(`تم حفظ المبنى لكن تعذّر رفع المرفقات: ${errorMessage(e)}`);
    }
    return warnings;
  };

  const onFinish = async () => {
    try { await form.validateFields(); } catch { return; }
    const v = form.getFieldsValue(true);
    const payload = toPayload(v);
    setSaving(true);
    try {
      const res = await buildingsApi.create(payload);
      const warnings = await uploadOwnerFiles(res.id, payload.branchId, v);
      setCreated({ ...res, warnings });
      setDone(true);
      reload();
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  /** activate / deactivate (status «inactive» keeps the building and its history, just stops it) */
  const confirmStatus = (r: BuildingListItem, status: 'active' | 'inactive') => {
    Modal.confirm({
      title: status === 'inactive' ? `إيقاف المبنى ${r.code}؟` : `تفعيل المبنى ${r.code}؟`,
      content: status === 'inactive' ? 'يبقى المبنى ووحداته وسجلاته محفوظة، ويظهر كـ«غير نشط». يمكن تفعيله لاحقاً.' : 'سيعود المبنى إلى الحالة «نشط».',
      okText: status === 'inactive' ? 'إيقاف' : 'تفعيل', cancelText: 'إلغاء', centered: true,
      okButtonProps: status === 'inactive' ? { style: { background: '#d46b08', borderColor: '#d46b08' } } : { style: { background: PRIMARY, borderColor: PRIMARY } },
      onOk: async () => {
        try { await buildingsApi.setStatus(r.id, status); message.success(status === 'inactive' ? 'تم إيقاف المبنى' : 'تم تفعيل المبنى'); reload(); }
        catch (e) { message.error(errorMessage(e), 6); }
      },
    });
  };

  const confirmDelete = (r: BuildingListItem) => {
    Modal.confirm({
      title: `حذف المبنى ${r.code}؟`,
      content: `سيتم حذف "${r.name ?? ''}" من القائمة. لا يمكن حذف مبنى عليه عقود توريد نشطة.`,
      okText: 'حذف',
      cancelText: 'إلغاء',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          await buildingsApi.remove(r.id);
          message.success('تم حذف المبنى');
          if (rows.length === 1 && page > 1) setPage(p => p - 1); else reload();
        } catch (e) {
          message.error(errorMessage(e), 6);
        }
      },
    });
  };

  const statusTag = (code?: string) => {
    const lv = buildingStatuses.find(s => s.code === code);
    const label = lv?.label ?? (code === 'active' ? 'نشط' : code === 'inactive' ? 'غير نشط' : code ?? '—');
    return <Tag color={code === 'active' ? 'success' : 'default'} style={{ borderRadius: 20, fontWeight: 500 }}>{label}</Tag>;
  };

  const columns = [
    { title: 'رقم المبنى', dataIndex: 'code', key: 'code', width: 110, render: (v: string) => <Text strong style={{ color: PRIMARY, fontFamily: 'monospace' }}>{v}</Text> },
    {
      title: 'اسم المبنى', dataIndex: 'name', key: 'name',
      render: (v: string, r: BuildingListItem) => (
        <div>
          <a onClick={e => { e.stopPropagation(); openProfile(r, 'units'); }} style={{ fontWeight: 600, color: PRIMARY }}>{v}</a>
          {siteMap[r.id]?.villaId && <Tag color="purple" style={{ marginInlineStart: 6 }}><HomeOutlined /> فيلا</Tag>}
          {(siteMap[r.id]?.restaurants ?? 0) > 0 && <Tag color="volcano" style={{ marginInlineStart: 6 }}><ShopOutlined /> {siteMap[r.id].restaurants} مطعم</Tag>}
          {(r.city || r.primaryOwner) && <div style={{ fontSize: 11, color: '#999' }}>{[r.city, r.primaryOwner].filter(Boolean).join(' · ')}</div>}
        </div>
      ),
    },
    { title: 'الفرع', dataIndex: 'branch', key: 'branch', render: (v: string) => <Tag icon={<EnvironmentOutlined />} color="default">{v}</Tag> },
    { title: 'الوحدات', dataIndex: 'units', key: 'units', width: 90, align: 'center' as const },
    {
      title: 'مشغولة / شاغرة', key: 'occ', width: 140, align: 'center' as const,
      render: (_: any, r: BuildingListItem) => <Space size={4}><Text style={{ color: PRIMARY, fontWeight: 600 }}>{r.occupied}</Text><Text type="secondary">/</Text><Text style={{ color: '#c62828', fontWeight: 600 }}>{r.vacant}</Text></Space>
    },
    {
      title: 'الإشغال', key: 'rate', width: 90, align: 'center' as const,
      render: (_: any, r: BuildingListItem) => {
        if (!r.units) return <Text type="secondary">—</Text>;
        const pct = Math.round((r.occupied / r.units) * 100);
        return <Badge count={`${pct}%`} style={{ backgroundColor: pct >= 90 ? PRIMARY : pct >= 70 ? '#f59e0b' : '#ef4444', fontSize: 11 }} />;
      }
    },
    { title: 'الحالة', dataIndex: 'status', key: 'status', width: 100, render: (v: string) => statusTag(v) },
    {
      title: 'الإجراءات', key: 'actions', width: 170, align: 'center' as const,
      render: (_: any, r: BuildingListItem) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Tooltip title="مخطط الطوابق والوحدات">
            <Button size="small" icon={<ApartmentOutlined />} onClick={() => openProfile(r, 'units')}
              style={{ color: '#fff', background: PRIMARY, borderColor: PRIMARY, borderRadius: 6 }}>المخطط</Button>
          </Tooltip>
          <Tooltip title="عرض الملف الكامل"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => openProfile(r, 'overview')} style={{ color: PRIMARY }} /></Tooltip>
          {canManage && <Tooltip title="تعديل بيانات المبنى"><Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#1565c0' }} onClick={() => setEditId(r.id)} /></Tooltip>}
          {canManage && (r.status === 'inactive'
            ? <Tooltip title="تفعيل المبنى"><Button size="small" type="text" icon={<PlayCircleOutlined />} style={{ color: PRIMARY }} onClick={() => confirmStatus(r, 'active')} /></Tooltip>
            : <Tooltip title="إيقاف المبنى (دون حذف)"><Button size="small" type="text" icon={<PauseCircleOutlined />} style={{ color: '#d46b08' }} onClick={() => confirmStatus(r, 'inactive')} /></Tooltip>)}
          {canManage && <Tooltip title="حذف"><Button size="small" type="text" icon={<DeleteOutlined />} danger onClick={() => confirmDelete(r)} /></Tooltip>}
        </Space>
      )
    },
  ];

  if (showProfile) {
    return (
      <div style={{ padding: '20px 24px 32px', background: '#f7f8fa', minHeight: '100vh' }}>
        <BuildingProfile buildingId={viewModal?.id} initialTab={profileTab} onBack={() => { setShowProfile(false); setViewModal(null); reload(); }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', background: '#f7f8fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: PRIMARY }}>
            <BankOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1a1a2e' }}>المباني</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>إدارة وعرض جميع المباني عبر الفروع</Text>
          </div>
        </div>
        <Space>
          <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} size="large" style={{ borderRadius: 10, height: 42 }} onClick={reload} loading={loading} /></Tooltip>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} size="large"
              style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, height: 42, paddingInline: 20 }}
              onClick={openModal} disabled={!ref}>
              إضافة مبنى
            </Button>
          )}
        </Space>
      </div>

      {refError != null && (
        <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 10 }}
          message={`تعذّر تحميل القوائم المرجعية (الفروع، المدن، الأنواع): ${errorMessage(refError)}`} />
      )}

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { padding: '18px 20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>{k.title}</Text>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value.toLocaleString()}</div>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{k.sub}</Text>
                  </div>
                </div>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: k.color }}>{k.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={15}>
          <Card title={<Text strong style={{ fontSize: 14 }}>توزيع المباني حسب الفرع</Text>} style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { paddingTop: 8 } }}>
            <ReactApexChart key={(kpiData?.byBranch ?? []).map(b => b.branchId).join('-')}
              options={barOptions((kpiData?.byBranch ?? []).map(b => b.branch ?? ''))}
              series={[{ name: 'المباني', data: (kpiData?.byBranch ?? []).map(b => b.buildings) }]} type="bar" height={220} />
          </Card>
        </Col>
        <Col xs={24} md={9}>
          <Card title={<Text strong style={{ fontSize: 14 }}>نسبة إشغال الوحدات</Text>} style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', height: '100%' }} styles={{ body: { paddingTop: 8 } }}>
            {kpiData && kpiData.totalUnits > 0
              ? <ReactApexChart options={pieOptions} series={[kpiData.occupiedUnits, kpiData.vacantUnits]} type="donut" height={220} />
              : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">لا توجد وحدات بعد</Text></div>}
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 14, marginInlineEnd: 'auto' }}>قائمة المباني</Text>
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="بحث باسم المبنى أو الرقم..." style={{ width: 220, borderRadius: 8 }} value={searchInput} onChange={e => setSearchInput(e.target.value)} allowClear />
          <Select placeholder="الفرع" style={{ width: 150 }} allowClear value={branchFilter} onChange={v => { setBranchFilter(v); setPage(1); }}>
            {(ref?.branches ?? []).map(b => <Option key={b.id} value={b.id}>{locName(b, isAr)}</Option>)}
          </Select>
          <Select placeholder="الحالة" style={{ width: 120 }} allowClear value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}>
            {buildingStatuses.map(s => <Option key={s.code} value={s.code}>{s.label}</Option>)}
          </Select>
          <Segmented value={kindFilter ?? 'all'} onChange={v => { setKindFilter(v === 'all' ? undefined : String(v)); setPage(1); }}
            options={[{ value: 'all', label: 'الكل' }, { value: 'building', label: 'المباني' }, { value: 'villa', label: 'الفلل' }, { value: 'restaurant', label: 'فيها مطاعم' }]} />
        </div>
        {listError && <Alert type="error" showIcon style={{ margin: 16, borderRadius: 8 }} message={listError}
          action={<Button size="small" onClick={reload}>إعادة المحاولة</Button>} />}
        <Table<BuildingListItem> dataSource={rows} columns={columns} rowKey="id" loading={loading}
          onRow={r => ({ onClick: () => openProfile(r, 'units'), style: { cursor: 'pointer' } })}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `إجمالي ${t} مبنى`, size: 'small',
            onChange: (p, ps) => { if (ps !== pageSize) { setPageSize(ps); setPage(1); } else setPage(p); } }}
          size="middle" scroll={{ x: true }}
          locale={{ emptyText: search || branchFilter || statusFilter ? 'لا توجد نتائج مطابقة' : 'لا توجد مباني بعد — أضف أول مبنى' }} />
      </Card>

      {/* ── ADD BUILDING MODAL (Multi-step) ── */}
      <Modal
        open={modalOpen}
        onCancel={done ? closeModal : confirmCancel}
        maskClosable={false}
        footer={null}
        width={1100}
        centered
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY}, #0b2e18)`, padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>
              <BankOutlined />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>إضافة مبنى جديد</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {done ? 'تم الحفظ بنجاح' : `الخطوة ${currentStep + 1} من ${STEPS.length}`}
              </div>
            </div>
          </div>
          {!done && (
            <Steps
              current={currentStep}
              size="small"
              items={STEPS.map(s => ({ title: <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{s.title}</span>, icon: s.icon }))}
              style={{ '--ant-steps-icon-size': '28px' } as any}
            />
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '28px 32px', maxHeight: '65vh', overflowY: 'auto' }}>
          {done ? (
            <Result
              status="success"
              icon={<CheckCircleOutlined style={{ color: PRIMARY, fontSize: 56 }} />}
              title={<span style={{ color: PRIMARY, fontWeight: 700 }}>تم إضافة المبنى بنجاح!{created ? ` (${created.code})` : ''}</span>}
              subTitle={created?.warnings.length
                ? <Alert type="warning" showIcon style={{ textAlign: 'start', borderRadius: 8 }} message="ملاحظات" description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{created.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>} />
                : 'سيظهر المبنى الجديد في قائمة المباني'}
              extra={[
                <Button key="another" onClick={() => { setCurrentStep(0); setDone(false); setCreated(null); setPrimaryOwnerIdx(0); setDefaultPhones({ 0: 0 }); setDefaultEmails({ 0: 0 }); form.resetFields(); form.setFieldsValue({ owners: [{ ownerType: 'individual', phones: [''], emails: [''] }] }); }}>إضافة مبنى آخر</Button>,
                <Button key="close" type="primary" style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={closeModal}>إغلاق</Button>,
              ]}
            />
          ) : (
            <Form form={form} layout="vertical">
              {/* Step 1 */}
              {currentStep === 0 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أدخل المعلومات الأساسية للمبنى
                  </Text>
                  <Alert type="info" showIcon icon={<NumberOutlined />} style={{ marginBottom: 16, borderRadius: 8 }}
                    message="رقم المبنى يُولَّد تلقائياً عند الحفظ (مثال: B-007)" />
                  <Form.Item name="name" label="اسم المبنى (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم المبنى بالعربي' }]}>
                    <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="اسم المبنى بالعربي" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="nameEn" label="Building Name (English)" rules={[{ required: true, message: 'Please enter the building name in English' }]}>
                    <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="e.g. Al Amal Tower" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                  </Form.Item>
                  <Form.Item name="branch" label="الفرع" rules={[{ required: true, message: 'الرجاء اختيار الفرع' }]}>
                    <Select placeholder="اختر الفرع" size="large" style={{ borderRadius: 8 }}>
                      {(ref?.branches ?? []).map(b => <Option key={b.id} value={b.id}><EnvironmentOutlined style={{ marginInlineEnd: 6 }} />{locName(b, isAr)}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="type" label="نوع المبنى" rules={[{ required: true, message: 'الرجاء اختيار نوع المبنى' }]}>
                    <Select placeholder="اختر نوع المبنى" size="large" style={{ borderRadius: 8 }}>
                      {buildingTypes.filter(t => t.code !== 'villa').map(t => (
                        <Option key={t.code} value={t.code}>
                          {t.code === 'commercial' ? <ShopOutlined style={{ marginInlineEnd: 6 }} /> : t.code === 'mixed' ? <BuildOutlined style={{ marginInlineEnd: 6 }} /> : <HomeOutlined style={{ marginInlineEnd: 6 }} />}
                          {t.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              )}

              {/* Step 2 - Owner Info */}
              {currentStep === 1 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أدخل معلومات ملاك المبنى. يمكنك إضافة أكثر من مالك.
                  </Text>

                  <Form.List name="owners">
                    {(ownerFields, { add: addOwner, remove: removeOwner }) => (
                      <>
                        {ownerFields.map((ownerField, ownerIndex) => (
                          <Card
                            key={ownerField.key}
                            size="small"
                            style={{ marginBottom: 16, borderRadius: 12, border: '1.5px solid #e3f0ff', background: '#fafcff' }}
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Text strong style={{ color: '#1677ff' }}>
                                    <UserOutlined style={{ marginInlineEnd: 6 }} />
                                    {`المالك ${ownerIndex + 1}`}
                                  </Text>
                                  {primaryOwnerIdx === ownerIndex ? (
                                    <Tag icon={<StarFilled />} color="gold" style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                                      المالك المسؤول
                                    </Tag>
                                  ) : (
                                    <Tag
                                      style={{ margin: 0, borderRadius: 10, fontSize: 11, cursor: 'pointer', borderStyle: 'dashed' }}
                                      onClick={() => setPrimaryOwnerIdx(ownerIndex)}
                                    >
                                      تعيين كمسؤول
                                    </Tag>
                                  )}
                                </div>
                                {ownerFields.length > 1 && (
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                    onClick={() => {
                                      removeOwner(ownerField.name);
                                      if (primaryOwnerIdx === ownerIndex) setPrimaryOwnerIdx(0);
                                      else if (primaryOwnerIdx > ownerIndex) setPrimaryOwnerIdx(p => p - 1);
                                    }}
                                  >
                                    حذف
                                  </Button>
                                )}
                              </div>
                            }
                          >
                            {/* Owner Type */}
                            <Form.Item name={[ownerField.name, 'ownerType']} label="نوع المالك" initialValue="individual" rules={[{ required: true }]}>
                              <Select size="large" style={{ borderRadius: 8 }}>
                                <Option value="individual"><UserOutlined style={{ marginInlineEnd: 6 }} />فرد (شخصي)</Option>
                                <Option value="company"><BuildOutlined style={{ marginInlineEnd: 6 }} />شركة</Option>
                              </Select>
                            </Form.Item>

                            {/* Owner Names */}
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'ownerName']} label="اسم المالك (عربي)" rules={[{ required: true, message: 'الرجاء إدخال الاسم بالعربي' }]}>
                                  <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="الاسم الكامل بالعربي" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'ownerNameEn']} label="Owner Name (English)" rules={[{ required: true, message: 'Please enter name in English' }]}>
                                  <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="Full name in English" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Phones */}
                            <Form.Item label="أرقام الهاتف" required style={{ marginBottom: 8 }}>
                              <Form.List name={[ownerField.name, 'phones']}>
                                {(phoneFields, { add: addPhone, remove: removePhone }) => (
                                  <>
                                    {phoneFields.map((phoneField, phoneIndex) => (
                                      <div key={phoneField.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                        {phoneFields.length > 1 && ownerIndex === primaryOwnerIdx && (
                                          <Tooltip title={defaultPhones[ownerIndex] === phoneIndex ? 'الرقم الافتراضي' : 'تعيين كافتراضي'}>
                                            <Button
                                              type="text"
                                              size="small"
                                              icon={defaultPhones[ownerIndex] === phoneIndex
                                                ? <StarFilled style={{ color: '#faad14' }} />
                                                : <StarOutlined style={{ color: '#ccc' }} />}
                                              onClick={() => setDefaultPhones(prev => ({ ...prev, [ownerIndex]: phoneIndex }))}
                                            />
                                          </Tooltip>
                                        )}
                                        <Form.Item name={[phoneField.name]} noStyle rules={[{ required: phoneIndex === 0, message: 'الرجاء إدخال رقم الهاتف' }]}>
                                          <Input
                                            prefix={<PhoneOutlined style={{ color: '#bbb' }} />}
                                            placeholder="+971 50 000 0000"
                                            size="large"
                                            style={{ borderRadius: 8, direction: 'ltr', flex: 1,
                                              ...(defaultPhones[ownerIndex] === phoneIndex && phoneFields.length > 1 && ownerIndex === primaryOwnerIdx ? { borderColor: '#faad14', boxShadow: '0 0 0 2px rgba(250,173,20,0.15)' } : {})
                                            }}
                                          />
                                        </Form.Item>
                                        {phoneFields.length > 1 && (
                                          <Button size="large" icon={<DeleteOutlined />} danger type="text"
                                            onClick={() => {
                                              removePhone(phoneField.name);
                                              const cur = defaultPhones[ownerIndex] ?? 0;
                                              if (cur === phoneIndex) setDefaultPhones(prev => ({ ...prev, [ownerIndex]: 0 }));
                                              else if (cur > phoneIndex) setDefaultPhones(prev => ({ ...prev, [ownerIndex]: cur - 1 }));
                                            }}
                                          />
                                        )}
                                      </div>
                                    ))}
                                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addPhone('')} style={{ borderRadius: 8 }}>
                                      إضافة رقم هاتف
                                    </Button>
                                  </>
                                )}
                              </Form.List>
                            </Form.Item>

                            {/* Emails */}
                            <Form.Item label="البريد الإلكتروني" required style={{ marginBottom: 8 }}>
                              <Form.List name={[ownerField.name, 'emails']}>
                                {(emailFields, { add: addEmail, remove: removeEmail }) => (
                                  <>
                                    {emailFields.map((emailField, emailIndex) => (
                                      <div key={emailField.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                        {emailFields.length > 1 && ownerIndex === primaryOwnerIdx && (
                                          <Tooltip title={defaultEmails[ownerIndex] === emailIndex ? 'البريد الافتراضي' : 'تعيين كافتراضي'}>
                                            <Button
                                              type="text"
                                              size="small"
                                              icon={defaultEmails[ownerIndex] === emailIndex
                                                ? <StarFilled style={{ color: '#faad14' }} />
                                                : <StarOutlined style={{ color: '#ccc' }} />}
                                              onClick={() => setDefaultEmails(prev => ({ ...prev, [ownerIndex]: emailIndex }))}
                                            />
                                          </Tooltip>
                                        )}
                                        <Form.Item name={[emailField.name]} noStyle rules={[{ required: emailIndex === 0, type: 'email', message: 'الرجاء إدخال بريد إلكتروني صحيح' }]}>
                                          <Input
                                            prefix={<MailOutlined style={{ color: '#bbb' }} />}
                                            placeholder="example@email.com"
                                            size="large"
                                            style={{ borderRadius: 8, direction: 'ltr', flex: 1,
                                              ...(defaultEmails[ownerIndex] === emailIndex && emailFields.length > 1 && ownerIndex === primaryOwnerIdx ? { borderColor: '#faad14', boxShadow: '0 0 0 2px rgba(250,173,20,0.15)' } : {})
                                            }}
                                          />
                                        </Form.Item>
                                        {emailFields.length > 1 && (
                                          <Button size="large" icon={<DeleteOutlined />} danger type="text"
                                            onClick={() => {
                                              removeEmail(emailField.name);
                                              const cur = defaultEmails[ownerIndex] ?? 0;
                                              if (cur === emailIndex) setDefaultEmails(prev => ({ ...prev, [ownerIndex]: 0 }));
                                              else if (cur > emailIndex) setDefaultEmails(prev => ({ ...prev, [ownerIndex]: cur - 1 }));
                                            }}
                                          />
                                        )}
                                      </div>
                                    ))}
                                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addEmail('')} style={{ borderRadius: 8 }}>
                                      إضافة بريد إلكتروني
                                    </Button>
                                  </>
                                )}
                              </Form.List>
                            </Form.Item>

                            {/* Emirate */}
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'ownerEmirate']} label="الإمارة" rules={[{ required: true, message: 'الرجاء اختيار الإمارة' }]}>
                                  <Select placeholder="اختر الإمارة" size="large" style={{ borderRadius: 8 }}
                                    onChange={() => form.setFieldValue(['owners', ownerField.name, 'ownerCity'], undefined)}>
                                    {(ref?.emirates ?? []).map(e => (
                                      <Option key={e.id} value={e.id}><EnvironmentOutlined style={{ marginInlineEnd: 6 }} />{locName(e, isAr)}</Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.owners?.[ownerIndex]?.ownerEmirate !== cur.owners?.[ownerIndex]?.ownerEmirate}>
                                  {({ getFieldValue }) => (
                                    <Form.Item name={[ownerField.name, 'ownerCity']} label="المدينة">
                                      <Select placeholder="اختر المدينة" size="large" allowClear showSearch optionFilterProp="label" style={{ borderRadius: 8 }}
                                        options={citiesOf(getFieldValue(['owners', ownerIndex, 'ownerEmirate'])).map(c => ({ value: c.id, label: locName(c, isAr) }))} />
                                    </Form.Item>
                                  )}
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Emirates ID */}
                            <Divider titlePlacement="start" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>هوية الإمارات</Divider>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'emiratesId']} label="رقم هوية الإمارات" rules={[{ required: true, message: 'الرجاء إدخال رقم الهوية' }]}>
                                  <Input prefix={<IdcardOutlined style={{ color: '#bbb' }} />} placeholder="784-YYYY-XXXXXXX-X" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'emiratesIdFile']} label="صورة هوية الإمارات" valuePropName="fileList" getValueFromEvent={normFile}>
                                  <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                    <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع الهوية</Button>
                                  </Upload>
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Bank Info */}
                            <Divider titlePlacement="start" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>المعلومات البنكية</Divider>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'bankName']} label="اسم البنك">
                                  <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="مثال: بنك الإمارات دبي الوطني" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'bankIban']} label="رقم IBAN">
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="AE000000000000000000000" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Company fields — conditional */}
                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.owners?.[ownerIndex]?.ownerType !== cur.owners?.[ownerIndex]?.ownerType || prev.owners?.[ownerIndex]?.companyEmirate !== cur.owners?.[ownerIndex]?.companyEmirate}>
                              {({ getFieldValue }) => {
                                const ownerType = getFieldValue(['owners', ownerIndex, 'ownerType']);
                                return ownerType === 'company' ? (
                                  <>
                                    <Divider titlePlacement="start" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>معلومات الشركة</Divider>

                                    {/* Company Names */}
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'companyName']} label="اسم الشركة (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم الشركة بالعربي' }]}>
                                          <Input prefix={<BuildOutlined style={{ color: '#bbb' }} />} placeholder="الاسم الرسمي للشركة" size="large" style={{ borderRadius: 8 }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'companyNameEn']} label="Company Name (English)" rules={[{ required: true, message: 'Please enter company name in English' }]}>
                                          <Input prefix={<BuildOutlined style={{ color: '#bbb' }} />} placeholder="Official company name" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                    </Row>

                                    {/* Company Location */}
                                    <Row gutter={12}>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyEmirate']} label="الإمارة" rules={[{ required: true, message: 'الرجاء اختيار الإمارة' }]}>
                                          <Select placeholder="اختر الإمارة" size="large" style={{ borderRadius: 8 }}
                                            onChange={() => form.setFieldValue(['owners', ownerField.name, 'companyCity'], undefined)}>
                                            {(ref?.emirates ?? []).map(e => (
                                              <Option key={e.id} value={e.id}>{locName(e, isAr)}</Option>
                                            ))}
                                          </Select>
                                        </Form.Item>
                                      </Col>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyCity']} label="المدينة">
                                          <Select placeholder="المدينة" size="large" allowClear showSearch optionFilterProp="label" style={{ borderRadius: 8 }}
                                            options={citiesOf(getFieldValue(['owners', ownerIndex, 'companyEmirate'])).map(c => ({ value: c.id, label: locName(c, isAr) }))} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyPO']} label="صندوق البريد (P.O. Box)">
                                          <Input placeholder="12345" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                    <Form.Item name={[ownerField.name, 'companyAddress']} label="العنوان التفصيلي" rules={[{ required: true, message: 'الرجاء إدخال عنوان الشركة' }]}>
                                      <Input.TextArea rows={2} placeholder="رقم المبنى، الشارع، المنطقة..." style={{ borderRadius: 8 }} />
                                    </Form.Item>

                                    {/* Trade License & Tax */}
                                    <Divider titlePlacement="start" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>الوثائق القانونية</Divider>
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'tradeLicenseNo']} label="رقم الرخصة التجارية" rules={[{ required: true, message: 'الرجاء إدخال رقم الرخصة' }]}>
                                          <Input prefix={<SafetyCertificateOutlined style={{ color: '#bbb' }} />} placeholder="CN-XXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'tradeLicenseFile']} label="الرخصة التجارية (مرفق)" valuePropName="fileList" getValueFromEvent={normFile} rules={[{ required: true, message: 'الرجاء إرفاق الرخصة' }]}>
                                          <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                            <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع الرخصة</Button>
                                          </Upload>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'taxNo']} label="رقم التسجيل الضريبي (اختياري)">
                                          <Input prefix={<SafetyCertificateOutlined style={{ color: '#bbb' }} />} placeholder="TRN-XXXXXXXXXXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'taxFile']} label="شهادة الضريبة (اختياري)" valuePropName="fileList" getValueFromEvent={normFile}>
                                          <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                            <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع شهادة الضريبة</Button>
                                          </Upload>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  </>
                                ) : null;
                              }}
                            </Form.Item>
                          </Card>
                        ))}

                        {/* Add Owner Button */}
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => addOwner({ ownerType: 'individual', phones: [''], emails: [''] })}
                          style={{ borderRadius: 10, height: 44, fontSize: 14, borderColor: '#1677ff', color: '#1677ff' }}
                        >
                          إضافة مالك آخر
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>
              )}

                            {/* Step 3 - Units & Status */}
              {/* Step 3 - Tanks */}
              {currentStep === 2 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أضف الخزانات المثبتة في المبنى. يمكنك إضافة أكثر من خزان.
                  </Text>

                  <Form.List name="tanks">
                    {(tankFields, { add: addTank, remove: removeTank }) => (
                      <>
                        {tankFields.map((tankField, tankIndex) => (
                          <Card
                            key={tankField.key}
                            size="small"
                            style={{ marginBottom: 16, borderRadius: 12, border: '1.5px solid #e6f4ff', background: '#f0f7ff' }}
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong style={{ color: '#0958d9' }}>
                                  <DatabaseOutlined style={{ marginInlineEnd: 6 }} />
                                  {`الخزان ${tankIndex + 1}`}
                                </Text>
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTank(tankField.name)}>
                                  حذف
                                </Button>
                              </div>
                            }
                          >
                            <Row gutter={12}>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'tankNo']} label="رقم الخزان" rules={[{ required: true, message: 'الرجاء إدخال رقم الخزان' }]}>
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="T-001" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'gasType']} label="نوع الغاز" rules={[{ required: true, message: 'الرجاء اختيار نوع الغاز' }]}>
                                  <Select placeholder="اختر النوع" size="large" style={{ borderRadius: 8 }}>
                                    {(ref?.gasTypes ?? []).map(g => <Option key={g.code} value={g.code}>{g.code} — {locName(g, isAr)}</Option>)}
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'status']} label="الحالة" initialValue="ok">
                                  <Select size="large" style={{ borderRadius: 8 }}>
                                    {tankStatuses.map(st => (
                                      <Option key={st.code} value={st.code}>
                                        <Tag color={st.code === 'ok' ? 'success' : st.code === 'low' || st.code === 'maintenance' ? 'warning' : 'default'}>{st.label}</Tag>
                                      </Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={12}>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'capacity']} label="السعة (لتر)"
                                  rules={[{ required: true, message: 'الرجاء إدخال السعة' }, { validator: (_, v) => (v == null || v === '' || Number(v) > 0 ? Promise.resolve() : Promise.reject(new Error('السعة يجب أن تكون أكبر من صفر'))) }]}>
                                  <Input type="number" min={1} prefix={<DatabaseOutlined style={{ color: '#bbb' }} />} placeholder="5000" size="large" style={{ borderRadius: 8, direction: 'ltr' }} addonAfter="لتر" />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'serialNo']} label="الرقم التسلسلي">
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="SN-XXXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'installDate']} label="تاريخ التركيب">
                                  <Input type="date" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'manufacturer']} label="الشركة المصنعة">
                                  <Input placeholder="اسم الشركة المصنعة" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'lastInspection']} label="آخر فحص دوري">
                                  <Input type="date" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'currentLevel']} label="المستوى الحالي (لتر)" dependencies={[['tanks', tankField.name, 'capacity']]}
                                  rules={[({ getFieldValue }) => ({ validator: (_, v) => {
                                    if (v == null || v === '') return Promise.resolve();
                                    const cap = Number(getFieldValue(['tanks', tankField.name, 'capacity']));
                                    if (Number(v) < 0) return Promise.reject(new Error('لا يمكن أن يكون سالباً'));
                                    if (cap && Number(v) > cap) return Promise.reject(new Error('المستوى أكبر من السعة'));
                                    return Promise.resolve();
                                  } })]}>
                                  <Input type="number" min={0} placeholder="اختياري" size="large" style={{ borderRadius: 8, direction: 'ltr' }} addonAfter="لتر" />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'nextInspection']} label="الفحص الدوري القادم">
                                  <Input type="date" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Card>
                        ))}

                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => addTank({ status: 'ok' })}
                          style={{ borderRadius: 10, height: 44, fontSize: 14, borderColor: '#0958d9', color: '#0958d9' }}
                        >
                          إضافة خزان
                        </Button>

                        {tankFields.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
                            <DatabaseOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                            <Text type="secondary">لا توجد خزانات مضافة — انقر على الزر أعلاه لإضافة خزان</Text>
                          </div>
                        )}
                      </>
                    )}
                  </Form.List>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
                    أضف طوابق وشقق المبنى. استخدم التوليد السريع للمباني الكبيرة.
                  </Text>

                  {/* Building status + year row */}
                  <Row gutter={12} style={{ marginBottom: 8 }}>
                    <Col span={12}>
                      <Form.Item name="status" label="حالة المبنى" initialValue="active">
                        <Select size="large" style={{ borderRadius: 8 }}>
                          {buildingStatuses.map(st => <Option key={st.code} value={st.code}><Tag color={st.code === 'active' ? 'success' : 'default'}>{st.label}</Tag></Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="totalFloors" label="عدد الطوابق">
                        <InputNumber min={0} max={200} placeholder="مثال: 6" size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Quick Generator */}
                  <Card
                    size="small"
                    style={{ marginBottom: 16, background: '#f6ffed', border: '1.5px solid #b7eb8f', borderRadius: 12 }}
                    title={<Text strong style={{ color: '#389e0d', fontSize: 13 }}><HomeOutlined style={{ marginInlineEnd: 6 }} />توليد سريع للوحدات</Text>}
                  >
                    <Row gutter={10} align="bottom">
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>طابق البداية</div>
                        <InputNumber min={-5} max={100} value={genStartFloor} onChange={v => setGenStartFloor(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>عدد الطوابق</div>
                        <InputNumber min={1} max={100} value={genFloors} onChange={v => setGenFloors(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>وحدات / طابق</div>
                        <InputNumber min={1} max={50} value={genUnitsPerFloor} onChange={v => setGenUnitsPerFloor(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={5}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>نمط الترقيم</div>
                        <Select value={genNaming} onChange={setGenNaming} size="large" style={{ width: '100%', borderRadius: 8 }}>
                          <Option value="floor_unit">طابق + وحدة (101، 102)</Option>
                          <Option value="floor_letter">طابق + حرف (1A، 1B)</Option>
                          <Option value="floor_dash">طابق-وحدة (1-1، 1-2)</Option>
                          <Option value="sequential">تسلسلي (1، 2، 3)</Option>
                        </Select>
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>نوع الوحدة</div>
                        <Select value={genUnitType} onChange={setGenUnitType} size="large" style={{ width: '100%', borderRadius: 8 }}>
                          {unitTypes.map(t => <Option key={t.code} value={t.code}>{t.label}</Option>)}
                        </Select>
                      </Col>
                      <Col span={3}>
                        <Button type="primary" size="large" style={{ width: '100%', borderRadius: 8, background: '#389e0d', borderColor: '#389e0d' }} onClick={generateUnits}>
                          توليد {genFloors * genUnitsPerFloor} وحدة
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* Units Table */}
                  <Form.List name="unitsList">
                    {(unitFields, { add: addUnit, remove: removeUnit }) => (
                      <>
                        {unitFields.length > 0 && (
                          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 13 }}>
                              <ApartmentOutlined style={{ marginInlineEnd: 6, color: '#1677ff' }} />
                              {unitFields.length} وحدة
                            </Text>
                            <Button size="small" type="text" danger onClick={() => form.setFieldsValue({ unitsList: [] })}>
                              مسح الكل
                            </Button>
                          </div>
                        )}

                        {unitFields.length > 0 && (
                          <div style={{ maxHeight: '36vh', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                  {['رقم الوحدة', 'الطابق', 'النوع', 'المساحة م²', 'الحالة', ''].map(h => (
                                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#555', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {unitFields.map((unitField, unitIndex) => (
                                  <tr key={unitField.key} style={{ borderBottom: '1px solid #f9f9f9', background: unitIndex % 2 === 0 ? '#fff' : '#fafafa' }}>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'unitNo']} noStyle>
                                        <Input size="small" style={{ borderRadius: 6, width: 80, direction: 'ltr' }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'floor']} noStyle>
                                        <Input size="small" style={{ borderRadius: 6, width: 60 }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'type']} noStyle>
                                        <Select size="small" style={{ width: 110, borderRadius: 6 }}>
                                          {unitTypes.map(t => <Option key={t.code} value={t.code}>{t.label}</Option>)}
                                        </Select>
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'area']} noStyle>
                                        <Input size="small" placeholder="م²" style={{ borderRadius: 6, width: 70, direction: 'ltr' }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'status']} noStyle>
                                        <Select size="small" style={{ width: 120 }}>
                                          {unitStatuses.map(st => (
                                            <Option key={st.code} value={st.code}>
                                              <Tag color={st.code === 'vacant' ? 'blue' : st.code === 'occupied' ? 'success' : st.code === 'maintenance' ? 'warning' : 'purple'} style={{ margin: 0, fontSize: 11 }}>{st.label}</Tag>
                                            </Option>
                                          ))}
                                        </Select>
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeUnit(unitField.name)} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {unitFields.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                            <ApartmentOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                            <Text type="secondary">لا توجد وحدات — استخدم التوليد السريع أو أضف يدوياً</Text>
                          </div>
                        )}

                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => addUnit({ type: 'residential', status: 'vacant', area: '' })}
                          style={{ marginTop: 10, borderRadius: 8 }}
                        >
                          إضافة وحدة يدوياً
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>
              )}

              {/* Step 5 */}
              {currentStep === 4 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أضف تفاصيل الموقع وأي ملاحظات إضافية
                  </Text>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="emirate" label="الإمارة">
                        <Select placeholder="اختر الإمارة" size="large" allowClear style={{ borderRadius: 8 }} onChange={() => form.setFieldValue('city', undefined)}>
                          {(ref?.emirates ?? []).map(e => <Option key={e.id} value={e.id}>{locName(e, isAr)}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.emirate !== cur.emirate}>
                        {({ getFieldValue }) => (
                          <Form.Item name="city" label="المدينة">
                            <Select placeholder="اختر المدينة" size="large" allowClear showSearch optionFilterProp="label" style={{ borderRadius: 8 }}
                              options={citiesOf(getFieldValue('emirate')).map(c => ({ value: c.id, label: locName(c, isAr) }))} />
                          </Form.Item>
                        )}
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="zone" label="المنطقة">
                        <Input placeholder="مثال: المنطقة 4" size="large" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="street" label="الشارع">
                        <Input placeholder="مثال: شارع خليفة" size="large" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="poBox" label="صندوق البريد">
                        <Input placeholder="12345" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="address" label="العنوان التفصيلي">
                    <Input.TextArea rows={3} placeholder="الشارع، المنطقة، المدينة..." style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="coordinates" label="الإحداثيات (اختياري)"
                    rules={[{ validator: (_, v) => (!v || parseCoordinates(v).latitude !== undefined ? Promise.resolve() : Promise.reject(new Error('صيغة غير صحيحة — مثال: 24.4539, 54.3773'))) }]}>
                    <Input placeholder="مثال: 24.4539° N, 54.3773° E" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="notes" label="ملاحظات">
                    <Input.TextArea rows={3} placeholder="أي معلومات إضافية عن المبنى" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </div>
              )}
            </Form>
          )}
        </div>

        {/* Modal Footer */}
        {!done && (
          <div style={{ padding: '16px 32px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0' }}>
            <Button size="large" style={{ borderRadius: 8, minWidth: 100 }} disabled={saving} onClick={currentStep === 0 ? confirmCancel : prevStep}>
              {currentStep === 0 ? 'إلغاء' : 'السابق'}
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Step dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineEnd: 16 }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{ width: i === currentStep ? 20 : 8, height: 8, borderRadius: 4, background: i === currentStep ? PRIMARY : i < currentStep ? '#a5d6a7' : '#e0e0e0', transition: 'all 0.3s' }} />
                ))}
              </div>
              <Button
                type="primary" size="large"
                style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, minWidth: 120, fontWeight: 600 }}
                loading={saving}
                onClick={currentStep < STEPS.length - 1 ? nextStep : onFinish}
              >
                {currentStep < STEPS.length - 1 ? 'التالي ←' : 'حفظ المبنى'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewModal} onCancel={() => setViewModal(null)} footer={
        canManage ? <Button type="primary" icon={<EditOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => { if (viewModal) setEditId(viewModal.id); }}>تعديل البيانات</Button> : null
      } centered width={420} title={<Text strong>تفاصيل المبنى — {viewModal?.code}</Text>}>
        {viewModal && (
          <div>
            <div style={{ background: PRIMARY_LIGHT, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 36, color: PRIMARY, marginBottom: 8 }}><BankOutlined /></div>
              <Title level={4} style={{ margin: 0, color: PRIMARY }}>{viewModal.name}</Title>
              <Tag color="success" style={{ marginTop: 8 }}>{viewModal.status === 'active' ? 'نشط' : 'غير نشط'}</Tag>
            </div>
            <Row gutter={[12, 12]}>
              <Col span={12}><Statistic title="رقم المبنى" value={viewModal.code} valueStyle={{ fontSize: 16, color: PRIMARY }} /></Col>
              <Col span={12}><Statistic title="الفرع" value={viewModal.branch} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={12}><Statistic title="إجمالي الوحدات" value={viewModal.units} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={12}><Statistic title="نسبة الإشغال" value={viewModal.units ? `${Math.round((viewModal.occupied / viewModal.units) * 100)}%` : '—'} valueStyle={{ fontSize: 16, color: PRIMARY }} /></Col>
              <Col span={12}><Statistic title="مشغولة" value={viewModal.occupied} valueStyle={{ fontSize: 16, color: '#1565c0' }} /></Col>
              <Col span={12}><Statistic title="شاغرة" value={viewModal.vacant} valueStyle={{ fontSize: 16, color: '#c62828' }} /></Col>
            </Row>
            <Divider />
            <Button block icon={<HomeOutlined />} style={{ borderRadius: 8, marginBottom: 8 }} onClick={() => viewModal && openProfile(viewModal, 'units')}>عرض الوحدات</Button>
            <Button block icon={<FileTextOutlined />} style={{ borderRadius: 8 }} onClick={() => viewModal && openProfile(viewModal, 'contracts')}>عقود هذا المبنى</Button>
          </div>
        )}
      </Modal>

      <EditBuildingModal buildingId={editId} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); setViewModal(null); reload(); }} />
    </div>
  );
};

export default Buildings;
