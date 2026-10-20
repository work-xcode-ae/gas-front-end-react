import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Input, Select, Button, Tag, Typography, Space, Segmented, Progress, message, Empty } from 'antd';
import { HomeOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, StopOutlined, ThunderboltOutlined, AppstoreOutlined, DashboardOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { unitsApi, type UnitDto } from '../../api/units';
import { useReference } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import UnitProfileDrawer from '../Buildings/UnitProfileDrawer';
import { MeterStatusTag } from '../Meters/meterStatus';
import { PageBanner, Kpi, money, PRIMARY } from '../Customers/shared';

const { Text } = Typography;
type Occ = 'all' | 'occupied' | 'vacant' | 'inactive';
const floorLabel = (f?: number | null) => (f == null ? '—' : f === 0 ? 'أرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `${f}`);
const occOf = (u: UnitDto): Occ => (u.isActive === false ? 'inactive' : u.contractId ? 'occupied' : 'vacant');

/** Units (apartments, shops, offices) across all buildings. */
export default function ApartmentsPage() {
  const { i18n } = useTranslation();
  const { data: ref } = useReference(i18n.language);
  const { can } = useAuth();
  const [rows, setRows] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [buildingId, setBuildingId] = useState<number>();
  const [type, setType] = useState<string>();
  const [occ, setOcc] = useState<Occ>('all');
  const [floor, setFloor] = useState<number>();
  const [noMeter, setNoMeter] = useState(false);
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState<UnitDto | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api<Paged<UnitDto>>('/units', { query: { pageSize: 0, buildingId } }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId, key]);
  useEffect(() => { api<Paged<any>>('/buildings', { query: { pageSize: 0 } }).then(r => setBuildings(r.items)).catch(() => setBuildings([])); }, []);

  const floors = useMemo(() => [...new Set(rows.map(u => u.floor).filter((f): f is number => f != null))].sort((a, b) => a - b), [rows]);
  const shown = useMemo(() => rows.filter(u => {
    if (type && u.type !== type) return false;
    if (occ !== 'all' && occOf(u) !== occ) return false;
    if (floor != null && u.floor !== floor) return false;
    if (noMeter && u.meterId) return false;
    if (search) { const s = search.toLowerCase(); if (![u.no, u.tenant, u.contractNo, u.meter, u.buildingName, u.buildingCode].some(x => String(x ?? '').toLowerCase().includes(s))) return false; }
    return true;
  }), [rows, type, occ, floor, noMeter, search]);

  const act = rows.filter(u => u.isActive !== false);
  const occupied = act.filter(u => u.contractId).length;
  const pct = act.length ? Math.round(occupied * 100 / act.length) : 0;

  return (
    <div>
      <PageBanner icon={<HomeOutlined />} title="الوحدات" subtitle="الشقق والمحلات والمكاتب في كل المباني — الإشغال والعدادات والعقود"
        extra={<Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }} />} />

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={8} xl={4}><Kpi label="إجمالي الوحدات" value={rows.length} color={PRIMARY} bg="#e8f5e9" icon={<AppstoreOutlined />} active={occ === 'all'} onClick={() => setOcc('all')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="مشغولة" value={occupied} color="#52c41a" bg="#f6ffed" icon={<CheckCircleOutlined />} active={occ === 'occupied'} onClick={() => setOcc('occupied')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="شاغرة" value={act.length - occupied} color="#ff4d4f" bg="#fff1f0" icon={<CloseCircleOutlined />} active={occ === 'vacant'} onClick={() => setOcc('vacant')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="موقوفة" value={rows.length - act.length} color="#8c8c8c" bg="#fafafa" icon={<StopOutlined />} active={occ === 'inactive'} onClick={() => setOcc('inactive')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="بدون عداد" value={act.filter(u => !u.meterId).length} color="#fa8c16" bg="#fff7e6" icon={<ThunderboltOutlined />} active={noMeter} onClick={() => setNoMeter(!noMeter)} /></Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: '#e6f4ff', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DashboardOutlined style={{ fontSize: 22, color: '#1677ff' }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{pct}%</div><Progress percent={pct} showInfo={false} size="small" strokeColor="#1677ff" style={{ margin: 0 }} />
                <Text style={{ fontSize: 11.5, color: '#1677ff' }}>نسبة الإشغال</Text></div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="بحث: رقم الوحدة، المستأجر، العقد، العداد…" style={{ width: 280 }} onSearch={setSearch} onChange={e => !e.target.value && setSearch('')} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="المبنى" style={{ width: 200 }} value={buildingId} onChange={v => { setBuildingId(v); setFloor(undefined); }}
            options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? ''}` }))} />
          <Select allowClear placeholder="النوع" style={{ width: 130 }} value={type} onChange={setType}
            options={(ref?.lookups?.UNIT_TYPE ?? []).map(t => ({ value: t.code, label: t.label }))} />
          <Select allowClear placeholder="الطابق" style={{ width: 120 }} value={floor} onChange={setFloor}
            options={floors.map(f => ({ value: f, label: f === 0 ? 'أرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `الطابق ${f}` }))} />
          <Segmented value={occ} onChange={v => setOcc(v as Occ)} options={[{ value: 'all', label: 'الكل' }, { value: 'occupied', label: 'مشغولة' }, { value: 'vacant', label: 'شاغرة' }, { value: 'inactive', label: 'موقوفة' }]} />
        </Space>
        <Table rowKey="id" size="middle" loading={loading} dataSource={shown} scroll={{ x: 1000 }} pagination={{ pageSize: 25, showTotal: t => `${t} وحدة` }}
          locale={{ emptyText: <Empty description="لا توجد وحدات" /> }}
          onRow={u => ({ onClick: () => setUnit(u), style: { cursor: 'pointer', opacity: u.isActive === false ? 0.55 : 1 } })}
          columns={[
            { title: 'الوحدة', dataIndex: 'no', render: v => <Text strong style={{ color: PRIMARY }}>{v}</Text> },
            { title: 'المبنى', key: 'b', render: (_, u) => <div>{u.buildingName}<div style={{ fontSize: 11, color: '#888' }}>{u.buildingCode}</div></div> },
            { title: 'الطابق', dataIndex: 'floor', align: 'center' as const, render: floorLabel },
            { title: 'النوع', dataIndex: 'typeLabel', render: v => v ?? '—' },
            { title: 'المساحة', dataIndex: 'area', render: v => (v ? `${v} م²` : '—') },
            { title: 'الإيجار', dataIndex: 'rent', render: v => (v ? money(v) : '—') },
            { title: 'الحالة', key: 'st', render: (_, u) => { const o = occOf(u); return o === 'inactive' ? <Tag>موقوفة</Tag> : o === 'occupied' ? <Tag color="success">مشغولة</Tag> : <Tag color="error">شاغرة</Tag>; } },
            { title: 'المستأجر', dataIndex: 'tenant', render: (v, u) => v ? <div>{v}<div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{u.contractNo}</div></div> : <Text type="secondary">—</Text> },
            { title: 'العداد', dataIndex: 'meter', render: (v, u: any) => (v
              ? <Space size={4} wrap><Tag color="geekblue" style={{ fontFamily: 'monospace', margin: 0 }}>{v}</Tag>{u.meterStatus && <MeterStatusTag status={u.meterStatus} label={u.meterStatusLabel} />}</Space>
              : <Tag color="orange">بدون عداد</Tag>) },
          ]} />
      </Card>

      <UnitProfileDrawer unit={unit} buildingName={unit?.buildingName} canManage={can('buildings.manage')}
        onClose={() => setUnit(null)}
        onToggleActive={async u => {
          try { await unitsApi.setActive(u.id, u.isActive === false); message.success(u.isActive === false ? 'تم تفعيل الوحدة' : 'تم إيقاف الوحدة'); setKey(k => k + 1); setUnit(await unitsApi.get(u.id)); }
          catch (e) { message.error(errorMessage(e), 6); }
        }}
        onChanged={() => { setKey(k => k + 1); unit && unitsApi.get(unit.id).then(setUnit).catch(() => undefined); }} />
    </div>
  );
}
