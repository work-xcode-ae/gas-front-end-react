import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Table, Input, Select, Button, Tag, Typography, Space, Modal, message, Empty } from 'antd';
import { FireOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, StopOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { unitsApi, type UnitDto } from '../../api/units';
import { useAuth } from '../../auth/AuthContext';
import UnitProfileDrawer from '../Buildings/UnitProfileDrawer';
import CustomerDrawer from '../Customers/CustomerDrawer';
import { PageBanner, Kpi, money, d10, PRIMARY, GOLD, CONTRACT_STATUS, PAY_STATUS } from '../Customers/shared';
import ContractDrawer from './ContractDrawer';

const { Text } = Typography;
const daysLeft = (end?: string | null) => (end ? dayjs(end).diff(dayjs().startOf('day'), 'day') : null);

/** Gas supply contracts across all buildings. */
export default function GasContractsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [buildingId, setBuildingId] = useState<number>();
  const [status, setStatus] = useState<string>();
  const [expiring, setExpiring] = useState<number>();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [unit, setUnit] = useState<UnitDto | null>(null);
  const [unitAction, setUnitAction] = useState<{ action: any; nonce: number } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newBuilding, setNewBuilding] = useState<number>();
  const [vacant, setVacant] = useState<UnitDto[]>([]);
  const [newUnit, setNewUnit] = useState<number>();
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api<Paged<any>>('/supply-contracts', { query: { pageSize: 0 } }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [key]);
  useEffect(() => { api<Paged<any>>('/buildings', { query: { pageSize: 0, sort: 'code' } }).then(r => setBuildings(r.items)).catch(() => setBuildings([])); }, []);
  useEffect(() => {
    setNewUnit(undefined); setVacant([]);
    if (newBuilding) api<Paged<UnitDto>>('/units', { query: { buildingId: newBuilding, vacantOnly: true, pageSize: 0 } }).then(r => setVacant(r.items.filter(u => u.isActive !== false))).catch(() => setVacant([]));
  }, [newBuilding]);

  const active = rows.filter(r => r.isActive);
  const exp = (n: number) => active.filter(r => { const d = daysLeft(r.endDate); return d != null && d >= 0 && d <= n; });
  const overdue = rows.filter(r => Number(r.overdueAmount) > 0);
  const shown = useMemo(() => rows.filter(r => {
    if (buildingId && r.buildingId !== buildingId) return false;
    if (status && r.status !== status) return false;
    if (expiring) { const d = daysLeft(r.endDate); if (!r.isActive || d == null || d < 0 || d > expiring) return false; }
    if (overdueOnly && !(Number(r.overdueAmount) > 0)) return false;
    if (search) { const s = search.toLowerCase(); if (![r.contractNo, r.tenant, r.unit, r.building, r.meter].some(x => String(x ?? '').toLowerCase().includes(s))) return false; }
    return true;
  }), [rows, buildingId, status, expiring, overdueOnly, search]);

  const refresh = () => setKey(k => k + 1);
  const openUnit = async (unitId: number, action?: 'tenant') => {
    try { setUnit(await unitsApi.get(unitId)); setUnitAction(action ? { action, nonce: Date.now() } : null); } catch (e) { message.error(errorMessage(e)); }
  };
  const resetFilters = () => { setStatus(undefined); setExpiring(undefined); setOverdueOnly(false); };

  return (
    <div>
      <PageBanner icon={<FireOutlined />} title="عقود توريد الغاز" subtitle="كل عقود التوريد في جميع المباني — التجديد والإنهاء والفوترة والاستهلاك"
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }} />
          {(can('contracts.manage') || can('buildings.manage')) && <Button icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD, color: '#0b2e18', fontWeight: 600 }}
            onClick={() => { setNewBuilding(undefined); setNewOpen(true); }}>عقد جديد</Button>}
        </Space>} />

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={8} xl={4}><Kpi label="إجمالي العقود" value={rows.length} color={PRIMARY} bg="#e8f5e9" icon={<FileTextOutlined />} onClick={resetFilters} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="نشطة" value={active.length} color="#52c41a" bg="#f6ffed" icon={<CheckCircleOutlined />} active={status === 'active'} onClick={() => { resetFilters(); setStatus('active'); }} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="تنتهي خلال 30 يوم" value={exp(30).length} color="#fa541c" bg="#fff2e8" icon={<ClockCircleOutlined />} active={expiring === 30} onClick={() => { resetFilters(); setExpiring(30); }} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="تنتهي خلال 60 يوم" value={exp(60).length} color="#fa8c16" bg="#fff7e6" icon={<ClockCircleOutlined />} active={expiring === 60} onClick={() => { resetFilters(); setExpiring(60); }} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`متأخرات (${overdue.length})`} value={money(overdue.reduce((s, r) => s + Number(r.overdueAmount), 0))} color="#ff4d4f" bg="#fff1f0" icon={<WarningOutlined />} active={overdueOnly} onClick={() => { resetFilters(); setOverdueOnly(true); }} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="منتهية / ملغاة" value={rows.filter(r => r.status === 'expired' || r.status === 'terminated').length} color="#8c8c8c" bg="#fafafa" icon={<StopOutlined />} /></Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="بحث: رقم العقد، العميل، الوحدة، العداد…" style={{ width: 300 }} onSearch={setSearch} onChange={e => !e.target.value && setSearch('')} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="المبنى" style={{ width: 200 }} value={buildingId} onChange={setBuildingId}
            options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? ''}` }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus}
            options={Object.entries(CONTRACT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Select allowClear placeholder="ينتهي خلال" style={{ width: 140 }} value={expiring} onChange={setExpiring}
            options={[30, 60, 90].map(n => ({ value: n, label: `${n} يوم` }))} />
          {(status || expiring || overdueOnly || buildingId) && <Button onClick={() => { resetFilters(); setBuildingId(undefined); }}>مسح الفلاتر</Button>}
        </Space>
        <Table rowKey="id" size="middle" loading={loading} dataSource={shown} scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="لا توجد عقود" /> }}
          pagination={{ pageSize: 20, showTotal: t => `${t} عقد` }}
          onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer', background: Number(r.overdueAmount) > 0 ? '#fff8f8' : undefined } })}
          columns={[
            { title: 'رقم العقد', dataIndex: 'contractNo', render: v => <Text strong style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text> },
            { title: 'العميل', dataIndex: 'tenant' },
            { title: 'المبنى / الوحدة', key: 'u', render: (_, r) => <div>{r.building}<div style={{ fontSize: 11, color: '#888' }}>وحدة {r.unit}{r.meter ? ` · ${r.meter}` : ''}</div></div> },
            { title: 'الفترة', key: 'p', render: (_, r) => {
              const d = daysLeft(r.endDate);
              return <div style={{ fontSize: 12 }}>{d10(r.startDate)} → {d10(r.endDate)}
                {r.isActive && d != null && d <= 60 && <div><Tag color={d < 0 ? 'error' : d <= 30 ? 'volcano' : 'orange'} style={{ fontSize: 10 }}>{d < 0 ? `انتهى منذ ${-d} يوم` : `ينتهي خلال ${d} يوم`}</Tag></div>}</div>;
            } },
            { title: 'الرسوم الشهرية', dataIndex: 'monthlyFee', render: v => money(v) },
            { title: 'الرصيد', dataIndex: 'balanceAmount', render: (v, r) => <div><Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#52c41a' }}>{money(v)}</Text>
              {Number(r.overdueAmount) > 0 && <div style={{ fontSize: 11, color: '#ff4d4f' }}>متأخر {money(r.overdueAmount)}</div>}</div> },
            { title: 'السداد', dataIndex: 'paymentStatus', render: s => <Tag color={PAY_STATUS[s]?.color}>{PAY_STATUS[s]?.label ?? s}</Tag> },
            { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={CONTRACT_STATUS[s]?.color}>{CONTRACT_STATUS[s]?.label ?? s}</Tag> },
          ]} />
      </Card>

      <ContractDrawer contractId={openId} onClose={() => setOpenId(null)} onChanged={refresh} onOpenUnit={id => openUnit(id)} onOpenCustomer={id => setCustomerId(id)} />
      <CustomerDrawer customerId={customerId} onClose={() => setCustomerId(null)} onChanged={refresh} />
      <UnitProfileDrawer unit={unit} buildingName={unit?.buildingName} canManage={can('buildings.manage') || can('contracts.manage')} openAction={unitAction}
        onClose={() => { setUnit(null); setUnitAction(null); }}
        onChanged={() => { refresh(); unit && unitsApi.get(unit.id).then(setUnit).catch(() => undefined); }} />

      <Modal open={newOpen} title="عقد توريد جديد — اختر المبنى والوحدة" okText="متابعة" cancelText="إلغاء" okButtonProps={{ disabled: !newUnit }}
        onCancel={() => setNewOpen(false)} onOk={() => { setNewOpen(false); if (newUnit) openUnit(newUnit, 'tenant'); }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>يُنشأ العقد من ملف الوحدة: المستأجر، الرسوم، الشروط والأحكام، والعداد.</Text>
        <Select style={{ width: '100%', marginBottom: 10 }} showSearch optionFilterProp="label" placeholder="المبنى" value={newBuilding} onChange={setNewBuilding}
          options={buildings.filter(b => b.isActive !== false).map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? ''} (${b.vacant ?? 0} شاغرة)` }))} />
        <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="الوحدة الشاغرة" value={newUnit} onChange={setNewUnit} disabled={!newBuilding}
          notFoundContent="لا توجد وحدات شاغرة في هذا المبنى"
          options={vacant.map(u => ({ value: u.id, label: `وحدة ${u.no}${u.floor != null ? ` — طابق ${u.floor}` : ''}${u.typeLabel ? ` — ${u.typeLabel}` : ''}` }))} />
      </Modal>
    </div>
  );
}
