import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Card, Table, Input, Select, Segmented, Button, Tag, Typography, Space, Tabs, Progress, Tooltip, Empty, message } from 'antd';
import { HomeOutlined, ShopOutlined, PlusOutlined, ReloadOutlined, CheckCircleOutlined, FileProtectOutlined, FireOutlined, WarningOutlined, FileDoneOutlined, DashboardOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { premisesApi, type PremisesKpis, type PremisesListItem, type PremisesRefillRow, type PremisesType } from '../../api/premises';
import { PageBanner, Kpi } from '../Customers/shared';
import { InvoiceRefillModal, PRIMARY, GOLD, money, litres, d10 } from './forms';
import PremisesDrawer from './PremisesDrawer';
import PremisesWizard from './PremisesWizard';

const { Text } = Typography;

const TEXT: Record<PremisesType, { title: string; subtitle: string; add: string; unit: string; search: string }> = {
  villa: {
    title: 'الفلل', add: 'فيلا جديدة', unit: 'فيلا', search: 'بحث: الاسم، الرمز، المالك، الهاتف…',
    subtitle: 'فلل مستقلة: المالك هو العميل والموقّع (لا مستأجر) — الخزان والتعبئة والفاتورة لكل تعبئة حسب سعر اللتر في العقد',
  },
  restaurant: {
    title: 'المطاعم', add: 'مطعم جديد', unit: 'مطعم', search: 'بحث: الاسم، الرمز، المبنى، المالك…',
    subtitle: 'مطاعم داخل المباني: مالك المطعم والمخولون بالتوقيع — خزان خاص لكل مطعم والفاتورة لكل تعبئة حسب سعر اللتر',
  },
};

/** Villas (/villas) or restaurants (/restaurants): list, KPIs, refills ready to invoice. */
export default function PremisesPage({ type }: { type: PremisesType }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);
  const { can } = useAuth();
  const T = TEXT[type];
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<PremisesListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<PremisesKpis | null>(null);
  const [search, setSearch] = useState<string>();
  const [active, setActive] = useState<'all' | 'true' | 'false'>('true');
  const [branchId, setBranchId] = useState<number>();
  const [openId, setOpenId] = useState<number | null>(params.get('id') ? Number(params.get('id')) : null);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [tab, setTab] = useState('list');
  const [ready, setReady] = useState<PremisesRefillRow[]>([]);
  const [readyLoading, setReadyLoading] = useState(false);
  const [invoiceRow, setInvoiceRow] = useState<PremisesRefillRow | null>(null);
  const [key, setKey] = useState(0);
  const refresh = () => setKey(k => k + 1);

  const load = useCallback((p: number) => {
    setLoading(true);
    premisesApi.list({ page: p, pageSize: 20, type, search, branchId, active: active === 'all' ? undefined : active === 'true' })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [type, search, branchId, active]);
  useEffect(() => { load(1); }, [load, key]);
  useEffect(() => { premisesApi.kpis(type, branchId).then(setKpis).catch(() => setKpis(null)); }, [type, branchId, key]);
  useEffect(() => {
    if (tab !== 'ready') return;
    setReadyLoading(true);
    premisesApi.refills({ type, readyOnly: true }).then(setReady).catch(e => message.error(errorMessage(e))).finally(() => setReadyLoading(false));
  }, [tab, type, key]);
  // reset when switching between /villas and /restaurants
  useEffect(() => { setTab('list'); setSearch(undefined); }, [type]);

  const closeDrawer = () => { setOpenId(null); if (params.get('id')) { params.delete('id'); setParams(params, { replace: true }); } };

  return (
    <div>
      <PageBanner icon={type === 'villa' ? <HomeOutlined /> : <ShopOutlined />} title={T.title} subtitle={T.subtitle}
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }} />
          {can('buildings.manage') && <Button icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD, color: '#0b2e18', fontWeight: 600 }}
            onClick={() => setFormOpen(true)}>{T.add}</Button>}
        </Space>} />

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={8} xl={4}><Kpi label={`إجمالي ${T.title}`} value={kpis?.total ?? '—'} color={PRIMARY} bg="#e8f5e9" icon={type === 'villa' ? <HomeOutlined /> : <ShopOutlined />} onClick={() => setActive('all')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="نشطة" value={kpis?.active ?? '—'} color="#1677ff" bg="#e6f4ff" icon={<CheckCircleOutlined />} active={active === 'true'} onClick={() => setActive('true')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="لديها عقد نشط" value={kpis?.withContract ?? '—'} color="#13c2c2" bg="#e6fffb" icon={<FileProtectOutlined />} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`خزانات منخفضة (من ${kpis?.tanks ?? 0})`} value={kpis?.lowTanks ?? '—'} color="#ff4d4f" bg="#fff1f0" icon={<WarningOutlined />} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`تعبئات جاهزة للفوترة (${litres(kpis?.readyLitres)})`} value={kpis?.readyToInvoice ?? '—'} color="#fa8c16" bg="#fff7e6" icon={<FireOutlined />}
          active={tab === 'ready'} onClick={() => setTab('ready')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`مفوتر هذا الشهر (${litres(kpis?.litresThisMonth)})`} value={money(kpis?.invoicedThisMonth)} color="#722ed1" bg="#f9f0ff" icon={<FileDoneOutlined />} /></Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'list', label: `قائمة ${T.title}`, children: (
            <>
              <Space wrap style={{ marginBottom: 12 }}>
                <Input.Search allowClear placeholder={T.search} style={{ width: 300 }} onSearch={v => setSearch(v || undefined)} />
                <Segmented value={active} onChange={v => setActive(v as any)} options={[{ value: 'true', label: 'النشطة' }, { value: 'false', label: 'الموقوفة' }, { value: 'all', label: 'الكل' }]} />
                <Select allowClear placeholder="الفرع" style={{ width: 160 }} value={branchId} onChange={setBranchId}
                  options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
              </Space>
              <Table<PremisesListItem> rowKey="id" size="middle" loading={loading} dataSource={rows} scroll={{ x: 1100 }}
                onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.55 } })}
                pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: load, showTotal: t => `${t} ${T.unit}` }}
                locale={{ emptyText: <Empty description={`لا توجد ${T.title} بعد`} /> }}
                columns={[
                  { title: 'الرمز', dataIndex: 'code', width: 90, render: v => <Text strong style={{ color: PRIMARY, fontFamily: 'monospace' }}>{v}</Text> },
                  { title: type === 'villa' ? 'الفيلا' : 'المطعم', key: 'name', render: (_, r) => <div><Text strong>{r.name}</Text>
                    <div style={{ fontSize: 11, color: '#888' }}>{type === 'restaurant' ? `${r.buildingCode} — ${r.building ?? ''}${r.unitNo ? ` · وحدة ${r.unitNo}` : ''}` : [r.zone, r.branch].filter(Boolean).join(' · ')}</div></div> },
                  { title: 'المالك', key: 'owner', render: (_, r) => <div>{r.owner ?? '—'}{r.ownerPhone && <div dir="ltr" style={{ fontSize: 11, color: '#888', textAlign: 'start' }}>{r.ownerPhone}</div>}</div> },
                  ...(type === 'restaurant' ? [{ title: 'المخولون', dataIndex: 'signatories', width: 90, align: 'center' as const,
                    render: (v: number) => v > 0 ? <Tag color="green">{v}</Tag> : <Tooltip title="لا يوجد شخص مخول بالتوقيع"><Tag color="red">0</Tag></Tooltip> }] : []),
                  { title: 'الخزانات', key: 'tanks', width: 170, render: (_, r) => r.tanks > 0
                    ? <div><Progress percent={Number(r.levelPct ?? 0)} size="small" status={Number(r.levelPct) < 25 ? 'exception' : 'normal'} />
                      <div style={{ fontSize: 11, color: '#888' }}><DashboardOutlined /> {r.tanks} · {litres(r.capacityLitres)}</div></div>
                    : <Text type="secondary">—</Text> },
                  { title: 'العقد / سعر اللتر', key: 'contract', render: (_, r) => r.contractNo
                    ? <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.contractNo}</Text><div style={{ fontSize: 12 }}><Text strong>{Number(r.pricePerLitre).toLocaleString()}</Text> د.إ/لتر</div></div>
                    : <Tag color="red">بلا عقد</Tag> },
                  { title: 'جاهزة للفوترة', dataIndex: 'readyToInvoice', width: 110, align: 'center' as const, render: v => v > 0 ? <Tag color="orange">{v}</Tag> : '—' },
                  { title: 'المفوتر', dataIndex: 'invoicedTotal', render: v => money(v) },
                ]} />
            </>
          ) },
          { key: 'ready', label: <span><FireOutlined /> تعبئات جاهزة للفوترة {kpis?.readyToInvoice ? <Tag color="orange">{kpis.readyToInvoice}</Tag> : null}</span>, children: (
            <Table<PremisesRefillRow> rowKey="refillRequestId" size="middle" loading={readyLoading} dataSource={ready} scroll={{ x: 1000 }}
              locale={{ emptyText: <Empty description="لا توجد تعبئات مُسلَّمة بانتظار الفاتورة" /> }}
              columns={[
                { title: 'الطلب', dataIndex: 'requestNo', render: v => <Text code>{v}</Text> },
                { title: type === 'villa' ? 'الفيلا' : 'المطعم', render: (_, r) => <a onClick={() => setOpenId(r.premisesId)}>{r.premisesCode} — {r.premises}</a> },
                { title: 'الخزان', dataIndex: 'tankNo' },
                { title: 'تاريخ التوصيل', dataIndex: 'deliveredAt', render: d10 },
                { title: 'الكمية', dataIndex: 'deliveredLitres', render: v => litres(v) },
                { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: (v, r) => r.missingContract ? <Tag color="red">لا يوجد عقد</Tag> : Number(v).toLocaleString() },
                { title: 'المبلغ (قبل الضريبة)', dataIndex: 'estimatedAmount', render: v => v != null ? <Text strong>{money(v)}</Text> : '—' },
                { title: '', render: (_, r) => can('invoices.manage') &&
                  <Button size="small" type="primary" icon={<FileDoneOutlined />} style={{ background: PRIMARY }} disabled={r.missingContract} onClick={() => setInvoiceRow(r)}>إصدار فاتورة</Button> },
              ]} />
          ) },
        ]} />
      </Card>

      <PremisesDrawer id={openId} onClose={closeDrawer} onChanged={refresh} />
      <PremisesWizard type={type} open={formOpen} onClose={() => setFormOpen(false)} onListChanged={refresh}
        onSaved={id => { setFormOpen(false); refresh(); setOpenId(id); }} />
      <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); refresh(); }} />
    </div>
  );
}
