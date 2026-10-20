import { parseNumber } from './numeric'

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
  numeric_min: number | null
  numeric_max: number | null
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

const GENERALIZE_TYPES: DetectedType[] = ['AGE', 'DOB', 'DATE']
const NUMERIC_SAMPLE_RATIO = 0.6

function isNumericSample(value: string): boolean {
  return parseNumber(value) !== null
}

export function canGeneralize(column: ColumnInfo): boolean {
  if (GENERALIZE_TYPES.includes(column.detected_type)) return true
  if (column.detected_type !== 'UNKNOWN') return false
  const { sample_values: samples } = column
  if (samples.length === 0) return false
  const numeric = samples.filter(isNumericSample).length
  return numeric / samples.length >= NUMERIC_SAMPLE_RATIO
}

export function availableActionsFor(
  column: ColumnInfo,
): { value: ColumnAction; label: string }[] {
  return COLUMN_ACTIONS.filter(
    (action) => action.value !== 'generalize' || canGeneralize(column),
  )
}

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
  generalize: GeneralizeConfig
}

export const DEFAULT_REDACT: RedactConfig = {
  mode: 'type_aware',
  percentage: 100,
}

export type GeneralizeMethod = 'age' | 'dob' | 'numeric'

export type DobWidth = 'month' | 'quarter' | 'year' | 'decade'

export interface GeneralizeConfig {
  method: GeneralizeMethod
  ageBand: number
  dobWidth: DobWidth
  buckets: number
}

export const AGE_BANDS = [3, 5, 10, 20]

export const DOB_WIDTHS: { value: DobWidth; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'decade', label: 'Decade' },
]

export const GENERALIZE_METHODS: {
  value: GeneralizeMethod
  label: string
  hint: string
}[] = [
  { value: 'age', label: 'Age', hint: 'Fixed-width year bands, e.g. 20-29.' },
  {
    value: 'dob',
    label: 'Date of birth',
    hint: 'Month, quarter, year or decade ranges.',
  },
  {
    value: 'numeric',
    label: 'Numeric (General)',
    hint: 'Equal-width buckets from the column data.',
  },
]

export const DEFAULT_GENERALIZE: GeneralizeConfig = {
  method: 'numeric',
  ageBand: 10,
  dobWidth: 'year',
  buckets: 5,
}

export function defaultGeneralizeFor(column: ColumnInfo): GeneralizeConfig {
  const method: GeneralizeMethod =
    column.detected_type === 'AGE'
      ? 'age'
      : column.detected_type === 'DOB' || column.detected_type === 'DATE'
        ? 'dob'
        : 'numeric'
  return { ...DEFAULT_GENERALIZE, method }
}

export function defaultColumnConfig(column: ColumnInfo): ColumnConfig {
  const resolved = column.default_action ?? defaultActionFor(column.sensitivity)
  return {
    action:
      resolved === 'generalize' && !canGeneralize(column) ? 'redact' : resolved,
    redact: { ...DEFAULT_REDACT },
    generalize: defaultGeneralizeFor(column),
  }
}