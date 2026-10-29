import { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Button, Tag, Input, Select, Space, Typography, Tooltip, Progress, Empty, Segmented, Alert, message } from 'antd';
import {
  HomeOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, DatabaseOutlined, FileProtectOutlined,
  FireOutlined, WarningOutlined, FileDoneOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { premisesApi, type PremisesKpis, type PremisesListItem, type PremisesRefillRow } from '../../api/premises';
import BuildingProfile from '../Buildings/BuildingProfile';
import { InvoiceRefillModal, PRIMARY, money, litres, d10 } from './forms';
import PremisesWizard from './PremisesWizard';

const { Title, Text } = Typography;
const PRIMARY_LIGHT = '#e8f5e9';
const cardStyle = { borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' } as const;

/**
 * Villas (/villas) — same layout as the Buildings page: header, KPI cards, charts, table.
 * Opening a villa shows the full building-style profile of its host building in villa mode
 * (villa & contract overview, tanks diagram, refills, AMC, visits, service requests, Civil Defense, invoices, documents, activity).
 */
export default function VillasPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<PremisesListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<PremisesKpis | null>(null);
  const [chartRows, setChartRows] = useState<PremisesListItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string>();
  const [branchId, setBranchId] = useState<number>();
  const [active, setActive] = useState<'all' | 'true' | 'false'>('true');
  const [view, setView] = useState<'list' | 'ready'>('list');
  const [ready, setReady] = useState<PremisesRefillRow[]>([]);
  const [readyLoading, setReadyLoading] = useState(false);
  const [invoiceRow, setInvoiceRow] = useState<PremisesRefillRow | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [open, setOpen] = useState<{ id: number; buildingId: number; tab?: string } | null>(null);
  const [key, setKey] = useState(0);
  const reload = () => setKey(k => k + 1);

  // debounce the search box like the Buildings page
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim() || undefined); setPage(1); }, 400); return () => clearTimeout(t); }, [searchInput]);

  const load = useCallback((p: number) => {
    setLoading(true);
    premisesApi.list({ page: p, pageSize: 20, type: 'villa', search, branchId, active: active === 'all' ? undefined : active === 'true' })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); setListError(null); })
      .catch(e => setListError(errorMessage(e))).finally(() => setLoading(false));
  }, [search, branchId, active]);
  useEffect(() => { load(1); }, [load, key]);
  useEffect(() => { premisesApi.kpis('villa', branchId).then(setKpis).catch(() => setKpis(null)); }, [branchId, key]);
  // charts: up to 200 villas of the branch
  useEffect(() => { premisesApi.list({ page: 1, pageSize: 200, type: 'villa', branchId, active: true }).then(r => setChartRows(r.items)).catch(() => setChartRows([])); }, [branchId, key]);
  useEffect(() => {
    if (view !== 'ready') return;
    setReadyLoading(true);
    premisesApi.refills({ type: 'villa', readyOnly: true }).then(setReady).catch(e => message.error(errorMessage(e))).finally(() => setReadyLoading(false));
  }, [view, key]);

  // deep link ?id=<villaId>
  useEffect(() => {
    const id = Number(params.get('id'));
    if (!id || open) return;
    premisesApi.get(id).then(d => setOpen({ id, buildingId: d.building?.id ?? d.buildingId })).catch(() => undefined);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const openVilla = (r: { id: number; buildingId: number }, tab?: string) => { setOpen({ id: r.id, buildingId: r.buildingId, tab }); window.scrollTo({ top: 0 }); };
  const closeVilla = () => { setOpen(null); if (params.get('id')) { params.delete('id'); setParams(params, { replace: true }); } reload(); };

  const kpiCards = [
    { title: 'إجمالي الفلل', value: kpis?.total ?? 0, sub: `${kpis?.active ?? 0} نشطة`, color: PRIMARY, bg: PRIMARY_LIGHT, icon: <HomeOutlined /> },
    { title: 'فلل لديها عقد نشط', value: kpis?.withContract ?? 0, sub: `${Math.max(0, (kpis?.active ?? 0) - (kpis?.withContract ?? 0))} نشطة بلا عقد`, color: '#13c2c2', bg: '#e6fffb', icon: <FileProtectOutlined /> },
    { title: 'خزانات منخفضة', value: kpis?.lowTanks ?? 0, sub: `من أصل ${kpis?.tanks ?? 0} خزان`, color: '#ff4d4f', bg: '#fff1f0', icon: <WarningOutlined /> },
    { title: 'تعبئات جاهزة للفوترة', value: kpis?.readyToInvoice ?? 0, sub: `${litres(kpis?.readyLitres)} · مفوتر هذا الشهر ${money(kpis?.invoicedThisMonth)}`, color: '#fa8c16', bg: '#fff7e6', icon: <FireOutlined />, onClick: () => setView('ready') },
  ];

  const levelChart = useMemo(() => {
    const withTanks = chartRows.filter(r => r.tanks > 0).sort((a, b) => Number(a.levelPct ?? 0) - Number(b.levelPct ?? 0)).slice(0, 12);
    return {
      options: {
        chart: { toolbar: { show: false }, fontFamily: 'inherit' },
        plotOptions: { bar: { borderRadius: 6, columnWidth: '45%', distributed: true } },
        colors: withTanks.map(r => (Number(r.levelPct ?? 0) < 25 ? '#ff4d4f' : Number(r.levelPct ?? 0) < 50 ? '#fa8c16' : PRIMARY)),
        legend: { show: false }, dataLabels: { enabled: true, formatter: (v: number) => `${v}%` },
        xaxis: { categories: withTanks.map(r => r.code) }, yaxis: { max: 100, labels: { formatter: (v: number) => `${v}%` } },
        grid: { borderColor: '#f0f0f0' }, tooltip: { y: { formatter: (v: number) => `${v}%` } },
      } as any,
      series: [{ name: 'مستوى الخزان', data: withTanks.map(r => Number(r.levelPct ?? 0)) }],
      count: withTanks.length,
    };
  }, [chartRows]);
  const withContract = chartRows.filter(r => r.contractNo).length;

  if (open) {
    return (
      <div style={{ padding: '20px 24px 32px', background: '#f7f8fa', minHeight: '100vh' }}>
        <BuildingProfile buildingId={open.buildingId} villaId={open.id} initialTab={open.tab ?? 'villaoverview'} onBack={closeVilla} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', background: '#f7f8fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: PRIMARY }}>
            <HomeOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1a1a2e' }}>الفلل</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>فلل مستقلة: المالك هو العميل والموقّع — الخزان والتعبئة والفاتورة لكل تعبئة حسب سعر اللتر</Text>
          </div>
        </div>
        <Space>
          <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} size="large" style={{ borderRadius: 10, height: 42 }} onClick={reload} loading={loading} /></Tooltip>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setFormOpen(true)}
              style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, height: 42, paddingInline: 20 }}>
              إضافة فيلا
            </Button>
          )}
        </Space>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiCards.map((k, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card style={{ ...cardStyle, cursor: k.onClick ? 'pointer' : undefined }} styles={{ body: { padding: '18px 20px' } }} onClick={k.onClick}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>{k.title}</Text>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{Number(k.value).toLocaleString()}</div>
                  <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 11 }}>{k.sub}</Text></div>
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
          <Card title={<Text strong style={{ fontSize: 14 }}>مستوى خزانات الفلل (الأقل أولاً)</Text>} style={cardStyle} styles={{ body: { paddingTop: 8 } }}>
            {levelChart.count > 0
              ? <ReactApexChart key={levelChart.series[0].data.join('-')} options={levelChart.options} series={levelChart.series} type="bar" height={220} />
              : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">لا توجد خزانات بعد</Text></div>}
          </Card>
        </Col>
        <Col xs={24} md={9}>
          <Card title={<Text strong style={{ fontSize: 14 }}>تغطية عقود التوريد</Text>} style={{ ...cardStyle, height: '100%' }} styles={{ body: { paddingTop: 8 } }}>
            {chartRows.length > 0
              ? <ReactApexChart type="donut" height={220} series={[withContract, chartRows.length - withContract]}
                  options={{ labels: ['لديها عقد', 'بلا عقد'], colors: [PRIMARY, '#ff4d4f'], legend: { position: 'bottom' }, chart: { fontFamily: 'inherit' },
                    plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'الفلل' } } } } } } as any} />
              : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">لا توجد فلل بعد</Text></div>}
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={cardStyle} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0' }}>
          <Segmented value={view} onChange={v => setView(v as any)} options={[
            { value: 'list', label: 'قائمة الفلل' },
            { value: 'ready', label: <span><FireOutlined /> جاهزة للفوترة {kpis?.readyToInvoice ? `(${kpis.readyToInvoice})` : ''}</span> },
          ]} />
          <span style={{ marginInlineEnd: 'auto' }} />
          {view === 'list' && <>
            <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="بحث بالاسم، الرمز، المالك..." style={{ width: 230, borderRadius: 8 }}
              value={searchInput} onChange={e => setSearchInput(e.target.value)} allowClear />
            <Select placeholder="الفرع" style={{ width: 150 }} allowClear value={branchId} onChange={v => { setBranchId(v); setPage(1); }}
              options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
            <Segmented value={active} onChange={v => setActive(v as any)} options={[{ value: 'true', label: 'النشطة' }, { value: 'false', label: 'الموقوفة' }, { value: 'all', label: 'الكل' }]} />
          </>}
        </div>
        {listError && <Alert type="error" showIcon style={{ margin: 16, borderRadius: 8 }} message={listError} action={<Button size="small" onClick={reload}>إعادة المحاولة</Button>} />}

        {view === 'list' ? (
          <Table<PremisesListItem> rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 1100 }} style={{ padding: '0 4px' }}
            onRow={r => ({ onClick: () => openVilla(r), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.55 } })}
            pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: load, showTotal: t => `${t} فيلا`, style: { padding: '0 16px' } }}
            locale={{ emptyText: <Empty description="لا توجد فلل بعد" /> }}
            columns={[
              { title: 'الرقم', dataIndex: 'code', width: 95, render: v => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
              { title: 'الفيلا', key: 'name', render: (_, r) => (
                <div>
                  <a onClick={e => { e.stopPropagation(); openVilla(r); }} style={{ fontWeight: 600, color: PRIMARY }}>{r.name}</a>
                  {(r.zone || r.branch) && <div style={{ fontSize: 11, color: '#999' }}>{[r.zone, r.branch].filter(Boolean).join(' · ')}</div>}
                </div>) },
              { title: 'المالك', key: 'owner', render: (_, r) => <div>{r.owner ?? '—'}{r.ownerPhone && <div dir="ltr" style={{ fontSize: 11, color: '#999', textAlign: 'start' }}>{r.ownerPhone}</div>}</div> },
              { title: 'الخزانات', key: 'tanks', width: 190, render: (_, r) => r.tanks > 0
                ? <div onClick={e => { e.stopPropagation(); openVilla(r, 'tanks'); }}>
                    <Progress percent={Number(r.levelPct ?? 0)} size="small" status={Number(r.levelPct) < 25 ? 'exception' : 'normal'} strokeColor={Number(r.levelPct) < 25 ? undefined : PRIMARY} />
                    <div style={{ fontSize: 11, color: '#999' }}><DatabaseOutlined /> {r.tanks} · {litres(r.levelLitres)} / {litres(r.capacityLitres)}</div>
                  </div>
                : <Text type="secondary">—</Text> },
              { title: 'العقد / سعر اللتر', key: 'contract', render: (_, r) => r.contractNo
                ? <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.contractNo}</Text><div style={{ fontSize: 12 }}><Text strong>{Number(r.pricePerLitre).toLocaleString()}</Text> د.إ/لتر</div></div>
                : <Tag color="red">بلا عقد</Tag> },
              { title: 'جاهزة للفوترة', dataIndex: 'readyToInvoice', width: 110, align: 'center' as const, render: v => v > 0 ? <Tag color="orange">{v}</Tag> : '—' },
              { title: 'المفوتر', dataIndex: 'invoicedTotal', render: v => money(v) },
              { title: 'الحالة', dataIndex: 'isActive', width: 90, render: v => v ? <Tag color="green" icon={<CheckCircleOutlined />}>نشطة</Tag> : <Tag>موقوفة</Tag> },
              { title: '', key: 'act', width: 50, render: (_, r) => <Tooltip title="عرض الملف الكامل"><Button size="small" type="text" icon={<EyeOutlined />} style={{ color: PRIMARY }}
                  onClick={e => { e.stopPropagation(); openVilla(r); }} /></Tooltip> },
            ]} />
        ) : (
          <Table<PremisesRefillRow> rowKey="refillRequestId" loading={readyLoading} dataSource={ready} scroll={{ x: 1000 }} style={{ padding: '0 4px' }}
            locale={{ emptyText: <Empty description="لا توجد تعبئات مُسلَّمة بانتظار الفاتورة" /> }}
            columns={[
              { title: 'الطلب', dataIndex: 'requestNo', render: v => <Text code>{v}</Text> },
              { title: 'الفيلا', render: (_, r) => <a onClick={() => premisesApi.get(r.premisesId).then(d => openVilla({ id: r.premisesId, buildingId: d.building?.id }, 'villa'))}>{r.premisesCode} — {r.premises}</a> },
              { title: 'الخزان', dataIndex: 'tankNo' },
              { title: 'تاريخ التوصيل', dataIndex: 'deliveredAt', render: d10 },
              { title: 'الكمية', dataIndex: 'deliveredLitres', render: v => litres(v) },
              { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: (v, r) => r.missingContract ? <Tag color="red">لا يوجد عقد</Tag> : Number(v).toLocaleString() },
              { title: 'المبلغ (قبل الضريبة)', dataIndex: 'estimatedAmount', render: v => v != null ? <Text strong>{money(v)}</Text> : '—' },
              { title: '', render: (_, r) => can('invoices.manage') &&
                <Button size="small" type="primary" icon={<FileDoneOutlined />} style={{ background: PRIMARY }} disabled={r.missingContract} onClick={() => setInvoiceRow(r)}>إصدار فاتورة</Button> },
            ]} />
        )}
      </Card>

      <PremisesWizard type="villa" open={formOpen} onClose={() => setFormOpen(false)} onListChanged={reload}
        onSaved={id => { setFormOpen(false); reload(); premisesApi.get(id).then(d => openVilla({ id, buildingId: d.building?.id }, 'villa')).catch(() => undefined); }} />
      <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); reload(); }} />
    </div>
  );
}
