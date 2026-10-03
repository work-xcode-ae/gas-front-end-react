import React from 'react';
import { Skeleton } from 'antd';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /** Column widths as percentages or fixed px values, e.g. ['8%','25%','15%'] */
  colWidths?: (string | number)[];
}

/**
 * Renders skeleton rows to replace a table while data loads from the API.
 * Usage:
 *   {loading ? <TableSkeleton rows={8} colWidths={['10%','30%','20%','20%','20%']} /> : <Table ... />}
 */
const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 8, columns = 5, colWidths }) => {
  const widths = colWidths ?? Array(columns).fill(`${Math.floor(100 / columns)}%`);

  return (
    <div style={{ width: '100%' }}>
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: ri % 2 === 0 ? '#fff' : '#fafafa',
          }}
        >
          {widths.map((w, ci) => (
            <div key={ci} style={{ flex: typeof w === 'number' ? `0 0 ${w}px` : `0 0 ${w}`, width: w }}>
              <Skeleton.Button
                active
                size="small"
                style={{
                  width: '80%',
                  height: 14,
                  borderRadius: 4,
                  // vary widths slightly so it looks natural
                  opacity: 0.6 + ((ri + ci) % 4) * 0.1,
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default TableSkeleton;
