import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { PreviewTable } from "./preview-table";
import { GeneralizeDialog } from "./generalize-dialog";
import { MethodChoiceDialog } from "./method-choice-dialog";
import { ProcessDialog } from "./process-dialog";
import { RedactDialog } from "./redact-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startProcess } from "@/features/datasets/api";
import {
  datasetQueryOptions,
  datasetRowsQueryOptions,
} from "@/features/datasets/queries";
import {
  defaultColumnConfig,
  type ColumnAction,
  type ColumnConfig,
  type ColumnInfo,
  type GeneralizeConfig,
  type RedactConfig,
} from "@/features/datasets/types";

type PreviewMode = "inspect" | "transform";

interface DatasetPreviewProps {
  id: string;
  mode: PreviewMode;
}

export function DatasetPreview({ id, mode }: DatasetPreviewProps) {
  const dataset = useQuery(datasetQueryOptions(id));
  const [configs, setConfigs] = useState<Record<number, ColumnConfig>>({});
  const [settingsColumn, setSettingsColumn] = useState<number | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);
  const [processJobId, setProcessJobId] = useState<string | null>(null);

  const rowsQuery = useInfiniteQuery({
    ...datasetRowsQueryOptions(id),
    initialData: dataset.data
      ? {
          pages: [
            {
              offset: 0,
              limit: dataset.data.rows.length,
              total: dataset.data.total_rows,
              rows: dataset.data.rows,
            },
          ],
          pageParams: [0],
        }
      : undefined,
  });

  const columns = useMemo(() => dataset.data?.columns ?? [], [dataset.data]);
  const rows = useMemo(
    () => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [rowsQuery.data],
  );
  const total =
    dataset.data?.total_rows ?? rowsQuery.data?.pages[0]?.total ?? 0;

  const configFor = useCallback(
    (column: ColumnInfo) =>
      configs[column.index] ?? defaultColumnConfig(column),
    [configs],
  );

  const updateConfig = useCallback(
    (index: number, patch: Partial<ColumnConfig>) => {
      setConfigs((prev) => {
        const column = columns.find((item) => item.index === index);
        if (!column) return prev;
        const base = prev[index] ?? defaultColumnConfig(column);
        return { ...prev, [index]: { ...base, ...patch } };
      });
    },
    [columns],
  );

  const handleActionChange = useCallback(
    (index: number, action: ColumnAction) => updateConfig(index, { action }),
    [updateConfig],
  );

  const handleRedactChange = useCallback(
    (index: number, redact: RedactConfig) => updateConfig(index, { redact }),
    [updateConfig],
  );

  const handleGeneralizeChange = useCallback(
    (index: number, generalize: GeneralizeConfig) =>
      updateConfig(index, { generalize }),
    [updateConfig],
  );

  const activeColumn =
    settingsColumn === null
      ? null
      : (columns.find((column) => column.index === settingsColumn) ?? null);
  const activeConfig = activeColumn ? configFor(activeColumn) : null;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = rowsQuery;
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const processMutation = useMutation({
    mutationFn: () =>
      startProcess(
        id,
        columns.map((column) => ({
          index: column.index,
          config: configFor(column),
        })),
      ),
    onSuccess: (job) => {
      setProcessJobId(job.job_id);
      setProcessOpen(true);
    },
  });

  if (dataset.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (dataset.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Could not load this dataset</p>
        <p className="text-sm text-muted-foreground">
          {dataset.error instanceof Error
            ? dataset.error.message
            : "Something went wrong."}
        </p>
      </div>
    );
  }

  const { filename, sheet } = dataset.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {mode === "transform" && (
            <Button asChild variant="ghost" size="icon-sm" aria-label="Back">
              <Link
                to="/datasets/$datasetId"
                params={{ datasetId: id }}
                title="Back"
              >
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{filename}</p>
            <p className="text-xs text-muted-foreground">
              {sheet} · {total.toLocaleString()} rows · {columns.length}{" "}
              columns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isFetchingNextPage && (
            <span className="text-xs text-muted-foreground">
              Loading more rows…
            </span>
          )}
          {mode === "transform" ? (
            <>
              {processMutation.isError && (
                <span className="text-xs text-destructive">
                  Could not start processing.
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={processMutation.isPending}
                onClick={() => processMutation.mutate()}
              >
                {processMutation.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArrowRightIcon className="size-4" />
                )}
                Process data
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => setChoiceOpen(true)}>
              Next
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <PreviewTable
        columns={columns}
        rows={rows}
        configFor={configFor}
        onActionChange={handleActionChange}
        onOpenSettings={setSettingsColumn}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={handleLoadMore}
        showActions={mode === "transform"}
      />

      {mode === "inspect" && (
        <MethodChoiceDialog
          open={choiceOpen}
          datasetId={id}
          onOpenChange={setChoiceOpen}
        />
      )}

      {mode === "transform" && activeColumn && activeConfig && (
        <>
          <RedactDialog
            open={activeConfig.action === "redact"}
            column={activeColumn}
            config={activeConfig.redact}
            onOpenChange={(open) => {
              if (!open) setSettingsColumn(null);
            }}
            onChange={(redact) =>
              handleRedactChange(activeColumn.index, redact)
            }
          />
          <GeneralizeDialog
            open={activeConfig.action === "generalize"}
            column={activeColumn}
            config={activeConfig.generalize}
            onOpenChange={(open) => {
              if (!open) setSettingsColumn(null);
            }}
            onChange={(generalize) =>
              handleGeneralizeChange(activeColumn.index, generalize)
            }
          />
        </>
      )}

      <ProcessDialog
        open={mode === "transform" && processOpen}
        datasetId={id}
        jobId={processJobId}
        onOpenChange={setProcessOpen}
        onRetry={() => processMutation.mutate()}
      />
    </div>
  );
}
