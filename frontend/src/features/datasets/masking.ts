import type { DetectedType, RedactConfig } from './types'

function isSpace(char: string): boolean {
  return /\s/.test(char)
}

function maskNonSpace(value: string, keepStart: number, keepEnd: number): string {
  const chars = value.split('')
  const positions: number[] = []
  chars.forEach((char, index) => {
    if (!isSpace(char)) positions.push(index)
  })
  const total = positions.length
  const maskCount = Math.max(0, total - keepStart - keepEnd)
  for (let order = keepStart; order < keepStart + maskCount; order += 1) {
    chars[positions[order]] = '*'
  }
  return chars.join('')
}

function maskTrailing(value: string, percentage: number): string {
  const total = value.split('').filter((char) => !isSpace(char)).length
  if (total === 0) return value
  const count =
    percentage >= 100
      ? total
      : Math.max(1, Math.round((total * percentage) / 100))
  return maskNonSpace(value, total - count, 0)
}

function maskEmail(value: string): string {
  const at = value.indexOf('@')
  if (at <= 0 || at === value.length - 1) return maskNonSpace(value, 0, 0)
  return `${value.slice(0, 1)}***${value.slice(at)}`
}

function maskUrl(value: string): string {
  const match = value.match(/^(https?:\/\/)?([^/?#]+)/i)
  if (!match) return maskNonSpace(value, 0, 0)
  const scheme = match[1] ?? ''
  const host = match[2]
  const dot = host.lastIndexOf('.')
  if (dot <= 0) return `${scheme}${maskNonSpace(host, 0, 0)}`
  return `${scheme}****${host.slice(dot)}`
}

function maskIp(value: string): string {
  const parts = value.split('.')
  if (parts.length !== 4) return maskNonSpace(value, 0, 0)
  return `***.***.***.${parts[3]}`
}

function maskDate(value: string): string {
  const year = value.match(/\b(?:19|20)\d{2}\b/)
  if (!year || year.index === undefined) return maskNonSpace(value, 0, 0)
  const start = year.index
  const end = start + year[0].length
  return value
    .split('')
    .map((char, index) => {
      if (!/[A-Za-z0-9]/.test(char)) return char
      return index >= start && index < end ? char : '*'
    })
    .join('')
}

export function maskValue(
  type: DetectedType,
  value: string | null,
  redact: RedactConfig,
): string | null {
  if (value === null) return null
  if (value.trim() === '') return value
  if (redact.mode === 'custom') return maskTrailing(value, redact.percentage)
  switch (type) {
    case 'EMAIL':
      return maskEmail(value)
    case 'URL':
      return maskUrl(value)
    case 'IP_ADDRESS':
      return maskIp(value)
    case 'DOB':
    case 'DATE':
      return maskDate(value)
    case 'PHONE':
    case 'CARD':
      return maskNonSpace(value, 0, 4)
    case 'NRIC':
    case 'PASSPORT':
    case 'DRIVING_LICENSE':
      return maskNonSpace(value, 1, 4)
    default:
      return maskNonSpace(value, 0, 0)
  }
}
