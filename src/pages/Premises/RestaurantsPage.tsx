import { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Button, Tag, Input, Select, Space, Typography, Tooltip, Progress, Empty, Segmented, Alert, message } from 'antd';
import {
  ShopOutlined, PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, DatabaseOutlined, FileProtectOutlined,
  FireOutlined, WarningOutlined, FileDoneOutlined, CheckCircleOutlined, BankOutlined, TeamOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { premisesApi, type PremisesKpis, type PremisesListItem, type PremisesRefillRow } from '../../api/premises';
import BuildingProfile from '../Buildings/BuildingProfile';
import { PremisesFormModal, InvoiceRefillModal, PRIMARY, money, litres, d10 } from './forms';
import RestaurantProfile from './RestaurantProfile';

const { Title, Text } = Typography;
const PRIMARY_LIGHT = '#e8f5e9';
const cardStyle = { borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' } as const;

/**
 * Restaurants (/restaurants) — same layout as the Buildings and Villas pages: header, KPI cards, charts, table.
 * Opening a restaurant shows its building-style profile (RestaurantProfile); «فتح المبنى» shows the normal host building profile.
 */
export default function RestaurantsPage() {
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
  const [buildings, setBuildings] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string>();
  const [branchId, setBranchId] = useState<number>();
  const [buildingId, setBuildingId] = useState<number>();
  const [active, setActive] = useState<'all' | 'true' | 'false'>('true');
  const [view, setView] = useState<'list' | 'ready'>('list');
  const [ready, setReady] = useState<PremisesRefillRow[]>([]);
  const [readyLoading, setReadyLoading] = useState(false);
  const [invoiceRow, setInvoiceRow] = useState<PremisesRefillRow | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [open, setOpen] = useState<{ id: number; tab?: string } | null>(params.get('id') ? { id: Number(params.get('id')) } : null);
  const [hostBuilding, setHostBuilding] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  const reload = () => setKey(k => k + 1);

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim() || undefined); setPage(1); }, 400); return () => clearTimeout(t); }, [searchInput]);

  const load = useCallback((p: number) => {
    setLoading(true);
    premisesApi.list({ page: p, pageSize: 20, type: 'restaurant', search, branchId, buildingId, active: active === 'all' ? undefined : active === 'true' })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); setListError(null); })
      .catch(e => setListError(errorMessage(e))).finally(() => setLoading(false));
  }, [search, branchId, buildingId, active]);
  useEffect(() => { load(1); }, [load, key]);
  useEffect(() => { premisesApi.kpis('restaurant', branchId).then(setKpis).catch(() => setKpis(null)); }, [branchId, key]);
  useEffect(() => { premisesApi.list({ page: 1, pageSize: 200, type: 'restaurant', branchId, active: true }).then(r => setChartRows(r.items)).catch(() => setChartRows([])); }, [branchId, key]);
  useEffect(() => { api<Paged<any>>('/buildings', { query: { pageSize: 0, kind: 'restaurant' } }).then(r => setBuildings(r.items)).catch(() => setBuildings([])); }, [key]);
  useEffect(() => {
    if (view !== 'ready') return;
    setReadyLoading(true);
    premisesApi.refills({ type: 'restaurant', readyOnly: true }).then(setReady).catch(e => message.error(errorMessage(e))).finally(() => setReadyLoading(false));
  }, [view, key]);

  const openRestaurant = (id: number, tab?: string) => { setOpen({ id, tab }); window.scrollTo({ top: 0 }); };
  const closeRestaurant = () => { setOpen(null); if (params.get('id')) { params.delete('id'); setParams(params, { replace: true }); } reload(); };

  const kpiCards = [
    { title: 'إجمالي المطاعم', value: kpis?.total ?? 0, sub: `${kpis?.active ?? 0} نشطة · في ${buildings.length} مبنى`, color: PRIMARY, bg: PRIMARY_LIGHT, icon: <ShopOutlined /> },
    { title: 'مطاعم لديها عقد نشط', value: kpis?.withContract ?? 0, sub: `${Math.max(0, (kpis?.active ?? 0) - (kpis?.withContract ?? 0))} نشطة بلا عقد`, color: '#13c2c2', bg: '#e6fffb', icon: <FileProtectOutlined /> },
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

  if (hostBuilding) {
    return (
      <div style={{ padding: '20px 24px 32px', background: '#f7f8fa', minHeight: '100vh' }}>
        <BuildingProfile buildingId={hostBuilding} initialTab="restaurants" onBack={() => setHostBuilding(null)} />
      </div>
    );
  }
  if (open) {
    return (
      <div style={{ padding: '20px 24px 32px', background: '#f7f8fa', minHeight: '100vh' }}>
        <RestaurantProfile restaurantId={open.id} initialTab={open.tab} onBack={closeRestaurant} onOpenBuilding={id => { setHostBuilding(id); window.scrollTo({ top: 0 }); }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', background: '#f7f8fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: PRIMARY }}>
            <ShopOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1a1a2e' }}>المطاعم</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>مطاعم داخل المباني: المالك والمخولون بالتوقيع — خزان خاص لكل مطعم والفاتورة لكل تعبئة حسب سعر اللتر</Text>
          </div>
        </div>
        <Space>
          <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} size="large" style={{ borderRadius: 10, height: 42 }} onClick={reload} loading={loading} /></Tooltip>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setFormOpen(true)}
              style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, height: 42, paddingInline: 20 }}>
              إضافة مطعم
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
          <Card title={<Text strong style={{ fontSize: 14 }}>مستوى خزانات المطاعم (الأقل أولاً)</Text>} style={cardStyle} styles={{ body: { paddingTop: 8 } }}>
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
                    plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'المطاعم' } } } } } } as any} />
              : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Text type="secondary">لا توجد مطاعم بعد</Text></div>}
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={cardStyle} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0' }}>
          <Segmented value={view} onChange={v => setView(v as any)} options={[
            { value: 'list', label: 'قائمة المطاعم' },
            { value: 'ready', label: <span><FireOutlined /> جاهزة للفوترة {kpis?.readyToInvoice ? `(${kpis.readyToInvoice})` : ''}</span> },
          ]} />
          <span style={{ marginInlineEnd: 'auto' }} />
          {view === 'list' && <>
            <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="بحث بالاسم، الرمز، المبنى، المالك..." style={{ width: 230, borderRadius: 8 }}
              value={searchInput} onChange={e => setSearchInput(e.target.value)} allowClear />
            <Select placeholder="المبنى" style={{ width: 200 }} allowClear showSearch optionFilterProp="label" value={buildingId} onChange={v => { setBuildingId(v); setPage(1); }}
              options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? b.nameAr ?? ''}` }))} />
            <Select placeholder="الفرع" style={{ width: 150 }} allowClear value={branchId} onChange={v => { setBranchId(v); setPage(1); }}
              options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
            <Segmented value={active} onChange={v => setActive(v as any)} options={[{ value: 'true', label: 'النشطة' }, { value: 'false', label: 'الموقوفة' }, { value: 'all', label: 'الكل' }]} />
          </>}
        </div>
        {listError && <Alert type="error" showIcon style={{ margin: 16, borderRadius: 8 }} message={listError} action={<Button size="small" onClick={reload}>إعادة المحاولة</Button>} />}

        {view === 'list' ? (
          <Table<PremisesListItem> rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 1200 }} style={{ padding: '0 4px' }}
            onRow={r => ({ onClick: () => openRestaurant(r.id), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.55 } })}
            pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: load, showTotal: t => `${t} مطعم`, style: { padding: '0 16px' } }}
            locale={{ emptyText: <Empty description="لا توجد مطاعم بعد" /> }}
            columns={[
              { title: 'الرقم', dataIndex: 'code', width: 95, render: v => <Tag color="volcano" style={{ fontFamily: 'monospace' }}>{v}</Tag> },
              { title: 'المطعم', key: 'name', render: (_, r) => (
                <div>
                  <a onClick={e => { e.stopPropagation(); openRestaurant(r.id); }} style={{ fontWeight: 600, color: PRIMARY }}>{r.name}</a>
                  {r.branch && <div style={{ fontSize: 11, color: '#999' }}>{r.branch}</div>}
                </div>) },
              { title: 'المبنى / الوحدة', key: 'building', render: (_, r) => (
                <div>
                  <a onClick={e => { e.stopPropagation(); setHostBuilding(r.buildingId); }} style={{ color: '#555' }}><BankOutlined /> {r.buildingCode}</a>
                  <div style={{ fontSize: 11, color: '#999' }}>{r.building}{r.unitNo ? ` · وحدة ${r.unitNo}` : ''}</div>
                </div>) },
              { title: 'المالك', key: 'owner', render: (_, r) => <div>{r.owner ?? '—'}{r.ownerPhone && <div dir="ltr" style={{ fontSize: 11, color: '#999', textAlign: 'start' }}>{r.ownerPhone}</div>}</div> },
              { title: 'المخولون', dataIndex: 'signatories', width: 90, align: 'center' as const,
                render: v => v > 0 ? <Tag color="green" icon={<TeamOutlined />}>{v}</Tag> : <Tooltip title="لا يوجد شخص مخول بالتوقيع"><Tag color="red">0</Tag></Tooltip> },
              { title: 'الخزانات', key: 'tanks', width: 190, render: (_, r) => r.tanks > 0
                ? <div onClick={e => { e.stopPropagation(); openRestaurant(r.id, 'tanks'); }}>
                    <Progress percent={Number(r.levelPct ?? 0)} size="small" status={Number(r.levelPct) < 25 ? 'exception' : 'normal'} strokeColor={Number(r.levelPct) < 25 ? undefined : PRIMARY} />
                    <div style={{ fontSize: 11, color: '#999' }}><DatabaseOutlined /> {r.tanks} · {litres(r.levelLitres)} / {litres(r.capacityLitres)}</div>
                  </div>
                : <Text type="secondary">—</Text> },
              { title: 'العقد / سعر اللتر', key: 'contract', render: (_, r) => r.contractNo
                ? <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.contractNo}</Text><div style={{ fontSize: 12 }}><Text strong>{Number(r.pricePerLitre).toLocaleString()}</Text> د.إ/لتر</div></div>
                : <Tag color="red">بلا عقد</Tag> },
              { title: 'جاهزة للفوترة', dataIndex: 'readyToInvoice', width: 110, align: 'center' as const, render: v => v > 0 ? <Tag color="orange">{v}</Tag> : '—' },
              { title: 'المفوتر', dataIndex: 'invoicedTotal', render: v => money(v) },
              { title: 'الحالة', dataIndex: 'isActive', width: 90, render: v => v ? <Tag color="green" icon={<CheckCircleOutlined />}>نشط</Tag> : <Tag>موقوف</Tag> },
              { title: '', key: 'act', width: 50, render: (_, r) => <Tooltip title="عرض الملف الكامل"><Button size="small" type="text" icon={<EyeOutlined />} style={{ color: PRIMARY }}
                  onClick={e => { e.stopPropagation(); openRestaurant(r.id); }} /></Tooltip> },
            ]} />
        ) : (
          <Table<PremisesRefillRow> rowKey="refillRequestId" loading={readyLoading} dataSource={ready} scroll={{ x: 1000 }} style={{ padding: '0 4px' }}
            locale={{ emptyText: <Empty description="لا توجد تعبئات مُسلَّمة بانتظار الفاتورة" /> }}
            columns={[
              { title: 'الطلب', dataIndex: 'requestNo', render: v => <Text code>{v}</Text> },
              { title: 'المطعم', render: (_, r) => <a onClick={() => openRestaurant(r.premisesId, 'site')}>{r.premisesCode} — {r.premises}</a> },
              { title: 'المبنى', dataIndex: 'buildingCode' },
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

      <PremisesFormModal type="restaurant" open={formOpen} onClose={() => setFormOpen(false)}
        onSaved={id => { setFormOpen(false); reload(); openRestaurant(id, 'site'); }} />
      <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); reload(); }} />
    </div>
  );
}
