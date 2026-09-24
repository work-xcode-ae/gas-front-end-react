import React, { useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space,
  Avatar, Drawer, Descriptions, Modal,
  Form, Input, InputNumber, Select, Tabs, Alert,
  Progress, Divider, Checkbox
} from 'antd';
import {
  TeamOutlined, UserOutlined, DollarOutlined, CalendarOutlined,
  FileTextOutlined, SafetyCertificateOutlined, ClockCircleOutlined,
  PlusOutlined, AlertOutlined, CheckCircleOutlined, CloseOutlined,
  LockOutlined, MailOutlined, PhoneOutlined, HomeOutlined,
  BankOutlined, ExclamationCircleOutlined,
  PrinterOutlined, DownloadOutlined, HistoryOutlined,
  MinusCircleOutlined, FileProtectOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;

const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';
const today   = new Date();
const soon    = new Date(today.getTime() + 30 * 86400000);

const expiryTag = (date: string) => {
  const d = new Date(date);
  if (d < today) return <Tag color="red" icon={<AlertOutlined />}>{date} — منتهي</Tag>;
  if (d < soon)  return <Tag color="orange" icon={<ExclamationCircleOutlined />}>{date} — ينتهي قريباً</Tag>;
  return <Tag color="green" icon={<CheckCircleOutlined />}>{date}</Tag>;
};

// Interfaces
interface Employee {
  id: string; empNo: string; name: string; nameEn: string;
  department: string; position: string; email: string; phone: string;
  hireDate: string; nationality: string; status: 'active' | 'leave' | 'terminated';
  username: string; role: string;
  salary: { base: number; housing: number; transport: number; other: number; deductions: number; };
  leave: { annual: number; annualUsed: number; sick: number; sickUsed: number; emergency: number; emergencyUsed: number; };
  bankName: string; iban: string;
}
interface EmpDoc { id: string; empId: string; name: string; type: string; issueDate: string; expiryDate: string; }
interface LeaveRecord { id: string; empId: string; type: string; from: string; to: string; days: number; status: 'approved'|'pending'|'rejected'; reason: string; }
interface ExpenseClaim { id: string; empId: string; date: string; category: string; amount: number; status: 'approved'|'pending'|'rejected'; description: string; }
interface PayrollRecord { id: string; empId: string; month: string; gross: number; deductions: number; net: number; status: 'paid'|'pending'; paidOn?: string; }
interface AttendanceRecord { id: string; empId: string; date: string; checkIn: string; checkOut?: string; status: 'present'|'late'|'absent'|'leave'; }
interface DeductionLine { id: string; label: string; amount: number; }
interface SalaryStructure { id: string; empId: string; name: string; startDate: string; endDate?: string; basic: number; housing: number; transport: number; other: number; deductions: number; }

const EMPLOYEES: Employee[] = [
  { id:'E-001', empNo:'EMP-001', name:'محمد علي حسن', nameEn:'Mohammed Ali Hassan', department:'العمليات', position:'مدير عمليات', email:'m.ali@binsidra.ae', phone:'0501234567', hireDate:'2019-03-01', nationality:'إماراتي', status:'active', username:'m.ali', role:'مدير عمليات', bankName:'بنك أبوظبي', iban:'AE070331234567890123456', salary:{base:12000, housing:3000, transport:1500, other:500, deductions:800}, leave:{annual:30, annualUsed:12, sick:15, sickUsed:2, emergency:5, emergencyUsed:1} },
  { id:'E-002', empNo:'EMP-002', name:'أحمد سالم الحربي', nameEn:'Ahmed Salem Al-Harbi', department:'المحاسبة', position:'محاسب أول', email:'a.harbi@binsidra.ae', phone:'0552345678', hireDate:'2020-06-15', nationality:'سعودي', status:'active', username:'a.harbi', role:'محاسب', bankName:'بنك الإمارات', iban:'AE120340987654321098765', salary:{base:9000, housing:2500, transport:1000, other:0, deductions:600}, leave:{annual:30, annualUsed:8, sick:15, sickUsed:5, emergency:5, emergencyUsed:0} },
  { id:'E-003', empNo:'EMP-003', name:'خالد عمر المنصوري', nameEn:'Khalid Omar Al-Mansouri', department:'اللوجستيك', position:'سائق صهريج', email:'k.mansouri@binsidra.ae', phone:'0561234567', hireDate:'2022-01-10', nationality:'باكستاني', status:'leave', username:'k.mansouri', role:'سائق', bankName:'بنك دبي', iban:'AE450230111222333444555', salary:{base:5500, housing:1500, transport:800, other:300, deductions:400}, leave:{annual:30, annualUsed:30, sick:15, sickUsed:8, emergency:5, emergencyUsed:2} },
  { id:'E-004', empNo:'EMP-004', name:'فاطمة يوسف العامري', nameEn:'Fatima Yousuf Al-Ameri', department:'الموارد البشرية', position:'موظفة موارد بشرية', email:'f.ameri@binsidra.ae', phone:'0503456789', hireDate:'2021-09-01', nationality:'إماراتية', status:'active', username:'f.ameri', role:'مدير موارد بشرية', bankName:'بنك أبوظبي', iban:'AE380340777888999000111', salary:{base:11000, housing:2800, transport:1200, other:700, deductions:900}, leave:{annual:30, annualUsed:5, sick:15, sickUsed:0, emergency:5, emergencyUsed:0} },
  { id:'E-005', empNo:'EMP-005', name:'سعيد راشد العامري', nameEn:'Saeed Rashed Al-Ameri', department:'اللوجستيك', position:'سائق صهريج', email:'s.ameri@binsidra.ae', phone:'0581234567', hireDate:'2020-01-15', nationality:'إماراتي', status:'active', username:'s.ameri', role:'سائق', bankName:'بنك الشارقة', iban:'AE120570444555666777888', salary:{base:5500, housing:1500, transport:800, other:0, deductions:350}, leave:{annual:30, annualUsed:18, sick:15, sickUsed:3, emergency:5, emergencyUsed:1} },
];

const EMP_DOCS: EmpDoc[] = [
  { id:'ED-001', empId:'E-001', name:'جواز السفر', type:'هوية', issueDate:'2022-01-01', expiryDate:'2027-01-01' },
  { id:'ED-002', empId:'E-001', name:'بطاقة الهوية الإماراتية', type:'هوية', issueDate:'2023-05-01', expiryDate:'2026-05-01' },
  { id:'ED-003', empId:'E-001', name:'تصريح عمل', type:'تصريح', issueDate:'2024-01-01', expiryDate:'2026-09-30' },
  { id:'ED-004', empId:'E-002', name:'جواز السفر', type:'هوية', issueDate:'2021-03-01', expiryDate:'2026-10-15' },
  { id:'ED-005', empId:'E-002', name:'تصريح عمل', type:'تصريح', issueDate:'2024-06-01', expiryDate:'2025-05-31' },
  { id:'ED-006', empId:'E-003', name:'جواز السفر', type:'هوية', issueDate:'2020-07-01', expiryDate:'2025-07-01' },
  { id:'ED-007', empId:'E-003', name:'رخصة قيادة', type:'رخصة', issueDate:'2022-01-01', expiryDate:'2026-01-01' },
  { id:'ED-008', empId:'E-004', name:'جواز السفر', type:'هوية', issueDate:'2023-09-01', expiryDate:'2028-09-01' },
  { id:'ED-009', empId:'E-005', name:'جواز السفر', type:'هوية', issueDate:'2022-06-01', expiryDate:'2026-06-01' },
  { id:'ED-010', empId:'E-005', name:'رخصة قيادة', type:'رخصة', issueDate:'2023-01-01', expiryDate:'2025-12-31' },
];

const LEAVE_RECORDS: LeaveRecord[] = [
  { id:'L-001', empId:'E-001', type:'سنوية', from:'2026-07-01', to:'2026-07-12', days:12, status:'approved', reason:'إجازة سنوية' },
  { id:'L-002', empId:'E-002', type:'مرضية', from:'2026-06-10', to:'2026-06-14', days:5, status:'approved', reason:'مراجعة طبية' },
  { id:'L-003', empId:'E-003', type:'سنوية', from:'2026-08-01', to:'2026-08-30', days:30, status:'approved', reason:'إجازة سنوية' },
  { id:'L-004', empId:'E-001', type:'طارئة', from:'2026-09-20', to:'2026-09-20', days:1, status:'pending', reason:'ظرف طارئ' },
  { id:'L-005', empId:'E-005', type:'سنوية', from:'2026-05-01', to:'2026-05-18', days:18, status:'approved', reason:'إجازة سنوية' },
];

const EXPENSE_CLAIMS: ExpenseClaim[] = [
  { id:'EX-001', empId:'E-001', date:'2026-09-10', category:'وقود', amount:250, status:'approved', description:'وقود سيارة الشركة' },
  { id:'EX-002', empId:'E-001', date:'2026-09-15', category:'اجتماعات', amount:800, status:'pending', description:'غداء عمل مع عميل' },
  { id:'EX-003', empId:'E-002', date:'2026-09-05', category:'مواصلات', amount:180, status:'approved', description:'تاكسي لاجتماع' },
  { id:'EX-004', empId:'E-004', date:'2026-09-01', category:'تدريب', amount:1500, status:'approved', description:'رسوم دورة تدريبية' },
  { id:'EX-005', empId:'E-005', date:'2026-09-18', category:'وقود', amount:320, status:'pending', description:'وقود الصهريج' },
];

const PAYROLL: PayrollRecord[] = [
  { id:'PR-001', empId:'E-001', month:'2026-09', gross:17000, deductions:800, net:16200, status:'pending' },
  { id:'PR-002', empId:'E-001', month:'2026-08', gross:17000, deductions:800, net:16200, status:'paid', paidOn:'2026-08-28' },
  { id:'PR-003', empId:'E-001', month:'2026-07', gross:17000, deductions:800, net:16200, status:'paid', paidOn:'2026-07-29' },
  { id:'PR-004', empId:'E-002', month:'2026-09', gross:12500, deductions:600, net:11900, status:'pending' },
  { id:'PR-005', empId:'E-002', month:'2026-08', gross:12500, deductions:600, net:11900, status:'paid', paidOn:'2026-08-28' },
  { id:'PR-006', empId:'E-003', month:'2026-09', gross:8100, deductions:400, net:7700, status:'pending' },
  { id:'PR-007', empId:'E-004', month:'2026-09', gross:15700, deductions:900, net:14800, status:'pending' },
  { id:'PR-008', empId:'E-005', month:'2026-09', gross:7800, deductions:350, net:7450, status:'pending' },
];

const ATTENDANCE: AttendanceRecord[] = [
  { id:'A-001', empId:'E-001', date:'2026-09-22', checkIn:'08:02', checkOut:'17:05', status:'present' },
  { id:'A-002', empId:'E-001', date:'2026-09-21', checkIn:'08:30', checkOut:'17:00', status:'late' },
  { id:'A-003', empId:'E-001', date:'2026-09-20', checkIn:'07:58', checkOut:'17:10', status:'present' },
  { id:'A-004', empId:'E-002', date:'2026-09-22', checkIn:'08:00', checkOut:'17:00', status:'present' },
  { id:'A-005', empId:'E-002', date:'2026-09-21', checkIn:'09:15', checkOut:'17:00', status:'late' },
  { id:'A-006', empId:'E-003', date:'2026-09-22', checkIn:'', status:'leave' },
  { id:'A-007', empId:'E-004', date:'2026-09-22', checkIn:'07:55', checkOut:'17:00', status:'present' },
  { id:'A-008', empId:'E-005', date:'2026-09-22', checkIn:'08:10', checkOut:'17:30', status:'present' },
  { id:'A-009', empId:'E-005', date:'2026-09-21', checkIn:'', status:'absent' },
];

const SALARY_STRUCTURES: SalaryStructure[] = [
  { id:'SS-001', empId:'E-001', name:'هيكل راتب أ', startDate:'2024-01-01', endDate:'2025-12-31', basic:11000, housing:2800, transport:1400, other:400, deductions:700 },
  { id:'SS-002', empId:'E-001', name:'هيكل راتب ب (محدث)', startDate:'2026-01-01', basic:12000, housing:3000, transport:1500, other:500, deductions:800 },
  { id:'SS-003', empId:'E-002', name:'هيكل راتب أ', startDate:'2020-06-15', endDate:'2025-06-01', basic:8000, housing:2200, transport:900, other:0, deductions:500 },
  { id:'SS-004', empId:'E-002', name:'هيكل راتب ب (محدث)', startDate:'2026-06-02', basic:9000, housing:2500, transport:1000, other:0, deductions:600 },
  { id:'SS-005', empId:'E-003', name:'هيكل راتب', startDate:'2022-01-10', basic:5500, housing:1500, transport:800, other:300, deductions:400 },
  { id:'SS-006', empId:'E-004', name:'هيكل راتب أ', startDate:'2021-09-01', endDate:'2025-08-31', basic:10000, housing:2600, transport:1100, other:600, deductions:800 },
  { id:'SS-007', empId:'E-004', name:'هيكل راتب ب (محدث)', startDate:'2026-09-01', basic:11000, housing:2800, transport:1200, other:700, deductions:900 },
  { id:'SS-008', empId:'E-005', name:'هيكل راتب', startDate:'2020-01-15', basic:5500, housing:1500, transport:800, other:0, deductions:350 },
];

const getActiveSalary = (empId: string): SalaryStructure | null => {
  const todayStr = today.toISOString().slice(0,10);
  const structs = SALARY_STRUCTURES
    .filter(s => s.empId === empId && s.startDate <= todayStr && (!s.endDate || s.endDate >= todayStr))
    .sort((a,b) => b.startDate.localeCompare(a.startDate));
  return structs[0] || null;
};

const DEPT_COLORS: Record<string,string> = {
  'العمليات':'#1a5c2a', 'المحاسبة':'#1677ff',
  'اللوجستيك':'#fa8c16', 'الموارد البشرية':'#722ed1',
};

// EmployeeDrawer


// ─── Generate Payroll Modal (single employee) ───────────────────────────────
const GeneratePayrollModal: React.FC<{
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onGenerated: (record: PayrollRecord) => void;
}> = ({ open, employee, onClose, onGenerated }) => {
  const [form] = Form.useForm();
  const [deductions, setDeductions] = React.useState<DeductionLine[]>([]);
  const [month, setMonth] = React.useState<string>('');

  React.useEffect(() => {
    if (open) {
      const now = new Date();
      const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setMonth(m);
      form.setFieldsValue({ month: m });
      setDeductions([]);
    }
  }, [open, form]);

  if (!employee) return null;

  const ss = getActiveSalary(employee.id);
  const gross = ss ? ss.basic + ss.housing + ss.transport + ss.other : 0;
  const extraDed = deductions.reduce((s, d) => s + (d.amount || 0), 0);
  const totalDed = (ss?.deductions || 0) + extraDed;
  const net = gross - totalDed;

  const addDeduction = () =>
    setDeductions(prev => [...prev, { id: Date.now().toString(), label: '', amount: 0 }]);

  const updateDeduction = (id: string, field: 'label' | 'amount', val: string | number) =>
    setDeductions(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));

  const removeDeduction = (id: string) =>
    setDeductions(prev => prev.filter(d => d.id !== id));

  const handleOk = () => {
    form.validateFields().then(vals => {
      const record: PayrollRecord = {
        id: 'PR-' + Date.now(),
        empId: employee.id,
        month: vals.month,
        gross,
        deductions: totalDed,
        net,
        status: 'pending',
      };
      PAYROLL.push(record);
      onGenerated(record);
      onClose();
    });
  };

  return (
    <Modal
      title={<Space><FileProtectOutlined />{'توليد راتب — '}{employee.name}</Space>}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="توليد وحفظ"
      cancelText="إلغاء"
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="month" label="الشهر" rules={[{ required: true }]}>
          <Input type="month" />
        </Form.Item>
      </Form>

      {ss ? (
        <>
          <Divider orientation="right" plain style={{ fontSize: 12 }}>مكونات الراتب</Divider>
          <Row gutter={8} style={{ marginBottom: 12 }}>
            {[
              { label: 'الأساسي', val: ss.basic },
              { label: 'بدل سكن', val: ss.housing },
              { label: 'بدل نقل', val: ss.transport },
              { label: 'بدل آخر', val: ss.other },
            ].map((r, i) => (
              <Col span={6} key={i}>
                <div style={{ background: '#f6ffed', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#888' }}>{r.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1a5c2a' }}>{r.val.toLocaleString()}</div>
                </div>
              </Col>
            ))}
          </Row>

          <Divider orientation="right" plain style={{ fontSize: 12 }}>الخصومات</Divider>

          {/* Fixed deduction from structure */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#fff2f0', borderRadius: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 12 }}>خصم هيكل الراتب</span>
            <span style={{ fontWeight: 600, color: '#cf1322' }}>- {ss.deductions.toLocaleString()} د.إ</span>
          </div>

          {/* Extra deduction lines */}
          {deductions.map(d => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <Input
                placeholder="سبب الخصم"
                style={{ flex: 1 }}
                value={d.label}
                onChange={e => updateDeduction(d.id, 'label', e.target.value)}
              />
              <InputNumber
                placeholder="المبلغ"
                min={0}
                style={{ width: 110 }}
                value={d.amount}
                addonAfter="د.إ"
                onChange={v => updateDeduction(d.id, 'amount', v || 0)}
              />
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeDeduction(d.id)}
              />
            </div>
          ))}

          <Button type="dashed" onClick={addDeduction} block icon={<PlusOutlined />} style={{ marginBottom: 12 }}>
            إضافة خصم
          </Button>

          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={8}>
            <Col span={8}>
              <div style={{ textAlign: 'center', background: '#f0f9f2', borderRadius: 6, padding: '8px 0' }}>
                <div style={{ fontSize: 10, color: '#888' }}>إجمالي</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>{gross.toLocaleString()} د.إ</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center', background: '#fff2f0', borderRadius: 6, padding: '8px 0' }}>
                <div style={{ fontSize: 10, color: '#888' }}>مجموع الخصومات</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#cf1322' }}>- {totalDed.toLocaleString()} د.إ</div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ textAlign: 'center', background: '#f6ffed', borderRadius: 6, padding: '8px 0', border: '1px solid #52c41a' }}>
                <div style={{ fontSize: 10, color: '#888' }}>صافي الراتب</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#1a5c2a' }}>{net.toLocaleString()} د.إ</div>
              </div>
            </Col>
          </Row>
        </>
      ) : (
        <Alert message="لا يوجد هيكل راتب نشط. تعيين هيكل راتب أولاً." type="error" showIcon />
      )}
    </Modal>
  );
};

const SalaryTab: React.FC<{ empId: string; onAdd: () => void }> = ({ empId, onAdd }) => {
  const activeSS = getActiveSalary(empId);
  const empStructures = SALARY_STRUCTURES
    .filter(s => s.empId === empId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const gross = activeSS ? activeSS.basic + activeSS.housing + activeSS.transport + activeSS.other : 0;
  const net   = activeSS ? gross - activeSS.deductions : 0;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {activeSS ? (
        <Card size="small" bordered={false} style={{ borderRadius:10, background:'linear-gradient(135deg, #f6ffed 0%, #f0ffe8 100%)', border:'1px solid #52c41a' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <Text strong style={{ fontSize:14 }}>{activeSS.name}</Text>
            <Tag color="green" icon={<CheckCircleOutlined />}>الهيكل الحالي</Tag>
          </div>
          <Row gutter={8} style={{ marginBottom:8 }}>
            <Col span={8} style={{ textAlign:'center', borderLeft:'1px solid #e0e0e0' }}>
              <div style={{ fontSize:11, color:'#888' }}>الصافي</div>
              <div style={{ fontSize:20, fontWeight:700, color:'#1a5c2a' }}>{net.toLocaleString()} <span style={{fontSize:11}}>د.إ</span></div>
            </Col>
            <Col span={8} style={{ textAlign:'center', borderLeft:'1px solid #e0e0e0' }}>
              <div style={{ fontSize:11, color:'#888' }}>الإجمالي</div>
              <div style={{ fontSize:18, fontWeight:600, color:'#333' }}>{gross.toLocaleString()} <span style={{fontSize:11}}>د.إ</span></div>
            </Col>
            <Col span={8} style={{ textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#888' }}>الاستقطاعات</div>
              <div style={{ fontSize:18, fontWeight:600, color:'#cf1322' }}>{activeSS.deductions.toLocaleString()} <span style={{fontSize:11}}>د.إ</span></div>
            </Col>
          </Row>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="الراتب الأساسي">{activeSS.basic.toLocaleString()} د.إ</Descriptions.Item>
            <Descriptions.Item label="بدل السكن">{activeSS.housing.toLocaleString()} د.إ</Descriptions.Item>
            <Descriptions.Item label="بدل النقل">{activeSS.transport.toLocaleString()} د.إ</Descriptions.Item>
            <Descriptions.Item label="بدل آخر">{activeSS.other.toLocaleString()} د.إ</Descriptions.Item>
            <Descriptions.Item label="تاريخ البدء">{activeSS.startDate}</Descriptions.Item>
            <Descriptions.Item label="تاريخ الانتهاء">{activeSS.endDate || <Tag color="blue">ساري المفعول</Tag>}</Descriptions.Item>
          </Descriptions>
        </Card>
      ) : (
        <Alert message="لا يوجد هيكل راتب نشط لهذا الموظف" type="warning" showIcon />
      )}
      <Card size="small" title={<Space><HistoryOutlined />سجل الهياكل</Space>} bordered={false} style={{ borderRadius:10 }}
        extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd}>إضافة هيكل</Button>}>
        <Table size="small" dataSource={empStructures} rowKey="id" pagination={false}
          columns={[
            { title:'اسم الهيكل', dataIndex:'name', key:'name', render:(v:string,r:SalaryStructure)=><Space>{v}{r.id===activeSS?.id&&<Tag color="green" style={{fontSize:10}}>نشط</Tag>}</Space> },
            { title:'تاريخ البدء', dataIndex:'startDate', key:'startDate' },
            { title:'تاريخ الانتهاء', dataIndex:'endDate', key:'endDate', render:(v:string)=>v||<Tag color="blue" style={{fontSize:10}}>مفتوح</Tag> },
            { title:'الأساسي', dataIndex:'basic', key:'basic', render:(v:number)=>v.toLocaleString()+' د.إ' },
            { title:'الإجمالي', key:'gross', render:(_:unknown,r:SalaryStructure)=>(r.basic+r.housing+r.transport+r.other).toLocaleString()+' د.إ' },
            { title:'الصافي', key:'net', render:(_:unknown,r:SalaryStructure)=>(r.basic+r.housing+r.transport+r.other-r.deductions).toLocaleString()+' د.إ' },
          ]}
        />
      </Card>
    </div>
  );
};

const EmployeeDrawer: React.FC<{
  employee: Employee | null; open: boolean; onClose: () => void;
}> = ({ employee, open, onClose }) => {
  const [addLeaveOpen, setAddLeaveOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [payrollGenOpen, setPayrollGenOpen] = useState(false);
  const [payrollRev, setPayrollRev] = useState(0);
  const [leaveForm] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const [salaryForm] = Form.useForm();

  if (!employee) return null;
  const e = employee;
  const eDocs    = EMP_DOCS.filter(d => d.empId === e.id);
  const eLeave   = LEAVE_RECORDS.filter(l => l.empId === e.id);
  const eExp     = EXPENSE_CLAIMS.filter(x => x.empId === e.id);
  const ePayroll = PAYROLL.filter(p => p.empId === e.id); void payrollRev;
  const eAtt     = ATTENDANCE.filter(a => a.empId === e.id);
  const expiredDocs = eDocs.filter(d => new Date(d.expiryDate) < today).length;
  const pendingExp  = eExp.filter(x => x.status === 'pending').reduce((s, x) => s + x.amount, 0);

  const tabItems = [
    {
      key: 'info',
      label: <Space><UserOutlined />معلومات عامة</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card size="small" bordered={false} style={{ borderRadius:10, background:'linear-gradient(135deg, #f0f9f2 0%, #e8f5e9 100%)', border:'1px solid #c8e6c9' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <Avatar size={64} style={{ background: PRIMARY, fontSize:24, fontWeight:700 }}>{e.name.charAt(0)}</Avatar>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700 }}>{e.name}</div>
                <div style={{ fontSize:12, color:'#666' }}>{e.nameEn}</div>
                <Space style={{ marginTop:6 }} wrap>
                  <Tag color={DEPT_COLORS[e.department]||'default'}>{e.department}</Tag>
                  <Tag color="blue">{e.position}</Tag>
                  <Tag color={e.status==='active'?'green':e.status==='leave'?'orange':'red'}>
                    {e.status==='active'?'نشط':e.status==='leave'?'في إجازة':'منتهي'}
                  </Tag>
                </Space>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:11, color:'#888' }}>رقم الموظف</div>
                <div style={{ fontWeight:700, fontFamily:'monospace', color: PRIMARY }}>{e.empNo}</div>
              </div>
            </div>
          </Card>
          <Row gutter={10}>
            {[
              { label:'صافي الراتب', value:(() => { const ss=getActiveSalary(e.id); return ss?(ss.basic+ss.housing+ss.transport+ss.other-ss.deductions).toLocaleString()+' د':'—'; })(), color:'#1a5c2a', icon:<DollarOutlined /> },
              { label:'المستندات المنتهية', value:expiredDocs, color:expiredDocs>0?'#ff4d4f':'#52c41a', icon:<FileTextOutlined /> },
              { label:'مطالبات معلقة', value:`${pendingExp.toLocaleString()} د`, color:'#fa8c16', icon:<BankOutlined /> },
            ].map((s, i) => (
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, textAlign:'center', background:'#f9fafb' }}>
                  <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <Descriptions size="small" column={2} bordered style={{ borderRadius:8 }}>
            <Descriptions.Item label={<><MailOutlined /> البريد</>}>{e.email}</Descriptions.Item>
            <Descriptions.Item label={<><PhoneOutlined /> الجوال</>}>{e.phone}</Descriptions.Item>
            <Descriptions.Item label={<><CalendarOutlined /> تاريخ التوظيف</>}>{e.hireDate}</Descriptions.Item>
            <Descriptions.Item label={<><HomeOutlined /> الجنسية</>}>{e.nationality}</Descriptions.Item>
            <Descriptions.Item label={<><LockOutlined /> اسم المستخدم</>}><Tag color="purple" style={{ fontFamily:'monospace' }}>{e.username}</Tag></Descriptions.Item>
            <Descriptions.Item label={<><SafetyCertificateOutlined /> الصلاحية</>}><Tag color="geekblue">{e.role}</Tag></Descriptions.Item>
            <Descriptions.Item label={<><BankOutlined /> البنك</>}>{e.bankName}</Descriptions.Item>
            <Descriptions.Item label="IBAN"><Text copyable style={{ fontFamily:'monospace', fontSize:11 }}>{e.iban}</Text></Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'salary',
      label: <Space><DollarOutlined />الراتب</Space>,
      children: (
        <SalaryTab empId={e.id} onAdd={() => setSalaryModalOpen(true)} />
      ),
    },
    {
      key: 'leaves',
      label: <Space><CalendarOutlined />الإجازات</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Row gutter={10}>
            {[
              { label:'سنوية', total: e.leave.annual, used: e.leave.annualUsed, color:'#1677ff' },
              { label:'مرضية', total: e.leave.sick, used: e.leave.sickUsed, color:'#ff4d4f' },
              { label:'طارئة', total: e.leave.emergency, used: e.leave.emergencyUsed, color:'#fa8c16' },
            ].map((lt, i) => (
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, background:'#f9fafb', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{lt.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color: lt.color }}>{lt.total - lt.used} <span style={{ fontSize:10 }}>متبقي</span></div>
                  <Progress percent={Math.round((lt.used/lt.total)*100)} size="small" strokeColor={lt.color} showInfo={false} style={{ marginBottom:2 }} />
                  <div style={{ fontSize:10, color:'#888' }}>{lt.used} / {lt.total} يوم</div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY }} onClick={() => { leaveForm.resetFields(); setAddLeaveOpen(true); }}>طلب إجازة</Button>
          </div>
          <Table size="small" rowKey="id" pagination={false} dataSource={[...eLeave].sort((a,b) => b.from.localeCompare(a.from))}
            columns={[
              { title:'النوع', dataIndex:'type', render:(t:string) => <Tag color="blue">{t}</Tag> },
              { title:'من', dataIndex:'from', render:(d:string) => <Text style={{ fontSize:11 }}>{d}</Text> },
              { title:'إلى', dataIndex:'to', render:(d:string) => <Text style={{ fontSize:11 }}>{d}</Text> },
              { title:'الأيام', dataIndex:'days', render:(d:number) => <Text strong>{d}</Text> },
              { title:'الحالة', dataIndex:'status', render:(s:string) => <Tag color={s==='approved'?'green':s==='pending'?'orange':'red'}>{s==='approved'?'معتمد':s==='pending'?'بانتظار':'مرفوض'}</Tag> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'attendance',
      label: <Space><ClockCircleOutlined />الحضور</Space>,
      children: (
        <div>
          <Row gutter={10} style={{ marginBottom:12 }}>
            {[
              { label:'حاضر', value: eAtt.filter(a=>a.status==='present').length, color:'#52c41a' },
              { label:'متأخر', value: eAtt.filter(a=>a.status==='late').length, color:'#fa8c16' },
              { label:'غائب', value: eAtt.filter(a=>a.status==='absent').length, color:'#ff4d4f' },
              { label:'إجازة', value: eAtt.filter(a=>a.status==='leave').length, color:'#1677ff' },
            ].map((s,i) => (
              <Col span={6} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, textAlign:'center', background:'#f9fafb' }}>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <Table size="small" rowKey="id" pagination={false} dataSource={[...eAtt].sort((a,b) => b.date.localeCompare(a.date))}
            columns={[
              { title:'التاريخ', dataIndex:'date', render:(d:string)=><Text style={{fontSize:11}}>{d}</Text> },
              { title:'دخول', dataIndex:'checkIn', render:(t:string)=>t?<Text style={{fontSize:12,color:'#52c41a'}}>{t}</Text>:<Text style={{color:'#bbb'}}>—</Text> },
              { title:'خروج', dataIndex:'checkOut', render:(t:string)=>t?<Text style={{fontSize:12,color:'#1677ff'}}>{t}</Text>:<Text style={{color:'#bbb'}}>—</Text> },
              { title:'الحالة', dataIndex:'status', render:(s:string)=><Tag color={s==='present'?'green':s==='late'?'orange':s==='absent'?'red':'blue'}>{s==='present'?'حاضر':s==='late'?'متأخر':s==='absent'?'غائب':'إجازة'}</Tag> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'docs',
      label: <Space><FileTextOutlined />الوثائق{expiredDocs > 0 && <Tag color="red" style={{fontSize:10,margin:0}}>{expiredDocs}</Tag>}</Space>,
      children: (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <Button size="small" type="dashed" icon={<PlusOutlined />}>إضافة وثيقة</Button>
          </div>
          <Table size="small" rowKey="id" pagination={false} dataSource={eDocs}
            columns={[
              { title:'الوثيقة', dataIndex:'name', render:(n:string)=><Text strong style={{fontSize:12}}>{n}</Text> },
              { title:'النوع', dataIndex:'type', render:(t:string)=><Tag>{t}</Tag> },
              { title:'تاريخ الإصدار', dataIndex:'issueDate', render:(d:string)=><Text style={{fontSize:11}}>{d}</Text> },
              { title:'تاريخ الانتهاء', dataIndex:'expiryDate', render:(d:string)=>expiryTag(d) },
              { title:'', render:()=><Button size="small" icon={<DownloadOutlined />} type="text" /> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'expenses',
      label: <Space><BankOutlined />المصروفات{eExp.filter(x=>x.status==='pending').length > 0 && <Tag color="orange" style={{fontSize:10,margin:0}}>{eExp.filter(x=>x.status==='pending').length}</Tag>}</Space>,
      children: (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <Text type="secondary" style={{fontSize:12}}>إجمالي معلق: <Text strong style={{color:'#fa8c16'}}>{pendingExp.toLocaleString()} د</Text></Text>
            <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD }} onClick={() => { expenseForm.resetFields(); setAddExpenseOpen(true); }}>مطالبة جديدة</Button>
          </div>
          <Table size="small" rowKey="id" pagination={false} dataSource={[...eExp].sort((a,b)=>b.date.localeCompare(a.date))}
            columns={[
              { title:'التاريخ', dataIndex:'date', render:(d:string)=><Text style={{fontSize:11}}>{d}</Text> },
              { title:'الفئة', dataIndex:'category', render:(c:string)=><Tag color="geekblue">{c}</Tag> },
              { title:'الوصف', dataIndex:'description', render:(d:string)=><Text style={{fontSize:11,color:'#888'}}>{d}</Text> },
              { title:'المبلغ', dataIndex:'amount', render:(a:number)=><Text strong style={{color:'#fa8c16'}}>{a.toLocaleString()} د</Text> },
              { title:'الحالة', dataIndex:'status', render:(s:string)=><Tag color={s==='approved'?'green':s==='pending'?'orange':'red'}>{s==='approved'?'معتمد':s==='pending'?'بانتظار':'مرفوض'}</Tag> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'payroll',
      label: <Space><PrinterOutlined />كشف الراتب</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <Button type="primary" icon={<FileProtectOutlined />} onClick={() => setPayrollGenOpen(true)}
              style={{ background: PRIMARY }}>توليد راتب جديد</Button>
          </div>
          <Table size="small" rowKey="id" pagination={false} dataSource={[...ePayroll].sort((a,b)=>b.month.localeCompare(a.month))}
          columns={[
            { title:'الشهر', dataIndex:'month', render:(m:string)=><Text strong style={{fontFamily:'monospace'}}>{m}</Text> },
            { title:'إجمالي', dataIndex:'gross', render:(g:number)=><Text>{g.toLocaleString()} د</Text> },
            { title:'خصومات', dataIndex:'deductions', render:(d:number)=><Text style={{color:'#ff4d4f'}}>- {d.toLocaleString()} د</Text> },
            { title:'صافي', dataIndex:'net', render:(n:number)=><Text strong style={{color: PRIMARY}}>{n.toLocaleString()} د</Text> },
            { title:'الحالة', dataIndex:'status', render:(s:string)=><Tag color={s==='paid'?'green':'orange'}>{s==='paid'?'مدفوع':'بانتظار'}</Tag> },
            { title:'تاريخ الدفع', dataIndex:'paidOn', render:(d:string)=>d?<Text style={{fontSize:11}}>{d}</Text>:<Text style={{color:'#bbb'}}>—</Text> },
            { title:'', render:()=><Button size="small" type="text" icon={<PrinterOutlined />} /> },
          ]}
        />
        </div>
      ),
    },
    {
      key: 'access',
      label: <Space><LockOutlined />الصلاحيات</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card size="small" bordered={false} style={{ borderRadius:10, background:'#f9f0ff', border:'1px solid #d3adf7' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ background:'#722ed1', borderRadius:8, padding:'8px 12px' }}><LockOutlined style={{ color:'#fff', fontSize:20 }} /></div>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>بيانات الدخول</div>
                <Space style={{ marginTop:4 }}>
                  <Tag color="purple" style={{ fontFamily:'monospace', fontSize:13 }}>{e.username}</Tag>
                  <Tag color="geekblue">{e.role}</Tag>
                </Space>
              </div>
            </div>
          </Card>
          <Descriptions size="small" bordered column={1} style={{ borderRadius:8 }}>
            <Descriptions.Item label="اسم المستخدم"><Text copyable style={{ fontFamily:'monospace' }}>{e.username}</Text></Descriptions.Item>
            <Descriptions.Item label="الدور">{e.role}</Descriptions.Item>
            <Descriptions.Item label="البريد"><Text copyable>{e.email}</Text></Descriptions.Item>
            <Descriptions.Item label="حالة الحساب"><Tag color="green">نشط</Tag></Descriptions.Item>
          </Descriptions>
          <Alert type="info" showIcon message="لتغيير كلمة المرور أو الصلاحيات, تواصل مع مدير النظام." />
        </div>
      ),
    },
  ];

  return (
    <>
      <Drawer
        open={open} onClose={onClose}
        width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 40 : 820, 820)}
        styles={{ body:{ background:'#f5f7fa', padding:'16px 20px' }, header:{ background:'#fff' } }}
        title={
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Avatar size={36} style={{ background: DEPT_COLORS[e.department]||PRIMARY, fontWeight:700 }}>{e.name.charAt(0)}</Avatar>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>{e.name}</div>
              <div style={{ fontSize:11, color:'#888', fontWeight:400 }}>{e.position} — {e.department}</div>
            </div>
            <Tag style={{ marginRight:'auto' }} color={e.status==='active'?'green':e.status==='leave'?'orange':'red'}>
              {e.status==='active'?'نشط':e.status==='leave'?'في إجازة':'منتهي'}
            </Tag>
          </div>
        }
      >
        <Tabs items={tabItems} size="small" />
      </Drawer>
      <Modal open={addLeaveOpen} onCancel={()=>setAddLeaveOpen(false)} footer={null} width={440} destroyOnHidden
        styles={{ header:{display:'none'}, body:{padding:0} }}>
        <div style={{ background:`linear-gradient(135deg, ${PRIMARY} 0%, #2d7a3e 100%)`, borderRadius:'8px 8px 0 0', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>🗓 طلب إجازة — {e.name}</div>
          <Button type="text" icon={<CloseOutlined style={{color:'#fff'}} />} onClick={()=>setAddLeaveOpen(false)} />
        </div>
        <Form form={leaveForm} layout="vertical" style={{ padding:20 }} onFinish={()=>setAddLeaveOpen(false)}>
          <Form.Item name="leaveType" label="نوع الإجازة" rules={[{required:true}]}>
            <Select>
              <Option value="سنوية">سنوية</Option>
              <Option value="مرضية">مرضية</Option>
              <Option value="طارئة">طارئة</Option>
            </Select>
          </Form.Item>
          <Row gutter={10}>
            <Col span={12}><Form.Item name="from" label="من" rules={[{required:true}]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="to" label="إلى" rules={[{required:true}]}><Input type="date" /></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="السبب"><Input.TextArea rows={2} /></Form.Item>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Button onClick={()=>setAddLeaveOpen(false)}>إلغاء</Button>
            <Button type="primary" htmlType="submit" style={{ background: PRIMARY }}>إرسال الطلب</Button>
          </div>
        </Form>
      </Modal>
      <Modal open={addExpenseOpen} onCancel={()=>setAddExpenseOpen(false)} footer={null} width={440} destroyOnHidden
        styles={{ header:{display:'none'}, body:{padding:0} }}>
        <div style={{ background:`linear-gradient(135deg, ${GOLD} 0%, #e0b84c 100%)`, borderRadius:'8px 8px 0 0', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>💸 مطالبة مصروف — {e.name}</div>
          <Button type="text" icon={<CloseOutlined style={{color:'#fff'}} />} onClick={()=>setAddExpenseOpen(false)} />
        </div>
        <Form form={expenseForm} layout="vertical" style={{ padding:20 }} onFinish={()=>setAddExpenseOpen(false)}>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="category" label="الفئة" rules={[{required:true}]}>
                <Select>{['وقود','مواصلات','اجتماعات','تدريب','لوازم','أخرى'].map(c=><Option key={c} value={c}>{c}</Option>)}</Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="المبلغ (درهم)" rules={[{required:true}]}><Input type="number" prefix={<DollarOutlined />} /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="date" label="التاريخ" rules={[{required:true}]}><Input type="date" /></Form.Item>
          <Form.Item name="description" label="الوصف" rules={[{required:true}]}><Input.TextArea rows={2} /></Form.Item>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Button onClick={()=>setAddExpenseOpen(false)}>إلغاء</Button>
            <Button type="primary" htmlType="submit" style={{ background: GOLD, borderColor: GOLD }}>تقديم المطالبة</Button>
          </div>
        </Form>
      </Modal>

    <Modal
      title={<Space><DollarOutlined />إضافة هيكل راتب</Space>}
      open={salaryModalOpen}
      onCancel={() => { setSalaryModalOpen(false); salaryForm.resetFields(); }}
      onOk={() => {
        salaryForm.validateFields().then(vals => {
          const newSS: SalaryStructure = {
            id: 'SS-NEW-' + Date.now(),
            empId: e.id,
            name: vals.name,
            startDate: vals.startDate,
            endDate: vals.endDate || undefined,
            basic: Number(vals.basic),
            housing: Number(vals.housing),
            transport: Number(vals.transport),
            other: Number(vals.other || 0),
            deductions: Number(vals.deductions || 0),
          };
          SALARY_STRUCTURES.push(newSS);
          setSalaryModalOpen(false);
          salaryForm.resetFields();
        });
      }}
      okText="حفظ" cancelText="إلغاء"
    >
      <Form form={salaryForm} layout="vertical">
        <Form.Item name="name" label="اسم الهيكل" rules={[{ required:true }]}>
          <Input placeholder="مثال: هيكل راتب 2026" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="startDate" label="تاريخ البدء" rules={[{ required:true }]}>
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="تاريخ الانتهاء (اختياري)">
              <Input type="date" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="basic" label="الراتب الأساسي" rules={[{ required:true }]}>
              <Input type="number" addonAfter="د.إ" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="housing" label="بدل السكن" rules={[{ required:true }]}>
              <Input type="number" addonAfter="د.إ" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="transport" label="بدل النقل" rules={[{ required:true }]}>
              <Input type="number" addonAfter="د.إ" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="other" label="بدل آخر">
              <Input type="number" addonAfter="د.إ" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="deductions" label="الاستقطاعات">
          <Input type="number" addonAfter="د.إ" />
        </Form.Item>
      </Form>
    </Modal>

    <GeneratePayrollModal
      open={payrollGenOpen}
      employee={employee}
      onClose={() => setPayrollGenOpen(false)}
      onGenerated={() => setPayrollRev(r => r + 1)}
    />
    </>
  );
};

// Main Page

// ─── Bulk Payroll Modal ───────────────────────────────────────────────────────
const BulkPayrollModal: React.FC<{
  open: boolean;
  employeeIds: string[];
  month: string;
  onMonthChange: (m: string) => void;
  deductions: Record<string, DeductionLine[]>;
  onDeductionsChange: (d: Record<string, DeductionLine[]>) => void;
  onClose: () => void;
  onGenerated: () => void;
}> = ({ open, employeeIds, month, onMonthChange, deductions, onDeductionsChange, onClose, onGenerated }) => {
  const employees = EMPLOYEES.filter(e => employeeIds.includes(e.id));

  const addDeduction = (empId: string) => {
    const prev = deductions[empId] || [];
    onDeductionsChange({ ...deductions, [empId]: [...prev, { id: Date.now().toString(), label: '', amount: 0 }] });
  };

  const updateDeduction = (empId: string, id: string, field: 'label' | 'amount', val: string | number) => {
    const prev = deductions[empId] || [];
    onDeductionsChange({ ...deductions, [empId]: prev.map(d => d.id === id ? { ...d, [field]: val } : d) });
  };

  const removeDeduction = (empId: string, id: string) => {
    const prev = deductions[empId] || [];
    onDeductionsChange({ ...deductions, [empId]: prev.filter(d => d.id !== id) });
  };

  const handleGenerate = () => {
    if (!month) return;
    employees.forEach(emp => {
      const ss = getActiveSalary(emp.id);
      if (!ss) return;
      const gross = ss.basic + ss.housing + ss.transport + ss.other;
      const extraDed = (deductions[emp.id] || []).reduce((s, d) => s + (d.amount || 0), 0);
      const totalDed = ss.deductions + extraDed;
      PAYROLL.push({
        id: 'PR-' + emp.id + '-' + Date.now(),
        empId: emp.id,
        month,
        gross,
        deductions: totalDed,
        net: gross - totalDed,
        status: 'pending',
      });
    });
    onGenerated();
  };

  return (
    <Modal
      title={<Space><FileProtectOutlined />{'توليد رواتب — '}{employees.length}{' موظفين'}</Space>}
      open={open}
      onCancel={onClose}
      onOk={handleGenerate}
      okText={`توليد وحفظ (${employees.length})`}
      cancelText="إلغاء"
      width={680}
    >
      <div style={{ marginBottom: 12 }}>
        <Text strong>الشهر: </Text>
        <Input type="month" value={month} onChange={e => onMonthChange(e.target.value)}
          style={{ width: 180, marginRight: 8 }} />
      </div>
      <div style={{ maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {employees.map(emp => {
          const ss = getActiveSalary(emp.id);
          const gross = ss ? ss.basic + ss.housing + ss.transport + ss.other : 0;
          const extraDed = (deductions[emp.id] || []).reduce((s, d) => s + (d.amount || 0), 0);
          const totalDed = (ss?.deductions || 0) + extraDed;
          const net = gross - totalDed;
          return (
            <Card key={emp.id} size="small" bordered={false} style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Space>
                  <Avatar size="small" style={{ background: PRIMARY }}>{emp.name.charAt(0)}</Avatar>
                  <Text strong>{emp.name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{emp.empNo}</Text>
                </Space>
                {ss ? (
                  <Space>
                    <Tag color="default">إجمالي {gross.toLocaleString()}</Tag>
                    <Tag color="error">- {totalDed.toLocaleString()}</Tag>
                    <Tag color="success">صافي {net.toLocaleString()} د.إ</Tag>
                  </Space>
                ) : (
                  <Tag color="warning">لا يوجد هيكل راتب</Tag>
                )}
              </div>
              {ss && (
                <>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: '4px 8px', marginBottom: 6, fontSize: 11, color: '#666' }}>
                    خصم هيكل الراتب: <strong style={{ color: '#cf1322' }}>- {ss.deductions.toLocaleString()} د.إ</strong>
                  </div>
                  {(deductions[emp.id] || []).map(d => (
                    <div key={d.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <Input placeholder="سبب الخصم" style={{ flex: 1 }} value={d.label}
                        onChange={ev => updateDeduction(emp.id, d.id, 'label', ev.target.value)} size="small" />
                      <InputNumber placeholder="المبلغ" min={0} style={{ width: 100 }} value={d.amount} size="small"
                        addonAfter="د.إ" onChange={v => updateDeduction(emp.id, d.id, 'amount', v || 0)} />
                      <Button type="text" danger size="small" icon={<MinusCircleOutlined />}
                        onClick={() => removeDeduction(emp.id, d.id)} />
                    </div>
                  ))}
                  <Button type="dashed" size="small" onClick={() => addDeduction(emp.id)} icon={<PlusOutlined />}>
                    إضافة خصم
                  </Button>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </Modal>
  );
};

const EmployeesPage: React.FC = () => {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkPayrollOpen, setBulkPayrollOpen] = useState(false);
  const [bulkMonth, setBulkMonth] = useState<string>('');
  const [bulkDeductions, setBulkDeductions] = useState<Record<string, DeductionLine[]>>({});
  const [bulkRev, setBulkRev] = useState(0);

  const departments = [...new Set(EMPLOYEES.map(e => e.department))];
  const filtered = EMPLOYEES.filter(e =>
    (filterDept   === 'all' || e.department === filterDept) &&
    (filterStatus === 'all' || e.status === filterStatus)
  );

  const totalPayroll  = PAYROLL.filter(p => p.month === '2026-09').reduce((s,p) => s+p.net, 0);
  const onLeave       = EMPLOYEES.filter(e => e.status === 'leave').length;
  const expiredAny    = EMP_DOCS.filter(d => new Date(d.expiryDate) < today).length;
  const pendingClaims = EXPENSE_CLAIMS.filter(x => x.status === 'pending').reduce((s,x) => s+x.amount, 0);

  return (
    <div style={{ padding:'24px', direction:'rtl', minHeight:'100vh', background:'#f5f7fa' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background: PRIMARY, borderRadius:10, padding:'8px 12px' }}>
            <TeamOutlined style={{ color:'#fff', fontSize:22 }} />
          </div>
          <div>
            <Title level={4} style={{ margin:0, color:'#1a1a1a' }}>إدارة الموظفين</Title>
            <Text type="secondary" style={{ fontSize:12 }}>{filtered.length} موظف</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, fontWeight:600 }}>إضافة موظف</Button>
      </div>
      <Row gutter={12} style={{ marginBottom:16 }}>
        {[
          { label:'إجمالي الموظفين', value: EMPLOYEES.length, color: PRIMARY, bg:'#f0f9f2', icon:<TeamOutlined /> },
          { label:'نشطون', value: EMPLOYEES.filter(e=>e.status==='active').length, color:'#52c41a', bg:'#f6ffed', icon:<CheckCircleOutlined /> },
          { label:'في إجازة', value: onLeave, color:'#fa8c16', bg:'#fff7e6', icon:<CalendarOutlined /> },
          { label:'رواتب سبتمبر', value:`${totalPayroll.toLocaleString()} د`, color:'#1677ff', bg:'#e6f4ff', icon:<DollarOutlined /> },
          { label:'مستندات منتهية', value: expiredAny, color: expiredAny>0?'#ff4d4f':'#52c41a', bg: expiredAny>0?'#fff2f0':'#f6ffed', icon:<AlertOutlined /> },
          { label:'مطالبات معلقة', value:`${pendingClaims.toLocaleString()} د`, color:'#722ed1', bg:'#f9f0ff', icon:<BankOutlined /> },
        ].map((s, i) => (
          <Col span={4} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius:10, background:s.bg, textAlign:'center' }}>
              <div style={{ fontSize:13, color:s.color, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:17, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>
      {expiredAny > 0 && <Alert type="error" showIcon style={{ marginBottom:10, borderRadius:8 }} message={`${expiredAny} وثيقة منتهية الصلاحية — يجب التجديد فوراً`} />}
      {pendingClaims > 0 && <Alert type="warning" showIcon style={{ marginBottom:10, borderRadius:8 }} message={`مطالبات مصروفات معلقة بإجمالي ${pendingClaims.toLocaleString()} درهم`} />}
      {/* ─── Charts Row ─────────────────────────────────────── */}
      <Row gutter={14} style={{ marginBottom:14 }}>
        {/* Donut: Status */}
        <Col span={6}>
          <Card bordered={false} size="small" style={{ borderRadius:10, height:'100%' }}
            title={<Text strong style={{fontSize:12}}>توزيع حالة الموظفين</Text>}>
            <ReactApexChart type="donut" height={180}
              series={[
                EMPLOYEES.filter(e=>e.status==='active').length,
                EMPLOYEES.filter(e=>e.status==='leave').length,
                EMPLOYEES.filter(e=>e.status==='terminated').length,
              ]}
              options={{
                labels:['نشطون','في إجازة','منتهيون'],
                colors:['#52c41a','#fa8c16','#ff4d4f'],
                legend:{ position:'bottom', fontSize:'11px' },
                dataLabels:{ style:{ fontSize:'11px' } },
                plotOptions:{ pie:{ donut:{ size:'60%' } } },
                chart:{ toolbar:{ show:false } },
              }}
            />
          </Card>
        </Col>

        {/* Bar: Employees per Department */}
        <Col span={9}>
          <Card bordered={false} size="small" style={{ borderRadius:10, height:'100%' }}
            title={<Text strong style={{fontSize:12}}>عدد الموظفين بالقسم</Text>}>
            <ReactApexChart type="bar" height={180}
              series={[{
                name:'عدد الموظفين',
                data:[...new Set(EMPLOYEES.map(e=>e.department))].map(d=>EMPLOYEES.filter(e=>e.department===d).length),
              }]}
              options={{
                xaxis:{ categories:[...new Set(EMPLOYEES.map(e=>e.department))], labels:{ style:{ fontSize:'10px' } } },
                colors:['#1a5c2a'],
                plotOptions:{ bar:{ borderRadius:4, distributed:true, columnWidth:'55%' } },
                legend:{ show:false },
                dataLabels:{ enabled:true, style:{ fontSize:'10px' } },
                chart:{ toolbar:{ show:false } },
                yaxis:{ labels:{ formatter:(v:number)=>Math.round(v).toString() } },
              }}
            />
          </Card>
        </Col>

        {/* Bar: Salary Total by Department */}
        <Col span={9}>
          <Card bordered={false} size="small" style={{ borderRadius:10, height:'100%' }}
            title={<Text strong style={{fontSize:12}}>إجمالي الرواتب بالقسم (د.إ)</Text>}>
            <ReactApexChart type="bar" height={180}
              series={[{
                name:'إجمالي الرواتب',
                data:[...new Set(EMPLOYEES.map(e=>e.department))].map(dept => {
                  const emps = EMPLOYEES.filter(e=>e.department===dept);
                  return emps.reduce((sum,emp)=>{
                    const ss = getActiveSalary(emp.id);
                    return sum + (ss ? ss.basic+ss.housing+ss.transport+ss.other : 0);
                  }, 0);
                }),
              }]}
              options={{
                xaxis:{ categories:[...new Set(EMPLOYEES.map(e=>e.department))], labels:{ style:{ fontSize:'10px' } } },
                colors:['#c9a84c'],
                plotOptions:{ bar:{ borderRadius:4, distributed:true, columnWidth:'55%' } },
                legend:{ show:false },
                dataLabels:{ enabled:true, formatter:(v:number)=>(v/1000).toFixed(0)+'k', style:{ fontSize:'9px' } },
                chart:{ toolbar:{ show:false } },
                yaxis:{ labels:{ formatter:(v:number)=>(v/1000).toFixed(0)+'k' } },
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={14} style={{ marginBottom:14 }}>
        {/* Line: Monthly Payroll Trend */}
        <Col span={14}>
          <Card bordered={false} size="small" style={{ borderRadius:10 }}
            title={<Text strong style={{fontSize:12}}>تطور مدفوعات الرواتب (آخر 6 أشهر)</Text>}>
            {(() => {
              const months: string[] = [];
              for (let i = 5; i >= 0; i--) {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
              }
              const grossData = months.map(m => PAYROLL.filter(p=>p.month===m).reduce((s,p)=>s+p.gross,0));
              const netData   = months.map(m => PAYROLL.filter(p=>p.month===m).reduce((s,p)=>s+p.net,0));
              return (
                <ReactApexChart type="area" height={160}
                  series={[
                    { name:'إجمالي', data: grossData },
                    { name:'صافي',   data: netData },
                  ]}
                  options={{
                    xaxis:{ categories: months, labels:{ style:{ fontSize:'9px' } } },
                    colors:['#1a5c2a','#c9a84c'],
                    stroke:{ curve:'smooth', width:2 },
                    fill:{ type:'gradient', gradient:{ shadeIntensity:1, opacityFrom:0.3, opacityTo:0 } },
                    legend:{ position:'top', fontSize:'11px' },
                    dataLabels:{ enabled:false },
                    chart:{ toolbar:{ show:false } },
                    yaxis:{ labels:{ formatter:(v:number)=>(v/1000).toFixed(0)+'k' } },
                    tooltip:{ y:{ formatter:(v:number)=>v.toLocaleString()+' د.إ' } },
                  }}
                />
              );
            })()}
          </Card>
        </Col>

        {/* Nationality + Leave utilization stacked */}
        <Col span={10}>
          <Card bordered={false} size="small" style={{ borderRadius:10, height:'100%' }}
            title={<Text strong style={{fontSize:12}}>استخدام الإجازات (%)</Text>}>
            {(() => {
              const cats = ['سنوية','مرضية','طارئة'];
              const used  = EMPLOYEES.map(e=>[
                e.leave.annualUsed, e.leave.sickUsed, e.leave.emergencyUsed
              ]);
              const totals = EMPLOYEES.map(e=>[
                e.leave.annual, e.leave.sick, e.leave.emergency
              ]);
              const pct = (idx: number) => {
                const u = used.reduce((s,r)=>s+r[idx],0);
                const t = totals.reduce((s,r)=>s+r[idx],0);
                return t ? Math.round(u/t*100) : 0;
              };
              return (
                <ReactApexChart type="radialBar" height={180}
                  series={[pct(0), pct(1), pct(2)]}
                  options={{
                    labels: cats,
                    colors:['#1a5c2a','#1677ff','#fa8c16'],
                    plotOptions:{ radialBar:{ dataLabels:{ name:{ fontSize:'11px' }, value:{ fontSize:'11px' } }, hollow:{ size:'20%' } } },
                    legend:{ show:true, position:'bottom', fontSize:'10px' },
                    chart:{ toolbar:{ show:false } },
                  }}
                />
              );
            })()}
          </Card>
        </Col>
      </Row>

      <Card bordered={false} size="small" style={{ borderRadius:10, marginBottom:12 }}>
        <Space wrap>
          <Select value={filterDept} onChange={setFilterDept} style={{ width:160 }} size="small">
            <Option value="all">جميع الأقسام</Option>
            {departments.map(d => <Option key={d} value={d}>{d}</Option>)}
          </Select>
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width:130 }} size="small">
            <Option value="all">جميع الحالات</Option>
            <Option value="active">نشط</Option>
            <Option value="leave">في إجازة</Option>
            <Option value="terminated">منتهي</Option>
          </Select>
        </Space>
      </Card>
      {selectedRowKeys.length > 0 && (
        <Card bordered={false} style={{ borderRadius:8, background:'#e6f7ff', border:'1px solid #91caff', marginBottom:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Text strong>تم تحديد {selectedRowKeys.length} موظفين</Text>
            <Space>
              <Button onClick={() => setSelectedRowKeys([])}>إلغاء التحديد</Button>
              <Button type="primary" icon={<FileProtectOutlined />}
                style={{ background: PRIMARY }}
                onClick={() => { const now = new Date(); setBulkMonth(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`); setBulkPayrollOpen(true); }}>
                توليد رواتب وكشوف رواتب
              </Button>
            </Space>
          </div>
        </Card>
      )}
      <Card bordered={false} style={{ borderRadius:10 }}>
        <Table rowKey="id" size="small" pagination={{ pageSize:10 }} dataSource={filtered}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: emp => ({ name: emp.id }) }}
          onRow={emp => ({ onClick: () => { setSelected(emp); setDrawerOpen(true); }, style:{ cursor:'pointer' } })}
          columns={[
            { title:'الموظف', key:'name', render:(_,emp) => (
              <Space>
                <Avatar size={32} style={{ background: DEPT_COLORS[emp.department]||PRIMARY, fontWeight:700, fontSize:13 }}>{emp.name.charAt(0)}</Avatar>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{emp.name}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{emp.empNo}</div>
                </div>
              </Space>
            )},
            { title:'القسم', dataIndex:'department', render:(d:string) => <Tag color={DEPT_COLORS[d]||'default'} style={{fontSize:11}}>{d}</Tag> },
            { title:'المسمى', dataIndex:'position', render:(p:string) => <Text style={{fontSize:12}}>{p}</Text> },
            { title:'المستخدم', dataIndex:'username', render:(u:string) => <Tag color="purple" style={{fontFamily:'monospace',fontSize:11}}>{u}</Tag> },
            { title:'صافي الراتب', key:'net', render:(_,emp) => {
              const ss = getActiveSalary(emp.id);
          const net = ss ? (ss.basic + ss.housing + ss.transport + ss.other - ss.deductions) : 0;
              return <Text strong style={{color: PRIMARY}}>{net.toLocaleString()} د</Text>;
            }},
            { title:'الإجازة السنوية', key:'leave', render:(_,emp) => {
              const rem = emp.leave.annual - emp.leave.annualUsed;
              return <Tag color={rem>0?'blue':'orange'}>{rem} يوم متبقي</Tag>;
            }},
            { title:'الوثائق', key:'docs', render:(_,emp) => {
              const exp = EMP_DOCS.filter(d=>d.empId===emp.id && new Date(d.expiryDate)<today).length;
              return exp > 0 ? <Tag color="red" icon={<AlertOutlined />}>{exp} منتهي</Tag> : <Tag color="green">سارية</Tag>;
            }},
            { title:'الحالة', dataIndex:'status', render:(s:string) => (
              <Tag color={s==='active'?'green':s==='leave'?'orange':'red'}>
                {s==='active'?'نشط':s==='leave'?'إجازة':'منتهي'}
              </Tag>
            )},
          ]}
        />
      </Card>
      <EmployeeDrawer employee={selected} open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelected(null); }} />

      <BulkPayrollModal
        open={bulkPayrollOpen}
        employeeIds={selectedRowKeys as string[]}
        month={bulkMonth}
        onMonthChange={setBulkMonth}
        deductions={bulkDeductions}
        onDeductionsChange={setBulkDeductions}
        onClose={() => setBulkPayrollOpen(false)}
        onGenerated={() => { setSelectedRowKeys([]); setBulkPayrollOpen(false); setBulkRev(r => r + 1); }}
      />
    </div>
  );
};

export default EmployeesPage;
