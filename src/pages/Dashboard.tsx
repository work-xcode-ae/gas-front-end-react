import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Tag, Button, Typography, Space, List, Badge, Spin, Alert, Empty, Segmented, DatePicker, Tooltip, Progress } from 'antd';
import {
  BankOutlined, TeamOutlined, FileDoneOutlined, DollarOutlined, WarningOutlined, DashboardOutlined, ToolOutlined, BellOutlined, FireOutlined,
  DatabaseOutlined, ReloadOutlined, PrinterOutlined, DownloadOutlined, RiseOutlined, FallOutlined, ShoppingCartOutlined, WalletOutlined,
  CheckCircleFilled, ExclamationCircleFilled, CloseCircleFilled, FileSearchOutlined, HomeOutlined, PercentageOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import { useNavigate } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../api/client';
import { useGlobalFilters } from '../context/GlobalFilters';
import { meterStatusStyle } from './Meters/meterStatus';

const { Text, Title } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';
const CARD = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none', height: '100%' } as const;
const fmt = (n?: number) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const aed = (n?: number) => `${fmt(n)} د.إ`;
const pctChange = (now: number, before: number) => (before === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / Math.abs(before)) * 1000) / 10);

type Preset = 'month' | 'last_month' | 'quarter' | 'year' | 'custom';
const presetRange = (p: Preset): [Dayjs, Dayjs] => {
  const t = dayjs();
  switch (p) {
    case 'last_month': return [t.subtract(1, 'month').startOf('month'), t.subtract(1, 'month').endOf('month')];
    case 'quarter': return [t.month(Math.floor(t.month() / 3) * 3).startOf('month'), t];
    case 'year': return [t.startOf('year'), t];
    default: return [t.startOf('month'), t];
  }
};

const INV_STATUS: Record<string, { color: string; label: string }> = {
  paid: { color: 'success', label: 'مسددة' }, pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  overdue: { color: 'error', label: 'متأخرة' }, draft: { color: 'default', label: 'مسودة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const PRIORITY: Record<string, { color: string; label: string }> = {
  low: { color: 'default', label: 'منخفضة' }, medium: { color: 'blue', label: 'متوسطة' }, high: { color: 'orange', label: 'عالية' }, urgent: { color: 'red', label: 'عاجلة' },
};
const SR_STATUS: Record<string, { color: string; label: string }> = { pending: { color: 'gold', label: 'معلق' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' } };
const SEVERITY_COLOR: Record<string, string> = { critical: '#ff4d4f', high: '#fa8c16', medium: '#faad14', low: '#1677ff' };
const SEVERITY_LABEL: Record<string, string> = { critical: 'حرجة', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
const ALERT_LINK: Record<string, string> = {
  cd_certificate: '/buildings', amc_contract: '/buildings', supply_contract: '/gas-contracts', meter_calibration: '/meters', tank_inspection: '/buildings', low_tank: '/buildings',
};

type Level = 'good' | 'warn' | 'bad';
interface Health { level: Level; label: string; detail: string; to?: string }

/** Executive summary text + health indicators + follow-up points, written from the period figures. */
function buildSummary(s: any): { paragraphs: string[]; health: Health[]; actions: { text: string; to: string }[] } {
  const c = s.current, p = s.previous, a = s.aging, o = s.operations, m = s.meters, occ = s.occupancy, dq = s.dataQuality, al = s.alerts;
  const period = `${dayjs(s.period.from).format('DD/MM/YYYY')} – ${dayjs(s.period.to).format('DD/MM/YYYY')}`;
  const ch = (now: number, before: number) => {
    if (!before && !now) return 'دون تغيير عن الفترة السابقة';
    const v = pctChange(now, before);
    return v === 0 ? 'دون تغيير عن الفترة السابقة' : `${v > 0 ? 'بارتفاع' : 'بانخفاض'} ${Math.abs(v)}% عن الفترة السابقة`;
  };
  const rate = c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 1000) / 10 : null;
  const overduePct = a.total > 0 ? Math.round((a.overdue / a.total) * 1000) / 10 : 0;
  const occPct = occ.units > 0 ? Math.round((occ.occupied / occ.units) * 1000) / 10 : 0;
  const broken = (m.byStatus ?? []).filter((x: any) => ['fault', 'damaged'].includes(x.status)).reduce((t: number, x: any) => t + x.count, 0);
  const critical = (al.bySeverity?.critical ?? 0) + (al.bySeverity?.high ?? 0);
  const top = s.topDebtors?.[0];
  const noJournal = (dq.invoicesWithoutJournal ?? 0) + (dq.billsWithoutJournal ?? 0);

  const paragraphs: string[] = [
    `المبيعات: خلال الفترة ${period} تم إصدار ${fmt(c.invoiceCount)} فاتورة بقيمة ${aed(c.invoiced)} (${ch(c.invoiced, p.invoiced)})، وتحصيل ${aed(c.collected)} عبر ${fmt(c.receiptCount)} سند قبض (${ch(c.collected, p.collected)})`
      + (rate != null ? `، أي نسبة تحصيل ${rate}% من فواتير الفترة.` : '.')
      + (c.creditNotes > 0 ? ` صدرت إشعارات دائنة بقيمة ${aed(c.creditNotes)}.` : ''),
    `المستحقات: إجمالي المستحقات المفتوحة على العملاء ${aed(a.total)} لدى ${fmt(a.customers)} عميل، منها ${aed(a.overdue)} متأخرة (${overduePct}%)`
      + (a.d90p > 0 ? `، و${aed(a.d90p)} تجاوزت 90 يوماً` : '') + '.'
      + (top ? ` أكبر مديونية لدى «${top.customer}» بمبلغ ${aed(top.amount)}${top.oldestDays > 0 ? ` وأقدم تأخير ${top.oldestDays} يوماً` : ''}.` : ''),
    `المشتريات والنقدية: بلغت المشتريات من الموردين ${aed(c.purchases)} (${ch(c.purchases, p.purchases)})`
      + (c.invoiced || c.purchases ? `، والفرق بين المبيعات والمشتريات ${aed(c.invoiced - c.purchases)}` : '')
      + (s.cash != null ? `. رصيد النقدية والبنوك في الدفاتر ${aed(s.cash)}.` : '.'),
    `التشغيل: استهلك العملاء ${fmt(c.consumptionM3)} م³ من الغاز حسب ${fmt(c.readings)} قراءة (${ch(c.consumptionM3, p.consumptionM3)})، وتم تسليم ${fmt(c.refillLitres)} لتر في ${fmt(c.refills)} عملية تعبئة للخزانات.`
      + (c.newContracts ? ` بدأ ${fmt(c.newContracts)} عقد توريد جديد.` : ''),
    `الأصول والمتابعة: الإشغال ${occPct}% (${fmt(occ.occupied)} من ${fmt(occ.units)} وحدة). لدينا ${fmt(m.total)} عداداً منها ${fmt(m.installed)} مركّب`
      + (broken ? `، و${fmt(broken)} عداد معطل أو تالف` : '') + (m.calibrationExpired ? `، و${fmt(m.calibrationExpired)} عداد انتهت معايرته` : '') + '.'
      + ` يوجد ${fmt(o.openServiceRequests)} طلب خدمة مفتوح${o.staleServiceRequests ? ` (${fmt(o.staleServiceRequests)} أقدم من أسبوع)` : ''}، و${fmt(o.lowTanks)} خزان بمستوى منخفض، و${fmt(al.total)} تنبيه خلال 30 يوماً${critical ? ` منها ${fmt(critical)} عالية الأهمية` : ''}.`,
  ];

  const health: Health[] = [
    rate == null ? { level: 'warn', label: 'نسبة التحصيل', detail: 'لا فواتير في الفترة', to: '/invoices' }
      : { level: rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad', label: 'نسبة التحصيل', detail: `${rate}%`, to: '/payments' },
    { level: overduePct <= 15 ? 'good' : overduePct <= 35 ? 'warn' : 'bad', label: 'المتأخرات من المستحقات', detail: `${overduePct}%`, to: '/overdue' },
    { level: a.d90p <= 0 ? 'good' : a.d90p < a.total * 0.1 ? 'warn' : 'bad', label: 'ديون أكثر من 90 يوماً', detail: aed(a.d90p), to: '/overdue' },
    { level: o.lowTanks === 0 ? 'good' : o.lowTanks <= 2 ? 'warn' : 'bad', label: 'الخزانات المنخفضة', detail: fmt(o.lowTanks), to: '/buildings' },
    { level: broken + m.calibrationExpired === 0 ? 'good' : broken + m.calibrationExpired <= 5 ? 'warn' : 'bad', label: 'العدادات (أعطال + معايرة منتهية)', detail: `${fmt(broken)} + ${fmt(m.calibrationExpired)}`, to: '/meters' },
    { level: o.staleServiceRequests === 0 ? 'good' : o.staleServiceRequests <= 3 ? 'warn' : 'bad', label: 'طلبات خدمة أقدم من أسبوع', detail: fmt(o.staleServiceRequests), to: '/service-requests' },
    { level: noJournal === 0 ? 'good' : 'bad', label: 'ترحيل القيود المحاسبية', detail: noJournal === 0 ? 'مكتمل' : `${fmt(noJournal)} مستند بلا قيد`, to: '/accounting' },
  ];

  const actions: { text: string; to: string }[] = [];
  if (a.d90p > 0) actions.push({ text: `متابعة تحصيل ${aed(a.d90p)} متأخرة أكثر من 90 يوماً`, to: '/overdue' });
  if (top && top.overdue > 0) actions.push({ text: `التواصل مع «${top.customer}» بخصوص ${aed(top.overdue)} متأخرة`, to: '/customers' });
  if (o.lowTanks > 0) actions.push({ text: `طلب تعبئة لـ ${fmt(o.lowTanks)} خزان منخفض`, to: '/buildings' });
  if (broken > 0) actions.push({ text: `صيانة أو استبدال ${fmt(broken)} عداد معطل/تالف`, to: '/meters' });
  if (m.calibrationExpired > 0) actions.push({ text: `إعادة معايرة ${fmt(m.calibrationExpired)} عداد`, to: '/reports?r=meters' });
  if (o.staleServiceRequests > 0) actions.push({ text: `إنهاء ${fmt(o.staleServiceRequests)} طلب خدمة مفتوح منذ أكثر من أسبوع`, to: '/service-requests' });
  if (dq.invoicesWithoutJournal > 0) actions.push({ text: `${fmt(dq.invoicesWithoutJournal)} فاتورة بلا قيد محاسبي — راجع ربط الحسابات والفترات المالية`, to: '/accounting' });
  if (dq.occupiedUnitsWithoutMeter > 0) actions.push({ text: `${fmt(dq.occupiedUnitsWithoutMeter)} وحدة مشغولة بلا عداد مركّب`, to: '/apartments' });
  if (dq.activeContractsNoReading45 > 0) actions.push({ text: `${fmt(dq.activeContractsNoReading45)} عقد نشط بلا قراءة عداد منذ 45 يوماً`, to: '/meters' });
  if (critical > 0) actions.push({ text: `${fmt(critical)} تنبيه عالي الأهمية (شهادات / عقود / معايرة)`, to: '/' });
  return { paragraphs, health, actions };
}

const HEALTH_ICON: Record<Level, React.ReactNode> = {
  good: <CheckCircleFilled style={{ color: '#52c41a' }} />, warn: <ExclamationCircleFilled style={{ color: '#faad14' }} />, bad: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
};

/** One summary panel: title, a small chart and a one-line caption. */
function Panel({ title, caption, color, children }: { title: string; caption: React.ReactNode; color: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #f0f0f0', borderTop: `3px solid ${color}`, borderRadius: 10, padding: '8px 10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color }}>{title}</div>
      <div style={{ flex: 1, minHeight: 120 }}>{children}</div>
      <div style={{ fontSize: 11.5, color: '#666', lineHeight: 1.5 }}>{caption}</div>
    </div>
  );
}

/** Pair of horizontal bars «current vs previous» (or two measures) with values. */
function PairBars({ rows, height = 120 }: { rows: { label: string; a: number; b: number; aName: string; bName: string; colors: [string, string]; unit?: string }[]; height?: number }) {
  const r = rows[0];
  const opts = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', sparkline: { enabled: false } },
    plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 3, distributed: true } },
    colors: r.colors, legend: { show: false }, grid: { show: false, padding: { left: 0, right: 8, top: -10, bottom: -10 } },
    dataLabels: { enabled: true, formatter: (v: number) => fmt(v), style: { fontSize: '10.5px', colors: ['#fff'] } },
    xaxis: { categories: [r.aName, r.bName], labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '11px' } } },
    tooltip: { y: { formatter: (v: number) => `${fmt(v)}${r.unit ? ` ${r.unit}` : ''}` } },
  };
  return <ReactApexChart type="bar" height={height} options={opts as any} series={[{ name: r.label, data: [r.a, r.b] }]} />;
}

function radial(pct: number, color: string, label: string) {
  return {
    series: [Math.max(0, Math.min(100, Math.round(pct)))],
    options: {
      chart: { type: 'radialBar', fontFamily: 'inherit', sparkline: { enabled: true } }, colors: [color],
      plotOptions: { radialBar: { hollow: { size: '58%' }, track: { background: '#f0f0f0' },
        dataLabels: { name: { show: true, fontSize: '10.5px', offsetY: 16, color: '#888' }, value: { fontSize: '17px', fontWeight: 800, offsetY: -8, formatter: (v: number) => `${v}%` } } } },
      labels: [label],
    },
  };
}

/** Executive summary as diagrams: sales & collection, receivables, purchases & cash, operations, assets & follow-up. */
function SummaryVisuals({ s }: { s: any }) {
  const c = s.current, p = s.previous, a = s.aging, o = s.operations, m = s.meters, occ = s.occupancy, al = s.alerts;
  const rate = c.invoiced > 0 ? (c.collected / c.invoiced) * 100 : 0;
  const occPct = occ.units > 0 ? (occ.occupied / occ.units) * 100 : 0;
  const delta = (now: number, before: number) => {
    const v = pctChange(now, before);
    return v === 0 ? <span style={{ color: '#999' }}>دون تغيير</span>
      : <span style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>{v > 0 ? '▲' : '▼'} {Math.abs(v)}%</span>;
  };
  const buckets = [
    { label: 'غير مستحق', v: Number(a.notDue), color: '#52c41a' }, { label: '1–30', v: Number(a.d1_30), color: '#faad14' },
    { label: '31–60', v: Number(a.d31_60), color: '#fa8c16' }, { label: '61–90', v: Number(a.d61_90), color: '#f5222d' }, { label: '+90', v: Number(a.d90p), color: '#820014' },
  ];
  const agingBar = {
    series: buckets.map(b => ({ name: b.label, data: [b.v] })),
    options: {
      chart: { type: 'bar', stacked: true, stackType: '100%', toolbar: { show: false }, fontFamily: 'inherit', sparkline: { enabled: true } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%' } }, colors: buckets.map(b => b.color),
      tooltip: { y: { formatter: (v: number) => aed(v) } }, xaxis: { categories: ['المستحقات'] },
    },
  };
  const broken = (m.byStatus ?? []).filter((x: any) => ['fault', 'damaged'].includes(x.status)).reduce((t: number, x: any) => t + x.count, 0);
  const meterBar = {
    series: (m.byStatus ?? []).map((x: any) => ({ name: x.label, data: [x.count] })),
    options: {
      chart: { type: 'bar', stacked: true, stackType: '100%', toolbar: { show: false }, fontFamily: 'inherit', sparkline: { enabled: true } },
      plotOptions: { bar: { horizontal: true, barHeight: '60%' } }, colors: (m.byStatus ?? []).map((x: any) => meterStatusStyle(x.status).color),
      tooltip: { y: { formatter: (v: number) => `${fmt(v)} عداد` } }, xaxis: { categories: ['العدادات'] },
    },
  };
  const critical = (al.bySeverity?.critical ?? 0) + (al.bySeverity?.high ?? 0);
  return (
    <Row gutter={[10, 10]}>
      <Col xs={24} md={12} xl={8}>
        <Panel title="المبيعات والتحصيل" color={PRIMARY}
          caption={<>مفوتر {aed(c.invoiced)} ({delta(c.invoiced, p.invoiced)}) · محصّل {aed(c.collected)} ({delta(c.collected, p.collected)})</>}>
          <Row align="middle" gutter={4}>
            <Col span={10}><ReactApexChart type="radialBar" height={130} {...radial(rate, rate >= 90 ? '#52c41a' : rate >= 70 ? '#faad14' : '#ff4d4f', 'التحصيل') as any} /></Col>
            <Col span={14}><PairBars rows={[{ label: 'الفترة', a: c.invoiced, b: c.collected, aName: 'مفوتر', bName: 'محصّل', colors: [GOLD, PRIMARY], unit: 'د.إ' }]} /></Col>
          </Row>
        </Panel>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Panel title="المستحقات وأعمار الديون" color="#c62828"
          caption={<>مفتوح {aed(a.total)} لدى {fmt(a.customers)} عميل · متأخر {aed(a.overdue)}{a.d90p > 0 ? <> · <b style={{ color: '#820014' }}>+90 يوم {aed(a.d90p)}</b></> : null}</>}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#c62828', marginTop: 6 }}>{aed(a.overdue)} <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>متأخرة</span></div>
          {a.total > 0 ? <ReactApexChart type="bar" height={60} options={agingBar.options as any} series={agingBar.series} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا مستحقات" />}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10.5 }}>
            {buckets.map(b => <span key={b.label}><Badge color={b.color} /> {b.label}</span>)}
          </div>
        </Panel>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Panel title="المبيعات مقابل المشتريات" color="#ad4e00"
          caption={<>الفرق {aed(c.invoiced - c.purchases)} · المشتريات {delta(c.purchases, p.purchases)}{s.cash != null ? <> · النقدية {aed(s.cash)}</> : null}</>}>
          <PairBars rows={[{ label: 'الفترة', a: c.invoiced, b: c.purchases, aName: 'مبيعات', bName: 'مشتريات', colors: [PRIMARY, '#d4380d'], unit: 'د.إ' }]} />
        </Panel>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Panel title="استهلاك الغاز والتعبئة" color="#d4380d"
          caption={<>استهلاك {fmt(c.consumptionM3)} م³ ({delta(c.consumptionM3, p.consumptionM3)}) · تعبئة {fmt(c.refillLitres)} لتر في {fmt(c.refills)} عملية{c.newContracts ? ` · ${fmt(c.newContracts)} عقد جديد` : ''}</>}>
          <PairBars rows={[{ label: 'م³', a: c.consumptionM3, b: p.consumptionM3, aName: 'الفترة الحالية', bName: 'الفترة السابقة', colors: ['#d4380d', '#ffbb96'], unit: 'م³' }]} />
        </Panel>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Panel title="الإشغال والعدادات" color="#1565c0"
          caption={<>{fmt(occ.occupied)} من {fmt(occ.units)} وحدة مشغولة · {fmt(broken)} عداد معطل/تالف · {fmt(m.calibrationExpired)} معايرة منتهية</>}>
          <Row align="middle" gutter={4}>
            <Col span={10}><ReactApexChart type="radialBar" height={130} {...radial(occPct, '#1565c0', 'الإشغال') as any} /></Col>
            <Col span={14}>{(m.byStatus ?? []).length ? <ReactApexChart type="bar" height={60} options={meterBar.options as any} series={meterBar.series} /> : <Text type="secondary">لا عدادات</Text>}</Col>
          </Row>
        </Panel>
      </Col>
      <Col xs={24} md={12} xl={8}>
        <Panel title="المتابعة والتنبيهات" color="#d48806"
          caption={<>{fmt(o.openServiceRequests)} طلب خدمة مفتوح ({fmt(o.staleServiceRequests)} أقدم من أسبوع) · {fmt(al.total)} تنبيه</>}>
          <Row gutter={[6, 6]} style={{ marginTop: 8 }}>
            {[
              { l: 'تنبيهات عالية', v: critical, c: '#ff4d4f' }, { l: 'خزانات منخفضة', v: o.lowTanks, c: '#fa8c16' },
              { l: 'طلبات متأخرة', v: o.staleServiceRequests, c: '#d48806' }, { l: 'معايرة منتهية', v: m.calibrationExpired, c: '#722ed1' },
            ].map(x => (
              <Col span={12} key={x.l}>
                <div style={{ background: x.v ? `${x.c}14` : '#f6ffed', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: x.v ? x.c : '#52c41a' }}>{fmt(x.v)}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{x.l}</div>
                </div>
              </Col>
            ))}
          </Row>
        </Panel>
      </Col>
    </Row>
  );
}

interface Kpi { title: string; value: string; now: number; before: number; icon: React.ReactNode; color: string; bg: string; to: string; inverse?: boolean; note?: string; points?: boolean; noDelta?: boolean }

const Dashboard: React.FC = () => {
  const nav = useNavigate();
  const { branchId } = useGlobalFilters();
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState<[Dayjs, Dayjs]>(presetRange('month'));
  const [s, setS] = useState<any>(null);
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    setLoading(true);
    const query = { branchId, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') };
    Promise.all([api<any>('/dashboard/summary', { query }), api<any>('/dashboard', { query: { branchId } })])
      .then(([sum, dash]) => { setS(sum); setD(dash); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [branchId, range, key]);

  const summary = useMemo(() => (s ? buildSummary(s) : null), [s]);
  const go = (to: string) => () => nav(to);

  if (loading && !s) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>;
  if (error && !s) return <div style={{ padding: 20 }}><Alert type="error" showIcon message="تعذر تحميل لوحة التحكم" description={error} action={<Button onClick={() => setKey(k => k + 1)}>إعادة المحاولة</Button>} /></div>;
  if (!s || !summary) return null;

  const c = s.current, p = s.previous, a = s.aging;
  const rate = c.invoiced > 0 ? Math.round((c.collected / c.invoiced) * 1000) / 10 : 0;
  const prevRate = p.invoiced > 0 ? Math.round((p.collected / p.invoiced) * 1000) / 10 : 0;

  const kpis: Kpi[] = [
    { title: 'المفوتر (المبيعات)', value: aed(c.invoiced), now: c.invoiced, before: p.invoiced, icon: <FileDoneOutlined />, color: '#a07c1c', bg: '#fdf6e3', to: '/invoices', note: `${fmt(c.invoiceCount)} فاتورة` },
    { title: 'المحصّل', value: aed(c.collected), now: c.collected, before: p.collected, icon: <DollarOutlined />, color: '#2e7d32', bg: '#f1f8e9', to: '/payments', note: `${fmt(c.receiptCount)} سند قبض` },
    { title: 'نسبة التحصيل', value: `${rate}%`, now: rate, before: prevRate, icon: <PercentageOutlined />, color: '#00695c', bg: '#e0f2f1', to: '/payments', points: true },
    { title: 'المتأخرات (اليوم)', value: aed(a.overdue), now: 0, before: 0, noDelta: true, icon: <WarningOutlined />, color: '#c62828', bg: '#ffebee', to: '/overdue', note: `${fmt(a.overdueCustomers)} عميل · المفتوح ${aed(a.total)}` },
    { title: 'المشتريات', value: aed(c.purchases), now: c.purchases, before: p.purchases, icon: <ShoppingCartOutlined />, color: '#ad4e00', bg: '#fff7e6', to: '/invoices', inverse: true, note: `${fmt(c.billCount)} فاتورة مورد` },
    { title: 'استهلاك الغاز', value: `${fmt(c.consumptionM3)} م³`, now: c.consumptionM3, before: p.consumptionM3, icon: <FireOutlined />, color: '#d4380d', bg: '#fff2e8', to: '/reports?r=consumption', note: `${fmt(c.readings)} قراءة` },
    { title: 'تعبئة الخزانات', value: `${fmt(c.refillLitres)} لتر`, now: c.refillLitres, before: p.refillLitres, icon: <DatabaseOutlined />, color: '#1565c0', bg: '#e3f2fd', to: '/reports?r=refills', note: `${fmt(c.refills)} تعبئة` },
    { title: 'النقدية والبنوك', value: s.cash == null ? '—' : aed(s.cash), now: 0, before: 0, noDelta: true, icon: <WalletOutlined />, color: PRIMARY, bg: '#e8f5e9', to: '/accounting', note: 'الرصيد الدفتري الحالي' },
  ];

  const months: string[] = (s.trend.months as string[]).map(m => dayjs(`${m}-01`).format('MM/YY'));
  const trendChart = {
    series: [
      { name: 'المفوتر', type: 'column', data: s.trend.invoiced },
      { name: 'المحصّل', type: 'column', data: s.trend.collected },
      { name: 'المشتريات', type: 'line', data: s.trend.purchases },
    ],
    options: {
      chart: { toolbar: { show: false }, fontFamily: 'inherit' }, colors: [GOLD, PRIMARY, '#d4380d'], stroke: { width: [0, 0, 3], curve: 'smooth' },
      dataLabels: { enabled: false }, xaxis: { categories: months }, yaxis: { labels: { formatter: (v: number) => fmt(v) } }, legend: { position: 'top' },
      plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } }, grid: { borderColor: '#f0f0f0' }, tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => aed(v) } },
    },
  };
  const consChart = {
    series: [{ name: 'الاستهلاك م³', data: s.trend.consumptionM3 }],
    options: {
      chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' }, colors: ['#d4380d'], stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } }, dataLabels: { enabled: false }, xaxis: { categories: months },
      yaxis: { labels: { formatter: (v: number) => fmt(v) } }, grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: (v: number) => `${fmt(v)} م³` } },
    },
  };
  const agingBuckets = [
    { label: 'غير مستحقة بعد', value: Number(a.notDue), color: '#52c41a' }, { label: '1–30 يوم', value: Number(a.d1_30), color: '#faad14' },
    { label: '31–60 يوم', value: Number(a.d31_60), color: '#fa8c16' }, { label: '61–90 يوم', value: Number(a.d61_90), color: '#f5222d' }, { label: 'أكثر من 90 يوم', value: Number(a.d90p), color: '#820014' },
  ];
  const agingChart = {
    series: agingBuckets.map(b => b.value),
    options: {
      chart: { type: 'donut', fontFamily: 'inherit' }, labels: agingBuckets.map(b => b.label), colors: agingBuckets.map(b => b.color), legend: { position: 'bottom' },
      dataLabels: { enabled: false }, tooltip: { y: { formatter: (v: number) => aed(v) } },
      plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'المستحقات', formatter: () => fmt(a.total) } } } } },
    },
  };
  const ms: any[] = s.meters.byStatus ?? [];
  const meterChart = {
    series: ms.map(x => x.count),
    options: {
      chart: { type: 'donut', fontFamily: 'inherit' }, labels: ms.map(x => x.label), colors: ms.map(x => meterStatusStyle(x.status).color),
      legend: { position: 'bottom' }, dataLabels: { enabled: false },
      plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'العدادات' } } } } },
    },
  };
  const occ = s.occupancy;
  const occPct = occ.units > 0 ? Math.round((occ.occupied / occ.units) * 100) : 0;

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [['التقرير التنفيذي', `${s.period.from} → ${s.period.to}`, 'مقارنة', `${s.period.prevFrom} → ${s.period.prevTo}`], [], ['المؤشر', 'الفترة الحالية', 'الفترة السابقة', 'التغير %']];
    const add = (n: string, k: string) => rows.push([n, c[k], p[k], pctChange(Number(c[k]), Number(p[k]))]);
    add('المفوتر', 'invoiced'); add('عدد الفواتير', 'invoiceCount'); add('المحصّل', 'collected'); add('الإشعارات الدائنة', 'creditNotes'); add('المشتريات', 'purchases');
    add('ضريبة المخرجات', 'outputVat'); add('ضريبة المدخلات', 'inputVat'); add('استهلاك الغاز م³', 'consumptionM3'); add('لترات التعبئة', 'refillLitres'); add('عقود جديدة', 'newContracts');
    rows.push([], ['أعمار الديون', 'المبلغ'], ...agingBuckets.map(b => [b.label, b.value]), ['الإجمالي', a.total]);
    rows.push([], ['أكبر المدينين', 'المستحق', 'المتأخر', 'أقدم تأخير (يوم)'], ...(s.topDebtors ?? []).map((x: any) => [x.customer, x.amount, x.overdue, x.oldestDays]));
    rows.push([], ['أعلى المباني فوترة', 'المفوتر', 'المستحق'], ...(s.topBuildings ?? []).map((x: any) => [x.building, x.invoiced, x.outstanding]));
    rows.push([], ['المؤشر', 'الحالة', 'القيمة'], ...summary.health.map(h => [h.label, h.level === 'good' ? 'جيد' : h.level === 'warn' ? 'يحتاج متابعة' : 'ضعيف', h.detail]));
    rows.push([], ['الملخص التنفيذي'], ...summary.paragraphs.map(t => [t]), [], ['نقاط تحتاج متابعة'], ...summary.actions.map(x => [x.text]));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = `التقرير-التنفيذي-${s.period.from}-${s.period.to}.csv`;
    link.click();
  };

  return (
    <div style={{ padding: 20 }} className="dash">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .dash { padding: 0 !important; }
          .dash .ant-card { box-shadow: none !important; border: 1px solid #eee !important; break-inside: avoid; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: block; margin-top: 8px; } }
        .kpi-delta { font-size: 11px; font-weight: 600; margin-top: 2px; }
        .sum-p { font-size: 13.5px; line-height: 1.9; color: #333; margin-bottom: 8px; }
        .sum-p b { color: ${PRIMARY}; }
      `}</style>

      {/* header & period */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${DARK})`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>لوحة التحكم — التقرير التنفيذي</Title>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 12.5 }}>
            الفترة {dayjs(s.period.from).format('DD/MM/YYYY')} – {dayjs(s.period.to).format('DD/MM/YYYY')} ({s.period.days} يوم) · مقارنة بـ {dayjs(s.period.prevFrom).format('DD/MM')} – {dayjs(s.period.prevTo).format('DD/MM/YYYY')}
          </div>
        </div>
        <Space wrap className="no-print" style={{ marginInlineStart: 'auto' }}>
          <Segmented value={preset} onChange={v => { const pr = v as Preset; setPreset(pr); if (pr !== 'custom') setRange(presetRange(pr)); }}
            options={[{ value: 'month', label: 'هذا الشهر' }, { value: 'last_month', label: 'الشهر السابق' }, { value: 'quarter', label: 'هذا الربع' }, { value: 'year', label: 'هذه السنة' }, { value: 'custom', label: 'مخصص' }]} />
          {preset === 'custom' && <DatePicker.RangePicker value={range} allowClear={false} onChange={r => { if (r?.[0] && r?.[1]) setRange([r[0], r[1]]); }} />}
          <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} loading={loading} onClick={() => setKey(x => x + 1)} /></Tooltip>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة / PDF</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Excel</Button>
        </Space>
      </div>

      {/* executive summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={15}>
          <Card style={CARD} title={<Space><FileSearchOutlined style={{ color: PRIMARY }} /><Text strong>الملخص التنفيذي</Text></Space>}
            extra={<Button size="small" type="link" className="no-print" onClick={() => setShowText(x => !x)}>{showText ? 'عرض الرسوم' : 'عرض النص'}</Button>}>
            {showText ? summary.paragraphs.map((t, i) => {
              const [head, ...rest] = t.split(': ');
              return <div key={i} className="sum-p">• <b>{head}:</b> {rest.join(': ')}</div>;
            }) : <SummaryVisuals s={s} />}
            {/* the text version is always printed under the charts */}
            {!showText && <div className="print-only">{summary.paragraphs.map((t, i) => <div key={i} className="sum-p">• {t}</div>)}</div>}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card style={CARD} title={<Text strong>مؤشرات الأداء</Text>} styles={{ body: { paddingTop: 8 } }}>
            {summary.health.map(h => (
              <div key={h.label} onClick={h.to ? go(h.to) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f5f5f5', cursor: h.to ? 'pointer' : undefined }}>
                {HEALTH_ICON[h.level]}<span style={{ flex: 1, fontSize: 13 }}>{h.label}</span><b style={{ fontSize: 13 }}>{h.detail}</b>
              </div>
            ))}
            {summary.actions.length > 0 && (
              <>
                <div style={{ fontWeight: 700, margin: '12px 0 6px', color: '#ad4e00' }}>نقاط تحتاج متابعة</div>
                {summary.actions.slice(0, 7).map((x, i) => (
                  <div key={i} onClick={go(x.to)} style={{ fontSize: 12.5, padding: '3px 0', cursor: 'pointer', color: '#555' }}>{i + 1}. {x.text}</div>
                ))}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* KPIs with comparison */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {kpis.map(k => {
          const ch = pctChange(k.now, k.before);
          const up = ch > 0, good = k.inverse ? !up : up;
          return (
            <Col xs={12} md={8} xl={6} xxl={3} key={k.title}>
              <Card hoverable onClick={go(k.to)} style={CARD} styles={{ body: { padding: 14 } }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{k.icon}</span>
                  <span style={{ fontSize: 12, color: '#777' }}>{k.title}</span>
                </div>
                <div style={{ fontSize: 19, fontWeight: 800, color: k.color, lineHeight: 1.3 }}>{k.value}</div>
                {!k.noDelta && (
                  <div className="kpi-delta" style={{ color: ch === 0 ? '#999' : good ? '#389e0d' : '#cf1322' }}>
                    {ch === 0 ? '— دون تغيير' : <>{up ? <RiseOutlined /> : <FallOutlined />} {k.points ? `${Math.abs(Math.round((k.now - k.before) * 10) / 10)} نقطة` : `${Math.abs(ch)}%`} عن الفترة السابقة</>}
                  </div>
                )}
                {k.note && <div style={{ fontSize: 11, color: '#999' }}>{k.note}</div>}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* finance */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card style={CARD} title={<Text strong>المبيعات والتحصيل والمشتريات — آخر 12 شهراً</Text>} styles={{ body: { padding: '8px 12px' } }}>
            <ReactApexChart options={trendChart.options as any} series={trendChart.series as any} type="line" height={280} />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={5}>
          <Card style={CARD} title={<Text strong>أعمار الديون</Text>} extra={<Button type="link" size="small" onClick={go('/reports?r=aging')} className="no-print">التفاصيل</Button>} styles={{ body: { padding: 8 } }}>
            {Number(a.total) > 0 ? <ReactApexChart options={agingChart.options as any} series={agingChart.series} type="donut" height={270} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا مستحقات مفتوحة" />}
          </Card>
        </Col>
        <Col xs={24} md={12} lg={5}>
          <Card style={CARD} title={<Text strong>أكبر المدينين</Text>} extra={<Button type="link" size="small" onClick={go('/overdue')} className="no-print">الكل</Button>} styles={{ body: { padding: '4px 12px' } }}>
            {(s.topDebtors ?? []).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا يوجد" /> : (s.topDebtors as any[]).map((x, i) => (
              <div key={x.tenantId} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}><span>{i + 1}. {x.customer}</span><b>{fmt(x.amount)}</b></div>
                <Progress percent={a.total ? Math.round((x.amount / a.total) * 100) : 0} size="small" showInfo={false} strokeColor={x.overdue > 0 ? '#ff4d4f' : PRIMARY} />
                <div style={{ fontSize: 11, color: '#999' }}>{x.overdue > 0 ? `متأخر ${fmt(x.overdue)} · ${x.oldestDays} يوم` : 'غير متأخر'}</div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* consumption, buildings, meters */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={9}>
          <Card style={CARD} title={<Text strong>استهلاك الغاز الشهري (م³)</Text>} styles={{ body: { padding: '8px 12px' } }}>
            <ReactApexChart options={consChart.options as any} series={consChart.series} type="area" height={240} />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card style={CARD} title={<Text strong>أعلى المباني فوترةً في الفترة</Text>} styles={{ body: { padding: 0 } }}>
            <Table rowKey="buildingId" size="small" pagination={false} dataSource={s.topBuildings ?? []} locale={{ emptyText: 'لا توجد فواتير في الفترة' }}
              columns={[
                { title: 'المبنى', dataIndex: 'building', render: (v: string, r: any) => <div><b style={{ fontSize: 12.5 }}>{v}</b><div style={{ fontSize: 11, color: '#999' }}>{r.code}</div></div> },
                { title: 'المفوتر', dataIndex: 'invoiced', align: 'end', render: (v: number) => fmt(v) },
                { title: 'المستحق حالياً', dataIndex: 'outstanding', align: 'end', render: (v: number) => <span style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{fmt(v)}</span> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card style={CARD} title={<Text strong>حالة العدادات</Text>} extra={<Button type="link" size="small" onClick={go('/reports?r=meters')} className="no-print">التقرير</Button>} styles={{ body: { padding: 8 } }}>
            {ms.length ? <ReactApexChart options={meterChart.options as any} series={meterChart.series} type="donut" height={220} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد عدادات" />}
            <div style={{ fontSize: 12, textAlign: 'center', color: s.meters.calibrationExpired ? '#cf1322' : '#999' }}>معايرة منتهية: {fmt(s.meters.calibrationExpired)} · بدون تاريخ معايرة: {fmt(s.meters.noCalibration)}</div>
          </Card>
        </Col>
      </Row>

      {/* occupancy / tanks / refill pipeline / data quality */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={5}>
          <Card style={CARD} title={<Space><HomeOutlined /><Text strong>الإشغال</Text></Space>} onClick={go('/apartments')} hoverable>
            <div style={{ textAlign: 'center' }}><Progress type="dashboard" percent={occPct} strokeColor={PRIMARY} size={130} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12.5 }}>
              <span>مشغولة <b>{fmt(occ.occupied)}</b></span><span>شاغرة <b>{fmt(occ.vacant)}</b></span><span>بلا عداد <b>{fmt(occ.withoutMeter)}</b></span>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card style={CARD} title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><Text strong>أدنى مستويات الخزانات</Text></Space>} styles={{ body: { paddingTop: 8 } }}>
            {(s.operations.lowestTanks ?? []).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد خزانات" /> : (s.operations.lowestTanks as any[]).map(t => (
              <div key={t.id} style={{ marginBottom: 8, cursor: 'pointer' }} onClick={go('/buildings')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{t.building} · {t.tankNo}</span><b style={{ color: t.low ? '#cf1322' : '#555' }}>{t.levelPct}%</b></div>
                <Progress percent={Number(t.levelPct)} size="small" showInfo={false} strokeColor={t.levelPct < 25 ? '#ff4d4f' : t.levelPct < 50 ? '#fa8c16' : '#52c41a'} />
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card style={CARD} title={<Space><DatabaseOutlined /><Text strong>طلبات التعبئة الجارية حسب المرحلة</Text></Space>}>
            {(s.operations.refillPipeline ?? []).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد طلبات جارية" /> : (s.operations.refillPipeline as any[]).map(x => (
              <div key={x.stage ?? 'none'} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 12.5 }}>
                <span>{x.label ?? '—'}</span><Tag color="orange" style={{ margin: 0 }}>{x.count}</Tag>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 12, color: '#777' }}>
              طلبات خدمة مفتوحة: <b>{fmt(s.operations.openServiceRequests)}</b> · أقدم من أسبوع: <b style={{ color: s.operations.staleServiceRequests ? '#cf1322' : undefined }}>{fmt(s.operations.staleServiceRequests)}</b>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={7}>
          <Card style={CARD} title={<Space><ToolOutlined /><Text strong>جودة البيانات والترحيل</Text></Space>}>
            {[
              { l: 'فواتير بلا قيد محاسبي', v: s.dataQuality.invoicesWithoutJournal, to: '/accounting' },
              { l: 'فواتير موردين بلا قيد', v: s.dataQuality.billsWithoutJournal, to: '/accounting' },
              { l: 'وحدات مشغولة بلا عداد', v: s.dataQuality.occupiedUnitsWithoutMeter, to: '/apartments' },
              { l: 'عقود نشطة بلا قراءة منذ 45 يوماً', v: s.dataQuality.activeContractsNoReading45, to: '/meters' },
            ].map(x => (
              <div key={x.l} onClick={go(x.to)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 12.5 }}>
                <span>{x.v ? HEALTH_ICON.bad : HEALTH_ICON.good} {x.l}</span><b style={{ color: x.v ? '#cf1322' : '#389e0d' }}>{fmt(x.v)}</b>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* recent activity & alerts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card style={CARD} title={<Text strong>أحدث الفواتير</Text>} extra={<Button type="link" size="small" onClick={go('/invoices')} className="no-print">عرض الكل</Button>} styles={{ body: { padding: 0 } }}>
            <Table rowKey="id" dataSource={d?.recentInvoices ?? []} pagination={false} size="small" locale={{ emptyText: 'لا توجد فواتير' }}
              columns={[
                { title: 'الفاتورة', dataIndex: 'no', render: (v: string, r: any) => <div><Text style={{ color: PRIMARY, fontWeight: 600, fontSize: 12 }}>{v}</Text><div style={{ fontSize: 11, color: '#888' }}>{r.customer}</div></div> },
                { title: 'المبنى', dataIndex: 'building', ellipsis: true },
                { title: 'المبلغ', dataIndex: 'amount', align: 'end', render: (v: number) => <Text strong>{fmt(v)}</Text> },
                { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={INV_STATUS[v]?.color}>{INV_STATUS[v]?.label ?? v}</Tag> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={7}>
          <Card style={CARD} title={<Text strong>طلبات الخدمة المفتوحة</Text>} extra={<Button type="link" size="small" onClick={go('/service-requests')} className="no-print">عرض الكل</Button>} styles={{ body: { padding: 0 } }}>
            <Table rowKey="id" dataSource={d?.serviceRequests ?? []} pagination={false} size="small" locale={{ emptyText: 'لا توجد طلبات مفتوحة' }}
              columns={[
                { title: 'الطلب', dataIndex: 'type', ellipsis: true, render: (v: string, r: any) => <div><Text style={{ fontSize: 12 }}>{v}</Text><div style={{ fontSize: 11, color: '#888' }}>{r.location}</div></div> },
                { title: 'الأولوية', dataIndex: 'priority', width: 80, render: (v: string) => <Tag color={PRIORITY[v]?.color} style={{ fontSize: 10 }}>{PRIORITY[v]?.label ?? v}</Tag> },
                { title: 'الحالة', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={SR_STATUS[v]?.color} style={{ fontSize: 10 }}>{SR_STATUS[v]?.label ?? v}</Tag> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={CARD} title={<Space><BellOutlined style={{ color: '#ff4d4f' }} /><Text strong style={{ color: '#ff4d4f' }}>التنبيهات خلال 30 يوماً ({fmt(s.alerts.total)})</Text></Space>}
            extra={<Space size={6}>{Object.entries(s.alerts.bySeverity ?? {}).map(([k, v]) => (
              <Tooltip key={k} title={SEVERITY_LABEL[k] ?? k}><Badge color={SEVERITY_COLOR[k]} text={<span style={{ fontSize: 11 }}>{String(v)}</span>} /></Tooltip>))}</Space>}>
            {(s.alerts.top ?? []).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد تنبيهات" /> : (
              <List dataSource={s.alerts.top} renderItem={(item: any) => (
                <List.Item style={{ padding: '7px 0', cursor: 'pointer' }} onClick={go(ALERT_LINK[item.type] ?? '/')}>
                  <Space align="start">
                    <Badge color={SEVERITY_COLOR[item.severity] ?? '#1677ff'} />
                    <div>
                      <Text style={{ fontSize: 12.5 }}>{item.messageAr ?? item.messageEn}</Text>
                      <div style={{ fontSize: 11, color: '#999' }}>{item.buildingName ?? ''}{item.daysLeft != null ? ` · ${item.daysLeft < 0 ? `منذ ${-item.daysLeft} يوم` : `خلال ${item.daysLeft} يوم`}` : ''}</div>
                    </div>
                  </Space>
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
      </Row>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 12 }}>
        <TeamOutlined /> {fmt(d?.kpis?.activeCustomers)} عميل نشط · <BankOutlined /> {fmt(d?.kpis?.buildings)} مبنى · <DashboardOutlined /> {fmt(s.meters.total)} عداد · آخر تحديث {dayjs(s.generatedAt).format('YYYY-MM-DD HH:mm')}
      </div>
    </div>
  );
};

export default Dashboard;
