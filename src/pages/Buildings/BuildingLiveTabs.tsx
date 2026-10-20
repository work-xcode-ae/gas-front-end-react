import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Tag, Typography, Button, Table, Timeline, Progress, Empty, Avatar, Descriptions, Divider, Modal, Form, Input, InputNumber,
  Select, Switch, Segmented, DatePicker, Upload, Popconfirm, Space, message, Spin, Statistic, Alert,
} from 'antd';
import {
  HomeOutlined, FireOutlined, ApartmentOutlined, BellOutlined, DollarOutlined, ToolOutlined, UserOutlined, BuildOutlined, StarFilled,
  PhoneOutlined, MailOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, FileTextOutlined, FilePdfOutlined,
  FileImageOutlined, DownloadOutlined, EyeOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, DatabaseOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { API_BASE, api, apiUpload, errorMessage, type Paged, authFetch } from '../../api/client';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const money = (n?: number) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} د.إ`;

async function openBlob(url: string, fileName?: string, mime?: string, download = false) {
  const w = download ? null : window.open('', '_blank');
  try {
    const res = await authFetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error(res.status === 404 ? 'الملف غير موجود' : `تعذر تحميل الملف (${res.status})`);
    const obj = URL.createObjectURL(await res.blob());
    if (w && /^image\/|pdf/.test(mime ?? '')) w.location.href = obj;
    else { w?.close(); const a = document.createElement('a'); a.href = obj; a.download = fileName ?? 'file'; a.click(); }
    setTimeout(() => URL.revokeObjectURL(obj), 60_000);
  } catch (e) { w?.close(); message.error(errorMessage(e)); }
}

const ACTIVITY_COLOR: Record<string, string> = { create: 'green', delete: 'red', status_change: 'blue', update: 'blue', invoice: 'purple', payment: 'green', fees: 'orange', report: 'cyan' };

// ═══════════════════════════ نظرة عامة ═══════════════════════════
export function BuildingOverviewLive({ buildingId, live, onGoTo }: { buildingId: number; live: any; onGoTo: (tab: string) => void }) {
  const [units, setUnits] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [fin, setFin] = useState<{ month: number; balance: number; overdue: number } | null>(null);
  useEffect(() => {
    api<Paged<any>>('/units', { query: { buildingId, pageSize: 0 } }).then(r => setUnits(r.items)).catch(() => setUnits([]));
    api<any>(`/buildings/${buildingId}/tank-insights`).then(setInsights).catch(() => setInsights(null));
    api<Paged<any>>(`/buildings/${buildingId}/activity`, { query: { pageSize: 6 } }).then(r => setActivity(r.items)).catch(() => setActivity([]));
    api<Paged<any>>('/invoices', { query: { buildingId, pageSize: 0 } }).then(r => {
      const m0 = dayjs().startOf('month');
      const valid = r.items.filter((i: any) => i.status !== 'cancelled' && i.status !== 'draft');
      setFin({
        month: valid.filter((i: any) => !dayjs(i.date).isBefore(m0)).reduce((s: number, i: any) => s + Number(i.amount), 0),
        balance: valid.reduce((s: number, i: any) => s + Number(i.balance), 0),
        overdue: valid.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.balance), 0),
      });
    }).catch(() => setFin(null));
  }, [buildingId]);

  const st = live?.stats ?? {};
  const active = units.filter(u => u.isActive !== false);
  const occupied = active.filter(u => u.contractId).length;
  const vacant = active.length - occupied;
  const inactive = units.length - active.length;
  const occ = active.length ? Math.round(occupied * 100 / active.length) : 0;
  const byType = useMemo(() => {
    const m = new Map<string, { total: number; occ: number }>();
    active.forEach(u => { const k = u.typeLabel ?? u.type ?? 'أخرى'; const v = m.get(k) ?? { total: 0, occ: 0 }; v.total++; if (u.contractId) v.occ++; m.set(k, v); });
    return [...m.entries()];
  }, [units]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = (insights?.months ?? []).slice(-6);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={9}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><HomeOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />نسبة الإشغال</Text>}>
              {active.length === 0 ? <Empty description="لا توجد وحدات" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <ReactApexChart type="donut" height={170} series={[occupied, vacant, inactive]}
                  options={{ chart: { type: 'donut', fontFamily: 'inherit' }, colors: ['#52c41a', '#ff4d4f', '#bfbfbf'], labels: ['مشغولة', 'شاغرة', 'موقوفة'],
                    legend: { position: 'bottom', fontSize: '12px' }, plotOptions: { pie: { donut: { size: '70%' } } }, dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` } }} />
              )}
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 22, fontWeight: 700, color: PRIMARY }}>{occ}%</Text><br />
                <Text type="secondary" style={{ fontSize: 12 }}>نسبة الإشغال الكلية</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={15}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><FireOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />استهلاك الغاز من عدادات المستأجرين (آخر 6 أشهر)</Text>}>
              {months.length === 0 ? <Empty description="لا توجد قراءات عدادات بعد" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <ReactApexChart type="area" height={210}
                  series={[{ name: 'الاستهلاك م³', data: months.map((m: any) => Number(m.consumptionM3)) }]}
                  options={{ chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' }, colors: [PRIMARY], stroke: { curve: 'smooth', width: 2 },
                    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } }, dataLabels: { enabled: false },
                    xaxis: { categories: months.map((m: any) => m.month) }, tooltip: { y: { formatter: (v: number) => `${v} م³` } } }} />
              )}
            </Card>
          </Col>
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><ApartmentOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />الوحدات ({units.length})</Text>}
          extra={<Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => onGoTo('units')}>إضافة / إدارة الوحدات</Button>}>
          <Table size="small" dataSource={units} rowKey="id" pagination={{ pageSize: 6, size: 'small' }} scroll={{ x: 700 }}
            columns={[
              { title: 'رقم الوحدة', dataIndex: 'no', width: 90, render: (v: string, u: any) => <Text strong style={{ color: u.isActive === false ? '#bbb' : PRIMARY }}>{v}</Text> },
              { title: 'الطابق', dataIndex: 'floor', width: 70, align: 'center' as const },
              { title: 'النوع', dataIndex: 'typeLabel', width: 90 },
              { title: 'المساحة', dataIndex: 'area', width: 80, render: (v: number) => (v ? `${v} م²` : '—') },
              { title: 'الحالة', key: 'st', width: 90, render: (_: any, u: any) => u.isActive === false ? <Tag>موقوفة</Tag> : u.contractId ? <Tag color="success">مشغولة</Tag> : <Tag color="error">شاغرة</Tag> },
              { title: 'المستأجر', dataIndex: 'tenant', render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
              { title: 'العداد', dataIndex: 'meter', width: 100, render: (v: string | null) => (v ? <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag> : '—') },
              { title: 'العقد', dataIndex: 'contractNo', width: 120, render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
            ]} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { label: 'فواتير هذا الشهر', value: fin ? Math.round(fin.month).toLocaleString() : '—', unit: 'د.إ', color: PRIMARY, icon: <DollarOutlined />, tab: 'financials' },
            { label: 'طلبات خدمة مفتوحة', value: st.openServiceRequests ?? 0, unit: 'طلب', color: '#fa8c16', icon: <ToolOutlined />, tab: 'service' },
            { label: 'مستحقات غير مسددة', value: fin ? Math.round(fin.balance).toLocaleString() : '—', unit: 'د.إ', color: '#d4380d', icon: <WarningOutlined />, tab: 'financials' },
            { label: 'مستوى الخزانات', value: st.tankLevelPct != null ? `${st.tankLevelPct}%` : '—', unit: insights?.status === 'refill_now' ? 'يحتاج تعبئة' : '', color: '#1677ff', icon: <DatabaseOutlined />, tab: 'tanks' },
          ].map((s, i) => (
            <Col span={12} key={i}>
              <Card size="small" bordered={false} hoverable onClick={() => onGoTo(s.tab)} style={{ borderRadius: 10, textAlign: 'center', background: '#fafafa' }}>
                <div style={{ color: s.color, fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{s.unit}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
        {st.civilDefense && (
          <Alert style={{ marginBottom: 16, borderRadius: 10 }} showIcon icon={<SafetyCertificateOutlined />}
            type={st.civilDefense.expiryDate && dayjs(st.civilDefense.expiryDate).diff(dayjs(), 'day') < 60 ? 'warning' : 'success'}
            message={<span>شهادة الدفاع المدني {st.civilDefense.certificateNo ?? ''} — تنتهي {st.civilDefense.expiryDate ?? '—'}</span>}
            action={<Button size="small" type="link" onClick={() => onGoTo('civildefense')}>عرض</Button>} />
        )}
        <Card size="small" bordered={false} style={{ borderRadius: 10, marginBottom: 16 }}
          title={<Text strong><HomeOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />تفاصيل الإشغال</Text>}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12 }}>مشغولة</Text>
              <Text strong style={{ fontSize: 12, color: PRIMARY }}>{occupied} / {active.length}</Text>
            </div>
            <Progress percent={occ} strokeColor={PRIMARY} trailColor="#f0f0f0" size="small" />
          </div>
          {byType.map(([label, v]) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 11, color: '#666' }}>{label}</Text>
                <Text style={{ fontSize: 11 }}>{v.occ} / {v.total} وحدة</Text>
              </div>
              <Progress percent={Math.round(v.occ * 100 / v.total)} size="small" strokeColor="#1677ff" showInfo={false} />
            </div>
          ))}
        </Card>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><BellOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />آخر النشاطات</Text>}
          extra={<Button size="small" type="link" onClick={() => onGoTo('activity')}>الكل</Button>}>
          {activity.length === 0 ? <Empty description="لا توجد نشاطات" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
            <Timeline style={{ marginTop: 8 }} items={activity.map(a => ({
              color: ACTIVITY_COLOR[a.action] ?? 'blue',
              children: <div><Text style={{ fontSize: 12 }}>{a.description}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(a.occurredAt).format('YYYY-MM-DD HH:mm')}{a.user ? ` · ${a.user}` : ''}</Text></div>,
            }))} />
          )}
        </Card>
      </Col>
    </Row>
  );
}

// ═══════════════════════════ الملاك ═══════════════════════════
export function BuildingOwnersLive({ buildingId, owners, canManage, onChanged }: { buildingId: number; owners: any[]; canManage: boolean; onChanged: () => void }) {
  const [details, setDetails] = useState<Record<number, any>>({});
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [parties, setParties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    owners.forEach(o => {
      if (details[o.partyId]) return;
      api<any>(`/parties/${o.partyId}/details`).then(d => setDetails(x => ({ ...x, [o.partyId]: d }))).catch(() => undefined);
    });
  }, [owners]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchParties = (s: string) =>
    api<Paged<any>>('/parties', { query: { search: s || undefined, pageSize: 30 } }).then(r => setParties(r.items)).catch(() => setParties([]));

  const openNew = () => { form.resetFields(); form.setFieldsValue({ partyType: 'individual', isPrimary: owners.length === 0, ownershipPercentage: owners.length === 0 ? 100 : undefined }); setMode('existing'); searchParties(''); setEditing('new'); };
  const openEdit = (o: any) => { form.setFieldsValue({ ownershipPercentage: o.ownershipPercentage, isPrimary: o.isPrimary, fromDate: o.fromDate ? dayjs(o.fromDate) : undefined }); setEditing(o); };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const common = { ownershipPercentage: v.ownershipPercentage ?? null, isPrimary: !!v.isPrimary, fromDate: v.fromDate?.format('YYYY-MM-DD') ?? null, toDate: null };
      if (editing === 'new') {
        await api(`/buildings/${buildingId}/owners`, {
          method: 'POST', body: mode === 'existing' ? { ...common, partyId: v.partyId } : {
            ...common, party: {
              partyType: v.partyType, nameAr: v.nameAr, nameEn: v.nameEn || null, emiratesId: v.emiratesId || null, tradeLicenseNo: v.tradeLicenseNo || null,
              phone: v.phone || null, email: v.email || null, address: v.address || null, bankName: v.bankName || null, iban: v.iban || null,
            },
          },
        });
      } else {
        await api(`/buildings/${buildingId}/owners/${editing.id}`, { method: 'PUT', body: common });
      }
      message.success('تم الحفظ');
      setEditing(null);
      onChanged();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const remove = async (o: any) => {
    try { await api(`/buildings/${buildingId}/owners/${o.id}`, { method: 'DELETE' }); message.success('تمت إزالة المالك'); onChanged(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  const total = owners.reduce((s, o) => s + Number(o.ownershipPercentage ?? 0), 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Text strong>ملاك المبنى ({owners.length})</Text>
          <Tag color={total === 100 ? 'success' : 'warning'}>إجمالي نسب الملكية: {total}%</Tag>
        </Space>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>إضافة مالك</Button>}
      </div>
      {owners.length === 0 && <Empty description="لا يوجد ملاك مسجلون لهذا المبنى" />}
      <Row gutter={[16, 16]}>
        {owners.map(o => {
          const d = details[o.partyId];
          const company = o.partyType === 'company';
          const phones = (d?.contacts ?? []).filter((c: any) => c.type !== 'email').map((c: any) => c.value);
          const emails = (d?.contacts ?? []).filter((c: any) => c.type === 'email').map((c: any) => c.value);
          const bank = (d?.bankAccounts ?? [])[0];
          return (
            <Col xs={24} lg={12} key={o.id}>
              <Card size="small" bordered={false} style={{ borderRadius: 10, border: o.isPrimary ? '2px solid #faad14' : '1px solid #f0f0f0', height: '100%' }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar icon={company ? <BuildOutlined /> : <UserOutlined />} style={{ background: o.isPrimary ? '#faad14' : PRIMARY, flexShrink: 0 }} />
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{o.nameAr ?? o.name}</Text>
                      {o.isPrimary && <Tag icon={<StarFilled />} color="gold" style={{ marginInlineStart: 8, borderRadius: 8, fontSize: 11 }}>المالك المسؤول</Tag>}
                      <br /><Text type="secondary" style={{ fontSize: 12 }}>{company ? 'شركة' : 'فرد'}{o.ownershipPercentage != null ? ` · ${o.ownershipPercentage}%` : ''}</Text>
                    </div>
                  </div>
                }
                extra={canManage && (
                  <Space size={2}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(o)} />
                    <Popconfirm title="إزالة هذا المالك من المبنى؟" okText="إزالة" cancelText="إلغاء" onConfirm={() => remove(o)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )}>
                <Descriptions column={1} size="small" labelStyle={{ width: 130, fontSize: 12, color: '#666' }} contentStyle={{ fontSize: 12 }}>
                  <Descriptions.Item label="الاسم (إنجليزي)">{o.nameEn ?? '—'}</Descriptions.Item>
                  {company
                    ? <Descriptions.Item label="رقم الرخصة">{o.tradeLicenseNo ?? '—'}</Descriptions.Item>
                    : <Descriptions.Item label="الهوية الإماراتية"><Text style={{ fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{o.emiratesId ?? '—'}</Text></Descriptions.Item>}
                  {d?.nationality && <Descriptions.Item label="الجنسية">{d.nationality}</Descriptions.Item>}
                  {d?.party?.address && <Descriptions.Item label="العنوان">{d.party.address}</Descriptions.Item>}
                  {o.fromDate && <Descriptions.Item label="مالك منذ">{o.fromDate}</Descriptions.Item>}
                </Descriptions>
                <Divider style={{ margin: '10px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(phones.length ? phones : o.phone ? [o.phone] : []).map((ph: string) => (
                    <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PhoneOutlined style={{ color: PRIMARY, fontSize: 12 }} /><Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{ph}</Text></div>
                  ))}
                  {(emails.length ? emails : o.email ? [o.email] : []).map((em: string) => (
                    <div key={em} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MailOutlined style={{ color: PRIMARY, fontSize: 12 }} /><Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{em}</Text></div>
                  ))}
                  {!phones.length && !emails.length && !o.phone && !o.email && <Text type="secondary" style={{ fontSize: 12 }}>لا توجد بيانات اتصال</Text>}
                </div>
                {bank && (
                  <>
                    <Divider style={{ margin: '10px 0' }} />
                    <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px' }}>
                      <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>الحساب البنكي</Text>
                      <Text style={{ fontSize: 12 }}>{bank.bankName}</Text><br />
                      <Text style={{ fontSize: 12, fontFamily: 'monospace', direction: 'ltr', display: 'inline-block', color: '#555' }}>{bank.iban}</Text>
                    </div>
                  </>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Modal open={editing != null} title={editing === 'new' ? 'إضافة مالك' : 'تعديل الملكية'} okText="حفظ" cancelText="إلغاء" onOk={save} confirmLoading={saving}
        onCancel={() => setEditing(null)} destroyOnClose width={600}>
        <Form form={form} layout="vertical">
          {editing === 'new' && (
            <>
              <Segmented block value={mode} onChange={v => setMode(v as 'existing' | 'new')} style={{ marginBottom: 12 }}
                options={[{ value: 'existing', label: 'مالك مسجل' }, { value: 'new', label: 'مالك جديد' }]} />
              {mode === 'existing' ? (
                <Form.Item name="partyId" label="المالك" rules={[{ required: true, message: 'اختر المالك' }]}>
                  <Select showSearch filterOption={false} onSearch={searchParties} placeholder="ابحث بالاسم أو الهوية…"
                    options={parties.map(p => ({ value: p.id, label: `${p.nameAr ?? p.nameEn ?? ''}${p.emiratesId ? ` — ${p.emiratesId}` : ''}` }))} />
                </Form.Item>
              ) : (
                <Row gutter={12}>
                  <Col span={12}><Form.Item name="partyType" label="النوع"><Select options={[{ value: 'individual', label: 'فرد' }, { value: 'company', label: 'شركة' }]} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="nameAr" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
                  <Col span={12}><Form.Item noStyle shouldUpdate={(a, b) => a.partyType !== b.partyType}>
                    {({ getFieldValue }) => getFieldValue('partyType') === 'company'
                      ? <Form.Item name="tradeLicenseNo" label="رقم الرخصة"><Input dir="ltr" /></Form.Item>
                      : <Form.Item name="emiratesId" label="الهوية الإماراتية"><Input dir="ltr" placeholder="784-XXXX-XXXXXXX-X" /></Form.Item>}
                  </Form.Item></Col>
                  <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
                  <Col span={12}><Form.Item name="email" label="البريد"><Input dir="ltr" /></Form.Item></Col>
                  <Col span={24}><Form.Item name="address" label="العنوان"><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="bankName" label="البنك"><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="iban" label="IBAN"><Input dir="ltr" /></Form.Item></Col>
                </Row>
              )}
            </>
          )}
          <Row gutter={12}>
            <Col span={8}><Form.Item name="ownershipPercentage" label="نسبة الملكية %"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="fromDate" label="مالك منذ"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="isPrimary" label="المالك المسؤول" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════ الوثائق ═══════════════════════════
const DOC_TYPES = [
  { value: 'title_deed', label: 'سند الملكية' }, { value: 'trade_license', label: 'الرخصة التجارية' }, { value: 'contract', label: 'عقد' },
  { value: 'certificate', label: 'شهادة' }, { value: 'report', label: 'تقرير' }, { value: 'photo', label: 'صورة' }, { value: 'invoice', label: 'فاتورة' }, { value: 'other', label: 'أخرى' },
];
const docIcon = (mime?: string) => (/pdf/.test(mime ?? '') ? <FilePdfOutlined style={{ color: '#cf1322' }} /> : /^image\//.test(mime ?? '') ? <FileImageOutlined style={{ color: '#1677ff' }} /> : <FileTextOutlined style={{ color: PRIMARY }} />);
const kb = (n?: number) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function BuildingDocsLive({ buildingId, branchId, canManage, onCount }: { buildingId: number; branchId?: number; canManage: boolean; onCount?: (n: number) => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = useCallback(() => {
    setLoading(true);
    api<any[]>('/documents', { query: { entityType: 'building', entityId: buildingId } })
      .then(r => { setDocs(r); onCount?.(r.length); }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    const v = await form.validateFields();
    if (!files.length) { message.warning('اختر ملفاً'); return; }
    setSaving(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f.originFileObj as File);
        fd.append('entityType', 'building');
        fd.append('entityId', String(buildingId));
        fd.append('documentType', v.documentType);
        if (v.expiryDate) fd.append('expiryDate', v.expiryDate.format('YYYY-MM-DD'));
        if (branchId) fd.append('branchId', String(branchId));
        await apiUpload('/documents', fd);
      }
      message.success('تم رفع الوثائق');
      setOpen(false); setFiles([]);
      load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const remove = async (d: any) => {
    try { await api(`/documents/${d.id}`, { method: 'DELETE' }); message.success('تم حذف الوثيقة'); load(); } catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <Card bordered={false} style={{ borderRadius: 10 }}>
      <Table size="small" rowKey="id" loading={loading} dataSource={docs} pagination={false} locale={{ emptyText: <Empty description="لا توجد وثائق للمبنى" /> }}
        columns={[
          { title: 'الوثيقة', dataIndex: 'fileName', render: (v, d) => <Space>{docIcon(d.mimeType)}<a onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType)}>{v}</a></Space> },
          { title: 'النوع', dataIndex: 'typeLabel', width: 130 },
          { title: 'الحجم', dataIndex: 'sizeBytes', width: 90, render: v => kb(v) },
          { title: 'تاريخ الرفع', dataIndex: 'createdAt', width: 120, render: v => (v ? dayjs(v).format('YYYY-MM-DD') : '—') },
          { title: 'الانتهاء', dataIndex: 'expiryDate', width: 130, render: v => !v ? '—' : (
            <span style={{ color: dayjs(v).isBefore(dayjs()) ? '#ff4d4f' : dayjs(v).diff(dayjs(), 'day') < 60 ? '#fa8c16' : undefined }}>{v}</span>) },
          { title: '', key: 'a', width: 120, render: (_, d) => (
            <Space size={2}>
              <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType)} />
              <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => openBlob(`/documents/${d.id}/download`, d.fileName, d.mimeType, true)} />
              {canManage && <Popconfirm title="حذف الوثيقة؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(d)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
            </Space>) },
        ]} />
      <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={() => { form.resetFields(); form.setFieldsValue({ documentType: 'other' }); setFiles([]); setOpen(true); }}>رفع وثيقة جديدة</Button>
      <Modal open={open} title="رفع وثيقة للمبنى" okText="رفع" cancelText="إلغاء" onOk={upload} confirmLoading={saving} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="documentType" label="نوع الوثيقة" rules={[{ required: true }]}><Select options={DOC_TYPES} /></Form.Item>
          <Form.Item name="expiryDate" label="تاريخ الانتهاء (إن وجد)"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Upload multiple fileList={files} beforeUpload={() => false} onChange={({ fileList }) => setFiles(fileList)} maxCount={10}>
            <Button icon={<UploadOutlined />}>اختر الملفات</Button>
          </Upload>
        </Form>
      </Modal>
    </Card>
  );
}

// ═══════════════════════════ سجل النشاط ═══════════════════════════
export function BuildingActivityLive({ buildingId }: { buildingId: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const load = useCallback((p: number) => {
    setLoading(true);
    api<Paged<any>>(`/buildings/${buildingId}/activity`, { query: { page: p, pageSize: 30 } })
      .then(r => { setRows(r.items); setTotal(r.total); setPage(p); }).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId]);
  useEffect(() => { load(1); }, [load]);
  return (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>
        <ClockCircleOutlined style={{ marginInlineEnd: 8, color: PRIMARY }} />سجل النشاط والأحداث <Tag>{total}</Tag>
      </Text>
      {loading ? <Spin /> : rows.length === 0 ? <Empty description="لا توجد أحداث لهذا المبنى" /> : (
        <Timeline items={rows.map(a => ({
          color: ACTIVITY_COLOR[a.action] ?? 'blue',
          children: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div><Text style={{ fontSize: 13 }}>{a.description}</Text>{a.user && <div style={{ fontSize: 11, color: '#999' }}>{a.user}</div>}</div>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{dayjs(a.occurredAt).format('YYYY-MM-DD HH:mm')}</Text>
            </div>
          ),
        }))} />
      )}
      {total > 30 && (
        <Space style={{ display: 'flex', justifyContent: 'center' }}>
          <Button size="small" disabled={page <= 1} onClick={() => load(page - 1)}>السابق</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>صفحة {page} من {Math.ceil(total / 30)}</Text>
          <Button size="small" disabled={page * 30 >= total} onClick={() => load(page + 1)}>التالي</Button>
        </Space>
      )}
    </Card>
  );
}

// ═══════════════════════════ الفواتير والمالية ═══════════════════════════
const INV_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, overdue: { color: 'error', label: 'متأخرة' }, cancelled: { color: 'default', label: 'ملغاة' },
};

export function BuildingFinanceLive({ buildingId }: { buildingId: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'all' | 'maintenance' | 'supply'>('all');
  const [status, setStatus] = useState<string | undefined>();
  useEffect(() => {
    setLoading(true);
    api<Paged<any>>('/invoices', { query: { buildingId, pageSize: 0, sort: 'date', desc: true } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId]);

  const valid = rows.filter(i => i.status !== 'cancelled' && i.status !== 'draft');
  const isAmc = (i: any) => i.type === 'maintenance' && !i.contractId;
  const sum = (list: any[], f: string) => list.reduce((s, i) => s + Number(i[f] ?? 0), 0);
  const amc = valid.filter(isAmc), supply = valid.filter(i => !isAmc(i));
  const overdue = valid.filter(i => i.status === 'overdue');
  const shown = rows.filter(i => (kind === 'all' || (kind === 'maintenance' ? isAmc(i) : !isAmc(i))) && (!status || i.status === status));

  // last 6 months: invoiced vs collected
  const months = Array.from({ length: 6 }, (_, k) => dayjs().subtract(5 - k, 'month'));
  const series = [
    { name: 'المفوتر', data: months.map(m => Math.round(sum(valid.filter(i => dayjs(i.date).isSame(m, 'month')), 'amount'))) },
    { name: 'المحصّل', data: months.map(m => Math.round(sum(valid.filter(i => dayjs(i.date).isSame(m, 'month')), 'paid'))) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[12, 12]}>
        {[
          { label: 'إجمالي المفوتر', v: sum(valid, 'amount'), c: PRIMARY, bg: '#e8f5e9', i: <DollarOutlined /> },
          { label: 'المحصّل', v: sum(valid, 'paid'), c: '#52c41a', bg: '#f6ffed', i: <CheckCircleOutlined /> },
          { label: 'الرصيد المستحق', v: sum(valid, 'balance'), c: '#fa8c16', bg: '#fff7e6', i: <ClockCircleOutlined /> },
          { label: `متأخر (${overdue.length} فاتورة)`, v: sum(overdue, 'balance'), c: '#ff4d4f', bg: '#fff1f0', i: <WarningOutlined /> },
          { label: `فواتير الصيانة AMC (${amc.length})`, v: sum(amc, 'amount'), c: '#722ed1', bg: '#f9f0ff', i: <ToolOutlined /> },
          { label: `فواتير المستأجرين (${supply.length})`, v: sum(supply, 'amount'), c: '#1677ff', bg: '#e6f4ff', i: <FireOutlined /> },
        ].map(s => (
          <Col xs={12} md={8} xl={4} key={s.label}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <Statistic title={<span style={{ fontSize: 11 }}>{s.label}</span>} value={s.v} precision={0} prefix={<span style={{ color: s.c }}>{s.i}</span>}
                valueStyle={{ color: s.c, fontSize: 17, fontWeight: 700 }} suffix={<span style={{ fontSize: 11 }}>د.إ</span>} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small" bordered={false} style={{ borderRadius: 10 }} title={<Text strong>المفوتر والمحصّل — آخر 6 أشهر</Text>}>
        <ReactApexChart type="bar" height={220} series={series}
          options={{ chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' }, colors: [PRIMARY, '#52c41a'], plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
            dataLabels: { enabled: false }, xaxis: { categories: months.map(m => m.format('YYYY-MM')) }, legend: { position: 'top' },
            tooltip: { y: { formatter: (v: number) => `${v.toLocaleString()} د.إ` } } }} />
      </Card>
      <Card size="small" bordered={false} style={{ borderRadius: 10 }}
        title={<Text strong>فواتير المبنى ({shown.length})</Text>}
        extra={<Space wrap>
          <Segmented size="small" value={kind} onChange={v => setKind(v as any)} options={[{ value: 'all', label: 'الكل' }, { value: 'maintenance', label: 'الصيانة AMC' }, { value: 'supply', label: 'المستأجرون' }]} />
          <Select size="small" allowClear placeholder="الحالة" style={{ width: 130 }} value={status} onChange={setStatus}
            options={Object.entries(INV_STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
        </Space>}>
        <Table size="small" rowKey="id" loading={loading} dataSource={shown} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="لا توجد فواتير" /> }}
          onRow={i => ({ style: i.status === 'overdue' ? { background: '#fff1f0' } : undefined })}
          columns={[
            { title: 'رقم الفاتورة', dataIndex: 'invoiceNo', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
            { title: 'العميل', dataIndex: 'customer', render: (v, i) => <div>{v}{i.unit && <div style={{ fontSize: 11, color: '#888' }}>وحدة {i.unit}</div>}</div> },
            { title: 'النوع', dataIndex: 'typeLabel', render: (v, i) => <Tag color={isAmc(i) ? 'purple' : 'blue'}>{isAmc(i) ? 'صيانة AMC' : v}</Tag> },
            { title: 'التاريخ', dataIndex: 'date' },
            { title: 'الاستحقاق', dataIndex: 'dueDate', render: (v, i) => <span style={{ color: i.status === 'overdue' ? '#ff4d4f' : undefined }}>{v}</span> },
            { title: 'الإجمالي', dataIndex: 'amount', render: v => money(v) },
            { title: 'المدفوع', dataIndex: 'paid', render: v => <span style={{ color: '#52c41a' }}>{money(v)}</span> },
            { title: 'الرصيد', dataIndex: 'balance', render: v => <Text strong style={{ color: Number(v) > 0 ? '#d4380d' : '#888' }}>{money(v)}</Text> },
            { title: 'الحالة', dataIndex: 'status', render: (s, i) => (
              <div><Tag color={INV_STATUS[s]?.color}>{INV_STATUS[s]?.label ?? i.statusLabel}</Tag>
                {s === 'overdue' && <div style={{ fontSize: 10, color: '#ff4d4f' }}>متأخرة {dayjs().diff(dayjs(i.dueDate), 'day')} يوم</div>}
                {s === 'paid' && i.paidDate && <div style={{ fontSize: 10, color: '#888' }}>سُددت {i.paidDate}</div>}</div>) },
          ]} />
      </Card>
    </div>
  );
}
