import React from 'react';
import { Tabs } from 'antd';
import { FileDoneOutlined, ShoppingCartOutlined, ArrowDownOutlined, ArrowUpOutlined, ProfileOutlined, CalendarOutlined, BankOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { PRIMARY, DARK, GOLD } from './shared';
import SalesInvoices from './SalesInvoices';
import PurchaseBills from './PurchaseBills';
import Vouchers from './Vouchers';
import Statement from './Statement';
import CashflowCalendar from './Calendar';
import Banking from './Banking';
import { useAuth } from '../../auth/AuthContext';

export { InvoiceDrawer } from './SalesInvoices';
export type { InvoiceRow } from './SalesInvoices';

/** One finance page: sales invoices, purchase bills, receipt / payment vouchers and the statement of account. */
const InvoicesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  const tab = params.get('tab') ?? 'sales';
  const partyType = params.get('partyType') as 'customer' | 'supplier' | 'account' | null;
  const partyId = Number(params.get('id')) || undefined;
  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileDoneOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>الفواتير والسندات</div>
          <div style={{ color: 'rgba(255,255,255,.72)', fontSize: 12.5 }}>فواتير المبيعات والمشتريات، السندات، كشوف الحسابات، تقويم الدفعات والبنوك</div>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 14, padding: '4px 16px 16px' }}>
        <Tabs activeKey={tab} onChange={k => setParams({ tab: k })} destroyInactiveTabPane items={[
          { key: 'sales', label: <span><FileDoneOutlined /> فواتير المبيعات</span>, children: <SalesInvoices embedded /> },
          { key: 'purchases', label: <span><ShoppingCartOutlined /> فواتير المشتريات</span>, children: <PurchaseBills /> },
          { key: 'receipts', label: <span style={{ color: PRIMARY }}><ArrowDownOutlined /> سندات القبض</span>, children: <Vouchers type="receipt" /> },
          { key: 'payments', label: <span style={{ color: '#d46b08' }}><ArrowUpOutlined /> سندات الصرف</span>, children: <Vouchers type="payment" /> },
          { key: 'statement', label: <span><ProfileOutlined /> كشف حساب</span>,
            children: <Statement initial={partyType && partyId ? { partyType, id: partyId } : undefined} /> },
          { key: 'calendar', label: <span><CalendarOutlined /> تقويم الدفعات والتدفق النقدي</span>, children: <CashflowCalendar /> },
          ...(can('accounting.view') ? [{ key: 'banking', label: <span><BankOutlined /> البنوك والصندوق</span>, children: <Banking /> }] : []),
        ]} />
      </div>
    </div>
  );
};

export default InvoicesPage;
