import { useCallback, useEffect, useState } from 'react';
import { Row, Col, Card, Descriptions, Tag, Table, Button, Space, Typography, Progress, Empty, Modal, Input, Popconfirm, Spin, Tooltip, message } from 'antd';
import {
  HomeOutlined, UserOutlined, PhoneOutlined, EditOutlined, PlusOutlined, StopOutlined, FileDoneOutlined, FireOutlined,
  DatabaseOutlined, FileProtectOutlined, DollarOutlined, PauseCircleOutlined, PlayCircleOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { errorMessage } from '../../api/client';
import { premisesApi } from '../../api/premises';
import { useAuth } from '../../auth/AuthContext';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';
import { PremisesFormModal, ContractModal, InvoiceRefillModal, PRIMARY, money, litres, d10 } from './forms';

const { Text } = Typography;

const CONTRACT_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: 'نشط' }, expired: { color: 'default', label: 'منتهي' },
  terminated: { color: 'red', label: 'منهى' }, draft: { color: 'blue', label: 'مسودة' }, pending: { color: 'orange', label: 'معلق' },
};

const cardStyle = { borderRadius: 14, border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' } as const;

function MiniKpi({ title, value, sub, color, bg, icon, onClick }: { title: string; value: React.ReactNode; sub?: React.ReactNode; color: string; bg: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <Card style={{ ...cardStyle, cursor: onClick ? 'pointer' : undefined }} styles={{ body: { padding: '16px 18px' } }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>{title}</Text>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 11 }}>{sub}</Text></div>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color }}>{icon}</div>
      </div>
    </Card>
  );
}

/**
 * Villa overview inside the building-style profile (BuildingProfile in villa mode):
 * villa details, owner (customer + signer), delivery contract (price per litre) and refills → invoices.
 * Tanks diagram, refill requests, AMC, visits, service requests, Civil Defense, documents and activity are the
 * normal building tabs of the villa's own host building.
 */
export default function VillaSiteTab({ villaId, onGoTo, onChanged }: { villaId: number; onGoTo: (tab: string) => void; onChanged?: () => void }) {
  const { can } = useAuth();
  const canManage = can('buildings.manage');
  const canInvoice = can('invoices.manage');
  const [s, setS] = useState<any>(null);
  const [refills, setRefills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [editContract, setEditContract] = useState<any>(null);
  const [invoiceRow, setInvoiceRow] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([premisesApi.get(villaId), premisesApi.refills({ premisesId: villaId })])
      .then(([d, r]) => { setS(d); setRefills(r); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [villaId]);
  useEffect(() => { load(); }, [load, key]);
  const changed = () => { setKey(k => k + 1); onChanged?.(); };
  useTrackView('Villa', villaId, s?.name);

  const terminate = (c: any) => {
    let reason = '';
    Modal.confirm({
      title: `إنهاء العقد ${c.contractNo}؟`, centered: true, okText: 'إنهاء', okType: 'danger', cancelText: 'إلغاء',
      content: <Input.TextArea rows={2} placeholder="السبب (اختياري)" onChange={e => { reason = e.target.value; }} />,
      onOk: async () => { try { await premisesApi.terminateContract(c.id, undefined, reason || undefined); message.success('تم إنهاء العقد'); changed(); } catch (e) { message.error(errorMessage(e), 6); } },
    });
  };
  const toggleActive = async () => {
    try { await premisesApi.setActive(s.id, !s.isActive); message.success(s.isActive ? 'تم إيقاف الفيلا' : 'تم تفعيل الفيلا'); changed(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  if (!s) return <Card style={cardStyle}><div style={{ textAlign: 'center', padding: 40 }}>{loading ? <Spin /> : <Empty />}</div></Card>;

  const tanks: any[] = (s.tanks ?? []).map((t: any) => t.tank ?? t);
  const cap = tanks.reduce((n, t) => n + Number(t.capacityLitres ?? 0), 0);
  const lvl = tanks.reduce((n, t) => n + Number(t.currentLevel ?? 0), 0);
  const pct = cap > 0 ? Math.round((lvl / cap) * 1000) / 10 : null;
  const active = (s.contracts ?? []).find((c: any) => c.status === 'active');
  const ready = refills.filter(r => r.readyToInvoice);
  const invoiced = refills.reduce((n, r) => n + Number(r.invoicedAmount ?? 0), 0);
  const v = s.villa ?? {};

  return (
    <Spin spinning={loading}>
      {/* KPIs — same card style as the building overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <MiniKpi title="مستوى الخزان" value={pct != null ? `${pct}%` : '—'} color={pct != null && pct < 25 ? '#ff4d4f' : PRIMARY} bg="#e8f5e9" icon={<DatabaseOutlined />}
            sub={tanks.length ? `${tanks.length} خزان · ${litres(lvl)} من ${litres(cap)}` : 'لا يوجد خزان'} onClick={() => onGoTo('tanks')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MiniKpi title="سعر اللتر (العقد النشط)" value={active ? `${Number(active.pricePerLitre).toLocaleString()} د.إ` : '—'} color="#13c2c2" bg="#e6fffb" icon={<FileProtectOutlined />}
            sub={active ? `${active.contractNo} · حتى ${d10(active.endDate)}` : <Text type="danger" style={{ fontSize: 11 }}>لا يوجد عقد نشط</Text>} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MiniKpi title="تعبئات جاهزة للفوترة" value={ready.length} color="#fa8c16" bg="#fff7e6" icon={<FireOutlined />}
            sub={ready.length ? litres(ready.reduce((n, r) => n + Number(r.deliveredLitres ?? 0), 0)) : 'لا شيء بانتظار الفاتورة'} onClick={() => onGoTo('refill')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MiniKpi title="إجمالي المفوتر" value={money(invoiced)} color="#722ed1" bg="#f9f0ff" icon={<DollarOutlined />}
            sub={`${refills.filter(r => r.invoiceNo).length} فاتورة تعبئة`} onClick={() => onGoTo('financials')} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* villa details */}
        <Col xs={24} lg={14}>
          <Card style={cardStyle} title={<Space><HomeOutlined style={{ color: PRIMARY }} /><Text strong>بيانات الفيلا</Text>
            <Tag color="purple">{s.code}</Tag>{s.isActive ? <Tag color="green">نشطة</Tag> : <Tag>موقوفة</Tag>}</Space>}
            extra={<Space size={4}>
              <HistoryButton entityType="Villa" id={villaId} title={s.name} />
              {canManage && <Tooltip title="تعديل بيانات الفيلا"><Button size="small" icon={<EditOutlined />} onClick={() => setEditOpen(true)} /></Tooltip>}
              {canManage && <Popconfirm title={s.isActive ? 'إيقاف الفيلا؟ (لا يمكن مع عقد نشط)' : 'تفعيل الفيلا؟'} okText="نعم" cancelText="لا" onConfirm={toggleActive}>
                <Button size="small" icon={s.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />} /></Popconfirm>}
            </Space>}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" labelStyle={{ color: '#888' }}>
              <Descriptions.Item label="الاسم">{s.name}</Descriptions.Item>
              <Descriptions.Item label="الفرع">{s.branch ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="المجمّع / المنطقة">{v.community ?? s.building?.zone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="المدينة">{s.building?.city ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="رقم القطعة">{v.plotNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="رقم الفيلا">{v.villaNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="رقم مكاني">{v.makaniNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="غرف النوم">{v.bedrooms ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="العنوان" span={2}>{[s.building?.street, s.building?.address].filter(Boolean).join('، ') || '—'}</Descriptions.Item>
              {s.notes && <Descriptions.Item label="ملاحظات" span={2}>{s.notes}</Descriptions.Item>}
            </Descriptions>
          </Card>
        </Col>
        {/* owner = customer + signer */}
        <Col xs={24} lg={10}>
          <Card style={{ ...cardStyle, height: '100%' }} title={<Space><UserOutlined style={{ color: PRIMARY }} /><Text strong>المالك (العميل والموقّع)</Text></Space>}>
            {s.owner ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#e8f5e9', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
                  {(s.owner.name ?? '?').slice(0, 1)}
                </div>
                <div style={{ lineHeight: 1.9 }}>
                  <Text strong style={{ fontSize: 15 }}>{s.owner.name}</Text> {s.owner.isCustomer && <Tag color="blue">عميل</Tag>}
                  <div style={{ fontSize: 12, color: '#888' }}>{s.owner.partyCode}{s.owner.emiratesId ? ` · ${s.owner.emiratesId}` : ''}</div>
                  {s.owner.phone && <div dir="ltr" style={{ textAlign: 'start', fontSize: 13 }}><PhoneOutlined /> {s.owner.phone}</div>}
                  {s.owner.email && <div style={{ fontSize: 12, color: '#666' }}>{s.owner.email}</div>}
                </div>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا يوجد مالك" />}
          </Card>
        </Col>

        {/* delivery contract */}
        <Col xs={24}>
          <Card style={cardStyle} title={<Space><FileProtectOutlined style={{ color: PRIMARY }} /><Text strong>عقد توريد الغاز (سعر اللتر)</Text></Space>}
            extra={canManage && s.isActive && !active && <Button size="small" type="primary" style={{ background: PRIMARY }} icon={<PlusOutlined />}
              onClick={() => { setEditContract(null); setContractOpen(true); }}>عقد جديد</Button>}>
            <Table<any> rowKey="id" size="small" dataSource={s.contracts ?? []} pagination={false}
              locale={{ emptyText: <Empty description="لا يوجد عقد — أضف عقد التوريد بسعر اللتر لتتمكن من الفوترة" /> }}
              columns={[
                { title: 'العقد', dataIndex: 'contractNo', render: x => <Text code>{x}</Text> },
                { title: 'الفترة', render: (_, c) => `${d10(c.startDate)} → ${d10(c.endDate)}${c.autoRenew ? ' (تجديد تلقائي)' : ''}` },
                { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: x => <Text strong>{Number(x).toLocaleString()} د.إ</Text> },
                { title: 'الضريبة', dataIndex: 'taxCode', render: x => x ?? 'افتراضي' },
                { title: 'مدة السداد', dataIndex: 'paymentTermsDays', render: x => x != null ? `${x} يوم` : '—' },
                { title: 'المفوتر', render: (_, c) => <span>{money(c.invoicedTotal)}<div style={{ fontSize: 11, color: '#888' }}>{litres(c.invoicedLitres)}</div></span> },
                { title: 'الحالة', dataIndex: 'status', render: x => <Tag color={CONTRACT_STATUS[x]?.color}>{CONTRACT_STATUS[x]?.label ?? x}</Tag> },
                { title: '', render: (_, c) => canManage && c.status === 'active' ? <Space size={0}>
                  <Tooltip title="تعديل"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditContract(c); setContractOpen(true); }} /></Tooltip>
                  <Tooltip title="إنهاء العقد"><Button type="text" size="small" danger icon={<StopOutlined />} onClick={() => terminate(c)} /></Tooltip>
                </Space> : <HistoryButton entityType="DeliveryContract" id={c.id} label={null} type="text" /> },
              ]} />
          </Card>
        </Col>

        {/* refills → invoices */}
        <Col xs={24}>
          <Card style={cardStyle} title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><Text strong>التعبئات والفواتير</Text>
            {ready.length > 0 && <Tag color="orange">{ready.length} جاهزة للفوترة</Tag>}</Space>}
            extra={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => onGoTo('refill')}>طلبات التعبئة</Button>}>
            <Table<any> rowKey="refillRequestId" size="small" dataSource={refills} pagination={{ pageSize: 8, size: 'small' }}
              locale={{ emptyText: <Empty description="لا توجد تعبئات بعد — أنشئ طلب تعبئة من تبويب «طلبات التعبئة»" /> }}
              columns={[
                { title: 'الطلب', dataIndex: 'requestNo', render: x => <Text code>{x}</Text> },
                { title: 'الخزان', dataIndex: 'tankNo' },
                { title: 'التاريخ', dataIndex: 'requestDate', render: d10 },
                { title: 'التوصيل', dataIndex: 'deliveredAt', render: x => x ? d10(x) : <Tag>لم يُسلَّم</Tag> },
                { title: 'الكمية المورّدة', dataIndex: 'deliveredLitres', render: x => x != null ? litres(x) : '—' },
                { title: 'الفاتورة', render: (_, r) => r.invoiceNo
                  ? <Space direction="vertical" size={0}><Tag color="green">{r.invoiceNo}</Tag><Text style={{ fontSize: 12 }}>{money(r.invoicedAmount)}</Text></Space>
                  : r.readyToInvoice ? <Tag color="orange">جاهزة{r.estimatedAmount != null ? ` · ${money(r.estimatedAmount)}` : ''}</Tag>
                  : r.missingContract ? <Tag color="red">لا يوجد عقد</Tag> : '—' },
                { title: '', render: (_, r) => r.readyToInvoice && canInvoice
                  ? <Button size="small" type="primary" icon={<FileDoneOutlined />} style={{ background: PRIMARY }} disabled={r.missingContract}
                      onClick={() => setInvoiceRow(r)}>إصدار فاتورة</Button> : null },
              ]} />
            {tanks.length > 0 && (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
                {tanks.map(t => (
                  <div key={t.id} style={{ minWidth: 200, cursor: 'pointer' }} onClick={() => onGoTo('tanks')}>
                    <Text style={{ fontSize: 12 }}><DatabaseOutlined /> {t.tankNo} — {litres(t.currentLevel)} / {litres(t.capacityLitres)}</Text>
                    <Progress percent={Number(t.levelPct ?? 0)} size="small" status={Number(t.levelPct) < 25 ? 'exception' : 'normal'} strokeColor={Number(t.levelPct) < 25 ? undefined : PRIMARY} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <PremisesFormModal type="villa" open={editOpen} editing={s} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); changed(); }} />
      <ContractModal site={s} contract={editContract} open={contractOpen} onClose={() => setContractOpen(false)} onSaved={() => { setContractOpen(false); changed(); }} />
      <InvoiceRefillModal row={invoiceRow} open={!!invoiceRow} onClose={() => setInvoiceRow(null)} onDone={() => { setInvoiceRow(null); changed(); }} />
    </Spin>
  );
}
