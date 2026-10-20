import { useCallback, useEffect, useState } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Table, Button, Space, Avatar, Typography, Spin, Empty, Row, Col, Popconfirm, message, DatePicker, Modal, Input } from 'antd';
import { EditOutlined, DollarOutlined, StopOutlined, PlayCircleOutlined, DeleteOutlined, PhoneOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { Kpi, money, d10, PRIMARY, PAY_STATUS, INV_STATUS, CONTRACT_STATUS } from './shared';
import { CustomerFormModal, RecordPaymentModal } from './CustomerModals';

const { Text } = Typography;

/** Customer profile: details, contracts, invoices, payments and account statement. */
export default function CustomerDrawer({ customerId, onClose, onChanged }: { customerId: number | null; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const canManage = can('tenants.manage');
  const [c, setC] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [statement, setStatement] = useState<any>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [key, setKey] = useState(0);

  const load = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      api<any>(`/tenants/${customerId}`),
      api<Paged<any>>('/invoices', { query: { tenantId: customerId, pageSize: 0 } }).then(r => r.items).catch(() => []),
      api<Paged<any>>('/payments', { query: { tenantId: customerId, pageSize: 0 } }).then(r => r.items).catch(() => []),
    ]).then(([t, inv, pay]) => { setC(t); setInvoices(inv); setPayments(pay); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [customerId]);
  useEffect(() => { setC(null); load(); }, [load, key]);
  useEffect(() => {
    if (!customerId) return;
    api<any>(`/tenants/${customerId}/statement`, { query: { from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') } })
      .then(setStatement).catch(() => setStatement(null));
  }, [customerId, range, key]);

  const changed = () => { setKey(k => k + 1); onChanged(); };
  const toggleActive = () => {
    let reason = '';
    Modal.confirm({
      title: c.isActive ? 'إيقاف العميل؟' : 'تفعيل العميل؟',
      content: c.isActive ? <div><Text type="secondary" style={{ fontSize: 12 }}>يبقى العميل وسجلاته محفوظة.</Text><Input style={{ marginTop: 8 }} placeholder="السبب (اختياري)" onChange={e => { reason = e.target.value; }} /></div> : undefined,
      okText: c.isActive ? 'إيقاف' : 'تفعيل', cancelText: 'إلغاء',
      onOk: async () => {
        try { await api(`/tenants/${c.id}/active`, { method: 'PATCH', body: { isActive: !c.isActive, reason: reason || null } }); message.success('تم'); changed(); }
        catch (e) { message.error(errorMessage(e), 6); }
      },
    });
  };
  const remove = async () => {
    try { await api(`/tenants/${c.id}`, { method: 'DELETE' }); message.success('تم حذف العميل'); onChanged(); onClose(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  useTrackView('Tenant', customerId, c?.nameAr ?? c?.name);
  return (
    <Drawer open={!!customerId} onClose={onClose} width={Math.min(window.innerWidth - 24, 900)} destroyOnClose
      title={c ? <Space><Avatar style={{ background: PRIMARY }}>{c.avatar}</Avatar><span>{c.nameAr ?? c.name}</span><Tag style={{ fontFamily: 'monospace' }}>{c.code}</Tag>
        {!c.isActive && <Tag>موقوف</Tag>}<Tag color={PAY_STATUS[c.paymentStatus]?.color}>{PAY_STATUS[c.paymentStatus]?.label}</Tag></Space> : 'العميل'}
      extra={c && (
        <Space wrap>
          <HistoryButton entityType="Tenant" id={customerId} title={c.nameAr ?? c.name} size="middle" />
          {can('payments.manage') && <Button type="primary" icon={<DollarOutlined />} onClick={() => setPayOpen(true)}>تسجيل دفعة</Button>}
          {canManage && <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>تعديل</Button>}
          {canManage && <Button icon={c.isActive ? <StopOutlined /> : <PlayCircleOutlined />} onClick={toggleActive}>{c.isActive ? 'إيقاف' : 'تفعيل'}</Button>}
          {canManage && <Popconfirm title="حذف العميل؟ (لا يُسمح مع عقد نشط أو رصيد)" okText="حذف" cancelText="إلغاء" onConfirm={remove}><Button danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      )}>
      {!c || loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <>
          <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
            <Col xs={12} md={6}><Kpi label="إجمالي المفوتر" value={money(c.invoiced)} color={PRIMARY} bg="#e8f5e9" /></Col>
            <Col xs={12} md={6}><Kpi label="المدفوع" value={money(c.paid)} color="#52c41a" bg="#f6ffed" /></Col>
            <Col xs={12} md={6}><Kpi label="الرصيد المستحق" value={money(c.balance)} color="#fa8c16" bg="#fff7e6" /></Col>
            <Col xs={12} md={6}><Kpi label="متأخر" value={money(c.overdue)} color="#ff4d4f" bg="#fff1f0" /></Col>
          </Row>
          <Tabs items={[
            { key: 'info', label: 'البيانات', children: (
              <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} labelStyle={{ width: 150, background: '#fafafa' }}>
                <Descriptions.Item label="الاسم">{c.nameAr ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="الاسم بالإنجليزية">{c.nameEn ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={<><PhoneOutlined /> الهاتف</>}><span dir="ltr">{c.phone ?? '—'}</span></Descriptions.Item>
                <Descriptions.Item label={<><MailOutlined /> البريد</>}><span dir="ltr">{c.email ?? '—'}</span></Descriptions.Item>
                <Descriptions.Item label={<><IdcardOutlined /> الهوية</>}><span dir="ltr" style={{ fontFamily: 'monospace' }}>{c.emiratesId ?? '—'}</span></Descriptions.Item>
                <Descriptions.Item label="الجنسية">{c.nationality ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="تاريخ الميلاد">{d10(c.dob)}</Descriptions.Item>
                <Descriptions.Item label="المدينة">{c.city ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="العنوان" span={2}>{c.address ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="المبنى / الوحدة">{c.building ? `${c.building} — وحدة ${c.unit}` : '—'}</Descriptions.Item>
                <Descriptions.Item label="العداد">{c.meterNo ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="رصيد الغاز غير المفوتر">{Number(c.gasBalance ?? 0).toLocaleString()} م³</Descriptions.Item>
                <Descriptions.Item label="آخر قراءة">{c.lastReading ? `${c.lastReading.readingValue} (${d10(c.lastReading.readingDate)})` : '—'}</Descriptions.Item>
                <Descriptions.Item label="رصيد دائن">{money(c.credit)}</Descriptions.Item>
                <Descriptions.Item label="عميل منذ">{d10(c.createdAt)}</Descriptions.Item>
              </Descriptions>
            ) },
            { key: 'contracts', label: `العقود (${c.contracts?.length ?? 0})`, children: (
              <Table size="small" rowKey="id" pagination={false} dataSource={c.contracts ?? []} locale={{ emptyText: <Empty description="لا توجد عقود" /> }}
                columns={[
                  { title: 'رقم العقد', dataIndex: 'contractNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
                  { title: 'المبنى / الوحدة', key: 'u', render: (_, r: any) => `${r.building ?? ''} — ${r.unitNo ?? ''}` },
                  { title: 'العداد', dataIndex: 'meterNo', render: v => v ?? '—' },
                  { title: 'الفترة', key: 'p', render: (_, r: any) => `${d10(r.startDate)} → ${d10(r.endDate)}` },
                  { title: 'الوديعة', key: 'dep', render: (_, r: any) => r.depositAmount ? <span>{money(r.depositAmount)} {r.depositPaid ? <Tag color="success">مسددة</Tag> : <Tag color="error">غير مسددة</Tag>}</span> : '—' },
                  { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={CONTRACT_STATUS[s]?.color}>{CONTRACT_STATUS[s]?.label ?? s}</Tag> },
                ]} />
            ) },
            { key: 'invoices', label: `الفواتير (${invoices.length})`, children: (
              <Table size="small" rowKey="id" dataSource={invoices} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 700 }}
                onRow={i => ({ style: i.status === 'overdue' ? { background: '#fff1f0' } : undefined })}
                columns={[
                  { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
                  { title: 'النوع', dataIndex: 'typeLabel' },
                  { title: 'التاريخ', dataIndex: 'date' },
                  { title: 'الاستحقاق', dataIndex: 'dueDate' },
                  { title: 'الإجمالي', dataIndex: 'amount', render: v => money(v) },
                  { title: 'الرصيد', dataIndex: 'balance', render: v => <Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#888' }}>{money(v)}</Text> },
                  { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={INV_STATUS[s]?.color}>{INV_STATUS[s]?.label ?? s}</Tag> },
                ]} />
            ) },
            { key: 'payments', label: `المدفوعات (${payments.length})`, children: (
              <Table size="small" rowKey="id" dataSource={payments} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 700 }}
                columns={[
                  { title: 'رقم السند', dataIndex: 'receiptNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
                  { title: 'التاريخ', dataIndex: 'date' },
                  { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong style={{ color: '#52c41a' }}>{money(v)}</Text> },
                  { title: 'الطريقة', dataIndex: 'methodLabel' },
                  { title: 'المرجع', dataIndex: 'reference', render: v => v ?? '—' },
                  { title: 'الفواتير', dataIndex: 'invoiceLabel', render: v => v || '—' },
                  { title: 'الحالة', dataIndex: 'statusLabel', render: (v, p: any) => <Tag color={p.status === 'completed' ? 'success' : 'default'}>{v}</Tag> },
                ]} />
            ) },
            { key: 'statement', label: 'كشف الحساب', children: (
              <div>
                <Space style={{ marginBottom: 10 }} wrap>
                  <DatePicker.RangePicker value={range as any} onChange={v => setRange(v as any)} allowClear />
                  {statement && <Text type="secondary" style={{ fontSize: 12 }}>رصيد افتتاحي {money(statement.opening)} · مدين {money(statement.totalDebit)} · دائن {money(statement.totalCredit)} · رصيد ختامي <Text strong>{money(statement.closing)}</Text></Text>}
                </Space>
                <Table size="small" rowKey={(r: any) => `${r.type}-${r.id}`} pagination={false} dataSource={statement?.lines ?? []} scroll={{ x: 650 }}
                  columns={[
                    { title: 'التاريخ', dataIndex: 'date' },
                    { title: 'المستند', key: 'ref', render: (_, r: any) => <span><Tag color={r.type === 'invoice' ? 'blue' : 'green'}>{r.type === 'invoice' ? 'فاتورة' : 'سند قبض'}</Tag><Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.reference}</Text></span> },
                    { title: 'البيان', dataIndex: 'description', render: v => v ?? '—' },
                    { title: 'مدين', dataIndex: 'debit', render: v => (Number(v) ? money(v) : '') },
                    { title: 'دائن', dataIndex: 'credit', render: v => (Number(v) ? money(v) : '') },
                    { title: 'الرصيد', dataIndex: 'balance', render: v => <Text strong>{money(v)}</Text> },
                  ]} />
              </div>
            ) },
          ]} />
        </>
      )}
      <CustomerFormModal open={editOpen} customer={c} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); changed(); }} />
      <RecordPaymentModal open={payOpen} tenantId={c?.id ?? null} tenantName={c?.nameAr ?? c?.name} onClose={() => setPayOpen(false)} onSaved={() => { setPayOpen(false); changed(); }} />
    </Drawer>
  );
}

