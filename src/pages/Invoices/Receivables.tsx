// Receivables (BRD §7.2 / §7.3): invoice instalment schedules, credit notes (إشعار دائن) and customer refunds (استرداد للعميل).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Col, DatePicker, Divider, Drawer, Empty, Input, InputNumber, Modal, Radio, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CalendarOutlined, DeleteOutlined, EditOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, PrinterOutlined, RollbackOutlined, StopOutlined,
  FileExcelOutlined, SwapOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { API_BASE, api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PRIMARY, GOLD, money, PAYMENT_METHODS, methodLabel, PRINT_CSS, CustomerSelect } from './shared';

const { Text, Title } = Typography;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ═════════════ instalments ═════════════

export interface InstallmentView {
  id: number; seqNo: number; dueDate: string; amount: number; paid: number; outstanding: number; status: string; notes?: string; daysLate: number;
}
export const INSTALLMENT_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: 'gold', label: 'مستحق' }, partial: { color: 'cyan', label: 'مسدد جزئياً' }, paid: { color: 'success', label: 'مسدد' },
  overdue: { color: 'error', label: 'متأخر' }, on_hold: { color: 'purple', label: 'معلّق' }, cancelled: { color: 'default', label: 'ملغى' },
};
const FREQUENCIES = [
  { value: 'month:1', label: 'شهري' }, { value: 'month:2', label: 'كل شهرين' }, { value: 'month:3', label: 'ربع سنوي' },
  { value: 'month:6', label: 'نصف سنوي' }, { value: 'week:1', label: 'أسبوعي' }, { value: 'week:2', label: 'كل أسبوعين' },
];

export interface ScheduleRow { key: string; id?: number; dueDate: Dayjs; amount: number; notes?: string; locked?: boolean }
let seq = 0;
const newKey = () => `r${++seq}`;

/** Split helpers + editable rows. Locked rows (already received money) are kept as they are. */
export function ScheduleEditor({ total, start, rows, onChange }: { total: number; start: Dayjs; rows: ScheduleRow[]; onChange: (rows: ScheduleRow[]) => void }) {
  const [count, setCount] = useState(3);
  const [freq, setFreq] = useState('month:1');
  const [first, setFirst] = useState<Dayjs>(start.add(1, 'month'));
  const [percents, setPercents] = useState('');
  const locked = rows.filter(r => r.locked);
  const lockedSum = locked.reduce((s, r) => s + r.amount, 0);
  const free = r2(total - lockedSum);
  const sum = r2(rows.reduce((s, r) => s + Number(r.amount || 0), 0));
  const diff = r2(total - sum);

  const dates = (n: number) => {
    const [unit, step] = freq.split(':');
    return Array.from({ length: n }, (_, i) => first.add(i * Number(step), unit as 'month' | 'week'));
  };
  const build = (amounts: number[]) => {
    const d = dates(amounts.length);
    onChange([...locked, ...amounts.map((a, i) => ({ key: newKey(), dueDate: d[i], amount: a }))]);
  };
  const equal = () => {
    if (count < 1) return;
    const each = Math.floor((free / count) * 100) / 100;
    const list = Array.from({ length: count }, () => each);
    list[count - 1] = r2(free - each * (count - 1));
    build(list);
  };
  const byPercent = () => {
    const p = percents.split(/[,،\s]+/).map(Number).filter(x => x > 0);
    const s = p.reduce((a, b) => a + b, 0);
    if (!p.length || Math.abs(s - 100) > 0.01) { message.warning('مجموع النسب يجب أن يساوي 100'); return; }
    const list = p.map(x => r2(free * x / 100));
    list[list.length - 1] = r2(free - list.slice(0, -1).reduce((a, b) => a + b, 0));
    build(list);
  };
  const set = (key: string, patch: Partial<ScheduleRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div>
      <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 10 }}>
        <Space wrap>
          <span>أول استحقاق</span><DatePicker value={first} onChange={v => v && setFirst(v)} allowClear={false} />
          <Select value={freq} onChange={setFreq} options={FREQUENCIES} style={{ width: 130 }} />
          <InputNumber min={1} max={120} value={count} onChange={v => setCount(Number(v ?? 1))} addonAfter="قسط" style={{ width: 120 }} />
          <Button onClick={equal}>تقسيم متساوٍ</Button>
        </Space>
        <Space wrap style={{ marginTop: 8 }}>
          <Input value={percents} onChange={e => setPercents(e.target.value)} placeholder="نسب مثل 30, 30, 40" style={{ width: 200 }} />
          <Button onClick={byPercent}>تقسيم بالنسب</Button>
          <Button icon={<PlusOutlined />} onClick={() => onChange([...rows, { key: newKey(), dueDate: (rows.at(-1)?.dueDate ?? first).add(1, 'month'), amount: diff > 0 ? diff : 0 }])}>صف يدوي</Button>
          {lockedSum > 0 && <Text type="secondary" style={{ fontSize: 12 }}>الأقساط المحصّلة ({money(lockedSum)}) تبقى كما هي</Text>}
        </Space>
      </div>
      <Table size="small" rowKey="key" pagination={false} dataSource={[...rows].sort((a, b) => a.dueDate.valueOf() - b.dueDate.valueOf())}
        locale={{ emptyText: 'لا توجد أقساط — استخدم أدوات التقسيم أعلاه' }}
        columns={[
          { title: '#', key: 'n', width: 40, render: (_, __, i) => i + 1 },
          { title: 'تاريخ الاستحقاق', key: 'd', render: (_, r) => <DatePicker value={r.dueDate} disabled={r.locked} allowClear={false} onChange={v => v && set(r.key, { dueDate: v })} /> },
          { title: 'المبلغ', key: 'a', render: (_, r) => <InputNumber min={0.01} step={100} value={r.amount} disabled={r.locked} onChange={v => set(r.key, { amount: Number(v ?? 0) })} style={{ width: 140 }} /> },
          { title: 'ملاحظة', key: 'nt', render: (_, r) => <Input value={r.notes} disabled={r.locked} onChange={e => set(r.key, { notes: e.target.value })} /> },
          { title: '', key: 'x', width: 50, render: (_, r) => r.locked ? <Tag color="success">محصّل</Tag>
            : <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(rows.filter(x => x.key !== r.key))} /> },
        ]} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, marginTop: 8, fontSize: 13 }}>
        <span>إجمالي الفاتورة: <b>{money(total)}</b></span>
        <span>مجموع الأقساط: <b>{money(sum)}</b></span>
        <span style={{ color: diff === 0 ? '#389e0d' : '#cf1322' }}>الفرق: <b>{money(diff)}</b></span>
      </div>
    </div>
  );
}

export const scheduleBody = (rows: ScheduleRow[]) =>
  rows.map(r => ({ id: r.id ?? null, dueDate: r.dueDate.format('YYYY-MM-DD'), amount: r2(Number(r.amount)), notes: r.notes || null }));

/** «جدول الأقساط» section inside the invoice drawer. */
export function InstallmentsSection({ invoice, rows, onChanged }: { invoice: any; rows: InstallmentView[]; onChanged: () => void }) {
  const { can } = useAuth();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<ScheduleRow[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFor, setStatusFor] = useState<{ row: InstallmentView; status: string } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const editable = can('invoices.manage') && invoice.status !== 'draft' && invoice.status !== 'cancelled';
  const total = Number(invoice.amount ?? 0);

  const openEdit = () => {
    setDraft(rows.filter(r => r.status !== 'cancelled').map(r => ({ key: newKey(), id: r.id, dueDate: dayjs(r.dueDate), amount: r.amount, notes: r.notes, locked: r.paid > 0 })));
    setReason('');
    setEdit(true);
  };
  const save = async () => {
    if (!draft.length) { message.warning('أضف قسطاً واحداً على الأقل'); return; }
    setSaving(true);
    try {
      await api(`/invoices/${invoice.id}/installments`, { method: 'PUT', body: { rows: scheduleBody(draft), reason: reason || null } });
      message.success('تم حفظ جدول الأقساط');
      setEdit(false);
      onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const changeStatus = async () => {
    if (!statusFor) return;
    if (!statusReason.trim()) { message.warning('أدخل السبب'); return; }
    try {
      await api(`/invoices/${invoice.id}/installments/${statusFor.row.id}/status`, { method: 'PATCH', body: { status: statusFor.status, reason: statusReason } });
      message.success('تم تحديث القسط');
      setStatusFor(null);
      onChanged();
    } catch (e) { message.error(errorMessage(e), 6); }
  };

  if (!rows.length && !editable) return null;
  return (
    <>
      <Divider titlePlacement="right" style={{ fontSize: 13 }}><CalendarOutlined /> جدول الأقساط</Divider>
      {rows.length === 0 ? (
        <div className="no-print" style={{ textAlign: 'center', padding: 8 }}>
          <Text type="secondary">لا يوجد جدول أقساط — الفاتورة مستحقة دفعة واحدة. </Text>
          <Button size="small" icon={<CalendarOutlined />} onClick={openEdit}>إنشاء جدول أقساط</Button>
        </div>
      ) : (
        <>
          <Table size="small" rowKey="id" pagination={false} dataSource={rows}
            rowClassName={r => (r.status === 'cancelled' ? 'no-print' : '')}
            columns={[
              { title: '#', dataIndex: 'seqNo', width: 40 },
              { title: 'الاستحقاق', dataIndex: 'dueDate', render: (v, r) => <span style={{ color: r.status === 'overdue' ? '#cf1322' : undefined }}>{v}{r.daysLate > 0 && <Text type="danger" style={{ fontSize: 11 }}> ({r.daysLate} يوم)</Text>}</span> },
              { title: 'المبلغ', dataIndex: 'amount', render: money },
              { title: 'المسدد', dataIndex: 'paid', render: v => <span style={{ color: '#389e0d' }}>{money(v)}</span> },
              { title: 'المتبقي', dataIndex: 'outstanding', render: v => <b style={{ color: Number(v) > 0 ? '#d4380d' : '#999' }}>{money(v)}</b> },
              { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={INSTALLMENT_STATUS[s]?.color}>{INSTALLMENT_STATUS[s]?.label ?? s}</Tag> },
              { title: 'ملاحظات', dataIndex: 'notes', render: v => <span style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#666' }}>{v}</span> },
              ...(editable ? [{
                title: '', key: 'act', width: 80, className: 'no-print', render: (_: unknown, r: InstallmentView) => r.status === 'paid' || r.status === 'cancelled' ? null : (
                  <Space size={2}>
                    {r.status === 'on_hold'
                      ? <Tooltip title="إعادة التفعيل"><Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={() => { setStatusReason(''); setStatusFor({ row: r, status: 'pending' }); }} /></Tooltip>
                      : <Tooltip title="تعليق"><Button size="small" type="text" icon={<PauseCircleOutlined />} onClick={() => { setStatusReason(''); setStatusFor({ row: r, status: 'on_hold' }); }} /></Tooltip>}
                    {r.paid === 0 && <Tooltip title="إلغاء القسط"><Button size="small" type="text" danger icon={<StopOutlined />} onClick={() => { setStatusReason(''); setStatusFor({ row: r, status: 'cancelled' }); }} /></Tooltip>}
                  </Space>),
              }] : []),
            ]} />
          {editable && <div className="no-print" style={{ marginTop: 6 }}><Button size="small" icon={<EditOutlined />} onClick={openEdit}>تعديل الجدول</Button></div>}
        </>
      )}
      <Modal open={edit} title={`جدول أقساط الفاتورة ${invoice.invoiceNo}`} width={820} okText="حفظ الجدول" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={() => setEdit(false)} destroyOnClose>
        <ScheduleEditor total={total} start={dayjs(invoice.date)} rows={draft} onChange={setDraft} />
        <Input style={{ marginTop: 10 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب التعديل (اختياري)" />
      </Modal>
      <Modal open={!!statusFor} title={statusFor ? `القسط ${statusFor.row.seqNo}: ${INSTALLMENT_STATUS[statusFor.status]?.label}` : ''} okText="تأكيد" cancelText="رجوع"
        okButtonProps={{ danger: statusFor?.status === 'cancelled' }} onOk={changeStatus} onCancel={() => setStatusFor(null)} destroyOnClose>
        {statusFor?.status === 'cancelled' && <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="إلغاء القسط لا يغيّر إجمالي الفاتورة؛ عدّل الجدول أو أصدر إشعاراً دائناً إذا لزم." />}
        <Input.TextArea rows={3} value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="السبب (إلزامي)" />
      </Modal>
    </>
  );
}

// ═════════════ credit notes ═════════════

export const CN_STATUS: Record<string, { color: string; label: string }> = {
  posted: { color: 'success', label: 'مرحّل' }, cancelled: { color: 'default', label: 'ملغى' },
};

/** Issue a credit note against an invoice: full / amount (VAT proportional) / by lines. */
export function CreditNoteModal({ open, invoiceId, onClose, onSaved }: { open: boolean; invoiceId?: number; onClose: () => void; onSaved: (id: number) => void }) {
  const [info, setInfo] = useState<any>(null);
  const [mode, setMode] = useState<'full' | 'amount' | 'lines'>('amount');
  const [amount, setAmount] = useState<number | null>(null);
  const [lines, setLines] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [apply, setApply] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || !invoiceId) return;
    setInfo(null); setMode('amount'); setAmount(null); setLines({}); setReason(''); setDate(dayjs()); setApply(true);
    api<any>(`/credit-notes/creditable/${invoiceId}`).then(setInfo).catch(e => { message.error(errorMessage(e), 6); onClose(); });
  }, [open, invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    if (!info) return { net: 0, vat: 0 };
    const ls: any[] = info.lines ?? [];
    if (mode === 'full') return ls.reduce((s, l) => ({ net: s.net + l.remainingNet, vat: s.vat + (l.remainingGross - l.remainingNet) }), { net: 0, vat: 0 });
    if (mode === 'lines') return ls.reduce((s, l) => { const n = Number(lines[l.itemId] ?? 0); return { net: s.net + n, vat: s.vat + r2(n * l.vatRate / 100) }; }, { net: 0, vat: 0 });
    const gross = ls.reduce((s, l) => s + l.remainingGross, 0) || 1;
    const t = Number(amount ?? 0);
    const vat = ls.reduce((s, l) => s + r2(l.remainingNet * t / gross * l.vatRate / 100), 0);
    return { net: r2(t - vat), vat: r2(vat) };
  }, [info, mode, amount, lines]);

  const save = async () => {
    if (!reason.trim()) { message.warning('أدخل سبب الإشعار الدائن'); return; }
    if (mode === 'amount' && !amount) { message.warning('أدخل المبلغ'); return; }
    setSaving(true);
    try {
      const r = await api<{ id: number; creditNoteNo: string; applied: number; credit: number; posted: boolean }>('/credit-notes', {
        method: 'POST', body: {
          invoiceId, date: date.format('YYYY-MM-DD'), reason, mode, amount: mode === 'amount' ? amount : null, applyToInvoice: apply,
          lines: mode === 'lines' ? Object.entries(lines).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ invoiceItemId: Number(k), amount: v })) : null,
        },
      });
      message.success(`تم إصدار الإشعار الدائن ${r.creditNoteNo}${r.credit > 0 ? ` — ${money(r.credit)} رصيد دائن للعميل` : ''}`, 5);
      if (!r.posted) message.warning('لم يتم ترحيل القيد — راجع ربط الحسابات', 6);
      onSaved(r.id);
      onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={`إشعار دائن — الفاتورة ${info?.invoiceNo ?? ''}`} width={760} okText="إصدار الإشعار" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      {!info ? <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div> : (
        <>
          <Row gutter={12} style={{ marginBottom: 10, fontSize: 13 }}>
            <Col span={8}>إجمالي الفاتورة: <b>{money(info.total)}</b></Col>
            <Col span={8}>الرصيد المستحق: <b>{money(info.balance)}</b></Col>
            <Col span={8}>قابل للإشعار: <b style={{ color: PRIMARY }}>{money(info.remaining)}</b></Col>
          </Row>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)} optionType="button" buttonStyle="solid" style={{ marginBottom: 12 }}
            options={[{ value: 'full', label: 'كامل المتبقي' }, { value: 'amount', label: 'مبلغ' }, { value: 'lines', label: 'حسب البنود' }]} />
          {mode === 'amount' && (
            <div style={{ marginBottom: 12 }}>
              <InputNumber min={0.01} max={info.remaining} value={amount} onChange={v => setAmount(v as number)} style={{ width: 220 }} addonAfter="شامل الضريبة" />
              <Text type="secondary" style={{ fontSize: 12, marginInlineStart: 8 }}>توزّع الضريبة نسبياً على البنود</Text>
            </div>
          )}
          {mode !== 'amount' && (
            <Table size="small" rowKey="itemId" pagination={false} dataSource={info.lines} style={{ marginBottom: 12 }}
              columns={[
                { title: 'البند', dataIndex: 'description' },
                { title: 'المبلغ', dataIndex: 'net', render: money },
                { title: 'أشعر سابقاً', dataIndex: 'credited', render: v => (Number(v) ? money(v) : '—') },
                { title: 'المتبقي', dataIndex: 'remainingNet', render: money },
                ...(mode === 'lines' ? [{
                  title: 'مبلغ الإشعار (قبل الضريبة)', key: 'x', render: (_: unknown, l: any) => (
                    <InputNumber min={0} max={l.remainingNet} disabled={l.remainingNet <= 0} value={lines[l.itemId]} style={{ width: 140 }}
                      onChange={v => setLines(s => ({ ...s, [l.itemId]: Number(v ?? 0) }))} />),
                }] : []),
              ]} />
          )}
          <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', fontSize: 13, marginBottom: 10 }}>
            <span>قبل الضريبة: <b>{money(preview.net)}</b></span><span>الضريبة: <b>{money(preview.vat)}</b></span>
            <span>الإجمالي: <b style={{ color: PRIMARY }}>{money(preview.net + preview.vat)}</b></span>
          </div>
          <Row gutter={12}>
            <Col span={8}><DatePicker value={date} onChange={v => v && setDate(v)} allowClear={false} style={{ width: '100%' }} /></Col>
            <Col span={16}><Select value={apply ? 1 : 0} onChange={v => setApply(v === 1)} style={{ width: '100%' }}
              options={[{ value: 1, label: 'تخفيض رصيد الفاتورة (والباقي رصيد دائن للعميل)' }, { value: 0, label: 'إبقاؤه رصيداً دائناً للعميل بالكامل' }]} /></Col>
          </Row>
          <Input.TextArea style={{ marginTop: 10 }} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإشعار الدائن (إلزامي)" />
        </>
      )}
    </Modal>
  );
}

function CompanyHeader({ company, title, subtitle, no }: { company: any; title: string; subtitle: string; no: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${GOLD}`, paddingBottom: 12, marginBottom: 16 }}>
      <div>
        <Title level={4} style={{ margin: 0, color: PRIMARY }}>{company?.nameAr ?? company?.nameEn ?? ''}</Title>
        <div style={{ fontSize: 12, color: '#666' }}>{company?.address}</div>
        <div style={{ fontSize: 12, color: '#666' }}>{[company?.phone, company?.email].filter(Boolean).join(' · ')}</div>
        {company?.trn && <div style={{ fontSize: 12 }}>الرقم الضريبي: <b>{company.trn}</b></div>}
      </div>
      <div style={{ textAlign: 'end' }}>
        {company?.logoPath && <img src={`${API_BASE}/files/${company.logoPath}`} alt="" style={{ height: 48, marginBottom: 6 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        <div style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{title}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{subtitle}</div>
        <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 14 }}>{no}</div>
      </div>
    </div>
  );
}

/** Printable credit note with apply-to-invoices and cancel. */
export function CreditNoteDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);
  const load = useCallback(() => { if (id) api<any>(`/credit-notes/${id}`).then(setData).catch(e => message.error(errorMessage(e))); }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);
  const cn = data?.creditNote;
  const done = () => { load(); onChanged?.(); };
  const allocate = async () => {
    try { const r = await api<any>(`/credit-notes/${id}/allocate`, { method: 'POST', body: [] }); message.success(`تم تطبيق ${money(r.allocated)} على الفواتير المفتوحة`); done(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  const cancel = async () => {
    if (!reason.trim()) { message.warning('أدخل سبب الإلغاء'); return; }
    try { await api(`/credit-notes/${id}/cancel`, { method: 'POST', body: { reason } }); message.success('تم إلغاء الإشعار الدائن'); setCancelOpen(false); done(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  return (
    <Drawer open={!!id} onClose={onClose} width={Math.min(window.innerWidth - 40, 820)} destroyOnClose
      title={<Space><RollbackOutlined style={{ color: PRIMARY }} /><span>إشعار دائن {cn?.creditNoteNo ?? ''}</span>{cn && <Tag color={CN_STATUS[cn.status]?.color}>{CN_STATUS[cn.status]?.label}</Tag>}</Space>}
      extra={cn && (
        <Space wrap className="no-print">
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة / PDF</Button>
          {cn.status === 'posted' && cn.available > 0 && can('invoices.manage') && <Button icon={<SwapOutlined />} onClick={allocate}>تطبيق على الفواتير المفتوحة</Button>}
          {cn.status === 'posted' && cn.available > 0 && can('payments.manage') && <Button icon={<RollbackOutlined />} onClick={() => setRefund(true)}>استرداد للعميل</Button>}
          {cn.status === 'posted' && can('invoices.cancel') && <Button danger icon={<StopOutlined />} onClick={() => { setReason(''); setCancelOpen(true); }}>إلغاء</Button>}
        </Space>
      )}>
      <style>{PRINT_CSS}</style>
      {!cn ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <div className="print-sheet" style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: 24 }}>
          <CompanyHeader company={data.company} title="إشعار دائن ضريبي" subtitle="TAX CREDIT NOTE" no={cn.creditNoteNo} />
          <Row gutter={16} style={{ marginBottom: 16, fontSize: 12 }}>
            <Col span={12}>
              <div style={{ fontSize: 11, color: '#888' }}>العميل</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{data.customer?.name}</div>
              {data.customer?.code && <div>{data.customer.code}</div>}
            </Col>
            <Col span={12}>
              <div>التاريخ: <b>{cn.date}</b></div>
              <div>الفاتورة الأصلية: <b>{cn.invoiceNo}</b> ({cn.invoiceDate})</div>
              {data.journal && <div className="no-print">القيد: <b>{data.journal.journalNo}</b></div>}
            </Col>
          </Row>
          <div style={{ marginBottom: 10, fontSize: 13 }}>السبب: <b>{cn.reason}</b></div>
          <Table size="small" rowKey="id" pagination={false} bordered dataSource={data.lines}
            columns={[
              { title: '#', key: 'n', width: 40, render: (_, __, i) => i + 1 },
              { title: 'البيان', dataIndex: 'description' },
              { title: 'المبلغ', dataIndex: 'amount', render: money },
              { title: 'الضريبة', key: 'v', render: (_, l: any) => <span>{money(l.vatAmount)} <span style={{ fontSize: 10, color: '#888' }}>({l.vatRate}%)</span></span> },
              { title: 'الإجمالي', dataIndex: 'total', render: money },
            ]} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <table style={{ fontSize: 13, minWidth: 280 }}><tbody>
              <tr><td style={{ padding: 4, color: '#666' }}>المجموع قبل الضريبة</td><td style={{ padding: 4, textAlign: 'end' }}>{money(cn.subtotal)}</td></tr>
              <tr><td style={{ padding: 4, color: '#666' }}>ضريبة القيمة المضافة</td><td style={{ padding: 4, textAlign: 'end' }}>{money(cn.vatAmount)}</td></tr>
              <tr style={{ borderTop: '2px solid #333' }}><td style={{ padding: 4, fontWeight: 700 }}>إجمالي الإشعار</td><td style={{ padding: 4, textAlign: 'end', fontWeight: 800, color: PRIMARY }}>{money(cn.totalAmount)}</td></tr>
              <tr><td style={{ padding: 4, color: '#666' }}>مطبّق على فواتير</td><td style={{ padding: 4, textAlign: 'end' }}>{money(cn.applied)}</td></tr>
              {cn.refunded > 0 && <tr><td style={{ padding: 4, color: '#666' }}>مسترد للعميل</td><td style={{ padding: 4, textAlign: 'end' }}>{money(cn.refunded)}</td></tr>}
              <tr><td style={{ padding: 4, fontWeight: 700 }}>رصيد دائن متاح</td><td style={{ padding: 4, textAlign: 'end', fontWeight: 700 }}>{money(cn.available)}</td></tr>
            </tbody></table>
          </div>
          {(data.allocations ?? []).length > 0 && (<>
            <Divider titlePlacement="right" style={{ fontSize: 13 }}>التطبيق على الفواتير</Divider>
            <Table size="small" rowKey="id" pagination={false} dataSource={data.allocations}
              columns={[{ title: 'الفاتورة', dataIndex: 'invoiceNo' }, { title: 'التاريخ', dataIndex: 'issueDate' }, { title: 'المبلغ', dataIndex: 'amount', render: money }]} />
          </>)}
          {cn.status === 'cancelled' && <Alert type="warning" showIcon style={{ marginTop: 12 }} message={`ملغى: ${cn.cancelReason ?? ''}`} />}
        </div>
      )}
      <Modal open={cancelOpen} title={`إلغاء الإشعار الدائن ${cn?.creditNoteNo ?? ''}`} okText="إلغاء الإشعار" okButtonProps={{ danger: true }} cancelText="رجوع" onOk={cancel} onCancel={() => setCancelOpen(false)}>
        <Alert type="info" showIcon style={{ marginBottom: 10 }} message="يُعكس القيد وتُعاد الفواتير التي سددها الإشعار إلى رصيدها السابق." />
        <Input.TextArea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإلغاء (إلزامي)" />
      </Modal>
      <RefundModal open={refund} tenantId={cn?.tenantId} onClose={() => setRefund(false)} onSaved={done} />
    </Drawer>
  );
}

/** Credit notes register (sales tab). */
export function CreditNotesList({ tenantId: fixedTenant }: { tenantId?: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<number | undefined>(fixedTenant);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('year'), dayjs()]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/credit-notes', { query: { pageSize: 0, tenantId, search: search || undefined, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [tenantId, range, search]);
  useEffect(() => { load(); }, [load]);
  const totals = rows.filter(r => r.status === 'posted').reduce((s, r) => ({ total: s.total + r.totalAmount, vat: s.vat + r.vatAmount, avail: s.avail + r.available }), { total: 0, vat: 0, avail: 0 });
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range as any} onChange={v => setRange(v as any)} />
        {!fixedTenant && <CustomerSelect allowClear value={tenantId} onChange={v => setTenantId(v)} style={{ width: 220 }} />}
        <Input.Search allowClear placeholder="رقم الإشعار / الفاتورة / العميل" prefix={<SearchOutlined />} style={{ width: 240 }} onSearch={setSearch} />
        <Button icon={<ReloadOutlined />} onClick={load} />
        <Text type="secondary" style={{ fontSize: 12 }}>الإجمالي {money(totals.total)} · ضريبة مستردة {money(totals.vat)} · رصيد غير مطبّق {money(totals.avail)}</Text>
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="لا توجد إشعارات دائنة" /> }}
        onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'رقم الإشعار', dataIndex: 'creditNoteNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text> },
          { title: 'التاريخ', dataIndex: 'date', width: 100 },
          { title: 'العميل', dataIndex: 'tenant' },
          { title: 'الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
          { title: 'السبب', dataIndex: 'reason', ellipsis: true },
          { title: 'الإجمالي', dataIndex: 'totalAmount', align: 'end' as const, render: money },
          { title: 'غير مطبّق', dataIndex: 'available', align: 'end' as const, render: v => (Number(v) > 0 ? <b style={{ color: '#d46b08' }}>{money(v)}</b> : '—') },
          { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={CN_STATUS[s]?.color}>{CN_STATUS[s]?.label ?? s}</Tag> },
        ]} />
      <CreditNoteDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </>
  );
}

// ═════════════ customer refunds ═════════════

const SOURCE_LABEL: Record<string, string> = { receipt: 'سند قبض', credit_note: 'إشعار دائن' };

/** Refund unallocated customer credit (receipts / credit notes), oldest first. */
export function RefundModal({ open, tenantId, onClose, onSaved }: { open: boolean; tenantId?: number; onClose: () => void; onSaved?: (id: number) => void }) {
  const [customer, setCustomer] = useState<number | undefined>(tenantId);
  const [credit, setCredit] = useState<{ total: number; sources: any[] } | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setCustomer(tenantId); setReference(''); setReason(''); setDate(dayjs()); setMethod('bank_transfer'); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !customer) { setCredit(null); return; }
    api<any>('/customer-refunds/credit', { query: { tenantId: customer } })
      .then(r => { setCredit(r); setAmount(r.total > 0 ? r2(r.total) : null); }).catch(e => message.error(errorMessage(e)));
  }, [open, customer]);
  const save = async () => {
    if (!customer || !amount) { message.warning('اختر العميل وأدخل المبلغ'); return; }
    if (!reason.trim()) { message.warning('أدخل سبب الاسترداد'); return; }
    setSaving(true);
    try {
      const r = await api<{ id: number; refundNo: string; posted: boolean }>('/customer-refunds', {
        method: 'POST', body: { tenantId: customer, amount, date: date.format('YYYY-MM-DD'), method, reference: reference || null, reason },
      });
      message.success(`تم تسجيل الاسترداد ${r.refundNo}`);
      if (!r.posted) message.warning('لم يتم ترحيل القيد — راجع ربط الحسابات', 6);
      onSaved?.(r.id);
      onClose();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} title="استرداد للعميل" width={680} okText="تسجيل الاسترداد" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose
      okButtonProps={{ disabled: !credit || credit.total <= 0 }}>
      {!tenantId && <CustomerSelect value={customer} onChange={v => setCustomer(v)} style={{ width: '100%', marginBottom: 10 }} />}
      {credit && (credit.total <= 0 ? <Alert type="info" showIcon message="لا يوجد رصيد دائن غير مخصص لهذا العميل." /> : (
        <>
          <Alert type="success" showIcon style={{ marginBottom: 10 }} message={<span>الرصيد الدائن المتاح للاسترداد: <b>{money(credit.total)}</b></span>} />
          <Table size="small" rowKey={(s: any) => `${s.kind}-${s.id}`} pagination={false} dataSource={credit.sources} style={{ marginBottom: 12 }}
            columns={[
              { title: 'المصدر', dataIndex: 'kind', render: k => <Tag>{SOURCE_LABEL[k] ?? k}</Tag> },
              { title: 'الرقم', dataIndex: 'no' }, { title: 'التاريخ', dataIndex: 'date' },
              { title: 'المبلغ', dataIndex: 'total', render: money }, { title: 'المتاح', dataIndex: 'free', render: v => <b>{money(v)}</b> },
            ]} />
          <Row gutter={10}>
            <Col span={8}><InputNumber min={0.01} max={credit.total} value={amount} onChange={v => setAmount(v as number)} style={{ width: '100%' }} addonAfter="د.إ" /></Col>
            <Col span={8}><Select value={method} onChange={setMethod} options={PAYMENT_METHODS} style={{ width: '100%' }} /></Col>
            <Col span={8}><DatePicker value={date} onChange={v => v && setDate(v)} allowClear={false} style={{ width: '100%' }} /></Col>
          </Row>
          <Input style={{ marginTop: 10 }} value={reference} onChange={e => setReference(e.target.value)} placeholder="المرجع (رقم التحويل / الشيك)" />
          <Input.TextArea style={{ marginTop: 10 }} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الاسترداد (إلزامي)" />
          <Text type="secondary" style={{ fontSize: 12 }}>يُخصم من أقدم رصيد أولاً. القيد: مدين ذمم العملاء / دائن النقدية أو البنك.</Text>
        </>
      ))}
    </Modal>
  );
}

/** Printable refund voucher with cancel. */
export function RefundDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(() => { if (id) api<any>(`/customer-refunds/${id}`).then(setData).catch(e => message.error(errorMessage(e))); }, [id]);
  useEffect(() => { setData(null); load(); }, [load]);
  const r = data?.refund;
  const cancel = async () => {
    if (!reason.trim()) { message.warning('أدخل سبب الإلغاء'); return; }
    try { await api(`/customer-refunds/${id}/cancel`, { method: 'POST', body: { reason } }); message.success('تم إلغاء الاسترداد'); setCancelOpen(false); load(); onChanged?.(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  return (
    <Drawer open={!!id} onClose={onClose} width={Math.min(window.innerWidth - 40, 760)} destroyOnClose
      title={<Space><RollbackOutlined style={{ color: PRIMARY }} /><span>استرداد {r?.refundNo ?? ''}</span>{r && <Tag color={CN_STATUS[r.status]?.color}>{CN_STATUS[r.status]?.label}</Tag>}</Space>}
      extra={r && (
        <Space className="no-print">
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>طباعة / PDF</Button>
          {r.status === 'posted' && can('payments.cancel') && <Button danger icon={<StopOutlined />} onClick={() => { setReason(''); setCancelOpen(true); }}>إلغاء</Button>}
        </Space>
      )}>
      <style>{PRINT_CSS}</style>
      {!r ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <div className="print-sheet" style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 10, padding: 24 }}>
          <CompanyHeader company={data.company} title="سند استرداد للعميل" subtitle="CUSTOMER REFUND" no={r.refundNo} />
          <table style={{ width: '100%', fontSize: 14, marginBottom: 16 }}><tbody>
            <tr><td style={{ padding: 6, color: '#666', width: 160 }}>صُرف إلى</td><td style={{ padding: 6 }}><b>{data.customer?.name}</b> {data.customer?.code && <Tag>{data.customer.code}</Tag>}</td></tr>
            <tr><td style={{ padding: 6, color: '#666' }}>المبلغ</td><td style={{ padding: 6, fontSize: 18, fontWeight: 800, color: PRIMARY }}>{money(r.amount)}</td></tr>
            <tr><td style={{ padding: 6, color: '#666' }}>التاريخ</td><td style={{ padding: 6 }}>{r.date}</td></tr>
            <tr><td style={{ padding: 6, color: '#666' }}>طريقة الدفع</td><td style={{ padding: 6 }}>{r.methodLabel ?? methodLabel(r.method)}{r.reference ? ` — ${r.reference}` : ''}</td></tr>
            <tr><td style={{ padding: 6, color: '#666' }}>السبب</td><td style={{ padding: 6 }}>{r.reason}</td></tr>
            {data.journal && <tr className="no-print"><td style={{ padding: 6, color: '#666' }}>القيد</td><td style={{ padding: 6 }}>{data.journal.journalNo}</td></tr>}
          </tbody></table>
          <Table size="small" rowKey="id" pagination={false} dataSource={data.sources}
            columns={[
              { title: 'من رصيد', key: 'k', render: (_, s: any) => s.receiptNo ? `سند قبض ${s.receiptNo}` : `إشعار دائن ${s.creditNoteNo}` },
              { title: 'المبلغ', dataIndex: 'amount', render: money },
            ]} />
          <Row gutter={24} style={{ marginTop: 40, fontSize: 12, textAlign: 'center' }}>
            <Col span={8}>المحاسب<br /><br />__________</Col><Col span={8}>المعتمد<br /><br />__________</Col><Col span={8}>المستلم<br /><br />__________</Col>
          </Row>
          {r.status === 'cancelled' && <Alert type="warning" showIcon style={{ marginTop: 12 }} message={`ملغى: ${r.cancelReason ?? ''}`} />}
        </div>
      )}
      <Modal open={cancelOpen} title={`إلغاء الاسترداد ${r?.refundNo ?? ''}`} okText="إلغاء الاسترداد" okButtonProps={{ danger: true }} cancelText="رجوع" onOk={cancel} onCancel={() => setCancelOpen(false)}>
        <Alert type="info" showIcon style={{ marginBottom: 10 }} message="يُعكس القيد ويعود المبلغ رصيداً دائناً للعميل." />
        <Input.TextArea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإلغاء (إلزامي)" />
      </Modal>
    </Drawer>
  );
}

/** Customer refunds register (sales tab). */
export function RefundsList() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<number | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('year'), dayjs()]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/customer-refunds', { query: { pageSize: 0, tenantId, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [tenantId, range]);
  useEffect(() => { load(); }, [load]);
  const exportCsv = () => {
    const head = ['الرقم', 'التاريخ', 'العميل', 'المبلغ', 'الطريقة', 'المرجع', 'السبب', 'الحالة'];
    const csv = '﻿' + [head, ...rows.map(r => [r.refundNo, r.date, r.tenant, r.amount, r.methodLabel ?? r.method, r.reference ?? '', r.reason, r.status])]
      .map(x => x.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'customer-refunds.csv';
    a.click();
  };
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range as any} onChange={v => setRange(v as any)} />
        <CustomerSelect allowClear value={tenantId} onChange={v => setTenantId(v)} style={{ width: 220 }} />
        <Button icon={<ReloadOutlined />} onClick={load} />
        <Button icon={<FileExcelOutlined />} disabled={!rows.length} onClick={exportCsv}>Excel</Button>
        {can('payments.manage') && <Button type="primary" icon={<RollbackOutlined />} onClick={() => setNewOpen(true)}>استرداد للعميل</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="لا توجد استردادات" /> }}
        onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'الرقم', dataIndex: 'refundNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: PRIMARY }}>{v}</Text> },
          { title: 'التاريخ', dataIndex: 'date', width: 100 },
          { title: 'العميل', dataIndex: 'tenant' },
          { title: 'المبلغ', dataIndex: 'amount', align: 'end' as const, render: money },
          { title: 'الطريقة', dataIndex: 'methodLabel', render: (v, r: any) => v ?? methodLabel(r.method) },
          { title: 'المرجع', dataIndex: 'reference', render: v => v ?? '—' },
          { title: 'السبب', dataIndex: 'reason', ellipsis: true },
          { title: 'الحالة', dataIndex: 'status', render: s => <Tag color={CN_STATUS[s]?.color}>{CN_STATUS[s]?.label ?? s}</Tag> },
        ]} />
      <RefundDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />
      <RefundModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={id => { load(); setOpenId(id); }} />
    </>
  );
}
