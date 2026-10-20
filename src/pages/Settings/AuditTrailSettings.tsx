import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Table, Tag, Select, DatePicker, Input, Space, Button, Typography, Tooltip, message, Empty } from 'antd';
import { ReloadOutlined, FilterOutlined, LoginOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, BranchesOutlined, CloseCircleOutlined, EyeOutlined, PrinterOutlined, DownloadOutlined, LogoutOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { HistoryButton } from '../../components/history/RecordHistory';
import { entityLabel } from '../../components/history/labels';

const { Text } = Typography;

/** Arabic names of the tables (anything not listed shows its table name). */
export const TABLE_LABELS: Record<string, string> = {
  building: 'مبنى', unit: 'وحدة', building_owner: 'مالك مبنى', party: 'طرف / مالك', party_contact: 'اتصال طرف', tenant: 'مستأجر / عميل',
  supply_contract: 'عقد توريد', contract_fee: 'رسوم عقد', contract_term: 'شروط وأحكام', meter: 'عداد', meter_assignment: 'تركيب عداد',
  meter_reading: 'قراءة عداد', meter_service: 'خدمة عداد', meter_topup: 'شحن عداد', tank: 'خزان', tank_level_history: 'قراءة مستوى خزان',
  tank_refill: 'تعبئة خزان', refill_request: 'طلب تعبئة', refill_po: 'أمر شراء غاز', refill_collection: 'استلام غاز', refill_schedule: 'جدولة توصيل',
  refill_supplier_payment: 'دفع مورد (تعبئة)', refill_purchase_invoice: 'فاتورة شراء (تعبئة)', refill_stage_history: 'مراحل طلب تعبئة',
  amc_contract: 'عقد صيانة AMC', amc_payment_schedule: 'قسط عقد صيانة', amc_scope_item: 'نطاق عقد صيانة', amc_term: 'شرط عقد صيانة',
  maintenance_visit: 'زيارة صيانة', visit_checklist_item: 'بند فحص زيارة', visit_finding: 'ملاحظة زيارة', service_request: 'طلب خدمة',
  cd_certificate: 'شهادة دفاع مدني', cd_renewal: 'تجديد دفاع مدني', invoice: 'فاتورة', invoice_item: 'بند فاتورة', payment: 'دفعة / سند قبض',
  payment_allocation: 'تخصيص دفعة', vendor: 'مورد', vendor_contact: 'اتصال مورد', vendor_bill: 'فاتورة مورد', vendor_bill_item: 'بند فاتورة مورد',
  vendor_payment: 'دفعة لمورد', vendor_payment_allocation: 'تخصيص دفعة مورد', driver: 'سائق', vehicle: 'مركبة', journal_entry: 'قيد يومية',
  journal_line: 'سطر قيد', account: 'حساب', account_mapping: 'ربط حساب', fiscal_period: 'فترة مالية', document: 'مستند / مرفق',
  app_user: 'مستخدم', user_role: 'دور مستخدم', user_branch: 'فرع مستخدم', role: 'دور', role_permission: 'صلاحية دور', permission: 'صلاحية',
  lookup_type: 'نوع قائمة', lookup_value: 'قيمة قائمة', branch: 'فرع', company: 'الشركة', city: 'مدينة', gas_type: 'نوع غاز', currency: 'عملة',
  checklist_template: 'قالب فحص', checklist_template_item: 'بند قالب فحص', party_bank_account: 'حساب بنكي',
};

const ACTIONS: Record<string, { color: string; label: string; icon: ReactNode }> = {
  insert: { color: 'green', label: 'إضافة', icon: <PlusCircleOutlined /> },
  update: { color: 'blue', label: 'تعديل', icon: <EditOutlined /> },
  delete: { color: 'red', label: 'حذف', icon: <DeleteOutlined /> },
  hard_delete: { color: 'volcano', label: 'حذف نهائي', icon: <DeleteOutlined /> },
  login: { color: 'cyan', label: 'تسجيل دخول', icon: <LoginOutlined /> },
  login_failed: { color: 'magenta', label: 'دخول فاشل', icon: <CloseCircleOutlined /> },
  view: { color: 'default', label: 'فتح / عرض', icon: <EyeOutlined /> },
  print: { color: 'purple', label: 'طباعة', icon: <PrinterOutlined /> },
  export: { color: 'geekblue', label: 'تصدير', icon: <DownloadOutlined /> },
  download: { color: 'geekblue', label: 'تحميل', icon: <DownloadOutlined /> },
  logout: { color: 'default', label: 'تسجيل خروج', icon: <LogoutOutlined /> },
  rejected: { color: 'volcano', label: 'عملية مرفوضة', icon: <CloseCircleOutlined /> },
};

interface Row {
  id: number; occurredAt: string; transactionId: string; userId?: number; userName?: string; action: string; table?: string; entityType?: string;
  entityId?: string; changes?: Record<string, { old: unknown; new: unknown }> | null; httpMethod?: string; requestPath?: string; ipAddress?: string;
}

const fmt = (v: unknown) => {
  if (v === null || v === undefined) return <Text type="secondary">—</Text>;
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dayjs(v).format('YYYY-MM-DD HH:mm');
  if (typeof v === 'object') return <code style={{ fontSize: 11 }}>{JSON.stringify(v)}</code>;
  return String(v);
};

/** Changes of one row as a field / before / after table. */
export function ChangesTable({ r }: { r: Row }) {
  const entries = Object.entries(r.changes ?? {});
  return (
    <div style={{ padding: '6px 12px', background: '#fafafa', borderRadius: 8 }}>
      {entries.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>لا توجد تفاصيل حقول</Text> : (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#888', textAlign: 'start' }}>
            <th style={{ textAlign: 'start', padding: 4, width: '25%' }}>الحقل</th>
            {r.action !== 'insert' && <th style={{ textAlign: 'start', padding: 4 }}>قبل</th>}
            {r.action !== 'delete' && r.action !== 'hard_delete' && <th style={{ textAlign: 'start', padding: 4 }}>بعد</th>}
          </tr></thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 4, fontFamily: 'monospace', direction: 'ltr', textAlign: 'start' }}>{k}</td>
                {r.action !== 'insert' && <td style={{ padding: 4, color: '#cf1322', background: '#fff1f0' }}>{fmt(v?.old)}</td>}
                {r.action !== 'delete' && r.action !== 'hard_delete' && <td style={{ padding: 4, color: '#389e0d', background: '#f6ffed' }}>{fmt(v?.new)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11, color: '#999', marginTop: 6, direction: 'ltr', textAlign: 'end' }}>
        {r.httpMethod} {r.requestPath} · IP {r.ipAddress ?? '—'} · tx {r.transactionId?.slice(0, 8)}
      </div>
    </div>
  );
}

export default function AuditTrailSettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<{ table: string; count: number }[]>([]);
  const [users, setUsers] = useState<{ userId: number; name?: string; count: number }[]>([]);
  const [f, setF] = useState<{ table?: string; userId?: number; action?: string; range?: [Dayjs, Dayjs] | null; search?: string; entityId?: string; transactionId?: string }>({
    range: [dayjs().subtract(7, 'day'), dayjs()],
  });

  useEffect(() => {
    api<any[]>('/audit-trail/tables').then(setTables).catch(() => setTables([]));
    api<any[]>('/audit-trail/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  const load = useCallback((p = 1) => {
    setLoading(true);
    api<Paged<Row>>('/audit-trail', {
      query: {
        page: p, pageSize: 50, table: f.table, userId: f.userId, action: f.action, search: f.search, entityId: f.entityId, transactionId: f.transactionId,
        from: f.range?.[0]?.format('YYYY-MM-DD'), to: f.range?.[1]?.format('YYYY-MM-DD'),
      },
    })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); })
      .catch(e => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [f]);
  useEffect(() => { load(1); }, [load]);

  const label = (t?: string) => (t ? TABLE_LABELS[t] ?? t : '—');
  const hasExtra = !!(f.entityId || f.transactionId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>سجل التدقيق</Text>
          <div style={{ fontSize: 12, color: '#888' }}>كل عملية إضافة أو تعديل أو حذف في النظام، مع المستخدم والوقت والقيم قبل وبعد. السجل للقراءة فقط ولا يمكن تعديله أو حذفه.</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(page)}>تحديث</Button>
      </div>

      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={f.range as any} onChange={v => setF(x => ({ ...x, range: v as any }))} allowClear />
        <Select allowClear showSearch optionFilterProp="label" placeholder="الجدول / نوع السجل" style={{ width: 200 }} value={f.table}
          onChange={v => setF(x => ({ ...x, table: v }))} options={tables.map(t => ({ value: t.table, label: `${label(t.table)} (${t.count})` }))} />
        <Select allowClear showSearch optionFilterProp="label" placeholder="المستخدم" style={{ width: 170 }} value={f.userId}
          onChange={v => setF(x => ({ ...x, userId: v }))} options={users.map(u => ({ value: u.userId, label: u.name ?? `#${u.userId}` }))} />
        <Select allowClear placeholder="العملية" style={{ width: 140 }} value={f.action} onChange={v => setF(x => ({ ...x, action: v }))}
          options={Object.entries(ACTIONS).map(([k, a]) => ({ value: k, label: a.label }))} />
        <Input.Search allowClear placeholder="بحث: رقم السجل، قيمة، مستخدم…" style={{ width: 240 }} onSearch={v => setF(x => ({ ...x, search: v || undefined }))} />
        {hasExtra && (
          <Tag closable color="purple" onClose={() => setF(x => ({ ...x, entityId: undefined, transactionId: undefined }))} icon={<FilterOutlined />}>
            {f.transactionId ? `نفس العملية ${f.transactionId.slice(0, 8)}` : `السجل #${f.entityId}`}
          </Tag>
        )}
      </Space>

      <Table<Row> size="small" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 900 }}
        locale={{ emptyText: <Empty description="لا توجد عمليات في هذه الفترة" /> }}
        pagination={{ current: page, pageSize: 50, total, showSizeChanger: false, onChange: p => load(p), showTotal: t => `${t.toLocaleString()} عملية` }}
        expandable={{ expandedRowRender: r => <ChangesTable r={r} />, rowExpandable: r => r.action !== 'login' && r.action !== 'login_failed' }}
        columns={[
          { title: 'الوقت', dataIndex: 'occurredAt', width: 150, render: v => <div><div style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD')}</div><div style={{ fontSize: 11, color: '#888' }}>{dayjs(v).format('HH:mm:ss')}</div></div> },
          { title: 'المستخدم', dataIndex: 'userName', width: 150, render: (v, r) => v ?? (r.userId ? `#${r.userId}` : <Text type="secondary">النظام</Text>) },
          { title: 'العملية', dataIndex: 'action', width: 120, render: a => <Tag color={ACTIONS[a]?.color} icon={ACTIONS[a]?.icon}>{ACTIONS[a]?.label ?? a}</Tag> },
          { title: 'السجل', key: 'rec', render: (_, r) => (
            <div>
              <Text style={{ fontSize: 12 }}>{r.table ? label(r.table) : r.entityType ? entityLabel(r.entityType) : (String((r.changes as any)?.title ?? r.requestPath ?? '—'))}</Text>
              {r.entityId && <a style={{ marginInlineStart: 6, fontFamily: 'monospace', fontSize: 12 }} onClick={() => setF(x => ({ ...x, table: r.table, entityId: r.entityId, range: null }))}>#{r.entityId}</a>}
            </div>) },
          { title: 'الحقول المتغيرة', key: 'fields', render: (_, r) => {
            const keys = Object.keys(r.changes ?? {});
            if (!keys.length) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
            return <Tooltip title={keys.join('، ')}><Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{keys.slice(0, 4).join(', ')}{keys.length > 4 ? ` +${keys.length - 4}` : ''}</Text></Tooltip>;
          } },
          { title: '', key: 'hist', width: 50, render: (_, r) => r.entityType && r.entityId
            ? <HistoryButton entityType={r.entityType} id={r.entityId} label={null} type="text" /> : null },
          { title: '', key: 'tx', width: 50, render: (_, r) => (
            <Tooltip title="كل السجلات في نفس العملية"><Button size="small" type="text" icon={<BranchesOutlined />}
              onClick={() => setF(x => ({ ...x, transactionId: r.transactionId, entityId: undefined, table: undefined, range: null }))} /></Tooltip>) },
        ]} />
    </div>
  );
}
