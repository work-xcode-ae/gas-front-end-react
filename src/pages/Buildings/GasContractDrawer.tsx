import React, { useRef } from 'react';
import {
  Drawer, Button, Tag, Descriptions, Divider, Row, Col,
  Typography, Space, Timeline, Progress, Alert, Badge,
} from 'antd';
import {
  PrinterOutlined, EditOutlined, FireOutlined, HomeOutlined,
  UserOutlined, CalendarOutlined, DollarOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

export interface SupplyContractRecord {
  id: string; contractNo: string; tenant: string; tenantId?: string;
  unit: string; floor?: number; meter: string; startDate: string; endDate: string;
  status: string; monthlyFee: number; currency: string;
  gasUnitPrice?: number; connectionFee?: number; connectionFeePaid?: boolean;
  disconnectionFee?: number; depositAmount?: number; depositPaid?: boolean; depositDate?: string;
  lastReading?: number; lastReadDate?: string; balanceM3?: number;
  balanceAmount: number; overdueAmount?: number; paymentStatus: string;
  autoRenew?: boolean; renewalPeriod?: number;
  terms?: string;
  [key: string]: unknown;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active:  { label: 'نشط',   color: 'success', icon: <CheckCircleOutlined /> },
  expired: { label: 'منتهي', color: 'error',   icon: <CloseCircleOutlined /> },
  pending: { label: 'معلق',  color: 'warning', icon: <SyncOutlined spin /> },
};
const PAY_MAP: Record<string, { label: string; color: string }> = {
  paid:    { label: 'مسدد',  color: 'success' },
  pending: { label: 'معلق',  color: 'warning' },
  overdue: { label: 'متأخر', color: 'error'   },
};

interface Props {
  open: boolean;
  contract: SupplyContractRecord | null;
  buildingName?: string;
  onClose: () => void;
  onEdit?: () => void;
}

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
    <Text type="secondary" style={{ fontSize: 12, minWidth: 130 }}>{label}</Text>
    <div style={{ fontSize: 12, fontWeight: 500, textAlign: 'left' }}>{children}</div>
  </div>
);

const GasContractDrawer: React.FC<Props> = ({ open, contract, buildingName, onClose, onEdit }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!contract) return null;

  const status   = STATUS_MAP[contract.status]  ?? { label: contract.status, color: 'default', icon: null };
  const payStatus = PAY_MAP[contract.paymentStatus] ?? { label: contract.paymentStatus, color: 'default' };

  const daysLeft = contract.endDate
    ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 60;
  const isExpired = contract.status === 'expired';

  const balancePct = contract.balanceM3 != null && contract.lastReading != null
    ? Math.min(100, Math.round((contract.balanceM3 / (contract.lastReading + contract.balanceM3)) * 100))
    : null;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w || !printRef.current) return;
    w.document.write(`
      <html dir="rtl"><head>
      <title>عقد توريد غاز — ${contract.contractNo}</title>
      <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
        body { margin: 0; padding: 24px; color: #222; font-size: 13px; }
        h1 { color: #1a5c2a; font-size: 18px; margin: 0 0 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5c2a; padding-bottom: 12px; margin-bottom: 18px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .active  { background: #d9f7be; color: #237804; }
        .expired { background: #ffe7e7; color: #a8071a; }
        .section { margin-bottom: 16px; }
        .section-title { font-weight: 700; font-size: 13px; color: #1a5c2a; border-bottom: 1px solid #d9f7be; padding-bottom: 4px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; font-size: 12px; text-align: right; }
        th { background: #f6ffed; font-weight: 600; color: #1a5c2a; }
        .kpi { display: inline-block; background: #f0f9f0; border-radius: 6px; padding: 6px 12px; margin: 0 4px 6px; text-align: center; min-width: 90px; }
        .kpi-val { font-size: 16px; font-weight: 700; color: #1a5c2a; }
        .kpi-lbl { font-size: 11px; color: #666; }
        .terms { white-space: pre-line; background: #f9f9f9; border: 1px solid #eee; padding: 10px; border-radius: 4px; font-size: 12px; line-height: 1.8; }
        .footer { margin-top: 32px; display: flex; justify-content: space-between; }
        .sig { border-top: 1px solid #333; padding-top: 4px; min-width: 160px; text-align: center; font-size: 11px; color: #555; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <div class="header">
        <div>
          <div style="font-size:11px;color:#888;margin-bottom:4px">بن سدرة للغاز — Gas Supply Contract</div>
          <h1>عقد توريد الغاز</h1>
          <div style="font-size:12px;color:#555;margin-top:4px">رقم العقد: <strong style="font-family:monospace">${contract.contractNo}</strong></div>
        </div>
        <div style="text-align:left">
          <span class="badge ${contract.status}">${status.label}</span>
          <div style="font-size:11px;color:#888;margin-top:6px">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-AE')}</div>
        </div>
      </div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px">
        <div class="kpi"><div class="kpi-val">${contract.balanceAmount.toLocaleString()}</div><div class="kpi-lbl">الرصيد (د.إ)</div></div>
        <div class="kpi"><div class="kpi-val">${contract.monthlyFee}</div><div class="kpi-lbl">رسوم شهرية (د.إ)</div></div>
        <div class="kpi"><div class="kpi-val">${contract.depositAmount ?? '—'}</div><div class="kpi-lbl">الوديعة (د.إ)</div></div>
        ${contract.balanceM3 != null ? `<div class="kpi"><div class="kpi-val">${contract.balanceM3}</div><div class="kpi-lbl">رصيد م³</div></div>` : ''}
      </div>

      <div class="section">
        <div class="section-title">أطراف العقد</div>
        <table>
          <tr><th>المستأجر</th><td>${contract.tenant}</td><th>المبنى</th><td>${buildingName ?? '—'}</td></tr>
          <tr><th>رقم الوحدة</th><td>${contract.unit}</td><th>رقم العداد</th><td>${contract.meter}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">مدة العقد</div>
        <table>
          <tr><th>تاريخ البداية</th><td>${contract.startDate}</td><th>تاريخ الانتهاء</th><td>${contract.endDate}</td></tr>
          <tr><th>التجديد التلقائي</th><td>${contract.autoRenew ? `نعم — كل ${contract.renewalPeriod ?? 12} شهر` : 'لا'}</td><th>الحالة</th><td>${status.label}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">الرسوم والأسعار</div>
        <table>
          <tr><th>الرسوم الشهرية</th><td>${contract.monthlyFee} ${contract.currency}</td><th>سعر م³ الغاز</th><td>${contract.gasUnitPrice ?? '—'} ${contract.currency}</td></tr>
          <tr><th>رسوم الوصل</th><td>${contract.connectionFee ?? '—'} ${contract.currency}</td><th>رسوم القطع</th><td>${contract.disconnectionFee ?? '—'} ${contract.currency}</td></tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">الوديعة والمدفوعات</div>
        <table>
          <tr><th>مبلغ الوديعة</th><td>${contract.depositAmount ?? '—'} ${contract.currency}</td><th>حالة الوديعة</th><td>${contract.depositPaid ? 'مسددة' : 'غير مسددة'}${contract.depositDate ? ' — ' + contract.depositDate : ''}</td></tr>
          <tr><th>حالة الدفع</th><td>${payStatus.label}</td><th>المتأخرات</th><td style="color:${(contract.overdueAmount ?? 0) > 0 ? '#a8071a' : '#237804'}">${contract.overdueAmount ?? 0} ${contract.currency}</td></tr>
        </table>
      </div>

      ${contract.terms ? `
      <div class="section">
        <div class="section-title">الشروط والأحكام</div>
        <div class="terms">${contract.terms}</div>
      </div>` : ''}

      <div class="footer">
        <div class="sig">توقيع المستأجر<br/><br/>${contract.tenant}</div>
        <div class="sig">توقيع الشركة<br/><br/>بن سدرة للغاز</div>
      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      placement="left"
      title={null}
      styles={{ body: { padding: 0 }, header: { display: 'none' } }}
    >
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}08)`, borderBottom: `3px solid ${GOLD}`, padding: '18px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
              <FireOutlined />
            </div>
            <div>
              <Title level={5} style={{ margin: 0, color: '#7a5c00' }}>عقد توريد الغاز</Title>
              <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{contract.contractNo}</Text>
            </div>
          </div>
          <Space>
            <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>طباعة</Button>
            {onEdit && <Button size="small" icon={<EditOutlined />} onClick={onEdit}>تعديل</Button>}
            <Button size="small" onClick={onClose}>✕</Button>
          </Space>
        </div>

        {/* Status badges */}
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Tag color={status.color} icon={status.icon} style={{ fontWeight: 600 }}>{status.label}</Tag>
          <Tag color={payStatus.color}>{payStatus.label}</Tag>
          {contract.autoRenew && <Tag color="blue" icon={<SyncOutlined />}>تجديد تلقائي</Tag>}
          {expiringSoon && <Tag color="warning" icon={<WarningOutlined />}>ينتهي خلال {daysLeft} يوم</Tag>}
          {isExpired && <Tag color="error">منتهي</Tag>}
        </div>
      </div>

      {/* Alerts */}
      {(contract.overdueAmount ?? 0) > 0 && (
        <Alert type="error" showIcon banner message={`متأخرات غير مسددة: ${contract.overdueAmount?.toLocaleString()} ${contract.currency}`} style={{ fontSize: 12 }} />
      )}
      {expiringSoon && !isExpired && (
        <Alert type="warning" showIcon banner message={`العقد ينتهي خلال ${daysLeft} يوم — يُنصح بالتجديد المبكر`} style={{ fontSize: 12 }} />
      )}

      <div style={{ padding: '16px 20px', overflowY: 'auto', height: 'calc(100vh - 180px)' }} ref={printRef}>

        {/* KPI Strip */}
        <Row gutter={8} style={{ marginBottom: 16 }}>
          {[
            { label: 'الرصيد المالي', val: `${contract.balanceAmount.toLocaleString()} د.إ`, color: contract.balanceAmount > 0 ? PRIMARY : '#ff4d4f' },
            { label: 'الرسوم الشهرية', val: `${contract.monthlyFee} ${contract.currency}`, color: GOLD },
            { label: 'رصيد م³', val: contract.balanceM3 != null ? `${contract.balanceM3} م³` : '—', color: '#1677ff' },
          ].map((k, i) => (
            <Col span={8} key={i}>
              <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{k.label}</div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Parties */}
        <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '0 0 10px' }}>
          <UserOutlined style={{ marginInlineEnd: 4 }} />أطراف العقد
        </Divider>
        <InfoRow label="المستأجر"><Text strong>{contract.tenant}</Text></InfoRow>
        <InfoRow label="المبنى"><Text>{buildingName ?? '—'}</Text></InfoRow>
        <InfoRow label="الوحدة"><Text><HomeOutlined style={{ marginInlineEnd: 4, color: PRIMARY }} />{contract.unit}</Text></InfoRow>
        <InfoRow label="رقم العداد"><Text style={{ fontFamily: 'monospace' }}>{contract.meter}</Text></InfoRow>

        {/* Duration */}
        <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '14px 0 10px' }}>
          <CalendarOutlined style={{ marginInlineEnd: 4 }} />مدة العقد
        </Divider>
        <InfoRow label="تاريخ البداية"><Text>{contract.startDate}</Text></InfoRow>
        <InfoRow label="تاريخ الانتهاء">
          <Text style={{ color: isExpired ? '#ff4d4f' : expiringSoon ? '#fa8c16' : undefined }}>{contract.endDate}</Text>
        </InfoRow>
        {daysLeft !== null && !isExpired && (
          <InfoRow label="المتبقي">
            <Progress
              percent={Math.max(0, Math.min(100, Math.round((daysLeft / 365) * 100)))}
              size="small" strokeColor={expiringSoon ? '#fa8c16' : PRIMARY}
              format={() => `${daysLeft} يوم`}
              style={{ margin: 0, width: 180 }}
            />
          </InfoRow>
        )}
        <InfoRow label="التجديد التلقائي">
          {contract.autoRenew
            ? <Tag color="success">نعم — كل {contract.renewalPeriod ?? 12} شهر</Tag>
            : <Tag color="default">لا</Tag>}
        </InfoRow>

        {/* Fees */}
        <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '14px 0 10px' }}>
          <DollarOutlined style={{ marginInlineEnd: 4 }} />الرسوم والأسعار
        </Divider>
        <InfoRow label="الرسوم الشهرية"><Text strong style={{ color: GOLD }}>{contract.monthlyFee} {contract.currency}</Text></InfoRow>
        {contract.gasUnitPrice != null && <InfoRow label="سعر م³ الغاز"><Text>{contract.gasUnitPrice} {contract.currency}</Text></InfoRow>}
        {contract.connectionFee != null && (
          <InfoRow label="رسوم الوصل">
            <Space>
              <Text>{contract.connectionFee} {contract.currency}</Text>
              {contract.connectionFeePaid ? <Tag color="success" style={{ fontSize: 10 }}>مسددة</Tag> : <Tag color="warning" style={{ fontSize: 10 }}>معلقة</Tag>}
            </Space>
          </InfoRow>
        )}
        {contract.disconnectionFee != null && <InfoRow label="رسوم القطع"><Text>{contract.disconnectionFee} {contract.currency}</Text></InfoRow>}

        {/* Deposit */}
        <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '14px 0 10px' }}>
          <SafetyCertificateOutlined style={{ marginInlineEnd: 4 }} />الوديعة
        </Divider>
        <InfoRow label="مبلغ الوديعة"><Text strong>{contract.depositAmount ?? '—'} {contract.currency}</Text></InfoRow>
        <InfoRow label="حالة الوديعة">
          {contract.depositPaid
            ? <Tag color="success">مسددة {contract.depositDate ? `(${contract.depositDate})` : ''}</Tag>
            : <Tag color="error">غير مسددة</Tag>}
        </InfoRow>

        {/* Meter / Balance */}
        {(contract.lastReading != null || contract.balanceM3 != null) && (
          <>
            <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '14px 0 10px' }}>
              قراءة العداد والرصيد
            </Divider>
            {contract.lastReading != null && <InfoRow label="آخر قراءة"><Text>{contract.lastReading} م³ {contract.lastReadDate ? `(${contract.lastReadDate})` : ''}</Text></InfoRow>}
            {contract.balanceM3 != null && (
              <InfoRow label="رصيد م³">
                <Space>
                  <Text strong style={{ color: contract.balanceM3 > 0 ? PRIMARY : '#ff4d4f' }}>{contract.balanceM3} م³</Text>
                  {balancePct != null && <Progress percent={balancePct} size="small" strokeColor={PRIMARY} style={{ width: 80, margin: 0 }} showInfo={false} />}
                </Space>
              </InfoRow>
            )}
            <InfoRow label="الرصيد المالي"><Text strong style={{ color: contract.balanceAmount > 0 ? PRIMARY : '#ff4d4f' }}>{contract.balanceAmount.toLocaleString()} {contract.currency}</Text></InfoRow>
            {(contract.overdueAmount ?? 0) > 0 && (
              <InfoRow label="المتأخرات"><Text strong style={{ color: '#ff4d4f' }}>{contract.overdueAmount?.toLocaleString()} {contract.currency}</Text></InfoRow>
            )}
          </>
        )}

        {/* Terms */}
        {contract.terms && (
          <>
            <Divider orientation="right" style={{ fontSize: 12, color: '#888', margin: '14px 0 10px' }}>
              <FileTextOutlined style={{ marginInlineEnd: 4 }} />الشروط والأحكام
            </Divider>
            <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', fontSize: 12, whiteSpace: 'pre-line', lineHeight: 1.9, color: '#444' }}>
              {contract.terms}
            </div>
          </>
        )}

        {/* Signature area */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
          {['توقيع المستأجر', 'توقيع الشركة'].map(s => (
            <div key={s} style={{ textAlign: 'center', minWidth: 140 }}>
              <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 6, marginTop: 40 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{s}</Text>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Footer actions */}
      {isExpired && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<SyncOutlined />} style={{ flex: 1, background: GOLD, borderColor: GOLD }}>تجديد العقد</Button>
          <Button icon={<FileTextOutlined />} style={{ flex: 1 }}>عقد جديد</Button>
        </div>
      )}
    </Drawer>
  );
};

export default GasContractDrawer;
