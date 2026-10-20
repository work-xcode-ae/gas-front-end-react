import React, { useState } from 'react';
import { Table, Tag, Button, Tooltip, Modal, Form, InputNumber, DatePicker, Select, Input, Typography, message, Space } from 'antd';
import { FileDoneOutlined, DollarOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';

const { Text } = Typography;

/** One instalment of an AMC contract with its client invoice (from GET /amc-contracts → paymentSchedule). */
export interface AmcInstalment {
  id: number; dueDate: string; amount: number; label?: string;
  invoiceId?: number | null; invoiceNo?: string | null; issueDate?: string | null; invoiceDueDate?: string | null;
  total?: number; paid?: number; balance?: number; customerId?: number | null;
  status: 'scheduled' | 'ready' | 'issued' | 'partial' | 'paid' | 'overdue'; daysLate?: number;
}

const STATUS: Record<string, { color: string; label: string; icon?: React.ReactNode }> = {
  scheduled: { color: 'default', label: 'مجدولة', icon: <ClockCircleOutlined /> },
  ready: { color: 'gold', label: 'جاهزة للإصدار', icon: <ThunderboltOutlined /> },
  issued: { color: 'blue', label: 'صادرة', icon: <FileDoneOutlined /> },
  partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة', icon: <CheckCircleOutlined /> },
  overdue: { color: 'error', label: 'متأخرة السداد', icon: <WarningOutlined /> },
};
const money = (n?: number) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} د.إ`;

interface Props { contractId: number | string; schedule: AmcInstalment[]; onChanged: () => void; }

export default function AmcInvoicesPanel({ contractId, schedule, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [issueLine, setIssueLine] = useState<AmcInstalment | null>(null);
  const [payLine, setPayLine] = useState<AmcInstalment | null>(null);
  const [issueForm] = Form.useForm();
  const [payForm] = Form.useForm();
  const today = dayjs().startOf('day');
  const lines = [...(schedule ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const readyCount = lines.filter(l => l.status === 'ready').length;
  const overdue = lines.filter(l => l.status === 'overdue');
  const totals = {
    invoiced: lines.filter(l => l.invoiceId).reduce((s, l) => s + Number(l.total ?? 0), 0),
    paid: lines.reduce((s, l) => s + Number(l.paid ?? 0), 0),
    overdue: overdue.reduce((s, l) => s + Number(l.balance ?? 0), 0),
    open: lines.filter(l => l.invoiceId).reduce((s, l) => s + Number(l.balance ?? 0), 0),
  };

  const issueDue = async () => {
    setBusy('due');
    try {
      const r = await api<any[]>(`/amc-contracts/${contractId}/invoice-due`, { method: 'POST' });
      message.success(`تم إصدار ${r.length} فاتورة`);
      onChanged();
    } catch (e) { message.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const submitIssue = async () => {
    if (!issueLine) return;
    const v = await issueForm.validateFields();
    setBusy(`i${issueLine.id}`);
    try {
      const r = await api<any>(`/amc-contracts/${contractId}/schedule/${issueLine.id}/invoice`, {
        method: 'POST', body: { issueDate: v.issueDate.format('YYYY-MM-DD') },
      });
      message.success(`تم إصدار الفاتورة ${r.invoiceNo}`);
      setIssueLine(null);
      onChanged();
    } catch (e) { message.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const submitPay = async () => {
    if (!payLine?.customerId) return;
    const v = await payForm.validateFields();
    setBusy(`p${payLine.id}`);
    try {
      await api('/payments', {
        method: 'POST', body: {
          tenantId: payLine.customerId, invoiceId: payLine.invoiceId, amount: v.amount, date: v.date.format('YYYY-MM-DD'),
          method: v.method, reference: v.reference || null, notes: v.notes || null,
        },
      });
      message.success('تم تسجيل الدفعة');
      setPayLine(null);
      onChanged();
    } catch (e) { message.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const columns = [
    {
      title: 'القسط', key: 'label', render: (_: any, l: AmcInstalment) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{l.label || '—'}</Text>
          <div style={{ fontSize: 11, color: '#888' }}>تاريخ الفاتورة: {l.dueDate}</div>
        </div>
      ),
    },
    {
      title: 'رقم الفاتورة', key: 'inv', render: (_: any, l: AmcInstalment) => l.invoiceNo
        ? <div><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.invoiceNo}</Text><div style={{ fontSize: 11, color: '#888' }}>صدرت {l.issueDate}</div></div>
        : <Text type="secondary" style={{ fontSize: 11 }}>لم تصدر</Text>,
    },
    {
      title: 'تاريخ الاستحقاق', key: 'due', render: (_: any, l: AmcInstalment) => (
        <Text style={{ fontSize: 12, color: l.status === 'overdue' ? '#ff4d4f' : undefined }}>{l.invoiceDueDate ?? '—'}</Text>
      ),
    },
    { title: 'الإجمالي', key: 'total', render: (_: any, l: AmcInstalment) => <Text style={{ fontSize: 12 }}>{money(l.total ?? l.amount)}</Text> },
    { title: 'المدفوع', key: 'paid', render: (_: any, l: AmcInstalment) => <Text style={{ fontSize: 12, color: '#52c41a' }}>{money(l.paid)}</Text> },
    {
      title: 'الرصيد', key: 'bal', render: (_: any, l: AmcInstalment) =>
        <Text strong style={{ fontSize: 12, color: Number(l.balance) > 0 && l.invoiceId ? '#d4380d' : '#888' }}>{l.invoiceId ? money(l.balance) : '—'}</Text>,
    },
    {
      title: 'الحالة', key: 'status', render: (_: any, l: AmcInstalment) => {
        const s = STATUS[l.status] ?? { color: 'default', label: l.status };
        return (
          <div>
            <Tag color={s.color} icon={s.icon} style={{ marginInlineEnd: 0 }}>{s.label}</Tag>
            {l.status === 'overdue' && <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 2 }}>متأخرة {l.daysLate} يوم</div>}
            {l.status === 'ready' && (l.daysLate ?? 0) > 0 && <div style={{ fontSize: 11, color: '#d48806', marginTop: 2 }}>تأخر الإصدار {l.daysLate} يوم</div>}
            {l.status === 'scheduled' && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>بعد {dayjs(l.dueDate).diff(today, 'day')} يوم</div>}
          </div>
        );
      },
    },
    {
      title: '', key: 'act', render: (_: any, l: AmcInstalment) => {
        if (!l.invoiceId) {
          const notYet = dayjs(l.dueDate).isAfter(today);
          return (
            <Tooltip title={notYet ? `لا يمكن إصدار الفاتورة قبل ${l.dueDate}` : undefined}>
              <Button size="small" type="primary" icon={<FileDoneOutlined />} disabled={notYet || l.status !== 'ready'}
                loading={busy === `i${l.id}`}
                onClick={() => { issueForm.setFieldsValue({ issueDate: today }); setIssueLine(l); }}>
                إصدار الفاتورة
              </Button>
            </Tooltip>
          );
        }
        if (Number(l.balance) > 0 && l.customerId)
          return (
            <Button size="small" icon={<DollarOutlined />} loading={busy === `p${l.id}`}
              onClick={() => { payForm.setFieldsValue({ amount: Number(l.balance), date: today, method: 'bank_transfer' }); setPayLine(l); }}>
              تسجيل دفعة
            </Button>
          );
        return null;
      },
    },
  ];

  return (
    <div>
      <div style={{ fontSize: 11.5, color: '#888', marginBottom: 6 }}>تصدر فاتورة كل دفعة للمالك وتُرحّل تلقائياً في تاريخ استحقاقها (والدفعات المستحقة عند إنشاء العقد فوراً).</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <Space size={6} wrap>
          <Tag color="blue">مُفوتر: {money(totals.invoiced)}</Tag>
          <Tag color="success">مدفوع: {money(totals.paid)}</Tag>
          <Tag color="orange">مستحق: {money(totals.open)}</Tag>
          {overdue.length > 0 && <Tag color="error" icon={<WarningOutlined />}>متأخر: {money(totals.overdue)} ({overdue.length} فاتورة)</Tag>}
        </Space>
        <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} disabled={readyCount === 0} loading={busy === 'due'} onClick={issueDue}>
          إصدار الفواتير المستحقة {readyCount > 0 ? `(${readyCount})` : ''}
        </Button>
      </div>
      <Table<AmcInstalment> size="small" rowKey="id" pagination={false} dataSource={lines} columns={columns as any}
        scroll={{ x: 760 }} locale={{ emptyText: 'لا توجد أقساط لهذا العقد' }}
        rowClassName={(l) => (l.status === 'overdue' ? 'amc-row-overdue' : '')}
        onRow={(l) => ({ style: l.status === 'overdue' ? { background: '#fff1f0' } : undefined })} />

      <Modal open={!!issueLine} title={`إصدار فاتورة — ${issueLine?.label ?? ''}`} okText="إصدار" cancelText="إلغاء"
        onOk={submitIssue} confirmLoading={!!busy} onCancel={() => setIssueLine(null)} destroyOnClose>
        <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
          المبلغ قبل الضريبة: <Text strong>{money(issueLine?.amount)}</Text> — الإجمالي المتوقع مع الضريبة: <Text strong>{money(issueLine?.total)}</Text>
        </div>
        <Form form={issueForm} layout="vertical">
          <Form.Item name="issueDate" label="تاريخ الفاتورة" rules={[{ required: true, message: 'اختر التاريخ' }]}
            extra={`لا يسبق تاريخ القسط (${issueLine?.dueDate}) ولا يتجاوز اليوم`}>
            <DatePicker style={{ width: '100%' }}
              disabledDate={d => !!issueLine && (d.isBefore(dayjs(issueLine.dueDate), 'day') || d.isAfter(today, 'day'))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={!!payLine} title={`تسجيل دفعة — ${payLine?.invoiceNo ?? ''}`} okText="حفظ" cancelText="إلغاء"
        onOk={submitPay} confirmLoading={!!busy} onCancel={() => setPayLine(null)} destroyOnClose>
        <Form form={payForm} layout="vertical">
          <Form.Item name="amount" label={`المبلغ (الرصيد ${money(payLine?.balance)})`} rules={[{ required: true }]}>
            <InputNumber min={0.01} max={Number(payLine?.balance ?? 0)} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(today, 'day')} />
          </Form.Item>
          <Form.Item name="method" label="طريقة الدفع" rules={[{ required: true }]}>
            <Select options={[
              { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'cheque', label: 'شيك' }, { value: 'cash', label: 'نقداً' },
              { value: 'card', label: 'بطاقة' }, { value: 'online', label: 'إلكتروني' },
            ]} />
          </Form.Item>
          <Form.Item name="reference" label="المرجع"><Input /></Form.Item>
          <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
