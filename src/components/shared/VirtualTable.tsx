import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DataTableColumn } from "./DataTable";

export type { DataTableColumn } from "./DataTable";

interface VirtualTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  /** Estimated row height in px. Used by the virtualizer; rows are dynamically measured. */
  estimatedRowHeight?: number;
  /** Extra rows to render above/below the viewport. */
  overscan?: number;
  /**
   * Below this row count we render the plain table (no virtualization overhead).
   * Above it we switch to a `useVirtualizer`-backed body. Default: 200.
   */
  virtualizeFromRowCount?: number;
  /** Row identity for stable keys + measurement. Falls back to `row.id` then index. */
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: string | ((row: T) => string);
  emptyMessage?: string;
  /** Sticky `<thead>` (default true). */
  stickyHeader?: boolean;
  /** Accessible name for the grid. */
  ariaLabel?: string;
  /** Min-width on the inner `<Table>` so columns don't collapse on overflow-x scroll. */
  minWidth?: number | string;
  /** Optional cap for the scroll container. Default: 600px. */
  maxHeight?: number | string;
}

/**
 * Shared virtualized table.
 *
 * - WAI-ARIA Grid pattern: `role="grid"`, `aria-rowcount` for the full row count,
 *   `aria-rowindex` per row so screen readers announce "row N of total" while only
 *   ~30 rows are mounted.
 * - TanStack Virtual best practices: dynamic measurement via `measureElement`,
 *   overscan = 8 by default, top/bottom spacer `<tr>`s preserve native table layout.
 * - Below `virtualizeFromRowCount` rows the component falls back to a non-virtualized
 *   render so small lists pay zero virtualization cost.
 */
export function VirtualTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading,
  estimatedRowHeight = 48,
  overscan = 8,
  virtualizeFromRowCount = 200,
  getRowId,
  onRowClick,
  rowClassName,
  emptyMessage = "No data found.",
  stickyHeader = true,
  ariaLabel,
  minWidth,
  maxHeight = 600,
}: VirtualTableProps<T>) {
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = data.length > virtualizeFromRowCount;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? data.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  const resolveKey = (row: T, idx: number): string => {
    if (getRowId) return getRowId(row, idx);
    const id = (row as { id?: unknown }).id;
    return typeof id === "string" || typeof id === "number" ? String(id) : String(idx);
  };

  const headerRow = useMemo(
    () => (
      <TableRow aria-rowindex={1}>
        {columns.map((col) => (
          <TableHead key={col.key} className={col.className}>
            {col.header}
          </TableHead>
        ))}
      </TableRow>
    ),
    [columns]
  );

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card shadow-[var(--shadow-sm)] border border-border/50 overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  // -- Non-virtualized path (small lists) ------------------------------------
  if (!shouldVirtualize) {
    return (
      <div className="rounded-lg bg-card shadow-[var(--shadow-sm)] border border-border/50 overflow-hidden">
        <div className="relative w-full overflow-x-auto">
          <Table
            className="min-w-full"
            style={minWidth ? { minWidth } : undefined}
            role="grid"
            aria-label={ariaLabel}
            aria-rowcount={data.length + 1}
          >
            <TableHeader className={stickyHeader ? "sticky top-0 bg-card z-10" : undefined}>
              {headerRow}
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => (
                  <TableRow
                    key={resolveKey(row, idx)}
                    aria-rowindex={idx + 2}
                    className={cn(
                      onRowClick && "cursor-pointer",
                      typeof rowClassName === "function" ? rowClassName(row) : rowClassName
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render
                          ? col.render(row)
                          : ((row[col.key] as React.ReactNode) ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // -- Virtualized path (large lists) ----------------------------------------
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <div className="rounded-lg bg-card shadow-[var(--shadow-sm)] border border-border/50 overflow-hidden">
      <div
        ref={scrollParentRef}
        className="relative w-full overflow-auto"
        style={{ maxHeight }}
      >
        <Table
          className="min-w-full"
          style={minWidth ? { minWidth } : undefined}
          role="grid"
          aria-label={ariaLabel}
          aria-rowcount={data.length + 1}
        >
          <TableHeader className={stickyHeader ? "sticky top-0 bg-card z-10" : undefined}>
            {headerRow}
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columns.length}
                  style={{ height: `${paddingTop}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = data[virtualRow.index];
              if (!row) return null;
              return (
                <TableRow
                  key={resolveKey(row, virtualRow.index)}
                  data-index={virtualRow.index}
                  ref={(el) => el && rowVirtualizer.measureElement(el)}
                  aria-rowindex={virtualRow.index + 2}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    typeof rowClassName === "function" ? rowClassName(row) : rowClassName
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : ((row[col.key] as React.ReactNode) ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columns.length}
                  style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
