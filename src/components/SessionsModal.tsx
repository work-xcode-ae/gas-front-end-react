import { useCallback, useEffect, useState } from 'react';
import { Modal, Table, Tag, Button, Popconfirm, Typography, message, Alert } from 'antd';
import { LaptopOutlined, MobileOutlined, LogoutOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, tokenStore } from '../api/client';

const { Text } = Typography;
interface Session { id: string; startedAt: string; lastActiveAt: string; expiresAt: string; sessionEndsAt: string; ip?: string; device?: string; current?: boolean }

/** my sessions; the refresh token header marks the current device */
async function fetchMine(): Promise<Session[]> {
  const { authFetch, API_BASE } = await import('../api/client');
  const res = await authFetch(`${API_BASE}/auth/sessions`, { headers: { 'X-Refresh-Token': tokenStore.getRefresh() ?? '', Accept: 'application/json' } });
  if (!res.ok) throw new Error('تعذّر تحميل الجلسات');
  return res.json();
}

/** Short browser / OS name from a user agent. */
function deviceName(ua?: string) {
  if (!ua) return 'غير معروف';
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${b}${os ? ` — ${os}` : ''}`;
}

/**
 * Active sessions (signed-in devices). userId given → admin view of that user (/users/{id}/sessions);
 * otherwise my own sessions (/auth/sessions) with «sign out other devices».
 */
export default function SessionsModal({ open, onClose, userId, userName }: { open: boolean; onClose: () => void; userId?: number; userName?: string }) {
  const [rows, setRows] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const mine = userId == null;

  const load = useCallback(() => {
    setLoading(true);
    const p = mine
      ? fetchMine()
      : api<Session[]>(`/users/${userId}/sessions`);
    p.then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [mine, userId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const endOne = (s: Session) => api(`/auth/sessions/${s.id}`, { method: 'DELETE' }).then(() => { message.success('تم إنهاء الجلسة'); load(); }).catch(e => message.error(errorMessage(e)));
  const endAll = () => (mine
    ? api<{ revoked: number }>('/auth/logout-all', { method: 'POST', body: { refreshToken: tokenStore.getRefresh() }, query: { keepCurrent: true } })
    : api<{ revoked: number }>(`/users/${userId}/sessions/revoke`, { method: 'POST' }))
    .then(() => { message.success(mine ? 'تم تسجيل الخروج من الأجهزة الأخرى' : 'تم تسجيل خروج المستخدم من كل الأجهزة'); load(); })
    .catch(e => message.error(errorMessage(e)));

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={820} destroyOnHidden
      title={mine ? 'أجهزتي المسجّلة (الجلسات النشطة)' : `جلسات المستخدم ${userName ?? ''}`}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="كل جلسة تبقى نشطة ما دام المستخدم يستعملها (تتجدد تلقائياً)، وتنتهي بعد 7 أيام بلا استخدام أو بعد 30 يوماً من الدخول. إنهاء الجلسة يوقفها فوراً." />
      <div style={{ marginBottom: 10, textAlign: 'end' }}>
        <Popconfirm title={mine ? 'تسجيل الخروج من كل الأجهزة الأخرى؟' : 'تسجيل خروج المستخدم من كل الأجهزة؟'} okText="نعم" cancelText="إلغاء" onConfirm={endAll}>
          <Button danger icon={<LogoutOutlined />} disabled={!rows.some(r => !r.current)}>{mine ? 'الخروج من الأجهزة الأخرى' : 'إنهاء كل الجلسات'}</Button>
        </Popconfirm>
      </div>
      <Table<Session> size="small" rowKey="id" loading={loading} dataSource={rows} pagination={false} locale={{ emptyText: 'لا توجد جلسات نشطة' }}
        columns={[
          { title: 'الجهاز', key: 'd', render: (_, s) => <span>{/Android|iPhone|iPad/.test(s.device ?? '') ? <MobileOutlined /> : <LaptopOutlined />} {deviceName(s.device)} {s.current && <Tag color="green">هذا الجهاز</Tag>}</span> },
          { title: 'IP', dataIndex: 'ip', width: 120, render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v ?? '—'}</Text> },
          { title: 'بدأت', dataIndex: 'startedAt', width: 130, render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
          { title: 'آخر تجديد', dataIndex: 'lastActiveAt', width: 130, render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
          { title: 'تنتهي', dataIndex: 'sessionEndsAt', width: 110, render: (v, s) => <span title={`بلا استخدام حتى ${dayjs(s.expiresAt).format('YYYY-MM-DD HH:mm')}`}>{dayjs(v).format('YYYY-MM-DD')}</span> },
          ...(mine ? [{ title: '', key: 'a', width: 90, render: (_: unknown, s: Session) => !s.current && (
            <Popconfirm title="إنهاء هذه الجلسة؟" okText="نعم" cancelText="إلغاء" onConfirm={() => endOne(s)}><Button size="small" danger>إنهاء</Button></Popconfirm>) }] : []),
        ]} />
    </Modal>
  );
}
