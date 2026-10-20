import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Button, Table, Typography, Space, Segmented, Empty, Statistic, message, Tag, Spin } from 'antd';
import {
  BarChartOutlined, FireOutlined, DollarOutlined, WarningOutlined, HomeOutlined, DatabaseOutlined, ShopOutlined, PercentageOutlined,
  DownloadOutlined, PrinterOutlined, ReloadOutlined, DashboardOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import dayjs, { type Dayjs } from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage, type Paged } from '../../api/client';
import { useGlobalFilters } from '../../context/GlobalFilters';
import { MeterStatusTag, CalibrationTag, CALIBRATION_STATE, meterStatusStyle } from '../Meters/meterStatus';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';
const n0 = (v?: number) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const n2 = (v?: number) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ReportKey = 'consumption' | 'collections' | 'aging' | 'occupancy' | 'meters' | 'refills' | 'vendor-balances' | 'vat';
interface Col { key: string; title: string; money?: boolean; num?: boolean; render?: (r: any) => React.ReactNode; csv?: (r: any) => string | number }

const REPORTS: { key: ReportKey; title: string; icon: React.ReactNode; desc: string; dates?: boolean; building?: boolean; groups?: { value: string; label: string }[] }[] = [
  { key: 'consumption', title: 'استهلاك الغاز', icon: <FireOutlined />, desc: 'استهلاك عدادات المستأجرين (م³)', dates: true, building: true,
    groups: [{ value: 'building', label: 'حسب المبنى' }, { value: 'month', label: 'حسب الشهر' }, { value: 'unit', label: 'حسب الوحدة' }] },
  { key: 'collections', title: 'التحصيل', icon: <DollarOutlined />, desc: 'المدفوعات المستلمة من العملاء', dates: true,
    groups: [{ value: 'month', label: 'حسب الشهر' }, { value: 'method', label: 'حسب طريقة الدفع' }, { value: 'building', label: 'حسب المبنى' }] },
  { key: 'aging', title: 'أعمار الديون', icon: <WarningOutlined />, desc: 'المستحقات حسب أيام التأخير لكل عميل', building: true },
  { key: 'occupancy', title: 'الإشغال', icon: <HomeOutlined />, desc: 'الوحدات المشغولة والشاغرة لكل مبنى' },
  { key: 'meters', title: 'حالة العدادات', icon: <DashboardOutlined />, desc: 'العدادات حسب الحالة (سليم، عطل، تالف…) وصلاحية المعايرة لكل مبنى', building: true,
    groups: [{ value: 'building', label: 'حسب المبنى' }, { value: 'list', label: 'قائمة العدادات' }, { value: 'attention', label: 'تحتاج متابعة' }] },
  { key: 'refills', title: 'تعبئة الخزانات', icon: <DatabaseOutlined />, desc: 'الكميات المسلّمة وتكلفة الشراء لكل مبنى', dates: true },
  { key: 'vendor-balances', title: 'أرصدة الموردين', icon: <ShopOutlined />, desc: 'المفوتر والمدفوع والمستحق لكل مورد' },
  { key: 'vat', title: 'ضريبة القيمة المضافة', icon: <PercentageOutlined />, desc: 'ضريبة المخرجات مقابل المدخلات للفترة', dates: true },
];

const METHOD: Record<string, string> = { cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', online: 'إلكتروني', card: 'بطاقة' };

/** rows, columns, totals and chart for each report */
function shape(key: ReportKey, groupBy: string, data: any): { rows: any[]; cols: Col[]; totals?: { label: string; value: number; money?: boolean; color?: string }[]; chart?: { labels: string[]; series: { name: string; data: number[] }[]; type: 'bar' | 'area' | 'donut' } } {
  if (!data) return { rows: [], cols: [] };
  switch (key) {
    case 'consumption': {
      const rows = data.rows ?? [];
      const cols: Col[] = groupBy === 'month'
        ? [{ key: 'month', title: 'الشهر' }, { key: 'readings', title: 'عدد القراءات', num: true }, { key: 'm3', title: 'الاستهلاك م³', num: true }]
        : groupBy === 'unit'
          ? [{ key: 'code', title: 'المبنى' }, { key: 'unitNo', title: 'الوحدة' }, { key: 'readings', title: 'عدد القراءات', num: true }, { key: 'm3', title: 'الاستهلاك م³', num: true, render: r => n2(r.m3 ?? r.M3), csv: r => r.m3 ?? r.M3 }]
          : [{ key: 'code', title: 'الرمز' }, { key: 'building', title: 'المبنى' }, { key: 'readings', title: 'عدد القراءات', num: true }, { key: 'm3', title: 'الاستهلاك م³', num: true }];
      const lbl = (r: any) => (groupBy === 'month' ? r.month : groupBy === 'unit' ? `${r.code} / ${r.unitNo}` : r.code ?? r.building);
      return { rows, cols, totals: [{ label: 'إجمالي الاستهلاك م³', value: data.total }, { label: 'عدد البنود', value: rows.length }],
        chart: { labels: rows.slice(0, 20).map(lbl), series: [{ name: 'م³', data: rows.slice(0, 20).map((r: any) => Number(r.m3 ?? r.M3 ?? 0)) }], type: groupBy === 'month' ? 'area' : 'bar' } };
    }
    case 'collections': {
      const rows = data.rows ?? [];
      const cols: Col[] = groupBy === 'method'
        ? [{ key: 'label', title: 'طريقة الدفع', render: r => r.label ?? METHOD[r.method] ?? r.method, csv: r => r.label ?? METHOD[r.method] ?? r.method }, { key: 'count', title: 'عدد السندات', num: true }, { key: 'amount', title: 'المبلغ', money: true }]
        : groupBy === 'building'
          ? [{ key: 'code', title: 'الرمز' }, { key: 'building', title: 'المبنى' }, { key: 'amount', title: 'المبلغ المحصّل', money: true }]
          : [{ key: 'month', title: 'الشهر' }, { key: 'count', title: 'عدد السندات', num: true }, { key: 'amount', title: 'المبلغ', money: true }];
      const lbl = (r: any) => (groupBy === 'method' ? r.label ?? METHOD[r.method] ?? r.method : groupBy === 'building' ? r.code ?? r.building : r.month);
      return { rows, cols, totals: [{ label: 'إجمالي المحصّل', value: data.total, money: true, color: '#52c41a' }],
        chart: { labels: rows.map(lbl), series: [{ name: 'المحصّل', data: rows.map((r: any) => Number(r.amount ?? 0)) }], type: groupBy === 'method' ? 'donut' : groupBy === 'month' ? 'area' : 'bar' } };
    }
    case 'aging': {
      const rows = data.rows ?? [];
      const t = data.totals ?? {};
      return {
        rows,
        cols: [{ key: 'tenant', title: 'العميل' }, { key: 'phone', title: 'الهاتف' }, { key: 'current', title: 'غير مستحق بعد', money: true }, { key: 'd30', title: '1-30 يوم', money: true },
          { key: 'd60', title: '31-60 يوم', money: true }, { key: 'd90', title: '61-90 يوم', money: true }, { key: 'over90', title: 'أكثر من 90', money: true }, { key: 'total', title: 'الإجمالي', money: true }],
        totals: [{ label: 'الإجمالي المستحق', value: t.total, money: true, color: '#d4380d' }, { label: '1-30 يوم', value: t.d30, money: true }, { label: '31-60 يوم', value: t.d60, money: true },
          { label: '61-90 يوم', value: t.d90, money: true }, { label: 'أكثر من 90 يوم', value: t.over90, money: true, color: '#ff4d4f' }],
        chart: { labels: ['غير مستحق', '1-30', '31-60', '61-90', '+90'], series: [{ name: 'المبلغ', data: [t.current, t.d30, t.d60, t.d90, t.over90].map(Number) }], type: 'bar' },
      };
    }
    case 'occupancy': {
      const rows = Array.isArray(data) ? data : [];
      const units = rows.reduce((s: number, r: any) => s + r.units, 0), occ = rows.reduce((s: number, r: any) => s + r.occupied, 0);
      return {
        rows,
        cols: [{ key: 'code', title: 'الرمز' }, { key: 'building', title: 'المبنى' }, { key: 'branch', title: 'الفرع' }, { key: 'units', title: 'الوحدات', num: true },
          { key: 'occupied', title: 'مشغولة', num: true }, { key: 'vacant', title: 'شاغرة', num: true }, { key: 'rate', title: 'نسبة الإشغال %', render: r => <Tag color={r.rate >= 80 ? 'success' : r.rate >= 50 ? 'gold' : 'error'}>{r.rate}%</Tag>, csv: r => r.rate }],
        totals: [{ label: 'إجمالي الوحدات', value: units }, { label: 'مشغولة', value: occ, color: '#52c41a' }, { label: 'شاغرة', value: units - occ, color: '#ff4d4f' },
          { label: 'نسبة الإشغال %', value: units ? Math.round(occ * 1000 / units) / 10 : 0 }],
        chart: { labels: rows.map((r: any) => r.code), series: [{ name: 'مشغولة', data: rows.map((r: any) => r.occupied) }, { name: 'شاغرة', data: rows.map((r: any) => r.vacant) }], type: 'bar' },
      };
    }
    case 'meters': {
      const st: any[] = (data.statuses ?? []).filter((x: any) => x.count > 0);
      const t = data.totals ?? {};
      const totals = [{ label: 'إجمالي العدادات', value: t.total }, { label: 'مركّبة', value: t.installed }, { label: 'في المخزون', value: t.inStock },
        ...st.map(x => ({ label: x.label, value: x.count, color: meterStatusStyle(x.status).color })),
        { label: CALIBRATION_STATE.valid.label, value: t.calibrationValid, color: '#52c41a' }, { label: CALIBRATION_STATE.due_soon.label, value: t.calibrationDueSoon, color: '#d48806' },
        { label: CALIBRATION_STATE.expired.label, value: t.calibrationExpired, color: '#cf1322' }];
      const chart = { labels: st.map(x => x.label), series: [{ name: 'العدادات', data: st.map(x => x.count) }], type: 'donut' as const };
      if (groupBy === 'building') {
        const rows = data.byBuilding ?? [];
        const cols: Col[] = [{ key: 'code', title: 'الرمز' }, { key: 'building', title: 'المبنى' }, { key: 'total', title: 'العدادات', num: true },
          ...st.map(x => ({ key: `s_${x.status}`, title: x.label, num: true, render: (r: any) => r.counts?.[x.status] ?? 0, csv: (r: any) => r.counts?.[x.status] ?? 0 })),
          { key: 'calibrationDueSoon', title: 'معايرة قريبة', num: true }, { key: 'calibrationExpired', title: 'معايرة منتهية', num: true }];
        return { rows, cols, totals, chart };
      }
      const all: any[] = data.rows ?? [];
      const rows = groupBy === 'attention'
        ? all.filter(r => ['fault', 'damaged', 'maintenance', 'disconnected', 'lost'].includes(r.status) || (r.status !== 'retired' && r.status !== 'lost' && (r.calibrationState === 'expired' || r.calibrationState === 'due_soon')))
        : all;
      const cols: Col[] = [{ key: 'meterNo', title: 'رقم العداد' }, { key: 'serial', title: 'التسلسلي' }, { key: 'buildingCode', title: 'المبنى', render: r => r.building ? `${r.buildingCode ?? ''} — ${r.building}` : 'في المخزون', csv: r => r.building ?? 'in stock' },
        { key: 'unit', title: 'الوحدة', render: r => r.unit ?? '—', csv: r => r.unit ?? '' },
        { key: 'status', title: 'الحالة', render: r => <MeterStatusTag status={r.status} label={r.statusLabel} />, csv: r => r.statusLabel },
        { key: 'calibrationDate', title: 'تاريخ المعايرة', render: r => r.calibrationDate ?? '—', csv: r => r.calibrationDate ?? '' },
        { key: 'calibrationState', title: 'صلاحية المعايرة', render: r => <CalibrationTag state={r.calibrationState} expiry={r.calibrationExpiry} />, csv: r => CALIBRATION_STATE[r.calibrationState]?.label ?? '' },
        { key: 'calibrationExpiry', title: 'تنتهي في', render: r => r.calibrationExpiry ?? '—', csv: r => r.calibrationExpiry ?? '' },
        { key: 'lastRead', title: 'آخر قراءة', render: r => (r.lastRead ? dayjs(r.lastRead).format('YYYY-MM-DD') : '—'), csv: r => (r.lastRead ? dayjs(r.lastRead).format('YYYY-MM-DD') : '') }];
      return { rows, cols, totals, chart };
    }
    case 'refills': {
      const rows = data.rows ?? [];
      const t = data.totals ?? {};
      return {
        rows,
        cols: [{ key: 'code', title: 'الرمز' }, { key: 'building', title: 'المبنى' }, { key: 'refills', title: 'عدد التعبئات', num: true }, { key: 'litres', title: 'اللترات المسلّمة', num: true }, { key: 'cost', title: 'تكلفة الشراء', money: true }],
        totals: [{ label: 'عدد التعبئات', value: t.refills }, { label: 'اللترات المسلّمة', value: t.litres }, { label: 'تكلفة الشراء', value: t.cost, money: true }],
        chart: { labels: rows.map((r: any) => r.code), series: [{ name: 'لتر', data: rows.map((r: any) => Number(r.litres)) }], type: 'bar' },
      };
    }
    case 'vendor-balances': {
      const rows = Array.isArray(data) ? data : [];
      const sum = (f: string) => rows.reduce((s: number, r: any) => s + Number(r[f] ?? 0), 0);
      return {
        rows,
        cols: [{ key: 'vendor', title: 'المورد' }, { key: 'billed', title: 'المفوتر', money: true }, { key: 'paid', title: 'المدفوع', money: true }, { key: 'outstanding', title: 'المستحق', money: true }],
        totals: [{ label: 'المفوتر', value: sum('billed'), money: true }, { label: 'المدفوع', value: sum('paid'), money: true, color: '#52c41a' }, { label: 'المستحق', value: sum('outstanding'), money: true, color: '#d4380d' }],
        chart: { labels: rows.slice(0, 15).map((r: any) => r.vendor), series: [{ name: 'المستحق', data: rows.slice(0, 15).map((r: any) => Number(r.outstanding)) }], type: 'bar' },
      };
    }
    case 'vat': {
      const rows = [
        { item: 'المبيعات (فواتير العملاء)', net: data.sales?.net, vat: data.sales?.vat },
        { item: 'المشتريات (فواتير الموردين)', net: data.purchases?.net, vat: data.purchases?.vat },
        { item: 'صافي الضريبة المستحقة', net: null, vat: data.payable },
      ];
      return {
        rows,
        cols: [{ key: 'item', title: 'البند' }, { key: 'net', title: 'المبلغ قبل الضريبة', money: true }, { key: 'vat', title: 'الضريبة', money: true }],
        totals: [{ label: 'ضريبة المخرجات', value: data.sales?.vat, money: true }, { label: 'ضريبة المدخلات', value: data.purchases?.vat, money: true },
          { label: data.payable >= 0 ? 'ضريبة مستحقة الدفع' : 'ضريبة مستردة', value: Math.abs(data.payable ?? 0), money: true, color: data.payable >= 0 ? '#d4380d' : '#52c41a' }],
      };
    }
  }
}

function toCsv(cols: Col[], rows: any[]) {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.map(c => esc(c.title)).join(',')];
  rows.forEach(r => lines.push(cols.map(c => esc(c.csv ? c.csv(r) : r[c.key] ?? r[c.key.charAt(0).toUpperCase() + c.key.slice(1)])).join(',')));
  return '﻿' + lines.join('\r\n'); // BOM so Excel opens Arabic correctly
}

const ReportsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { branchId } = useGlobalFilters();
  const initial = (params.get('r') as ReportKey) || 'consumption';
  const [report, setReport] = useState<ReportKey>(REPORTS.some(r => r.key === initial) ? initial : 'consumption');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [groupBy, setGroupBy] = useState<string>('building');
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [buildings, setBuildings] = useState<{ id: number; code: string; name?: string }[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const def = REPORTS.find(r => r.key === report)!;

  useEffect(() => {
    api<Paged<any>>('/buildings', { query: { pageSize: 0 } }).then(r => setBuildings(r.items.map((b: any) => ({ id: b.id, code: b.code ?? b.no, name: b.name })))).catch(() => setBuildings([]));
  }, []);
  useEffect(() => { setGroupBy(def.groups?.[0].value ?? ''); setData(null); setParams({ r: report }, { replace: true }); }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (def.groups && !def.groups.some(g => g.value === groupBy)) return;
    setLoading(true);
    const query: Record<string, any> = { branchId };
    if (def.dates) { query.from = range[0].format('YYYY-MM-DD'); query.to = range[1].format('YYYY-MM-DD'); }
    if (def.groups) query.groupBy = groupBy;
    if (def.building && buildingId) query.buildingId = buildingId;
    api<any>(`/reports/${report}`, { query })
      .then(setData)
      .catch(e => { setData(null); message.error(errorMessage(e)); })
      .finally(() => setLoading(false));
  }, [report, groupBy, range, buildingId, branchId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => shape(report, groupBy, data), [report, groupBy, data]);

  const exportCsv = () => {
    if (!s.rows.length) { message.info('لا توجد بيانات للتصدير'); return; }
    const blob = new Blob([toCsv(s.cols, s.rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${def.title}${def.dates ? ` ${range[0].format('YYYY-MM-DD')}_${range[1].format('YYYY-MM-DD')}` : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  const columns = s.cols.map(c => ({
    title: c.title, key: c.key, align: (c.money || c.num ? 'end' : 'start') as any,
    sorter: c.money || c.num ? (a: any, b: any) => Number(a[c.key] ?? 0) - Number(b[c.key] ?? 0) : undefined,
    render: (_: any, r: any) => c.render ? c.render(r) : c.money ? (r[c.key] == null ? '—' : n2(r[c.key])) : c.num ? n0(r[c.key] ?? r[c.key.charAt(0).toUpperCase() + c.key.slice(1)]) : (r[c.key] ?? r[c.key.charAt(0).toUpperCase() + c.key.slice(1)] ?? '—'),
  }));

  const chart = s.chart && s.chart.labels.length > 0 && (
    s.chart.type === 'donut'
      ? <ReactApexChart type="donut" height={280} series={s.chart.series[0].data} options={{ labels: s.chart.labels, colors: [PRIMARY, GOLD, '#1677ff', '#fa8c16', '#722ed1'], legend: { position: 'bottom' }, chart: { fontFamily: 'inherit' } }} />
      : <ReactApexChart type={s.chart.type} height={280} series={s.chart.series}
          options={{ chart: { toolbar: { show: false }, fontFamily: 'inherit', stacked: report === 'occupancy' }, colors: [PRIMARY, '#ff4d4f', GOLD], dataLabels: { enabled: false },
            xaxis: { categories: s.chart.labels }, yaxis: { labels: { formatter: (v: number) => n0(v) } }, plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
            stroke: { curve: 'smooth', width: s.chart.type === 'area' ? 3 : 0 }, legend: { position: 'top' }, grid: { borderColor: '#f0f0f0' } }} />
  );

  return (
    <div style={{ padding: 20 }} className="reports-page">
      <style>{`@media print { .reports-no-print { display: none !important; } .reports-page { padding: 0 !important; } }`}</style>
      <div className="reports-no-print" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #0b2e18 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChartOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>التقارير</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>تقارير الاستهلاك والتحصيل والمستحقات والإشغال والتعبئة والضريبة</div>
        </div>
      </div>

      <Row gutter={[12, 12]} className="reports-no-print" style={{ marginBottom: 14 }}>
        {REPORTS.map(r => (
          <Col key={r.key} style={{ flex: '1 1 150px', maxWidth: 'none' }}>
            <Card size="small" hoverable onClick={() => setReport(r.key)}
              style={{ borderRadius: 10, height: '100%', border: report === r.key ? `2px solid ${PRIMARY}` : '1px solid #f0f0f0', background: report === r.key ? '#f0f7f2' : '#fff' }}>
              <div style={{ fontSize: 20, color: report === r.key ? PRIMARY : '#999' }}>{r.icon}</div>
              <Text strong style={{ fontSize: 13, color: report === r.key ? PRIMARY : undefined }}>{r.title}</Text>
              <div style={{ fontSize: 11, color: '#999' }}>{r.desc}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} style={{ borderRadius: 12, marginBottom: 14 }} className="reports-no-print">
        <Space wrap>
          {def.dates && <DatePicker.RangePicker allowClear={false} value={range} onChange={v => v && v[0] && v[1] && setRange([v[0], v[1]])} />}
          {def.groups && <Segmented value={groupBy} onChange={v => setGroupBy(String(v))} options={def.groups} />}
          {def.building && (
            <Select allowClear showSearch optionFilterProp="label" placeholder="كل المباني" style={{ width: 220 }} value={buildingId} onChange={setBuildingId}
              options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? ''}` }))} />
          )}
          <Button icon={<ReloadOutlined />} onClick={() => setKey(x => x + 1)}>تحديث</Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>تصدير Excel (CSV)</Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة</Button>
        </Space>
      </Card>

      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: 16, color: PRIMARY }}>{def.title}</Text>
        <Text type="secondary" style={{ fontSize: 12, marginInlineStart: 8 }}>
          {def.dates ? `${range[0].format('YYYY-MM-DD')} → ${range[1].format('YYYY-MM-DD')}` : report === 'aging' && data?.asOf ? `حتى ${data.asOf}` : ''}
          {def.groups ? ` · ${def.groups.find(g => g.value === groupBy)?.label ?? ''}` : ''}
          {buildingId && def.building ? ` · ${buildings.find(b => b.id === buildingId)?.code ?? ''}` : ''}
        </Text>
      </div>

      <Spin spinning={loading}>
        {s.totals && (
          <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
            {s.totals.map(t => (
              <Col key={t.label} xs={12} md={8} xl={Math.max(4, Math.floor(24 / s.totals!.length))}>
                <Card size="small" bordered={false} style={{ borderRadius: 10, background: '#fafafa' }}>
                  <Statistic title={<span style={{ fontSize: 12 }}>{t.label}</span>} value={Number(t.value ?? 0)} precision={t.money ? 2 : 0}
                    valueStyle={{ color: t.color ?? PRIMARY, fontSize: 20, fontWeight: 700 }} suffix={t.money ? <span style={{ fontSize: 12 }}>د.إ</span> : undefined} />
                </Card>
              </Col>
            ))}
          </Row>
        )}
        {chart && <Card bordered={false} style={{ borderRadius: 12, marginBottom: 14 }}>{chart}</Card>}
        <Card bordered={false} style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
          <Table size="small" rowKey={(_, i) => String(i)} dataSource={s.rows} columns={columns} scroll={{ x: 700 }}
            pagination={s.rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
            locale={{ emptyText: <Empty description="لا توجد بيانات للفترة / الفلاتر المحددة" /> }} />
        </Card>
      </Spin>
    </div>
  );
};

export default ReportsPage;
