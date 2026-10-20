import { useEffect, useState } from 'react';
import { Card } from 'antd';
import type { ReactNode } from 'react';
import { api, type Paged } from '../../api/client';

export const PRIMARY = '#1a5c2a';
export const GOLD = '#c9a84c';
export const DARK = '#0b2e18';

export interface BuildingOpt { id: number; code: string; name?: string; branchId?: number }

/** All buildings for filters / pickers. */
export function useBuildings() {
  const [rows, setRows] = useState<BuildingOpt[]>([]);
  useEffect(() => {
    api<Paged<any>>('/buildings', { query: { pageSize: 0 } })
      .then(r => setRows(r.items.map((b: any) => ({ id: b.id, code: b.code ?? b.no, name: b.name ?? b.nameAr ?? b.nameEn, branchId: b.branchId }))))
      .catch(() => setRows([]));
  }, []);
  return rows;
}

export const buildingLabel = (b: BuildingOpt) => `${b.code}${b.name ? ` — ${b.name}` : ''}`;

/** Page header in the portal style (green gradient, gold line). */
export function PageHeader({ icon, title, subtitle, extra }: { icon: ReactNode; title: string; subtitle?: string; extra?: ReactNode }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK} 100%)`, borderBottom: `3px solid ${GOLD}`, borderRadius: 14, padding: '16px 20px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(201,168,76,.18)', color: GOLD, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{title}</div>
        {subtitle && <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5 }}>{subtitle}</div>}
      </div>
      {extra}
    </div>
  );
}

export interface Kpi { label: string; value: ReactNode; color: string; bg: string; icon: ReactNode; onClick?: () => void; active?: boolean }

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
      {items.map(k => (
        <Card key={k.label} size="small" bordered={false} hoverable={!!k.onClick} onClick={k.onClick}
          style={{ borderRadius: 12, background: k.bg, border: k.active ? `2px solid ${k.color}` : '2px solid transparent', cursor: k.onClick ? 'pointer' : 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, color: k.color }}>{k.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1.2 }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: k.color, opacity: 0.85 }}>{k.label}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
