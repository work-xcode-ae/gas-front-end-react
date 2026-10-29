import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Typography, Button, Table, Timeline, Progress, Empty, Alert } from 'antd';
import {
  HomeOutlined, FireOutlined, BellOutlined, DollarOutlined, ToolOutlined, WarningOutlined, DatabaseOutlined, SafetyCertificateOutlined,
  FileProtectOutlined, PlusOutlined,
} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import dayjs from 'dayjs';
import { api, type Paged } from '../../api/client';
import { premisesApi, type PremisesRefillRow } from '../../api/premises';
import { PRIMARY, litres, d10 } from './forms';

const { Text } = Typography;
const ACTIVITY_COLOR: Record<string, string> = { create: 'green', delete: 'red', status_change: 'blue', update: 'blue', invoice: 'purple', payment: 'green', fees: 'orange', report: 'cyan' };
const LOW_PCT = 25;
const lvlColor = (p: number) => (p < LOW_PCT ? '#c62828' : p < 50 ? '#fa8c16' : '#52c41a');

/**
 * «نظرة عامة» of a villa — the layout of the building overview (BuildingOverviewLive), with the villa's own content:
 * tank level instead of occupancy, refills instead of meter consumption, the tanks instead of the units,
 * and the contracts (gas supply + AMC) instead of the occupancy details.
 */
export default function VillaOverview({ villaId, buildingId, live, reloadKey, onGoTo }: {
  villaId: number; buildingId: number; live: any; reloadKey?: number; onGoTo: (tab: string) => void;
}) {
  const [site, setSite] = useState<any>(null);
  const [refills, setRefills] = useState<PremisesRefillRow[]>([]);
  const [amcs, setAmcs] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [fin, setFin] = useState<{ month: number; balance: number; overdue: number } | null>(null);

  useEffect(() => {
    premisesApi.get(villaId).then(setSite).catch(() => setSite(null));
    premisesApi.refills({ premisesId: villaId }).then(setRefills).catch(() => setRefills([]));
    api<Paged<any>>('/amc-contracts', { query: { buildingId, pageSize: 0 } }).then(r => setAmcs(r.items)).catch(() => setAmcs([]));
    api<Paged<any>>(`/buildings/${buildingId}/activity`, { query: { pageSize: 6 } }).then(r => setActivity(r.items)).catch(() => setActivity([]));
    api<Paged<any>>('/invoices', { query: { buildingId, pageSize: 0 } }).then(r => {
      const m0 = dayjs().startOf('month');
      const valid = r.items.filter((i: any) => i.status !== 'cancelled' && i.status !== 'draft');
      setFin({
        month: valid.filter((i: any) => !dayjs(i.date).isBefore(m0)).reduce((s: number, i: any) => s + Number(i.amount), 0),
        balance: valid.reduce((s: number, i: any) => s + Number(i.balance), 0),
        overdue: valid.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.balance), 0),
      });
    }).catch(() => setFin(null));
  }, [villaId, buildingId, reloadKey]);

  const st = live?.stats ?? {};
  const tanks: any[] = useMemo(() => (site?.tanks ?? []).map((t: any) => ({ ...(t.tank ?? t), openRequest: t.openRequest })), [site]);
  const cap = tanks.reduce((s, t) => s + Number(t.capacityLitres ?? 0), 0);
  const cur = tanks.reduce((s, t) => s + Number(t.currentLevel ?? 0), 0);
  const levelPct = cap > 0 ? Math.round(cur * 100 / cap) : (st.tankLevelPct ?? null);

  // refills delivered per month (last 6 months)
  const months = useMemo(() => {
    const list = Array.from({ length: 6 }, (_, i) => dayjs().startOf('month').subtract(5 - i, 'month'));
    return list.map(m => {
      const rows = refills.filter(r => r.deliveredAt && dayjs(r.deliveredAt).isSame(m, 'month'));
      return { month: m.format('YYYY-MM'), litres: rows.reduce((s, r) => s + Number(r.deliveredLitres ?? 0), 0), count: rows.length };
    });
  }, [refills]);
  const anyRefill = months.some(m => m.count > 0);

  const today = dayjs();
  const gas = (site?.contracts ?? []).find((c: any) => c.status === 'active');
  const amc = amcs.find(a => a.status === 'active' && !dayjs(a.startDate).isAfter(today, 'day') && !dayjs(a.endDate).isBefore(today, 'day'));
  const span = (c: any) => {
    if (!c?.startDate || !c?.endDate) return { pct: 0, left: null as number | null };
    const total = Math.max(1, dayjs(c.endDate).diff(dayjs(c.startDate), 'day'));
    const done = Math.min(total, Math.max(0, today.diff(dayjs(c.startDate), 'day')));
    return { pct: Math.round(done * 100 / total), left: dayjs(c.endDate).diff(today, 'day') };
  };
  const ready = refills.filter(r => r.readyToInvoice).length;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={9}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><DatabaseOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />مستوى الخزان</Text>}>
              {levelPct == null ? <Empty description="لا توجد خزانات" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <ReactApexChart type="radialBar" height={190} series={[levelPct]}
                  options={{ chart: { type: 'radialBar', fontFamily: 'inherit' }, colors: [lvlColor(levelPct)],
                    plotOptions: { radialBar: { hollow: { size: '62%' }, track: { background: '#f0f0f0' },
                      dataLabels: { name: { show: true, offsetY: 18, fontSize: '12px', color: '#888' }, value: { offsetY: -12, fontSize: '22px', fontWeight: 700, formatter: (v: number) => `${Math.round(v)}%` } } } },
                    labels: [levelPct < LOW_PCT ? 'يحتاج تعبئة' : 'مستوى الخزان'] }} />
              )}
              <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: 600 }}>{litres(cur)}</Text><Text type="secondary" style={{ fontSize: 12 }}> من {litres(cap)}</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={15}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><FireOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />كميات التعبئة المورّدة (آخر 6 أشهر)</Text>}>
              {!anyRefill ? <Empty description="لا توجد تعبئات مورّدة بعد" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <ReactApexChart type="area" height={210}
                  series={[{ name: 'لتر', data: months.map(m => Math.round(m.litres)) }]}
                  options={{ chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' }, colors: [PRIMARY], stroke: { curve: 'smooth', width: 2 },
                    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } }, dataLabels: { enabled: false },
                    xaxis: { categories: months.map(m => m.month) }, tooltip: { y: { formatter: (v: number) => `${v.toLocaleString()} لتر` } } }} />
              )}
            </Card>
          </Col>
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><DatabaseOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />الخزانات ({tanks.length})</Text>}
          extra={<Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => onGoTo('tanks')}>إضافة / إدارة الخزانات</Button>}>
          <Table size="small" dataSource={tanks} rowKey="id" pagination={{ pageSize: 6, size: 'small' }} scroll={{ x: 700 }}
            locale={{ emptyText: 'لا توجد خزانات' }}
            columns={[
              { title: 'رقم الخزان', dataIndex: 'tankNo', width: 100, render: (v: string) => <Text strong style={{ color: PRIMARY }}>{v}</Text> },
              { title: 'نوع الغاز', dataIndex: 'gasType', width: 90, render: (v: string, t: any) => t.gasTypeName ?? v ?? '—' },
              { title: 'السعة', dataIndex: 'capacityLitres', width: 110, render: (v: number) => litres(v) },
              { title: 'المستوى', key: 'lvl', width: 200, render: (_: any, t: any) => <Progress percent={Math.round(Number(t.levelPct ?? 0))} size="small" strokeColor={lvlColor(Number(t.levelPct ?? 0))} /> },
              { title: 'الحالة', dataIndex: 'statusLabel', width: 100, render: (v: string, t: any) => <Tag color={t.status === 'ok' ? 'success' : t.status === 'low' ? 'warning' : 'default'}>{v ?? t.status ?? '—'}</Tag> },
              { title: 'طلب مفتوح', dataIndex: 'openRequest', render: (v: string | null) => v ? <Tag color="orange">{v}</Tag> : <Text type="secondary">—</Text> },
            ]} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { label: 'فواتير هذا الشهر', value: fin ? Math.round(fin.month).toLocaleString() : '—', unit: 'د.إ', color: PRIMARY, icon: <DollarOutlined />, tab: 'financials' },
            { label: 'طلبات خدمة مفتوحة', value: st.openServiceRequests ?? 0, unit: 'طلب', color: '#fa8c16', icon: <ToolOutlined />, tab: 'service' },
            { label: 'مستحقات غير مسددة', value: fin ? Math.round(fin.balance).toLocaleString() : '—', unit: 'د.إ', color: '#d4380d', icon: <WarningOutlined />, tab: 'financials' },
            { label: 'مستوى الخزان', value: levelPct != null ? `${levelPct}%` : '—', unit: ready > 0 ? `${ready} تعبئة جاهزة للفوترة` : levelPct != null && levelPct < LOW_PCT ? 'يحتاج تعبئة' : '', color: '#1677ff', icon: <DatabaseOutlined />, tab: 'tanks' },
          ].map((s, i) => (
            <Col span={12} key={i}>
              <Card size="small" bordered={false} hoverable onClick={() => onGoTo(s.tab)} style={{ borderRadius: 10, textAlign: 'center', background: '#fafafa' }}>
                <div style={{ color: s.color, fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{s.unit}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
        {st.civilDefense && (
          <Alert style={{ marginBottom: 16, borderRadius: 10 }} showIcon icon={<SafetyCertificateOutlined />}
            type={st.civilDefense.expiryDate && dayjs(st.civilDefense.expiryDate).diff(dayjs(), 'day') < 60 ? 'warning' : 'success'}
            message={<span>شهادة الدفاع المدني {st.civilDefense.certificateNo ?? ''} — تنتهي {st.civilDefense.expiryDate ?? '—'}</span>}
            action={<Button size="small" type="link" onClick={() => onGoTo('civildefense')}>عرض</Button>} />
        )}
        <Card size="small" bordered={false} style={{ borderRadius: 10, marginBottom: 16 }}
          title={<Text strong><FileProtectOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />حالة العقود</Text>}
          extra={<Button size="small" type="link" onClick={() => onGoTo('contracts')}>العقود</Button>}>
          {[
            { label: 'عقد توريد الغاز', c: gas, sub: gas ? `${gas.contractNo} · ${Number(gas.pricePerLitre).toLocaleString()} د.إ / لتر` : null, tab: 'villa' },
            { label: 'عقد الخدمة والصيانة (AMC)', c: amc, sub: amc ? `${amc.contractNo} · زيارات ${amc.visitsDone ?? 0} / ${amc.visitsTotal ?? 0}` : null, tab: 'contracts' },
          ].map(x => {
            const s = span(x.c);
            return (
              <div key={x.label} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => onGoTo(x.tab)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>{x.label}</Text>
                  {x.c ? <Tag color={s.left != null && s.left < 30 ? 'orange' : 'success'} style={{ margin: 0 }}>ساري حتى {d10(x.c.endDate)}</Tag>
                    : <Tag color="error" style={{ margin: 0 }}>لا يوجد عقد ساري</Tag>}
                </div>
                {x.c && <>
                  <Progress percent={s.pct} size="small" strokeColor={s.left != null && s.left < 30 ? '#fa8c16' : PRIMARY} showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 11 }}>{x.sub}{s.left != null ? ` · متبقٍ ${s.left} يوم` : ''}</Text>
                </>}
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <Text style={{ fontSize: 12 }}><HomeOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />التعبئات</Text>
            <Text style={{ fontSize: 12 }}>{refills.length} طلب · {refills.filter(r => r.invoiceNo).length} مفوترة · <Text type={ready ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>{ready} جاهزة</Text></Text>
          </div>
        </Card>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><BellOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />آخر النشاطات</Text>}
          extra={<Button size="small" type="link" onClick={() => onGoTo('activity')}>الكل</Button>}>
          {activity.length === 0 ? <Empty description="لا توجد نشاطات" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
            <Timeline style={{ marginTop: 8 }} items={activity.map(a => ({
              color: ACTIVITY_COLOR[a.action] ?? 'blue',
              children: <div><Text style={{ fontSize: 12 }}>{a.description}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{dayjs(a.occurredAt).format('YYYY-MM-DD HH:mm')}{a.user ? ` · ${a.user}` : ''}</Text></div>,
            }))} />
          )}
        </Card>
      </Col>
    </Row>
  );
}
