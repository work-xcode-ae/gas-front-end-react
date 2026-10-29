import { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, Select, DatePicker, Switch, Row, Col, Checkbox, Radio, Typography, Table, Tag, Input, Alert, message } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import ContractTermsPicker from '../../components/ContractTermsPicker';
import { toTermInputs, type ContractTermItem } from '../../api/terms';
import { api, errorMessage } from '../../api/client';
import { PRIMARY } from './forms';

const { Text } = Typography;

/**
 * Service & maintenance contract (AMC) of a villa / restaurant — the essentials of the building AMC wizard
 * (AddAmcContractModal) on one card: period, value + payment plan, visits, response time, services, terms.
 * Saved with POST /amc-contracts { buildingId, premisesId } — a restaurant's AMC is linked to the restaurant itself.
 */

// same choices as AddAmcContractModal (copied so the building component stays untouched)
export const AMC_SERVICES = [
  { id: 'pipe_inspect', label: 'فحص مواسير الغاز وكشف التسريبات', recommended: true },
  { id: 'tank_inspect', label: 'فحص سلامة الخزانات والصمامات', recommended: true },
  { id: 'meter_connect', label: 'فحص نقاط الاتصال بالعدادات', recommended: true },
  { id: 'safety_report', label: 'إصدار تقرير سلامة سنوي', recommended: true },
  { id: 'meter_calib', label: 'معايرة العدادات الذكية', recommended: false },
  { id: 'pressure_test', label: 'اختبارات ضغط المواسير', recommended: false },
  { id: 'regulator', label: 'صيانة منظمات الضغط', recommended: false },
  { id: 'emergency_kit', label: 'توفير معدات طوارئ في الموقع', recommended: false },
  { id: 'training', label: 'تدريب الموظفين على السلامة', recommended: false },
  { id: 'cctv_gas', label: 'مراقبة أنظمة الاستشعار الذكية', recommended: false },
];
const AMC_EXCLUDED = ['الإصلاحات الهيكلية للمبنى', 'استبدال الخزانات بالكامل', 'أعمال الكهرباء غير المتعلقة بالغاز'];
export const VISIT_FREQ = [
  { value: 'monthly', label: 'شهري', count: 12 },
  { value: 'bimonthly', label: 'كل شهرين', count: 6 },
  { value: 'quarterly', label: 'ربع سنوي', count: 4 },
  { value: 'semi_annual', label: 'نصف سنوي', count: 2 },
  { value: 'annual', label: 'سنوي', count: 1 },
];
const PAYMENT_FREQ = [
  { value: 'annual', label: 'دفعة واحدة سنوياً', n: 1 },
  { value: 'semi', label: 'نصف سنوي — دفعتان', n: 2 },
  { value: 'quarterly', label: 'ربع سنوي — 4 دفعات', n: 4 },
  { value: 'monthly', label: 'شهري — 12 دفعة', n: 12 },
];
const RESPONSE = [{ value: 2, label: '2 ساعة' }, { value: 4, label: '4 ساعات' }, { value: 8, label: '8 ساعات' }, { value: 24, label: '24 ساعة' }];

export const amcDefaults = () => ({
  startDate: dayjs(), endDate: dayjs().add(1, 'year').subtract(1, 'day'), paymentFreq: 'annual', visitFrequency: 'quarterly',
  responseTimeHours: 4, emergencyIncluded: true, services: AMC_SERVICES.filter(s => s.recommended).map(s => s.id),
});

export function amcSchedule(start: Dayjs, annual: number, freq: string) {
  const n = (PAYMENT_FREQ.find(o => o.value === freq) ?? PAYMENT_FREQ[0]).n;
  const amt = Math.round(annual / n);
  return Array.from({ length: n }, (_, i) => ({
    label: n === 1 ? 'الدفعة الكاملة' : `دفعة ${i + 1}`,
    dueDate: start.add(i * Math.floor(12 / n), 'month').format('YYYY-MM-DD'),
    amount: i === n - 1 ? annual - amt * (n - 1) : amt,
  }));
}

/** Form values under `prefix` + chosen terms → POST /amc-contracts body (without buildingId / premisesId). */
export function amcBody(v: any, terms: ContractTermItem[] | undefined) {
  const start: Dayjs = v.startDate;
  const end: Dayjs = v.endDate ?? start.add(1, 'year').subtract(1, 'day');
  const visit = VISIT_FREQ.find(o => o.value === v.visitFrequency) ?? VISIT_FREQ[2];
  return {
    vendorId: null, ownerPartyId: null,
    startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD'), annualValue: Number(v.annualValue),
    visitFrequency: visit.value, visitsTotal: visit.count, responseTimeHours: v.responseTimeHours ?? null, emergencyIncluded: !!v.emergencyIncluded,
    notes: v.notes?.trim() || null,
    scope: AMC_SERVICES.filter(s => (v.services ?? []).includes(s.id)).map(s => s.label), excludedScope: AMC_EXCLUDED,
    terms: toTermInputs(terms ?? []).map(t => ({ type: t.category, text: t.text, templateId: t.templateId })),
    paymentSchedule: amcSchedule(start, Number(v.annualValue), v.paymentFreq ?? 'annual'),
    generateVisits: true, autoPaymentSchedule: false,
  };
}

/** The AMC fields under form path `prefix` (e.g. ['amc']). */
export function AmcFields({ prefix, terms, onTermsChange }: { prefix: string[]; terms?: ContractTermItem[]; onTermsChange: (t: ContractTermItem[]) => void }) {
  const form = Form.useFormInstance();
  const p = (n: string) => [...prefix, n];
  const start = Form.useWatch(p('startDate'), form) as Dayjs | undefined;
  const annual = Form.useWatch(p('annualValue'), form) as number | undefined;
  const freq = Form.useWatch(p('paymentFreq'), form) as string | undefined;
  const schedule = start && annual ? amcSchedule(start, Number(annual), freq ?? 'annual') : [];
  return (
    <>
      <Row gutter={12}>
        <Col xs={12} md={6}><Form.Item name={p('startDate')} label="بداية العقد" rules={[{ required: true, message: 'التاريخ' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('endDate')} label="نهاية العقد" dependencies={[p('startDate')]}
          rules={[{ required: true, message: 'التاريخ' }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || !getFieldValue(p('startDate')) || v.isAfter(getFieldValue(p('startDate')), 'day') ? Promise.resolve() : Promise.reject(new Error('بعد تاريخ البداية'))) })]}>
          <DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('annualValue')} label="القيمة السنوية (قبل الضريبة)" rules={[{ required: true, message: 'القيمة مطلوبة' }]}>
          <InputNumber min={1} style={{ width: '100%' }} addonAfter="د.إ" /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('paymentFreq')} label="خطة الدفع"><Select options={PAYMENT_FREQ.map(o => ({ value: o.value, label: o.label }))} /></Form.Item></Col>
      </Row>
      <Form.Item name={p('visitFrequency')} label="تكرار زيارات الصيانة" rules={[{ required: true }]}>
        <Radio.Group optionType="button" buttonStyle="solid" options={VISIT_FREQ.map(o => ({ value: o.value, label: `${o.label} (${o.count})` }))} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={12} md={6}><Form.Item name={p('responseTimeHours')} label="زمن الاستجابة"><Select options={RESPONSE} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('emergencyIncluded')} label="يشمل الطوارئ" valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name={p('notes')} label="ملاحظات العقد"><Input /></Form.Item></Col>
      </Row>
      <Form.Item name={p('services')} label="نطاق الخدمات" rules={[{ required: true, type: 'array', min: 1, message: 'اختر خدمة واحدة على الأقل' }]}>
        <Checkbox.Group style={{ width: '100%' }}>
          <Row gutter={[8, 6]}>{AMC_SERVICES.map(s => <Col xs={24} md={12} key={s.id}><Checkbox value={s.id}>{s.label}{s.recommended && <Tag color="green" style={{ marginInlineStart: 6, fontSize: 10 }}>موصى</Tag>}</Checkbox></Col>)}</Row>
        </Checkbox.Group>
      </Form.Item>
      {schedule.length > 0 && (
        <Table size="small" rowKey="label" pagination={false} style={{ marginBottom: 12 }} dataSource={schedule}
          columns={[{ title: 'الدفعة', dataIndex: 'label' }, { title: 'تاريخ الاستحقاق', dataIndex: 'dueDate' },
            { title: 'المبلغ', dataIndex: 'amount', render: (x: number) => <Text strong style={{ color: PRIMARY }}>{x.toLocaleString()} د.إ</Text> }]} />
      )}
      <Text strong style={{ display: 'block', marginBottom: 8 }}>الشروط والأحكام</Text>
      <ContractTermsPicker contractType="amc" value={terms} onChange={onTermsChange} />
    </>
  );
}

/** «عقد صيانة جديد» on a restaurant / villa profile. site = GET /premises/{id}. */
export function PremisesAmcModal({ site, open, onClose, onSaved }: { site: any; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [terms, setTerms] = useState<ContractTermItem[] | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue({ amc: amcDefaults() }); setTerms(undefined); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<{ id: number; contractNo: string; invoiceWarning?: string }>('/amc-contracts', { body: { ...amcBody(v.amc, terms), buildingId: site.building?.id, premisesId: site.id } });
      message.success(`تم إنشاء عقد الصيانة ${r.contractNo}`);
      if (r.invoiceWarning) message.warning(r.invoiceWarning, 8);
      onSaved();
    } catch (e) { message.error(errorMessage(e), 7); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} width={Math.min(window.innerWidth - 24, 900)} destroyOnHidden centered
      title={<span><ToolOutlined style={{ color: PRIMARY }} /> عقد صيانة جديد — {site?.code}</span>} okText="حفظ العقد" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY } }}>
      <Alert type="info" showIcon style={{ margin: '8px 0 12px', borderRadius: 8 }}
        message={site?.type === 'restaurant' ? 'عقد الصيانة خاص بهذا المطعم فقط — لا يُحسب كعقد للمبنى الذي يقع فيه.' : 'عقد الصيانة للفيلا (المالك هو الطرف الأول).'} />
      <Form form={form} layout="vertical">
        <AmcFields prefix={['amc']} terms={terms} onTermsChange={setTerms} />
      </Form>
    </Modal>
  );
}
