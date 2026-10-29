import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DatePicker, Empty, Form, Input, Modal, Radio, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, EyeOutlined, UserOutlined, CalendarOutlined, FileTextOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { VisitDrawer } from '../Maintenance/VisitDrawer';
import { useEmployeeOptions, employeeLabel } from '../Buildings/AmcVisitModals';

/**
 * «زيارات الصيانة» of a villa / restaurant (Restaurants & Villas module). Same visits as the building tab
 * (Buildings/BuildingOpsTabs → BuildingVisitsTab, unchanged) plus, for each visit:
 *  - «تمت» / «لم تتم» buttons → result form: employee who visited (required), date, every checklist step done / not done + remark,
 *    report (done) or reason (not done);
 *  - expandable details: the steps with their remarks, the employee, the outcome and who recorded it.
 * Done → existing POST /maintenance-visits/{id}/complete. Not done → POST /premises/{id}/visits/{visitId}/not-done.
 */

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const VISIT_TYPE: Record<string, string> = { preventive: 'وقائية', corrective: 'تصحيحية', emergency: 'طارئة', inspection: 'فحص' };

interface Outcome { id: number; outcome?: 'done' | 'not_done' | null; reason?: string | null; recordedAt?: string | null; recordedBy?: string | null }
interface Step { id?: number; lookupId?: number; itemText: string; isDone: boolean; notes: string }
const fmt = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—');

function outcomeTag(v: any, o?: Outcome) {
  if (o?.outcome === 'done') return <Tag color="success" icon={<CheckCircleOutlined />}>تمت</Tag>;
  if (o?.outcome === 'not_done') return <Tooltip title={o.reason}><Tag color="error" icon={<CloseCircleOutlined />}>لم تتم</Tag></Tooltip>;
  if (v.status === 'cancelled') return <Tag>ملغاة</Tag>;
  if (v.overdue) return <Tag color="error" icon={<ClockCircleOutlined />}>متأخرة</Tag>;
  return <Tag color={v.status === 'in_progress' ? 'processing' : 'blue'}>{v.status === 'in_progress' ? 'قيد التنفيذ' : 'مجدولة'}</Tag>;
}

/** Steps + employee + outcome of one visit (expanded row). */
function VisitDetails({ visitId, outcome }: { visitId: number; outcome?: Outcome }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api<any>(`/maintenance-visits/${visitId}`).then(setD).catch(() => setD({ checklist: [] })); }, [visitId]);
  if (!d) return <Spin size="small" />;
  const steps: any[] = d.checklist ?? [];
  return (
    <div style={{ padding: '4px 8px' }}>
      <Space wrap size={[16, 4]} style={{ fontSize: 12, marginBottom: 8 }}>
        <span><UserOutlined /> الموظف الذي زار الموقع: <b>{d.technician?.name ?? '—'}</b>{d.technician?.phone && <span dir="ltr"> · {d.technician.phone}</span>}</span>
        <span><CalendarOutlined /> تاريخ الزيارة: <b>{d.visit?.visitDate ?? '—'}</b></span>
        {outcome?.outcome && <span><EditOutlined /> سُجّلت النتيجة <b>{fmt(outcome.recordedAt)}</b> بواسطة <b>{outcome.recordedBy ?? '—'}</b></span>}
      </Space>
      {outcome?.outcome === 'not_done' && <Alert type="error" showIcon style={{ marginBottom: 8 }} message={`لم تتم الزيارة — السبب: ${outcome.reason ?? '—'}`} />}
      {d.visit?.reportSummary && <Alert type="success" showIcon icon={<FileTextOutlined />} style={{ marginBottom: 8 }} message={`التقرير: ${d.visit.reportSummary}`} />}
      <Table size="small" rowKey="id" pagination={false} dataSource={steps} locale={{ emptyText: 'لا توجد بنود فحص لهذه الزيارة' }}
        columns={[
          { title: '#', width: 40, render: (_, __, i) => i + 1 },
          { title: 'خطوة الفحص', dataIndex: 'itemText' },
          { title: 'النتيجة', dataIndex: 'isDone', width: 110, render: x => x ? <Tag color="success" icon={<CheckCircleOutlined />}>تم</Tag> : <Tag color="error" icon={<CloseCircleOutlined />}>لم يتم</Tag> },
          { title: 'الملاحظة', dataIndex: 'notes', render: x => x ?? '—' },
        ]} />
    </div>
  );
}

/** Result form: done / not done, employee, date, steps with remarks, report or reason. */
function VisitResultModal({ premisesId, visit, initial, onClose, onDone }: {
  premisesId: number; visit: any | null; initial: 'done' | 'not_done'; onClose: () => void; onDone: () => void;
}) {
  const open = !!visit;
  const employees = useEmployeeOptions(open);
  const [form] = Form.useForm();
  const [steps, setSteps] = useState<Step[]>([]);
  const [fromLookup, setFromLookup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const outcome: 'done' | 'not_done' = Form.useWatch('outcome', form) ?? initial;

  useEffect(() => {
    if (!visit) return;
    form.resetFields();
    form.setFieldsValue({ outcome: initial, visitDate: dayjs(), technicianEmployeeId: visit.technicianEmployeeId ?? undefined });
    setLoading(true);
    api<any>(`/maintenance-visits/${visit.id}`).then(async d => {
      const items: any[] = d.checklist ?? [];
      if (items.length) { setFromLookup(false); setSteps(items.map(i => ({ id: i.id, itemText: i.itemText, isDone: !!i.isDone, notes: i.notes ?? '' }))); }
      else {
        const lk = await api<{ id: number; label: string }[]>('/lookups/VISIT_CHECKLIST').catch(() => []);
        setFromLookup(true); setSteps(lk.map(i => ({ lookupId: i.id, itemText: i.label, isDone: false, notes: '' })));
      }
      if (d.visit?.technicianEmployeeId) form.setFieldsValue({ technicianEmployeeId: d.visit.technicianEmployeeId });
    }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [visit]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStep = (i: number, p: Partial<Step>) => setSteps(l => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = async () => {
    const v = await form.validateFields();
    const missing = steps.filter(s => !s.isDone && !s.notes.trim());
    if (missing.length) { message.warning(`اكتب ملاحظة لكل خطوة لم تتم (${missing.map(s => s.itemText).join('، ')})`, 6); return; }
    setSaving(true);
    try {
      const visitDate = v.visitDate.format('YYYY-MM-DD');
      if (v.outcome === 'done') {
        await api(`/maintenance-visits/${visit.id}/complete`, { method: 'POST', body: {
          visitDate, technicianEmployeeId: v.technicianEmployeeId, reportSummary: v.reportSummary || null, notes: v.notes || null,
          checklist: fromLookup ? undefined : steps.map(s => ({ id: s.id, isDone: s.isDone, notes: s.notes.trim() || null })),
          checklistItems: fromLookup ? steps.map(s => ({ lookupId: s.lookupId, isDone: s.isDone, notes: s.notes.trim() || null })) : undefined,
        } });
        message.success(`تم تسجيل الزيارة ${visit.visitNo} كمكتملة`);
      } else {
        await api(`/premises/${premisesId}/visits/${visit.id}/not-done`, { method: 'POST', body: {
          visitDate, technicianEmployeeId: v.technicianEmployeeId, reason: v.reason,
          checklist: fromLookup ? [] : steps.map(s => ({ id: s.id, isDone: s.isDone, notes: s.notes.trim() || null })),
          newItems: fromLookup ? steps.map(s => ({ itemText: s.itemText, isDone: s.isDone, notes: s.notes.trim() || null })) : [],
        } });
        message.success(`تم تسجيل الزيارة ${visit.visitNo} كـ «لم تتم»`);
      }
      onDone(); onClose();
    } catch (e) { message.error(errorMessage(e), 7); } finally { setSaving(false); }
  };

  const doneCount = steps.filter(s => s.isDone).length;
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} destroyOnHidden width={Math.min(window.innerWidth - 24, 760)}
      title={<Space><CalendarOutlined style={{ color: PRIMARY }} />نتيجة الزيارة {visit?.periodLabel ?? ''} <Text type="secondary" style={{ fontSize: 12 }}>{visit?.visitNo}</Text></Space>}
      okText="حفظ النتيجة" cancelText="إلغاء" okButtonProps={{ danger: outcome === 'not_done', style: outcome === 'done' ? { background: PRIMARY } : undefined }}>
      <Form form={form} layout="vertical">
        <Form.Item name="outcome" label="هل تمت الزيارة؟">
          <Radio.Group optionType="button" buttonStyle="solid" options={[
            { value: 'done', label: <span><CheckCircleOutlined /> تمت</span> },
            { value: 'not_done', label: <span><CloseCircleOutlined /> لم تتم</span> },
          ]} />
        </Form.Item>
        <Space wrap style={{ width: '100%' }} size={12}>
          <Form.Item name="technicianEmployeeId" label="الموظف الذي زار الموقع" rules={[{ required: true, message: 'اختر الموظف' }]} style={{ minWidth: 300 }}>
            <Select showSearch optionFilterProp="label" placeholder="اختر الموظف" options={employees.map(e => ({ value: e.id, label: employeeLabel(e) }))} />
          </Form.Item>
          <Form.Item name="visitDate" label="تاريخ الزيارة" rules={[{ required: true, message: 'اختر التاريخ' }]}>
            <DatePicker disabledDate={d => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
        </Space>

        <div style={{ fontWeight: 700, margin: '4px 0 8px' }}>
          خطوات الفحص <Tag color={steps.length && doneCount === steps.length ? 'success' : 'default'}>{doneCount}/{steps.length}</Tag>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}> — حدّد كل خطوة (تم / لم يتم) مع ملاحظة؛ الملاحظة مطلوبة للخطوة التي لم تتم</Text>
        </div>
        {loading ? <Spin /> : steps.length === 0 ? <Text type="secondary">لا توجد بنود فحص — أضفها من الإعدادات ← قائمة الفحص</Text> : (
          <div style={{ border: '1px solid #eef0ee', borderRadius: 8, marginBottom: 12 }}>
            {steps.map((s, i) => (
              <div key={s.id ?? s.lookupId ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: i ? '1px solid #f3f5f3' : undefined, flexWrap: 'wrap' }}>
                <span style={{ width: 22, color: '#999' }}>{i + 1}</span>
                <span style={{ flex: '1 1 200px' }}>{s.itemText}</span>
                <Radio.Group size="small" optionType="button" buttonStyle="solid" value={s.isDone ? 'y' : 'n'} onChange={e => setStep(i, { isDone: e.target.value === 'y' })}
                  options={[{ value: 'y', label: 'تم' }, { value: 'n', label: 'لم يتم' }]} />
                <Input size="small" placeholder={s.isDone ? 'ملاحظة (اختياري)' : 'ملاحظة (مطلوبة)'} value={s.notes} status={!s.isDone && !s.notes.trim() ? 'warning' : undefined}
                  style={{ flex: '1 1 200px' }} onChange={e => setStep(i, { notes: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {outcome === 'done' ? (
          <>
            <Form.Item name="reportSummary" label="ملخص التقرير"><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
          </>
        ) : (
          <Form.Item name="reason" label="سبب عدم إتمام الزيارة" rules={[{ required: true, whitespace: true, message: 'اذكر السبب' }]}>
            <Input.TextArea rows={2} placeholder="مثال: العميل غير موجود / تعذر الوصول إلى الخزان" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

export default function SiteVisitsTab({ premisesId, buildingId, reloadKey, kind = 'villa' }: {
  premisesId: number; buildingId: number; reloadKey?: number; kind?: 'villa' | 'restaurant';
}) {
  const { can } = useAuth();
  const canManage = can('maintenance.manage');
  const [rows, setRows] = useState<any[]>([]);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [loading, setLoading] = useState(false);
  const [k, setK] = useState(0);
  const [sel, setSel] = useState<any>(null);
  const [result, setResult] = useState<{ visit: any; initial: 'done' | 'not_done' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        api<Paged<any>>('/maintenance-visits', { query: { buildingId, pageSize: 0 } }),
        api<Outcome[]>(`/premises/${premisesId}/visits/outcomes`).catch(() => [] as Outcome[]),
      ]);
      setRows([...r.items].sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate))));
      setOutcomes(Object.fromEntries(o.map(x => [x.id, x])));
    } catch (e) { message.error(errorMessage(e)); } finally { setLoading(false); }
  }, [buildingId, premisesId]);
  useEffect(() => { load(); }, [load, reloadKey, k]);

  const isOpen = (v: any) => v.status === 'scheduled' || v.status === 'in_progress';
  const tiles = [
    { label: 'إجمالي الزيارات', value: rows.length, color: PRIMARY, bg: '#e8f5e9' },
    { label: 'تمت', value: rows.filter(v => outcomes[v.id]?.outcome === 'done').length, color: '#52c41a', bg: '#f6ffed' },
    { label: 'لم تتم', value: rows.filter(v => outcomes[v.id]?.outcome === 'not_done').length, color: '#cf1322', bg: '#fff1f0' },
    { label: 'مجدولة', value: rows.filter(v => isOpen(v) && !v.overdue).length, color: '#1677ff', bg: '#e6f4ff' },
    { label: 'متأخرة', value: rows.filter(v => v.overdue).length, color: '#fa541c', bg: '#fff2e8' },
  ];

  return (
    <div>
      {kind === 'restaurant' && <Alert type="info" showIcon style={{ marginBottom: 10 }} message="زيارات عقد صيانة المبنى الذي يقع فيه المطعم." />}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {tiles.map(s => (
          <Card key={s.label} size="small" variant="borderless" style={{ borderRadius: 10, background: s.bg, minWidth: 110, textAlign: 'center', flex: '1 1 100px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 1000 }}
        locale={{ emptyText: <Empty description="لا توجد زيارات صيانة — تُنشأ تلقائياً مع عقد الصيانة (AMC)" /> }}
        rowClassName={v => (v.overdue ? 'sv-overdue' : '')}
        expandable={{ expandedRowRender: v => <VisitDetails visitId={v.id} outcome={outcomes[v.id]} />, expandRowByClick: false }}
        columns={[
          { title: 'الزيارة', key: 'no', render: (_, v) => <div><Text strong style={{ fontSize: 12 }}>{v.periodLabel || v.visitNo}</Text><div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{v.visitNo}</div></div> },
          { title: 'العقد', dataIndex: 'contractNo', render: t => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</Text> },
          { title: 'النوع', dataIndex: 'visitType', render: t => VISIT_TYPE[t] ?? t ?? '—' },
          { title: 'الموعد', dataIndex: 'scheduledDate' },
          { title: 'تاريخ الزيارة', dataIndex: 'visitDate', render: t => t ?? '—' },
          { title: 'الموظف الذي زار', dataIndex: 'technician', render: t => t ?? <Text type="secondary" style={{ fontSize: 11 }}>—</Text> },
          { title: 'خطوات الفحص', key: 'chk', render: (_, v) => v.checklistTotal ? <Tag color={v.checklistDone === v.checklistTotal ? 'success' : 'default'}>{v.checklistDone}/{v.checklistTotal}</Tag> : '—' },
          { title: 'النتيجة', key: 'out', render: (_, v) => <div>{outcomeTag(v, outcomes[v.id])}
            {outcomes[v.id]?.recordedBy && <div style={{ fontSize: 10.5, color: '#888' }}>{outcomes[v.id].recordedBy} · {fmt(outcomes[v.id].recordedAt)}</div>}</div> },
          { title: '', key: 'act', width: 210, render: (_, v) => (
            <Space size={4}>
              {canManage && isOpen(v) && <>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setResult({ visit: v, initial: 'done' })}>تمت</Button>
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => setResult({ visit: v, initial: 'not_done' })}>لم تتم</Button>
              </>}
              <Tooltip title="كل التفاصيل (التقرير، المرفقات، رأي العميل)"><Button size="small" icon={<EyeOutlined />} onClick={() => setSel(v)} /></Tooltip>
            </Space>) },
        ]} />
      <style>{'.sv-overdue > td { background: #fff1f0 !important; }'}</style>
      <Text type="secondary" style={{ fontSize: 11 }}>«تمت» / «لم تتم» لتسجيل نتيجة الزيارة مع الموظف وكل خطوة فحص وملاحظتها؛ اضغط ➕ لعرض الخطوات، و👁 لكل التفاصيل.</Text>
      <VisitDrawer row={sel} onClose={() => setSel(null)} onChanged={() => setK(x => x + 1)} />
      <VisitResultModal premisesId={premisesId} visit={result?.visit ?? null} initial={result?.initial ?? 'done'} onClose={() => setResult(null)} onDone={() => setK(x => x + 1)} />
    </div>
  );
}

export type { Outcome };
