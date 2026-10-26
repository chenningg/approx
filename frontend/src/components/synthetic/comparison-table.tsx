import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";
import type {
  ComparisonColumn,
  ComparisonRow,
} from "@/features/datasets/types";
import type { VirtualItem } from "@tanstack/react-virtual";

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

interface ComparisonPaneProps {
  paneRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  valuesKey: "original" | "synthetic";
  label: string;
  total: number;
  virtualItems: VirtualItem[];
  totalSize: number;
  isFetchingNextPage: boolean;
  synthetic?: boolean;
}

function ComparisonPane({
  paneRef,
  onScroll,
  columns,
  rows,
  valuesKey,
  label,
  total,
  virtualItems,
  totalSize,
  isFetchingNextPage,
  synthetic = false,
}: ComparisonPaneProps) {
  const groupWidth = columns.length * COLUMN_WIDTH;
  const contentWidth = GUTTER_WIDTH + groupWidth;

  return (
    <div
      ref={paneRef}
      onScroll={onScroll}
      className="min-h-0 min-w-0 overflow-auto"
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
              className={cn(
                "flex h-full shrink-0 items-center px-3",
                synthetic
                  ? "border-l-2 border-primary/30 bg-primary/5 text-primary"
                  : "text-muted-foreground",
              )}
            >
              {label} · {total.toLocaleString()} rows
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
                key={`${valuesKey}-${column.index}`}
                style={{ width: COLUMN_WIDTH }}
                className={cn(
                  "flex h-10 shrink-0 items-center border-r border-border/40 px-2",
                  synthetic && "bg-primary/5",
                )}
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

        <div className="relative" style={{ height: totalSize }}>
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
                  const value = row?.[valuesKey][position];
                  return (
                    <div
                      key={`${valuesKey}-${column.index}`}
                      style={{ width: COLUMN_WIDTH }}
                      title={value ?? undefined}
                      className={cn(
                        "flex shrink-0 items-center truncate border-r border-border/40 px-2 text-xs text-foreground/90",
                        synthetic && "bg-primary/5",
                      )}
                    >
                      <span className="truncate">{value ?? ""}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {isFetchingNextPage && (
          <p className="border-t border-border/40 p-3 text-center text-xs text-muted-foreground">
            Loading more rows…
          </p>
        )}
      </div>
    </div>
  );
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
  const originalRef = useRef<HTMLDivElement>(null);
  const syntheticRef = useRef<HTMLDivElement>(null);

  const originalVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => originalRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  });
  const syntheticVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => syntheticRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  });

  const originalItems = originalVirtualizer.getVirtualItems();
  const lastItem = originalItems[originalItems.length - 1];

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

  const syncScroll = (
    source: RefObject<HTMLDivElement | null>,
    target: RefObject<HTMLDivElement | null>,
  ) => {
    const sourceElement = source.current;
    const targetElement = target.current;
    if (!sourceElement || !targetElement) return;
    if (Math.abs(targetElement.scrollTop - sourceElement.scrollTop) > 1) {
      targetElement.scrollTop = sourceElement.scrollTop;
    }
  };

  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No rows to compare.
      </p>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border/60 overflow-hidden rounded-lg border border-border/60">
      <ComparisonPane
        paneRef={originalRef}
        onScroll={() => syncScroll(originalRef, syntheticRef)}
        columns={columns}
        rows={rows}
        valuesKey="original"
        label="Original"
        total={originalTotal}
        virtualItems={originalItems}
        totalSize={originalVirtualizer.getTotalSize()}
        isFetchingNextPage={isFetchingNextPage}
      />
      <ComparisonPane
        paneRef={syntheticRef}
        onScroll={() => syncScroll(syntheticRef, originalRef)}
        columns={columns}
        rows={rows}
        valuesKey="synthetic"
        label="Synthetic"
        total={syntheticTotal}
        virtualItems={syntheticVirtualizer.getVirtualItems()}
        totalSize={syntheticVirtualizer.getTotalSize()}
        isFetchingNextPage={isFetchingNextPage}
        synthetic
      />
    </div>
  );
}
