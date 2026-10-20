import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Drawer, Empty, Input, Modal, Row, Select, Space, Spin, Table, Tag, Typography, message, Alert, Segmented, Divider } from 'antd';
import {
  DollarOutlined, PlusOutlined, ReloadOutlined, PrinterOutlined, StopOutlined, RollbackOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, SearchOutlined, BranchesOutlined, WalletOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import {
  PRIMARY, DARK, GOLD, money, PAYMENT_METHODS, PAYMENT_STATUS, PRINT_CSS, CustomerSelect, RecordPaymentModal, methodLabel,
} from '../Invoices/shared';
import { InvoiceDrawer } from '../Invoices';

const { Text, Title } = Typography;

interface PaymentRow {
  id: number; receiptNo: string; date: string; amount: number; method?: string; methodLabel?: string; invoiceLabel?: string;
  invoices: { invoiceId: number; invoiceNo: string; amount: number }[]; reference?: string; receivedBy?: string; notes?: string;
  tenantId: number; tenant?: string; status?: string; statusLabel?: string; allocated: number; unallocated: number; journalEntryId?: number;
}

/** amount in Arabic words is overkill — show the figure clearly instead */
function ReceiptDrawer({ id, onClose, onChanged, onOpenInvoice }: { id: number | null; onClose: () => void; onChanged: () => void; onOpenInvoice: (id: number) => void }) {
  const { can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cancelMode, setCancelMode] = useState<'cancel' | 'bounce' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api<any>(`/payments/${id}`).then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);
  const p: PaymentRow | undefined = data?.payment;
  const dead = p?.status === 'cancelled' || p?.status === 'bounced';

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); message.success(ok); load(); onChanged(); } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };

  return (
    <Drawer open={!!id} onClose={onClose} width={Math.min(window.innerWidth - 40, 760)} destroyOnClose
      title={<Space><WalletOutlined style={{ color: PRIMARY }} /><span>سند قبض {p?.receiptNo ?? ''}</span>{p && <Tag color={PAYMENT_STATUS[p.status ?? '']?.color}>{PAYMENT_STATUS[p.status ?? '']?.label ?? p.statusLabel}</Tag>}</Space>}
      extra={p && (
        <Space wrap className="no-print">
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة / PDF</Button>
          {!dead && p.unallocated > 0 && can('payments.manage') && (
            <Button icon={<BranchesOutlined />} loading={busy} onClick={() => act(() => api(`/payments/${p.id}/allocate`, { method: 'POST', body: [] }), 'تم تخصيص الرصيد على الفواتير المفتوحة')}>
              تخصيص الرصيد ({money(p.unallocated)})
            </Button>)}
          {!dead && can('payments.cancel') && <>
            {p.method === 'cheque' && <Button danger icon={<RollbackOutlined />} onClick={() => { setReason(''); setCancelMode('bounce'); }}>شيك مرتجع</Button>}
            <Button danger icon={<StopOutlined />} onClick={() => { setReason(''); setCancelMode('cancel'); }}>إلغاء السند</Button>
          </>}
        </Space>
      )}>
      <style>{PRINT_CSS}</style>
      {loading || !p ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <div className="print-sheet" style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `3px solid ${GOLD}`, paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <Title level={4} style={{ margin: 0, color: PRIMARY }}>سند قبض</Title>
              <div style={{ fontSize: 12, color: '#888' }}>RECEIPT VOUCHER</div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 15 }}>{p.receiptNo}</div>
              <div style={{ fontSize: 12 }}>التاريخ: <b>{p.date}</b></div>
            </div>
          </div>
          {dead && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={p.status === 'bounced' ? 'شيك مرتجع — تم عكس القيد وإعادة فتح الفواتير' : 'سند ملغى — تم عكس القيد وإعادة فتح الفواتير'} />}
          <Row gutter={16} style={{ fontSize: 13, marginBottom: 12 }}>
            <Col span={12}>استلمنا من: <b>{p.tenant}</b></Col>
            <Col span={12}>المبلغ: <b style={{ fontSize: 18, color: PRIMARY }}>{money(p.amount)}</b></Col>
            <Col span={12} style={{ marginTop: 8 }}>طريقة الدفع: <b>{methodLabel(p.method)}</b></Col>
            <Col span={12} style={{ marginTop: 8 }}>المرجع: <b>{p.reference ?? '—'}</b></Col>
            <Col span={12} style={{ marginTop: 8 }}>استلمها: <b>{p.receivedBy ?? '—'}</b></Col>
            <Col span={12} style={{ marginTop: 8 }}>غير مخصص (رصيد دائن): <b style={{ color: '#1677ff' }}>{money(p.unallocated)}</b></Col>
          </Row>
          <Divider titlePlacement="right" style={{ fontSize: 13 }}>الفواتير المسددة بهذا السند</Divider>
          <Table size="small" rowKey="id" pagination={false} dataSource={data.allocations ?? []} locale={{ emptyText: 'غير مخصص لأي فاتورة' }}
            columns={[
              { title: 'الفاتورة', dataIndex: 'invoiceNo', render: (v, a: any) => <a className="no-print-link" onClick={() => onOpenInvoice(a.invoiceId)}>{v}</a> },
              { title: 'تاريخ الفاتورة', dataIndex: 'issueDate' },
              { title: 'إجمالي الفاتورة', dataIndex: 'totalAmount', render: money },
              { title: 'المبلغ المخصص', dataIndex: 'amount', render: v => <Text strong>{money(v)}</Text> },
            ]} />
          {p.notes && <div style={{ marginTop: 12, fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>ملاحظات: {p.notes}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, fontSize: 12, color: '#888' }}>
            <span>توقيع المستلم: ____________</span><span>الختم: ____________</span>
          </div>
        </div>
      )}
      <Modal open={!!cancelMode} title={cancelMode === 'bounce' ? 'تسجيل شيك مرتجع' : 'إلغاء سند القبض'} okText="تأكيد" cancelText="رجوع"
        okButtonProps={{ danger: true, disabled: !reason.trim() }} confirmLoading={busy} onCancel={() => setCancelMode(null)}
        onOk={() => act(async () => { await api(`/payments/${p!.id}/cancel`, { method: 'POST', body: { reason, bounced: cancelMode === 'bounce' } }); setCancelMode(null); },
          cancelMode === 'bounce' ? 'تم تسجيل الشيك كمرتجع' : 'تم إلغاء السند')}>
        <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="يُعكس القيد المحاسبي وتُعاد الفواتير المسددة بهذا السند إلى حالة غير مسددة." />
        <Input.TextArea rows={3} placeholder="السبب (إلزامي)" value={reason} onChange={e => setReason(e.target.value)} />
      </Modal>
    </Drawer>
  );
}

const PaymentsPage: React.FC = () => {
  const { can } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month'), dayjs()]);
  const [method, setMethod] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [tenantId, setTenantId] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'unallocated'>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<PaymentRow>>('/payments', {
      query: { pageSize: 0, method, status, tenantId, search: search || undefined, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') },
    }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [method, status, tenantId, search, range]);
  useEffect(() => { load(); }, [load]);

  const kpi = useMemo(() => {
    const ok = rows.filter(r => r.status === 'completed');
    const pend = rows.filter(r => r.status === 'pending');
    const bad = rows.filter(r => r.status === 'bounced' || r.status === 'cancelled');
    const sum = (l: PaymentRow[], f: keyof PaymentRow = 'amount') => l.reduce((s, r) => s + Number(r[f] ?? 0), 0);
    const byMethod = PAYMENT_METHODS.map(m => ({ ...m, total: sum(ok.filter(r => r.method === m.value)) })).filter(m => m.total > 0);
    return { total: sum(ok), count: ok.length, pending: sum(pend), pendingCount: pend.length, bad: sum(bad), badCount: bad.length,
      unallocated: sum(rows.filter(r => r.status === 'completed' || r.status === 'pending'), 'unallocated'), byMethod };
  }, [rows]);

  const shown = view === 'unallocated' ? rows.filter(r => r.unallocated > 0 && r.status !== 'cancelled' && r.status !== 'bounced') : rows;
  const tiles = [
    { label: `المحصّل (${kpi.count} سند)`, value: money(kpi.total), color: PRIMARY, bg: '#e8f5e9', icon: <CheckCircleOutlined /> },
    { label: `قيد التحصيل / شيكات (${kpi.pendingCount})`, value: money(kpi.pending), color: '#d48806', bg: '#fffbe6', icon: <ClockCircleOutlined />, onClick: () => setStatus('pending') },
    { label: 'أرصدة دائنة غير مخصصة', value: money(kpi.unallocated), color: '#1677ff', bg: '#e6f4ff', icon: <BranchesOutlined />, onClick: () => setView('unallocated') },
    { label: `ملغاة / مرتجعة (${kpi.badCount})`, value: money(kpi.bad), color: '#cf1322', bg: '#fff1f0', icon: <WarningOutlined /> },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>المدفوعات وسندات القبض</div>
          <div style={{ color: 'rgba(255,255,255,.72)', fontSize: 12.5 }}>تحصيل المستأجرين والعملاء، تخصيصها على الفواتير، والشيكات المرتجعة</div>
        </div>
        {can('payments.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}
          style={{ marginInlineStart: 'auto', background: GOLD, borderColor: GOLD, color: DARK, fontWeight: 700 }}>تسجيل دفعة</Button>}
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {tiles.map(t => (
          <Col key={t.label} xs={12} md={6}>
            <Card size="small" hoverable={!!t.onClick} onClick={t.onClick} style={{ borderRadius: 12, background: t.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><div style={{ fontSize: 18, fontWeight: 800, color: t.color }}>{t.value}</div><div style={{ fontSize: 11.5, color: t.color }}>{t.label}</div></div>
                <span style={{ fontSize: 22, color: t.color, opacity: .7 }}>{t.icon}</span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      {kpi.byMethod.length > 0 && (
        <Space wrap style={{ marginBottom: 12 }}>
          {kpi.byMethod.map(m => <Tag key={m.value} color="green" style={{ cursor: 'pointer' }} onClick={() => setMethod(m.value)}>{m.label}: {money(m.total)}</Tag>)}
        </Space>
      )}

      <Card styles={{ body: { padding: 14 } }} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Segmented value={view} onChange={v => setView(v as any)} options={[{ value: 'all', label: 'الكل' }, { value: 'unallocated', label: 'غير مخصصة' }]} />
          <DatePicker.RangePicker value={range as any} onChange={v => setRange(v as any)} />
          <CustomerSelect allowClear value={tenantId} onChange={v => setTenantId(v)} style={{ width: 200 }} />
          <Select allowClear placeholder="طريقة الدفع" style={{ width: 140 }} value={method} onChange={setMethod} options={PAYMENT_METHODS} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus}
            options={Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Input.Search allowClear placeholder="رقم السند / المرجع / العميل" prefix={<SearchOutlined />} style={{ width: 230 }} onSearch={setSearch} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        <Table<PaymentRow> size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showTotal: t => `${t} سند`, showSizeChanger: false }} locale={{ emptyText: <Empty description="لا توجد مدفوعات" /> }}
          onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer', opacity: r.status === 'cancelled' || r.status === 'bounced' ? 0.6 : 1 } })}
          columns={[
            { title: 'سند القبض', dataIndex: 'receiptNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text> },
            { title: 'التاريخ', dataIndex: 'date', width: 100 },
            { title: 'العميل', dataIndex: 'tenant' },
            { title: 'الطريقة', dataIndex: 'method', render: (v, r) => <div>{methodLabel(v)}{r.reference && <div style={{ fontSize: 11, color: '#888' }}>{r.reference}</div>}</div> },
            { title: 'الفواتير', dataIndex: 'invoiceLabel', render: v => v ? <Text style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text> },
            { title: 'المبلغ', dataIndex: 'amount', align: 'end' as const, render: v => <Text strong>{money(v)}</Text> },
            { title: 'غير مخصص', dataIndex: 'unallocated', align: 'end' as const, render: v => Number(v) > 0 ? <Text style={{ color: '#1677ff' }}>{money(v)}</Text> : '—' },
            { title: 'الحالة', dataIndex: 'status', render: (s, r) => <Tag color={PAYMENT_STATUS[s ?? '']?.color}>{PAYMENT_STATUS[s ?? '']?.label ?? r.statusLabel}</Tag> },
            { title: 'المستلم', dataIndex: 'receivedBy', render: v => v ?? '—' },
          ]} />
      </Card>

      <ReceiptDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} onOpenInvoice={id => setInvoiceId(id)} />
      <InvoiceDrawer id={invoiceId} onClose={() => setInvoiceId(null)} onChanged={load} />
      <RecordPaymentModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={r => { load(); if (r?.id) setOpenId(r.id); }} />
    </div>
  );
};

export default PaymentsPage;
