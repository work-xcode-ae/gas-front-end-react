import React, { useEffect, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message, Tooltip,
} from 'antd';
import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SwapOutlined, ToolOutlined, WarningOutlined, DollarOutlined, InboxOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useReference, locName } from '../../api/reference';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

interface Asset {
  id: number; assetCode?: string | null; nameAr?: string | null; nameEn?: string | null; categoryId?: number | null; statusId?: number | null;
  branchId?: number | null; buildingId?: number | null; serialNo?: string | null; purchaseDate?: string | null; purchaseCost?: number | null;
  assignedEmployeeId?: number | null; warrantyExpiry?: string | null; notes?: string | null;
}
interface Lk { id: number; code: string; label: string }
const STATUS_COLOR: Record<string, string> = { in_use: 'green', in_stock: 'blue', maintenance: 'orange', retired: 'default', lost: 'red' };
const aName = (a?: Asset | null) => (a ? a.nameAr || a.nameEn || a.assetCode || `#${a.id}` : '—');

const AssetsPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('assets.manage');
  const { data: ref } = useReference('ar');
  const [rows, setRows] = useState<Asset[]>([]);
  const [cats, setCats] = useState<Lk[]>([]);
  const [statuses, setStatuses] = useState<Lk[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<number | undefined>();
  const [st, setSt] = useState<number | undefined>();
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [buying, setBuying] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const [buyForm] = Form.useForm();
  const [assignForm] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Paged<Asset>>('/assets', { query: { pageSize: 0 } }),
      api<Lk[]>('/lookups/ASSET_CATEGORY').catch(() => [] as Lk[]),
      api<Lk[]>('/lookups/ASSET_STATUS').catch(() => [] as Lk[]),
      api<any[]>('/employees/options').catch(() => []),
      api<Paged<any>>('/buildings', { query: { pageSize: 0 } }).then(r => r.items).catch(() => []),
      api<any[]>('/vendors/options').catch(() => []),
    ]).then(([a, c, s, e, b, v]) => { setRows(a.items); setCats(c); setStatuses(s); setEmployees(e); setBuildings(b); setVendors(v); })
      .catch(err => message.error(errorMessage(err))).finally(() => setLoading(false));
  }, [key]);

  const lk = (list: Lk[], id?: number | null) => list.find(x => x.id === id);
  const statusCode = (a: Asset) => lk(statuses, a.statusId)?.code ?? '';
  const empName = (id?: number | null) => employees.find(e => e.id === id)?.name ?? null;
  const bName = (id?: number | null) => { const b = buildings.find(x => x.id === id); return b ? `${b.code} — ${b.name ?? b.nameAr ?? ''}` : null; };
  const brName = (id?: number | null) => locName(ref?.branches.find(b => b.id === id), true) || null;
  const daysTo = (d?: string | null) => (d ? dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day') : null);

  const s = search.trim().toLowerCase();
  const shown = rows.filter(a => (!cat || a.categoryId === cat) && (!st || a.statusId === st)
    && (!s || [a.assetCode, a.nameAr, a.nameEn, a.serialNo, empName(a.assignedEmployeeId)].some(x => (x ?? '').toLowerCase().includes(s))));
  const byStatus = (code: string) => rows.filter(a => statusCode(a) === code).length;
  const totalCost = rows.filter(a => !['retired', 'lost'].includes(statusCode(a))).reduce((x, a) => x + Number(a.purchaseCost ?? 0), 0);
  const warranty = rows.filter(a => { const n = daysTo(a.warrantyExpiry); return n != null && n >= 0 && n <= 60; }).length;

  const open = (a: Asset | 'new') => {
    form.resetFields();
    if (a === 'new') form.setFieldsValue({ purchaseDate: dayjs(), statusId: statuses.find(x => x.code === 'in_stock')?.id, vatRate: 5 });
    else form.setFieldsValue({ ...a, purchaseDate: a.purchaseDate ? dayjs(a.purchaseDate) : undefined, warrantyExpiry: a.warrantyExpiry ? dayjs(a.warrantyExpiry) : undefined });
    setEditing(a);
  };
  const body = (base: Partial<Asset>, f: any): Partial<Asset> => ({
    ...base, assetCode: f.assetCode || null, nameAr: f.nameAr, nameEn: f.nameEn || null, categoryId: f.categoryId ?? null, statusId: f.statusId ?? null,
    branchId: f.branchId ?? null, buildingId: f.buildingId ?? null, serialNo: f.serialNo || null, purchaseDate: f.purchaseDate ? f.purchaseDate.format('YYYY-MM-DD') : null,
    purchaseCost: f.purchaseCost ?? null, assignedEmployeeId: f.assignedEmployeeId ?? null, warrantyExpiry: f.warrantyExpiry ? f.warrantyExpiry.format('YYYY-MM-DD') : null,
    notes: f.notes || null,
  });
  const save = async () => {
    const f = await form.validateFields();
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await api<Asset>('/assets', { method: 'POST', body: body({}, f) });
        if (f.vendorId && created?.id) {
          // bought from a supplier → vendor bill: Dr fixed assets + VAT input / Cr supplier
          try {
            const r = await api<any>(`/assets/${created.id}/purchase`, { method: 'POST', body: { vendorId: f.vendorId, billNo: f.billNo, billDate: f.purchaseDate ? f.purchaseDate.format('YYYY-MM-DD') : null, branchId: f.branchId ?? null, vatRate: f.vatRate ?? 0 } });
            message.success(`تم حفظ الأصل وتسجيل فاتورة الشراء ${r.billNo}`);
          } catch (err) { message.warning(`تم حفظ الأصل، لكن لم تُسجل فاتورة الشراء: ${errorMessage(err)}`, 8); }
        } else message.success('تم حفظ الأصل');
      } else {
        await api(`/assets/${(editing as Asset).id}`, { method: 'PUT', body: body(editing as Asset, f) });
        message.success('تم حفظ الأصل');
      }
      setEditing(null); setKey(k => k + 1);
    } catch (err) { message.error(errorMessage(err), 6); } finally { setSaving(false); }
  };
  const saveAssign = async () => {
    if (!assigning) return;
    const f = await assignForm.validateFields();
    const statusId = statuses.find(x => x.code === (f.assignedEmployeeId ? 'in_use' : 'in_stock'))?.id ?? assigning.statusId;
    setSaving(true);
    try {
      await api(`/assets/${assigning.id}`, { method: 'PUT', body: { ...assigning, assignedEmployeeId: f.assignedEmployeeId ?? null, buildingId: f.buildingId ?? null, statusId } });
      message.success(f.assignedEmployeeId ? 'تم تسليم الأصل' : 'تم إرجاع الأصل للمخزن'); setAssigning(null); setKey(k => k + 1);
    } catch (err) { message.error(errorMessage(err), 6); } finally { setSaving(false); }
  };
  const openBuy = (a: Asset) => { buyForm.resetFields(); buyForm.setFieldsValue({ billDate: a.purchaseDate ? dayjs(a.purchaseDate) : dayjs(), vatRate: 5, branchId: a.branchId ?? undefined }); setBuying(a); };
  const saveBuy = async () => {
    if (!buying) return;
    const f = await buyForm.validateFields();
    setSaving(true);
    try {
      const r = await api<any>(`/assets/${buying.id}/purchase`, { method: 'POST', body: { vendorId: f.vendorId, billNo: f.billNo, billDate: f.billDate?.format('YYYY-MM-DD') ?? null, branchId: f.branchId ?? null, vatRate: f.vatRate ?? 0 } });
      message.success(`تم تسجيل فاتورة الشراء ${r.billNo} — ${Number(r.totalAmount).toLocaleString()} د.إ`); setBuying(null); setKey(k => k + 1);
    } catch (err) { message.error(errorMessage(err), 6); } finally { setSaving(false); }
  };
  const remove = async (a: Asset) => {
    try { await api(`/assets/${a.id}`, { method: 'DELETE' }); message.success('تم حذف الأصل'); setKey(k => k + 1); } catch (err) { message.error(errorMessage(err), 6); }
  };

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AppstoreOutlined /></span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>الأصول</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>معدات وأدوات وأجهزة الشركة: الموقع، العهدة، التكلفة والضمان</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)}>تحديث</Button>
        {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD, color: DARK }} onClick={() => open('new')}>أصل جديد</Button>}
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {[
          { label: 'إجمالي الأصول', value: rows.length, color: PRIMARY, bg: '#e8f5e9', icon: <AppstoreOutlined /> },
          { label: 'قيمة الأصول القائمة', value: `${Math.round(totalCost).toLocaleString()} د.إ`, color: '#722ed1', bg: '#f9f0ff', icon: <DollarOutlined /> },
          { label: 'قيد الاستخدام', value: byStatus('in_use'), color: '#52c41a', bg: '#f6ffed', icon: <ToolOutlined /> },
          { label: 'في المخزن', value: byStatus('in_stock'), color: '#1677ff', bg: '#e6f4ff', icon: <InboxOutlined /> },
          { label: 'تحت الصيانة', value: byStatus('maintenance'), color: '#fa8c16', bg: '#fff7e6', icon: <ToolOutlined /> },
          { label: 'ضمان ينتهي خلال 60 يوم', value: warranty, color: '#ff4d4f', bg: '#fff1f0', icon: <WarningOutlined /> },
        ].map(k => (
          <Col xs={12} md={8} xl={4} key={k.label}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: k.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, color: k.color }}>{k.icon}</span>
                <div><div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div><div style={{ fontSize: 11, color: '#666' }}>{k.label}</div></div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} style={{ borderRadius: 14 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="بحث بالرمز، الاسم، الرقم التسلسلي، الموظف…" style={{ width: 280 }} onChange={e => setSearch(e.target.value)} />
          <Select allowClear placeholder="الفئة" style={{ width: 160 }} value={cat} onChange={setCat} options={cats.map(c => ({ value: c.id, label: c.label }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 150 }} value={st} onChange={setSt} options={statuses.map(c => ({ value: c.id, label: c.label }))} />
        </Space>
        <Table<Asset> size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1150 }} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="لا توجد أصول مسجلة" /> }}
          columns={[
            { title: 'الرمز', dataIndex: 'assetCode', width: 100, render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
            { title: 'الأصل', key: 'n', render: (_, a) => <div><Text strong>{aName(a)}</Text>{a.serialNo && <div style={{ fontSize: 11, color: '#888', direction: 'ltr', textAlign: 'end' }}>S/N {a.serialNo}</div>}</div> },
            { title: 'الفئة', dataIndex: 'categoryId', render: v => lk(cats, v)?.label ?? '—' },
            { title: 'الحالة', key: 'st', render: (_, a) => { const x = lk(statuses, a.statusId); return x ? <Tag color={STATUS_COLOR[x.code]}>{x.label}</Tag> : '—'; } },
            { title: 'الموقع', key: 'loc', render: (_, a) => <div style={{ fontSize: 12 }}>{bName(a.buildingId) ?? brName(a.branchId) ?? '—'}</div> },
            { title: 'في عهدة', dataIndex: 'assignedEmployeeId', render: v => empName(v) ?? <Text type="secondary" style={{ fontSize: 11 }}>—</Text> },
            { title: 'الشراء', key: 'p', render: (_, a) => <div style={{ fontSize: 12 }}>{a.purchaseCost != null ? `${Number(a.purchaseCost).toLocaleString()} د.إ` : '—'}{a.purchaseDate && <div style={{ color: '#888', fontSize: 11 }}>{a.purchaseDate}</div>}</div> },
            { title: 'الضمان', dataIndex: 'warrantyExpiry', render: v => { const n = daysTo(v); if (n == null) return '—';
              return <div style={{ fontSize: 12 }}>{v}<div>{n < 0 ? <Tag style={{ fontSize: 10 }}>منتهٍ</Tag> : n <= 60 ? <Tag color="warning" style={{ fontSize: 10 }}>خلال {n} يوم</Tag> : <Tag color="success" style={{ fontSize: 10 }}>ساري</Tag>}</div></div>; } },
            { title: '', key: 'a', width: 150, render: (_, a) => canManage && (
              <Space size={2}>
                {Number(a.purchaseCost ?? 0) > 0 && <Tooltip title="تسجيل فاتورة الشراء من المورد"><Button size="small" type="text" icon={<ShoppingCartOutlined />} onClick={() => openBuy(a)} /></Tooltip>}
                <Tooltip title="تسليم / إرجاع"><Button size="small" type="text" icon={<SwapOutlined />} onClick={() => { assignForm.setFieldsValue({ assignedEmployeeId: a.assignedEmployeeId, buildingId: a.buildingId }); setAssigning(a); }} /></Tooltip>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(a)} />
                <Popconfirm title="حذف الأصل؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(a)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
              </Space>) },
          ]} />
      </Card>

      <Modal open={editing != null} title={editing === 'new' ? 'أصل جديد' : 'تعديل الأصل'} okText="حفظ" cancelText="إلغاء" onOk={save}
        confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose width={700}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="nameAr" label="اسم الأصل" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="assetCode" label="رمز الأصل" extra={editing === 'new' ? 'يُولَّد تلقائياً إن تُرك فارغاً' : undefined}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="serialNo" label="الرقم التسلسلي"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="categoryId" label="الفئة" rules={[{ required: true, message: 'اختر الفئة' }]}><Select options={cats.map(c => ({ value: c.id, label: c.label }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="statusId" label="الحالة"><Select options={statuses.map(c => ({ value: c.id, label: c.label }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="branchId" label="الفرع"><Select allowClear options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, true) }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="buildingId" label="المبنى (إن كان مركباً في مبنى)">
              <Select allowClear showSearch optionFilterProp="label" options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? b.nameAr ?? ''}` }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="assignedEmployeeId" label="في عهدة الموظف">
              <Select allowClear showSearch optionFilterProp="label" options={employees.map(e => ({ value: e.id, label: `${e.name}${e.employeeNo ? ` — ${e.employeeNo}` : ''}` }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="purchaseDate" label="تاريخ الشراء"><DatePicker style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} /></Form.Item></Col>
            <Col span={12}><Form.Item name="purchaseCost" label="تكلفة الشراء (د.إ)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="warrantyExpiry" label="انتهاء الضمان"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
            {editing === 'new' && (<>
              <Col span={24}><Text type="secondary" style={{ fontSize: 12 }}>شراء من مورد (اختياري) — تُسجل فاتورة مشتريات للمورد ويُقيد الأصل في حساب الأصول الثابتة</Text></Col>
              <Col span={10}><Form.Item name="vendorId" label="المورد"><Select allowClear showSearch optionFilterProp="label" options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Form.Item></Col>
              <Col span={8}><Form.Item name="billNo" label="رقم فاتورة المورد" dependencies={['vendorId']}
                rules={[({ getFieldValue }) => ({ validator: (_, v) => (!getFieldValue('vendorId') || (v && v.trim()) ? Promise.resolve() : Promise.reject(new Error('مطلوب'))) })]}><Input dir="ltr" /></Form.Item></Col>
              <Col span={6}><Form.Item name="vatRate" label="الضريبة %"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            </>)}
          </Row>
        </Form>
      </Modal>

      <Modal open={!!buying} title={`فاتورة شراء الأصل — ${aName(buying)}`} okText="تسجيل" cancelText="إلغاء" onOk={saveBuy} confirmLoading={saving} onCancel={() => setBuying(null)} destroyOnClose>
        <Text type="secondary" style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>
          التكلفة {Number(buying?.purchaseCost ?? 0).toLocaleString()} د.إ — القيد: مدين الأصول الثابتة + ضريبة المدخلات / دائن المورد
        </Text>
        <Form form={buyForm} layout="vertical">
          <Form.Item name="vendorId" label="المورد" rules={[{ required: true, message: 'اختر المورد' }]}><Select showSearch optionFilterProp="label" options={vendors.map(v => ({ value: v.id, label: v.name }))} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="billNo" label="رقم فاتورة المورد" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="billDate" label="تاريخ الفاتورة"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="vatRate" label="الضريبة %"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="branchId" label="الفرع"><Select allowClear options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, true) }))} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={!!assigning} title={`تسليم / إرجاع — ${aName(assigning)}`} okText="حفظ" cancelText="إلغاء" onOk={saveAssign} confirmLoading={saving}
        onCancel={() => setAssigning(null)} destroyOnClose>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="assignedEmployeeId" label="الموظف المستلم" extra="اتركه فارغاً لإرجاع الأصل إلى المخزن">
            <Select allowClear showSearch optionFilterProp="label" options={employees.map(e => ({ value: e.id, label: e.name }))} />
          </Form.Item>
          <Form.Item name="buildingId" label="الموقع (مبنى)">
            <Select allowClear showSearch optionFilterProp="label" options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? b.nameAr ?? ''}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetsPage;
