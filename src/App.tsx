import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import './i18n';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Buildings from './pages/Buildings';
import ApartmentsPage from './pages/Apartments';
import CustomersPage from './pages/Customers';
import GasContractsPage from './pages/GasContracts';
import MaintenanceContractsPage from './pages/MaintenanceContracts';
import MetersPage from './pages/Meters';
import InvoicesPage from './pages/Invoices';
import PaymentsPage from './pages/Payments';
import OverduePage from './pages/Overdue';
import ServiceRequestsPage from './pages/ServiceRequests';
import MaintenancePage from './pages/Maintenance';
import ReportsPage from './pages/Reports';
import UsersPage from './pages/Users';
import SettingsPage from './pages/Settings';
import VehiclesPage from './pages/Vehicles';
import EmployeesPage from './pages/Employees';
import AssetsPage from './pages/Assets';

const AppContent: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <ConfigProvider
      locale={isRTL ? arEG : enUS}
      direction={isRTL ? 'rtl' : 'ltr'}
      theme={{
        token: {
          colorPrimary: '#1a5c2a',
          borderRadius: 8,
          fontFamily: isRTL ? "'Noto Sans Arabic', 'Cairo', sans-serif" : "'Inter', sans-serif",
        },
      }}
    >
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/buildings" element={<Buildings />} />
            <Route path="/apartments" element={<ApartmentsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/gas-contracts" element={<GasContractsPage />} />
            <Route path="/maintenance-contracts" element={<MaintenanceContractsPage />} />
            <Route path="/meters" element={<MetersPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/overdue" element={<OverduePage />} />
            <Route path="/service-requests" element={<ServiceRequestsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/assets" element={<AssetsPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  React.useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, []);
  return <AppContent />;
};

export default App;
