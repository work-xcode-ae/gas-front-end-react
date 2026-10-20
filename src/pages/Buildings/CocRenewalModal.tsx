import { useEffect, useState } from 'react';
import { Modal, Steps, Typography, Tag, Button, Form, Input, DatePicker, Select, Space, Divider, message, Spin, Alert, Row, Col, Segmented } from 'antd';
import {
  AuditOutlined, SolutionOutlined, CreditCardOutlined, CalendarOutlined, ToolOutlined, FileDoneOutlined, CheckOutlined, PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { CocFeesPanel, StepNotesEditor, StepNotesList, CdBillingFields, type StepNotes } from './CocStepPanels';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';

export const RENEWAL_STEPS = [
  { title: 'تقديم الطلب', description: 'رفع نموذج الطلب (جديد / تجديد) للدفاع المدني', icon: <SolutionOutlined />, action: 'تم رفع الطلب',
    help: 'قدّم الطلب عبر بوابة الدفاع المدني مرفقاً به: الرخصة التجارية، المخطط المعتمد لتمديدات الغاز، صورة الشهادة السابقة (عند التجديد)، وعقد الصيانة السنوي.' },
  { title: 'دفع الرسوم', description: 'سداد رسوم الفحص والشهادة', icon: <CreditCardOutlined />, action: 'تم الدفع',
    help: 'سدّد رسوم الفحص والإصدار المذكورة في إشعار الدفع، واحتفظ برقم الإيصال في الملاحظات.' },
  { title: 'جدولة الفحص', description: 'تحديد موعد الفحص الميداني مع المفتش', icon: <CalendarOutlined />, action: 'حجز الموعد',
    help: 'احجز موعد الفحص وسجّل اسم المفتش ورقم هاتفه — يظهر في بطاقة المفتش في المبنى.' },
  { title: 'الفحص الميداني', description: 'زيارة المفتش وفحص منظومة الغاز', icon: <AuditOutlined />, action: 'تسجيل نتيجة الفحص',
    help: 'يفحص المفتش الخزانات والصمامات وأجهزة كشف التسرب والأنابيب. سجّل النتيجة وأي ملاحظات.' },
  { title: 'معالجة الملاحظات', description: 'تصحيح أي ملاحظات أو مخالفات (إن وُجدت)', icon: <ToolOutlined />, action: 'تم التصحيح',
    help: 'صحّح الملاحظات (يمكن فتح طلب خدمة لها) ثم أبلغ الدفاع المدني. إن لم توجد ملاحظات انتقل للخطوة التالية.' },
  { title: 'إصدار الشهادة', description: 'استلام شهادة المطابقة الجديدة من الدفاع المدني', icon: <FileDoneOutlined />, action: 'إصدار الشهادة',
    help: 'أدخل رقم الشهادة وتاريخي الإصدار والانتهاء كما في الشهادة المستلمة.' },
];

/** Certificate row as shown in the civil defence tab (live rows carry dbId / renewalId). */
export interface CocRow {
  id: string; dbId?: number; type?: string; licenseNo?: string; issuedBy?: string; issueDate?: string; expiryDate?: string; scope?: string;
  status: string; renewalStep?: number; renewalId?: number | null; inspector?: string; inspectionDate?: string; notes?: string;
}

interface Props {
  open: boolean;
  /** 'add' = new certificate; otherwise the certificate whose renewal is shown */
  mode: 'add' | 'renew';
  coc: CocRow | null;
  buildingId?: number;
  onClose: () => void;
  onChanged: () => void;
}

export default function CocRenewalModal({ open, mode, coc, buildingId, onClose, onChanged }: Props) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [renewal, setRenewal] = useState<any>(null);
  const [addMode, setAddMode] = useState<'request' | 'register'>('request');
  const [showHelp, setShowHelp] = useState<number | null>(null);
  const [feesPaid, setFeesPaid] = useState(false);
  const [stepNotes, setStepNotes] = useState<StepNotes[]>([]);
  const [notesKey, setNotesKey] = useState(0);
  const live = !!buildingId;
  const step = coc?.renewalId ? Math.max(1, coc.renewalStep ?? 1) : 0; // 0 = not started; 1..6 = step in progress

  // the renewal record (inspector, date, remarks) — PUT replaces all fields, so the form starts from it
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setRenewal(null);
    setShowHelp(null);
    if (mode === 'add') { setAddMode('request'); form.setFieldsValue({ certType: 'gas_installation', issuedBy: 'الدفاع المدني', startedAt: dayjs() }); return; }
    if (!live || !coc?.dbId || !coc.renewalId) return;
    setLoading(true);
    api<any>(`/cd-certificates/${coc.dbId}`)
      .then(d => {
        const r = (d.renewals ?? []).map((x: any) => x.renewal).find((x: any) => x.id === coc.renewalId) ?? null;
        setRenewal(r);
        if (r) form.setFieldsValue({
          inspectorName: r.inspectorName, inspectorPhone: r.inspectorPhone, inspectorDept: r.inspectorDept,
          renewalDate: r.renewalDate ? dayjs(r.renewalDate) : undefined, remarks: r.remarks,
          licenseNo: coc.licenseNo, issueDate: dayjs(), newExpiryDate: dayjs().add(1, 'year'),
        });
      })
      .catch(() => setRenewal(null))
      .finally(() => setLoading(false));
  }, [open, mode, coc?.dbId, coc?.renewalId, live]); // eslint-disable-line react-hooks/exhaustive-deps

  // remarks + attachments of every step
  useEffect(() => {
    if (!open || !live || !coc?.renewalId) { setStepNotes([]); return; }
    api<StepNotes[]>(`/cd-certificates/renewals/${coc.renewalId}/steps`).then(setStepNotes).catch(() => setStepNotes([]));
  }, [open, live, coc?.renewalId, notesKey]);
  const notesOf = (i: number) => stepNotes.find(n => n.step === i + 1);

  const run = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    if (!live) { message.info('متاح عند فتح مبنى حقيقي'); return; }
    setBusy(true);
    try { await fn(); message.success(ok); onChanged(); if (close) onClose(); }
    catch (e: any) { if (!e?.errorFields) message.error(errorMessage(e), 6); }
    finally { setBusy(false); }
  };

  const d = (v: any) => (v ? dayjs(v).format('YYYY-MM-DD') : null);
  const billingBody = (b: any) => (b ? { ownerPartyId: b.ownerPartyId ?? null, years: b.years ?? 1, govFeesPerYear: b.govFeesPerYear ?? 0, serviceFeePerYear: b.serviceFeePerYear ?? 0 } : null);

  const addCertificate = () => run(async () => {
    const v = await form.validateFields();
    await api('/cd-certificates', {
      method: 'POST', body: {
        buildingId, certificateNo: v.certificateNo, certType: v.certType, licenseNo: v.licenseNo || null, issuedBy: v.issuedBy || null,
        issueDate: d(v.issueDate), expiryDate: d(v.expiryDate), scope: v.scope || null, inspectorName: v.inspectorName || null,
        inspectionDate: d(v.inspectionDate), notes: v.notes || null,
      },
    });
  }, 'تمت إضافة الشهادة', true);

  const requestNew = () => run(async () => {
    const v = await form.validateFields();
    await api('/cd-certificates/request', {
      method: 'POST', body: { buildingId, certType: v.certType, issuedBy: v.issuedBy || null, scope: v.scope || null, startedAt: d(v.startedAt), notes: v.notes || null,
        billing: billingBody(v.billing) },
    }).then((r: any) => { if (r?.invoiceNo) message.success(`صدرت فاتورة المالك ${r.invoiceNo}`, 6); });
  }, 'تم إنشاء طلب الشهادة — الخطوة 1: تقديم الطلب', true);

  const startRenewal = () => run(async () => {
    const v = await form.validateFields();
    const r: any = await api(`/cd-certificates/${coc!.dbId}/renewals`, { method: 'POST', body: { currentStep: 1, startedAt: dayjs().format('YYYY-MM-DD'), billing: billingBody(v.billing) } });
    if (r?.invoiceNo) message.success(`صدرت فاتورة المالك ${r.invoiceNo}`, 6);
  }, 'بدأ التجديد — الخطوة 1: تقديم الطلب', true);

  const completeStep = () => run(async () => {
    const v = await form.validateFields();
    await api(`/cd-certificates/renewals/${coc!.renewalId}`, {
      method: 'PUT', body: {
        currentStep: step + 1, inspectorName: v.inspectorName ?? renewal?.inspectorName ?? null, inspectorPhone: v.inspectorPhone ?? renewal?.inspectorPhone ?? null,
        inspectorDept: v.inspectorDept ?? renewal?.inspectorDept ?? null, renewalDate: d(v.renewalDate) ?? renewal?.renewalDate ?? null,
        remarks: v.remarks ?? renewal?.remarks ?? null,
      },
    });
  }, `تمت الخطوة: ${RENEWAL_STEPS[step - 1]?.title}`, true);

  const issueCertificate = () => run(async () => {
    const v = await form.validateFields();
    await api(`/cd-certificates/renewals/${coc!.renewalId}/complete`, {
      method: 'POST', body: { certificateNo: v.certificateNo, issueDate: d(v.issueDate), newExpiryDate: d(v.newExpiryDate), licenseNo: v.licenseNo || null, remarks: v.remarks || null },
    });
  }, 'تم إصدار الشهادة الجديدة', true);

  // fields shown under the step in progress
  const stepFields = (i: number) => {
    if (i === 2) return (
      <Row gutter={8}>
        <Col span={12}><Form.Item name="renewalDate" label="موعد الفحص" rules={[{ required: true, message: 'حدد الموعد' }]} style={{ marginBottom: 6 }}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={12}><Form.Item name="inspectorName" label="المفتش" style={{ marginBottom: 6 }}><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="inspectorPhone" label="هاتف المفتش" style={{ marginBottom: 6 }}><Input dir="ltr" /></Form.Item></Col>
        <Col span={12}><Form.Item name="inspectorDept" label="القسم" style={{ marginBottom: 6 }}><Input /></Form.Item></Col>
      </Row>
    );
    if (i === 1) return coc?.renewalId ? <CocFeesPanel renewalId={coc.renewalId} onPaidChange={setFeesPaid} /> : null;
    if (i === 3) return (
      <Form.Item name="remarks" label="نتيجة الفحص" style={{ marginBottom: 6 }}><Input.TextArea rows={2} /></Form.Item>
    );
    if (i === 4) return null;
    if (i === 5) return (
      <Row gutter={8}>
        <Col span={12}><Form.Item name="certificateNo" label="رقم الشهادة الجديدة" rules={[{ required: true, message: 'مطلوب' }]} style={{ marginBottom: 6 }}><Input dir="ltr" /></Form.Item></Col>
        <Col span={12}><Form.Item name="licenseNo" label="رقم الرخصة" style={{ marginBottom: 6 }}><Input dir="ltr" /></Form.Item></Col>
        <Col span={12}><Form.Item name="issueDate" label="تاريخ الإصدار" rules={[{ required: true, message: 'مطلوب' }]} style={{ marginBottom: 6 }}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={12}><Form.Item name="newExpiryDate" label="تاريخ الانتهاء" rules={[{ required: true, message: 'مطلوب' }]} style={{ marginBottom: 6 }}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
    );
    return <Form.Item name="remarks" label="ملاحظات" style={{ marginBottom: 6 }}><Input.TextArea rows={1} /></Form.Item>;
  };

  if (mode === 'add') return (
    <Modal open={open} onCancel={onClose} width={660} cancelText="إلغاء" destroyOnClose confirmLoading={busy}
      okText={addMode === 'request' ? 'بدء الطلب' : 'إضافة الشهادة'} onOk={addMode === 'request' ? requestNew : addCertificate}
      title={<Space><PlusOutlined style={{ color: PRIMARY }} /><Text strong>شهادة دفاع مدني جديدة</Text></Space>}>
      <Segmented block style={{ margin: '12px 0' }} value={addMode} onChange={v => setAddMode(v as 'request' | 'register')} options={[
        { value: 'request', label: 'طلب شهادة جديدة (خطوات العمل)' },
        { value: 'register', label: 'تسجيل شهادة صادرة مسبقاً' },
      ]} />
      {addMode === 'request' ? (
        <Form form={form} layout="vertical">
          <div style={{ background: '#f6faf7', border: '1px solid #e3efe6', borderRadius: 10, padding: '14px 8px 6px', marginBottom: 14 }}>
            <Steps size="small" labelPlacement="vertical" current={0}
              items={RENEWAL_STEPS.map(s => ({ title: <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{s.title}</span> }))} />
          </div>
          <Alert type="info" showIcon style={{ marginBottom: 14, fontSize: 12 }}
            message={<span><Text strong>الخطوة 1 — تقديم الطلب:</Text> سجّل بيانات الطلب المقدَّم للدفاع المدني. تُكمل باقي الخطوات من بطاقة «التجديد جاري» في تبويب الدفاع المدني حتى إصدار الشهادة.</span>} />
          <Row gutter={12}>
            <Col span={12}><Form.Item name="certType" label="نوع الشهادة"><Select options={[
              { value: 'gas_installation', label: 'تمديدات الغاز' }, { value: 'fire_safety', label: 'السلامة من الحريق' },
              { value: 'completion', label: 'إنجاز' }, { value: 'other', label: 'أخرى' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="issuedBy" label="جهة الإصدار"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="startedAt" label="تاريخ تقديم الطلب" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} disabledDate={x => x.isAfter(dayjs(), 'day')} /></Form.Item></Col>
            <Col span={12}><Form.Item name="scope" label="النطاق"><Input placeholder="مثال: تمديدات الغاز المركزي للمبنى" /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات / رقم الطلب في بوابة الدفاع المدني"><Input.TextArea rows={2} /></Form.Item></Col>
            {live && <Col span={24}><CdBillingFields buildingId={buildingId} form={form} /></Col>}
          </Row>
        </Form>
      ) : (
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="certificateNo" label="رقم الشهادة" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="certType" label="النوع"><Select options={[
              { value: 'gas_installation', label: 'تمديدات الغاز' }, { value: 'fire_safety', label: 'السلامة من الحريق' },
              { value: 'completion', label: 'إنجاز' }, { value: 'other', label: 'أخرى' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="licenseNo" label="رقم الرخصة"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="issuedBy" label="جهة الإصدار"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="issueDate" label="تاريخ الإصدار" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="expiryDate" label="تاريخ الانتهاء" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="inspectorName" label="المفتش"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="inspectionDate" label="تاريخ الفحص"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="scope" label="النطاق"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      )}
    </Modal>
  );

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={680} destroyOnClose
      title={<Space><AuditOutlined style={{ color: PRIMARY }} /><Text strong>خطوات تجديد شهادة الدفاع المدني</Text>{coc && <Tag color="blue">{coc.id}</Tag>}</Space>}>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
        <Form form={form} layout="vertical" style={{ padding: '16px 0' }}>
          {step === 0 && live && <CdBillingFields buildingId={buildingId} form={form} />}
          {step === 0 && (
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message={coc?.status === 'pending' ? 'طلب شهادة جديدة' : coc?.status === 'expired' ? 'هذه الشهادة منتهية — ابدأ التجديد لإصدار شهادة جديدة' : 'لم يبدأ التجديد بعد لهذه الشهادة'}
              action={<Button type="primary" size="small" loading={busy} icon={<AuditOutlined />} onClick={startRenewal}>بدء التجديد</Button>} />
          )}
          <Steps direction="vertical" current={step === 0 ? -1 : step - 1}
            items={RENEWAL_STEPS.map((s, i) => ({
              title: <Text strong style={{ fontSize: 13 }}>{s.title}</Text>,
              icon: i < step - 1 ? <CheckOutlined style={{ color: '#52c41a' }} /> : s.icon,
              description: (
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.description}</Text>
                  {i < step - 1 && <div><Tag color="success" style={{ marginTop: 4, fontSize: 11 }}>✓ مكتملة{i === 1 ? ' — تم سداد الرسوم' : ''}</Tag>
                    {i === 2 && renewal?.renewalDate && <Text style={{ fontSize: 11 }}> موعد الفحص: {String(renewal.renewalDate).slice(0, 10)}{renewal.inspectorName ? ` — ${renewal.inspectorName}` : ''}</Text>}
                    <StepNotesList data={notesOf(i)} /></div>}
                  {step > 0 && i === step - 1 && (
                    <div style={{ marginTop: 8, padding: 10, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                      {stepFields(i)}
                      {live && coc?.renewalId && i !== 1 && (
                        <StepNotesEditor renewalId={coc.renewalId} step={i + 1} data={notesOf(i)} onSaved={() => setNotesKey(k => k + 1)} />
                      )}
                      {showHelp === i && <Alert type="info" style={{ margin: '6px 0', fontSize: 12 }} message={s.help} />}
                      <Button size="small" type="primary" loading={busy} style={{ marginTop: 4 }} onClick={i === 5 ? issueCertificate : completeStep}
                        disabled={i === 1 && live && !feesPaid}>
                        {s.action} {i < 5 ? '← الخطوة التالية' : ''}
                      </Button>
                      <Button size="small" type="link" style={{ marginTop: 4 }} onClick={() => setShowHelp(showHelp === i ? null : i)}>مشاهدة التعليمات</Button>
                    </div>
                  )}
                </div>
              ),
            }))} />
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginInlineEnd: 4 }} />
            {coc?.expiryDate ? `تنتهي الشهادة الحالية في ${coc.expiryDate}` : ''}
            {renewal?.startedAt ? ` · بدأ التجديد ${String(renewal.startedAt).slice(0, 10)}` : ''}
          </Text>
        </Form>
      )}
    </Modal>
  );
}

