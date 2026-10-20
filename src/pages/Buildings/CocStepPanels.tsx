import { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Typography, Upload, message, Space, Alert } from 'antd';
import { PlusOutlined, DollarOutlined, UploadOutlined, PaperClipOutlined, CheckCircleOutlined, WarningOutlined, MessageOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { API_BASE, api, apiUpload, errorMessage, authFetch } from '../../api/client';

const { Text } = Typography;
const money = (n?: number) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} د.إ`;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';
const FEE_STATUS: Record<string, { color: string; label: string }> = {
  unpaid: { color: 'gold', label: 'غير مسددة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, overdue: { color: 'error', label: 'متأخرة السداد' },
};
const METHODS = [
  { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'card', label: 'بطاقة' }, { value: 'online', label: 'إلكتروني' },
  { value: 'cheque', label: 'شيك' }, { value: 'cash', label: 'نقداً' },
];

// ═════════════ step 2: fees invoice → payment (continue only when paid) ═════════════
export function CocFeesPanel({ renewalId, onPaidChange }: { renewalId: number; onPaidChange: (paid: boolean) => void }) {
  const [data, setData] = useState<{ paid: boolean; bills: any[]; ownerInvoice?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [payBill, setPayBill] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [addForm] = Form.useForm();
  const [payForm] = Form.useForm();
  const today = dayjs();

  const load = useCallback(() => {
    setLoading(true);
    api<{ paid: boolean; bills: any[]; ownerInvoice?: any }>(`/cd-certificates/renewals/${renewalId}/fees`)
      .then(r => { setData(r); onPaidChange(r.paid); })
      .catch(e => { setData({ paid: false, bills: [] }); onPaidChange(false); message.error(errorMessage(e)); })
      .finally(() => setLoading(false));
  }, [renewalId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const addFee = async () => {
    const v = await addForm.validateFields();
    setSaving(true);
    try {
      const res = await api<any>(`/cd-certificates/renewals/${renewalId}/fees`, {
        method: 'POST', body: {
          billNo: v.billNo, billDate: v.billDate.format('YYYY-MM-DD'), dueDate: v.dueDate?.format('YYYY-MM-DD') ?? null,
          amount: v.amount, vatRate: v.vatRate ?? 0, description: v.description || null,
        },
      });
      if (res?.supplementInvoiceNo) message.info(`الرسوم الفعلية أعلى من المفوتر للمالك — صدرت فاتورة إضافية ${res.supplementInvoiceNo} بمبلغ ${money(res.supplementAmount)}`, 8);
      else if (Number(res?.overInvoiced) > 0) message.warning(`الرسوم الفعلية أقل مما فُوتر للمالك بمبلغ ${money(res.overInvoiced)} — أصدر إشعاراً دائناً من فاتورة المالك إن لزم`, 8);
      message.success('تم تسجيل فاتورة الرسوم');
      setAddOpen(false);
      load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const pay = async () => {
    const v = await payForm.validateFields();
    setSaving(true);
    try {
      await api(`/cd-certificates/renewals/${renewalId}/fees/${payBill.id}/pay`, {
        method: 'POST', body: { amount: v.amount, date: v.date.format('YYYY-MM-DD'), method: v.method, reference: v.reference || null },
      });
      message.success('تم تسجيل الدفع');
      setPayBill(null);
      load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const bills = data?.bills ?? [];
  return (
    <div style={{ marginBottom: 8 }}>
      {data?.ownerInvoice ? (
        <Alert type="info" showIcon style={{ marginBottom: 8, fontSize: 12 }}
          message={<span>فاتورة المالك <b>{data.ownerInvoice.invoiceNo}</b> بتاريخ {data.ownerInvoice.issueDate} — {money(data.ownerInvoice.total)} (مسدد {money(data.ownerInvoice.paid)}){data.ownerInvoice.years ? ` · ${data.ownerInvoice.years} سنة` : ''}</span>} />
      ) : data && <Alert type="warning" showIcon style={{ marginBottom: 8, fontSize: 12 }} message="لم تصدر فاتورة للمالك لهذا الطلب" />}
      {data && (bills.length === 0
        ? <Alert type="warning" showIcon style={{ marginBottom: 8, fontSize: 12 }} message="سجّل فاتورة / إشعار رسوم الدفاع المدني أولاً، ثم سجّل الدفع للمتابعة" />
        : data.paid
          ? <Alert type="success" showIcon icon={<CheckCircleOutlined />} style={{ marginBottom: 8, fontSize: 12 }} message="تم سداد الرسوم بالكامل — يمكنك الانتقال إلى الخطوة التالية" />
          : <Alert type="error" showIcon icon={<WarningOutlined />} style={{ marginBottom: 8, fontSize: 12 }} message={`الرسوم غير مسددة — المتبقي ${money(bills.reduce((s, b) => s + Number(b.balance), 0))}. لا يمكن المتابعة قبل السداد`} />)}
      <Table size="small" rowKey="id" loading={loading} dataSource={bills} pagination={false} scroll={{ x: 560 }}
        locale={{ emptyText: 'لا توجد فواتير رسوم' }}
        columns={[
          { title: 'رقم الفاتورة', dataIndex: 'billNo', render: (t, b) => <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</Text><div style={{ fontSize: 11, color: '#888' }}>{b.billDate}</div></div> },
          { title: 'الاستحقاق', dataIndex: 'dueDate', render: (t, b) => <Text style={{ fontSize: 12, color: b.status === 'overdue' ? '#ff4d4f' : undefined }}>{t ?? '—'}</Text> },
          { title: 'الإجمالي', dataIndex: 'total', render: v => <Text style={{ fontSize: 12 }}>{money(v)}</Text> },
          { title: 'المدفوع', dataIndex: 'paid', render: (v, b) => (
            <div><Text style={{ fontSize: 12, color: '#52c41a' }}>{money(v)}</Text>
              {(b.payments ?? []).map((p: any) => <div key={p.paymentNo} style={{ fontSize: 10, color: '#888' }}>{p.paymentNo} · {p.paymentDate}{p.referenceNo ? ` · ${p.referenceNo}` : ''}</div>)}</div>) },
          { title: 'الحالة', dataIndex: 'status', render: (s, b) => <div><Tag color={FEE_STATUS[s]?.color}>{FEE_STATUS[s]?.label ?? s}</Tag>{s === 'overdue' && <div style={{ fontSize: 10, color: '#ff4d4f' }}>متأخرة {b.daysLate} يوم</div>}</div> },
          { title: '', key: 'a', render: (_, b) => Number(b.balance) > 0 && (
            <Button size="small" type="primary" icon={<DollarOutlined />}
              onClick={() => { payForm.setFieldsValue({ amount: Number(b.balance), date: today, method: 'bank_transfer' }); setPayBill(b); }}>تسجيل الدفع</Button>) },
        ]} />
      <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 6 }}
        onClick={() => { addForm.resetFields(); addForm.setFieldsValue({ billDate: today, dueDate: today.add(7, 'day'), vatRate: 0 }); setAddOpen(true); }}>
        تسجيل فاتورة رسوم
      </Button>

      <Modal open={addOpen} title="فاتورة رسوم الدفاع المدني" okText="حفظ" cancelText="إلغاء" onOk={addFee} confirmLoading={saving} onCancel={() => setAddOpen(false)} destroyOnClose>
        <Form form={addForm} layout="vertical">
          <Form.Item name="billNo" label="رقم الفاتورة / إشعار الدفع" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="billDate" label="تاريخ الفاتورة" rules={[{ required: true }]}><DatePicker disabledDate={x => x.isAfter(today, 'day')} /></Form.Item>
            <Form.Item name="dueDate" label="تاريخ الاستحقاق"><DatePicker /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="amount" label="المبلغ (قبل الضريبة)" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: 180 }} /></Form.Item>
            <Form.Item name="vatRate" label="الضريبة %"><InputNumber min={0} max={100} style={{ width: 100 }} /></Form.Item>
          </Space>
          <Form.Item name="description" label="البيان"><Input placeholder="رسوم الفحص وإصدار الشهادة" /></Form.Item>
        </Form>
      </Modal>

      <Modal open={!!payBill} title={`تسجيل دفع — ${payBill?.billNo ?? ''}`} okText="حفظ الدفع" cancelText="إلغاء" onOk={pay} confirmLoading={saving} onCancel={() => setPayBill(null)} destroyOnClose>
        <Form form={payForm} layout="vertical">
          <Form.Item name="amount" label={`المبلغ (المتبقي ${money(payBill?.balance)})`} rules={[{ required: true }]}>
            <InputNumber min={0.01} max={Number(payBill?.balance ?? 0)} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={x => x.isAfter(today, 'day') || (!!payBill && x.isBefore(dayjs(payBill.billDate), 'day'))} />
          </Form.Item>
          <Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}><Select options={METHODS} /></Form.Item>
          <Form.Item name="reference" label="رقم الإيصال / المرجع"><Input dir="ltr" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ═════════════ remarks + attachments of one step ═════════════
export interface StepNotes { step: number; notes: { text: string; at: string; user?: string }[]; files: { id: number; fileName?: string; mimeType?: string; sizeBytes?: number; createdAt?: string }[] }

async function openFile(f: StepNotes['files'][number]) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/cd-certificates/renewals/attachments/${f.id}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'الملف غير موجود' : `تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(f.mimeType ?? '')) w.location.href = url;
    else { w?.close(); const a = document.createElement('a'); a.href = url; a.download = f.fileName ?? 'file'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

/** Existing remarks / files of a step (read-only list). */
export function StepNotesList({ data }: { data?: StepNotes }) {
  if (!data || (data.notes.length === 0 && data.files.length === 0)) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {data.notes.map((n, i) => (
        <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, marginBottom: 4 }}>
          <MessageOutlined style={{ color: '#1677ff', marginInlineEnd: 6 }} />{n.text}
          <div style={{ fontSize: 10, color: '#999' }}>{dayjs(n.at).format('YYYY-MM-DD HH:mm')}{n.user ? ` · ${n.user}` : ''}</div>
        </div>
      ))}
      {data.files.map(f => (
        <div key={f.id} style={{ fontSize: 12 }}><PaperClipOutlined /> <a onClick={() => openFile(f)}>{f.fileName}</a></div>
      ))}
    </div>
  );
}

/** Add a remark and/or attachments to a step. */
export function StepNotesEditor({ renewalId, step, data, onSaved, required }: { renewalId: number; step: number; data?: StepNotes; onSaved: () => void; required?: boolean }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!text.trim() && files.length === 0) { message.warning('اكتب ملاحظة أو أرفق ملفاً'); return; }
    const fd = new FormData();
    if (text.trim()) fd.append('remarks', text.trim());
    files.forEach(f => f.originFileObj && fd.append('files', f.originFileObj as File));
    setSaving(true);
    try { await apiUpload(`/cd-certificates/renewals/${renewalId}/steps/${step}/notes`, fd); message.success('تم الحفظ'); setText(''); setFiles([]); onSaved(); }
    catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: 600 }}>الملاحظات والمرفقات{required ? '' : ' (اختياري)'}</Text>
      <StepNotesList data={data} />
      <Input.TextArea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="اكتب الملاحظة / ما تم تصحيحه…" style={{ marginTop: 6 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 6, flexWrap: 'wrap' }}>
        <Upload multiple accept={ACCEPT} fileList={files} beforeUpload={() => false} maxCount={10} onChange={({ fileList }) => setFiles(fileList)}>
          <Button size="small" icon={<UploadOutlined />}>إرفاق ملفات</Button>
        </Upload>
        <Button size="small" type="primary" ghost loading={saving} onClick={save}>حفظ الملاحظة / المرفقات</Button>
      </div>
    </div>
  );
}

// ═════════════ expanded certificate row: details, documents and the full workflow history ═════════════
const STEP_TITLES = ['تقديم الطلب', 'دفع الرسوم', 'جدولة الفحص', 'الفحص الميداني', 'معالجة الملاحظات', 'إصدار الشهادة'];

async function openCertDoc(f: { id: number; fileName?: string; mimeType?: string }) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/cd-certificates/documents/${f.id}`);
    if (!res.ok) throw new Error(`تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(f.mimeType ?? '')) w.location.href = url;
    else { w?.close(); const a = document.createElement('a'); a.href = url; a.download = f.fileName ?? 'file'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

interface RenewalHistory { renewal: any; status: string; producedThis?: boolean; steps: StepNotes[]; fees: { paid: boolean; bills: any[] } }

export function CocCertificateDetails({ dbId }: { dbId: number }) {
  const [cert, setCert] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [history, setHistory] = useState<RenewalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([api<any>(`/cd-certificates/${dbId}`), api<any[]>(`/cd-certificates/${dbId}/documents`).catch(() => [])])
      .then(async ([d, docList]) => {
        setCert(d);
        setDocs(docList);
        const hs = await Promise.all((d.renewals ?? []).map(async (x: any) => ({
          ...x,
          steps: await api<StepNotes[]>(`/cd-certificates/renewals/${x.renewal.id}/steps`).catch(() => []),
          fees: await api<{ paid: boolean; bills: any[] }>(`/cd-certificates/renewals/${x.renewal.id}/fees`).catch(() => ({ paid: false, bills: [] })),
        })));
        setHistory(hs);
      })
      .catch(e => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [dbId, key]);

  const upload = async () => {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => f.originFileObj && fd.append('files', f.originFileObj as File));
    setUploading(true);
    try { await apiUpload(`/cd-certificates/${dbId}/documents`, fd); message.success('تم إرفاق الوثائق'); setFiles([]); setKey(k => k + 1); }
    catch (e) { message.error(errorMessage(e), 6); } finally { setUploading(false); }
  };

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Text type="secondary">جاري التحميل…</Text></div>;
  const c = cert?.certificate ?? {};
  const d10 = (v: any) => (v ? String(v).slice(0, 10) : '—');
  return (
    <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 28px', fontSize: 12, marginBottom: 10 }}>
        <span><Text type="secondary">النوع: </Text>{cert?.certTypeLabel ?? '—'}</span>
        <span><Text type="secondary">جهة الإصدار: </Text>{c.issuedBy || '—'}</span>
        <span><Text type="secondary">النطاق: </Text>{c.scope || '—'}</span>
        <span><Text type="secondary">المفتش: </Text>{c.inspectorName || '—'} · <Text type="secondary">تاريخ الفحص: </Text>{d10(c.inspectionDate)}</span>
        {c.notes && <span><Text type="secondary">ملاحظات: </Text>{c.notes}</span>}
      </div>

      {/* documents of the certificate */}
      <Text strong style={{ fontSize: 12 }}>وثائق الشهادة</Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '6px 0 12px' }}>
        {docs.length === 0 && <Text type="secondary" style={{ fontSize: 11 }}>لا توجد وثائق مرفقة</Text>}
        {docs.map(f => <Button key={f.id} size="small" icon={<PaperClipOutlined />} style={{ fontSize: 11 }} onClick={() => openCertDoc(f)}>{f.fileName}</Button>)}
        <Upload multiple accept={ACCEPT} fileList={files} beforeUpload={() => false} maxCount={10} onChange={({ fileList }) => setFiles(fileList)} showUploadList={files.length > 0}>
          <Button size="small" icon={<PlusOutlined />} style={{ fontSize: 11 }}>إرفاق وثيقة</Button>
        </Upload>
        {files.length > 0 && <Button size="small" type="primary" loading={uploading} onClick={upload}>رفع {files.length} ملف</Button>}
      </div>

      {/* workflow history (the request / renewal that issued this certificate, and renewals started from it) */}
      {history.map(h => {
        const r = h.renewal;
        const doneSteps = h.status === 'completed' ? 6 : Math.max(0, (r.currentStep ?? 1) - 1);
        return (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <Text strong style={{ fontSize: 12 }}>{h.producedThis || h.status === 'completed' ? 'سجل إجراءات إصدار الشهادة' : 'إجراءات التجديد'} — بدأ {d10(r.startedAt)}</Text>
              <Tag color={h.status === 'completed' ? 'success' : h.status === 'cancelled' ? 'default' : 'processing'}>
                {h.status === 'completed' ? 'مكتمل' : h.status === 'cancelled' ? 'ملغى' : `الخطوة ${r.currentStep ?? 1} من 6`}
              </Tag>
            </div>
            {STEP_TITLES.map((t, i) => {
              const n = h.steps.find(s => s.step === i + 1);
              const done = i < doneSteps;
              const fees = i === 1 ? h.fees.bills : [];
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderTop: i ? '1px dashed #f0f0f0' : undefined }}>
                  <Tag color={done ? 'success' : i === doneSteps && h.status === 'in_progress' ? 'processing' : 'default'} style={{ minWidth: 26, textAlign: 'center', height: 22 }}>{done ? '✓' : i + 1}</Tag>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600 }}>{t}</Text>
                    {i === 2 && r.renewalDate && <Text type="secondary" style={{ fontSize: 11 }}> — موعد الفحص {d10(r.renewalDate)}{r.inspectorName ? ` · ${r.inspectorName}` : ''}{r.inspectorPhone ? ` · ${r.inspectorPhone}` : ''}</Text>}
                    {i === 5 && h.status === 'completed' && <Text type="secondary" style={{ fontSize: 11 }}> — صالحة حتى {d10(r.newExpiryDate)}</Text>}
                    {fees.map((b: any) => (
                      <div key={b.id} style={{ fontSize: 11 }}>
                        <DollarOutlined /> فاتورة {b.billNo} — {money(b.total)} · <Tag color={FEE_STATUS[b.status]?.color} style={{ fontSize: 10 }}>{FEE_STATUS[b.status]?.label}</Tag>
                        {(b.payments ?? []).map((p: any) => <span key={p.paymentNo} style={{ color: '#888' }}> {p.paymentNo} ({p.paymentDate}{p.referenceNo ? ` · ${p.referenceNo}` : ''})</span>)}
                      </div>
                    ))}
                    {i === 3 && r.remarks && <div style={{ fontSize: 11, color: '#555' }}>{r.remarks}</div>}
                    <StepNotesList data={n} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Owner billing of a certificate request / renewal (issued when the request opens):
 * government fees per year (0% — out of scope) + our service fee per year (+5% VAT) × years. Field names are under «billing».
 */
export function CdBillingFields({ buildingId, form }: { buildingId?: number; form: any }) {
  const [owners, setOwners] = useState<{ partyId: number; name: string; isPrimary: boolean }[]>([]);
  useEffect(() => {
    if (!buildingId) return;
    api<any>('/cd-certificates/billing-defaults', { query: { buildingId } }).then(r => {
      setOwners(r.owners ?? []);
      const cur = form.getFieldValue('billing') ?? {};
      form.setFieldsValue({ billing: {
        ownerPartyId: cur.ownerPartyId ?? r.owners?.[0]?.partyId, years: cur.years ?? r.years ?? 1,
        govFeesPerYear: cur.govFeesPerYear ?? (r.govFeesPerYear || undefined), serviceFeePerYear: cur.serviceFeePerYear ?? (r.serviceFeePerYear || undefined),
      } });
    }).catch(() => undefined);
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = Form.useWatch('billing', form) ?? {};
  const years = Number(b.years ?? 1), gov = Number(b.govFeesPerYear ?? 0) * years, svc = Number(b.serviceFeePerYear ?? 0) * years;
  const vat = Math.round(svc * 5) / 100;
  return (
    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
      <Text strong style={{ fontSize: 13 }}>فاتورة المالك (تصدر وتُرحّل عند فتح الطلب)</Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 8 }}>
        <Form.Item name={['billing', 'ownerPartyId']} label="المالك" style={{ marginBottom: 4 }} rules={[{ required: owners.length > 0 && gov + svc > 0, message: 'اختر المالك' }]}>
          <Select placeholder={owners.length ? 'المالك' : 'لا يوجد مالك للمبنى'} options={owners.map(o => ({ value: o.partyId, label: `${o.name}${o.isPrimary ? ' (رئيسي)' : ''}` }))} />
        </Form.Item>
        <Form.Item name={['billing', 'years']} label="المدة (سنوات)" style={{ marginBottom: 4 }}><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name={['billing', 'govFeesPerYear']} label="الرسوم الحكومية / سنة" style={{ marginBottom: 4 }}><InputNumber min={0} style={{ width: '100%' }} addonAfter="د.إ" /></Form.Item>
        <Form.Item name={['billing', 'serviceFeePerYear']} label="رسوم الخدمة / سنة" style={{ marginBottom: 4 }}><InputNumber min={0} style={{ width: '100%' }} addonAfter="د.إ" /></Form.Item>
      </div>
      <div style={{ fontSize: 12, color: '#555' }}>
        الرسوم الحكومية {money(gov)} (خارج نطاق الضريبة) + الخدمة {money(svc)} + ضريبة 5% {money(vat)} = <b>{money(gov + svc + vat)}</b>
        {gov + svc === 0 && <Text type="secondary"> — بدون مبالغ لن تصدر فاتورة الآن (يمكن إصدارها لاحقاً)</Text>}
        {owners.length === 0 && <Text type="danger"> — أضف مالك المبنى أولاً لإصدار الفاتورة</Text>}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>إذا كانت الرسوم الفعلية المدفوعة للدفاع المدني أعلى، تصدر فاتورة إضافية للمالك تلقائياً عند تسجيلها.</Text>
    </div>
  );
}
