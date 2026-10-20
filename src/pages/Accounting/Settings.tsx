import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, Alert, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AccountSelect, useAccounts } from './shared';

export default function Settings() {
  const { can } = useAuth();
  const accounts = useAccounts();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<any>('/accounting/settings').then(s => form.setFieldsValue(s)).catch(e => message.error(errorMessage(e))); }, [form]);
  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try { await api('/accounting/settings', { method: 'PUT', body: { journalApprovalThreshold: v.journalApprovalThreshold ?? 0, openingEquityAccountId: v.openingEquityAccountId ?? null } }); message.success('تم حفظ الإعدادات'); }
    catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };
  return (
    <Card size="small" style={{ maxWidth: 620, borderRadius: 12 }}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="اعتماد القيود (فصل المهام)"
        description="القيود اليدوية التي تتجاوز الحد تُحفظ كمسودة ولا تُرحّل إلا بعد اعتمادها من مستخدم آخر لديه صلاحية الترحيل (accounting.post) غير منشئ القيد. يُسجّل المعتمد ووقت الاعتماد. القيمة 0 تعطّل الاعتماد." />
      <Form form={form} layout="vertical" disabled={!can('accounting.manage')}>
        <Form.Item name="journalApprovalThreshold" label="حد اعتماد القيود اليدوية (د.إ)">
          <InputNumber min={0} step={1000} style={{ width: 240 }} />
        </Form.Item>
        <Form.Item name="openingEquityAccountId" label="حساب الأرصدة الافتتاحية (حقوق ملكية)" extra="يُستخدم لموازنة القيد الافتتاحي وأرصدة العملاء والموردين الافتتاحية.">
          <AccountSelect allowClear accounts={accounts.filter(a => a.type === 'equity')} />
        </Form.Item>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>حفظ</Button>
      </Form>
    </Card>
  );
}
