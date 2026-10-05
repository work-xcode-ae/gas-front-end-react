import KpiCard from '../../components/KpiCard';
import TableSkeleton from '../../components/TableSkeleton';
import React, { useState, useEffect } from 'react';
import { getBuildings, getBuildingUnits, getAllBuildingUnits, getAmcContracts, getBuildingStats } from '../../api/buildings';
import type { Building, BuildingUnit, AmcContract, BuildingStats } from '../../api/buildings';
import BuildingProfile from './BuildingProfile';
import {
  Row, Col, Card, Table, Button, Tag, Input, Select, Space, InputNumber,
  Modal, Form, Typography, Statistic, Divider, Tooltip, Badge, Steps, Result, Upload
, Skeleton } from 'antd';
import {
  BankOutlined, PlusOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  EnvironmentOutlined, HomeOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  NumberOutlined, ApartmentOutlined, FileTextOutlined, ShopOutlined, UserOutlined, PhoneOutlined, MailOutlined, IdcardOutlined, SafetyCertificateOutlined, UploadOutlined, BuildOutlined, StarFilled, StarOutlined, DatabaseOutlined, CalendarOutlined, UsergroupAddOutlined
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY = '#1a5c2a';
const PRIMARY_LIGHT = '#e8f5e9';

const mockData = [
  { key: 1, no: 'B-001', name: 'مجمع الرحاب', branch: 'أبوظبي', units: 24, occupied: 22, vacant: 2, status: 'active' },
  { key: 2, no: 'B-002', name: 'برج الخليج', branch: 'دبي', units: 48, occupied: 45, vacant: 3, status: 'active' },
  { key: 3, no: 'B-003', name: 'مجمع النخيل', branch: 'الشارقة', units: 36, occupied: 33, vacant: 3, status: 'active' },
  { key: 4, no: 'B-004', name: 'مبنى الياسمين', branch: 'عجمان', units: 18, occupied: 14, vacant: 4, status: 'inactive' },
  { key: 5, no: 'B-005', name: 'برج المارينا', branch: 'أبوظبي', units: 60, occupied: 58, vacant: 2, status: 'active' },
  { key: 6, no: 'B-006', name: 'مجمع الفجيرة', branch: 'الفجيرة', units: 22, occupied: 18, vacant: 4, status: 'active' },
];

// kpis computed inside component from live data — see below

const barOptions: any = {
  chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
  colors: [PRIMARY],
  plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
  dataLabels: { enabled: false },
  xaxis: { categories: ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'الفجيرة'], labels: { style: { fontSize: '12px' } } },
  grid: { borderColor: '#f5f5f5', strokeDashArray: 4 },
  tooltip: { y: { formatter: (v: number) => `${v} مبنى` } },
};

const pieOptions: any = {
  chart: { type: 'donut', fontFamily: 'inherit' },
  colors: [PRIMARY, '#ff4d4f'],
  labels: ['مشغولة', 'شاغرة'],
  legend: { position: 'bottom', fontSize: '13px' },
  plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'المشغولة', color: PRIMARY, fontSize: '14px', fontWeight: 700 } } } } },
  dataLabels: { enabled: false },
  stroke: { width: 0 },
};

const STEPS = [
  { title: 'معلومات المبنى', icon: <BankOutlined /> },
  { title: 'معلومات المالك', icon: <UserOutlined /> },
  { title: 'معلومات الخزانات', icon: <DatabaseOutlined /> },
  { title: 'الوحدات والحالة', icon: <ApartmentOutlined /> },
  { title: 'العنوان والملاحظات', icon: <FileTextOutlined /> },
];

const Buildings: React.FC = () => {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [primaryOwnerIdx, setPrimaryOwnerIdx] = useState(0);
  const [defaultPhones, setDefaultPhones] = useState<Record<number, number>>({ 0: 0 });
  const [defaultEmails, setDefaultEmails] = useState<Record<number, number>>({ 0: 0 });
  // Mock data — will be replaced by API
  const [mockMeters, setMockMeters] = useState<string[]>(['M-001', 'M-002', 'M-003', 'M-004', 'M-005']);
  const [mockTenants, setMockTenants] = useState<{ id: string; name: string; phone: string }[]>([
    { id: 'T-001', name: 'أحمد محمد علي', phone: '+971501234567' },
    { id: 'T-002', name: 'فاطمة خالد النعيمي', phone: '+971502345678' },
  ]);
  const [newMeterInput, setNewMeterInput] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPhone, setNewTenantPhone] = useState('');

  // Quick unit generator state
  const [genFloors, setGenFloors] = useState(1);
  const [genStartFloor, setGenStartFloor] = useState(1);
  const [genUnitsPerFloor, setGenUnitsPerFloor] = useState(1);
  const [genNaming, setGenNaming] = useState<'floor_unit' | 'floor_letter' | 'sequential' | 'floor_dash'>('floor_unit');
  const [genUnitType, setGenUnitType] = useState('apartment');
  const [viewModal, setViewModal] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [form] = Form.useForm();
  const [liveBuildings, setLiveBuildings] = useState<Building[]>([]);
  const [liveUnits, setLiveUnits] = useState<BuildingUnit[]>([]);
  const [liveAmc, setLiveAmc] = useState<AmcContract[]>([]);
  const [buildingStats, setBuildingStats] = useState<BuildingStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    setDataLoading(true);
    // 3 parallel requests — avoids N+1 per-building unit calls
    Promise.all([
      getBuildings(),
      getAllBuildingUnits(),
      getAmcContracts(),
    ]).then(async ([buildings, allUnits, amc]) => {
      setLiveBuildings(buildings);
      setLiveUnits(allUnits);
      setLiveAmc(amc);
      const stats = await getBuildingStats(buildings, allUnits);
      setBuildingStats(stats);
    }).catch(err => console.warn('Buildings API error:', err))
      .finally(() => setDataLoading(false));
  }, []);

  // ── Live KPIs ──────────────────────────────────────────────────────────────
  const kpis = [
    {
      title: 'إجمالي المباني',
      value: buildingStats?.total ?? liveBuildings.length ?? 0,
      trend: +4.2, sub: 'مقارنة بالشهر الماضي',
      icon: <BankOutlined />, color: PRIMARY, bg: PRIMARY_LIGHT,
    },
    {
      title: 'مباني نشطة',
      value: buildingStats?.active ?? liveBuildings.filter(b => b.status === 'Active').length ?? 0,
      trend: +2.1, sub: `${buildingStats ? Math.round((buildingStats.active / (buildingStats.total || 1)) * 100) : 92}% من الإجمالي`,
      icon: <CheckCircleOutlined />, color: '#1565c0', bg: '#e3f2fd',
    },
    {
      title: 'إجمالي الوحدات',
      value: buildingStats?.totalUnits ?? liveBuildings.reduce((s, b) => s + (b.total_units || 0), 0) ?? 0,
      trend: +8.5, sub: 'عبر جميع الإمارات',
      icon: <HomeOutlined />, color: '#6a1b9a', bg: '#f3e5f5',
    },
    {
      title: 'وحدات شاغرة',
      value: buildingStats?.vacantUnits ?? 0,
      trend: -3.2,
      sub: buildingStats ? `${Math.round((buildingStats.vacantUnits / (buildingStats.totalUnits || 1)) * 100)}% من الإجمالي` : '',
      icon: <ExclamationCircleOutlined />, color: '#c62828', bg: '#ffebee',
    },
  ];

  // ── Live chart data ─────────────────────────────────────────────────────────
  const emirateLabels = Object.keys(buildingStats?.byEmirate || {});
  const emirateCounts = emirateLabels.map(e => buildingStats!.byEmirate[e]);
  const liveBarOptions = emirateLabels.length > 0
    ? { ...barOptions, xaxis: { ...barOptions.xaxis, categories: emirateLabels } }
    : barOptions;
  const liveBarSeries = emirateLabels.length > 0
    ? [{ name: 'المباني', data: emirateCounts }]
    : [{ name: 'المباني', data: [12, 8, 6, 4, 3] }];
  const livePieSeries = buildingStats && liveUnits.length > 0
    ? [buildingStats.occupiedUnits, buildingStats.vacantUnits]
    : [2172, 184];

  const tableData = liveBuildings.length > 0
    ? liveBuildings.map((b, i) => ({
        key: i + 1,
        no: b.name,
        name: b.building_name || b.building_name_en || b.name,
        branch: b.emirate || b.city || '—',
        units: b.total_units || 0,
        occupied: 0,
        vacant: 0,
        status: (b.status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      }))
    : [];

  const filtered = tableData.filter(r => {
    const matchSearch = !search || r.name.includes(search) || r.no.includes(search);
    const matchBranch = !branchFilter || r.branch === branchFilter;
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchBranch && matchStatus;
  });

  const openModal = () => {
    setCurrentStep(0);
    setDone(false);
    setPrimaryOwnerIdx(0);
    setDefaultPhones({ 0: 0 });
    setDefaultEmails({ 0: 0 });
    form.resetFields();
    form.setFieldsValue({ owners: [{ ownerType: 'individual', phones: [''], emails: [''] }] });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setDone(false); setPrimaryOwnerIdx(0); setDefaultPhones({ 0: 0 }); setDefaultEmails({ 0: 0 }); form.resetFields(); };

  const confirmCancel = () => {
    Modal.confirm({
      title: 'إلغاء إضافة المبنى؟',
      content: 'سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟',
      okText: 'نعم، إلغاء',
      cancelText: 'لا، متابعة',
      okType: 'danger',
      centered: true,
      onOk: closeModal,
    });
  };

  const nextStep = () => {
    if (currentStep === 0) {
      form.validateFields(['no', 'name', 'nameEn', 'branch', 'type']).then(() => setCurrentStep(s => s + 1));
    } else if (currentStep === 1) {
      form.validateFields().then(() => setCurrentStep(s => s + 1));
    } else if (currentStep === 2) {
      // Tanks step — no required fields, proceed freely
      setCurrentStep(s => s + 1);
    } else if (currentStep === 3) {
      // Units step — status has initialValue, just proceed
      setCurrentStep(s => s + 1);
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const prevStep = () => setCurrentStep(s => s - 1);

  const addQuickMeter = () => {
    const val = newMeterInput.trim();
    if (val && !mockMeters.includes(val)) { setMockMeters(prev => [...prev, val]); }
    setNewMeterInput('');
  };

  const addQuickTenant = () => {
    const name = newTenantName.trim();
    if (name) {
      const id = `T-${String(mockTenants.length + 1).padStart(3, '0')}`;
      setMockTenants(prev => [...prev, { id, name, phone: newTenantPhone.trim() }]);
      setNewTenantName('');
      setNewTenantPhone('');
    }
  };

  const generateUnits = () => {
    const units: { unitNo: string; floor: number | string; type: string; area: string; status: string }[] = [];
    let seq = 1;
    for (let f = genStartFloor; f < genStartFloor + genFloors; f++) {
      const floorLabel = f === 0 ? 'أرضي' : f < 0 ? `بدروم ${Math.abs(f)}` : `${f}`;
      for (let u = 1; u <= genUnitsPerFloor; u++) {
        let unitNo = '';
        if (genNaming === 'floor_unit') {
          unitNo = `${f}${u.toString().padStart(2, '0')}`;
        } else if (genNaming === 'floor_letter') {
          unitNo = `${f}${String.fromCharCode(64 + u)}`;
        } else if (genNaming === 'floor_dash') {
          unitNo = `${f}-${u}`;
        } else {
          unitNo = `${seq}`;
        }
        units.push({ unitNo, floor: f === 0 ? 'أرضي' : f, type: genUnitType, area: '', status: 'vacant' });
        seq++;
      }
    }
    form.setFieldsValue({ unitsList: units });
  };

  const onFinish = () => {
    form.validateFields().then(() => setDone(true));
  };

  const columns = [
    { title: 'رقم المبنى', dataIndex: 'no', key: 'no', width: 110, render: (v: string) => <Text strong style={{ color: PRIMARY, fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'اسم المبنى', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'الفرع', dataIndex: 'branch', key: 'branch', render: (v: string) => <Tag icon={<EnvironmentOutlined />} color="default">{v}</Tag> },
    { title: 'الوحدات', dataIndex: 'units', key: 'units', width: 90, align: 'center' as const },
    {
      title: 'مشغولة / شاغرة', key: 'occ', width: 140, align: 'center' as const,
      render: (_: any, r: any) => <Space size={4}><Text style={{ color: PRIMARY, fontWeight: 600 }}>{r.occupied}</Text><Text type="secondary">/</Text><Text style={{ color: '#c62828', fontWeight: 600 }}>{r.vacant}</Text></Space>
    },
    {
      title: 'الإشغال', key: 'rate', width: 90, align: 'center' as const,
      render: (_: any, r: any) => {
        const pct = Math.round((r.occupied / r.units) * 100);
        return <Badge count={`${pct}%`} style={{ backgroundColor: pct >= 90 ? PRIMARY : pct >= 70 ? '#f59e0b' : '#ef4444', fontSize: 11 }} />;
      }
    },
    { title: 'الحالة', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === 'active' ? 'success' : 'default'} style={{ borderRadius: 20, fontWeight: 500 }}>{v === 'active' ? 'نشط' : 'غير نشط'}</Tag> },
    {
      title: 'الإجراءات', key: 'actions', width: 110, align: 'center' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Tooltip title="عرض الملف الكامل"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => { setViewModal(r); setShowProfile(true); }} style={{ color: PRIMARY }} /></Tooltip>
          <Tooltip title="تعديل"><Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#1565c0' }} /></Tooltip>
          <Tooltip title="حذف"><Button size="small" type="text" icon={<DeleteOutlined />} danger /></Tooltip>
        </Space>
      )
    },
  ];

  if (showProfile) {
    return <BuildingProfile buildingName={viewModal?.no} onBack={() => { setShowProfile(false); setViewModal(null); }} />;
  }

  return (
    <div style={{ padding: '20px 24px', background: '#f7f8fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: PRIMARY }}>
            <BankOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1a1a2e' }}>المباني</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>إدارة وعرض جميع المباني عبر الفروع</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, height: 42, paddingInline: 20 }}
          onClick={openModal}>
          إضافة مبنى
        </Button>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <KpiCard
              title={k.title}
              value={k.value}
              prefix={k.prefix}
              suffix={k.suffix}
              sub={k.sub}
              icon={k.icon}
              color={k.color}
              bg={k.bg}
              loading={dataLoading}
            />
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={15}>
          <Card title={<Text strong style={{ fontSize: 14 }}>توزيع المباني حسب الفرع</Text>} style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { paddingTop: 8 } }}>
            <ReactApexChart options={liveBarOptions} series={liveBarSeries} type="bar" height={220} />
          </Card>
        </Col>
        <Col xs={24} md={9}>
          <Card title={<Text strong style={{ fontSize: 14 }}>نسبة إشغال الوحدات</Text>} style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', height: '100%' }} styles={{ body: { paddingTop: 8 } }}>
            <ReactApexChart options={pieOptions} series={livePieSeries} type="donut" height={220} />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 14, marginInlineEnd: 'auto' }}>قائمة المباني</Text>
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="بحث باسم المبنى أو الرقم..." style={{ width: 220, borderRadius: 8 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
          <Select placeholder="الفرع" style={{ width: 130 }} allowClear onChange={v => setBranchFilter(v)}>
            {['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'الفجيرة'].map(b => <Option key={b} value={b}>{b}</Option>)}
          </Select>
          <Select placeholder="الحالة" style={{ width: 120 }} allowClear onChange={v => setStatusFilter(v)}>
            <Option value="active">نشط</Option>
            <Option value="inactive">غير نشط</Option>
          </Select>
        </div>
        {dataLoading ? (
          <TableSkeleton
            rows={8}
            colWidths={['10%', '22%', '12%', '10%', '14%', '16%', '16%']}
          />
        ) : (
          <Table
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 10, showTotal: (t) => `إجمالي ${t} مبنى`, size: 'small' }}
            size="middle"
            scroll={{ x: true }}
          />
        )}
      </Card>

      {/* ── ADD BUILDING MODAL (Multi-step) ── */}
      <Modal
        open={modalOpen}
        onCancel={confirmCancel}
        footer={null}
        width={1100}
        centered
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY}, #0b2e18)`, padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>
              <BankOutlined />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>إضافة مبنى جديد</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {done ? 'تم الحفظ بنجاح' : `الخطوة ${currentStep + 1} من ${STEPS.length}`}
              </div>
            </div>
          </div>
          {!done && (
            <Steps
              current={currentStep}
              size="small"
              items={STEPS.map(s => ({ title: <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{s.title}</span>, icon: s.icon }))}
              style={{ '--ant-steps-icon-size': '28px' } as any}
            />
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '28px 32px', maxHeight: '65vh', overflowY: 'auto' }}>
          {done ? (
            <Result
              status="success"
              icon={<CheckCircleOutlined style={{ color: PRIMARY, fontSize: 56 }} />}
              title={<span style={{ color: PRIMARY, fontWeight: 700 }}>تم إضافة المبنى بنجاح!</span>}
              subTitle="سيظهر المبنى الجديد في قائمة المباني"
              extra={[
                <Button key="another" onClick={() => { setCurrentStep(0); setDone(false); form.resetFields(); }}>إضافة مبنى آخر</Button>,
                <Button key="close" type="primary" style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={closeModal}>إغلاق</Button>,
              ]}
            />
          ) : (
            <Form form={form} layout="vertical">
              {/* Step 1 */}
              {currentStep === 0 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أدخل المعلومات الأساسية للمبنى
                  </Text>
                  <Form.Item name="no" label="رقم المبنى" rules={[{ required: true, message: 'الرجاء إدخال رقم المبنى' }]}>
                    <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="مثال: B-007" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="name" label="اسم المبنى (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم المبنى بالعربي' }]}>
                    <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="اسم المبنى بالعربي" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="nameEn" label="Building Name (English)" rules={[{ required: true, message: 'Please enter the building name in English' }]}>
                    <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="e.g. Al Amal Tower" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                  </Form.Item>
                  <Form.Item name="branch" label="الفرع" rules={[{ required: true, message: 'الرجاء اختيار الفرع' }]}>
                    <Select placeholder="اختر الفرع" size="large" style={{ borderRadius: 8 }}>
                      {['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'الفجيرة'].map(b => <Option key={b} value={b}><EnvironmentOutlined style={{ marginInlineEnd: 6 }} />{b}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="type" label="نوع المبنى" rules={[{ required: true, message: 'الرجاء اختيار نوع المبنى' }]}>
                    <Select placeholder="اختر نوع المبنى" size="large" style={{ borderRadius: 8 }}>
                      <Option value="residential"><HomeOutlined style={{ marginInlineEnd: 6 }} />سكني</Option>
                      <Option value="commercial"><ShopOutlined style={{ marginInlineEnd: 6 }} />تجاري</Option>
                    </Select>
                  </Form.Item>
                </div>
              )}

              {/* Step 2 - Owner Info */}
              {currentStep === 1 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أدخل معلومات ملاك المبنى. يمكنك إضافة أكثر من مالك.
                  </Text>

                  <Form.List name="owners">
                    {(ownerFields, { add: addOwner, remove: removeOwner }) => (
                      <>
                        {ownerFields.map((ownerField, ownerIndex) => (
                          <Card
                            key={ownerField.key}
                            size="small"
                            style={{ marginBottom: 16, borderRadius: 12, border: '1.5px solid #e3f0ff', background: '#fafcff' }}
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Text strong style={{ color: '#1677ff' }}>
                                    <UserOutlined style={{ marginInlineEnd: 6 }} />
                                    {`المالك ${ownerIndex + 1}`}
                                  </Text>
                                  {primaryOwnerIdx === ownerIndex ? (
                                    <Tag icon={<StarFilled />} color="gold" style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                                      المالك المسؤول
                                    </Tag>
                                  ) : (
                                    <Tag
                                      style={{ margin: 0, borderRadius: 10, fontSize: 11, cursor: 'pointer', borderStyle: 'dashed' }}
                                      onClick={() => setPrimaryOwnerIdx(ownerIndex)}
                                    >
                                      تعيين كمسؤول
                                    </Tag>
                                  )}
                                </div>
                                {ownerFields.length > 1 && (
                                  <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                    onClick={() => {
                                      removeOwner(ownerField.name);
                                      if (primaryOwnerIdx === ownerIndex) setPrimaryOwnerIdx(0);
                                      else if (primaryOwnerIdx > ownerIndex) setPrimaryOwnerIdx(p => p - 1);
                                    }}
                                  >
                                    حذف
                                  </Button>
                                )}
                              </div>
                            }
                          >
                            {/* Owner Type */}
                            <Form.Item name={[ownerField.name, 'ownerType']} label="نوع المالك" initialValue="individual" rules={[{ required: true }]}>
                              <Select size="large" style={{ borderRadius: 8 }}>
                                <Option value="individual"><UserOutlined style={{ marginInlineEnd: 6 }} />فرد (شخصي)</Option>
                                <Option value="company"><BuildOutlined style={{ marginInlineEnd: 6 }} />شركة</Option>
                              </Select>
                            </Form.Item>

                            {/* Owner Names */}
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'ownerName']} label="اسم المالك (عربي)" rules={[{ required: true, message: 'الرجاء إدخال الاسم بالعربي' }]}>
                                  <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="الاسم الكامل بالعربي" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'ownerNameEn']} label="Owner Name (English)" rules={[{ required: true, message: 'Please enter name in English' }]}>
                                  <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="Full name in English" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Phones */}
                            <Form.Item label="أرقام الهاتف" required style={{ marginBottom: 8 }}>
                              <Form.List name={[ownerField.name, 'phones']}>
                                {(phoneFields, { add: addPhone, remove: removePhone }) => (
                                  <>
                                    {phoneFields.map((phoneField, phoneIndex) => (
                                      <div key={phoneField.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                        {phoneFields.length > 1 && ownerIndex === primaryOwnerIdx && (
                                          <Tooltip title={defaultPhones[ownerIndex] === phoneIndex ? 'الرقم الافتراضي' : 'تعيين كافتراضي'}>
                                            <Button
                                              type="text"
                                              size="small"
                                              icon={defaultPhones[ownerIndex] === phoneIndex
                                                ? <StarFilled style={{ color: '#faad14' }} />
                                                : <StarOutlined style={{ color: '#ccc' }} />}
                                              onClick={() => setDefaultPhones(prev => ({ ...prev, [ownerIndex]: phoneIndex }))}
                                            />
                                          </Tooltip>
                                        )}
                                        <Form.Item name={[phoneField.name]} noStyle rules={[{ required: phoneIndex === 0, message: 'الرجاء إدخال رقم الهاتف' }]}>
                                          <Input
                                            prefix={<PhoneOutlined style={{ color: '#bbb' }} />}
                                            placeholder="+971 50 000 0000"
                                            size="large"
                                            style={{ borderRadius: 8, direction: 'ltr', flex: 1,
                                              ...(defaultPhones[ownerIndex] === phoneIndex && phoneFields.length > 1 && ownerIndex === primaryOwnerIdx ? { borderColor: '#faad14', boxShadow: '0 0 0 2px rgba(250,173,20,0.15)' } : {})
                                            }}
                                          />
                                        </Form.Item>
                                        {phoneFields.length > 1 && (
                                          <Button size="large" icon={<DeleteOutlined />} danger type="text"
                                            onClick={() => {
                                              removePhone(phoneField.name);
                                              const cur = defaultPhones[ownerIndex] ?? 0;
                                              if (cur === phoneIndex) setDefaultPhones(prev => ({ ...prev, [ownerIndex]: 0 }));
                                              else if (cur > phoneIndex) setDefaultPhones(prev => ({ ...prev, [ownerIndex]: cur - 1 }));
                                            }}
                                          />
                                        )}
                                      </div>
                                    ))}
                                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addPhone('')} style={{ borderRadius: 8 }}>
                                      إضافة رقم هاتف
                                    </Button>
                                  </>
                                )}
                              </Form.List>
                            </Form.Item>

                            {/* Emails */}
                            <Form.Item label="البريد الإلكتروني" required style={{ marginBottom: 8 }}>
                              <Form.List name={[ownerField.name, 'emails']}>
                                {(emailFields, { add: addEmail, remove: removeEmail }) => (
                                  <>
                                    {emailFields.map((emailField, emailIndex) => (
                                      <div key={emailField.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                        {emailFields.length > 1 && ownerIndex === primaryOwnerIdx && (
                                          <Tooltip title={defaultEmails[ownerIndex] === emailIndex ? 'البريد الافتراضي' : 'تعيين كافتراضي'}>
                                            <Button
                                              type="text"
                                              size="small"
                                              icon={defaultEmails[ownerIndex] === emailIndex
                                                ? <StarFilled style={{ color: '#faad14' }} />
                                                : <StarOutlined style={{ color: '#ccc' }} />}
                                              onClick={() => setDefaultEmails(prev => ({ ...prev, [ownerIndex]: emailIndex }))}
                                            />
                                          </Tooltip>
                                        )}
                                        <Form.Item name={[emailField.name]} noStyle rules={[{ required: emailIndex === 0, type: 'email', message: 'الرجاء إدخال بريد إلكتروني صحيح' }]}>
                                          <Input
                                            prefix={<MailOutlined style={{ color: '#bbb' }} />}
                                            placeholder="example@email.com"
                                            size="large"
                                            style={{ borderRadius: 8, direction: 'ltr', flex: 1,
                                              ...(defaultEmails[ownerIndex] === emailIndex && emailFields.length > 1 && ownerIndex === primaryOwnerIdx ? { borderColor: '#faad14', boxShadow: '0 0 0 2px rgba(250,173,20,0.15)' } : {})
                                            }}
                                          />
                                        </Form.Item>
                                        {emailFields.length > 1 && (
                                          <Button size="large" icon={<DeleteOutlined />} danger type="text"
                                            onClick={() => {
                                              removeEmail(emailField.name);
                                              const cur = defaultEmails[ownerIndex] ?? 0;
                                              if (cur === emailIndex) setDefaultEmails(prev => ({ ...prev, [ownerIndex]: 0 }));
                                              else if (cur > emailIndex) setDefaultEmails(prev => ({ ...prev, [ownerIndex]: cur - 1 }));
                                            }}
                                          />
                                        )}
                                      </div>
                                    ))}
                                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addEmail('')} style={{ borderRadius: 8 }}>
                                      إضافة بريد إلكتروني
                                    </Button>
                                  </>
                                )}
                              </Form.List>
                            </Form.Item>

                            {/* Emirate */}
                            <Form.Item name={[ownerField.name, 'ownerEmirate']} label="الإمارة" rules={[{ required: true, message: 'الرجاء اختيار الإمارة' }]}>
                              <Select placeholder="اختر الإمارة" size="large" style={{ borderRadius: 8 }}>
                                {['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'].map(e => (
                                  <Option key={e} value={e}><EnvironmentOutlined style={{ marginInlineEnd: 6 }} />{e}</Option>
                                ))}
                              </Select>
                            </Form.Item>

                            {/* Emirates ID */}
                            <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>هوية الإمارات</Divider>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'emiratesId']} label="رقم هوية الإمارات" rules={[{ required: true, message: 'الرجاء إدخال رقم الهوية' }]}>
                                  <Input prefix={<IdcardOutlined style={{ color: '#bbb' }} />} placeholder="784-YYYY-XXXXXXX-X" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'emiratesIdFile']} label="صورة هوية الإمارات">
                                  <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                    <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع الهوية</Button>
                                  </Upload>
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Bank Info */}
                            <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>المعلومات البنكية</Divider>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'bankName']} label="اسم البنك">
                                  <Input prefix={<BankOutlined style={{ color: '#bbb' }} />} placeholder="مثال: بنك الإمارات دبي الوطني" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[ownerField.name, 'bankIban']} label="رقم IBAN">
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="AE000000000000000000000" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* Company fields — conditional */}
                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.owners?.[ownerIndex]?.ownerType !== cur.owners?.[ownerIndex]?.ownerType}>
                              {({ getFieldValue }) => {
                                const ownerType = getFieldValue(['owners', ownerIndex, 'ownerType']);
                                return ownerType === 'company' ? (
                                  <>
                                    <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>معلومات الشركة</Divider>

                                    {/* Company Names */}
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'companyName']} label="اسم الشركة (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم الشركة بالعربي' }]}>
                                          <Input prefix={<BuildOutlined style={{ color: '#bbb' }} />} placeholder="الاسم الرسمي للشركة" size="large" style={{ borderRadius: 8 }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'companyNameEn']} label="Company Name (English)" rules={[{ required: true, message: 'Please enter company name in English' }]}>
                                          <Input prefix={<BuildOutlined style={{ color: '#bbb' }} />} placeholder="Official company name" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                    </Row>

                                    {/* Company Location */}
                                    <Row gutter={12}>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyEmirate']} label="الإمارة" rules={[{ required: true, message: 'الرجاء اختيار الإمارة' }]}>
                                          <Select placeholder="اختر الإمارة" size="large" style={{ borderRadius: 8 }}>
                                            {['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'].map(e => (
                                              <Option key={e} value={e}>{e}</Option>
                                            ))}
                                          </Select>
                                        </Form.Item>
                                      </Col>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyCity']} label="المدينة">
                                          <Input prefix={<EnvironmentOutlined style={{ color: '#bbb' }} />} placeholder="المدينة" size="large" style={{ borderRadius: 8 }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={8}>
                                        <Form.Item name={[ownerField.name, 'companyPO']} label="صندوق البريد (P.O. Box)">
                                          <Input placeholder="12345" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                    <Form.Item name={[ownerField.name, 'companyAddress']} label="العنوان التفصيلي" rules={[{ required: true, message: 'الرجاء إدخال عنوان الشركة' }]}>
                                      <Input.TextArea rows={2} placeholder="رقم المبنى، الشارع، المنطقة..." style={{ borderRadius: 8 }} />
                                    </Form.Item>

                                    {/* Trade License & Tax */}
                                    <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '10px 0 8px' }}>الوثائق القانونية</Divider>
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'tradeLicenseNo']} label="رقم الرخصة التجارية" rules={[{ required: true, message: 'الرجاء إدخال رقم الرخصة' }]}>
                                          <Input prefix={<SafetyCertificateOutlined style={{ color: '#bbb' }} />} placeholder="CN-XXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'tradeLicenseFile']} label="الرخصة التجارية (مرفق)" rules={[{ required: true, message: 'الرجاء إرفاق الرخصة' }]}>
                                          <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                            <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع الرخصة</Button>
                                          </Upload>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                    <Row gutter={12}>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'taxNo']} label="رقم التسجيل الضريبي (اختياري)">
                                          <Input prefix={<SafetyCertificateOutlined style={{ color: '#bbb' }} />} placeholder="TRN-XXXXXXXXXXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                        </Form.Item>
                                      </Col>
                                      <Col span={12}>
                                        <Form.Item name={[ownerField.name, 'taxFile']} label="شهادة الضريبة (اختياري)">
                                          <Upload maxCount={1} beforeUpload={() => false} accept=".jpg,.jpeg,.png,.pdf">
                                            <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}>رفع شهادة الضريبة</Button>
                                          </Upload>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  </>
                                ) : null;
                              }}
                            </Form.Item>
                          </Card>
                        ))}

                        {/* Add Owner Button */}
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => addOwner({ ownerType: 'individual', phones: [''], emails: [''] })}
                          style={{ borderRadius: 10, height: 44, fontSize: 14, borderColor: '#1677ff', color: '#1677ff' }}
                        >
                          إضافة مالك آخر
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>
              )}

                            {/* Step 3 - Units & Status */}
              {/* Step 3 - Tanks */}
              {currentStep === 2 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أضف الخزانات المثبتة في المبنى. يمكنك إضافة أكثر من خزان.
                  </Text>

                  <Form.List name="tanks">
                    {(tankFields, { add: addTank, remove: removeTank }) => (
                      <>
                        {tankFields.map((tankField, tankIndex) => (
                          <Card
                            key={tankField.key}
                            size="small"
                            style={{ marginBottom: 16, borderRadius: 12, border: '1.5px solid #e6f4ff', background: '#f0f7ff' }}
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong style={{ color: '#0958d9' }}>
                                  <DatabaseOutlined style={{ marginInlineEnd: 6 }} />
                                  {`الخزان ${tankIndex + 1}`}
                                </Text>
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTank(tankField.name)}>
                                  حذف
                                </Button>
                              </div>
                            }
                          >
                            <Row gutter={12}>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'tankNo']} label="رقم الخزان" rules={[{ required: true, message: 'الرجاء إدخال رقم الخزان' }]}>
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="T-001" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'gasType']} label="نوع الغاز" rules={[{ required: true, message: 'الرجاء اختيار نوع الغاز' }]}>
                                  <Select placeholder="اختر النوع" size="large" style={{ borderRadius: 8 }}>
                                    <Option value="lpg">LPG — غاز البترول المسال</Option>
                                    <Option value="cng">CNG — الغاز الطبيعي المضغوط</Option>
                                    <Option value="lng">LNG — الغاز الطبيعي المسال</Option>
                                    <Option value="natural">غاز طبيعي</Option>
                                    <Option value="other">أخرى</Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'status']} label="الحالة" initialValue="active">
                                  <Select size="large" style={{ borderRadius: 8 }}>
                                    <Option value="active"><Tag color="success">نشط</Tag></Option>
                                    <Option value="inactive"><Tag color="default">غير نشط</Tag></Option>
                                    <Option value="maintenance"><Tag color="warning">صيانة</Tag></Option>
                                  </Select>
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={12}>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'capacity']} label="السعة (كغ)" rules={[{ required: true, message: 'الرجاء إدخال السعة' }]}>
                                  <Input type="number" min={1} prefix={<DatabaseOutlined style={{ color: '#bbb' }} />} placeholder="500" size="large" style={{ borderRadius: 8, direction: 'ltr' }} addonAfter="كغ" />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'serialNo']} label="الرقم التسلسلي">
                                  <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="SN-XXXXXXXX" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                              <Col span={8}>
                                <Form.Item name={[tankField.name, 'installDate']} label="تاريخ التركيب">
                                  <Input type="date" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'manufacturer']} label="الشركة المصنعة">
                                  <Input placeholder="اسم الشركة المصنعة" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name={[tankField.name, 'lastInspection']} label="آخر فحص دوري">
                                  <Input type="date" size="large" style={{ borderRadius: 8, direction: 'ltr' }} />
                                </Form.Item>
                              </Col>
                            </Row>

                            <Form.Item name={[tankField.name, 'notes']} label="ملاحظات">
                              <Input.TextArea rows={2} placeholder="أي ملاحظات إضافية عن الخزان..." style={{ borderRadius: 8 }} />
                            </Form.Item>
                          </Card>
                        ))}

                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => addTank({ status: 'active' })}
                          style={{ borderRadius: 10, height: 44, fontSize: 14, borderColor: '#0958d9', color: '#0958d9' }}
                        >
                          إضافة خزان
                        </Button>

                        {tankFields.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa' }}>
                            <DatabaseOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                            <Text type="secondary">لا توجد خزانات مضافة — انقر على الزر أعلاه لإضافة خزان</Text>
                          </div>
                        )}
                      </>
                    )}
                  </Form.List>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
                    أضف طوابق وشقق المبنى. استخدم التوليد السريع للمباني الكبيرة.
                  </Text>

                  {/* Building status + year row */}
                  <Row gutter={12} style={{ marginBottom: 8 }}>
                    <Col span={12}>
                      <Form.Item name="status" label="حالة المبنى" initialValue="active">
                        <Select size="large" style={{ borderRadius: 8 }}>
                          <Option value="active"><Tag color="success">نشط</Tag></Option>
                          <Option value="inactive"><Tag color="default">غير نشط</Tag></Option>
                          <Option value="maintenance"><Tag color="warning">تحت الصيانة</Tag></Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="year" label="سنة البناء">
                        <Input type="number" placeholder="مثال: 2018" size="large" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Quick Generator */}
                  <Card
                    size="small"
                    style={{ marginBottom: 16, background: '#f6ffed', border: '1.5px solid #b7eb8f', borderRadius: 12 }}
                    title={<Text strong style={{ color: '#389e0d', fontSize: 13 }}><HomeOutlined style={{ marginInlineEnd: 6 }} />توليد سريع للوحدات</Text>}
                  >
                    <Row gutter={10} align="bottom">
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>طابق البداية</div>
                        <InputNumber min={-5} max={100} value={genStartFloor} onChange={v => setGenStartFloor(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>عدد الطوابق</div>
                        <InputNumber min={1} max={100} value={genFloors} onChange={v => setGenFloors(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>وحدات / طابق</div>
                        <InputNumber min={1} max={50} value={genUnitsPerFloor} onChange={v => setGenUnitsPerFloor(v ?? 1)} size="large" style={{ width: '100%', borderRadius: 8 }} />
                      </Col>
                      <Col span={5}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>نمط الترقيم</div>
                        <Select value={genNaming} onChange={setGenNaming} size="large" style={{ width: '100%', borderRadius: 8 }}>
                          <Option value="floor_unit">طابق + وحدة (101، 102)</Option>
                          <Option value="floor_letter">طابق + حرف (1A، 1B)</Option>
                          <Option value="floor_dash">طابق-وحدة (1-1، 1-2)</Option>
                          <Option value="sequential">تسلسلي (1، 2، 3)</Option>
                        </Select>
                      </Col>
                      <Col span={4}>
                        <div style={{ marginBottom: 4, fontSize: 12, color: '#555' }}>نوع الوحدة</div>
                        <Select value={genUnitType} onChange={setGenUnitType} size="large" style={{ width: '100%', borderRadius: 8 }}>
                          <Option value="apartment">شقة</Option>
                          <Option value="studio">استوديو</Option>
                          <Option value="villa">فيلا</Option>
                          <Option value="shop">محل تجاري</Option>
                          <Option value="office">مكتب</Option>
                          <Option value="warehouse">مستودع</Option>
                          <Option value="other">أخرى</Option>
                        </Select>
                      </Col>
                      <Col span={3}>
                        <Button type="primary" size="large" style={{ width: '100%', borderRadius: 8, background: '#389e0d', borderColor: '#389e0d' }} onClick={generateUnits}>
                          توليد {genFloors * genUnitsPerFloor} وحدة
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* Units Table */}
                  <Form.List name="unitsList">
                    {(unitFields, { add: addUnit, remove: removeUnit }) => (
                      <>
                        {unitFields.length > 0 && (
                          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 13 }}>
                              <ApartmentOutlined style={{ marginInlineEnd: 6, color: '#1677ff' }} />
                              {unitFields.length} وحدة
                            </Text>
                            <Button size="small" type="text" danger onClick={() => form.setFieldsValue({ unitsList: [] })}>
                              مسح الكل
                            </Button>
                          </div>
                        )}

                        {unitFields.length > 0 && (
                          <div style={{ maxHeight: '36vh', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead style={{ background: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                  {['رقم الوحدة', 'الطابق', 'النوع', 'المساحة م²', 'الحالة', 'عداد الغاز', 'المستأجر', ''].map(h => (
                                    <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#555', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {unitFields.map((unitField, unitIndex) => (
                                  <tr key={unitField.key} style={{ borderBottom: '1px solid #f9f9f9', background: unitIndex % 2 === 0 ? '#fff' : '#fafafa' }}>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'unitNo']} noStyle>
                                        <Input size="small" style={{ borderRadius: 6, width: 80, direction: 'ltr' }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'floor']} noStyle>
                                        <Input size="small" style={{ borderRadius: 6, width: 60 }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'type']} noStyle>
                                        <Select size="small" style={{ width: 110, borderRadius: 6 }}>
                                          <Option value="apartment">شقة</Option>
                                          <Option value="studio">استوديو</Option>
                                          <Option value="villa">فيلا</Option>
                                          <Option value="shop">محل</Option>
                                          <Option value="office">مكتب</Option>
                                          <Option value="warehouse">مستودع</Option>
                                          <Option value="other">أخرى</Option>
                                        </Select>
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'area']} noStyle>
                                        <Input size="small" placeholder="م²" style={{ borderRadius: 6, width: 70, direction: 'ltr' }} />
                                      </Form.Item>
                                    </td>
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'status']} noStyle>
                                        <Select size="small" style={{ width: 100 }}>
                                          <Option value="vacant"><Tag color="blue" style={{ margin: 0, fontSize: 11 }}>شاغرة</Tag></Option>
                                          <Option value="occupied"><Tag color="success" style={{ margin: 0, fontSize: 11 }}>مشغولة</Tag></Option>
                                          <Option value="maintenance"><Tag color="warning" style={{ margin: 0, fontSize: 11 }}>صيانة</Tag></Option>
                                        </Select>
                                      </Form.Item>
                                    </td>
                                    {/* Gas Meter */}
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'gasMeter']} noStyle>
                                        <Select
                                          size="small"
                                          allowClear
                                          placeholder="اختر عداداً"
                                          style={{ width: 130 }}
                                          dropdownRender={menu => (
                                            <>
                                              {menu}
                                              <Divider style={{ margin: '4px 0' }} />
                                              <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
                                                <Input
                                                  size="small"
                                                  placeholder="رقم عداد جديد"
                                                  value={newMeterInput}
                                                  style={{ direction: 'ltr', borderRadius: 4 }}
                                                  onChange={e => setNewMeterInput(e.target.value)}
                                                  onKeyDown={e => e.key === 'Enter' && addQuickMeter()}
                                                />
                                                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={addQuickMeter} />
                                              </div>
                                            </>
                                          )}
                                        >
                                          {mockMeters.map(m => (
                                            <Option key={m} value={m}>{m}</Option>
                                          ))}
                                        </Select>
                                      </Form.Item>
                                    </td>

                                    {/* Tenant */}
                                    <td style={{ padding: '4px 8px' }}>
                                      <Form.Item name={[unitField.name, 'tenant']} noStyle>
                                        <Select
                                          size="small"
                                          allowClear
                                          placeholder="اختر مستأجراً"
                                          style={{ width: 150 }}
                                          optionFilterProp="label"
                                          showSearch
                                          dropdownRender={menu => (
                                            <>
                                              {menu}
                                              <Divider style={{ margin: '4px 0' }} />
                                              <div style={{ padding: '6px 8px' }}>
                                                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>إضافة مستأجر جديد</div>
                                                <Input
                                                  size="small"
                                                  placeholder="الاسم الكامل"
                                                  value={newTenantName}
                                                  style={{ borderRadius: 4, marginBottom: 4 }}
                                                  onChange={e => setNewTenantName(e.target.value)}
                                                />
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                  <Input
                                                    size="small"
                                                    placeholder="+971 5X XXX XXXX"
                                                    value={newTenantPhone}
                                                    style={{ direction: 'ltr', borderRadius: 4, flex: 1 }}
                                                    onChange={e => setNewTenantPhone(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && addQuickTenant()}
                                                  />
                                                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={addQuickTenant} />
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        >
                                          {mockTenants.map(t => (
                                            <Option key={t.id} value={t.id} label={t.name}>
                                              <div style={{ lineHeight: 1.4 }}>
                                                <div style={{ fontWeight: 500, fontSize: 12 }}>{t.name}</div>
                                                <div style={{ fontSize: 11, color: '#888', direction: 'ltr' }}>{t.phone}</div>
                                              </div>
                                            </Option>
                                          ))}
                                        </Select>
                                      </Form.Item>
                                    </td>

                                    <td style={{ padding: '4px 8px' }}>
                                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeUnit(unitField.name)} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {unitFields.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                            <ApartmentOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                            <Text type="secondary">لا توجد وحدات — استخدم التوليد السريع أو أضف يدوياً</Text>
                          </div>
                        )}

                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => addUnit({ type: 'apartment', status: 'vacant', area: '' })}
                          style={{ marginTop: 10, borderRadius: 8 }}
                        >
                          إضافة وحدة يدوياً
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>
              )}

              {/* Step 5 */}
              {currentStep === 4 && (
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
                    أضف تفاصيل الموقع وأي ملاحظات إضافية
                  </Text>
                  <Form.Item name="address" label="العنوان التفصيلي">
                    <Input.TextArea rows={3} placeholder="الشارع، المنطقة، المدينة..." style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="coordinates" label="الإحداثيات (اختياري)">
                    <Input placeholder="مثال: 24.4539° N, 54.3773° E" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                  <Form.Item name="notes" label="ملاحظات">
                    <Input.TextArea rows={3} placeholder="أي معلومات إضافية عن المبنى" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </div>
              )}
            </Form>
          )}
        </div>

        {/* Modal Footer */}
        {!done && (
          <div style={{ padding: '16px 32px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0' }}>
            <Button size="large" style={{ borderRadius: 8, minWidth: 100 }} onClick={currentStep === 0 ? confirmCancel : prevStep}>
              {currentStep === 0 ? 'إلغاء' : 'السابق'}
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Step dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineEnd: 16 }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{ width: i === currentStep ? 20 : 8, height: 8, borderRadius: 4, background: i === currentStep ? PRIMARY : i < currentStep ? '#a5d6a7' : '#e0e0e0', transition: 'all 0.3s' }} />
                ))}
              </div>
              <Button
                type="primary" size="large"
                style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, minWidth: 120, fontWeight: 600 }}
                onClick={currentStep < STEPS.length - 1 ? nextStep : onFinish}
              >
                {currentStep < STEPS.length - 1 ? 'التالي ←' : 'حفظ المبنى'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewModal} onCancel={() => setViewModal(null)} footer={
        <Button type="primary" icon={<EditOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }}>تعديل البيانات</Button>
      } centered width={420} title={<Text strong>تفاصيل المبنى — {viewModal?.no}</Text>}>
        {viewModal && (
          <div>
            <div style={{ background: PRIMARY_LIGHT, borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 36, color: PRIMARY, marginBottom: 8 }}><BankOutlined /></div>
              <Title level={4} style={{ margin: 0, color: PRIMARY }}>{viewModal.name}</Title>
              <Tag color="success" style={{ marginTop: 8 }}>{viewModal.status === 'active' ? 'نشط' : 'غير نشط'}</Tag>
            </div>
            <Row gutter={[12, 12]}>
              <Col span={12}><Statistic title="رقم المبنى" value={viewModal.no} valueStyle={{ fontSize: 16, color: PRIMARY }} /></Col>
              <Col span={12}><Statistic title="الفرع" value={viewModal.branch} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={12}><Statistic title="إجمالي الوحدات" value={viewModal.units} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={12}><Statistic title="نسبة الإشغال" value={`${Math.round((viewModal.occupied / viewModal.units) * 100)}%`} valueStyle={{ fontSize: 16, color: PRIMARY }} /></Col>
              <Col span={12}><Statistic title="مشغولة" value={viewModal.occupied} valueStyle={{ fontSize: 16, color: '#1565c0' }} /></Col>
              <Col span={12}><Statistic title="شاغرة" value={viewModal.vacant} valueStyle={{ fontSize: 16, color: '#c62828' }} /></Col>
            </Row>
            <Divider />
            <Button block icon={<HomeOutlined />} style={{ borderRadius: 8, marginBottom: 8 }}>عرض الوحدات</Button>
            <Button block icon={<FileTextOutlined />} style={{ borderRadius: 8 }}>عقود هذا المبنى</Button>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default Buildings;
