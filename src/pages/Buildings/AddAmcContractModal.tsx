import React, { useState } from 'react';
import {
  Modal, Steps, Form, Input, InputNumber, Select, DatePicker,
  Button, Row, Col, Typography, Tag, Divider, Switch, Space,
  Alert, Card, message, Radio, Table,
} from 'antd';
import {
  UserOutlined, ToolOutlined, CalendarOutlined, DollarOutlined,
  CheckCircleOutlined, SafetyCertificateOutlined,
  CloseOutlined, FileTextOutlined, BankOutlined,
  InfoCircleOutlined, FileProtectOutlined, PlusOutlined, DeleteOutlined, EditOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

const OUR_COMPANY = {
  name:    'شركة بن صدرة للغاز',
  nameEn:  'Bin Sidra Gas LLC',
  phone:   '+971 2 555 0200',
  email:   'contracts@binsidragas.com',
  address: 'أبوظبي، الإمارات العربية المتحدة',
  crNo:    'CN-1234567',
  trn:     '100123456700003',
};

export interface AmcContract {
  id: string; contractNo: string;
  vendor: string; vendorContact: string; vendorEmail: string;
  ownerName: string; ownerPhone: string; ownerEmail: string;
  startDate: string; endDate: string;
  annualValue: number; currency: string;
  status: 'active' | 'expired' | 'pending';
  scope: string[]; excludedScope: string[];
  visitFrequency: string; visitsTotal: number; visitSchedule: string[];
  paymentSchedule: { dueDate: string; amount: number; label: string; status: 'pending' | 'paid' }[]; terms: string[]; customTerms: string[];
  visitsDone: number;
  lastVisit: string | null; lastVisitReport: string; nextVisit: string | null;
  responseTime: string; emergencyIncluded: boolean; notes: string;
}

interface Props {
  open: boolean; buildingName: string;
  ownerName?: string; ownerPhone?: string; ownerEmail?: string;
  onClose: () => void; onSave: (c: AmcContract) => void;
}

const SERVICE_CATALOGUE = [
  { id: 'pipe_inspect',  label: 'فحص مواسير الغاز وكشف التسريبات',   category: 'safety',  recommended: true },
  { id: 'tank_inspect',  label: 'فحص سلامة الخزانات والصمامات',        category: 'safety',  recommended: true },
  { id: 'meter_connect', label: 'فحص نقاط الاتصال بالعدادات',          category: 'meter',   recommended: true },
  { id: 'safety_report', label: 'إصدار تقرير سلامة سنوي',               category: 'report',  recommended: true },
  { id: 'meter_calib',   label: 'معايرة العدادات الذكية',               category: 'meter',   recommended: false },
  { id: 'pressure_test', label: 'اختبارات ضغط المواسير',                 category: 'safety',  recommended: false },
  { id: 'regulator',     label: 'صيانة منظمات الضغط',                   category: 'safety',  recommended: false },
  { id: 'emergency_kit', label: 'توفير معدات طوارئ في الموقع',          category: 'extra',   recommended: false },
  { id: 'training',      label: 'تدريب موظفي المبنى على السلامة',       category: 'extra',   recommended: false },
  { id: 'cctv_gas',      label: 'مراقبة أنظمة الاستشعار الذكية',       category: 'extra',   recommended: false },
];

const EXCLUDED_CATALOGUE = [
  { id: 'ex_structural',  label: 'الإصلاحات الهيكلية للمبنى' },
  { id: 'ex_electrical',  label: 'الأعمال الكهربائية المرتبطة' },
  { id: 'ex_appliances',  label: 'صيانة الأجهزة المنزلية' },
  { id: 'ex_third_party', label: 'أعطال ناجمة عن أطراف خارجية' },
  { id: 'ex_civil',       label: 'الأعمال المدنية والتكسير' },
];

const TERMS_CATALOGUE = [
  { id: 't01', category: 'general',   text: 'يلتزم الطرف الأول بتسهيل وصول فريق الطرف الثاني إلى المبنى في المواعيد المتفق عليها.' },
  { id: 't02', category: 'general',   text: 'يبدأ سريان هذا العقد من تاريخ توقيع الطرفين ويُعدّ ساري المفعول لمدة سنة كاملة.' },
  { id: 't03', category: 'general',   text: 'يحق لأي من الطرفين إنهاء العقد بإشعار كتابي مدته 30 يوماً في حال إخلال الطرف الآخر ببنوده.' },
  { id: 't04', category: 'payment',   text: 'يُسدَّد مبلغ العقد وفق الجدول المتفق عليه — أي تأخر يترتب عليه غرامة 2% شهرياً على الرصيد المتأخر.' },
  { id: 't05', category: 'payment',   text: 'يُعدّ العقد مجمداً حتى استلام الطرف الثاني للدفعة الأولى المتفق عليها.' },
  { id: 't06', category: 'service',   text: 'تُنجز الزيارات الدورية خلال 3 أيام عمل من تاريخها المقرر — التأخير غير المبرر يُعتبر خرقاً للعقد.' },
  { id: 't07', category: 'service',   text: 'يتعهد الطرف الثاني بإصدار تقرير مفصّل لكل زيارة صيانة خلال 48 ساعة من إتمامها.' },
  { id: 't08', category: 'service',   text: 'في حالات الطوارئ، يستجيب الطرف الثاني خلال وقت الاستجابة المتفق عليه من لحظة الإبلاغ.' },
  { id: 't09', category: 'liability', text: 'لا يتحمل الطرف الثاني مسؤولية الأضرار الناجمة عن سوء الاستخدام أو الحوادث الخارجة عن نطاق الصيانة المتفق عليها.' },
  { id: 't10', category: 'liability', text: 'تقتصر مسؤولية الطرف الثاني التعويضية بحد أقصى قيمة عقد الصيانة السنوي.' },
  { id: 't11', category: 'renewal',   text: 'يُجدَّد العقد تلقائياً لمدة مماثلة ما لم يُخطر أحد الطرفين الآخر بعدم التجديد قبل 60 يوماً من انتهائه.' },
  { id: 't12', category: 'renewal',   text: 'عند التجديد، يحق للطرف الثاني مراجعة الرسوم بحد أقصى 5% وفق مؤشر التضخم السنوي المعتمد.' },
  { id: 't13', category: 'dispute',   text: 'يُحكم هذا العقد وفق قوانين إمارة أبوظبي — أي نزاع يُحال إلى القضاء الإماراتي المختص.' },
  { id: 't14', category: 'dispute',   text: 'يسعى الطرفان أولاً إلى التسوية الودية لأي نزاع خلال 30 يوماً قبل اللجوء إلى أي إجراء قانوني.' },
];

const TERMS_CATEGORIES: Record<string, { label: string; color: string }> = {
  general:   { label: 'أحكام عامة',       color: 'blue' },
  payment:   { label: 'الدفع والرسوم',    color: 'gold' },
  service:   { label: 'مستوى الخدمة',    color: 'green' },
  liability: { label: 'المسؤولية',        color: 'orange' },
  renewal:   { label: 'التجديد والإنهاء', color: 'purple' },
  dispute:   { label: 'تسوية النزاعات',   color: 'red' },
};

const VISIT_FREQ_OPTIONS = [
  { value: 'monthly',   label: 'شهري',       count: 12 },
  { value: 'bimonthly', label: 'كل شهرين',   count: 6  },
  { value: 'quarterly', label: 'ربع سنوي',    count: 4  },
  { value: 'biannual',  label: 'نصف سنوي',   count: 2  },
  { value: 'annual',    label: 'سنوي',        count: 1  },
];

const PAYMENT_FREQ_OPTIONS = [
  { value: 'annual',    label: 'دفعة واحدة سنوياً',    installments: 1  },
  { value: 'semi',      label: 'نصف سنوي — دفعتان',    installments: 2  },
  { value: 'quarterly', label: 'ربع سنوي — 4 دفعات',   installments: 4  },
  { value: 'monthly',   label: 'شهري — 12 دفعة',        installments: 12 },
];

const RESPONSE_OPTIONS = [
  { value: '2h',  label: '2 ساعة' },
  { value: '4h',  label: '4 ساعات' },
  { value: '8h',  label: '8 ساعات' },
  { value: '24h', label: '24 ساعة' },
];

function buildPaymentSchedule(start: Dayjs, annual: number, freq: string) {
  const opt = PAYMENT_FREQ_OPTIONS.find(o => o.value === freq) ?? PAYMENT_FREQ_OPTIONS[0];
  const n = opt.installments;
  const amt = Math.round(annual / n);
  return Array.from({ length: n }, (_, i) => ({
    dueDate: start.add(i * Math.floor(12 / n), 'month').format('YYYY-MM-DD'),
    amount: i === n - 1 ? annual - amt * (n - 1) : amt,
    label: n === 1 ? 'الدفعة الكاملة' : `دفعة ${i + 1}`,
    status: 'pending' as const,
  }));
}

function buildVisitSchedule(start: Dayjs, freq: string) {
  const opt = VISIT_FREQ_OPTIONS.find(o => o.value === freq) ?? VISIT_FREQ_OPTIONS[2];
  return Array.from({ length: opt.count }, (_, i) =>
    start.add(i * Math.floor(12 / opt.count), 'month').format('YYYY-MM-DD')
  );
}

const STEPS = [
  { title: 'أطراف العقد',      icon: <UserOutlined /> },
  { title: 'نطاق الخدمات',     icon: <ToolOutlined /> },
  { title: 'جدول الزيارات',    icon: <CalendarOutlined /> },
  { title: 'الرسوم والدفعات',  icon: <DollarOutlined /> },
  { title: 'الشروط والأحكام',  icon: <FileProtectOutlined /> },
  { title: 'المراجعة',          icon: <CheckCircleOutlined /> },
];
const AddAmcContractModal: React.FC<Props> = ({
  open, buildingName, ownerName, ownerPhone, ownerEmail, onClose, onSave,
}) => {
  const [step, setStep] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const isDirty = () => step > 0;
  const [form1] = Form.useForm();
  const [form3] = Form.useForm();
  const [form4] = Form.useForm();
  const [selectedServices, setSelectedServices] = useState<string[]>(
    SERVICE_CATALOGUE.filter(s => s.recommended).map(s => s.id)
  );
  const [excludedServices, setExcludedServices] = useState<string[]>(
    EXCLUDED_CATALOGUE.slice(0, 3).map(s => s.id)
  );
  const [paymentPreview, setPaymentPreview] = useState<ReturnType<typeof buildPaymentSchedule>>([]);
  const [customIncluded, setCustomIncluded] = useState<string[]>([]);
  const [customExcluded, setCustomExcluded] = useState<string[]>([]);
  const [customIncInput, setCustomIncInput] = useState('');
  const [customExcInput, setCustomExcInput] = useState('');
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [customTermInput, setCustomTermInput] = useState('');

  const refreshPreview = () => {
    const v4 = form4.getFieldsValue();
    const v3 = form3.getFieldsValue();
    if (v4?.startDate && v4?.annualValue) {
      setPaymentPreview(buildPaymentSchedule(v4.startDate, v4.annualValue, v4.paymentFreq ?? 'annual'));
    }
  };

  const handleNext = async () => {
    try {
      if (step === 0) await form1.validateFields();
      if (step === 2) await form3.validateFields();
      if (step === 3) { await form4.validateFields(); refreshPreview(); }
      setStep(s => s + 1);
    } catch {}
  };

  const doClose = () => {
    setStep(0);
    form1.resetFields(); form3.resetFields(); form4.resetFields();
    setSelectedServices(SERVICE_CATALOGUE.filter(s => s.recommended).map(s => s.id));
    setExcludedServices(EXCLUDED_CATALOGUE.slice(0, 3).map(s => s.id));
    setPaymentPreview([]);
    setCustomIncluded([]); setCustomExcluded([]);
    setCustomIncInput(''); setCustomExcInput('');
    setSelectedTerms([]); setCustomTerms([]); setCustomTermInput('');
    setCloseConfirmOpen(false);
    onClose();
  };

  const handleClose = () => {
    setCloseConfirmOpen(true);
  };

  const handleSave = () => {
    const v1 = form1.getFieldsValue();
    const v3 = form3.getFieldsValue();
    const v4 = form4.getFieldsValue();
    const start: Dayjs = v4.startDate;
    const end: Dayjs = v4.endDate ?? start.add(1, 'year').subtract(1, 'day');
    const visitFreq = v3.visitFrequency ?? 'quarterly';
    const visitOpt = VISIT_FREQ_OPTIONS.find(o => o.value === visitFreq)!;
    const schedule = buildVisitSchedule(start, visitFreq);
    const payments = buildPaymentSchedule(start, v4.annualValue, v4.paymentFreq ?? 'annual');
    const contract: AmcContract = {
      id: `AMC-${dayjs().year()}-${String(Date.now()).slice(-4)}`,
      contractNo: `AMC-BLD-${dayjs().year()}-${String(Date.now()).slice(-3)}`,
      vendor: OUR_COMPANY.name, vendorContact: OUR_COMPANY.phone, vendorEmail: OUR_COMPANY.email,
      ownerName: v1.ownerName ?? ownerName ?? '',
      ownerPhone: v1.ownerPhone ?? ownerPhone ?? '',
      ownerEmail: v1.ownerEmail ?? ownerEmail ?? '',
      startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD'),
      annualValue: v4.annualValue, currency: 'AED', status: 'active',
      scope: selectedServices.map(id => SERVICE_CATALOGUE.find(s => s.id === id)!.label),
      excludedScope: excludedServices.map(id => EXCLUDED_CATALOGUE.find(s => s.id === id)!.label),
      visitFrequency: visitOpt.label, visitsTotal: visitOpt.count, visitsDone: 0,
      visitSchedule: schedule, paymentSchedule: payments,
      lastVisit: null, lastVisitReport: '', nextVisit: schedule[0] ?? null,
      responseTime: v3.responseTime ?? '4h',
      emergencyIncluded: v3.emergencyIncluded ?? false,
      notes: v3.notes ?? '',
      terms: selectedTerms.map(id => TERMS_CATALOGUE.find(t => t.id === id)?.text ?? id),
      customTerms,
    };
    onSave(contract);
    message.success('تم إنشاء عقد AMC بنجاح');
    handleClose();
  };

  /* ── Step renderers ── */
  const renderStep0 = () => (
    <Form form={form1} layout="vertical" style={{ direction: 'rtl' }}>
      {/* FIRST PARTY — building owner */}
      <div style={{ background: '#f6ffed', borderRadius: 12, padding: '16px 18px', marginBottom: 16, border: `2px solid ${PRIMARY}44` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ background: PRIMARY, color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '2px 10px' }}>الطرف الأول</div>
          <Text strong style={{ fontSize: 13, color: PRIMARY }}>مالك / مستأجر المبنى</Text>
        </div>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="ownerName" label="الاسم الكامل" initialValue={ownerName} rules={[{ required: true, message: 'مطلوب' }]}>
              <Input prefix={<UserOutlined />} placeholder="اسم المالك أو المستأجر" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ownerPhone" label="رقم الهاتف" initialValue={ownerPhone}>
              <Input placeholder="+971XXXXXXXXX" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ownerEmail" label="البريد الإلكتروني" initialValue={ownerEmail} rules={[{ type: 'email', message: 'بريد غير صالح' }]}>
              <Input placeholder="owner@email.com" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ownerIdNo" label="رقم الهوية / السجل التجاري">
              <Input placeholder="اختياري" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ownerAddress" label="عنوان المراسلة">
              <Input placeholder="أبوظبي، الإمارات" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      {/* SECOND PARTY — our company (fixed) */}
      <div style={{ background: 'linear-gradient(135deg,#e8f5e9,#f1f8e9)', borderRadius: 12, padding: '16px 18px', border: `2px solid ${PRIMARY}66`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 60, height: 60, background: `${PRIMARY}18`, borderRadius: '0 0 0 60px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ background: GOLD, color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '2px 10px' }}>الطرف الثاني</div>
          <Text strong style={{ fontSize: 13, color: PRIMARY }}>مزود خدمة الغاز</Text>
          <Tag color="success" style={{ marginInlineStart: 'auto', fontSize: 11 }}>ثابت</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg,${PRIMARY},#2e7d32)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 22 }}>🔥</span>
          </div>
          <div>
            <Text strong style={{ fontSize: 15, color: PRIMARY, display: 'block' }}>{OUR_COMPANY.name}</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>{OUR_COMPANY.nameEn}</Text>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 14 }}>
          {[
            { label: 'هاتف', value: OUR_COMPANY.phone },
            { label: 'بريد', value: OUR_COMPANY.email },
            { label: 'العنوان', value: OUR_COMPANY.address },
            { label: 'السجل التجاري', value: OUR_COMPANY.crNo },
            { label: 'الرقم الضريبي', value: OUR_COMPANY.trn },
  ,
          { title: 'الشروط والأحكام', bg: '#f9f0ff', rows: [
            { label: 'بنود مختارة', value: `${selectedTerms.length} بند` },
            { label: 'بنود مخصصة', value: `${customTerms.length} بند` },
          ], extra: (
            <div style={{ marginTop: 8 }}>
              {selectedTerms.slice(0, 3).map(id => {
                const t = TERMS_CATALOGUE.find(x => x.id === id);
                return t ? <div key={id} style={{ fontSize: 11, color: '#555', marginBottom: 4, padding: '4px 8px', background: '#ede7f6', borderRadius: 6 }}>• {t.text.slice(0, 60)}{t.text.length > 60 ? '…' : ''}</div> : null;
              })}
              {selectedTerms.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>و {selectedTerms.length - 3} بنود أخرى…</Text>}
              {customTerms.slice(0, 2).map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: '#ad6800', marginTop: 2, padding: '4px 8px', background: '#fffbe6', borderRadius: 6 }}>★ {t.slice(0, 60)}{t.length > 60 ? '…' : ''}</div>
              ))}
            </div>
          ) }
        ].map(row => (
            <div key={row.label} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 10px' }}>
              <Text style={{ fontSize: 10, color: '#888', display: 'block' }}>{row.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>{row.value}</Text>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.5)', borderRadius: 8, border: '1px dashed #a5d6a7' }}>
          <Text style={{ fontSize: 11, color: '#555' }}>
            🔒 بيانات الطرف الثاني ثابتة ومرتبطة بحساب شركتك — لتغييرها راجع إعدادات النظام
          </Text>
        </div>
      </div>
    </Form>
  );

  const renderStep1 = () => (
    <div style={{ direction: 'rtl' }}>
      <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
        message="اختر الخدمات من القائمة أو أضف خدمات مخصصة" />

      {/* ── Included services ── */}
      <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 10 }}>
        <CheckCircleOutlined style={{ marginInlineEnd: 6, color: '#52c41a' }} />الخدمات المشمولة
      </Text>
      <div style={{ background: '#fafafa', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f0f0f0' }}>
        {(['safety','meter','report','extra'] as const).map(cat => {
          const catLabel: Record<string, string> = { safety: 'السلامة', meter: 'العدادات', report: 'التقارير', extra: 'إضافي' };
          const catColor: Record<string, string> = { safety: 'green', meter: 'blue', report: 'purple', extra: 'orange' };
          return (
            <div key={cat} style={{ marginBottom: 10 }}>
              <Tag color={catColor[cat]} style={{ fontSize: 11, marginBottom: 6 }}>{catLabel[cat]}</Tag>
              {SERVICE_CATALOGUE.filter(s => s.category === cat).map(s => (
                <div key={s.id} onClick={() => setSelectedServices(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', marginBottom: 3, cursor: 'pointer', borderRadius: 8, border: `1px solid ${selectedServices.includes(s.id) ? '#b7eb8f' : '#f0f0f0'}`, background: selectedServices.includes(s.id) ? '#f6ffed' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${selectedServices.includes(s.id) ? '#52c41a' : '#d9d9d9'}`, background: selectedServices.includes(s.id) ? '#52c41a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedServices.includes(s.id) && <CheckCircleOutlined style={{ color: '#fff', fontSize: 9 }} />}
                    </div>
                    <Text style={{ fontSize: 12 }}>{s.label}</Text>
                  </div>
                  {s.recommended && <Tag style={{ fontSize: 10, margin: 0 }} color="green">موصى به</Tag>}
                </div>
              ))}
            </div>
          );
        })}
        {customIncluded.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <Tag color="cyan" style={{ fontSize: 11, marginBottom: 6 }}>مخصصة</Tag>
            {customIncluded.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', marginBottom: 3, borderRadius: 8, border: '1px solid #b5f5ec', background: '#e6fffb' }}>
                <Text style={{ fontSize: 12 }}>{item}</Text>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setCustomIncluded(prev => prev.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Input size="small" value={customIncInput} onChange={e => setCustomIncInput(e.target.value)}
          onPressEnter={() => { if (customIncInput.trim()) { setCustomIncluded(p => [...p, customIncInput.trim()]); setCustomIncInput(''); } }}
          placeholder="أضف خدمة مشمولة مخصصة..." style={{ borderRadius: 8, fontSize: 12 }} />
        <Button size="small" type="primary" icon={<PlusOutlined />}
          style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8 }}
          onClick={() => { if (customIncInput.trim()) { setCustomIncluded(p => [...p, customIncInput.trim()]); setCustomIncInput(''); } }}>
          إضافة
        </Button>
      </div>

      {/* ── Excluded services ── */}
      <Text strong style={{ fontSize: 13, color: '#ff4d4f', display: 'block', marginBottom: 10 }}>
        <CloseOutlined style={{ marginInlineEnd: 6 }} />الخدمات المستثناة
      </Text>
      <div style={{ background: '#fff1f0', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #ffccc7' }}>
        {EXCLUDED_CATALOGUE.map(s => (
          <div key={s.id} onClick={() => setExcludedServices(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 3, cursor: 'pointer', borderRadius: 8, border: `1px solid ${excludedServices.includes(s.id) ? '#ffa39e' : '#ffe0de'}`, background: excludedServices.includes(s.id) ? '#fff1f0' : '#fff' }}>
            <div style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${excludedServices.includes(s.id) ? '#ff4d4f' : '#d9d9d9'}`, background: excludedServices.includes(s.id) ? '#ff4d4f' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {excludedServices.includes(s.id) && <CloseOutlined style={{ color: '#fff', fontSize: 9 }} />}
            </div>
            <Text style={{ fontSize: 12 }}>{s.label}</Text>
          </div>
        ))}
        {customExcluded.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <Tag color="red" style={{ fontSize: 11, marginBottom: 6 }}>مخصصة</Tag>
            {customExcluded.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', marginBottom: 3, borderRadius: 8, border: '1px solid #ffa39e', background: '#fff2f0' }}>
                <Text style={{ fontSize: 12 }}>{item}</Text>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setCustomExcluded(prev => prev.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Input size="small" value={customExcInput} onChange={e => setCustomExcInput(e.target.value)}
          onPressEnter={() => { if (customExcInput.trim()) { setCustomExcluded(p => [...p, customExcInput.trim()]); setCustomExcInput(''); } }}
          placeholder="أضف استثناء مخصصاً..." style={{ borderRadius: 8, fontSize: 12 }} />
        <Button size="small" danger
          icon={<PlusOutlined />} style={{ borderRadius: 8 }}
          onClick={() => { if (customExcInput.trim()) { setCustomExcluded(p => [...p, customExcInput.trim()]); setCustomExcInput(''); } }}>
          إضافة
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Tag color="green">{selectedServices.length + customIncluded.length} مشمولة</Tag>
        <Tag color="red">{excludedServices.length + customExcluded.length} مستثناة</Tag>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <Form form={form3} layout="vertical" style={{ direction: 'rtl' }}
      initialValues={{ visitFrequency: 'quarterly', responseTime: '4h', emergencyIncluded: true }}>
      <Form.Item name="visitFrequency" label="تكرار الزيارات" rules={[{ required: true }]}>
        <Radio.Group style={{ width: '100%' }}>
          <Row gutter={[10, 10]}>
            {VISIT_FREQ_OPTIONS.map(opt => (
              <Col span={8} key={opt.value}>
                <Radio.Button value={opt.value} style={{ width: '100%', textAlign: 'center', borderRadius: 8, height: 'auto', padding: '10px 6px', lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{opt.count} زيارة</div>
                </Radio.Button>
              </Col>
            ))}
          </Row>
        </Radio.Group>
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="preferredDay" label="اليوم المفضل">
            <Select placeholder="اختياري">
              {['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'].map(d => <Option key={d} value={d}>{d}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="preferredTime" label="الوقت المفضل">
            <Select placeholder="اختياري">
              {['صباحاً (8ص-12م)','مساءً (1م-5م)','مرن'].map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="responseTime" label="وقت الاستجابة للطوارئ" rules={[{ required: true }]}>
            <Select>{RESPONSE_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}</Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="emergencyIncluded" label="تغطية الطوارئ" valuePropName="checked">
            <Switch checkedChildren="مشمولة" unCheckedChildren="غير مشمولة" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="notes" label="ملاحظات / شروط خاصة">
            <TextArea rows={3} placeholder="شروط خاصة، ملاحظات..." maxLength={300} showCount />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  const renderStep3 = () => (
    <Form form={form4} layout="vertical" style={{ direction: 'rtl' }}
      initialValues={{ paymentFreq: 'annual', startDate: dayjs(), endDate: dayjs().add(1,'year').subtract(1,'day') }}
      onValuesChange={refreshPreview}>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="startDate" label="تاريخ البداية" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="endDate" label="تاريخ الانتهاء">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="اختياري" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="annualValue" label="القيمة السنوية (د.إ)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="48,000" addonAfter="د.إ / سنة"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="paymentFreq" label="جدول الدفع">
            <Radio.Group style={{ width: '100%' }}>
              <Row gutter={[10, 10]}>
                {PAYMENT_FREQ_OPTIONS.map(opt => (
                  <Col span={12} key={opt.value}>
                    <Radio.Button value={opt.value} style={{ width: '100%', textAlign: 'center', borderRadius: 8, height: 'auto', padding: '10px 6px', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
                    </Radio.Button>
                  </Col>
                ))}
              </Row>
            </Radio.Group>
          </Form.Item>
        </Col>
        {paymentPreview.length > 0 && (
          <Col span={24}>
            <div style={{ background: '#f6ffed', borderRadius: 10, padding: '14px', border: `1px solid ${PRIMARY}33` }}>
              <Text strong style={{ fontSize: 12, color: PRIMARY, display: 'block', marginBottom: 10 }}>
                <BankOutlined style={{ marginInlineEnd: 6 }} />معاينة جدول الدفعات
              </Text>
              <Table size="small" pagination={false} dataSource={paymentPreview} rowKey="dueDate"
                columns={[
                  { title: 'الدفعة',          dataIndex: 'label',   render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                  { title: 'تاريخ الاستحقاق', dataIndex: 'dueDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                  { title: 'المبلغ',           dataIndex: 'amount',  render: (v: number) => <Text strong style={{ color: PRIMARY, fontSize: 12 }}>{v.toLocaleString()} د.إ</Text> },
                ]}
              />
            </div>
          </Col>
        )}
      </Row>
    </Form>
  );

  const renderStep4TC = () => (
    <div style={{ direction: 'rtl' }}>
      <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
        message="اختر الشروط والأحكام من القائمة أو أضف بنوداً مخصصة" />

      {/* ── T&C from catalogue ── */}
      <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 12 }}>
        <FileProtectOutlined style={{ marginInlineEnd: 6 }} />قائمة الشروط والأحكام
      </Text>
      {Object.entries(TERMS_CATEGORIES).map(([catKey, catMeta]) => {
        const items = TERMS_CATALOGUE.filter(t => t.category === catKey);
        if (!items.length) return null;
        return (
          <div key={catKey} style={{ marginBottom: 14 }}>
            <Tag color={catMeta.color} style={{ fontSize: 11, marginBottom: 8, borderRadius: 6 }}>{catMeta.label}</Tag>
            {items.map(t => {
              const sel = selectedTerms.includes(t.id);
              return (
                <div key={t.id}
                  onClick={() => setSelectedTerms(prev => sel ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', marginBottom: 4, cursor: 'pointer', borderRadius: 8, border: `1px solid ${sel ? '#91caff' : '#f0f0f0'}`, background: sel ? '#e6f4ff' : '#fafafa', transition: 'all 0.15s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${sel ? '#1677ff' : '#d9d9d9'}`, background: sel ? '#1677ff' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {sel && <CheckCircleOutlined style={{ color: '#fff', fontSize: 9 }} />}
                  </div>
                  <Text style={{ fontSize: 12, lineHeight: 1.6, color: sel ? '#1677ff' : '#333' }}>{t.text}</Text>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Custom terms ── */}
      <div style={{ marginTop: 18, background: '#fffbe6', borderRadius: 10, padding: '14px', border: '1px solid #ffe58f' }}>
        <Text strong style={{ fontSize: 13, color: '#ad6800', display: 'block', marginBottom: 10 }}>
          <EditOutlined style={{ marginInlineEnd: 6 }} />إضافة بند مخصص
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input.TextArea rows={2} value={customTermInput} onChange={e => setCustomTermInput(e.target.value)}
            placeholder="اكتب البند المخصص هنا..." style={{ borderRadius: 8, fontSize: 12, resize: 'none' }} />
          <Button type="primary"
            icon={<PlusOutlined />}
            style={{ background: GOLD, borderColor: GOLD, borderRadius: 8, height: 'auto', minWidth: 80, color: '#fff' }}
            onClick={() => { if (customTermInput.trim()) { setCustomTerms(p => [...p, customTermInput.trim()]); setCustomTermInput(''); } }}>
            إضافة بند
          </Button>
        </div>
        {customTerms.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>البنود المخصصة المضافة:</Text>
            {customTerms.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: '1px solid #ffd666', background: '#fffef0' }}>
                <Text style={{ fontSize: 11, color: '#888', minWidth: 18, paddingTop: 2 }}>{i + 1}.</Text>
                <Text style={{ fontSize: 12, flex: 1, lineHeight: 1.6 }}>{t}</Text>
                <Button type="text" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => setCustomTerms(prev => prev.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Tag color="blue">{selectedTerms.length} بند مختار</Tag>
        {customTerms.length > 0 && <Tag color="gold">{customTerms.length} بند مخصص</Tag>}
      </div>
    </div>
  );

  const renderStep4 = () => {
    const v1 = form1.getFieldsValue();
    const v3 = form3.getFieldsValue();
    const v4 = form4.getFieldsValue();
    return (
      <div style={{ direction: 'rtl' }}>
        <Alert type="success" showIcon style={{ marginBottom: 14, borderRadius: 8 }}
          message="راجع تفاصيل العقد — يمكنك العودة لأي خطوة للتعديل" />
        {[
          { title: 'أطراف العقد', bg: '#f6ffed', rows: [
            { label: 'الطرف الأول — المالك', value: v1.ownerName },
            { label: 'هاتف المالك', value: v1.ownerPhone },
            { label: 'الطرف الثاني — مزود الخدمة', value: OUR_COMPANY.name },
            { label: 'هاتف مزود الخدمة', value: OUR_COMPANY.phone },
          ]},
          { title: 'الخدمات', bg: '#e8f5e9', rows: [
            { label: 'خدمات مشمولة', value: `${selectedServices.length + customIncluded.length} خدمة` },
            { label: 'خدمات مستثناة', value: `${excludedServices.length + customExcluded.length} خدمة` },
          ], extra: (
            <div style={{ marginTop: 8 }}>
              {selectedServices.slice(0, 4).map(id => <Tag key={id} color="green" style={{ fontSize: 11, marginBottom: 4 }}>{SERVICE_CATALOGUE.find(s => s.id === id)!.label}</Tag>)}
              {selectedServices.length > 4 && <Tag style={{ fontSize: 11 }}>+{selectedServices.length - 4}</Tag>}
            </div>
          )},
          { title: 'الزيارات', bg: '#e6f4ff', rows: [
            { label: 'التكرار', value: VISIT_FREQ_OPTIONS.find(o => o.value === v3.visitFrequency)?.label ?? '—' },
            { label: 'عدد الزيارات', value: `${VISIT_FREQ_OPTIONS.find(o => o.value === v3.visitFrequency)?.count ?? 0} زيارة / سنة` },
            { label: 'وقت الاستجابة', value: RESPONSE_OPTIONS.find(o => o.value === v3.responseTime)?.label ?? '—' },
            { label: 'تغطية الطوارئ', value: v3.emergencyIncluded ? 'مشمولة' : 'غير مشمولة' },
          ]},
          { title: 'الرسوم والدفعات', bg: '#fff7e6', rows: [
            { label: 'تاريخ البداية', value: v4.startDate ? (v4.startDate as Dayjs).format('YYYY-MM-DD') : '—' },
            { label: 'تاريخ الانتهاء', value: v4.endDate ? (v4.endDate as Dayjs).format('YYYY-MM-DD') : '—' },
            { label: 'القيمة السنوية', value: v4.annualValue ? `${Number(v4.annualValue).toLocaleString()} د.إ` : '—' },
            { label: 'جدول الدفع', value: PAYMENT_FREQ_OPTIONS.find(o => o.value === v4.paymentFreq)?.label ?? '—' },
          ]},
          { title: 'الشروط والأحكام', bg: '#f9f0ff', rows: [
            { label: 'بنود مختارة', value: `${selectedTerms.length} بند` },
            { label: 'بنود مخصصة', value: `${customTerms.length} بند` },
          ], extra: (
            <div style={{ marginTop: 8 }}>
              {selectedTerms.slice(0, 3).map(id => {
                const t = TERMS_CATALOGUE.find(x => x.id === id);
                return t ? <div key={id} style={{ fontSize: 11, color: '#555', marginBottom: 4, padding: '4px 8px', background: '#ede7f6', borderRadius: 6 }}>• {t.text.slice(0, 65)}{t.text.length > 65 ? '…' : ''}</div> : null;
              })}
              {selectedTerms.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>وبنود {selectedTerms.length - 3} أخرى…</Text>}
              {customTerms.slice(0, 2).map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: '#ad6800', marginTop: 2, padding: '4px 8px', background: '#fffbe6', borderRadius: 6 }}>★ {t.slice(0, 65)}{t.length > 65 ? '…' : ''}</div>
              ))}
            </div>
          ) },
        ].map(sec => (
          <div key={sec.title} style={{ background: sec.bg, borderRadius: 10, padding: '13px 15px', marginBottom: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
            <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 8 }}>{sec.title}</Text>
            {sec.rows.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <Text style={{ color: '#888', fontSize: 12 }}>{r.label}</Text>
                <Text strong style={{ fontSize: 12 }}>{r.value ?? '—'}</Text>
              </div>
            ))}
            {(sec as any).extra}
          </div>
        ))}
        {v3.notes && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 13px' }}>
            <Text style={{ fontSize: 12, color: '#886600' }}>
              <FileTextOutlined style={{ marginInlineEnd: 6 }} />ملاحظات: {v3.notes}
            </Text>
          </div>
        )}
      </div>
    );
  };

  const stepContent = [renderStep0(), renderStep1(), renderStep2(), renderStep3(), renderStep4TC(), renderStep4()];

  return (
    <>
    <Modal open={open} onCancel={handleClose} maskClosable destroyOnHidden width={680}
      style={{ direction: 'rtl' }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${PRIMARY},#2e7d32)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ToolOutlined style={{ color: '#fff', fontSize: 17 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>إنشاء عقد AMC جديد</div>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{buildingName}</div>
          </div>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleClose} icon={<CloseOutlined />}>إلغاء</Button>
          <Space>
            {step > 0 && <Button onClick={() => setStep(s => s - 1)}>السابق</Button>}
            {step < STEPS.length - 1
              ? <Button type="primary" onClick={handleNext} style={{ background: PRIMARY, borderColor: PRIMARY }}>التالي</Button>
              : <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSave} style={{ background: GOLD, borderColor: GOLD, fontWeight: 600, paddingInline: 24 }}>إنشاء العقد</Button>
            }
          </Space>
        </div>
      }
    >
      <Steps current={step} size="small" style={{ marginBottom: 20 }}
        items={STEPS.map(s => ({ title: s.title, icon: s.icon }))} />
      <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? PRIMARY : '#e8f5e9', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ minHeight: 360, maxHeight: '60vh', overflowY: 'auto', paddingInlineEnd: 4 }}>
        {stepContent[step]}
      </div>
    </Modal>

    {/* ── Exit confirmation ── */}
    <Modal
      open={closeConfirmOpen}
      onCancel={() => setCloseConfirmOpen(false)}
      width={380}
      centered
      closable={false}
      footer={null}
      style={{ direction: 'rtl' }}
      styles={{ body: { padding: '28px 24px 20px', direction: 'rtl' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>إلغاء إنشاء العقد؟</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fa8c16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ExclamationCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
        </div>
        {/* body */}
        <Typography.Text style={{ fontSize: 13, color: '#555', textAlign: 'right', display: 'block', width: '100%' }}>
          سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟
        </Typography.Text>
        {/* buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-start', width: '100%' }}>
          <Button danger style={{ borderRadius: 8, minWidth: 100 }} onClick={doClose}>
            نعم، إلغاء
          </Button>
          <Button style={{ borderRadius: 8, minWidth: 100 }} onClick={() => setCloseConfirmOpen(false)}>
            لا، متابعة
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
};

export default AddAmcContractModal;
