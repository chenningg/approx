import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { PreviewTable } from "@/components/dataset-preview/preview-table";
import {
  MetadataEditor,
  initialFormState,
  type SyntheticFormState,
} from "@/components/synthetic/metadata-editor";
import { SyntheticJobDialog } from "@/components/synthetic/synthetic-job-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { startSynthetic } from "@/features/datasets/api";
import {
  datasetQueryOptions,
  datasetRowsQueryOptions,
  syntheticDefaultsQueryOptions,
} from "@/features/datasets/queries";
import {
  DEFAULT_REDACT,
  supportsPii,
  type ColumnConfig,
  type DatasetPreview,
  type SyntheticDefaults,
  type SyntheticRequest,
} from "@/features/datasets/types";

const NOOP_CONFIG: ColumnConfig = {
  action: "keep",
  redact: DEFAULT_REDACT,
  generalize: {
    method: "numeric",
    ageBand: 10,
    dobWidth: "year",
    buckets: 5,
  },
};

const noopConfigFor = () => NOOP_CONFIG;

function toRequest(form: SyntheticFormState): SyntheticRequest {
  return {
    table_name: form.tableName.trim(),
    primary_key: form.primaryKey,
    num_rows: form.numRows,
    columns: Object.entries(form.columns).map(([index, column]) => ({
      index: Number(index),
      sdtype: column.sdtype,
      pii: supportsPii(column.sdtype) && column.pii,
      min_value: column.minValue.trim() || null,
      max_value: column.maxValue.trim() || null,
    })),
  };
}

function rangesAreValid(form: SyntheticFormState): boolean {
  return Object.values(form.columns).every((column) => {
    if (column.sdtype !== "numerical") return true;
    const min = column.minValue.trim();
    const max = column.maxValue.trim();
    if (min && Number.isNaN(Number(min))) return false;
    if (max && Number.isNaN(Number(max))) return false;
    if (min && max && Number(min) > Number(max)) return false;
    return true;
  });
}

interface SyntheticWorkspaceProps {
  id: string;
  dataset: DatasetPreview;
  defaults: SyntheticDefaults;
}

function SyntheticWorkspace({ id, dataset, defaults }: SyntheticWorkspaceProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<SyntheticFormState>(() =>
    initialFormState(defaults),
  );
  const [jobOpen, setJobOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const handleComplete = useCallback(
    (completedJobId: string) => {
      setJobOpen(false);
      void navigate({
        to: "/datasets/$datasetId/synthetic/$jobId",
        params: { datasetId: id, jobId: completedJobId },
      });
    },
    [id, navigate],
  );

  const rowsQuery = useInfiniteQuery({
    ...datasetRowsQueryOptions(id),
    initialData: {
      pages: [
        {
          offset: 0,
          limit: dataset.rows.length,
          total: dataset.total_rows,
          rows: dataset.rows,
        },
      ],
      pageParams: [0],
    },
  });

  const rows = useMemo(
    () => rowsQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [rowsQuery.data],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = rowsQuery;
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const mutation = useMutation({
    mutationFn: (request: SyntheticRequest) => startSynthetic(id, request),
    onSuccess: (job) => {
      setJobId(job.job_id);
      setJobOpen(true);
    },
  });

  const valid =
    form.tableName.trim().length > 0 &&
    Number.isInteger(form.numRows) &&
    form.numRows >= 1 &&
    form.numRows <= 1_000_000 &&
    rangesAreValid(form);

  const handleGenerate = () => mutation.mutate(toRequest(form));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back">
            <Link to="/datasets/$datasetId" params={{ datasetId: id }} title="Back">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{dataset.filename}</p>
            <p className="text-xs text-muted-foreground">
              Synthetic data generation · {dataset.sheet} ·{" "}
              {dataset.total_rows.toLocaleString()} rows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mutation.isError && (
            <span className="text-xs text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Could not start generation."}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!valid || mutation.isPending}
            onClick={handleGenerate}
          >
            {mutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            Generate
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <MetadataEditor
          defaults={defaults}
          form={form}
          onChange={setForm}
          columns={dataset.columns}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60">
          <PreviewTable
            columns={dataset.columns}
            rows={rows}
            configFor={noopConfigFor}
            onActionChange={() => undefined}
            onOpenSettings={() => undefined}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            showActions={false}
          />
        </div>
      </div>

      <SyntheticJobDialog
        open={jobOpen}
        datasetId={id}
        jobId={jobId}
        onOpenChange={setJobOpen}
        onRetry={handleGenerate}
        onComplete={handleComplete}
      />
    </div>
  );
}

interface SyntheticGeneratorProps {
  id: string;
}

export function SyntheticGenerator({ id }: SyntheticGeneratorProps) {
  const dataset = useQuery(datasetQueryOptions(id));
  const defaults = useQuery(syntheticDefaultsQueryOptions(id));

  if (dataset.isPending || defaults.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (dataset.isError || defaults.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-medium">Could not load this dataset</p>
        <p className="text-sm text-muted-foreground">
          {dataset.error instanceof Error
            ? dataset.error.message
            : defaults.error instanceof Error
              ? defaults.error.message
              : "Something went wrong."}
        </p>
      </div>
    );
  }

  return (
    <SyntheticWorkspace id={id} dataset={dataset.data} defaults={defaults.data} />
  );
}
