import { Badge } from '@/components/ui/badge'
import type { Sensitivity } from '@/features/datasets/types'
import { cn } from '@/lib/utils'

const STYLES: Record<Sensitivity, { label: string; className: string }> = {
  PII: {
    label: 'PII',
    className: 'border-red-500/40 bg-red-500/10 text-red-400',
  },
  INDIRECT_PII: {
    label: 'Indirect PII',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  },
  SENSITIVE: {
    label: 'Sensitive',
    className: 'border-violet-500/40 bg-violet-500/10 text-violet-400',
  },
  UNKNOWN: {
    label: 'Low risk',
    className: 'border-border bg-muted text-muted-foreground',
  },
}

interface SensitivityBadgeProps {
  sensitivity: Sensitivity
}

export function SensitivityBadge({ sensitivity }: SensitivityBadgeProps) {
  const style = STYLES[sensitivity] ?? STYLES.UNKNOWN

  return (
    <Badge
      variant="outline"
      className={cn('font-normal', style.className)}
      title={`Classified as ${style.label}`}
    >
      <span className="truncate">{style.label}</span>
    </Badge>
  )
}