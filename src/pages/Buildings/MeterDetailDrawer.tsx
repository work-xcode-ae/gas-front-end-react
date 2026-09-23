import React, { useMemo } from 'react';
import {
  Drawer, Tag, Typography, Row, Col, Divider,
  Timeline, Badge, Progress, Button, Space,
  Statistic, Tooltip, Alert
} from 'antd';
import {
  DashboardOutlined, HomeOutlined, UserOutlined,
  CalendarOutlined, ToolOutlined, BarcodeOutlined,
  WarningOutlined, CheckCircleOutlined, ThunderboltOutlined,
  FireOutlined, ClockCircleOutlined, RiseOutlined,
  PrinterOutlined, EditOutlined, DisconnectOutlined, SafetyOutlined
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';

const { Text, Title } = Typography;
const PRIMARY  = '#1a5c2a';
const GOLD     = '#c9a84c';
const DANGER   = '#ff4d4f';

import type { MeterRecord } from './meterTypes';

interface MeterDetailDrawerProps {
  open: boolean;
  meter: MeterRecord | null;
  onClose: () => void;
  onEdit?: (meter: MeterRecord) => void;
}

/* ─── Generate fake monthly reading history ───────────────────── */
function buildHistory(meter: MeterRecord) {
  const months = ['يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف'];
  const base   = meter.monthlyAvg || 120;
  let cumulative = meter.lastReadValue - base * 5;
  return months.map((m, i) => {
    const usage = Math.round(base * (0.8 + Math.random() * 0.4));
    cumulative += usage;
    return { month: m, usage, cumulative: Math.max(0, cumulative) };
  });
}

/* ─── Status helpers ─────────────────────────────────────────── */
const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  active:       { color: 'success', icon: <CheckCircleOutlined />, text: 'نشط' },
  fault:        { color: 'error',   icon: <WarningOutlined />,     text: 'عطل' },
  disconnected: { color: 'default', icon: <DisconnectOutlined />,  text: 'مفصول' },
};

/* ─── Small info row ─────────────────────────────────────────── */
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f5f5f5' }}>
    <span style={{ color: '#bbb', fontSize: 13, width: 18, textAlign: 'center' }}>{icon}</span>
    <Text type="secondary" style={{ flex: 1, fontSize: 12 }}>{label}</Text>
    <span style={{ fontSize: 12 }}>{value}</span>
  </div>
);

/* ─── Section header ─────────────────────────────────────────── */
const SectionHead: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '18px 0 8px' }}>
    <span style={{ color: PRIMARY, fontSize: 14 }}>{icon}</span>
    <Text strong style={{ fontSize: 13, color: '#222' }}>{title}</Text>
  </div>
);

/* ─── Component ──────────────────────────────────────────────── */
const MeterDetailDrawer: React.FC<MeterDetailDrawerProps> = ({ open, meter, onClose, onEdit }) => {
  const history = useMemo(() => meter ? buildHistory(meter) : [], [meter]);

  if (!meter) return null;

  const isFault        = meter.status === 'fault';
  const isDisconnected = meter.status === 'disconnected';
  const sc             = statusConfig[meter.status] ?? statusConfig.active;
  const isSmart        = meter.type === 'smart';

  /* Calibration urgency */
  const calDate      = new Date(meter.calibrationDate);
  const today        = new Date();
  const daysToCalib  = Math.ceil((calDate.getTime() - today.getTime()) / 86_400_000);
  const calibWarning = daysToCalib < 90;

  /* Balance progress (out of 1500 m³ as reference max) */
  const balancePct = Math.min(100, Math.round((meter.balance / 1500) * 100));

  /* Chart options */
  const chartOptions: ApexCharts.ApexOptions = {
    chart: { toolbar: { show: false }, sparkline: { enabled: false }, background: 'transparent' },
    colors: [PRIMARY, `${PRIMARY}55`],
    xaxis: { categories: history.map(h => h.month), labels: { style: { fontSize: '10px' } } },
    yaxis: { labels: { style: { fontSize: '10px' }, formatter: (v: number) => `${v}` } },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} م³` } },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
    legend: { show: false },
  };
  const chartSeries = [
    { name: 'الاستهلاك الشهري', data: history.map(h => h.usage) },
  ];

  /* Reading timeline */
  const readingTimeline = history.slice().reverse().map((h, i) => ({
    label: h.month,
    value: h.cumulative,
    usage: h.usage,
    dot: i === 0 ? <CheckCircleOutlined style={{ color: PRIMARY }} /> : undefined,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      placement="left"
      styles={{
        header: { borderBottom: `3px solid ${PRIMARY}`, background: `linear-gradient(135deg, ${PRIMARY}08, transparent)` },
        body:   { padding: '0 20px 24px', direction: 'rtl' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${PRIMARY}, #2e7d32)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <DashboardOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: PRIMARY }}>{meter.id}</div>
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{meter.serial}</div>
          </div>
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
            <Tag color={sc.color} icon={sc.icon} style={{ margin: 0 }}>{sc.text}</Tag>
            <Tag color={isSmart ? 'blue' : 'default'} style={{ margin: 0 }}>
              {isSmart ? <><ThunderboltOutlined style={{ marginInlineEnd: 3 }} />ذكي</> : 'عادي'}
            </Tag>
          </div>
        </div>
      }
      extra={
        <Space size={6}>
          <Tooltip title="طباعة">
            <Button icon={<PrinterOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="تعديل">
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit?.(meter)} />
          </Tooltip>
        </Space>
      }
    >
      {/* ── Fault / Calibration alerts ── */}
      {isFault && (
        <Alert type="error" showIcon icon={<WarningOutlined />}
          message="العداد يحتاج إلى صيانة"
          description="يُرجى إنشاء طلب صيانة لفحص هذا العداد."
          action={<Button size="small" danger>إنشاء طلب</Button>}
          style={{ marginTop: 16, marginBottom: 4, borderRadius: 8 }}
        />
      )}
      {calibWarning && !isFault && (
        <Alert type="warning" showIcon icon={<ClockCircleOutlined />}
          message={`المعايرة القادمة خلال ${daysToCalib} يوم`}
          description={`تاريخ المعايرة: ${meter.calibrationDate}`}
          style={{ marginTop: 16, marginBottom: 4, borderRadius: 8 }}
        />
      )}

      {/* ── KPI row ── */}
      <Row gutter={[10, 10]} style={{ marginTop: 18 }}>
        <Col span={8}>
          <div style={{ background: '#f6ffed', borderRadius: 10, padding: '10px 12px', border: `1px solid ${PRIMARY}22`, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>آخر قراءة</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{meter.lastReadValue.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>م³</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ background: '#fff7e6', borderRadius: 10, padding: '10px 12px', border: `1px solid ${GOLD}44`, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>متوسط شهري</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{meter.monthlyAvg}</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>م³</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{
            background: meter.balance === 0 ? '#fff1f0' : '#f6ffed',
            borderRadius: 10, padding: '10px 12px',
            border: `1px solid ${meter.balance === 0 ? DANGER : PRIMARY}22`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>الرصيد</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: meter.balance === 0 ? DANGER : PRIMARY }}>
              {meter.balance === 0 ? '—' : meter.balance.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: '#aaa' }}>م³</div>
          </div>
        </Col>
      </Row>

      {/* Balance bar */}
      {meter.balance > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>مستوى الرصيد</Text>
            <Text style={{ fontSize: 11 }}>{balancePct}%</Text>
          </div>
          <Progress
            percent={balancePct}
            strokeColor={balancePct < 20 ? DANGER : balancePct < 50 ? GOLD : PRIMARY}
            trailColor="#f0f0f0" size="small" showInfo={false}
          />
        </div>
      )}

      {/* ── Unit & Tenant ── */}
      <SectionHead icon={<HomeOutlined />} title="الوحدة والمستأجر" />
      <InfoRow icon={<HomeOutlined />}    label="الوحدة"    value={<Text strong style={{ color: PRIMARY }}>وحدة {meter.unit} — طابق {meter.floor}</Text>} />
      <InfoRow icon={<UserOutlined />}    label="المستأجر"  value={
        meter.tenant
          ? <><Text strong>{meter.tenant}</Text><Tag color="success" style={{ marginInlineStart: 6 }}>نشط</Tag></>
          : <Text type="secondary">لا يوجد مستأجر</Text>
      } />

      {/* ── Device Info ── */}
      <SectionHead icon={<DashboardOutlined />} title="معلومات الجهاز" />
      <InfoRow icon={<BarcodeOutlined />}     label="الرقم التسلسلي"  value={<Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{meter.serial}</Text>} />
      <InfoRow icon={<ToolOutlined />}         label="الماركة"         value={meter.brand} />
      <InfoRow icon={<ThunderboltOutlined />}  label="النوع"           value={<Tag color={isSmart ? 'blue' : 'default'} style={{ margin: 0 }}>{meter.typeLabel}</Tag>} />
      <InfoRow icon={<CalendarOutlined />}     label="تاريخ التركيب"   value={meter.installDate} />
      <InfoRow icon={<ClockCircleOutlined />}  label="آخر قراءة بتاريخ" value={meter.lastRead} />
      <InfoRow icon={<SafetyOutlined />}       label="المعايرة القادمة" value={
        <Text style={{ color: calibWarning ? (daysToCalib < 30 ? DANGER : GOLD) : '#222' }}>
          {meter.calibrationDate}
          {calibWarning && <WarningOutlined style={{ marginInlineStart: 4, color: GOLD }} />}
        </Text>
      } />

      {/* ── Consumption chart ── */}
      <SectionHead icon={<RiseOutlined />} title="استهلاك الأشهر الستة الماضية" />
      <div style={{ background: '#fafafa', borderRadius: 10, padding: '6px 4px' }}>
        <ReactApexChart
          type="area"
          height={160}
          options={chartOptions}
          series={chartSeries}
        />
      </div>

      {/* ── Reading history timeline ── */}
      <SectionHead icon={<ClockCircleOutlined />} title="سجل القراءات" />
      <Timeline
        style={{ marginTop: 4, paddingRight: 4 }}
        items={readingTimeline.map((r, i) => ({
          dot: r.dot,
          color: i === 0 ? PRIMARY : '#d9d9d9',
          children: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
              <div>
                <Text strong style={{ fontSize: 12 }}>{r.value.toLocaleString()} م³</Text>
                <Text type="secondary" style={{ fontSize: 11, marginInlineStart: 6 }}>({r.label})</Text>
              </div>
              <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>استهلاك: {r.usage} م³</Tag>
            </div>
          ),
        }))}
      />

      {/* ── Actions footer ── */}
      <Divider style={{ margin: '16px 0 12px' }} />
      <Row gutter={8}>
        <Col span={12}>
          <Button block icon={<EditOutlined />} style={{ borderRadius: 8 }}>
            تسجيل قراءة
          </Button>
        </Col>
        <Col span={12}>
          <Button block type="primary" icon={<ToolOutlined />}
            danger={isFault}
            style={{ borderRadius: 8, background: isFault ? undefined : PRIMARY, borderColor: isFault ? undefined : PRIMARY }}>
            {isFault ? 'طلب صيانة' : 'تقرير الاستهلاك'}
          </Button>
        </Col>
      </Row>
    </Drawer>
  );
};


export default MeterDetailDrawer;
