import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Radio, Row, Select, Slider, Spin, Tag, Tooltip, Typography, message } from 'antd';
import {
  CalendarOutlined, DatabaseOutlined, ExperimentOutlined, FireOutlined, HistoryOutlined, ReloadOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined, WarningOutlined, EditOutlined, PlusOutlined, LineChartOutlined, CheckOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import TankInsights from './TankInsights';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';
/** same threshold as the API (TankRules.LowLevelPercent) */
const LOW_PCT = 25;

// ── GET /tanks?buildingId= ──
interface TankDto {
  id: number; tankNo: string; gasTypeId?: number; gasType?: string; gasTypeName?: string; capacityLitres: number; currentLevel: number; levelPct: number;
  currentLevelM3?: number | null; serialNo?: string | null; manufacturer?: string | null; installDate?: string | null;
  lastInspectionDate?: string | null; nextInspectionDate?: string | null; status?: string; statusLabel?: string; isActive: boolean;
}
interface TankRow { tank: TankDto; lastRefill?: string | null; openRequest?: string | null }
interface LevelRow {
  id: number; eventDate: string; eventType?: string; eventTypeLabel?: string; levelLitres: number; levelPct: number; notes?: string | null;
  readBy?: string | null; enteredBy?: string | null;
}

const litres = (v?: number | null) => (v == null ? '—' : `${Math.round(Number(v)).toLocaleString()} لتر`);
const d = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '—');
const tone = (t: Pick<TankDto, 'levelPct' | 'status' | 'statusLabel'>) => {
  if (t.status === 'maintenance' || t.status === 'out_of_service')
    return { color: '#8c8c8c', fill: '#bfbfbf', f1: '#cfd4d8', f2: '#a7aeb4', label: t.statusLabel ?? 'خارج الخدمة', off: true };
  if (t.levelPct < LOW_PCT / 2) return { color: '#c62828', fill: '#e53935', f1: '#ef5350', f2: '#c62828', label: 'حرج', off: false };
  if (t.levelPct < LOW_PCT) return { color: '#d84315', fill: '#f4511e', f1: '#ff7043', f2: '#d84315', label: 'منخفض', off: false };
  if (t.levelPct < 50) return { color: '#b7791f', fill: '#f59e0b', f1: '#fbbf24', f2: '#d97706', label: 'متوسط', off: false };
  return { color: '#2e7d32', fill: '#43a047', f1: '#66bb6a', f2: '#2e7d32', label: 'جيد', off: false };
};
const EVENT_COLOR: Record<string, string> = { refill: '#2e7d32', manual_reading: '#1565c0', sensor: '#6a1b9a', adjustment: '#d48806' };

/** Horizontal LPG bullet tank (SVG) on two saddles, filled to the current level. */
const TankShape: React.FC<{ t: TankDto; id: string }> = ({ t, id }) => {
  const tn = tone(t);
  const pct = Math.max(0, Math.min(100, t.levelPct));
  const Y = 12, H = 56, ly = Y + H * (1 - pct / 100);
  const low = pct < LOW_PCT && !tn.off;
  return (
    <svg className="tk-svg" viewBox="0 0 220 96" role="img" aria-label={`الخزان ${t.tankNo} — ${Math.round(pct)}%`}>
      <defs>
        <linearGradient id={`sh-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#eef1f3" /><stop offset="1" stopColor="#c9d0d5" />
        </linearGradient>
        <linearGradient id={`lq-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tn.f1} /><stop offset="1" stopColor={tn.f2} /></linearGradient>
        <clipPath id={`cp-${id}`}><rect x="14" y={Y} width="192" height={H} rx="28" /></clipPath>
        <pattern id={`ht-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="rgba(0,0,0,.07)" /></pattern>
      </defs>
      <ellipse cx="110" cy="90" rx="92" ry="4" fill="rgba(0,0,0,.08)" />
      <path d="M52 66 L60 88 L80 88 L88 66 Z" fill="#7b858c" /><path d="M132 66 L140 88 L160 88 L168 66 Z" fill="#7b858c" />
      <rect x="46" y="86" width="48" height="4" rx="1" fill="#5f686e" /><rect x="126" y="86" width="48" height="4" rx="1" fill="#5f686e" />
      <rect x="14" y={Y} width="192" height={H} rx="28" fill={`url(#sh-${id})`} />
      <g clipPath={`url(#cp-${id})`}>
        <rect className="tk-liquid" x="0" y={ly} width="220" height={H + 4} fill={`url(#lq-${id})`} opacity={tn.off ? 0.6 : 0.95} />
        <rect x="0" y={ly} width="220" height="2" fill="rgba(255,255,255,.55)" />
        {tn.off && <rect x="0" y="0" width="220" height="96" fill={`url(#ht-${id})`} />}
        <rect x="30" y={Y + 6} width="160" height="5" rx="2.5" fill="rgba(255,255,255,.75)" />
        <line x1="62" y1={Y} x2="62" y2={Y + H} stroke="rgba(0,0,0,.08)" /><line x1="158" y1={Y} x2="158" y2={Y + H} stroke="rgba(0,0,0,.08)" />
      </g>
      <rect x="14" y={Y} width="192" height={H} rx="28" fill="none" stroke={low ? '#e57373' : '#9aa5ad'} strokeWidth="2" />
      <rect x="104" y="4" width="12" height="9" rx="1.5" fill="#6b757c" /><circle cx="110" cy="4" r="3.5" fill={GOLD} />
      {[25, 50, 75].map(m => <line key={m} x1="198" x2="206" y1={Y + H * (1 - m / 100)} y2={Y + H * (1 - m / 100)} stroke="#9aa5ad" strokeWidth="1" />)}
    </svg>
  );
};

export const TANK_CSS = `
  .tk-card { background: #fff; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,.07); margin-bottom: 12px; overflow: hidden; }
  .tk-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-bottom: 1px solid #f0f0f0; }
  .tk-hicon { width: 38px; height: 38px; border-radius: 11px; background: #e8f5e9; color: ${PRIMARY}; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .tk-htitle { font-weight: 700; font-size: 15px; color: ${DARK}; }
  .tk-hsub { font-size: 12px; color: #8a8f8a; }
  .tk-sum { margin-inline-start: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .tk-sumbox { background: #f7f8f7; border-radius: 10px; padding: 6px 12px; text-align: center; min-width: 92px; }
  .tk-sumbox .k { font-size: 11px; color: #888; }
  .tk-sumbox .v { font-size: 15px; font-weight: 800; color: ${PRIMARY}; }
  .tk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; padding: 16px 18px 18px; background: #fafbfa; }
  .tk { background: #fff; border: 1px solid #e6ebe6; border-radius: 14px; padding: 12px 14px; cursor: pointer; transition: all .18s; outline: none; }
  /* refill suggestion on the tank */
  .tk-advice { position: absolute; top: 34%; left: 50%; transform: translate(-50%, -50%); white-space: nowrap; z-index: 2;
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 11px; border-radius: 14px; font-size: 12px; font-weight: 800;
    box-shadow: 0 2px 8px rgba(0,0,0,.18); pointer-events: auto; }
  .tk-advice.now { background: #d32f2f; color: #fff; animation: tkBlink 1s ease-in-out infinite, tkGlow 1s ease-in-out infinite; }
  .tk-advice.soon { background: #f59e0b; color: #3b2600; animation: tkBlink 1.6s ease-in-out infinite; }
  .tk-advice.ok { background: rgba(46,125,50,.92); color: #fff; }
  @keyframes tkBlink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
  @keyframes tkGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(211,47,47,.55); } 50% { box-shadow: 0 0 0 7px rgba(211,47,47,0); } }
  .tk:hover, .tk:focus-visible { border-color: ${GOLD}; box-shadow: 0 6px 18px rgba(11,46,24,.10); transform: translateY(-2px); }
  .tk.low { border-color: #f5c2c0; background: linear-gradient(180deg, #fff 60%, #fff7f7 100%); }
  .tk-top { display: flex; align-items: center; gap: 8px; }
  .tk-no { background: ${DARK}; color: ${GOLD}; font-weight: 800; font-size: 12px; padding: 2px 8px; border-radius: 6px; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tk-gas { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .tk-gas { font-size: 12px; color: #666; }
  .tk-pill { margin-inline-start: auto; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 12px; display: inline-flex; align-items: center; gap: 5px; }
  .tk-pill i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .tk-svg { display: block; width: 100%; height: auto; margin: 6px 0 2px; }
  .tk-liquid { transition: y .8s cubic-bezier(.2,.8,.2,1); }
  .tk-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
  .tk-pct { font-size: 30px; font-weight: 800; line-height: 1; direction: ltr; }
  .tk-pct small { font-size: 15px; font-weight: 700; margin-inline-start: 1px; }
  .tk-l { text-align: end; font-size: 12px; color: #777; line-height: 1.5; }
  .tk-l b { font-size: 14px; color: #263238; }
  .tk-bar { height: 6px; border-radius: 3px; background: #eef1ee; margin: 8px 0; overflow: hidden; }
  .tk-bar > div { height: 100%; border-radius: 3px; transition: width .8s; }
  .tk-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; font-size: 11.5px; color: #8a8f8a; gap: 4px 8px; }
  .tk-req { font-size: 11px; color: #1565c0; background: #e3f2fd; border-radius: 10px; padding: 1px 8px; white-space: nowrap; }
  .tk-big { max-width: 380px; margin: 0 auto; }
  .tk-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 230px; border: 2px dashed #cdd8cd; background: transparent; text-align: center; }
  .tk-add:hover, .tk-add:focus-visible { border-color: ${PRIMARY}; background: #f3faf3; }
  .tk-add-ic { width: 52px; height: 52px; border-radius: 50%; background: #e8f5e9; color: ${PRIMARY}; display: flex; align-items: center; justify-content: center; font-size: 22px; }

  .ty-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
  .ty-stats > div { background: #f7f8fa; border-radius: 10px; padding: 8px 10px; }
  .ty-stats .k { font-size: 11px; color: #888; }
  .ty-stats .v { font-size: 15px; font-weight: 700; }
  .ty-hist { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow: auto; }
  .ty-hrow { display: grid; grid-template-columns: 112px 1fr 56px 96px; align-items: center; gap: 8px; font-size: 12px; padding: 4px 6px; border-radius: 6px; }
  .ty-hrow-wrap:nth-child(odd) { background: #fafafa; border-radius: 6px; }
  .ty-hmeta { font-size: 11px; color: #8a8f8a; padding: 0 6px 5px; }
  .ty-form { margin-top: 16px; padding: 14px; border-radius: 12px; background: #f6f8f6; border: 1px solid #e3e8e3; }
  .ty-lbl { font-size: 12px; font-weight: 600; color: #555; margin-bottom: 4px; }
  .ty-lbl .req { color: #c62828; }
  .ty-hint { font-size: 11.5px; color: #1a5c2a; margin-top: 3px; }
  .ty-hbar { height: 8px; border-radius: 4px; background: #eef0ee; overflow: hidden; }
  .ty-hbar > div { height: 100%; border-radius: 4px; }
`;

/** Little SVG line of the level history (oldest → newest). */
const Sparkline: React.FC<{ rows: LevelRow[] }> = ({ rows }) => {
  const pts = [...rows].reverse();
  if (pts.length < 2) return null;
  const W = 520, H = 70;
  const x = (i: number) => (i / (pts.length - 1)) * (W - 8) + 4;
  const y = (p: number) => H - 4 - (Math.max(0, Math.min(100, p)) / 100) * (H - 8);
  const line = pts.map((p, i) => `${x(i)},${y(p.levelPct)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 70, display: 'block' }} aria-label="منحنى مستوى الخزان">
      <line x1="0" x2={W} y1={y(LOW_PCT)} y2={y(LOW_PCT)} stroke="#e57373" strokeDasharray="4 4" strokeWidth="1" />
      <polygon points={`${x(0)},${H} ${line} ${x(pts.length - 1)},${H}`} fill="rgba(26,92,42,.10)" />
      <polyline points={line} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.levelPct)} r="3" fill={EVENT_COLOR[p.eventType ?? ''] ?? PRIMARY}><title>{`${d(p.eventDate)} — ${p.levelPct}%`}</title></circle>)}
    </svg>
  );
};

interface Props {
  buildingId: number;
  canManage?: boolean;
  /** reload trigger from the page */
  reloadKey?: number;
}

// ───────────────────────── add / edit tank ─────────────────────────
interface GasTypeOpt { id: number; code: string; name: string }
const CAPACITY_PRESETS = [500, 1000, 2000, 4000, 7500, 10000];
const TANK_STATUSES = [
  { value: 'ok', label: 'جيد' }, { value: 'low', label: 'منخفض' }, { value: 'maintenance', label: 'صيانة' }, { value: 'out_of_service', label: 'خارج الخدمة' },
];

export const TANK_FORM_CSS = `
  .tf-wrap { display: grid; grid-template-columns: 250px 1fr; gap: 18px; }
  @media (max-width: 720px) { .tf-wrap { grid-template-columns: 1fr; } }
  .tf-preview { background: linear-gradient(180deg, #f3f7f2 0%, #faf7ee 100%); border: 1px solid #e6ebe6; border-radius: 14px; padding: 14px; align-self: start; position: sticky; top: 0; }
  .tf-preview-title { font-size: 11.5px; color: #8a8f8a; margin-bottom: 4px; }
  .tf-preview .tk-top { margin-bottom: 2px; }
  .tf-sec { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 12px 14px 2px; margin-bottom: 12px; }
  .tf-sec-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13.5px; color: ${PRIMARY}; margin-bottom: 10px; }
  .tf-sec-title .ic { width: 28px; height: 28px; border-radius: 8px; background: #e8f5e9; display: inline-flex; align-items: center; justify-content: center; }
  .tf-sec .ant-form-item { margin-bottom: 12px; }
  .tf-sec .ant-form-item-label > label { font-weight: 600; font-size: 12.5px; color: #444; }
  .tf-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 12px; }
  .tf-chip { border: 1.5px solid #dfe6df; background: #fff; color: #3d4a40; border-radius: 16px; padding: 2px 11px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .tf-chip.on { background: ${PRIMARY}; border-color: ${PRIMARY}; color: #fff; }
  .tf-chip:hover { border-color: ${PRIMARY}; }
`;

const TankFormModal: React.FC<{
  open: boolean; buildingId: number; tank?: TankDto | null; nextNo: string;
  onClose: () => void; onSaved: (id?: number) => void;
}> = ({ open, buildingId, tank, nextNo, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [gasTypes, setGasTypes] = useState<GasTypeOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const edit = !!tank;

  useEffect(() => {
    if (!open) return;
    api<GasTypeOpt[]>('/buildings/gas-types').then(setGasTypes).catch(() => setGasTypes([]));
    form.resetFields();
    if (tank) {
      form.setFieldsValue({
        tankNo: tank.tankNo, gasTypeId: tank.gasTypeId, capacity: tank.capacityLitres, levelPct: Math.round(tank.levelPct), status: tank.status,
        serialNo: tank.serialNo, manufacturer: tank.manufacturer, installDate: tank.installDate ? dayjs(tank.installDate) : null,
        lastInspectionDate: tank.lastInspectionDate ? dayjs(tank.lastInspectionDate) : null, nextInspectionDate: tank.nextInspectionDate ? dayjs(tank.nextInspectionDate) : null,
      });
    } else {
      form.setFieldsValue({ capacity: 2000, levelPct: 100, installDate: dayjs(), lastInspectionDate: dayjs(), nextInspectionDate: dayjs().add(1, 'year') });
    }
  }, [open, tank, form]);

  // default gas type (LPG) once the list arrives
  useEffect(() => {
    if (open && !tank && gasTypes.length && !form.getFieldValue('gasTypeId'))
      form.setFieldsValue({ gasTypeId: (gasTypes.find(g => g.code.toUpperCase() === 'LPG') ?? gasTypes[0]).id });
  }, [gasTypes, open, tank, form]);

  const capacity: number = Form.useWatch('capacity', form) ?? 0;
  const levelPct: number = Form.useWatch('levelPct', form) ?? 0;
  const tankNo: string = Form.useWatch('tankNo', form) ?? '';
  const gasTypeId: number | undefined = Form.useWatch('gasTypeId', form);
  const status: string | undefined = Form.useWatch('status', form);
  const gasName = gasTypes.find(g => g.id === gasTypeId)?.name ?? tank?.gasTypeName ?? '';
  const previewPct = edit ? (tank!.capacityLitres && capacity ? Math.min(100, (tank!.currentLevel / capacity) * 100) : 0) : levelPct;
  const preview: TankDto = {
    id: 0, tankNo: tankNo.trim() || nextNo, capacityLitres: capacity, currentLevel: edit ? tank!.currentLevel : (capacity * levelPct) / 100,
    levelPct: previewPct, status: status ?? (previewPct < LOW_PCT ? 'low' : 'ok'), isActive: true, gasTypeName: gasName,
  };
  const pt = tone(preview);

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    const ds = (x?: dayjs.Dayjs | null) => (x ? x.format('YYYY-MM-DD') : null);
    const body = {
      tankNo: v.tankNo?.trim() || null, gasTypeId: v.gasTypeId, capacityLitres: v.capacity,
      currentLevelLitres: edit ? undefined : Math.round((v.capacity * (v.levelPct ?? 0)) / 100 * 1000) / 1000,
      serialNo: v.serialNo?.trim() || null, manufacturer: v.manufacturer?.trim() || null, installDate: ds(v.installDate),
      lastInspectionDate: ds(v.lastInspectionDate), nextInspectionDate: ds(v.nextInspectionDate), status: edit ? v.status : undefined,
    };
    setSaving(true);
    try {
      if (edit) {
        await api(`/buildings/${buildingId}/tanks/${tank!.id}`, { method: 'PUT', body });
        message.success(`تم حفظ بيانات الخزان ${body.tankNo ?? tank!.tankNo}`);
        onSaved(tank!.id);
      } else {
        const r = await api<{ id: number; tankNo: string }>(`/buildings/${buildingId}/tanks`, { body });
        message.success(`تمت إضافة الخزان ${r.tankNo}`);
        onSaved(r.id);
      }
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} width={780} centered destroyOnHidden maskClosable={!saving}
      title={<span><FireOutlined style={{ color: '#d46b08' }} /> {edit ? `تعديل الخزان ${tank!.tankNo}` : 'إضافة خزان غاز'}</span>}
      footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button type="primary" icon={edit ? <EditOutlined /> : <PlusOutlined />} loading={saving} onClick={save}
          style={{ background: PRIMARY, borderColor: PRIMARY, minWidth: 140, fontWeight: 600 }}>{edit ? 'حفظ التعديلات' : 'إضافة الخزان'}</Button>
      </div>}>
      <style>{TANK_FORM_CSS}</style>
      <Form form={form} layout="vertical" requiredMark="optional">
        <div className="tf-wrap">
          {/* live preview */}
          <div className="tf-preview">
            <div className="tf-preview-title">معاينة</div>
            <div className="tk-top">
              <span className="tk-no">{preview.tankNo}</span>
              <span className="tk-gas">{gasName}</span>
              <span className="tk-pill" style={{ color: pt.color, background: `${pt.color}14` }}><i style={{ background: pt.color }} />{pt.label}</span>
            </div>
            <TankShape t={preview} id="tf-preview" />
            <div className="tk-row">
              <div className="tk-pct" style={{ color: pt.color }}>{Math.round(previewPct)}<small>%</small></div>
              <div className="tk-l"><b>{litres(preview.currentLevel)}</b><br />من {litres(capacity)}</div>
            </div>
            <div className="tk-bar"><div style={{ width: `${previewPct}%`, background: `linear-gradient(90deg, ${pt.f1}, ${pt.f2})` }} /></div>
          </div>

          <div>
            <div className="tf-sec">
              <div className="tf-sec-title"><span className="ic"><DatabaseOutlined /></span>بيانات الخزان</div>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="tankNo" label="اسم / رقم الخزان" extra={edit ? undefined : `فارغ = ترقيم تلقائي (${nextNo})`}
                    rules={edit ? [{ required: true, whitespace: true, message: 'مطلوب' }] : undefined}>
                    <Input placeholder={nextNo} maxLength={20} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="gasTypeId" label="نوع الغاز" rules={[{ required: true, message: 'اختر نوع الغاز' }]}>
                    <Select placeholder="اختر" options={gasTypes.map(g => ({ value: g.id, label: g.name }))} notFoundContent="لا توجد أنواع غاز" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="capacity" label="السعة الكاملة" style={{ marginBottom: 8 }}
                    rules={[{ required: true, message: 'أدخل السعة' }, { type: 'number', min: 1, message: 'السعة يجب أن تكون أكبر من صفر' },
                      ...(edit ? [{ validator: (_: unknown, val: number) => (val == null || val >= tank!.currentLevel ? Promise.resolve() : Promise.reject(new Error(`لا يمكن أن تكون أقل من المستوى الحالي (${litres(tank!.currentLevel)})`))) }] : [])]}>
                    <InputNumber min={1} style={{ width: '100%' }} addonAfter="لتر" formatter={x => `${x ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={x => (x ? Number(x.replace(/,/g, '')) : (null as any))} />
                  </Form.Item>
                  <div className="tf-chips">
                    {CAPACITY_PRESETS.map(c => (
                      <button type="button" key={c} className={`tf-chip${capacity === c ? ' on' : ''}`} onClick={() => form.setFieldsValue({ capacity: c })}>{c.toLocaleString()} لتر</button>
                    ))}
                  </div>
                </Col>
              </Row>
            </div>

            {!edit ? (
              <div className="tf-sec">
                <div className="tf-sec-title"><span className="ic"><FireOutlined /></span>كمية الغاز الحالية</div>
                <Row gutter={12} align="middle">
                  <Col xs={24} md={15}>
                    <Form.Item name="levelPct" style={{ marginBottom: 12 }}>
                      <Slider min={0} max={100} marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} tooltip={{ formatter: x => `${x}%` }}
                        styles={{ track: { background: pt.fill } }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={9}>
                    <Form.Item label="باللتر" style={{ marginBottom: 12 }}>
                      <InputNumber min={0} max={capacity || undefined} style={{ width: '100%' }} addonAfter="لتر"
                        value={capacity ? Math.round((capacity * levelPct) / 100) : 0}
                        onChange={x => form.setFieldsValue({ levelPct: capacity ? Math.min(100, Math.max(0, ((Number(x) || 0) / capacity) * 100)) : 0 })} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ) : (
              <div className="tf-sec">
                <div className="tf-sec-title"><span className="ic"><FireOutlined /></span>الحالة</div>
                <Row gutter={12}>
                  <Col xs={24} md={12}><Form.Item name="status" label="حالة الخزان"><Select options={TANK_STATUSES} /></Form.Item></Col>
                  <Col xs={24} md={12}><div style={{ fontSize: 12, color: '#888', paddingTop: 30 }}>الكمية الحالية: <b>{litres(tank!.currentLevel)}</b> — تتغير بقراءة المستوى أو التعبئة.</div></Col>
                </Row>
              </div>
            )}

            <div className="tf-sec">
              <div className="tf-sec-title"><span className="ic"><SafetyCertificateOutlined /></span>التركيب والفحص <Text type="secondary" style={{ fontWeight: 400, fontSize: 11.5 }}>(اختياري)</Text></div>
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item name="serialNo" label="الرقم التسلسلي"><Input style={{ direction: 'ltr' }} placeholder="SN-…" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="manufacturer" label="الشركة المصنعة"><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="installDate" label="تاريخ التركيب"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="lastInspectionDate" label="آخر فحص"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="nextInspectionDate" label="الفحص القادم"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
            </div>
          </div>
        </div>
      </Form>
    </Modal>
  );
};

const BuildingTanksYard: React.FC<Props> = ({ buildingId, canManage, reloadKey = 0 }) => {
  const [rows, setRows] = useState<TankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** the «tanks» permission is needed for the level history / recording a level */
  const [, setCanTanks] = useState(true);
  const [key, setKey] = useState(0);
  const [sel, setSel] = useState<TankRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[] | null>(null);
  const [mode, setMode] = useState<'litres' | 'pct'>('pct');
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const [note, setNote] = useState('');
  /** level reading: when it was read and by whom */
  const [readAt, setReadAt] = useState<dayjs.Dayjs | null>(dayjs());
  const [readBy, setReadBy] = useState<string | undefined>();
  /** «قام بالقراءة» choices: staff (system users) + drivers */
  const [staff, setStaff] = useState<{ employees: { id: number; name: string; phone?: string }[]; drivers: { id: number; name: string; phone?: string }[] }>({ employees: [], drivers: [] });
  useEffect(() => {
    api<typeof staff>('/buildings/staff-options').then(setStaff).catch(() => setStaff({ employees: [], drivers: [] }));
  }, []);
  const { user } = useAuth();
  const myName = user?.nameAr ?? user?.nameEn ?? '';
  const loadLevels = (tankId: number) =>
    api<LevelRow[]>(`/buildings/${buildingId}/tanks/${tankId}/levels`, { query: { take: 50 } }).then(setLevels).catch(() => setLevels([]));
  const [saving, setSaving] = useState(false);
  /** add (null) / edit (tank) form; undefined = closed */
  const [formTank, setFormTank] = useState<TankDto | null | undefined>(undefined);
  /** analysis window (refill forecast, refill periods, monthly history) */
  const [insightsOpen, setInsightsOpen] = useState(false);
  /** refill suggestion per tank, from the building analysis (gas now = last record − tenant meters) */
  const [advice, setAdvice] = useState<Record<number, { kind: 'now' | 'soon' | 'ok'; days?: number; nowLitres: number }>>({});
  useEffect(() => {
    const ctrl = new AbortController();
    api<{ dailyUsageLitres?: number | null; capacityLitres: number; lowLevelPercent: number;
          tanks: { id: number; capacityLitres: number; levelLitres: number; levelPct: number }[] }>(`/buildings/${buildingId}/tank-insights`, { signal: ctrl.signal })
      .then(r => {
        const out: Record<number, { kind: 'now' | 'soon' | 'ok'; days?: number; nowLitres: number }> = {};
        r.tanks.forEach(t => {
          const share = r.capacityLitres > 0 ? t.capacityLitres / r.capacityLitres : 0;
          const daily = (r.dailyUsageLitres ?? 0) * share;
          const days = daily > 0 ? Math.max(0, (t.levelLitres - t.capacityLitres * r.lowLevelPercent / 100) / daily) : undefined;
          out[t.id] = { nowLitres: t.levelLitres, days,
            kind: t.levelPct < r.lowLevelPercent ? 'now' : days != null && days <= 7 ? 'soon' : 'ok' };
        });
        setAdvice(out);
      })
      .catch(() => setAdvice({}));
    return () => ctrl.abort();
  }, [buildingId, reloadKey, key]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    // Tanks come with the building profile (buildings permission). GET /tanks adds last refill / open refill request
    // when the user also has the «tanks» permission.
    Promise.all([
      api<{ tanks?: TankDto[] }>(`/buildings/${buildingId}`, { signal: ctrl.signal }).then(b => b.tanks ?? []).catch(e => { if (e?.name === 'AbortError') throw e; setError(errorMessage(e)); return [] as TankDto[]; }),
      api<Paged<TankRow>>('/tanks', { query: { buildingId, pageSize: 0 }, signal: ctrl.signal })
        .then(r => { setCanTanks(true); return r.items; })
        .catch(e => { if (e?.name === 'AbortError') throw e; setCanTanks(false); return null; }),
    ]).then(([base, extra]) => {
      if (ctrl.signal.aborted) return;
      const byId = new Map((extra ?? []).map(x => [x.tank.id, x]));
      const merged: TankRow[] = base.length
        ? base.map(t => ({ tank: byId.get(t.id)?.tank ?? t, lastRefill: byId.get(t.id)?.lastRefill, openRequest: byId.get(t.id)?.openRequest }))
        : (extra ?? []);
      setRows(merged.filter(x => x.tank.isActive !== false));
      if (merged.length || extra) setError(null);
    }).catch(() => undefined)
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [buildingId, reloadKey, key]);

  // keep the open tank in sync after a reload
  useEffect(() => { setSel(s => (s ? rows.find(r => r.tank.id === s.tank.id) ?? null : s)); }, [rows]);

  const openTank = (r: TankRow) => {
    setSel(r); setLevels(null); setNewLevel(null); setNote(''); setMode('pct'); setReadAt(dayjs()); setReadBy(myName || undefined);
    loadLevels(r.tank.id);
  };

  const totals = useMemo(() => {
    const cap = rows.reduce((s, r) => s + Number(r.tank.capacityLitres || 0), 0);
    const cur = rows.reduce((s, r) => s + Number(r.tank.currentLevel || 0), 0);
    return { cap, cur, pct: cap ? Math.round((cur / cap) * 100) : 0, low: rows.filter(r => r.tank.levelPct < LOW_PCT).length };
  }, [rows]);

  const saveLevel = async () => {
    if (!sel || newLevel == null) { message.warning('أدخل المستوى الحالي'); return; }
    const l = mode === 'pct' ? (newLevel / 100) * sel.tank.capacityLitres : newLevel;
    if (l < 0 || l > sel.tank.capacityLitres) { message.warning(`المستوى يجب أن يكون بين 0 و ${litres(sel.tank.capacityLitres)}`); return; }
    if (!readAt) { message.warning('حدد تاريخ ووقت القراءة'); return; }
    if (readAt.isAfter(dayjs().add(5, 'minute'))) { message.warning('وقت القراءة لا يمكن أن يكون في المستقبل'); return; }
    if (!readBy) { message.warning('اختر من قام بالقراءة'); return; }
    setSaving(true);
    try {
      await api(`/buildings/${buildingId}/tanks/${sel.tank.id}/levels`, { body: {
        levelLitres: Math.round(l * 1000) / 1000, eventType: 'manual_reading', eventDate: readAt.toISOString(),
        readBy, notes: note.trim() || undefined,
      } });
      message.success(`تم تسجيل قراءة الخزان ${sel.tank.tankNo} — ${readAt.format('YYYY-MM-DD HH:mm')}`);
      setNewLevel(null); setNote(''); setReadAt(dayjs());
      setKey(k => k + 1);
      loadLevels(sel.tank.id);
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setSaving(false);
    }
  };

  const totTone = tone({ levelPct: totals.pct });
  const t = sel?.tank;
  const inspDue = t?.nextInspectionDate ? dayjs(t.nextInspectionDate).diff(dayjs(), 'day') : null;

  return (
    <div className="tk-card">
      <style>{TANK_CSS}</style>
      <div className="tk-head">
        <span className="tk-hicon"><FireOutlined /></span>
        <div>
          <div className="tk-htitle">خزانات الغاز ({rows.length})</div>
          <div className="tk-hsub">اضغط على الخزان لعرض التفاصيل وسجل المستوى{canManage ? ' وتسجيل قراءة' : ''}</div>
        </div>
        <div className="tk-sum">
          {totals.low > 0 && <Tag color="error" icon={<WarningOutlined />} style={{ margin: 0 }}>{totals.low} منخفض</Tag>}
          {rows.length > 0 && <>
            <div className="tk-sumbox"><div className="k">المتوفر</div><div className="v" style={{ color: totTone.color }}>{litres(totals.cur)}</div></div>
            <div className="tk-sumbox"><div className="k">السعة الكاملة</div><div className="v" style={{ color: '#263238' }}>{litres(totals.cap)}</div></div>
            <div className="tk-sumbox"><div className="k">نسبة الامتلاء</div><div className="v" style={{ color: totTone.color }}>{totals.pct}%</div></div>
          </>}
          <Tooltip title="تحديث"><Button size="small" type="text" icon={<ReloadOutlined />} loading={loading} onClick={() => setKey(k => k + 1)} /></Tooltip>
          {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormTank(null)}
            style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, fontWeight: 600 }}>إضافة خزان</Button>}
        </div>
      </div>

      {loading && !rows.length ? <div style={{ padding: 30, textAlign: 'center' }}><Spin /></div>
        : !rows.length && error ? <Alert type="warning" showIcon style={{ margin: 12, borderRadius: 8 }} message={`تعذّر تحميل الخزانات: ${error}`} />
        : !rows.length ? <Empty style={{ padding: '18px 0' }} image={<DatabaseOutlined style={{ fontSize: 34, color: '#ccc' }} />} description="لا توجد خزانات غاز مسجّلة لهذا المبنى">
            {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setFormTank(null)}>إضافة أول خزان</Button>}
          </Empty>
        : (
          <div className="tk-grid">
            {rows.map(r => {
              const tn = tone(r.tank);
              const low = r.tank.levelPct < LOW_PCT && !tn.off;
              return (
                <div key={r.tank.id} className={`tk${low ? ' low' : ''}`} role="button" tabIndex={0}
                  onClick={() => openTank(r)} onKeyDown={e => { if (e.key === 'Enter') openTank(r); }}>
                  <div className="tk-top">
                    <span className="tk-no" title={r.tank.tankNo}>{r.tank.tankNo}</span>
                    <span className="tk-gas">{r.tank.gasTypeName ?? r.tank.gasType}</span>
                    <span className="tk-pill" style={{ color: tn.color, background: `${tn.color}14` }}><i style={{ background: tn.color }} />{tn.label}</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <TankShape t={r.tank} id={`t${r.tank.id}`} />
                    {advice[r.tank.id] && (() => {
                      const a = advice[r.tank.id];
                      return (
                        <Tooltip title={`المتوفر الآن تقديرياً ${litres(a.nowLitres)} (آخر قراءة للخزان − استهلاك عدادات المستأجرين)`}>
                          <span className={`tk-advice ${a.kind}`}>
                            {a.kind === 'now' ? <><WarningOutlined /> يحتاج تعبئة الآن</>
                              : a.kind === 'soon' ? <><WarningOutlined /> تعبئة خلال {a.days != null && a.days < 1 ? 'يوم' : `${Math.round(a.days ?? 0)} يوم`}</>
                              : <><CheckOutlined /> لا يحتاج تعبئة</>}
                          </span>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  <div className="tk-row">
                    <div className="tk-pct" style={{ color: tn.color }}>{Math.round(r.tank.levelPct)}<small>%</small></div>
                    <div className="tk-l"><b>{litres(r.tank.currentLevel)}</b><br />من {litres(r.tank.capacityLitres)}</div>
                  </div>
                  <div className="tk-bar"><div style={{ width: `${Math.max(0, Math.min(100, r.tank.levelPct))}%`, background: `linear-gradient(90deg, ${tn.f1}, ${tn.f2})` }} /></div>
                  <div className="tk-foot">
                    <span>{r.lastRefill ? `آخر تعبئة: ${d(r.lastRefill)}` : r.tank.nextInspectionDate ? `الفحص القادم: ${d(r.tank.nextInspectionDate)}` : `السعة ${litres(r.tank.capacityLitres)}`}</span>
                    {r.openRequest && <span className="tk-req"><ThunderboltOutlined /> تعبئة {r.openRequest}</span>}
                  </div>
                  <Button size="small" block icon={<LineChartOutlined />} style={{ marginTop: 10, borderRadius: 8, color: PRIMARY, borderColor: '#cfe3d0' }}
                    onClick={e => { e.stopPropagation(); setInsightsOpen(true); }}>تحليل الاستهلاك والتعبئة</Button>
                </div>
              );
            })}
            {canManage && (
              <div className="tk tk-add" role="button" tabIndex={0} onClick={() => setFormTank(null)} onKeyDown={e => { if (e.key === 'Enter') setFormTank(null); }}>
                <span className="tk-add-ic"><PlusOutlined /></span>
                <div style={{ fontWeight: 700, color: PRIMARY }}>إضافة خزان</div>
                <div style={{ fontSize: 11.5, color: '#999' }}>تسجيل خزان غاز جديد لهذا المبنى</div>
              </div>
            )}
          </div>
        )}

      {/* ── refill forecast (tenant meters) + refills since the start, month by month ── */}
      <Modal open={insightsOpen} onCancel={() => setInsightsOpen(false)} footer={null} width={1150} centered destroyOnHidden
        title={<span><LineChartOutlined style={{ color: PRIMARY }} /> تحليل الاستهلاك والتعبئة — خزانات المبنى</span>}
        styles={{ body: { maxHeight: '78vh', overflow: 'auto', padding: 0 } }}>
        {insightsOpen && <TankInsights buildingId={buildingId} reloadKey={key + reloadKey} />}
      </Modal>

      {/* ── tank details ── */}
      <Modal open={!!sel} onCancel={() => setSel(null)} footer={null} width={640} centered destroyOnHidden
        title={t && <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInlineEnd: 28 }}>
          <span><FireOutlined style={{ color: '#d46b08' }} /> الخزان {t.tankNo} <Text type="secondary" style={{ fontSize: 12 }}>· {t.gasTypeName ?? t.gasType}</Text></span>
          {canManage && <Button size="small" icon={<EditOutlined />} style={{ marginInlineStart: 'auto' }} onClick={() => setFormTank(t)}>تعديل البيانات</Button>}
        </div>}>
        {t && sel && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', background: '#fafbfa', border: '1px solid #eef1ee', borderRadius: 12 }}>
              <div className="tk-big" style={{ flex: 1 }}><TankShape t={t} id={`big${t.id}`} /></div>
              <div style={{ textAlign: 'center', minWidth: 110 }}>
                <div className="tk-pct" style={{ color: tone(t).color, fontSize: 40 }}>{Math.round(t.levelPct)}<small>%</small></div>
                <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{litres(t.currentLevel)}</div>
              </div>
            </div>
            <div className="ty-stats">
              <div><div className="k">المتوفر حالياً</div><div className="v" style={{ color: tone(t).color }}>{litres(t.currentLevel)}</div>{t.currentLevelM3 != null && <div className="k">≈ {Number(t.currentLevelM3).toLocaleString()} م³</div>}</div>
              <div><div className="k">السعة الكاملة</div><div className="v">{litres(t.capacityLitres)}</div></div>
              <div><div className="k">المساحة الفارغة</div><div className="v">{litres(t.capacityLitres - t.currentLevel)}</div><div className="k">كمية التعبئة الممكنة</div></div>
              <div><div className="k">الحالة</div><div className="v" style={{ color: tone(t).color }}>{t.statusLabel ?? tone(t).label}</div></div>
            </div>
            {t.levelPct < LOW_PCT && <Alert type="error" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
              message={sel.openRequest ? `المستوى منخفض — يوجد طلب تعبئة مفتوح ${sel.openRequest}` : 'المستوى منخفض — يُنصح بإنشاء طلب تعبئة'} />}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 12, color: '#666', marginBottom: 14 }}>
              <span><CalendarOutlined /> آخر تعبئة: <b>{d(sel.lastRefill)}</b></span>
              <span><SafetyCertificateOutlined /> آخر فحص: <b>{d(t.lastInspectionDate)}</b></span>
              <span style={{ color: inspDue != null && inspDue < 0 ? '#c62828' : undefined }}><SafetyCertificateOutlined /> الفحص القادم: <b>{d(t.nextInspectionDate)}</b>
                {inspDue != null && inspDue < 0 && <Tag color="error" style={{ marginInlineStart: 6 }}>متأخر {Math.abs(inspDue)} يوم</Tag>}</span>
              {t.serialNo && <span>S/N: <b style={{ fontFamily: 'monospace' }}>{t.serialNo}</b></span>}
              {t.manufacturer && <span><ExperimentOutlined /> {t.manufacturer}</span>}
              {t.installDate && <span>التركيب: <b>{d(t.installDate)}</b></span>}
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}><HistoryOutlined /> سجل المستوى</div>
            {levels == null ? <Spin size="small" /> : levels.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>لا يوجد سجل.</Text> : (
              <>
                <Sparkline rows={levels} />
                <div className="ty-hist" style={{ marginTop: 8 }}>
                  {levels.map(l => {
                    const c = EVENT_COLOR[l.eventType ?? ''] ?? '#888';
                    return (
                      <div key={l.id} className="ty-hrow-wrap">
                        <div className="ty-hrow">
                          <span>{dayjs(l.eventDate).format('YYYY-MM-DD HH:mm')}</span>
                          <div className="ty-hbar"><div style={{ width: `${l.levelPct}%`, background: tone({ levelPct: l.levelPct }).fill }} /></div>
                          <b style={{ textAlign: 'end' }}>{l.levelPct}%</b>
                          <Tag color={c} style={{ margin: 0, fontSize: 10.5, textAlign: 'center' }}>{l.eventTypeLabel ?? l.eventType}</Tag>
                        </div>
                        {(l.readBy || l.notes || l.enteredBy) && (
                          <div className="ty-hmeta">
                            {litres(l.levelLitres)}
                            {l.readBy && <> · <UserOutlined /> قرأها: <b>{l.readBy}</b></>}
                            {l.enteredBy && l.enteredBy !== l.readBy && <> · أدخلها: {l.enteredBy}</>}
                            {l.notes && <> · <span style={{ color: '#666' }}>{l.notes}</span></>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {canManage && (
              <div className="ty-form">
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, color: PRIMARY }}><EditOutlined /> تسجيل قراءة مستوى</div>
                <Row gutter={[10, 10]}>
                  <Col xs={24} md={12}>
                    <div className="ty-lbl">مستوى الخزان <span className="req">*</span></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Radio.Group value={mode} onChange={e => { setMode(e.target.value); setNewLevel(null); }} optionType="button" buttonStyle="solid">
                        <Radio.Button value="pct">%</Radio.Button>
                        <Radio.Button value="litres">لتر</Radio.Button>
                      </Radio.Group>
                      <InputNumber min={0} max={mode === 'pct' ? 100 : t.capacityLitres} value={newLevel} onChange={v => setNewLevel(v)} style={{ flex: 1 }}
                        addonAfter={mode === 'pct' ? '%' : 'لتر'} placeholder={mode === 'pct' ? String(Math.round(t.levelPct)) : String(Math.round(t.currentLevel))} />
                    </div>
                    {newLevel != null && <div className="ty-hint">= {mode === 'pct' ? litres((newLevel / 100) * t.capacityLitres) : `${Math.round((newLevel / t.capacityLitres) * 100)}%`}</div>}
                  </Col>
                  <Col xs={24} md={12}>
                    <div className="ty-lbl">تاريخ ووقت القراءة <span className="req">*</span></div>
                    <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" value={readAt} onChange={setReadAt} style={{ width: '100%' }}
                      disabledDate={x => x.isAfter(dayjs(), 'day')} allowClear={false} />
                  </Col>
                  <Col xs={24} md={12}>
                    <div className="ty-lbl">قام بالقراءة <span className="req">*</span></div>
                    <Select showSearch allowClear value={readBy} onChange={v => setReadBy(v)} style={{ width: '100%' }} optionFilterProp="label"
                      placeholder="اختر الموظف" suffixIcon={<UserOutlined />}
                      notFoundContent="لا يوجد موظفون"
                      options={[
                        { label: 'الموظفون', options: staff.employees.map(e => ({ value: e.name, label: e.phone ? `${e.name} — ${e.phone}` : e.name })) },
                        ...(staff.drivers.length ? [{ label: 'السائقون', options: staff.drivers.map(d => ({ value: d.name, label: d.phone ? `${d.name} — ${d.phone}` : d.name })) }] : []),
                      ]} />
                  </Col>
                  <Col xs={24} md={12}>
                    <div className="ty-lbl">ملاحظات</div>
                    <Input.TextArea value={note} onChange={e => setNote(e.target.value)} autoSize={{ minRows: 1, maxRows: 4 }} maxLength={500}
                      placeholder="مثال: قراءة المؤشر الخارجي / رائحة غاز / المؤشر غير واضح" />
                  </Col>
                </Row>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: 11, color: '#999', flex: 1 }}>التعبئة تُسجَّل من خلال طلبات التعبئة. القراءة بتاريخ أقدم من آخر قراءة تُحفظ في السجل دون تغيير المستوى الحالي.</span>
                  <Button type="primary" loading={saving} onClick={saveLevel} style={{ background: PRIMARY, borderColor: PRIMARY, minWidth: 120, fontWeight: 600 }}>حفظ القراءة</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
      <TankFormModal open={formTank !== undefined} buildingId={buildingId} tank={formTank ?? null} nextNo={`T${rows.length + 1}`}
        onClose={() => setFormTank(undefined)}
        onSaved={() => { setFormTank(undefined); setKey(k => k + 1); }} />
    </div>
  );
};

export default BuildingTanksYard;
