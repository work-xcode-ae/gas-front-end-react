import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Empty, Segmented, Space, Spin, Switch, Tag, Tooltip, Typography, DatePicker, Select, message } from 'antd';
import {
  HistoryOutlined, PlusCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined, DownloadOutlined, LoginOutlined, LogoutOutlined,
  ThunderboltOutlined, LinkOutlined, ReloadOutlined, UserOutlined, GlobalOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ACTION_STYLE, entityLabel, fieldLabel } from './labels';

const { Text } = Typography;

const ICONS: Record<string, React.ReactNode> = {
  insert: <PlusCircleOutlined />, update: <EditOutlined />, delete: <DeleteOutlined />, hard_delete: <DeleteOutlined />, view: <EyeOutlined />, print: <PrinterOutlined />,
  export: <DownloadOutlined />, download: <DownloadOutlined />, login: <LoginOutlined />, login_failed: <LoginOutlined />, logout: <LogoutOutlined />, event: <ThunderboltOutlined />,
};

interface Change { field: string; old: any; new: any; oldText?: string | null; newText?: string | null; refType?: string | null }
interface Item {
  kind: 'change' | 'usage' | 'auth' | 'event'; id: number; occurredAt: string; transactionId?: string; userId?: number; userName?: string | null; action: string;
  entityType?: string | null; entityId?: string | null; self?: boolean; recordName?: string | null; requestPath?: string | null; ipAddress?: string | null;
  description?: string | null; changes?: Change[];
}

const fmt = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dayjs(v).format('YYYY-MM-DD HH:mm');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const HIDDEN = new Set(['Id', 'CompanyId', 'RowVersion']);

function ChangeTable({ item }: { item: Item }) {
  const rows = (item.changes ?? []).filter(c => !HIDDEN.has(c.field));
  if (!rows.length) return null;
  const isUsage = item.kind === 'usage';
  return (
    <table className="rh-table">
      <tbody>
        {rows.map(c => (
          <tr key={c.field}>
            <td className="rh-f">{fieldLabel(c.field)}</td>
            {isUsage || item.action === 'insert'
              ? <td colSpan={2}><b>{c.newText ?? fmt(c.new)}</b></td>
              : item.action === 'delete' || item.action === 'hard_delete'
                ? <td colSpan={2}><span className="rh-old">{c.oldText ?? fmt(c.old)}</span></td>
                : <><td><span className="rh-old">{c.oldText ?? fmt(c.old)}</span></td><td><span className="rh-arrow">←</span> <b className="rh-new">{c.newText ?? fmt(c.new)}</b></td></>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Full history of one record: its own changes, changes of related records, business events and usage (opened / printed / exported). */
export function HistoryDrawer({ entityType, id, title, open, onClose }: { entityType: string; id?: number | string | null; title?: React.ReactNode; open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'all' | 'changes' | 'usage'>('all');
  const [related, setRelated] = useState(true);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [userId, setUserId] = useState<number | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<Item[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; pageSize: number; title?: string | null }>({ total: 0, page: 1, pageSize: 100 });
  const [loading, setLoading] = useState(false);

  const load = useCallback((page = 1) => {
    if (id == null) return;
    setLoading(true);
    api<any>(`/history/${entityType}/${id}`, { query: {
      related, kind: kind === 'all' ? undefined : kind, page, pageSize: 100, userId,
      from: range?.[0].format('YYYY-MM-DD'), to: range?.[1].format('YYYY-MM-DD'),
    } })
      .then(r => {
        setItems(prev => (page === 1 ? r.items : [...prev, ...r.items]));
        if (page === 1) setEvents((r.events ?? []).map((e: any) => ({ ...e, kind: 'event', action: 'event', userName: e.userName, self: true })));
        setMeta({ total: r.total, page: r.page, pageSize: r.pageSize, title: r.title });
      })
      .catch(e => message.error(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [entityType, id, related, kind, range, userId]);
  useEffect(() => { if (open) load(1); }, [open, load]);

  const all = useMemo(() => {
    const ev = kind === 'usage' ? [] : events.filter(e => (!userId || e.userId === userId)
      && (!range || (dayjs(e.occurredAt).isAfter(range[0].startOf('day')) && dayjs(e.occurredAt).isBefore(range[1].endOf('day')))));
    return [...items, ...ev].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [items, events, kind, userId, range]);
  const users = useMemo(() => {
    const m = new Map<number, string>();
    [...items, ...events].forEach(i => { if (i.userId) m.set(i.userId, i.userName ?? `#${i.userId}`); });
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [items, events]);
  const days = useMemo(() => {
    const g = new Map<string, Item[]>();
    all.forEach(i => { const d = dayjs(i.occurredAt).format('YYYY-MM-DD'); if (!g.has(d)) g.set(d, []); g.get(d)!.push(i); });
    return [...g.entries()];
  }, [all]);

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['التاريخ', 'المستخدم', 'العملية', 'السجل', 'الحقل', 'القيمة السابقة', 'القيمة الجديدة'].map(esc).join(',')];
    all.forEach(i => {
      const rec = i.self ? entityLabel(i.entityType) : `${entityLabel(i.entityType)} ${i.recordName ?? `#${i.entityId}`}`;
      const base = [dayjs(i.occurredAt).format('YYYY-MM-DD HH:mm:ss'), i.userName ?? '', ACTION_STYLE[i.action]?.label ?? i.action, rec];
      if (i.kind === 'event') lines.push([...base, '', '', i.description ?? ''].map(esc).join(','));
      else if (!i.changes?.length) lines.push([...base, '', '', ''].map(esc).join(','));
      else i.changes.forEach(c => lines.push([...base, fieldLabel(c.field), c.oldText ?? fmt(c.old), c.newText ?? fmt(c.new)].map(esc).join(',')));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `سجل-${entityLabel(entityType)}-${id}.csv`;
    a.click();
  };

  return (
    <Drawer open={open} onClose={onClose} width={720} destroyOnHidden
      title={<Space><HistoryOutlined /><span>السجل الكامل — {title ?? meta.title ?? `${entityLabel(entityType)} #${id}`}</span></Space>}
      extra={<Space><Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={() => load(1)} /></Tooltip><Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!all.length}>Excel</Button></Space>}>
      <style>{`
        .rh-day { font-weight: 700; color: #555; margin: 14px 0 8px; font-size: 13px; border-bottom: 1px dashed #e5e5e5; padding-bottom: 4px; }
        .rh-item { display: flex; gap: 10px; padding: 8px 10px; border-radius: 10px; background: #fafafa; margin-bottom: 8px; border-inline-start: 4px solid; }
        .rh-ico { font-size: 16px; margin-top: 2px; }
        .rh-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; }
        .rh-meta { font-size: 11.5px; color: #888; }
        .rh-table { width: 100%; margin-top: 6px; font-size: 12px; border-collapse: collapse; }
        .rh-table td { padding: 3px 6px; border-top: 1px solid #f0f0f0; vertical-align: top; }
        .rh-f { color: #666; width: 150px; white-space: nowrap; }
        .rh-old { color: #a8071a; text-decoration: line-through; opacity: .8; }
        .rh-new { color: #135200; }
        .rh-arrow { color: #bbb; }
      `}</style>
      <Space wrap style={{ marginBottom: 10 }}>
        <Segmented value={kind} onChange={v => setKind(v as any)} options={[{ value: 'all', label: 'الكل' }, { value: 'changes', label: 'التغييرات' }, { value: 'usage', label: 'الفتح والطباعة' }]} />
        <Tooltip title="يشمل تغييرات السجلات المرتبطة (مثلاً قراءات العداد، وحدات وعقود وفواتير المبنى)">
          <Space size={4}><Switch size="small" checked={related} onChange={setRelated} /><Text style={{ fontSize: 12 }}><LinkOutlined /> السجلات المرتبطة</Text></Space>
        </Tooltip>
        <Select allowClear placeholder="كل المستخدمين" style={{ width: 160 }} value={userId} onChange={setUserId} options={users} />
        <DatePicker.RangePicker value={range as any} onChange={r => setRange(r as any)} />
      </Space>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{meta.total.toLocaleString()} عملية مسجلة{events.length ? ` + ${events.length} حدث` : ''}</div>
      <Spin spinning={loading}>
        {!all.length && !loading ? <Empty description="لا يوجد سجل" /> : days.map(([d, list]) => (
          <div key={d}>
            <div className="rh-day">{dayjs(d).format('dddd YYYY-MM-DD')}</div>
            {list.map(i => {
              const st = ACTION_STYLE[i.action] ?? { label: i.action, color: '#595959' };
              return (
                <div key={`${i.kind}-${i.id}`} className="rh-item" style={{ borderInlineStartColor: st.color }}>
                  <span className="rh-ico" style={{ color: st.color }}>{ICONS[i.action] ?? <HistoryOutlined />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rh-head">
                      <Tag color={st.color} style={{ margin: 0 }}>{st.label}</Tag>
                      {i.kind === 'event' ? <b>{i.description}</b>
                        : i.self === false ? <span><LinkOutlined /> {entityLabel(i.entityType)} <b>{i.recordName ?? `#${i.entityId}`}</b></span>
                        : <span>{entityLabel(i.entityType)}</span>}
                    </div>
                    <div className="rh-meta">
                      <UserOutlined /> {i.userName ?? 'النظام'} · {dayjs(i.occurredAt).format('HH:mm:ss')}
                      {i.ipAddress && <> · <GlobalOutlined /> {i.ipAddress}</>}
                      {i.requestPath && i.kind === 'change' && <Text type="secondary" style={{ fontSize: 11 }}> · {i.requestPath}</Text>}
                    </div>
                    {i.kind !== 'event' && <ChangeTable item={i} />}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {items.length < meta.total && <div style={{ textAlign: 'center' }}><Button onClick={() => load(meta.page + 1)} loading={loading}>عرض المزيد</Button></div>}
      </Spin>
    </Drawer>
  );
}

/** «السجل» button that opens the full history of a record. Shown only to users with audit.view. */
export function HistoryButton({ entityType, id, title, size = 'small', label = 'السجل', type }: {
  entityType: string; id?: number | string | null; title?: React.ReactNode; size?: 'small' | 'middle' | 'large'; label?: React.ReactNode | null; type?: 'default' | 'text' | 'link';
}) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  if (id == null || !can('audit.view')) return null;
  return (
    <>
      <Tooltip title="السجل الكامل: كل التغييرات ومن قام بها ومتى">
        <Button size={size} type={type} icon={<HistoryOutlined />} onClick={e => { e.stopPropagation(); setOpen(true); }}>{label}</Button>
      </Tooltip>
      <HistoryDrawer entityType={entityType} id={id} title={title} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Records that a record was opened (usage history). */
export function useTrackView(entityType: string, id?: number | string | null, title?: string) {
  useEffect(() => {
    if (id == null) return;
    import('../../api/track').then(m => m.track('view', { entityType, entityId: id, title }));
  }, [entityType, id]); // eslint-disable-line react-hooks/exhaustive-deps
}
