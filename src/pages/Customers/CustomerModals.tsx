import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col, message, Typography, Alert } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { METHODS, money } from './shared';

const { Text } = Typography;

/** Add / edit a customer (tenant record) — POST /tenants, PUT /tenants/{id}. */
export function CustomerFormModal({ open, customer, onClose, onSaved }: { open: boolean; customer?: any | null; onClose: () => void; onSaved: (id: number) => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (customer) form.setFieldsValue({
      nameAr: customer.nameAr, nameEn: customer.nameEn, phone: customer.phone, email: customer.email, emiratesId: customer.emiratesId,
      nationality: customer.nationalityCode, dob: customer.dob ? dayjs(customer.dob) : undefined, cityId: customer.cityId, address: customer.address,
      branchId: customer.branchId,
    });
    else if (ref?.branches?.length === 1) form.setFieldsValue({ branchId: ref.branches[0].id });
  }, [open, customer, ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body = {
        branchId: v.branchId ?? null, nameAr: v.nameAr, nameEn: v.nameEn || null, phone: v.phone || null, email: v.email || null,
        emiratesId: v.emiratesId || null, nationality: v.nationality || null, dob: v.dob?.format('YYYY-MM-DD') ?? null, cityId: v.cityId ?? null, address: v.address || null,
      };
      if (customer?.id) { await api(`/tenants/${customer.id}`, { method: 'PUT', body }); message.success('تم حفظ بيانات العميل'); onSaved(customer.id); }
      else { const r = await api<{ id: number; code: string }>('/tenants', { method: 'POST', body }); message.success(`تمت إضافة العميل ${r.code}`); onSaved(r.id); }
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={customer ? `تعديل العميل ${customer.code ?? ''}` : 'عميل جديد'} okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving}
      onCancel={onClose} destroyOnClose width={640}>
      {!customer && <Alert type="info" showIcon style={{ marginBottom: 12, fontSize: 12 }} message="لربط العميل بوحدة وعقد توريد استخدم «عقد جديد» من صفحة عقود الغاز أو من ملف الوحدة." />}
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="nameAr" label="الاسم" rules={[{ required: true, message: 'الاسم مطلوب' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="phone" label="الهاتف" rules={[{ pattern: /^[+\d\s-]{7,20}$/, message: 'رقم غير صحيح' }]}><Input dir="ltr" placeholder="+971 5X XXX XXXX" /></Form.Item></Col>
          <Col span={12}><Form.Item name="email" label="البريد" rules={[{ type: 'email', message: 'بريد غير صحيح' }]}><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="emiratesId" label="الهوية الإماراتية / الرخصة"><Input dir="ltr" placeholder="784-XXXX-XXXXXXX-X" /></Form.Item></Col>
          <Col span={12}><Form.Item name="nationality" label="الجنسية">
            <Select allowClear showSearch optionFilterProp="label" options={(ref?.lookups?.NATIONALITY ?? []).map(n => ({ value: n.code, label: n.label }))} />
          </Form.Item></Col>
          <Col span={12}><Form.Item name="dob" label="تاريخ الميلاد"><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} /></Form.Item></Col>
          <Col span={12}><Form.Item name="branchId" label="الفرع" rules={[{ required: !customer, message: 'اختر الفرع' }]}>
            <Select disabled={!!customer} options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
          </Form.Item></Col>
          <Col span={12}><Form.Item name="cityId" label="المدينة">
            <Select allowClear showSearch optionFilterProp="label" options={(ref?.cities ?? []).map(c => ({ value: c.id, label: locName(c, isAr) }))} />
          </Form.Item></Col>
          <Col span={12}><Form.Item name="address" label="العنوان"><Input /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}

/** Record a customer payment — POST /payments (to one invoice, or FIFO over open invoices). */
export function RecordPaymentModal({ open, tenantId, tenantName, onClose, onSaved }: { open: boolean; tenantId: number | null; tenantName?: string; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [openInv, setOpenInv] = useState<any[]>([]);
  useEffect(() => {
    if (!open || !tenantId) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs(), method: 'cash' });
    api<Paged<any>>('/invoices', { query: { tenantId, openOnly: true, pageSize: 0, sort: 'dueDate' } })
      .then(r => { setOpenInv(r.items); form.setFieldsValue({ amount: r.items.reduce((s: number, i: any) => s + Number(i.balance), 0) || undefined }); })
      .catch(() => setOpenInv([]));
  }, [open, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<any>('/payments', { method: 'POST', body: {
        tenantId, amount: v.amount, date: v.date.format('YYYY-MM-DD'), method: v.method, reference: v.reference || null, notes: v.notes || null, invoiceId: v.invoiceId ?? null,
      } });
      message.success(`تم تسجيل الدفعة ${r?.receiptNo ?? ''}`);
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const due = openInv.reduce((s, i) => s + Number(i.balance), 0);

  return (
    <Modal open={open} title={`تسجيل دفعة${tenantName ? ` — ${tenantName}` : ''}`} okText="حفظ الدفعة" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        المستحق: <Text strong>{money(due)}</Text> في {openInv.length} فاتورة مفتوحة. بدون اختيار فاتورة تُوزع الدفعة على الأقدم أولاً.
      </Text>
      <Form form={form} layout="vertical">
        <Form.Item name="invoiceId" label="الفاتورة (اختياري)">
          <Select allowClear placeholder="توزيع تلقائي على الفواتير الأقدم"
            options={openInv.map(i => ({ value: i.id, label: `${i.invoiceNo} — رصيد ${money(i.balance)} — استحقاق ${i.dueDate}` }))}
            onChange={(id?: number) => { const i = openInv.find(x => x.id === id); form.setFieldsValue({ amount: i ? Number(i.balance) : due || undefined }); }} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="amount" label="المبلغ" rules={[{ required: true, message: 'أدخل المبلغ' }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="date" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item></Col>
          <Col span={12}><Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}><Select options={METHODS} /></Form.Item></Col>
          <Col span={12}><Form.Item name="reference" label="المرجع / رقم الشيك"><Input dir="ltr" /></Form.Item></Col>
        </Row>
        <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}
