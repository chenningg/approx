const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDisplayDate(
  value: string | null,
  isDate: boolean,
): string | null {
  if (!isDate || value === null) return value
  const match = value.match(ISO_DATE)
  if (!match) return value
  return `${match[3]}-${match[2]}-${match[1]}`
}

const DISPLAY_DATE = /^(\d{2})-(\d{2})-(\d{4})$/

export function toIsoDate(value: string): string {
  const match = value.trim().match(DISPLAY_DATE)
  if (!match) return value
  return `${match[3]}-${match[2]}-${match[1]}`
}
