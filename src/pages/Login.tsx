import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined, FireOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';

const { Title, Text } = Typography;
const PRIMARY = '#1a5c2a';

const LoginPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  const onFinish = async (v: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(v.email.trim(), v.password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: `linear-gradient(135deg, #0b2e18 0%, ${PRIMARY} 60%, #2e7d32 100%)`, direction: isAr ? 'rtl' : 'ltr' }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#e8f5e9', color: PRIMARY, fontSize: 26,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <FireOutlined />
          </div>
          <Title level={4} style={{ margin: 0, color: PRIMARY }}>{isAr ? 'سدرة للبترول' : 'Sedra Petrol'}</Title>
          <Text type="secondary">{isAr ? 'تسجيل الدخول إلى البوابة' : 'Sign in to the portal'}</Text>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16, borderRadius: 8 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" label={isAr ? 'البريد الإلكتروني' : 'Email'}
            rules={[{ required: true, message: isAr ? 'أدخل البريد الإلكتروني' : 'Enter your email' }, { type: 'email', message: isAr ? 'بريد غير صالح' : 'Invalid email' }]}>
            <Input prefix={<MailOutlined style={{ color: '#bbb' }} />} size="large" autoComplete="username" style={{ direction: 'ltr' }} />
          </Form.Item>
          <Form.Item name="password" label={isAr ? 'كلمة المرور' : 'Password'}
            rules={[{ required: true, message: isAr ? 'أدخل كلمة المرور' : 'Enter your password' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#bbb' }} />} size="large" autoComplete="current-password" style={{ direction: 'ltr' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}
            style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 10, fontWeight: 600, marginTop: 4 }}>
            {isAr ? 'دخول' : 'Sign in'}
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
