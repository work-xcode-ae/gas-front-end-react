import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Select, Switch, Popconfirm, Alert, Typography, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AccountSelect, BranchSelect, useAccounts } from './shared';

const { Text } = Typography;
/** MappingSources constants (Services/PostingService.cs) with Arabic labels and the lookup used as key. */
export const MAPPING_SOURCES: Record<string, { label: string; hint: string; keyType?: string; side: 'debit' | 'credit' }> = {
  invoice_item: { label: 'بند فاتورة مبيعات', hint: 'الدائن = حساب الإيراد لكل نوع رسوم', keyType: 'FEE_TYPE', side: 'credit' },
  receivable: { label: 'الذمم المدينة', hint: 'المدين = حساب العملاء الافتراضي', side: 'debit' },
  vat: { label: 'ضريبة المخرجات', hint: 'الدائن = ضريبة القيمة المضافة المستحقة', side: 'credit' },
  vat_input: { label: 'ضريبة المدخلات', hint: 'المدين = ضريبة قابلة للاسترداد', side: 'debit' },
  payment: { label: 'تحصيل من العملاء', hint: 'المدين = الصندوق/البنك حسب طريقة الدفع', keyType: 'PAYMENT_METHOD', side: 'debit' },
  deposit: { label: 'تأمينات العملاء', hint: 'الدائن = التزام التأمينات', side: 'credit' },
  vendor_bill_item: { label: 'بند فاتورة مورد', hint: 'المدين = حساب المصروف', keyType: 'FEE_TYPE', side: 'debit' },
  payable: { label: 'الذمم الدائنة', hint: 'الدائن = حساب الموردين الافتراضي', side: 'credit' },
  vendor_payment: { label: 'سداد للموردين', hint: 'الدائن = الصندوق/البنك حسب طريقة الدفع', keyType: 'PAYMENT_METHOD', side: 'credit' },
};

export default function Mappings() {
  const { can } = useAuth();
  const manage = can('accounting.manage');
  const accounts = useAccounts();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<Record<string, { id: number; code: string; label: string }[]>>({});
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form] = Form.useForm();
  const sourceType = Form.useWatch('sourceType', form);

  const load = () => { setLoading(true); api<any[]>('/account-mappings/view').then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false)); };
  useEffect(() => {
    load();
    ['FEE_TYPE', 'PAYMENT_METHOD'].forEach(t => api<any[]>(`/lookups/${t}`).then(v => setKeys(k => ({ ...k, [t]: v }))).catch(() => undefined));
  }, []);

  const open = (m?: any) => { form.resetFields(); form.setFieldsValue(m ?? { isActive: true }); setEditing(m ?? 'new'); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing === 'new') await api('/account-mappings', { method: 'POST', body: { companyId: 0, ...v } });
      else await api(`/account-mappings/${editing.id}`, { method: 'PUT', body: { ...editing, ...v } });
      message.success('تم الحفظ'); setEditing(null); load();
    } catch (e) { message.error(errorMessage(e), 6); }
  };
  const remove = async (id: number) => { try { await api(`/account-mappings/${id}`, { method: 'DELETE' }); load(); } catch (e) { message.error(errorMessage(e)); } };
  const keyType = sourceType ? MAPPING_SOURCES[sourceType]?.keyType : undefined;

  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message="ربط الحسابات يحدد الحسابات التي تُستخدم تلقائياً عند ترحيل الفواتير والتحصيلات وفواتير الموردين. الربط الخاص بفرع يسبق الربط العام." />
      {manage && <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => open()}>ربط جديد</Button>}
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} pagination={false} scroll={{ x: 900 }}
        columns={[
          { title: 'المصدر', dataIndex: 'sourceType', width: 190, render: v => <div><b>{MAPPING_SOURCES[v]?.label ?? v}</b><div style={{ fontSize: 11, color: '#999' }}>{v}</div></div> },
          { title: 'المفتاح', key: 'k', width: 160, render: (_, m: any) => m.sourceKeyId ? <Tag color="blue">{m.sourceKeyLabel ?? m.sourceKey}</Tag> : <Text type="secondary">افتراضي</Text> },
          { title: 'الفرع', dataIndex: 'branch', width: 130, render: v => v ?? <Text type="secondary">كل الفروع</Text> },
          { title: 'الحساب المدين', dataIndex: 'debitAccount', render: v => v ?? '—' },
          { title: 'الحساب الدائن', dataIndex: 'creditAccount', render: v => v ?? '—' },
          { title: 'نشط', dataIndex: 'isActive', width: 70, render: v => v ? <Tag color="green">نعم</Tag> : <Tag>لا</Tag> },
          ...(manage ? [{ title: '', key: 'a', width: 90, render: (_: any, m: any) => <Space size={2}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => open(m)} />
            <Popconfirm title="حذف الربط؟" okText="حذف" cancelText="إلغاء" onConfirm={() => remove(m.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space> }] : []),
        ]} />
      <Modal open={editing != null} title={editing === 'new' ? 'ربط جديد' : 'تعديل الربط'} okText="حفظ" cancelText="إلغاء" onOk={save} onCancel={() => setEditing(null)} destroyOnClose width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="sourceType" label="المصدر" rules={[{ required: true, message: 'مطلوب' }]} extra={sourceType && MAPPING_SOURCES[sourceType]?.hint}>
            <Select options={Object.entries(MAPPING_SOURCES).map(([k, v]) => ({ value: k, label: `${v.label} (${k})` }))} onChange={() => form.setFieldsValue({ sourceKeyId: undefined })} />
          </Form.Item>
          {keyType && <Form.Item name="sourceKeyId" label={keyType === 'FEE_TYPE' ? 'نوع الرسوم / البند' : 'طريقة الدفع'} extra="اتركه فارغاً للربط الافتراضي">
            <Select allowClear showSearch optionFilterProp="label" options={(keys[keyType] ?? []).map(k => ({ value: k.id, label: k.label ?? k.code }))} />
          </Form.Item>}
          <Form.Item name="branchId" label="الفرع"><BranchSelect allowClear placeholder="كل الفروع" /></Form.Item>
          <Form.Item name="debitAccountId" label="الحساب المدين"><AccountSelect allowClear accounts={accounts} /></Form.Item>
          <Form.Item name="creditAccountId" label="الحساب الدائن"><AccountSelect allowClear accounts={accounts} /></Form.Item>
          <Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
