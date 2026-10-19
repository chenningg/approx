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
import type { ColumnInfo } from '@/features/datasets/types'

interface GeneralizeDialogProps {
  open: boolean
  column: ColumnInfo | null
  onOpenChange: (open: boolean) => void
}

export function GeneralizeDialog({
  open,
  column,
  onOpenChange,
}: GeneralizeDialogProps) {
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
                Options for generalizing this column are coming soon.
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              This column is currently left unchanged. Generalization settings
              will be available in a future update.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" size="sm">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
