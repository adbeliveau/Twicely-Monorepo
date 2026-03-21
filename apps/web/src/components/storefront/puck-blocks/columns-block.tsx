'use client';

import { DropZone } from '@puckeditor/core';
import type { ComponentConfig } from '@puckeditor/core';

export interface ColumnsBlockProps {
  columns: '2' | '3';
  gap: string;
}

export function ColumnsBlock({ columns, gap }: ColumnsBlockProps) {
  const colCount = columns === '3' ? 3 : 2;
  const gridClass =
    colCount === 3
      ? 'grid grid-cols-1 md:grid-cols-3'
      : 'grid grid-cols-1 md:grid-cols-2';

  return (
    <div className={gridClass} style={{ gap: gap || '24px' }}>
      {Array.from({ length: colCount }, (_, i) => (
        <div key={i} className="min-h-[80px]">
          <DropZone zone={`column-${i}`} />
        </div>
      ))}
    </div>
  );
}

export const columnsBlockConfig: ComponentConfig<ColumnsBlockProps> = {
  label: 'Columns',
  defaultProps: { columns: '2', gap: '24px' },
  fields: {
    columns: {
      type: 'radio',
      label: 'Columns',
      options: [
        { label: '2 Columns', value: '2' },
        { label: '3 Columns', value: '3' },
      ],
    },
    gap: { type: 'text', label: 'Gap (CSS)' },
  },
  render: (props) => <ColumnsBlock {...props} />,
};
