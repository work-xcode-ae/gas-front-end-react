import { useCallback, useEffect, useState } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Table, Button, Space, Typography, Spin, Row, Col, Popconfirm, Progress, Empty, Modal, Form, InputNumber, Input, DatePicker, Tooltip, message } from 'antd';
import { EditOutlined, StopOutlined, PlayCircleOutlined, DeleteOutlined, PlusOutlined, FireOutlined, FileDoneOutlined, FileProtectOutlined, TeamOutlined,
  HomeOutlined, ShopOutlined, ReloadOutlined, DashboardOutlined, BankOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { premisesApi, PREMISES_LABEL, type PremisesType } from '../../api/premises';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { useAuth } from '../../auth/AuthContext';
import { RefillRequestDrawer, NewRefillRequestModal, mapLiveRefill, type RefillRequestItem } from '../Buildings/RefillRequestDrawer';
import { Kpi } from '../Customers/shared';
import { PremisesFormModal, ContractModal, SignatoryModal, InvoiceRefillModal, TankListFields, PRIMARY, money, litres, d10 } from './forms';

const { Text } = Typography;

const CONTRACT_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: 'نشط' }, expired: { color: 'error', label: 'منتهي' }, terminated: { color: 'volcano', label: 'ملغي' },
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'معلق' },
};

/** Villa / restaurant profile: details, tanks + refills, refill invoicing, delivery contracts, signatories, history. */
export default function PremisesDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const canInvoice = can('invoices.manage');
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [editContract, setEditContract] = useState<any>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [editSig, setEditSig] = useState<any>(null);
  const [tankOpen, setTankOpen] = useState(false);
  const [newRefillOpen, setNewRefillOpen] = useState(false);
  const [refill, setRefill] = useState<RefillRequestItem | null>(null);
  const [invoiceRow, setInvoiceRow] = useState<any>(null);
  const [levelTank, setLevelTank] = useState<any>(null);
  const [refillRows, setRefillRows] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([premisesApi.get(id), premisesApi.refills({ premisesId: id })])
      .then(([d, r]) => { setS(d); setRefillRows(r); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { setS(null); load(); }, [load, key]);
  const changed = () => { setKey(k => k + 1); onChanged?.(); };

  const type: PremisesType | undefined = s?.type;
  const entityType = type === 'villa' ? 'Villa' : 'Restaurant';
  useTrackView(entityType, id, s?.name);

  const toggleActive = async () => {
    try { await premisesApi.setActive(s.id, !s.isActive); message.success('تم'); changed(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async () => {
    try { await premisesApi.remove(s.id); message.success('تم الحذف'); onChanged?.(); onClose(); } catch (e) { message.error(errorMessage(e), 7); }
  };
  const openRefill = async (refillRequestId: number) => {
    try { setRefill(mapLiveRefill(await api<any>(`/refill-requests/${refillRequestId}`))); } catch (e) { message.error(errorMessage(e)); }
  };
  const terminate = (c: any) => {
    let reason = '';
    Modal.confirm({
      title: `إنهاء العقد ${c.contractNo}؟`, okText: 'إنهاء', cancelText: 'إلغاء', okButtonProps: { danger: true },
      content: <Input style={{ marginTop: 8 }} placeholder="السبب (اختياري)" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => { try { await premisesApi.terminateContract(c.id, undefined, reason || undefined); message.success('تم إنهاء العقد'); changed(); } catch (e) { message.error(errorMessage(e), 6); } },
    });
  };

  const activeContract = s?.contracts?.find((c: any) => c.status === 'active');
  const ready = refillRows.filter(r => r.readyToInvoice);
  const tanks: any[] = s?.tanks ?? [];

  const overview = s && (
    <>
      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} md={6}><Kpi label="سعر اللتر (العقد النشط)" value={activeContract ? Number(activeContract.pricePerLitre).toLocaleString() : '—'} color={PRIMARY} bg="#e8f5e9" icon={<FileProtectOutlined />} /></Col>
        <Col xs={12} md={6}><Kpi label="الخزانات" value={tanks.length} color="#1677ff" bg="#e6f4ff" icon={<DashboardOutlined />} /></Col>
        <Col xs={12} md={6}><Kpi label="تعبئات جاهزة للفوترة" value={ready.length} color="#fa8c16" bg="#fff7e6" icon={<FireOutlined />} /></Col>
        <Col xs={12} md={6}><Kpi label="إجمالي المفوتر" value={money(refillRows.reduce((a, r) => a + Number(r.invoicedAmount ?? 0), 0))} color="#13c2c2" bg="#e6fffb" icon={<FileDoneOutlined />} /></Col>
      </Row>
      <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="الرمز"><Text code>{s.code}</Text></Descriptions.Item>
        <Descriptions.Item label="الفرع">{s.branch}</Descriptions.Item>
        <Descriptions.Item label={type === 'villa' ? 'المبنى (سجل الفيلا)' : 'المبنى'}>{s.building ? `${s.building.code} — ${s.building.name ?? ''}` : '—'}</Descriptions.Item>
        {type === 'restaurant' && <Descriptions.Item label="الوحدة">{s.unit?.unitNo ?? '—'}</Descriptions.Item>}
        <Descriptions.Item label={type === 'villa' ? 'المالك (العميل والموقّع)' : 'مالك المطعم'}>
          {s.owner ? <span>{s.owner.name} <Text type="secondary" style={{ fontSize: 12 }}>({s.owner.partyCode})</Text>{s.owner.phone && <div dir="ltr" style={{ fontSize: 12 }}>{s.owner.phone}</div>}</span> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="حساب العميل">{s.owner?.isCustomer ? <Tag color="green">مفعّل</Tag> : <Tag>يُفعّل عند أول فاتورة</Tag>}</Descriptions.Item>
        {s.villa && <>
          <Descriptions.Item label="المنطقة / المجمع">{s.villa.community ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="رقم الفيلا / القطعة">{[s.villa.villaNo, s.villa.plotNo].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
          <Descriptions.Item label="رقم مكاني">{s.villa.makaniNo ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="العنوان" span={2}>{[s.building?.city, s.building?.zone, s.building?.street, s.building?.address].filter(Boolean).join('، ') || '—'}</Descriptions.Item>
        </>}
        {s.restaurant && <>
          <Descriptions.Item label="الاسم التجاري">{s.restaurant.tradeName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="الرخصة التجارية">{s.restaurant.tradeLicenseNo ?? '—'}{s.restaurant.tradeLicenseExpiry && <Tag style={{ marginInlineStart: 6 }}
            color={dayjs(s.restaurant.tradeLicenseExpiry).isBefore(dayjs()) ? 'red' : 'default'}>حتى {d10(s.restaurant.tradeLicenseExpiry)}</Tag>}</Descriptions.Item>
        </>}
        <Descriptions.Item label="ملاحظات" span={2}>{s.notes ?? '—'}</Descriptions.Item>
      </Descriptions>
      <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
        {type === 'villa'
          ? 'الدفاع المدني وعقود الصيانة وطلبات الخدمة للفيلا من صفحة المباني (رمز الفيلا) — نفس إجراءات المبنى.'
          : 'شهادة الدفاع المدني على مستوى المبنى. خزانات المطعم منفصلة عن خزانات المبنى ولا تدخل في حسابات المبنى.'}
      </Text>
    </>
  );

  const tanksTab = s && (
    <>
      <Space style={{ marginBottom: 10 }} wrap>
        {canManage && <Button icon={<PlusOutlined />} onClick={() => setTankOpen(true)}>إضافة خزان</Button>}
        {can('tanks.manage') && tanks.length > 0 && <Button type="primary" icon={<FireOutlined />} style={{ background: '#fa8c16' }} onClick={() => setNewRefillOpen(true)}>طلب تعبئة</Button>}
      </Space>
      <Table rowKey={r => r.tank.id} size="small" dataSource={tanks} pagination={false} locale={{ emptyText: <Empty description="لا توجد خزانات" /> }}
        columns={[
          { title: 'الخزان', render: (_, r) => <Text strong>{r.tank.tankNo}</Text> },
          { title: 'الغاز', render: (_, r) => r.tank.gasTypeName ?? r.tank.gasType },
          { title: 'السعة', render: (_, r) => litres(r.tank.capacityLitres) },
          { title: 'المستوى', width: 200, render: (_, r) => <Progress percent={Number(r.tank.levelPct ?? 0)} size="small" status={Number(r.tank.levelPct) < 25 ? 'exception' : 'normal'}
            format={p => `${p}% · ${Number(r.tank.currentLevel).toLocaleString()} L`} /> },
          { title: 'الحالة', render: (_, r) => <Tag color={r.tank.status === 'low' ? 'red' : r.tank.status === 'ok' ? 'green' : 'default'}>{r.tank.statusLabel ?? r.tank.status}</Tag> },
          { title: 'طلب مفتوح', render: (_, r) => r.openRequest ? <Tag color="orange">{r.openRequest}</Tag> : '—' },
          { title: '', width: 120, render: (_, r) => <Space size={0}>
            {can('tanks.manage') && <Tooltip title="تسجيل قراءة المستوى"><Button type="text" size="small" icon={<DashboardOutlined />} onClick={() => setLevelTank(r.tank)} /></Tooltip>}
            {canManage && <Popconfirm title="حذف الخزان؟ (فقط إذا لم تكن له تعبئات)" okText="حذف" cancelText="إلغاء"
              onConfirm={async () => { try { await premisesApi.removeTank(s.id, r.tank.id); changed(); } catch (e) { message.error(errorMessage(e), 6); } }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
          </Space> },
        ]} />
    </>
  );

  const refillsTab = (
    <Table rowKey="refillRequestId" size="small" dataSource={refillRows} pagination={{ pageSize: 10, size: 'small' }}
      locale={{ emptyText: <Empty description="لا توجد تعبئات" /> }}
      onRow={r => ({ onClick: () => openRefill(r.refillRequestId), style: { cursor: 'pointer' } })}
      columns={[
        { title: 'الطلب', dataIndex: 'requestNo', render: v => <Text code>{v}</Text> },
        { title: 'الخزان', dataIndex: 'tankNo' },
        { title: 'التاريخ', dataIndex: 'requestDate', render: d10 },
        { title: 'التوصيل', dataIndex: 'deliveredAt', render: v => v ? d10(v) : <Tag>لم يُسلَّم</Tag> },
        { title: 'الكمية المورّدة', dataIndex: 'deliveredLitres', render: v => v != null ? litres(v) : '—' },
        { title: 'الفاتورة', render: (_, r) => r.invoiceNo ? <Space direction="vertical" size={0}><Tag color="green">{r.invoiceNo}</Tag><Text style={{ fontSize: 12 }}>{money(r.invoicedAmount)}</Text></Space>
          : r.readyToInvoice ? <Tag color="orange">جاهزة للفوترة{r.estimatedAmount != null ? ` · ${money(r.estimatedAmount)}` : ''}</Tag> : '—' },
        { title: '', render: (_, r) => r.readyToInvoice && canInvoice
          ? <Button size="small" type="primary" icon={<FileDoneOutlined />} style={{ background: PRIMARY }} onClick={e => { e.stopPropagation(); setInvoiceRow(r); }}>إصدار فاتورة</Button> : null },
      ]} />
  );

  const contractsTab = s && (
    <>
      {canManage && s.isActive && <Button icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => { setEditContract(null); setContractOpen(true); }}>عقد جديد</Button>}
      <Table<any> rowKey="id" size="small" dataSource={s.contracts ?? []} pagination={false} locale={{ emptyText: <Empty description="لا يوجد عقد — أضف عقد التوريد (سعر اللتر)" /> }}
        columns={[
          { title: 'العقد', dataIndex: 'contractNo', render: v => <Text code>{v}</Text> },
          { title: 'الفترة', render: (_, c) => `${d10(c.startDate)} → ${d10(c.endDate)}${c.autoRenew ? ' (تجديد تلقائي)' : ''}` },
          { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: v => <Text strong>{Number(v).toLocaleString()}</Text> },
          { title: 'الضريبة', dataIndex: 'taxCode', render: v => v ?? 'افتراضي' },
          { title: 'الموقّع', dataIndex: 'signedByName', render: (v, c) => <span>{v ?? '—'}{c.signedDate && <div style={{ fontSize: 11, color: '#888' }}>{d10(c.signedDate)}</div>}</span> },
          { title: 'المفوتر', render: (_, c) => <span>{money(c.invoicedTotal)}<div style={{ fontSize: 11, color: '#888' }}>{litres(c.invoicedLitres)}</div></span> },
          { title: 'الحالة', dataIndex: 'status', render: v => <Tag color={CONTRACT_STATUS[v]?.color}>{CONTRACT_STATUS[v]?.label ?? v}</Tag> },
          { title: '', render: (_, c) => canManage && c.status === 'active' ? <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditContract(c); setContractOpen(true); }} />
            <Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => terminate(c)} />
          </Space> : <HistoryButton entityType="DeliveryContract" id={c.id} label={null} type="text" /> },
        ]} />
    </>
  );

  const signatoriesTab = s && (
    <>
      {canManage && <Button icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => { setEditSig(null); setSigOpen(true); }}>إضافة شخص</Button>}
      <Table<any> rowKey="id" size="small" dataSource={s.signatories ?? []} pagination={false} locale={{ emptyText: <Empty description="لا يوجد مخولون — أضف من طاقم المطعم من يحق له التوقيع" /> }}
        columns={[
          { title: 'الاسم', dataIndex: 'name', render: (v, r) => <span style={{ opacity: r.isActive ? 1 : 0.5 }}>{v}</span> },
          { title: 'المنصب', dataIndex: 'position' },
          { title: 'الهوية', dataIndex: 'emiratesId', render: v => <span dir="ltr">{v ?? '—'}</span> },
          { title: 'الهاتف', dataIndex: 'phone', render: v => <span dir="ltr">{v ?? '—'}</span> },
          { title: 'التوقيع', dataIndex: 'canSignContracts', render: (v, r) => v && r.isActive ? <Tag color="green">مخول</Tag> : <Tag>غير مخول</Tag> },
          { title: '', render: (_, r) => canManage && <Space size={0}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditSig(r); setSigOpen(true); }} />
            <Popconfirm title="حذف؟ (إن وقّع عقداً يُلغى تخويله فقط)" okText="نعم" cancelText="لا"
              onConfirm={async () => { try { await premisesApi.removeSignatory(s.id, r.id); changed(); } catch (e) { message.error(errorMessage(e), 6); } }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space> },
        ]} />
    </>
  );

  return (
    <Drawer open={!!id} onClose={onClose} width={Math.min(window.innerWidth - 24, 1000)} destroyOnHidden
      title={s ? <Space wrap>{type === 'villa' ? <HomeOutlined /> : <ShopOutlined />}<span>{s.name}</span><Tag style={{ fontFamily: 'monospace' }}>{s.code}</Tag>
        <Tag color={PREMISES_LABEL[type!]?.color}>{PREMISES_LABEL[type!]?.one}</Tag>{!s.isActive && <Tag>موقوف</Tag>}
        {type === 'restaurant' && s.building && <Tag icon={<BankOutlined />}>{s.building.code}</Tag>}</Space> : 'جارٍ التحميل…'}
      extra={s && <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={changed} />
        <HistoryButton entityType={entityType} id={id} title={s.name} size="middle" />
        {canManage && <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>تعديل</Button>}
        {canManage && <Button icon={s.isActive ? <StopOutlined /> : <PlayCircleOutlined />} onClick={toggleActive}>{s.isActive ? 'إيقاف' : 'تفعيل'}</Button>}
        {canManage && <Popconfirm title="حذف؟ (فقط إذا لم يُستخدم: لا عقود ولا تعبئات)" okText="حذف" cancelText="إلغاء" onConfirm={remove}><Button danger icon={<DeleteOutlined />} /></Popconfirm>}
      </Space>}>
      {!s || loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <Tabs items={[
          { key: 'overview', label: 'البيانات', children: overview },
          { key: 'tanks', label: <span><DashboardOutlined /> الخزانات ({tanks.length})</span>, children: tanksTab },
          { key: 'refills', label: <span><FireOutlined /> التعبئات والفواتير {ready.length > 0 && <Tag color="orange">{ready.length}</Tag>}</span>, children: refillsTab },
          { key: 'contracts', label: <span><FileProtectOutlined /> العقود ({s.contracts?.length ?? 0})</span>, children: contractsTab },
          ...(type === 'restaurant' ? [{ key: 'signatories', label: <span><TeamOutlined /> المخولون بالتوقيع ({s.signatories?.length ?? 0})</span>, children: signatoriesTab }] : []),
        ]} />
      )}

      {s && <>
        <PremisesFormModal type={s.type} open={editOpen} editing={s} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); changed(); }} />
        <ContractModal site={s} contract={editContract} open={contractOpen} onClose={() => setContractOpen(false)} onSaved={() => { setContractOpen(false); changed(); }} />
        <SignatoryModal siteId={s.id} signatory={editSig} open={sigOpen} onClose={() => setSigOpen(false)} onSaved={() => { setSigOpen(false); changed(); }} />
        <AddTankModal siteId={s.id} open={tankOpen} onClose={() => setTankOpen(false)} onSaved={() => { setTankOpen(false); changed(); }} />
        <LevelModal tank={levelTank} onClose={() => setLevelTank(null)} onSaved={() => { setLevelTank(null); changed(); }} />
        <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); changed(); }} />
        <NewRefillRequestModal open={newRefillOpen} onClose={() => setNewRefillOpen(false)} onSave={() => undefined}
          onCreate={async v => {
            const r = await api<{ id: number }>('/refill-requests', { method: 'POST', body: v });
            setNewRefillOpen(false);
            changed();
            await openRefill(r.id);
          }}
          tanks={tanks.map(t => ({ id: String(t.tank.id), label: `${t.tank.tankNo}${t.tank.gasTypeName ? ` — ${t.tank.gasTypeName}` : ''}`,
            currentLevel: Number(t.tank.currentLevel ?? 0), capacity: Number(t.tank.capacityLitres ?? 0), levelPct: Math.round(Number(t.tank.levelPct ?? 0)), unit: 'لتر' }))} />
        <RefillRequestDrawer open={!!refill} request={refill} live onClose={() => { setRefill(null); changed(); }} onUpdate={u => setRefill(u)} />
      </>}
    </Drawer>
  );
}

function AddTankModal({ siteId, open, onClose, onSaved }: { siteId: number; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue({ tanks: [{ gasType: 'LPG' }] }); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      for (const t of (v.tanks ?? []).filter(Boolean))
        await premisesApi.addTank(siteId, { tankNo: t.tankNo || undefined, gasType: t.gasType ?? 'LPG', capacityLitres: Number(t.capacityLitres), currentLevelLitres: t.currentLevelLitres ?? undefined, serialNo: t.serialNo || undefined });
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} width={Math.min(window.innerWidth - 24, 900)} title="إضافة خزان" okText="حفظ" cancelText="إلغاء" destroyOnHidden>
      <Form form={form} layout="vertical"><TankListFields /></Form>
    </Modal>
  );
}

/** Manual level reading — existing endpoint POST /tanks/{id}/levels (same as building tanks). */
function LevelModal({ tank, onClose, onSaved }: { tank: any | null; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (tank) form.setFieldsValue({ levelLitres: tank.currentLevel, eventDate: dayjs(), notes: undefined }); }, [tank]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!tank) return null;
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api(`/tanks/${tank.id}/levels`, { method: 'POST', body: { levelLitres: v.levelLitres, eventType: 'manual_reading', eventDate: v.eventDate.toISOString(), notes: v.notes || null } });
      message.success('تم تسجيل القراءة');
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onCancel={onClose} onOk={submit} confirmLoading={saving} title={`قراءة مستوى الخزان ${tank.tankNo}`} okText="حفظ" cancelText="إلغاء">
      <Form form={form} layout="vertical">
        <Form.Item name="levelLitres" label={`المستوى (لتر) — السعة ${Number(tank.capacityLitres).toLocaleString()}`} rules={[{ required: true }]}>
          <InputNumber min={0} max={Number(tank.capacityLitres)} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="eventDate" label="وقت القراءة" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs())} /></Form.Item>
        <Form.Item name="notes" label="ملاحظات"><Input /></Form.Item>
      </Form>
    </Modal>
  );
}
