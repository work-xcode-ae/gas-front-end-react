import React, { useEffect, useState } from 'react';
import { Button, Empty, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined, DashboardOutlined, DatabaseOutlined, DownOutlined, EnvironmentOutlined, FireOutlined, HistoryOutlined,
  PlusOutlined, ReloadOutlined, SwapOutlined, UpOutlined, CloseCircleOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';
const WARNING = '#fa8c16';

// ── GET /units/{id}/meters ──
interface MeterReadingRow {
  id: number; readingDate: string; readingValue: number; consumption?: number | null; type?: string | null; typeLabel?: string | null;
  method?: string | null; billed: boolean; readBy?: string | null; notes?: string | null;
}
interface Installation {
  assignmentId: number; meterId: number; meterNo: string; serial?: string; type?: string; typeLabel?: string; brand?: string | null; model?: string | null;
  calibrationDate?: string | null; initialReading?: number | null; location?: string | null; status?: string; statusLabel?: string;
  fromDate: string; toDate?: string | null; isCurrent: boolean; days: number;
  openingReading?: number | null; closingReading?: number | null; lastReading?: number | null; lastReadingDate?: string | null;
  consumption: number; readingsCount: number; endReason?: 'replaced' | 'removed' | 'ended' | null;
  readings: MeterReadingRow[];
}
interface MeterHistory { current: Installation | null; history: Installation[]; totals: { meters: number; installations: number; consumption: number } }

const READING_TYPE: Record<string, { label: string; color: string }> = {
  opening: { label: 'افتتاحية', color: 'green' }, periodic: { label: 'دورية', color: 'default' }, closing: { label: 'ختامية', color: 'red' },
  replacement_out: { label: 'استبدال – قديم', color: 'orange' }, replacement_in: { label: 'استبدال – جديد', color: 'blue' }, removal: { label: 'فك العداد', color: 'volcano' },
};
const END_REASON: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  current: { label: 'مركّب حالياً', color: PRIMARY, icon: <CheckCircleOutlined /> },
  replaced: { label: 'تم استبداله', color: '#d46b08', icon: <SwapOutlined /> },
  removed: { label: 'تم فكّه', color: '#c62828', icon: <CloseCircleOutlined /> },
  ended: { label: 'انتهى التركيب', color: '#8c8c8c', icon: <CloseCircleOutlined /> },
};

const d = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '—');
const m3 = (v?: number | null) => (v == null ? '—' : `${Number(v).toLocaleString()} م³`);
const span = (days: number) => {
  if (days < 31) return `${days} يوم`;
  const mo = Math.floor(days / 30.44);
  return mo < 12 ? `${mo} شهر` : `${Math.floor(mo / 12)} سنة${mo % 12 ? ` و${mo % 12} شهر` : ''}`;
};

interface Props {
  unitId: number;
  /** changes after any save in the unit panel → reload */
  refreshKey: number;
  canManage?: boolean;
  onInstall: () => void;
  onReading: () => void;
  /** total installations, for the tab label */
  onCount?: (n: number) => void;
}

const UnitMetersTab: React.FC<Props> = ({ unitId, refreshKey, canManage, onInstall, onReading, onCount }) => {
  const [data, setData] = useState<MeterHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    api<MeterHistory>(`/units/${unitId}/meters`)
      .then(r => { if (alive) { setData(r); onCount?.(r.history.length); } })
      .catch(e => { if (alive) setError(errorMessage(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [unitId, refreshKey, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = data?.current ?? null;
  const past = (data?.history ?? []).filter(h => !h.isCurrent);

  const readingsTable = (h: Installation) => (
    <Table<MeterReadingRow> size="small" rowKey="id" dataSource={h.readings} pagination={h.readings.length > 6 ? { pageSize: 6, size: 'small' } : false}
      locale={{ emptyText: 'لا توجد قراءات خلال هذه الفترة' }}
      columns={[
        { title: 'التاريخ', dataIndex: 'readingDate', width: 96, render: (v: string) => <Text style={{ fontSize: 12 }}>{d(v)}</Text> },
        { title: 'القراءة', dataIndex: 'readingValue', width: 110, render: (v: number) => <Text strong style={{ fontSize: 12, color: PRIMARY }}>{m3(v)}</Text> },
        { title: 'الاستهلاك', dataIndex: 'consumption', width: 96, render: (v?: number | null) => <Text style={{ fontSize: 12, color: WARNING }}>{v == null ? '—' : m3(v)}</Text> },
        { title: 'النوع', dataIndex: 'type', width: 104, render: (v: string | null, r: MeterReadingRow) => {
          const t = READING_TYPE[v ?? 'periodic'] ?? READING_TYPE.periodic;
          return <Tag color={t.color} style={{ fontSize: 10 }}>{r.typeLabel ?? t.label}</Tag>;
        } },
        { title: 'الفوترة', dataIndex: 'billed', width: 86, render: (v: boolean) => <Tag color={v ? 'success' : 'warning'} style={{ fontSize: 10 }}>{v ? 'مفوترة' : 'غير مفوترة'}</Tag> },
        { title: 'القارئ', dataIndex: 'readBy', render: (v: string | null | undefined, r: MeterReadingRow) => <Text style={{ fontSize: 11 }} title={r.notes ?? undefined}>{v ?? '—'}</Text> },
      ]} />
  );

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
  if (error) return <Empty description={error}><Button icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)}>إعادة المحاولة</Button></Empty>;

  return (
    <Spin spinning={loading}>
      <style>{`
        .um-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .um-tile { border-radius: 10px; padding: 10px 12px; }
        .um-tile .k { font-size: 11px; color: #777; }
        .um-tile .v { font-size: 18px; font-weight: 800; line-height: 1.3; }
        .um-cur { border-radius: 14px; overflow: hidden; border: 1px solid #e3e8e3; margin-bottom: 18px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.05); }
        .um-cur-head { background: linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%); border-bottom: 3px solid ${GOLD}; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
        .um-cur-icon { width: 46px; height: 46px; border-radius: 12px; background: rgba(201,168,76,.18); color: ${GOLD}; font-size: 22px; display: flex; align-items: center; justify-content: center; }
        .um-cur-no { color: #fff; font-family: monospace; font-weight: 800; font-size: 20px; }
        .um-cur-sub { color: rgba(255,255,255,.72); font-size: 12px; }
        .um-live { margin-inline-start: auto; background: rgba(82,196,26,.18); color: #b7eb8f; border: 1px solid rgba(183,235,143,.4); border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
        .um-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #eef0ee; }
        .um-grid > div { background: #fff; padding: 10px 12px; }
        .um-grid .k { font-size: 11px; color: #888; }
        .um-grid .v { font-size: 14px; font-weight: 700; color: #263238; }
        .um-cur-foot { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; padding: 10px 14px; font-size: 12px; color: #6b7a6e; border-top: 1px solid #eef0ee; }
        .um-h-title { font-weight: 700; font-size: 13.5px; color: #333; margin: 4px 0 10px; display: flex; align-items: center; gap: 6px; }
        .um-tl { position: relative; padding-inline-start: 22px; }
        .um-tl::before { content: ''; position: absolute; inset-inline-start: 7px; top: 6px; bottom: 6px; width: 2px; background: #e3e7e3; }
        .um-item { position: relative; background: #fff; border: 1px solid #e8ece8; border-radius: 12px; margin-bottom: 10px; }
        .um-dot { position: absolute; inset-inline-start: -21px; top: 16px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px #d9d9d9; }
        .um-item-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; flex-wrap: wrap; }
        .um-item-no { font-family: monospace; font-weight: 800; color: ${PRIMARY}; font-size: 14px; }
        .um-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px; border-radius: 12px; font-size: 11.5px; font-weight: 700; }
        .um-item-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 0 12px 10px; font-size: 11.5px; color: #7a857c; }
        .um-item-meta b { display: block; color: #333; font-size: 12.5px; }
        .um-item-body { padding: 0 12px 10px; border-top: 1px dashed #eef0ee; }
      `}</style>

      {/* summary */}
      <div className="um-tiles">
        <div className="um-tile" style={{ background: '#e8f5e9' }}><div className="k">العدادات التي رُكّبت في الوحدة</div><div className="v" style={{ color: PRIMARY }}>{data?.totals.meters ?? 0}</div></div>
        <div className="um-tile" style={{ background: '#fff7e6' }}><div className="k">إجمالي الاستهلاك المسجّل</div><div className="v" style={{ color: '#d46b08' }}>{m3(data?.totals.consumption ?? 0)}</div></div>
        <div className="um-tile" style={{ background: '#e3f2fd' }}><div className="k">مدة العداد الحالي</div><div className="v" style={{ color: '#1565c0' }}>{cur ? span(cur.days) : '—'}</div></div>
      </div>

      {/* current meter */}
      {cur ? (
        <div className="um-cur">
          <div className="um-cur-head">
            <span className="um-cur-icon"><DashboardOutlined /></span>
            <div>
              <div className="um-cur-no">{cur.meterNo}</div>
              <div className="um-cur-sub">{[cur.serial ? `S/N ${cur.serial}` : null, cur.typeLabel, [cur.brand, cur.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="um-live">● العداد الحالي</span>
          </div>
          <div className="um-grid">
            <div><div className="k">مركّب منذ</div><div className="v">{d(cur.fromDate)}</div><div className="k">{span(cur.days)}</div></div>
            <div><div className="k">القراءة عند التركيب</div><div className="v">{m3(cur.openingReading)}</div></div>
            <div><div className="k">آخر قراءة</div><div className="v" style={{ color: PRIMARY }}>{m3(cur.lastReading)}</div><div className="k">{d(cur.lastReadingDate)}</div></div>
            <div><div className="k">الاستهلاك منذ التركيب</div><div className="v" style={{ color: '#d46b08' }}>{m3(cur.consumption)}</div><div className="k">{cur.readingsCount} قراءة</div></div>
          </div>
          <div className="um-cur-foot">
            {cur.location && <span><EnvironmentOutlined /> {cur.location}</span>}
            <span><SafetyCertificateOutlined /> المعايرة: {d(cur.calibrationDate)}</span>
            {cur.statusLabel && <Tag color={cur.status === 'active' ? 'success' : 'default'} style={{ margin: 0 }}>{cur.statusLabel}</Tag>}
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
              <Button size="small" icon={open === cur.assignmentId ? <UpOutlined /> : <HistoryOutlined />} onClick={() => setOpen(open === cur.assignmentId ? null : cur.assignmentId)}>
                قراءات هذا العداد
              </Button>
              {canManage && <Button size="small" type="primary" icon={<DatabaseOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={onReading}>تسجيل قراءة</Button>}
            </span>
          </div>
          {open === cur.assignmentId && <div style={{ padding: '0 12px 10px' }}>{readingsTable(cur)}</div>}
        </div>
      ) : (
        <Empty style={{ margin: '8px 0 20px' }} image={<FireOutlined style={{ fontSize: 40, color: '#ccc' }} />}
          description={past.length ? 'لا يوجد عداد مركّب حالياً — آخر عداد مذكور في السجل أدناه' : 'لم يُركّب أي عداد في هذه الوحدة بعد'}>
          {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: WARNING, borderColor: WARNING }} onClick={onInstall}>تركيب عداد</Button>}
        </Empty>
      )}

      {/* history */}
      <div className="um-h-title">
        <HistoryOutlined style={{ color: PRIMARY }} /> سجل العدادات في الوحدة
        <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>({data?.history.length ?? 0} تركيب)</Text>
        <Tooltip title="تحديث"><Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)} style={{ marginInlineStart: 'auto' }} /></Tooltip>
      </div>
      {(data?.history.length ?? 0) === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>لا يوجد سجل عدادات.</Text>
      ) : (
        <div className="um-tl">
          {data!.history.map(h => {
            const r = END_REASON[h.isCurrent ? 'current' : h.endReason ?? 'ended'];
            const isOpen = open === h.assignmentId;
            return (
              <div key={h.assignmentId} className="um-item">
                <span className="um-dot" style={{ background: r.color }} />
                <div className="um-item-head" onClick={() => setOpen(isOpen ? null : h.assignmentId)}>
                  <span className="um-item-no">{h.meterNo}</span>
                  <span className="um-pill" style={{ color: r.color, background: `${r.color}14` }}>{r.icon} {r.label}</span>
                  <span style={{ fontSize: 12, color: '#666' }}><CalendarOutlined /> {d(h.fromDate)} ← {h.toDate ? d(h.toDate) : 'الآن'} · {span(h.days)}</span>
                  <span style={{ marginInlineStart: 'auto', color: '#aaa' }}>{isOpen ? <UpOutlined /> : <DownOutlined />}</span>
                </div>
                <div className="um-item-meta">
                  <div>قراءة التركيب<b>{m3(h.openingReading)}</b></div>
                  <div>{h.isCurrent ? 'آخر قراءة' : 'قراءة الفك'}<b>{m3(h.isCurrent ? h.lastReading : h.closingReading)}</b></div>
                  <div>الاستهلاك<b style={{ color: '#d46b08' }}>{m3(h.consumption)}</b></div>
                  <div>القراءات<b>{h.readingsCount}</b></div>
                </div>
                {isOpen && (
                  <div className="um-item-body">
                    <div style={{ fontSize: 11.5, color: '#888', margin: '8px 0' }}>
                      {[h.serial ? `S/N ${h.serial}` : null, h.typeLabel, [h.brand, h.model].filter(Boolean).join(' '), h.location].filter(Boolean).join(' · ')}
                    </div>
                    {readingsTable(h)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Spin>
  );
};

export default UnitMetersTab;
