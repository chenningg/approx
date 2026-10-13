import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  COLUMN_ACTIONS,
  type ColumnAction,
} from '@/features/datasets/types'
import { cn } from '@/lib/utils'

interface ColumnActionSelectProps {
  value: ColumnAction
  onChange: (action: ColumnAction) => void
  className?: string
}

export function ColumnActionSelect({
  value,
  onChange,
  className,
}: ColumnActionSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ColumnAction)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Column action"
        className={cn('w-full', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COLUMN_ACTIONS.map((action) => (
          <SelectItem key={action.value} value={action.value}>
            {action.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
