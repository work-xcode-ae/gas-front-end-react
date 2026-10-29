/**
 * Service-request tracker of a villa (Restaurants & Villas module) — same workflow / actions / history / attachments as the unit
 * tracker (Buildings/ServiceRequestTracker.tsx, unchanged) but listed by the villa's building, because a villa has no units.
 * Uses the existing /service-requests endpoints (assign, status, complete, history, attachments).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Input, Radio, Spin, Timeline, Tooltip, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DownOutlined, EditOutlined, FieldTimeOutlined, HistoryOutlined,
  PaperClipOutlined, PhoneOutlined, PlusOutlined, UploadOutlined, FileImageOutlined, FileOutlined, CalendarOutlined, ReloadOutlined, ShopOutlined, UpOutlined, UserOutlined, UserSwitchOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE, api, apiUpload, errorMessage, type Paged, authFetch } from '../../api/client';
import { AssigneePicker, PRIORITY_STYLE, SR_FLOW_CSS, SR_STATUS, SrFlow, useAssignees, type SrRow, type SrStatus } from '../Buildings/ServiceRequestTracker';

const PRIMARY = '#1a5c2a';

// ── API shapes ──
interface HistoryRow {
  id: number; action: string; description?: string; at: string; user?: string | null; from?: string | null; to?: string | null; note?: string | null;
  assignee?: string | null; vendor?: string | null; completedAt?: string | null; attachments?: number;
}
interface Attachment { id: number; fileName?: string; mimeType?: string; sizeBytes?: number; createdAt?: string }

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip';
const MAX_FILES = 10;
const kb = (n?: number) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Attachments need the bearer token → fetch as a blob, then open it in a new tab (images / pdf) or download it. */
async function openAttachment(a: Attachment) {
  const w = window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}/service-requests/attachments/${a.id}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'الملف غير موجود' : `تعذر تحميل الملف (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const viewable = /^image\/|pdf/.test(a.mimeType ?? '');
    if (w && viewable) w.location.href = url;
    else {
      w?.close();
      const link = document.createElement('a');
      link.href = url; link.download = a.fileName ?? 'attachment'; link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    w?.close();
    message.error(errorMessage(e));
  }
}
type ActKind = 'assign' | 'complete' | 'cancel' | 'reopen';

const fmt = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—');
const ago = (v?: string | null) => {
  if (!v) return '';
  const m = Math.max(0, dayjs().diff(dayjs(v), 'minute'));
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
};
const duration = (from: string, to?: string | null) => {
  const h = dayjs(to ?? undefined).diff(dayjs(from), 'hour');
  return h < 24 ? `${h} ساعة` : `${Math.floor(h / 24)} يوم ${h % 24 ? `و ${h % 24} ساعة` : ''}`;
};
const isOpen = (s?: string) => s === 'pending' || s === 'in_progress';
const overdue = (r: SrRow) => isOpen(r.status) && dayjs().diff(dayjs(r.requestedAt), 'hour') > (PRIORITY_STYLE[r.priority ?? 'medium']?.slaHours ?? 72);

/** created / last-changed info of a request (premises audit endpoint) */
interface Audit { id: number; createdAt?: string | null; createdBy?: string | null; updatedAt?: string | null; updatedBy?: string | null; steps: number }

interface Props {
  /** the villa's host building — a villa has no units, so its requests are those of its building */
  buildingId: number;
  /** the villa (premises) id — used for the created-by / last-update-by info of each request */
  premisesId: number;
  /** false → «طلب جديد» is disabled (no valid maintenance contract); the reason is shown as a tooltip */
  canNew?: boolean;
  newDisabledReason?: string | null;
  /** restaurant: the building is shared → keep only the site's own requests (those returned by the audit endpoint) */
  scopeToAudit?: boolean;
  /** «الفيلا» / «المطعم» — used in the empty-list text */
  siteLabel?: string;
  /** external reload trigger */
  reloadKey?: number;
  /** request to open and flash (e.g. the one just created) */
  highlightId?: number | null;
  /** after any change, so the drawer / building drawing reload */
  onChanged?: () => void;
  onNew: () => void;
  /** reports counts so the parent can label its tab */
  onCounts?: (open: number, total: number) => void;
}

type Filter = 'open' | 'all' | SrStatus;

const VillaServiceRequestTracker: React.FC<Props> = ({ buildingId, premisesId, scopeToAudit, siteLabel = 'الفيلا', canNew = true, newDisabledReason, reloadKey, highlightId, onChanged, onNew, onCounts }) => {
  const [rows, setRows] = useState<SrRow[]>([]);
  const [audit, setAudit] = useState<Record<number, Audit>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [expanded, setExpanded] = useState<number | null>(highlightId ?? null);
  const [histories, setHistories] = useState<Record<number, HistoryRow[] | 'loading'>>({});
  const [attachments, setAttachments] = useState<Record<number, Attachment[]>>({});
  /** completion form: date the work was finished + files (both optional) */
  const [doneAt, setDoneAt] = useState<dayjs.Dayjs | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [act, setAct] = useState<{ id: number; kind: ActKind } | null>(null);
  const [note, setNote] = useState('');
  const [assignKind, setAssignKind] = useState<'none' | 'user' | 'vendor'>('user');
  const [assignId, setAssignId] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const assignees = useAssignees(true);

  const loadHistory = useCallback((id: number) => {
    setHistories(h => ({ ...h, [id]: 'loading' }));
    api<HistoryRow[]>(`/service-requests/${id}/history`)
      .then(r => setHistories(h => ({ ...h, [id]: r })))
      .catch(() => setHistories(h => ({ ...h, [id]: [] })));
    api<Attachment[]>(`/service-requests/${id}/attachments`)
      .then(r => setAttachments(x => ({ ...x, [id]: r })))
      .catch(() => setAttachments(x => ({ ...x, [id]: [] })));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        api<Paged<SrRow>>('/service-requests', { query: { buildingId, pageSize: 100 } }),
        api<Audit[]>(`/premises/${premisesId}/service-requests/audit`).catch(() => [] as Audit[]),
      ]);
      setAudit(Object.fromEntries(a.map(x => [x.id, x])));
      if (scopeToAudit) { const own = new Set(a.map(x => x.id)); r.items = r.items.filter(x => own.has(x.id)); }
      setRows(r.items);
      onCounts?.(r.items.filter(x => isOpen(x.status)).length, r.items.length);
      if (!r.items.some(x => isOpen(x.status))) setFilter(f => (f === 'open' ? 'all' : f));
    } catch (e) {
      message.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [buildingId, premisesId, scopeToAudit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => { if (highlightId) { setExpanded(highlightId); loadHistory(highlightId); } }, [highlightId, loadHistory]);

  const counts = useMemo(() => {
    const c: Record<SrStatus, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    rows.forEach(r => { if (r.status && r.status in c) c[r.status]++; });
    return c;
  }, [rows]);
  const shown = rows.filter(r => filter === 'all' ? true : filter === 'open' ? isOpen(r.status) : r.status === filter);

  const toggle = (id: number) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !histories[next]) loadHistory(next);
  };

  const startAct = (r: SrRow, kind: ActKind) => {
    setAct({ id: r.id, kind }); setNote(''); setDoneAt(dayjs()); setFiles([]);
    setAssignKind(r.assignedVendorId ? 'vendor' : 'user');
    setAssignId(r.assignedVendorId ?? r.assignedTo ?? undefined);
    if (expanded !== r.id) { setExpanded(r.id); if (!histories[r.id]) loadHistory(r.id); }
  };

  const submit = async () => {
    if (!act) return;
    if (act.kind === 'cancel' && !note.trim()) { message.warning('اذكر سبب الإلغاء'); return; }
    if (act.kind === 'assign' && !assignId) { message.warning('اختر الفني أو المقاول'); return; }
    setBusy(true);
    try {
      if (act.kind === 'assign') {
        await api(`/service-requests/${act.id}/assign`, { body: {
          assignedTo: assignKind === 'user' ? assignId : null, assignedVendorId: assignKind === 'vendor' ? assignId : null, notes: note.trim() || undefined,
        } });
        message.success('تم إسناد الطلب — الحالة الآن: قيد التنفيذ');
      } else if (act.kind === 'complete') {
        const fd = new FormData();
        if (note.trim()) fd.append('notes', note.trim());
        if (doneAt) fd.append('completedAt', doneAt.toISOString());
        files.forEach(f => { if (f.originFileObj) fd.append('files', f.originFileObj as File, f.name); });
        await apiUpload(`/service-requests/${act.id}/complete`, fd);
        message.success(files.length ? `تم إغلاق الطلب كمكتمل مع ${files.length} مرفق` : 'تم إغلاق الطلب كمكتمل');
      } else {
        const status = act.kind === 'cancel' ? 'cancelled' : 'pending';
        await api(`/service-requests/${act.id}/status`, { body: { status, notes: note.trim() || undefined } });
        message.success(act.kind === 'cancel' ? 'تم إلغاء الطلب' : 'تمت إعادة فتح الطلب');
      }
      const id = act.id;
      setAct(null);
      await load();
      loadHistory(id);
      onChanged?.();
    } catch (e) {
      message.error(errorMessage(e), 6);
    } finally {
      setBusy(false);
    }
  };

  const historyItem = (h: HistoryRow) => {
    const to = (h.to ?? '') as SrStatus;
    let color = '#999', title: React.ReactNode = h.description;
    if (h.action === 'create') { color = SR_STATUS.pending.color; title = 'تم استلام الطلب'; }
    else if (h.action === 'assign') { color = SR_STATUS.in_progress.color; title = <>أُسند إلى <b>{h.assignee ?? h.vendor ?? '—'}</b>{h.vendor && h.assignee ? ` / ${h.vendor}` : ''}</>; }
    else if (h.action === 'status_change' && SR_STATUS[to]) {
      color = SR_STATUS[to].color;
      title = h.from === 'completed' || h.from === 'cancelled' ? 'أُعيد فتح الطلب' : <>تغيرت الحالة إلى <b style={{ color }}>{SR_STATUS[to].label}</b></>;
    }
    return {
      color,
      children: (
        <div>
          <div style={{ fontSize: 12.5 }}>{title}</div>
          {h.completedAt && <div style={{ fontSize: 12, color: '#2e7d32' }}><CalendarOutlined /> تاريخ الإنجاز: {fmt(h.completedAt)}</div>}
          {h.note && <div className="sr-hist-note">{h.note}</div>}
          {!!h.attachments && <div style={{ fontSize: 11.5, color: '#666' }}><PaperClipOutlined /> {h.attachments} مرفق</div>}
          <div style={{ fontSize: 11, color: '#999' }}>{fmt(h.at)}{h.user ? ` · ${h.user}` : ''}</div>
        </div>
      ),
    };
  };

  const actionForm = (r: SrRow) => act && act.id === r.id && (
    <div className="sr-act">
      <div className="sr-act-title">
        {act.kind === 'assign' ? (r.status === 'in_progress' ? 'تغيير الإسناد' : 'إسناد الطلب وبدء التنفيذ')
          : act.kind === 'complete' ? 'إغلاق الطلب كمكتمل' : act.kind === 'cancel' ? 'إلغاء الطلب' : 'إعادة فتح الطلب'}
      </div>
      {act.kind === 'assign' && (
        <div style={{ marginBottom: 8 }}>
          <AssigneePicker assignees={assignees} kind={assignKind} onKind={setAssignKind} value={assignId} onChange={setAssignId} />
        </div>
      )}
      {act.kind === 'complete' && (
        <div className="sr-field">
          <div className="sr-label">تاريخ ووقت الإنجاز <span className="opt">(اختياري)</span></div>
          <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" value={doneAt} onChange={setDoneAt} style={{ width: '100%' }}
            placeholder="الآن" disabledDate={x => x.isAfter(dayjs(), 'day') || x.isBefore(dayjs(r.requestedAt), 'day')} />
        </div>
      )}
      {act.kind === 'complete' && <div className="sr-label">ملاحظات الإنجاز <span className="opt">(اختياري)</span></div>}
      <Input.TextArea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={500}
        placeholder={act.kind === 'complete' ? 'مثال: تم استبدال الصمام وفحص التسريب'
          : act.kind === 'cancel' ? 'سبب الإلغاء (مطلوب)' : 'ملاحظة (اختياري)'} />
      {act.kind === 'complete' && (
        <div className="sr-field" style={{ marginTop: 10 }}>
          <div className="sr-label">المرفقات <span className="opt">(اختياري — صور، تقرير الفني … حتى {MAX_FILES} ملفات)</span></div>
          <Upload multiple accept={ACCEPT} fileList={files} maxCount={MAX_FILES}
            beforeUpload={f => {
              if (f.size > 20 * 1024 * 1024) { message.warning(`${f.name}: الحد الأقصى 20 ميجابايت`); return Upload.LIST_IGNORE; }
              return false; // keep locally — sent together with «تأكيد»
            }}
            onChange={({ fileList }) => setFiles(fileList.slice(0, MAX_FILES))}>
            <Button size="small" icon={<UploadOutlined />} disabled={files.length >= MAX_FILES}>إضافة مرفق</Button>
          </Upload>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <Button size="small" onClick={() => setAct(null)} disabled={busy}>تراجع</Button>
        <Button size="small" type="primary" loading={busy} onClick={submit} danger={act.kind === 'cancel'}
          icon={act.kind === 'complete' ? <CheckCircleOutlined /> : undefined}
          style={act.kind === 'cancel' ? undefined : { background: PRIMARY, borderColor: PRIMARY }}>{act.kind === 'complete' ? 'إكمال الطلب' : 'تأكيد'}</Button>
      </div>
    </div>
  );

  return (
    <div>
      <style>{`
        ${SR_FLOW_CSS}
        .sr-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
        .sr-tile { border-radius: 10px; padding: 8px 10px; cursor: pointer; border: 2px solid transparent; transition: all .15s; user-select: none; }
        .sr-tile .n { font-size: 20px; font-weight: 800; line-height: 1.2; }
        .sr-tile .k { font-size: 11.5px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
        .sr-filter { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
        .sr-card { background: #fff; border: 1px solid #e8ece8; border-radius: 12px; margin-bottom: 10px; overflow: hidden; transition: box-shadow .2s; }
        .sr-card.hl { box-shadow: 0 0 0 2px #c9a84c, 0 4px 14px rgba(201,168,76,.25); }
        .sr-card-head { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px 6px; cursor: pointer; }
        .sr-no { font-family: monospace; font-weight: 700; color: ${PRIMARY}; font-size: 13px; }
        .sr-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px; border-radius: 12px; font-size: 11.5px; font-weight: 700; }
        .sr-desc { font-size: 13px; color: #333; margin-top: 3px; }
        .sr-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0 14px 4px; font-size: 11.5px; color: #7a857c; }
        .sr-meta b { color: #444; font-weight: 600; }
        .sr-audit { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 2px 14px 4px; padding: 5px 10px; border-radius: 8px; background: #f6f8f6; font-size: 11.5px; color: #7a857c; }
        .sr-audit b { color: #444; font-weight: 600; }
        .sr-actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 14px 12px; border-top: 1px dashed #eef0ee; }
        .sr-body { padding: 4px 14px 4px; background: #fafbfa; border-top: 1px solid #f0f2f0; }
        .sr-act { background: #fffbf0; border: 1px solid #f0e2bd; border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
        .sr-act-title { font-weight: 700; font-size: 13px; color: #8a6d1f; margin-bottom: 8px; }
        .sr-label { font-size: 12px; font-weight: 600; color: #555; margin-bottom: 4px; }
        .sr-label .opt { font-weight: 400; color: #999; }
        .sr-field { margin-bottom: 8px; }
        .sr-files { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
        .sr-file { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; background: #fff; border: 1px solid #e3e8e3;
          font-size: 12px; cursor: pointer; max-width: 100%; }
        .sr-file:hover { border-color: ${PRIMARY}; color: ${PRIMARY}; }
        .sr-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px; }
        .sr-hist-note { font-size: 12px; color: #555; background: #f3f5f3; border-radius: 6px; padding: 3px 8px; margin: 3px 0; white-space: pre-wrap; }
        .sr-notes { font-size: 11.5px; color: #6b7a6e; white-space: pre-wrap; background: #f5f0e8; border-radius: 8px; padding: 6px 10px; margin: 8px 0; }
      `}</style>

      {/* status tiles (click to filter) */}
      <div className="sr-tiles">
        {(Object.keys(SR_STATUS) as SrStatus[]).map(s => {
          const st = SR_STATUS[s];
          const on = filter === s;
          return (
            <div key={s} className="sr-tile" role="button" tabIndex={0} onClick={() => setFilter(on ? 'all' : s)}
              onKeyDown={e => { if (e.key === 'Enter') setFilter(on ? 'all' : s); }}
              style={{ background: st.bg, borderColor: on ? st.color : 'transparent' }}>
              <div className="n" style={{ color: st.color }}>{counts[s]}</div>
              <div className="k" style={{ color: st.color }}>{st.icon} {st.label}</div>
            </div>
          );
        })}
      </div>

      <div className="sr-filter">
        <Radio.Group size="small" value={filter === 'open' || filter === 'all' ? filter : undefined} onChange={e => setFilter(e.target.value)} optionType="button">
          <Radio.Button value="open">المفتوحة ({counts.pending + counts.in_progress})</Radio.Button>
          <Radio.Button value="all">الكل ({rows.length})</Radio.Button>
        </Radio.Group>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="تحديث"><Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading} /></Tooltip>
          <Tooltip title={canNew ? undefined : newDisabledReason}><Button size="small" type="primary" icon={<PlusOutlined />} disabled={!canNew} style={canNew ? { background: PRIMARY, borderColor: PRIMARY } : undefined} onClick={onNew}>طلب جديد</Button></Tooltip>
        </div>
      </div>

      <Spin spinning={loading && rows.length > 0}>
        {loading && rows.length === 0 ? <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
          : shown.length === 0 ? (
            <Empty style={{ padding: '24px 0' }} description={rows.length === 0 ? `لا توجد طلبات خدمة لهذا ${siteLabel === 'الفيلا' ? 'العقار' : 'المطعم'}` : 'لا توجد طلبات بهذه الحالة'}>
              {rows.length === 0 && canNew && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={onNew}>إنشاء طلب خدمة</Button>}
            </Empty>
          ) : shown.map(r => {
            const st = SR_STATUS[r.status ?? 'pending'] ?? SR_STATUS.pending;
            const pr = PRIORITY_STYLE[r.priority ?? 'medium'] ?? PRIORITY_STYLE.medium;
            const open = expanded === r.id;
            const hist = histories[r.id];
            const late = overdue(r);
            const who = r.assignee ?? r.vendor;
            const phone = r.assignee ? r.assigneePhone : r.vendorPhone;
            return (
              <div key={r.id} className={`sr-card${highlightId === r.id ? ' hl' : ''}`}>
                <div className="sr-card-head" onClick={() => toggle(r.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="sr-no">{r.requestNo}</span>
                      <span className="sr-pill" style={{ color: st.color, background: st.bg }}>{st.icon} {st.label}</span>
                      <span className="sr-pill" style={{ color: pr.color, background: pr.bg }}>{pr.label}</span>
                      {late && <span className="sr-pill" style={{ color: '#fff', background: '#c62828' }}><WarningOutlined /> متأخر عن المهلة ({pr.slaHours} ساعة)</span>}
                    </div>
                    <div className="sr-desc">{r.description}</div>
                  </div>
                  <span style={{ color: '#aaa', paddingTop: 2 }}>{open ? <UpOutlined /> : <DownOutlined />}</span>
                </div>

                <div className="sr-meta">
                  <span><FieldTimeOutlined /> {fmt(r.requestedAt)} · {ago(r.requestedAt)}</span>
                  <span>{r.vendor && !r.assignee ? <ShopOutlined /> : <UserOutlined />} {who ? <b>{who}</b> : 'غير مُسند'}
                    {phone && <> · <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} style={{ direction: 'ltr' }}><PhoneOutlined /> {phone}</a></>}</span>
                  {r.closedAt ? <span>أُغلق {fmt(r.closedAt)} · مدة المعالجة <b>{duration(r.requestedAt, r.closedAt)}</b></span>
                    : <span>مفتوح منذ <b>{duration(r.requestedAt)}</b></span>}
                </div>

                {audit[r.id] && (
                  <div className="sr-audit">
                    <span><PlusOutlined /> أُنشئ <b>{fmt(audit[r.id].createdAt)}</b> بواسطة <b>{audit[r.id].createdBy ?? '—'}</b></span>
                    <span><EditOutlined /> آخر تحديث <b>{fmt(audit[r.id].updatedAt)}</b> بواسطة <b>{audit[r.id].updatedBy ?? '—'}</b> · {ago(audit[r.id].updatedAt)}</span>
                    <span><HistoryOutlined /> {audit[r.id].steps} خطوة في السجل</span>
                  </div>
                )}

                <SrFlow status={r.status ?? 'pending'} />

                {open && (
                  <div className="sr-body">
                    {actionForm(r)}
                    {r.notes && <div className="sr-notes">{r.notes}</div>}
                    {(attachments[r.id]?.length ?? 0) > 0 && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#555', marginTop: 8 }}><PaperClipOutlined /> المرفقات ({attachments[r.id].length})</div>
                        <div className="sr-files">
                          {attachments[r.id].map(a => (
                            <Tooltip key={a.id} title={`${a.fileName ?? ''} · ${kb(a.sizeBytes)}`}>
                              <div className="sr-file" role="button" tabIndex={0} onClick={() => openAttachment(a)}
                                onKeyDown={e => { if (e.key === 'Enter') openAttachment(a); }}>
                                {(a.mimeType ?? '').startsWith('image/') ? <FileImageOutlined /> : <FileOutlined />}
                                <span>{a.fileName ?? `ملف ${a.id}`}</span>
                              </div>
                            </Tooltip>
                          ))}
                        </div>
                      </>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: '#555', margin: '8px 0' }}><HistoryOutlined /> سجل المتابعة</div>
                    {hist === 'loading' || hist === undefined ? <Spin size="small" />
                      : hist.length === 0 ? <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>لا يوجد سجل لهذا الطلب.</div>
                      : <Timeline style={{ marginTop: 6, marginBottom: -12 }} items={hist.map(historyItem)} />}
                  </div>
                )}

                {!(act && act.id === r.id) && (
                  <div className="sr-actions">
                    {r.status === 'pending' && <Button size="small" type="primary" icon={<UserSwitchOutlined />} style={{ background: SR_STATUS.in_progress.color, borderColor: SR_STATUS.in_progress.color }} onClick={() => startAct(r, 'assign')}>إسناد وبدء التنفيذ</Button>}
                    {r.status === 'in_progress' && <Button size="small" icon={<UserSwitchOutlined />} onClick={() => startAct(r, 'assign')}>تغيير الإسناد</Button>}
                    {isOpen(r.status) && <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => startAct(r, 'complete')}>إغلاق كمكتمل</Button>}
                    {isOpen(r.status) && <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => startAct(r, 'cancel')}>إلغاء</Button>}
                    {!isOpen(r.status) && <Button size="small" icon={<ReloadOutlined />} onClick={() => startAct(r, 'reopen')}>إعادة فتح</Button>}
                    {!open && <Button size="small" type="link" icon={<HistoryOutlined />} onClick={() => toggle(r.id)}>سجل المتابعة</Button>}
                  </div>
                )}
              </div>
            );
          })}
      </Spin>
    </div>
  );
};

export default VillaServiceRequestTracker;
