import React, { useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space,
  Avatar, Drawer, Descriptions, Modal, Form, Input, Select,
  Alert, Divider, Tooltip, Switch, Badge, Tabs, Progress, Timeline,
} from 'antd';
import {
  UserOutlined, PlusOutlined, LockOutlined, UnlockOutlined,
  EditOutlined, DeleteOutlined, KeyOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  TeamOutlined, SettingOutlined, EyeOutlined, PrinterOutlined,
  HistoryOutlined, ShieldOutlined, LoginOutlined, LogoutOutlined,
  MailOutlined, PhoneOutlined, BankOutlined, CalendarOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Permission { module: string; view: boolean; create: boolean; edit: boolean; delete: boolean; }
interface Role {
  id: string; name: string; nameAr: string; description: string;
  color: string; permissions: Permission[]; usersCount?: number;
}
interface SystemUser {
  id: string; name: string; email: string; phone: string;
  department: string; position: string; roleIds: string[];
  status: 'active' | 'inactive' | 'locked' | 'pending';
  lastLogin?: string; lastLoginIP?: string;
  createdAt: string; avatar?: string; twoFA: boolean;
  loginCount: number;
}
interface ActivityLog {
  id: string; userId: string; action: string; module: string;
  timestamp: string; ip: string; status: 'success' | 'failed' | 'warning';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MODULES = ['لوحة التحكم','المباني','العملاء','العقود','الفواتير','المدفوعات','الموظفين','المركبات','الأصول','التقارير','المستخدمين','الإعدادات'];

const mkPerm = (module: string, v=true, c=false, e=false, d=false): Permission => ({ module, view:v, create:c, edit:e, delete:d });

const ROLES: Role[] = [
  {
    id:'R01', name:'Super Admin', nameAr:'مدير النظام', description:'صلاحية كاملة على جميع الوحدات', color:'#ff4d4f',
    permissions: MODULES.map(m => ({ module:m, view:true, create:true, edit:true, delete:true })),
  },
  {
    id:'R02', name:'Admin', nameAr:'مدير', description:'إدارة العمليات اليومية بدون حذف', color:'#fa8c16',
    permissions: MODULES.map(m => mkPerm(m,true,true,true,false)),
  },
  {
    id:'R03', name:'Accountant', nameAr:'محاسب', description:'الفواتير والمدفوعات والتقارير المالية', color:'#1890ff',
    permissions: ['لوحة التحكم','الفواتير','المدفوعات','التقارير'].map(m=>mkPerm(m,true,true,true,false))
      .concat(MODULES.filter(m=>!['لوحة التحكم','الفواتير','المدفوعات','التقارير'].includes(m)).map(m=>mkPerm(m,true))),
  },
  {
    id:'R04', name:'Operations', nameAr:'عمليات', description:'متابعة العقود وطلبات الخدمة والصيانة', color:'#52c41a',
    permissions: ['لوحة التحكم','المباني','العملاء','العقود'].map(m=>mkPerm(m,true,true,true,false))
      .concat(MODULES.filter(m=>!['لوحة التحكم','المباني','العملاء','العقود'].includes(m)).map(m=>mkPerm(m,true))),
  },
  {
    id:'R05', name:'Viewer', nameAr:'مشاهد', description:'قراءة فقط لجميع الوحدات', color:'#999',
    permissions: MODULES.map(m=>mkPerm(m,true)),
  },
  {
    id:'R06', name:'HR', nameAr:'موارد بشرية', description:'إدارة الموظفين والرواتب', color:'#722ed1',
    permissions: ['لوحة التحكم','الموظفين','التقارير'].map(m=>mkPerm(m,true,true,true,false))
      .concat(MODULES.filter(m=>!['لوحة التحكم','الموظفين','التقارير'].includes(m)).map(m=>mkPerm(m,true))),
  },
];

const USERS: SystemUser[] = [
  { id:'U01', name:'أحمد محمد الراشدي', email:'ahmed@binsidra.ae', phone:'+971501234567', department:'الإدارة', position:'مدير عام', roleIds:['R01'], status:'active', lastLogin:'2026-09-24 09:15', lastLoginIP:'192.168.1.10', createdAt:'2023-01-01', twoFA:true, loginCount:412 },
  { id:'U02', name:'سارة خالد المنصوري', email:'sara@binsidra.ae', phone:'+971502345678', department:'المالية', position:'مدير مالي', roleIds:['R02','R03'], status:'active', lastLogin:'2026-09-24 08:45', lastLoginIP:'192.168.1.22', createdAt:'2023-03-15', twoFA:true, loginCount:287 },
  { id:'U03', name:'خالد سعيد النعيمي', email:'khaled@binsidra.ae', phone:'+971503456789', department:'العمليات', position:'مدير عمليات', roleIds:['R04'], status:'active', lastLogin:'2026-09-23 17:30', lastLoginIP:'10.0.0.5', createdAt:'2023-02-10', twoFA:false, loginCount:341 },
  { id:'U04', name:'فاطمة علي الكعبي', email:'fatima@binsidra.ae', phone:'+971504567890', department:'المحاسبة', position:'محاسبة', roleIds:['R03'], status:'active', lastLogin:'2026-09-24 10:00', lastLoginIP:'192.168.1.35', createdAt:'2023-06-01', twoFA:true, loginCount:198 },
  { id:'U05', name:'محمد ناصر الحمادي', email:'moh@binsidra.ae', phone:'+971505678901', department:'الموارد البشرية', position:'مدير HR', roleIds:['R06'], status:'active', lastLogin:'2026-09-22 14:20', lastLoginIP:'10.0.0.8', createdAt:'2023-08-20', twoFA:true, loginCount:156 },
  { id:'U06', name:'نورة سلطان الظاهري', email:'noura@binsidra.ae', phone:'+971506789012', department:'الإدارة', position:'مساعدة إدارية', roleIds:['R05'], status:'active', lastLogin:'2026-09-24 11:00', lastLoginIP:'192.168.2.10', createdAt:'2024-01-10', twoFA:false, loginCount:89 },
  { id:'U07', name:'عمر فيصل الشحي', email:'omar@binsidra.ae', phone:'+971507890123', department:'تقنية المعلومات', position:'مطور نظام', roleIds:['R02'], status:'inactive', lastLogin:'2026-09-10 09:00', lastLoginIP:'10.0.0.12', createdAt:'2023-11-05', twoFA:true, loginCount:203 },
  { id:'U08', name:'ريم جاسم الكندي', email:'reem@binsidra.ae', phone:'+971508901234', department:'العمليات', position:'مشرف عمليات', roleIds:['R04'], status:'pending', createdAt:'2026-09-20', twoFA:false, loginCount:0 },
  { id:'U09', name:'يوسف علي الشامسي', email:'yousuf@binsidra.ae', phone:'+971509012345', department:'المالية', position:'مراجع داخلي', roleIds:['R03','R05'], status:'locked', lastLogin:'2026-09-15 13:45', lastLoginIP:'10.0.1.5', createdAt:'2024-03-01', twoFA:false, loginCount:45 },
  { id:'U10', name:'مريم حمد الزعابي', email:'mariam@binsidra.ae', phone:'+971500123456', department:'الموارد البشرية', position:'أخصائية HR', roleIds:['R06'], status:'active', lastLogin:'2026-09-23 16:00', lastLoginIP:'192.168.1.50', createdAt:'2024-05-15', twoFA:true, loginCount:67 },
];

// Add role usersCount
ROLES.forEach(r => { r.usersCount = USERS.filter(u=>u.roleIds.includes(r.id)).length; });

const ACTIVITY_LOGS: ActivityLog[] = [
  { id:'L01', userId:'U01', action:'تسجيل دخول', module:'النظام', timestamp:'2026-09-24 09:15', ip:'192.168.1.10', status:'success' },
  { id:'L02', userId:'U04', action:'إنشاء فاتورة', module:'الفواتير', timestamp:'2026-09-24 09:30', ip:'192.168.1.35', status:'success' },
  { id:'L03', userId:'U09', action:'محاولة تسجيل دخول', module:'النظام', timestamp:'2026-09-24 08:00', ip:'10.0.1.5', status:'failed' },
  { id:'L04', userId:'U02', action:'تعديل عقد', module:'العقود', timestamp:'2026-09-24 08:45', ip:'192.168.1.22', status:'success' },
  { id:'L05', userId:'U03', action:'حذف طلب خدمة', module:'العمليات', timestamp:'2026-09-23 17:00', ip:'10.0.0.5', status:'warning' },
  { id:'L06', userId:'U07', action:'محاولة الوصول لصفحة محظورة', module:'الإعدادات', timestamp:'2026-09-23 12:00', ip:'10.0.0.12', status:'failed' },
  { id:'L07', userId:'U05', action:'تعديل بيانات موظف', module:'الموظفين', timestamp:'2026-09-22 14:20', ip:'10.0.0.8', status:'success' },
  { id:'L08', userId:'U06', action:'تسجيل دخول', module:'النظام', timestamp:'2026-09-24 11:00', ip:'192.168.2.10', status:'success' },
  { id:'L09', userId:'U10', action:'إنشاء تقرير', module:'التقارير', timestamp:'2026-09-23 16:00', ip:'192.168.1.50', status:'success' },
  { id:'L10', userId:'U01', action:'إضافة مستخدم', module:'المستخدمين', timestamp:'2026-09-20 11:00', ip:'192.168.1.10', status:'success' },
];

const STATUS_MAP: Record<string, {label:string; color:string}> = {
  active:   { label:'نشط',         color:'green' },
  inactive: { label:'غير نشط',     color:'default' },
  locked:   { label:'مقفل',        color:'red' },
  pending:  { label:'قيد التفعيل', color:'orange' },
};

// ─── User Drawer ──────────────────────────────────────────────────────────────
const UserDrawer: React.FC<{ user: SystemUser | null; open: boolean; onClose: () => void; onEdit: (u: SystemUser) => void }> = ({ user, open, onClose, onEdit }) => {
  if (!user) return null;
  const u = user;
  const userRoles = ROLES.filter(r => u.roleIds.includes(r.id));
  const userLogs  = ACTIVITY_LOGS.filter(l => l.userId === u.id).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const allPerms  = Array.from(new Set(userRoles.flatMap(r=>r.permissions.map(p=>p.module))));

  // Merge permissions across roles (OR logic)
  const mergedPerms = MODULES.map(m => {
    const plist = userRoles.flatMap(r => r.permissions.filter(p=>p.module===m));
    return {
      module: m,
      view:   plist.some(p=>p.view),
      create: plist.some(p=>p.create),
      edit:   plist.some(p=>p.edit),
      delete: plist.some(p=>p.delete),
    };
  }).filter(p => p.view);
  void allPerms;

  const tabItems = [
    {
      key: 'info',
      label: <Space><UserOutlined />معلومات شخصية</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card size="small" bordered={false} style={{ borderRadius:10, background:'linear-gradient(135deg,#f0f9f2,#e8f5e9)', border:'1px solid #c8e6c9' }}>
            <Row gutter={12} align="middle">
              <Col>
                <Avatar size={56} style={{ background:PRIMARY, fontSize:20 }}>
                  {u.name.charAt(0)}
                </Avatar>
              </Col>
              <Col flex={1}>
                <div style={{ fontSize:15, fontWeight:700 }}>{u.name}</div>
                <div style={{ fontSize:12, color:'#555' }}>{u.position} · {u.department}</div>
                <Space style={{ marginTop:4 }} wrap>
                  {userRoles.map(r=><Tag key={r.id} color={r.color} style={{fontSize:10}}>{r.nameAr}</Tag>)}
                  <Tag color={STATUS_MAP[u.status].color}>{STATUS_MAP[u.status].label}</Tag>
                </Space>
              </Col>
              <Col style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#888' }}>جلسات الدخول</div>
                <div style={{ fontWeight:700, fontSize:18, color:PRIMARY }}>{u.loginCount}</div>
              </Col>
            </Row>
          </Card>

          <Row gutter={10}>
            {[
              { label:'2FA', value: u.twoFA ? 'مفعل' : 'غير مفعل', color: u.twoFA?'#52c41a':'#ff4d4f' },
              { label:'آخر دخول', value: u.lastLogin?.split(' ')[0] || '-', color:'#333' },
              { label:'عدد الصلاحيات', value: userRoles.flatMap(r=>r.permissions).filter(p=>p.create||p.edit||p.delete).length, color:PRIMARY },
            ].map((s,i)=>(
              <Col span={8} key={i}>
                <Card size="small" bordered={false} style={{ textAlign:'center', background:'#f9fafb', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'#888' }}>{s.label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:s.color }}>{s.value}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Descriptions size="small" column={2} bordered style={{ borderRadius:8 }}>
            <Descriptions.Item label={<Space><MailOutlined/>البريد</Space>} span={2}><Text copyable style={{fontSize:12}}>{u.email}</Text></Descriptions.Item>
            <Descriptions.Item label={<Space><PhoneOutlined/>الهاتف</Space>}>{u.phone}</Descriptions.Item>
            <Descriptions.Item label={<Space><BankOutlined/>القسم</Space>}>{u.department}</Descriptions.Item>
            <Descriptions.Item label={<Space><CalendarOutlined/>تاريخ الإنشاء</Space>}>{u.createdAt}</Descriptions.Item>
            <Descriptions.Item label="آخر إيبي">{u.lastLoginIP || '-'}</Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'permissions',
      label: <Space><KeyOutlined />الصلاحيات</Space>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <Alert message={`الصلاحيات من الأدوار: ${userRoles.map(r=>r.nameAr).join('، ')}`} type="info" showIcon style={{fontSize:11}} />
          <Table
            size="small"
            dataSource={mergedPerms}
            rowKey="module"
            pagination={false}
            columns={[
              { title:'الوحدة', dataIndex:'module', key:'module', render:(v:string)=><Text style={{fontSize:12}}>{v}</Text> },
              { title:'عرض', dataIndex:'view',   key:'view',   width:55, render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#52c41a'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
              { title:'إضافة', dataIndex:'create', key:'create', width:55, render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#1890ff'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
              { title:'تعديل', dataIndex:'edit',   key:'edit',   width:55, render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#fa8c16'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
              { title:'حذف', dataIndex:'delete', key:'delete', width:55, render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#ff4d4f'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'activity',
      label: <Space><HistoryOutlined />سجل النشاط</Space>,
      children: (
        <div>
          {userLogs.length === 0 ? <Alert message="لا يوجد سجل نشاط" type="info" showIcon /> :
            <Timeline mode="right" items={userLogs.map(l => ({
              color: l.status==='success'?'green':l.status==='failed'?'red':'orange',
              label: <Text style={{fontSize:10}}>{l.timestamp}</Text>,
              children: (
                <div>
                  <Space>
                    <Tag color={l.status==='success'?'green':l.status==='failed'?'red':'orange'} style={{fontSize:10}}>
                      {l.status==='success'?'نجاح':l.status==='failed'?'فشل':'تحذير'}
                    </Tag>
                    <Text style={{fontSize:12}}>{l.action}</Text>
                    <Tag style={{fontSize:10}}>{l.module}</Tag>
                  </Space>
                  <div style={{fontSize:10, color:'#888'}}>{l.ip}</div>
                </div>
              ),
            }))} />
          }
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open} onClose={onClose} width={560}
      title={<Space><Avatar size="small" style={{background:PRIMARY}}>{u.name.charAt(0)}</Avatar><span>{u.name}</span></Space>}
      extra={<Space>
        <Button size="small" icon={<EditOutlined />} onClick={()=>onEdit(u)}>تعديل</Button>
        <Button size="small" icon={<PrinterOutlined />}>طباعة</Button>
      </Space>}
    >
      <Tabs items={tabItems} size="small" />
    </Drawer>
  );
};

// ─── Role Card ────────────────────────────────────────────────────────────────
const RoleCard: React.FC<{ role: Role; onClick: () => void }> = ({ role, onClick }) => (
  <Card
    size="small" bordered={false} hoverable onClick={onClick}
    style={{ borderRadius:12, border:`2px solid ${role.color}22`, background:`${role.color}08`, cursor:'pointer' }}
  >
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
      <Space>
        <Avatar size="small" style={{ background:role.color, fontSize:12 }}><SafetyCertificateOutlined /></Avatar>
        <Text strong style={{ fontSize:13 }}>{role.nameAr}</Text>
      </Space>
      <Badge count={role.usersCount} style={{ background:role.color }} />
    </div>
    <div style={{ fontSize:11, color:'#555', marginBottom:8 }}>{role.description}</div>
    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
      {role.permissions.filter(p=>p.create||p.edit||p.delete).slice(0,4).map(p=>(
        <Tag key={p.module} style={{ fontSize:9, margin:0 }}>{p.module}</Tag>
      ))}
      {role.permissions.filter(p=>p.create||p.edit||p.delete).length > 4 &&
        <Tag style={{fontSize:9, margin:0}}>+{role.permissions.filter(p=>p.create||p.edit||p.delete).length-4}</Tag>
      }
    </div>
  </Card>
);

// ─── Role Detail Modal ────────────────────────────────────────────────────────
const RoleDetailModal: React.FC<{ role: Role | null; open: boolean; onClose: () => void }> = ({ role, open, onClose }) => {
  if (!role) return null;
  return (
    <Modal open={open} onCancel={onClose} footer={<Button onClick={onClose}>إغلاق</Button>} width={680}
      title={<Space><SafetyCertificateOutlined style={{color:role.color}} /><span style={{color:role.color}}>{role.nameAr}</span><Text type="secondary" style={{fontSize:12}}>({role.name})</Text></Space>}
    >
      <Alert message={role.description} type="info" showIcon style={{marginBottom:14}} />
      <Table
        size="small"
        dataSource={role.permissions}
        rowKey="module"
        pagination={false}
        columns={[
          { title:'الوحدة', dataIndex:'module', key:'module' },
          { title:<Space><EyeOutlined/>عرض</Space>, dataIndex:'view', key:'view', width:70,
            render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#52c41a'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
          { title:<Space><PlusOutlined/>إضافة</Space>, dataIndex:'create', key:'create', width:70,
            render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#1890ff'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
          { title:<Space><EditOutlined/>تعديل</Space>, dataIndex:'edit', key:'edit', width:70,
            render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#fa8c16'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
          { title:<Space><DeleteOutlined/>حذف</Space>, dataIndex:'delete', key:'delete', width:70,
            render:(v:boolean)=>v?<CheckCircleOutlined style={{color:'#ff4d4f'}}/>:<CloseCircleOutlined style={{color:'#ddd'}}/> },
        ]}
        rowClassName={(r)=>r.create||r.edit||r.delete?'':'ant-table-row-disabled'}
      />
      <Divider />
      <Text type="secondary" style={{fontSize:12}}>
        المستخدمون بهذا الدور: {USERS.filter(u=>u.roleIds.includes(role.id)).map(u=>u.name).join(' • ')||'لا يوجد'}
      </Text>
    </Modal>
  );
};

// ─── Main Users Page ─────────────────────────────────────────────────────────
const UsersPage: React.FC = () => {
  const [selUser, setSelUser] = useState<SystemUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selRole, setSelRole] = useState<Role | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [rev, setRev] = useState(0);
  void rev;

  const depts = [...new Set(USERS.map(u => u.department))];
  const filtered = USERS.filter(u =>
    (!filterStatus || u.status === filterStatus) &&
    (!filterRole   || u.roleIds.includes(filterRole)) &&
    (!filterDept   || u.department === filterDept)
  );

  // Stats
  const active   = USERS.filter(u=>u.status==='active').length;
  const inactive = USERS.filter(u=>u.status==='inactive').length;
  const locked   = USERS.filter(u=>u.status==='locked').length;
  const pending  = USERS.filter(u=>u.status==='pending').length;
  const with2FA  = USERS.filter(u=>u.twoFA).length;
  const admins   = USERS.filter(u=>u.roleIds.includes('R01')||u.roleIds.includes('R02')).length;

  // Chart: role distribution
  const roleChartSeries = ROLES.map(r=>r.usersCount||0);
  const roleChartOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
    labels: ROLES.map(r=>r.nameAr),
    colors: ROLES.map(r=>r.color),
    legend: { position:'bottom', fontSize:'11px' },
    dataLabels: { enabled:true, formatter:(v:number)=>v.toFixed(0) },
  };

  // Chart: status distribution
  const statusSeries = [active, inactive, locked, pending];
  const statusOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
    labels: ['نشط','غير نشط','مقفل','قيد التفعيل'],
    colors: ['#52c41a','#aaa','#ff4d4f','#fa8c16'],
    plotOptions: { pie: { donut: { size:'60%' } } },
    legend: { position:'bottom', fontSize:'11px' },
    dataLabels: { formatter:(v:number)=>v.toFixed(0) },
  };

  // Chart: logins by user (top 6)
  const topUsers = [...USERS].sort((a,b)=>b.loginCount-a.loginCount).slice(0,6);
  const loginBarOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
    xaxis: { categories: topUsers.map(u=>u.name.split(' ')[0]+' '+u.name.split(' ')[1]), labels:{style:{fontSize:'10px'}} },
    colors: [PRIMARY],
    plotOptions: { bar: { borderRadius:6, columnWidth:'55%' } },
    dataLabels: { enabled:false },
    yaxis: { title:{ text:'عدد الجلسات' } },
  };

  // Chart: activity log status pie
  const logSuccess = ACTIVITY_LOGS.filter(l=>l.status==='success').length;
  const logFailed  = ACTIVITY_LOGS.filter(l=>l.status==='failed').length;
  const logWarn    = ACTIVITY_LOGS.filter(l=>l.status==='warning').length;
  const activityOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif' },
    labels: ['نجاح','فشل','تحذير'],
    colors: ['#52c41a','#ff4d4f','#fa8c16'],
    plotOptions: { radialBar: { hollow:{size:'40%'}, dataLabels:{ name:{fontSize:'11px'}, value:{fontSize:'18px',fontWeight:700} } } },
  };

  // Chart: dept user count
  const deptMap: Record<string,number> = {};
  USERS.forEach(u=>{ deptMap[u.department]=(deptMap[u.department]||0)+1; });
  const deptBarOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif', toolbar:{show:false} },
    xaxis: { categories: Object.keys(deptMap), labels:{style:{fontSize:'10px'}} },
    colors: [GOLD],
    plotOptions: { bar: { borderRadius:6, horizontal:true } },
    dataLabels: { enabled:true },
  };

  // Chart: 2FA adoption radial
  const twoFAPct = Math.round((with2FA/USERS.length)*100);
  const twoFAOpts: ApexCharts.ApexOptions = {
    chart: { fontFamily:'Tajawal,sans-serif' },
    labels: ['تفعيل 2FA'],
    colors: ['#52c41a'],
    plotOptions: { radialBar: { hollow:{size:'60%'}, dataLabels:{ name:{fontSize:'13px'}, value:{fontSize:'26px',fontWeight:700} } } },
  };

  const userColumns = [
    { title:'المستخدم', key:'name', render:(_:any, r:SystemUser)=>
        <Space>
          <Avatar size={32} style={{background:PRIMARY,fontSize:13}}>{r.name.charAt(0)}</Avatar>
          <div>
            <div style={{fontSize:12,fontWeight:600}}>{r.name}</div>
            <div style={{fontSize:10,color:'#888'}}>{r.email}</div>
          </div>
        </Space>
    },
    { title:'القسم', dataIndex:'department', key:'dept', render:(v:string)=><Text style={{fontSize:12}}>{v}</Text> },
    { title:'الأدوار', key:'roles', render:(_:any,r:SystemUser)=>
        <Space wrap>{ROLES.filter(ro=>r.roleIds.includes(ro.id)).map(ro=><Tag key={ro.id} color={ro.color} style={{fontSize:10}}>{ro.nameAr}</Tag>)}</Space>
    },
    { title:'الحالة', dataIndex:'status', key:'status', render:(v:string)=><Tag color={STATUS_MAP[v].color}>{STATUS_MAP[v].label}</Tag> },
    { title:'2FA', dataIndex:'twoFA', key:'twofa', render:(v:boolean)=><Tag color={v?'green':'default'}>{v?'مفعل':'معطل'}</Tag> },
    { title:'آخر دخول', dataIndex:'lastLogin', key:'lastLogin', render:(v?:string)=><Text style={{fontSize:11}}>{v?.split(' ')[0]||'-'}</Text> },
    { title:'إجراءات', key:'act', render:(_:any,r:SystemUser)=>
        <Space size={4}>
          <Tooltip title="التفاصيل"><Button size="small" icon={<EyeOutlined/>} onClick={()=>{setSelUser(r);setDrawerOpen(true);}}/></Tooltip>
          <Tooltip title="تعديل"><Button size="small" icon={<EditOutlined/>} onClick={()=>{setSelUser(r);editForm.setFieldsValue({...r,roleIds:r.roleIds});setEditOpen(true);}}/></Tooltip>
          <Tooltip title={r.status==='locked'?'إلغاء القفل':'قفل'}>
            <Button size="small" danger={r.status!=='locked'} icon={r.status==='locked'?<UnlockOutlined/>:<LockOutlined/>}
              onClick={()=>{ r.status = r.status==='locked'?'active':'locked'; setRev(x=>x+1); }} />
          </Tooltip>
        </Space>
    },
  ];

  const logColumns = [
    { title:'المستخدم', key:'user', render:(_:any,r:ActivityLog)=>{const u=USERS.find(x=>x.id===r.userId); return <Text style={{fontSize:12}}>{u?.name||r.userId}</Text>;} },
    { title:'الإجراء', dataIndex:'action', key:'action', render:(v:string)=><Text style={{fontSize:12}}>{v}</Text> },
    { title:'الوحدة', dataIndex:'module', key:'module', render:(v:string)=><Tag style={{fontSize:10}}>{v}</Tag> },
    { title:'الوقت', dataIndex:'timestamp', key:'ts', render:(v:string)=><Text style={{fontSize:11}}>{v}</Text> },
    { title:'الإيبي', dataIndex:'ip', key:'ip', render:(v:string)=><Text code style={{fontSize:10}}>{v}</Text> },
    { title:'النتيجة', dataIndex:'status', key:'status', render:(v:string)=>
        <Tag color={v==='success'?'green':v==='failed'?'red':'orange'}>{v==='success'?'نجاح':v==='failed'?'فشل':'تحذير'}</Tag>
    },
  ];

  const mainTabs = [
    {
      key: 'users',
      label: <Space><TeamOutlined />المستخدمون</Space>,
      children: (
        <Card bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}}>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <Select placeholder="فلتر: الحالة" allowClear style={{minWidth:130}} onChange={v=>setFilterStatus(v||'')}>
              {Object.entries(STATUS_MAP).map(([k,v])=><Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Select placeholder="فلتر: الدور" allowClear style={{minWidth:130}} onChange={v=>setFilterRole(v||'')}>
              {ROLES.map(r=><Option key={r.id} value={r.id}>{r.nameAr}</Option>)}
            </Select>
            <Select placeholder="فلتر: القسم" allowClear style={{minWidth:140}} onChange={v=>setFilterDept(v||'')}>
              {depts.map(d=><Option key={d} value={d}>{d}</Option>)}
            </Select>
            <Text type="secondary" style={{lineHeight:'32px',fontSize:12,marginRight:'auto'}}>{filtered.length} من {USERS.length} مستخدم</Text>
          </div>
          <Table dataSource={filtered} rowKey="id" columns={userColumns} size="small"
            scroll={{x:true}} pagination={{pageSize:8}}
            onRow={r=>({onClick:()=>{setSelUser(r);setDrawerOpen(true);}, style:{cursor:'pointer'}})} />
        </Card>
      ),
    },
    {
      key: 'roles',
      label: <Space><SafetyCertificateOutlined />الأدوار والصلاحيات</Space>,
      children: (
        <div>
          <Row gutter={[14,14]}>
            {ROLES.map(r=>(
              <Col key={r.id} xs={24} md={12} lg={8}>
                <RoleCard role={r} onClick={()=>{setSelRole(r);setRoleModalOpen(true);}} />
              </Col>
            ))}
          </Row>
          <Divider />
          <Alert
            message="مصفوفة الصلاحيات الكاملة"
            description={
              <Table size="small"
                dataSource={MODULES.map(m=>({ module:m, ...Object.fromEntries(ROLES.map(r=>{ const p=r.permissions.find(p=>p.module===m); return [r.id, p?[p.view&&'ع',p.create&&'إ',p.edit&&'ت',p.delete&&'ح'].filter(Boolean).join('/'):'-']; })) }))}
                rowKey="module" pagination={false}
                columns={[
                  { title:'الوحدة', dataIndex:'module', key:'module', render:(v:string)=><Text style={{fontSize:11}}>{v}</Text> },
                  ...ROLES.map(r=>({ title:<Tag color={r.color} style={{fontSize:9}}>{r.nameAr}</Tag>, dataIndex:r.id, key:r.id, width:80, render:(v:string)=><Text style={{fontSize:10,fontFamily:'monospace'}}>{v}</Text> }))
                ]}
              />
            }
            type="info" style={{marginTop:14}}
          />
        </div>
      ),
    },
    {
      key: 'activity',
      label: <Space><HistoryOutlined />سجل النشاط</Space>,
      children: (
        <Card bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}}>
          <Row gutter={[14,14]} style={{marginBottom:14}}>
            <Col xs={24} md={8}>
              <Card size="small" bordered={false} style={{borderRadius:10, background:'#f9fafb'}}>
                <div style={{textAlign:'center', padding:'8px 0'}}>
                  <ReactApexChart type="radialBar" series={[Math.round(logSuccess/ACTIVITY_LOGS.length*100)]} options={activityOpts} height={160} />
                  <Row gutter={4} justify="center">
                    {[{label:'نجاح',v:logSuccess,c:'green'},{label:'فشل',v:logFailed,c:'red'},{label:'تحذير',v:logWarn,c:'orange'}].map((s,i)=>(
                      <Col key={i}><Tag color={s.c} style={{fontSize:10}}>{s.label}: {s.v}</Tag></Col>
                    ))}
                  </Row>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={16}>
              <Table dataSource={ACTIVITY_LOGS} rowKey="id" columns={logColumns} size="small"
                scroll={{x:true}} pagination={{pageSize:6}} />
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding:20, direction:'rtl', fontFamily:'Tajawal,sans-serif', minHeight:'100vh', background:'#f5f7fa' }}>
      {/* Header */}
      <div style={{ marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
        <div>
          <Title level={3} style={{ margin:0, color:PRIMARY }}><TeamOutlined /> إدارة المستخدمين والصلاحيات</Title>
          <Text type="secondary">متابعة حسابات المستخدمين وأدوارهم وسجلات الدخول</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={()=>setAddOpen(true)} style={{background:PRIMARY}}>
          إضافة مستخدم
        </Button>
      </div>

      {/* Stat Cards */}
      <Row gutter={[12,12]} style={{ marginBottom:20 }}>
        {[
          { label:'إجمالي المستخدمين', value:USERS.length, icon:<TeamOutlined/>, color:PRIMARY },
          { label:'نشط', value:active, icon:<CheckCircleOutlined/>, color:'#52c41a' },
          { label:'غير نشط', value:inactive, icon:<ClockCircleOutlined/>, color:'#999' },
          { label:'مقفل', value:locked, icon:<LockOutlined/>, color:'#ff4d4f' },
          { label:'قيد التفعيل', value:pending, icon:<ClockCircleOutlined/>, color:'#fa8c16' },
          { label:'مديرون', value:admins, icon:<ShieldOutlined/>, color:'#722ed1' },
          { label:'2FA مفعل', value:with2FA, icon:<SafetyCertificateOutlined/>, color:'#13c2c2' },
          { label:'عدد الأدوار', value:ROLES.length, icon:<KeyOutlined/>, color:GOLD },
        ].map((s,i)=>(
          <Col key={i} xs={12} sm={6} md={3}>
            <Card size="small" bordered={false} style={{borderRadius:12, textAlign:'center', background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}}>
              <div style={{fontSize:22, color:s.color}}>{s.icon}</div>
              <div style={{fontSize:22, fontWeight:700, color:s.color}}>{s.value}</div>
              <div style={{fontSize:10, color:'#888'}}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[14,14]} style={{marginBottom:14}}>
        <Col xs={24} md={6}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>توزيع الأدوار</Text>}>
            <ReactApexChart type="donut" series={roleChartSeries} options={roleChartOpts} height={220} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>حالة المستخدمين</Text>}>
            <ReactApexChart type="donut" series={statusSeries} options={statusOpts} height={220} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>عدد جلسات الدخول (أكثر نشاطاً)</Text>}>
            <ReactApexChart type="bar" series={[{name:'جلسات',data:topUsers.map(u=>u.loginCount)}]} options={loginBarOpts} height={220} />
          </Card>
        </Col>
        <Col xs={24} md={4}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>نسبة 2FA</Text>}>
            <ReactApexChart type="radialBar" series={[twoFAPct]} options={twoFAOpts} height={180} />
            <div style={{textAlign:'center',marginTop:4}}>
              <Text style={{fontSize:11}}>{with2FA} / {USERS.length} مستخدم</Text>
            </div>
            {twoFAPct < 70 && <Alert message="يُنصح تفعيل 2FA لجميع المستخدمين" type="warning" showIcon style={{fontSize:10,marginTop:6}} />}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[14,14]} style={{marginBottom:20}}>
        <Col xs={24} md={10}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>المستخدمون حسب القسم</Text>}>
            <ReactApexChart type="bar" series={[{name:'مستخدمين',data:Object.values(deptMap)}]} options={deptBarOpts} height={200} />
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card size="small" bordered={false} style={{borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}} title={<Text style={{fontSize:12,fontWeight:600}}>آخر نشاطات النظام</Text>}>
            <Timeline mode="right" style={{maxHeight:200,overflowY:'auto'}}
              items={ACTIVITY_LOGS.slice(0,7).map(l=>{
                const u=USERS.find(x=>x.id===l.userId);
                return {
                  color: l.status==='success'?'green':l.status==='failed'?'red':'orange',
                  label: <Text style={{fontSize:10}}>{l.timestamp.split(' ')[1]}</Text>,
                  children: <Space size={4}><Text style={{fontSize:11,fontWeight:600}}>{u?.name.split(' ')[0]}</Text><Tag style={{fontSize:9}}>{l.action}</Tag><Tag color={l.status==='success'?'green':'red'} style={{fontSize:9}}>{l.status==='success'?'نجاح':'فشل'}</Tag></Space>,
                };
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={mainTabs} />

      {/* Add User Modal */}
      <Modal open={addOpen} title={<Space><PlusOutlined />إضافة مستخدم جديد</Space>}
        onCancel={()=>{setAddOpen(false);addForm.resetFields();}}
        onOk={()=>addForm.validateFields().then(vals=>{
          USERS.push({ id:'U'+Date.now(), name:vals.name, email:vals.email, phone:vals.phone||'',
            department:vals.department, position:vals.position||'', roleIds:vals.roleIds||['R05'],
            status:'pending', createdAt:new Date().toISOString().slice(0,10), twoFA:false, loginCount:0 });
          setRev(r=>r+1); setAddOpen(false); addForm.resetFields();
        })}
        width={560} okText="حفظ" cancelText="إلغاء"
      >
        <Form form={addForm} layout="vertical">
          <Row gutter={12}>
            <Col span={14}><Form.Item name="name" label="الاسم الكامل" rules={[{required:true}]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="position" label="المسمى الوظيفي"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}><Form.Item name="email" label="البريد الإلكتروني" rules={[{required:true,type:'email'}]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="phone" label="رقم الهاتف"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="department" label="القسم" rules={[{required:true}]}>
              <Select>{depts.map(d=><Option key={d} value={d}>{d}</Option>)}<Option value="قسم جديد">قسم جديد</Option></Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="roleIds" label="الأدوار" rules={[{required:true}]}>
              <Select mode="multiple">{ROLES.map(r=><Option key={r.id} value={r.id}><Tag color={r.color} style={{fontSize:10}}>{r.nameAr}</Tag></Option>)}</Select>
            </Form.Item></Col>
          </Row>
          <Form.Item name="twoFA" label="" valuePropName="checked" initialValue={false}>
            <Space><Switch /><Text style={{fontSize:12}}>تفعيل المصادقة الثنائية (2FA)</Text></Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={editOpen} title={<Space><EditOutlined />تعديل بيانات المستخدم</Space>}
        onCancel={()=>{setEditOpen(false);editForm.resetFields();}}
        onOk={()=>editForm.validateFields().then(vals=>{
          if(selUser){ Object.assign(selUser, vals); setRev(r=>r+1); setEditOpen(false); editForm.resetFields(); }
        })}
        width={560} okText="حفظ" cancelText="إلغاء"
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={12}>
            <Col span={14}><Form.Item name="name" label="الاسم" rules={[{required:true}]}><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="position" label="المسمى"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="department" label="القسم">
              <Select>{depts.map(d=><Option key={d} value={d}>{d}</Option>)}</Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="roleIds" label="الأدوار">
              <Select mode="multiple">{ROLES.map(r=><Option key={r.id} value={r.id}><Tag color={r.color} style={{fontSize:10}}>{r.nameAr}</Tag></Option>)}</Select>
            </Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="status" label="الحالة">
              <Select>{Object.entries(STATUS_MAP).map(([k,v])=><Option key={k} value={k}>{v.label}</Option>)}</Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="twoFA" label="" valuePropName="checked">
              <Space style={{marginTop:22}}><Switch /><Text style={{fontSize:12}}>2FA</Text></Space>
            </Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Role Detail Modal */}
      <RoleDetailModal role={selRole} open={roleModalOpen} onClose={()=>setRoleModalOpen(false)} />

      {/* User Drawer */}
      <UserDrawer user={selUser} open={drawerOpen} onClose={()=>setDrawerOpen(false)}
        onEdit={u=>{setDrawerOpen(false); editForm.setFieldsValue({...u,roleIds:u.roleIds}); setSelUser(u); setEditOpen(true);}} />
    </div>
  );
};

export default UsersPage;
