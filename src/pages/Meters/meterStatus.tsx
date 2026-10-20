import React, { useEffect, useState } from 'react';
import { Alert, DatePicker, Divider, Empty, Form, Input, Modal, Select, Tag, Timeline, Tooltip, Typography, message } from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, DisconnectOutlined, ExclamationCircleOutlined, InboxOutlined, QuestionCircleOutlined,
  StopOutlined, ToolOutlined, WarningOutlined, SafetyCertificateOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { HistoryButton } from '../../components/history/RecordHistory';

const { Text } = Typography;

/** Colours / icons per meter status code. Statuses added later in Settings (METER_STATUS lookup) fall back to grey. */
export const METER_STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  in_stock: { label: 'في المخزون', color: '#1565c0', bg: '#e3f2fd', icon: <InboxOutlined /> },
  active: { label: 'سليم / نشط', color: '#2e7d32', bg: '#e8f5e9', icon: <ApiOutlined /> },
  fault: { label: 'عطل', color: '#c62828', bg: '#ffebee', icon: <WarningOutlined /> },
  damaged: { label: 'تالف', color: '#a8071a', bg: '#fff1f0', icon: <CloseCircleOutlined /> },
  maintenance: { label: 'صيانة', color: '#d46b08', bg: '#fff7e6', icon: <ToolOutlined /> },
  disconnected: { label: 'مفصول', color: '#616161', bg: '#f5f5f5', icon: <DisconnectOutlined /> },
  retired: { label: 'مستبعد / خارج الخدمة', color: '#434343', bg: '#f0f0f0', icon: <StopOutlined /> },
  lost: { label: 'مفقود', color: '#531dab', bg: '#f9f0ff', icon: <ExclamationCircleOutlined /> },
};
export const meterStatusStyle = (s?: string | null) =>
  METER_STATUS_STYLE[s ?? ''] ?? { label: s ?? '—', color: '#595959', bg: '#fafafa', icon: <QuestionCircleOutlined /> };

export function MeterStatusTag({ status, label }: { status?: string | null; label?: string | null }) {
  const s = meterStatusStyle(status);
  return <Tag icon={s.icon} style={{ color: s.color, background: s.bg, borderColor: `${s.color}55`, margin: 0 }}>{label ?? s.label}</Tag>;
}

/** Calibration validity (computed by the API from the calibration date; default validity 12 months). */
export const CALIBRATION_STATE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  valid: { label: 'المعايرة سارية', color: 'success', icon: <SafetyCertificateOutlined /> },
  due_soon: { label: 'المعايرة تنتهي قريباً', color: 'warning', icon: <ClockCircleOutlined /> },
  expired: { label: 'المعايرة منتهية', color: 'error', icon: <CloseCircleOutlined /> },
  unknown: { label: 'بدون تاريخ معايرة', color: 'default', icon: <QuestionCircleOutlined /> },
};
export function CalibrationTag({ state, expiry, short }: { state?: string | null; expiry?: string | null; short?: boolean }) {
  const c = CALIBRATION_STATE[state ?? 'unknown'] ?? CALIBRATION_STATE.unknown;
  const tag = <Tag color={c.color} icon={c.icon} style={{ margin: 0 }}>{short ? (state === 'valid' ? 'سارية' : state === 'due_soon' ? 'قريباً' : state === 'expired' ? 'منتهية' : '—') : c.label}</Tag>;
  return expiry ? <Tooltip title={`صالحة حتى ${expiry}`}>{tag}</Tooltip> : tag;
}

export type MeterStatusOption = { id: number; code: string; label: string };
/** Active values of the METER_STATUS lookup (editable in Settings). */
export function useMeterStatuses() {
  const [list, setList] = useState<MeterStatusOption[]>([]);
  useEffect(() => {
    api<MeterStatusOption[]>('/lookups/METER_STATUS').then(setList)
      .catch(() => setList(Object.entries(METER_STATUS_STYLE).map(([code, s], i) => ({ id: -i - 1, code, label: s.label }))));
  }, []);
  return list;
}

const NEEDS_REASON = ['fault', 'damaged', 'retired', 'lost'];
const MUST_UNINSTALL = ['retired', 'lost', 'in_stock'];

/** Change a meter's status (with date, reason and optional new calibration date) and see its status history. */
export function MeterStatusModal({ meter, onClose, onSaved }: {
  meter: { id: number; meterNo: string; status?: string | null; statusLabel?: string | null; unitId?: number | null; unit?: string | null; calibrationDate?: string | null } | null;
  onClose: () => void; onSaved?: () => void;
}) {
  const statuses = useMeterStatuses();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const next = Form.useWatch('status', form) as string | undefined;

  useEffect(() => {
    if (!meter) return;
    form.resetFields();
    form.setFieldsValue({ date: dayjs() });
    setHistory(null);
    api<any[]>(`/meters/${meter.id}/status-history`).then(setHistory).catch(() => setHistory([]));
  }, [meter]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = !!meter?.unitId && !!next && MUST_UNINSTALL.includes(next);
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/meters/${meter!.id}/status`, { method: 'POST', body: {
        status: v.status, date: (v.date as Dayjs).format('YYYY-MM-DD'), reason: v.reason?.trim() || null,
        calibrationDate: v.calibrationDate ? (v.calibrationDate as Dayjs).format('YYYY-MM-DD') : null,
      } });
      message.success('تم تحديث حالة العداد');
      onSaved?.(); onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!meter} title={meter ? <span>تغيير حالة العداد <Text code>{meter.meterNo}</Text></span> : ''} onCancel={onClose} onOk={save}
      okText="حفظ الحالة" confirmLoading={saving} okButtonProps={{ disabled: blocked }} destroyOnHidden width={560}>
      {meter && (
        <>
          <div style={{ marginBottom: 12 }}>الحالة الحالية: <MeterStatusTag status={meter.status} label={meter.statusLabel} />
            {meter.unit && <Text type="secondary" style={{ marginInlineStart: 8 }}>مركّب في الوحدة {meter.unit}</Text>}</div>
          <Form form={form} layout="vertical">
            <Form.Item name="status" label="الحالة الجديدة" rules={[{ required: true, message: 'اختر الحالة' }]}>
              <Select placeholder="اختر الحالة" options={statuses.filter(s => s.code !== meter.status).map(s => ({
                value: s.code, label: <span style={{ color: meterStatusStyle(s.code).color }}>{meterStatusStyle(s.code).icon} {s.label}</span> }))} />
            </Form.Item>
            {blocked && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`العداد مركّب في الوحدة ${meter.unit}. افصله عن الوحدة (أو استبدله) أولاً قبل تحويله إلى هذه الحالة.`} />}
            <Form.Item name="date" label="تاريخ الحالة" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} />
            </Form.Item>
            <Form.Item name="reason" label="السبب / الملاحظات" rules={[{ required: !!next && NEEDS_REASON.includes(next), message: 'اكتب السبب' }]}>
              <Input.TextArea rows={2} placeholder={next === 'damaged' ? 'مثال: كسر في الشاشة، تسرب من الوصلة…' : ''} />
            </Form.Item>
            {(next === 'active' || next === 'in_stock' || next === 'maintenance') && (
              <Form.Item name="calibrationDate" label="تاريخ معايرة جديد (اختياري)" extra={meter.calibrationDate ? `المعايرة الحالية: ${meter.calibrationDate}` : 'لا يوجد تاريخ معايرة مسجل'}>
                <DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} />
              </Form.Item>
            )}
          </Form>
          <Divider titlePlacement="start" plain style={{ margin: '8px 0 12px' }}>سجل الحالات <HistoryButton entityType="Meter" id={meter.id} title={`عداد ${meter.meterNo}`} label="السجل الكامل" type="link" /></Divider>
          {history === null ? <Text type="secondary">…</Text> : history.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا يوجد تغيير حالة مسجل" /> : (
            <Timeline items={history.map(h => ({
              color: meterStatusStyle(h.to).color,
              children: <div style={{ fontSize: 12 }}>
                <div><MeterStatusTag status={h.to} label={METER_STATUS_STYLE[h.to]?.label ?? h.to} /> <Text type="secondary">من {METER_STATUS_STYLE[h.from]?.label ?? h.from ?? '—'}</Text></div>
                <div style={{ color: '#888' }}>{h.date ?? dayjs(h.occurredAt).format('YYYY-MM-DD')} · {h.user ?? '—'}</div>
                {h.reason && <div>{h.reason}</div>}
              </div>,
            }))} />
          )}
          <Text type="secondary" style={{ fontSize: 11 }}><CheckCircleOutlined /> يُسجَّل كل تغيير في سجل النشاط وسجل التدقيق.</Text>
        </>
      )}
    </Modal>
  );
}
