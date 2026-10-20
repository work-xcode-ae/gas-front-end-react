import React, { useState, useEffect } from 'react';
import {
  Modal, Steps, Form, Input, Select, DatePicker, Button, Switch,
  Row, Col, Divider, Tag, InputNumber, Typography, Space,
  Alert, Checkbox, Tooltip,
} from 'antd';
import {
  FileTextOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined,
  ArrowRightOutlined, ArrowLeftOutlined, 
  CalendarOutlined, HomeOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs, {  } from 'dayjs';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

/* ─── Types ─── */
interface FeeRow {
  id: string;
  type: string;
  typeLabel: string;
  cycle: 'monthly' | 'yearly' | 'one_time';
  amount: number;
  notes: string;
}

interface UnitOption { key: string; no: string; floor: number; typeLabel: string; tenant: string | null; }
interface TenantOption { id: string; name: string; unit: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  buildingUnits: UnitOption[];
  tenants: TenantOption[];
  defaultTenantId?: string;
  nextContractNo: string;
  onSave: (data: Record<string, unknown>) => void;
}

const FEE_TYPES = [
  { value: 'gas_price',     label: 'سعر الغاز (م³)'      },
  { value: 'maintenance',   label: 'رسوم الصيانة'          },
  { value: 'connection',    label: 'رسوم الوصل'             },
  { value: 'disconnection', label: 'رسوم القطع'             },
  { value: 'inspection',    label: 'رسوم الفحص الدوري'     },
  { value: 'meter_rent',    label: 'إيجار العداد'           },
  { value: 'insurance',     label: 'تأمين'                   },
  { value: 'other',         label: 'رسم آخر'                },
];

const CYCLE_LABELS: Record<string, string> = { monthly: 'شهري', yearly: 'سنوي', one_time: 'مرة واحدة' };
const CYCLE_COLORS: Record<string, string> = { monthly: 'blue', yearly: 'purple', one_time: 'orange' };

const DEFAULT_TERMS = `1. يلتزم المستأجر بسداد فواتير الغاز في مواعيدها المحددة.
2. لا يحق للمستأجر التعديل على عداد الغاز أو الاتصالات المرتبطة به.
3. في حالة الانتهاء المبكر للعقد يُطبَّق شرط الغرامة وفق الاتفاق.
4. يحق لشركة بن سدرة للغاز قطع الخدمة عند التأخر في السداد لأكثر من 30 يوماً.
5. يُجدَّد العقد تلقائياً لمدة مماثلة ما لم يُخطَر الطرف الآخر قبل 30 يوماً من تاريخ الانتهاء.
6. يخضع هذا العقد لأنظمة هيئة تنظيم الطاقة والمياه في إمارة أبوظبي.`;

const STEPS = ['أطراف العقد', 'المدة والتجديد', 'الرسوم والخدمات', 'الوديعة والشروط', 'المراجعة'];

const AddGasContractModal: React.FC<Props> = ({
  open, onClose, buildingUnits, tenants, defaultTenantId, nextContractNo, onSave,
}) => {
  const [step, setStep] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [form] = Form.useForm();
  const [autoRenew, setAutoRenew] = useState(true);
  const [fees, setFees] = useState<FeeRow[]>([
    { id: '1', type: 'gas_price', typeLabel: 'سعر الغاز (م³)', cycle: 'monthly', amount: 3.5, notes: '' },
    { id: '2', type: 'maintenance', typeLabel: 'رسوم الصيانة', cycle: 'yearly', amount: 500, notes: '' },
  ]);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        contractNo: nextContractNo,
        tenantId: defaultTenantId,
        startDate: dayjs(),
        endDate: dayjs().add(1, 'year'),
        renewalPeriod: 12,
        terms: DEFAULT_TERMS,
        depositAmount: 2000,
        depositPaid: false,
      });
      setStep(0); setAutoRenew(true); setTcAccepted(false);
    }
  }, [open]);

  const doClose = () => { form.resetFields(); setStep(0); setCloseConfirmOpen(false); onClose(); };
  const handleClose = () => { setCloseConfirmOpen(true); };

  const stepFields: Record<number, string[]> = {
    0: ['tenantId', 'unitKey'],
    1: ['startDate', 'endDate'],
    2: [],
    3: ['depositAmount'],
  };

  const next = async () => {
    try {
      await form.validateFields(stepFields[step] ?? []);
      setStep(s => s + 1);
    } catch {}
  };

  const handleSave = async () => {
    if (!tcAccepted) return;
    try {
      const vals = await form.validateFields();
      setSubmitting(true);
      setTimeout(() => {
        onSave({ ...vals, autoRenew, fees, startDate: vals.startDate?.format('YYYY-MM-DD'), endDate: vals.endDate?.format('YYYY-MM-DD') });
        setSubmitting(false);
        handleClose();
      }, 700);
    } catch {}
  };

  /* Fee table helpers */
  const addFee = () => {
    setFees(prev => [...prev, { id: Date.now().toString(), type: 'other', typeLabel: 'رسم آخر', cycle: 'monthly', amount: 0, notes: '' }]);
  };
  const updateFee = (id: string, field: keyof FeeRow, val: unknown) => {
    setFees(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, [field]: val };
      if (field === 'type') updated.typeLabel = FEE_TYPES.find(t => t.value === val)?.label ?? '';
      return updated;
    }));
  };
  const removeFee = (id: string) => setFees(prev => prev.filter(f => f.id !== id));

  const totalMonthly = fees.filter(f => f.cycle === 'monthly').reduce((s, f) => s + (f.amount || 0), 0);
  const totalYearly  = fees.filter(f => f.cycle === 'yearly').reduce((s, f) => s + (f.amount || 0), 0);

  
  

  return (
    <>
    <Modal open={open} onCancel={handleClose} width={700} title={null} footer={null} destroyOnClose styles={{ body: { padding: 0 } }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${GOLD}18, ${GOLD}06)`, borderBottom: `3px solid ${GOLD}`, padding: '18px 24px 14px', borderRadius: '8px 8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
            <FileTextOutlined />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, color: '#7a5c00' }}>إنشاء عقد غاز جديد</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>رقم العقد: <Text code style={{ fontSize: 11 }}>{nextContractNo}</Text></Text>
          </div>
        </div>
        <Steps current={step} size="small" style={{ marginTop: 14 }} items={STEPS.map(t => ({ title: t }))} />
      </div>

      <div style={{ padding: '20px 24px 8px', maxHeight: '60vh', overflowY: 'auto' }}>
        <Form form={form} layout="vertical" size="middle">

          {/* ── Step 0: Parties ── */}
          {step === 0 && (
            <>
              <Form.Item name="contractNo" label="رقم العقد">
                <Input readOnly style={{ background: '#fafafa', fontFamily: 'monospace' }} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item name="tenantId" label="المستأجر" rules={[{ required: true, message: 'اختر المستأجر' }]}>
                    <Select placeholder="اختر المستأجر" showSearch optionFilterProp="label"
                      options={tenants.map(t => ({ value: t.id, label: t.name }))} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="unitKey" label="الوحدة" rules={[{ required: true, message: 'اختر الوحدة' }]}>
                    <Select placeholder="اختر الوحدة" showSearch>
                      {buildingUnits.map(u => (
                        <Option key={u.key} value={u.key}>
                          <HomeOutlined style={{ marginInlineEnd: 4, color: PRIMARY }} />وحدة {u.no} — ط{u.floor}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Alert showIcon type="info" style={{ fontSize: 12 }}
                message="يمكن ربط عقد واحد نشط بكل وحدة في نفس الوقت" />
            </>
          )}

          {/* ── Step 1: Duration ── */}
          {step === 1 && (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="startDate" label="تاريخ بداية العقد" rules={[{ required: true, message: 'أدخل تاريخ البداية' }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endDate" label="تاريخ نهاية العقد" rules={[{ required: true, message: 'أدخل تاريخ النهاية' }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD"
                      disabledDate={d => d && form.getFieldValue('startDate') && d.isBefore(form.getFieldValue('startDate'), 'day')} />
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ margin: '8px 0 16px' }}>التجديد التلقائي</Divider>
              <Row align="middle" gutter={12}>
                <Col>
                  <Switch checked={autoRenew} onChange={setAutoRenew}
                    checkedChildren="مفعّل" unCheckedChildren="معطّل"
                    style={autoRenew ? { background: PRIMARY } : {}} />
                </Col>
                <Col flex={1}>
                  <Text style={{ fontSize: 13 }}>تجديد تلقائي عند انتهاء العقد</Text>
                </Col>
              </Row>
              {autoRenew && (
                <Form.Item name="renewalPeriod" label="مدة التجديد (بالأشهر)" style={{ marginTop: 14 }}>
                  <Select style={{ width: 200 }}>
                    {[3, 6, 12, 24].map(m => <Option key={m} value={m}>{m} شهر{m === 12 ? ' (سنة)' : m === 24 ? ' (سنتان)' : ''}</Option>)}
                  </Select>
                </Form.Item>
              )}
              <Alert showIcon type={autoRenew ? 'success' : 'warning'} style={{ marginTop: 12, fontSize: 12 }}
                message={autoRenew
                  ? 'سيُجدَّد العقد تلقائياً — يمكن الإلغاء قبل 30 يوماً من انتهائه'
                  : 'العقد غير قابل للتجديد التلقائي — يجب تجديده يدوياً قبل الانتهاء'} />
            </>
          )}

          {/* ── Step 2: Fees & Services ── */}
          {step === 2 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong>الرسوم والخدمات</Text>
                <Button size="small" icon={<PlusOutlined />} type="dashed" onClick={addFee}>إضافة رسم</Button>
              </div>

              {fees.map(fee => (
                <div key={fee.id} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #f0f0f0' }}>
                  <Row gutter={8} align="middle">
                    <Col flex="160px">
                      <Select
                        size="small" value={fee.type} style={{ width: '100%' }}
                        onChange={v => updateFee(fee.id, 'type', v)}
                        options={FEE_TYPES.map(t => ({ value: t.value, label: t.label }))}
                      />
                    </Col>
                    <Col flex="120px">
                      <Select
                        size="small" value={fee.cycle} style={{ width: '100%' }}
                        onChange={v => updateFee(fee.id, 'cycle', v)}>
                        <Option value="monthly">شهري</Option>
                        <Option value="yearly">سنوي</Option>
                        <Option value="one_time">مرة واحدة</Option>
                      </Select>
                    </Col>
                    <Col flex="auto">
                      <InputNumber
                        size="small" style={{ width: '100%' }} min={0} value={fee.amount}
                        onChange={v => updateFee(fee.id, 'amount', v ?? 0)}
                        addonAfter="د.إ" />
                    </Col>
                    <Col flex="none">
                      <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => removeFee(fee.id)} />
                    </Col>
                  </Row>
                  <Input
                    size="small" placeholder="ملاحظة (اختياري)" value={fee.notes} style={{ marginTop: 6 }}
                    onChange={e => updateFee(fee.id, 'notes', e.target.value)}
                  />
                </div>
              ))}

              <Divider style={{ margin: '12px 0 8px' }}>ملخص الرسوم</Divider>
              <Row gutter={12}>
                {[
                  { label: 'شهري', val: totalMonthly, color: 'blue' },
                  { label: 'سنوي', val: totalYearly, color: 'purple' },
                  { label: 'مجموع سنوي', val: totalMonthly * 12 + totalYearly, color: 'gold' },
                ].map(s => (
                  <Col span={8} key={s.label}>
                    <div style={{ textAlign: 'center', background: '#f9f9f9', borderRadius: 8, padding: '8px 4px', border: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{s.val.toLocaleString()} <span style={{ fontSize: 10, color: '#888' }}>د.إ</span></div>
                      <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* ── Step 3: Deposit + T&C ── */}
          {step === 3 && (
            <>
              <Divider titlePlacement="right" style={{ fontSize: 13 }}>الوديعة</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="depositAmount" label="مبلغ الوديعة (د.إ)" rules={[{ required: true }]}>
                    <InputNumber min={0} style={{ width: '100%' }} addonAfter="د.إ" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="depositPaid" label="حالة الوديعة" valuePropName="checked">
                    <Switch checkedChildren="مدفوعة ✓" unCheckedChildren="غير مدفوعة" style={{ marginTop: 6 }} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider titlePlacement="right" style={{ fontSize: 13 }}>الشروط والأحكام</Divider>
              <Form.Item name="terms">
                <TextArea rows={8} style={{ fontSize: 12, fontFamily: 'inherit', lineHeight: 1.8 }} />
              </Form.Item>
              <div style={{ marginTop: 8 }}>
                <Checkbox checked={tcAccepted} onChange={e => setTcAccepted(e.target.checked)}>
                  <Text style={{ fontSize: 12 }}>أقر بأن جميع البيانات المدخلة صحيحة وأوافق على الشروط والأحكام المذكورة أعلاه</Text>
                </Checkbox>
              </div>
            </>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (() => {
            const vals = form.getFieldsValue();
            const tenant = tenants.find(t => t.id === vals.tenantId);
            const unit   = buildingUnits.find(u => u.key === vals.unitKey);
            return (
              <div>
                <Alert type="info" showIcon message="راجع التفاصيل قبل حفظ العقد — لا يمكن تعديل رقم العقد أو المستأجر بعد الحفظ" style={{ marginBottom: 16, fontSize: 12 }} />
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>أطراف العقد</Text>
                      <div style={{ fontSize: 12 }}><Text type="secondary">المستأجر: </Text><Text strong>{tenant?.name}</Text></div>
                      <div style={{ fontSize: 12, marginTop: 4 }}><Text type="secondary">الوحدة: </Text><Text strong>وحدة {unit?.no} — ط{unit?.floor}</Text></div>
                    </div>
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>مدة العقد</Text>
                      <div style={{ fontSize: 12 }}><CalendarOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />{vals.startDate?.format?.('YYYY-MM-DD')} → {vals.endDate?.format?.('YYYY-MM-DD')}</div>
                      <div style={{ marginTop: 6 }}>
                        <Tag color={autoRenew ? 'success' : 'default'} style={{ fontSize: 11 }}>
                          {autoRenew ? `تجديد تلقائي كل ${vals.renewalPeriod} شهر` : 'بدون تجديد تلقائي'}
                        </Tag>
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>الرسوم ({fees.length} بند)</Text>
                      {fees.map(f => (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <Space size={4}>
                            <Tag color={CYCLE_COLORS[f.cycle]} style={{ fontSize: 10, margin: 0 }}>{CYCLE_LABELS[f.cycle]}</Tag>
                            <Text>{f.typeLabel}</Text>
                          </Space>
                          <Text strong>{f.amount.toLocaleString()} د.إ</Text>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>الوديعة</Text>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <Text>المبلغ:</Text>
                        <Text strong>{(vals.depositAmount || 0).toLocaleString()} د.إ</Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={vals.depositPaid ? 'success' : 'orange'} style={{ fontSize: 11 }}>
                          {vals.depositPaid ? 'مدفوعة' : 'غير مدفوعة'}
                        </Tag>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            );
          })()}

        </Form>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button onClick={step === 0 ? handleClose : () => setStep(s => s - 1)} icon={step > 0 ? <ArrowRightOutlined /> : undefined}>
          {step === 0 ? 'إلغاء' : 'السابق'}
        </Button>
        {step < 4 ? (
          <Button type="primary" icon={<ArrowLeftOutlined />} iconPosition="end" onClick={next}
            style={{ background: GOLD, borderColor: GOLD, color: '#fff' }}>التالي</Button>
        ) : (
          <Tooltip title={!tcAccepted ? 'يجب الموافقة على الشروط أولاً' : ''}>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting} onClick={handleSave}
              disabled={!tcAccepted} style={{ background: PRIMARY, borderColor: PRIMARY }}>
              حفظ العقد
            </Button>
          </Tooltip>
        )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>إلغاء إنشاء العقد؟</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fa8c16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ExclamationCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
        </div>
        <Typography.Text style={{ fontSize: 13, color: '#555', textAlign: 'right', display: 'block', width: '100%' }}>
          سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟
        </Typography.Text>
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

export default AddGasContractModal;
