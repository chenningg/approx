import { detectedTypeLabel } from './detected-type-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { maskValue } from '@/features/datasets/masking'
import {
  DEFAULT_REDACT,
  type ColumnInfo,
  type RedactConfig,
} from '@/features/datasets/types'
import { cn } from '@/lib/utils'

interface RedactDialogProps {
  open: boolean
  column: ColumnInfo | null
  config: RedactConfig
  onOpenChange: (open: boolean) => void
  onChange: (config: RedactConfig) => void
}

export function RedactDialog({
  open,
  column,
  config,
  onOpenChange,
  onChange,
}: RedactDialogProps) {
  const type = column?.detected_type ?? 'UNKNOWN'
  const sample =
    column?.sample_values.find((value) => value.trim() !== '') ?? ''
  const isCustom = config.mode === 'custom'
  const sliderValue = config.percentage
  const preview = sample ? maskValue(type, sample, config) : ''
  const defaultPreview = sample ? maskValue(type, sample, DEFAULT_REDACT) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {column && (
          <>
            <DialogHeader>
              <DialogTitle>
                Redact: {column.header ?? `Column ${column.index + 1}`}
              </DialogTitle>
              <DialogDescription>
                Mask values detected as {detectedTypeLabel(type)}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div
                className={cn(
                  'cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/40',
                  !isCustom
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border',
                )}
                onClick={() => onChange({ ...config, mode: 'type_aware' })}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">Default masking</p>
                  <p className="text-xs text-muted-foreground">
                    Type-aware masking for {detectedTypeLabel(type)}.
                  </p>
                </div>
                {sample && (
                  <p className="mt-2 truncate font-mono text-xs text-foreground/80">
                    {sample}{' '}
                    <span className="text-muted-foreground">&rarr;</span>{' '}
                    {defaultPreview}
                  </p>
                )}
              </div>

              <div
                className={cn(
                  'cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/40',
                  isCustom
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border',
                )}
                onClick={() => onChange({ ...config, mode: 'custom' })}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Custom masking</p>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {sliderValue}%
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mask more characters from the end as asterisks.
                </p>
                <div
                  className="mt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Slider
                    value={[sliderValue]}
                    min={1}
                    max={100}
                    step={1}
                    onValueChange={(next) =>
                      onChange({
                        ...config,
                        percentage: next[0] ?? config.percentage,
                      })
                    }
                  />
                </div>
              </div>

              {sample && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Preview</p>
                  <p className="mt-1 truncate font-mono text-xs text-foreground">
                    {preview || '—'}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" size="sm">
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
