import { Settings2Icon } from 'lucide-react'

import { ColumnActionSelect } from './column-action-select'
import { Button } from '@/components/ui/button'
import type { ColumnAction, ColumnInfo } from '@/features/datasets/types'
import { cn } from '@/lib/utils'

const ACTIONS_WITH_SETTINGS: ColumnAction[] = ['redact', 'generalize']

interface ColumnActionControlsProps {
  column: ColumnInfo
  action: ColumnAction
  onActionChange: (action: ColumnAction) => void
  onOpenSettings: () => void
}

export function ColumnActionControls({
  column,
  action,
  onActionChange,
  onOpenSettings,
}: ColumnActionControlsProps) {
  const hasSettings = ACTIONS_WITH_SETTINGS.includes(action)
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <ColumnActionSelect
          column={column}
          value={action}
          onChange={onActionChange}
        />
      </div>
      <span
        className={cn(!hasSettings && 'cursor-not-allowed')}
        title={!hasSettings ? 'No settings for this action' : undefined}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!hasSettings}
          aria-label="Action settings"
          title={
            hasSettings
              ? 'Configure action settings'
              : 'No settings for this action'
          }
          onClick={onOpenSettings}
        >
          <Settings2Icon />
        </Button>
      </span>
    </div>
  )
}
