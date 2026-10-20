import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Input, Segmented, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { unitsApi, type UnitDto } from '../../api/units';
import UnitProfileDrawer from './UnitProfileDrawer';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';

/** Row of GET /supply-contracts?buildingId= */
interface ContractRow {
  id: number; contractNo: string; tenantId: number; tenant?: string; unitId: number; unit?: string; floor?: number | null;
  meter?: string | null; startDate: string; endDate?: string | null; status?: string; statusLabel?: string; isActive: boolean;
  monthlyFee?: number; depositAmount?: number | null; depositPaid: boolean; balanceAmount?: number; overdueAmount?: number; paymentStatus?: string;
  terminatedAt?: string | null;
}

const PAY: Record<string, { label: string; color: string }> = {
  paid: { label: 'مسدد', color: 'success' }, partial: { label: 'مسدد جزئياً', color: 'processing' },
  pending: { label: 'مستحق', color: 'warning' }, overdue: { label: 'متأخر', color: 'error' }, none: { label: 'لا فواتير', color: 'default' },
};
const money = (v?: number | null) => `${Number(v ?? 0).toLocaleString()} د.إ`;
const d = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '—');

/** Building profile → «المستأجرون»: tenants of this building from their gas supply contracts (live data). */
const BuildingTenantsTab: React.FC<{ buildingId: number; buildingName?: string; canManage?: boolean; onCount?: (n: number) => void; onChanged?: () => void }> = ({
  buildingId, buildingName, canManage, onCount, onChanged,
}) => {
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'active' | 'overdue' | 'all'>('active');
  const [unit, setUnit] = useState<UnitDto | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api<Paged<ContractRow>>('/supply-contracts', { query: { buildingId, pageSize: 0 }, signal: ctrl.signal })
      .then(r => { setRows(r.items); onCount?.(r.items.filter(c => c.isActive).length); })
      .catch(e => { if (e?.name !== 'AbortError') message.error(errorMessage(e)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [buildingId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = rows.filter(r => r.isActive);
  const in30 = dayjs().add(30, 'day');
  const kpis = useMemo(() => [
    { label: 'مستأجرون حاليون', value: active.length, color: PRIMARY, bg: '#e8f5e9' },
    { label: 'دفعات متأخرة', value: active.filter(r => Number(r.overdueAmount ?? 0) > 0).length, color: '#ff4d4f', bg: '#ffebee' },
    { label: 'بدون وديعة', value: active.filter(r => !r.depositPaid && Number(r.depositAmount ?? 0) > 0).length, color: '#fa8c16', bg: '#fff7e6' },
    { label: 'تنتهي خلال 30 يوماً', value: active.filter(r => r.endDate && dayjs(r.endDate).isBefore(in30)).length, color: '#1677ff', bg: '#e3f2fd' },
    { label: 'إجمالي المستحق', value: money(active.reduce((t, r) => t + Number(r.balanceAmount ?? 0), 0)), color: '#8a6d1f', bg: '#fbf3dc' },
  ], [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const shown = rows.filter(r => (view === 'all' || (r.isActive && (view === 'active' || Number(r.overdueAmount ?? 0) > 0)))
    && (!q || [r.tenant, r.unit, r.contractNo, r.meter].some(v => (v ?? '').toLowerCase().includes(q))));

  const openUnit = async (r: ContractRow) => {
    try { setUnit(await unitsApi.get(r.unitId)); } catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {kpis.map(s => (
          <Card key={s.label} size="small" variant="borderless" style={{ borderRadius: 10, background: s.bg, minWidth: 110, textAlign: 'center', flex: '1 1 110px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input prefix={<SearchOutlined style={{ color: '#ccc' }} />} placeholder="بحث بالمستأجر، الوحدة، العقد، العداد..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} allowClear />
        <Segmented value={view} onChange={v => setView(v as typeof view)} options={[
          { value: 'active', label: `الحاليون (${active.length})` },
          { value: 'overdue', label: 'متأخرون' },
          { value: 'all', label: `كل العقود (${rows.length})` },
        ]} />
        <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)} loading={loading} /></Tooltip>
      </div>

      <Table<ContractRow> size="middle" rowKey="id" loading={loading} dataSource={shown} pagination={shown.length > 15 ? { pageSize: 15 } : false}
        locale={{ emptyText: rows.length ? 'لا توجد نتائج' : 'لا يوجد مستأجرون في هذا المبنى — أضف المستأجر من مخطط الوحدات' }}
        onRow={r => ({ onClick: () => openUnit(r), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.6 } })}
        columns={[
          { title: 'المستأجر', dataIndex: 'tenant', render: (v: string, r) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar style={{ background: PRIMARY, color: GOLD }}>{(v ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('')}</Avatar>
              <div><Text strong>{v ?? '—'}</Text><div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{r.contractNo}</div></div>
            </div>
          ) },
          { title: 'الوحدة', dataIndex: 'unit', width: 110, render: (v: string, r) => <span><b>{v}</b>{r.floor != null && <span style={{ color: '#999', fontSize: 11 }}> · ط {r.floor}</span>}</span> },
          { title: 'العداد', dataIndex: 'meter', width: 100, render: (v?: string) => <span style={{ fontFamily: 'monospace' }}>{v ?? '—'}</span> },
          { title: 'مدة العقد', key: 'period', width: 190, render: (_, r) => <span style={{ fontSize: 12 }}>{d(r.startDate)} ← {r.terminatedAt ? d(r.terminatedAt) : d(r.endDate)}</span> },
          { title: 'الرصيد', dataIndex: 'balanceAmount', width: 120, render: (v: number, r) => (
            <span style={{ color: Number(r.overdueAmount ?? 0) > 0 ? '#cf1322' : Number(v ?? 0) > 0 ? '#d46b08' : PRIMARY, fontWeight: 600 }}>{money(v)}</span>
          ) },
          { title: 'الدفع', dataIndex: 'paymentStatus', width: 100, render: (v?: string) => { const p = PAY[v ?? 'none'] ?? PAY.none; return <Tag color={p.color}>{p.label}</Tag>; } },
          { title: 'العقد', dataIndex: 'status', width: 100, render: (_: string, r) => <Tag color={r.isActive ? 'green' : 'default'}>{r.statusLabel ?? (r.isActive ? 'نشط' : 'منتهي')}</Tag> },
        ]} />

      <UnitProfileDrawer unit={unit} buildingName={buildingName} canManage={canManage}
        onClose={() => setUnit(null)}
        onChanged={() => { setKey(k => k + 1); onChanged?.(); unit && unitsApi.get(unit.id).then(setUnit).catch(() => undefined); }} />
    </div>
  );
};

export default BuildingTenantsTab;
