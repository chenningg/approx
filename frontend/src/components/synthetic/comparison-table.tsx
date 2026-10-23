import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import type {
  ComparisonColumn,
  ComparisonRow,
} from "@/features/datasets/types";

const ROW_HEIGHT = 36;
const COLUMN_WIDTH = 200;
const GUTTER_WIDTH = 56;
const LOAD_MORE_THRESHOLD = 25;

interface ComparisonTableProps {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  originalTotal: number;
  syntheticTotal: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export function ComparisonTable({
  columns,
  rows,
  originalTotal,
  syntheticTotal,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ComparisonTableProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem) return;
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastItem.index >= rows.length - LOAD_MORE_THRESHOLD
    ) {
      onLoadMore();
    }
  }, [lastItem, hasNextPage, isFetchingNextPage, rows.length, onLoadMore]);

  const groupWidth = columns.length * COLUMN_WIDTH;
  const contentWidth = GUTTER_WIDTH + groupWidth * 2;

  return (
    <div
      ref={bodyRef}
      className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60"
    >
      <div style={{ width: contentWidth }}>
        <div className="sticky top-0 z-20 border-b border-border/60 bg-background">
          <div className="flex h-9 items-center text-xs font-semibold">
            <div
              style={{ width: GUTTER_WIDTH }}
              className="sticky left-0 z-30 flex h-full shrink-0 items-center justify-center border-r border-border/60 bg-background text-[11px] text-muted-foreground"
            >
              #
            </div>
            <div
              style={{ width: groupWidth }}
              className="flex h-full shrink-0 items-center px-3 text-muted-foreground"
            >
              Original · {originalTotal.toLocaleString()} rows
            </div>
            <div
              style={{ width: groupWidth }}
              className="flex h-full shrink-0 items-center border-l-2 border-primary/30 bg-primary/5 px-3 text-primary"
            >
              Synthetic · {syntheticTotal.toLocaleString()} rows
            </div>
          </div>
          <div className="flex">
            <div
              style={{ width: GUTTER_WIDTH }}
              className="sticky left-0 z-30 flex h-10 shrink-0 items-center justify-center border-r border-border/60 bg-background text-[11px] text-muted-foreground"
            >
              #
            </div>
            {columns.map((column) => (
              <div
                key={`original-${column.index}`}
                style={{ width: COLUMN_WIDTH }}
                className="flex h-10 shrink-0 items-center border-r border-border/40 px-2"
              >
                <span
                  className="truncate text-xs font-medium"
                  title={column.header}
                >
                  {column.header}
                </span>
              </div>
            ))}
            {columns.map((column) => (
              <div
                key={`synthetic-${column.index}`}
                style={{ width: COLUMN_WIDTH }}
                className="flex h-10 shrink-0 items-center border-r border-border/40 bg-primary/5 px-2"
              >
                <span
                  className="truncate text-xs font-medium"
                  title={column.header}
                >
                  {column.header}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => {
            const row = rows[item.index];
            return (
              <div
                key={item.key}
                data-index={item.index}
                className="absolute left-0 top-0 flex border-b border-border/40"
                style={{
                  width: contentWidth,
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <div
                  style={{ width: GUTTER_WIDTH }}
                  className="sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-border/60 bg-background px-2 text-[11px] tabular-nums text-muted-foreground"
                >
                  {item.index + 1}
                </div>
                {columns.map((column, position) => {
                  const value = row?.original[position];
                  return (
                    <div
                      key={`original-${column.index}`}
                      style={{ width: COLUMN_WIDTH }}
                      title={value ?? undefined}
                      className="flex shrink-0 items-center truncate border-r border-border/40 px-2 text-xs text-foreground/90"
                    >
                      <span className="truncate">{value ?? ""}</span>
                    </div>
                  );
                })}
                {columns.map((column, position) => {
                  const value = row?.synthetic[position];
                  return (
                    <div
                      key={`synthetic-${column.index}`}
                      style={{ width: COLUMN_WIDTH }}
                      title={value ?? undefined}
                      className="flex shrink-0 items-center truncate border-r border-border/40 bg-primary/5 px-2 text-xs text-foreground/90"
                    >
                      <span className="truncate">{value ?? ""}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No rows to compare.
        </p>
      )}
      {isFetchingNextPage && (
        <p className="border-t border-border/40 p-3 text-center text-xs text-muted-foreground">
          Loading more rows…
        </p>
      )}
    </div>
  );
}
