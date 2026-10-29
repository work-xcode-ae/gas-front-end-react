import { useEffect, useState } from 'react';
import { Modal, Button, Form, InputNumber, Input, DatePicker, Select, Space, Typography, Empty, Spin, message } from 'antd';
import { DatabaseOutlined, PlusOutlined, FireOutlined, EditOutlined, DashboardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { TANK_CSS } from '../Buildings/BuildingTanksYard';
import { premisesApi } from '../../api/premises';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';
const LOW_PCT = 25;

/** Tank of GET /premises/{id} → tanks[].tank (same DTO as the building tanks). */
export interface SiteTank {
  id: number; tankNo: string; gasType?: string; gasTypeName?: string; capacityLitres: number; currentLevel: number; levelPct: number;
  currentLevelM3?: number | null; serialNo?: string | null; manufacturer?: string | null; installDate?: string | null;
  lastInspectionDate?: string | null; nextInspectionDate?: string | null; status?: string; statusLabel?: string; isActive?: boolean;
}
interface LevelRow { id: number; eventDate: string; eventType?: string; eventTypeLabel?: string; levelLitres: number; levelPct: number; notes?: string | null }

const L = (v?: number | null) => (v == null ? '—' : `${Math.round(Number(v)).toLocaleString()} لتر`);
const D = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '—');
const tone = (t: Pick<SiteTank, 'levelPct' | 'status' | 'statusLabel'>) => {
  if (t.status === 'maintenance' || t.status === 'out_of_service') return { color: '#8c8c8c', f1: '#cfd4d8', f2: '#a7aeb4', label: t.statusLabel ?? 'خارج الخدمة', off: true };
  if (t.levelPct < LOW_PCT / 2) return { color: '#c62828', f1: '#ef5350', f2: '#c62828', label: 'حرج', off: false };
  if (t.levelPct < LOW_PCT) return { color: '#d84315', f1: '#ff7043', f2: '#d84315', label: 'منخفض', off: false };
  if (t.levelPct < 50) return { color: '#b7791f', f1: '#fbbf24', f2: '#d97706', label: 'متوسط', off: false };
  return { color: '#2e7d32', f1: '#66bb6a', f2: '#2e7d32', label: 'جيد', off: false };
};
const EVENT_COLOR: Record<string, string> = { refill: '#2e7d32', manual_reading: '#1565c0', sensor: '#6a1b9a', adjustment: '#d48806' };

/**
 * Same horizontal LPG tank drawing as the building tanks yard (copied, so the building screen is not touched).
 */
function TankShape({ t, id }: { t: SiteTank; id: string }) {
  const tn = tone(t);
  const pct = Math.max(0, Math.min(100, Number(t.levelPct ?? 0)));
  const Y = 12, H = 56, ly = Y + H * (1 - pct / 100);
  const low = pct < LOW_PCT && !tn.off;
  return (
    <svg className="tk-svg" viewBox="0 0 220 96" role="img" aria-label={`الخزان ${t.tankNo} — ${Math.round(pct)}%`}>
      <defs>
        <linearGradient id={`rsh-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#eef1f3" /><stop offset="1" stopColor="#c9d0d5" /></linearGradient>
        <linearGradient id={`rlq-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tn.f1} /><stop offset="1" stopColor={tn.f2} /></linearGradient>
        <clipPath id={`rcp-${id}`}><rect x="14" y={Y} width="192" height={H} rx="28" /></clipPath>
        <pattern id={`rht-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="rgba(0,0,0,.07)" /></pattern>
      </defs>
      <ellipse cx="110" cy="90" rx="92" ry="4" fill="rgba(0,0,0,.08)" />
      <path d="M52 66 L60 88 L80 88 L88 66 Z" fill="#7b858c" /><path d="M132 66 L140 88 L160 88 L168 66 Z" fill="#7b858c" />
      <rect x="46" y="86" width="48" height="4" rx="1" fill="#5f686e" /><rect x="126" y="86" width="48" height="4" rx="1" fill="#5f686e" />
      <rect x="14" y={Y} width="192" height={H} rx="28" fill={`url(#rsh-${id})`} />
      <g clipPath={`url(#rcp-${id})`}>
        <rect className="tk-liquid" x="0" y={ly} width="220" height={H + 4} fill={`url(#rlq-${id})`} opacity={tn.off ? 0.6 : 0.95} />
        <rect x="0" y={ly} width="220" height="2" fill="rgba(255,255,255,.55)" />
        {tn.off && <rect x="0" y="0" width="220" height="96" fill={`url(#rht-${id})`} />}
        <rect x="30" y={Y + 6} width="160" height="5" rx="2.5" fill="rgba(255,255,255,.75)" />
        <line x1="62" y1={Y} x2="62" y2={Y + H} stroke="rgba(0,0,0,.08)" /><line x1="158" y1={Y} x2="158" y2={Y + H} stroke="rgba(0,0,0,.08)" />
      </g>
      <rect x="14" y={Y} width="192" height={H} rx="28" fill="none" stroke={low ? '#e57373' : '#9aa5ad'} strokeWidth="2" />
      <rect x="104" y="4" width="12" height="9" rx="1.5" fill="#6b757c" /><circle cx="110" cy="4" r="3.5" fill={GOLD} />
      {[25, 50, 75].map(m => <line key={m} x1="198" x2="206" y1={Y + H * (1 - m / 100)} y2={Y + H * (1 - m / 100)} stroke="#9aa5ad" strokeWidth="1" />)}
    </svg>
  );
}

function Sparkline({ rows }: { rows: LevelRow[] }) {
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
      {pts.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.levelPct)} r="3" fill={EVENT_COLOR[p.eventType ?? ''] ?? PRIMARY}><title>{`${D(p.eventDate)} — ${p.levelPct}%`}</title></circle>)}
    </svg>
  );
}

/**
 * Tanks yard of a restaurant (or any villa / restaurant site): same look as the building tanks yard.
 * Restaurant tanks are not building tanks (asset.building_id = NULL), so this uses the tank endpoints directly:
 * GET/POST /tanks/{id}/levels, PUT /tanks/{id}, POST /premises/{id}/tanks.
 */
export default function SiteTanksYard({ premisesId, siteName, tanks, openRequests, canManage, canRefill, onChanged, onRequestRefill }: {
  premisesId: number; siteName?: string; tanks: SiteTank[]; openRequests?: Record<number, string | null | undefined>;
  canManage: boolean; canRefill: boolean; onChanged: () => void; onRequestRefill: () => void;
}) {
  const [sel, setSel] = useState<SiteTank | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lf] = Form.useForm();
  const [af] = Form.useForm();
  const [ef] = Form.useForm();

  const loadLevels = (id: number) => {
    setLevelsLoading(true);
    api<Paged<LevelRow>>(`/tanks/${id}/levels`, { query: { pageSize: 50 } }).then(r => setLevels(r.items)).catch(() => setLevels([])).finally(() => setLevelsLoading(false));
  };
  useEffect(() => { if (sel) { loadLevels(sel.id); lf.resetFields(); lf.setFieldsValue({ levelLitres: sel.currentLevel, eventDate: dayjs() }); } }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cap = tanks.reduce((n, t) => n + Number(t.capacityLitres ?? 0), 0);
  const lvl = tanks.reduce((n, t) => n + Number(t.currentLevel ?? 0), 0);
  const low = tanks.filter(t => Number(t.levelPct) < LOW_PCT).length;

  const saveLevel = async () => {
    const v = await lf.validateFields();
    setSaving(true);
    try {
      await api(`/tanks/${sel!.id}/levels`, { method: 'POST', body: { levelLitres: v.levelLitres, eventType: 'manual_reading', eventDate: v.eventDate.toISOString(), notes: v.notes || null, readBy: v.readBy || null } });
      message.success('تم تسجيل القراءة');
      setSel(null); onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const addTank = async () => {
    const v = await af.validateFields();
    setSaving(true);
    try {
      await premisesApi.addTank(premisesId, { tankNo: v.tankNo || undefined, gasType: v.gasType ?? 'LPG', capacityLitres: v.capacityLitres, currentLevelLitres: v.currentLevelLitres ?? undefined, serialNo: v.serialNo || undefined, manufacturer: v.manufacturer || undefined });
      message.success('تمت إضافة الخزان'); setAddOpen(false); onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const editTank = async () => {
    const v = await ef.validateFields();
    setSaving(true);
    try {
      await api(`/tanks/${sel!.id}`, { method: 'PUT', body: {
        tankNo: v.tankNo, gasType: sel!.gasType, capacityLitres: v.capacityLitres, serialNo: v.serialNo || null, manufacturer: v.manufacturer || null,
        installDate: v.installDate?.format('YYYY-MM-DD') ?? null, lastInspectionDate: v.lastInspectionDate?.format('YYYY-MM-DD') ?? null,
        nextInspectionDate: v.nextInspectionDate?.format('YYYY-MM-DD') ?? null, status: v.status } });
      message.success('تم حفظ الخزان'); setEditOpen(false); setSel(null); onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <div>
      <style>{TANK_CSS}</style>
      <div className="tk-card">
        <div className="tk-head">
          <div className="tk-hicon"><DatabaseOutlined /></div>
          <div>
            <div className="tk-htitle">خزانات {siteName ?? 'المطعم'}</div>
            <div className="tk-hsub">خزانات خاصة بالمطعم — منفصلة عن خزانات المبنى ولا تدخل في حساباته</div>
          </div>
          <div className="tk-sum">
            <div className="tk-sumbox"><div className="k">الخزانات</div><div className="v">{tanks.length}</div></div>
            <div className="tk-sumbox"><div className="k">السعة</div><div className="v">{L(cap)}</div></div>
            <div className="tk-sumbox"><div className="k">المتوفر</div><div className="v">{L(lvl)}</div></div>
            <div className="tk-sumbox"><div className="k">منخفضة</div><div className="v" style={{ color: low ? '#c62828' : PRIMARY }}>{low}</div></div>
            {canRefill && tanks.length > 0 && <Button type="primary" icon={<FireOutlined />} style={{ background: '#fa8c16', borderColor: '#fa8c16' }} onClick={onRequestRefill}>طلب تعبئة</Button>}
          </div>
        </div>
        <div className="tk-grid">
          {tanks.map(t => {
            const tn = tone(t);
            const pct = Math.round(Number(t.levelPct ?? 0));
            return (
              <div key={t.id} className={`tk${pct < LOW_PCT && !tn.off ? ' low' : ''}`} role="button" tabIndex={0} onClick={() => setSel(t)} onKeyDown={e => { if (e.key === 'Enter') setSel(t); }}>
                <div className="tk-top">
                  <span className="tk-no">{t.tankNo}</span>
                  <span className="tk-gas">{t.gasTypeName ?? t.gasType}</span>
                  <span className="tk-pill" style={{ background: `${tn.color}18`, color: tn.color }}><i style={{ background: tn.color }} />{tn.label}</span>
                </div>
                <TankShape t={t} id={`s${t.id}`} />
                <div className="tk-row">
                  <div className="tk-pct" style={{ color: tn.color }}>{pct}<small>%</small></div>
                  <div className="tk-l"><b>{L(t.currentLevel)}</b><br />من {L(t.capacityLitres)}</div>
                </div>
                <div className="tk-bar"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tn.color }} /></div>
                <div className="tk-foot">
                  <span>الفحص القادم: {D(t.nextInspectionDate)}</span>
                  {openRequests?.[t.id] && <span className="tk-req">{openRequests[t.id]}</span>}
                </div>
              </div>
            );
          })}
          {canManage && (
            <div className="tk tk-add" role="button" tabIndex={0} onClick={() => { af.resetFields(); af.setFieldsValue({ gasType: 'LPG' }); setAddOpen(true); }}>
              <div className="tk-add-ic"><PlusOutlined /></div>
              <Text strong>إضافة خزان</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>خزان خاص بالمطعم</Text>
            </div>
          )}
          {!canManage && tanks.length === 0 && <Empty description="لا توجد خزانات" />}
        </div>
      </div>

      {/* tank detail: big drawing, figures, level history, manual reading */}
      <Modal open={!!sel && !editOpen} onCancel={() => setSel(null)} footer={null} width={Math.min(window.innerWidth - 24, 680)} destroyOnHidden
        title={sel && <Space><DatabaseOutlined style={{ color: PRIMARY }} />الخزان {sel.tankNo}<span style={{ color: '#888', fontWeight: 400 }}>{sel.gasTypeName ?? sel.gasType}</span></Space>}>
        {sel && (
          <div>
            <div className="tk-big"><TankShape t={sel} id={`big${sel.id}`} /></div>
            <div className="ty-stats">
              <div><div className="k">المستوى</div><div className="v" style={{ color: tone(sel).color }}>{Math.round(sel.levelPct)}%</div></div>
              <div><div className="k">المتوفر</div><div className="v">{L(sel.currentLevel)}</div></div>
              <div><div className="k">السعة</div><div className="v">{L(sel.capacityLitres)}</div></div>
              <div><div className="k">الفراغ المتاح</div><div className="v">{L(Number(sel.capacityLitres) - Number(sel.currentLevel))}</div></div>
            </div>
            <Space wrap size={[16, 4]} style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              <span>الرقم التسلسلي: {sel.serialNo ?? '—'}</span><span>الشركة المصنعة: {sel.manufacturer ?? '—'}</span>
              <span>آخر فحص: {D(sel.lastInspectionDate)}</span><span>الفحص القادم: {D(sel.nextInspectionDate)}</span>
            </Space>
            <Text strong style={{ display: 'block', margin: '6px 0' }}><DashboardOutlined /> سجل المستوى</Text>
            {levelsLoading ? <Spin /> : levels.length === 0 ? <Text type="secondary">لا توجد قراءات</Text> : <>
              <Sparkline rows={levels} />
              <div className="ty-hist">
                {levels.map(h => (
                  <div key={h.id} className="ty-hrow-wrap">
                    <div className="ty-hrow">
                      <span>{dayjs(h.eventDate).format('YYYY-MM-DD HH:mm')}</span>
                      <div className="ty-hbar"><div style={{ width: `${Math.min(100, h.levelPct)}%`, background: EVENT_COLOR[h.eventType ?? ''] ?? PRIMARY }} /></div>
                      <b>{Math.round(h.levelPct)}%</b>
                      <span style={{ color: EVENT_COLOR[h.eventType ?? ''] ?? '#555' }}>{h.eventTypeLabel ?? h.eventType}</span>
                    </div>
                    {h.notes && <div className="ty-hmeta">{h.notes}</div>}
                  </div>
                ))}
              </div>
            </>}
            {canManage && (
              <div className="ty-form">
                <Form form={lf} layout="vertical" size="small">
                  <Space wrap align="end">
                    <Form.Item name="levelLitres" label="قراءة المستوى (لتر)" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <InputNumber min={0} max={Number(sel.capacityLitres)} style={{ width: 150 }} /></Form.Item>
                    <Form.Item name="eventDate" label="وقت القراءة" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                      <DatePicker showTime disabledDate={x => x.isAfter(dayjs())} /></Form.Item>
                    <Form.Item name="readBy" label="القارئ" style={{ marginBottom: 0 }}><Input style={{ width: 130 }} /></Form.Item>
                    <Form.Item name="notes" label="ملاحظات" style={{ marginBottom: 0 }}><Input style={{ width: 160 }} /></Form.Item>
                    <Button type="primary" loading={saving} onClick={saveLevel} style={{ background: PRIMARY }}>تسجيل</Button>
                  </Space>
                </Form>
              </div>
            )}
            <Space style={{ marginTop: 12 }}>
              {canRefill && <Button icon={<FireOutlined />} onClick={() => { setSel(null); onRequestRefill(); }}>طلب تعبئة</Button>}
              {canManage && <Button icon={<EditOutlined />} onClick={() => {
                ef.setFieldsValue({ tankNo: sel.tankNo, capacityLitres: sel.capacityLitres, serialNo: sel.serialNo, manufacturer: sel.manufacturer, status: sel.status,
                  installDate: sel.installDate ? dayjs(sel.installDate) : undefined, lastInspectionDate: sel.lastInspectionDate ? dayjs(sel.lastInspectionDate) : undefined,
                  nextInspectionDate: sel.nextInspectionDate ? dayjs(sel.nextInspectionDate) : undefined });
                setEditOpen(true);
              }}>تعديل بيانات الخزان</Button>}
            </Space>
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onCancel={() => setAddOpen(false)} onOk={addTank} confirmLoading={saving} title="إضافة خزان للمطعم" okText="إضافة" cancelText="إلغاء"
        okButtonProps={{ style: { background: PRIMARY } }} destroyOnHidden>
        <Form form={af} layout="vertical">
          <Space wrap>
            <Form.Item name="tankNo" label="رقم الخزان"><Input placeholder={`T${tanks.length + 1}`} style={{ width: 120 }} /></Form.Item>
            <Form.Item name="gasType" label="نوع الغاز"><Select style={{ width: 120 }} options={[{ value: 'LPG', label: 'LPG' }, { value: 'NG', label: 'NG' }]} /></Form.Item>
            <Form.Item name="capacityLitres" label="السعة (لتر)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 140 }} /></Form.Item>
            <Form.Item name="currentLevelLitres" label="المستوى الحالي (لتر)"><InputNumber min={0} style={{ width: 140 }} /></Form.Item>
            <Form.Item name="serialNo" label="الرقم التسلسلي"><Input dir="ltr" style={{ width: 160 }} /></Form.Item>
            <Form.Item name="manufacturer" label="الشركة المصنعة"><Input style={{ width: 160 }} /></Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={editOpen} onCancel={() => setEditOpen(false)} onOk={editTank} confirmLoading={saving} title={`تعديل الخزان ${sel?.tankNo ?? ''}`} okText="حفظ" cancelText="إلغاء"
        okButtonProps={{ style: { background: PRIMARY } }} destroyOnHidden>
        <Form form={ef} layout="vertical">
          <Space wrap>
            <Form.Item name="tankNo" label="رقم الخزان" rules={[{ required: true }]}><Input style={{ width: 120 }} /></Form.Item>
            <Form.Item name="capacityLitres" label="السعة (لتر)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 140 }} /></Form.Item>
            <Form.Item name="status" label="الحالة"><Select style={{ width: 150 }} options={[{ value: 'ok', label: 'جيد' }, { value: 'low', label: 'منخفض' }, { value: 'maintenance', label: 'صيانة' }, { value: 'out_of_service', label: 'خارج الخدمة' }]} /></Form.Item>
            <Form.Item name="serialNo" label="الرقم التسلسلي"><Input dir="ltr" style={{ width: 160 }} /></Form.Item>
            <Form.Item name="manufacturer" label="الشركة المصنعة"><Input style={{ width: 160 }} /></Form.Item>
            <Form.Item name="installDate" label="تاريخ التركيب"><DatePicker /></Form.Item>
            <Form.Item name="lastInspectionDate" label="آخر فحص"><DatePicker /></Form.Item>
            <Form.Item name="nextInspectionDate" label="الفحص القادم"><DatePicker /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
