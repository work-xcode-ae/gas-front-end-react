import React, { useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space,
  Avatar, Drawer, Descriptions, Timeline, Modal,
  Form, Input, Select, InputNumber, Tabs, Tooltip, Alert, Divider,
} from 'antd';
import {
  CarOutlined, ToolOutlined, AlertOutlined, CheckCircleOutlined,
  ClockCircleOutlined, PlusOutlined, FileTextOutlined,
  UserOutlined, CalendarOutlined, FireOutlined, BankOutlined,
  SafetyCertificateOutlined, WarningOutlined, TeamOutlined,
  HistoryOutlined, ExclamationCircleOutlined, FilePdfOutlined,
  DollarOutlined, CloseOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Fine {
  id: string; vehicleId: string; date: string; amount: number;
  type: string; location: string; status: 'paid' | 'unpaid' | 'contested';
  reference: string; dueDate: string; driverName?: string;
}
interface VehicleDoc {
  id: string; vehicleId: string; name: string;
  type: 'registration' | 'insurance' | 'inspection' | 'other';
  issueDate: string; expiryDate: string; fileRef?: string; notes?: string;
}
interface Certificate {
  id: string; vehicleId: string; name: string;
  type: 'civil_defense' | 'hazmat' | 'adr' | 'tank_inspection' | 'driver_hazmat' | 'other';
  issueDate: string; expiryDate: string; issuedBy: string; reference?: string; notes?: string;
}
interface DriverHistory {
  id: string; vehicleId: string; driverName: string; from: string; to?: string;
  trips: number; totalKm: number; incidents: number; status: 'current' | 'past';
  phone?: string; notes?: string;
}
interface Vehicle {
  id: string; plate: string; type: string; brand: string; model: string;
  year: number; capacity: number; unit: string; driver: string; driverPhone: string;
  status: string; mileage: number; lastService: string; nextService: string;
  insurance: string; registration: string; fuelType: string;
  assignedBuilding: string; lastTrip: string; trips: number; isTruck: boolean;
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const VEHICLES: Vehicle[] = [
  {
    id: 'V-001', plate: 'أ و 12345 أبوظبي', type: 'صهريج غاز', brand: 'مرسيدس', model: 'Actros',
    year: 2021, capacity: 15000, unit: 'لتر', driver: 'محمد علي حسن', driverPhone: '0501234567',
    status: 'active', mileage: 124500, lastService: '2026-07-10', nextService: '2026-10-10',
    insurance: '2027-01-15', registration: '2026-12-31', fuelType: 'ديزل',
    assignedBuilding: 'برج الفردوس — أبوظبي', lastTrip: '2026-09-23', trips: 312, isTruck: true,
  },
  {
    id: 'V-002', plate: 'ب س 67890 أبوظبي', type: 'صهريج غاز', brand: 'فولفو', model: 'FH16',
    year: 2022, capacity: 18000, unit: 'لتر', driver: 'أحمد سالم الحربي', driverPhone: '0552345678',
    status: 'active', mileage: 87300, lastService: '2026-08-01', nextService: '2026-11-01',
    insurance: '2027-03-20', registration: '2027-02-28', fuelType: 'ديزل',
    assignedBuilding: 'أبراج الشاطئ — دبي', lastTrip: '2026-09-22', trips: 198, isTruck: true,
  },
  {
    id: 'V-003', plate: 'ج م 11111 الشارقة', type: 'صهريج صغير', brand: 'إيسوزو', model: 'NPR',
    year: 2020, capacity: 5000, unit: 'لتر', driver: 'خالد عمر المنصوري', driverPhone: '0561234567',
    status: 'maintenance', mileage: 201000, lastService: '2026-09-15', nextService: '2026-12-15',
    insurance: '2026-11-30', registration: '2026-10-31', fuelType: 'ديزل',
    assignedBuilding: '—', lastTrip: '2026-09-18', trips: 445, isTruck: true,
  },
  {
    id: 'V-004', plate: 'د ع 33333 أبوظبي', type: 'سيارة إشراف', brand: 'تويوتا', model: 'Land Cruiser',
    year: 2023, capacity: 0, unit: '—', driver: 'فيصل ناصر الزهراني', driverPhone: '0501112233',
    status: 'active', mileage: 45200, lastService: '2026-06-20', nextService: '2026-09-20',
    insurance: '2027-05-10', registration: '2027-04-30', fuelType: 'بنزين',
    assignedBuilding: 'تغطية عامة', lastTrip: '2026-09-24', trips: 0, isTruck: false,
  },
  {
    id: 'V-005', plate: 'هـ ق 55555 دبي', type: 'صهريج غاز', brand: 'DAF', model: 'XF',
    year: 2019, capacity: 12000, unit: 'لتر', driver: 'سعيد راشد العامري', driverPhone: '0581234567',
    status: 'expired_insurance', mileage: 312000, lastService: '2026-05-01', nextService: '2026-08-01',
    insurance: '2026-09-01', registration: '2026-08-31', fuelType: 'ديزل',
    assignedBuilding: '—', lastTrip: '2026-09-01', trips: 711, isTruck: true,
  },
];

const FINES: Fine[] = [
  { id: 'F-001', vehicleId: 'V-001', date: '2026-08-12', amount: 600, type: 'تجاوز السرعة', location: 'شارع الكورنيش — أبوظبي', status: 'paid', reference: 'TF-88812', dueDate: '2026-09-12' },
  { id: 'F-002', vehicleId: 'V-001', date: '2026-06-05', amount: 400, type: 'استخدام الجوال أثناء القيادة', location: 'خروج بوابة خليفة', status: 'paid', reference: 'TF-77231', dueDate: '2026-07-05' },
  { id: 'F-003', vehicleId: 'V-002', date: '2026-09-10', amount: 1000, type: 'عدم ارتداء حزام الأمان', location: 'طريق شيخ زايد — دبي', status: 'unpaid', reference: 'TF-99103', dueDate: '2026-10-10' },
  { id: 'F-004', vehicleId: 'V-005', date: '2026-07-20', amount: 800, type: 'وقوف غير نظامي', location: 'منطقة صناعية جبل علي', status: 'contested', reference: 'TF-66540', dueDate: '2026-08-20' },
  { id: 'F-005', vehicleId: 'V-003', date: '2026-05-01', amount: 500, type: 'تجاوز السرعة', location: 'طريق الشارقة دبي السريع', status: 'paid', reference: 'TF-55210', dueDate: '2026-06-01' },
];

const DOCS: VehicleDoc[] = [
  { id: 'D-001', vehicleId: 'V-001', name: 'تسجيل المركبة', type: 'registration', issueDate: '2026-01-01', expiryDate: '2026-12-31', fileRef: 'reg_v001.pdf' },
  { id: 'D-002', vehicleId: 'V-001', name: 'وثيقة التأمين', type: 'insurance', issueDate: '2026-01-15', expiryDate: '2027-01-15', fileRef: 'ins_v001.pdf' },
  { id: 'D-003', vehicleId: 'V-001', name: 'شهادة الفحص الفني', type: 'inspection', issueDate: '2026-03-01', expiryDate: '2027-03-01' },
  { id: 'D-004', vehicleId: 'V-002', name: 'تسجيل المركبة', type: 'registration', issueDate: '2027-01-01', expiryDate: '2027-02-28', fileRef: 'reg_v002.pdf' },
  { id: 'D-005', vehicleId: 'V-002', name: 'وثيقة التأمين', type: 'insurance', issueDate: '2026-03-20', expiryDate: '2027-03-20' },
  { id: 'D-006', vehicleId: 'V-003', name: 'تسجيل المركبة', type: 'registration', issueDate: '2025-10-01', expiryDate: '2026-10-31' },
  { id: 'D-007', vehicleId: 'V-003', name: 'وثيقة التأمين', type: 'insurance', issueDate: '2025-11-30', expiryDate: '2026-11-30' },
  { id: 'D-008', vehicleId: 'V-005', name: 'تسجيل المركبة', type: 'registration', issueDate: '2025-08-01', expiryDate: '2026-08-31' },
  { id: 'D-009', vehicleId: 'V-005', name: 'وثيقة التأمين', type: 'insurance', issueDate: '2025-09-01', expiryDate: '2026-09-01' },
  { id: 'D-010', vehicleId: 'V-004', name: 'تسجيل المركبة', type: 'registration', issueDate: '2026-05-01', expiryDate: '2027-04-30' },
  { id: 'D-011', vehicleId: 'V-004', name: 'وثيقة التأمين', type: 'insurance', issueDate: '2026-05-10', expiryDate: '2027-05-10' },
];

const CERTS: Certificate[] = [
  { id: 'C-001', vehicleId: 'V-001', name: 'تصريح نقل غاز طبيعي (الدفاع المدني)', type: 'civil_defense', issueDate: '2025-12-01', expiryDate: '2026-12-01', issuedBy: 'هيئة الدفاع المدني والإسعاف', reference: 'CD-2025-0441' },
  { id: 'C-002', vehicleId: 'V-001', name: 'شهادة ADR لنقل البضائع الخطرة', type: 'adr', issueDate: '2025-06-01', expiryDate: '2027-06-01', issuedBy: 'هيئة الطرق والمواصلات', reference: 'ADR-2025-1189' },
  { id: 'C-003', vehicleId: 'V-001', name: 'فحص خزان الغاز والأنابيب', type: 'tank_inspection', issueDate: '2026-02-01', expiryDate: '2027-02-01', issuedBy: 'شركة فحص معتمدة', reference: 'TI-2026-0087' },
  { id: 'C-004', vehicleId: 'V-001', name: 'رخصة سائق مواد خطرة (السائق محمد علي)', type: 'driver_hazmat', issueDate: '2025-09-01', expiryDate: '2027-09-01', issuedBy: 'هيئة السلامة والمرور', reference: 'DH-2025-3312' },
  { id: 'C-005', vehicleId: 'V-002', name: 'تصريح نقل غاز طبيعي (الدفاع المدني)', type: 'civil_defense', issueDate: '2026-01-01', expiryDate: '2027-01-01', issuedBy: 'هيئة الدفاع المدني والإسعاف', reference: 'CD-2026-0118' },
  { id: 'C-006', vehicleId: 'V-002', name: 'شهادة ADR لنقل البضائع الخطرة', type: 'adr', issueDate: '2026-04-01', expiryDate: '2028-04-01', issuedBy: 'هيئة الطرق والمواصلات', reference: 'ADR-2026-0765' },
  { id: 'C-007', vehicleId: 'V-005', name: 'تصريح نقل غاز طبيعي (الدفاع المدني)', type: 'civil_defense', issueDate: '2025-07-01', expiryDate: '2026-07-01', issuedBy: 'هيئة الدفاع المدني والإسعاف', reference: 'CD-2025-0219' },
];

const DRIVER_HISTORY: DriverHistory[] = [
  { id: 'DH-001', vehicleId: 'V-001', driverName: 'محمد علي حسن', from: '2024-01-01', status: 'current', trips: 312, totalKm: 124500, incidents: 1, phone: '0501234567' },
  { id: 'DH-002', vehicleId: 'V-001', driverName: 'عمر سالم الكعبي', from: '2022-05-01', to: '2023-12-31', status: 'past', trips: 289, totalKm: 98000, incidents: 0, phone: '0509876543', notes: 'نقل لمركبة V-003' },
  { id: 'DH-003', vehicleId: 'V-001', driverName: 'فهد خالد البلوشي', from: '2021-06-01', to: '2022-04-30', status: 'past', trips: 112, totalKm: 41200, incidents: 2, phone: '0551122334', notes: 'انتهاء عقد' },
  { id: 'DH-004', vehicleId: 'V-002', driverName: 'أحمد سالم الحربي', from: '2023-03-01', status: 'current', trips: 198, totalKm: 87300, incidents: 0, phone: '0552345678' },
  { id: 'DH-005', vehicleId: 'V-003', driverName: 'خالد عمر المنصوري', from: '2022-01-01', status: 'current', trips: 445, totalKm: 201000, incidents: 3, phone: '0561234567' },
  { id: 'DH-006', vehicleId: 'V-005', driverName: 'سعيد راشد العامري', from: '2020-01-01', status: 'current', trips: 711, totalKm: 312000, incidents: 5, phone: '0581234567' },
  { id: 'DH-007', vehicleId: 'V-005', driverName: 'ناصر محمد المطيري', from: '2019-03-01', to: '2019-12-31', status: 'past', trips: 48, totalKm: 22000, incidents: 1 },
];

const MAINTENANCE_LOG = [
  { id: 'M-001', vehicleId: 'V-001', date: '2026-07-10', type: 'صيانة دورية', cost: 850, notes: 'تغيير زيت + فلتر هواء', workshop: 'ورشة الأمانة' },
  { id: 'M-002', vehicleId: 'V-003', date: '2026-09-15', type: 'إصلاح كهربائي', cost: 3200, notes: 'تغيير بطارية ومولد كهربائي', workshop: 'ورشة المهندس' },
  { id: 'M-003', vehicleId: 'V-002', date: '2026-08-01', type: 'صيانة دورية', cost: 650, notes: 'تغيير زيت + فحص عام', workshop: 'ورشة الأمانة' },
  { id: 'M-004', vehicleId: 'V-005', date: '2026-05-01', type: 'صيانة دورية', cost: 1100, notes: 'تغيير زيت + استبدال إطار', workshop: 'خارج الشبكة' },
  { id: 'M-005', vehicleId: 'V-004', date: '2026-06-20', type: 'فحص دوري', cost: 200, notes: 'تشحيم + ضبط فرامل', workshop: 'ورشة الأمانة' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active:            { color: 'green',   label: 'نشطة' },
  maintenance:       { color: 'orange',  label: 'تحت الصيانة' },
  expired_insurance: { color: 'red',     label: 'تأمين منتهي' },
  inactive:          { color: 'default', label: 'غير نشطة' },
};

const CERT_TYPE_MAP: Record<string, { color: string; label: string }> = {
  civil_defense:   { color: 'red',     label: 'الدفاع المدني' },
  adr:             { color: 'purple',  label: 'ADR بضائع خطرة' },
  tank_inspection: { color: 'blue',    label: 'فحص الخزان' },
  driver_hazmat:   { color: 'orange',  label: 'رخصة سائق خطرة' },
  hazmat:          { color: 'volcano', label: 'مواد خطرة' },
  other:           { color: 'default', label: 'أخرى' },
};

const DOC_TYPE_MAP: Record<string, { color: string; label: string }> = {
  registration: { color: 'blue',    label: 'تسجيل' },
  insurance:    { color: 'green',   label: 'تأمين' },
  inspection:   { color: 'cyan',    label: 'فحص فني' },
  other:        { color: 'default', label: 'أخرى' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = new Date();
const soon   = new Date(today.getTime() + 30 * 86400000);
const expiryTag = (date: string) => {
  const d = new Date(date);
  if (d < today) return <Tag color="red" icon={<AlertOutlined />}>{date} — منتهي</Tag>;
  if (d < soon)  return <Tag color="orange" icon={<ExclamationCircleOutlined />}>{date} — ينتهي قريباً</Tag>;
  return <Tag color="green" icon={<CheckCircleOutlined />}>{date}</Tag>;
};

// ─── Vehicle Profile Drawer ───────────────────────────────────────────────────
const VehicleDrawer: React.FC<{ vehicle: Vehicle | null; open: boolean; onClose: () => void; allFines: Fine[]; setAllFines: React.Dispatch<React.SetStateAction<Fine[]>>; }> = ({ vehicle, open, onClose, allFines, setAllFines }) => {
  // Hooks must come before any conditional return
  const [addFineOpen, setAddFineOpen] = useState(false);
  const [fineForm] = Form.useForm();

  if (!vehicle) return null;
  const v = vehicle;

  const vFines  = allFines.filter(f => f.vehicleId === v.id);
  const vDocs   = DOCS.filter(d => d.vehicleId === v.id);
  const vCerts  = CERTS.filter(c => c.vehicleId === v.id);
  const vDrivers = DRIVER_HISTORY.filter(d => d.vehicleId === v.id);
  const vMaint  = MAINTENANCE_LOG.filter(m => m.vehicleId === v.id);

  const unpaidFines = vFines.filter(f => f.status === 'unpaid').reduce((s, f) => s + f.amount, 0);
  const expiredDocs  = vDocs.filter(d => new Date(d.expiryDate) < today).length;
  const expiredCerts = vCerts.filter(c => new Date(c.expiryDate) < today).length;

  const statusInfo = STATUS_MAP[v.status] || { color: 'default', label: v.status };

  const tabItems = [
    {
      key: 'info',
      label: <Space><CarOutlined />معلومات عامة</Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick stats */}
          <Row gutter={10}>
            {[
              { label: 'الكيلومترات', value: v.mileage.toLocaleString() + ' كم', color: PRIMARY },
              { label: 'عدد الرحلات', value: v.trips || '—', color: '#1677ff' },
              { label: 'السعة', value: v.capacity ? v.capacity.toLocaleString() + ' ' + v.unit : '—', color: '#fa8c16' },
            ].map((s, i) => (
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius: 8, textAlign: 'center', background: '#f9fafb' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card size="small" bordered={false} style={{ borderRadius: 8 }}
            title={<Text strong style={{ fontSize: 13 }}>بيانات المركبة</Text>}>
            <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
              <Descriptions.Item label="رقم اللوحة"><Text strong>{v.plate}</Text></Descriptions.Item>
              <Descriptions.Item label="النوع"><Tag color="blue">{v.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="الماركة">{v.brand}</Descriptions.Item>
              <Descriptions.Item label="الموديل">{v.model}</Descriptions.Item>
              <Descriptions.Item label="سنة الصنع">{v.year}</Descriptions.Item>
              <Descriptions.Item label="نوع الوقود">{v.fuelType}</Descriptions.Item>
              <Descriptions.Item label="المبنى المعين" span={2}>
                <Space><BankOutlined />{v.assignedBuilding}</Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" bordered={false} style={{ borderRadius: 8 }}
            title={<Text strong style={{ fontSize: 13 }}>السائق الحالي</Text>}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={40} icon={<UserOutlined />} style={{ background: GOLD }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{v.driver}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{v.driverPhone}</div>
              </div>
            </div>
          </Card>

          <Card size="small" bordered={false} style={{ borderRadius: 8 }}
            title={<Text strong style={{ fontSize: 13 }}>مواعيد الوثائق</Text>}>
            <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
              <Descriptions.Item label="انتهاء التسجيل" span={2}>{expiryTag(v.registration)}</Descriptions.Item>
              <Descriptions.Item label="انتهاء التأمين" span={2}>{expiryTag(v.insurance)}</Descriptions.Item>
              <Descriptions.Item label="الصيانة القادمة" span={2}>{expiryTag(v.nextService)}</Descriptions.Item>
              <Descriptions.Item label="آخر رحلة">{v.lastTrip}</Descriptions.Item>
              <Descriptions.Item label="آخر صيانة">{v.lastService}</Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      ),
    },

    // ── Documents Tab ──────────────────────────────────────────────────────
    {
      key: 'docs',
      label: (
        <Space>
          <FileTextOutlined />
          الوثائق
          {expiredDocs > 0 && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>{expiredDocs}</Tag>}
        </Space>
      ),
      children: (
        <div>
          {expiredDocs > 0 && (
            <Alert type="error" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
              message={`${expiredDocs} وثيقة منتهية الصلاحية — يجب تجديدها فوراً`} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" icon={<PlusOutlined />} type="dashed">إضافة وثيقة</Button>
          </div>
          <Table
            size="small" rowKey="id" pagination={false}
            dataSource={vDocs}
            columns={[
              { title: 'الوثيقة', dataIndex: 'name', render: (n: string, r: VehicleDoc) => (
                <Space>
                  <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n}</div>
                    {r.fileRef && <div style={{ fontSize: 10, color: '#1677ff' }}>{r.fileRef}</div>}
                  </div>
                </Space>
              )},
              { title: 'النوع', dataIndex: 'type', width: 90, render: (t: string) => (
                <Tag color={DOC_TYPE_MAP[t]?.color || 'default'} style={{ fontSize: 11 }}>{DOC_TYPE_MAP[t]?.label || t}</Tag>
              )},
              { title: 'تاريخ الإصدار', dataIndex: 'issueDate', width: 100, render: (d: string) => <Text style={{ fontSize: 12 }}>{d}</Text> },
              { title: 'تاريخ الانتهاء', dataIndex: 'expiryDate', width: 150, render: (d: string) => expiryTag(d) },
            ]}
          />
        </div>
      ),
    },

    // ── Certificates Tab (trucks only) ────────────────────────────────────
    ...(v.isTruck ? [{
      key: 'certs',
      label: (
        <Space>
          <SafetyCertificateOutlined />
          الشهادات والتصاريح
          {expiredCerts > 0 && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>{expiredCerts}</Tag>}
        </Space>
      ),
      children: (
        <div>
          {expiredCerts > 0 && (
            <Alert type="error" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
              message={`${expiredCerts} شهادة/تصريح منتهي — المركبة غير مرخصة لنقل الغاز!`} />
          )}
          <div style={{ background: '#fff7e6', border: '1px solid #ffe7ba', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <Space>
              <WarningOutlined style={{ color: '#fa8c16' }} />
              <Text style={{ fontSize: 12 }}>
                صهاريج الغاز تتطلب: تصريح الدفاع المدني + شهادة ADR + فحص الخزان + رخصة سائق مواد خطرة — جميعها مطلوبة قبل أي رحلة
              </Text>
            </Space>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" icon={<PlusOutlined />} type="dashed">إضافة شهادة</Button>
          </div>
          {vCerts.length === 0 ? (
            <Alert type="warning" showIcon message="لا توجد شهادات مسجلة لهذه المركبة" />
          ) : (
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={vCerts}
              columns={[
                { title: 'الشهادة / التصريح', dataIndex: 'name', render: (n: string) => (
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>{n}</Text>
                )},
                { title: 'النوع', dataIndex: 'type', width: 130, render: (t: string) => (
                  <Tag color={CERT_TYPE_MAP[t]?.color || 'default'} style={{ fontSize: 10 }}>{CERT_TYPE_MAP[t]?.label || t}</Tag>
                )},
                { title: 'الجهة المصدرة', dataIndex: 'issuedBy', render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text> },
                { title: 'رقم المرجع', dataIndex: 'reference', width: 120, render: (v: string) => (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{v || '—'}</Text>
                )},
                { title: 'انتهاء الصلاحية', dataIndex: 'expiryDate', width: 160, render: (d: string) => expiryTag(d) },
              ]}
            />
          )}
        </div>
      ),
    }] : []),

    // ── Driver History (trucks only) ──────────────────────────────────────
    ...(v.isTruck ? [{
      key: 'drivers',
      label: <Space><HistoryOutlined />سجل السائقين</Space>,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" icon={<PlusOutlined />} type="dashed">تعيين سائق</Button>
          </div>
          <Timeline
            items={vDrivers.sort((a, b) => (a.status === 'current' ? -1 : 1)).map(dh => ({
              color: dh.status === 'current' ? PRIMARY : '#aaa',
              dot: dh.status === 'current'
                ? <Avatar size={24} icon={<UserOutlined />} style={{ background: PRIMARY, fontSize: 12 }} />
                : <Avatar size={24} icon={<UserOutlined />} style={{ background: '#d9d9d9', fontSize: 12 }} />,
              children: (
                <Card size="small" bordered={false} style={{ borderRadius: 8, background: dh.status === 'current' ? '#e8f5e9' : '#fafafa', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>{dh.driverName}</Text>
                        {dh.status === 'current'
                          ? <Tag color="green" style={{ fontSize: 10 }}>السائق الحالي</Tag>
                          : <Tag color="default" style={{ fontSize: 10 }}>سابق</Tag>}
                      </Space>
                      {dh.phone && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{dh.phone}</div>}
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                        {dh.from} {dh.to ? `→ ${dh.to}` : '→ الآن'}
                      </div>
                    </div>
                    <Space direction="vertical" style={{ textAlign: 'center', gap: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{dh.trips} رحلة</Text>
                      <Text style={{ fontSize: 11, color: '#888' }}>{dh.totalKm.toLocaleString()} كم</Text>
                    </Space>
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space>
                    <Tag color={dh.incidents === 0 ? 'green' : dh.incidents < 3 ? 'orange' : 'red'} style={{ fontSize: 10 }}>
                      {dh.incidents} حادث/مخالفة
                    </Tag>
                    {dh.notes && <Text style={{ fontSize: 11, color: '#888' }}>{dh.notes}</Text>}
                  </Space>
                </Card>
              ),
            }))}
          />
        </div>
      ),
    }] : []),

    // ── Fines Tab ─────────────────────────────────────────────────────────
    {
      key: 'fines',
      label: (
        <Space>
          <DollarOutlined />
          المخالفات
          {vFines.filter(f => f.status === 'unpaid').length > 0 && (
            <Tag color="red" style={{ fontSize: 10, margin: 0 }}>
              {vFines.filter(f => f.status === 'unpaid').length}
            </Tag>
          )}
        </Space>
      ),
      children: (
        <div>
          {unpaidFines > 0 && (
            <Alert type="error" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
              message={`مخالفات غير مدفوعة: ${unpaidFines.toLocaleString()} درهم — يجب السداد قبل استخدام المركبة`} />
          )}
          <Row gutter={10} style={{ marginBottom: 12 }}>
            {[
              { label: 'إجمالي المخالفات', value: vFines.length, color: '#1677ff' },
              { label: 'غير مدفوعة', value: vFines.filter(f => f.status === 'unpaid').length, color: '#ff4d4f' },
              { label: 'إجمالي المبالغ', value: vFines.reduce((s, f) => s + f.amount, 0).toLocaleString() + ' د', color: '#fa8c16' },
            ].map((s, i) => (
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius: 8, textAlign: 'center', background: '#f9fafb' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" icon={<PlusOutlined />} type="primary" style={{ background: PRIMARY }} onClick={() => { fineForm.resetFields(); setAddFineOpen(true); }}>إضافة مخالفة</Button>
          </div>
          {vFines.length === 0 ? (
            <Alert type="success" showIcon message="لا توجد مخالفات مسجلة على هذه المركبة" />
          ) : (
            <Table
              size="small" rowKey="id" pagination={false}
              dataSource={[...vFines].sort((a, b) => b.date.localeCompare(a.date))}
              columns={[
                { title: 'التاريخ', dataIndex: 'date', width: 90, render: (d: string) => <Text style={{ fontSize: 11 }}>{d}</Text> },
                { title: 'نوع المخالفة', dataIndex: 'type', render: (t: string) => <Text style={{ fontSize: 12 }}>{t}</Text> },
                { title: 'السائق', dataIndex: 'driverName', width: 130, render: (d: string) => d
                  ? <Text style={{ fontSize: 11 }}>👤 {d}</Text>
                  : <Text style={{ fontSize: 11, color: '#bbb' }}>غير محدد</Text>
                },
                { title: 'الموقع', dataIndex: 'location', render: (l: string) => <Text style={{ fontSize: 11, color: '#888' }}>{l}</Text> },
                { title: 'المبلغ', dataIndex: 'amount', width: 90, render: (a: number) => (
                  <Text style={{ fontSize: 12, fontWeight: 700, color: '#ff4d4f' }}>{a.toLocaleString()} د</Text>
                )},
                { title: 'الحالة', dataIndex: 'status', width: 100, render: (s: string) => (
                  <Tag color={s === 'paid' ? 'green' : s === 'contested' ? 'orange' : 'red'} style={{ fontSize: 10 }}>
                    {s === 'paid' ? 'مدفوعة' : s === 'contested' ? 'قيد الطعن' : 'غير مدفوعة'}
                  </Tag>
                )},
                { title: 'المرجع', dataIndex: 'reference', width: 90, render: (r: string) => (
                  <Text style={{ fontSize: 10, fontFamily: 'monospace' }}>{r}</Text>
                )},
              ]}
            />
          )}
        </div>
      ),
    },

    // ── Maintenance Tab ───────────────────────────────────────────────────
    {
      key: 'maintenance',
      label: <Space><ToolOutlined />الصيانة</Space>,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" icon={<PlusOutlined />} type="dashed">إضافة سجل صيانة</Button>
          </div>
          {vMaint.length === 0 ? (
            <Alert type="info" showIcon message="لا توجد سجلات صيانة لهذه المركبة" />
          ) : (
            <Timeline
              items={[...vMaint].sort((a, b) => b.date.localeCompare(a.date)).map(m => ({
                color: PRIMARY,
                children: (
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{m.type}</Text>
                    <div style={{ fontSize: 11, color: '#888' }}>{m.date} — {m.workshop}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{m.notes}</div>
                    <Tag color="blue" style={{ fontSize: 11, marginTop: 4 }}>{m.cost.toLocaleString()} درهم</Tag>
                  </div>
                ),
              }))}
            />
          )}
        </div>
      ),
    },
  ];

  const totalAlerts = (unpaidFines > 0 ? 1 : 0) + expiredDocs + expiredCerts;

  return (
    <>
    <Drawer
      open={open}
      onClose={onClose}
      width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 40 : 800, 800)}
      styles={{ body: { background: '#f5f7fa', padding: '16px 20px' }, header: { background: '#fff' } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CarOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{v.plate}</div>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>{v.brand} {v.model} {v.year} — {v.type}</div>
          </div>
          <div style={{ marginRight: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag color={statusInfo.color} style={{ margin: 0 }}>{statusInfo.label}</Tag>
            {v.isTruck && <Tag color="volcano" icon={<FireOutlined />} style={{ margin: 0 }}>صهريج غاز</Tag>}
            {totalAlerts > 0 && <Tag color="red" icon={<AlertOutlined />} style={{ margin: 0 }}>{totalAlerts} تنبيه</Tag>}
          </div>
        </div>
      }
    >
      <Tabs items={tabItems} size="small" />
    </Drawer>

      {/* ── Add Fine Modal ─────────────────────────────────────────────── */}
      <Modal
        open={addFineOpen}
        onCancel={() => setAddFineOpen(false)}
        footer={null}
        width={520}
        styles={{ header: { display: 'none' }, body: { padding: 0 } }}
        destroyOnClose
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)', borderRadius: '8px 8px 0 0', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', fontSize: 20 }}>🚨</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>تسجيل مخالفة مرورية</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{v.plate}</div>
            </div>
          </div>
          <Button type="text" icon={<CloseOutlined style={{ color: '#fff' }} />} onClick={() => setAddFineOpen(false)} style={{ color: '#fff' }} />
        </div>

        <Form form={fineForm} layout="vertical" style={{ padding: 20 }} onFinish={(vals) => {
          const newFine: Fine = {
            id: `F-${Date.now()}`,
            vehicleId: v.id,
            date: vals.date,
            amount: Number(vals.amount),
            type: vals.fineType,
            location: vals.location,
            status: 'unpaid',
            reference: vals.reference || `TF-${Math.floor(Math.random()*90000+10000)}`,
            dueDate: vals.dueDate,
            driverName: vals.driverName,
          };
          setAllFines(prev => [...prev, newFine]);
          setAddFineOpen(false);
          fineForm.resetFields();
        }}>

          {/* Driver selector */}
          <div style={{ background: '#fff8f0', border: '1px solid #ffe0b2', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>👤</span>
              <Text strong style={{ fontSize: 13, color: '#333' }}>السائق وقت المخالفة</Text>
              <Tag color="red" style={{ fontSize: 10 }}>مطلوب</Tag>
            </div>
            <Form.Item name="driverName" rules={[{ required: true, message: 'يجب تحديد السائق المسؤول' }]} style={{ marginBottom: 0 }}>
              <Select placeholder="اختر السائق المسؤول..." style={{ width: '100%', borderRadius: 8 }} size="large">
                {vDrivers.map(d => (
                  <Select.Option key={d.id} value={d.driverName}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{d.driverName}</span>
                      <Tag color={d.status === 'current' ? 'green' : 'default'} style={{ fontSize: 10, marginRight: 0 }}>
                        {d.status === 'current' ? 'السائق الحالي' : `حتى ${d.to}`}
                      </Tag>
                    </div>
                  </Select.Option>
                ))}
                <Select.Option value="__other__">
                  <span style={{ color: '#888' }}>➕ سائق آخر (أدخل يدوياً)</span>
                </Select.Option>
              </Select>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.driverName !== cur.driverName}>
              {({ getFieldValue }) => getFieldValue('driverName') === '__other__' ? (
                <Form.Item name="driverNameManual" rules={[{ required: true, message: 'أدخل اسم السائق' }]} style={{ marginBottom: 0, marginTop: 8 }}>
                  <Input placeholder="اسم السائق (يدوي)" prefix={<UserOutlined />} style={{ borderRadius: 8 }} />
                </Form.Item>
              ) : null}
            </Form.Item>
          </div>

          {/* Fine details */}
          <div style={{ background: '#f8fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <Text strong style={{ fontSize: 13, color: '#333' }}>تفاصيل المخالفة</Text>
            </div>
            <Row gutter={[10, 0]}>
              <Col span={12}>
                <Form.Item name="fineType" label="نوع المخالفة" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Select placeholder="اختر..." style={{ borderRadius: 8 }}>
                    {['تجاوز السرعة', 'استخدام الجوال أثناء القيادة', 'عدم ارتداء حزام الأمان', 'وقوف غير نظامي', 'تجاوز الإشارة الحمراء', 'قيادة دون رخصة سارية', 'قيادة مركبة غير مؤمنة', 'أخرى'].map(t => (
                      <Select.Option key={t} value={t}>{t}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="amount" label="المبلغ (درهم)" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Input type="number" prefix={<DollarOutlined style={{ color: '#ff4d4f' }} />} placeholder="0" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="location" label="موقع المخالفة" rules={[{ required: true, message: 'مطلوب' }]}>
              <Input prefix={<span>📍</span>} placeholder="الطريق أو المنطقة" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Row gutter={[10, 0]}>
              <Col span={12}>
                <Form.Item name="date" label="تاريخ المخالفة" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Input type="date" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dueDate" label="تاريخ السداد" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Input type="date" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="reference" label="رقم المرجع (اختياري)" style={{ marginBottom: 0 }}>
              <Input prefix={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>TF-</span>} placeholder="رقم المخالفة الرسمي" style={{ borderRadius: 8, fontFamily: 'monospace' }} />
            </Form.Item>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setAddFineOpen(false)}>إلغاء</Button>
            <Button type="primary" htmlType="submit" danger icon={<PlusOutlined />} style={{ fontWeight: 600 }}>
              تسجيل المخالفة
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const VehiclesPage: React.FC = () => {
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [form] = Form.useForm();
  const [allFines, setAllFines] = useState<Fine[]>(FINES);

  const active      = VEHICLES.filter(v => v.status === 'active').length;
  const maintenance = VEHICLES.filter(v => v.status === 'maintenance').length;
  const alerts      = VEHICLES.filter(v => v.status === 'expired_insurance').length;
  const totalUnpaidFines = FINES.filter(f => f.status === 'unpaid').reduce((s, f) => s + f.amount, 0);
  const expiredCertsCount = CERTS.filter(c => new Date(c.expiryDate) < today).length;

  const openVehicle = (v: Vehicle) => { setSelected(v); setDrawerOpen(true); };

  const columns = [
    { title: 'رقم اللوحة', dataIndex: 'plate', render: (val: string, r: Vehicle) => (
      <div>
        <a style={{ fontWeight: 700, color: PRIMARY, fontSize: 13 }} onClick={() => openVehicle(r)}>{val}</a>
        {r.isTruck && <Tag color="volcano" style={{ fontSize: 10, marginRight: 6 }}>صهريج</Tag>}
      </div>
    )},
    { title: 'الماركة / الموديل', render: (_: any, r: Vehicle) => <Text style={{ fontSize: 12 }}>{r.brand} {r.model} ({r.year})</Text> },
    { title: 'السائق', dataIndex: 'driver', render: (val: string) => (
      <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: GOLD }} /><Text style={{ fontSize: 12 }}>{val}</Text></Space>
    )},
    { title: 'السعة', dataIndex: 'capacity', render: (val: number, r: Vehicle) =>
      val ? <Text style={{ fontSize: 12 }}>{val.toLocaleString()} {r.unit}</Text> : <Text type="secondary">—</Text>
    },
    { title: 'المخالفات', render: (_: any, r: Vehicle) => {
      const unpaid = FINES.filter(f => f.vehicleId === r.id && f.status === 'unpaid').length;
      return unpaid > 0
        ? <Tag color="red" style={{ fontSize: 11 }}>{unpaid} غير مدفوعة</Tag>
        : <Tag color="green" style={{ fontSize: 11 }}>لا مخالفات</Tag>;
    }},
    { title: 'الشهادات', render: (_: any, r: Vehicle) => {
      if (!r.isTruck) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      const exp = CERTS.filter(c => c.vehicleId === r.id && new Date(c.expiryDate) < today).length;
      return exp > 0
        ? <Tag color="red" style={{ fontSize: 11 }}>{exp} منتهية</Tag>
        : <Tag color="green" style={{ fontSize: 11 }}>سارية</Tag>;
    }},
    { title: 'انتهاء التأمين', dataIndex: 'insurance', render: (d: string) => expiryTag(d) },
    { title: 'الحالة', dataIndex: 'status', render: (s: string) => (
      <Tag color={STATUS_MAP[s]?.color || 'default'} style={{ fontSize: 11 }}>{STATUS_MAP[s]?.label || s}</Tag>
    )},
    { title: '', render: (_: any, r: Vehicle) => (
      <Button size="small" type="link" onClick={() => openVehicle(r)}>ملف المركبة</Button>
    )},
  ];

  return (
    <div style={{ padding: '20px 24px', direction: 'rtl', maxWidth: 1440, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CarOutlined style={{ fontSize: 22, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: PRIMARY }}>إدارة المركبات</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>أسطول صهاريج الغاز وسيارات الخدمة</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY }} onClick={() => setAddOpen(true)}>
          إضافة مركبة
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {[
          { label: 'إجمالي المركبات', value: VEHICLES.length, color: PRIMARY, bg: '#e8f5e9', icon: <CarOutlined /> },
          { label: 'نشطة', value: active, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
          { label: 'تحت الصيانة', value: maintenance, color: '#fa8c16', bg: '#fff7e6', icon: <ToolOutlined /> },
          { label: 'تنبيهات', value: alerts, color: '#ff4d4f', bg: '#fff2f0', icon: <AlertOutlined /> },
          { label: 'مخالفات غير مدفوعة', value: totalUnpaidFines.toLocaleString() + ' د', color: '#ff4d4f', bg: '#fff2f0', icon: <DollarOutlined /> },
          { label: 'شهادات منتهية', value: expiredCertsCount, color: '#722ed1', bg: '#f9f0ff', icon: <SafetyCertificateOutlined /> },
        ].map((s, i) => (
          <Col xs={12} sm={8} md={4} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 20, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Alert banners */}
      {(alerts > 0 || totalUnpaidFines > 0 || expiredCertsCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {alerts > 0 && <Alert type="error" showIcon message={`${alerts} مركبة تأمينها منتهي — يجب التجديد فوراً لتجنب المخالفات`} />}
          {totalUnpaidFines > 0 && <Alert type="warning" showIcon message={`مخالفات مرورية غير مدفوعة بإجمالي ${totalUnpaidFines.toLocaleString()} درهم`} />}
          {expiredCertsCount > 0 && <Alert type="error" showIcon message={`${expiredCertsCount} شهادة/تصريح نقل غاز منتهية — بعض الصهاريج غير مرخصة للتشغيل!`} />}
        </div>
      )}


      {/* ─── Charts ────────────────────────────────────────────────── */}
      <Row gutter={14} style={{ marginBottom: 14 }}>

        {/* Donut: Vehicle Status */}
        <Col span={5}>
          <Card bordered={false} size="small" style={{ borderRadius: 10, height: '100%' }}
            title={<Text strong style={{ fontSize: 12 }}>حالة المركبات</Text>}>
            <ReactApexChart type="donut" height={175}
              series={[
                VEHICLES.filter(v => v.status === 'active').length,
                VEHICLES.filter(v => v.status === 'maintenance').length,
                VEHICLES.filter(v => v.status === 'expired_insurance').length,
              ]}
              options={{
                labels: ['نشطة', 'صيانة', 'تأمين منتهي'],
                colors: ['#52c41a', '#fa8c16', '#ff4d4f'],
                legend: { position: 'bottom', fontSize: '10px' },
                dataLabels: { style: { fontSize: '11px' } },
                plotOptions: { pie: { donut: { size: '58%' } } },
                chart: { toolbar: { show: false } },
              }}
            />
          </Card>
        </Col>

        {/* Bar: Fines by vehicle */}
        <Col span={8}>
          <Card bordered={false} size="small" style={{ borderRadius: 10, height: '100%' }}
            title={<Text strong style={{ fontSize: 12 }}>المخالفات بالمركبة (د.إ)</Text>}>
            <ReactApexChart type="bar" height={175}
              series={[{
                name: 'مدفوعة',
                data: VEHICLES.map(v => FINES.filter(f => f.vehicleId === v.id && f.status === 'paid').reduce((s, f) => s + f.amount, 0)),
              }, {
                name: 'غير مدفوعة',
                data: VEHICLES.map(v => FINES.filter(f => f.vehicleId === v.id && f.status === 'unpaid').reduce((s, f) => s + f.amount, 0)),
              }, {
                name: 'متنازع عليها',
                data: VEHICLES.map(v => FINES.filter(f => f.vehicleId === v.id && f.status === 'contested').reduce((s, f) => s + f.amount, 0)),
              }]}
              options={{
                xaxis: { categories: VEHICLES.map(v => v.plate.split(' ')[0] + '..'), labels: { style: { fontSize: '9px' } } },
                colors: ['#52c41a', '#ff4d4f', '#fa8c16'],
                plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
                chart: { toolbar: { show: false }, stacked: true },
                legend: { position: 'top', fontSize: '10px' },
                dataLabels: { enabled: false },
                yaxis: { labels: { formatter: (v: number) => v ? v + '' : '' } },
                tooltip: { y: { formatter: (v: number) => v.toLocaleString() + ' د.إ' } },
              }}
            />
          </Card>
        </Col>

        {/* Bar: Mileage per vehicle */}
        <Col span={6}>
          <Card bordered={false} size="small" style={{ borderRadius: 10, height: '100%' }}
            title={<Text strong style={{ fontSize: 12 }}>عداد الكيلومترات</Text>}>
            <ReactApexChart type="bar" height={175}
              series={[{ name: 'كم', data: VEHICLES.map(v => v.mileage) }]}
              options={{
                xaxis: { categories: VEHICLES.map(v => v.plate.split(' ')[0] + '..'), labels: { style: { fontSize: '9px' } } },
                colors: ['#1a5c2a'],
                plotOptions: { bar: { borderRadius: 4, horizontal: true } },
                chart: { toolbar: { show: false } },
                legend: { show: false },
                dataLabels: { enabled: true, formatter: (v: number) => (v / 1000).toFixed(0) + 'k', style: { fontSize: '9px' } },
                xaxis: { labels: { formatter: (v: string) => (+v / 1000).toFixed(0) + 'k', style: { fontSize: '9px' } } } as any,
                tooltip: { x: { show: false }, y: { formatter: (v: number) => v.toLocaleString() + ' كم' } },
              }}
            />
          </Card>
        </Col>

        {/* Radial: Trucks vs non-trucks */}
        <Col span={5}>
          <Card bordered={false} size="small" style={{ borderRadius: 10, height: '100%' }}
            title={<Text strong style={{ fontSize: 12 }}>نوع المركبة</Text>}>
            <ReactApexChart type="pie" height={175}
              series={[
                VEHICLES.filter(v => v.isTruck).length,
                VEHICLES.filter(v => !v.isTruck).length,
              ]}
              options={{
                labels: ['صهاريج', 'سيارات خدمة'],
                colors: ['#c9a84c', '#1677ff'],
                legend: { position: 'bottom', fontSize: '10px' },
                dataLabels: { style: { fontSize: '11px' } },
                chart: { toolbar: { show: false } },
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={14} style={{ marginBottom: 14 }}>

        {/* Timeline-style: Documents expiring soon */}
        <Col span={10}>
          <Card bordered={false} size="small" style={{ borderRadius: 10 }}
            title={<Text strong style={{ fontSize: 12 }}>تواريخ انتهاء الوثائق والشهادات</Text>}>
            {(() => {
              const todayMs = today.getTime();
              const items = [
                ...DOCS.map(d => ({ name: d.name, plate: VEHICLES.find(v => v.id === d.vehicleId)?.plate || '', exp: d.expiryDate, kind: 'وثيقة' })),
                ...CERTS.map(c => ({ name: c.name.slice(0, 22) + '..', plate: VEHICLES.find(v => v.id === c.vehicleId)?.plate || '', exp: c.expiryDate, kind: 'شهادة' })),
              ].sort((a, b) => a.exp.localeCompare(b.exp)).slice(0, 8);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, i) => {
                    const diff = Math.ceil((new Date(item.exp).getTime() - todayMs) / 86400000);
                    const color = diff < 0 ? '#ff4d4f' : diff < 30 ? '#fa8c16' : '#52c41a';
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: diff < 0 ? '#fff2f0' : diff < 30 ? '#fff7e6' : '#f6ffed', borderRadius: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 11 }}>{item.name}</div>
                        <Tag color="default" style={{ fontSize: 9, margin: 0 }}>{item.kind}</Tag>
                        <Text style={{ fontSize: 10, color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {diff < 0 ? `منتهي (${Math.abs(diff)}ي)` : diff === 0 ? 'اليوم' : `${diff} يوم`}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </Col>

        {/* Bar: Fine types breakdown */}
        <Col span={7}>
          <Card bordered={false} size="small" style={{ borderRadius: 10 }}
            title={<Text strong style={{ fontSize: 12 }}>أنواع المخالفات</Text>}>
            {(() => {
              const types = [...new Set(FINES.map(f => f.type))];
              return (
                <ReactApexChart type="bar" height={190}
                  series={[{ name: 'المبلغ', data: types.map(t => FINES.filter(f => f.type === t).reduce((s, f) => s + f.amount, 0)) }]}
                  options={{
                    xaxis: { categories: types.map(t => t.length > 12 ? t.slice(0, 12) + '..' : t), labels: { style: { fontSize: '9px' } } },
                    colors: ['#ff4d4f'],
                    plotOptions: { bar: { borderRadius: 4, distributed: true, horizontal: true } },
                    chart: { toolbar: { show: false } },
                    legend: { show: false },
                    dataLabels: { enabled: true, formatter: (v: number) => v + ' د', style: { fontSize: '9px' } },
                    tooltip: { y: { formatter: (v: number) => v.toLocaleString() + ' د.إ' } },
                  }}
                />
              );
            })()}
          </Card>
        </Col>

        {/* Fuel type + capacity summary */}
        <Col span={7}>
          <Card bordered={false} size="small" style={{ borderRadius: 10 }}
            title={<Text strong style={{ fontSize: 12 }}>الطاقة الإجمالية للصهاريج (لتر)</Text>}>
            <ReactApexChart type="donut" height={140}
              series={VEHICLES.filter(v => v.isTruck && v.capacity > 0).map(v => v.capacity)}
              options={{
                labels: VEHICLES.filter(v => v.isTruck && v.capacity > 0).map(v => v.plate.split(' ').slice(0, 2).join(' ')),
                colors: ['#1a5c2a', '#c9a84c', '#1677ff', '#fa8c16', '#722ed1'],
                legend: { position: 'bottom', fontSize: '9px' },
                dataLabels: { formatter: (v: number) => v.toFixed(0) + '%', style: { fontSize: '10px' } },
                plotOptions: { pie: { donut: { size: '55%', labels: { show: true, total: { show: true, label: 'مجموع', fontSize: '11px', formatter: () => VEHICLES.filter(v => v.isTruck).reduce((s, v) => s + v.capacity, 0).toLocaleString() + ' L' } } } } },
                chart: { toolbar: { show: false } },
                tooltip: { y: { formatter: (v: number) => v.toLocaleString() + ' لتر' } },
              }}
            />
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={8}>
              {['ديزل', 'بنزين'].map(f => (
                <Col span={12} key={f}>
                  <div style={{ textAlign: 'center', background: '#f9fafb', borderRadius: 6, padding: '4px 0' }}>
                    <div style={{ fontSize: 9, color: '#888' }}>{f}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{VEHICLES.filter(v => v.fuelType === f).length}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Table
          size="small" rowKey="id"
          dataSource={VEHICLES}
          columns={columns}
          pagination={{ pageSize: 10, size: 'small' }}
          onRow={r => ({ onClick: () => openVehicle(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Vehicle Profile Drawer */}
      <VehicleDrawer vehicle={selected} open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelected(null); }} allFines={allFines} setAllFines={setAllFines} />

      {/* Add Vehicle Modal — redesigned */}
      <Modal
        open={addOpen} centered
        onCancel={() => { setAddOpen(false); form.resetFields(); setSelectedType(''); }}
        footer={null}
        width={680}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
      >
        {/* Custom header */}
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #2d7a40 100%)`, borderRadius: '8px 8px 0 0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CarOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>إضافة مركبة جديدة</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>أدخل بيانات المركبة ووثائقها</div>
            </div>
          </div>
          <Button type="text" icon={<span style={{ color: '#fff', fontSize: 18, fontWeight: 300 }}>×</span>}
            onClick={() => { setAddOpen(false); form.resetFields(); setSelectedType(''); }}
            style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        </div>

        <div style={{ padding: '20px 24px 0', background: '#fff' }}>
          <Form form={form} layout="vertical" onFinish={() => { setAddOpen(false); form.resetFields(); setSelectedType(''); }}>

            {/* Section 1: Vehicle Type Picker */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 3, height: 16, background: PRIMARY, borderRadius: 2 }} />
                <Text strong style={{ fontSize: 13, color: '#333' }}>نوع المركبة</Text>
              </div>
              <Form.Item name="type" rules={[{ required: true, message: 'اختر نوع المركبة' }]} style={{ marginBottom: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {[
                    { value: 'صهريج غاز', icon: '🚚', sub: 'سعة كبيرة', color: '#1a5c2a', bg: '#e8f5e9' },
                    { value: 'صهريج صغير', icon: '🚛', sub: 'توزيع محلي', color: '#1677ff', bg: '#e6f4ff' },
                    { value: 'سيارة إشراف', icon: '🚗', sub: 'خدمات إدارية', color: '#722ed1', bg: '#f9f0ff' },
                    { value: 'سيارة خدمة', icon: '🚜', sub: 'صيانة ودعم', color: '#fa8c16', bg: '#fff7e6' },
                  ].map(opt => (
                    <div key={opt.value}
                      onClick={() => { setSelectedType(opt.value); form.setFieldValue('type', opt.value); }}
                      style={{
                        border: `2px solid ${selectedType === opt.value ? opt.color : '#e8e8e8'}`,
                        borderRadius: 10, padding: '10px 8px', textAlign: 'center', cursor: 'pointer',
                        background: selectedType === opt.value ? opt.bg : '#fafafa',
                        transition: 'all 0.2s',
                      }}>
                      <div style={{ fontSize: 22 }}>{opt.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: selectedType === opt.value ? 700 : 500, color: selectedType === opt.value ? opt.color : '#555', marginTop: 4 }}>{opt.value}</div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </Form.Item>
            </div>

            {/* Section 2: Basic info */}
            <div style={{ background: '#f8fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileTextOutlined style={{ color: PRIMARY, fontSize: 14 }} />
                <Text strong style={{ fontSize: 13, color: '#333' }}>بيانات المركبة</Text>
              </div>
              <Row gutter={[10, 0]}>
                <Col span={12}>
                  <Form.Item name="plate" label="رقم اللوحة" rules={[{ required: true, message: 'مطلوب' }]} style={{ marginBottom: 10 }}>
                    <Input prefix={<span style={{ fontSize: 11, color: '#888' }}>🔵</span>} placeholder="مثال: أ و 12345 أبوظبي" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="brand" label="الماركة" rules={[{ required: true, message: '' }]} style={{ marginBottom: 10 }}>
                    <Input placeholder="مرسيدس، فولفو،..." style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="model" label="الموديل" rules={[{ required: true, message: '' }]} style={{ marginBottom: 10 }}>
                    <Input placeholder="Actros, FH16..." style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="year" label="سنة الصنع" rules={[{ required: true, message: '' }]} style={{ marginBottom: 10 }}>
                    <InputNumber style={{ width: '100%', borderRadius: 8 }} min={2000} max={2030} placeholder="2022" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="capacity" label="السعة (لتر)" style={{ marginBottom: 10 }}>
                    <InputNumber style={{ width: '100%', borderRadius: 8 }} min={0} placeholder="مثال: 15000" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="fuelType" label="نوع الوقود" style={{ marginBottom: 0 }}>
                    <Select placeholder="اختر..." style={{ borderRadius: 8 }}>
                      <Option value="ديزل">ديزل</Option>
                      <Option value="بنزين">بنزين</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* Section 3: Driver */}
            <div style={{ background: '#f8fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined style={{ color: GOLD, fontSize: 14 }} />
                  <Text strong style={{ fontSize: 13, color: '#333' }}>السائق</Text>
                  <Tag style={{ fontSize: 10, marginRight: 0 }} color="default">اختياري</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  💡 تعدد السائقين والورديات يُدار من ملف المركبة
                </Text>
              </div>
              <Row gutter={[10, 0]}>
                <Col span={14}>
                  <Form.Item name="driver" label="اسم السائق الحالي" style={{ marginBottom: 0 }}>
                    <Input prefix={<UserOutlined style={{ color: '#aaa' }} />} placeholder="الاسم الكامل (اختياري)" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="driverPhone" label="رقم الجوال" style={{ marginBottom: 0 }}>
                    <Input prefix={<span style={{ fontSize: 11 }}>📞</span>} placeholder="05XXXXXXXX" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* Section 4: Documents expiry */}
            <div style={{ background: '#f8fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CalendarOutlined style={{ color: '#1677ff', fontSize: 14 }} />
                <Text strong style={{ fontSize: 13, color: '#333' }}>تواريخ انتهاء الوثائق</Text>
              </div>
              <Row gutter={[10, 0]}>
                <Col span={12}>
                  <Form.Item name="insurance" label={<Space size={4}><span style={{ width: 8, height: 8, background: '#52c41a', borderRadius: '50%', display: 'inline-block' }} />انتهاء التأمين</Space>} rules={[{ required: true, message: '' }]} style={{ marginBottom: 10 }}>
                    <Input type="date" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="registration" label={<Space size={4}><span style={{ width: 8, height: 8, background: '#1677ff', borderRadius: '50%', display: 'inline-block' }} />انتهاء التسجيل</Space>} rules={[{ required: true, message: '' }]} style={{ marginBottom: 10 }}>
                    <Input type="date" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nextService" label={<Space size={4}><span style={{ width: 8, height: 8, background: '#fa8c16', borderRadius: '50%', display: 'inline-block' }} />موعد الصيانة القادمة</Space>} style={{ marginBottom: 0 }}>
                    <Input type="date" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="mileage" label={<Space size={4}><span style={{ width: 8, height: 8, background: '#722ed1', borderRadius: '50%', display: 'inline-block' }} />عداد الكيلومترات الحالي</Space>} style={{ marginBottom: 0 }}>
                    <InputNumber style={{ width: '100%', borderRadius: 8 }} min={0} placeholder="كم" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

          </Form>
        </div>

        {/* Custom footer */}
        <div style={{ padding: '14px 24px 20px', background: '#fff', borderRadius: '0 0 8px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {selectedType ? <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />تم اختيار: {selectedType}</Space> : 'اختر نوع المركبة أولاً'}
          </Text>
          <Space>
            <Button onClick={() => { setAddOpen(false); form.resetFields(); setSelectedType(''); }} style={{ borderRadius: 8 }}>
              إلغاء
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: PRIMARY, borderRadius: 8, fontWeight: 600, paddingInline: 20 }}
              onClick={() => form.validateFields().then(() => { setAddOpen(false); form.resetFields(); setSelectedType(''); })}
            >
              حفظ المركبة
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default VehiclesPage;
