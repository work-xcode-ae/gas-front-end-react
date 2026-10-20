import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Card, Empty, Progress, Tooltip, Rate } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { VisitDrawer } from '../Maintenance/VisitDrawer';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';

function useList<T>(path: string, query: Record<string, any>, reloadKey?: number) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query);
  useEffect(() => {
    setLoading(true);
    api<Paged<T>>(path, { query: { ...query, pageSize: 0 } })
      .then(r => { setRows(r.items); setError(null); })
      .catch(e => { setRows([]); setError(errorMessage(e)); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, reloadKey]);
  return { rows, loading, error };
}

const Summary = ({ items }: { items: { label: string; value: number | string; color: string; bg: string }[] }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
    {items.map(s => (
      <Card key={s.label} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, minWidth: 110, textAlign: 'center', flex: '1 1 100px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
        <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
      </Card>
    ))}
  </div>
);

interface TabProps { buildingId: number; reloadKey?: number }

// ═════════════ maintenance visits (all AMC contracts of the building) ═════════════
const VISIT_STATUS: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'مجدولة' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' },
  completed: { color: 'success', label: 'مكتملة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const VISIT_TYPE: Record<string, string> = { preventive: 'وقائية', corrective: 'تصحيحية', emergency: 'طارئة', inspection: 'فحص' };

export function BuildingVisitsTab({ buildingId, reloadKey }: TabProps) {
  const [k, setK] = useState(0);
  const [sel, setSel] = useState<any>(null);
  const { rows, loading, error } = useList<any>('/maintenance-visits', { buildingId }, (reloadKey ?? 0) + k);
  const sorted = [...rows].sort((a, b) => String(b.visitDate ?? b.scheduledDate).localeCompare(String(a.visitDate ?? a.scheduledDate)));
  return (
    <div>
      <Summary items={[
        { label: 'إجمالي الزيارات', value: rows.length, color: PRIMARY, bg: '#e8f5e9' },
        { label: 'مكتملة', value: rows.filter(v => v.status === 'completed').length, color: '#52c41a', bg: '#f6ffed' },
        { label: 'مجدولة', value: rows.filter(v => v.status === 'scheduled' && !v.overdue).length, color: '#1677ff', bg: '#e6f4ff' },
        { label: 'متأخرة', value: rows.filter(v => v.overdue).length, color: '#ff4d4f', bg: '#fff1f0' },
      ]} />
      <Table size="small" rowKey="id" loading={loading} dataSource={sorted} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 1100 }}
        locale={{ emptyText: <Empty description={error ?? 'لا توجد زيارات صيانة — تُنشأ تلقائياً مع عقد AMC'} /> }}
        onRow={v => ({ onClick: () => setSel(v), style: { cursor: 'pointer', background: v.overdue ? '#fff1f0' : undefined } })}
        columns={[
          { title: 'الزيارة', key: 'no', render: (_, v) => <div><Text strong style={{ fontSize: 12 }}>{v.periodLabel || v.visitNo}</Text><div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{v.visitNo}</div></div> },
          { title: 'العقد', dataIndex: 'contractNo', render: t => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</Text> },
          { title: 'النوع', dataIndex: 'visitType', render: t => VISIT_TYPE[t] ?? t ?? '—' },
          { title: 'الموعد', dataIndex: 'scheduledDate' },
          { title: 'تاريخ التنفيذ', dataIndex: 'visitDate', render: t => t ?? '—' },
          { title: 'الموظف المنفذ', dataIndex: 'technician', render: t => t ?? <Text type="secondary" style={{ fontSize: 11 }}>غير مسند</Text> },
          { title: 'قائمة الفحص', key: 'chk', render: (_, v) => v.checklistTotal ? <Progress percent={Math.round(v.checklistDone * 100 / v.checklistTotal)} size="small" style={{ width: 90, margin: 0 }} format={() => `${v.checklistDone}/${v.checklistTotal}`} /> : '—' },
          { title: 'ملاحظات', dataIndex: 'findings', render: n => n ? <Tag color="orange" icon={<WarningOutlined />}>{n}</Tag> : '—' },
          { title: 'التقرير', dataIndex: 'reportSummary', ellipsis: true, render: t => t ? <Tooltip title={t}><Text style={{ fontSize: 12 }}>{t}</Text></Tooltip> : '—' },
          { title: 'تقييم العميل', dataIndex: 'customerRating', render: r => r ? <Rate disabled value={r} style={{ fontSize: 11 }} /> : '—' },
          { title: 'الحالة', key: 'st', render: (_, v) => v.overdue ? <Tag color="error" icon={<ClockCircleOutlined />}>متأخرة</Tag> : <Tag color={VISIT_STATUS[v.status]?.color}>{VISIT_STATUS[v.status]?.label ?? v.statusLabel}</Tag> },
        ]} />
      <Text type="secondary" style={{ fontSize: 11 }}>اضغط على الزيارة لإسنادها لموظف، تسجيل الإنجاز والملاحظات، رفع التقرير، وتسجيل رأي العميل.</Text>
      <VisitDrawer row={sel} onClose={() => setSel(null)} onChanged={() => setK(x => x + 1)} />
    </div>
  );
}

// ═════════════ service requests ═════════════
const SR_STATUS: Record<string, string> = { pending: 'gold', in_progress: 'processing', completed: 'success', cancelled: 'default', closed: 'success' };
const PRIORITY: Record<string, string> = { low: 'default', medium: 'blue', high: 'orange', urgent: 'red' };

export function BuildingServiceRequestsTab({ buildingId, reloadKey }: TabProps) {
  const { rows, loading, error } = useList<any>('/service-requests', { buildingId }, reloadKey);
  const open = rows.filter(r => r.status === 'pending' || r.status === 'in_progress');
  return (
    <div>
      <Summary items={[
        { label: 'إجمالي الطلبات', value: rows.length, color: PRIMARY, bg: '#e8f5e9' },
        { label: 'مفتوحة', value: open.length, color: '#fa8c16', bg: '#fff7e6' },
        { label: 'عاجلة / عالية', value: open.filter(r => r.priority === 'urgent' || r.priority === 'high').length, color: '#ff4d4f', bg: '#fff1f0' },
        { label: 'مكتملة', value: rows.filter(r => r.status === 'completed').length, color: '#52c41a', bg: '#f6ffed' },
      ]} />
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 800 }}
        locale={{ emptyText: <Empty description={error ?? 'لا توجد طلبات خدمة — تُفتح من الوحدة في مخطط المبنى'} /> }}
        columns={[
          { title: 'رقم الطلب', dataIndex: 'requestNo', render: t => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{t}</Text> },
          { title: 'الوحدة', dataIndex: 'unit', render: (t, r) => <div>{t ?? '—'}{r.tenant && <div style={{ fontSize: 11, color: '#888' }}>{r.tenant}</div>}</div> },
          { title: 'الوصف', dataIndex: 'description', ellipsis: true },
          { title: 'الأولوية', dataIndex: 'priority', render: (p, r) => <Tag color={PRIORITY[p]}>{r.priorityLabel ?? p}</Tag> },
          { title: 'المكلّف', key: 'as', render: (_, r) => r.assignee ?? r.vendor ?? '—' },
          { title: 'تاريخ الطلب', dataIndex: 'requestedAt', render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—' },
          { title: 'الإغلاق', dataIndex: 'closedAt', render: t => t ? dayjs(t).format('YYYY-MM-DD') : '—' },
          { title: 'الحالة', dataIndex: 'status', render: (s, r) => <Tag color={SR_STATUS[s]}>{r.statusLabel ?? s}</Tag> },
        ]} />
    </div>
  );
}

// ═════════════ civil defence certificates ═════════════
const CD_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: 'سارية' }, expired: { color: 'error', label: 'منتهية' },
  renewal_in_progress: { color: 'processing', label: 'قيد التجديد' }, pending: { color: 'gold', label: 'قيد الإصدار' },
};

export function BuildingCocTab({ buildingId, reloadKey }: TabProps) {
  const { rows, loading, error } = useList<any>('/cd-certificates', { buildingId }, reloadKey);
  const active = rows.find(c => c.status === 'active');
  return (
    <div>
      <Summary items={[
        { label: 'إجمالي الشهادات', value: rows.length, color: PRIMARY, bg: '#e8f5e9' },
        { label: 'سارية', value: rows.filter(c => c.status === 'active').length, color: '#52c41a', bg: '#f6ffed' },
        { label: 'قيد التجديد', value: rows.filter(c => c.status === 'renewal_in_progress' || c.renewal?.status === 'in_progress').length, color: '#1677ff', bg: '#e6f4ff' },
        { label: 'منتهية', value: rows.filter(c => c.status === 'expired' || (c.daysToExpiry ?? 1) < 0).length, color: '#ff4d4f', bg: '#fff1f0' },
        { label: 'تنتهي الشهادة الحالية', value: active?.expiryDate ?? '—', color: '#fa8c16', bg: '#fff7e6' },
      ]} />
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={false} scroll={{ x: 800 }}
        locale={{ emptyText: <Empty description={error ?? 'لا توجد شهادات دفاع مدني لهذا المبنى'} /> }}
        columns={[
          { title: 'رقم الشهادة', dataIndex: 'certificateNo', render: t => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}><SafetyCertificateOutlined style={{ color: PRIMARY }} /> {t}</Text> },
          { title: 'النوع', dataIndex: 'certTypeLabel' },
          { title: 'الجهة المصدرة', dataIndex: 'issuedBy', render: t => t ?? '—' },
          { title: 'تاريخ الإصدار', dataIndex: 'issueDate', render: t => t ?? '—' },
          { title: 'تاريخ الانتهاء', key: 'exp', render: (_, c) => c.expiryDate ? (
            <div>{c.expiryDate}{c.daysToExpiry != null && (
              <div style={{ fontSize: 11, color: c.daysToExpiry < 0 ? '#ff4d4f' : c.daysToExpiry <= 60 ? '#fa8c16' : '#52c41a' }}>
                {c.daysToExpiry < 0 ? `منتهية منذ ${-c.daysToExpiry} يوم` : `متبقي ${c.daysToExpiry} يوم`}
              </div>)}</div>) : '—' },
          { title: 'المفتش', key: 'insp', render: (_, c) => c.inspectorName ? <div>{c.inspectorName}<div style={{ fontSize: 11, color: '#888' }}>{c.inspectionDate}</div></div> : '—' },
          { title: 'الحالة', key: 'st', render: (_, c) => {
            const s = CD_STATUS[c.status] ?? { color: 'default', label: c.statusLabel ?? c.status };
            return <Tag color={s.color} icon={c.status === 'active' ? <CheckCircleOutlined /> : undefined}>{s.label}</Tag>;
          } },
        ]} />
    </div>
  );
}
