import React from 'react';
import { Row, Col, Card, Table, Button, Typography } from 'antd';
import ReactApexChart from 'react-apexcharts';

const { Title, Text } = Typography;

interface KPI { title: string; value: string | number; color: string; bg: string; icon: React.ReactNode; sub?: string; }
interface ChartConfig { title: string; series: any[]; options: any; type: string; height?: number; }
interface TableConfig { title: string; columns: any[]; data: any[]; }

interface ModuleDashboardProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  kpis: KPI[];
  charts?: ChartConfig[];
  tables?: TableConfig[];
}

const ModuleDashboard: React.FC<ModuleDashboardProps> = ({ title, icon, color, kpis, charts = [], tables = [] }) => {
  return (
    <div style={{ padding: 20 }}>
      {/* Module Header */}
      <div style={{ marginBottom: 20, padding: '16px 20px', background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28, color: '#fff' }}>{icon}</div>
        <div>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>{title}</Title>
        </div>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: k.color }}>
                  {k.icon}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888' }}>{k.title}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
                  {k.sub && <div style={{ fontSize: 11, color: '#aaa' }}>{k.sub}</div>}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      {charts.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {charts.map((c, i) => (
            <Col xs={24} md={charts.length === 1 ? 24 : charts.length === 2 ? 12 : 8} key={i}>
              <Card title={<Text strong>{c.title}</Text>} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }} bodyStyle={{ padding: '8px 16px 16px' }}>
                <ReactApexChart options={c.options} series={c.series} type={c.type as any} height={c.height || 220} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Tables */}
      {tables.length > 0 && (
        <Row gutter={[16, 16]}>
          {tables.map((tb, i) => (
            <Col xs={24} md={tables.length === 1 ? 24 : 12} key={i}>
              <Card
                title={<Text strong>{tb.title}</Text>}
                extra={<Button type="link" style={{ color, padding: 0 }}>عرض الكل</Button>}
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: 'none' }}
                bodyStyle={{ padding: 0 }}
              >
                <Table dataSource={tb.data} columns={tb.columns} pagination={false} size="small" scroll={{ x: true }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default ModuleDashboard;
