import React, { useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space,
  Avatar, Drawer, Descriptions, Modal, Form, Input,
  InputNumber, Select, Tabs, Alert, Divider, Progress, Tooltip,
} from 'antd';
import {
  AppstoreOutlined, ToolOutlined, CheckCircleOutlined, AlertOutlined,
  PlusOutlined, CalendarOutlined, DollarOutlined, FileTextOutlined,
  UserOutlined, HistoryOutlined, ExclamationCircleOutlined,
  PrinterOutlined, InboxOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, ShopOutlined, LaptopOutlined, BuildOutlined,
  SettingOutlined, FireOutlined, MinusCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';
const today   = new Date();
const soon    = new Date(today.getTime() + 60 * 86400000);

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Asset {
  id: string; assetNo: string; name: string; category: string;
  type: string; brand: string; model: string; serialNo: string;
  purchaseDate: string; purchasePrice: number;
  depreciationRate: number; // % per year
  status: 'active' | 'maintenance' | 'disposed' | 'storage' | 'lost';
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  location: string; department: string;
  assignedTo: string; warrantyExpiry?: string; notes?: string;
}
interface AssetMaintenance {
  id: string; assetId: string; date: string;
  type: 'preventive' | 'corrective' | 'inspection';
  description: string; cost: number; technician: string;
  nextDue?: string; status: 'done' | 'pending';
}
interface AssetDoc {
  id: string; assetId: string; name: string;
  type: 'warranty' | 'invoice' | 'manual' | 'certificate' | 'other';
  issueDate: string; expiryDate?: string;
}
interface AssetAssignment {
  id: string; assetId: string; assignedTo: string; department: string;
  location: string; from: string; to?: string; notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const currentValue = (asset: Asset): number => {
  const years = (today.getTime() - new Date(asset.purchaseDate).getTime()) / (365.25 * 86400000);
  return Math.max(0, Math.round(asset.purchasePrice * Math.pow(1 - asset.depreciationRate / 100, years)));
};

const expiryTag = (date?: string) => {
  if (!date) return null;
  const d = new Date(date);
  if (d < today) return <Tag color="red" icon={<AlertOutlined />}>{date} — منتهي</Tag>;
  if (d < soon)  return <Tag color="orange" icon={<ExclamationCircleOutlined />}>{date} — ينتهي قريباً</Tag>;
  return <Tag color="green">{date}</Tag>;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'تقنية المعلومات': <LaptopOutlined />,
  'معدات': <SettingOutlined />,
  'أثاث': <ShopOutlined />,
  'أدوات': <ToolOutlined />,
  'اسطوانات غاز': <FireOutlined />,
  'بنية تحتية': <BuildOutlined />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'تقنية المعلومات': '#1677ff',
  'معدات': '#fa8c16',
  'أثاث': '#722ed1',
  'أدوات': '#08979c',
  'اسطوانات غاز': '#cf1322',
  'بنية تحتية': '#1a5c2a',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:      { label: 'نشط', color: 'green' },
  maintenance: { label: 'صيانة', color: 'orange' },
  disposed:    { label: 'مُستغنى عنه', color: 'default' },
  storage:     { label: 'مخزن', color: 'blue' },
  lost:        { label: 'مفقود', color: 'red' },
};

const COND_MAP: Record<string, { label: string; color: string }> = {
  excellent: { label: 'ممتاز', color: 'green' },
  good:      { label: 'جيد', color: 'cyan' },
  fair:      { label: 'مقبول', color: 'orange' },
  poor:      { label: 'ضعيف', color: 'red' },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { id:'A-001', assetNo:'AST-001', name:'حاسوب محمول Dell', category:'تقنية المعلومات', type:'حاسوب', brand:'Dell', model:'Latitude 5540', serialNo:'DL54-887231', purchaseDate:'2023-03-15', purchasePrice:5800, depreciationRate:25, status:'active', condition:'good', location:'مكتب المديرية', department:'تقنية المعلومات', assignedTo:'محمد علي حسن', warrantyExpiry:'2026-03-15' },
  { id:'A-002', assetNo:'AST-002', name:'طابعة مكتب HP LaserJet', category:'تقنية المعلومات', type:'طابعة', brand:'HP', model:'LaserJet Pro 4002', serialNo:'HP4002-332211', purchaseDate:'2022-08-10', purchasePrice:3200, depreciationRate:20, status:'active', condition:'good', location:'قسم المحاسبة', department:'المحاسبة', assignedTo:'قسم المحاسبة', warrantyExpiry:'2025-08-10' },
  { id:'A-003', assetNo:'AST-003', name:'ضاغط غاز صناعي', category:'معدات', type:'ضاغط', brand:'Atlas Copco', model:'GA 22 VSD', serialNo:'AC-GA22-55441', purchaseDate:'2020-01-20', purchasePrice:85000, depreciationRate:15, status:'active', condition:'good', location:'مستودع أبوظبي', department:'العمليات', assignedTo:'قسم العمليات', warrantyExpiry:'2026-12-31' },
  { id:'A-004', assetNo:'AST-004', name:'رافعة شوكة صغيرة', category:'معدات', type:'رافعة', brand:'Toyota', model:'8FBE15', serialNo:'TOY-FL-77812', purchaseDate:'2019-06-05', purchasePrice:62000, depreciationRate:15, status:'maintenance', condition:'fair', location:'مستودع أبوظبي', department:'العمليات', assignedTo:'فريق المستودع' },
  { id:'A-005', assetNo:'AST-005', name:'مكيف مركزي Daikin 5طن', category:'معدات', type:'مكيف', brand:'Daikin', model:'RZAG140', serialNo:'DK-AC-22115', purchaseDate:'2021-09-01', purchasePrice:18000, depreciationRate:12, status:'active', condition:'excellent', location:'مكتب المديرية', department:'الإدارة', assignedTo:'مكتب المديرية', warrantyExpiry:'2027-09-01' },
  { id:'A-006', assetNo:'AST-006', name:'طاولة اجتماعات كبيرة', category:'أثاث', type:'أثاث مكتبي', brand:'King', model:'مخصص', serialNo:'KF-TBL-2021-009', purchaseDate:'2021-02-14', purchasePrice:12000, depreciationRate:10, status:'active', condition:'good', location:'قاعة الاجتماعات', department:'الإدارة', assignedTo:'عام' },
  { id:'A-007', assetNo:'AST-007', name:'مجموعة أدوات صيانة احترافية', category:'أدوات', type:'أدوات يدوية', brand:'Bosch', model:'GSB 18V Kit', serialNo:'BS-KIT-33221', purchaseDate:'2022-11-01', purchasePrice:4500, depreciationRate:20, status:'active', condition:'good', location:'ورشة الصيانة', department:'العمليات', assignedTo:'فريق الصيانة' },
  { id:'A-008', assetNo:'AST-008', name:'اسطوانات غاز 12كغ (200 وحدة)', category:'اسطوانات غاز', type:'اسطوانة غاز', brand:'بن سدرة', model:'12KG-STD', serialNo:'CYL-12K-BATCH-22A', purchaseDate:'2022-03-01', purchasePrice:180000, depreciationRate:8, status:'active', condition:'good', location:'مستودع أبوظبي', department:'العمليات', assignedTo:'مستودع أبوظبي' },
  { id:'A-009', assetNo:'AST-009', name:'سيرفر Dell PowerEdge R750', category:'تقنية المعلومات', type:'خادم', brand:'Dell', model:'PowerEdge R750', serialNo:'DL-R750-991122', purchaseDate:'2023-06-01', purchasePrice:95000, depreciationRate:20, status:'active', condition:'excellent', location:'غرفة الخوادم', department:'تقنية المعلومات', assignedTo:'قسم تقنية المعلومات', warrantyExpiry:'2028-06-01' },
  { id:'A-010', assetNo:'AST-010', name:'نظام كاميرات مراقبة CCTV', category:'بنية تحتية', type:'كاميرات', brand:'Hikvision', model:'DS-2CD2347G2', serialNo:'HIK-32CH-44512', purchaseDate:'2021-07-15', purchasePrice:42000, depreciationRate:15, status:'active', condition:'good', location:'مبنى الشركة', department:'الإدارة', assignedTo:'عام', warrantyExpiry:'2026-07-15' },
  { id:'A-011', assetNo:'AST-011', name:'مولد كهرباء احتياطي 150كيفا', category:'معدات', type:'مولد كهرباء', brand:'Cummins', model:'C150D5', serialNo:'CUM-G150-77234', purchaseDate:'2020-05-10', purchasePrice:75000, depreciationRate:12, status:'storage', condition:'fair', location:'مستودع أبوظبي', department:'العمليات', assignedTo:'احتياطي' },
  { id:'A-012', assetNo:'AST-012', name:'جهاز تحليل غاز محمول', category:'معدات', type:'معدات قياس', brand:'Dräger', model:'X-am 8000', serialNo:'DR-XAM8-55891', purchaseDate:'2024-01-10', purchasePrice:22000, depreciationRate:20, status:'active', condition:'excellent', location:'ورشة الصيانة', department:'السلامة', assignedTo:'فريق السلامة', warrantyExpiry:'2027-01-10' },
];

const MAINTENANCE_RECORDS: AssetMaintenance[] = [
  { id:'AM-001', assetId:'A-003', date:'2026-07-01', type:'preventive', description:'صيانة دورية للضاغط — تغيير زيت وفلتر', cost:1200, technician:'فني شركة Atlas Copco', nextDue:'2026-10-01', status:'done' },
  { id:'AM-002', assetId:'A-004', date:'2026-09-10', type:'corrective', description:'إصلاح عطل في نظام الرفع الهيدروليكي', cost:3500, technician:'ورشة Toyota المعتمدة', nextDue:'2026-12-10', status:'pending' },
  { id:'AM-003', assetId:'A-005', date:'2026-06-15', type:'preventive', description:'فحص سنوي وتنظيف الفلاتر', cost:450, technician:'فني Daikin معتمد', nextDue:'2026-12-15', status:'done' },
  { id:'AM-004', assetId:'A-003', date:'2026-01-10', type:'inspection', description:'فحص ضغط وفحص أمان سنوي', cost:800, technician:'مفتش معتمد', nextDue:'2027-01-10', status:'done' },
  { id:'AM-005', assetId:'A-010', date:'2026-08-20', type:'preventive', description:'تحديث برمجيات وفحص الكاميرات', cost:600, technician:'فني Hikvision', nextDue:'2027-02-20', status:'done' },
  { id:'AM-006', assetId:'A-009', date:'2026-09-01', type:'preventive', description:'فحص وتنظيف غرفة الخوادم وتحديث النظام', cost:900, technician:'فريق تقنية المعلومات', nextDue:'2027-03-01', status:'done' },
];

const ASSET_DOCS: AssetDoc[] = [
  { id:'AD-001', assetId:'A-001', name:'فاتورة الشراء', type:'invoice', issueDate:'2023-03-15' },
  { id:'AD-002', assetId:'A-001', name:'شهادة الضمان', type:'warranty', issueDate:'2023-03-15', expiryDate:'2026-03-15' },
  { id:'AD-003', assetId:'A-003', name:'شهادة فحص الأمان', type:'certificate', issueDate:'2026-01-10', expiryDate:'2027-01-10' },
  { id:'AD-004', assetId:'A-003', name:'عقد الصيانة السنوي', type:'certificate', issueDate:'2026-01-01', expiryDate:'2026-12-31' },
  { id:'AD-005', assetId:'A-009', name:'شهادة ضمان Dell', type:'warranty', issueDate:'2023-06-01', expiryDate:'2028-06-01' },
  { id:'AD-006', assetId:'A-012', name:'شهادة معايرة وتدريب', type:'certificate', issueDate:'2024-01-10', expiryDate:'2027-01-10' },
];

const ASSET_ASSIGNMENTS: AssetAssignment[] = [
  { id:'AA-001', assetId:'A-001', assignedTo:'محمد علي حسن', department:'تقنية المعلومات', location:'مكتب المديرية', from:'2023-03-15', notes:'تسليم مباشر' },
  { id:'AA-002', assetId:'A-004', assignedTo:'خالد عمر', department:'العمليات', location:'مستودع أبوظبي', from:'2022-01-01', to:'2024-12-31', notes:'مؤقت — أعيد إلى المخزن' },
  { id:'AA-003', assetId:'A-004', assignedTo:'فريق المستودع', department:'العمليات', location:'مستودع أبوظبي', from:'2025-01-01', notes:'تحت الصيانة حالياً' },
];

// ─── Asset Drawer ────────────────────────────────────────────────────────────
const AssetDrawer: React.FC<{ asset: Asset | null; open: boolean; onClose: () => void }> = ({ asset, open, onClose }) => {
  const [maintRev, setMaintRev] = useState(0);
  const [addMaintOpen, setAddMaintOpen] = useState(false);
  const [maintForm] = Form.useForm();

  if (!asset) return null;
  const a = asset;
  void maintRev;

  const aMaint = MAINTENANCE_RECORDS.filter(m => m.assetId === a.id).sort((x,y) => y.date.localeCompare(x.date));
  const aDocs  = ASSET_DOCS.filter(d => d.assetId === a.id);
  const aAssign = ASSET_ASSIGNMENTS.filter(x => x.assetId === a.id).sort((x,y) => y.from.localeCompare(x.from));
  const cv = currentValue(a);
  const deprPct = Math.max(0, Math.min(100, Math.round((1 - cv / a.purchasePrice) * 100)));
  const totalMaintCost = aMaint.reduce((s, m) => s + m.cost, 0);

  const tabItems = [
    {
      key: 'info',
      label: <Space><AppstoreOutlined />معلومات عامة</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card size="small" bordered={false} style={{ borderRadius:10, background:'linear-gradient(135deg,#f0f9f2,#e8f5e9)', border:'1px solid #c8e6c9' }}>
            <Row gutter={12} align="middle">
              <Col>
                <Avatar size={54} style={{ background: CATEGORY_COLORS[a.category] || PRIMARY, fontSize:22 }}>
                  {CATEGORY_ICONS[a.category] || <AppstoreOutlined />}
                </Avatar>
              </Col>
              <Col flex={1}>
                <div style={{ fontSize:15, fontWeight:700 }}>{a.name}</div>
                <Space wrap style={{ marginTop:4 }}>
                  <Tag color={CATEGORY_COLORS[a.category] || 'default'}>{a.category}</Tag>
                  <Tag color={STATUS_MAP[a.status].color}>{STATUS_MAP[a.status].label}</Tag>
                  <Tag color={COND_MAP[a.condition].color}>{COND_MAP[a.condition].label}</Tag>
                </Space>
              </Col>
              <Col style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#888' }}>رقم الأصل</div>
                <div style={{ fontWeight:700, fontFamily:'monospace', color:PRIMARY }}>{a.assetNo}</div>
              </Col>
            </Row>
          </Card>

          <Row gutter={10}>
            {[
              { label:'سعر الشراء', value:a.purchasePrice.toLocaleString()+' د.إ', color:'#333' },
              { label:'القيمة الحالية', value:cv.toLocaleString()+' د.إ', color:PRIMARY },
              { label:'تكلفة الصيانة', value:totalMaintCost.toLocaleString()+' د.إ', color:'#fa8c16' },
            ].map((s, i) => (
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ textAlign:'center', background:'#f9fafb', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:s.color }}>{s.value}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card size="small" bordered={false} style={{ borderRadius:8 }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>نسبة الإهلاك (منذ الشراء)</div>
            <Progress percent={deprPct} strokeColor={deprPct>70?'#ff4d4f':deprPct>40?'#fa8c16':'#52c41a'} format={p=>`${p}% مهلك`} />
          </Card>

          <Descriptions size="small" column={2} bordered style={{ borderRadius:8 }}>
            <Descriptions.Item label="النوع">{a.type}</Descriptions.Item>
            <Descriptions.Item label="الماركة / الموديل">{a.brand} {a.model}</Descriptions.Item>
            <Descriptions.Item label="الرقم التسلسلي"><Text copyable style={{fontFamily:'monospace',fontSize:11}}>{a.serialNo}</Text></Descriptions.Item>
            <Descriptions.Item label="تاريخ الشراء">{a.purchaseDate}</Descriptions.Item>
            <Descriptions.Item label="القسم">{a.department}</Descriptions.Item>
            <Descriptions.Item label="الموقع">{a.location}</Descriptions.Item>
            <Descriptions.Item label="مسؤول الأصل">{a.assignedTo}</Descriptions.Item>
            <Descriptions.Item label="معدل الإهلاك">{a.depreciationRate}% / سنة</Descriptions.Item>
            {a.warrantyExpiry && <Descriptions.Item label="انتهاء الضمان" span={2}>{expiryTag(a.warrantyExpiry)}</Descriptions.Item>}
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'maintenance',
      label: <Space><ToolOutlined />الصيانة</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddMaintOpen(true)} style={{ background:PRIMARY }}>
              إضافة سجل صيانة
            </Button>
          </div>
          {aMaint.length === 0 ? <Alert message="لا توجد سجلات صيانة" type="info" showIcon /> :
            aMaint.map(m => (
              <Card key={m.id} size="small" bordered={false} style={{ borderRadius:8, border:'1px solid #f0f0f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <Space>
                    <Tag color={m.type==='preventive'?'green':m.type==='corrective'?'red':'blue'} style={{fontSize:10}}>
                      {m.type==='preventive'?'وقائية':m.type==='corrective'?'تصحيحية':'فحص'}
                    </Tag>
                    <Text strong style={{fontSize:12}}>{m.date}</Text>
                    <Tag color={m.status==='done'?'green':'orange'}>{m.status==='done'?'منجزة':'معلقة'}</Tag>
                  </Space>
                  <Text style={{ color:'#fa8c16', fontWeight:600, fontSize:12 }}>{m.cost.toLocaleString()} د.إ</Text>
                </div>
                <div style={{ fontSize:12, color:'#555', margin:'4px 0' }}>{m.description}</div>
                <Space style={{fontSize:10, color:'#888'}}>
                  <span>الفني: {m.technician}</span>
                  {m.nextDue && <span>الموعد القادم: {m.nextDue}</span>}
                </Space>
              </Card>
            ))
          }
        </div>
      ),
    },
    {
      key: 'docs',
      label: <Space><FileTextOutlined />المستندات</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {aDocs.length === 0 ? <Alert message="لا توجد مستندات" type="info" showIcon /> :
            aDocs.map(d => (
              <Card key={d.id} size="small" bordered={false} style={{ borderRadius:8, border:'1px solid #f0f0f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <Space>
                    <FileTextOutlined style={{ color:PRIMARY }} />
                    <Text strong style={{fontSize:12}}>{d.name}</Text>
                    <Tag color="blue" style={{fontSize:10}}>{d.type==='warranty'?'ضمان':d.type==='invoice'?'فاتورة':d.type==='certificate'?'شهادة':'مستند'}</Tag>
                  </Space>
                  {d.expiryDate && expiryTag(d.expiryDate)}
                </div>
                <Text type="secondary" style={{fontSize:10}}>تاريخ الإصدار: {d.issueDate}</Text>
              </Card>
            ))
          }
          <Button type="dashed" icon={<PlusOutlined />} block>إضافة مستند</Button>
        </div>
      ),
    },
    {
      key: 'assignment',
      label: <Space><HistoryOutlined />سجل التخصيص</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {aAssign.length === 0 ? <Alert message="لا يوجد سجل تخصيص" type="info" showIcon /> :
            aAssign.map(x => (
              <Card key={x.id} size="small" bordered={false} style={{ borderRadius:8, background: !x.to ? '#f0f9f2' : '#fafafa', border:'1px solid #f0f0f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <Space><UserOutlined style={{ color:PRIMARY }} /><Text strong style={{fontSize:12}}>{x.assignedTo}</Text><Tag color="purple" style={{fontSize:10}}>{x.department}</Tag></Space>
                  {!x.to && <Tag color="green">حالياً</Tag>}
                </div>
                <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{x.location} · {x.from}{x.to ? ` → ${x.to}` : ' → الآن'}</div>
                {x.notes && <div style={{ fontSize:11, color:'#555' }}>{x.notes}</div>}
              </Card>
            ))
          }
          <Button type="dashed" icon={<PlusOutlined />} block>تخصيص جديد</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Drawer
        open={open} onClose={onClose} width={580}
        title={<Space><Avatar size="small" style={{ background: CATEGORY_COLORS[a.category] || PRIMARY }}>{CATEGORY_ICONS[a.category] || <AppstoreOutlined />}</Avatar><span>{a.name}</span></Space>}
        extra={<Space><Tag color={STATUS_MAP[a.status].color}>{STATUS_MAP[a.status].label}</Tag><Button size="small" icon={<PrinterOutlined />}>طباعة</Button></Space>}
      >
        <Tabs items={tabItems} size="small" />
      </Drawer>

      <Modal
        open={addMaintOpen} title={<Space><ToolOutlined />إضافة سجل صيانة</Space>}
        onCancel={() => { setAddMaintOpen(false); maintForm.resetFields(); }}
        onOk={() => maintForm.validateFields().then(vals => {
          MAINTENANCE_RECORDS.push({ id:'AM-'+Date.now(), assetId:a.id, date:vals.date, type:vals.type, description:vals.description, cost:vals.cost||0, technician:vals.technician, nextDue:vals.nextDue, status:'done' });
          setMaintRev(r => r+1); setAddMaintOpen(false); maintForm.resetFields();
        })}
        okText="حفظ" cancelText="إلغاء"
      >
        <Form form={maintForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="date" label="التاريخ" rules={[{required:true}]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="type" label="نوع الصيانة" rules={[{required:true}]}>
              <Select><Option value="preventive">وقائية</Option><Option value="corrective">تصحيحية</Option><Option value="inspection">فحص</Option></Select>
            </Form.Item></Col>
          </Row>
          <Form.Item name="description" label="الوصف" rules={[{required:true}]}><TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="cost" label="التكلفة (د.إ)"><InputNumber style={{width:'100%'}} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="technician" label="الفني / الشركة" rules={[{required:true}]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="nextDue" label="موعد الصيانة القادم"><Input type="date" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Assets Page ─────────────────────────────────────────────────────────────
const AssetsPage: React.FC = () => {
  const [selAsset, setSelAsset] = useState<Asset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [filterCat, setFilterCat] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [rev, setRev] = useState(0);
  void rev;

  const categories = [...new Set(ASSETS.map(a => a.category))];
  const depts = [...new Set(ASSETS.map(a => a.department))];

  const filtered = ASSETS.filter(a =>
    (!filterCat || a.category === filterCat) &&
    (!filterStatus || a.status === filterStatus) &&
    (!filterDept || a.department === filterDept)
  );

  const totalPurchase = ASSETS.reduce((s,a) => s + a.purchasePrice, 0);
  const totalCurrent  = ASSETS.reduce((s,a) => s + currentValue(a), 0);
  const totalDepr     = totalPurchase - totalCurrent;

  const statCards = [
    { label:'إجمالي الأصول', value: ASSETS.length, icon:<AppstoreOutlined />, color:'#1a5c2a' },
    { label:'نشط', value: ASSETS.filter(a=>a.status==='active').length, icon:<CheckCircleOutlined />, color:'#52c41a' },
    { label:'صيانة', value: ASSETS.filter(a=>a.status==='maintenance').length, icon:<ToolOutlined />, color:'#fa8c16' },
    { label:'مستبعد', value: ASSETS.filter(a=>a.status==='disposed').length, icon:<AlertOutlined />, color:'#ff4d4f' },
    { label:'سعر الشراء الإجمالي', value: totalPurchase.toLocaleString()+' د.إ', icon:<DollarOutlined />, color:'#1a5c2a' },
    { label:'القيمة الدفترية الحالية', value: totalCurrent.toLocaleString()+' د.إ', icon:<DollarOutlined />, color:'#52c41a' },
    { label:'إجمالي الإهلاك', value: totalDepr.toLocaleString()+' د.إ', icon:<AlertOutlined />, color:'#ff4d4f' },
    { label:'سجلات صيانة', value: MAINTENANCE_RECORDS.length, icon:<ToolOutlined />, color:'#722ed1' },
  ];

  // Chart data
  const catCounts: Record<string, number> = {};
  const catValues: Record<string, number> = {};
  ASSETS.forEach(a => {
    catCounts[a.category] = (catCounts[a.category] || 0) + 1;
    catValues[a.category] = (catValues[a.category] || 0) + currentValue(a);
  });
  const catLabels = Object.keys(catCounts);
  const statusCounts: Record<string, number> = {};
  ASSETS.forEach(a => { statusCounts[a.status] = (statusCounts[a.status]||0)+1; });

  // Maintenance cost by month (last 6 months)
  const today2 = new Date();
  const maintMonths = Array.from({length:6}, (_,i) => {
    const d = new Date(today2.getFullYear(), today2.getMonth() - 5 + i, 1);
    return { label:`${d.getMonth()+1}/${d.getFullYear()}`, year:d.getFullYear(), month:d.getMonth() };
  });
  const maintTrend = maintMonths.map(m =>
    MAINTENANCE_RECORDS.filter(r => { const rd = new Date(r.date); return rd.getFullYear()===m.year && rd.getMonth()===m.month; }).reduce((s,r)=>s+r.cost,0)
  );

  const charts1: { title:string; opts:ApexCharts.ApexOptions; series:any; type:any; height?:number }[] = [
    {
      title: 'توزيع الفئات',
      type: 'donut',
      height: 240,
      series: catLabels.map(c => catCounts[c]),
      opts: {
        labels: catLabels,
        colors: catLabels.map((_,i) => ['#1a5c2a','#c9a84c','#2196f3','#ff5722','#9c27b0','#00bcd4'][i%6]),
        legend: { position:'bottom', fontSize:'11px' },
        dataLabels: { formatter:(v:number)=>v.toFixed(0) },
        chart: { fontFamily:'Tajawal,sans-serif' },
      },
    },
    {
      title: 'عدد الأصول حسب الحالة',
      type: 'bar',
      height: 240,
      series: [{ name:'عدد', data: Object.values(statusCounts) }],
      opts: {
        chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
        xaxis: { categories: Object.keys(statusCounts).map(s=>STATUS_MAP[s as keyof typeof STATUS_MAP]?.label||s), labels:{style:{fontSize:'11px'}} },
        colors: [PRIMARY],
        plotOptions: { bar: { borderRadius:6, columnWidth:'50%' } },
        dataLabels: { enabled:true },
        yaxis: { title: { text:'' } },
      },
    },
    {
      title: 'القيمة الحالية حسب الفئة (د.إ)',
      type: 'bar',
      height: 240,
      series: [{ name:'القيمة', data: catLabels.map(c=>catValues[c]) }],
      opts: {
        chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
        xaxis: { categories: catLabels, labels:{style:{fontSize:'10px'}} },
        colors: [GOLD],
        plotOptions: { bar: { borderRadius:6, horizontal:true } },
        dataLabels: { enabled:false },
        tooltip: { y:{ formatter:(v:number)=>v.toLocaleString()+' د.إ' } },
      },
    },
  ];

  const charts2: { title:string; opts:ApexCharts.ApexOptions; series:any; type:any; height?:number }[] = [
    {
      title: 'تكلفة الصيانة (آخر 6 أشهر)',
      type: 'area',
      height: 220,
      series: [{ name:'تكلفة الصيانة', data: maintTrend }],
      opts: {
        chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false}, sparkline:{enabled:false} },
        xaxis: { categories: maintMonths.map(m=>m.label), labels:{style:{fontSize:'10px'}} },
        colors: ['#722ed1'],
        fill: { type:'gradient', gradient:{shadeIntensity:1, opacityFrom:0.4, opacityTo:0.05} },
        stroke: { curve:'smooth', width:2 },
        dataLabels: { enabled:false },
        tooltip: { y:{ formatter:(v:number)=>v.toLocaleString()+' د.إ' } },
      },
    },
    {
      title: 'نسبة الإهلاك الإجمالية',
      type: 'radialBar',
      height: 220,
      series: [Math.round((totalDepr / totalPurchase) * 100)],
      opts: {
        chart: { fontFamily:'Tajawal,sans-serif' },
        plotOptions: { radialBar: { hollow:{ size:'60%' }, dataLabels:{ name:{ fontSize:'13px' }, value:{ fontSize:'22px', fontWeight:700 } } } },
        labels: ['مهلك'],
        colors: ['#ff4d4f'],
      },
    },
    {
      title: 'عدد الأصول حسب الحالة (دائرة)',
      type: 'pie',
      height: 220,
      series: Object.values(statusCounts),
      opts: {
        chart: { fontFamily:'Tajawal,sans-serif' },
        labels: Object.keys(statusCounts).map(s=>STATUS_MAP[s as keyof typeof STATUS_MAP]?.label||s),
        colors: ['#52c41a','#fa8c16','#ff4d4f','#1890ff','#999'],
        legend: { position:'bottom', fontSize:'11px' },
        dataLabels: { formatter:(v:number)=>v.toFixed(0)+'%' },
      },
    },
  ];

  const columns = [
    { title:'رقم الأصل', dataIndex:'assetNo', key:'assetNo', render:(v:string)=><Text code style={{fontSize:11}}>{v}</Text> },
    { title:'الاسم', dataIndex:'name', key:'name', render:(v:string, r:Asset)=>
        <Space><Avatar size="small" style={{background:CATEGORY_COLORS[r.category]||PRIMARY,fontSize:12}}>{CATEGORY_ICONS[r.category]||<AppstoreOutlined/>}</Avatar><span style={{fontSize:13,fontWeight:500}}>{v}</span></Space>
    },
    { title:'الفئة', dataIndex:'category', key:'category', render:(v:string)=><Tag>{v}</Tag> },
    { title:'القسم', dataIndex:'department', key:'department', render:(v:string)=><Text style={{fontSize:12}}>{v}</Text> },
    { title:'الحالة', dataIndex:'status', key:'status', render:(v:string)=>{const m=STATUS_MAP[v as keyof typeof STATUS_MAP]; return <Tag color={m?.color}>{m?.label}</Tag>;} },
    { title:'التقييم', dataIndex:'condition', key:'condition', render:(v:string)=>{const m=COND_MAP[v as keyof typeof COND_MAP]; return <Tag color={m?.color}>{m?.label}</Tag>;} },
    { title:'القيمة الحالية', key:'cv', render:(_:any,r:Asset)=><Text strong style={{color:PRIMARY}}>{currentValue(r).toLocaleString()} د.إ</Text> },
    { title:'إجراءات', key:'act', render:(_:any,r:Asset)=>
        <Button size="small" onClick={()=>{setSelAsset(r); setDrawerOpen(true);}}>
          التفاصيل
        </Button>
    },
  ];

  return (
    <div style={{ padding:20, direction:'rtl', fontFamily:'Tajawal,sans-serif', minHeight:'100vh', background:'#f5f7fa' }}>
      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div>
          <Title level={3} style={{ margin:0, color:PRIMARY }}><AppstoreOutlined /> إدارة الأصول</Title>
          <Text type="secondary">تتبع وتدير جميع أصول الشركة</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={()=>setAddModalOpen(true)} style={{ background:PRIMARY }}>
          إضافة أصل جديد
        </Button>
      </div>

      {/* Stat Cards */}
      <Row gutter={[12,12]} style={{ marginBottom:20 }}>
        {statCards.map((s,i) => (
          <Col key={i} xs={12} sm={6} md={3}>
            <Card size="small" bordered={false} style={{ borderRadius:12, textAlign:'center', background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize:22, color:s.color }}>{s.icon}</div>
              <div style={{ fontSize:i<4?22:13, fontWeight:700, color:s.color, lineHeight:1.2 }}>{s.value}</div>
              <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[14,14]} style={{ marginBottom:14 }}>
        {charts1.map((c,i) => (
          <Col key={i} xs={24} md={8}>
            <Card size="small" bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }} title={<Text style={{fontSize:12,fontWeight:600}}>{c.title}</Text>}>
              <ReactApexChart type={c.type} series={c.series} options={c.opts} height={c.height||220} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[14,14]} style={{ marginBottom:20 }}>
        {charts2.map((c,i) => (
          <Col key={i} xs={24} md={8}>
            <Card size="small" bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }} title={<Text style={{fontSize:12,fontWeight:600}}>{c.title}</Text>}>
              <ReactApexChart type={c.type} series={c.series} options={c.opts} height={c.height||220} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters + Table */}
      <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
          <Select placeholder="فلتر: الفئة" allowClear style={{minWidth:140}} onChange={v=>setFilterCat(v||'')}>
            {categories.map(c=><Option key={c} value={c}>{c}</Option>)}
          </Select>
          <Select placeholder="فلتر: الحالة" allowClear style={{minWidth:130}} onChange={v=>setFilterStatus(v||'')}>
            {Object.entries(STATUS_MAP).map(([k,v])=><Option key={k} value={k}>{v.label}</Option>)}
          </Select>
          <Select placeholder="فلتر: القسم" allowClear style={{minWidth:150}} onChange={v=>setFilterDept(v||'')}>
            {depts.map(d=><Option key={d} value={d}>{d}</Option>)}
          </Select>
          <Text type="secondary" style={{ marginRight:'auto', lineHeight:'32px', fontSize:12 }}>{filtered.length} من {ASSETS.length} أصل</Text>
        </div>
        <Table
          dataSource={filtered} rowKey="id" columns={columns} size="small"
          scroll={{ x:true }}
          onRow={r => ({ onClick: ()=>{setSelAsset(r); setDrawerOpen(true);}, style:{cursor:'pointer'} })}
          pagination={{ pageSize:10, showTotal:(t,range)=>`${range[0]}-${range[1]} من ${t}` }}
        />
      </Card>

      {/* Add Asset Modal */}
      <Modal
        open={addModalOpen}
        title={<Space><PlusOutlined />إضافة أصل جديد</Space>}
        onCancel={()=>{setAddModalOpen(false); addForm.resetFields();}}
        onOk={()=>addForm.validateFields().then(vals=>{
          ASSETS.push({
            id:'A-'+Date.now(), assetNo:'AST-'+String(ASSETS.length+1).padStart(3,'0'),
            name:vals.name, category:vals.category, type:vals.type||'',
            brand:vals.brand||'', model:vals.model||'', serialNo:vals.serialNo||'',
            purchaseDate:vals.purchaseDate, purchasePrice:vals.purchasePrice||0,
            depreciationRate:vals.depreciationRate||10,
            status:'active', condition:'excellent',
            location:vals.location||'', department:vals.department||'',
            assignedTo:vals.assignedTo||'', warrantyExpiry:vals.warrantyExpiry, notes:vals.notes,
          });
          setRev(r=>r+1); setAddModalOpen(false); addForm.resetFields();
        })}
        width={620} okText="حفظ" cancelText="إلغاء"
      >
        <Form form={addForm} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="name" label="اسم الأصل" rules={[{required:true}]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="الفئة" rules={[{required:true}]}>
              <Select>{categories.map(c=><Option key={c} value={c}>{c}</Option>)}</Select>
            </Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="brand" label="الماركة"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="model" label="الموديل"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="serialNo" label="الرقم التسلسلي"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="purchaseDate" label="تاريخ الشراء" rules={[{required:true}]}><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="purchasePrice" label="سعر الشراء (د.إ)" rules={[{required:true}]}><InputNumber style={{width:'100%'}} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="depreciationRate" label="معدل الإهلاك (%)"><InputNumber style={{width:'100%'}} min={0} max={100} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="department" label="القسم"><Select>{depts.map(d=><Option key={d} value={d}>{d}</Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="location" label="الموقع"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="assignedTo" label="مسؤول الأصل"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="warrantyExpiry" label="انتهاء الضمان"><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="type" label="نوع الأصل"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="ملاحظات"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Asset Drawer */}
      <AssetDrawer asset={selAsset} open={drawerOpen} onClose={()=>setDrawerOpen(false)} />
    </div>
  );
};

export default AssetsPage;
