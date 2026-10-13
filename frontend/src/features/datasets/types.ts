export type DetectedType =
  | 'NRIC'
  | 'CARD'
  | 'DOB'
  | 'GENDER'
  | 'ADDRESS'
  | 'NAME'
  | 'UNKNOWN'

export interface ColumnInfo {
  index: number
  header: string | null
  detected_type: DetectedType
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

const DEFAULT_ACTIONS: Record<DetectedType, ColumnAction> = {
  NRIC: 'redact',
  CARD: 'redact',
  NAME: 'redact',
  DOB: 'k_anonymity',
  GENDER: 'k_anonymity',
  ADDRESS: 'k_anonymity',
  UNKNOWN: 'keep',
}

export function defaultActionFor(type: DetectedType): ColumnAction {
  return DEFAULT_ACTIONS[type] ?? 'keep'
}
