import { Badge } from '@/components/ui/badge'
import type { DetectedType } from '@/features/datasets/types'
import { cn } from '@/lib/utils'

const STYLES: Record<DetectedType, { label: string; className: string }> = {
  NRIC: {
    label: 'NRIC',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
  CARD: {
    label: 'Card number',
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
  DOB: {
    label: 'Date of birth',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  GENDER: {
    label: 'Gender',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
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
