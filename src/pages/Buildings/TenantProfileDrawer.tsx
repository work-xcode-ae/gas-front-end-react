import React, { useState } from 'react';
import {
  Drawer, Typography, Tag, Button, Avatar, Row, Col,
  Descriptions, Divider, Progress, Timeline, Tooltip,
  Badge, Space, Modal, Form, Input, Select, message,
} from 'antd';
import {
  UserOutlined, PhoneOutlined, MailOutlined, IdcardOutlined,
  HomeOutlined, FireOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, EditOutlined, PrinterOutlined,
  CalendarOutlined, ContainerOutlined, GlobalOutlined,
  CloseOutlined, CreditCardOutlined, SafetyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

/* ─── Types ─────────────────────────────────────────── */
export interface TenantProfileProps {
  open: boolean;
  onClose: () => void;
  tenant: {
    id: string; name: string; nameEn?: string; avatar: string;
    unit: string; floor: number; meterNo: string | null;
    contractNo: string; contractStart: string; contractEnd: string;
    rent: number; paymentStatus: string;
    gasBalance?: number; depositPaid?: boolean;
    phone?: string; email?: string; emiratesId?: string; nationality?: string;
  } | null;
  buildingName?: string;
  onOpenInvoices?: () => void;
  onOpenContract?: () => void;
}

/* ─── Helpers ───────────────────────────────────────── */
const paymentStatusMap: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  paid:    { color: 'success', label: 'مسدد',    icon: <CheckCircleOutlined /> },
  pending: { color: 'warning', label: 'معلق',    icon: <ClockCircleOutlined /> },
  overdue: { color: 'error',   label: 'متأخر',   icon: <ExclamationCircleOutlined /> },
};

function contractDaysLeft(endDate: string): number {
  return dayjs(endDate).diff(dayjs(), 'day');
}

function contractProgress(start: string, end: string): number {
  const total = dayjs(end).diff(dayjs(start), 'day');
  const elapsed = dayjs().diff(dayjs(start), 'day');
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/* ─── Activity timeline (demo) ───────────────────────── */
function getDemoActivity(contractNo: string) {
  return [
    { date: '2024-12-01', type: 'invoice',  color: 'blue',   label: 'فاتورة استهلاك الغاز - ديسمبر 2024', amount: '3,850 د.إ' },
    { date: '2024-11-10', type: 'payment',  color: 'green',  label: 'دفعة مستلمة - نوفمبر 2024',           amount: '3,650 د.إ' },
    { date: '2024-11-01', type: 'invoice',  color: 'blue',   label: 'فاتورة استهلاك الغاز - نوفمبر 2024', amount: '3,650 د.إ' },
    { date: '2024-10-08', type: 'payment',  color: 'green',  label: 'دفعة مستلمة - أكتوبر 2024',           amount: '4,100 د.إ' },
    { date: '2024-07-09', type: 'payment',  color: 'green',  label: 'دفعة صيانة مستلمة',                   amount: '800 د.إ' },
    { date: '2024-01-05', type: 'deposit',  color: 'purple', label: 'وديعة ضمان مستلمة',                   amount: '5,000 د.إ' },
    { date: contractNo === 'GC-2024-001' ? '2024-01-01' : '2024-01-01',
                          type: 'contract', color: 'gold',   label: `توقيع العقد ${contractNo}`,            amount: '' },
  ];
}

/* ─── Edit Contact Modal ────────────────────────────── */
interface EditContactModalProps {
  open: boolean; tenant: TenantProfileProps['tenant'];
  onClose: () => void; onSave: (data: { phone: string; email: string }) => void;
}
const EditContactModal: React.FC<EditContactModalProps> = ({ open, tenant, onClose, onSave }) => {
  const [form] = Form.useForm();
  if (!tenant) return null;
  return (
    <Modal open={open} onCancel={onClose} destroyOnHidden
      title={<span><EditOutlined style={{ marginInlineEnd: 8 }} />تعديل معلومات الاتصال</span>}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>إلغاء</Button>
          <Button type="primary" style={{ background: PRIMARY, borderColor: PRIMARY }}
            onClick={async () => {
              const v = await form.validateFields();
              onSave(v); message.success('تم تحديث بيانات الاتصال'); onClose();
            }}>حفظ</Button>
        </div>
      }
      width={420} style={{ direction: 'rtl' }}>
      <Form form={form} layout="vertical" style={{ direction: 'rtl', marginTop: 16 }}
        initialValues={{ phone: tenant.phone, email: tenant.email }}>
        <Form.Item name="phone" label="رقم الهاتف" rules={[{ required: true }]}>
          <Input prefix={<PhoneOutlined />} placeholder="+971XXXXXXXXX" />
        </Form.Item>
        <Form.Item name="email" label="البريد الإلكتروني" rules={[{ type: 'email' }]}>
          <Input prefix={<MailOutlined />} placeholder="email@example.com" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/* ─── Main Component ────────────────────────────────── */
const TenantProfileDrawer: React.FC<TenantProfileProps> = ({
  open, onClose, tenant, buildingName, onOpenInvoices, onOpenContract,
}) => {
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [contactOverride, setContactOverride] = useState<{ phone?: string; email?: string }>({});

  if (!tenant) return null;

  const phone    = contactOverride.phone ?? tenant.phone ?? '—';
  const email    = contactOverride.email ?? tenant.email ?? '—';
  const daysLeft = contractDaysLeft(tenant.contractEnd);
  const progress = contractProgress(tenant.contractStart, tenant.contractEnd);
  const activity = getDemoActivity(tenant.contractNo);

  const statusColor = paymentStatusMap[tenant.paymentStatus]?.color ?? 'default';
  const isOverdue   = tenant.paymentStatus === 'overdue';
  const headerBg    = isOverdue
    ? 'linear-gradient(135deg,#c0392b,#e74c3c)'
    : `linear-gradient(135deg,${PRIMARY},#2e7d32)`;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>ملف المستأجر - ${tenant.name}</title>
      <style>
        body{font-family:Arial,sans-serif;direction:rtl;padding:40px;color:#222;font-size:13px}
        h1{color:#1a5c2a;font-size:20px;border-bottom:3px solid #1a5c2a;padding-bottom:12px}
        .section{margin-bottom:24px}
        .section-title{font-size:14px;font-weight:700;color:#1a5c2a;margin-bottom:8px;border-right:3px solid #c9a84c;padding-right:8px}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5}
        .label{color:#888;font-size:12px}.value{font-weight:600}
        .badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px}
        .badge-paid{background:#f6ffed;color:#52c41a;border:1px solid #b7eb8f}
        .badge-overdue{background:#fff1f0;color:#ff4d4f;border:1px solid #ffa39e}
        .badge-pending{background:#fff7e6;color:#fa8c16;border:1px solid #ffd591}
        .footer{margin-top:40px;text-align:center;color:#aaa;font-size:11px}
      </style></head><body>
      <h1>ملف المستأجر</h1>
      <div class="section">
        <div class="section-title">المعلومات الشخصية</div>
        <div class="row"><span class="label">الاسم</span><span class="value">${tenant.name}</span></div>
        <div class="row"><span class="label">الاسم بالإنجليزية</span><span class="value">${tenant.nameEn ?? '—'}</span></div>
        <div class="row"><span class="label">الجنسية</span><span class="value">${tenant.nationality ?? '—'}</span></div>
        <div class="row"><span class="label">الهوية الإماراتية</span><span class="value">${tenant.emiratesId ?? '—'}</span></div>
        <div class="row"><span class="label">الهاتف</span><span class="value">${phone}</span></div>
        <div class="row"><span class="label">البريد الإلكتروني</span><span class="value">${email}</span></div>
      </div>
      <div class="section">
        <div class="section-title">تفاصيل السكن</div>
        <div class="row"><span class="label">الوحدة</span><span class="value">وحدة ${tenant.unit} · طابق ${tenant.floor}</span></div>
        <div class="row"><span class="label">المبنى</span><span class="value">${buildingName ?? '—'}</span></div>
        <div class="row"><span class="label">رقم العداد</span><span class="value">${tenant.meterNo ?? 'لا يوجد عداد'}</span></div>
        <div class="row"><span class="label">رصيد الغاز</span><span class="value">${tenant.gasBalance ?? 0} م³</span></div>
      </div>
      <div class="section">
        <div class="section-title">تفاصيل العقد</div>
        <div class="row"><span class="label">رقم العقد</span><span class="value">${tenant.contractNo}</span></div>
        <div class="row"><span class="label">بداية العقد</span><span class="value">${tenant.contractStart}</span></div>
        <div class="row"><span class="label">نهاية العقد</span><span class="value">${tenant.contractEnd}</span></div>
        <div class="row"><span class="label">الإيجار السنوي</span><span class="value">${tenant.rent.toLocaleString()} د.إ</span></div>
        <div class="row"><span class="label">وديعة الضمان</span><span class="value">${tenant.depositPaid ? 'مدفوعة ✓' : 'غير مدفوعة'}</span></div>
        <div class="row"><span class="label">حالة الدفع</span><span class="value">
          <span class="badge badge-${tenant.paymentStatus}">${paymentStatusMap[tenant.paymentStatus]?.label}</span>
        </span></div>
      </div>
      <div class="footer">طُبع بتاريخ ${new Date().toLocaleDateString('ar-AE')} · ${buildingName ?? ''}</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <>
      <Drawer
        open={open} onClose={onClose} placement="left" width={620}
        styles={{ header: { display: 'none' }, body: { padding: 0 } }}
      >
        {/* ── Header ── */}
        <div style={{ background: headerBg, padding: '24px 24px 20px', color: '#fff', position: 'relative' }}>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose}
            style={{ position: 'absolute', top: 16, insetInlineStart: 16, color: 'rgba(255,255,255,0.7)' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Avatar size={64} style={{
              background: 'rgba(255,255,255,0.25)', fontSize: 20, fontWeight: 700,
              border: '3px solid rgba(255,255,255,0.4)', flexShrink: 0,
            }}>
              {tenant.avatar}
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Title level={4} style={{ color: '#fff', margin: 0 }}>{tenant.name}</Title>
                <Tag color={statusColor} icon={paymentStatusMap[tenant.paymentStatus]?.icon}
                  style={{ fontWeight: 600 }}>
                  {paymentStatusMap[tenant.paymentStatus]?.label}
                </Tag>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{tenant.nameEn}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Tag style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'transparent', color: '#fff', fontSize: 12 }}>
                  <HomeOutlined style={{ marginInlineEnd: 4 }} />وحدة {tenant.unit} · ط {tenant.floor}
                </Tag>
                {tenant.meterNo && (
                  <Tag style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'transparent', color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
                    <FireOutlined style={{ marginInlineEnd: 4 }} />{tenant.meterNo}
                  </Tag>
                )}
                <Tag style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'transparent', color: '#fff', fontSize: 12 }}>
                  <GlobalOutlined style={{ marginInlineEnd: 4 }} />{tenant.nationality ?? '—'}
                </Tag>
              </div>
            </div>
          </div>

          {/* Quick action chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { icon: <CreditCardOutlined />, label: 'الفواتير',    action: onOpenInvoices },
              { icon: <ContainerOutlined />,  label: 'العقد',       action: onOpenContract },
              { icon: <PrinterOutlined />,    label: 'طباعة الملف', action: handlePrint },
            ].map(btn => (
              <Button key={btn.label} size="small" icon={btn.icon} onClick={btn.action}
                style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', fontSize: 12 }}>
                {btn.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px 24px 32px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>

          {/* ① Personal info */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ fontSize: 13, color: PRIMARY }}>
                <UserOutlined style={{ marginInlineEnd: 6 }} />المعلومات الشخصية
              </Text>
              <Button size="small" icon={<EditOutlined />} type="text"
                onClick={() => setEditContactOpen(true)} style={{ fontSize: 12, color: '#888' }}>
                تعديل
              </Button>
            </div>
            <div style={{ background: '#fafafa', borderRadius: 10, padding: '4px 0' }}>
              {[
                { label: 'الهاتف',             value: phone,               icon: <PhoneOutlined /> },
                { label: 'البريد الإلكتروني', value: email,               icon: <MailOutlined /> },
                { label: 'الهوية الإماراتية', value: tenant.emiratesId ?? '—', icon: <IdcardOutlined /> },
                { label: 'الجنسية',            value: tenant.nationality ?? '—', icon: <GlobalOutlined /> },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderBottom: i < 3 ? '1px solid #f0f0f0' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 12 }}>
                    {row.icon}<span>{row.label}</span>
                  </div>
                  <Text style={{ fontSize: 13, fontFamily: row.label === 'الهوية الإماراتية' ? 'monospace' : undefined }}>
                    {row.value}
                  </Text>
                </div>
              ))}
            </div>
          </div>

          {/* ② Contract info */}
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 12 }}>
              <ContainerOutlined style={{ marginInlineEnd: 6 }} />تفاصيل العقد
            </Text>
            <div style={{ background: '#fafafa', borderRadius: 10, padding: '4px 0' }}>
              {[
                { label: 'رقم العقد',      value: <Text style={{ fontFamily: 'monospace', color: PRIMARY }}>{tenant.contractNo}</Text> },
                { label: 'بداية العقد',    value: tenant.contractStart },
                { label: 'نهاية العقد',    value: tenant.contractEnd },
                { label: 'الإيجار السنوي', value: <Text strong style={{ color: PRIMARY }}>{tenant.rent.toLocaleString()} <small>د.إ</small></Text> },
                { label: 'وديعة الضمان',   value: tenant.depositPaid
                    ? <Tag color="success" icon={<CheckCircleOutlined />}>مدفوعة</Tag>
                    : <Tag color="error"   icon={<ExclamationCircleOutlined />}>غير مدفوعة</Tag> },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderBottom: i < 4 ? '1px solid #f0f0f0' : 'none',
                }}>
                  <Text style={{ color: '#888', fontSize: 12 }}>{row.label}</Text>
                  <span style={{ fontSize: 13 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Contract progress bar */}
            <div style={{ marginTop: 12, background: '#fafafa', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  <CalendarOutlined style={{ marginInlineEnd: 4 }} />مدة العقد
                </Text>
                <Text style={{ fontSize: 12, color: daysLeft < 30 ? '#ff4d4f' : daysLeft < 90 ? '#fa8c16' : PRIMARY, fontWeight: 600 }}>
                  {daysLeft > 0 ? `${daysLeft} يوم متبقي` : 'انتهى العقد'}
                </Text>
              </div>
              <Progress
                percent={progress}
                showInfo={false}
                strokeColor={daysLeft < 30 ? '#ff4d4f' : daysLeft < 90 ? '#fa8c16' : PRIMARY}
                trailColor="#e8f5e9"
                size="small"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: '#bbb' }}>{tenant.contractStart}</Text>
                <Text style={{ fontSize: 11, color: '#bbb' }}>{tenant.contractEnd}</Text>
              </div>
            </div>
          </div>

          {/* ③ Gas account */}
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 12 }}>
              <FireOutlined style={{ marginInlineEnd: 6 }} />حساب الغاز
            </Text>
            <Row gutter={12}>
              <Col span={12}>
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{tenant.gasBalance ?? 0}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>رصيد الغاز (م³)</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ background: tenant.meterNo ? '#e6f4ff' : '#fff7e6', border: `1px solid ${tenant.meterNo ? '#91caff' : '#ffd591'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: tenant.meterNo ? '#0958d9' : '#d46b08', fontFamily: 'monospace' }}>
                    {tenant.meterNo ?? 'لا يوجد'}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>رقم العداد</div>
                </div>
              </Col>
            </Row>
          </div>

          {/* ④ Activity timeline */}
          <div>
            <Text strong style={{ fontSize: 13, color: PRIMARY, display: 'block', marginBottom: 14 }}>
              <ClockCircleOutlined style={{ marginInlineEnd: 6 }} />آخر النشاطات
            </Text>
            <Timeline
              style={{ direction: 'rtl' }}
              items={activity.map(a => ({
                color: a.color as any,
                content: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 4 }}>
                    <div>
                      <Text style={{ fontSize: 13 }}>{a.label}</Text>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{a.date}</div>
                    </div>
                    {a.amount && <Text strong style={{ fontSize: 13, color: PRIMARY, whiteSpace: 'nowrap' }}>{a.amount}</Text>}
                  </div>
                ),
              }))}
            />
          </div>
        </div>
      </Drawer>

      <EditContactModal
        open={editContactOpen} tenant={tenant}
        onClose={() => setEditContactOpen(false)}
        onSave={(d) => setContactOverride(d)}
      />
    </>
  );
};

export default TenantProfileDrawer;
