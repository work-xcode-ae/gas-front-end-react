import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Card, Table, Input, Select, Segmented, Button, Tag, Avatar, Typography, Space, Tooltip, message } from 'antd';
import { TeamOutlined, PlusOutlined, UserOutlined, CheckCircleOutlined, WarningOutlined, DollarOutlined, StopOutlined, ReloadOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { PageBanner, Kpi, money, PRIMARY, GOLD, PAY_STATUS } from './shared';
import CustomerDrawer from './CustomerDrawer';
import { CustomerFormModal, RecordPaymentModal } from './CustomerModals';

const { Text } = Typography;

/** Customers = tenant accounts (tenants of gas supply contracts and building owners invoiced for AMC). */
export default function CustomersPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState<string>();
  const [active, setActive] = useState<'all' | 'true' | 'false'>('true');
  const [branchId, setBranchId] = useState<number>();
  const [payStatus, setPayStatus] = useState<string>();
  const [openId, setOpenId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [payFor, setPayFor] = useState<any>(null);
  const [key, setKey] = useState(0);

  const load = useCallback((p: number) => {
    setLoading(true);
    api<Paged<any>>('/tenants', { query: { page: p, pageSize: 20, search, branchId, paymentStatus: payStatus, active: active === 'all' ? undefined : active } })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [search, branchId, payStatus, active]);
  useEffect(() => { load(1); }, [load, key]);
  useEffect(() => { api<any>('/tenants/summary', { query: { branchId } }).then(setSummary).catch(() => setSummary(null)); }, [branchId, key]);

  const refresh = () => setKey(k => k + 1);
  const openEdit = async (id: number) => {
    try { setEditing(await api<any>(`/tenants/${id}`)); setFormOpen(true); } catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      <PageBanner icon={<TeamOutlined />} title="العملاء" subtitle="حسابات العملاء: المستأجرون وملاك المباني — العقود والفواتير والمدفوعات والأرصدة"
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent' }} />
          {can('tenants.manage') && <Button icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD, color: '#0b2e18', fontWeight: 600 }}
            onClick={() => { setEditing(null); setFormOpen(true); }}>عميل جديد</Button>}
        </Space>} />

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={8} xl={4}><Kpi label="إجمالي العملاء" value={summary?.total ?? '—'} color={PRIMARY} bg="#e8f5e9" icon={<TeamOutlined />} onClick={() => { setActive('all'); setPayStatus(undefined); }} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="نشطون" value={summary?.active ?? '—'} color="#1677ff" bg="#e6f4ff" icon={<CheckCircleOutlined />} active={active === 'true'} onClick={() => setActive('true')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="لديهم عقد نشط" value={summary?.withContract ?? '—'} color="#13c2c2" bg="#e6fffb" icon={<UserOutlined />} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`عليهم رصيد (${summary?.withBalance ?? 0})`} value={money(summary?.outstanding)} color="#fa8c16" bg="#fff7e6" icon={<DollarOutlined />}
          active={payStatus === 'pending'} onClick={() => setPayStatus(payStatus === 'pending' ? undefined : 'pending')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label={`متأخرون (${summary?.overdueCount ?? 0})`} value={money(summary?.overdue)} color="#ff4d4f" bg="#fff1f0" icon={<WarningOutlined />}
          active={payStatus === 'overdue'} onClick={() => setPayStatus(payStatus === 'overdue' ? undefined : 'overdue')} /></Col>
        <Col xs={12} md={8} xl={4}><Kpi label="موقوفون" value={summary?.inactive ?? '—'} color="#8c8c8c" bg="#fafafa" icon={<StopOutlined />} active={active === 'false'} onClick={() => setActive('false')} /></Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="بحث: الاسم، الرمز، الهاتف، الهوية، البريد…" style={{ width: 300 }} onSearch={v => setSearch(v || undefined)} />
          <Segmented value={active} onChange={v => setActive(v as any)} options={[{ value: 'true', label: 'النشطون' }, { value: 'false', label: 'الموقوفون' }, { value: 'all', label: 'الكل' }]} />
          <Select allowClear placeholder="الفرع" style={{ width: 160 }} value={branchId} onChange={setBranchId}
            options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
          <Select allowClear placeholder="حالة السداد" style={{ width: 150 }} value={payStatus} onChange={setPayStatus}
            options={Object.entries(PAY_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
        </Space>
        <Table rowKey="id" size="middle" loading={loading} dataSource={rows} scroll={{ x: 1000 }}
          onRow={r => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.55 } })}
          pagination={{ current: page, pageSize: 20, total, showSizeChanger: false, onChange: load, showTotal: t => `${t} عميل` }}
          columns={[
            { title: 'العميل', key: 'name', render: (_, r) => (
              <Space><Avatar style={{ background: PRIMARY }}>{r.avatar}</Avatar>
                <div><Text strong>{r.nameAr ?? r.name}</Text><div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{r.code}</div></div></Space>) },
            { title: 'الهاتف', dataIndex: 'phone', render: v => <span dir="ltr">{v ?? '—'}</span> },
            { title: 'الهوية', dataIndex: 'emiratesId', render: v => <span dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12 }}>{v ?? '—'}</span> },
            { title: 'المبنى / الوحدة', key: 'unit', render: (_, r) => r.building ? <div>{r.building}<div style={{ fontSize: 11, color: '#888' }}>وحدة {r.unit}{r.meterNo ? ` · ${r.meterNo}` : ''}</div></div> : <Text type="secondary">—</Text> },
            { title: 'العقد', dataIndex: 'contractNo', render: v => v ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text> },
            { title: 'الرصيد', dataIndex: 'balance', render: (v, r) => <div><Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#52c41a' }}>{money(v)}</Text>
              {Number(r.overdue) > 0 && <div style={{ fontSize: 11, color: '#ff4d4f' }}>متأخر {money(r.overdue)}</div>}</div> },
            { title: 'السداد', dataIndex: 'paymentStatus', render: s => <Tag color={PAY_STATUS[s]?.color}>{PAY_STATUS[s]?.label ?? s}</Tag> },
            { title: '', key: 'a', width: 120, render: (_, r) => (
              <Space size={0} onClick={e => e.stopPropagation()}>
                <Tooltip title="الملف"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setOpenId(r.id)} /></Tooltip>
                {can('tenants.manage') && <Tooltip title="تعديل"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r.id)} /></Tooltip>}
                {can('payments.manage') && <Tooltip title="تسجيل دفعة"><Button type="text" size="small" icon={<DollarOutlined style={{ color: PRIMARY }} />} onClick={() => setPayFor(r)} /></Tooltip>}
              </Space>) },
          ]} />
      </Card>

      <CustomerDrawer customerId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
      <CustomerFormModal open={formOpen} customer={editing} onClose={() => setFormOpen(false)}
        onSaved={id => { setFormOpen(false); refresh(); if (!editing) setOpenId(id); }} />
      <RecordPaymentModal open={!!payFor} tenantId={payFor?.id ?? null} tenantName={payFor?.nameAr ?? payFor?.name} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); refresh(); }} />
    </div>
  );
}
