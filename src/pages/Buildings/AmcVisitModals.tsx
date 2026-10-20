import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, Checkbox, Upload, Button, Tag, Typography, Divider, Empty, Spin, Alert, message, Space, Rate, Row, Col } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, PaperClipOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { API_BASE, api, apiUpload, errorMessage, authFetch } from '../../api/client';

const { Text } = Typography;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';
const EXTRA = -1;

interface VisitRow { id: number; visitNo?: string; scheduledDate: string; visitDate?: string | null; periodLabel?: string | null; status: string }
interface Attachment { id: number; fileName?: string; mimeType?: string; sizeBytes?: number; createdAt?: string }

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'مجدولة' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' },
  completed: { color: 'success', label: 'مكتملة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const kb = (n?: number) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const visitLabel = (v: VisitRow) => `${v.periodLabel || v.visitNo || 'زيارة'} — ${v.visitDate ?? v.scheduledDate}`;

async function openAttachment(a: Attachment) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/maintenance-visits/attachments/${a.id}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'الملف غير موجود' : `تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(a.mimeType ?? '')) w.location.href = url;
    else { w?.close(); const l = document.createElement('a'); l.href = url; l.download = a.fileName ?? 'attachment'; l.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

const toForm = (files: UploadFile[], summary?: string) => {
  const fd = new FormData();
  if (summary) fd.append('reportSummary', summary);
  files.forEach(f => f.originFileObj && fd.append('files', f.originFileObj as File));
  return fd;
};

interface Props { open: boolean; contract: any; onClose: () => void; onDone: () => void; visitId?: number | null }

/** Active employees for the «technician» dropdown. */
export function useEmployeeOptions(open = true) {
  const [list, setList] = useState<{ id: number; name: string; employeeNo?: string; jobTitle?: string; phone?: string }[]>([]);
  useEffect(() => { if (open) api<any[]>('/employees/options').then(setList).catch(() => setList([])); }, [open]);
  return list;
}
export const employeeLabel = (e: { name: string; employeeNo?: string; jobTitle?: string }) => `${e.name}${e.employeeNo ? ` — ${e.employeeNo}` : ''}${e.jobTitle ? ` (${e.jobTitle})` : ''}`;

// ═════════════════════════ record a visit (complete a scheduled one, or an extra visit) ═════════════════════════
export function RecordVisitModal({ open, contract, onClose, onDone, visitId: preset }: Props) {
  const employees = useEmployeeOptions(open);
  const [form] = Form.useForm();
  const [visitId, setVisitId] = useState<number | null>(null);
  const [checklist, setChecklist] = useState<{ id: number; itemText: string; isDone: boolean; notes?: string }[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);
  const today = dayjs().startOf('day');
  const openVisits: VisitRow[] = (contract?.visits ?? []).filter((v: VisitRow) => v.status === 'scheduled' || v.status === 'in_progress')
    .sort((a: VisitRow, b: VisitRow) => a.scheduledDate.localeCompare(b.scheduledDate));

  useEffect(() => {
    if (!open) return;
    const first = (preset != null ? openVisits.find(v => v.id === preset) : null) ?? openVisits.find(v => !dayjs(v.scheduledDate).isAfter(today)) ?? openVisits[0];
    const id = first?.id ?? EXTRA;
    form.resetFields();
    form.setFieldsValue({ visitId: id, visitDate: today, visitType: 'corrective', findings: [] });
    setFiles([]);
    setVisitId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // checklist items come from the «VISIT_CHECKLIST» lookup (Settings → قائمة الفحص); a visit already ticked keeps its ticks
  useEffect(() => {
    if (!open || visitId == null) return;
    setLoadingList(true);
    Promise.all([
      api<{ id: number; label: string; nameAr?: string; nameEn?: string }[]>('/lookups/VISIT_CHECKLIST'),
      visitId === EXTRA ? Promise.resolve(null) : api<any>(`/maintenance-visits/${visitId}`).catch(() => null),
    ])
      .then(([items, visit]) => {
        const prev: any[] = visit?.checklist ?? [];
        if (visit?.visit?.technicianEmployeeId) form.setFieldsValue({ technicianEmployeeId: visit.visit.technicianEmployeeId });
        setChecklist(items.map(i => {
          const p = prev.find(x => x.itemText === (i.nameAr ?? i.nameEn ?? i.label) || x.itemText === i.label);
          return { id: i.id, itemText: i.label, isDone: !!p?.isDone, notes: p?.notes ?? '' };
        }));
      })
      .catch(() => setChecklist([]))
      .finally(() => setLoadingList(false));
  }, [open, visitId]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      let id: number = v.visitId;
      if (id === EXTRA) {
        const r = await api<{ id: number }>('/maintenance-visits', {
          method: 'POST', body: { amcContractId: Number(contract.id), scheduledDate: v.visitDate.format('YYYY-MM-DD'), visitType: v.visitType, notes: v.notes || null },
        });
        id = r.id;
      }
      await api(`/maintenance-visits/${id}/complete`, {
        method: 'POST', body: {
          visitDate: v.visitDate.format('YYYY-MM-DD'), reportSummary: v.reportSummary || null, notes: v.notes || null,
          technicianEmployeeId: v.technicianEmployeeId ?? null, customerRating: v.customerRating || null,
          customerFeedback: v.customerFeedback || null, feedbackBy: v.feedbackBy || null,
          checklistItems: checklist.map(c => ({ lookupId: c.id, isDone: c.isDone, notes: c.notes || null })),
          findings: (v.findings ?? []).filter((f: any) => f?.description?.trim()).map((f: any) => ({
            severity: f.severity ?? 'medium', description: f.description.trim(), actionTaken: f.actionTaken || null,
            createServiceRequest: !!f.createServiceRequest, priority: f.severity === 'critical' ? 'urgent' : f.severity === 'high' ? 'high' : 'medium',
          })),
        },
      });
      if (files.length) await apiUpload(`/maintenance-visits/${id}/report`, toForm(files));
      message.success('تم تسجيل الزيارة');
      onDone();
      onClose();
    } catch (e) { message.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const selected = openVisits.find(v => v.id === visitId);
  const early = selected && dayjs(selected.scheduledDate).isAfter(today);

  return (
    <Modal open={open} title={`تسجيل زيارة — ${contract?.contractNo ?? ''}`} width={680} okText="تسجيل الزيارة" cancelText="إلغاء"
      onOk={submit} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="visitId" label="الزيارة" rules={[{ required: true }]}>
          <Select onChange={(id: number) => setVisitId(id)} options={[
            ...openVisits.map(v => ({
              value: v.id,
              label: <span>{visitLabel(v)} {dayjs(v.scheduledDate).isBefore(today) && <Tag color="error" style={{ marginInlineStart: 6 }}>متأخرة</Tag>}</span>,
            })),
            { value: EXTRA, label: <span><PlusOutlined /> زيارة إضافية (غير مجدولة)</span> },
          ]} />
        </Form.Item>
        {early && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`هذه الزيارة مجدولة في ${selected!.scheduledDate} — سيتم تسجيلها مبكراً`} />}
        <Space style={{ display: 'flex' }} align="start" wrap>
          <Form.Item name="visitDate" label="تاريخ الزيارة" rules={[{ required: true, message: 'اختر التاريخ' }]}>
            <DatePicker disabledDate={d => d.isAfter(today, 'day')} />
          </Form.Item>
          {visitId === EXTRA && (
            <Form.Item name="visitType" label="نوع الزيارة" style={{ minWidth: 180 }}>
              <Select options={[
                { value: 'corrective', label: 'تصحيحية' }, { value: 'emergency', label: 'طارئة' },
                { value: 'inspection', label: 'فحص' }, { value: 'preventive', label: 'وقائية' },
              ]} />
            </Form.Item>
          )}
          <Form.Item name="technicianEmployeeId" label="الموظف / الفني المنفذ" style={{ minWidth: 260 }}>
            <Select allowClear showSearch optionFilterProp="label" placeholder="اختر الموظف"
              options={employees.map(e => ({ value: e.id, label: employeeLabel(e) }))} />
          </Form.Item>
        </Space>

        {(
          <>
            <Divider titlePlacement="right" style={{ fontSize: 13, margin: '4px 0 8px' }}>
              قائمة الفحص {checklist.length > 0 && <Tag color={checklist.every(c => c.isDone) ? 'success' : 'default'} style={{ marginInlineStart: 6 }}>{checklist.filter(c => c.isDone).length}/{checklist.length}</Tag>}
            </Divider>
            {loadingList ? <Spin /> : checklist.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>لا توجد بنود — أضفها من الإعدادات ← قائمة الفحص</Text> : (
              <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 8 }}>
                {checklist.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed #f0f0f0' }}>
                    <Checkbox checked={c.isDone} onChange={e => setChecklist(l => l.map((x, j) => (j === i ? { ...x, isDone: e.target.checked } : x)))}>
                      <Text style={{ fontSize: 12 }}>{c.itemText}</Text>
                    </Checkbox>
                    <Input size="small" placeholder="ملاحظة" value={c.notes} style={{ maxWidth: 200, marginInlineStart: 'auto' }}
                      onChange={e => setChecklist(l => l.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} />
                  </div>
                ))}
                <Button type="link" size="small" onClick={() => setChecklist(l => l.map(x => ({ ...x, isDone: true })))}>تحديد الكل</Button>
              </div>
            )}
          </>
        )}

        <Form.Item name="reportSummary" label="ملخص التقرير">
          <Input.TextArea rows={3} placeholder="ما تم فحصه وإنجازه في الزيارة…" />
        </Form.Item>

        <Divider titlePlacement="right" style={{ fontSize: 13, margin: '4px 0 8px' }}>الملاحظات / الأعطال المكتشفة</Divider>
        <Form.List name="findings">
          {(fields, { add, remove }) => (
            <>
              {fields.map(f => (
                <div key={f.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                  <Space align="start" wrap style={{ display: 'flex' }}>
                    <Form.Item name={[f.name, 'severity']} initialValue="medium" style={{ marginBottom: 6, width: 120 }}>
                      <Select options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' }]} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'description']} rules={[{ required: true, message: 'اكتب الوصف' }]} style={{ marginBottom: 6, width: 300 }}>
                      <Input placeholder="وصف الملاحظة / العطل" />
                    </Form.Item>
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(f.name)} />
                  </Space>
                  <Form.Item name={[f.name, 'actionTaken']} style={{ marginBottom: 6 }}><Input placeholder="الإجراء المتخذ (اختياري)" /></Form.Item>
                  <Form.Item name={[f.name, 'createServiceRequest']} valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Checkbox><WarningOutlined style={{ color: '#fa8c16' }} /> فتح طلب خدمة لهذا العطل</Checkbox>
                  </Form.Item>
                </div>
              ))}
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ severity: 'medium' })}>إضافة ملاحظة</Button>
            </>
          )}
        </Form.List>

        <Form.Item name="notes" label="ملاحظات داخلية" style={{ marginTop: 12 }}><Input.TextArea rows={2} placeholder="ملاحظات الفريق (لا تظهر للعميل)" /></Form.Item>

        <Divider titlePlacement="right" style={{ fontSize: 13, margin: '4px 0 8px' }}>رأي العميل (اختياري)</Divider>
        <Row gutter={12}>
          <Col span={10}><Form.Item name="customerRating" label="التقييم"><Rate /></Form.Item></Col>
          <Col span={14}><Form.Item name="feedbackBy" label="اسم من أعطى الرأي / وقّع"><Input placeholder="مثال: مدير المبنى" /></Form.Item></Col>
          <Col span={24}><Form.Item name="customerFeedback" label="ملاحظات العميل"><Input.TextArea rows={2} maxLength={1000} /></Form.Item></Col>
        </Row>
        <Form.Item label="مرفقات (تقرير / صور) — اختياري" style={{ marginBottom: 0 }}>
          <Upload multiple accept={ACCEPT} fileList={files} beforeUpload={() => false} maxCount={10}
            onChange={({ fileList }) => setFiles(fileList)}>
            <Button icon={<UploadOutlined />}>اختر الملفات</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ═════════════════════════ upload a report to a visit ═════════════════════════
export function UploadReportModal({ open, contract, onClose, onDone }: Props) {
  const [form] = Form.useForm();
  const [visitId, setVisitId] = useState<number | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const visits: VisitRow[] = (contract?.visits ?? []).filter((v: VisitRow) => v.status !== 'cancelled')
    .sort((a: VisitRow, b: VisitRow) => (b.visitDate ?? b.scheduledDate).localeCompare(a.visitDate ?? a.scheduledDate));

  useEffect(() => {
    if (!open) return;
    const done = visits.find(v => v.status === 'completed') ?? visits[0];
    form.resetFields();
    form.setFieldsValue({ visitId: done?.id });
    setVisitId(done?.id ?? null);
    setFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !visitId) { setExisting([]); return; }
    setLoading(true);
    Promise.all([api<Attachment[]>(`/maintenance-visits/${visitId}/attachments`), api<any>(`/maintenance-visits/${visitId}`)])
      .then(([docs, v]) => { setExisting(docs); form.setFieldsValue({ reportSummary: v.visit?.reportSummary ?? '' }); })
      .catch(() => setExisting([]))
      .finally(() => setLoading(false));
  }, [open, visitId, form]);

  const submit = async () => {
    const v = await form.validateFields();
    if (!files.length && !v.reportSummary?.trim()) { message.warning('أضف نص التقرير أو ملفاً واحداً على الأقل'); return; }
    setSaving(true);
    try {
      await apiUpload(`/maintenance-visits/${v.visitId}/report`, toForm(files, v.reportSummary?.trim()));
      message.success('تم رفع التقرير');
      onDone();
      onClose();
    } catch (e) { message.error(errorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={`رفع تقرير زيارة — ${contract?.contractNo ?? ''}`} width={560} okText="رفع" cancelText="إلغاء"
      onOk={submit} confirmLoading={saving} onCancel={onClose} okButtonProps={{ disabled: visits.length === 0 }} destroyOnClose>
      {visits.length === 0 ? <Empty description="لا توجد زيارات لهذا العقد بعد" /> : (
        <Form form={form} layout="vertical">
          <Form.Item name="visitId" label="الزيارة" rules={[{ required: true }]}>
            <Select onChange={(id: number) => setVisitId(id)} options={visits.map(v => ({
              value: v.id,
              label: <span>{visitLabel(v)} <Tag color={STATUS_TAG[v.status]?.color} style={{ marginInlineStart: 6 }}>{STATUS_TAG[v.status]?.label ?? v.status}</Tag></span>,
            }))} />
          </Form.Item>
          <Form.Item name="reportSummary" label="نص التقرير"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item label="ملفات التقرير">
            <Upload multiple accept={ACCEPT} fileList={files} beforeUpload={() => false} maxCount={10} onChange={({ fileList }) => setFiles(fileList)}>
              <Button icon={<UploadOutlined />}>اختر الملفات</Button>
            </Upload>
          </Form.Item>
          <Divider titlePlacement="right" style={{ fontSize: 13, margin: '4px 0 8px' }}>الملفات المرفوعة سابقاً</Divider>
          {loading ? <Spin /> : existing.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>لا توجد ملفات</Text> : existing.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <PaperClipOutlined /><a onClick={() => openAttachment(a)}>{a.fileName}</a>
              <Text type="secondary" style={{ fontSize: 11 }}>{kb(a.sizeBytes)} · {a.createdAt ? dayjs(a.createdAt).format('YYYY-MM-DD') : ''}</Text>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            </div>
          ))}
        </Form>
      )}
    </Modal>
  );
}
