import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Divider, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Steps, Switch, Table, Tabs,
  Tag, Tooltip, Typography, Upload, message,
} from 'antd';
import {
  BankOutlined, WalletOutlined, PlusOutlined, EditOutlined, SwapOutlined, ReloadOutlined, UploadOutlined, LinkOutlined, DisconnectOutlined,
  EyeInvisibleOutlined, EyeOutlined, CheckCircleOutlined, ThunderboltOutlined, FileAddOutlined, DeleteOutlined, StopOutlined, ProfileOutlined, LockOutlined,
  SettingOutlined, UnlockOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '../../api/client';
import { useReference } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { PRIMARY, DARK, GOLD } from './shared';

dayjs.extend(customParseFormat);
const { Text } = Typography;
const fmt = (n?: number | null) => `${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (n?: number | null) => `${fmt(n)} د.إ`;
const TYPE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  bank: { label: 'حساب بنكي', color: 'blue', icon: <BankOutlined /> },
  cash: { label: 'صندوق نقدي', color: 'green', icon: <WalletOutlined /> },
  petty_cash: { label: 'عهدة / مصروفات نثرية', color: 'gold', icon: <WalletOutlined /> },
};
const LINE_STATUS: Record<string, { color: string; label: string }> = {
  unmatched: { color: 'orange', label: 'غير مطابق' }, matched: { color: 'success', label: 'مطابق' }, ignored: { color: 'default', label: 'مستبعد' },
};
const SOURCE: Record<string, string> = {
  payment: 'سند قبض', vendor_payment: 'سند صرف مورد', voucher: 'سند', bank_transfer: 'تحويل', bank_opening: 'رصيد افتتاحي', bank_statement: 'من كشف البنك',
  invoice: 'فاتورة', vendor_bill: 'فاتورة مورد', manual: 'قيد يدوي',
};

interface BankAccountRow {
  id: number; branchId?: number; branch?: string; nameAr: string; nameEn?: string; name: string; accountType: string; bankName?: string; accountNo?: string; iban?: string; swiftCode?: string; showOnInvoice?: boolean;
  currencyId?: number; currency: string; glAccountId: number; glAccount: string; openingBalance: number; openingDate?: string; openingJournalId?: number;
  isActive: boolean; notes?: string; balance: number; lastMovement?: string; receiptMethods: string[]; paymentMethods: string[]; unmatchedLines: number; reconciledUntil?: string;
}
interface GlOption { id: number; accountCode: string; name: string; typeLabel?: string; linkedBank?: string }

function useGlAccounts(open = true) {
  const [list, setList] = useState<GlOption[]>([]);
  const load = useCallback(() => api<GlOption[]>('/banking/gl-accounts').then(setList).catch(() => setList([])), []);
  useEffect(() => { if (open) load(); }, [open, load]);
  const grouped = useMemo(() => {
    const m = new Map<string, GlOption[]>();
    list.forEach(a => { const k = a.typeLabel ?? 'أخرى'; m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()].map(([label, items]) => ({ label, options: items.map(a => ({ value: a.id, label: `${a.accountCode} — ${a.name}${a.linkedBank ? ` (${a.linkedBank})` : ''}` })) }));
  }, [list]);
  return { list, grouped, reload: load };
}

// ═══════════════════════════ account form ═══════════════════════════
function AccountModal({ open, row, onClose, onSaved }: { open: boolean; row: BankAccountRow | null; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { i18n } = useTranslation();
  const ref = useReference(i18n.language);
  const { grouped } = useGlAccounts(open);
  const type = Form.useWatch('accountType', form);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (row) form.setFieldsValue({ ...row, openingDate: row.openingDate ? dayjs(row.openingDate) : undefined });
    else form.setFieldsValue({ accountType: 'bank', isActive: true, openingBalance: 0 });
  }, [open, row]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body = { ...v, openingDate: v.openingDate?.format('YYYY-MM-DD') ?? null, branchId: v.branchId ?? null, currencyId: v.currencyId ?? null };
      if (row) await api(`/banking/accounts/${row.id}`, { method: 'PUT', body }); else await api('/banking/accounts', { method: 'POST', body });
      message.success('تم الحفظ');
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const postedOpening = !!row?.openingJournalId;
  return (
    <Modal open={open} width={720} title={row ? `تعديل ${row.nameAr}` : 'حساب بنك / صندوق جديد'} okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={onClose} destroyOnClose>
      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={8}><Form.Item name="accountType" label="النوع" rules={[{ required: true }]}>
            <Select options={Object.entries(TYPE).map(([k, t]) => ({ value: k, label: t.label }))} /></Form.Item></Col>
          <Col span={8}><Form.Item name="nameAr" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}><Input placeholder="مثال: بنك الإمارات دبي الوطني — جاري" /></Form.Item></Col>
          <Col span={8}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
          {type === 'bank' && (
            <>
              <Col span={8}><Form.Item name="bankName" label="البنك" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="accountNo" label="رقم الحساب"><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="iban" label="IBAN"><Input dir="ltr" placeholder="AE07 0331 2345 6789 0123 456" /></Form.Item></Col>
              <Col span={8}><Form.Item name="swiftCode" label="Swift Code"><Input dir="ltr" placeholder="MEBLAEAD" /></Form.Item></Col>
              <Col span={16}><Form.Item name="showOnInvoice" label="يظهر على فاتورة العميل (الدفع بالتحويل البنكي)" valuePropName="checked"><Switch /></Form.Item></Col>
            </>
          )}
          <Col span={12}><Form.Item name="glAccountId" label="حساب دليل الحسابات المرتبط" rules={[{ required: true, message: 'اختر الحساب' }]}
            extra="الرصيد يُحسب دائماً من القيود المرحّلة على هذا الحساب">
            <Select showSearch optionFilterProp="label" options={grouped} disabled={!!row && postedOpening} />
          </Form.Item></Col>
          <Col span={6}><Form.Item name="currencyId" label="العملة">
            <Select allowClear options={(ref.data?.currencies ?? []).map(c => ({ value: c.id, label: c.code }))} placeholder="AED" /></Form.Item></Col>
          <Col span={6}><Form.Item name="branchId" label="الفرع">
            <Select allowClear options={(ref.data?.branches ?? []).map(b => ({ value: b.id, label: b.nameAr ?? b.nameEn ?? b.code }))} placeholder="كل الفروع" /></Form.Item></Col>
          <Col span={8}><Form.Item name="openingBalance" label="الرصيد الافتتاحي" extra={postedOpening ? 'مرحّل — لا يمكن تعديله' : 'يُرحّل بقيد من بطاقة الحساب'}>
            <InputNumber style={{ width: '100%' }} disabled={postedOpening} /></Form.Item></Col>
          <Col span={8}><Form.Item name="openingDate" label="تاريخ الرصيد الافتتاحي"><DatePicker style={{ width: '100%' }} disabled={postedOpening} /></Form.Item></Col>
          <Col span={8}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}

// ═══════════════════════════ accounts tab ═══════════════════════════
function AccountsTab({ rows, loading, reload, canManage, onLedger, onReconcile }: {
  rows: BankAccountRow[]; loading: boolean; reload: () => void; canManage: boolean; onLedger: (a: BankAccountRow) => void; onReconcile: (a: BankAccountRow) => void;
}) {
  const [edit, setEdit] = useState<BankAccountRow | null | 'new'>(null);
  const [opening, setOpening] = useState<BankAccountRow | null>(null);
  const [equity, setEquity] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [maps, setMaps] = useState<any[]>([]);
  const [mapEdit, setMapEdit] = useState<any>(null);
  const [mapForm] = Form.useForm();
  const { grouped } = useGlAccounts(!!opening || !!mapEdit);
  const loadMaps = useCallback(() => api<any[]>('/banking/method-mappings').then(setMaps).catch(() => setMaps([])), []);
  useEffect(() => { loadMaps(); }, [loadMaps]);

  const total = rows.filter(r => r.isActive).reduce((s, r) => s + Number(r.balance), 0);
  const byType = (t: string) => rows.filter(r => r.isActive && r.accountType === t).reduce((s, r) => s + Number(r.balance), 0);

  const postOpening = async () => {
    if (!opening || !equity) { message.warning('اختر حساب الطرف الآخر (أرصدة افتتاحية)'); return; }
    setBusy(true);
    try {
      const r = await api<{ journalNo: string }>(`/banking/accounts/${opening.id}/opening-entry`, { method: 'POST', body: { equityAccountId: equity } });
      message.success(`تم ترحيل الرصيد الافتتاحي (${r.journalNo})`);
      setOpening(null); reload();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setBusy(false); }
  };
  const saveMap = async () => {
    const v = await mapForm.validateFields();
    try {
      await api('/banking/method-mappings', { method: 'PUT', body: { method: mapEdit.method, receiptAccountId: v.receiptAccountId ?? null, paymentAccountId: v.paymentAccountId ?? null } });
      message.success('تم تحديث ربط طريقة الدفع');
      setMapEdit(null); loadMaps(); reload();
    } catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async (r: BankAccountRow) => {
    try { await api(`/banking/accounts/${r.id}`, { method: 'DELETE' }); message.success('تم الحذف'); reload(); } catch (e) { message.error(errorMessage(e), 6); }
  };

  return (
    <div>
      <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
        {[
          { l: 'إجمالي النقدية والبنوك', v: total, c: PRIMARY },
          { l: 'البنوك', v: byType('bank'), c: '#1677ff' },
          { l: 'الصناديق النقدية', v: byType('cash'), c: '#389e0d' },
          { l: 'العهد والنثريات', v: byType('petty_cash'), c: '#d48806' },
        ].map(t => (
          <Col key={t.l} xs={12} md={6}><Card size="small" style={{ borderRadius: 12 }}><div style={{ fontSize: 18, fontWeight: 800, color: t.c }}>{money(t.v)}</div><div style={{ fontSize: 12, color: '#777' }}>{t.l}</div></Card></Col>
        ))}
      </Row>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>الأرصدة محسوبة من القيود المرحّلة في دفتر الأستاذ — لا تُعدّل يدوياً.</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={reload} />
          {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit('new')}>حساب جديد</Button>}
        </Space>
      </Space>
      {!loading && rows.length === 0 && <Empty description="لا توجد حسابات بنكية أو صناديق — أضف حساباً واربطه بحساب في دليل الحسابات" />}
      <Row gutter={[12, 12]}>
        {rows.map(r => {
          const t = TYPE[r.accountType] ?? TYPE.bank;
          return (
            <Col key={r.id} xs={24} md={12} xl={8}>
              <Card size="small" style={{ borderRadius: 12, opacity: r.isActive ? 1 : 0.55, borderTop: `3px solid ${r.accountType === 'bank' ? '#1677ff' : r.accountType === 'cash' ? '#389e0d' : GOLD}` }}
                title={<Space><span style={{ color: PRIMARY }}>{t.icon}</span><span>{r.nameAr}</span>{!r.isActive && <Tag>موقوف</Tag>}</Space>}
                extra={canManage && <Space size={0}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEdit(r)} />
                  <Popconfirm title="حذف الحساب؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(r)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                </Space>}>
                <div style={{ fontSize: 22, fontWeight: 800, color: Number(r.balance) < 0 ? '#cf1322' : DARK }}>{fmt(r.balance)} <span style={{ fontSize: 12, fontWeight: 400 }}>{r.currency}</span></div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  <Tag color={t.color}>{t.label}</Tag>{r.bankName && <span>{r.bankName} </span>}{r.accountNo && <span style={{ fontFamily: 'monospace' }}>{r.accountNo}</span>}
                  {r.iban && <div style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{r.iban}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: '#888' }}>الحساب: {r.glAccount}{r.branch ? ` · ${r.branch}` : ''}</div>
                <div style={{ fontSize: 11.5, color: '#888' }}>آخر حركة: {r.lastMovement ?? '—'} · مسوّى حتى: {r.reconciledUntil ?? 'لم يُسوَّ'}</div>
                <div style={{ marginTop: 6 }}>
                  {r.receiptMethods.map(m => <Tag key={`r${m}`} color="green" style={{ fontSize: 10 }}>قبض: {maps.find(x => x.method === m)?.label ?? m}</Tag>)}
                  {r.paymentMethods.map(m => <Tag key={`p${m}`} color="volcano" style={{ fontSize: 10 }}>صرف: {maps.find(x => x.method === m)?.label ?? m}</Tag>)}
                  {r.unmatchedLines > 0 && <Tag color="orange" style={{ fontSize: 10 }}>{r.unmatchedLines} سطر كشف غير مطابق</Tag>}
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <Space wrap size={4}>
                  <Button size="small" icon={<ProfileOutlined />} onClick={() => onLedger(r)}>كشف الحساب</Button>
                  {r.accountType === 'bank' && <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onReconcile(r)}>التسوية البنكية</Button>}
                  {canManage && !r.openingJournalId && Number(r.openingBalance) !== 0 && (
                    <Button size="small" type="dashed" onClick={() => { setEquity(undefined); setOpening(r); }}>ترحيل الرصيد الافتتاحي ({fmt(r.openingBalance)})</Button>)}
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card size="small" style={{ borderRadius: 12, marginTop: 16 }} title={<Space><SettingOutlined />ربط طرق الدفع بالحسابات</Space>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>تحدد أي حساب يُرحّل إليه سند القبض وسند الصرف لكل طريقة دفع</Text>}>
        <Table size="small" rowKey="method" pagination={false} dataSource={maps}
          columns={[
            { title: 'طريقة الدفع', dataIndex: 'label' },
            { title: 'سندات القبض تُرحّل إلى', key: 'r', render: (_, m) => m.receipt ? <span>{m.receipt.account}{m.receipt.bankAccount && <Tag color="blue" style={{ marginInlineStart: 6 }}>{m.receipt.bankAccount}</Tag>}</span> : <Tag color="error">غير مربوط</Tag> },
            { title: 'سندات الصرف تُرحّل من', key: 'p', render: (_, m) => m.payment ? <span>{m.payment.account}{m.payment.bankAccount && <Tag color="blue" style={{ marginInlineStart: 6 }}>{m.payment.bankAccount}</Tag>}</span> : <Tag color="error">غير مربوط</Tag> },
            ...(canManage ? [{ title: '', key: 'e', width: 60, render: (_: any, m: any) => <Button size="small" type="text" icon={<EditOutlined />}
              onClick={() => { mapForm.setFieldsValue({ receiptAccountId: m.receipt?.accountId, paymentAccountId: m.payment?.accountId }); setMapEdit(m); }} /> }] : []),
          ]} />
      </Card>

      <AccountModal open={edit !== null} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      <Modal open={!!opening} title={`ترحيل الرصيد الافتتاحي — ${opening?.nameAr ?? ''}`} okText="ترحيل" cancelText="إلغاء" onOk={postOpening} confirmLoading={busy} onCancel={() => setOpening(null)}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message={`سيُرحّل ${money(opening?.openingBalance)} بتاريخ ${opening?.openingDate ?? 'اليوم'}: ${Number(opening?.openingBalance) > 0 ? 'مدين الحساب البنكي / دائن الحساب المختار' : 'مدين الحساب المختار / دائن الحساب البنكي'}`} />
        <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="حساب الأرصدة الافتتاحية (حقوق ملكية)…" value={equity} onChange={setEquity} options={grouped} />
      </Modal>
      <Modal open={!!mapEdit} title={`ربط «${mapEdit?.label ?? ''}»`} okText="حفظ" cancelText="إلغاء" onOk={saveMap} onCancel={() => setMapEdit(null)} destroyOnClose>
        <Form form={mapForm} layout="vertical">
          <Form.Item name="receiptAccountId" label="عند القبض بهذه الطريقة يُرحّل المبلغ مديناً على"><Select allowClear showSearch optionFilterProp="label" options={grouped} /></Form.Item>
          <Form.Item name="paymentAccountId" label="عند الصرف بهذه الطريقة يُرحّل المبلغ دائناً على"><Select allowClear showSearch optionFilterProp="label" options={grouped} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ transfers tab ═══════════════════════════
function TransfersTab({ accounts, canManage, onChanged }: { accounts: BankAccountRow[]; canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month'), dayjs()]);
  const [accountId, setAccountId] = useState<number | undefined>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { grouped } = useGlAccounts(open);
  const fees = Form.useWatch('fees', form);
  const load = useCallback(() => {
    setLoading(true);
    api<any[]>('/banking/transfers', { query: { accountId, from: range?.[0]?.format('YYYY-MM-DD'), to: range?.[1]?.format('YYYY-MM-DD') } })
      .then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [accountId, range]);
  useEffect(() => { load(); }, [load]);
  const active = accounts.filter(a => a.isActive);
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<{ transferNo: string; warning?: string }>('/banking/transfers', { method: 'POST', body: {
        date: v.date.format('YYYY-MM-DD'), fromAccountId: v.fromAccountId, toAccountId: v.toAccountId, amount: v.amount, fees: v.fees ?? 0,
        feesAccountId: v.feesAccountId ?? null, reference: v.reference || null, notes: v.notes || null } });
      message.success(`تم التحويل ${r.transferNo}`);
      if (r.warning) message.warning('رصيد الحساب المحوَّل منه أقل من المبلغ — تحقق من الرصيد', 6);
      setOpen(false); load(); onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const cancel = (t: any) => {
    let reason = '';
    Modal.confirm({
      title: `إلغاء التحويل ${t.transferNo}؟`, okText: 'إلغاء التحويل', okButtonProps: { danger: true }, cancelText: 'رجوع',
      content: <Input.TextArea rows={2} placeholder="السبب (مطلوب) — سيُعكس القيد" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => {
        if (!reason.trim()) { message.warning('اكتب السبب'); throw new Error('reason'); }
        try { await api(`/banking/transfers/${t.id}/cancel`, { method: 'POST', body: { reason } }); message.success('تم الإلغاء وعكس القيد'); load(); onChanged(); }
        catch (e) { message.error(errorMessage(e), 6); throw e; }
      },
    });
  };
  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <DatePicker.RangePicker value={range as any} onChange={r => setRange(r as any)} />
          <Select allowClear placeholder="الحساب" style={{ width: 220 }} value={accountId} onChange={setAccountId} options={accounts.map(a => ({ value: a.id, label: a.nameAr }))} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        {canManage && <Button type="primary" icon={<SwapOutlined />} disabled={active.length < 2}
          onClick={() => { form.resetFields(); form.setFieldsValue({ date: dayjs(), fees: 0 }); setOpen(true); }}>تحويل بين الحسابات</Button>}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 900 }} pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="لا توجد تحويلات في هذه الفترة" /> }}
        columns={[
          { title: 'الرقم', dataIndex: 'transferNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
          { title: 'التاريخ', dataIndex: 'transferDate', width: 100 },
          { title: 'من', dataIndex: 'from' }, { title: 'إلى', dataIndex: 'to' },
          { title: 'المبلغ', dataIndex: 'amount', render: v => <Text strong>{money(v)}</Text> },
          { title: 'الرسوم', dataIndex: 'fees', render: v => (Number(v) ? money(v) : '—') },
          { title: 'المرجع', dataIndex: 'referenceNo', render: v => v ?? '—' },
          { title: 'القيد', dataIndex: 'journalNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v ?? '—'}</Text> },
          { title: 'الحالة', dataIndex: 'status', render: (s, t) => s === 'cancelled' ? <Tooltip title={t.cancelReason}><Tag>ملغى</Tag></Tooltip> : <Tag color="success">مرحّل</Tag> },
          { title: '', key: 'a', width: 50, render: (_, t) => canManage && t.status !== 'cancelled' && <Button size="small" type="text" danger icon={<StopOutlined />} onClick={() => cancel(t)} /> },
        ]} />
      <Modal open={open} width={640} title="تحويل بين الحسابات" okText="ترحيل التحويل" cancelText="إلغاء" onOk={save} confirmLoading={saving} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="fromAccountId" label="من حساب" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select options={active.map(a => ({ value: a.id, label: `${a.nameAr} — ${fmt(a.balance)}` }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="toAccountId" label="إلى حساب" rules={[{ required: true, message: 'مطلوب' },
              ({ getFieldValue }) => ({ validator: (_, v) => (v && v === getFieldValue('fromAccountId') ? Promise.reject(new Error('اختر حساباً مختلفاً')) : Promise.resolve()) })]}>
              <Select options={active.map(a => ({ value: a.id, label: a.nameAr }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="amount" label="المبلغ" rules={[{ required: true, message: 'مطلوب' }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="date" label="التاريخ" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item></Col>
            <Col span={8}><Form.Item name="reference" label="المرجع"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="fees" label="رسوم بنكية (من الحساب المحوَّل منه)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            {Number(fees) > 0 && <Col span={16}><Form.Item name="feesAccountId" label="حساب مصروف الرسوم" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select showSearch optionFilterProp="label" options={grouped} /></Form.Item></Col>}
            <Col span={24}><Form.Item name="notes" label="البيان"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ statement import wizard ═══════════════════════════
type Mapping = { date?: number; description?: number; reference?: number; amount?: number; debit?: number; credit?: number; balance?: number };
const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'MM/DD/YYYY', 'DD/MM/YY', 'DD-MMM-YYYY', 'DD MMM YYYY', 'YYYY/MM/DD'];

function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] ?? '';
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}
const num = (s?: string) => {
  if (s == null) return undefined;
  let t = s.replace(/[^\d.,()\-+]/g, '');
  if (!t) return undefined;
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[()+-]/g, '');
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : undefined;
};
const parseDate = (s?: string) => { if (!s) return undefined; const d = dayjs(s.trim(), DATE_FORMATS, true); return d.isValid() ? d : undefined; };

function ImportWizard({ account, open, onClose, onDone }: { account: BankAccountRow; open: boolean; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<string[][]>([]);
  const [header, setHeader] = useState(true);
  const [mode, setMode] = useState<'signed' | 'split'>('split');
  const [map, setMap] = useState<Mapping>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setStep(0); setRows([]); setMap({}); } }, [open]);
  const cols = rows[0]?.length ?? 0;
  const colOptions = Array.from({ length: cols }, (_, i) => ({ value: i, label: header ? `${i + 1}. ${rows[0][i] || '—'}` : `عمود ${i + 1}` }));
  const body = header ? rows.slice(1) : rows;

  const guess = (r: string[][]) => {
    const h = (r[0] ?? []).map(x => x.toLowerCase());
    const find = (...k: string[]) => { const i = h.findIndex(x => k.some(w => x.includes(w))); return i >= 0 ? i : undefined; };
    const m: Mapping = {
      date: find('date', 'تاريخ'), description: find('desc', 'narr', 'detail', 'بيان', 'وصف', 'تفاصيل'), reference: find('ref', 'cheque', 'chq', 'مرجع'),
      debit: find('debit', 'withdraw', 'مدين', 'سحب'), credit: find('credit', 'deposit', 'دائن', 'إيداع', 'ايداع'), balance: find('balance', 'رصيد'), amount: find('amount', 'مبلغ'),
    };
    setMode(m.debit != null || m.credit != null ? 'split' : 'signed');
    setMap(m);
  };
  const preview = useMemo(() => body.map(r => {
    const date = parseDate(map.date != null ? r[map.date] : undefined);
    const amount = mode === 'signed'
      ? num(map.amount != null ? r[map.amount] : undefined)
      : (num(map.credit != null ? r[map.credit] : undefined) ?? 0) - Math.abs(num(map.debit != null ? r[map.debit] : undefined) ?? 0);
    return { date, description: map.description != null ? r[map.description] : undefined, reference: map.reference != null ? r[map.reference] : undefined,
      amount, balance: map.balance != null ? num(r[map.balance]) : undefined, ok: !!date && amount != null && amount !== 0 };
  }), [body, map, mode]);
  const okRows = preview.filter(p => p.ok);

  const doImport = async () => {
    setSaving(true);
    try {
      const r = await api<any>(`/banking/accounts/${account.id}/statement/import`, { method: 'POST', body: {
        lines: okRows.map(p => ({ date: p.date!.format('YYYY-MM-DD'), description: p.description ?? null, reference: p.reference ?? null, amount: p.amount, balance: p.balance ?? null })) } });
      message.success(`تم استيراد ${r.added} سطر${r.duplicates ? ` — ${r.duplicates} مكرر تم تجاهله` : ''}${r.skippedLocked ? ` — ${r.skippedLocked} في فترة مقفلة` : ''}`, 6);
      onDone();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} width={980} title={`استيراد كشف البنك — ${account.nameAr}`} onCancel={onClose} destroyOnClose
      footer={<Space>
        {step > 0 && <Button onClick={() => setStep(s => s - 1)}>السابق</Button>}
        {step === 1 && <Button type="primary" disabled={map.date == null || (mode === 'signed' ? map.amount == null : map.debit == null && map.credit == null)} onClick={() => setStep(2)}>معاينة</Button>}
        {step === 2 && <Button type="primary" loading={saving} disabled={!okRows.length} onClick={doImport}>استيراد {okRows.length} سطر</Button>}
      </Space>}>
      <Steps size="small" current={step} style={{ marginBottom: 16 }} items={[{ title: 'رفع الملف' }, { title: 'ربط الأعمدة' }, { title: 'المعاينة والاستيراد' }]} />
      {step === 0 && (
        <Upload.Dragger accept=".csv,.txt" showUploadList={false} beforeUpload={file => {
          file.text().then(t => { const r = parseCsv(t.replace(/^﻿/, '')); if (!r.length) { message.error('الملف فارغ'); return; } setRows(r); guess(r); setStep(1); });
          return false;
        }}>
          <p style={{ fontSize: 32, color: PRIMARY, margin: 0 }}><UploadOutlined /></p>
          <p>اسحب ملف CSV لكشف الحساب هنا أو اضغط للاختيار</p>
          <p style={{ fontSize: 12, color: '#888' }}>صدّر الكشف من بوابة البنك بصيغة CSV (Excel ← حفظ باسم ← CSV UTF-8)</p>
        </Upload.Dragger>
      )}
      {step === 1 && (
        <div>
          <Space wrap style={{ marginBottom: 12 }}>
            <Space size={4}><Switch size="small" checked={header} onChange={setHeader} /><Text>السطر الأول عناوين</Text></Space>
            <Select value={mode} onChange={setMode} style={{ width: 260 }} options={[
              { value: 'split', label: 'عمودان: مسحوبات (مدين) وإيداعات (دائن)' }, { value: 'signed', label: 'عمود مبلغ واحد (السالب = سحب)' }]} />
          </Space>
          <Row gutter={12}>
            {([['date', 'التاريخ *'], ['description', 'البيان'], ['reference', 'المرجع'],
              ...(mode === 'signed' ? [['amount', 'المبلغ *']] : [['debit', 'المسحوبات (مدين)'], ['credit', 'الإيداعات (دائن)']]), ['balance', 'الرصيد']] as [keyof Mapping, string][]).map(([k, l]) => (
              <Col key={k} span={8} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, marginBottom: 2 }}>{l}</div>
                <Select allowClear style={{ width: '100%' }} value={map[k]} onChange={v => setMap(m => ({ ...m, [k]: v }))} options={colOptions} />
              </Col>
            ))}
          </Row>
          <Table size="small" pagination={false} scroll={{ x: true }} dataSource={rows.slice(0, 6).map((r, i) => ({ key: i, r }))}
            columns={Array.from({ length: cols }, (_, i) => ({ title: `${i + 1}`, key: i, render: (_: any, x: any) => <span style={{ fontSize: 11 }}>{x.r[i]}</span> }))} />
        </div>
      )}
      {step === 2 && (
        <div>
          <Alert style={{ marginBottom: 8 }} type={okRows.length === preview.length ? 'success' : 'warning'} showIcon
            message={`${okRows.length} سطر صالح من ${preview.length}${okRows.length < preview.length ? ' — الأسطر بدون تاريخ صحيح أو مبلغ تُستبعد' : ''}`}
            description={`الإيداعات ${money(okRows.filter(p => p.amount! > 0).reduce((s, p) => s + p.amount!, 0))} · المسحوبات ${money(okRows.filter(p => p.amount! < 0).reduce((s, p) => s + p.amount!, 0))}`} />
          <Table size="small" rowKey={(_, i) => String(i)} pagination={{ pageSize: 10 }} dataSource={preview}
            onRow={p => ({ style: { opacity: p.ok ? 1 : 0.4 } })}
            columns={[
              { title: 'التاريخ', render: (_, p) => p.date?.format('YYYY-MM-DD') ?? <Tag color="error">غير صالح</Tag> },
              { title: 'البيان', dataIndex: 'description' }, { title: 'المرجع', dataIndex: 'reference' },
              { title: 'المبلغ', dataIndex: 'amount', render: v => v == null ? '—' : <span style={{ color: v < 0 ? '#cf1322' : '#389e0d' }}>{fmt(v)}</span> },
              { title: 'الرصيد', dataIndex: 'balance', render: v => (v == null ? '' : fmt(v)) },
            ]} />
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════ reconciliation ═══════════════════════════
function ReconcileTab({ accounts, initial, canManage, onChanged }: { accounts: BankAccountRow[]; initial?: number; canManage: boolean; onChanged: () => void }) {
  const banks = accounts.filter(a => a.isActive);
  const [accountId, setAccountId] = useState<number | undefined>(initial ?? banks.find(a => a.accountType === 'bank')?.id);
  const account = accounts.find(a => a.id === accountId);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')]);
  const [lines, setLines] = useState<any[]>([]);
  const [book, setBook] = useState<any[]>([]);
  const [sugg, setSugg] = useState<Record<number, any[]>>({});
  const [summary, setSummary] = useState<any>(null);
  const [stmtBal, setStmtBal] = useState<number | null>(null);
  const [selLine, setSelLine] = useState<number | null>(null);
  const [selBook, setSelBook] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [entryFor, setEntryFor] = useState<any>(null);
  const [entryForm] = Form.useForm();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { grouped } = useGlAccounts(!!entryFor);
  useEffect(() => { if (initial) setAccountId(initial); }, [initial]);

  const q = { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') };
  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [l, b, s, h] = await Promise.all([
        api<any[]>(`/banking/accounts/${accountId}/statement-lines`, { query: q }),
        api<any[]>(`/banking/accounts/${accountId}/book-lines`, { query: q }),
        api<any[]>(`/banking/accounts/${accountId}/suggestions`, { query: q }),
        api<any[]>(`/banking/accounts/${accountId}/reconciliations`),
      ]);
      setLines(l); setBook(b); setHistory(h);
      setSugg(Object.fromEntries(s.map((x: any) => [x.statementLineId, x.candidates])));
      setSelLine(null); setSelBook(null);
    } catch (e) { message.error(errorMessage(e)); } finally { setLoading(false); }
  }, [accountId, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadSummary = useCallback(() => {
    if (!accountId) return;
    api<any>(`/banking/accounts/${accountId}/reconciliation-summary`, { query: { ...q, statementBalance: stmtBal ?? undefined } }).then(setSummary).catch(() => setSummary(null));
  }, [accountId, range, stmtBal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary, lines]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) message.success(ok); await load(); onChanged(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const match = (lineId: number, journalLineId: number) => act(() => api(`/banking/statement-lines/${lineId}/match`, { method: 'POST', body: { journalLineId } }), 'تمت المطابقة');
  const autoMatch = () => act(async () => {
    const r = await api<any>(`/banking/accounts/${accountId}/auto-match`, { method: 'POST', body: q });
    message.success(`تمت مطابقة ${r.matched} سطر تلقائياً — المتبقي ${r.remaining}`);
  });
  const createEntry = async () => {
    const v = await entryForm.validateFields();
    await act(() => api(`/banking/statement-lines/${entryFor.id}/create-entry`, { method: 'POST', body: { accountId: v.accountId, description: v.description || null } }), 'تم ترحيل القيد ومطابقته');
    setEntryFor(null);
  };
  const complete = () => {
    if (summary?.statementBalance == null) { message.warning('أدخل رصيد الكشف في نهاية الفترة'); return; }
    Modal.confirm({
      title: 'إتمام التسوية البنكية؟', okText: 'إتمام وقفل', cancelText: 'رجوع',
      content: `سيتم قفل الأسطر المطابقة حتى ${q.to}. رصيد الكشف ${money(summary.statementBalance)} = رصيد الدفاتر المعدل.`,
      onOk: () => act(() => api(`/banking/accounts/${accountId}/reconciliations`, { method: 'POST', body: { periodFrom: q.from, periodTo: q.to, statementBalance: summary.statementBalance } }), 'تمت التسوية وقفل الفترة'),
    });
  };
  const reopen = (r: any) => {
    let reason = '';
    Modal.confirm({
      title: 'إعادة فتح التسوية؟', okText: 'إعادة فتح', cancelText: 'رجوع',
      content: <Input.TextArea rows={2} placeholder="السبب" onChange={e => { reason = e.target.value; }} />,
      onOk: () => act(() => api(`/banking/reconciliations/${r.id}/reopen`, { method: 'POST', body: { reason } }), 'أعيد فتح التسوية'),
    });
  };

  const shownLines = showAll ? lines : lines.filter(l => l.status === 'unmatched');
  const matchedIds = new Set(lines.filter(l => l.journalLineId).map(l => l.journalLineId));
  const shownBook = showAll ? book : book.filter(b => !b.statementLineId && !matchedIds.has(b.id));
  const selected = lines.find(l => l.id === selLine);
  const candidates = selLine ? new Set((sugg[selLine] ?? []).map((c: any) => c.journalLineId)) : new Set<number>();
  const diff = summary?.difference;

  if (!banks.length) return <Empty description="أضف حساباً بنكياً أولاً" />;
  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select style={{ width: 240 }} value={accountId} onChange={setAccountId} options={banks.map(a => ({ value: a.id, label: `${a.nameAr}${a.reconciledUntil ? ` (مسوّى حتى ${a.reconciledUntil})` : ''}` }))} />
        <DatePicker.RangePicker value={range} allowClear={false} onChange={r => r && setRange(r as [Dayjs, Dayjs])} />
        <Button icon={<ReloadOutlined />} onClick={load} />
        {canManage && account && <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>استيراد كشف البنك</Button>}
        {canManage && <Button icon={<ThunderboltOutlined />} onClick={autoMatch} disabled={!lines.some(l => l.status === 'unmatched')}>مطابقة تلقائية</Button>}
        <Space size={4}><Switch size="small" checked={showAll} onChange={setShowAll} /><Text style={{ fontSize: 12 }}>إظهار المطابق والمستبعد</Text></Space>
      </Space>

      {summary && (
        <Card size="small" style={{ borderRadius: 12, marginBottom: 12, borderColor: diff === 0 ? '#b7eb8f' : '#ffccc7', background: diff === 0 ? '#f6ffed' : '#fff' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={12} md={4}><div style={{ fontSize: 11, color: '#888' }}>رصيد الدفاتر في {q.to}</div><b>{money(summary.bookBalance)}</b></Col>
            <Col xs={12} md={4}><div style={{ fontSize: 11, color: '#888' }}>− قيود لم تظهر في الكشف</div><b>{money(summary.outstandingBook)}</b></Col>
            <Col xs={12} md={4}><div style={{ fontSize: 11, color: '#888' }}>+ حركات بنكية غير مسجلة</div><b>{money(summary.unrecordedBank)}</b></Col>
            <Col xs={12} md={4}><div style={{ fontSize: 11, color: '#888' }}>= الرصيد المتوقع في الكشف</div><b style={{ color: PRIMARY }}>{money(summary.expectedStatementBalance)}</b></Col>
            <Col xs={12} md={4}>
              <div style={{ fontSize: 11, color: '#888' }}>رصيد كشف البنك {summary.statementBalanceSource === 'statement' ? '(من الكشف)' : ''}</div>
              <InputNumber size="small" style={{ width: '100%' }} value={stmtBal ?? summary.statementBalance ?? undefined} onChange={v => setStmtBal(v as number | null)} placeholder="أدخل الرصيد" />
            </Col>
            <Col xs={12} md={4} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>الفرق</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: diff === 0 ? '#389e0d' : '#cf1322' }}>{diff == null ? '—' : fmt(diff)}</div>
              {canManage && <Button size="small" type="primary" icon={<LockOutlined />} disabled={diff !== 0} onClick={complete}>إتمام التسوية</Button>}
            </Col>
          </Row>
          {summary.lockedUntil && <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}><LockOutlined /> الفترات حتى {summary.lockedUntil} مقفلة</div>}
        </Card>
      )}

      <Row gutter={12}>
        <Col xs={24} xl={12}>
          <Card size="small" style={{ borderRadius: 12 }} title={<Space><BankOutlined />كشف البنك <Tag>{shownLines.length}</Tag></Space>}
            extra={selected && <Text type="secondary" style={{ fontSize: 12 }}>محدد: {fmt(selected.amount)} — اختر القيد المقابل</Text>}>
            <Table size="small" rowKey="id" loading={loading} dataSource={shownLines} pagination={{ pageSize: 15, size: 'small' }} scroll={{ x: 560 }}
              locale={{ emptyText: <Empty description={lines.length ? 'كل الأسطر مطابقة' : 'لا توجد أسطر — استورد كشف البنك'} /> }}
              rowSelection={{ type: 'radio', selectedRowKeys: selLine ? [selLine] : [], onChange: k => { setSelLine(Number(k[0])); setSelBook(null); },
                getCheckboxProps: l => ({ disabled: l.status !== 'unmatched' }) }}
              columns={[
                { title: 'التاريخ', dataIndex: 'date', width: 92 },
                { title: 'البيان', key: 'd', render: (_, l) => <div style={{ fontSize: 12 }}>{l.description}{l.reference && <div style={{ color: '#888', fontSize: 11 }}>{l.reference}</div>}
                  {l.journalNo && <div style={{ fontSize: 11, color: '#389e0d' }}><LinkOutlined /> {l.journalNo} · {l.journalText}</div>}</div> },
                { title: 'المبلغ', dataIndex: 'amount', width: 110, render: v => <Text strong style={{ color: v < 0 ? '#cf1322' : '#389e0d' }}>{fmt(v)}</Text> },
                { title: '', key: 's', width: 150, render: (_, l) => (
                  <Space size={0} wrap>
                    {l.locked ? <Tag icon={<LockOutlined />}>مقفل</Tag> : <Tag color={LINE_STATUS[l.status]?.color}>{LINE_STATUS[l.status]?.label}</Tag>}
                    {!l.locked && canManage && l.status === 'unmatched' && (sugg[l.id]?.length ?? 0) > 0 &&
                      <Tooltip title={`اقتراح: ${sugg[l.id][0].journalNo} — ${sugg[l.id][0].reason}`}><Button size="small" type="link" onClick={() => match(l.id, sugg[l.id][0].journalLineId)}>مطابقة مقترحة</Button></Tooltip>}
                    {!l.locked && canManage && l.status === 'matched' && <Tooltip title="فك المطابقة"><Button size="small" type="text" icon={<DisconnectOutlined />} onClick={() => act(() => api(`/banking/statement-lines/${l.id}/unmatch`, { method: 'POST' }))} /></Tooltip>}
                    {!l.locked && canManage && l.status === 'unmatched' && <Tooltip title="تسجيل قيد (رسوم / فوائد / خصم مباشر)"><Button size="small" type="text" icon={<FileAddOutlined />}
                      onClick={() => { entryForm.resetFields(); entryForm.setFieldsValue({ description: l.description }); setEntryFor(l); }} /></Tooltip>}
                    {!l.locked && canManage && l.status === 'unmatched' && <Tooltip title="استبعاد"><Button size="small" type="text" icon={<EyeInvisibleOutlined />} onClick={() => act(() => api(`/banking/statement-lines/${l.id}/ignore`, { method: 'POST' }))} /></Tooltip>}
                    {!l.locked && canManage && l.status === 'ignored' && <Tooltip title="إرجاع"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => act(() => api(`/banking/statement-lines/${l.id}/unignore`, { method: 'POST' }))} /></Tooltip>}
                    {!l.locked && canManage && l.status !== 'matched' && <Popconfirm title="حذف السطر؟" okText="حذف" cancelText="إلغاء" onConfirm={() => act(() => api(`/banking/statement-lines/${l.id}`, { method: 'DELETE' }))}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
                  </Space>) },
              ]} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card size="small" style={{ borderRadius: 12 }} title={<Space><ProfileOutlined />قيود الدفاتر <Tag>{shownBook.length}</Tag></Space>}
            extra={canManage && selLine && selBook && <Button size="small" type="primary" icon={<LinkOutlined />} onClick={() => match(selLine, selBook)}>مطابقة المحدد</Button>}>
            <Table size="small" rowKey="id" loading={loading} dataSource={shownBook} pagination={{ pageSize: 15, size: 'small' }} scroll={{ x: 560 }}
              locale={{ emptyText: <Empty description="لا توجد قيود غير مطابقة" /> }}
              rowSelection={{ type: 'radio', selectedRowKeys: selBook ? [selBook] : [], onChange: k => setSelBook(Number(k[0])),
                getCheckboxProps: b => ({ disabled: !!b.statementLineId || matchedIds.has(b.id) || !selLine }) }}
              onRow={b => ({ style: { background: candidates.has(b.id) ? '#f6ffed' : selected && Number(b.amount) === Number(selected.amount) ? '#fffbe6' : undefined } })}
              columns={[
                { title: 'التاريخ', dataIndex: 'date', width: 92 },
                { title: 'القيد', key: 'j', render: (_, b) => <div style={{ fontSize: 12 }}><Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.journalNo}</Text> <Tag style={{ fontSize: 10 }}>{SOURCE[b.sourceType] ?? b.sourceType ?? 'قيد'}</Tag>
                  <div style={{ color: '#666' }}>{b.description}</div></div> },
                { title: 'المبلغ', dataIndex: 'amount', width: 110, render: v => <Text strong style={{ color: v < 0 ? '#cf1322' : '#389e0d' }}>{fmt(v)}</Text> },
                { title: '', key: 's', width: 70, render: (_, b) => (b.statementLineId || matchedIds.has(b.id) ? <Tag color="success">مطابق</Tag> : candidates.has(b.id) ? <Tag color="green">مقترح</Tag> : null) },
              ]} />
          </Card>
        </Col>
      </Row>

      {history.length > 0 && (
        <Card size="small" style={{ borderRadius: 12, marginTop: 12 }} title="التسويات السابقة">
          <Table size="small" rowKey="id" pagination={false} dataSource={history}
            columns={[
              { title: 'الفترة', key: 'p', render: (_, r) => `${r.periodFrom} → ${r.periodTo}` },
              { title: 'رصيد الكشف', dataIndex: 'statementBalance', render: v => money(v) },
              { title: 'رصيد الدفاتر', dataIndex: 'bookBalance', render: v => money(v) },
              { title: 'معلقات الدفاتر', dataIndex: 'outstandingBook', render: v => money(v) },
              { title: 'حركات بنكية غير مسجلة', dataIndex: 'unrecordedBank', render: v => money(v) },
              { title: 'بواسطة', key: 'b', render: (_, r) => <span style={{ fontSize: 12 }}>{r.completedBy ?? '—'} · {dayjs(r.completedAt).format('YYYY-MM-DD HH:mm')}</span> },
              { title: 'الحالة', dataIndex: 'status', render: s => (s === 'completed' ? <Tag color="success" icon={<LockOutlined />}>مكتملة</Tag> : <Tag>أعيد فتحها</Tag>) },
              { title: '', key: 'a', render: (_, r) => canManage && r.status === 'completed' && r === history.find(h => h.status === 'completed') &&
                <Button size="small" type="link" icon={<UnlockOutlined />} onClick={() => reopen(r)}>إعادة فتح</Button> },
            ]} />
        </Card>
      )}

      {account && <ImportWizard account={account} open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); onChanged(); }} />}
      <Modal open={!!entryFor} title="تسجيل قيد من كشف البنك" okText="ترحيل ومطابقة" cancelText="إلغاء" onOk={createEntry} onCancel={() => setEntryFor(null)} destroyOnClose>
        {entryFor && <Alert style={{ marginBottom: 12 }} type="info" showIcon
          message={`${entryFor.date} — ${fmt(entryFor.amount)} ${entryFor.amount < 0 ? '(سحب: مدين الحساب المختار / دائن البنك)' : '(إيداع: مدين البنك / دائن الحساب المختار)'}`} />}
        <Form form={entryForm} layout="vertical">
          <Form.Item name="accountId" label={entryFor?.amount < 0 ? 'حساب المصروف (رسوم بنكية…)' : 'حساب الإيراد (فوائد…)'} rules={[{ required: true, message: 'اختر الحساب' }]}>
            <Select showSearch optionFilterProp="label" options={grouped} /></Form.Item>
          <Form.Item name="description" label="البيان"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ ledger drawer ═══════════════════════════
function LedgerDrawer({ account, onClose }: { account: BankAccountRow | null; onClose: () => void }) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!account) return;
    setData(null);
    api<any>(`/accounting/ledger/${account.glAccountId}`, { query: { from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') } })
      .then(setData).catch(e => message.error(errorMessage(e)));
  }, [account, range]);
  return (
    <Drawer open={!!account} onClose={onClose} width={Math.min(window.innerWidth - 24, 960)} title={account ? `حركة ${account.nameAr}` : ''}
      extra={<DatePicker.RangePicker value={range} allowClear={false} onChange={r => r && setRange(r as [Dayjs, Dayjs])} />}>
      {data && (
        <>
          <Space style={{ marginBottom: 10 }} wrap>
            <Tag>الافتتاحي: {money(data.opening)}</Tag><Tag color="green">الختامي: {money(data.closing)}</Tag><Text type="secondary">{data.account?.accountCode} {data.account?.name}</Text>
          </Space>
          <Table size="small" rowKey="id" dataSource={data.lines} pagination={{ pageSize: 25 }} scroll={{ x: 760 }}
            columns={[
              { title: 'التاريخ', dataIndex: 'entryDate', width: 100 },
              { title: 'القيد', dataIndex: 'journalNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
              { title: 'المصدر', dataIndex: 'sourceType', render: s => <Tag style={{ fontSize: 10 }}>{SOURCE[s] ?? s ?? 'قيد'}</Tag> },
              { title: 'البيان', dataIndex: 'description' },
              { title: 'مدين (إيداع)', dataIndex: 'debit', render: v => (Number(v) ? fmt(v) : '') },
              { title: 'دائن (سحب)', dataIndex: 'credit', render: v => (Number(v) ? fmt(v) : '') },
              { title: 'الرصيد', dataIndex: 'balance', render: v => <b>{fmt(v)}</b> },
            ]} />
        </>
      )}
    </Drawer>
  );
}

// ═══════════════════════════ page ═══════════════════════════
export default function Banking() {
  const { can } = useAuth();
  const canManage = can('accounting.manage');
  const [rows, setRows] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('accounts');
  const [ledger, setLedger] = useState<BankAccountRow | null>(null);
  const [recFor, setRecFor] = useState<number | undefined>();
  const load = useCallback(() => {
    setLoading(true);
    api<BankAccountRow[]>('/banking/accounts').then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!can('accounting.view')) return <Alert type="warning" showIcon message="لا تملك صلاحية عرض الحسابات البنكية (المحاسبة — عرض)" />;
  return (
    <div>
      <Tabs activeKey={tab} onChange={setTab} size="small" items={[
        { key: 'accounts', label: <span><BankOutlined /> الحسابات والأرصدة</span>,
          children: <AccountsTab rows={rows} loading={loading} reload={load} canManage={canManage} onLedger={setLedger} onReconcile={a => { setRecFor(a.id); setTab('reconcile'); }} /> },
        { key: 'transfers', label: <span><SwapOutlined /> التحويلات</span>, children: <TransfersTab accounts={rows} canManage={canManage} onChanged={load} /> },
        { key: 'reconcile', label: <span><CheckCircleOutlined /> التسوية البنكية</span>, children: <ReconcileTab accounts={rows} initial={recFor} canManage={canManage} onChanged={load} /> },
      ]} />
      <LedgerDrawer account={ledger} onClose={() => setLedger(null)} />
    </div>
  );
}
