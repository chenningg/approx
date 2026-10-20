const NUMERIC_WITH_DECIMAL = /^-?\d+(?:\.\d+)?$/
const NUMERIC_WITH_THOUSANDS = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/

export function parseNumber(value: string): number | null {
  const candidate = value
    .trim()
    .replace(/%\s*$/, '')
    .replace(/\s+/g, '')
    .replace(/^[$€£¥¤]+|[$€£¥¤]+$/g, '')
  if (
    NUMERIC_WITH_DECIMAL.test(candidate) ||
    NUMERIC_WITH_THOUSANDS.test(candidate)
  ) {
    return Number(candidate.replace(/,/g, ''))
  }
  return null
}
