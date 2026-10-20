import { parseNumber } from './numeric'
import type { ColumnInfo, DobWidth, GeneralizeConfig } from './types'

interface DateParts {
  year: number
  month: number
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

export function numericBounds(
  column: ColumnInfo,
): { min: number; max: number } | null {
  if (column.numeric_min !== null && column.numeric_max !== null) {
    return { min: column.numeric_min, max: column.numeric_max }
  }
  // Datasets stored before the API exposed a numeric range: fall back to
  // the (few) sample values.
  const numbers = column.sample_values
    .map(parseNumber)
    .filter((value): value is number => value !== null)
  if (numbers.length === 0) return null
  return { min: Math.min(...numbers), max: Math.max(...numbers) }
}

function formatBound(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-US')
  return String(Number(value.toFixed(2)))
}

function numericBucketLabel(
  bounds: { min: number; max: number },
  buckets: number,
  value: number,
): string {
  const { min, max } = bounds
  const count = Math.max(1, Math.floor(buckets))
  if (max <= min) return formatBound(min)
  const width = (max - min) / count
  const wholeRange =
    Number.isInteger(min) && Number.isInteger(max) && width >= 1
  const edges: number[] = []
  for (let index = 0; index <= count; index += 1) {
    const edge = min + index * width
    edges.push(wholeRange ? Math.round(edge) : edge)
  }
  const clamped = Math.min(Math.max(value, min), max)
  let bucket = count - 1
  for (let index = 0; index < count; index += 1) {
    if (clamped < edges[index + 1]) {
      bucket = index
      break
    }
  }
  const lower = edges[bucket]
  const upper = edges[bucket + 1]
  return wholeRange && bucket < count - 1
    ? `${formatBound(lower)}-${formatBound(upper - 1)}`
    : `${formatBound(lower)}-${formatBound(upper)}`
}

function ageBandLabel(band: number, age: number): string {
  const width = Math.max(1, Math.floor(band))
  const start = Math.floor(age / width) * width
  return `${start}-${start + width - 1}`
}

function makeParts(year: number, month: number, day: number): DateParts | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month }
}

// Mirrors the backend's DATE_FORMATS (detection.py): year-first, then
// day-first slash/dash dates, then English month names.
function parseDateParts(value: string): DateParts | null {
  const text = value.trim()

  const yearFirst = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/)
  if (yearFirst) {
    return makeParts(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]))
  }

  const dayFirst = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dayFirst) {
    return makeParts(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
  }

  const dayName = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/)
  if (dayName) {
    const month = MONTH_NAMES[dayName[2].toLowerCase()]
    return month ? makeParts(Number(dayName[3]), month, Number(dayName[1])) : null
  }

  const nameDay = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (nameDay) {
    const month = MONTH_NAMES[nameDay[1].toLowerCase()]
    return month ? makeParts(Number(nameDay[3]), month, Number(nameDay[2])) : null
  }

  return null
}

function dobRangeLabel(parts: DateParts, width: DobWidth): string {
  const { year, month } = parts
  switch (width) {
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`
    case 'quarter':
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
    case 'year':
      return `${year}`
    case 'decade': {
      const start = Math.floor(year / 10) * 10
      return `${start}-${start + 9}`
    }
  }
}

export function generalizeValue(
  column: ColumnInfo,
  value: string | null,
  config: GeneralizeConfig,
): string | null {
  if (value === null) return null
  if (value.trim() === '') return value
  switch (config.method) {
    case 'age': {
      const age = parseNumber(value)
      return age === null ? value : ageBandLabel(config.ageBand, age)
    }
    case 'dob': {
      const parts = parseDateParts(value)
      return parts === null ? value : dobRangeLabel(parts, config.dobWidth)
    }
    case 'numeric': {
      const number = parseNumber(value)
      const bounds = numericBounds(column)
      if (number === null || bounds === null) return value
      return numericBucketLabel(bounds, config.buckets, number)
    }
  }
}
