import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import { getDataset, getDatasetRows, getProcessStatus, getSyntheticDefaults, getSyntheticStatus } from './api'

export const ROWS_PAGE_SIZE = 200

export const datasetKey = (id: string) => ['datasets', id] as const

export const datasetRowsKey = (id: string) =>
  ['datasets', id, 'rows'] as const

export const datasetQueryOptions = (id: string) =>
  queryOptions({
    queryKey: datasetKey(id),
    queryFn: () => getDataset(id),
  })

export const datasetRowsQueryOptions = (id: string) =>
  infiniteQueryOptions({
    queryKey: datasetRowsKey(id),
    queryFn: ({ pageParam }) => getDatasetRows(id, pageParam, ROWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.rows.length
      return next < lastPage.total ? next : undefined
    },
  })

export const processStatusQueryOptions = (id: string, jobId: string) =>
  queryOptions({
    queryKey: ['datasets', id, 'process', jobId],
    queryFn: () => getProcessStatus(id, jobId),
  })

export const syntheticDefaultsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['datasets', id, 'synthetic', 'defaults'],
    queryFn: () => getSyntheticDefaults(id),
    staleTime: Infinity,
  })

export const syntheticStatusQueryOptions = (id: string, jobId: string) =>
  queryOptions({
    queryKey: ['datasets', id, 'synthetic', jobId],
    queryFn: () => getSyntheticStatus(id, jobId),
  })
