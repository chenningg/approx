import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { ChoiceCard } from "@/components/dataset-preview/choice-card";
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
import { downloadSynthetic } from "@/features/datasets/api";
import { syntheticStatusQueryOptions } from "@/features/datasets/queries";

interface SyntheticJobDialogProps {
  open: boolean;
  datasetId: string;
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

export function SyntheticJobDialog({
  open,
  datasetId,
  jobId,
  onOpenChange,
  onRetry,
}: SyntheticJobDialogProps) {
  const [display, setDisplay] = useState(0);
  const [exporting, setExporting] = useState(false);

  const statusQuery = useQuery({
    ...syntheticStatusQueryOptions(datasetId, jobId ?? ""),
    enabled: open && jobId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 500 : false,
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
      await downloadSynthetic(
        datasetId,
        jobId,
        status?.export_filename ?? "synthetic.xlsx",
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
              <DialogTitle>Generating synthetic data</DialogTitle>
              <DialogDescription>
                Training a model on your data…
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
                  ? `${(status.total_rows ?? 0).toLocaleString()} rows requested`
                  : "Starting…"}
              </p>
            </div>
          </>
        ) : completed ? (
          <>
            <DialogHeader>
              <DialogTitle>Synthetic data ready</DialogTitle>
              <DialogDescription>
                {(status?.output_rows ?? status?.total_rows ?? 0).toLocaleString()}{" "}
                rows generated
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <ChoiceCard
                icon={DownloadIcon}
                title="Export synthetic data"
                hint="Download the generated dataset as an Excel file."
                onClick={handleExport}
                busy={exporting}
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
              <DialogTitle>Generation failed</DialogTitle>
              <DialogDescription>
                {statusQuery.isError
                  ? "Generation was interrupted (the server may have restarted). Try again."
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
