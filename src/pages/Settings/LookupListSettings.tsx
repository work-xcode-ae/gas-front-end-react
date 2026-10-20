import { useCallback, useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Space, Popconfirm, Typography, message, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api, errorMessage, type Paged } from '../../api/client';
import { clearReferenceCache } from '../../api/reference';
import { useAuth } from '../../auth/AuthContext';

const { Text } = Typography;

interface LookupRow { id: number; lookupTypeId: number; code: string; nameEn?: string; nameAr?: string; sortOrder?: number; isActive: boolean; parentId?: number | null }
interface Props { typeCode: string; title: string; hint?: string }

/** Editable list of one lookup type (values of lookup_value), e.g. the visit checklist (VISIT_CHECKLIST). */
export default function LookupListSettings({ typeCode, title, hint }: Props) {
  const { can } = useAuth();
  const canManage = can('settings.manage');
  const [typeId, setTypeId] = useState<number | null>(null);
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<LookupRow | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let id = typeId;
      if (id == null) {
        const t = await api<Paged<any>>('/lookup-types', { query: { code: typeCode, pageSize: 0 } });
        id = t.items[0]?.id ?? null;
        setTypeId(id);
      }
      if (id == null) { setRows([]); return; }
      const r = await api<Paged<LookupRow>>('/lookup-values', { query: { lookupTypeId: id, pageSize: 0 } });
      setRows([...r.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id));
    } catch (e) { message.error(errorMessage(e)); } finally { setLoading(false); }
  }, [typeCode, typeId]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    form.resetFields();
    form.setFieldsValue({ isActive: true, sortOrder: ((rows.at(-1)?.sortOrder ?? 0) + 10) });
    setEditing('new');
  };
  const openEdit = (r: LookupRow) => { form.setFieldsValue(r); setEditing(r); };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (editing === 'new') {
        const code = (v.code?.trim() || `item_${Date.now().toString(36)}`).toLowerCase().replace(/\s+/g, '_');
        await api('/lookup-values', { method: 'POST', body: { lookupTypeId: typeId, code, nameAr: v.nameAr, nameEn: v.nameEn || null, sortOrder: v.sortOrder, isActive: v.isActive } });
      } else if (editing) {
        await api(`/lookup-values/${editing.id}`, { method: 'PUT', body: { ...editing, nameAr: v.nameAr, nameEn: v.nameEn || null, sortOrder: v.sortOrder, isActive: v.isActive } });
      }
      clearReferenceCache();
      message.success('تم الحفظ');
      setEditing(null);
      load();
    } catch (e) { message.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const toggle = async (r: LookupRow, isActive: boolean) => {
    try { await api(`/lookup-values/${r.id}`, { method: 'PUT', body: { ...r, isActive } }); clearReferenceCache(); load(); }
    catch (e) { message.error(errorMessage(e)); }
  };
  const remove = async (r: LookupRow) => {
    try { await api(`/lookup-values/${r.id}`, { method: 'DELETE' }); clearReferenceCache(); message.success('تم الحذف'); load(); }
    catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <Text strong style={{ fontSize: 15 }}>{title}</Text>
          {hint && <div style={{ fontSize: 12, color: '#888' }}>{hint}</div>}
        </div>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openNew} disabled={typeId == null}>إضافة بند</Button>}
      </div>
      {!loading && typeId == null && <Alert type="warning" showIcon message="القائمة غير موجودة بعد — أعد تشغيل الـ API لإنشائها" style={{ marginBottom: 12 }} />}
      <Table<LookupRow> size="small" rowKey="id" loading={loading} dataSource={rows} pagination={false}
        columns={[
          { title: '#', key: 'n', width: 50, render: (_, __, i) => i + 1 },
          { title: 'البند', dataIndex: 'nameAr', render: (t, r) => <div><Text style={{ opacity: r.isActive ? 1 : 0.5 }}>{t || r.nameEn}</Text>{r.nameEn && t && <div style={{ fontSize: 11, color: '#999' }}>{r.nameEn}</div>}</div> },
          { title: 'الترتيب', dataIndex: 'sortOrder', width: 80 },
          { title: 'الحالة', key: 'active', width: 110, render: (_, r) => canManage
            ? <Switch size="small" checked={r.isActive} onChange={c => toggle(r, c)} checkedChildren="نشط" unCheckedChildren="موقوف" />
            : <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? 'نشط' : 'موقوف'}</Tag> },
          ...(canManage ? [{
            title: '', key: 'act', width: 90, render: (_: any, r: LookupRow) => (
              <Space size={2}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="حذف هذا البند؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(r)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          }] : []),
        ]} />

      <Modal open={editing != null} title={editing === 'new' ? 'بند جديد' : 'تعديل البند'} okText="حفظ" cancelText="إلغاء"
        onOk={save} confirmLoading={saving} onCancel={() => setEditing(null)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="nameAr" label="الاسم بالعربية" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item>
          <Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item>
          {editing === 'new' && <Form.Item name="code" label="الرمز (اختياري)"><Input dir="ltr" placeholder="auto" /></Form.Item>}
          <Space>
            <Form.Item name="sortOrder" label="الترتيب"><InputNumber min={0} /></Form.Item>
            <Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
