import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFinish = async (values: { usr: string; pwd: string }) => {
    setLoading(true);
    setError('');
    try {
      await login(values.usr, values.pwd);
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a5c2a 0%, #0d3318 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 16 }}>
        <Space direction="vertical" size={24} style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a5c2a, #c9a84c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
              fontSize: 28,
            }}>🔥</div>
            <Title level={3} style={{ margin: 0 }}>Bin Sidra Gas</Title>
            <Text type="secondary">نظام إدارة الغاز</Text>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

          <Form layout="vertical" onFinish={onFinish} style={{ textAlign: 'right' }}>
            <Form.Item name="usr" rules={[{ required: true, message: 'أدخل البريد الإلكتروني' }]}>
              <Input prefix={<UserOutlined />} placeholder="البريد الإلكتروني" size="large" />
            </Form.Item>
            <Form.Item name="pwd" rules={[{ required: true, message: 'أدخل كلمة المرور' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="كلمة المرور" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large"
              style={{ background: '#1a5c2a', borderColor: '#1a5c2a' }}>
              تسجيل الدخول
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
