import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Select, Space, Typography, Modal, message, Empty, Progress, Calendar, Segmented, DatePicker, Spin, Badge, Checkbox, Rate,
} from 'antd';
import {
  CalendarOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined,
  ReloadOutlined, ToolOutlined, PlusOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { RecordVisitModal, UploadReportModal } from '../Buildings/AmcVisitModals';
import { VisitDrawer } from './VisitDrawer';
import { PageHeader, KpiRow, useBuildings, buildingLabel, PRIMARY } from '../MaintenanceContracts/shared';

const { Text } = Typography;
const STATUS: Record<string, { color: string; label: string }> = {
  scheduled: { color: 'blue', label: 'مجدولة' }, in_progress: { color: 'processing', label: 'قيد التنفيذ' },
  completed: { color: 'success', label: 'مكتملة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
const TYPE: Record<string, string> = { preventive: 'وقائية', corrective: 'تصحيحية', emergency: 'طارئة', inspection: 'فحص' };

const MaintenancePage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('maintenance.manage');
  const buildings = useBuildings();
  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'));
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [buildingId, setBuildingId] = useState<number | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [overdueAll, setOverdueAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [selId, setSelId] = useState<number | null>(null);
  const [visitContract, setVisitContract] = useState<any>(null);
  const [recordVisitId, setRecordVisitId] = useState<number | null>(null);
  const [reportContract, setReportContract] = useState<any>(null);
  const [extraPick, setExtraPick] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [extraContract, setExtraContract] = useState<number | null>(null);
  const refresh = () => setReload(k => k + 1);

  const load = useCallback(() => {
    setLoading(true);
    const from = month.startOf('month').format('YYYY-MM-DD'), to = month.endOf('month').format('YYYY-MM-DD');
    Promise.all([
      api<Paged<any>>('/maintenance-visits', { query: { pageSize: 0, buildingId, status, from, to } }),
      api<Paged<any>>('/maintenance-visits', { query: { pageSize: 0, buildingId, status: 'scheduled', to: dayjs().subtract(1, 'day').format('YYYY-MM-DD') } }),
    ]).then(([m, o]) => { setRows(m.items); setOverdueAll(o.items.filter((v: any) => v.overdue)); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [month, buildingId, status]);
  useEffect(() => { load(); }, [load, reload]);


  const shown = overdueOnly ? overdueAll : rows;
  const selRow = [...rows, ...overdueAll].find(v => v.id === selId);
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach(v => { const k = String(v.scheduledDate).slice(0, 10); m.set(k, [...(m.get(k) ?? []), v]); });
    return m;
  }, [rows]);

  const contractOf = async (v: any) => api<any>(`/amc-contracts/${v.amcContractId}`);
  const doRecord = async (v: any) => { try { setRecordVisitId(v.id); setVisitContract(await contractOf(v)); } catch (e) { message.error(errorMessage(e)); } };
  const doReport = async (v: any) => { try { setReportContract(await contractOf(v)); } catch (e) { message.error(errorMessage(e)); } };
  const doStart = async (v: any) => {
    try { await api(`/maintenance-visits/${v.id}/start`, { method: 'POST' }); message.success('بدأت الزيارة'); refresh(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const doCancel = (v: any) => Modal.confirm({
    title: `إلغاء الزيارة ${v.visitNo}؟`, okText: 'إلغاء الزيارة', okType: 'danger', cancelText: 'رجوع',
    onOk: async () => { try { await api(`/maintenance-visits/${v.id}/cancel`, { method: 'POST' }); message.success('تم إلغاء الزيارة'); refresh(); } catch (e) { message.error(errorMessage(e), 6); } },
  });
  const openExtra = () => {
    setExtraContract(null);
    api<Paged<any>>('/amc-contracts', { query: { pageSize: 0, status: 'active', buildingId } }).then(r => setContracts(r.items)).catch(() => setContracts([]));
    setExtraPick(true);
  };

  const actionsFor = (v: any, size: 'small' | 'middle' = 'small') => !canManage ? null : (
    <Space size={4} wrap onClick={e => e.stopPropagation()}>
      {v.status === 'scheduled' && <Button size={size} icon={<PlayCircleOutlined />} onClick={() => doStart(v)}>بدء</Button>}
      {(v.status === 'scheduled' || v.status === 'in_progress') && <Button size={size} type="primary" icon={<CheckCircleOutlined />} onClick={() => doRecord(v)}>تسجيل الإنجاز</Button>}
      {v.status !== 'cancelled' && <Button size={size} icon={<UploadOutlined />} onClick={() => doReport(v)}>تقرير</Button>}
      {(v.status === 'scheduled' || v.status === 'in_progress') && <Button size={size} danger icon={<StopOutlined />} onClick={() => doCancel(v)}>إلغاء</Button>}
    </Space>
  );

  const statusTag = (v: any) => v.overdue ? <Tag color="error" icon={<WarningOutlined />}>متأخرة</Tag> : <Tag color={STATUS[v.status]?.color}>{STATUS[v.status]?.label ?? v.statusLabel}</Tag>;

  return (
    <div>
      <PageHeader icon={<CalendarOutlined />} title="زيارات الصيانة" subtitle="جدول زيارات عقود الصيانة السنوية في كل المباني — التنفيذ، التقارير، الملاحظات"
        extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={refresh}>تحديث</Button>
          {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: '#c9a84c', borderColor: '#c9a84c', color: '#0b2e18', fontWeight: 600 }} onClick={openExtra}>زيارة إضافية</Button>}
        </Space>} />

      <KpiRow items={[
        { label: `زيارات ${month.format('YYYY-MM')}`, value: rows.length, color: PRIMARY, bg: '#e8f5e9', icon: <CalendarOutlined />, onClick: () => setOverdueOnly(false), active: !overdueOnly },
        { label: 'مكتملة', value: rows.filter(v => v.status === 'completed').length, color: '#389e0d', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
        { label: 'مجدولة', value: rows.filter(v => v.status === 'scheduled' && !v.overdue).length, color: '#1677ff', bg: '#e6f4ff', icon: <ClockCircleOutlined /> },
        { label: 'متأخرة (كل الفترات)', value: overdueAll.length, color: '#cf1322', bg: '#fff1f0', icon: <WarningOutlined />, onClick: () => { setOverdueOnly(true); setView('list'); }, active: overdueOnly },
        { label: 'ملاحظات مكتشفة', value: rows.reduce((s, v) => s + (v.findings ?? 0), 0), color: '#d46b08', bg: '#fff7e6', icon: <ToolOutlined /> },
      ]} />

      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Segmented value={view} onChange={v => setView(v as any)} options={[{ value: 'calendar', label: <span><CalendarOutlined /> تقويم</span> }, { value: 'list', label: <span><UnorderedListOutlined /> جدول</span> }]} />
          <DatePicker picker="month" value={month} allowClear={false} onChange={v => v && setMonth(v.startOf('month'))} disabled={overdueOnly} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="المبنى" style={{ width: 240 }} value={buildingId} onChange={setBuildingId}
            options={buildings.map(b => ({ value: b.id, label: buildingLabel(b) }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 140 }} value={status} onChange={setStatus} disabled={overdueOnly}
            options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Checkbox checked={overdueOnly} onChange={e => { setOverdueOnly(e.target.checked); if (e.target.checked) setView('list'); }}>المتأخرة فقط</Checkbox>
        </Space>

        {view === 'calendar' && !overdueOnly ? (
          <Spin spinning={loading}>
            <Calendar value={month} onPanelChange={v => setMonth(v.startOf('month'))} onSelect={(d, info) => { if (info.source === 'date' && !d.isSame(month, 'month')) setMonth(d.startOf('month')); }}
              headerRender={() => null}
              cellRender={(d, info) => {
                if (info.type !== 'date') return info.originNode;
                const list = byDay.get(d.format('YYYY-MM-DD')) ?? [];
                return (
                  <div>
                    {list.slice(0, 3).map(v => (
                      <div key={v.id} onClick={e => { e.stopPropagation(); setSelId(v.id); }} style={{ fontSize: 11, marginBottom: 2, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Badge color={v.overdue ? '#ff4d4f' : v.status === 'completed' ? '#52c41a' : v.status === 'cancelled' ? '#bfbfbf' : '#1677ff'} text={<span style={{ fontSize: 11 }}>{v.buildingCode} · {v.periodLabel || v.visitNo}</span>} />
                      </div>
                    ))}
                    {list.length > 3 && <Text type="secondary" style={{ fontSize: 10 }}>+{list.length - 3} أخرى</Text>}
                  </div>
                );
              }} />
          </Spin>
        ) : (
          <Table size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1100 }} pagination={{ pageSize: 20, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty description={overdueOnly ? 'لا توجد زيارات متأخرة' : 'لا توجد زيارات في هذا الشهر'} /> }}
            onRow={v => ({ onClick: () => setSelId(v.id), style: { cursor: 'pointer', background: v.overdue ? '#fff1f0' : undefined } })}
            columns={[
              { title: 'الزيارة', key: 'n', render: (_, v) => <div><Text strong style={{ fontSize: 12 }}>{v.periodLabel || v.visitNo}</Text><div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{v.visitNo}</div></div> },
              { title: 'المبنى', key: 'b', render: (_, v) => <div>{v.building}<div style={{ fontSize: 11, color: '#888' }}>{v.contractNo}</div></div> },
              { title: 'النوع', dataIndex: 'visitType', render: t => TYPE[t] ?? t ?? '—' },
              { title: 'الموعد', dataIndex: 'scheduledDate', render: (d, v) => <span style={{ color: v.overdue ? '#cf1322' : undefined }}>{d}{v.timeSlot ? ` ${v.timeSlot}` : ''}{v.overdue ? <div style={{ fontSize: 10 }}>متأخرة {dayjs().diff(dayjs(d), 'day')} يوم</div> : null}</span> },
              { title: 'التنفيذ', dataIndex: 'visitDate', render: d => d ?? '—' },
              { title: 'الفني', dataIndex: 'technician', render: (t, v) => t ?? v.technicianPhone ?? '—' },
              { title: 'قائمة الفحص', key: 'c', render: (_, v) => v.checklistTotal ? <Progress size="small" style={{ width: 90, margin: 0 }} percent={Math.round(v.checklistDone * 100 / v.checklistTotal)} format={() => `${v.checklistDone}/${v.checklistTotal}`} /> : '—' },
              { title: 'ملاحظات', dataIndex: 'findings', render: n => n ? <Tag color="orange">{n}</Tag> : '—' },
              { title: 'تقييم العميل', dataIndex: 'customerRating', render: r => r ? <Rate disabled value={r} style={{ fontSize: 12 }} /> : '—' },
              { title: 'الحالة', key: 's', render: (_, v) => statusTag(v) },
              { title: '', key: 'a', render: (_, v) => actionsFor(v) },
            ]} />
        )}
      </Card>

      <VisitDrawer row={selRow ?? null} onClose={() => setSelId(null)} onChanged={refresh} />

      <RecordVisitModal open={!!visitContract} contract={visitContract} visitId={recordVisitId} onClose={() => { setVisitContract(null); setRecordVisitId(null); }} onDone={refresh} />
      <UploadReportModal open={!!reportContract} contract={reportContract} onClose={() => setReportContract(null)} onDone={refresh} />

      <Modal open={extraPick} title="زيارة إضافية — اختر عقد الصيانة" okText="متابعة" cancelText="إلغاء" okButtonProps={{ disabled: !extraContract }}
        onCancel={() => setExtraPick(false)}
        onOk={async () => { setExtraPick(false); try { setVisitContract(await api<any>(`/amc-contracts/${extraContract}`)); } catch (e) { message.error(errorMessage(e)); } }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>اختر «زيارة إضافية (غير مجدولة)» في نافذة التسجيل التالية.</Text>
        <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="عقد نشط…" value={extraContract ?? undefined} onChange={setExtraContract}
          notFoundContent="لا توجد عقود نشطة" options={contracts.map(c => ({ value: c.id, label: `${c.contractNo} — ${c.building}` }))} />
      </Modal>
    </div>
  );
};

export default MaintenancePage;
