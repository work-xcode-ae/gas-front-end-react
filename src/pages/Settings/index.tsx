import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import { FileProtectOutlined, SettingOutlined, AppstoreOutlined, CheckSquareOutlined, AuditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import TermsSettings from './TermsSettings';
import LookupListSettings from './LookupListSettings';
import AuditTrailSettings from './AuditTrailSettings';
import SystemSettings from './SystemSettings';
import { useAuth } from '../../auth/AuthContext';

const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

const SettingsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [tab, setTab] = useState('system');
  const { can } = useAuth();

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SettingOutlined /></span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{isRTL ? 'الإعدادات' : 'Settings'}</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>{isRTL ? 'الشركة والفروع والقوائم والقوالب المستخدمة في النظام' : 'System settings and contract templates'}</div>
        </div>
      </div>
      <Card styles={{ body: { padding: '4px 16px 16px' } }} style={{ borderRadius: 14 }}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'system', label: <span><AppstoreOutlined /> {isRTL ? 'إعدادات النظام' : 'System'}</span>, children: <SystemSettings /> },
          { key: 'terms', label: <span><FileProtectOutlined /> {isRTL ? 'الشروط والأحكام' : 'Terms & conditions'}</span>, children: <TermsSettings /> },
          { key: 'checklist', label: <span><CheckSquareOutlined /> {isRTL ? 'قائمة الفحص' : 'Visit checklist'}</span>,
            children: <LookupListSettings typeCode="VISIT_CHECKLIST" title={isRTL ? 'بنود قائمة فحص زيارات الصيانة' : 'Maintenance visit checklist'}
              hint={isRTL ? 'تظهر هذه البنود عند تسجيل زيارة صيانة لعقد AMC' : 'Shown when recording an AMC maintenance visit'} /> },
          ...(can('audit.view') ? [{ key: 'audit', label: <span><AuditOutlined /> {isRTL ? 'سجل التدقيق' : 'Audit trail'}</span>, children: <AuditTrailSettings /> }] : []),
        ]} />
      </Card>
    </div>
  );
};

export default SettingsPage;
