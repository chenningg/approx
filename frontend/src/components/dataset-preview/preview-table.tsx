import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'

import { ColumnActionSelect } from './column-action-select'
import { DetectedTypeBadge } from './detected-type-badge'
import type { ColumnAction, ColumnInfo } from '@/features/datasets/types'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 36
const COLUMN_WIDTH = 220
const GUTTER_WIDTH = 56
const LOAD_MORE_THRESHOLD = 25

interface PreviewTableProps {
  columns: ColumnInfo[]
  rows: (string | null)[][]
  actionFor: (column: ColumnInfo) => ColumnAction
  onActionChange: (index: number, action: ColumnAction) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export function PreviewTable({
  columns,
  rows,
  actionFor,
  onActionChange,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: PreviewTableProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const headerTrackRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 14,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]

  useEffect(() => {
    if (!lastItem) return
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastItem.index >= rows.length - LOAD_MORE_THRESHOLD
    ) {
      onLoadMore()
    }
  }, [lastItem, hasNextPage, isFetchingNextPage, rows.length, onLoadMore])

  function handleScroll() {
    if (headerTrackRef.current && bodyRef.current) {
      headerTrackRef.current.style.transform = `translateX(${-bodyRef.current.scrollLeft}px)`
    }
  }

  const contentWidth = GUTTER_WIDTH + columns.length * COLUMN_WIDTH

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-border/60 bg-background">
        <div
          style={{ width: GUTTER_WIDTH }}
          className="flex shrink-0 items-end justify-center border-r border-border/60 px-2 pb-2 text-[11px] font-medium text-muted-foreground"
        >
          #
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={headerTrackRef}
            className="flex will-change-transform"
            style={{ width: contentWidth - GUTTER_WIDTH }}
          >
            {columns.map((column) => (
              <div
                key={column.index}
                style={{ width: COLUMN_WIDTH }}
                className="flex shrink-0 flex-col gap-1.5 border-r border-border/60 p-2"
              >
                <span
                  className="truncate text-xs font-semibold"
                  title={column.header ?? undefined}
                >
                  {column.header ?? `Column ${column.index + 1}`}
                </span>
                <DetectedTypeBadge
                  type={column.detected_type}
                  confidence={column.confidence}
                />
                <ColumnActionSelect
                  value={actionFor(column)}
                  onChange={(action) => onActionChange(column.index, action)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div
          className="relative"
          style={{ width: contentWidth, height: rowVirtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => {
            const row = rows[item.index]
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
                {columns.map((column) => {
                  const value = row?.[column.index]
                  const removed = actionFor(column) === 'remove'
                  return (
                    <div
                      key={column.index}
                      style={{ width: COLUMN_WIDTH }}
                      title={value ?? undefined}
                      className={cn(
                        'flex shrink-0 items-center truncate border-r border-border/40 px-2 text-xs text-foreground/90',
                        removed && 'text-muted-foreground line-through opacity-50',
                      )}
                    >
                      <span className="truncate">{value ?? ''}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
