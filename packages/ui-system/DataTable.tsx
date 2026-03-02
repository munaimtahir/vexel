import * as React from 'react';
import { cn } from './utils';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  numeric?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data',
  loading = false,
  className,
  rowClassName,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: React.ReactNode;
  loading?: boolean;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  const skeletonRows = Array.from({ length: 6 });

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', className)}>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    col.numeric && 'text-right font-mono',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? skeletonRows.map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className={idx % 2 === 1 ? 'bg-muted/20' : undefined}>
                    {columns.map((col) => (
                      <td key={`${col.key}-${idx}`} className="px-3 py-2.5">
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!loading && data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {!loading
              ? data.map((row, index) => (
                  <tr
                    key={keyExtractor(row)}
                    className={cn(
                      'border-t border-border/70 transition-colors',
                      index % 2 === 1 && 'bg-muted/[0.16]',
                      onRowClick && 'cursor-pointer hover:bg-muted/35',
                      rowClassName?.(row),
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 align-middle text-foreground',
                          col.numeric && 'text-right font-mono tabular-nums',
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
