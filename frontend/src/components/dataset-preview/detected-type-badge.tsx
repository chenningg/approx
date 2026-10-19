import { Badge } from '@/components/ui/badge'
import type { DetectedType } from '@/features/datasets/types'
import { cn } from '@/lib/utils'

const STYLES: Record<DetectedType, { label: string; className: string }> = {
  NRIC: {
    label: 'NRIC',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
  PASSPORT: {
    label: 'Passport',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  },
  DRIVING_LICENSE: {
    label: 'Driving licence',
    className: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  },
  CARD: {
    label: 'Card number',
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
  PHONE: {
    label: 'Phone',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  EMAIL: {
    label: 'Email',
    className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  },
  URL: {
    label: 'URL',
    className: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
  },
  IP_ADDRESS: {
    label: 'IP address',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  DOB: {
    label: 'Date of birth',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  DATE: {
    label: 'Date',
    className: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
  },
  AGE: {
    label: 'Age',
    className: 'border-pink-500/30 bg-pink-500/10 text-pink-400',
  },
  GENDER: {
    label: 'Gender',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
  TITLE: {
    label: 'Title',
    className: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  },
  ADDRESS: {
    label: 'Address',
    className: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
  },
  NAME: {
    label: 'Name',
    className: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400',
  },
  UNKNOWN: {
    label: 'Not detected',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

interface DetectedTypeBadgeProps {
  type: DetectedType
  confidence: number
}

export function detectedTypeLabel(type: DetectedType): string {
  return (STYLES[type] ?? STYLES.UNKNOWN).label
}

export function DetectedTypeBadge({
  type,
  confidence,
}: DetectedTypeBadgeProps) {
  const style = STYLES[type] ?? STYLES.UNKNOWN
  const showConfidence = type !== 'UNKNOWN' && confidence > 0

  return (
    <Badge
      variant="outline"
      className={cn('font-normal', style.className)}
      title={
        showConfidence
          ? `Detected as ${style.label} (${Math.round(confidence * 100)}% confidence)`
          : 'No sensitive data detected'
      }
    >
      <span className="truncate">{style.label}</span>
      {showConfidence && (
        <span className="opacity-70">{Math.round(confidence * 100)}%</span>
      )}
    </Badge>
  )
}