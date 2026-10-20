import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  availableActionsFor,
  type ColumnAction,
  type ColumnInfo,
} from '@/features/datasets/types'
import { cn } from '@/lib/utils'

interface ColumnActionSelectProps {
  column: ColumnInfo
  value: ColumnAction
  onChange: (action: ColumnAction) => void
  className?: string
}

export function ColumnActionSelect({
  column,
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
        {availableActionsFor(column).map((action) => (
          <SelectItem key={action.value} value={action.value}>
            {action.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
