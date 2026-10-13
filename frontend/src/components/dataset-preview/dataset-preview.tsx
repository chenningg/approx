import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { PreviewTable } from './preview-table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  datasetQueryOptions,
  datasetRowsQueryOptions,
} from '@/features/datasets/queries'
import {
  defaultActionFor,
  type ColumnAction,
  type ColumnInfo,
} from '@/features/datasets/types'

interface DatasetPreviewProps {
  id: string
}

export function DatasetPreview({ id }: DatasetPreviewProps) {
  const dataset = useQuery(datasetQueryOptions(id))
  const [actions, setActions] = useState<Record<number, ColumnAction>>({})

  const rowsQuery = useInfiniteQuery({
    ...datasetRowsQueryOptions(id),
    initialData: dataset.data
      ? {
          pages: [
            {
              offset: 0,
              limit: dataset.data.rows.length,
              total: dataset.data.total_rows,
              rows: dataset.data.rows,
            },
          ],
          pageParams: [0],
        }
      : undefined,
  })

  const columns = useMemo(() => dataset.data?.columns ?? [], [dataset.data])
  const rows = useMemo(
    () => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [rowsQuery.data],
  )
  const total = dataset.data?.total_rows ?? rowsQuery.data?.pages[0]?.total ?? 0

  const actionFor = useCallback(
    (column: ColumnInfo) =>
      actions[column.index] ?? defaultActionFor(column.detected_type),
    [actions],
  )

  const handleActionChange = useCallback(
    (index: number, action: ColumnAction) => {
      setActions((prev) => ({ ...prev, [index]: action }))
    },
    [],
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = rowsQuery
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const removedCount = useMemo(
    () =>
      columns.filter(
        (column) =>
          (actions[column.index] ?? defaultActionFor(column.detected_type)) ===
          'remove',
      ).length,
    [columns, actions],
  )

  if (dataset.isPending) {
    return (
      <div className="flex h-[calc(100svh-4rem)] flex-col gap-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  if (dataset.isError) {
    return (
      <div className="flex h-[calc(100svh-4rem)] flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Could not load this dataset</p>
        <p className="text-sm text-muted-foreground">
          {dataset.error instanceof Error
            ? dataset.error.message
            : 'Something went wrong.'}
        </p>
      </div>
    )
  }

  const { filename, sheet } = dataset.data

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} rows · {columns.length} columns · sheet “
            {sheet}”
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {isFetchingNextPage && <span>Loading more rows…</span>}
          {removedCount > 0 && (
            <span>{removedCount} column(s) marked for removal</span>
          )}
        </div>
      </div>

      <PreviewTable
        columns={columns}
        rows={rows}
        actionFor={actionFor}
        onActionChange={handleActionChange}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={handleLoadMore}
      />
    </div>
  )
}
