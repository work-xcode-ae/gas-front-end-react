import React, { useState } from 'react';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space, Input,
  Select, Avatar, Progress, Statistic, Divider, Tabs, Modal, Descriptions, Timeline,
} from 'antd';
import {
  AppstoreOutlined, HomeOutlined, UserOutlined, FireOutlined,
  DollarOutlined, SearchOutlined, PlusOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  EyeOutlined, PhoneOutlined, MailOutlined, FileTextOutlined,
  CalendarOutlined, DatabaseOutlined,
  SafetyCertificateOutlined, ToolOutlined,
  BankOutlined, BarChartOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY   = '#1565c0';
const SUCCESS   = '#52c41a';
const WARNING   = '#fa8c16';
const DANGER    = '#ff4d4f';

const unitStatusMap: Record<string, { color: string; label: string; bg: string }> = {
  occupied:    { color: SUCCESS,    label: 'مؤجرة',   bg: '#f6ffed' },
  vacant:      { color: PRIMARY,    label: 'شاغرة',   bg: '#e3f2fd' },
  maintenance: { color: WARNING,    label: 'صيانة',   bg: '#fff7e6' },
  reserved:    { color: '#722ed1',  label: 'محجوزة',  bg: '#f9f0ff' },
};
const payStatusMap: Record<string, { color: string; label: string }> = {
  paid:    { color: 'success', label: 'مسدد'  },
  pending: { color: 'warning', label: 'معلق'  },
  overdue: { color: 'error',   label: 'متأخر' },
};
const gasStatusMap: Record<string, { color: string; label: string }> = {
  active:       { color: 'success', label: 'نشط'   },
  disconnected: { color: 'default', label: 'مفصول' },
  suspended:    { color: 'error',   label: 'موقوف' },
};

const apartmentsData = [
  { key:1, id:'APT-101', unitNo:'101', floor:1, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'أحمد علي محمد', tenantId:'T-001', tenantPhone:'+971501234567', tenantEmail:'ahmed.ali@email.com', tenantNationality:'إماراتي', meter:'M-001', meterSerial:'SN-MTR-2021-001', meterType:'smart', gasBalance:450, gasStatus:'active', contractNo:'GC-2024-001', contractStart:'2024-01-01', contractEnd:'2026-12-31', rent:65000, paymentStatus:'paid', depositPaid:true, depositAmount:10000, monthlyGasFee:150, lastReading:4521, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-08-15', serviceCount:2, notes:'' },
  { key:2, id:'APT-102', unitNo:'102', floor:1, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'فاطمة خالد النعيمي', tenantId:'T-002', tenantPhone:'+971502345678', tenantEmail:'f.nuaimi@email.com', tenantNationality:'إماراتي', meter:'M-002', meterSerial:'SN-MTR-2021-002', meterType:'smart', gasBalance:210, gasStatus:'active', contractNo:'GC-2024-002', contractStart:'2024-02-01', contractEnd:'2027-01-31', rent:65000, paymentStatus:'paid', depositPaid:true, depositAmount:10000, monthlyGasFee:150, lastReading:3210, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-07-10', serviceCount:1, notes:'' },
  { key:3, id:'APT-103', unitNo:'103', floor:1, type:'apartment', typeLabel:'شقة', area:95, bedrooms:1, bathrooms:1, building:'برج السلام', buildingId:'B-001', status:'vacant', tenant:null, tenantId:null, tenantPhone:null, tenantEmail:null, tenantNationality:null, meter:'M-003', meterSerial:'SN-MTR-2021-003', meterType:'standard', gasBalance:0, gasStatus:'disconnected', contractNo:null, contractStart:null, contractEnd:null, rent:55000, paymentStatus:null, depositPaid:false, depositAmount:0, monthlyGasFee:0, lastReading:1820, lastReadDate:'2026-08-01', overdueAmount:0, lastServiceDate:null, serviceCount:0, notes:'جاهزة للإيجار — نظيفة ومجهزة' },
  { key:4, id:'APT-201', unitNo:'201', floor:2, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'سالم محمد الزعابي', tenantId:'T-003', tenantPhone:'+971503456789', tenantEmail:'s.zaabi@email.com', tenantNationality:'إماراتي', meter:'M-004', meterSerial:'SN-MTR-2021-004', meterType:'smart', gasBalance:0, gasStatus:'active', contractNo:'GC-2024-003', contractStart:'2024-01-15', contractEnd:'2025-01-14', rent:65000, paymentStatus:'overdue', depositPaid:true, depositAmount:10000, monthlyGasFee:150, lastReading:5102, lastReadDate:'2026-09-01', overdueAmount:650, lastServiceDate:null, serviceCount:0, notes:'متأخر عن السداد — تم إرسال إشعار' },
  { key:5, id:'APT-202', unitNo:'202', floor:2, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'مريم راشد العامري', tenantId:'T-004', tenantPhone:'+971504567890', tenantEmail:'m.ameri@email.com', tenantNationality:'إماراتي', meter:'M-005', meterSerial:'SN-MTR-2021-005', meterType:'smart', gasBalance:780, gasStatus:'active', contractNo:'GC-2024-004', contractStart:'2024-03-01', contractEnd:'2027-02-28', rent:60000, paymentStatus:'paid', depositPaid:true, depositAmount:8000, monthlyGasFee:150, lastReading:2890, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-08-20', serviceCount:1, notes:'' },
  { key:6, id:'APT-203', unitNo:'203', floor:2, type:'apartment', typeLabel:'شقة', area:95, bedrooms:1, bathrooms:1, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'خالد سعيد البلوشي', tenantId:'T-005', tenantPhone:'+971505678901', tenantEmail:'k.balushi@email.com', tenantNationality:'عماني', meter:'M-006', meterSerial:'SN-MTR-2021-006', meterType:'standard', gasBalance:125, gasStatus:'active', contractNo:'GC-2024-005', contractStart:'2024-04-01', contractEnd:'2027-03-31', rent:55000, paymentStatus:'pending', depositPaid:false, depositAmount:8000, monthlyGasFee:150, lastReading:1540, lastReadDate:'2026-09-01', overdueAmount:300, lastServiceDate:null, serviceCount:0, notes:'وديعة غير مسددة' },
  { key:7, id:'APT-301', unitNo:'301', floor:3, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'علي حسن المنصوري', tenantId:'T-006', tenantPhone:'+971506789012', tenantEmail:'ali.mansouri@email.com', tenantNationality:'إماراتي', meter:'M-007', meterSerial:'SN-MTR-2022-007', meterType:'smart', gasBalance:340, gasStatus:'active', contractNo:'GC-2024-006', contractStart:'2023-12-01', contractEnd:'2026-11-30', rent:65000, paymentStatus:'paid', depositPaid:true, depositAmount:10000, monthlyGasFee:150, lastReading:3876, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-06-10', serviceCount:3, notes:'العقد ينتهي قريباً' },
  { key:8, id:'APT-302', unitNo:'302', floor:3, type:'apartment', typeLabel:'شقة', area:120, bedrooms:2, bathrooms:2, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'نورة أحمد الشحي', tenantId:'T-007', tenantPhone:'+971507890123', tenantEmail:'n.shahi@email.com', tenantNationality:'إماراتي', meter:'M-008', meterSerial:'SN-MTR-2022-008', meterType:'smart', gasBalance:620, gasStatus:'active', contractNo:'GC-2024-007', contractStart:'2024-05-01', contractEnd:'2027-04-30', rent:65000, paymentStatus:'paid', depositPaid:true, depositAmount:10000, monthlyGasFee:150, lastReading:2654, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-09-05', serviceCount:1, notes:'' },
  { key:9, id:'APT-601', unitNo:'601', floor:6, type:'penthouse', typeLabel:'بنتهاوس', area:280, bedrooms:4, bathrooms:4, building:'برج السلام', buildingId:'B-001', status:'occupied', tenant:'عبدالله ماجد القاسمي', tenantId:'T-008', tenantPhone:'+971508901234', tenantEmail:'a.qasimi@email.com', tenantNationality:'إماراتي', meter:'M-024', meterSerial:'SN-MTR-2023-024', meterType:'smart', gasBalance:1250, gasStatus:'active', contractNo:'GC-2024-022', contractStart:'2024-01-01', contractEnd:'2026-12-31', rent:150000, paymentStatus:'paid', depositPaid:true, depositAmount:25000, monthlyGasFee:350, lastReading:8910, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-09-01', serviceCount:4, notes:'' },
  { key:10, id:'APT-602', unitNo:'602', floor:6, type:'penthouse', typeLabel:'بنتهاوس', area:280, bedrooms:4, bathrooms:4, building:'برج السلام', buildingId:'B-001', status:'maintenance', tenant:null, tenantId:null, tenantPhone:null, tenantEmail:null, tenantNationality:null, meter:'M-025', meterSerial:'SN-MTR-2023-025', meterType:'smart', gasBalance:0, gasStatus:'suspended', contractNo:null, contractStart:null, contractEnd:null, rent:150000, paymentStatus:null, depositPaid:false, depositAmount:0, monthlyGasFee:0, lastReading:0, lastReadDate:null, overdueAmount:0, lastServiceDate:'2026-08-01', serviceCount:2, notes:'صيانة نظام التكييف والغاز — متوقع الانتهاء أكتوبر 2026' },
  { key:11, id:'APT-401', unitNo:'401', floor:4, type:'apartment', typeLabel:'شقة', area:140, bedrooms:3, bathrooms:2, building:'مجمع النخيل', buildingId:'B-002', status:'reserved', tenant:'محمد راشد الظاهري', tenantId:'T-011', tenantPhone:'+971509012345', tenantEmail:'m.dhaheri@email.com', tenantNationality:'إماراتي', meter:'M-041', meterSerial:'SN-MTR-2024-041', meterType:'smart', gasBalance:0, gasStatus:'disconnected', contractNo:'GC-2024-041', contractStart:'2026-10-01', contractEnd:'2027-09-30', rent:75000, paymentStatus:'pending', depositPaid:true, depositAmount:12000, monthlyGasFee:200, lastReading:0, lastReadDate:null, overdueAmount:0, lastServiceDate:null, serviceCount:0, notes:'محجوزة — تسليم أول أكتوبر 2026' },
  { key:12, id:'APT-501', unitNo:'501', floor:5, type:'apartment', typeLabel:'شقة', area:135, bedrooms:3, bathrooms:2, building:'برج الكورنيش', buildingId:'B-003', status:'occupied', tenant:'سارة حمد الهاملي', tenantId:'T-021', tenantPhone:'+971500123456', tenantEmail:'s.hamli@email.com', tenantNationality:'إماراتي', meter:'M-051', meterSerial:'SN-MTR-2022-051', meterType:'smart', gasBalance:890, gasStatus:'active', contractNo:'GC-2024-051', contractStart:'2024-06-01', contractEnd:'2027-05-31', rent:80000, paymentStatus:'paid', depositPaid:true, depositAmount:13000, monthlyGasFee:200, lastReading:6780, lastReadDate:'2026-09-01', overdueAmount:0, lastServiceDate:'2026-08-25', serviceCount:2, notes:'' },
];

const ApartmentProfile: React.FC<{ apt: any; onClose: () => void }> = ({ apt, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const daysToExpiry = apt.contractEnd
    ? Math.ceil((new Date(apt.contractEnd).getTime() - new Date().getTime()) / 86400000)
    : null;

  // ── Per-unit mock data ──
  const invoicesMock: Record<string, any[]> = {
    'APT-101': [
      { id:'INV-2026-091', date:'2026-09-01', type:'إيجار شهري', amount:5417, status:'paid', paidDate:'2026-09-03', method:'تحويل بنكي' },
      { id:'INV-2026-081', date:'2026-08-01', type:'إيجار شهري', amount:5417, status:'paid', paidDate:'2026-08-02', method:'تحويل بنكي' },
      { id:'INV-2026-071', date:'2026-07-01', type:'رسوم غاز',   amount:150,  status:'paid', paidDate:'2026-07-05', method:'نقد' },
      { id:'INV-2026-061', date:'2026-06-01', type:'إيجار شهري', amount:5417, status:'paid', paidDate:'2026-06-01', method:'تحويل بنكي' },
      { id:'INV-2026-051', date:'2026-05-01', type:'رسوم غاز',   amount:150,  status:'paid', paidDate:'2026-05-10', method:'نقد' },
    ],
    'APT-201': [
      { id:'INV-2026-094', date:'2026-09-01', type:'إيجار شهري', amount:5417, status:'overdue', paidDate:null, method:null },
      { id:'INV-2026-084', date:'2026-08-01', type:'رسوم غاز',   amount:150,  status:'overdue', paidDate:null, method:null },
      { id:'INV-2026-074', date:'2026-07-01', type:'إيجار شهري', amount:5417, status:'paid',    paidDate:'2026-07-15', method:'نقد' },
    ],
  };
  const paymentsMock: Record<string, any[]> = {
    'APT-101': [
      { id:'PAY-2026-091', date:'2026-09-03', amount:5417, method:'تحويل بنكي', ref:'TRF-09032026-001', status:'confirmed', invoice:'INV-2026-091' },
      { id:'PAY-2026-081', date:'2026-08-02', amount:5417, method:'تحويل بنكي', ref:'TRF-08022026-001', status:'confirmed', invoice:'INV-2026-081' },
      { id:'PAY-2026-071', date:'2026-07-05', amount:150,  method:'نقد',        ref:'CASH-07052026',    status:'confirmed', invoice:'INV-2026-071' },
      { id:'PAY-2026-061', date:'2026-06-01', amount:5417, method:'تحويل بنكي', ref:'TRF-06012026-001', status:'confirmed', invoice:'INV-2026-061' },
      { id:'PAY-2026-051', date:'2026-05-10', amount:150,  method:'نقد',        ref:'CASH-05102026',    status:'confirmed', invoice:'INV-2026-051' },
    ],
    'APT-201': [
      { id:'PAY-2026-074', date:'2026-07-15', amount:5417, method:'نقد', ref:'CASH-07152026', status:'confirmed', invoice:'INV-2026-074' },
    ],
  };
  const readingsMock: Record<string, any[]> = {
    'APT-101': [
      { id:'RD-2026-09', date:'2026-09-01', reading:4521, previous:4389, consumption:132, reader:'أحمد الطاهر', type:'شهري',    status:'confirmed' },
      { id:'RD-2026-08', date:'2026-08-01', reading:4389, previous:4255, consumption:134, reader:'أحمد الطاهر', type:'شهري',    status:'confirmed' },
      { id:'RD-2026-07', date:'2026-07-01', reading:4255, previous:4118, consumption:137, reader:'محمد علي',    type:'شهري',    status:'confirmed' },
      { id:'RD-2026-06', date:'2026-06-01', reading:4118, previous:3980, consumption:138, reader:'أحمد الطاهر', type:'شهري',    status:'confirmed' },
      { id:'RD-2026-05', date:'2026-05-01', reading:3980, previous:3845, consumption:135, reader:'محمد علي',    type:'شهري',    status:'confirmed' },
      { id:'RD-2026-04', date:'2026-04-01', reading:3845, previous:3700, consumption:145, reader:'أحمد الطاهر', type:'شهري',    status:'confirmed' },
    ],
    'APT-201': [
      { id:'RD-2026-09', date:'2026-09-01', reading:5102, previous:4960, consumption:142, reader:'أحمد الطاهر', type:'شهري', status:'confirmed' },
      { id:'RD-2026-08', date:'2026-08-01', reading:4960, previous:4810, consumption:150, reader:'محمد علي',    type:'شهري', status:'confirmed' },
    ],
  };

  const aptInvoices = invoicesMock[apt.id] || [
    { id:`INV-${apt.id}-001`, date:'2026-09-01', type:'إيجار شهري', amount: Math.round((apt.rent||0)/12), status: apt.paymentStatus||'paid', paidDate: apt.paymentStatus==='paid'?'2026-09-03':null, method: apt.paymentStatus==='paid'?'تحويل بنكي':null },
    { id:`INV-${apt.id}-002`, date:'2026-08-01', type:'رسوم غاز', amount: apt.monthlyGasFee||150, status:'paid', paidDate:'2026-08-05', method:'نقد' },
    { id:`INV-${apt.id}-003`, date:'2026-07-01', type:'إيجار شهري', amount: Math.round((apt.rent||0)/12), status:'paid', paidDate:'2026-07-02', method:'تحويل بنكي' },
  ];
  const aptPayments = paymentsMock[apt.id] || [
    { id:`PAY-${apt.id}-001`, date:'2026-09-03', amount: Math.round((apt.rent||0)/12), method:'تحويل بنكي', ref:`TRF-${apt.id}-001`, status:'confirmed', invoice:`INV-${apt.id}-001` },
    { id:`PAY-${apt.id}-002`, date:'2026-08-05', amount: apt.monthlyGasFee||150, method:'نقد', ref:`CASH-${apt.id}-002`, status:'confirmed', invoice:`INV-${apt.id}-002` },
  ];
  const aptReadings = readingsMock[apt.id] || [
    { id:`RD-${apt.id}-1`, date:'2026-09-01', reading: apt.lastReading||0, previous: Math.max(0,(apt.lastReading||0)-130), consumption:130, reader:'أحمد الطاهر', type:'شهري', status:'confirmed' },
    { id:`RD-${apt.id}-2`, date:'2026-08-01', reading: Math.max(0,(apt.lastReading||0)-130), previous: Math.max(0,(apt.lastReading||0)-265), consumption:135, reader:'محمد علي', type:'شهري', status:'confirmed' },
  ];

  const invStatusMap: Record<string,{color:string;label:string}> = {
    paid:    { color:'success', label:'مسدد'  },
    pending: { color:'warning', label:'معلق'  },
    overdue: { color:'error',   label:'متأخر' },
  };

  const tabs = [
    {
      key: 'overview', label: <span><BarChartOutlined /> نظرة عامة</span>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card bordered={false} style={{ borderRadius:10, background:'#f8faff', border:'1px solid #e3f2fd' }}>
            <Row gutter={[16,12]}>
              {[
                { l:'المبنى',    v:apt.building,                         icon:<BankOutlined /> },
                { l:'رقم الوحدة',v:apt.unitNo,                           icon:<HomeOutlined /> },
                { l:'الطابق',    v:`الطابق ${apt.floor}`,                icon:<BarChartOutlined /> },
                { l:'النوع',     v:apt.typeLabel,                        icon:<AppstoreOutlined /> },
                { l:'المساحة',   v:`${apt.area} م²`,                     icon:<BarChartOutlined /> },
                { l:'الغرف',     v:`${apt.bedrooms} غرف · ${apt.bathrooms} حمامات`, icon:<HomeOutlined /> },
              ].map((f,i) => (
                <Col span={8} key={i}>
                  <Space>
                    <span style={{ color:PRIMARY }}>{f.icon}</span>
                    <div>
                      <Text type="secondary" style={{ fontSize:11, display:'block' }}>{f.l}</Text>
                      <Text style={{ fontSize:13 }}>{f.v}</Text>
                    </div>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
          <Row gutter={[12,12]}>
            {[
              { label:'الحالة',        v:<Tag color={unitStatusMap[apt.status]?.color}>{unitStatusMap[apt.status]?.label}</Tag> },
              { label:'الإيجار السنوي', v:<Text strong style={{ color:PRIMARY }}>{apt.rent?.toLocaleString()} د.إ</Text> },
              { label:'حالة الدفع',    v:apt.paymentStatus ? <Tag color={payStatusMap[apt.paymentStatus]?.color}>{payStatusMap[apt.paymentStatus]?.label}</Tag> : <Text type="secondary">—</Text> },
              { label:'الوديعة',       v:apt.depositPaid ? <Tag color="success">مسددة — {apt.depositAmount?.toLocaleString()} د.إ</Tag> : <Tag color="error">غير مسددة</Tag> },
            ].map((s,i) => (
              <Col span={6} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, textAlign:'center', background:'#fafafa' }}>
                  <Text type="secondary" style={{ fontSize:11, display:'block' }}>{s.label}</Text>
                  <div style={{ marginTop:4 }}>{s.v}</div>
                </Card>
              </Col>
            ))}
          </Row>
          {apt.contractNo && (
            <Card size="small" bordered={false} style={{ borderRadius:10, border:`1px solid ${daysToExpiry !== null && daysToExpiry < 60 ? DANGER : '#e3f2fd'}`, background:'#f0f7ff' }}>
              <Row align="middle" gutter={[12,8]}>
                <Col flex="1">
                  <Text strong style={{ display:'block', fontSize:13 }}><SafetyCertificateOutlined style={{ marginInlineEnd:6, color:PRIMARY }} />{apt.contractNo}</Text>
                  <Text type="secondary" style={{ fontSize:11 }}>{apt.contractStart} → {apt.contractEnd}</Text>
                </Col>
                {daysToExpiry !== null && (
                  <Col><Tag color={daysToExpiry < 0 ? 'error' : daysToExpiry < 60 ? 'warning' : 'success'}>{daysToExpiry < 0 ? 'منتهي' : `${daysToExpiry} يوم متبقي`}</Tag></Col>
                )}
                <Col><Button size="small" type="primary" ghost>تجديد العقد</Button></Col>
              </Row>
            </Card>
          )}
          <Row gutter={[12,0]}>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius:10, background:'#fff7e6', border:'1px solid #ffd591' }}>
                <Space>
                  <FireOutlined style={{ fontSize:22, color:WARNING }} />
                  <div>
                    <Text type="secondary" style={{ fontSize:11, display:'block' }}>رصيد الغاز</Text>
                    <Text strong style={{ fontSize:18, color:WARNING }}>{apt.gasBalance} م³</Text>
                  </div>
                </Space>
                <Divider style={{ margin:'8px 0' }} />
                <Row gutter={[8,4]}>
                  {[
                    { l:'العداد', v:apt.meter },
                    { l:'النوع',  v:apt.meterType === 'smart' ? 'ذكي' : 'عادي' },
                    { l:'آخر قراءة', v:apt.lastReading ? `${apt.lastReading.toLocaleString()} م³` : '—' },
                    { l:'تاريخ القراءة', v:apt.lastReadDate || '—' },
                  ].map((f,i) => (
                    <Col span={12} key={i}>
                      <Text type="secondary" style={{ fontSize:10 }}>{f.l}: </Text>
                      <Text style={{ fontSize:11 }}>{f.v}</Text>
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop:8 }}>
                  <Tag color={gasStatusMap[apt.gasStatus]?.color}>{gasStatusMap[apt.gasStatus]?.label}</Tag>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius:10, background:'#fff1f0', border:apt.overdueAmount > 0 ? '1px solid #ffccc7' : '1px solid #f0f0f0' }}>
                <Space>
                  <DollarOutlined style={{ fontSize:22, color:apt.overdueAmount > 0 ? DANGER : SUCCESS }} />
                  <div>
                    <Text type="secondary" style={{ fontSize:11, display:'block' }}>المبالغ المتأخرة</Text>
                    <Text strong style={{ fontSize:18, color:apt.overdueAmount > 0 ? DANGER : SUCCESS }}>
                      {apt.overdueAmount > 0 ? `${apt.overdueAmount} د.إ` : 'لا يوجد'}
                    </Text>
                  </div>
                </Space>
                <Divider style={{ margin:'8px 0' }} />
                <Row gutter={[8,4]}>
                  <Col span={24}><Text type="secondary" style={{ fontSize:10 }}>الرسوم الشهرية: </Text><Text style={{ fontSize:11 }}>{apt.monthlyGasFee || '—'} د.إ</Text></Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize:10 }}>طلبات خدمة: </Text><Text style={{ fontSize:11 }}>{apt.serviceCount} طلب</Text></Col>
                  <Col span={24}><Text type="secondary" style={{ fontSize:10 }}>آخر صيانة: </Text><Text style={{ fontSize:11 }}>{apt.lastServiceDate || '—'}</Text></Col>
                </Row>
              </Card>
            </Col>
          </Row>
          {apt.notes && (
            <div style={{ padding:'10px 14px', borderRadius:8, background:'#fff7e6', fontSize:12 }}>
              <ExclamationCircleOutlined style={{ color:WARNING, marginInlineEnd:6 }} />{apt.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'tenant', label: <span><UserOutlined /> المستأجر</span>,
      children: apt.tenant ? (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card bordered={false} style={{ borderRadius:10, background:'#f8faff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
              <Avatar size={64} style={{ background:PRIMARY, fontSize:20 }}>{apt.tenant.substring(0,2)}</Avatar>
              <div>
                <Text strong style={{ fontSize:16, display:'block' }}>{apt.tenant}</Text>
                <Text type="secondary" style={{ fontSize:12 }}>{apt.tenantNationality} · {apt.tenantId}</Text>
                <div style={{ marginTop:4 }}>
                  <Tag color={payStatusMap[apt.paymentStatus]?.color}>{payStatusMap[apt.paymentStatus]?.label}</Tag>
                </div>
              </div>
            </div>
            <Row gutter={[16,10]}>
              {[
                { label:'الهاتف',           value:apt.tenantPhone,    icon:<PhoneOutlined /> },
                { label:'البريد الإلكتروني', value:apt.tenantEmail,    icon:<MailOutlined /> },
                { label:'بداية العقد',       value:apt.contractStart,  icon:<CalendarOutlined /> },
                { label:'نهاية العقد',       value:apt.contractEnd,    icon:<CalendarOutlined /> },
                { label:'الإيجار',           value:`${apt.rent?.toLocaleString()} د.إ / سنة`, icon:<DollarOutlined /> },
                { label:'الوديعة',           value:apt.depositPaid ? `${apt.depositAmount?.toLocaleString()} د.إ (مسددة)` : 'غير مسددة', icon:<SafetyCertificateOutlined /> },
              ].map((f,i) => (
                <Col span={12} key={i}>
                  <Space>
                    <span style={{ color:PRIMARY }}>{f.icon}</span>
                    <div>
                      <Text type="secondary" style={{ fontSize:11, display:'block' }}>{f.label}</Text>
                      <Text style={{ fontSize:12 }}>{f.value}</Text>
                    </div>
                  </Space>
                </Col>
              ))}
            </Row>
          </Card>
          <Row gutter={[12,0]}>
            <Col span={12}><Button block icon={<PhoneOutlined />}>اتصال</Button></Col>
            <Col span={12}><Button block type="primary" ghost icon={<MailOutlined />}>إرسال إشعار</Button></Col>
          </Row>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:40 }}>
          <UserOutlined style={{ fontSize:40, color:'#ccc', display:'block', marginBottom:12 }} />
          <Text type="secondary">لا يوجد مستأجر حالياً</Text>
          <div style={{ marginTop:16 }}>
            <Button type="primary" icon={<PlusOutlined />}>إضافة مستأجر</Button>
          </div>
        </div>
      ),
    },
    {
      key: 'gas', label: <span><FireOutlined /> الغاز</span>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Row gutter={[12,12]}>
            {[
              { label:'رصيد الغاز',    value:`${apt.gasBalance} م³`,              color:WARNING, bg:'#fff7e6', icon:<FireOutlined /> },
              { label:'آخر قراءة',     value:`${apt.lastReading?.toLocaleString() || 0} م³`, color:PRIMARY, bg:'#e3f2fd', icon:<DatabaseOutlined /> },
              { label:'الرسوم الشهرية', value:`${apt.monthlyGasFee} د.إ`,          color:'#52c41a', bg:'#f6ffed', icon:<DollarOutlined /> },
              { label:'حالة الغاز',    value:gasStatusMap[apt.gasStatus]?.label,  color:apt.gasStatus==='active'?SUCCESS:DANGER, bg:apt.gasStatus==='active'?'#f6ffed':'#fff1f0', icon:<CheckCircleOutlined /> },
            ].map((s:any,i) => (
              <Col span={12} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:10, background:s.bg }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:20, color:s.color }}>{s.icon}</div>
                    <div>
                      <Text type="secondary" style={{ fontSize:11, display:'block' }}>{s.label}</Text>
                      <Text strong style={{ fontSize:15, color:s.color }}>{s.value}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <Card size="small" bordered={false} style={{ borderRadius:10 }}>
            <Descriptions size="small" column={2} title={<Text strong><DatabaseOutlined style={{ marginInlineEnd:6, color:PRIMARY }} />تفاصيل العداد</Text>}>
              <Descriptions.Item label="رقم العداد">{apt.meter}</Descriptions.Item>
              <Descriptions.Item label="الرقم التسلسلي">{apt.meterSerial}</Descriptions.Item>
              <Descriptions.Item label="النوع">{apt.meterType === 'smart' ? 'ذكي' : 'عادي'}</Descriptions.Item>
              <Descriptions.Item label="تاريخ آخر قراءة">{apt.lastReadDate || '—'}</Descriptions.Item>
              <Descriptions.Item label="حالة الغاز" span={2}>
                <Tag color={gasStatusMap[apt.gasStatus]?.color}>{gasStatusMap[apt.gasStatus]?.label}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Row gutter={[12,0]}>
            <Col span={12}><Button block icon={<DatabaseOutlined />}>تسجيل قراءة</Button></Col>
            <Col span={12}><Button block type="primary" ghost icon={<FireOutlined />}>{apt.gasStatus==='active' ? 'إيقاف الغاز' : 'تشغيل الغاز'}</Button></Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'activity', label: <span><ClockCircleOutlined /> النشاط</span>,
      children: (
        <Timeline items={[
          { color:'#52c41a', children:<div><Text style={{ fontSize:12 }}>قراءة عداد الغاز — {apt.lastReading?.toLocaleString()} م³</Text><div style={{ fontSize:11, color:'#888' }}>{apt.lastReadDate}</div></div> },
          { color:apt.paymentStatus==='paid'?'#52c41a':'#ff4d4f', children:<div><Text style={{ fontSize:12 }}>{apt.paymentStatus==='paid'?'تم استلام دفعة الإيجار':'إشعار تأخر السداد'}</Text><div style={{ fontSize:11, color:'#888' }}>سبتمبر 2026</div></div> },
          ...(apt.lastServiceDate ? [{ color:'#1677ff', children:<div><Text style={{ fontSize:12 }}>طلب خدمة — صيانة</Text><div style={{ fontSize:11, color:'#888' }}>{apt.lastServiceDate}</div></div> }] : []),
          { color:'#888', children:<div><Text style={{ fontSize:12 }}>بداية العقد — {apt.contractNo}</Text><div style={{ fontSize:11, color:'#888' }}>{apt.contractStart}</div></div> },
        ]} />
      ),
    },
    {
      key: 'invoices', label: <span><FileTextOutlined /> الفواتير</span>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Row gutter={[12,12]} style={{ marginBottom:4 }}>
            {[
              { label:'إجمالي الفواتير', value:aptInvoices.length, color:PRIMARY,  bg:'#e3f2fd' },
              { label:'مسددة',           value:aptInvoices.filter((i:any)=>i.status==='paid').length, color:'#52c41a', bg:'#f6ffed' },
              { label:'متأخرة / معلقة', value:aptInvoices.filter((i:any)=>i.status!=='paid').length, color:DANGER,   bg:'#fff1f0' },
              { label:'إجمالي المبالغ',  value:`${aptInvoices.reduce((s:number,i:any)=>s+i.amount,0).toLocaleString()} د.إ`, color:'#00695c', bg:'#e0f2f1' },
            ].map((s:any,i:number) => (
              <Col span={6} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, background:s.bg, textAlign:'center' }}>
                  <Text type="secondary" style={{ fontSize:10, display:'block' }}>{s.label}</Text>
                  <Text strong style={{ fontSize:16, color:s.color }}>{s.value}</Text>
                </Card>
              </Col>
            ))}
          </Row>
          <Table
            size="small" dataSource={aptInvoices} rowKey="id" pagination={false}
            columns={[
              { title:'رقم الفاتورة', dataIndex:'id', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text>, width:140 },
              { title:'التاريخ', dataIndex:'date', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text>, width:95 },
              { title:'النوع', dataIndex:'type', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text> },
              { title:'المبلغ', dataIndex:'amount', render:(v:number)=><Text strong style={{ fontSize:12, color:PRIMARY }}>{v.toLocaleString()} د.إ</Text>, width:100 },
              { title:'الحالة', dataIndex:'status', render:(v:string)=><Tag color={invStatusMap[v]?.color} style={{ fontSize:10 }}>{invStatusMap[v]?.label}</Tag>, width:80 },
              { title:'تاريخ السداد', dataIndex:'paidDate', render:(v:string|null)=><Text style={{ fontSize:11 }}>{v||'—'}</Text>, width:100 },
              { title:'طريقة الدفع', dataIndex:'method', render:(v:string|null)=><Text style={{ fontSize:11 }}>{v||'—'}</Text> },
            ]}
          />
          <Button block type="primary" ghost icon={<PlusOutlined />} size="small">إنشاء فاتورة جديدة</Button>
        </div>
      ),
    },
    {
      key: 'payments', label: <span><DollarOutlined /> المدفوعات</span>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Row gutter={[12,12]} style={{ marginBottom:4 }}>
            {[
              { label:'إجمالي المدفوعات', value:aptPayments.length, color:PRIMARY, bg:'#e3f2fd' },
              { label:'إجمالي المبالغ', value:`${aptPayments.reduce((s:number,p:any)=>s+p.amount,0).toLocaleString()} د.إ`, color:'#52c41a', bg:'#f6ffed' },
            ].map((s:any,i:number) => (
              <Col span={12} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, background:s.bg, textAlign:'center' }}>
                  <Text type="secondary" style={{ fontSize:10, display:'block' }}>{s.label}</Text>
                  <Text strong style={{ fontSize:16, color:s.color }}>{s.value}</Text>
                </Card>
              </Col>
            ))}
          </Row>
          <Table
            size="small" dataSource={aptPayments} rowKey="id" pagination={false}
            columns={[
              { title:'رقم الدفعة', dataIndex:'id', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text>, width:140 },
              { title:'التاريخ', dataIndex:'date', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text>, width:95 },
              { title:'المبلغ', dataIndex:'amount', render:(v:number)=><Text strong style={{ fontSize:12, color:'#52c41a' }}>{v.toLocaleString()} د.إ</Text>, width:100 },
              { title:'الطريقة', dataIndex:'method', render:(v:string)=><Tag color="blue" style={{ fontSize:10 }}>{v}</Tag>, width:100 },
              { title:'المرجع', dataIndex:'ref', render:(v:string)=><Text style={{ fontSize:10, color:'#888' }}>{v}</Text> },
              { title:'الفاتورة', dataIndex:'invoice', render:(v:string)=><Text style={{ fontSize:10, color:PRIMARY }}>{v}</Text>, width:130 },
              { title:'الحالة', dataIndex:'status', render:()=><Tag color="success" style={{ fontSize:10 }}>مؤكد</Tag>, width:70 },
            ]}
          />
          <Button block type="primary" ghost icon={<PlusOutlined />} size="small">تسجيل دفعة جديدة</Button>
        </div>
      ),
    },
    {
      key: 'readings', label: <span><DatabaseOutlined /> القراءات</span>,
      children: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Row gutter={[12,12]} style={{ marginBottom:4 }}>
            {[
              { label:'آخر قراءة',        value:`${aptReadings[0]?.reading?.toLocaleString()||0} م³`, color:WARNING,   bg:'#fff7e6' },
              { label:'آخر استهلاك',      value:`${aptReadings[0]?.consumption||0} م³`,              color:PRIMARY,   bg:'#e3f2fd' },
              { label:'متوسط الاستهلاك',  value:`${aptReadings.length ? Math.round(aptReadings.reduce((s:number,r:any)=>s+r.consumption,0)/aptReadings.length) : 0} م³`, color:'#52c41a', bg:'#f6ffed' },
              { label:'عدد القراءات',     value:aptReadings.length,                                   color:'#00695c', bg:'#e0f2f1' },
            ].map((s:any,i:number) => (
              <Col span={6} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius:8, background:s.bg, textAlign:'center' }}>
                  <Text type="secondary" style={{ fontSize:10, display:'block' }}>{s.label}</Text>
                  <Text strong style={{ fontSize:15, color:s.color }}>{s.value}</Text>
                </Card>
              </Col>
            ))}
          </Row>
          <Table
            size="small" dataSource={aptReadings} rowKey="id" pagination={false}
            columns={[
              { title:'التاريخ', dataIndex:'date', render:(v:string)=><Text style={{ fontSize:12 }}>{v}</Text>, width:100 },
              { title:'القراءة الحالية', dataIndex:'reading', render:(v:number)=><Text strong style={{ fontSize:12, color:PRIMARY }}>{v.toLocaleString()} م³</Text>, width:120 },
              { title:'القراءة السابقة', dataIndex:'previous', render:(v:number)=><Text style={{ fontSize:11 }}>{v.toLocaleString()} م³</Text>, width:120 },
              { title:'الاستهلاك', dataIndex:'consumption', render:(v:number)=>(
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <FireOutlined style={{ color:WARNING, fontSize:12 }} />
                  <Text strong style={{ fontSize:12, color:WARNING }}>{v} م³</Text>
                </div>
              ), width:100 },
              { title:'القارئ', dataIndex:'reader', render:(v:string)=><Text style={{ fontSize:11 }}>{v}</Text> },
              { title:'النوع', dataIndex:'type', render:(v:string)=><Tag color="blue" style={{ fontSize:10 }}>{v}</Tag>, width:70 },
              { title:'الحالة', dataIndex:'status', render:()=><Tag color="success" style={{ fontSize:10 }}>مؤكد</Tag>, width:70 },
            ]}
          />
          <Button block type="primary" ghost icon={<PlusOutlined />} size="small">تسجيل قراءة جديدة</Button>
        </div>
      ),
    },
  ];

  return (
    <Modal open onCancel={onClose} footer={null} width={820} style={{ top:20 }}
      title={
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:`${unitStatusMap[apt.status]?.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:unitStatusMap[apt.status]?.color }}>
            <HomeOutlined />
          </div>
          <div>
            <Text strong style={{ fontSize:16, display:'block' }}>وحدة {apt.unitNo} — {apt.building}</Text>
            <Space>
              <Tag color={unitStatusMap[apt.status]?.color} style={{ fontSize:11 }}>{unitStatusMap[apt.status]?.label}</Tag>
              <Text type="secondary" style={{ fontSize:12 }}>{apt.typeLabel} · {apt.area} م² · {apt.bedrooms} غرف</Text>
            </Space>
          </div>
        </div>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" items={tabs} style={{ marginTop:-8 }} />
    </Modal>
  );
};

const ApartmentsPage: React.FC = () => {
  const [search,          setSearch]          = useState('');
  const [filterStatus,    setFilterStatus]    = useState<string>('all');
  const [filterBuilding,  setFilterBuilding]  = useState<string>('all');
  const [filterType,      setFilterType]      = useState<string>('all');
  const [selectedApt,     setSelectedApt]     = useState<any>(null);

  const filtered = apartmentsData.filter(a => {
    const matchSearch   = !search || a.unitNo.includes(search) || (a.tenant||'').includes(search) || a.building.includes(search) || a.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = filterStatus   === 'all' || a.status     === filterStatus;
    const matchBuilding = filterBuilding === 'all' || a.buildingId  === filterBuilding;
    const matchType     = filterType     === 'all' || a.type        === filterType;
    return matchSearch && matchStatus && matchBuilding && matchType;
  });

  const total         = apartmentsData.length;
  const occupied      = apartmentsData.filter(a => a.status === 'occupied').length;
  const vacant        = apartmentsData.filter(a => a.status === 'vacant').length;
  const maintenance   = apartmentsData.filter(a => a.status === 'maintenance').length;
  const reserved      = apartmentsData.filter(a => a.status === 'reserved').length;
  const overdueCount  = apartmentsData.filter(a => a.paymentStatus === 'overdue').length;
  const totalRent     = apartmentsData.filter(a => a.rent).reduce((s,a) => s + (a.rent||0), 0);
  const occupancyPct  = Math.round((occupied / total) * 100);

  const statusChart = {
    series: [occupied, vacant, maintenance, reserved],
    options: {
      chart: { type:'donut' as const, fontFamily:'inherit' },
      colors: [SUCCESS, PRIMARY, WARNING, '#722ed1'],
      labels: ['مؤجرة','شاغرة','صيانة','محجوزة'],
      legend: { position:'bottom' as const, fontSize:'12px' },
      plotOptions: { pie: { donut: { size:'65%', labels: { show:true, total: { show:true, label:'الإجمالي', fontSize:'13px', formatter:()=>`${total}` } } } } },
    },
  };

  const rentChart = {
    series: [{ name:'الإيجار (د.إ)', data:[120000,145000,162000,178000,195000,210000] }],
    options: {
      chart: { type:'area' as const, toolbar:{ show:false }, fontFamily:'inherit' },
      colors: [PRIMARY],
      fill: { type:'gradient', gradient:{ opacityFrom:0.4, opacityTo:0.05 } },
      stroke: { curve:'smooth' as const, width:3 },
      xaxis: { categories:['أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر'] },
      yaxis: { labels:{ formatter:(v:number)=>`${(v/1000).toFixed(0)}k` } },
      grid: { borderColor:'#f0f0f0' },
      tooltip: { theme:'light' as const },
    },
  };

  const typeChart = {
    series: [
      { name:'شقة',      data:[8,0,1,0,0,0] },
      { name:'بنتهاوس',  data:[2,0,0,0,0,0] },
    ],
    options: {
      chart: { type:'bar' as const, toolbar:{ show:false }, fontFamily:'inherit', stacked:true },
      colors: [PRIMARY, '#722ed1'],
      xaxis: { categories:['برج السلام','مجمع النخيل','برج الكورنيش','مجمع الياسمين','برج الفاروق','أخرى'] },
      legend: { position:'top' as const },
      plotOptions: { bar:{ borderRadius:4, columnWidth:'50%' } },
      grid: { borderColor:'#f0f0f0' },
    },
  };

  const columns = [
    {
      title:'الوحدة',
      render:(_:any, r:any) => (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:unitStatusMap[r.status]?.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:unitStatusMap[r.status]?.color, flexShrink:0 }}>
            <HomeOutlined />
          </div>
          <div>
            <Text strong style={{ fontSize:13 }}>{r.id}</Text>
            <div style={{ fontSize:11, color:'#888' }}>الطابق {r.floor} · {r.area} م²</div>
          </div>
        </div>
      ), width:160,
    },
    {
      title:'المبنى',
      render:(_:any, r:any) => (
        <div>
          <Text style={{ fontSize:12 }}>{r.building}</Text>
          <div style={{ fontSize:11, color:'#888' }}>{r.typeLabel}</div>
        </div>
      ),
    },
    {
      title:'المستأجر',
      render:(_:any, r:any) => r.tenant ? (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Avatar size={28} style={{ background:PRIMARY, fontSize:11 }}>{r.tenant.substring(0,2)}</Avatar>
          <div>
            <Text style={{ fontSize:12 }}>{r.tenant}</Text>
            <div style={{ fontSize:11, color:'#888' }}>{r.tenantNationality}</div>
          </div>
        </div>
      ) : <Text type="secondary" style={{ fontSize:12 }}>—</Text>,
    },
    {
      title:'العقد',
      render:(_:any, r:any) => {
        if (!r.contractNo) return <Text type="secondary" style={{ fontSize:12 }}>—</Text>;
        const days = Math.ceil((new Date(r.contractEnd).getTime() - Date.now()) / 86400000);
        return (
          <div>
            <Text style={{ fontSize:11 }}>{r.contractNo}</Text>
            <div><Tag color={days < 0 ? 'error' : days < 60 ? 'warning' : 'success'} style={{ fontSize:10, marginTop:2 }}>{days < 0 ? 'منتهي' : `${days} يوم`}</Tag></div>
          </div>
        );
      },
    },
    {
      title:'الإيجار',
      render:(_:any, r:any) => r.rent ? (
        <div>
          <Text strong style={{ fontSize:12, color:PRIMARY }}>{r.rent.toLocaleString()} د.إ</Text>
          <div>{r.paymentStatus && <Tag color={payStatusMap[r.paymentStatus]?.color} style={{ fontSize:10 }}>{payStatusMap[r.paymentStatus]?.label}</Tag>}</div>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title:'الغاز',
      render:(_:any, r:any) => (
        <div>
          <Space><FireOutlined style={{ color:WARNING, fontSize:13 }} /><Text style={{ fontSize:12 }}>{r.gasBalance} م³</Text></Space>
          <div><Tag color={gasStatusMap[r.gasStatus]?.color} style={{ fontSize:10 }}>{gasStatusMap[r.gasStatus]?.label}</Tag></div>
        </div>
      ),
    },
    {
      title:'الحالة',
      render:(_:any, r:any) => <Tag color={unitStatusMap[r.status]?.color} style={{ fontSize:12 }}>{unitStatusMap[r.status]?.label}</Tag>,
    },
    {
      title:'',
      render:(_:any, r:any) => (
        <Button size="small" type="primary" ghost icon={<EyeOutlined />} onClick={e => { e.stopPropagation(); setSelectedApt(r); }}>عرض</Button>
      ), width:80,
    },
  ];

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ marginBottom:20, padding:'16px 24px', borderRadius:14, background:`linear-gradient(135deg, ${PRIMARY} 0%, #1976d2 100%)`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:32, color:'#fff' }}><AppstoreOutlined /></div>
          <div>
            <Title level={4} style={{ color:'#fff', margin:0 }}>الشقق والوحدات السكنية</Title>
            <Text style={{ color:'rgba(255,255,255,0.8)', fontSize:12 }}>{total} وحدة · {occupied} مؤجرة · نسبة الإشغال {occupancyPct}%</Text>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', color:'#fff' }}>إضافة وحدة</Button>
      </div>

      {/* KPIs */}
      <Row gutter={[14,14]} style={{ marginBottom:20 }}>
        {[
          { label:'إجمالي الوحدات',   value:total,        color:PRIMARY,    bg:'#e3f2fd', icon:<AppstoreOutlined />,          sub:`${occupied} مؤجرة` },
          { label:'نسبة الإشغال',     value:`${occupancyPct}%`, color:SUCCESS, bg:'#f6ffed', icon:<CheckCircleOutlined />,  sub:`${occupied} من ${total}`, progress:occupancyPct },
          { label:'شاغرة',            value:vacant,       color:'#1565c0',  bg:'#e3f2fd', icon:<HomeOutlined />,             sub:'متاحة للإيجار' },
          { label:'صيانة / محجوزة',  value:maintenance+reserved, color:WARNING, bg:'#fff7e6', icon:<ToolOutlined />,       sub:`${maintenance} صيانة · ${reserved} محجوزة` },
          { label:'متأخرون عن الدفع', value:overdueCount, color:DANGER,     bg:'#fff1f0', icon:<ExclamationCircleOutlined />, sub:'تحتاج متابعة' },
          { label:'إجمالي الإيجارات', value:`${(totalRent/1000).toFixed(0)}k`, color:'#00695c', bg:'#e0f2f1', icon:<DollarOutlined />, sub:'د.إ سنوياً' },
        ].map((k:any,i) => (
          <Col xs={12} sm={8} md={4} key={i}>
            <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }} bodyStyle={{ padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:42, height:42, borderRadius:10, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:k.color, flexShrink:0 }}>{k.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:'#888', marginBottom:1 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:k.color, lineHeight:1.2 }}>{k.value}</div>
                  <div style={{ fontSize:10, color:'#aaa' }}>{k.sub}</div>
                </div>
              </div>
              {k.progress && <Progress percent={k.progress} strokeColor={k.color} showInfo={false} size="small" style={{ marginTop:6 }} />}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <Row gutter={[14,14]} style={{ marginBottom:20 }}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }} title={<Text strong>توزيع حالة الوحدات</Text>} bodyStyle={{ padding:'8px 16px 16px' }}>
            <ReactApexChart options={statusChart.options} series={statusChart.series} type="donut" height={230} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }} title={<Text strong>إيرادات الإيجار الشهرية</Text>} bodyStyle={{ padding:'8px 16px 16px' }}>
            <ReactApexChart options={rentChart.options} series={rentChart.series} type="area" height={230} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }} title={<Text strong>الوحدات حسب المبنى والنوع</Text>} bodyStyle={{ padding:'8px 16px 16px' }}>
            <ReactApexChart options={typeChart.options} series={typeChart.series} type="bar" height={230} />
          </Card>
        </Col>
      </Row>

      {/* Alerts */}
      {(overdueCount > 0 || maintenance > 0) && (
        <Row gutter={[14,14]} style={{ marginBottom:16 }}>
          {overdueCount > 0 && (
            <Col xs={24} md={12}>
              <Card size="small" bordered={false} style={{ borderRadius:10, background:'#fff1f0', border:'1.5px solid #ffccc7' }}>
                <Space>
                  <ExclamationCircleOutlined style={{ color:DANGER, fontSize:18 }} />
                  <div>
                    <Text strong style={{ color:DANGER }}>تنبيه: {overdueCount} مستأجر متأخر عن السداد</Text>
                    <div style={{ fontSize:11, color:'#888' }}>يحتاج إرسال إشعارات متابعة</div>
                  </div>
                  <Button size="small" danger style={{ marginInlineStart:'auto' }}>إرسال إشعارات</Button>
                </Space>
              </Card>
            </Col>
          )}
          {maintenance > 0 && (
            <Col xs={24} md={12}>
              <Card size="small" bordered={false} style={{ borderRadius:10, background:'#fff7e6', border:'1.5px solid #ffd591' }}>
                <Space>
                  <ToolOutlined style={{ color:WARNING, fontSize:18 }} />
                  <div>
                    <Text strong style={{ color:WARNING }}>{maintenance} وحدة تحت الصيانة</Text>
                    <div style={{ fontSize:11, color:'#888' }}>غير متاحة للإيجار مؤقتاً</div>
                  </div>
                  <Button size="small" style={{ marginInlineStart:'auto', borderColor:WARNING, color:WARNING }}>عرض التفاصيل</Button>
                </Space>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* Table */}
      <Card bordered={false} style={{ borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }} bodyStyle={{ padding:0 }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f5f5f5', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <Input.Search
            placeholder="بحث برقم الوحدة، اسم المستأجر، المبنى..."
            style={{ width:280 }} allowClear size="middle"
            onChange={e => setSearch(e.target.value)}
            prefix={<SearchOutlined style={{ color:'#bbb' }} />}
          />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width:140 }} size="middle">
            <Option value="all">كل الحالات</Option>
            <Option value="occupied">مؤجرة</Option>
            <Option value="vacant">شاغرة</Option>
            <Option value="maintenance">صيانة</Option>
            <Option value="reserved">محجوزة</Option>
          </Select>
          <Select value={filterBuilding} onChange={setFilterBuilding} style={{ width:160 }} size="middle">
            <Option value="all">كل المباني</Option>
            <Option value="B-001">برج السلام</Option>
            <Option value="B-002">مجمع النخيل</Option>
            <Option value="B-003">برج الكورنيش</Option>
          </Select>
          <Select value={filterType} onChange={setFilterType} style={{ width:130 }} size="middle">
            <Option value="all">كل الأنواع</Option>
            <Option value="apartment">شقة</Option>
            <Option value="penthouse">بنتهاوس</Option>
          </Select>
          <div style={{ marginInlineStart:'auto' }}>
            <Text type="secondary" style={{ fontSize:12 }}>{filtered.length} وحدة من {total}</Text>
          </div>
        </div>
        <Table
          size="middle"
          dataSource={filtered}
          columns={columns}
          rowKey="key"
          pagination={{ pageSize:10, size:'small', showTotal:(t) => `${t} وحدة` }}
          onRow={(r) => ({ onClick:() => setSelectedApt(r), style:{ cursor:'pointer' } })}
        />
      </Card>

      {selectedApt && <ApartmentProfile apt={selectedApt} onClose={() => setSelectedApt(null)} />}
    </div>
  );
};

export default ApartmentsPage;
