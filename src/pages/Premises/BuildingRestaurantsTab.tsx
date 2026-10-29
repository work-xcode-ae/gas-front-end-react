import { useCallback, useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Empty, Space, Alert, Progress, message } from 'antd';
import { PlusOutlined, ShopOutlined } from '@ant-design/icons';
import { errorMessage } from '../../api/client';
import { premisesApi, type PremisesListItem } from '../../api/premises';
import { useAuth } from '../../auth/AuthContext';
import { PremisesFormModal, PRIMARY, money, litres } from './forms';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

/**
 * «المطاعم» tab of a building profile (Restaurants & Villas module). Lists the building's restaurants and adds new ones.
 * Restaurant tanks are separate from the building's tanks and never change the building's tank figures.
 */
export default function BuildingRestaurantsTab({ buildingId, isVilla, onCount }: { buildingId: number; isVilla?: boolean; onCount?: (n: number) => void }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  // a restaurant opens in its own building-style profile (Restaurants page)
  const openRestaurant = (id: number) => navigate(`/restaurants?id=${id}`);
  const [rows, setRows] = useState<PremisesListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [key, setKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    premisesApi.list({ type: 'restaurant', buildingId, pageSize: 0 })
      .then(r => { setRows(r.items); onCount?.(r.total); })
      .catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, key]);

  if (isVilla) return <Alert type="info" showIcon message="هذا السجل فيلا — المطاعم تُضاف إلى المباني. بيانات الفيلا وعقدها وتعبئاتها في صفحة الفلل." />;
  return (
    <div>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }} wrap>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ShopOutlined /> لكل مطعم مالكه والمخولون بالتوقيع وخزانه الخاص، ويُفوتر لكل تعبئة حسب سعر اللتر في عقده. شهادة الدفاع المدني تبقى على مستوى المبنى.
        </Text>
        {can('buildings.manage') && <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY }} onClick={() => setFormOpen(true)}>إضافة مطعم</Button>}
      </Space>
      {rows.some(r => !r.contractNo && r.isActive) && <Alert type="warning" showIcon style={{ marginBottom: 10 }} message="بعض المطاعم بلا عقد توريد نشط — لا يمكن فوترة تعبئاتها حتى يُضاف العقد." />}
      <Table<PremisesListItem> rowKey="id" size="small" loading={loading} dataSource={rows} pagination={false}
        locale={{ emptyText: <Empty description="لا توجد مطاعم في هذا المبنى" /> }}
        onRow={r => ({ onClick: () => openRestaurant(r.id), style: { cursor: 'pointer', opacity: r.isActive ? 1 : 0.55 } })}
        columns={[
          { title: 'الرمز', dataIndex: 'code', render: v => <Text code>{v}</Text> },
          { title: 'المطعم', dataIndex: 'name', render: (v, r) => <div><Text strong>{v}</Text>{r.unitNo && <div style={{ fontSize: 11, color: '#888' }}>وحدة {r.unitNo}</div>}</div> },
          { title: 'المالك', dataIndex: 'owner' },
          { title: 'المخولون', dataIndex: 'signatories', render: v => v > 0 ? <Tag color="green">{v}</Tag> : <Tag color="red">0</Tag> },
          { title: 'الخزان', render: (_, r) => r.tanks > 0 ? <div style={{ minWidth: 120 }}><Progress percent={Number(r.levelPct ?? 0)} size="small" />
            <div style={{ fontSize: 11, color: '#888' }}>{litres(r.capacityLitres)}</div></div> : '—' },
          { title: 'سعر اللتر', dataIndex: 'pricePerLitre', render: (v, r) => r.contractNo ? Number(v).toLocaleString() : <Tag color="red">بلا عقد</Tag> },
          { title: 'جاهزة للفوترة', dataIndex: 'readyToInvoice', render: v => v > 0 ? <Tag color="orange">{v}</Tag> : '—' },
          { title: 'المفوتر', dataIndex: 'invoicedTotal', render: v => money(v) },
        ]} />
      <PremisesFormModal type="restaurant" buildingId={buildingId} open={formOpen} onClose={() => setFormOpen(false)}
        onSaved={id => { setFormOpen(false); setKey(k => k + 1); openRestaurant(id); }} />
    </div>
  );
}
