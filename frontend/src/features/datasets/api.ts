import { config } from '@/config'

import type { DatasetPreview, RowsPage } from './types'

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
