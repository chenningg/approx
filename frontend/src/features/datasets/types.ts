export type DetectedType =
  | 'NRIC'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'CARD'
  | 'PHONE'
  | 'EMAIL'
  | 'URL'
  | 'IP_ADDRESS'
  | 'DOB'
  | 'DATE'
  | 'GENDER'
  | 'ADDRESS'
  | 'NAME'
  | 'UNKNOWN'

export type Sensitivity =
  | 'PII'
  | 'INDIRECT_PII'
  | 'SENSITIVE'
  | 'UNKNOWN'

export interface ColumnInfo {
  index: number
  header: string | null
  detected_type: DetectedType
  sensitivity: Sensitivity
  confidence: number
  sample_values: string[]
}

export interface DatasetPreview {
  id: string
  filename: string
  size: number
  sheet: string
  sheets: string[]
  total_rows: number
  columns: ColumnInfo[]
  rows: (string | null)[][]
}

export interface RowsPage {
  offset: number
  limit: number
  total: number
  rows: (string | null)[][]
}

export type ColumnAction =
  | 'keep'
  | 'remove'
  | 'redact'
  | 'k_anonymity'
  | 'synthetic'

export const COLUMN_ACTIONS: { value: ColumnAction; label: string }[] = [
  { value: 'keep', label: 'Keep' },
  { value: 'remove', label: 'Remove' },
  { value: 'redact', label: 'Redact' },
  { value: 'k_anonymity', label: 'K-anonymity' },
  { value: 'synthetic', label: 'Synthetic' },
]

const DEFAULT_ACTIONS: Record<Sensitivity, ColumnAction> = {
  PII: 'redact',
  INDIRECT_PII: 'k_anonymity',
  SENSITIVE: 'redact',
  UNKNOWN: 'keep',
}

export function defaultActionFor(sensitivity: Sensitivity): ColumnAction {
  return DEFAULT_ACTIONS[sensitivity] ?? 'keep'
}