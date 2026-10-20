import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography, message, Descriptions, Avatar,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, TeamOutlined, UserOutlined, LinkOutlined, ToolOutlined, IdcardOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useReference, locName } from '../../api/reference';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

export interface Employee {
  id: number; employeeNo?: string | null; nameEn?: string | null; nameAr?: string | null; jobTitle?: string | null; departmentId?: number | null;
  branchId?: number | null; phone?: string | null; email?: string | null; emiratesId?: string | null; hireDate?: string | null; userId?: number | null;
  isActive: boolean; notes?: string | null;
}
interface Lk { id: number; code: string; label: string }
const eName = (e?: Employee | null) => (e ? e.nameAr || e.nameEn || `#${e.id}` : '—');

const EmployeesPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('employees.manage');
  const { data: ref } = useReference('ar');
  const [rows, setRows] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Lk[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<number | undefined>();
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Paged<Employee>>('/employees', { query: { pageSize: 0 } }),
      api<Lk[]>('/lookups/DEPARTMENT').catch(() => [] as Lk[]),
      api<Paged<any>>('/users', { query: { pageSize: 0 } }).then(r => r.items).catch(() => []),
      api<Paged<any>>('/assets', { query: { pageSize: 0 } }).then(r => r.items).catch(() => []),
    ]).then(([e, d, u, a]) => { setRows(e.items); setDepartments(d); setUsers(u); setAssets(a); })
      .catch(err => message.error(errorMessage(err))).finally(() => setLoading(false));
  }, [key]);

  const branchName = (id?: number | null) => locName(ref?.branches.find(b => b.id === id), true) || '—';
  const deptName = (id?: number | null) => departments.find(d => d.id === id)?.label ?? '—';
  const userOf = (id?: number | null) => users.find(u => u.id === id);
  const assetsOf = (id: number) => assets.filter(a => a.assignedEmployeeId === id);

  const s = search.trim().toLowerCase();
  const shown = rows.filter(e => (status === 'all' || (status === 'active') === e.isActive) && (!dept || e.departmentId === dept)
    && (!s || [e.employeeNo, e.nameAr, e.nameEn, e.jobTitle, e.phone, e.email, e.emiratesId].some(x => (x ?? '').toLowerCase().includes(s))));

  const byDept = useMemo(() => departments.map(d => ({ d, n: rows.filter(e => e.isActive && e.departmentId === d.id).length })).filter(x => x.n > 0), [rows, departments]);

  const open = (e: Employee | 'new') => {
    form.resetFields();
    if (e === 'new') form.setFieldsValue({ isActive: true, hireDate: dayjs() });
    else form.setFieldsValue({ ...e, hireDate: e.hireDate ? dayjs(e.hireDate) : undefined });
    setEditing(e);
  };
  const save = async () => {
    const f = await form.validateFields();
    const body = {
      ...(editing !== 'new' ? editing : {}), employeeNo: f.employeeNo || null, nameAr: f.nameAr, nameEn: f.nameEn || null, jobTitle: f.jobTitle || null,
      departmentId: f.departmentId ?? null, branchId: f.branchId ?? null, phone: f.phone || null, email: f.email || null, emiratesId: f.emiratesId || null,
      hireDate: f.hireDate ? f.hireDate.format('YYYY-MM-DD') : null, userId: f.userId ?? null, isActive: !!f.isActive, notes: f.notes || null,
    };
    setSaving(true);
    try {
      if (editing === 'new') await api('/employees', { method: 'POST', body });
      else await api(`/employees/${(editing as Employee).id}`, { method: 'PUT', body });
      message.success('تم حفظ الموظف'); setEditing(null); setKey(k => k + 1);
    } catch (err) { message.error(errorMessage(err), 6); } finally { setSaving(false); }
  };
  const toggle = async (e: Employee, isActive: boolean) => {
    try { await api(`/employees/${e.id}`, { method: 'PUT', body: { ...e, isActive } }); setKey(k => k + 1); } catch (err) { message.error(errorMessage(err)); }
  };
  const remove = async (e: Employee) => {
    try { await api(`/employees/${e.id}`, { method: 'DELETE' }); message.success('تم حذف الموظف'); setKey(k => k + 1); } catch (err) { message.error(errorMessage(err), 6); }
  };

  const service = (d?: string | null) => {
    if (!d) return null;
    const m = dayjs().diff(dayjs(d), 'month');
    return m < 12 ? `${m} شهر` : `${Math.floor(m / 12)} سنة${m % 12 ? ` و${m % 12} شهر` : ''}`;
  };

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TeamOutlined /></span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>الموظفون</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>بيانات الموظفين، الأقسام والفروع، ربطهم بحسابات النظام، والأصول التي في عهدتهم</div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)}>تحديث</Button>
        {canManage && <Button type="primary" icon={<PlusOutlined />} style={{ background: GOLD, borderColor: GOLD, color: DARK }} onClick={() => open('new')}>موظف جديد</Button>}
      </div>

      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        {[
          { label: 'إجمالي الموظفين', value: rows.length, color: PRIMARY, bg: '#e8f5e9', icon: <TeamOutlined /> },
          { label: 'على رأس العمل', value: rows.filter(e => e.isActive).length, color: '#52c41a', bg: '#f6ffed', icon: <UserOutlined /> },
          { label: 'مرتبطون بحساب نظام', value: rows.filter(e => e.userId).length, color: '#1677ff', bg: '#e6f4ff', icon: <LinkOutlined /> },
          { label: 'أصول في العهدة', value: assets.filter(a => a.assignedEmployeeId).length, color: '#fa8c16', bg: '#fff7e6', icon: <ToolOutlined /> },
        ].map(k => (
          <Col xs={12} md={6} key={k.label}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: k.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, color: k.color }}>{k.icon}</span>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div><div style={{ fontSize: 11, color: '#666' }}>{k.label}</div></div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      {byDept.length > 0 && (
        <Space wrap style={{ marginBottom: 12 }}>
          {byDept.map(({ d, n }) => <Tag key={d.id} color={dept === d.id ? 'green' : 'default'} style={{ cursor: 'pointer', padding: '2px 10px' }} onClick={() => setDept(dept === d.id ? undefined : d.id)}>{d.label}: {n}</Tag>)}
        </Space>
      )}

      <Card bordered={false} style={{ borderRadius: 14 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="بحث بالاسم، الرقم، الهاتف، الهوية…" style={{ width: 260 }} onChange={e => setSearch(e.target.value)} />
          <Select allowClear placeholder="القسم" style={{ width: 170 }} value={dept} onChange={setDept} options={departments.map(d => ({ value: d.id, label: d.label }))} />
          <Select style={{ width: 140 }} value={status} onChange={setStatus} options={[{ value: 'active', label: 'على رأس العمل' }, { value: 'inactive', label: 'غير نشط' }, { value: 'all', label: 'الكل' }]} />
        </Space>
        <Table<Employee> size="small" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 1100 }} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="لا يوجد موظفون" /> }}
          columns={[
            { title: 'الرقم', dataIndex: 'employeeNo', width: 100, render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v ?? '—'}</Text> },
            { title: 'الموظف', key: 'n', render: (_, e) => (
              <Space><Avatar size="small" icon={<UserOutlined />} style={{ background: e.isActive ? PRIMARY : '#bbb' }} />
                <div><a onClick={() => setViewing(e)} style={{ fontWeight: 600 }}>{eName(e)}</a>{e.jobTitle && <div style={{ fontSize: 11, color: '#888' }}>{e.jobTitle}</div>}</div></Space>) },
            { title: 'القسم', dataIndex: 'departmentId', render: v => deptName(v) },
            { title: 'الفرع', dataIndex: 'branchId', render: v => branchName(v) },
            { title: 'الهاتف', dataIndex: 'phone', render: v => (v ? <span dir="ltr">{v}</span> : '—') },
            { title: 'تاريخ التعيين', dataIndex: 'hireDate', render: v => v ? <div>{v}<div style={{ fontSize: 11, color: '#888' }}>{service(v)}</div></div> : '—' },
            { title: 'حساب النظام', dataIndex: 'userId', render: v => { const u = userOf(v); return u ? <Tag icon={<LinkOutlined />} color="blue">{u.email}</Tag> : <Text type="secondary" style={{ fontSize: 11 }}>غير مرتبط</Text>; } },
            { title: 'العهدة', key: 'as', render: (_, e) => { const n = assetsOf(e.id).length; return n ? <Tag color="orange">{n} أصل</Tag> : '—'; } },
            { title: 'نشط', dataIndex: 'isActive', width: 70, render: (a, e) => canManage ? <Switch size="small" checked={a} onChange={c => toggle(e, c)} /> : (a ? 'نعم' : 'لا') },
            { title: '', key: 'a', width: 90, render: (_, e) => canManage && (
              <Space size={2}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(e)} />
                <Popconfirm title="حذف الموظف؟ يفضّل إيقافه للاحتفاظ بسجله." okText="حذف" cancelText="إلغاء" onConfirm={() => remove(e)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>) },
          ]} />
      </Card>

      <Modal open={editing != null} title={editing === 'new' ? 'موظف جديد' : 'تعديل بيانات الموظف'} okText="حفظ" cancelText="إلغاء" onOk={save}
        confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose width={680}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="nameAr" label="الاسم" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="employeeNo" label="الرقم الوظيفي" extra={editing === 'new' ? 'يُولَّد تلقائياً إن تُرك فارغاً' : undefined}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="jobTitle" label="المسمى الوظيفي"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="departmentId" label="القسم"><Select allowClear options={departments.map(d => ({ value: d.id, label: d.label }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="branchId" label="الفرع"><Select allowClear options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, true) }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="البريد"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="emiratesId" label="الهوية الإماراتية"><Input dir="ltr" placeholder="784-XXXX-XXXXXXX-X" /></Form.Item></Col>
            <Col span={12}><Form.Item name="hireDate" label="تاريخ التعيين"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="userId" label="حساب النظام (اختياري)">
              <Select allowClear showSearch optionFilterProp="label" options={users.map(u => ({ value: u.id, label: `${u.nameAr ?? u.nameEn ?? ''} — ${u.email}` }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="على رأس العمل" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Drawer open={!!viewing} width={560} onClose={() => setViewing(null)} title={<Space><IdcardOutlined style={{ color: PRIMARY }} />{eName(viewing)}</Space>}
        extra={canManage && viewing && <Button size="small" icon={<EditOutlined />} onClick={() => { const v = viewing; setViewing(null); open(v); }}>تعديل</Button>}>
        {viewing && (
          <>
            <Descriptions column={1} size="small" bordered labelStyle={{ width: 150 }}>
              <Descriptions.Item label="الرقم الوظيفي">{viewing.employeeNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الاسم بالإنجليزية">{viewing.nameEn ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="المسمى / القسم">{viewing.jobTitle ?? '—'} · {deptName(viewing.departmentId)}</Descriptions.Item>
              <Descriptions.Item label="الفرع">{branchName(viewing.branchId)}</Descriptions.Item>
              <Descriptions.Item label="الهاتف"><span dir="ltr">{viewing.phone ?? '—'}</span></Descriptions.Item>
              <Descriptions.Item label="البريد">{viewing.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="الهوية">{viewing.emiratesId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="تاريخ التعيين">{viewing.hireDate ?? '—'} {service(viewing.hireDate) && `(${service(viewing.hireDate)})`}</Descriptions.Item>
              <Descriptions.Item label="حساب النظام">{userOf(viewing.userId)?.email ?? 'غير مرتبط'}</Descriptions.Item>
              <Descriptions.Item label="الحالة">{viewing.isActive ? <Tag color="success">على رأس العمل</Tag> : <Tag>غير نشط</Tag>}</Descriptions.Item>
              {viewing.notes && <Descriptions.Item label="ملاحظات">{viewing.notes}</Descriptions.Item>}
            </Descriptions>
            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}><ToolOutlined /> الأصول في عهدته ({assetsOf(viewing.id).length})</Text>
            <Table size="small" rowKey="id" pagination={false} dataSource={assetsOf(viewing.id)} locale={{ emptyText: 'لا توجد أصول في عهدته' }}
              columns={[
                { title: 'الرمز', dataIndex: 'assetCode', render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
                { title: 'الأصل', key: 'n', render: (_, a) => a.nameAr ?? a.nameEn },
                { title: 'الرقم التسلسلي', dataIndex: 'serialNo', render: v => v ?? '—' },
              ]} />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default EmployeesPage;
