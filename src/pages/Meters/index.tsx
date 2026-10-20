import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Radio, Row, Segmented, Select, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  DashboardOutlined, EnvironmentOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, ToolOutlined, WarningOutlined, ApiOutlined,
  DisconnectOutlined, LoginOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { buildingsApi } from '../../api/buildings';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import { useGlobalFilters } from '../../context/GlobalFilters';
import { HistoryButton } from '../../components/history/RecordHistory';
import { METER_STATUS_STYLE, meterStatusStyle, MeterStatusTag, CalibrationTag, MeterStatusModal, useMeterStatuses } from './meterStatus';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

/** Row of GET /meters */
interface MeterRow {
  id: number; meterNo: string; serial?: string; unitId?: number | null; unit?: string | null; floor?: number | null;
  buildingId?: number | null; buildingCode?: string | null; building?: string | null;
  type?: string; typeLabel?: string; status?: string; statusLabel?: string; installDate?: string | null;
  lastRead?: string | null; lastReadValue?: number; tenant?: string | null; brand?: string | null; model?: string | null;
  calibrationDate?: string | null; branchId?: number; calibrationExpiry?: string | null; calibrationState?: string | null;
}

const STATUS = METER_STATUS_STYLE;
const stOf = meterStatusStyle;
/** a meter can be installed when it is in stock (or an older «active» meter that is not in any unit) */
const installable = (m: MeterRow) => !m.unitId && (m.status === 'in_stock' || m.status === 'active' || !m.status);

type View = 'all' | 'stock' | 'installed' | 'fault' | 'damaged' | 'maintenance' | 'disconnected' | 'calibration';

const MetersPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';
  const { data: ref } = useReference(i18n.language);
  const { can } = useAuth();
  const canManage = can('meters.manage') || can('buildings.manage');
  const global = useGlobalFilters();

  const [rows, setRows] = useState<MeterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [view, setView] = useState<View>('stock');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [installMeter, setInstallMeter] = useState<MeterRow | null>(null);
  const [statusMeter, setStatusMeter] = useState<MeterRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const statusOptions = useMeterStatuses();

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api<Paged<MeterRow>>('/meters', { query: { pageSize: 0, branchId: global.branchId }, signal: ctrl.signal })
      .then(r => setRows(r.items))
      .catch(e => { if (e?.name !== 'AbortError') message.error(errorMessage(e)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [key, global.branchId]);

  const isStock = installable;
  const calIssue = (m: MeterRow) => m.calibrationState === 'expired' || m.calibrationState === 'due_soon';
  const counts = useMemo(() => ({
    all: rows.length,
    stock: rows.filter(isStock).length,
    installed: rows.filter(m => !!m.unitId).length,
    fault: rows.filter(m => m.status === 'fault').length,
    damaged: rows.filter(m => m.status === 'damaged').length,
    calibration: rows.filter(m => (m.status !== 'retired' && m.status !== 'lost') && calIssue(m)).length,
    maintenance: rows.filter(m => m.status === 'maintenance').length,
    disconnected: rows.filter(m => m.status === 'disconnected').length,
  }), [rows]);

  const q = search.trim().toLowerCase();
  const shown = rows.filter(m => {
    const ok = (view === 'all' ? true : view === 'stock' ? isStock(m) : view === 'installed' ? !!m.unitId : view === 'calibration' ? calIssue(m) && m.status !== 'retired' && m.status !== 'lost' : m.status === view)
      && (!statusFilter || m.status === statusFilter);
    return ok && (!q || [m.meterNo, m.serial, m.building, m.buildingCode, m.unit, m.tenant, m.brand].some(v => (v ?? '').toLowerCase().includes(q)));
  });

  const tiles: { k: View; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
    { k: 'all', label: 'إجمالي العدادات', color: PRIMARY, bg: '#f1f8f1', icon: <DashboardOutlined /> },
    { k: 'stock', label: 'في المخزون (جاهز للتركيب)', color: STATUS.in_stock.color, bg: STATUS.in_stock.bg, icon: <InboxOutlined /> },
    { k: 'installed', label: 'مركّب في وحدات', color: STATUS.active.color, bg: STATUS.active.bg, icon: <ApiOutlined /> },
    { k: 'fault', label: 'عطل', color: STATUS.fault.color, bg: STATUS.fault.bg, icon: <WarningOutlined /> },
    { k: 'damaged', label: 'تالف', color: STATUS.damaged.color, bg: STATUS.damaged.bg, icon: STATUS.damaged.icon },
    { k: 'maintenance', label: 'صيانة', color: STATUS.maintenance.color, bg: STATUS.maintenance.bg, icon: <ToolOutlined /> },
    { k: 'disconnected', label: 'مفصول', color: STATUS.disconnected.color, bg: STATUS.disconnected.bg, icon: <DisconnectOutlined /> },
    { k: 'calibration', label: 'معايرة منتهية / قريبة', color: '#ad6800', bg: '#fffbe6', icon: <WarningOutlined /> },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DashboardOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>العدادات والمخزون</div>
          <div style={{ color: 'rgba(255,255,255,.72)', fontSize: 12.5 }}>كل عداد يُسجَّل في المخزون أولاً ثم يُركّب في وحدة — ويعود للمخزون عند فكّه</div>
        </div>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}
          style={{ marginInlineStart: 'auto', background: GOLD, borderColor: GOLD, color: DARK, fontWeight: 700 }}>إضافة عدادات للمخزون</Button>}
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {tiles.map(t => (
          <Col key={t.k} xs={12} md={6} lg={3}>
            <Card size="small" hoverable onClick={() => setView(t.k)}
              style={{ borderRadius: 12, background: t.bg, border: `2px solid ${view === t.k ? t.color : 'transparent'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.color }}>{counts[t.k]}</div>
                  <div style={{ fontSize: 11.5, color: t.color }}>{t.label}</div>
                </div>
                <span style={{ fontSize: 22, color: t.color, opacity: .7 }}>{t.icon}</span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card styles={{ body: { padding: 14 } }} style={{ borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <Segmented value={view} onChange={v => setView(v as View)} options={[
            { value: 'stock', label: `المخزون (${counts.stock})` },
            { value: 'installed', label: `المركّبة (${counts.installed})` },
            { value: 'all', label: `الكل (${counts.all})` },
          ]} />
          <Select allowClear placeholder="كل الحالات" style={{ width: 170 }} value={statusFilter} onChange={setStatusFilter}
            options={statusOptions.map(o => ({ value: o.code, label: <span style={{ color: stOf(o.code).color }}>{stOf(o.code).icon} {o.label} ({rows.filter(m => m.status === o.code).length})</span> }))} />
          <Input prefix={<SearchOutlined style={{ color: '#bbb' }} />} allowClear placeholder="رقم العداد، التسلسلي، المبنى، الوحدة، المستأجر…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)} loading={loading} /></Tooltip>
        </div>
        {global.branchId && <Alert type="info" showIcon style={{ marginBottom: 10, borderRadius: 8 }} message={`مفلتر حسب الفرع: ${locName(ref?.branches.find(b => b.id === global.branchId), isAr) ?? ''} (من شريط الأدوات العلوي)`} />}

        <Table<MeterRow> rowKey="id" size="middle" loading={loading} dataSource={shown}
          pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={view === 'stock' ? 'لا توجد عدادات في المخزون — أضف عدادات جديدة' : 'لا توجد عدادات'}>
            {canManage && view === 'stock' && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setAddOpen(true)}>إضافة عدادات للمخزون</Button>}
          </Empty> }}
          columns={[
            { title: 'رقم العداد', dataIndex: 'meterNo', width: 120, render: (v: string, m) => <div><b style={{ fontFamily: 'monospace', color: PRIMARY }}>{v}</b><div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{m.serial}</div></div> },
            { title: 'النوع', dataIndex: 'typeLabel', width: 110, render: (v: string, m) => <Tag color={m.type === 'smart' ? 'blue' : 'default'}>{v ?? m.type ?? '—'}</Tag> },
            { title: 'الشركة / الموديل', key: 'brand', width: 150, render: (_, m) => <span style={{ fontSize: 12 }}>{[m.brand, m.model].filter(Boolean).join(' · ') || '—'}</span> },
            { title: 'الحالة', dataIndex: 'status', width: 140, render: (_: string, m) => (!m.unitId && installable(m))
              ? <MeterStatusTag status="in_stock" />
              : <MeterStatusTag status={m.status} label={m.statusLabel} /> },
            { title: 'المعايرة', key: 'cal', width: 120, render: (_, m) => <div><CalibrationTag state={m.calibrationState} expiry={m.calibrationExpiry} short />
              {m.calibrationDate && <div style={{ fontSize: 11, color: '#999' }}>{m.calibrationDate}</div>}</div> },
            { title: 'الموقع', key: 'loc', render: (_, m) => m.unitId
              ? <div style={{ fontSize: 12 }}><EnvironmentOutlined style={{ color: '#999' }} /> {m.building ?? m.buildingCode} — <b>وحدة {m.unit}</b>{m.tenant && <div style={{ color: '#777' }}>{m.tenant}</div>}</div>
              : <Text type="secondary" style={{ fontSize: 12 }}><InboxOutlined /> في المستودع</Text> },
            { title: 'تاريخ التركيب', dataIndex: 'installDate', width: 110, render: (v?: string | null, m?: MeterRow) => <span style={{ fontSize: 12 }}>{m?.unitId && v ? dayjs(v).format('YYYY-MM-DD') : '—'}</span> },
            { title: 'آخر قراءة', key: 'last', width: 120, render: (_, m) => <span style={{ fontSize: 12 }}>{m.lastRead ? `${Number(m.lastReadValue ?? 0).toLocaleString()} م³` : '—'}</span> },
            { title: '', key: 'act', width: 220, render: (_, m) => canManage ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {installable(m) && <Button size="small" type="primary" icon={<LoginOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => setInstallMeter(m)}>تركيب في وحدة</Button>}
                <Button size="small" icon={<ToolOutlined />} onClick={() => setStatusMeter(m)}>الحالة</Button>
                <HistoryButton entityType="Meter" id={m.id} title={`عداد ${m.meterNo}`} />
              </div>) : <HistoryButton entityType="Meter" id={m.id} title={`عداد ${m.meterNo}`} /> },
          ]} />
      </Card>

      <AddToStockModal open={addOpen} onClose={() => setAddOpen(false)} defaultBranchId={global.branchId}
        onSaved={() => { setAddOpen(false); setView('stock'); setKey(k => k + 1); }} />
      <MeterStatusModal meter={statusMeter} onClose={() => setStatusMeter(null)} onSaved={() => setKey(k => k + 1)} />
      <InstallModal meter={installMeter} onClose={() => setInstallMeter(null)} onSaved={() => { setInstallMeter(null); setKey(k => k + 1); }} />
    </div>
  );
};

// ───────────────────────── add meters to stock ─────────────────────────
const AddToStockModal: React.FC<{ open: boolean; defaultBranchId?: number; onClose: () => void; onSaved: () => void }> = ({ open, defaultBranchId, onClose, onSaved }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';
  const { data: ref } = useReference(i18n.language);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const mode: 'one' | 'many' = Form.useWatch('mode', form) ?? 'one';
  const serialsText: string = Form.useWatch('serials', form) ?? '';
  const serials = serialsText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const dups = serials.filter((s, i) => serials.findIndex(x => x.toLowerCase() === s.toLowerCase()) !== i);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ mode: 'one', branchId: defaultBranchId ?? ref?.branches[0]?.id, type: 'smart', initialReading: 0 });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    const list = v.mode === 'one' ? [String(v.serial ?? '').trim()] : serials;
    if (!list.length || !list[0]) { message.warning('أدخل الرقم التسلسلي'); return; }
    if (dups.length && v.mode === 'many') { message.warning(`أرقام مكررة: ${[...new Set(dups)].join('، ')}`); return; }
    setSaving(true);
    try {
      const r = await api<{ id: number; meterNo: string }[]>('/meters/stock', { body: {
        branchId: v.branchId, serials: list, type: v.type, brand: v.brand?.trim() || undefined, model: v.model?.trim() || undefined,
        calibrationDate: v.calibrationDate ? (v.calibrationDate as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
        initialReading: v.initialReading ?? 0, notes: v.notes?.trim() || undefined,
      } });
      message.success(r.length === 1 ? `تمت إضافة العداد ${r[0].meterNo} للمخزون` : `تمت إضافة ${r.length} عداد للمخزون (${r[0].meterNo} … ${r[r.length - 1].meterNo})`);
      onSaved();
    } catch (e) { message.error(errorMessage(e), 8); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onCancel={onClose} onOk={save} confirmLoading={saving} width={640} centered destroyOnHidden
      title={<span><InboxOutlined style={{ color: PRIMARY }} /> إضافة عدادات للمخزون</span>}
      okText={mode === 'many' && serials.length > 1 ? `إضافة ${serials.length} عداد` : 'إضافة للمخزون'} cancelText="إلغاء"
      okButtonProps={{ style: { background: PRIMARY, borderColor: PRIMARY } }}>
      <Alert type="info" showIcon style={{ marginBottom: 14, borderRadius: 8 }} message="تُسجَّل العدادات بحالة «في المخزون» ويُعطى كل عداد رقماً تلقائياً (M-…). التركيب في الوحدات يتم لاحقاً من المخزون." />
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="mode" style={{ marginBottom: 12 }}>
          <Radio.Group optionType="button" buttonStyle="solid" options={[{ value: 'one', label: 'عداد واحد' }, { value: 'many', label: 'عدة عدادات (دفعة)' }]} />
        </Form.Item>
        {mode === 'one' ? (
          <Form.Item name="serial" label="الرقم التسلسلي" rules={[{ required: true, whitespace: true, message: 'مطلوب' }]}><Input style={{ direction: 'ltr' }} placeholder="SN-XXXXXXXX" /></Form.Item>
        ) : (
          <Form.Item name="serials" label="الأرقام التسلسلية — رقم في كل سطر" rules={[{ required: true, whitespace: true, message: 'أدخل رقماً واحداً على الأقل' }]}
            extra={serials.length ? <span>{serials.length} عداد{dups.length ? <Text type="danger"> — مكرر: {[...new Set(dups)].join('، ')}</Text> : null}</span> : 'يمكن اللصق من Excel'}>
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} style={{ direction: 'ltr', fontFamily: 'monospace' }} placeholder={'SN-1001\nSN-1002\nSN-1003'} />
          </Form.Item>
        )}
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="branchId" label="الفرع / المستودع" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}><Form.Item name="type" label="نوع العداد"><Select options={(ref?.lookups?.METER_TYPE ?? []).map(t => ({ value: t.code, label: t.label }))} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="brand" label="الشركة المصنعة"><Input placeholder="مثال: Itron" /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="model" label="الموديل"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="calibrationDate" label="تاريخ المعايرة"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="initialReading" label="القراءة الابتدائية"><InputNumber min={0} style={{ width: '100%' }} addonAfter="م³" /></Form.Item></Col>
          <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input placeholder="مثال: شحنة أكتوبر / رقم أمر الشراء" /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
};

// ───────────────────────── install a stock meter in a unit ─────────────────────────
interface UnitOpt { id: number; no: string; floor?: number | null; isActive?: boolean }
const InstallModal: React.FC<{ meter: MeterRow | null; onClose: () => void; onSaved: () => void }> = ({ meter, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const [buildings, setBuildings] = useState<{ id: number; code: string; name?: string }[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const buildingId: number | undefined = Form.useWatch('buildingId', form);

  useEffect(() => {
    if (!meter) return;
    form.resetFields(); form.setFieldsValue({ fromDate: dayjs() });
    buildingsApi.list({ pageSize: 0 }).then(r => setBuildings(r.items as any)).catch(() => setBuildings([]));
  }, [meter, form]);
  useEffect(() => {
    setUnits([]); form.setFieldsValue({ unitId: undefined });
    if (!buildingId) return;
    api<Paged<UnitOpt>>('/units', { query: { buildingId, withoutMeter: true, pageSize: 0 } }).then(r => setUnits(r.items.filter(u => u.isActive !== false))).catch(() => setUnits([]));
  }, [buildingId, form]);

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      await api(`/meters/${meter!.id}/assign`, { body: { unitId: v.unitId, fromDate: (v.fromDate as dayjs.Dayjs).format('YYYY-MM-DD') } });
      const u = units.find(x => x.id === v.unitId);
      message.success(`تم تركيب العداد ${meter!.meterNo} في الوحدة ${u?.no ?? ''} — يمكنك الآن إضافة المستأجر من مخطط المبنى`, 6);
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!meter} onCancel={onClose} onOk={save} confirmLoading={saving} width={520} centered destroyOnHidden
      title={<span><LoginOutlined style={{ color: PRIMARY }} /> تركيب العداد {meter?.meterNo} في وحدة</span>}
      okText="تركيب العداد" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY, borderColor: PRIMARY } }}>
      <div style={{ background: '#f3faf3', border: '1px solid #d6ead6', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12.5 }}>
        <b style={{ fontFamily: 'monospace' }}>{meter?.meterNo}</b> · {meter?.serial} · {meter?.typeLabel} — من المخزون ← مركّب
      </div>
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="buildingId" label="المبنى" rules={[{ required: true, message: 'اختر المبنى' }]}>
          <Select showSearch optionFilterProp="label" placeholder="اختر المبنى" options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? ''}` }))} />
        </Form.Item>
        <Form.Item name="unitId" label="الوحدة (بدون عداد)" rules={[{ required: true, message: 'اختر الوحدة' }]}
          extra={buildingId && !units.length ? 'كل وحدات هذا المبنى بها عدادات' : undefined}>
          <Select showSearch optionFilterProp="label" placeholder={buildingId ? 'اختر الوحدة' : 'اختر المبنى أولاً'} disabled={!buildingId}
            options={units.map(u => ({ value: u.id, label: `${u.no}${u.floor != null ? ` — ط ${u.floor}` : ''}` }))} />
        </Form.Item>
        <Form.Item name="fromDate" label="تاريخ التركيب" rules={[{ required: true, message: 'مطلوب' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  );
};

export default MetersPage;
