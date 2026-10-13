import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { uploadDataset } from "@/features/datasets/api";
import { datasetKey } from "@/features/datasets/queries";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function isExcelFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: uploadDataset,
    onSuccess: (dataset) => {
      queryClient.setQueryData(datasetKey(dataset.id), dataset);
      navigate({
        to: "/datasets/$datasetId",
        params: { datasetId: dataset.id },
      });
    },
  });

  function selectFile(next: File | null) {
    if (!next) return;
    if (!isExcelFile(next)) {
      setError("Only .xlsx Excel files are supported.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      setError("File is larger than the 50 MB limit.");
      return;
    }
    setError(null);
    upload.reset();
    setFile(next);
  }

  function clearFile() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Upload a dataset
        </h2>
        <p className="text-sm text-muted-foreground">
          Add an Excel workbook and ApproX will learn its structure to generate
          representative synthetic data.
        </p>
      </div>

      <div className="space-y-4">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloudIcon className="size-6" />
          </div>
          <div>
            <p className="font-medium">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground">
              Excel workbook (.xlsx), up to 50 MB
            </p>
          </div>
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          disabled={!file || upload.isPending}
          onClick={() => file && upload.mutate(file)}
        >
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>

        {upload.isError && (
          <p className="text-sm text-destructive">
            {upload.error instanceof Error
              ? upload.error.message
              : "Upload failed. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/upload")({
  component: UploadPage,
});
