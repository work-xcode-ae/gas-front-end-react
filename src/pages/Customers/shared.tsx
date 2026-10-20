import type { ReactNode } from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;
export const PRIMARY = '#1a5c2a';
export const DARK = '#0b2e18';
export const GOLD = '#c9a84c';
export const money = (n?: number | null) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} د.إ`;
export const d10 = (v?: string | null) => (v ? String(v).slice(0, 10) : '—');

export const PAY_STATUS: Record<string, { color: string; label: string }> = {
  paid: { color: 'success', label: 'مسدد' }, pending: { color: 'gold', label: 'مستحق' }, overdue: { color: 'error', label: 'متأخر' },
};
export const INV_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, pending: { color: 'gold', label: 'صادرة' }, partial: { color: 'cyan', label: 'مسددة جزئياً' },
  paid: { color: 'success', label: 'مسددة' }, overdue: { color: 'error', label: 'متأخرة' }, cancelled: { color: 'default', label: 'ملغاة' },
};
export const CONTRACT_STATUS: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'مسودة' }, active: { color: 'success', label: 'نشط' }, pending: { color: 'gold', label: 'معلق' },
  expired: { color: 'error', label: 'منتهي' }, terminated: { color: 'volcano', label: 'ملغي' },
};
export const METHODS = [
  { value: 'cash', label: 'نقداً' }, { value: 'bank_transfer', label: 'تحويل بنكي' }, { value: 'cheque', label: 'شيك' },
  { value: 'card', label: 'بطاقة' }, { value: 'online', label: 'إلكتروني' },
];

/** Page banner used by the list pages (same look as Settings). */
export function PageBanner({ icon, title, subtitle, extra }: { icon: ReactNode; title: string; subtitle: string; extra?: ReactNode }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>{subtitle}</div>
      </div>
      {extra}
    </div>
  );
}

export function Kpi({ label, value, color, bg, icon, onClick, active }: { label: string; value: ReactNode; color: string; bg: string; icon?: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <Card size="small" bordered={false} hoverable={!!onClick} onClick={onClick}
      style={{ borderRadius: 12, background: bg, cursor: onClick ? 'pointer' : undefined, outline: active ? `2px solid ${color}` : undefined, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <div style={{ fontSize: 22, color }}>{icon}</div>}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
          <Text style={{ fontSize: 11.5, color, opacity: 0.85 }}>{label}</Text>
        </div>
      </div>
    </Card>
  );
}
