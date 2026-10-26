import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
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

type PaneKey = "original" | "synthetic";

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
      aria-label={`${label} rows`}
      className="h-full min-h-0 min-w-0 overflow-auto"
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
              className="sticky left-0 z-30 flex h-12 shrink-0 items-center justify-center border-r border-border/60 bg-background text-[11px] text-muted-foreground"
            >
              #
            </div>
            {columns.map((column) => (
              <div
                key={`${valuesKey}-${column.index}`}
                style={{ width: COLUMN_WIDTH }}
                className={cn(
                  "flex h-12 shrink-0 flex-col justify-center border-r border-border/40 px-2",
                  synthetic && "bg-primary/5",
                )}
              >
                <span
                  className="truncate text-xs font-medium"
                  title={column.header}
                >
                  {column.header}
                </span>
                <span
                  className={cn(
                    "truncate text-[10px] uppercase tracking-wide text-muted-foreground",
                    synthetic && "text-primary/70",
                  )}
                >
                  {column.sdtype}
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
                className="group/row absolute left-0 top-0 flex border-b border-border/40 transition-colors"
                style={{
                  width: contentWidth,
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <div
                  style={{ width: GUTTER_WIDTH }}
                  className="sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-border/60 bg-background px-2 text-[11px] tabular-nums text-muted-foreground transition-colors group-hover/row:bg-muted/20"
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
                        "flex shrink-0 items-center truncate border-r border-border/40 px-2 text-xs text-foreground/90 transition-colors group-hover/row:bg-muted/20",
                        synthetic &&
                          "bg-primary/5 group-hover/row:bg-primary/10",
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

function PaneButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className="flex-1"
    >
      {children}
    </Button>
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
  const [activePane, setActivePane] = useState<PaneKey>("original");
  const [compact, setCompact] = useState(false);
  const rowHeight = compact ? 30 : ROW_HEIGHT;

  const originalVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => originalRef.current,
    estimateSize: () => rowHeight,
    overscan: 14,
  });
  const syntheticVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => syntheticRef.current,
    estimateSize: () => rowHeight,
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      originalVirtualizer.measure();
      syntheticVirtualizer.measure();
    });
    return () => cancelAnimationFrame(frame);
  }, [activePane, rowHeight, originalVirtualizer, syntheticVirtualizer]);

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
    if (Math.abs(targetElement.scrollLeft - sourceElement.scrollLeft) > 1) {
      targetElement.scrollLeft = sourceElement.scrollLeft;
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 p-2">
        <div className="flex flex-1 items-center gap-1 md:hidden">
          <PaneButton
            active={activePane === "original"}
            onClick={() => setActivePane("original")}
          >
            Original
          </PaneButton>
          <PaneButton
            active={activePane === "synthetic"}
            onClick={() => setActivePane("synthetic")}
          >
            Synthetic
          </PaneButton>
        </div>
        <Button
          type="button"
          size="xs"
          variant={compact ? "secondary" : "ghost"}
          aria-pressed={compact}
          onClick={() => setCompact((value) => !value)}
          className="ml-auto text-[11px]"
        >
          {compact ? "Comfortable rows" : "Compact rows"}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2 md:divide-x md:divide-border/60">
        <div
          className={cn(
            "min-h-0 min-w-0",
            activePane !== "original" && "hidden md:block",
          )}
        >
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
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0",
            activePane !== "synthetic" && "hidden md:block",
          )}
        >
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
      </div>
    </div>
  );
}
