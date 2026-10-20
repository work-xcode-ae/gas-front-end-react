import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Card, Row, Col, Form, Input, InputNumber, Select, Switch, Button, Table, Modal, Tag, Typography, Upload, Space, Popconfirm, Empty, Spin,
  message, Tabs, Alert, Image,
} from 'antd';
import {
  BankOutlined, ApartmentOutlined, DollarOutlined, FireOutlined, NumberOutlined, UnorderedListOutlined, SaveOutlined, UploadOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { API_BASE, api, apiUpload, errorMessage, type Paged } from '../../api/client';
import { clearReferenceCache, locName, useReference } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';
import LookupListSettings from './LookupListSettings';

const { Text } = Typography;

// ═════════════ company profile + branding ═════════════
function CompanySection({ canManage }: { canManage: boolean }) {
  const { data: ref } = useReference('ar');
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>('/companies', { query: { pageSize: 0 } })
      .then(r => { const c = r.items[0] ?? null; setCompany(c); if (c) form.setFieldsValue(c); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [form]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (company) await api(`/companies/${company.id}`, { method: 'PUT', body: { ...company, ...v } });
      else await api('/companies', { method: 'POST', body: { ...v, isActive: true } });
      message.success('تم حفظ بيانات الشركة'); load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const upload = async (kind: 'logo' | 'logo_dark' | 'stamp', file: File) => {
    if (!company) { message.warning('احفظ بيانات الشركة أولاً'); return; }
    const fd = new FormData(); fd.append('file', file);
    try { await apiUpload(`/companies/${company.id}/branding/${kind}`, fd); message.success('تم رفع الصورة'); load(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  const img = (path?: string | null) => (path ? `${API_BASE}/files/${path}` : undefined);

  if (loading) return <Spin />;
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }} title={<Text strong>بيانات الشركة</Text>}
          extra={canManage && <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>حفظ</Button>}>
          <Form form={form} layout="vertical" disabled={!canManage}>
            <Row gutter={12}>
              <Col span={12}><Form.Item name="nameAr" label="اسم الشركة بالعربية" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="nameEn" label="اسم الشركة بالإنجليزية" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="code" label="الرمز" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="trn" label="الرقم الضريبي (TRN)"><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="baseCurrencyId" label="العملة الأساسية">
                <Select allowClear options={(ref?.currencies ?? []).map(c => ({ value: c.id, label: `${c.code} — ${locName(c, true)}` }))} /></Form.Item></Col>
              <Col span={8}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="email" label="البريد"><Input dir="ltr" /></Form.Item></Col>
              <Col span={8}><Form.Item name="website" label="الموقع الإلكتروني"><Input dir="ltr" /></Form.Item></Col>
              <Col span={24}><Form.Item name="address" label="العنوان"><Input.TextArea rows={2} /></Form.Item></Col>
            </Row>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={9}>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }} title={<Text strong>الهوية والختم</Text>}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>تظهر على صفحة الدخول والفواتير المطبوعة.</Text>
          {([['logo', 'الشعار', company?.logoPath], ['logo_dark', 'الشعار (خلفية داكنة)', company?.logoDarkPath], ['stamp', 'الختم', company?.stampPath]] as const).map(([kind, label, path]) => (
            <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
              <div style={{ width: 90, height: 60, borderRadius: 8, background: kind === 'logo_dark' ? '#0b2e18' : '#fafafa', border: '1px solid #f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {path ? <Image src={img(path)} height={52} style={{ objectFit: 'contain' }} preview /> : <Text type="secondary" style={{ fontSize: 11 }}>لا يوجد</Text>}
              </div>
              <div style={{ flex: 1 }}><Text style={{ fontSize: 13 }}>{label}</Text></div>
              {canManage && (
                <Upload accept="image/*" showUploadList={false} beforeUpload={f => { upload(kind, f); return false; }}>
                  <Button size="small" icon={<UploadOutlined />}>{path ? 'تغيير' : 'رفع'}</Button>
                </Upload>
              )}
            </div>
          ))}
        </Card>
      </Col>
    </Row>
  );
}

// ═════════════ generic CRUD table for small master tables ═════════════
interface Field { name: string; label: string; required?: boolean; type?: 'text' | 'ltr' | 'number' | 'switch' | 'select'; options?: { value: unknown; label: string }[]; span?: number; render?: (v: any, r: any) => ReactNode; hideInTable?: boolean; readOnlyOnEdit?: boolean }

function CrudSection({ path, title, fields, canManage, defaults, onSaved, allowAdd = true, allowDelete = true, hint }: {
  path: string; title: string; fields: Field[]; canManage: boolean; defaults?: Record<string, unknown>; onSaved?: () => void;
  allowAdd?: boolean; allowDelete?: boolean; hint?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const load = useCallback(() => {
    setLoading(true);
    api<Paged<any>>(path, { query: { pageSize: 0 } }).then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { load(); }, [load]);

  const open = (r: any | 'new') => { form.resetFields(); form.setFieldsValue(r === 'new' ? { ...defaults } : r); setEditing(r); };
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing === 'new') await api(path, { method: 'POST', body: { ...defaults, ...v } });
      else await api(`${path}/${editing.id}`, { method: 'PUT', body: { ...editing, ...v } });
      message.success('تم الحفظ'); setEditing(null); load(); clearReferenceCache(); onSaved?.();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const toggle = async (r: any, isActive: boolean) => {
    try { await api(`${path}/${r.id}`, { method: 'PUT', body: { ...r, isActive } }); load(); clearReferenceCache(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async (r: any) => {
    try { await api(`${path}/${r.id}`, { method: 'DELETE' }); message.success('تم الحذف'); load(); clearReferenceCache(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const input = (f: Field, disabled = false) => f.type === 'number' ? <InputNumber style={{ width: '100%' }} disabled={disabled} />
    : f.type === 'switch' ? <Switch disabled={disabled} /> : f.type === 'select' ? <Select allowClear showSearch optionFilterProp="label" options={f.options as any} disabled={disabled} />
      : <Input dir={f.type === 'ltr' ? 'ltr' : undefined} disabled={disabled} />;
  const hasActive = fields.some(f => f.name === 'isActive');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div><Text strong style={{ fontSize: 14 }}>{title}</Text>{hint && <div style={{ fontSize: 12, color: '#888' }}>{hint}</div>}</div>
        {canManage && allowAdd && <Button type="primary" icon={<PlusOutlined />} onClick={() => open('new')}>إضافة</Button>}
      </div>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={{ pageSize: 15, hideOnSinglePage: true }} scroll={{ x: 600 }}
        locale={{ emptyText: <Empty description="لا توجد سجلات" /> }}
        columns={[
          ...fields.filter(f => !f.hideInTable && f.name !== 'isActive').map(f => ({
            title: f.label, dataIndex: f.name, render: (v: any, r: any) => f.render ? f.render(v, r)
              : f.type === 'select' ? (f.options?.find(o => o.value === v)?.label ?? (v ?? '—'))
                : v === null || v === undefined || v === '' ? <Text type="secondary">—</Text> : <span dir={f.type === 'ltr' ? 'ltr' : undefined}>{String(v)}</span>,
          })),
          ...(hasActive ? [{ title: 'الحالة', key: 'act', width: 100, render: (_: unknown, r: any) => canManage
            ? <Switch size="small" checked={r.isActive} onChange={c => toggle(r, c)} checkedChildren="نشط" unCheckedChildren="موقوف" />
            : <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? 'نشط' : 'موقوف'}</Tag> }] : []),
          ...(canManage ? [{ title: '', key: 'a', width: 90, render: (_: unknown, r: any) => (
            <Space size={2}>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(r)} />
              {allowDelete && <Popconfirm title="حذف السجل؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(r)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}
            </Space>) }] : []),
        ]} />
      <Modal open={editing != null} title={editing === 'new' ? `إضافة — ${title}` : `تعديل — ${title}`} okText="حفظ" cancelText="إلغاء" onOk={save}
        confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose width={620}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            {fields.map(f => (
              <Col span={f.span ?? 12} key={f.name}>
                <Form.Item name={f.name} label={f.label} valuePropName={f.type === 'switch' ? 'checked' : 'value'} rules={f.required ? [{ required: true, message: 'مطلوب' }] : undefined}>
                  {input(f, !!f.readOnlyOnEdit && editing !== 'new')}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ═════════════ lookup lists (any type) ═════════════
function LookupsSection() {
  const [types, setTypes] = useState<any[]>([]);
  const [code, setCode] = useState<string | undefined>();
  useEffect(() => {
    api<Paged<any>>('/lookup-types', { query: { pageSize: 0 } })
      .then(r => { const t = [...r.items].sort((a, b) => String(a.nameAr ?? a.code).localeCompare(String(b.nameAr ?? b.code), 'ar')); setTypes(t); })
      .catch(e => message.error(errorMessage(e)));
  }, []);
  const cur = types.find(t => t.code === code);
  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        <Text strong>القائمة:</Text>
        <Select showSearch optionFilterProp="label" style={{ width: 320 }} placeholder="اختر قائمة لتعديل قيمها…" value={code} onChange={setCode}
          options={types.map(t => ({ value: t.code, label: `${t.nameAr ?? t.nameEn ?? t.code} (${t.code})` }))} />
      </Space>
      <Alert type="info" showIcon style={{ marginBottom: 10, fontSize: 12 }}
        message="قيم القوائم تظهر في القوائم المنسدلة في النظام. القيم الأساسية التي يعتمد عليها النظام لا يمكن حذفها — يمكن إيقافها أو تعديل أسمائها." />
      {code ? <LookupListSettings key={code} typeCode={code} title={cur?.nameAr ?? cur?.nameEn ?? code} hint={cur?.description ?? undefined} />
        : <Empty description="اختر قائمة" />}
    </div>
  );
}

// ═════════════ page section ═════════════
export default function SystemSettings() {
  const { can } = useAuth();
  const canManage = can('settings.manage');
  const { data: ref } = useReference('ar');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [tab, setTab] = useState('company');
  useEffect(() => { api<Paged<any>>('/companies', { query: { pageSize: 0 } }).then(r => setCompanyId(r.items[0]?.id ?? null)).catch(() => undefined); }, []);
  const cities = (ref?.cities ?? []).map(c => ({ value: c.id, label: locName(c, true) || String(c.code ?? c.id) }));
  const branches = [{ value: null, label: 'كل الفروع' }, ...(ref?.branches ?? []).map(b => ({ value: b.id, label: `${b.code} — ${locName(b, true)}` }))];

  return (
    <Tabs tabPosition="top" activeKey={tab} onChange={setTab} type="card" size="small" style={{ marginTop: 8 }} items={[
      { key: 'company', label: <span><BankOutlined /> الشركة</span>, children: <CompanySection canManage={canManage} /> },
      { key: 'branches', label: <span><ApartmentOutlined /> الفروع</span>, children: (
        <CrudSection path="/branches" title="الفروع" canManage={canManage} defaults={{ companyId, isActive: true }}
          hint="كل مبنى ومستخدم مرتبط بفرع؛ صلاحيات المستخدم تُقيد بالفروع المسموح بها."
          fields={[
            { name: 'code', label: 'الرمز', required: true, type: 'ltr', span: 8 },
            { name: 'nameAr', label: 'الاسم بالعربية', required: true, span: 8 },
            { name: 'nameEn', label: 'الاسم بالإنجليزية', type: 'ltr', span: 8 },
            { name: 'cityId', label: 'المدينة', type: 'select', options: cities },
            { name: 'phone', label: 'الهاتف', type: 'ltr' },
            { name: 'email', label: 'البريد', type: 'ltr', hideInTable: true },
            { name: 'address', label: 'العنوان', span: 24, hideInTable: true },
            { name: 'isActive', label: 'نشط', type: 'switch' },
          ]} />
      ) },
      { key: 'gas', label: <span><FireOutlined /> أنواع الغاز</span>, children: (
        <CrudSection path="/gas-types" title="أنواع الغاز" canManage={canManage} defaults={{ isActive: true }}
          hint="معامل التحويل يُستخدم لتحويل استهلاك العدادات (م³) إلى لترات في الخزانات وتوقع التعبئة."
          fields={[
            { name: 'code', label: 'الرمز', required: true, type: 'ltr', span: 8 },
            { name: 'nameAr', label: 'الاسم بالعربية', required: true, span: 8 },
            { name: 'nameEn', label: 'الاسم بالإنجليزية', type: 'ltr', span: 8 },
            { name: 'litreToM3', label: 'م³ لكل لتر (معامل التحويل)', type: 'number', required: true, render: v => <Tag color="blue">{v}</Tag> },
            { name: 'isActive', label: 'نشط', type: 'switch' },
          ]} />
      ) },
      { key: 'currencies', label: <span><DollarOutlined /> العملات</span>, children: (
        <CrudSection path="/currencies" title="العملات" canManage={canManage} defaults={{ isActive: true, decimalPlaces: 2 }}
          fields={[
            { name: 'code', label: 'الرمز (ISO)', required: true, type: 'ltr', span: 8 },
            { name: 'nameAr', label: 'الاسم بالعربية', span: 8 },
            { name: 'nameEn', label: 'الاسم بالإنجليزية', type: 'ltr', span: 8 },
            { name: 'symbol', label: 'الرمز المختصر', span: 8 },
            { name: 'decimalPlaces', label: 'المنازل العشرية', type: 'number', span: 8 },
            { name: 'isActive', label: 'نشطة', type: 'switch', span: 8 },
          ]} />
      ) },
      { key: 'numbering', label: <span><NumberOutlined /> الترقيم</span>, children: (
        <CrudSection path="/number-sequences" title="تسلسل الأرقام" canManage={canManage} allowAdd={false} allowDelete={false}
          hint="ترقيم المستندات تلقائياً (الفواتير، العقود، الطلبات…). تعديل «آخر رقم» يغيّر الرقم التالي — استخدمه بحذر."
          fields={[
            { name: 'prefix', label: 'البادئة', required: true, type: 'ltr', readOnlyOnEdit: true, span: 8, render: v => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag> },
            { name: 'branchId', label: 'الفرع', type: 'select', options: branches as any, span: 8, readOnlyOnEdit: true },
            { name: 'year', label: 'السنة', type: 'number', span: 8, readOnlyOnEdit: true, render: v => v ?? 'مستمر' },
            { name: 'lastValue', label: 'آخر رقم', type: 'number', span: 12 },
            { name: 'padding', label: 'عدد الخانات (الرقم التالي)', type: 'number', span: 12,
              render: (v, r) => <span dir="ltr" style={{ fontFamily: 'monospace' }}>{`${r.prefix}-${r.year ? `${r.year}-` : ''}${String((r.lastValue ?? 0) + 1).padStart(v ?? 4, '0')}`}</span> },
          ]} />
      ) },
      { key: 'lookups', label: <span><UnorderedListOutlined /> القوائم</span>, children: <LookupsSection /> },
    ]} />
  );
}

