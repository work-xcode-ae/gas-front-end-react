import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, Table, Tag, Button, Typography, Space, Avatar, Modal, Form, Input, Select, Switch, Tabs, Checkbox, Popconfirm,
  Tooltip, Empty, Alert, message, Spin, Badge,
} from 'antd';
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, SafetyCertificateOutlined, TeamOutlined, CheckCircleOutlined,
  CloseCircleOutlined, CrownOutlined, ReloadOutlined, SaveOutlined, LockOutlined, LaptopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import SessionsModal from '../../components/SessionsModal';
import { useReference, locName } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

interface UserRow {
  id: number; email: string; nameEn?: string; nameAr?: string; phone?: string; branchId?: number; branch?: string; isActive: boolean;
  lastLoginAt?: string; createdAt?: string; roles: { roleId: number; code: string; nameEn?: string; nameAr?: string }[]; branches: { branchId: number; code: string }[];
}
interface RoleRow { id: number; code: string; nameEn?: string; nameAr?: string; users: number; permissions: string[] }
interface PermGroup { module: string; permissions: { id: number; code: string; nameEn?: string; nameAr?: string }[] }

const PASSWORD_RULE = { pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/, message: 'ثمانية أحرف على الأقل وتحتوي على حروف وأرقام' };
const roleName = (r: { code: string; nameAr?: string; nameEn?: string }) => r.nameAr || r.nameEn || r.code;
const ROLE_COLORS = ['#ff4d4f', '#fa8c16', '#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#eb2f96', '#faad14'];

// ═════════════════════════════ users ═════════════════════════════
function UsersTab({ roles, canManage }: { roles: RoleRow[]; canManage: boolean }) {
  const { data: ref } = useReference('ar');
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState<{ search?: string; roleId?: number; branchId?: number; active?: boolean }>({});
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [pwdUser, setPwdUser] = useState<UserRow | null>(null);
  const [sessionsUser, setSessionsUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    api<Paged<UserRow>>('/users', { query: { pageSize: 0, search: f.search, roleId: f.roleId, branchId: f.branchId, active: f.active } })
      .then(r => setRows(r.items)).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const branches = ref?.branches ?? [];
  const roleColor = useMemo(() => Object.fromEntries(roles.map((r, i) => [r.id, r.code === 'ADMIN' ? '#ff4d4f' : ROLE_COLORS[(i + 1) % ROLE_COLORS.length]])), [roles]);

  const openNew = () => { form.resetFields(); form.setFieldsValue({ isActive: true, roleIds: [], branchIds: [] }); setEditing('new'); };
  const openEdit = (u: UserRow) => {
    form.resetFields();
    form.setFieldsValue({ email: u.email, nameAr: u.nameAr, nameEn: u.nameEn, phone: u.phone, branchId: u.branchId, isActive: u.isActive,
      roleIds: u.roles.map(r => r.roleId), branchIds: u.branches.map(b => b.branchId) });
    setEditing(u);
  };

  const body = (u: UserRow, patch: Partial<Record<string, unknown>> = {}) => ({
    email: u.email, nameEn: u.nameEn ?? null, nameAr: u.nameAr ?? null, phone: u.phone ?? null, branchId: u.branchId ?? null, isActive: u.isActive,
    roleIds: u.roles.map(r => r.roleId), branchIds: u.branches.map(b => b.branchId), password: null, ...patch,
  });

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = { email: v.email, nameAr: v.nameAr || null, nameEn: v.nameEn || null, phone: v.phone || null, branchId: v.branchId ?? null,
        isActive: !!v.isActive, roleIds: v.roleIds ?? [], branchIds: v.branchIds ?? [], password: v.password || null };
      if (editing === 'new') await api('/users', { method: 'POST', body: payload });
      else if (editing) await api(`/users/${editing.id}`, { method: 'PUT', body: payload });
      message.success(editing === 'new' ? 'تمت إضافة المستخدم' : 'تم حفظ التعديلات');
      setEditing(null); load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const toggleActive = async (u: UserRow, isActive: boolean) => {
    try { await api(`/users/${u.id}`, { method: 'PUT', body: body(u, { isActive }) }); message.success(isActive ? 'تم تفعيل المستخدم' : 'تم إيقاف المستخدم'); load(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async (u: UserRow) => {
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); message.success('تم حذف المستخدم'); load(); } catch (e) { message.error(errorMessage(e), 6); }
  };
  const resetPassword = async () => {
    const v = await pwdForm.validateFields();
    setSaving(true);
    try { await api(`/users/${pwdUser!.id}/reset-password`, { method: 'POST', body: { newPassword: v.newPassword } }); message.success('تم تغيير كلمة المرور'); setPwdUser(null); }
    catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const active = rows.filter(u => u.isActive).length;
  const admins = rows.filter(u => u.roles.some(r => r.code === 'ADMIN')).length;
  const neverLogged = rows.filter(u => !u.lastLoginAt).length;

  return (
    <div>
      <SessionsModal open={!!sessionsUser} onClose={() => setSessionsUser(null)} userId={sessionsUser?.id} userName={sessionsUser?.nameAr ?? sessionsUser?.nameEn ?? sessionsUser?.email} />
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        {[
          { label: 'إجمالي المستخدمين', value: rows.length, color: PRIMARY, bg: '#e8f5e9', icon: <TeamOutlined /> },
          { label: 'نشط', value: active, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
          { label: 'موقوف', value: rows.length - active, color: '#ff4d4f', bg: '#fff1f0', icon: <CloseCircleOutlined /> },
          { label: 'مدراء النظام', value: admins, color: '#d48806', bg: '#fffbe6', icon: <CrownOutlined /> },
          { label: 'لم يسجلوا الدخول', value: neverLogged, color: '#1677ff', bg: '#e6f4ff', icon: <LockOutlined /> },
        ].map(s => (
          <Col xs={12} md={8} xl={4} key={s.label} flex="1">
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <Space><span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div><div style={{ fontSize: 11, color: '#666' }}>{s.label}</div></div></Space>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space wrap>
          <Input.Search allowClear placeholder="بحث بالاسم أو البريد…" style={{ width: 240 }} onSearch={v => setF(x => ({ ...x, search: v || undefined }))} />
          <Select allowClear placeholder="الدور" style={{ width: 160 }} value={f.roleId} onChange={v => setF(x => ({ ...x, roleId: v }))}
            options={roles.map(r => ({ value: r.id, label: roleName(r) }))} />
          <Select allowClear placeholder="الفرع" style={{ width: 160 }} value={f.branchId} onChange={v => setF(x => ({ ...x, branchId: v }))}
            options={branches.map(b => ({ value: b.id, label: locName(b, true) || b.code }))} />
          <Select allowClear placeholder="الحالة" style={{ width: 120 }} value={f.active} onChange={v => setF(x => ({ ...x, active: v }))}
            options={[{ value: true, label: 'نشط' }, { value: false, label: 'موقوف' }]} />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>مستخدم جديد</Button>}
      </div>

      <Table<UserRow> size="small" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 1000 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: <Empty description="لا يوجد مستخدمون" /> }}
        columns={[
          { title: 'المستخدم', key: 'u', render: (_, u) => (
            <Space>
              <Avatar style={{ background: u.isActive ? PRIMARY : '#bfbfbf' }} icon={<UserOutlined />}>{(u.nameAr || u.nameEn || u.email)[0]}</Avatar>
              <div>
                <Text strong style={{ fontSize: 13 }}>{u.nameAr || u.nameEn || '—'}</Text>
                {u.id === me?.id && <Tag color="gold" style={{ marginInlineStart: 6, fontSize: 10 }}>أنت</Tag>}
                <div style={{ fontSize: 11, color: '#888', direction: 'ltr', textAlign: 'end' }}>{u.email}</div>
              </div>
            </Space>) },
          { title: 'الهاتف', dataIndex: 'phone', width: 130, render: v => v ? <span style={{ direction: 'ltr', display: 'inline-block' }}>{v}</span> : '—' },
          { title: 'الأدوار', key: 'roles', render: (_, u) => u.roles.length === 0 ? <Text type="secondary">بدون دور</Text>
            : u.roles.map(r => <Tag key={r.roleId} color={roleColor[r.roleId]} style={{ marginBottom: 2 }}>{roleName(r)}</Tag>) },
          { title: 'الفرع / الفروع', key: 'br', render: (_, u) => (
            <div style={{ fontSize: 12 }}>
              {u.branch ?? <Text type="secondary">—</Text>}
              {u.branches.length > 0 && <div>{u.branches.map(b => <Tag key={b.branchId} style={{ fontSize: 10 }}>{b.code}</Tag>)}</div>}
            </div>) },
          { title: 'آخر دخول', dataIndex: 'lastLoginAt', width: 140, render: v => v ? <div style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD HH:mm')}</div> : <Text type="secondary" style={{ fontSize: 12 }}>لم يسجل الدخول</Text> },
          { title: 'الحالة', key: 'st', width: 110, render: (_, u) => canManage && u.id !== me?.id
            ? <Switch size="small" checked={u.isActive} onChange={c => toggleActive(u, c)} checkedChildren="نشط" unCheckedChildren="موقوف" />
            : <Badge status={u.isActive ? 'success' : 'default'} text={u.isActive ? 'نشط' : 'موقوف'} /> },
          ...(canManage ? [{ title: '', key: 'a', width: 150, render: (_: unknown, u: UserRow) => (
            <Space size={2}>
              <Tooltip title="تعديل"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(u)} /></Tooltip>
              <Tooltip title="تغيير كلمة المرور"><Button size="small" type="text" icon={<KeyOutlined />} onClick={() => { pwdForm.resetFields(); setPwdUser(u); }} /></Tooltip>
              <Tooltip title="الأجهزة والجلسات النشطة"><Button size="small" type="text" icon={<LaptopOutlined />} onClick={() => setSessionsUser(u)} /></Tooltip>
              {u.id !== me?.id && (
                <Popconfirm title="حذف المستخدم؟" description="لن يتمكن من تسجيل الدخول، ويبقى سجله محفوظاً." okText="حذف" cancelText="إلغاء" onConfirm={() => remove(u)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </Space>) }] : []),
        ]} />

      <Modal open={editing != null} title={editing === 'new' ? 'مستخدم جديد' : 'تعديل المستخدم'} okText="حفظ" cancelText="إلغاء" onOk={save}
        confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose width={640}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="nameAr" label="الاسم بالعربية" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="البريد الإلكتروني (اسم الدخول)" rules={[{ required: true, message: 'مطلوب' }, { type: 'email', message: 'بريد غير صحيح' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
            {editing === 'new' && (
              <Col span={12}><Form.Item name="password" label="كلمة المرور" rules={[{ required: true, message: 'مطلوب' }, PASSWORD_RULE]}><Input.Password dir="ltr" /></Form.Item></Col>
            )}
            <Col span={12}><Form.Item name="branchId" label="الفرع الرئيسي"><Select allowClear options={branches.map(b => ({ value: b.id, label: locName(b, true) || b.code }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="branchIds" label="الفروع المسموح بها" extra="بدون اختيار = كل الفروع">
              <Select mode="multiple" allowClear options={branches.map(b => ({ value: b.id, label: locName(b, true) || b.code }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="roleIds" label="الأدوار" rules={[{ required: true, message: 'اختر دوراً واحداً على الأقل' }]}>
              <Select mode="multiple" options={roles.map(r => ({ value: r.id, label: `${roleName(r)} (${r.code})` }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch disabled={editing !== 'new' && editing?.id === me?.id} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={!!pwdUser} title={`تغيير كلمة المرور — ${pwdUser?.nameAr || pwdUser?.email || ''}`} okText="حفظ" cancelText="إلغاء" onOk={resetPassword}
        confirmLoading={saving} onCancel={() => setPwdUser(null)} destroyOnClose>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="newPassword" label="كلمة المرور الجديدة" rules={[{ required: true, message: 'مطلوب' }, PASSWORD_RULE]}><Input.Password dir="ltr" /></Form.Item>
          <Form.Item name="confirm" label="تأكيد كلمة المرور" dependencies={['newPassword']}
            rules={[{ required: true, message: 'مطلوب' }, ({ getFieldValue }) => ({ validator: (_, v) => (!v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('كلمتا المرور غير متطابقتين'))) })]}>
            <Input.Password dir="ltr" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ═════════════════════════════ roles & permissions ═════════════════════════════
function RolesTab({ roles, reload, canManage }: { roles: RoleRow[]; reload: () => void; canManage: boolean }) {
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [selected, setSelected] = useState<RoleRow | 'new' | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { api<PermGroup[]>('/permissions').then(setGroups).catch(e => message.error(errorMessage(e))); }, []);
  useEffect(() => { if (!selected && roles.length) pick(roles[0]); }, [roles]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (r: RoleRow | 'new') => {
    setSelected(r);
    form.resetFields();
    if (r === 'new') { form.setFieldsValue({ code: '', nameAr: '', nameEn: '' }); setPerms(new Set(['dashboard.view'])); }
    else { form.setFieldsValue({ code: r.code, nameAr: r.nameAr, nameEn: r.nameEn }); setPerms(new Set(r.permissions)); }
  };

  const isAdminRole = selected !== 'new' && selected?.code === 'ADMIN';
  const toggle = (code: string, on: boolean) => setPerms(p => { const n = new Set(p); if (on) n.add(code); else n.delete(code); return n; });
  const moduleLabel = (g: PermGroup) => (g.permissions.find(p => p.code.endsWith('.view'))?.nameAr ?? g.module).replace(/^عرض\s*/, '');

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const payload = { code: v.code, nameAr: v.nameAr || null, nameEn: v.nameEn || null, permissions: [...perms] };
      if (selected === 'new') { await api('/roles', { method: 'POST', body: payload }); message.success('تم إنشاء الدور'); }
      else if (selected) { await api(`/roles/${selected.id}`, { method: 'PUT', body: payload }); message.success('تم حفظ الصلاحيات'); }
      setSelected(null); reload();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const remove = async (r: RoleRow) => {
    try { await api(`/roles/${r.id}`, { method: 'DELETE' }); message.success('تم حذف الدور'); setSelected(null); reload(); } catch (e) { message.error(errorMessage(e), 6); }
  };

  const matrix = groups.map(g => {
    const view = g.permissions.find(p => p.code === `${g.module}.view`);
    const manage = g.permissions.find(p => p.code === `${g.module}.manage`);
    const special = g.permissions.filter(p => p !== view && p !== manage);
    return { key: g.module, label: moduleLabel(g), view, manage, special, all: g.permissions.map(p => p.code) };
  });
  const editable = canManage && !isAdminRole;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={7}>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }} title={<Text strong><SafetyCertificateOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />الأدوار ({roles.length})</Text>}
          extra={canManage && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => pick('new')}>دور جديد</Button>}>
          {roles.map((r, i) => {
            const on = selected !== 'new' && selected?.id === r.id;
            return (
              <div key={r.id} onClick={() => pick(r)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                border: on ? `2px solid ${PRIMARY}` : '1px solid #f0f0f0', background: on ? '#f0f7f2' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><span style={{ width: 10, height: 10, borderRadius: 5, background: r.code === 'ADMIN' ? '#ff4d4f' : ROLE_COLORS[(i + 1) % ROLE_COLORS.length], display: 'inline-block' }} />
                    <Text strong>{roleName(r)}</Text></Space>
                  <Tag style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.code}</Tag>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{r.users} مستخدم · {r.code === 'ADMIN' ? 'كل الصلاحيات' : `${r.permissions.length} صلاحية`}</div>
              </div>
            );
          })}
        </Card>
      </Col>
      <Col xs={24} lg={17}>
        {!selected ? <Card bordered={false} style={{ borderRadius: 10 }}><Empty description="اختر دوراً لعرض صلاحياته" /></Card> : (
          <Card size="small" bordered={false} style={{ borderRadius: 10 }}
            title={<Text strong>{selected === 'new' ? 'دور جديد' : `صلاحيات: ${roleName(selected)}`}</Text>}
            extra={<Space>
              {canManage && selected !== 'new' && !isAdminRole && (
                <Popconfirm title="حذف الدور؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(selected)}>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={selected.users > 0}>حذف</Button>
                </Popconfirm>
              )}
              {canManage && <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>حفظ</Button>}
            </Space>}>
            {isAdminRole && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="دور مدير النظام (ADMIN) يملك كل الصلاحيات دائماً ولا يمكن تقييده أو حذفه." />}
            <Form form={form} layout="vertical" disabled={!canManage}>
              <Row gutter={12}>
                <Col span={8}><Form.Item name="code" label="الرمز" rules={[{ required: true, message: 'مطلوب' }, { pattern: /^[A-Za-z0-9_]+$/, message: 'حروف إنجليزية وأرقام فقط' }]}>
                  <Input dir="ltr" disabled={isAdminRole} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="nameAr" label="الاسم بالعربية" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
              </Row>
            </Form>
            {groups.length === 0 ? <Spin /> : (
              <Table size="small" rowKey="key" pagination={false} dataSource={matrix} scroll={{ x: 640 }}
                columns={[
                  { title: 'الوحدة', dataIndex: 'label', render: (v, m) => (
                    <Space>
                      <Checkbox disabled={!editable} checked={isAdminRole || m.all.every(c => perms.has(c))}
                        indeterminate={!isAdminRole && m.all.some(c => perms.has(c)) && !m.all.every(c => perms.has(c))}
                        onChange={e => setPerms(p => { const n = new Set(p); m.all.forEach(c => (e.target.checked ? n.add(c) : n.delete(c))); return n; })} />
                      <Text style={{ fontSize: 13 }}>{v}</Text>
                    </Space>) },
                  { title: 'عرض', key: 'v', width: 70, align: 'center' as const, render: (_, m) => m.view &&
                    <Checkbox disabled={!editable} checked={isAdminRole || perms.has(m.view.code)} onChange={e => toggle(m.view!.code, e.target.checked)} /> },
                  { title: 'إدارة (إضافة / تعديل / حذف)', key: 'm', width: 170, align: 'center' as const, render: (_, m) => m.manage &&
                    <Checkbox disabled={!editable} checked={isAdminRole || perms.has(m.manage.code)}
                      onChange={e => { toggle(m.manage!.code, e.target.checked); if (e.target.checked && m.view) toggle(m.view.code, true); }} /> },
                  { title: 'صلاحيات خاصة', key: 's', render: (_, m) => (
                    <Space wrap size={[8, 4]}>
                      {m.special.map(p => (
                        <Checkbox key={p.code} disabled={!editable} checked={isAdminRole || perms.has(p.code)} onChange={e => toggle(p.code, e.target.checked)}>
                          <span style={{ fontSize: 12 }}>{p.nameAr || p.nameEn || p.code}</span>
                        </Checkbox>
                      ))}
                    </Space>) },
                ]} />
            )}
          </Card>
        )}
      </Col>
    </Row>
  );
}

// ═════════════════════════════ page ═════════════════════════════
const UsersPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can('users.manage');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [tab, setTab] = useState('users');
  const loadRoles = useCallback(() => { api<RoleRow[]>('/roles').then(setRoles).catch(e => message.error(errorMessage(e))); }, []);
  useEffect(() => { loadRoles(); }, [loadRoles]);

  if (!can('users.view')) return <Card style={{ borderRadius: 14 }}><Empty description="ليست لديك صلاحية عرض المستخدمين" /></Card>;
  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TeamOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>المستخدمون والصلاحيات</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>حسابات الدخول، الأدوار، وصلاحيات كل دور على وحدات النظام</div>
        </div>
      </div>
      <Card styles={{ body: { padding: '4px 16px 16px' } }} style={{ borderRadius: 14 }}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'users', label: <span><UserOutlined /> المستخدمون</span>, children: <UsersTab roles={roles} canManage={canManage} /> },
          { key: 'roles', label: <span><SafetyCertificateOutlined /> الأدوار والصلاحيات</span>, children: <RolesTab roles={roles} reload={loadRoles} canManage={canManage} /> },
        ]} />
      </Card>
    </div>
  );
};

export default UsersPage;
