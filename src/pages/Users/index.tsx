import React from 'react';
import { Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import ModuleDashboard from '../../components/layout/ModuleDashboard';
import { useTranslation } from 'react-i18next';

const UsersPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const color = '#37474f';

  const kpis = [
    { title: isRTL ? 'الإجمالي' : 'Total', value: 248, color, bg: color + '22', icon: <UserOutlined /> },
    { title: isRTL ? 'نشط' : 'Active', value: 201, color: '#1565c0', bg: '#e3f2fd', icon: <UserOutlined /> },
    { title: isRTL ? 'هذا الشهر' : 'This Month', value: 32, color: '#00695c', bg: '#e0f2f1', icon: <UserOutlined /> },
    { title: isRTL ? 'قيد المراجعة' : 'Pending Review', value: 15, color: '#c62828', bg: '#ffebee', icon: <UserOutlined /> },
  ];

  const charts = [{
    title: isRTL ? 'الإحصائيات الشهرية' : 'Monthly Statistics',
    series: [{ name: isRTL ? 'الإجمالي' : 'Total', data: [42, 55, 61, 48, 70, 80] }],
    options: {
      chart: { type: 'area', toolbar: { show: false } }, colors: [color],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: isRTL ? ['نوفمبر','ديسمبر','يناير','فبراير','مارس','أبريل'] : ['Nov','Dec','Jan','Feb','Mar','Apr'] },
      grid: { borderColor: '#f0f0f0' },
    },
    type: 'area',
  }];

  const columns = [
    { title: isRTL ? 'الرقم' : 'No.', dataIndex: 'no', key: 'no' },
    { title: isRTL ? 'الاسم' : 'Name', dataIndex: 'name', key: 'name' },
    { title: isRTL ? 'التاريخ' : 'Date', dataIndex: 'date', key: 'date' },
    { title: isRTL ? 'الحالة' : 'Status', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={v === 'active' ? 'success' : v === 'pending' ? 'warning' : 'default'}>
        {v === 'active' ? (isRTL ? 'نشط' : 'Active') : v === 'pending' ? (isRTL ? 'قيد المراجعة' : 'Pending') : (isRTL ? 'منتهي' : 'Expired')}
      </Tag>
    },
  ];

  const data = [
    { key: 1, no: '001', name: isRTL ? 'السجل الأول' : 'Record One', date: '2025-04-16', status: 'active' },
    { key: 2, no: '002', name: isRTL ? 'السجل الثاني' : 'Record Two', date: '2025-04-15', status: 'pending' },
    { key: 3, no: '003', name: isRTL ? 'السجل الثالث' : 'Record Three', date: '2025-04-14', status: 'active' },
    { key: 4, no: '004', name: isRTL ? 'السجل الرابع' : 'Record Four', date: '2025-04-13', status: 'expired' },
    { key: 5, no: '005', name: isRTL ? 'السجل الخامس' : 'Record Five', date: '2025-04-12', status: 'active' },
  ];

  return <ModuleDashboard title={isRTL ? 'إدارة المستخدمين' : 'User Management'} icon={<UserOutlined />} color={color} kpis={kpis} charts={charts} tables={[{ title: isRTL ? 'السجلات الأخيرة' : 'Recent Records', columns, data }]} />;
};

export default UsersPage;
