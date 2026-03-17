'use client';

import { useState, useRef, useEffect } from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown, ListFilter, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SortState {
  column: string;
  direction: 'asc' | 'desc' | null;
}

interface SortableHeaderProps {
  column: string;
  label: string;
  currentSort: SortState;
  onSort: (column: string) => void;
  align?: 'left' | 'right';
  className?: string;
  filterOptions?: Array<{ value: string; label: string }>;
  filterValue?: string;
  onFilter?: (column: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
  align = 'left',
  className,
  filterOptions,
  filterValue,
  onFilter,
}: SortableHeaderProps) {
  const isActiveSortColumn = currentSort.column === column;
  const hasActiveFilter = filterValue != null && filterValue !== 'all';

  // Filter dropdown state
  const [filterOpen, setFilterOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterOpen]);

  // Close on Escape
  useEffect(() => {
    if (!filterOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filterOpen]);

  const SortIcon = isActiveSortColumn
    ? currentSort.direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={cn('select-none', className)}>
      <div
        className={cn(
          'flex items-center gap-1',
          align === 'right' && 'justify-end',
        )}
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium transition-colors hover:text-foreground',
            isActiveSortColumn ? 'text-foreground' : 'text-muted-foreground',
          )}
          onClick={() => onSort(column)}
        >
          {label}
          <SortIcon
            className={cn('size-3', !isActiveSortColumn && 'opacity-40')}
          />
        </button>

        {filterOptions && onFilter && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center rounded p-0.5 transition-colors hover:bg-accent',
                hasActiveFilter
                  ? 'text-primary'
                  : 'text-muted-foreground opacity-60',
              )}
              onClick={(e) => {
                e.stopPropagation();
                setFilterOpen((prev) => !prev);
              }}
            >
              <ListFilter className="size-3" />
            </button>

            {filterOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Filter {label}
                </div>
                <div className="my-1 h-px bg-border" />
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      filterValue === opt.value && 'font-medium',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFilter(column, opt.value);
                      setFilterOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'size-3 shrink-0',
                        filterValue === opt.value
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TableHead>
  );
}
