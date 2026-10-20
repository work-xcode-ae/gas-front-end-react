import { useState } from 'react';
import { Tabs, Result } from 'antd';
import { ApartmentOutlined, BookOutlined, BarChartOutlined, FlagOutlined, CalendarOutlined, SettingOutlined, LinkOutlined, PercentageOutlined } from '@ant-design/icons';
import { useAuth } from '../../auth/AuthContext';
import { DARK, GOLD, PRIMARY } from './shared';
import ChartOfAccounts from './ChartOfAccounts';
import Mappings from './Mappings';
import Journals from './Journals';
import Reports from './Reports';
import OpeningBalances from './OpeningBalances';
import Periods from './Periods';
import Settings from './Settings';
import TaxRates from './TaxRates';

/** Accounting module: chart of accounts, journals (with approval), financial reports, opening balances, fiscal periods. */
export default function AccountingPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('coa');
  const [ledger, setLedger] = useState<number>();
  if (!can('accounting.view')) return <Result status="403" title="لا تملك صلاحية عرض المحاسبة" />;
  const items = [
    { key: 'coa', label: <span><ApartmentOutlined /> دليل الحسابات</span>, children: <ChartOfAccounts onOpenLedger={id => { setLedger(id); setTab('reports'); }} /> },
    { key: 'journals', label: <span><BookOutlined /> القيود</span>, children: <Journals /> },
    { key: 'reports', label: <span><BarChartOutlined /> التقارير المالية</span>, children: <Reports ledgerAccountId={ledger} /> },
    { key: 'opening', label: <span><FlagOutlined /> الأرصدة الافتتاحية</span>, children: <OpeningBalances /> },
    { key: 'periods', label: <span><CalendarOutlined /> الفترات المالية</span>, children: <Periods /> },
    { key: 'tax', label: <span><PercentageOutlined /> الضرائب</span>, children: <TaxRates /> },
    { key: 'mappings', label: <span><LinkOutlined /> ربط الحسابات</span>, children: <Mappings /> },
    ...(can('accounting.manage') ? [{ key: 'settings', label: <span><SettingOutlined /> الإعدادات</span>, children: <Settings /> }] : []),
  ];
  return (
    <div dir="rtl">
      <div className="no-print" style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${DARK})`, borderRadius: 14, padding: '16px 20px', marginBottom: 12, color: '#fff', borderBottom: `3px solid ${GOLD}` }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>المحاسبة العامة</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>دليل الحسابات · القيود والاعتماد · ميزان المراجعة · القوائم المالية · الأرصدة الافتتاحية · إقفال الفترات</div>
      </div>
      <Tabs activeKey={tab} onChange={setTab} items={items} destroyOnHidden={false} />
    </div>
  );
}
