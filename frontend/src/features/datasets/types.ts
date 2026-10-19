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
  | 'AGE'
  | 'GENDER'
  | 'TITLE'
  | 'ADDRESS'
  | 'NAME'
  | 'UNKNOWN'

export type Sensitivity =
  | 'PII'
  | 'INDIRECT_PII'
  | 'SENSITIVE'
  | 'NON_SENSITIVE'
  | 'UNKNOWN'

export interface ColumnInfo {
  index: number
  header: string | null
  detected_type: DetectedType
  sensitivity: Sensitivity
  confidence: number
  sample_values: string[]
  default_action: ColumnAction | null
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

export type ColumnAction = 'remove' | 'keep' | 'redact' | 'generalize'

export const COLUMN_ACTIONS: { value: ColumnAction; label: string }[] = [
  { value: 'remove', label: 'Remove' },
  { value: 'keep', label: 'Keep' },
  { value: 'redact', label: 'Redact' },
  { value: 'generalize', label: 'Generalize' },
]

const DEFAULT_ACTIONS: Record<Sensitivity, ColumnAction> = {
  PII: 'redact',
  INDIRECT_PII: 'generalize',
  SENSITIVE: 'redact',
  NON_SENSITIVE: 'keep',
  UNKNOWN: 'keep',
}

export function defaultActionFor(sensitivity: Sensitivity): ColumnAction {
  return DEFAULT_ACTIONS[sensitivity] ?? 'keep'
}

export type RedactMode = 'type_aware' | 'custom'

export interface RedactConfig {
  mode: RedactMode
  percentage: number
}

export interface ColumnConfig {
  action: ColumnAction
  redact: RedactConfig
}

export const DEFAULT_REDACT: RedactConfig = {
  mode: 'type_aware',
  percentage: 100,
}

export function defaultColumnConfig(column: ColumnInfo): ColumnConfig {
  return {
    action: column.default_action ?? defaultActionFor(column.sensitivity),
    redact: { ...DEFAULT_REDACT },
  }
}