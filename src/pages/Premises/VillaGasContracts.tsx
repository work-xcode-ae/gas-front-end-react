import { useCallback, useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Tooltip, Modal, Input, Empty, Alert, message } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, FireOutlined, DollarOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { RecordPaymentModal } from '../Invoices/shared';
import { openPrintWindow, printInvoice, printDeliveryContract } from '../../utils/printDocs';
import { api, errorMessage, type Paged } from '../../api/client';
import { premisesApi } from '../../api/premises';
import { useAuth } from '../../auth/AuthContext';
import { HistoryButton } from '../../components/history/RecordHistory';
import { ContractModal, money, litres, d10 } from './forms';

const { Text } = Typography;
const STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: 'نشط' }, expired: { color: 'default', label: 'منتهي' },
  terminated: { color: 'red', label: 'منهى' }, draft: { color: 'blue', label: 'مسودة' }, pending: { color: 'orange', label: 'معلق' },
};

/**
 * «عقود توريد الغاز» of a villa (BuildingProfile → العقود في وضع الفيلا).
 * A villa has no units: its gas contract is the delivery contract of the villa itself (price per litre, invoiced per refill),
 * not a unit supply contract — so «عقد توريد جديد» opens the villa contract form directly.
 */
export default function VillaGasContracts({ villaId, reloadKey, onChanged, onNeedSignatory }: { villaId: number; reloadKey?: number; onChanged?: () => void;
  /** restaurant: nobody may sign yet → open the signatories tab */ onNeedSignatory?: () => void }) {
  const { can } = useAuth();
  const canManage = can('buildings.manage') || can('contracts.manage');
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [key, setKey] = useState(0);
  /** refill invoices of each contract (GET /invoices?contractId=) → billed / paid / balance + «تسجيل دفعة» */
  const [inv, setInv] = useState<Record<number, any[]>>({});
  const [pay, setPay] = useState<{ invoiceId?: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    premisesApi.get(villaId).then(async d => {
      setSite(d);
      const ids: number[] = (d.contracts ?? []).map((c: any) => c.id);
      const lists = await Promise.all(ids.map(id => api<Paged<any>>('/invoices', { query: { contractId: id, pageSize: 0 } }).then(x => x.items).catch(() => [])));
      setInv(Object.fromEntries(ids.map((id, i) => [id, lists[i]])));
    }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [villaId]);
  useEffect(() => { load(); }, [load, key, reloadKey]);
  const changed = () => { setKey(k => k + 1); onChanged?.(); };

  const list: any[] = site?.contracts ?? [];
  const isRest = site?.type === 'restaurant';
  const valid = (x: any) => x.status !== 'cancelled' && x.status !== 'draft';
  const sum = (id: number, f: string) => (inv[id] ?? []).filter(valid).reduce((n, x) => n + Number(x[f] ?? 0), 0);
  const allInv = Object.values(inv).flat().filter(valid);
  const totPaid = allInv.reduce((n, x) => n + Number(x.paid ?? 0), 0);
  const totDue = allInv.reduce((n, x) => n + Number(x.balance ?? 0), 0);
  const overdue = allInv.filter(x => x.status === 'overdue').reduce((n, x) => n + Number(x.balance ?? 0), 0);
  const customerId: number | undefined = site?.owner?.id ?? list[0]?.customerPartyId;
  const INV: Record<string, { color: string; label: string }> = {
    pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' }, paid: { color: 'success', label: 'مسددة' },
    overdue: { color: 'error', label: 'متأخرة' }, cancelled: { color: 'default', label: 'ملغاة' }, draft: { color: 'default', label: 'مسودة' },
  };
  const signers = (site?.signatories ?? []).filter((x: any) => x.isActive && x.canSignContracts);
  const openNew = () => {
    if (isRest && signers.length === 0) { message.warning('أضف شخصاً مخولاً بالتوقيع من طاقم المطعم أولاً'); onNeedSignatory?.(); return; }
    setEdit(null); setOpen(true);
  };
  const active = list.find(c => c.status === 'active');
  const terminate = (c: any) => {
    let reason = '';
    Modal.confirm({
      title: `إنهاء العقد ${c.contractNo}؟`, centered: true, okText: 'إنهاء', okType: 'danger', cancelText: 'إلغاء',
      content: <Input.TextArea rows={2} placeholder="السبب (اختياري)" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => { try { await premisesApi.terminateContract(c.id, undefined, reason || undefined); message.success('تم إنهاء العقد'); changed(); } catch (e) { message.error(errorMessage(e), 6); } },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'إجمالي العقود', value: list.length, color: '#fa8c16', bg: '#fff7e6' },
          { label: 'نشطة', value: list.filter(c => c.status === 'active').length, color: '#52c41a', bg: '#f6ffed' },
          { label: 'منتهية / منهاة', value: list.filter(c => c.status === 'expired' || c.status === 'terminated').length, color: '#ff4d4f', bg: '#fff1f0' },
          { label: 'سعر اللتر الحالي', value: active ? `${Number(active.pricePerLitre).toLocaleString()} د.إ` : '—', color: '#13c2c2', bg: '#e6fffb' },
          { label: 'الكمية المفوترة', value: litres(list.reduce((s, c) => s + Number(c.invoicedLitres ?? 0), 0)), color: '#1677ff', bg: '#e6f4ff' },
          { label: 'إجمالي المفوتر', value: money(list.reduce((s, c) => s + Number(c.invoicedTotal ?? 0), 0)), color: '#1a5c2a', bg: '#e8f5e9' },
          { label: 'المحصّل', value: money(totPaid), color: '#52c41a', bg: '#f6ffed' },
          { label: overdue > 0 ? `المستحق (متأخر ${money(overdue)})` : 'المستحق', value: money(totDue), color: totDue > 0 ? '#d4380d' : '#8c8c8c', bg: totDue > 0 ? '#fff2e8' : '#fafafa' },
        ].map((s, i) => (
          <Card key={i} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, minWidth: 100, textAlign: 'center', flex: '1 1 90px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
        {totDue > 0 && customerId && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button icon={<DollarOutlined />} style={{ borderRadius: 8, borderColor: '#52c41a', color: '#389e0d' }} onClick={() => setPay({})}>تسجيل دفعة</Button>
          </div>
        )}
        {canManage && site?.isActive && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={active ? `يوجد عقد نشط (${active.contractNo}) — أنهِه أو عدّله` : undefined}>
              <Button type="primary" icon={<PlusOutlined />} disabled={!!active} style={{ borderRadius: 8, background: active ? undefined : '#fa8c16', borderColor: active ? undefined : '#fa8c16' }}
                onClick={openNew}>عقد توريد جديد</Button>
            </Tooltip>
          </div>
        )}
      </div>
      <Alert type="info" showIcon style={{ marginBottom: 12, borderRadius: 8 }} icon={<FireOutlined />}
        message={isRest
          ? 'عقد التوريد بين الشركة ومالك المطعم، يوقّعه أحد المخولين من طاقم المطعم، بسعر اللتر، وتُصدر فاتورة لكل تعبئة بعد التوصيل.'
          : 'الفيلا بدون وحدات: عقد التوريد بين الشركة ومالك الفيلا مباشرة، بسعر اللتر، وتُصدر فاتورة لكل تعبئة بعد التوصيل.'} />
      <Table size="small" rowKey="id" loading={loading} dataSource={list} pagination={{ pageSize: 10, size: 'small' }}
        expandable={{
          rowExpandable: c => (inv[c.id] ?? []).length > 0,
          expandedRowRender: c => (
            <Table size="small" rowKey="id" pagination={false} dataSource={inv[c.id] ?? []} style={{ margin: '4px 0' }}
              columns={[
                { title: 'فاتورة التعبئة', render: (_: any, x: any) => <Text code>{x.no ?? x.invoiceNo}</Text> },
                { title: 'التاريخ', render: (_: any, x: any) => d10(x.date ?? x.issueDate) },
                { title: 'الاستحقاق', dataIndex: 'dueDate', render: (v: string) => <span style={{ color: dayjs(v).isBefore(dayjs(), 'day') ? '#d4380d' : undefined }}>{d10(v)}</span> },
                { title: 'الإجمالي', dataIndex: 'amount', render: (v: number) => money(v) },
                { title: 'المدفوع', dataIndex: 'paid', render: (v: number) => <Text style={{ color: '#389e0d' }}>{money(v)}</Text> },
                { title: 'الرصيد', dataIndex: 'balance', render: (v: number) => <Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#52c41a' }}>{money(v)}</Text> },
                { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={INV[v]?.color}>{INV[v]?.label ?? v}</Tag> },
                { title: '', render: (_: any, x: any) => <Space size={4}>
                  {Number(x.balance) > 0 && x.status !== 'cancelled' && <Button size="small" icon={<DollarOutlined />} style={{ borderColor: '#52c41a', color: '#389e0d' }}
                    onClick={() => setPay({ invoiceId: x.id })}>تسجيل دفعة</Button>}
                  <Tooltip title="طباعة الفاتورة / PDF"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => printInvoice(openPrintWindow(), x.id)} /></Tooltip>
                </Space> },
              ]} />
          ),
        }}
        locale={{ emptyText: <Empty description={`لا يوجد عقد توريد غاز ${isRest ? 'للمطعم' : 'للفيلا'} — أضف عقداً بسعر اللتر`} /> }}
        columns={[
          { title: 'رقم العقد', dataIndex: 'contractNo', render: x => <Text strong style={{ fontFamily: 'monospace', color: '#fa8c16' }}>{x}</Text> },
          { title: 'العميل (المالك)', dataIndex: 'customer', render: x => x ?? '—' },
          { title: 'الفترة', render: (_, c) => `${d10(c.startDate)} → ${d10(c.endDate)}${c.autoRenew ? ' (تجديد تلقائي)' : ''}` },
          { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: x => <Text strong>{Number(x).toLocaleString()} د.إ</Text> },
          { title: 'الضريبة', dataIndex: 'taxCode', render: x => x ?? 'افتراضي' },
          ...(isRest ? [{ title: 'الموقّع', dataIndex: 'signedByName', render: (x: string) => x ?? '—' }] : []),
          { title: 'الشروط', dataIndex: 'terms', render: (t: any[]) => <Tag>{t?.length ?? 0} بند</Tag> },
          { title: 'المفوتر', render: (_, c) => <span>{money(c.invoicedTotal)}<div style={{ fontSize: 11, color: '#888' }}>{litres(c.invoicedLitres)}</div></span> },
          { title: 'المحصّل', render: (_, c) => <Text style={{ color: '#389e0d' }}>{money(sum(c.id, 'paid'))}</Text> },
          { title: 'الرصيد', render: (_, c) => { const b = sum(c.id, 'balance'); return <Text strong style={{ color: b > 0 ? '#d4380d' : '#52c41a' }}>{money(b)}</Text>; } },
          { title: 'الحالة', dataIndex: 'status', render: x => <Tag color={STATUS[x]?.color}>{STATUS[x]?.label ?? x}</Tag> },
          { title: '', render: (_, c) => <Space size={0}>
            <Tooltip title="طباعة العقد"><Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => printDeliveryContract(openPrintWindow(), c.id)} /></Tooltip>
            {canManage && c.status === 'active' && <>
              <Tooltip title="تعديل"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEdit(c); setOpen(true); }} /></Tooltip>
              <Tooltip title="إنهاء العقد"><Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => terminate(c)} /></Tooltip>
            </>}
            <HistoryButton entityType="DeliveryContract" id={c.id} label={null} type="text" />
          </Space> },
        ]} />
      <RecordPaymentModal open={!!pay} tenantId={customerId} invoiceId={pay?.invoiceId} onClose={() => setPay(null)}
        onSaved={() => { setPay(null); changed(); }} />
      {site && <ContractModal site={site} contract={edit} open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); changed(); }} />}
    </div>
  );
}
