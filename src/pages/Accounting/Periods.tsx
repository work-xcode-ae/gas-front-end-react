import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Select, Popconfirm, Alert, Empty, Modal, message } from 'antd';
import { LockOutlined, UnlockOutlined, CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

export default function Periods() {
  const { can } = useAuth();
  const canClose = can('accounting.close_period');
  const [year, setYear] = useState(dayjs().year());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const load = (y = year) => { setLoading(true); api<any>('/fiscal-periods/summary', { query: { year: y } }).then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false)); };
  useEffect(() => { load(year); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (path: string, ok: string) => { try { await api(path, { method: 'POST' }); message.success(ok); load(); } catch (e) { message.error(errorMessage(e), 8); } };
  const close = (p: any) => {
    if (p.drafts > 0) {
      Modal.warning({ title: 'لا يمكن إقفال الفترة', content: `توجد ${p.drafts} قيود مسودة في هذه الفترة. رحّلها أو احذفها أولاً.` });
      return;
    }
    Modal.confirm({ title: `إقفال الفترة ${p.year}/${String(p.periodNo).padStart(2, '0')}؟`, content: 'لن يُسمح بالترحيل بتاريخ داخل فترة مقفلة حتى يُعاد فتحها.', okText: 'إقفال', cancelText: 'إلغاء',
      onOk: () => act(`/fiscal-periods/${p.id}/close`, 'تم إقفال الفترة') });
  };
  const years = Array.from(new Set([...(data?.years ?? []), dayjs().year(), dayjs().year() + 1, year])).sort();
  const periods: any[] = data?.periods ?? [];

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select value={year} onChange={setYear} style={{ width: 120 }} options={years.map(y => ({ value: y, label: String(y) }))} />
        <Button icon={<ReloadOutlined />} onClick={() => load()} />
        {canClose && periods.length < 12 && <Popconfirm title={`إنشاء الفترات الشهرية لسنة ${year}؟`} okText="إنشاء" cancelText="إلغاء" onConfirm={() => act(`/fiscal-periods/generate/${year}`, 'تم إنشاء الفترات')}>
          <Button type="primary" icon={<CalendarOutlined />}>إنشاء فترات {year}</Button></Popconfirm>}
      </Space>
      {!canClose && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="إقفال وفتح الفترات يتطلب صلاحية accounting.close_period." />}
      {periods.length === 0 && !loading ? <Empty description={`لا توجد فترات لسنة ${year}`} /> :
        <Table size="small" rowKey="id" loading={loading} dataSource={periods} pagination={false}
          columns={[
            { title: 'الفترة', key: 'p', width: 100, render: (_, p: any) => <b>{p.year}/{String(p.periodNo).padStart(2, '0')}</b> },
            { title: 'من', dataIndex: 'startDate', width: 110 }, { title: 'إلى', dataIndex: 'endDate', width: 110 },
            { title: 'القيود', dataIndex: 'journals', width: 80 },
            { title: 'مسودات', dataIndex: 'drafts', width: 90, render: v => v ? <Tag color="gold">{v}</Tag> : '—' },
            { title: 'الحالة', dataIndex: 'isClosed', width: 100, render: v => v ? <Tag icon={<LockOutlined />} color="red">مقفلة</Tag> : <Tag color="green">مفتوحة</Tag> },
            { title: '', key: 'a', render: (_, p: any) => !canClose ? null : p.isClosed
              ? <Popconfirm title="إعادة فتح الفترة؟ سيُسمح بالترحيل فيها مجدداً." okText="فتح" cancelText="إلغاء" onConfirm={() => act(`/fiscal-periods/${p.id}/reopen`, 'تم فتح الفترة')}>
                  <Button size="small" icon={<UnlockOutlined />}>إعادة فتح</Button></Popconfirm>
              : <Button size="small" danger icon={<LockOutlined />} onClick={() => close(p)}>إقفال</Button> },
          ]} />}
    </div>
  );
}
