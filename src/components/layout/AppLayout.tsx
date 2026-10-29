import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Badge, Avatar, Input, Select, DatePicker, Dropdown } from 'antd';
import {
  HomeOutlined, BankOutlined, AppstoreOutlined, TeamOutlined,
  FileTextOutlined, ToolOutlined, DashboardOutlined, FileDoneOutlined, CarOutlined,
  DollarOutlined, WarningOutlined, CustomerServiceOutlined, ThunderboltOutlined,
  BarChartOutlined, UserOutlined, SettingOutlined, BellOutlined,
  GlobalOutlined, PlusOutlined, CalendarOutlined, RightOutlined
, CalculatorOutlined, ShopOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { track, installGlobalTracking } from '../../api/track';
import SessionsModal from '../SessionsModal';
import { GlobalFiltersProvider, useGlobalFilters } from '../../context/GlobalFilters';
import { useReference, locName } from '../../api/reference';

const { Sider, Content } = Layout;

interface AppLayoutProps { children: React.ReactNode; }

const SkylineSVG = () => (
  <svg viewBox="0 0 1200 120" preserveAspectRatio="none"
    style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '100%', opacity: 0.12 }}>
    <path d="M0,80 L30,80 L30,40 L40,40 L40,20 L45,20 L45,15 L50,15 L50,20 L55,20 L55,40 L65,40 L65,80
      L80,80 L80,50 L85,50 L85,30 L90,30 L90,25 L95,25 L95,30 L100,30 L100,50 L110,50 L110,80
      L130,80 L130,45 L135,45 L135,10 L138,10 L138,5 L142,5 L142,10 L145,10 L145,45 L150,45 L150,80
      L170,80 L170,55 L175,55 L175,35 L185,35 L185,55 L190,55 L190,80
      L210,80 L210,40 L215,40 L215,15 L218,15 L218,8 L222,8 L222,15 L225,15 L225,40 L230,40 L230,80
      L250,80 L250,50 L260,50 L260,30 L265,30 L265,20 L270,20 L270,30 L275,30 L275,50 L285,50 L285,80
      L300,80 L300,45 L310,45 L310,25 L315,25 L315,18 L320,18 L320,25 L325,25 L325,45 L335,45 L335,80
      L360,80 L360,55 L370,55 L370,38 L378,38 L378,30 L382,30 L382,38 L390,38 L390,55 L400,55 L400,80
      L420,80 L420,42 L425,42 L425,18 L428,18 L428,10 L432,10 L432,18 L435,18 L435,42 L440,42 L440,80
      L460,80 L460,52 L468,52 L468,35 L472,35 L472,25 L476,25 L476,35 L480,35 L480,52 L488,52 L488,80
      L510,80 L510,45 L518,45 L518,22 L522,22 L522,12 L526,12 L526,22 L530,22 L530,45 L538,45 L538,80
      L560,80 L560,58 L568,58 L568,40 L575,40 L575,80
      L590,80 L590,48 L598,48 L598,28 L602,28 L602,20 L608,20 L608,28 L612,28 L612,48 L620,48 L620,80
      L640,80 L640,55 L648,55 L648,38 L655,38 L655,80
      L670,80 L670,42 L678,42 L678,18 L682,18 L682,10 L686,10 L686,18 L690,18 L690,42 L698,42 L698,80
      L720,80 L720,50 L728,50 L728,32 L735,32 L735,80
      L750,80 L750,45 L758,45 L758,20 L762,20 L762,12 L766,12 L766,20 L770,20 L770,45 L778,45 L778,80
      L800,80 L800,60 L810,60 L810,42 L818,42 L818,80
      L840,80 L840,48 L848,48 L848,25 L852,25 L852,15 L858,15 L858,25 L862,25 L862,48 L870,48 L870,80
      L900,80 L900,55 L908,55 L908,38 L915,38 L915,80
      L935,80 L935,44 L942,44 L942,22 L946,22 L946,14 L950,14 L950,22 L954,22 L954,44 L961,44 L961,80
      L980,80 L980,52 L988,52 L988,35 L995,35 L995,80
      L1015,80 L1015,46 L1022,46 L1022,20 L1026,20 L1026,12 L1030,12 L1030,20 L1034,20 L1034,46 L1042,46 L1042,80
      L1060,80 L1060,58 L1068,58 L1068,40 L1075,40 L1075,80
      L1095,80 L1095,44 L1102,44 L1102,20 L1106,20 L1106,10 L1110,10 L1110,20 L1114,20 L1114,44 L1122,44 L1122,80
      L1140,80 L1140,55 L1150,55 L1150,38 L1160,38 L1160,80
      L1200,80 L1200,120 L0,120 Z"
      fill="#4a5c3a"/>
  </svg>
);

const AppLayoutInner: React.FC<AppLayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const filters = useGlobalFilters();
  const { data: ref } = useReference(i18n.language);
  const [searchText, setSearchText] = useState('');
  /** pages that apply the header filters today (the others still show sample data) */
  const FILTER_PAGES = ['/buildings'];
  const runSearch = (text: string) => {
    filters.submitSearch(text);
    if (text.trim() && !FILTER_PAGES.includes(location.pathname)) navigate('/buildings');
  };
  const quickAdd = {
    items: [
      { key: '/buildings?new=1', icon: <BankOutlined />, label: isRTLLabel('مبنى جديد', 'New building') },
      { key: '/buildings', icon: <AppstoreOutlined />, label: isRTLLabel('وحدة / مستأجر / عداد — من مخطط المبنى', 'Unit / tenant / meter — from the building plan') },
      { key: '/settings', icon: <FileTextOutlined />, label: isRTLLabel('بند شروط وأحكام', 'Terms & conditions item') },
    ],
    onClick: ({ key }: { key: string }) => navigate(key),
  };
  function isRTLLabel(ar: string, en: string) { return i18n.language === 'ar' ? ar : en; }
  const navigate = useNavigate();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const [now, setNow] = useState(new Date());

  // live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // keep html dir in sync whenever language changes
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  const toggleLang = () => {
    i18n.changeLanguage(isRTL ? 'en' : 'ar');
  };

  const dateStr = now.toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' });
  const ampm = isRTL ? (now.getHours() < 12 ? 'ص' : 'م') : '';

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: t('nav.home') },
    { key: '/buildings', icon: <BankOutlined />, label: t('nav.buildings') },
    { key: '/villas', icon: <HomeOutlined />, label: i18n.language === 'ar' ? 'الفلل' : 'Villas' },
    { key: '/restaurants', icon: <ShopOutlined />, label: i18n.language === 'ar' ? 'المطاعم' : 'Restaurants' },
    { key: '/apartments', icon: <AppstoreOutlined />, label: t('nav.apartments') },
    { key: '/customers', icon: <TeamOutlined />, label: t('nav.customers') },
    { key: '/gas-contracts', icon: <FileTextOutlined />, label: t('nav.gasContracts') },
    { key: '/maintenance-contracts', icon: <ToolOutlined />, label: t('nav.maintenanceContracts') },
    { key: '/meters', icon: <DashboardOutlined />, label: t('nav.meters') },
    { key: '/invoices', icon: <FileDoneOutlined />, label: t('nav.invoices') },
    { key: '/payments', icon: <DollarOutlined />, label: t('nav.payments') },
    { key: '/accounting', icon: <CalculatorOutlined />, label: i18n.language === 'ar' ? 'المحاسبة' : 'Accounting' },
    { key: '/overdue', icon: <WarningOutlined />, label: t('nav.overdue') },
    { key: '/service-requests', icon: <CustomerServiceOutlined />, label: t('nav.serviceRequests') },
    { key: '/maintenance', icon: <ThunderboltOutlined />, label: t('nav.maintenance') },
    { key: '/reports', icon: <BarChartOutlined />, label: t('nav.reports') },
    { key: '/users', icon: <UserOutlined />, label: t('nav.users') },
    { key: '/vehicles', icon: <CarOutlined />, label: 'إدارة المركبات' },
    { key: '/employees', icon: <TeamOutlined />, label: 'الموظفون' },
    { key: '/assets', icon: <AppstoreOutlined />, label: 'إدارة الأصول' },
    { key: '/settings', icon: <SettingOutlined />, label: t('nav.settings') },
  ];

  const { user, logout } = useAuth();
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const { can } = useAuth();
  // real alert count for the bell (expiring certificates / contracts / calibration, low tanks …), refreshed every 5 minutes
  const [alertsCount, setAlertsCount] = useState(0);
  useEffect(() => {
    if (!user || !can('dashboard.view')) { setAlertsCount(0); return; }
    const load = () => api<{ count: number }>('/alerts', { query: { days: 30 } }).then(r => setAlertsCount(r.count ?? 0)).catch(() => undefined);
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // usage history: every page opened (+ every print / file export through the global hooks)
  useEffect(() => { installGlobalTracking(); }, []);
  useEffect(() => {
    if (!user) return;
    const item = [...menuItems].sort((a, b) => b.key.length - a.key.length).find(m => m.key === '/' ? location.pathname === '/' : location.pathname.startsWith(m.key));
    const title = typeof item?.label === 'string' ? item.label : location.pathname;
    track('view', { path: location.pathname + location.search, title });
  }, [location.pathname, location.search, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const displayName = (isRTL ? user?.nameAr ?? user?.nameEn : user?.nameEn ?? user?.nameAr) ?? user?.email ?? '';
  const roleLabel = user?.isAdmin ? (isRTL ? 'مدير النظام' : 'System Admin') : (user?.roles?.[0] ?? '');

  const userMenu = {
    items: [
      { key: 'profile', label: isRTL ? 'الملف الشخصي' : 'Profile' },
      { key: 'sessions', label: isRTL ? 'أجهزتي المسجّلة' : 'My devices' },
      { key: 'logout', label: isRTL ? 'تسجيل الخروج' : 'Logout' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') { logout(); navigate('/login', { replace: true }); }
      if (key === 'sessions') setSessionsOpen(true);
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', overflow: 'hidden', width: '100%', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── SIDEBAR ── */}
      <Sider
        width={220}
        className="app-sider"
        style={{
          background: 'linear-gradient(180deg, #0b2e18 0%, #1a5c2a 50%, #0b2e18 100%)',
          position: 'fixed',
          height: '100vh',
          zIndex: 100,
          right: isRTL ? 0 : 'auto',
          left: isRTL ? 'auto' : 0,
          
          overflow: 'hidden',
        }}
      >
        {/* ── USER HEADER (matching design image) ── */}
        <div style={{ background: '#0b2e18', padding: '14px 10px 10px' }}>

          {/* Row: name | avatar | icons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            flexDirection: isRTL ? 'row' : 'row-reverse',
          }}>
            {/* Bell + Globe — left side in RTL (start in LTR) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Badge count={alertsCount} size="small" overflowCount={99} offset={isRTL ? [-2, 2] : [2, 2]}>
                <BellOutlined title={isRTL ? `${alertsCount} تنبيه خلال 30 يوماً` : `${alertsCount} alerts in 30 days`} onClick={() => navigate('/')}
                  style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }} />
              </Badge>
              <GlobalOutlined
                onClick={toggleLang}
                style={{ fontSize: 20, color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}
                title={isRTL ? 'English' : 'عربي'}
              />
            </div>

            {/* Avatar — center */}
            <Avatar
              size={54}
              style={{
                border: '3px solid rgba(255,255,255,0.25)',
                background: '#c9a84c',
                flexShrink: 0,
              }}
              icon={<UserOutlined />}
            />

            {/* Name + role + chevron — right side in RTL */}
            <Dropdown menu={userMenu} placement={isRTL ? 'bottomLeft' : 'bottomRight'}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
                    {displayName}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                    {roleLabel}
                  </div>
                </div>
                <RightOutlined style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              </div>
            </Dropdown>
          </div>

          {/* Date + Time row */}
          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }}>{dateStr}</div>
            <div style={{ color: '#c9a84c', fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {timeStr} {ampm}
            </div>
          </div>
        </div>

        {/* ── NAV MENU (only this part scrolls; header + support box stay put) ── */}
        <div className="app-sider-menu">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
          style={{ background: 'transparent', border: 'none', marginTop: 2 }}
        />
        </div>

        {/* Support box */}
        <div style={{ flexShrink: 0, margin: '8px 12px 16px', padding: '10px', background: 'rgba(201,168,76,0.15)', borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)', textAlign: 'center' }}>
          <CustomerServiceOutlined style={{ color: '#c9a84c', fontSize: 18 }} />
          <div style={{ color: '#c9a84c', fontWeight: 700, fontSize: 14, marginTop: 4 }}>800 2673</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{t('support.service')}</div>
        </div>
      </Sider>

      {/* ── MAIN ── */}
      <Layout style={{ marginRight: isRTL ? 220 : 0, marginLeft: isRTL ? 0 : 220, overflow: 'hidden', minWidth: 0 }}>

        {/* ── HERO BANNER ── */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #f5f0e8 0%, #ede8d8 40%, #f0ebe0 100%)',
          overflow: 'hidden',
          borderBottom: '3px solid #1a5c2a',
        }}>
          <SkylineSVG />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>

            {/* Logo side (inline-start) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 200 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1a5c2a, #0b2e18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, border: '3px solid #c9a84c', flexShrink: 0,
                boxShadow: '0 4px 12px rgba(26,92,42,0.3)',
              }}>⛽</div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#1a5c2a', lineHeight: 1.1, fontFamily: 'Cairo, sans-serif' }}>بـن سـدرة</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a84c', letterSpacing: 1 }}>BIN SIDRA GAS</div>
                <div style={{ fontSize: 10, color: '#666' }}>أمان .. طاقة .. لمستقبل أفضل</div>
              </div>
            </div>

            {/* Center welcome */}
            <div style={{ textAlign: 'center', flex: 1, padding: '0 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1a3a20', fontFamily: 'Cairo, sans-serif', lineHeight: 1.3 }}>
                {isRTL ? 'مرحباً بك في نظام بن سدرة لإدارة الغاز' : 'Welcome to Bin Sidra Gas Management System'}
              </div>
              <div style={{ fontSize: 13, color: '#4a6a50', marginTop: 4, fontFamily: 'Cairo, sans-serif' }}>
                {isRTL ? 'إدارة متكاملة .. لخدمتكم بشكل أفضل' : 'Integrated Management .. Serving You Better'}
              </div>
            </div>

            {/* UAE flag + slogan (inline-end) */}
            <div style={{ textAlign: isRTL ? 'left' : 'right', minWidth: 150 }}>
              <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 4 }}>🇦🇪</div>
              <div style={{ fontSize: 11, color: '#4a6a50', fontFamily: 'Cairo, sans-serif' }}>
                {isRTL ? 'معاً لأمن وسلامة مجتمعنا' : 'Together for Community Safety'}
              </div>
            </div>
          </div>

          {/* ── FILTER TOOLBAR ── */}
          <div style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(4px)',
            borderTop: '1px solid rgba(26,92,42,0.15)',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            direction: isRTL ? 'rtl' : 'ltr',
          }}>
            <Dropdown menu={quickAdd} trigger={['click']} placement={isRTL ? 'bottomRight' : 'bottomLeft'}>
              <Button type="primary" icon={<PlusOutlined />}
                style={{ background: '#1a5c2a', borderColor: '#1a5c2a', fontWeight: 600, flexShrink: 0 }}>
                {isRTL ? 'إضافة سريع' : 'Quick Add'}
              </Button>
            </Dropdown>
            <DatePicker
              placeholder={isRTL ? 'كل الفترات' : 'All periods'}
              suffixIcon={<CalendarOutlined style={{ color: '#1a5c2a' }} />}
              style={{ width: 140 }} picker="month" allowClear
              value={filters.month} onChange={v => filters.setMonth(v ?? null)}
            />
            <Select placeholder={isRTL ? 'كل الفروع' : 'All Branches'} style={{ width: 150 }} allowClear
              value={filters.branchId} onChange={v => filters.setBranchId(v ?? undefined)}
              options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isRTL) }))}
            />
            <Select placeholder={isRTL ? 'كل الأنواع' : 'All Types'} style={{ width: 130 }} allowClear
              value={filters.buildingType} onChange={v => filters.setBuildingType(v ?? undefined)}
              options={(ref?.lookups?.BUILDING_TYPE ?? []).map(t => ({ value: t.code, label: t.label }))}
            />
            <div style={{ flex: 1 }} />
            <Input.Search
              placeholder={isRTL ? 'بحث عن مبنى (الاسم، الرمز) — Enter' : 'Search buildings (name, code) — Enter'}
              style={{ maxWidth: 340 }} allowClear
              value={searchText} onChange={e => { setSearchText(e.target.value); if (!e.target.value) filters.submitSearch(''); }}
              onSearch={runSearch}
            />
          </div>
        </div>

        {/* Page content */}
        <Content style={{ background: '#f5f6fa', minHeight: 'calc(100vh - 160px)' }}>
          {children}
          <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
        </Content>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderTop: '1px solid #eee', fontSize: 11, color: '#aaa' }}>
          {isRTL ? 'BIN SIDRA GAS | جميع الحقوق محفوظة © 2025' : '© 2025 BIN SIDRA GAS | All Rights Reserved'} | Version 1.0
        </div>
      </Layout>
    </Layout>
  );
};

/** The header filters live in a context so pages (e.g. Buildings) can apply them. */
const AppLayout: React.FC<AppLayoutProps> = props => (
  <GlobalFiltersProvider><AppLayoutInner {...props} /></GlobalFiltersProvider>
);

export default AppLayout;
