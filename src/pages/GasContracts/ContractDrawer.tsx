import { useCallback, useEffect, useState } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Table, Button, Space, Typography, Spin, Empty, Row, Col, Modal, Form, InputNumber, DatePicker, Input, Checkbox, message, Alert, Select, Popconfirm } from 'antd';
import { SyncOutlined, StopOutlined, FileAddOutlined, PlayCircleOutlined, HomeOutlined, UserOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { Kpi, money, d10, PRIMARY, INV_STATUS, CONTRACT_STATUS, PAY_STATUS } from '../Customers/shared';

const { Text } = Typography;
type ActionKind = 'renew' | 'terminate' | 'invoice' | 'activate' | 'fee' | 'deposit';
const FEE_TYPES = [
  { value: 'gas_price', label: 'سعر الغاز (لكل م³)', cycle: 'per_m3' },
  { value: 'maintenance', label: 'رسوم صيانة', cycle: 'monthly' },
  { value: 'meter_rent', label: 'إيجار العداد', cycle: 'monthly' },
  { value: 'connection', label: 'رسوم التوصيل', cycle: 'one_time' },
  { value: 'disconnection', label: 'رسوم القطع', cycle: 'one_time' },
  { value: 'inspection', label: 'رسوم فحص', cycle: 'one_time' },
  { value: 'insurance', label: 'تأمين', cycle: 'yearly' },
  { value: 'other', label: 'أخرى', cycle: 'monthly' },
];
const FEE_CYCLES = [{ value: 'per_m3', label: 'لكل م³' }, { value: 'monthly', label: 'شهرية' }, { value: 'yearly', label: 'سنوية' }, { value: 'one_time', label: 'مرة واحدة' }];

/** Supply contract: fees, consumption per meter, invoices, terms + renew / terminate / bill / activate. */
export default function ContractDrawer({ contractId, onClose, onChanged, onOpenUnit, onOpenCustomer }: {
  contractId: number | null; onClose: () => void; onChanged: () => void; onOpenUnit: (unitId: number) => void; onOpenCustomer?: (tenantId: number) => void;
}) {
  const { can } = useAuth();
  const canManage = can('contracts.manage');
  const [d, setD] = useState<any>(null);
  const [cons, setCons] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [key, setKey] = useState(0);
  const [dep, setDep] = useState<any>(null);

  const load = useCallback(() => {
    if (!contractId) return;
    setLoading(true);
    Promise.all([api<any>(`/supply-contracts/${contractId}`), api<any>(`/supply-contracts/${contractId}/consumption`).catch(() => null)])
      .then(([x, y]) => { setD(x); setCons(y); }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
    api<any>(`/supply-contracts/${contractId}/deposit`).then(setDep).catch(() => setDep(null));
  }, [contractId]);
  useEffect(() => { setD(null); load(); }, [load, key]);

  const c = d?.contract;
  const openAction = (a: ActionKind) => {
    form.resetFields();
    if (a === 'renew') form.setFieldsValue({ months: c.renewalPeriod ?? 12 });
    if (a === 'terminate') form.setFieldsValue({ date: dayjs(), issueFinalInvoice: true });
    if (a === 'invoice') {
      // unbilled readings up to today; never before the contract start
      const from = dayjs().subtract(1, 'month').startOf('month');
      const start = c?.startDate ? dayjs(c.startDate) : null;
      form.setFieldsValue({ period: [start && start.isAfter(from) ? start : from, dayjs()], issue: true });
    }
    if (a === 'activate') form.setFieldsValue({ openingDate: dayjs() });
    if (a === 'deposit') form.setFieldsValue({ date: dayjs(), applyToInvoices: true, refund: true, refundMethod: 'cash' });
    if (a === 'fee') form.setFieldsValue({ type: d?.fees?.some((f: any) => f.type === 'gas_price' && f.isActive) ? 'maintenance' : 'gas_price', cycle: undefined, effectiveFrom: dayjs() });
    setAction(a);
  };
  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const base = `/supply-contracts/${c.id}`;
      if (action === 'renew') { await api(`${base}/renew`, { method: 'POST', body: { months: v.newEndDate ? null : v.months, newEndDate: v.newEndDate?.format('YYYY-MM-DD') ?? null } }); message.success('تم تجديد العقد'); }
      if (action === 'terminate') {
        const r = await api<any>(`${base}/terminate`, { method: 'POST', body: { date: v.date.format('YYYY-MM-DD'), reason: v.reason || null, closingReading: v.closingReading ?? null, issueFinalInvoice: !!v.issueFinalInvoice } });
        message.success(r?.invoiceId ? 'تم إنهاء العقد وإصدار الفاتورة الختامية' : 'تم إنهاء العقد');
      }
      if (action === 'invoice') {
        const r = await api<any>(`${base}/generate-invoice`, { method: 'POST', body: { periodStart: v.period[0].format('YYYY-MM-DD'), periodEnd: v.period[1].format('YYYY-MM-DD'), issue: !!v.issue } });
        if (r?.created) message.success(`تم إصدار الفاتورة ${r.invoiceNo} — ${money(r.totalAmount)}`); else message.info('لا يوجد ما يُفوتر لهذه الفترة');
      }
      if (action === 'activate') { await api(`${base}/activate`, { method: 'POST', body: { openingReading: v.openingReading ?? null, openingReadingDate: v.openingDate ? v.openingDate.toISOString() : null } }); message.success('تم تفعيل العقد'); }
      if (action === 'deposit') {
        const r = await api<any>(`${base}/settle-deposit`, { method: 'POST', body: { date: v.date?.format('YYYY-MM-DD') ?? null, applyToInvoices: !!v.applyToInvoices, refund: !!v.refund, refundMethod: v.refundMethod, reference: v.reference || null } });
        message.success(`تمت تسوية التأمين — خُصم من الفواتير ${money(r.applied)}${r.refunded ? ` وأُعيد للعميل ${money(r.refunded)}` : ''}`, 6);
      }
      if (action === 'fee') {
        const cycle = v.cycle ?? FEE_TYPES.find(t => t.value === v.type)?.cycle;
        await api(`${base}/fees`, { method: 'POST', body: [{ type: v.type, cycle, amount: v.amount, effectiveFrom: v.effectiveFrom?.format('YYYY-MM-DD') ?? null, notes: v.notes || null }] });
        message.success('تمت إضافة الرسم');
      }
      setAction(null);
      setKey(k => k + 1);
      onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  const removeFee = async (feeId: number) => {
    try { await api(`/supply-contracts/${c.id}/fees/${feeId}`, { method: 'DELETE' }); message.success('تم حذف الرسم'); setKey(k => k + 1); onChanged(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  const status = c?.status as string | undefined;
  const isLive = status === 'active' || c?.isActive;
  useTrackView('SupplyContract', contractId, c?.contractNo);
  return (
    <Drawer open={!!contractId} onClose={onClose} width={Math.min(window.innerWidth - 24, 920)} destroyOnClose
      title={c ? <Space wrap><span>عقد توريد</span><Tag style={{ fontFamily: 'monospace' }}>{c.contractNo}</Tag><Tag color={CONTRACT_STATUS[status ?? '']?.color}>{CONTRACT_STATUS[status ?? '']?.label ?? c.statusLabel}</Tag>
        <Tag color={PAY_STATUS[c.paymentStatus]?.color}>{PAY_STATUS[c.paymentStatus]?.label}</Tag></Space> : 'عقد توريد'}
      extra={c && (
        <Space wrap>
          <HistoryButton entityType="SupplyContract" id={contractId} title={`عقد ${c.contractNo}`} size="middle" />
          {canManage && <>
          {(status === 'draft' || status === 'pending') && <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => openAction('activate')}>تفعيل</Button>}
          {isLive && can('invoices.manage') && <Button icon={<FileAddOutlined />} onClick={() => openAction('invoice')}>إصدار فاتورة</Button>}
          {status !== 'terminated' && <Button icon={<SyncOutlined />} onClick={() => openAction('renew')}>تجديد</Button>}
          {isLive && <Button danger icon={<StopOutlined />} onClick={() => openAction('terminate')}>إنهاء</Button>}
          {!isLive && dep?.canSettle && can('invoices.manage') && <Button type="primary" onClick={() => openAction('deposit')}>تسوية التأمين ({money(dep.held)})</Button>}
          </>}
        </Space>
      )}>
      {!c || loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <>
          <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
            <Col xs={12} md={6}><Kpi label="المفوتر" value={money(c.invoiced)} color={PRIMARY} bg="#e8f5e9" /></Col>
            <Col xs={12} md={6}><Kpi label="المدفوع" value={money(c.paid)} color="#52c41a" bg="#f6ffed" /></Col>
            <Col xs={12} md={6}><Kpi label="الرصيد" value={money(c.balanceAmount)} color="#fa8c16" bg="#fff7e6" /></Col>
            <Col xs={12} md={6}><Kpi label="غاز غير مفوتر" value={`${Number(cons?.unbilled ?? c.balanceM3 ?? 0).toLocaleString()} م³`} color="#1677ff" bg="#e6f4ff" /></Col>
          </Row>
          {Number(c.overdueAmount) > 0 && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={`متأخرات بقيمة ${money(c.overdueAmount)}`} />}
          <Tabs items={[
            { key: 'info', label: 'البيانات', children: (
              <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} labelStyle={{ width: 150, background: '#fafafa' }}>
                <Descriptions.Item label="العميل"><Space>{c.tenant}{onOpenCustomer && <Button size="small" type="link" icon={<UserOutlined />} onClick={() => onOpenCustomer(c.tenantId)}>الملف</Button>}</Space></Descriptions.Item>
                <Descriptions.Item label="المبنى / الوحدة"><Space>{c.building} — {c.unit}<Button size="small" type="link" icon={<HomeOutlined />} onClick={() => onOpenUnit(c.unitId)}>ملف الوحدة</Button></Space></Descriptions.Item>
                <Descriptions.Item label="العداد">{c.meter ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="الفترة">{d10(c.startDate)} → {d10(c.endDate)}</Descriptions.Item>
                <Descriptions.Item label="تجديد تلقائي">{c.autoRenew ? `نعم — كل ${c.renewalPeriod ?? 12} شهر` : 'لا'}</Descriptions.Item>
                <Descriptions.Item label="الوديعة">{c.depositAmount ? <span>{money(c.depositAmount)} {c.depositPaid ? <Tag color="success">مسددة {d10(c.depositDate)}</Tag> : <Tag color="error">غير مسددة</Tag>}</span> : '—'}</Descriptions.Item>
                <Descriptions.Item label="سعر م³">{c.gasUnitPrice != null ? money(c.gasUnitPrice) : '—'}</Descriptions.Item>
                <Descriptions.Item label="الرسوم الشهرية">{money(c.monthlyFee)}</Descriptions.Item>
                <Descriptions.Item label="رسوم التوصيل">{c.connectionFee != null ? money(c.connectionFee) : '—'}</Descriptions.Item>
                <Descriptions.Item label="رسوم القطع">{c.disconnectionFee != null ? money(c.disconnectionFee) : '—'}</Descriptions.Item>
                <Descriptions.Item label="القراءة الافتتاحية">{c.openingReading != null ? `${c.openingReading} (${d10(c.openingReadDate)})` : '—'}</Descriptions.Item>
                <Descriptions.Item label="آخر قراءة">{c.lastReading != null ? `${c.lastReading} (${d10(c.lastReadDate)})` : '—'}</Descriptions.Item>
                {c.terminatedAt && <Descriptions.Item label="تاريخ الإنهاء">{d10(c.terminatedAt)}</Descriptions.Item>}
              </Descriptions>
            ) },
            { key: 'fees', label: `الرسوم (${d.fees?.length ?? 0})`, children: (
              <>
              {canManage && status !== 'terminated' && (
                <div style={{ marginBottom: 10 }}>
                  {!d.fees?.some((f: any) => f.type === 'gas_price' && f.isActive) && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="لا يوجد سعر غاز لهذا العقد — لن تُصدر فواتير الاستهلاك حتى تُضيفه." />}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => openAction('fee')}>إضافة رسم</Button>
                </div>
              )}
              <Table size="small" rowKey="id" pagination={false} dataSource={d.fees ?? []} locale={{ emptyText: <Empty description="لا توجد رسوم" /> }}
                columns={[
                  { title: 'البند', dataIndex: 'typeLabel' },
                  { title: 'الدورة', dataIndex: 'cycleLabel' },
                  { title: 'المبلغ', dataIndex: 'amount', render: v => money(v) },
                  { title: 'من', dataIndex: 'effectiveFrom', render: d10 },
                  { title: 'إلى', dataIndex: 'effectiveTo', render: v => (v ? d10(v) : '—') },
                  { title: 'الحالة', dataIndex: 'isActive', render: v => (v ? <Tag color="success">فعالة</Tag> : <Tag>موقوفة</Tag>) },
                  ...(canManage ? [{ title: '', key: 'x', width: 50, render: (_: any, f: any) => (
                    <Popconfirm title="حذف هذا الرسم؟" okText="حذف" cancelText="إلغاء" okButtonProps={{ danger: true }} onConfirm={() => removeFee(f.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>) }] : []),
                ]} />
              </>
            ) },
            { key: 'cons', label: 'الاستهلاك والقراءات', children: !cons ? <Empty /> : (
              <div>
                <Space wrap style={{ marginBottom: 10 }}>
                  <Tag color="blue">الإجمالي {Number(cons.total).toLocaleString()} م³</Tag>
                  <Tag color="green">مفوتر {Number(cons.billed).toLocaleString()} م³</Tag>
                  <Tag color="orange">غير مفوتر {Number(cons.unbilled).toLocaleString()} م³</Tag>
                </Space>
                <Table size="small" rowKey="meterId" pagination={false} dataSource={cons.meters ?? []} style={{ marginBottom: 12 }}
                  columns={[
                    { title: 'العداد', dataIndex: 'meterNo' },
                    { title: 'من', key: 'f', render: (_, m: any) => `${m.startReading} (${d10(m.from)})` },
                    { title: 'إلى', key: 't', render: (_, m: any) => `${m.endReading} (${d10(m.to)})` },
                    { title: 'الاستهلاك م³', dataIndex: 'consumption' },
                    { title: 'مفوتر', dataIndex: 'billed' },
                  ]} />
                <Table size="small" rowKey="id" dataSource={[...(cons.readings ?? [])].reverse()} pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  columns={[
                    { title: 'التاريخ', dataIndex: 'date', render: d10 },
                    { title: 'العداد', dataIndex: 'meterNo' },
                    { title: 'القراءة', dataIndex: 'value' },
                    { title: 'الاستهلاك', dataIndex: 'consumption', render: v => v ?? '—' },
                    { title: 'النوع', dataIndex: 'typeLabel', render: v => v ?? '—' },
                    { title: 'الفوترة', dataIndex: 'billed', render: v => (v ? <Tag color="success">مفوترة</Tag> : <Tag color="orange">غير مفوترة</Tag>) },
                  ]} />
              </div>
            ) },
            { key: 'inv', label: `الفواتير (${d.invoices?.length ?? 0})`, children: (
              <Table size="small" rowKey="id" pagination={false} dataSource={d.invoices ?? []} locale={{ emptyText: <Empty description="لا توجد فواتير" /> }}
                columns={[
                  { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
                  { title: 'الفترة', dataIndex: 'period', render: v => v ?? '—' },
                  { title: 'التاريخ', dataIndex: 'issueDate' },
                  { title: 'الاستحقاق', dataIndex: 'dueDate' },
                  { title: 'المبلغ', dataIndex: 'amount', render: v => money(v) },
                  { title: 'الحالة', dataIndex: 'status', render: (s, i: any) => {
                    const st = s !== 'paid' && s !== 'cancelled' && dayjs(i.dueDate).isBefore(dayjs(), 'day') ? 'overdue' : s;
                    return <Tag color={INV_STATUS[st]?.color}>{INV_STATUS[st]?.label ?? s}</Tag>;
                  } },
                ]} />
            ) },
            { key: 'terms', label: `الشروط (${d.terms?.length ?? 0})`, children: (d.terms ?? []).length === 0 ? <Empty description="لا توجد شروط" /> : (
              <ol style={{ paddingInlineStart: 20 }}>
                {d.terms.map((t: any) => <li key={t.id} style={{ marginBottom: 6 }}>{t.text} {t.isCustom && <Tag color="purple">مخصص</Tag>}{t.isModified && <Tag color="orange">معدل</Tag>}</li>)}
              </ol>
            ) },
          ]} />
        </>
      )}

      <Modal open={!!action} onCancel={() => setAction(null)} onOk={submit} confirmLoading={busy} cancelText="إلغاء" destroyOnClose
        okText={action === 'terminate' ? 'إنهاء العقد' : action === 'invoice' ? 'إصدار' : action === 'activate' ? 'تفعيل' : action === 'fee' ? 'إضافة' : action === 'deposit' ? 'تسوية' : 'تجديد'} okButtonProps={{ danger: action === 'terminate' }}
        title={action === 'renew' ? 'تجديد العقد' : action === 'terminate' ? 'إنهاء العقد' : action === 'invoice' ? 'إصدار فاتورة استهلاك' : action === 'fee' ? 'إضافة رسم للعقد' : action === 'deposit' ? 'تسوية تأمين العقد' : 'تفعيل العقد'}>
        <Form form={form} layout="vertical">
          {action === 'renew' && (<>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>ينتهي العقد في {d10(c?.endDate)} — يُمدد بنفس الرسوم والشروط.</Text>
            <Form.Item name="months" label="مدة التجديد (أشهر)" rules={[{ required: true }]}><InputNumber min={1} max={60} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="newEndDate" label="أو تاريخ انتهاء محدد"><DatePicker style={{ width: '100%' }} /></Form.Item>
          </>)}
          {action === 'terminate' && (<>
            <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="تُسجل القراءة الختامية ويُغلق العقد وتصبح الوحدة شاغرة." />
            <Form.Item name="date" label="تاريخ الإنهاء" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="closingReading" label={`القراءة الختامية للعداد${c?.lastReading != null ? ` (آخر قراءة ${c.lastReading})` : ''}`}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="reason" label="السبب"><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="issueFinalInvoice" valuePropName="checked"><Checkbox>إصدار الفاتورة الختامية (الاستهلاك غير المفوتر + رسوم القطع)</Checkbox></Form.Item>
          </>)}
          {action === 'deposit' && dep && (<>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }} labelStyle={{ width: 190 }}>
              <Descriptions.Item label="التأمين المحتجز">{money(dep.held)}</Descriptions.Item>
              <Descriptions.Item label="المستحق على العميل">{money(dep.owed)}</Descriptions.Item>
              <Descriptions.Item label="يُخصم من الفواتير">{money(dep.applicable)}</Descriptions.Item>
              <Descriptions.Item label="يُعاد للعميل">{money(dep.refundable)}</Descriptions.Item>
            </Descriptions>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>القيد: مدين تأمينات العملاء / دائن حساب العميل (الخصم) ودائن الصندوق أو البنك (الإعادة)</Text>
            <Form.Item name="date" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="applyToInvoices" valuePropName="checked"><Checkbox>خصم المستحق من التأمين</Checkbox></Form.Item>
            <Form.Item name="refund" valuePropName="checked"><Checkbox>إعادة الباقي للعميل</Checkbox></Form.Item>
            <Form.Item name="refundMethod" label="طريقة الإعادة"><Select options={[{ value: 'cash', label: 'نقداً' }, { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'cheque', label: 'شيك' }]} /></Form.Item>
            <Form.Item name="reference" label="المرجع"><Input /></Form.Item>
          </>)}
          {action === 'fee' && (<>
            <Form.Item name="type" label="البند" rules={[{ required: true }]}><Select options={FEE_TYPES.map(({ value, label }) => ({ value, label }))} onChange={() => form.setFieldsValue({ cycle: undefined })} /></Form.Item>
            <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>
              {({ getFieldValue }) => (
                <Form.Item name="cycle" label="الدورة" extra={`الافتراضي: ${FEE_CYCLES.find(x => x.value === FEE_TYPES.find(t => t.value === getFieldValue('type'))?.cycle)?.label ?? '—'}`}>
                  <Select allowClear placeholder="افتراضي" options={FEE_CYCLES} />
                </Form.Item>)}
            </Form.Item>
            <Form.Item name="amount" label="المبلغ (د.إ)" rules={[{ required: true, message: 'المبلغ مطلوب' }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="effectiveFrom" label="ساري من"><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="notes" label="ملاحظات"><Input /></Form.Item>
          </>)}
          {action === 'invoice' && (<>
            <Form.Item name="period" label="فترة الفوترة" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="issue" valuePropName="checked"><Checkbox>إصدار مباشر (وإلا تُحفظ كمسودة)</Checkbox></Form.Item>
          </>)}
          {action === 'activate' && (<>
            <Form.Item name="openingReading" label="القراءة الافتتاحية للعداد"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="openingDate" label="تاريخ القراءة"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          </>)}
        </Form>
      </Modal>
    </Drawer>
  );
}
