import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal,
  Popover, Row, Select, Space, Spin, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ApartmentOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, FireOutlined, HomeOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined, BuildOutlined, ShopOutlined, DesktopOutlined, ToolOutlined,
  BellOutlined, ClockCircleOutlined, SyncOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { unitsApi, type UnitDto, type UnitSaveInput } from '../../api/units';
import { useReference } from '../../api/reference';
import { api, errorMessage, type Paged } from '../../api/client';
import UnitProfileDrawer from './UnitProfileDrawer';
import BuildingTanksYard from './BuildingTanksYard';
import type { UnitAction } from './UnitActionModal';
import { PRIORITY_STYLE, SR_STATUS, type SrStatus } from './ServiceRequestTracker';
import { useAuth } from '../../auth/AuthContext';

const { Text, Title } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';

/** Colours per unit status (box background / border / text). */
const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  occupied:    { bg: '#e8f5e9', border: '#66bb6a', text: '#1b5e20', label: 'مشغولة' },
  vacant:      { bg: '#e3f2fd', border: '#64b5f6', text: '#0d47a1', label: 'شاغرة' },
  reserved:    { bg: '#f3e5f5', border: '#ba68c8', text: '#4a148c', label: 'محجوزة' },
  maintenance: { bg: '#fff3e0', border: '#ffb74d', text: '#e65100', label: 'تحت الصيانة' },
};
const statusStyle = (s?: string) => STATUS_STYLE[s ?? ''] ?? { bg: '#fafafa', border: '#d9d9d9', text: '#555', label: s ?? '—' };

/** Unit types: residential / commercial / office — each has its own icon and facade look. */
const TYPE_META: Record<string, { icon: React.ReactNode; label: string }> = {
  residential: { icon: <HomeOutlined />, label: 'سكني' },
  commercial:  { icon: <ShopOutlined />, label: 'تجاري' },
  office:      { icon: <DesktopOutlined />, label: 'مكتب' },
};
const typeKey = (t?: string) => (t && TYPE_META[t] ? t : 'residential');
const typeMeta = (t?: string) => TYPE_META[typeKey(t)];

const floorLabel = (f: number | null | undefined) =>
  f == null ? 'بدون طابق' : f === 0 ? 'الطابق الأرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `الطابق ${f}`;
const floorShort = (f: number | null | undefined) => (f == null ? '—' : f === 0 ? 'G' : f < 0 ? `B${Math.abs(f)}` : String(f));

/** Natural sort: 101 < 102 < 110, 1A < 1B */
const byUnitNo = (a: UnitDto, b: UnitDto) => a.no.localeCompare(b.no, undefined, { numeric: true, sensitivity: 'base' });

/** Suggest the next unit number on a floor, following the pattern already used there. */
function suggestUnitNo(floor: number, onFloor: UnitDto[], all: UnitDto[]): string {
  const taken = new Set(all.map(u => u.no));
  const nums = onFloor.map(u => Number(u.no)).filter(n => Number.isInteger(n));
  if (nums.length) {
    let n = Math.max(...nums) + 1;
    while (taken.has(String(n))) n++;
    return String(n);
  }
  const prefix = floor === 0 ? 'G' : floor < 0 ? `B${Math.abs(floor)}` : String(floor);
  let i = onFloor.length + 1;
  let candidate = floor > 0 ? `${floor}${String(i).padStart(2, '0')}` : `${prefix}${String(i).padStart(2, '0')}`;
  while (taken.has(candidate)) { i++; candidate = floor > 0 ? `${floor}${String(i).padStart(2, '0')}` : `${prefix}${String(i).padStart(2, '0')}`; }
  return candidate;
}

interface Props {
  buildingId: number;
  buildingName?: string;
  /** building.total_floors — empty floors up to this number are drawn too */
  totalFloors?: number | null;
  /** called after any change so the profile header can refresh its counters */
  onChanged?: () => void;
}

/** Open service request as returned by GET /service-requests?openOnly=true */
interface OpenSr {
  id: number; requestNo: string; unitId?: number | null; unit?: string | null; status?: SrStatus; priority?: string;
  description?: string; assignee?: string | null; vendor?: string | null; requestedAt: string;
}
/** Open requests of one unit. */
interface UnitSr { pending: number; inProgress: number; urgent: boolean; overdue: boolean; list: OpenSr[] }

const srOverdue = (r: OpenSr) => dayjs().diff(dayjs(r.requestedAt), 'hour') > (PRIORITY_STYLE[r.priority ?? 'medium']?.slaHours ?? 72);
const srAge = (v: string) => {
  const h = Math.max(0, dayjs().diff(dayjs(v), 'hour'));
  return h < 24 ? `منذ ${h} ساعة` : `منذ ${Math.floor(h / 24)} يوم`;
};

type DrawerState =
  | { mode: 'view'; unit: UnitDto }
  | { mode: 'edit'; unit: UnitDto }
  | { mode: 'add'; floor: number }
  | null;

const BuildingFloorPlan: React.FC<Props> = ({ buildingId, buildingName, totalFloors, onChanged }) => {
  const { i18n } = useTranslation();
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const { data: ref } = useReference(i18n.language);
  const unitTypes = ref?.lookups?.UNIT_TYPE ?? [];
  const unitStatuses = ref?.lookups?.UNIT_STATUS ?? [];

  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  /** unit whose full details drawer (overview, tenant, gas, invoices …) is open */
  const [profileUnit, setProfileUnit] = useState<UnitDto | null>(null);
  /** open the unit panel directly on a form (e.g. service request from the 🔧 button on the unit) */
  const [openAction, setOpenAction] = useState<{ action: UnitAction; nonce: number } | null>(null);
  /** open (pending / in progress) service requests of this building */
  const [openSrs, setOpenSrs] = useState<OpenSr[]>([]);
  /** show only units that have an open service request */
  const [srOnly, setSrOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [floorModal, setFloorModal] = useState(false);
  const [form] = Form.useForm();
  const [floorForm] = Form.useForm();

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    unitsApi.byBuilding(buildingId, ctrl.signal)
      .then(r => { setUnits(r.items); setError(null); })
      .catch(e => { if (e?.name !== 'AbortError') setError(errorMessage(e)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [buildingId, reloadKey, i18n.language]);

  // Open service requests → the bell badge on each unit.
  useEffect(() => {
    const ctrl = new AbortController();
    api<Paged<OpenSr>>('/service-requests', { query: { buildingId, openOnly: true, pageSize: 0 }, signal: ctrl.signal })
      .then(r => setOpenSrs(r.items))
      .catch(e => { if (e?.name !== 'AbortError') setOpenSrs([]); });
    return () => ctrl.abort();
  }, [buildingId, reloadKey]);

  const srByUnit = useMemo(() => {
    const m = new Map<number, UnitSr>();
    openSrs.forEach(r => {
      if (r.unitId == null) return;
      const x = m.get(r.unitId) ?? { pending: 0, inProgress: 0, urgent: false, overdue: false, list: [] };
      if (r.status === 'in_progress') x.inProgress++; else x.pending++;
      if (r.priority === 'urgent') x.urgent = true;
      if (srOverdue(r)) x.overdue = true;
      x.list.push(r);
      m.set(r.unitId, x);
    });
    return m;
  }, [openSrs]);
  const srTotals = useMemo(() => ({
    pending: openSrs.filter(r => r.status !== 'in_progress').length,
    inProgress: openSrs.filter(r => r.status === 'in_progress').length,
  }), [openSrs]);

  /** open the unit panel directly on «track service requests» */
  const openTracking = (unitId?: number | null) => {
    const unit = units.find(x => x.id === unitId);
    if (!unit) return;
    setDrawer(null); setProfileUnit(unit); setOpenAction({ action: 'services', nonce: Date.now() });
  };

  // Keep the drawers showing fresh data after a reload.
  useEffect(() => {
    setProfileUnit(p => (p ? units.find(x => x.id === p.id) ?? null : p));
    setDrawer(d => {
      if (!d || d.mode === 'add') return d;
      const fresh = units.find(u => u.id === d.unit.id);
      return fresh ? { ...d, unit: fresh } : null;
    });
  }, [units]);

  // ── floors to draw: every floor that has units + empty floors up to total_floors ──
  const floors = useMemo(() => {
    const set = new Set<number>();
    units.forEach(u => { if (u.floor != null) set.add(u.floor); });
    const top = Math.max(totalFloors ?? 0, ...Array.from(set), 0);
    const hasGround = set.has(0) || (units.length === 0 && !totalFloors);
    const bottom = Math.min(...Array.from(set), hasGround ? 0 : 1);
    const list: number[] = [];
    for (let f = top; f >= bottom; f--) list.push(f);
    return list;
  }, [units, totalFloors]);

  const unitsByFloor = useMemo(() => {
    const m = new Map<number | null, UnitDto[]>();
    units.forEach(u => {
      const k = u.floor ?? null;
      m.set(k, [...(m.get(k) ?? []), u]);
    });
    m.forEach(list => list.sort(byUnitNo));
    return m;
  }, [units]);
  const noFloor = unitsByFloor.get(null) ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    units.forEach(u => { const s = u.status ?? 'vacant'; c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [units]);

  const q = search.trim().toLowerCase();
  const matches = (u: UnitDto) =>
    (!statusFilter || u.status === statusFilter) && (!srOnly || srByUnit.has(u.id)) &&
    (!q || u.no.toLowerCase().includes(q) || (u.tenant ?? '').toLowerCase().includes(q) || (u.meter ?? '').toLowerCase().includes(q));

  const selectedId = profileUnit?.id ?? (drawer && drawer.mode !== 'add' ? drawer.unit.id : null);

  // ── drawer actions ──
  const openAdd = (floor: number) => {
    const onFloor = unitsByFloor.get(floor) ?? [];
    const sameFloorType = onFloor[0]?.type;
    form.resetFields();
    form.setFieldsValue({ no: suggestUnitNo(floor, onFloor, units), floor, type: sameFloorType ?? 'residential', status: 'vacant' });
    setDrawer({ mode: 'add', floor });
  };
  const openEdit = (u: UnitDto) => {
    form.resetFields();
    form.setFieldsValue({
      no: u.no, floor: u.floor, type: u.type, status: u.status, area: u.area, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
      rent: u.rent, lastInspectionDate: u.lastInspectionDate ? dayjs(u.lastInspectionDate) : null, notes: u.notes,
    });
    setDrawer({ mode: 'edit', unit: u });
  };

  const toInput = (v: any): UnitSaveInput => ({
    buildingId,
    no: String(v.no ?? '').trim(),
    floor: v.floor ?? null,
    type: v.type,
    status: v.status,
    area: v.area ?? null,
    bedrooms: v.bedrooms ?? null,
    bathrooms: v.bathrooms ?? null,
    rent: v.rent ?? null,
    lastInspectionDate: v.lastInspectionDate ? (v.lastInspectionDate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
    notes: v.notes?.trim() || null,
  });

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    if (!drawer || drawer.mode === 'view') return;
    setSaving(true);
    try {
      if (drawer.mode === 'add') {
        const res = await unitsApi.create(toInput(v));
        message.success(`تمت إضافة الوحدة ${v.no}`);
        const created = await unitsApi.get(res.id).catch(() => null);
        setDrawer(null);
        if (created) setProfileUnit(created);
      } else {
        await unitsApi.update(drawer.unit.id, toInput(v));
        message.success(`تم حفظ الوحدة ${v.no}`);
        setDrawer(null);
        setProfileUnit(drawer.unit);
      }
      reload();
      onChanged?.();
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  /** deactivate / re-activate a unit (kept with its history) */
  const toggleActive = (u: UnitDto) => {
    const off = u.isActive !== false;
    Modal.confirm({
      title: off ? `إيقاف الوحدة ${u.no}؟` : `تفعيل الوحدة ${u.no}؟`,
      content: off
        ? (u.contractId ? 'لا يمكن إيقاف وحدة عليها عقد توريد نشط — أنهِ العقد أولاً.' : 'تبقى الوحدة وسجلاتها محفوظة وتظهر رمادية في المخطط، ولا يمكن إضافة مستأجر لها حتى تفعيلها.')
        : 'ستعود الوحدة متاحة لإضافة مستأجر.',
      okText: off ? 'إيقاف' : 'تفعيل', cancelText: 'إلغاء', centered: true,
      okButtonProps: off ? { disabled: !!u.contractId, style: u.contractId ? undefined : { background: '#d46b08', borderColor: '#d46b08' } } : { style: { background: PRIMARY, borderColor: PRIMARY } },
      onOk: async () => {
        try {
          await unitsApi.setActive(u.id, !off);
          message.success(off ? `تم إيقاف الوحدة ${u.no}` : `تم تفعيل الوحدة ${u.no}`);
          reload(); onChanged?.();
        } catch (e) { message.error(errorMessage(e), 6); }
      },
    });
  };

  const confirmDelete = (u: UnitDto) => {
    Modal.confirm({
      title: `حذف الوحدة ${u.no}؟`,
      content: u.contractId || u.meterId
        ? 'لا يمكن حذف وحدة عليها عقد توريد نشط أو عداد مركّب.'
        : 'سيتم حذف الوحدة من المبنى.',
      okText: 'حذف', cancelText: 'إلغاء', okType: 'danger', centered: true,
      okButtonProps: { disabled: !!(u.contractId || u.meterId) },
      onOk: async () => {
        try {
          await unitsApi.remove(u.id);
          message.success('تم حذف الوحدة');
          setDrawer(null);
          setProfileUnit(null);
          reload();
          onChanged?.();
        } catch (e) { message.error(errorMessage(e), 6); }
      },
    });
  };

  // ── add a whole floor (bulk) ──
  const openFloorModal = () => {
    const nextFloor = (floors.length ? Math.max(...floors) : 0) + 1;
    floorForm.resetFields();
    floorForm.setFieldsValue({ floor: nextFloor, count: (unitsByFloor.get(nextFloor - 1) ?? []).length || 4, naming: 'floor_unit', type: (unitsByFloor.get(nextFloor - 1) ?? [])[0]?.type ?? 'residential' });
    setFloorModal(true);
  };
  const previewFloorUnits = (v: any): string[] => {
    const f = Number(v?.floor ?? 1); const n = Math.max(0, Math.min(50, Number(v?.count ?? 0)));
    const pre = f === 0 ? 'G' : f < 0 ? `B${Math.abs(f)}` : String(f);
    return Array.from({ length: n }, (_, i) =>
      v?.naming === 'floor_letter' ? `${pre}${String.fromCharCode(65 + i)}`
        : v?.naming === 'floor_dash' ? `${pre}-${i + 1}`
          : `${pre}${String(i + 1).padStart(2, '0')}`);
  };
  const saveFloor = async () => {
    let v: any;
    try { v = await floorForm.validateFields(); } catch { return; }
    const nos = previewFloorUnits(v);
    const taken = new Set(units.map(u => u.no));
    const clash = nos.filter(n => taken.has(n));
    if (clash.length) { message.error(`أرقام موجودة مسبقاً: ${clash.join('، ')}`); return; }
    setSaving(true);
    try {
      await unitsApi.createBulk(buildingId, nos.map(no => ({ no, floor: v.floor, type: v.type, status: 'vacant' })));
      message.success(`تمت إضافة ${nos.length} وحدة في ${floorLabel(v.floor)}`);
      setFloorModal(false);
      reload();
      onChanged?.();
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  // ── rendering ──
  const unitBox = (u: UnitDto) => {
    const st = statusStyle(u.status);
    const dim = !matches(u);
    const selected = selectedId === u.id;
    const open = () => { setDrawer(null); setProfileUnit(u); };
    const sr = srByUnit.get(u.id);
    const srCount = sr ? sr.pending + sr.inProgress : 0;
    const srTone = !sr ? '' : sr.urgent || sr.overdue ? 'hot' : sr.pending ? 'pending' : 'progress';
    return (
      <Tooltip key={u.id} title={<div style={{ lineHeight: 1.6 }}>
        <div><b>الوحدة {u.no}</b> · {typeMeta(u.type).icon} {u.typeLabel ?? typeMeta(u.type).label}</div>
        <div>{u.tenant ? <><UserOutlined /> {u.tenant}</> : st.label}</div>
        {(u.area || u.bedrooms) ? <div>{[u.area ? `${u.area} م²` : null, u.bedrooms ? `${u.bedrooms} غرف` : null].filter(Boolean).join(' · ')}</div> : null}
        {u.meter ? <div><FireOutlined /> {u.meter}</div> : null}
        {sr ? <div style={{ marginTop: 4, color: '#ffd591' }}><BellOutlined /> {srCount} طلب خدمة مفتوح — {sr.pending} معلق · {sr.inProgress} قيد التنفيذ</div> : null}
      </div>}>
        <div role="button" tabIndex={0} onClick={open}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
          className={`bv-unit bv-${u.status ?? 'vacant'} bv-t-${typeKey(u.type)}${u.isActive === false ? ' bv-inactive' : ''}${selected ? ' bv-selected' : ''}${dim ? ' bv-dim' : ''}${sr ? ` bv-has-sr bv-sr-${srTone}` : ''}`}>
          {sr && (
            <button type="button" className={`bv-sr bv-sr-${srTone}`} aria-label={`${srCount} طلب خدمة مفتوح — الوحدة ${u.no}`}
              title={`${srCount} طلب خدمة مفتوح — اضغط للمتابعة`}
              onClick={e => { e.stopPropagation(); openTracking(u.id); }} onKeyDown={e => e.stopPropagation()}>
              {sr.urgent || sr.overdue ? <WarningOutlined /> : sr.pending ? <ClockCircleOutlined /> : <SyncOutlined />}
              <span>{srCount}</span>
            </button>
          )}
          <div className="bv-plate">{u.no}</div>
          {typeKey(u.type) === 'commercial' && <div className="bv-awning" />}
          <div className="bv-window">
            <div className="bv-panes" />
            <span className="bv-type" title={typeMeta(u.type).label}>{typeMeta(u.type).icon}</span>
            {canManage && (
              <Tooltip title="طلب خدمة لهذه الوحدة">
                <button type="button" className="bv-service" aria-label={`طلب خدمة للوحدة ${u.no}`}
                  onClick={e => { e.stopPropagation(); setDrawer(null); setProfileUnit(u); setOpenAction({ action: 'service', nonce: Date.now() }); }}
                  onKeyDown={e => e.stopPropagation()}>
                  <ToolOutlined />
                </button>
              </Tooltip>
            )}
            <div className="bv-badges">
              {u.meterId ? <span className="bv-badge" title={`عداد ${u.meter}`}><FireOutlined /></span> : null}
              {u.contractId ? <span className="bv-badge" title={`عقد ${u.contractNo}`}><FileTextOutlined /></span> : null}
            </div>
          </div>
          <div className="bv-balcony" />
          <div className="bv-caption" title={u.tenant ?? undefined}>
            {u.isActive === false ? <span className="bv-muted">موقوفة</span> : u.tenant ? <><UserOutlined /> {u.tenant}</> : <span className="bv-muted">{st.label}</span>}
          </div>
          <div className={`bv-meter${u.meter ? '' : ' none'}`} title={u.meter ? `عداد ${u.meter}` : undefined}>
            <FireOutlined /> {u.meter ?? 'بدون عداد'}
          </div>
        </div>
      </Tooltip>
    );
  };

  const addSlot = (f: number) => canManage ? (
    <Tooltip key="add" title={`إضافة وحدة في ${floorLabel(f)}`}>
      <div role="button" tabIndex={0} className="bv-unit bv-add" onClick={() => openAdd(f)}
        onKeyDown={e => { if (e.key === 'Enter') openAdd(f); }}>
        <div className="bv-plate">+</div>
        <div className="bv-window"><PlusOutlined /></div>
        <div className="bv-balcony" />
        <div className="bv-caption">إضافة وحدة</div>
        <div className="bv-meter none">&nbsp;</div>
      </div>
    </Tooltip>
  ) : null;

  const floorRow = (f: number) => {
    const list = unitsByFloor.get(f) ?? [];
    const occ = list.filter(x => x.status === 'occupied').length;
    return (
      <div key={f} className={`bv-floor${f < 0 ? ' bv-basement' : ''}`}>
        <div className="bv-floor-tag">
          <div className="bv-floor-num">{floorShort(f)}</div>
          <div className="bv-floor-occ">{list.length ? `${occ}/${list.length}` : '—'}</div>
        </div>
        <div className="bv-floor-units">
          {list.map(unitBox)}
          {addSlot(f)}
          {!list.length && !canManage && <span className="bv-empty">طابق بدون وحدات</span>}
        </div>
      </div>
    );
  };

  const above = floors.filter(f => f >= 0);
  const below = floors.filter(f => f < 0);
  const occupiedCount = counts.occupied ?? 0;
  const occupancy = units.length ? Math.round((occupiedCount / units.length) * 100) : 0;
  const kpis = [
    { label: 'إجمالي الوحدات', value: units.length, icon: <HomeOutlined />, color: PRIMARY, bg: '#e8f5e9' },
    { label: 'مشغولة', value: occupiedCount, icon: <UserOutlined />, color: '#1565c0', bg: '#e3f2fd' },
    { label: 'شاغرة', value: counts.vacant ?? 0, icon: <ApartmentOutlined />, color: '#c62828', bg: '#ffebee' },
    { label: 'نسبة الإشغال', value: `${occupancy}%`, icon: <BuildOutlined />, color: '#8a6d1f', bg: '#fbf3dc' },
  ];

  const u = drawer && drawer.mode !== 'add' ? drawer.unit : null;
  const st = statusStyle(u?.status);

  return (
    <div>
      <style>{`
        .bv-kpi { border-radius: 14px; border: none; box-shadow: 0 1px 6px rgba(0,0,0,0.07); }
        .bv-scene { position: relative; margin-bottom: 8px; overflow: hidden; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,0.07);
          background: linear-gradient(180deg, #e7efe6 0%, #f3efe4 55%, #f5f0e8 100%); padding: 28px 16px 0; }
        .bv-skyline { position: absolute; left: 0; right: 0; bottom: 40px; height: 150px; opacity: .10; pointer-events: none; }
        .bv-tower { position: relative; width: fit-content; min-width: 340px; max-width: 100%; margin: 0 auto; }

        /* roof */
        .bv-parapet { background: linear-gradient(180deg, #0b2e18 0%, #1a5c2a 100%); border-bottom: 4px solid #c9a84c;
          border-radius: 8px 8px 0 0; padding: 8px 24px; text-align: center; }
        .bv-parapet .name { color: #c9a84c; font-weight: 700; font-size: 15px; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bv-parapet .code { color: rgba(255,255,255,.65); font-size: 11px; font-family: monospace; }

        /* facade + pillars */
        .bv-facade { display: grid; grid-template-columns: 16px 1fr 16px; }
        .bv-pillar { background: linear-gradient(90deg, #0b2e18, #1a5c2a 50%, #0b2e18); }
        .bv-floors { background: #ece6d8; }
        .bv-floor { position: relative; display: flex; gap: 10px; padding: 12px 12px 0;
          background: linear-gradient(180deg, #f1ece0 0%, #e8e1d1 100%); border-bottom: 8px solid #cfc5b1;
          box-shadow: inset 0 -1px 0 #b9ae98; }
        .bv-floor-tag { width: 44px; flex-shrink: 0; align-self: stretch; margin-bottom: 12px; border-radius: 8px;
          background: linear-gradient(180deg, #1a5c2a, #0b2e18); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .bv-floor-num { color: #c9a84c; font-weight: 800; font-size: 18px; line-height: 1.1; }
        .bv-floor-occ { color: rgba(255,255,255,.7); font-size: 10px; }
        .bv-floor-units { display: flex; flex-wrap: wrap; gap: 12px; flex: 1; min-height: 128px; align-items: flex-start; }
        .bv-empty { align-self: center; color: #9b917c; font-size: 12px; }

        /* unit = window + balcony */
        .bv-unit { width: 112px; cursor: pointer; outline: none; display: flex; flex-direction: column; align-items: stretch;
          transition: transform .15s ease, filter .2s ease, opacity .2s ease; padding-bottom: 8px; }
        .bv-unit:hover, .bv-unit:focus-visible { transform: translateY(-3px); }
        .bv-plate { align-self: center; min-width: 44px; text-align: center; background: #1a5c2a; color: #fff; font-family: monospace;
          font-weight: 700; font-size: 12px; border-radius: 4px 4px 0 0; padding: 1px 8px; }
        .bv-window { position: relative; height: 58px; border: 4px solid #33413a; border-radius: 3px; overflow: hidden;
          background: linear-gradient(135deg, #6f8b99 0%, #3a5463 55%, #4b6878 100%); }
        .bv-window::after { content: ''; position: absolute; top: -20px; bottom: -20px; width: 18px; left: 18%;
          background: rgba(255,255,255,.18); transform: rotate(25deg); }
        .bv-panes { position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(90deg, transparent calc(50% - 1.5px), #33413a calc(50% - 1.5px), #33413a calc(50% + 1.5px), transparent calc(50% + 1.5px)),
                      linear-gradient(180deg, transparent 38%, #33413a 38%, #33413a calc(38% + 3px), transparent calc(38% + 3px)); }
        .bv-balcony { height: 12px; margin: 0 -4px; border-top: 3px solid #4a5c3a;
          background: repeating-linear-gradient(90deg, #4a5c3a 0 2px, transparent 2px 9px); }
        .bv-caption { margin-top: 5px; font-size: 11.5px; font-weight: 600; text-align: center; color: #3d372d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bv-caption .anticon { color: #1a5c2a; font-size: 10px; }
        .bv-muted { color: #8a7f68; font-weight: 400; }
        .bv-meter { margin: 3px auto 0; max-width: 100%; font-size: 10.5px; font-family: monospace; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: #fff7e6; color: #ad4e00; border: 1px solid #ffd591; border-radius: 10px; padding: 0 6px; }
        .bv-meter.none { background: transparent; border-color: transparent; color: #a99f88; font-family: inherit; }
        .bv-basement .bv-meter.none { color: #cfc6b4; }
        .bv-service { position: absolute; z-index: 3; top: 3px; inset-inline-start: 3px; width: 22px; height: 22px; border-radius: 7px; border: none; padding: 0;
          background: rgba(255,255,255,.92); color: #6a1b9a; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,.25); opacity: .85; transition: all .15s; }
        .bv-service:hover, .bv-service:focus-visible { opacity: 1; background: #c9a84c; color: #0b2e18; transform: scale(1.12); outline: none; }
        /* open service requests: bell bubble on the unit + coloured window ring */
        .bv-unit { position: relative; }
        .bv-sr { position: absolute; z-index: 5; top: -8px; inset-inline-end: -8px; height: 24px; min-width: 24px; padding: 0 7px; border-radius: 12px; border: 2px solid #fff;
          display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-size: 11.5px; font-weight: 800; color: #fff; cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 6px rgba(0,0,0,.3); transition: transform .15s; }
        .bv-sr:hover, .bv-sr:focus-visible { transform: scale(1.15); outline: none; }
        .bv-sr-pending.bv-sr { background: #d46b08; }
        .bv-sr-progress.bv-sr { background: #1565c0; }
        .bv-sr-hot.bv-sr { background: #c62828; animation: bvPulse 1.6s infinite; }
        @keyframes bvPulse { 0% { box-shadow: 0 0 0 0 rgba(198,40,40,.6); } 70% { box-shadow: 0 0 0 9px rgba(198,40,40,0); } 100% { box-shadow: 0 0 0 0 rgba(198,40,40,0); } }
        .bv-has-sr.bv-sr-pending .bv-window { outline: 3px solid #fa8c16; outline-offset: 1px; }
        .bv-has-sr.bv-sr-progress .bv-window { outline: 3px solid #1e88e5; outline-offset: 1px; }
        .bv-has-sr.bv-sr-hot .bv-window { outline: 3px solid #e53935; outline-offset: 1px; }
        .bv-srchip { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
          border: 1px solid #ffd591; background: #fff7e6; color: #ad4e00; transition: all .15s; }
        .bv-srchip.active { border-color: #d46b08; background: #d46b08; color: #fff; }
        .bv-srchip.none { border-color: #e6e0d2; background: #fff; color: #8a8a8a; cursor: default; }
        .bv-srlist { width: 360px; max-height: 360px; overflow: auto; }
        .bv-srrow { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px; border-radius: 8px; cursor: pointer; border-bottom: 1px solid #f2f2f2; }
        .bv-srrow:hover { background: #f6f8f6; }
        .bv-srunit { min-width: 46px; text-align: center; font-family: monospace; font-weight: 700; background: #1a5c2a; color: #fff; border-radius: 6px; padding: 2px 6px; font-size: 12px; }
        .bv-srpill { display: inline-flex; align-items: center; gap: 3px; padding: 0 7px; border-radius: 10px; font-size: 11px; font-weight: 700; }
        .bv-badges { position: absolute; z-index: 2; bottom: 3px; inset-inline-start: 3px; display: flex; gap: 3px; }
        .bv-badge { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,.92); color: #1a5c2a; font-size: 10px;
          display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.25); }

        /* status = what the window looks like */
        .bv-occupied .bv-window { background: radial-gradient(circle at 50% 35%, #fff8dc 0%, #f9dd7d 45%, #e2b445 100%);
          box-shadow: 0 0 14px rgba(249, 210, 90, .55); }
        .bv-occupied .bv-window::after { background: rgba(255,255,255,.25); }
        .bv-reserved .bv-window { background: linear-gradient(135deg, #b39ddb 0%, #7e57c2 60%, #9575cd 100%); }
        .bv-maintenance .bv-window { background: linear-gradient(135deg, #ffcc80, #f59e0b); }
        .bv-maintenance .bv-window::before { content: ''; position: absolute; z-index: 2; left: -10px; right: -10px; top: 40%; height: 12px;
          transform: rotate(-12deg); background: repeating-linear-gradient(45deg, #1f1f1f 0 7px, #fbbf24 7px 14px); }
        .bv-occupied .bv-caption { color: #1a5c2a; font-weight: 600; }

        /* type = what the unit looks like */
        .bv-type { position: absolute; z-index: 2; top: 3px; inset-inline-end: 3px; width: 20px; height: 20px; border-radius: 6px;
          background: rgba(11,46,24,.82); color: #c9a84c; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
        .bv-t-commercial { width: 132px; }
        .bv-t-commercial .bv-window { height: 64px; border-top-width: 2px; border-radius: 0; }
        .bv-t-commercial .bv-panes { background: linear-gradient(90deg, transparent calc(33% - 1.5px), #33413a calc(33% - 1.5px), #33413a calc(33% + 1.5px), transparent calc(33% + 1.5px),
                                                   transparent calc(66% - 1.5px), #33413a calc(66% - 1.5px), #33413a calc(66% + 1.5px), transparent calc(66% + 1.5px)); }
        .bv-t-commercial .bv-balcony { height: 6px; border-top: 4px solid #8d7a5a; background: #a8977a; margin: 0; }
        .bv-awning { height: 12px; margin: 0 -6px; border-radius: 0 0 6px 6px;
          background: repeating-linear-gradient(90deg, #1a5c2a 0 12px, #f5f0e8 12px 24px); box-shadow: 0 2px 3px rgba(0,0,0,.15); }
        .bv-t-office .bv-window { background: linear-gradient(135deg, #8fb3b8 0%, #4f7b84 55%, #6a959c 100%); }
        .bv-t-office .bv-panes { background:
          linear-gradient(90deg, transparent calc(33% - 1px), #33413a calc(33% - 1px), #33413a calc(33% + 1px), transparent calc(33% + 1px), transparent calc(66% - 1px), #33413a calc(66% - 1px), #33413a calc(66% + 1px), transparent calc(66% + 1px)),
          linear-gradient(180deg, transparent calc(50% - 1px), #33413a calc(50% - 1px), #33413a calc(50% + 1px), transparent calc(50% + 1px)); }
        .bv-t-office .bv-balcony { height: 5px; border-top: 3px solid #6d7a74; background: #9aa5a0; margin: 0; }
        .bv-occupied.bv-t-office .bv-window, .bv-occupied.bv-t-commercial .bv-window { background: radial-gradient(circle at 50% 35%, #fffbe8 0%, #fbe7a1 45%, #e9c45c 100%); }
        .bv-type-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; background: #f5f0e8; border: 1px solid #e6e0d2; font-size: 12px; }
        .bv-type-chip .ic { width: 20px; height: 20px; border-radius: 6px; background: #0b2e18; color: #c9a84c; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }

        .bv-selected .bv-window { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,.45), 0 6px 14px rgba(0,0,0,.18); }
        .bv-selected .bv-plate { background: #c9a84c; color: #0b2e18; }
        .bv-dim { opacity: .28; filter: grayscale(.8); }
        /* deactivated unit: grey, boarded-up window */
        .bv-inactive .bv-window { background: repeating-linear-gradient(45deg, #9e9e9e 0 8px, #bdbdbd 8px 16px) !important; box-shadow: none !important; }
        .bv-inactive .bv-plate { background: #8c8c8c; }
        .bv-inactive { filter: grayscale(.6); }

        .bv-add .bv-plate { background: transparent; color: #8a7f68; border: 1px dashed #b9ae98; border-bottom: none; }
        .bv-add .bv-window { background: rgba(255,255,255,.55); border: 3px dashed #b9ae98; color: #8a7f68; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .bv-add .bv-window::after { display: none; }
        .bv-add .bv-balcony { opacity: .35; }
        .bv-add:hover .bv-window { border-color: #1a5c2a; color: #1a5c2a; background: #f6ffed; }

        /* lobby + ground */
        .bv-lobby { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 92px; padding-top: 28px; background: linear-gradient(180deg, #e8e1d1, #ddd4c1); }
        .bv-canopy { position: absolute; top: 4px; width: 190px; height: 16px; background: linear-gradient(180deg, #1a5c2a, #0b2e18);
          border-bottom: 3px solid #c9a84c; border-radius: 4px; color: #c9a84c; font-size: 10px; font-weight: 700; text-align: center; line-height: 14px; }
        .bv-doors { width: 112px; height: 48px; border: 4px solid #33413a; border-bottom-width: 3px; border-radius: 3px 3px 0 0; display: grid; grid-template-columns: 1fr 1fr;
          background: linear-gradient(135deg, #b9d0da, #6f8b99); position: relative; }
        .bv-doors > div { position: relative; }
        .bv-doors > div:first-child { border-inline-end: 3px solid #33413a; }
        .bv-doors > div::after { content: ''; position: absolute; top: 45%; width: 3px; height: 12px; background: #c9a84c; border-radius: 2px; }
        .bv-doors > div:first-child::after { inset-inline-end: 4px; }
        .bv-doors > div:last-child::after { inset-inline-start: 4px; }
        .bv-step { width: 150px; height: 6px; background: #b9b0a0; border-radius: 2px 2px 0 0; box-shadow: inset 0 1px 0 #d6cebf; }
        .bv-planter { position: absolute; bottom: 0; width: 38px; display: flex; flex-direction: column; align-items: center; }
        .bv-planter .bush { width: 38px; height: 30px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #8fd18f, #2e7d32 75%); margin-bottom: -6px; position: relative; z-index: 1; }
        .bv-planter .pot { width: 30px; height: 18px; background: linear-gradient(180deg, #1a5c2a, #0b2e18); border-top: 3px solid #c9a84c; clip-path: polygon(0 0, 100% 0, 85% 100%, 15% 100%); }
        .bv-ground { margin: 0 -16px; }
        .bv-pavement { height: 14px; background: repeating-linear-gradient(90deg, #c8c0af 0 38px, #b6ad9a 38px 40px); border-top: 2px solid #a59b86; }
        .bv-kerb { height: 4px; background: #8d8473; }
        .bv-grass { height: 12px; background: linear-gradient(180deg, #8fc46a, #6fa64e); }
        .bv-soil { height: 10px; background: linear-gradient(180deg, #8a6e4b, #6f573a); }
        .bv-underground { margin: 0 -16px; padding: 0 16px 18px; border-top: 6px solid #6f573a; background: linear-gradient(180deg, #6d6455, #574f43); }
        .bv-underground .bv-tower-under { width: fit-content; min-width: 340px; max-width: 100%; margin: 0 auto; border: 4px solid #3e382f; border-top: none; }
        .bv-basement { background: linear-gradient(180deg, #7b7262, #6b6354); border-bottom-color: #4f483d; }
        .bv-basement .bv-floor-tag { background: linear-gradient(180deg, #4f483d, #3e382f); }
        .bv-basement .bv-caption { color: #e8e1d1; }
        .bv-basement .bv-window { height: 40px; }

        .bv-legend { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 3px 10px; border-radius: 20px;
          border: 1px solid #e6e0d2; background: #fff; font-size: 12px; transition: all .15s; }
        .bv-legend.active { border-color: #1a5c2a; background: #e8f5e9; font-weight: 600; }
        .bv-swatch { width: 18px; height: 13px; border: 2px solid #33413a; border-radius: 2px; }
      `}</style>

      {/* KPI row — same card style as the Buildings page */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {kpis.map(k => (
          <Col xs={12} md={6} key={k.label}>
            <Card className="bv-kpi" styles={{ body: { padding: '14px 16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ fontSize: 12, color: '#888' }}>{k.label}</Text>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: k.bg, color: k.color, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* toolbar */}
      <Card className="bv-kpi" style={{ marginBottom: 12 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap size={8}>
              {(['occupied', 'vacant', 'reserved', 'maintenance'] as const).map(k => {
                const active = statusFilter === k;
                const swatch: Record<string, string> = {
                  occupied: 'radial-gradient(circle, #fff8dc, #e2b445)', vacant: 'linear-gradient(135deg,#6f8b99,#3a5463)',
                  reserved: 'linear-gradient(135deg,#b39ddb,#7e57c2)', maintenance: 'repeating-linear-gradient(45deg,#1f1f1f 0 3px,#fbbf24 3px 6px)',
                };
                return (
                  <span key={k} role="button" tabIndex={0} className={`bv-legend${active ? ' active' : ''}`}
                    onClick={() => setStatusFilter(active ? null : k)} onKeyDown={e => { if (e.key === 'Enter') setStatusFilter(active ? null : k); }}>
                    <span className="bv-swatch" style={{ background: swatch[k] }} />
                    {unitStatuses.find(x => x.code === k)?.label ?? STATUS_STYLE[k].label}
                    <b style={{ color: '#888' }}>{counts[k] ?? 0}</b>
                  </span>
                );
              })}
              {statusFilter && <Button size="small" type="link" onClick={() => setStatusFilter(null)}>إظهار الكل</Button>}
              <span style={{ width: 1, height: 20, background: '#e6e0d2', display: 'inline-block', margin: '0 4px' }} />
              {openSrs.length === 0 ? (
                <span className="bv-srchip none"><BellOutlined /> لا توجد طلبات خدمة مفتوحة</span>
              ) : (
                <Popover trigger="click" placement="bottom"
                  title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span><BellOutlined /> طلبات الخدمة المفتوحة ({openSrs.length})</span>
                    <Button size="small" type={srOnly ? 'primary' : 'default'} onClick={() => setSrOnly(v => !v)}
                      style={srOnly ? { background: '#d46b08', borderColor: '#d46b08' } : undefined}>
                      {srOnly ? 'إظهار كل الوحدات' : 'تمييز هذه الوحدات فقط'}
                    </Button>
                  </div>}
                  content={
                    <div className="bv-srlist">
                      {[...openSrs].sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1) || dayjs(a.requestedAt).diff(dayjs(b.requestedAt))).map(r => {
                        const st = SR_STATUS[r.status ?? 'pending'] ?? SR_STATUS.pending;
                        const pr = PRIORITY_STYLE[r.priority ?? 'medium'] ?? PRIORITY_STYLE.medium;
                        const late = srOverdue(r);
                        return (
                          <div key={r.id} className="bv-srrow" role="button" tabIndex={0} onClick={() => openTracking(r.unitId)}
                            onKeyDown={e => { if (e.key === 'Enter') openTracking(r.unitId); }}>
                            <span className="bv-srunit">{r.unit ?? '—'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#666' }}>{r.requestNo}</span>
                                <span className="bv-srpill" style={{ color: st.color, background: st.bg }}>{st.icon} {st.label}</span>
                                <span className="bv-srpill" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
                                {late && <span className="bv-srpill" style={{ color: '#fff', background: '#c62828' }}><WarningOutlined /> متأخر</span>}
                              </div>
                              <div style={{ fontSize: 12.5, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                              <div style={{ fontSize: 11, color: '#999' }}>{srAge(r.requestedAt)} · {r.assignee ?? r.vendor ?? 'غير مُسند'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }>
                  <span role="button" tabIndex={0} className={`bv-srchip${srOnly ? ' active' : ''}`}>
                    <BellOutlined /> طلبات خدمة مفتوحة
                    <b>{openSrs.length}</b>
                    <span style={{ fontWeight: 400, opacity: .85 }}>({srTotals.pending} معلق · {srTotals.inProgress} قيد التنفيذ)</span>
                  </span>
                </Popover>
              )}
              {srOnly && <Button size="small" type="link" onClick={() => setSrOnly(false)}>إظهار كل الوحدات</Button>}
              <span style={{ width: 1, height: 20, background: '#e6e0d2', display: 'inline-block', margin: '0 4px' }} />
              {Object.entries(TYPE_META).map(([k, m]) => (
                <span key={k} className="bv-type-chip"><span className="ic">{m.icon}</span>{unitTypes.find(t => t.code === k)?.label ?? m.label}
                  <b style={{ color: '#888' }}>{units.filter(x => typeKey(x.type) === k).length}</b></span>
              ))}
            </Space>
          </Col>
          <Col>
            <Space>
              <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="رقم الوحدة / المستأجر / العداد" allowClear
                value={search} onChange={e => setSearch(e.target.value)} style={{ width: 230, borderRadius: 8 }} />
              <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={reload} loading={loading} style={{ borderRadius: 8 }} /></Tooltip>
              {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, fontWeight: 600 }} onClick={openFloorModal}>إضافة طابق</Button>}
            </Space>
          </Col>
        </Row>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12, borderRadius: 8 }} action={<Button size="small" onClick={reload}>إعادة المحاولة</Button>} />}

      {/* gas tanks of the building: capacity vs. gas inside */}
      <BuildingTanksYard buildingId={buildingId} canManage={canManage} reloadKey={reloadKey} />

      <Spin spinning={loading && !units.length}>
        {!loading && !units.length && !floors.length ? (
          <Card className="bv-kpi"><Empty description="لا توجد وحدات في هذا المبنى بعد">
            {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={openFloorModal}>إضافة أول طابق</Button>}
          </Empty></Card>
        ) : (
          <div className="bv-scene">
            <svg className="bv-skyline" viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true">
              <path fill="#1a5c2a" d="M0,150 L0,95 L40,95 L40,60 L70,60 L70,95 L110,95 L110,40 L125,40 L125,20 L135,20 L135,40 L150,40 L150,95 L200,95 L200,70 L240,70 L240,95 L290,95 L290,50 L330,50 L330,95 L380,95 L380,30 L395,30 L395,10 L405,10 L405,30 L420,30 L420,95 L470,95 L470,65 L510,65 L510,95 L780,95 L780,55 L820,55 L820,95 L860,95 L860,35 L875,35 L875,15 L885,15 L885,35 L900,35 L900,95 L950,95 L950,70 L990,70 L990,95 L1040,95 L1040,45 L1080,45 L1080,95 L1130,95 L1130,65 L1165,65 L1165,95 L1200,95 L1200,150 Z" />
            </svg>

            <div className="bv-tower">
              <div className="bv-parapet">
                <div className="name">{buildingName || 'المبنى'}</div>
                <div className="code">{units[0]?.buildingCode ?? ''}</div>
              </div>
              <div className="bv-facade">
                <div className="bv-pillar" />
                <div className="bv-floors">
                  {above.map(floorRow)}
                  <div className="bv-lobby">
                    <div className="bv-canopy">المدخل الرئيسي</div>
                    <div className="bv-planter" style={{ insetInlineStart: 18 }}><div className="bush" /><div className="pot" /></div>
                    <div className="bv-doors"><div /><div /></div>
                    <div className="bv-step" />
                    <div className="bv-planter" style={{ insetInlineEnd: 18 }}><div className="bush" /><div className="pot" /></div>
                  </div>
                </div>
                <div className="bv-pillar" />
              </div>
            </div>
            <div className="bv-ground"><div className="bv-pavement" /><div className="bv-kerb" /><div className="bv-grass" />{below.length === 0 && <div className="bv-soil" />}</div>
            {below.length > 0 && (
              <div className="bv-underground">
                <div className="bv-tower-under">{below.map(floorRow)}</div>
              </div>
            )}
          </div>
        )}
      </Spin>

      {noFloor.length > 0 && (
        <Card className="bv-kpi" style={{ marginTop: 12 }} title={<span style={{ color: '#8a6d1f' }}>وحدات بدون رقم طابق ({noFloor.length})</span>}
          styles={{ body: { background: '#f5f0e8', borderRadius: '0 0 14px 14px' } }}>
          <div className="bv-floor-units">{noFloor.map(unitBox)}</div>
        </Card>
      )}

      {/* ── unit drawer: view / edit / add ── */}
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        width={440}
        placement="left"
        destroyOnHidden
        title={drawer?.mode === 'add'
          ? <span><PlusOutlined /> وحدة جديدة — {floorLabel(drawer.floor)}</span>
          : u && <Space><HomeOutlined /> الوحدة {u.no}<Tag style={{ background: st.bg, borderColor: st.border, color: st.text }}>{u.statusLabel ?? st.label}</Tag></Space>}
        extra={drawer?.mode === 'view' && canManage && u ? (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(u)}>تعديل</Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => confirmDelete(u)} />
          </Space>
        ) : null}
        footer={drawer && drawer.mode !== 'view' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => { if (drawer.mode === 'edit') setProfileUnit(drawer.unit); setDrawer(null); }} disabled={saving}>إلغاء</Button>
            <Button type="primary" loading={saving} onClick={save} style={{ background: PRIMARY, borderColor: PRIMARY }}>
              {drawer.mode === 'add' ? 'إضافة الوحدة' : 'حفظ التعديلات'}
            </Button>
          </div>
        ) : null}
      >
        {drawer?.mode === 'view' && u && (
          <>
            <div style={{ background: 'linear-gradient(135deg, #1a5c2a 0%, #0b2e18 100%)', borderRadius: 12, padding: '16px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 14, borderBottom: `3px solid ${GOLD}` }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(201,168,76,0.18)', color: GOLD, fontSize: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{typeMeta(u.type).icon}</div>
              <div style={{ flex: 1 }}>
                <Title level={3} style={{ margin: 0, color: '#fff', fontFamily: 'monospace' }}>{u.no}</Title>
                <Text style={{ color: 'rgba(255,255,255,0.75)' }}>{floorLabel(u.floor)} · {u.typeLabel ?? typeMeta(u.type).label}</Text>
              </div>
              <Tag style={{ background: st.bg, borderColor: st.border, color: st.text, fontWeight: 600, borderRadius: 8 }}>{u.statusLabel ?? st.label}</Tag>
            </div>
            <Descriptions column={2} size="small" bordered labelStyle={{ width: 110 }}>
              <Descriptions.Item label="المساحة" span={2}>{u.area ? `${u.area} م²` : '—'}</Descriptions.Item>
              <Descriptions.Item label="غرف النوم">{u.bedrooms ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الحمامات">{u.bathrooms ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الإيجار السنوي" span={2}>{u.rent ? `${Number(u.rent).toLocaleString()} د.إ` : '—'}</Descriptions.Item>
              <Descriptions.Item label="آخر فحص" span={2}>{u.lastInspectionDate ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>الإشغال والعداد</Title>
            <Descriptions column={1} size="small" bordered labelStyle={{ width: 110 }}>
              <Descriptions.Item label="المستأجر">{u.tenant ? <><UserOutlined /> {u.tenant}</> : <Text type="secondary">لا يوجد</Text>}</Descriptions.Item>
              <Descriptions.Item label="عقد التوريد">{u.contractNo ? <Tag color="green">{u.contractNo}</Tag> : <Text type="secondary">لا يوجد عقد نشط</Text>}</Descriptions.Item>
              <Descriptions.Item label="عداد الغاز">{u.meter ? <Tag color="orange" icon={<FireOutlined />}>{u.meter}</Tag> : <Text type="secondary">لا يوجد عداد</Text>}</Descriptions.Item>
            </Descriptions>
            {!u.contractId && <Alert type="info" showIcon style={{ marginTop: 12, borderRadius: 8 }} message="الوحدة تصبح «مشغولة» تلقائياً عند تفعيل عقد توريد غاز لها." />}

            {u.notes && (
              <>
                <Title level={5} style={{ marginTop: 20 }}>ملاحظات</Title>
                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap' }}>{u.notes}</div>
              </>
            )}
          </>
        )}

        {drawer && drawer.mode !== 'view' && (
          <Form form={form} layout="vertical" requiredMark="optional">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="no" label="رقم الوحدة" rules={[{ required: true, whitespace: true, message: 'مطلوب' },
                  { validator: (_, v) => {
                    const no = String(v ?? '').trim();
                    const selfId = drawer.mode === 'edit' ? drawer.unit.id : -1;
                    return no && units.some(x => x.no === no && x.id !== selfId) ? Promise.reject(new Error('الرقم مستخدم في هذا المبنى')) : Promise.resolve();
                  } }]}>
                  <Input style={{ direction: 'ltr' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="floor" label="الطابق" rules={[{ required: true, message: 'مطلوب' }]} tooltip="0 = الأرضي، سالب = بدروم">
                  <InputNumber min={-5} max={200} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="type" label="النوع" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Select options={unitTypes.map(t => ({ value: t.code, label: <span>{typeMeta(t.code).icon} {t.label}</span> }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="status" label="الحالة"
                  extra={drawer.mode === 'edit' && drawer.unit.contractId ? 'عليها عقد نشط — تبقى مشغولة' : undefined}>
                  <Select options={unitStatuses.map(s => ({ value: s.code, label: s.label }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="area" label="المساحة (م²)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="bedrooms" label="غرف النوم"><InputNumber min={0} max={20} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="bathrooms" label="الحمامات"><InputNumber min={0} max={20} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="rent" label="الإيجار السنوي (د.إ)">
                  <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => (v ? Number(v.replace(/,/g, '')) : 0) as any} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="lastInspectionDate" label="آخر فحص"><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Drawer>

      {/* ── unit details: overview, tenant, gas, activity, invoices, payments, readings ── */}
      <UnitProfileDrawer
        unit={profileUnit}
        buildingName={buildingName}
        canManage={canManage}
        onClose={() => { setProfileUnit(null); setOpenAction(null); }}
        openAction={openAction}
        onEdit={x => { setProfileUnit(null); openEdit(x); }}
        onDelete={x => confirmDelete(x)}
        onToggleActive={x => toggleActive(x)}
        onChanged={() => { reload(); onChanged?.(); }}
      />

      {/* ── add a floor ── */}
      <Modal open={floorModal} onCancel={() => setFloorModal(false)} title={<span><ApartmentOutlined /> إضافة طابق</span>}
        okText="إضافة الطابق" cancelText="إلغاء" onOk={saveFloor} confirmLoading={saving} destroyOnHidden
        okButtonProps={{ style: { background: PRIMARY, borderColor: PRIMARY } }}>
        <Form form={floorForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="floor" label="رقم الطابق" rules={[{ required: true }]} tooltip="0 = الأرضي، سالب = بدروم">
                <InputNumber min={-5} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="count" label="عدد الوحدات" rules={[{ required: true }]}>
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="naming" label="نمط الترقيم">
                <Select options={[
                  { value: 'floor_unit', label: 'طابق + رقم (701، 702)' },
                  { value: 'floor_letter', label: 'طابق + حرف (7A، 7B)' },
                  { value: 'floor_dash', label: 'طابق-رقم (7-1، 7-2)' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="نوع الوحدات">
                <Select options={unitTypes.map(t => ({ value: t.code, label: <span>{typeMeta(t.code).icon} {t.label}</span> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldsValue }) => {
              const nos = previewFloorUnits(getFieldsValue());
              return nos.length ? (
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 10 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>الوحدات التي ستُضاف:</Text>
                  <div style={{ marginTop: 6 }}>{nos.map(n => <Tag key={n} color={units.some(x => x.no === n) ? 'red' : 'green'}>{n}</Tag>)}</div>
                </div>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BuildingFloorPlan;
