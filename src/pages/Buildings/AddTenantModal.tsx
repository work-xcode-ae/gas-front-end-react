import React, { useState } from 'react';
import {
  Modal, Steps, Form, Input, Select, DatePicker, Button,
  Row, Col, Divider, Tag, Avatar, Typography, Space, Alert,
} from 'antd';
import {
  UserOutlined, IdcardOutlined, PhoneOutlined, MailOutlined,
  EnvironmentOutlined, HomeOutlined, CheckCircleOutlined, ArrowRightOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';

export interface TenantFormData {
  nameAr: string; nameEn: string; email: string; phone: string;
  emiratesId: string; nationality: string; dob: string;
  city: string; address: string; unitKey: string; unitNo: string; floor: number;
}

interface UnitOption { key: string; no: string; floor: number; typeLabel: string; tenant: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  buildingUnits: UnitOption[];
  onAdd: (data: TenantFormData) => void;
}

const STEPS = ['البيانات الشخصية', 'الهوية والعنوان', 'تعيين الوحدة', 'المراجعة'];

const NATIONALITIES = ['إماراتي', 'سعودي', 'مصري', 'أردني', 'هندي', 'باكستاني', 'بنغلاديشي', 'فلبيني', 'سوداني', 'يمني', 'سوري', 'لبناني', 'أخرى'];
const CITIES = ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'رأس الخيمة', 'الفجيرة', 'أم القيوين', 'العين', 'الظفرة'];

const AddTenantModal: React.FC<Props> = ({ open, onClose, buildingUnits, onAdd }) => {
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<Partial<TenantFormData>>({});

  const freeUnits = buildingUnits.filter(u => !u.tenant);

  const handleClose = () => { form.resetFields(); setStep(0); setPreview({}); onClose(); };

  const next = async () => {
    const fields: Record<number, string[]> = {
      0: ['nameAr', 'nameEn', 'phone', 'email'],
      1: ['nationality', 'city', 'address'],
      2: ['unitKey'],
    };
    try {
      await form.validateFields(fields[step] ?? []);
      setPreview({ ...preview, ...form.getFieldsValue() });
      setStep(s => s + 1);
    } catch {}
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const unit = buildingUnits.find(u => u.key === vals.unitKey);
      setSubmitting(true);
      setTimeout(() => {
        onAdd({ ...vals, unitNo: unit?.no ?? '', floor: unit?.floor ?? 0, dob: vals.dob ? vals.dob.format('YYYY-MM-DD') : '' });
        setSubmitting(false);
        handleClose();
      }, 600);
    } catch {}
  };

  const initials = (name: string) => name ? name.split(' ').map((w: string) => w[0]).slice(0, 2).join('') : '؟';

  const ReviewRow = ({ label, value }: { label: string; value?: string }) => (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
      <Text type="secondary" style={{ fontSize: 12, minWidth: 130, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: 500 }}>{value || '—'}</Text>
    </div>
  );

  return (
    <Modal open={open} onCancel={handleClose} width={620} title={null} footer={null} destroyOnClose styles={{ body: { padding: 0 } }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY}18, ${PRIMARY}06)`, borderBottom: `3px solid ${PRIMARY}`, padding: '18px 24px 14px', borderRadius: '8px 8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
            <UserOutlined />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, color: PRIMARY }}>إضافة مستأجر جديد</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>أدخل بيانات المستأجر وخصص له وحدة</Text>
          </div>
        </div>
        <Steps current={step} size="small" style={{ marginTop: 14 }} items={STEPS.map(t => ({ title: t }))} />
      </div>

      <div style={{ padding: '20px 24px 8px' }}>
        <Form form={form} layout="vertical" size="middle">

          {/* ── Step 0: Personal Info ── */}
          {step === 0 && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="nameAr" label="الاسم الكامل (عربي)" rules={[{ required: true, message: 'أدخل الاسم بالعربي' }]}>
                    <Input placeholder="مثال: أحمد علي محمد" prefix={<UserOutlined style={{ color: '#ccc' }} />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nameEn" label="Full Name (English)" rules={[{ required: true, message: 'Enter name in English' }]}>
                    <Input placeholder="e.g. Ahmed Ali Mohammed" dir="ltr" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="phone" label="رقم الجوال" rules={[{ required: true, message: 'أدخل رقم الجوال' }]}>
                    <Input placeholder="+971 5X XXX XXXX" prefix={<PhoneOutlined style={{ color: '#ccc' }} />} dir="ltr" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="البريد الإلكتروني" rules={[{ type: 'email', message: 'بريد غير صحيح' }]}>
                    <Input placeholder="example@email.com" prefix={<MailOutlined style={{ color: '#ccc' }} />} dir="ltr" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="nationality" label="الجنسية" rules={[{ required: true, message: 'اختر الجنسية' }]}>
                    <Select placeholder="اختر الجنسية" showSearch>
                      {NATIONALITIES.map(n => <Option key={n} value={n}>{n}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="dob" label="تاريخ الميلاد">
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" maxDate={dayjs().subtract(18, 'year')} placeholder="اختر التاريخ" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* ── Step 1: Emirates ID + Address ── */}
          {step === 1 && (
            <>
              <Form.Item name="emiratesId" label="رقم الهوية الإماراتية (Emirates ID)" rules={[{ required: false }]}>
                <Input placeholder="784-YYYY-XXXXXXX-X" prefix={<IdcardOutlined style={{ color: '#ccc' }} />} dir="ltr" maxLength={18} />
              </Form.Item>
              <Alert type="info" showIcon message="سيتم استخدام رقم الهوية للتحقق من هوية المستأجر في عقد الغاز" style={{ marginBottom: 16, fontSize: 12 }} />
              <Divider style={{ margin: '4px 0 16px' }}>العنوان</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="city" label="المدينة" rules={[{ required: true, message: 'اختر المدينة' }]}>
                    <Select placeholder="اختر المدينة">
                      {CITIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item name="address" label="العنوان التفصيلي">
                    <Input placeholder="اسم الشارع، المنطقة..." prefix={<EnvironmentOutlined style={{ color: '#ccc' }} />} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* ── Step 2: Unit Assignment ── */}
          {step === 2 && (
            <>
              {freeUnits.length === 0 ? (
                <Alert type="warning" showIcon message="لا توجد وحدات شاغرة في هذا المبنى" style={{ marginBottom: 16 }} />
              ) : (
                <Form.Item name="unitKey" label="اختر الوحدة" rules={[{ required: true, message: 'اختر وحدة للمستأجر' }]}>
                  <Select placeholder="اختر الوحدة الشاغرة" showSearch optionLabelProp="label">
                    {freeUnits.map(u => (
                      <Option key={u.key} value={u.key} label={`وحدة ${u.no} — الطابق ${u.floor}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span><HomeOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} /><strong>وحدة {u.no}</strong> — الطابق {u.floor}</span>
                          <Tag color="success" style={{ fontSize: 10 }}>{u.typeLabel}</Tag>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
              <Alert type="info" showIcon message="بعد إضافة المستأجر يمكنك إنشاء عقد الغاز من بطاقة المستأجر" style={{ fontSize: 12 }} />
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (() => {
            const vals = form.getFieldsValue();
            const unit = buildingUnits.find(u => u.key === vals.unitKey);
            return (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <Avatar size={56} style={{ background: PRIMARY, fontSize: 18, fontWeight: 700 }}>{initials(vals.nameAr || '')}</Avatar>
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ fontSize: 15, display: 'block' }}>{vals.nameAr}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{vals.nameEn}</Text>
                  </div>
                </div>
                <Divider style={{ margin: '8px 0 12px' }}>البيانات الشخصية</Divider>
                <ReviewRow label="الجوال" value={vals.phone} />
                <ReviewRow label="البريد" value={vals.email} />
                <ReviewRow label="الجنسية" value={vals.nationality} />
                <ReviewRow label="تاريخ الميلاد" value={vals.dob?.format?.('YYYY-MM-DD')} />
                <Divider style={{ margin: '12px 0' }}>الهوية والعنوان</Divider>
                <ReviewRow label="رقم الهوية الإماراتية" value={vals.emiratesId} />
                <ReviewRow label="المدينة" value={vals.city} />
                <ReviewRow label="العنوان" value={vals.address} />
                <Divider style={{ margin: '12px 0' }}>الوحدة المعينة</Divider>
                {unit ? (
                  <div style={{ background: `${PRIMARY}08`, borderRadius: 8, padding: '10px 14px', border: `1px solid ${PRIMARY}30` }}>
                    <Space>
                      <HomeOutlined style={{ color: PRIMARY }} />
                      <Text strong style={{ color: PRIMARY }}>وحدة {unit.no}</Text>
                      <Text type="secondary">— الطابق {unit.floor}</Text>
                      <Tag color="success">{unit.typeLabel}</Tag>
                    </Space>
                  </div>
                ) : <Text type="secondary">لم يتم تعيين وحدة</Text>}
              </div>
            );
          })()}

        </Form>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={step === 0 ? handleClose : () => setStep(s => s - 1)} icon={step > 0 ? <ArrowRightOutlined /> : undefined}>
          {step === 0 ? 'إلغاء' : 'السابق'}
        </Button>
        {step < 3 ? (
          <Button type="primary" icon={<ArrowLeftOutlined />} iconPosition="end" onClick={next} style={{ background: PRIMARY, borderColor: PRIMARY }}>
            التالي
          </Button>
        ) : (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting} onClick={handleSave} style={{ background: PRIMARY, borderColor: PRIMARY }}>
            إضافة المستأجر
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default AddTenantModal;
