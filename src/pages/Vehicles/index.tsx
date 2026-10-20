import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Table, Tabs, Tag,
  Tooltip, Typography, message,
} from 'antd';
import {
  CarOutlined, DeleteOutlined, EditOutlined, HistoryOutlined, IdcardOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, TeamOutlined,
  WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

interface Vehicle { id: number; vendorId?: number | null; defaultDriverId?: number | null; plateNo: string; capacityLitres?: number | null; registrationExpiry?: string | null; isActive: boolean }
interface Driver { id: number; vendorId?: number | null; nameEn?: string | null; nameAr?: string | null; licenseNo?: string | null; licenseExpiry?: string | null; hazmatPermitNo?: string | null; phone?: string | null; isActive: boolean }
interface Vendor { id: number; code?: string; name: string }
interface Usage { count: number; litres: number; last?: string | null }

const OWN_CODES = ['OWN-COMPANY'];
const daysTo = (d?: string | null) => (d ? dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day') : null);
export function ExpiryTag({ date, warnDays = 30 }: { date?: string | null; warnDays?: number }) {
  const n = daysTo(date);
  if (n == null) return <Text type="secondary">—</Text>;
  return (
    <div>
      <span style={{ fontSize: 12 }}>{date}</span>
      <div>{n < 0 ? <Tag color="error" style={{ fontSize: 10 }}>منتهية منذ {-n} يوم</Tag> : n <= warnDays ? <Tag color="warning" style={{ fontSize: 10 }}>تنتهي خلال {n} يوم</Tag> : <Tag color="success" style={{ fontSize: 10 }}>سارية</Tag>}</div>
    </div>
  );
}
const dName = (d?: Driver | null) => (d ? d.nameAr || d.nameEn || `سائق #${d.id}` : '—');

const VehiclesPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('vendors.manage');
  const [tab, setTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [usage, setUsage] = useState<{ vehicles: Record<number, Usage>; drivers: Record<number, Usage> }>({ vehicles: {}, drivers: {} });
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [owner, setOwner] = useState<'all' | 'own' | 'supplier'>('all');
  const [search, setSearch] = useState('');
  const [editVehicle, setEditVehicle] = useState<Vehicle | 'new' | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | 'new' | null>(null);
  const [history, setHistory] = useState<{ title: string; query: Record<string, number> } | null>(null);
  const [histRows, setHistRows] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vForm] = Form.useForm();
  const [dForm] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Paged<Vehicle>>('/vehicles', { query: { pageSize: 0 } }),
      api<Paged<Driver>>('/drivers', { query: { pageSize: 0 } }),
      api<Vendor[]>('/vendors/options').catch(() => [] as Vendor[]),
      api<any>('/fleet/usage').catch(() => ({ vehicles: [], drivers: [] })),
    ]).then(([v, d, vn, u]) => {
      setVehicles(v.items); setDrivers(d.items); setVendors(vn);
      const map = (list: any[], k: string) => Object.fromEntries((list ?? []).map((x: any) => [x[k], { count: x.count, litres: Number(x.litres), last: x.last }]));
      setUsage({ vehicles: map(u.vehicles, 'vehicleId'), drivers: map(u.drivers, 'driverId') });
    }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [key]);

  const ownVendorIds = useMemo(() => vendors.filter(v => OWN_CODES.includes(v.code ?? '')).map(v => v.id), [vendors]);
  const isOwn = (vendorId?: number | null) => !vendorId || ownVendorIds.includes(vendorId);
  const vendorName = (id?: number | null) => (isOwn(id) ? 'أسطول الشركة' : vendors.find(v => v.id === id)?.name ?? `مورد #${id}`);
  const suppliers = vendors.filter(v => !OWN_CODES.includes(v.code ?? '') && v.code !== 'CIVIL-DEFENSE');
  const driverById = (id?: number | null) => drivers.find(d => d.id === id);

  const s = search.trim().toLowerCase();
  const vRows = vehicles.filter(v => (owner === 'all' || (owner === 'own') === isOwn(v.vendorId))
    && (!s || v.plateNo.toLowerCase().includes(s) || vendorName(v.vendorId).toLowerCase().includes(s) || dName(driverById(v.defaultDriverId)).toLowerCase().includes(s)));
  const dRows = drivers.filter(d => (owner === 'all' || (owner === 'own') === isOwn(d.vendorId))
    && (!s || dName(d).toLowerCase().includes(s) || (d.phone ?? '').includes(s) || (d.licenseNo ?? '').toLowerCase().includes(s)));

  const expiring = (d?: string | null) => { const n = daysTo(d); return n != null && n <= 30; };
  const kpis = [
    { label: 'إجمالي المركبات', value: vehicles.length, color: PRIMARY, bg: '#e8f5e9', icon: <CarOutlined /> },
    { label: 'أسطول الشركة', value: vehicles.filter(v => isOwn(v.vendorId)).length, color: '#1677ff', bg: '#e6f4ff', icon: <CarOutlined /> },
    { label: 'صهاريج الموردين', value: vehicles.filter(v => !isOwn(v.vendorId)).length, color: '#fa8c16', bg: '#fff7e6', icon: <CarOutlined /> },
    { label: 'تسجيل منتهٍ / قريب', value: vehicles.filter(v => v.isActive && expiring(v.registrationExpiry)).length, color: '#ff4d4f', bg: '#fff1f0', icon: <WarningOutlined /> },
    { label: 'السائقون', value: drivers.filter(d => d.isActive).length, color: '#722ed1', bg: '#f9f0ff', icon: <TeamOutlined /> },
    { label: 'رخص منتهية / قريبة', value: drivers.filter(d => d.isActive && expiring(d.licenseExpiry)).length, color: '#d4380d', bg: '#fff2e8', icon: <IdcardOutlined /> },
  ];

  // ── vehicle form ──
  const openVehicle = (v: Vehicle | 'new') => {
    vForm.resetFields();
    if (v === 'new') vForm.setFieldsValue({ ownerType: 'own', isActive: true });
    else vForm.setFieldsValue({ ...v, ownerType: isOwn(v.vendorId) ? 'own' : 'supplier', vendorId: isOwn(v.vendorId) ? undefined : v.vendorId,
      registrationExpiry: v.registrationExpiry ? dayjs(v.registrationExpiry) : undefined });
    setEditVehicle(v);
  };
  const saveVehicle = async () => {
    const f = await vForm.validateFields();
    const body = {
      ...(editVehicle !== 'new' ? editVehicle : {}), plateNo: f.plateNo.trim(), vendorId: f.ownerType === 'own' ? null : f.vendorId,
      capacityLitres: f.capacityLitres ?? null, defaultDriverId: f.defaultDriverId ?? null,
      registrationExpiry: f.registrationExpiry ? f.registrationExpiry.format('YYYY-MM-DD') : null, isActive: !!f.isActive,
    };
    setSaving(true);
    try {
      if (editVehicle === 'new') await api('/vehicles', { method: 'POST', body });
      else await api(`/vehicles/${(editVehicle as Vehicle).id}`, { method: 'PUT', body });
      message.success('تم حفظ المركبة'); setEditVehicle(null); setKey(k => k + 1);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const toggleVehicle = async (v: Vehicle, isActive: boolean) => {
    try { await api(`/vehicles/${v.id}`, { method: 'PUT', body: { ...v, isActive } }); setKey(k => k + 1); } catch (e) { message.error(errorMessage(e)); }
  };

  // ── driver form ──
  const openDriver = (d: Driver | 'new') => {
    dForm.resetFields();
    if (d === 'new') dForm.setFieldsValue({ ownerType: 'own', isActive: true });
    else dForm.setFieldsValue({ ...d, ownerType: isOwn(d.vendorId) ? 'own' : 'supplier', vendorId: isOwn(d.vendorId) ? undefined : d.vendorId,
      licenseExpiry: d.licenseExpiry ? dayjs(d.licenseExpiry) : undefined });
    setEditDriver(d);
  };
  const saveDriver = async () => {
    const f = await dForm.validateFields();
    const body = {
      ...(editDriver !== 'new' ? editDriver : {}), nameAr: f.nameAr, nameEn: f.nameEn || null, phone: f.phone || null, licenseNo: f.licenseNo || null,
      licenseExpiry: f.licenseExpiry ? f.licenseExpiry.format('YYYY-MM-DD') : null, hazmatPermitNo: f.hazmatPermitNo || null,
      vendorId: f.ownerType === 'own' ? null : f.vendorId, isActive: !!f.isActive,
    };
    setSaving(true);
    try {
      if (editDriver === 'new') await api('/drivers', { method: 'POST', body });
      else await api(`/drivers/${(editDriver as Driver).id}`, { method: 'PUT', body });
      message.success('تم حفظ السائق'); setEditDriver(null); setKey(k => k + 1);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const toggleDriver = async (d: Driver, isActive: boolean) => {
    try { await api(`/drivers/${d.id}`, { method: 'PUT', body: { ...d, isActive } }); setKey(k => k + 1); } catch (e) { message.error(errorMessage(e)); }
  };
  const remove = async (path: string) => {
    try { await api(path, { method: 'DELETE' }); message.success('تم الحذف'); setKey(k => k + 1); } catch (e) { message.error(errorMessage(e), 6); }
  };

  const openHistory = useCallback((title: string, query: Record<string, number>) => {
    setHistory({ title, query }); setHistLoading(true);
    api<any[]>('/fleet/collections', { query }).then(setHistRows).catch(e => { setHistRows([]); message.error(errorMessage(e)); }).finally(() => setHistLoading(false));
  }, []);

  const usageCell = (u?: Usage) => !u ? <Text type="secondary" style={{ fontSize: 11 }}>لا توجد عمليات</Text> : (
    <div style={{ fontSize: 11 }}><b>{u.count}</b> عملية استلام · {Math.round(u.litres).toLocaleString()} لتر
      {u.last && <div style={{ color: '#888' }}>آخرها {dayjs(u.last).format('YYYY-MM-DD')}</div>}</div>
  );

  const ownerFields = (form: typeof vForm) => (
    <Row gutter={12}>
      <Col span={12}><Form.Item name="ownerType" label="تابع لـ" rules={[{ required: true }]}>
        <Segmented block options={[{ value: 'own', label: 'أسطول الشركة' }, { value: 'supplier', label: 'مورد (طرف ثالث)' }]} />
      </Form.Item></Col>
      <Col span={12}><Form.Item noStyle shouldUpdate={(a, b) => a.ownerType !== b.ownerType}>
        {() => form.getFieldValue('ownerType') === 'supplier' && (
          <Form.Item name="vendorId" label="المورد" rules={[{ required: true, message: 'اختر المورد' }]}>
            <Select showSearch optionFilterProp="label" options={suppliers.map(v => ({ value: v.id, label: v.name }))} notFoundContent="لا يوجد موردون" />
          </Form.Item>
        )}
      </Form.Item></Col>
    </Row>
  );

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarOutlined /></span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>المركبات والسائقون</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>صهاريج أسطول الشركة وصهاريج الموردين، السائقون، انتهاء التسجيل والرخص، وسجل عمليات الاستلام</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)}>تحديث</Button>
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {kpis.map(k => (
          <Col xs={12} md={8} xl={4} key={k.label}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: k.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, color: k.color }}>{k.icon}</span>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div><div style={{ fontSize: 11, color: '#666' }}>{k.label}</div></div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} style={{ borderRadius: 14 }} styles={{ body: { padding: '4px 16px 16px' } }}>
        <Tabs activeKey={tab} onChange={setTab}
          tabBarExtraContent={
            <Space wrap>
              <Segmented size="small" value={owner} onChange={v => setOwner(v as any)} options={[{ value: 'all', label: 'الكل' }, { value: 'own', label: 'أسطول الشركة' }, { value: 'supplier', label: 'الموردون' }]} />
              <Input.Search size="small" allowClear placeholder="بحث…" style={{ width: 180 }} onChange={e => setSearch(e.target.value)} />
              {canManage && (tab === 'vehicles'
                ? <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openVehicle('new')}>مركبة جديدة</Button>
                : <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openDriver('new')}>سائق جديد</Button>)}
            </Space>
          }
          items={[
            {
              key: 'vehicles', label: <span><CarOutlined /> المركبات ({vehicles.length})</span>,
              children: (
                <Table<Vehicle> size="small" rowKey="id" loading={loading} dataSource={vRows} scroll={{ x: 1000 }} pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  locale={{ emptyText: <Empty description="لا توجد مركبات" /> }}
                  onRow={v => ({ style: v.isActive ? undefined : { opacity: 0.55 } })}
                  columns={[
                    { title: 'اللوحة', dataIndex: 'plateNo', render: v => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text> },
                    { title: 'تابع لـ', dataIndex: 'vendorId', render: v => <Tag color={isOwn(v) ? 'green' : 'orange'}>{vendorName(v)}</Tag> },
                    { title: 'السعة', dataIndex: 'capacityLitres', render: v => (v ? `${Number(v).toLocaleString()} لتر` : '—') },
                    { title: 'السائق الافتراضي', dataIndex: 'defaultDriverId', render: v => dName(driverById(v)) },
                    { title: 'انتهاء التسجيل', dataIndex: 'registrationExpiry', render: v => <ExpiryTag date={v} /> },
                    { title: 'عمليات الاستلام', key: 'u', render: (_, v) => usageCell(usage.vehicles[v.id]) },
                    { title: 'نشطة', dataIndex: 'isActive', width: 80, render: (a, v) => canManage ? <Switch size="small" checked={a} onChange={c => toggleVehicle(v, c)} /> : (a ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : '—') },
                    { title: '', key: 'a', width: 120, render: (_, v) => (
                      <Space size={2}>
                        <Tooltip title="سجل عمليات الاستلام"><Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => openHistory(`سجل المركبة ${v.plateNo}`, { vehicleId: v.id })} /></Tooltip>
                        {canManage && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openVehicle(v)} />}
                        {canManage && <Popconfirm title="حذف المركبة؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(`/vehicles/${v.id}`)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
                      </Space>) },
                  ]} />
              ),
            },
            {
              key: 'drivers', label: <span><TeamOutlined /> السائقون ({drivers.length})</span>,
              children: (
                <Table<Driver> size="small" rowKey="id" loading={loading} dataSource={dRows} scroll={{ x: 1000 }} pagination={{ pageSize: 15, hideOnSinglePage: true }}
                  locale={{ emptyText: <Empty description="لا يوجد سائقون" /> }}
                  onRow={d => ({ style: d.isActive ? undefined : { opacity: 0.55 } })}
                  columns={[
                    { title: 'السائق', key: 'n', render: (_, d) => <div><Text strong>{dName(d)}</Text>{d.nameEn && d.nameAr && <div style={{ fontSize: 11, color: '#888' }}>{d.nameEn}</div>}</div> },
                    { title: 'تابع لـ', dataIndex: 'vendorId', render: v => <Tag color={isOwn(v) ? 'green' : 'orange'}>{vendorName(v)}</Tag> },
                    { title: 'الهاتف', dataIndex: 'phone', render: v => (v ? <span dir="ltr">{v}</span> : '—') },
                    { title: 'رقم الرخصة', dataIndex: 'licenseNo', render: v => v ?? '—' },
                    { title: 'انتهاء الرخصة', dataIndex: 'licenseExpiry', render: v => <ExpiryTag date={v} /> },
                    { title: 'تصريح المواد الخطرة', dataIndex: 'hazmatPermitNo', render: v => (v ? <Tag icon={<SafetyCertificateOutlined />} color="blue">{v}</Tag> : <Tag color="default">لا يوجد</Tag>) },
                    { title: 'عمليات الاستلام', key: 'u', render: (_, d) => usageCell(usage.drivers[d.id]) },
                    { title: 'نشط', dataIndex: 'isActive', width: 70, render: (a, d) => canManage ? <Switch size="small" checked={a} onChange={c => toggleDriver(d, c)} /> : (a ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : '—') },
                    { title: '', key: 'a', width: 120, render: (_, d) => (
                      <Space size={2}>
                        <Tooltip title="سجل عمليات الاستلام"><Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => openHistory(`سجل السائق ${dName(d)}`, { driverId: d.id })} /></Tooltip>
                        {canManage && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openDriver(d)} />}
                        {canManage && <Popconfirm title="حذف السائق؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(`/drivers/${d.id}`)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
                      </Space>) },
                  ]} />
              ),
            },
          ]} />
      </Card>

      <Modal open={editVehicle != null} title={editVehicle === 'new' ? 'مركبة جديدة' : 'تعديل المركبة'} okText="حفظ" cancelText="إلغاء" onOk={saveVehicle}
        confirmLoading={saving} onCancel={() => setEditVehicle(null)} destroyOnClose width={620}>
        <Form form={vForm} layout="vertical">
          {ownerFields(vForm)}
          <Row gutter={12}>
            <Col span={12}><Form.Item name="plateNo" label="رقم اللوحة" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="capacityLitres" label="السعة (لتر)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item noStyle shouldUpdate={(a, b) => a.ownerType !== b.ownerType || a.vendorId !== b.vendorId}>
              {() => {
                const own = vForm.getFieldValue('ownerType') === 'own';
                const vid = vForm.getFieldValue('vendorId');
                return (
                  <Form.Item name="defaultDriverId" label="السائق الافتراضي">
                    <Select allowClear showSearch optionFilterProp="label" notFoundContent="لا يوجد سائقون لهذا المالك"
                      options={drivers.filter(d => d.isActive && (own ? isOwn(d.vendorId) : d.vendorId === vid)).map(d => ({ value: d.id, label: dName(d) }))} />
                  </Form.Item>
                );
              }}
            </Form.Item></Col>
            <Col span={12}><Form.Item name="registrationExpiry" label="انتهاء التسجيل (الملكية)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="نشطة" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={editDriver != null} title={editDriver === 'new' ? 'سائق جديد' : 'تعديل السائق'} okText="حفظ" cancelText="إلغاء" onOk={saveDriver}
        confirmLoading={saving} onCancel={() => setEditDriver(null)} destroyOnClose width={620}>
        <Form form={dForm} layout="vertical">
          {ownerFields(dForm)}
          <Row gutter={12}>
            <Col span={12}><Form.Item name="nameAr" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="licenseNo" label="رقم الرخصة"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="licenseExpiry" label="انتهاء الرخصة"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="hazmatPermitNo" label="تصريح نقل المواد الخطرة"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Drawer open={!!history} title={history?.title} width={760} onClose={() => setHistory(null)}>
        <Table size="small" rowKey="id" loading={histLoading} dataSource={histRows} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="لا توجد عمليات استلام غاز" /> }}
          columns={[
            { title: 'التاريخ', dataIndex: 'collectionDate', render: v => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
            { title: 'طلب التعبئة', dataIndex: 'requestNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
            { title: 'المبنى / الخزان', key: 'b', render: (_, r) => <div style={{ fontSize: 12 }}>{r.buildingCode} — {r.building}<div style={{ color: '#888' }}>خزان {r.tank}</div></div> },
            { title: 'المركبة', dataIndex: 'plate', render: v => v ?? '—' },
            { title: 'السائق', dataIndex: 'driver', render: v => v ?? '—' },
            { title: 'العداد قبل / بعد', key: 'm', render: (_, r) => <span style={{ fontSize: 12 }}>{r.meterBefore ?? '—'} → {r.meterAfter ?? '—'}</span> },
            { title: 'الكمية', dataIndex: 'qty', render: v => (v != null ? `${Number(v).toLocaleString()} لتر` : '—') },
          ]} />
      </Drawer>
    </div>
  );
};

export default VehiclesPage;
