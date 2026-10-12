import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { uploadDataset } from '@/features/uploads/api'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 50 * 1024 * 1024

function isExcelFile(file: File) {
  const name = file.name.toLowerCase()
  return name.endsWith('.xlsx') || name.endsWith('.xls')
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const upload = useMutation({ mutationFn: uploadDataset })

  function selectFile(next: File | null) {
    if (!next) return
    if (!isExcelFile(next)) {
      setError('Only Excel files (.xlsx or .xls) are supported.')
      return
    }
    if (next.size > MAX_FILE_SIZE) {
      setError('File is larger than the 50 MB limit.')
      return
    }
    setError(null)
    upload.reset()
    setFile(next)
  }

  function clearFile() {
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/60 px-4">
        <SidebarTrigger />
        <h1 className="font-heading text-lg font-semibold">Upload</h1>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Upload a dataset
          </h2>
          <p className="text-sm text-muted-foreground">
            Add an Excel workbook and ApproX will learn its structure to
            generate representative synthetic data.
          </p>
        </div>

        {upload.isSuccess ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <FileSpreadsheetIcon className="size-6" />
            </div>
            <div>
              <p className="font-medium">{upload.data.filename}</p>
              <p className="text-sm text-muted-foreground">
                Uploaded · {formatSize(upload.data.size)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                upload.reset()
                clearFile()
              }}
            >
              Upload another
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 hover:border-primary/50 hover:bg-muted/40',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloudIcon className="size-6" />
              </div>
              <div>
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">
                  Excel workbook (.xlsx or .xls), up to 50 MB
                </p>
              </div>
            </label>

            {file && (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
                <FileSpreadsheetIcon className="size-5 shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove file"
                  onClick={clearFile}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              disabled={!file || upload.isPending}
              onClick={() => file && upload.mutate(file)}
            >
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>

            {upload.isError && (
              <p className="text-sm text-destructive">
                {upload.error instanceof Error
                  ? upload.error.message
                  : 'Upload failed. Please try again.'}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export const Route = createFileRoute('/_app/upload')({
  component: UploadPage,
})