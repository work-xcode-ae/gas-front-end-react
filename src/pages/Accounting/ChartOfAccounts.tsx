import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Input, Modal, Form, Select, Switch, Row, Col, Popconfirm, Tooltip, message, Typography, Segmented } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, FileTextOutlined, ReloadOutlined, BookOutlined, DownloadOutlined } from '@ant-design/icons';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ACCOUNT_TYPES, downloadCsv, flattenTree, loadAccounts } from './shared';

const { Text } = Typography;

interface Node { id: number; accountCode: string; name: string; nameEn?: string; nameAr?: string; type?: string; level?: number; isGroup: boolean; isPostable: boolean; isActive: boolean; children?: Node[] }

export default function ChartOfAccounts({ onOpenLedger }: { onOpenLedger: (accountId: number) => void }) {
  const { can } = useAuth();
  const manage = can('accounting.manage');
  const [tree, setTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [types, setTypes] = useState<{ id: number; code: string; label: string }[]>([]);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api<Node[]>('/accounts/tree').then(t => { setTree(t); loadAccounts(true).catch(() => undefined); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { load(); api<any[]>('/lookups/ACCOUNT_TYPE').then(setTypes).catch(() => setTypes([])); }, []);

  const flat = useMemo(() => flattenTree(tree), [tree]);
  const clean = (nodes: Node[]): Node[] => nodes.map(n => ({ ...n, children: n.children?.length ? clean(n.children) : undefined }));
  const data = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s && typeFilter === 'all') return clean(tree);
    return flat.filter(a => (typeFilter === 'all' || a.type === typeFilter) && (!s || a.accountCode.toLowerCase().includes(s) || (a.name ?? '').toLowerCase().includes(s)))
      .map(a => ({ ...a, children: undefined })) as unknown as Node[];
  }, [tree, flat, search, typeFilter]);

  const openNew = (parent?: Node) => {
    form.resetFields();
    const typeId = types.find(t => t.code === (parent?.type ?? 'asset'))?.id;
    const siblings = flat.filter(a => a.parentId === (parent?.id ?? null)).map(a => a.accountCode).sort();
    const last = siblings[siblings.length - 1];
    const suggested = last && /^\d+$/.test(last) ? String(Number(last) + 1) : parent ? `${parent.accountCode}01` : '';
    form.setFieldsValue({ parentAccountId: parent?.id, accountTypeId: typeId, isGroup: false, isActive: true, accountCode: suggested });
    setEditing('new');
  };
  const openEdit = async (n: Node) => {
    try {
      const a = await api<any>(`/accounts/${n.id}`);
      form.setFieldsValue(a);
      setEditing(a);
    } catch (e) { message.error(errorMessage(e)); }
  };
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing === 'new') await api('/accounts', { method: 'POST', body: { ...v, isPostable: !v.isGroup } });
      else await api(`/accounts/${editing.id}`, { method: 'PUT', body: { ...editing, ...v, isPostable: !v.isGroup } });
      message.success('تم حفظ الحساب');
      setEditing(null); load();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  const toggleActive = async (n: Node, isActive: boolean) => {
    try { const a = await api<any>(`/accounts/${n.id}`); await api(`/accounts/${n.id}`, { method: 'PUT', body: { ...a, isActive } }); load(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async (n: Node) => {
    try { await api(`/accounts/${n.id}`, { method: 'DELETE' }); message.success('تم حذف الحساب'); load(); }
    catch (e) { message.error(errorMessage(e), 6); }
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input.Search allowClear placeholder="بحث بالرقم أو الاسم…" style={{ width: 240 }} onSearch={setSearch} onChange={e => !e.target.value && setSearch('')} />
          <Segmented value={typeFilter} onChange={v => setTypeFilter(v as string)}
            options={[{ value: 'all', label: 'الكل' }, ...Object.entries(ACCOUNT_TYPES).map(([k, t]) => ({ value: k, label: t.label }))]} />
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv('دليل-الحسابات', ['الرقم', 'الاسم', 'النوع', 'المستوى', 'تجميعي', 'نشط'],
            flat.map(a => [a.accountCode, a.name, ACCOUNT_TYPES[a.type ?? '']?.label ?? a.type, a.level, a.isGroup ? 'نعم' : 'لا', a.isActive ? 'نعم' : 'لا']))}>Excel</Button>
        </Space>
        {manage && <Button type="primary" icon={<PlusOutlined />} onClick={() => openNew()}>حساب رئيسي</Button>}
      </Space>
      <Table<Node> size="small" rowKey="id" loading={loading} dataSource={data} pagination={false} scroll={{ x: 800 }}
        expandable={{ defaultExpandAllRows: true }} key={search + typeFilter + tree.length}
        columns={[
          { title: 'رقم الحساب', dataIndex: 'accountCode', width: 200, render: (v, n) => <Space>{n.isGroup ? <FolderOutlined style={{ color: '#c9a84c' }} /> : <FileTextOutlined style={{ color: '#888' }} />}<Text strong={n.isGroup} style={{ fontFamily: 'monospace' }}>{v}</Text></Space> },
          { title: 'اسم الحساب', dataIndex: 'name', render: (v, n) => <Text strong={n.isGroup} type={n.isActive ? undefined : 'secondary'}>{v}</Text> },
          { title: 'النوع', dataIndex: 'type', width: 110, render: t => t ? <Tag color={ACCOUNT_TYPES[t]?.color}>{ACCOUNT_TYPES[t]?.label ?? t}</Tag> : '—' },
          { title: 'الحالة', key: 'st', width: 130, render: (_, n) => <Space size={4}>{n.isGroup ? <Tag>تجميعي</Tag> : <Tag color="geekblue">قابل للترحيل</Tag>}
            {manage ? <Switch size="small" checked={n.isActive} onChange={c => toggleActive(n, c)} /> : !n.isActive && <Tag>موقوف</Tag>}</Space> },
          { title: '', key: 'a', width: 150, render: (_, n) => (
            <Space size={2}>
              {!n.isGroup && <Tooltip title="دفتر الأستاذ"><Button size="small" type="text" icon={<BookOutlined />} onClick={() => onOpenLedger(n.id)} /></Tooltip>}
              {manage && n.isGroup && <Tooltip title="إضافة حساب فرعي"><Button size="small" type="text" icon={<PlusOutlined />} onClick={() => openNew(n)} /></Tooltip>}
              {manage && <Tooltip title="تعديل"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(n)} /></Tooltip>}
              {manage && !n.children?.length && (
                <Popconfirm title="حذف الحساب؟ (لا يمكن حذف حساب عليه قيود)" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(n)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>)}
            </Space>) },
        ]} />

      <Modal open={editing != null} title={editing === 'new' ? 'حساب جديد' : `تعديل الحساب ${editing?.accountCode ?? ''}`} okText="حفظ" cancelText="إلغاء"
        onOk={save} confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose width={620}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="parentAccountId" label="الحساب الأب">
              <Select allowClear showSearch optionFilterProp="label" placeholder="بدون (حساب رئيسي)"
                options={flat.filter(a => a.isGroup && (editing === 'new' || a.id !== editing?.id)).map(a => ({ value: a.id, label: `${a.accountCode} — ${a.name}` }))}
                onChange={(pid?: number) => { const p = flat.find(a => a.id === pid); const t = types.find(x => x.code === p?.type); if (t) form.setFieldsValue({ accountTypeId: t.id }); }} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="accountCode" label="رقم الحساب" rules={[{ required: true, message: 'مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameAr" label="الاسم بالعربية" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="accountTypeId" label="نوع الحساب" rules={[{ required: true, message: 'مطلوب' }]}>
              <Select options={types.map(t => ({ value: t.id, label: ACCOUNT_TYPES[t.code]?.label ?? t.label }))} />
            </Form.Item></Col>
            <Col span={6}><Form.Item name="isGroup" label="حساب تجميعي" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>الحساب التجميعي لا يقبل قيوداً؛ القيود تُرحّل على الحسابات الفرعية فقط.</Text>
        </Form>
      </Modal>
    </div>
  );
}
