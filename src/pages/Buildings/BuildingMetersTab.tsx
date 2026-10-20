import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Spin, Tag, Tooltip, message } from 'antd';
import {
  CalendarOutlined, DatabaseOutlined, EyeOutlined, FireOutlined, HomeOutlined, ReloadOutlined, SearchOutlined, ToolOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { unitsApi, type UnitDto } from '../../api/units';
import UnitProfileDrawer from './UnitProfileDrawer';
import type { UnitAction } from './UnitActionModal';
import { meterStatusStyle, CalibrationTag, MeterStatusModal } from '../Meters/meterStatus';
import { HistoryButton } from '../../components/history/RecordHistory';

const PRIMARY = '#1a5c2a';

/** Row of GET /meters?buildingId= */
interface MeterRow {
  id: number; meterNo: string; serial?: string; unitId?: number | null; unit?: string | null; floor?: number | null;
  type?: string; typeLabel?: string; status?: string; statusLabel?: string; installDate?: string | null;
  lastRead?: string | null; lastReadValue?: number; monthlyAvg?: number; unbilledM3?: number; balance?: number;
  tenantId?: number | null; tenant?: string | null; contractId?: number | null; contractNo?: string | null; brand?: string | null;
  calibrationDate?: string | null; calibrationExpiry?: string | null; calibrationState?: string | null;
}

const st = (s?: string) => { const x = meterStatusStyle(s); return { ...x, border: `${x.color}66` }; };
const floorLabel = (f?: number | null) => (f == null ? '' : f === 0 ? 'الأرضي' : f < 0 ? `B${Math.abs(f)}` : `ط ${f}`);
const m3 = (v?: number | null) => `${Number(v ?? 0).toLocaleString()} م³`;

/** Building profile → «العدادات»: meters installed in this building's units (live data). */
const BuildingMetersTab: React.FC<{ buildingId: number; buildingName?: string; canManage?: boolean; onCount?: (n: number) => void; onChanged?: () => void }> = ({
  buildingId, buildingName, canManage, onCount, onChanged,
}) => {
  const [rows, setRows] = useState<MeterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [unit, setUnit] = useState<UnitDto | null>(null);
  const [openAction, setOpenAction] = useState<{ action: UnitAction; nonce: number } | null>(null);
  const [statusMeter, setStatusMeter] = useState<MeterRow | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api<Paged<MeterRow>>('/meters', { query: { buildingId, pageSize: 0 }, signal: ctrl.signal })
      .then(r => { setRows(r.items); onCount?.(r.items.length); })
      .catch(e => { if (e?.name !== 'AbortError') message.error(errorMessage(e)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [buildingId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = useMemo(() => {
    const avg = rows.length ? Math.round(rows.reduce((t, m) => t + Number(m.monthlyAvg ?? 0), 0) / rows.length) : 0;
    return [
      { label: 'إجمالي العدادات', value: rows.length, color: PRIMARY, bg: '#e8f5e9' },
      { label: 'سليم / نشط', value: rows.filter(m => m.status === 'active').length, color: '#52c41a', bg: '#f6ffed' },
      { label: 'عطل', value: rows.filter(m => m.status === 'fault').length, color: '#ff4d4f', bg: '#fff1f0' },
      { label: 'تالف', value: rows.filter(m => m.status === 'damaged').length, color: '#a8071a', bg: '#fff1f0' },
      { label: 'صيانة', value: rows.filter(m => m.status === 'maintenance').length, color: '#d46b08', bg: '#fff7e6' },
      { label: 'مفصول', value: rows.filter(m => m.status === 'disconnected').length, color: '#8c8c8c', bg: '#f5f5f5' },
      { label: 'معايرة منتهية', value: rows.filter(m => m.calibrationState === 'expired').length, color: '#ad6800', bg: '#fffbe6' },
      { label: 'عداد ذكي', value: rows.filter(m => m.type === 'smart').length, color: '#1677ff', bg: '#e6f4ff' },
      { label: 'متوسط الاستهلاك الشهري', value: m3(avg), color: '#fa8c16', bg: '#fff7e6' },
    ];
  }, [rows]);

  const q = search.trim().toLowerCase();
  const shown = rows.filter(m => (filter === 'all' || (filter === 'cal' ? m.calibrationState === 'expired' || m.calibrationState === 'due_soon' : m.status === filter))
    && (!q || [m.meterNo, m.serial, m.unit, m.tenant, m.contractNo].some(v => (v ?? '').toLowerCase().includes(q))));

  /** open the unit panel (live forms: reading, service request, details) */
  const openUnit = async (m: MeterRow, action?: UnitAction) => {
    if (!m.unitId) { message.info('العداد غير مركّب في وحدة'); return; }
    try {
      const u = await unitsApi.get(m.unitId);
      setUnit(u);
      setOpenAction(action ? { action, nonce: Date.now() } : null);
    } catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      <style>{`
        .bm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
        .bm-card { border-radius: 12px; border: 2px solid; background: #fff; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
        .bm-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #777; }
        .bm-box { background: #f7f8fa; border-radius: 8px; padding: 8px 10px; }
        .bm-box b { color: #263238; font-size: 14px; }
        .bm-meta { font-size: 12px; color: #555; display: flex; align-items: center; gap: 6px; }
      `}</style>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {kpis.map(s => (
          <Card key={s.label} size="small" variant="borderless" style={{ borderRadius: 10, background: s.bg, minWidth: 100, textAlign: 'center', flex: '1 1 90px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#ccc' }} />} placeholder="بحث برقم العداد، الوحدة، المستأجر..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} allowClear />
        {[{ key: 'all', label: 'الكل' }, { key: 'active', label: 'سليم' }, { key: 'fault', label: 'عطل' }, { key: 'damaged', label: 'تالف' }, { key: 'maintenance', label: 'صيانة' },
          { key: 'disconnected', label: 'مفصول' }, { key: 'cal', label: 'معايرة منتهية / قريبة' }].map(f => (
          <Button key={f.key} type={filter === f.key ? 'primary' : 'default'} onClick={() => setFilter(f.key)}
            style={{ borderRadius: 8, ...(filter === f.key ? { background: PRIMARY, borderColor: PRIMARY } : {}) }}>{f.label}</Button>
        ))}
        <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)} loading={loading} /></Tooltip>
      </div>

      <Spin spinning={loading}>
        {!loading && shown.length === 0 ? (
          <Empty image={<FireOutlined style={{ fontSize: 40, color: '#ccc' }} />}
            description={rows.length ? 'لا توجد عدادات مطابقة' : 'لا توجد عدادات مركّبة في وحدات هذا المبنى — ركّب العداد من مخطط الوحدات'} />
        ) : (
          <div className="bm-grid">
            {shown.map(m => {
              const s = st(m.status);
              const owes = Number(m.balance ?? 0) > 0;
              const unbilled = Number(m.unbilledM3 ?? 0);
              return (
                <div key={m.id} className="bm-card" style={{ borderColor: s.border }}>
                  <div className="bm-row">
                    <div>
                      <div style={{ fontWeight: 700, color: PRIMARY, fontSize: 14, fontFamily: 'monospace' }}>{m.meterNo}</div>
                      <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{m.serial}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <Tag style={{ margin: 0, color: s.color, background: s.bg, borderColor: s.border }}>{m.statusLabel ?? s.label}</Tag>
                      <div><Tag color={m.type === 'smart' ? 'blue' : 'default'} style={{ margin: '4px 0 0', fontSize: 11 }}>{m.typeLabel ?? m.type ?? '—'}</Tag></div>
                      <div style={{ marginTop: 4 }}><CalibrationTag state={m.calibrationState} expiry={m.calibrationExpiry} short /></div>
                    </div>
                  </div>
                  <div className="bm-box">
                    <div className="bm-row"><span>آخر قراءة</span><b>{m3(m.lastReadValue)}</b></div>
                    <div className="bm-row" style={{ marginTop: 4 }}><span>متوسط شهري</span><span>{m3(m.monthlyAvg)}</span></div>
                    <div className="bm-row" style={{ marginTop: 4 }}><span>غير مفوتر</span><span style={{ color: '#d46b08' }}>{m3(m.unbilledM3)}</span></div>
                  </div>
                  <div className="bm-row"><span>رصيد المستأجر</span>
                    {!m.contractId ? <b style={{ color: '#aaa' }}>—</b>
                      : owes ? <Tooltip title="مبالغ فواتير صادرة لم تُسدَّد"><b style={{ color: '#cf1322' }}>{`${Number(m.balance).toLocaleString()} د.إ مستحق`}</b></Tooltip>
                      : unbilled > 0 ? <Tooltip title={`لا توجد فواتير غير مسددة، لكن ${m3(unbilled)} لم تصدر بها فاتورة بعد`}><b style={{ color: '#d46b08' }}>بانتظار الفوترة</b></Tooltip>
                      : <Tooltip title="لا فواتير مستحقة ولا استهلاك غير مفوتر"><b style={{ color: PRIMARY }}>لا مستحقات</b></Tooltip>}</div>
                  <div className="bm-meta"><HomeOutlined style={{ color: '#999' }} /> {m.unit ? `${m.unit}${m.floor != null ? ` — ${floorLabel(m.floor)}` : ''}` : 'غير مركّب'}</div>
                  <div className="bm-meta"><UserOutlined style={{ color: '#999' }} /> {m.tenant ?? <span style={{ color: '#aaa' }}>بدون مستأجر</span>}</div>
                  <div className="bm-meta" style={{ color: '#999' }}><CalendarOutlined /> آخر قراءة: {m.lastRead ? dayjs(m.lastRead).format('YYYY-MM-DD') : '—'}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    {canManage && <Button size="small" icon={<DatabaseOutlined />} onClick={() => openUnit(m, 'reading')}>قراءة</Button>}
                    {canManage && <Button size="small" icon={<ToolOutlined />} onClick={() => openUnit(m, 'service')}>طلب خدمة</Button>}
                    {canManage && <Button size="small" onClick={() => setStatusMeter(m)}>الحالة</Button>}
                    <HistoryButton entityType="Meter" id={m.id} title={`عداد ${m.meterNo}`} label={null} />
                    <Button size="small" type="primary" icon={<EyeOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY, marginInlineStart: 'auto' }}
                      onClick={() => openUnit(m)}>تفاصيل</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      <MeterStatusModal meter={statusMeter} onClose={() => setStatusMeter(null)} onSaved={() => { setKey(k => k + 1); onChanged?.(); }} />
      <UnitProfileDrawer unit={unit} buildingName={buildingName} canManage={canManage} openAction={openAction}
        onClose={() => { setUnit(null); setOpenAction(null); }}
        onChanged={() => { setKey(k => k + 1); onChanged?.(); unit && unitsApi.get(unit.id).then(setUnit).catch(() => undefined); }} />
    </div>
  );
};

export default BuildingMetersTab;
