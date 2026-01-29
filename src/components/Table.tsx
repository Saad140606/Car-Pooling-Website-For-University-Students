'use client';

import React, { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any, idx: number) => ReactNode;
}

interface TableProps {
  columns: TableColumn[];
  data: any[];
  isLoading?: boolean;
  loadingRows?: number;
  onRowClick?: (row: any) => void;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  className?: string;
  emptyMessage?: string;
}

export const Table = React.forwardRef<HTMLDivElement, TableProps>(
  (
    {
      columns,
      data,
      isLoading,
      loadingRows = 5,
      onRowClick,
      striped = true,
      hover = true,
      compact = false,
      className,
      emptyMessage = 'No data available',
    },
    ref
  ) => {
    const [sortBy, setSortBy] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);

    const sortedData = sortBy
      ? [...data].sort((a, b) => {
          const aVal = a[sortBy.key];
          const bVal = b[sortBy.key];
          const comp = aVal > bVal ? 1 : -1;
          return sortBy.order === 'asc' ? comp : -comp;
        })
      : data;

    const handleSort = (columnKey: string) => {
      if (sortBy?.key === columnKey) {
        setSortBy({
          key: columnKey,
          order: sortBy.order === 'asc' ? 'desc' : 'asc',
        });
      } else {
        setSortBy({ key: columnKey, order: 'asc' });
      }
    };

    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden rounded-2xl border-2 border-border/30', className)}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b-2 border-border/20 bg-gradient-to-r from-muted/50 to-muted/20">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left font-semibold text-sm text-muted-foreground',
                      !compact && 'py-4',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right'
                    )}
                    style={{ width: col.width }}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-2 hover:text-foreground transition-colors duration-200"
                      >
                        {col.label}
                        {sortBy?.key === col.key ? (
                          sortBy.order === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="h-4 w-4 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: loadingRows }).map((_, idx) => (
                  <tr
                    key={`skeleton-${idx}`}
                    className={cn(
                      'border-b border-border/10',
                      striped && idx % 2 === 1 && 'bg-muted/5'
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3" style={{ width: col.width }}>
                        <div className="h-4 bg-gradient-to-r from-muted/20 to-muted/10 rounded animate-shimmer" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedData.length > 0 ? (
                sortedData.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border/10 transition-all duration-200',
                      striped && idx % 2 === 1 && 'bg-muted/5',
                      hover && onRowClick && 'cursor-pointer hover:bg-muted/10 hover:shadow-md',
                      'animate-slide-in-left'
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-sm text-foreground',
                          !compact && 'py-4',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                        style={{ width: col.width }}
                      >
                        {col.render
                          ? col.render(row[col.key], row, idx)
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                // Empty state
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <p className="text-muted-foreground">{emptyMessage}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

Table.displayName = 'Table';

/**
 * DataGrid - Advanced table with pagination, filtering, and selection
 */
interface DataGridProps extends Omit<TableProps, 'data'> {
  data: any[];
  pageSize?: number;
  onPageChange?: (page: number) => void;
  totalPages?: number;
  currentPage?: number;
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const DataGrid = React.forwardRef<HTMLDivElement, DataGridProps>(
  (
    {
      columns,
      data,
      pageSize = 10,
      onPageChange,
      totalPages = 1,
      currentPage = 1,
      selectable = false,
      selectedRows = new Set(),
      onSelectionChange,
      ...props
    },
    ref
  ) => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedData = data.slice(startIdx, endIdx);

    const allSelected = paginatedData.length > 0 && 
      paginatedData.every(row => selectedRows.has(row.id));

    const handleSelectAll = () => {
      const newSelected = new Set(selectedRows);
      if (allSelected) {
        paginatedData.forEach(row => newSelected.delete(row.id));
      } else {
        paginatedData.forEach(row => newSelected.add(row.id));
      }
      onSelectionChange?.(newSelected);
    };

    const handleSelectRow = (rowId: string) => {
      const newSelected = new Set(selectedRows);
      if (newSelected.has(rowId)) {
        newSelected.delete(rowId);
      } else {
        newSelected.add(rowId);
      }
      onSelectionChange?.(newSelected);
    };

    return (
      <div ref={ref} className="space-y-4">
        <Table
          columns={selectable ? [
            {
              key: '_select',
              label: '✓',
              width: '50px',
              align: 'center',
              render: (_, row) => (
                <input
                  type="checkbox"
                  checked={selectedRows.has(row.id)}
                  onChange={() => handleSelectRow(row.id)}
                  className="h-4 w-4"
                />
              ),
            },
            ...columns,
          ] : columns}
          data={paginatedData}
          {...props}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 rounded-xl border border-border/20 bg-muted/5">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx + 1}
                onClick={() => onPageChange?.(idx + 1)}
                className={cn(
                  'h-10 min-w-[40px] rounded-lg font-medium transition-all duration-200',
                  currentPage === idx + 1
                    ? 'bg-primary text-white'
                    : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

DataGrid.displayName = 'DataGrid';
