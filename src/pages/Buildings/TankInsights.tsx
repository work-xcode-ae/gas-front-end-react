import React, { useEffect, useMemo, useState } from 'react';
import { Segmented, Spin, Table, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, ExperimentOutlined, FireOutlined, LineChartOutlined, QuestionCircleOutlined, ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import dayjs from 'dayjs';
import { api } from '../../api/client';

const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';

/** GET /buildings/{id}/tank-insights */
interface MonthRow {
  month: string; refills: number; deliveredLitres: number; consumptionM3: number; consumptionLitres: number;
  tankDropLitres: number; differenceLitres?: number | null; differencePct?: number | null;
}
interface RefillPeriod {
  tankId: number; tankNo: string; from: string; to: string; days: number; tankUsedLitres: number; dailyLitres: number;
  meterLitres?: number | null; differenceLitres?: number | null; differencePct?: number | null; metersComplete: boolean;
}
interface Insights {
  since: string; litreToM3: number; lowLevelPercent: number;
  capacityLitres: number; levelLitres: number; levelPct: number; refillToFullLitres: number;
  recordedLevelLitres: number; recordedAt?: string | null; usedSinceRecordMeasuredLitres: number; usedSinceRecordEstimatedLitres: number;
  metersReadUntil?: string | null;
  dailyUsageLitres?: number | null; rateSource?: 'refill_period' | 'meters' | null;
  refillPeriodRateLitres?: number | null; meterRateLitres?: number | null; meterRateM3?: number | null;
  daysToLow?: number | null; daysToEmpty?: number | null; expectedLowDate?: string | null;
  refillPeriods: RefillPeriod[];
  status: 'refill_now' | 'refill_soon' | 'ok' | 'unknown' | 'no_tanks';
  totals: {
    refills: number; deliveredLitres: number; consumptionM3: number; consumptionLitres: number; months: number; avgRefillsPerMonth: number;
    lastRefill?: string | null; tankDropLitres: number; differenceLitres?: number | null; differencePct?: number | null;
  };
  tanks: { id: number; tankNo: string; capacityLitres: number; recordedLevelLitres: number; recordedAt?: string | null; levelLitres: number; levelPct: number;
    refills: number; deliveredLitres: number; lastRefill?: string | null; openRequest?: string | null }[];
  openRequests: { tankId: number; requestNo: string; requestedQtyLitres: number }[];
  months: MonthRow[];
}

const L = (v?: number | null) => (v == null ? '—' : `${Math.round(Number(v)).toLocaleString()} لتر`);
const M3 = (v?: number | null) => (v == null ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} م³`);
const monthName = (m: string) => dayjs(`${m}-01`).format('MM/YYYY');

const STATUS = {
  refill_now: { color: '#c62828', bg: 'linear-gradient(135deg,#fff1f0,#ffe4e1)', border: '#ffb3ad', icon: <WarningOutlined />, title: 'المبنى يحتاج تعبئة الآن' },
  refill_soon: { color: '#b45309', bg: 'linear-gradient(135deg,#fffbeb,#fff1d6)', border: '#fcd38d', icon: <ClockCircleOutlined />, title: 'يحتاج تعبئة قريباً' },
  ok: { color: '#2e7d32', bg: 'linear-gradient(135deg,#f3faf3,#e8f5e9)', border: '#b7dfb9', icon: <CheckCircleOutlined />, title: 'لا يحتاج تعبئة حالياً' },
  unknown: { color: '#595959', bg: '#fafafa', border: '#e5e5e5', icon: <QuestionCircleOutlined />, title: 'لا يمكن تقدير موعد التعبئة بعد' },
};

/** Refill forecast from the tenants' meters + every refill since the building started, month by month. */
const TankInsights: React.FC<{ buildingId: number; reloadKey: number }> = ({ buildingId, reloadKey }) => {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'chart' | 'table' | 'periods'>('periods');

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api<Insights>(`/buildings/${buildingId}/tank-insights`, { signal: ctrl.signal })
      .then(r => { setData(r); setFailed(false); })
      .catch(e => { if (e?.name !== 'AbortError') setFailed(true); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [buildingId, reloadKey]);

  const months = useMemo(() => [...(data?.months ?? [])], [data]);
  const recent = months.slice(-12);

  if (loading && !data) return <div style={{ padding: 20, textAlign: 'center' }}><Spin size="small" /></div>;
  if (failed || !data || data.status === 'no_tanks') return null;

  const st = STATUS[data.status];
  const t = data.totals;
  const lossBad = (t.differencePct ?? 0) > 10;
  const daysText = (d?: number | null) => (d == null ? '—' : d < 1 ? 'أقل من يوم' : `${Math.round(d)} يوم`);

  const chart = {
    series: [
      { name: 'استهلاك العدادات (لتر)', type: 'column', data: recent.map(m => m.consumptionLitres) },
      { name: 'نقص مستوى الخزانات (لتر)', type: 'column', data: recent.map(m => m.tankDropLitres) },
      { name: 'المُعبّأ (لتر)', type: 'column', data: recent.map(m => m.deliveredLitres) },
      { name: 'عدد التعبئات', type: 'line', data: recent.map(m => m.refills) },
    ],
    options: {
      chart: { toolbar: { show: false }, fontFamily: 'inherit', stacked: false },
      colors: ['#1565c0', '#90a4ae', '#43a047', '#c9a84c'],
      stroke: { width: [0, 0, 0, 3], curve: 'smooth' as const },
      plotOptions: { bar: { columnWidth: '62%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      xaxis: { categories: recent.map(m => monthName(m.month)) },
      yaxis: [
        { seriesName: 'استهلاك العدادات (لتر)', title: { text: 'لتر' }, labels: { formatter: (v: number) => Math.round(v).toLocaleString() } },
        { seriesName: 'استهلاك العدادات (لتر)', show: false },
        { seriesName: 'استهلاك العدادات (لتر)', show: false },
        { seriesName: 'عدد التعبئات', opposite: true, title: { text: 'تعبئات' }, min: 0, forceNiceScale: true, labels: { formatter: (v: number) => String(Math.round(v)) } },
      ],
      legend: { position: 'top' as const, horizontalAlign: 'center' as const, fontSize: '12px' },
      grid: { borderColor: '#f0f0f0' },
      tooltip: { shared: true, intersect: false },
    },
  };

  return (
    <div className="ti">
      <style>{`
        .ti { padding: 4px 18px 18px; background: #fafbfa; }
        .ti-status { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-radius: 14px; padding: 14px 16px; margin: 10px 0 14px; }
        .ti-status-ic { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; background: #fff; flex-shrink: 0; }
        .ti-status-t { font-weight: 800; font-size: 16px; }
        .ti-status-s { font-size: 12.5px; color: #555; margin-top: 2px; }
        .ti-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
        .ti-stat { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 10px 12px; }
        .ti-stat .k { font-size: 11.5px; color: #888; }
        .ti-stat .v { font-size: 17px; font-weight: 800; color: ${DARK}; margin-top: 2px; }
        .ti-stat .s { font-size: 11px; color: #9aa09a; }
        .ti-box { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 12px 14px; }
        .ti-flow { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .ti-step { flex: 1 1 150px; background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 10px 12px; }
        .ti-step.est { border-style: dashed; background: #fffdf7; }
        .ti-step.now { border-width: 2px; }
        .ti-step .k { font-size: 11.5px; color: #888; }
        .ti-step .v { font-size: 18px; font-weight: 800; color: ${DARK}; }
        .ti-step .s { font-size: 11px; color: #9aa09a; }
        .ti-op { align-self: center; font-size: 22px; font-weight: 800; color: #b5bcb6; }
        .ti-note { font-size: 12px; color: #8a6d1f; background: #fbf6e8; border: 1px solid #efe3c4; border-radius: 10px; padding: 7px 12px; margin-bottom: 14px; }
        .ti-head { display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${PRIMARY}; margin-bottom: 8px; flex-wrap: wrap; }
      `}</style>

      {/* ── does the building need a refill? ── */}
      <div className="ti-status" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
        <span className="ti-status-ic" style={{ color: st.color }}>{st.icon}</span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="ti-status-t" style={{ color: st.color }}>
            {data.status === 'refill_soon' ? `يحتاج تعبئة خلال ${daysText(data.daysToLow)}` : st.title}
          </div>
          <div className="ti-status-s">
            {data.status === 'refill_now' && <>المخزون {data.levelPct}% — أقل من الحد الأدنى {data.lowLevelPercent}%. الكمية اللازمة للتعبئة الكاملة {L(data.refillToFullLitres)}.</>}
            {(data.status === 'refill_soon' || data.status === 'ok') && <>
              المتبقي الآن (تقديري) {L(data.levelLitres)} ({data.levelPct}%) — يصل للحد الأدنى {data.lowLevelPercent}% بتاريخ <b>{data.expectedLowDate ? dayjs(data.expectedLowDate).format('YYYY-MM-DD') : '—'}</b>
              {data.daysToEmpty != null && <> · ينفد بالكامل خلال {daysText(data.daysToEmpty)}</>}
            </>}
            {data.status === 'unknown' && <>لا يوجد معدل استهلاك بعد: يلزم إما فترة تعبئة كاملة (تعبئتان بقراءة قبل/بعد) أو قراءات عدادات تغطي 7 أيام على الأقل.</>}
          </div>
        </div>
        {data.openRequests.length > 0
          ? <Tag color="blue" icon={<ThunderboltOutlined />} style={{ margin: 0, padding: '3px 10px', fontSize: 12 }}>طلب تعبئة مفتوح: {data.openRequests.map(r => r.requestNo).join('، ')}</Tag>
          : (data.status === 'refill_now' || data.status === 'refill_soon') && <Tag color="error" style={{ margin: 0, padding: '3px 10px', fontSize: 12 }}>لا يوجد طلب تعبئة مفتوح</Tag>}
      </div>

      {/* ── gas now: last record → meters (measured) → estimate ── */}
      <div className="ti-flow">
        <div className="ti-step">
          <div className="k">آخر قراءة للخزانات (مقاسة)</div>
          <div className="v">{L(data.recordedLevelLitres)}</div>
          <div className="s">{data.recordedAt ? dayjs(data.recordedAt).format('YYYY-MM-DD') : 'لا توجد قراءة مستوى'} — تعبئة أو قراءة مستوى</div>
        </div>
        <span className="ti-op">−</span>
        <div className="ti-step">
          <div className="k">استهلاك العدادات بعدها</div>
          <div className="v">{L(data.usedSinceRecordMeasuredLitres)}</div>
          <div className="s">حتى آخر قراءة عدادات {data.metersReadUntil ? dayjs(data.metersReadUntil).format('YYYY-MM-DD') : '—'} (موزعة على الأيام)</div>
        </div>
        <span className="ti-op">−</span>
        <div className="ti-step est">
          <div className="k">تقدير الأيام غير المقروءة</div>
          <div className="v">{L(data.usedSinceRecordEstimatedLitres)}</div>
          <div className="s">{data.metersReadUntil ? `من ${dayjs(data.metersReadUntil).format('YYYY-MM-DD')} حتى اليوم` : 'لا توجد قراءات عدادات'} × المعدل اليومي</div>
        </div>
        <span className="ti-op">=</span>
        <div className="ti-step now" style={{ borderColor: st.border }}>
          <div className="k">المتوفر الآن (تقديري)</div>
          <div className="v" style={{ color: st.color }}>{L(data.levelLitres)}</div>
          <div className="s">{data.levelPct}% من {L(data.capacityLitres)}</div>
        </div>
      </div>
      {data.metersReadUntil && dayjs().diff(dayjs(data.metersReadUntil), 'day') > 3 && (
        <div className="ti-note"><ClockCircleOutlined /> عدادات المستأجرين لم تُقرأ منذ {dayjs(data.metersReadUntil).format('YYYY-MM-DD')} — الجزء بعد هذا التاريخ تقديري، ويُصحَّح تلقائياً عند إدخال قراءات نهاية الشهر.</div>
      )}

      {/* ── key figures ── */}
      <div className="ti-stats">
        <div className="ti-stat"><div className="k"><FireOutlined /> المعدل اليومي المستخدم</div>
          <div className="v">{L(data.dailyUsageLitres)}</div>
          <div className="s">{data.rateSource === 'refill_period' ? 'من آخر فترة تعبئة (مقاس من الخزان)' : data.rateSource === 'meters' ? 'من عدادات المستأجرين (آخر 30 يوماً مقروءة)' : 'لا يوجد'}</div></div>
        <div className="ti-stat"><div className="k">المعدل حسب المصدر</div>
          <div className="v" style={{ fontSize: 13.5, lineHeight: 1.7 }}>الخزان: {L(data.refillPeriodRateLitres)}<br />العدادات: {L(data.meterRateLitres)}</div>
          <div className="s">{data.meterRateM3 != null ? `${M3(data.meterRateM3)} / يوم` : ''}</div></div>
        <div className="ti-stat"><div className="k"><ClockCircleOutlined /> حتى الحد الأدنى</div><div className="v" style={{ color: st.color }}>{daysText(data.daysToLow)}</div><div className="s">الحد الأدنى {data.lowLevelPercent}% = {L(data.capacityLitres * data.lowLevelPercent / 100)}</div></div>
        <div className="ti-stat"><div className="k"><ThunderboltOutlined /> التعبئات منذ البداية</div><div className="v">{t.refills}</div><div className="s">منذ {dayjs(data.since).format('YYYY-MM')} · {t.avgRefillsPerMonth} / شهر · {L(t.deliveredLitres)}</div></div>
        <div className="ti-stat"><div className="k">استهلاك المستأجرين (العدادات)</div><div className="v">{M3(t.consumptionM3)}</div><div className="s">≈ {L(t.consumptionLitres)} (1 لتر = {data.litreToM3} م³)</div></div>
        <div className="ti-stat" style={lossBad ? { borderColor: '#ffb3ad', background: '#fff7f6' } : undefined}>
          <div className="k"><ExperimentOutlined /> الخزان مقابل العدادات
            <Tooltip title="ما خرج فعلياً من الخزانات مقارنةً بما سجّلته عدادات المستأجرين. الفرق الموجب = فاقد أو عدادات لم تُقرأ.">
              <QuestionCircleOutlined style={{ marginInlineStart: 4 }} /></Tooltip></div>
          <div className="v" style={{ color: lossBad ? '#c62828' : DARK }}>{t.differencePct == null ? '—' : `${t.differencePct > 0 ? '+' : ''}${t.differencePct}%`}</div>
          <div className="s">{t.differenceLitres == null ? 'لا توجد قراءات مستوى كافية' : `فرق ${L(t.differenceLitres)}`}</div>
        </div>
      </div>

      {/* ── month by month ── */}
      <div className="ti-box">
        <div className="ti-head">
          <LineChartOutlined /> التعبئة والاستهلاك شهرياً
          <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>({t.months} شهر منذ {dayjs(data.since).format('YYYY-MM')})</span>
          <Segmented size="small" style={{ marginInlineStart: 'auto' }} value={view} onChange={v => setView(v as 'chart' | 'table')}
            options={[{ value: 'periods', label: `فترات التعبئة (${data.refillPeriods.length})` }, { value: 'chart', label: 'رسم بياني شهري' }, { value: 'table', label: 'كل الأشهر' }]} />
        </div>
        {view === 'periods' ? (
          data.refillPeriods.length === 0
            ? <div style={{ color: '#999', fontSize: 12.5, padding: '10px 0' }}>لا توجد فترات تعبئة كاملة بعد — تُحسب بين تعبئتين مسجّل فيهما المستوى قبل وبعد التعبئة.</div>
            : <Table<RefillPeriod> size="small" rowKey={r => `${r.tankId}-${r.to}`} dataSource={data.refillPeriods} pagination={false}
                columns={[
                  { title: 'الخزان', dataIndex: 'tankNo', width: 80, render: (v: string) => <b>{v}</b> },
                  { title: 'الفترة', key: 'p', render: (_, r) => <span style={{ fontSize: 12 }}>{dayjs(r.from).format('YYYY-MM-DD')} ← {dayjs(r.to).format('YYYY-MM-DD')} <span style={{ color: '#999' }}>({Math.round(r.days)} يوم)</span></span> },
                  { title: 'خرج من الخزان', dataIndex: 'tankUsedLitres', render: (v: number, r) => <span>{L(v)} <span style={{ color: '#999', fontSize: 11 }}>({L(r.dailyLitres)}/يوم)</span></span> },
                  { title: 'سجّلته العدادات', dataIndex: 'meterLitres', render: (v?: number | null, r?: RefillPeriod) => r && !r.metersComplete
                    ? <Tooltip title="العدادات لم تُقرأ بعد حتى نهاية هذه الفترة"><Tag>بانتظار القراءات</Tag></Tooltip> : L(v) },
                  { title: 'الفرق', key: 'd', width: 130, render: (_, r) => r.differencePct == null ? '—'
                    : <Tag color={r.differencePct > 10 ? 'error' : r.differencePct < -10 ? 'warning' : 'success'}>{r.differencePct > 0 ? '+' : ''}{r.differencePct}% ({L(r.differenceLitres)})</Tag> },
                ]} />
        ) : view === 'chart'
          ? <ReactApexChart type="line" height={280} series={chart.series} options={chart.options as any} />
          : (
            <Table<MonthRow> size="small" rowKey="month" dataSource={[...months].reverse()} pagination={months.length > 12 ? { pageSize: 12, size: 'small' } : false}
              columns={[
                { title: 'الشهر', dataIndex: 'month', width: 90, render: (v: string) => <b>{monthName(v)}</b> },
                { title: 'التعبئات', dataIndex: 'refills', width: 80, render: (v: number) => v ? <Tag color="green">{v}</Tag> : <span style={{ color: '#ccc' }}>0</span> },
                { title: 'المُعبّأ', dataIndex: 'deliveredLitres', render: (v: number) => (v ? L(v) : '—') },
                { title: 'استهلاك العدادات', key: 'cons', render: (_, m) => m.consumptionM3 ? <span>{M3(m.consumptionM3)} <span style={{ color: '#999', fontSize: 11 }}>≈ {L(m.consumptionLitres)}</span></span> : '—' },
                { title: 'نقص الخزانات', dataIndex: 'tankDropLitres', render: (v: number) => (v ? L(v) : '—') },
                { title: 'الفرق', key: 'diff', width: 120, render: (_, m) => m.differencePct == null ? '—'
                  : <Tag color={m.differencePct > 10 ? 'error' : m.differencePct < -10 ? 'warning' : 'default'}>{m.differencePct > 0 ? '+' : ''}{m.differencePct}%</Tag> },
              ]} />
          )}
        {data.tanks.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {data.tanks.map(x => (
              <Tag key={x.id} style={{ padding: '3px 10px' }}>
                <b>{x.tankNo}</b>: {x.refills} تعبئة · {L(x.deliveredLitres)}{x.lastRefill ? ` · آخرها ${dayjs(x.lastRefill).format('YYYY-MM-DD')}` : ''}{x.openRequest ? ` · طلب ${x.openRequest}` : ''}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TankInsights;
