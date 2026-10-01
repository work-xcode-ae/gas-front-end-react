import React from 'react';
import { Card, Skeleton } from 'antd';

export interface KpiCardProps {
  title: string;
  value?: number | string | null;
  prefix?: string;
  suffix?: string;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
  bg?: string;
  loading?: boolean;
  /** Optional click handler */
  onClick?: () => void;
}

/**
 * Standard KPI card used across all pages.
 * Shows an animated skeleton while `loading` is true or `value` is undefined/null.
 * Usage:
 *   <KpiCard title="عدد المباني" value={stats?.buildings} loading={isLoading}
 *            icon={<BankOutlined />} color="#1a5c2a" bg="#e8f5e9" />
 */
const KpiCard: React.FC<KpiCardProps> = ({
  title, value, prefix, suffix, sub, icon, color = '#1a5c2a', bg = '#e8f5e9', loading = false, onClick,
}) => {
  const isLoading = loading || value === undefined || value === null;

  return (
    <Card
      onClick={onClick}
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: 'none',
        cursor: onClick ? 'pointer' : undefined,
      }}
      bodyStyle={{ padding: '16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon && (
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color, flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{title}</div>

          {isLoading ? (
            <Skeleton.Button
              active
              size="small"
              style={{ width: 90, height: 24, borderRadius: 4 }}
            />
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>
              {prefix && <span style={{ fontSize: 11, marginInlineEnd: 3 }}>{prefix}</span>}
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
          )}

          {!isLoading && suffix && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{suffix}</div>
          )}
          {!isLoading && sub && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default KpiCard;
