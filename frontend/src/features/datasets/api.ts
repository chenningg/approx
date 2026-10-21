import { config } from '@/config'

import type {
  ColumnConfig,
  DatasetPreview,
  ProcessStatus,
  RowsPage,
  SyntheticDefaults,
  SyntheticRequest,
  SyntheticStatus,
} from './types'

export async function uploadDataset(file: File): Promise<DatasetPreview> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${config.apiBaseUrl}/datasets`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(
      error?.detail ?? `Upload failed with status ${response.status}`,
    )
  }

  return (await response.json()) as DatasetPreview
}

export async function getDataset(id: string): Promise<DatasetPreview> {
  const response = await fetch(`${config.apiBaseUrl}/datasets/${id}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to load dataset (status ${response.status})`)
  }

  return (await response.json()) as DatasetPreview
}

export async function getDatasetRows(
  id: string,
  offset: number,
  limit: number,
): Promise<RowsPage> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/rows?${params.toString()}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(`Failed to load rows (status ${response.status})`)
  }

  return (await response.json()) as RowsPage
}

export interface ProcessColumnInput {
  index: number
  config: ColumnConfig
}

export async function startProcess(
  id: string,
  columns: ProcessColumnInput[],
): Promise<ProcessStatus> {
  const response = await fetch(`${config.apiBaseUrl}/datasets/${id}/process`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      columns: columns.map(({ index, config: columnConfig }) => ({
        index,
        action: columnConfig.action,
        redact: {
          mode: columnConfig.redact.mode,
          percentage: columnConfig.redact.percentage,
        },
        generalize: {
          method: columnConfig.generalize.method,
          age_band: columnConfig.generalize.ageBand,
          dob_width: columnConfig.generalize.dobWidth,
          buckets: columnConfig.generalize.buckets,
        },
      })),
    }),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(
      error?.detail ?? `Processing failed to start (status ${response.status})`,
    )
  }

  return (await response.json()) as ProcessStatus
}

export async function getProcessStatus(
  id: string,
  jobId: string,
): Promise<ProcessStatus> {
  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/process/${jobId}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to load processing status (status ${response.status})`,
    )
  }

  return (await response.json()) as ProcessStatus
}

export async function downloadProcessed(
  id: string,
  jobId: string,
  filename: string,
): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/process/${jobId}/export`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to download the processed file (status ${response.status})`,
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function readDetail(response: Response): Promise<string | null> {
  const error = (await response.json().catch(() => null)) as {
    detail?: string
  } | null
  return error?.detail ?? null
}

export async function getSyntheticDefaults(
  id: string,
): Promise<SyntheticDefaults> {
  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/synthetic/suggest`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(
      (await readDetail(response)) ??
        `Failed to load synthetic settings (status ${response.status})`,
    )
  }

  return (await response.json()) as SyntheticDefaults
}

export async function startSynthetic(
  id: string,
  request: SyntheticRequest,
): Promise<SyntheticStatus> {
  const response = await fetch(`${config.apiBaseUrl}/datasets/${id}/synthetic`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(
      (await readDetail(response)) ??
        `Synthetic generation failed to start (status ${response.status})`,
    )
  }

  return (await response.json()) as SyntheticStatus
}

export async function getSyntheticStatus(
  id: string,
  jobId: string,
): Promise<SyntheticStatus> {
  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/synthetic/${jobId}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to load synthetic status (status ${response.status})`,
    )
  }

  return (await response.json()) as SyntheticStatus
}

export async function downloadSynthetic(
  id: string,
  jobId: string,
  filename: string,
): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/datasets/${id}/synthetic/${jobId}/export`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to download the synthetic file (status ${response.status})`,
    )
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
