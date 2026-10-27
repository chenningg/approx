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
  | 'NUMERIC'
  | 'TEXT'
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
  datetime_min: string | null
  datetime_max: string | null
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

export interface ProcessStatus {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  phase: string
  processed_rows: number
  total_rows: number
  error: string | null
  export_filename: string | null
  output_columns: number | null
  output_rows: number | null
}

export type ColumnAction = 'remove' | 'keep' | 'redact' | 'generalize'

export const COLUMN_ACTIONS: { value: ColumnAction; label: string }[] = [
  { value: 'remove', label: 'Remove' },
  { value: 'keep', label: 'Keep' },
  { value: 'redact', label: 'Redact' },
  { value: 'generalize', label: 'Generalize' },
]

const GENERALIZE_TYPES: DetectedType[] = ['AGE', 'NUMERIC', 'DOB', 'DATE']
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
  { value: 'age', label: 'Age (Numeric)', hint: 'Fixed-width year bands, e.g. 20-29.' },
  {
    value: 'dob',
    label: 'Date (General)',
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

export type SyntheticSdtype =
  | 'id'
  | 'numerical'
  | 'categorical'
  | 'text'
  | 'boolean'
  | 'datetime'
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'phone_number'
  | 'street_address'
  | 'city'
  | 'postcode'
  | 'country_code'
  | 'credit_card_number'
  | 'passport_number'
  | 'ssn'
  | 'ipv4_address'
  | 'ipv6_address'

export const SYNTHETIC_SDTYPES: { value: SyntheticSdtype; label: string }[] = [
  { value: 'categorical', label: 'Categorical' },
  { value: 'numerical', label: 'Numerical' },
  { value: 'text', label: 'Text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'datetime', label: 'Date / Time' },
  { value: 'id', label: 'Identifier' },
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'phone_number', label: 'Phone number' },
  { value: 'street_address', label: 'Street address' },
  { value: 'city', label: 'City' },
  { value: 'postcode', label: 'Postcode' },
  { value: 'country_code', label: 'Country code' },
  { value: 'credit_card_number', label: 'Credit card number' },
  { value: 'passport_number', label: 'Passport number' },
  { value: 'ssn', label: 'SSN' },
  { value: 'ipv4_address', label: 'IPv4 address' },
  { value: 'ipv6_address', label: 'IPv6 address' },
]

export const PII_SDTYPES: SyntheticSdtype[] = [
  'email',
  'first_name',
  'last_name',
  'phone_number',
  'street_address',
  'city',
  'postcode',
  'country_code',
  'credit_card_number',
  'passport_number',
  'ssn',
  'ipv4_address',
  'ipv6_address',
]

export function supportsPii(sdtype: SyntheticSdtype): boolean {
  return PII_SDTYPES.includes(sdtype)
}

export const BOUNDED_SDTYPES: SyntheticSdtype[] = ['numerical', 'datetime']

export function supportsRange(sdtype: SyntheticSdtype): boolean {
  return BOUNDED_SDTYPES.includes(sdtype)
}

export interface SyntheticColumnDefaults {
  index: number
  header: string
  sdtype: SyntheticSdtype
  pii: boolean
  min_value: string | null
  max_value: string | null
}

export interface SyntheticDefaults {
  table_name: string
  suggested_primary_key: number | null
  default_num_rows: number
  columns: SyntheticColumnDefaults[]
}

export interface SyntheticColumnConfig {
  index: number
  sdtype: SyntheticSdtype
  pii: boolean
  min_value: string | null
  max_value: string | null
}

export interface SyntheticRequest {
  table_name: string
  primary_key: number | null
  num_rows: number
  columns: SyntheticColumnConfig[]
}

export interface SyntheticStatus {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  phase: string
  total_rows: number
  error: string | null
  export_filename: string | null
  output_rows: number | null
}

export interface ComparisonColumn {
  index: number
  header: string
  sdtype: string
}

export interface ComparisonRow {
  original: (string | null)[]
  synthetic: (string | null)[]
}

export interface SyntheticComparison {
  offset: number
  limit: number
  total: number
  original_total: number
  synthetic_total: number
  columns: ComparisonColumn[]
  rows: ComparisonRow[]
}

export interface EvaluationTable {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}

export interface EvaluationPlot {
  data: unknown[]
  layout: Record<string, unknown>
  frames?: unknown[]
}

export interface EvaluationProperty {
  property: string
  score: number | null
  details: EvaluationTable
  plot: EvaluationPlot | null
}

export interface EvaluationReport {
  report: 'quality' | 'diagnostic'
  score: number | null
  properties: EvaluationProperty[]
}

export interface SyntheticEvaluation {
  quality: EvaluationReport
  diagnostic: EvaluationReport
  sampled: boolean
  sample_rows: number
  original_sample_rows: number
  synthetic_sample_rows: number
  original_rows: number
  synthetic_rows: number
  generated_at: string
}

export interface ColumnPlotResponse {
  plot: Record<string, unknown> | null
}

export interface MLEvaluationRequest {
  target_column: string
  test_size: number
}

export interface MLEvaluationResponse {
  target_column: string
  task_type: 'classification' | 'regression'
  n_features: number
  n_samples_original: number
  n_samples_synthetic: number
  train_size_original: number
  test_size_original: number
  train_size_synthetic: number
  test_size_synthetic: number
  class_labels: string[] | null
  original_train_original_test: Record<string, number>
  original_train_synthetic_test: Record<string, number>
  synthetic_train_synthetic_test: Record<string, number>
  synthetic_train_original_test: Record<string, number>
  confusion_matrix_orig_train_orig_test: number[][] | null
  confusion_matrix_orig_train_synth_test: number[][] | null
  confusion_matrix_synth_train_synth_test: number[][] | null
  confusion_matrix_synth_train_orig_test: number[][] | null
}