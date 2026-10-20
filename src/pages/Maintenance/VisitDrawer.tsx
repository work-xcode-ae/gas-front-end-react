import { useEffect, useState } from 'react';
import { Drawer, Descriptions, Card, Tag, Button, Space, Typography, Spin, Modal, Form, Select, Input, DatePicker, Rate, message } from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined, PaperClipOutlined,
  WarningOutlined, UserOutlined, LikeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE, api, errorMessage, authFetch } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { RecordVisitModal, UploadReportModal, useEmployeeOptions, employeeLabel } from '../Buildings/AmcVisitModals';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
export const VISIT_STATUS: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'مجدولة' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' },
  completed: { color: 'success', label: 'مكتملة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
export const VISIT_TYPE: Record<string, string> = { preventive: 'وقائية', corrective: 'تصحيحية', emergency: 'طارئة', inspection: 'فحص' };
const SEV: Record<string, string> = { info: 'default', low: 'green', medium: 'blue', high: 'orange', critical: 'red' };
const SEV_L: Record<string, string> = { info: 'معلومة', low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };

export const visitStatusTag = (v: any) => v?.overdue
  ? <Tag color="error" icon={<WarningOutlined />}>متأخرة</Tag>
  : <Tag color={VISIT_STATUS[v?.status]?.color}>{VISIT_STATUS[v?.status]?.label ?? v?.statusLabel ?? v?.status}</Tag>;

async function openFile(a: any) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/maintenance-visits/attachments/${a.id}`);
    if (!res.ok) throw new Error(`تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(a.mimeType ?? '')) w.location.href = url;
    else { w?.close(); const l = document.createElement('a'); l.href = url; l.download = a.fileName ?? 'file'; l.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

/**
 * One maintenance visit: details, checklist, findings, files, technician and customer feedback,
 * with the actions start / record completion / report / assign technician / customer feedback / cancel.
 * Used by the Maintenance page and the building profile «زيارات الصيانة» tab.
 */
export function VisitDrawer({ row, onClose, onChanged }: { row: any | null; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const canManage = can('maintenance.manage');
  const id: number | null = row?.id ?? null;
  const [detail, setDetail] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const [recordContract, setRecordContract] = useState<any>(null);
  const [reportContract, setReportContract] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignForm] = Form.useForm();
  const [feedbackForm] = Form.useForm();
  const employees = useEmployeeOptions(!!id);

  useEffect(() => {
    if (!id) { setDetail(null); setFiles([]); return; }
    setLoading(true);
    Promise.all([api<any>(`/maintenance-visits/${id}`), api<any[]>(`/maintenance-visits/${id}/attachments`).catch(() => [])])
      .then(([d, f]) => { setDetail(d); setFiles(f); }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [id, key]);

  const changed = () => { setKey(k => k + 1); onChanged(); };
  const status: string = detail?.status ?? row?.status;
  const v = detail?.visit;
  const open = status === 'scheduled' || status === 'in_progress';
  const contract = async () => api<any>(`/amc-contracts/${row.amcContractId ?? v?.amcContractId}`);

  const doStart = async () => { try { await api(`/maintenance-visits/${id}/start`, { method: 'POST' }); message.success('بدأت الزيارة'); changed(); } catch (e) { message.error(errorMessage(e), 6); } };
  const doCancel = () => Modal.confirm({
    title: `إلغاء الزيارة ${row?.visitNo ?? ''}؟`, okText: 'إلغاء الزيارة', okType: 'danger', cancelText: 'رجوع',
    onOk: async () => { try { await api(`/maintenance-visits/${id}/cancel`, { method: 'POST' }); message.success('تم إلغاء الزيارة'); changed(); } catch (e) { message.error(errorMessage(e), 6); } },
  });
  const doRecord = async () => { try { setRecordContract(await contract()); } catch (e) { message.error(errorMessage(e)); } };
  const doReport = async () => { try { setReportContract(await contract()); } catch (e) { message.error(errorMessage(e)); } };
  const openAssign = () => {
    assignForm.setFieldsValue({ technicianEmployeeId: v?.technicianEmployeeId ?? undefined, technicianPhone: v?.technicianPhone ?? undefined,
      scheduledDate: v?.scheduledDate ? dayjs(v.scheduledDate) : undefined, timeSlot: v?.timeSlot ?? undefined });
    setAssignOpen(true);
  };
  const openFeedback = () => {
    feedbackForm.setFieldsValue({ customerRating: v?.customerRating ?? 0, customerFeedback: v?.customerFeedback ?? '', feedbackBy: v?.feedbackBy ?? '' });
    setFeedbackOpen(true);
  };
  const saveAssign = async () => {
    const f = await assignForm.validateFields();
    setBusy(true);
    try {
      await api(`/maintenance-visits/${id}/assign`, { method: 'POST', body: { technicianEmployeeId: f.technicianEmployeeId ?? null, technicianPhone: f.technicianPhone || null,
        scheduledDate: f.scheduledDate ? f.scheduledDate.format('YYYY-MM-DD') : null, timeSlot: f.timeSlot || null } });
      message.success('تم إسناد الزيارة'); setAssignOpen(false); changed();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  const saveFeedback = async () => {
    const f = await feedbackForm.validateFields();
    setBusy(true);
    try {
      await api(`/maintenance-visits/${id}/feedback`, { method: 'POST', body: { customerRating: f.customerRating || null, customerFeedback: f.customerFeedback || null, feedbackBy: f.feedbackBy || null } });
      message.success('تم حفظ رأي العميل'); setFeedbackOpen(false); changed();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  const actions = !canManage || !row ? null : (
    <Space size={4} wrap>
      {status === 'scheduled' && <Button size="small" icon={<PlayCircleOutlined />} onClick={doStart}>بدء</Button>}
      {open && <Button size="small" icon={<UserOutlined />} onClick={openAssign}>إسناد لموظف</Button>}
      {open && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={doRecord}>تسجيل الإنجاز</Button>}
      {status === 'completed' && <Button size="small" type="primary" icon={<LikeOutlined />} onClick={openFeedback}>رأي العميل</Button>}
      {status !== 'cancelled' && <Button size="small" icon={<UploadOutlined />} onClick={doReport}>تقرير</Button>}
      {open && <Button size="small" danger icon={<StopOutlined />} onClick={doCancel}>إلغاء</Button>}
    </Space>
  );

  return (
    <>
      <Drawer open={!!id} onClose={onClose} width={Math.min(780, window.innerWidth - 40)} destroyOnClose
        title={row && <Space wrap><CalendarOutlined style={{ color: PRIMARY }} />{row.periodLabel || row.visitNo}<Text type="secondary" style={{ fontSize: 12 }}>{row.visitNo}</Text>{visitStatusTag({ ...row, status })}</Space>}
        extra={actions}>
        {loading || !detail ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} labelStyle={{ width: 130, background: '#fafafa' }}>
              {row?.building && <Descriptions.Item label="المبنى">{row.building} {row.buildingCode ? `(${row.buildingCode})` : ''}</Descriptions.Item>}
              <Descriptions.Item label="العقد">{row?.contractNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="النوع">{VISIT_TYPE[detail.visitType] ?? detail.visitType ?? '—'}</Descriptions.Item>
              {row?.vendor && <Descriptions.Item label="مقدم الخدمة">{row.vendor}</Descriptions.Item>}
              <Descriptions.Item label="الموعد">{v?.scheduledDate}{v?.timeSlot ? ` ${v.timeSlot}` : ''}</Descriptions.Item>
              <Descriptions.Item label="تاريخ التنفيذ">{v?.visitDate ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الموظف المنفذ">
                {detail.technician ? <span>{detail.technician.name}{detail.technician.employeeNo ? ` — ${detail.technician.employeeNo}` : ''}</span> : (row?.technician ?? <Text type="secondary">غير مسند</Text>)}
                {v?.technicianPhone ? <Text type="secondary"> · {v.technicianPhone}</Text> : null}
              </Descriptions.Item>
              <Descriptions.Item label="اكتملت في">{v?.completedAt ? dayjs(v.completedAt).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="ملخص التقرير" span={2}>{v?.reportSummary || '—'}</Descriptions.Item>
              <Descriptions.Item label="ملاحظات داخلية" span={2}>{v?.notes || '—'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" style={{ marginTop: 14, borderRadius: 10 }} title={<span><LikeOutlined /> رأي العميل</span>}
              extra={canManage && status === 'completed' && <Button size="small" onClick={openFeedback}>{v?.customerRating || v?.customerFeedback ? 'تعديل' : 'إضافة'}</Button>}>
              {!v?.customerRating && !v?.customerFeedback ? (
                <Text type="secondary">{status === 'completed' ? 'لم يُسجَّل رأي العميل بعد' : 'يُسجَّل بعد إنجاز الزيارة'}</Text>
              ) : (
                <div>
                  {v.customerRating ? <Rate disabled value={v.customerRating} style={{ fontSize: 16 }} /> : null}
                  {v.customerFeedback && <div style={{ marginTop: 6 }}>{v.customerFeedback}</div>}
                  {v.feedbackBy && <Text type="secondary" style={{ fontSize: 12 }}>— {v.feedbackBy}</Text>}
                </div>
              )}
            </Card>

            <Card size="small" style={{ marginTop: 14, borderRadius: 10 }}
              title={<span>قائمة الفحص {detail.checklist?.length ? <Tag>{detail.checklist.filter((c: any) => c.isDone).length}/{detail.checklist.length}</Tag> : null}</span>}>
              {(detail.checklist ?? []).length === 0 ? <Text type="secondary">لا توجد بنود</Text> : detail.checklist.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px dashed #f0f0f0', fontSize: 12 }}>
                  {c.isDone ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ClockCircleOutlined style={{ color: '#bbb' }} />}
                  <span style={{ flex: 1 }}>{c.itemText}</span>
                  {c.notes && <Text type="secondary" style={{ fontSize: 11 }}>{c.notes}</Text>}
                </div>
              ))}
            </Card>

            <Card size="small" style={{ marginTop: 14, borderRadius: 10 }} title={`الملاحظات / الأعطال (${(detail.findings ?? []).length})`}>
              {(detail.findings ?? []).length === 0 ? <Text type="secondary">لا توجد ملاحظات</Text> : detail.findings.map((f: any) => (
                <div key={f.id} style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0', fontSize: 12 }}>
                  <Tag color={SEV[f.severity]}>{SEV_L[f.severity] ?? f.severity}</Tag>{f.description}
                  {f.actionTaken && <div style={{ color: '#666', fontSize: 11 }}>الإجراء: {f.actionTaken}</div>}
                  {f.serviceRequestId && <div style={{ fontSize: 11 }}><Tag color="blue">طلب خدمة #{f.serviceRequestId}</Tag></div>}
                </div>
              ))}
            </Card>

            <Card size="small" style={{ marginTop: 14, borderRadius: 10 }} title={`ملفات التقرير (${files.length})`}
              extra={canManage && status !== 'cancelled' && <Button size="small" icon={<UploadOutlined />} onClick={doReport}>رفع</Button>}>
              {files.length === 0 ? <Text type="secondary">لا توجد ملفات</Text> : files.map(f => (
                <div key={f.id} style={{ fontSize: 12, padding: '3px 0' }}><PaperClipOutlined /> <a onClick={() => openFile(f)}>{f.fileName}</a>
                  <Text type="secondary" style={{ fontSize: 11 }}> · {f.createdAt ? dayjs(f.createdAt).format('YYYY-MM-DD') : ''}</Text></div>
              ))}
            </Card>
          </div>
        )}
      </Drawer>

      <RecordVisitModal open={!!recordContract} contract={recordContract} visitId={id} onClose={() => setRecordContract(null)} onDone={changed} />
      <UploadReportModal open={!!reportContract} contract={reportContract} onClose={() => setReportContract(null)} onDone={changed} />

      <Modal open={assignOpen} title={`إسناد الزيارة ${row?.visitNo ?? ''}`} okText="حفظ" cancelText="إلغاء" onOk={saveAssign} confirmLoading={busy} onCancel={() => setAssignOpen(false)} destroyOnClose>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="technicianEmployeeId" label="الموظف / الفني" rules={[{ required: true, message: 'اختر الموظف' }]}>
            <Select showSearch optionFilterProp="label" placeholder="اختر الموظف" notFoundContent="لا يوجد موظفون — أضفهم من شاشة الموظفين"
              options={employees.map(e => ({ value: e.id, label: employeeLabel(e) }))}
              onChange={(eid: number) => { const e = employees.find(x => x.id === eid); if (e?.phone && !assignForm.getFieldValue('technicianPhone')) assignForm.setFieldsValue({ technicianPhone: e.phone }); }} />
          </Form.Item>
          <Form.Item name="technicianPhone" label="هاتف الفني"><Input dir="ltr" /></Form.Item>
          <Space wrap>
            <Form.Item name="scheduledDate" label="الموعد"><DatePicker /></Form.Item>
            <Form.Item name="timeSlot" label="الوقت"><Input placeholder="مثال: 10:00 - 12:00" /></Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={feedbackOpen} title={`رأي العميل — ${row?.visitNo ?? ''}`} okText="حفظ" cancelText="إلغاء" onOk={saveFeedback} confirmLoading={busy} onCancel={() => setFeedbackOpen(false)} destroyOnClose>
        <Form form={feedbackForm} layout="vertical">
          <Form.Item name="customerRating" label="التقييم"><Rate /></Form.Item>
          <Form.Item name="feedbackBy" label="اسم من أعطى الرأي / وقّع"><Input placeholder="مثال: مدير المبنى" /></Form.Item>
          <Form.Item name="customerFeedback" label="ملاحظات العميل"><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
