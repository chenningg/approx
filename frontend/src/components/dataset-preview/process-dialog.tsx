import { useQuery } from "@tanstack/react-query";
import {
  DownloadIcon,
  Loader2Icon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { downloadProcessed } from "@/features/datasets/api";
import { processStatusQueryOptions } from "@/features/datasets/queries";
import { cn } from "@/lib/utils";

interface ProcessDialogProps {
  open: boolean;
  datasetId: string;
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

interface ChoiceCardProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
}

function ChoiceCard({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled = false,
  busy = false,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 cursor-pointer rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50",
        (disabled || busy) &&
          "cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        {busy ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {disabled && <Badge variant="secondary">Coming soon</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}

export function ProcessDialog({
  open,
  datasetId,
  jobId,
  onOpenChange,
  onRetry,
}: ProcessDialogProps) {
  const [display, setDisplay] = useState(0);
  const [exporting, setExporting] = useState(false);

  const statusQuery = useQuery({
    ...processStatusQueryOptions(datasetId, jobId ?? ""),
    enabled: open && jobId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 250 : false,
  });

  const status = statusQuery.data ?? null;
  const isRunning =
    !statusQuery.isError && (status === null || status.status === "running");
  const target = (status?.progress ?? 0) * 100;

  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    const tick = () => {
      setDisplay((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        return prev + diff * 0.18;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, target]);

  const handleExport = async () => {
    if (!jobId || exporting) return;
    setExporting(true);
    try {
      await downloadProcessed(
        datasetId,
        jobId,
        status?.export_filename ?? "transformed.xlsx",
      );
    } finally {
      setExporting(false);
    }
  };

  const failed = statusQuery.isError || status?.status === "failed";
  const completed = !failed && status?.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isRunning}
        onInteractOutside={(event) => {
          if (isRunning) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isRunning) event.preventDefault();
        }}
      >
        {jobId === null ? null : isRunning ? (
          <>
            <DialogHeader>
              <DialogTitle>Processing data</DialogTitle>
              <DialogDescription>
                Applying your column transformations…
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  {status?.phase ?? "Starting…"}
                </span>
                <span className="tabular-nums">{Math.round(display)}%</span>
              </div>
              <Progress value={display} />
              <p className="text-xs tabular-nums text-muted-foreground">
                {status
                  ? `${status.processed_rows.toLocaleString()} / ${status.total_rows.toLocaleString()} rows`
                  : "Starting…"}
              </p>
            </div>
          </>
        ) : completed ? (
          <>
            <DialogHeader>
              <DialogTitle>Processing complete</DialogTitle>
              <DialogDescription>
                {(status?.total_rows ?? 0).toLocaleString()} rows ·{" "}
                {(status?.output_columns ?? 0).toLocaleString()} columns
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <ChoiceCard
                icon={DownloadIcon}
                title="Export transformed data"
                hint="Download the processed dataset as an Excel file."
                onClick={handleExport}
                busy={exporting}
              />
              <ChoiceCard
                icon={ShieldCheckIcon}
                title="K-anonymization"
                hint="Coming soon."
                disabled
              />
              <ChoiceCard
                icon={SparklesIcon}
                title="Synthetic data generation"
                hint="Coming soon."
                disabled
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" size="sm" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Processing failed</DialogTitle>
              <DialogDescription>
                {statusQuery.isError
                  ? "Processing was interrupted (the server may have restarted). Try again."
                  : (status?.error ?? "Something went wrong.")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" size="sm" onClick={onRetry}>
                Try again
              </Button>
              <DialogClose asChild>
                <Button type="button" size="sm" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
