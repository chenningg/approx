import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getDataset,
  getDatasetRows,
  getProcessStatus,
  getSyntheticComparison,
  getSyntheticDefaults,
  getSyntheticEvaluation,
  getSyntheticStatus,
  getSyntheticColumnPlot,
  isNotFoundError,
  runSyntheticMLEvaluation,
} from './api'

export const ROWS_PAGE_SIZE = 200
export const COMPARISON_PAGE_SIZE = 200

export const datasetKey = (id: string) => ['datasets', id] as const

export const datasetRowsKey = (id: string) =>
  ['datasets', id, 'rows'] as const

const retryOnTransientError = (failureCount: number, error: unknown) =>
  !isNotFoundError(error) && failureCount < 3

export const datasetQueryOptions = (id: string) =>
  queryOptions({
    queryKey: datasetKey(id),
    queryFn: () => getDataset(id),
    retry: retryOnTransientError,
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
    retry: retryOnTransientError,
  })

export const syntheticComparisonQueryOptions = (
  id: string,
  jobId: string,
) =>
  infiniteQueryOptions({
    queryKey: ['datasets', id, 'synthetic', jobId, 'comparison'],
    queryFn: ({ pageParam }) =>
      getSyntheticComparison(id, jobId, pageParam, COMPARISON_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.rows.length
      return next < lastPage.total ? next : undefined
    },
  })

export const syntheticEvaluationQueryOptions = (
  id: string,
  jobId: string,
) =>
  queryOptions({
    queryKey: ['datasets', id, 'synthetic', jobId, 'evaluation'],
    queryFn: () => getSyntheticEvaluation(id, jobId),
    staleTime: Infinity,
  })

export const syntheticColumnPlotQueryOptions = (
  id: string,
  jobId: string,
  columnName: string,
) =>
  queryOptions({
    queryKey: ['datasets', id, 'synthetic', jobId, 'column-plot', columnName],
    queryFn: () => getSyntheticColumnPlot(id, jobId, columnName),
    enabled: !!columnName,
    staleTime: Infinity,
  })

export const syntheticMLEvaluationMutationOptions = (
  id: string,
  jobId: string,
) =>
  queryOptions({
    queryKey: ['datasets', id, 'synthetic', jobId, 'ml-evaluation'],
    queryFn: () => runSyntheticMLEvaluation(id, jobId, { target_column: '', test_size: 0.2 }),
    enabled: false, // Manual trigger only
  })
