import { detectedTypeLabel } from './detected-type-badge'
import { Badge } from '@/components/ui/badge'
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
import { generalizeValue } from '@/features/datasets/generalize'
import {
  AGE_BANDS,
  DOB_WIDTHS,
  GENERALIZE_METHODS,
  defaultGeneralizeFor,
  type ColumnInfo,
  type GeneralizeConfig,
} from '@/features/datasets/types'
import { cn } from '@/lib/utils'

interface GeneralizeDialogProps {
  open: boolean
  column: ColumnInfo | null
  config: GeneralizeConfig
  onOpenChange: (open: boolean) => void
  onChange: (config: GeneralizeConfig) => void
}

export function GeneralizeDialog({
  open,
  column,
  config,
  onOpenChange,
  onChange,
}: GeneralizeDialogProps) {
  const type = column?.detected_type ?? 'UNKNOWN'
  const sample =
    column?.sample_values.find((value) => value.trim() !== '') ?? ''
  const preview = column && sample ? generalizeValue(column, sample, config) : ''
  const recommended = column ? defaultGeneralizeFor(column).method : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {column && (
          <>
            <DialogHeader>
              <DialogTitle>
                Generalize: {column.header ?? `Column ${column.index + 1}`}
              </DialogTitle>
              <DialogDescription>
                Group {detectedTypeLabel(type)} values into ranges.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              {GENERALIZE_METHODS.map((method) => (
                <div
                  key={method.value}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/40',
                    config.method === method.value
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border',
                  )}
                  onClick={() => onChange({ ...config, method: method.value })}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{method.label}</p>
                    {recommended === method.value && (
                      <Badge>Recommended</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {method.hint}
                  </p>
                </div>
              ))}

              {config.method === 'age' && (
                <div>
                  <p className="text-sm font-medium">Band width (years)</p>
                  <div className="mt-2 flex gap-2">
                    {AGE_BANDS.map((band) => (
                      <Button
                        key={band}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={config.ageBand === band}
                        className={cn(
                          config.ageBand === band &&
                            'border-primary/40 bg-primary/5',
                        )}
                        onClick={() => onChange({ ...config, ageBand: band })}
                      >
                        {band}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {config.method === 'dob' && (
                <div>
                  <p className="text-sm font-medium">Range width</p>
                  <div className="mt-2 flex gap-2">
                    {DOB_WIDTHS.map((width) => (
                      <Button
                        key={width.value}
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-pressed={config.dobWidth === width.value}
                        className={cn(
                          config.dobWidth === width.value &&
                            'border-primary/40 bg-primary/5',
                        )}
                        onClick={() =>
                          onChange({ ...config, dobWidth: width.value })
                        }
                      >
                        {width.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {config.method === 'numeric' && (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Buckets</p>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {config.buckets}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Equal-width ranges from the column data.
                  </p>
                  <div className="mt-3">
                    <Slider
                      value={[config.buckets]}
                      min={2}
                      max={20}
                      step={1}
                      onValueChange={(next) =>
                        onChange({
                          ...config,
                          buckets: next[0] ?? config.buckets,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {sample && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Preview</p>
                  <p className="mt-1 truncate font-mono text-xs text-foreground">
                    {sample}{' '}
                    <span className="text-muted-foreground">&rarr;</span>{' '}
                    {preview}
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
