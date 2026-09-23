import React from 'react';
import { Row, Col, Card, Table, Tag, Button, Typography, Space, List, Badge } from 'antd';
import {
  BankOutlined, AppstoreOutlined, TeamOutlined, FileDoneOutlined,
  DollarOutlined, WarningOutlined, FileAddOutlined,
  DashboardOutlined, UserAddOutlined, ToolOutlined, PlusCircleOutlined,
  BellOutlined, FireOutlined, DatabaseOutlined, CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const revenueChart = {
    series: [{ name: isRTL ? 'الإيرادات' : 'Revenue', data: [38000, 52000, 61000, 67000, 74000, 83000] }],
    options: {
      chart: { type: 'area' as const, toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#1a5c2a'],
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      stroke: { curve: 'smooth' as const, width: 3 },
      xaxis: { categories: [t('months.nov'), t('months.dec'), t('months.jan'), t('months.feb'), t('months.mar'), t('months.apr')] },
      yaxis: { labels: { formatter: (v: number) => v.toLocaleString() } },
      grid: { borderColor: '#f0f0f0' },
      tooltip: { theme: 'light' as 'light' | 'dark' },
    },
  };

  const invoicesChart = {
    series: [
      { name: t('charts.invoices'), data: [620, 710, 680, 750, 800, 870] },
      { name: t('charts.collected'), data: [390, 480, 510, 580, 710, 820] },
    ],
    options: {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#1a5c2a', '#c9a84c'],
      xaxis: { categories: [t('months.nov'), t('months.dec'), t('months.jan'), t('months.feb'), t('months.mar'), t('months.apr')] },
      legend: { position: 'top' as const },
      grid: { borderColor: '#f0f0f0' },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    },
  };

  const contractsChart = {
    series: [620, 122, 78, 42],
    options: {
      chart: { type: 'donut' as const, fontFamily: 'inherit' },
      colors: ['#1a5c2a', '#c9a84c', '#ff4d4f', '#d9d9d9'],
      labels: [t('contracts.active'), t('contracts.expiringSoon'), t('contracts.expired'), t('contracts.suspended')],
      legend: { position: 'bottom' as const },
      plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: t('contracts.total'), fontSize: '12px' } } } } },
    },
  };

  const invoiceColumns = [
    { title: t('tables.invoiceNo'), dataIndex: 'no', key: 'no', render: (v: string) => <Text style={{ color: '#1a5c2a', fontWeight: 600 }}>{v}</Text> },
    { title: t('tables.customer'), dataIndex: 'customer', key: 'customer' },
    { title: t('tables.building'), dataIndex: 'building', key: 'building' },
    { title: t('tables.amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => <Text strong>{v}</Text> },
    { title: t('tables.status'), dataIndex: 'status', key: 'status', render: (v: string) => {
      const map: Record<string, { color: string; label: string }> = {
        paid: { color: 'success', label: t('tables.paid') },
        unpaid: { color: 'error', label: t('tables.unpaid') },
        late: { color: 'warning', label: t('tables.late') },
      };
      return <Tag color={map[v]?.color}>{map[v]?.label}</Tag>;
    }},
  ];

  const invoiceData = [
    { key: 1, no: 'INV-2025-001', customer: isRTL ? 'سالم علي' : 'Salem Ali', building: isRTL ? 'مبنى 12 شقة 3' : 'Bldg 12 Unit 3', amount: 450, status: 'paid' },
    { key: 2, no: 'INV-2025-002', customer: isRTL ? 'أحمد خميس' : 'Ahmed Khamis', building: isRTL ? 'مبنى 5 شقة 1' : 'Bldg 5 Unit 1', amount: 320, status: 'unpaid' },
    { key: 3, no: 'INV-2025-003', customer: isRTL ? 'فاطمة النعيمي' : 'Fatima Al Nuaimi', building: isRTL ? 'مبنى 8 شقة 12' : 'Bldg 8 Unit 12', amount: 280, status: 'paid' },
    { key: 4, no: 'INV-2025-004', customer: isRTL ? 'محمد راشد' : 'Mohammed Rashed', building: isRTL ? 'مبنى 21 شقة 5' : 'Bldg 21 Unit 5', amount: 510, status: 'late' },
    { key: 5, no: 'INV-2025-005', customer: isRTL ? 'خالد البلوشي' : 'Khalid Al Balushi', building: isRTL ? 'مبنى 3 شقة 2' : 'Bldg 3 Unit 2', amount: 390, status: 'paid' },
  ];

  const meterColumns = [
    { title: t('tables.date'), dataIndex: 'date', key: 'date' },
    { title: t('tables.building'), dataIndex: 'building', key: 'building' },
    { title: t('tables.currentReading'), dataIndex: 'current', key: 'current' },
    { title: t('tables.previousReading'), dataIndex: 'previous', key: 'previous' },
    { title: t('tables.consumption'), dataIndex: 'consumption', key: 'consumption', render: (v: number) => <Tag color="blue">{v}</Tag> },
  ];

  const meterData = [
    { key: 1, date: '2025-04-16', building: isRTL ? 'مبنى 12 شقة 3' : 'Bldg 12 Unit 3', current: 1285, previous: 1234, consumption: 51 },
    { key: 2, date: '2025-04-16', building: isRTL ? 'مبنى 5 شقة 1' : 'Bldg 5 Unit 1', current: 985, previous: 950, consumption: 35 },
    { key: 3, date: '2025-04-15', building: isRTL ? 'مبنى 8 شقة 12' : 'Bldg 8 Unit 12', current: 760, previous: 700, consumption: 60 },
    { key: 4, date: '2025-04-15', building: isRTL ? 'مبنى 21 شقة 5' : 'Bldg 21 Unit 5', current: 453, previous: 400, consumption: 53 },
    { key: 5, date: '2025-04-14', building: isRTL ? 'مبنى 3 شقة 2' : 'Bldg 3 Unit 2', current: 612, previous: 580, consumption: 32 },
  ];

  const serviceColumns = [
    { title: t('tables.requestNo'), dataIndex: 'no', key: 'no', render: (v: string) => <Text style={{ color: '#1a5c2a' }}>{v}</Text> },
    { title: t('tables.type'), dataIndex: 'type', key: 'type' },
    { title: t('tables.location'), dataIndex: 'location', key: 'location' },
    { title: t('tables.status'), dataIndex: 'status', key: 'status', render: (v: string) => {
      const map: Record<string, { color: string; label: string }> = {
        new: { color: 'blue', label: t('tables.new') },
        inProgress: { color: 'orange', label: t('tables.inProgress') },
        completed: { color: 'success', label: t('tables.completed') },
        suspended: { color: 'default', label: t('tables.suspended') },
      };
      return <Tag color={map[v]?.color}>{map[v]?.label}</Tag>;
    }},
  ];

  const serviceData = [
    { key: 1, no: 'SR-2025-101', type: isRTL ? 'توصيل غاز' : 'Gas Connection', location: isRTL ? 'مبنى 5' : 'Bldg 5', status: 'new' },
    { key: 2, no: 'SR-2025-102', type: isRTL ? 'صيانة دورية' : 'Periodic Maintenance', location: isRTL ? 'مبنى 12' : 'Bldg 12', status: 'inProgress' },
    { key: 3, no: 'SR-2025-103', type: isRTL ? 'بلاغ تسرب' : 'Leak Report', location: isRTL ? 'مبنى 8' : 'Bldg 8', status: 'completed' },
    { key: 4, no: 'SR-2025-104', type: isRTL ? 'فصل خدمة' : 'Service Disconnect', location: isRTL ? 'مبنى 21' : 'Bldg 21', status: 'suspended' },
    { key: 5, no: 'SR-2025-105', type: isRTL ? 'صيانة طارئة' : 'Emergency Maintenance', location: isRTL ? 'مبنى 3' : 'Bldg 3', status: 'new' },
  ];

  const kpis = [
    { title: t('kpi.buildings'), value: 186, suffix: isRTL ? 'مبنى' : '', icon: <BankOutlined />, color: '#1a5c2a', bg: '#e8f5e9' },
    { title: t('kpi.apartments'), value: 2356, suffix: isRTL ? 'شقة' : '', icon: <AppstoreOutlined />, color: '#1565c0', bg: '#e3f2fd' },
    { title: t('kpi.activeCustomers'), value: 1248, suffix: isRTL ? 'عميل' : '', icon: <TeamOutlined />, color: '#6a1b9a', bg: '#f3e5f5' },
    { title: t('kpi.totalInvoices'), value: 528000, prefix: isRTL ? 'د.إ' : 'AED', suffix: '+8%', icon: <FileDoneOutlined />, color: '#00695c', bg: '#e0f2f1' },
    { title: t('kpi.collected'), value: 342580, prefix: isRTL ? 'د.إ' : 'AED', suffix: '+12%', icon: <DollarOutlined />, color: '#c9a84c', bg: '#fff8e1' },
    { title: t('kpi.overdue'), value: 185420, prefix: isRTL ? 'د.إ' : 'AED', suffix: isRTL ? '214 عميل' : '214 clients', icon: <WarningOutlined />, color: '#c62828', bg: '#ffebee' },
  ];

  const quickActions = [
    { icon: <FileAddOutlined />, label: t('quickActions.newInvoice'), color: '#1a5c2a' },
    { icon: <DashboardOutlined />, label: t('quickActions.meterReading'), color: '#1565c0' },
    { icon: <UserAddOutlined />, label: t('quickActions.newCustomer'), color: '#6a1b9a' },
    { icon: <ToolOutlined />, label: t('quickActions.newMaintenance'), color: '#00695c' },
    { icon: <PlusCircleOutlined />, label: t('quickActions.newGasContract'), color: '#c9a84c' },
    { icon: <BankOutlined />, label: t('quickActions.newBuilding'), color: '#c62828' },
  ];

  const notifications = [
    { color: '#ff4d4f', text: isRTL ? `14 ${t('notifications.expiringContracts')}` : `14 ${t('notifications.expiringContracts')}` },
    { color: '#fa8c16', text: isRTL ? `32 ${t('notifications.overdueInvoices')}` : `32 ${t('notifications.overdueInvoices')}` },
    { color: '#fadb14', text: isRTL ? `18 ${t('notifications.unreadMeters')}` : `18 ${t('notifications.unreadMeters')}` },
    { color: '#52c41a', text: isRTL ? `5 ${t('notifications.newServiceRequests')}` : `5 ${t('notifications.newServiceRequests')}` },
  ];

  // ── Gas Refill Requests — dashboard data ──────────────────────────
  const refillRequests = [
    { key: 1, id: 'RFR-2026-0101', building: 'برج السلام', tank: 'خزان LPG 2', levelPct: 24, qty: 3500, unit: 'لتر', supplier: 'EMGAS', priority: 'high', status: 'pending',   date: '2026-09-18' },
    { key: 2, id: 'RFR-2026-0098', building: 'مجمع النخيل', tank: 'خزان LPG 1', levelPct: 18, qty: 4000, unit: 'لتر', supplier: 'EMGAS', priority: 'urgent', status: 'approved', date: '2026-09-17' },
    { key: 3, id: 'RFR-2026-0095', building: 'برج الكورنيش', tank: 'خزان غاز طبيعي', levelPct: 15, qty: 1500, unit: 'م³', supplier: 'ADNOC Gas', priority: 'urgent', status: 'approved', date: '2026-09-16' },
    { key: 4, id: 'RFR-2026-0089', building: 'برج السلام', tank: 'خزان LPG 1', levelPct: 75, qty: 1000, unit: 'لتر', supplier: 'EMGAS', priority: 'medium', status: 'approved', date: '2026-09-10' },
    { key: 5, id: 'RFR-2026-0074', building: 'مجمع الياسمين', tank: 'خزان LPG 2', levelPct: 24, qty: 3500, unit: 'لتر', supplier: 'EMGAS', priority: 'high', status: 'completed', date: '2026-09-03' },
  ];

  const refillPriorityMap: Record<string, { color: string; label: string }> = {
    low: { color: 'default', label: 'منخفض' },
    medium: { color: 'blue', label: 'متوسط' },
    high: { color: 'orange', label: 'عالي' },
    urgent: { color: 'red', label: 'عاجل' },
  };

  const refillStatusColors: Record<string, { color: string; label: string }> = {
    pending:   { color: 'orange', label: 'معلق' },
    approved:  { color: 'blue',   label: 'موافق عليه' },
    completed: { color: 'green',  label: 'مكتمل' },
    rejected:  { color: 'red',    label: 'مرفوض' },
  };

  // Monthly refill volumes per building (last 6 months)
  const refillChartData = {
    series: [
      { name: 'برج السلام',   data: [4000, 0, 3500, 0, 4000, 3500] },
      { name: 'مجمع النخيل',  data: [0, 3800, 0, 3800, 0, 4000] },
      { name: 'برج الكورنيش', data: [1400, 0, 0, 1350, 0, 1500] },
      { name: 'مجمع الياسمين', data: [3500, 0, 3500, 0, 3800, 3500] },
    ],
    options: {
      chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: 'inherit', stacked: false },
      colors: ['#1a5c2a', '#c9a84c', '#1677ff', '#fa8c16'],
      xaxis: { categories: ['أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'] },
      yaxis: { title: { text: 'لتر / م³' } },
      legend: { position: 'top' as const },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '65%' } },
      grid: { borderColor: '#f0f0f0' },
      tooltip: { theme: 'light' as 'light' | 'dark', y: { formatter: (v: number) => `${v.toLocaleString()}` } },
    },
  };

  return (
    <div style={{ padding: 20 }}>
      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <Col xs={24} sm={12} md={8} lg={4} key={i}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: k.color, flexShrink: 0 }}>
                  {k.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{k.title}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1.2 }}>
                    {k.prefix && <span style={{ fontSize: 11, marginInlineEnd: 2 }}>{k.prefix}</span>}
                    {typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
                  </div>
                  {k.suffix && <div style={{ fontSize: 11, color: '#aaa' }}>{k.suffix}</div>}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={10}>
          <Card title={<Text strong>{t('charts.revenueTitle')}</Text>} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: '8px 16px 16px' }}>
            <ReactApexChart options={revenueChart.options} series={revenueChart.series} type="area" height={220} />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title={<Text strong>{t('charts.invoicesTitle')}</Text>} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: '8px 16px 16px' }}>
            <ReactApexChart options={invoicesChart.options} series={invoicesChart.series} type="bar" height={220} />
          </Card>
        </Col>
        <Col xs={24} lg={5}>
          <Card title={<Text strong>{t('charts.contractsTitle')}</Text>} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: '8px 8px 16px' }}>
            <ReactApexChart options={contractsChart.options} series={contractsChart.series} type="donut" height={220} />
          </Card>
        </Col>
      </Row>

      {/* Tables Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={10}>
          <Card
            title={<Text strong>{t('tables.recentInvoices')}</Text>}
            extra={<Button type="link" style={{ color: '#1a5c2a', padding: 0 }}>{t('tables.viewAll')}</Button>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table dataSource={invoiceData} columns={invoiceColumns} pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<Text strong>{t('tables.recentReadings')}</Text>}
            extra={<Button type="link" style={{ color: '#1a5c2a', padding: 0 }}>{t('tables.viewAll')}</Button>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table dataSource={meterData} columns={meterColumns} pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card
            title={<Text strong>{t('tables.serviceRequests')}</Text>}
            extra={<Button type="link" style={{ color: '#1a5c2a', padding: 0 }}>{t('tables.viewAll')}</Button>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table dataSource={serviceData} columns={serviceColumns} pagination={false} size="small" />
          </Card>
        </Col>
      </Row>

      {/* Gas Refill Requests Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Refill KPIs */}
        <Col xs={24} lg={5}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
            {[
              { label: 'طلبات معلقة', value: 1, color: '#fa8c16', bg: '#fff7e6', icon: <ClockCircleOutlined /> },
              { label: 'تحتاج موافقة', value: 3, color: '#1677ff', bg: '#e6f4ff', icon: <DatabaseOutlined /> },
              { label: 'مكتملة هذا الشهر', value: 2, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
              { label: 'مبانٍ مستوى منخفض', value: 3, color: '#ff4d4f', bg: '#fff1f0', icon: <FireOutlined /> },
            ].map((s, i) => (
              <Card key={i} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 20, color: s.color }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Col>

        {/* Refill Chart */}
        <Col xs={24} lg={11}>
          <Card
            title={<span><FireOutlined style={{ color: '#fa8c16', marginInlineEnd: 6 }} /><Text strong>كميات التعبئة بالمبنى (آخر 6 أشهر)</Text></span>}
            extra={<Button type="link" style={{ color: '#1a5c2a', padding: 0 }}>عرض التفاصيل</Button>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none', height: '100%' }}
            bodyStyle={{ padding: '8px 16px 16px' }}
          >
            <ReactApexChart options={refillChartData.options} series={refillChartData.series} type="bar" height={230} />
          </Card>
        </Col>

        {/* Pending Refill Requests Table */}
        <Col xs={24} lg={8}>
          <Card
            title={<span><FireOutlined style={{ color: '#fa8c16', marginInlineEnd: 6 }} /><Text strong>طلبات التعبئة الأخيرة</Text></span>}
            extra={<Button type="link" style={{ color: '#1a5c2a', padding: 0 }}>عرض الكل</Button>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none', height: '100%' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={refillRequests} rowKey="key" size="small" pagination={false}
              columns={[
                { title: 'المبنى', dataIndex: 'building', render: (v: string, r: any) => (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600 }}>{v}</Text>
                    <div style={{ fontSize: 11, color: '#888' }}>{r.tank}</div>
                  </div>
                )},
                { title: 'المستوى', dataIndex: 'levelPct', render: (v: number) => (
                  <div style={{ width: 56 }}>
                    <div style={{ fontSize: 11, textAlign: 'center', color: v < 25 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v}%</div>
                    <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                      <div style={{ height: 5, borderRadius: 3, width: `${v}%`, background: v < 25 ? '#ff4d4f' : v < 50 ? '#fa8c16' : '#52c41a' }} />
                    </div>
                  </div>
                )},
                { title: 'الأولوية', dataIndex: 'priority', render: (v: string) => <Tag color={refillPriorityMap[v]?.color} style={{ fontSize: 10 }}>{refillPriorityMap[v]?.label}</Tag> },
                { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={refillStatusColors[v]?.color} style={{ fontSize: 10 }}>{refillStatusColors[v]?.label}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions + Notifications */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title={<Text strong>{t('quickActions.title')}</Text>} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}>
            <Row gutter={[12, 12]}>
              {quickActions.map((a, i) => (
                <Col xs={12} sm={8} md={4} key={i}>
                  <Button
                    style={{ width: '100%', height: 72, borderRadius: 10, borderColor: a.color, color: a.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    icon={a.icon as React.ReactElement}
                  >
                    <span style={{ fontSize: 11, whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.3 }}>{a.label}</span>
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<Space><BellOutlined style={{ color: '#ff4d4f' }} /><Text strong style={{ color: '#ff4d4f' }}>{t('notifications.title')}</Text></Space>}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}
          >
            <List
              dataSource={notifications}
              renderItem={item => (
                <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <Space>
                    <Badge color={item.color} />
                    <Text style={{ fontSize: 13 }}>{item.text}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
