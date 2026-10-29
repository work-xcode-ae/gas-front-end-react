import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, Modal, Radio, Row, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { PlusOutlined, SafetyCertificateOutlined, WarningOutlined, ToolOutlined, FileProtectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import VillaServiceRequestTracker from './VillaServiceRequestTracker';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';

const SR_TYPES = [
  { value: 'leak', label: 'تسرب غاز' }, { value: 'no_gas', label: 'انقطاع الغاز' }, { value: 'low_pressure', label: 'ضعف الضغط' },
  { value: 'regulator', label: 'منظم / صمام' }, { value: 'tank', label: 'الخزان' }, { value: 'piping', label: 'التمديدات' },
  { value: 'appliance', label: 'توصيل جهاز' }, { value: 'inspection', label: 'فحص دوري' }, { value: 'other', label: 'أخرى' },
];
const SLOTS = [{ value: 'any', label: 'أي وقت' }, { value: 'morning', label: 'صباحاً' }, { value: 'afternoon', label: 'بعد الظهر' }, { value: 'evening', label: 'مساءً' }];

interface Coverage {
  valid: boolean; reason?: string | null;
  contract?: { id: number; contractNo: string; startDate: string; endDate?: string | null; emergencyIncluded: boolean; responseTimeHours?: number | null; daysLeft?: number | null; provider?: string | null } | null;
}

/**
 * «طلبات الخدمة» of a villa (BuildingProfile in villa mode). A villa has no units, so requests are opened here —
 * only while the villa has a valid maintenance (AMC) contract (checked again by the API). The list below is the normal
 * building service-requests tab of the villa's host building.
 */
export default function VillaServiceTab({ villaId, buildingId, reloadKey, onChanged, onGoTo, kind = 'villa', onOpenContracts }: {
  villaId: number; buildingId: number; reloadKey: number; onChanged: () => void; onGoTo?: (tab: string) => void;
  /** restaurant: same tab, but the maintenance contract is the host building's and only the restaurant's own requests are listed */
  kind?: 'villa' | 'restaurant';
  /** overrides the «عقود الصيانة» shortcut (restaurant → open the host building) */
  onOpenContracts?: () => void;
}) {
  const isRest = kind === 'restaurant';
  const siteWord = isRest ? 'للمطعم' : 'للفيلا';
  const { can } = useAuth();
  const canCreate = can('service_requests.manage');
  const [cov, setCov] = useState<Coverage | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [assignees, setAssignees] = useState<{ users: any[]; vendors: any[] }>({ users: [], vendors: [] });
  const [form] = Form.useForm();
  const assignKind = Form.useWatch('assignKind', form) ?? 'none';

  const load = useCallback(() => {
    api<Coverage>(`/premises/${villaId}/maintenance-coverage`).then(setCov).catch(e => setCov({ valid: false, reason: errorMessage(e) }));
  }, [villaId]);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => {
    if (!open) return;
    api<{ users: any[]; vendors: any[] }>('/service-requests/assignees').then(setAssignees).catch(() => setAssignees({ users: [], vendors: [] }));
  }, [open]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const r = await api<{ id: number; requestNo: string; amcContractNo: string }>(`/premises/${villaId}/service-requests`, { body: {
        description: [SR_TYPES.find(t => t.value === v.srType)?.label, v.description?.trim()].filter(Boolean).join(' — '),
        priority: v.priority,
        notes: [
          v.visitDate ? `الموعد المفضل: ${v.visitDate.format('YYYY-MM-DD')} — ${SLOTS.find(s => s.value === v.visitSlot)?.label ?? ''}` : null,
          v.contactPhone?.trim() ? `هاتف التواصل: ${v.contactPhone.trim()}` : null,
          v.notes?.trim() || null,
        ].filter(Boolean).join('\n') || null,
        assignedTo: v.assignKind === 'user' ? v.assignId : null,
        assignedVendorId: v.assignKind === 'vendor' ? v.assignId : null,
      } });
      message.success(`تم إنشاء طلب الخدمة ${r.requestNo} (عقد الصيانة ${r.amcContractNo})`);
      setOpen(false);
      setCreatedId(r.id);
      onChanged();
      load();
    } catch (e) { message.error(errorMessage(e), 7); }
    finally { setSaving(false); }
  };

  const c = cov?.contract;
  const openNew = () => { form.resetFields(); form.setFieldsValue({ priority: 'medium', visitSlot: 'any', assignKind: 'none' }); setOpen(true); };
  const addBtn = canCreate && (
    <Tooltip title={cov && !cov.valid ? cov.reason : undefined}>
      <Button type="primary" icon={<PlusOutlined />} disabled={!cov?.valid} style={cov?.valid ? { background: PRIMARY, borderColor: PRIMARY } : undefined}
        onClick={openNew}>
        طلب خدمة جديد
      </Button>
    </Tooltip>
  );

  return (
    <div>
      <Card variant="borderless" style={{ borderRadius: 10, marginBottom: 12 }} styles={{ body: { padding: '12px 16px' } }}>
        {!cov ? <Spin size="small" /> : cov.valid && c ? (
          <Row align="middle" gutter={[12, 8]}>
            <Col flex="auto">
              <Space wrap>
                <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <Text strong>{isRest ? 'عقد صيانة المبنى ساري:' : 'عقد صيانة ساري:'}</Text><Tag color="green" style={{ fontFamily: 'monospace' }}>{c.contractNo}</Tag>
                <Text type="secondary">{c.startDate} → {c.endDate ?? 'مفتوح'}</Text>
                {c.daysLeft != null && <Tag color={c.daysLeft <= 30 ? 'orange' : 'default'}>متبقي {c.daysLeft} يوم</Tag>}
                {c.provider && <Text type="secondary">· المزوّد: {c.provider}</Text>}
                {c.responseTimeHours != null && <Text type="secondary">· الاستجابة خلال {c.responseTimeHours} ساعة</Text>}
                {c.emergencyIncluded && <Tag color="blue">يشمل الطوارئ</Tag>}
              </Space>
            </Col>
            <Col>{addBtn}</Col>
          </Row>
        ) : (
          <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ borderRadius: 8 }}
            message={`لا يمكن فتح طلب خدمة: لا يوجد عقد صيانة ساري ${isRest ? 'للمبنى الذي يقع فيه المطعم' : siteWord}`}
            description={cov.reason}
            action={<Space orientation="vertical">
              {addBtn}
              {(onOpenContracts || onGoTo) && <Button size="small" icon={<FileProtectOutlined />} onClick={() => onOpenContracts ? onOpenContracts() : onGoTo?.('contracts')}>
                {isRest ? 'عقود الصيانة (المبنى)' : 'عقود الصيانة'}</Button>}
            </Space>} />
        )}
      </Card>

      {/* full tracker: workflow, assign / complete (with attachments) / cancel / reopen, follow-up history */}
      <VillaServiceRequestTracker buildingId={buildingId} premisesId={villaId} scopeToAudit={isRest} siteLabel={isRest ? 'المطعم' : 'الفيلا'} reloadKey={reloadKey} highlightId={createdId} onChanged={onChanged}
        canNew={!!cov?.valid && canCreate} newDisabledReason={cov?.reason ?? (canCreate ? null : 'لا تملك صلاحية إنشاء طلبات الخدمة')} onNew={openNew} />

      <Modal open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} destroyOnHidden width={Math.min(window.innerWidth - 24, 680)}
        okText="إنشاء الطلب" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY } }}
        title={<Space><ToolOutlined style={{ color: PRIMARY }} />{isRest ? 'طلب خدمة جديد للمطعم' : 'طلب خدمة جديد للفيلا'}</Space>}>
        {c && <Alert type="success" showIcon style={{ marginBottom: 12 }} message={`ضمن عقد الصيانة ${c.contractNo} (حتى ${c.endDate ?? '—'})`} />}
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="srType" label="نوع الطلب" rules={[{ required: true, message: 'اختر نوع الطلب' }]}><Select options={SR_TYPES} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="priority" label="الأولوية">
              <Select options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'urgent', label: 'عاجلة' }]} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="description" label="وصف المشكلة" rules={[{ required: true, message: 'اكتب وصفاً مختصراً' }]}><Input.TextArea rows={3} /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="visitDate" label="الموعد المفضل"><DatePicker style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs(), 'day')} /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="visitSlot" label="الفترة"><Select options={SLOTS} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="contactPhone" label="هاتف التواصل"><Input dir="ltr" /></Form.Item></Col>
            <Col xs={24}><Form.Item name="assignKind" label="الإسناد">
              <Radio.Group options={[{ value: 'none', label: 'بدون إسناد الآن' }, { value: 'user', label: 'فني' }, { value: 'vendor', label: 'مقاول' }]} /></Form.Item></Col>
            {assignKind !== 'none' && <Col xs={24}><Form.Item name="assignId" label={assignKind === 'user' ? 'الفني' : 'المقاول'} rules={[{ required: true, message: 'اختر' }]}>
              <Select showSearch optionFilterProp="label" options={(assignKind === 'user' ? assignees.users : assignees.vendors).map((a: any) => ({ value: a.id, label: `${a.name ?? ''}${a.phone ? ` · ${a.phone}` : ''}` }))} /></Form.Item></Col>}
            <Col xs={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
