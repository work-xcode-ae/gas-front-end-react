import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Select, Input, DatePicker, Upload, Button,
  Row, Col, Tag, Alert, Divider, Switch, Radio, Typography, Space,
} from 'antd';
import {
  DisconnectOutlined, ThunderboltOutlined, WarningOutlined,
  SwapOutlined, UploadOutlined, UserOutlined, ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MeterRecord } from './meterTypes';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

export type ServiceType = 'disconnect' | 'connect' | 'report_issue' | 'replace';

interface Props {
  open: boolean;
  meter: MeterRecord | null;
  serviceType: ServiceType | null;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}

const SERVICE_META: Record<ServiceType, { icon: React.ReactNode; title: string; color: string; tag: string }> = {
  disconnect: { icon: <DisconnectOutlined />, title: 'طلب قطع الغاز',        color: '#ff4d4f', tag: 'قطع' },
  connect:    { icon: <ThunderboltOutlined />, title: 'طلب وصل الغاز',        color: PRIMARY,  tag: 'وصل' },
  report_issue:{ icon: <WarningOutlined />,   title: 'الإبلاغ عن عطل / مشكلة', color: '#fa8c16', tag: 'بلاغ' },
  replace:    { icon: <SwapOutlined />,        title: 'طلب استبدال العداد',   color: '#722ed1', tag: 'استبدال' },
};

const MeterServiceModal: React.FC<Props> = ({ open, meter, serviceType, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [source, setSource] = useState<'tenant' | 'admin'>('admin');
  const [urgent, setUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSource('admin');
      setUrgent(false);
      form.setFieldsValue({ requestDate: dayjs() });
    }
  }, [open, serviceType]);

  if (!meter || !serviceType) return null;

  const meta = SERVICE_META[serviceType];

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSubmitting(true);
      setTimeout(() => {
        onSave({ serviceType, meterId: meter.id, source, urgent, ...vals });
        setSubmitting(false);
      }, 600);
    } catch {}
  };

  /* ── Disconnect-specific fields ── */
  const DisconnectFields = () => (
    <>
      <Form.Item name="reason" label="سبب القطع" rules={[{ required: true, message: 'اختر السبب' }]}>
        <Select placeholder="اختر السبب">
          <Option value="nonpayment">عدم السداد</Option>
          <Option value="tenant_request">طلب المستأجر</Option>
          <Option value="maintenance">أعمال صيانة</Option>
          <Option value="safety">أسباب أمنية</Option>
          <Option value="other">أخرى</Option>
        </Select>
      </Form.Item>
      <Form.Item name="requestDate" label="تاريخ التنفيذ المطلوب">
        <DatePicker style={{ width: '100%' }} minDate={dayjs()} format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item name="notifyTenant" label="إشعار المستأجر" valuePropName="checked" initialValue={true}>
        <Switch checkedChildren="نعم" unCheckedChildren="لا" />
      </Form.Item>
    </>
  );

  /* ── Connect-specific fields ── */
  const ConnectFields = () => (
    <>
      <Form.Item name="reason" label="سبب الوصل" rules={[{ required: true, message: 'اختر السبب' }]}>
        <Select placeholder="اختر السبب">
          <Option value="payment_cleared">تسوية المديونية</Option>
          <Option value="new_tenant">مستأجر جديد</Option>
          <Option value="maintenance_done">انتهاء أعمال الصيانة</Option>
          <Option value="new_install">تركيب جديد</Option>
          <Option value="other">أخرى</Option>
        </Select>
      </Form.Item>
      <Form.Item name="requestDate" label="تاريخ التنفيذ المطلوب">
        <DatePicker style={{ width: '100%' }} minDate={dayjs()} format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item name="safetyCheck" label="فحص السلامة قبل الوصل" valuePropName="checked" initialValue={true}>
        <Switch checkedChildren="مطلوب" unCheckedChildren="غير مطلوب" />
      </Form.Item>
    </>
  );

  /* ── Report Issue-specific fields ── */
  const ReportIssueFields = () => (
    <>
      <Form.Item name="issueType" label="نوع العطل / المشكلة" rules={[{ required: true, message: 'اختر النوع' }]}>
        <Select placeholder="اختر نوع المشكلة">
          <Option value="gas_leak">تسريب غاز</Option>
          <Option value="smell">رائحة غاز</Option>
          <Option value="low_pressure">ضغط منخفض</Option>
          <Option value="meter_fault">عطل في العداد</Option>
          <Option value="display_fault">شاشة العداد معطلة</Option>
          <Option value="valve_fault">عطل في الصمام</Option>
          <Option value="other">أخرى</Option>
        </Select>
      </Form.Item>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="عاجل" style={{ marginBottom: 0 }}>
            <Switch
              checked={urgent}
              onChange={setUrgent}
              checkedChildren="عاجل 🚨"
              unCheckedChildren="عادي"
              style={urgent ? { background: '#ff4d4f' } : {}}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="priority" label="الأولوية" initialValue="medium">
            <Select>
              <Option value="high">عالية</Option>
              <Option value="medium">متوسطة</Option>
              <Option value="low">منخفضة</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      {urgent && (
        <Alert
          type="error"
          showIcon
          message="بلاغ عاجل — سيتم إرسال إشعار فوري لفريق الصيانة"
          style={{ marginBottom: 12 }}
        />
      )}
    </>
  );

  /* ── Replace-specific fields ── */
  const ReplaceFields = () => (
    <>
      <Form.Item name="reason" label="سبب الاستبدال" rules={[{ required: true, message: 'اختر السبب' }]}>
        <Select placeholder="اختر السبب">
          <Option value="damaged">تلف / كسر</Option>
          <Option value="expired">انتهاء صلاحية العداد</Option>
          <Option value="upgrade">ترقية إلى عداد ذكي</Option>
          <Option value="calibration_fail">فشل في معايرة</Option>
          <Option value="tamper">تلاعب / فك غير مصرح</Option>
          <Option value="other">أخرى</Option>
        </Select>
      </Form.Item>
      <Form.Item name="newMeterType" label="نوع العداد البديل" rules={[{ required: true, message: 'اختر النوع' }]}>
        <Select placeholder="اختر نوع العداد">
          <Option value="smart">ذكي (Smart)</Option>
          <Option value="standard">قياسي</Option>
          <Option value="prepaid">مدفوع مسبقاً (Prepaid)</Option>
        </Select>
      </Form.Item>
      <Form.Item name="requestDate" label="التاريخ المفضل للتنفيذ">
        <DatePicker style={{ width: '100%' }} minDate={dayjs()} format="YYYY-MM-DD" />
      </Form.Item>
    </>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={560}
      title={null}
      footer={null}
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${meta.color}15, ${meta.color}05)`,
        borderBottom: `3px solid ${meta.color}`,
        padding: '20px 24px 16px',
        borderRadius: '8px 8px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20,
          }}>
            {meta.icon}
          </div>
          <div>
            <Title level={5} style={{ margin: 0, color: meta.color }}>{meta.title}</Title>
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>{meter.id}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{meter.unit}</Text>
              {meter.tenant && (
                <>
                  <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
                  <Text style={{ fontSize: 12 }}><UserOutlined style={{ fontSize: 10 }} /> {meter.tenant}</Text>
                </>
              )}
            </Space>
          </div>
          <div style={{ marginInlineStart: 'auto' }}>
            <Tag color={meta.color} style={{ margin: 0 }}>{meta.tag}</Tag>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ padding: '20px 24px 8px' }}>
        <Form form={form} layout="vertical" size="middle">

          {/* Source */}
          <Form.Item label="مصدر الطلب" style={{ marginBottom: 16 }}>
            <Radio.Group
              value={source}
              onChange={e => setSource(e.target.value)}
              style={{ display: 'flex', gap: 8 }}
            >
              <Radio.Button value="admin" style={{ flex: 1, textAlign: 'center' }}>
                <ToolOutlined style={{ marginInlineEnd: 6 }} />إداري (مباشر)
              </Radio.Button>
              <Radio.Button value="tenant" style={{ flex: 1, textAlign: 'center' }}>
                <UserOutlined style={{ marginInlineEnd: 6 }} />مستأجر
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {source === 'tenant' && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="tenantName" label="اسم المستأجر" initialValue={meter.tenant ?? ''}>
                  <Input placeholder="اسم المستأجر" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="tenantPhone" label="رقم الجوال">
                  <Input placeholder="05xxxxxxxx" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider style={{ margin: '4px 0 16px' }} />

          {/* Type-specific fields */}
          {serviceType === 'disconnect'   && <DisconnectFields />}
          {serviceType === 'connect'      && <ConnectFields />}
          {serviceType === 'report_issue' && <ReportIssueFields />}
          {serviceType === 'replace'      && <ReplaceFields />}

          {/* Common: Description */}
          <Form.Item name="description" label="وصف / ملاحظات">
            <TextArea
              rows={3}
              placeholder="أي تفاصيل إضافية..."
              showCount
              maxLength={400}
            />
          </Form.Item>

          {/* Common: Photos */}
          <Form.Item name="photos" label="صور داعمة (اختياري)">
            <Upload listType="picture" accept="image/*" beforeUpload={() => false} maxCount={4}>
              <Button icon={<UploadOutlined />} size="small">رفع صورة</Button>
            </Upload>
          </Form.Item>

        </Form>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px 20px',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
      }}>
        <Button onClick={onClose}>إلغاء</Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={submitting}
          onClick={handleSave}
          style={{ background: meta.color, borderColor: meta.color }}
        >
          {serviceType === 'report_issue' ? 'إرسال البلاغ' : 'إرسال الطلب'}
        </Button>
      </div>
    </Modal>
  );
};

export default MeterServiceModal;
export type { ServiceType as MeterServiceType };
