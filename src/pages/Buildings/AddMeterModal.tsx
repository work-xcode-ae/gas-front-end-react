import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Button,
  Row, Col, Divider, Space, Typography, Tag, Steps,
  Alert, Switch, DatePicker, Tooltip, Badge, message, Upload
} from 'antd';
import {
  DashboardOutlined, HomeOutlined, UserOutlined,
  CheckCircleOutlined, InfoCircleOutlined, ThunderboltOutlined,
  SafetyOutlined, CalendarOutlined, BarcodeOutlined, CameraOutlined
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import arEG from 'antd/locale/ar_EG';
import { ConfigProvider } from 'antd';

const arLocaleShortDays = {
  ...arEG,
  DatePicker: {
    ...(arEG.DatePicker as object),
    lang: {
      ...((arEG.DatePicker as any)?.lang ?? {}),
      shortWeekDays: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
    },
  },
} as typeof arEG;

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

/* ─── Types ─────────────────────────────────────────────────── */
interface BuildingUnit {
  key: string;
  no: string;
  floor: number;
  typeLabel: string;
  tenant: string | null;
  meter?: string | null;   // existing meter id if already has one
}

interface NewMeterData {
  id: string;
  serial: string;
  unit: string;
  floor: number;
  type: string;
  brand: string;
  installDate: string;
  initialReading: number;
  calibrationDate: string;
  location: string;
  simCard?: string;
  notes: string;
  linkTenant: boolean;
}

interface AddMeterModalProps {
  open: boolean;
  onClose: () => void;
  buildingUnits: BuildingUnit[];
  nextMeterId: string;          // e.g. "M-026"
  onAdd?: (meter: NewMeterData) => void;
}

/* ─── Static data ────────────────────────────────────────────── */
const meterTypes = [
  { value: 'smart',    label: 'ذكي (Smart)',    color: 'blue' },
  { value: 'standard', label: 'عادي',           color: 'default' },
  { value: 'prepaid',  label: 'مسبق الدفع',    color: 'gold' },
];

const brands = [
  'Landis+Gyr', 'Itron', 'Elster', 'Honeywell',
  'Sensus', 'ZENNER', 'Kamstrup', 'Diehl',
];

/* ─── Step labels ────────────────────────────────────────────── */
const STEPS = [
  { title: 'الوحدة',     description: 'اختر الوحدة المستهدفة' },
  { title: 'العداد',     description: 'بيانات العداد الجديد' },
  { title: 'التركيب',   description: 'موقع التركيب والمعايرة' },
  { title: 'مراجعة',    description: 'تأكيد وحفظ' },
];

/* ─── Component ──────────────────────────────────────────────── */
const AddMeterModal: React.FC<AddMeterModalProps> = ({
  open,
  onClose,
  buildingUnits,
  nextMeterId,
  onAdd,
}) => {
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<BuildingUnit | null>(null);
  const [linkTenant, setLinkTenant] = useState(true);
  const [meterType, setMeterType] = useState('smart');

  /* Autofill meter ID when modal opens */
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        id: nextMeterId,
        installDate: dayjs(),
        initialReading: 0,
        type: 'smart',
        linkTenant: true,
      });
    }
  }, [open, nextMeterId, form]);

  const handleUnitChange = (unitNo: string) => {
    const u = buildingUnits.find(u => u.no === unitNo) ?? null;
    setSelectedUnit(u);
    form.setFieldsValue({ floor: u?.floor });
  };

  /* ── Navigation ── */
  const validateAndNext = async () => {
    const fieldsPerStep: Record<number, string[]> = {
      0: ['unit'],
      1: ['id', 'serial', 'type', 'brand'],
      2: ['installDate', 'calibrationDate', 'initialReading'],
    };
    try {
      await form.validateFields(fieldsPerStep[step] ?? []);
      setStep(s => s + 1);
    } catch { /* antd shows inline errors */ }
  };

  /* ── Submit ── */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await new Promise(r => setTimeout(r, 700));
      onAdd?.({
        ...values,
        floor: selectedUnit?.floor ?? 0,
        installDate: (values.installDate as Dayjs).format('YYYY-MM-DD'),
        calibrationDate: (values.calibrationDate as Dayjs).format('YYYY-MM-DD'),
        linkTenant,
      });
      message.success('تم إضافة العداد وربطه بالوحدة بنجاح');
      handleClose();
    } catch {
      message.error('يرجى مراجعة البيانات المطلوبة');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setStep(0);
    setSelectedUnit(null);
    setLinkTenant(true);
    setMeterType('smart');
    onClose();
  };

  /* ─── Step 0 — Select Unit ─────────────────────────────────── */
  const unitsWithMeter    = buildingUnits.filter(u => !!u.meter).length;
  const unitsWithoutMeter = buildingUnits.filter(u => !u.meter).length;

  const stepUnit = (
    <div>
      {unitsWithMeter > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14, borderRadius: 8 }}
          message={
            <span>
              {unitsWithMeter > 0 && (
                <><Text strong>{unitsWithMeter}</Text> وحدة لديها عداد غاز نشط بالفعل وتم استبعادها · </>
              )}
              <Text strong style={{ color: PRIMARY }}>{unitsWithoutMeter}</Text> وحدة متاحة للتعيين
            </span>
          }
        />
      )}
      <Form.Item
        name="unit"
        label="الوحدة"
        rules={[{ required: true, message: 'يرجى اختيار الوحدة' }]}
      >
        <Select
          showSearch
          size="large"
          placeholder="ابحث أو اختر الوحدة..."
          onChange={handleUnitChange}
          optionFilterProp="children"
          style={{ width: '100%' }}
        >
          {buildingUnits.filter(u => !u.meter).map(u => (
            <Option key={u.no} value={u.no}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <Text strong style={{ color: PRIMARY }}>وحدة {u.no}</Text>
                  <Text type="secondary" style={{ marginInlineStart: 8, fontSize: 12 }}>
                    طابق {u.floor} · {u.typeLabel}
                  </Text>
                </span>
                <Tag color="success" style={{ margin: 0 }}>
                  {u.tenant ? u.tenant : 'شاغرة'}
                </Tag>
              </div>
            </Option>
          ))}
        </Select>
      </Form.Item>

      {selectedUnit && (
        <div style={{
          background: `${PRIMARY}08`, border: `1px solid ${PRIMARY}25`,
          borderRadius: 10, padding: '14px 16px', marginTop: 4,
        }}>
          <Row gutter={24}>
            <Col span={12}>
              <div style={{ marginBottom: 8 }}>
                <HomeOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />
                <Text strong>وحدة {selectedUnit.no}</Text>
                <Text type="secondary" style={{ marginInlineStart: 8 }}>
                  طابق {selectedUnit.floor} · {selectedUnit.typeLabel}
                </Text>
              </div>
            </Col>
            <Col span={12}>
              {selectedUnit.tenant ? (
                <div>
                  <UserOutlined style={{ color: GOLD, marginInlineEnd: 6 }} />
                  <Text>{selectedUnit.tenant}</Text>
                  <Tag color="success" style={{ marginInlineStart: 8 }}>مستأجر نشط</Tag>
                </div>
              ) : (
                <div>
                  <UserOutlined style={{ color: '#ccc', marginInlineEnd: 6 }} />
                  <Text type="secondary">لا يوجد مستأجر حالياً</Text>
                </div>
              )}
            </Col>
          </Row>
          {selectedUnit.tenant && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={linkTenant}
                onChange={setLinkTenant}
                size="small"
                style={{ background: linkTenant ? PRIMARY : undefined }}
              />
              <Text style={{ fontSize: 13 }}>
                ربط العداد بالمستأجر الحالي <Text strong>({selectedUnit.tenant})</Text> تلقائياً
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ─── Step 1 — Meter Info ──────────────────────────────────── */
  const stepMeter = (
    <Row gutter={[16, 0]}>
      <Col span={12}>
        <Form.Item name="id" label="رقم العداد (ID)" rules={[{ required: true }]}>
          <Input
            size="large"
            prefix={<DashboardOutlined style={{ color: PRIMARY }} />}
            placeholder="M-026"
            style={{ fontFamily: 'monospace', fontWeight: 700 }}
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="serial" label="الرقم التسلسلي" rules={[{ required: true, message: 'مطلوب' }]}>
          <Input
            size="large"
            prefix={<BarcodeOutlined style={{ color: '#aaa' }} />}
            placeholder="SN-MTR-2026-026"
          />
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item name="type" label="نوع العداد" rules={[{ required: true }]}>
          <Select size="large" onChange={v => setMeterType(v)}>
            {meterTypes.map(t => (
              <Option key={t.value} value={t.value}>
                <Tag color={t.color} style={{ margin: 0 }}>{t.label}</Tag>
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="brand" label="الماركة / المصنع" rules={[{ required: true, message: 'مطلوب' }]}>
          <Select size="large" showSearch>
            {brands.map(b => <Option key={b} value={b}>{b}</Option>)}
          </Select>
        </Form.Item>
      </Col>

      {meterType === 'smart' && (
        <Col span={24}>
          <Form.Item name="simCard" label={
            <span>
              رقم SIM / IMEI
              <Tooltip title="مطلوب للعدادات الذكية التي ترسل بيانات عن بُعد">
                <InfoCircleOutlined style={{ marginInlineStart: 6, color: '#aaa' }} />
              </Tooltip>
            </span>
          }>
            <Input
              placeholder="89971401234567890123"
              prefix={<ThunderboltOutlined style={{ color: 'blue' }} />}
            />
          </Form.Item>
        </Col>
      )}
    </Row>
  );

  /* ─── Step 2 — Installation ────────────────────────────────── */
  const stepInstall = (
    <Row gutter={[16, 0]}>
      <Col span={12}>
        <Form.Item name="installDate" label="تاريخ التركيب" rules={[{ required: true, message: 'مطلوب' }]}>
          <DatePicker
            size="large"
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            prefix={<CalendarOutlined />}
            placeholder="اختر التاريخ"
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="calibrationDate" label="تاريخ المعايرة القادمة" rules={[{ required: true, message: 'مطلوب' }]}>
          <DatePicker
            size="large"
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            placeholder="اختر التاريخ"
            disabledDate={d => d && d.isBefore(dayjs())}
          />
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item name="initialReading" label="القراءة الأولية (م³)" rules={[{ required: true }]}>
          <InputNumber
            size="large"
            min={0}
            style={{ width: '100%' }}
            placeholder="0"
            addonAfter="م³"
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="meterPhoto"
          label={
            <span>
              صورة العداد الجديد
              <Tooltip title="التقط صورة واضحة للعداد تظهر الرقم التسلسلي والشاشة">
                <InfoCircleOutlined style={{ marginInlineStart: 6, color: '#aaa' }} />
              </Tooltip>
            </span>
          }
        >
          <Upload
            accept="image/*"
            listType="picture-card"
            maxCount={1}
            beforeUpload={() => false}
          >
            <div style={{ padding: '4px 0' }}>
              <CameraOutlined style={{ fontSize: 22, color: PRIMARY }} />
              <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>التقط أو ارفع صورة</div>
            </div>
          </Upload>
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item name="notes" label="ملاحظات التركيب">
          <Input.TextArea
            rows={2}
            placeholder="ملاحظات عن حالة التركيب، المواد المستخدمة..."
            maxLength={300}
            showCount
          />
        </Form.Item>
      </Col>
    </Row>
  );

  /* ─── Step 3 — Review ──────────────────────────────────────── */
  const ReviewRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <Text strong style={{ fontSize: 12 }}>{value ?? '—'}</Text>
    </div>
  );

  const vals = form.getFieldsValue(true);
  const stepReview = (
    <div>
      <Alert
        type="info"
        showIcon
        message="راجع البيانات قبل الحفظ"
        description="بمجرد الحفظ سيتم ربط العداد بالوحدة المحددة وإضافته لقائمة عدادات المبنى."
        style={{ marginBottom: 16, borderRadius: 8 }}
      />
      <Row gutter={[16, 0]}>
        <Col span={12}>
          <Text strong style={{ fontSize: 12, color: PRIMARY, display: 'block', marginBottom: 6 }}>
            <HomeOutlined style={{ marginInlineEnd: 4 }} />الوحدة المستهدفة
          </Text>
          <ReviewRow label="رقم الوحدة"   value={<Text style={{ color: PRIMARY }}>{vals.unit}</Text>} />
          <ReviewRow label="الطابق"       value={selectedUnit?.floor} />
          <ReviewRow label="النوع"        value={selectedUnit?.typeLabel} />
          <ReviewRow label="المستأجر"     value={
            selectedUnit?.tenant
              ? <><Text>{selectedUnit.tenant}</Text>{linkTenant && <Tag color="success" style={{ marginInlineStart: 4 }}>سيُربط</Tag>}</>
              : <Text type="secondary">—</Text>
          } />
        </Col>
        <Col span={12}>
          <Text strong style={{ fontSize: 12, color: PRIMARY, display: 'block', marginBottom: 6 }}>
            <DashboardOutlined style={{ marginInlineEnd: 4 }} />بيانات العداد
          </Text>
          <ReviewRow label="رقم العداد"     value={<Text style={{ fontFamily: 'monospace', color: PRIMARY }}>{vals.id}</Text>} />
          <ReviewRow label="الرقم التسلسلي" value={<Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{vals.serial}</Text>} />
          <ReviewRow label="النوع"          value={<Tag color={meterTypes.find(t => t.value === vals.type)?.color}>{meterTypes.find(t => t.value === vals.type)?.label}</Tag>} />
          <ReviewRow label="الماركة"        value={vals.brand} />
        </Col>
        <Col span={24} style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 12, color: PRIMARY, display: 'block', marginBottom: 6 }}>
            <SafetyOutlined style={{ marginInlineEnd: 4 }} />التركيب والمعايرة
          </Text>
          <Row gutter={16}>
            <Col span={8}><ReviewRow label="تاريخ التركيب"  value={(vals.installDate as Dayjs)?.format('DD/MM/YYYY')} /></Col>
            <Col span={8}><ReviewRow label="القراءة الأولية" value={`${vals.initialReading ?? 0} م³`} /></Col>
            <Col span={8}><ReviewRow label="صورة العداد" value={(vals.meterPhoto?.fileList ?? []).length > 0 ? <Tag color="success">تم الرفع ✓</Tag> : <Text type="secondary">لم تُرفع</Text>} /></Col>
          </Row>
        </Col>
      </Row>
    </div>
  );

  const stepContent = [stepUnit, stepMeter, stepInstall, stepReview];

  /* ─── Footer buttons ─────────────────────────────────────────── */
  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Button onClick={handleClose}>إلغاء</Button>
      <Space>
        {step > 0 && (
          <Button onClick={() => setStep(s => s - 1)}>السابق</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="primary" onClick={validateAndNext}
            style={{ background: PRIMARY, borderColor: PRIMARY }}>
            التالي
          </Button>
        ) : (
          <Button type="primary" loading={loading} icon={<CheckCircleOutlined />}
            onClick={handleSave}
            style={{ background: PRIMARY, borderColor: PRIMARY }}>
            حفظ العداد
          </Button>
        )}
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${PRIMARY}, #2e7d32)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DashboardOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>إضافة عداد غاز جديد</div>
            <div style={{ fontWeight: 400, fontSize: 11, color: '#888', marginTop: 1 }}>
              ربط العداد بالوحدة والمستأجر
            </div>
          </div>
        </div>
      }
      width={680}
      footer={footer}
      destroyOnClose
      style={{ direction: 'rtl' }}
      styles={{ body: { padding: '0 24px 16px' } }}
      afterClose={() => { form.resetFields(); setStep(0); setSelectedUnit(null); }}
    >
      {/* ── Stepper ── */}
      <Steps
        current={step}
        size="small"
        items={STEPS}
        style={{ padding: '16px 0 20px', borderBottom: '1px solid #f0f0f0', marginBottom: 20 }}
      />

      {/* ── Step content ── */}
      <ConfigProvider locale={arLocaleShortDays}>
        <Form
          form={form}
          layout="vertical"
          size="middle"
          style={{ direction: 'rtl' }}
          initialValues={{ type: 'smart', initialReading: 0 }}
        >
          {stepContent[step]}
        </Form>
      </ConfigProvider>
    </Modal>
  );
};

export default AddMeterModal;
