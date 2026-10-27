import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BarChart2Icon,
  BrainIcon,
  DownloadIcon,
  ListChecksIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { NotFound } from "@/components/not-found";
import { ColumnPlot } from "@/components/synthetic/column-plot";
import { ComparisonTable } from "@/components/synthetic/comparison-table";
import { EvaluationReport } from "@/components/synthetic/evaluation-report";
import { MLEvaluation } from "@/components/synthetic/ml-evaluation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadSynthetic, isNotFoundError } from "@/features/datasets/api";
import {
  datasetQueryOptions,
  syntheticComparisonQueryOptions,
  syntheticEvaluationQueryOptions,
  syntheticStatusQueryOptions,
} from "@/features/datasets/queries";

interface SyntheticComparisonViewProps {
  id: string;
  jobId: string;
}

function ErrorPanel({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircleIcon className="size-4 text-destructive" />
            {title}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {action && <CardContent>{action}</CardContent>}
      </Card>
    </div>
  );
}

function EvaluationLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <Card size="sm">
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Evaluating synthetic data on up to 10,000 rows…
        </CardContent>
      </Card>
    </div>
  );
}

export function SyntheticComparisonView({
  id,
  jobId,
}: SyntheticComparisonViewProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const dataset = useQuery(datasetQueryOptions(id));
  const statusQuery = useQuery({
    ...syntheticStatusQueryOptions(id, jobId),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 500 : false,
  });
  const completed = statusQuery.data?.status === "completed";

  const comparison = useInfiniteQuery({
    ...syntheticComparisonQueryOptions(id, jobId),
    enabled: completed,
  });
  const evaluation = useQuery({
    ...syntheticEvaluationQueryOptions(id, jobId),
    enabled: completed,
    retry: 1,
  });

  const rows = useMemo(
    () => comparison.data?.pages.flatMap((page) => page.rows) ?? [],
    [comparison.data],
  );
  const firstPage = comparison.data?.pages[0];

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = comparison;
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleDownload = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadSynthetic(
        id,
        jobId,
        statusQuery.data?.export_filename ?? "synthetic.xlsx",
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Could not download the file.",
      );
    } finally {
      setExporting(false);
    }
  };

  if (dataset.isPending || statusQuery.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (dataset.isError || statusQuery.isError) {
    if (isNotFoundError(dataset.error) || isNotFoundError(statusQuery.error)) {
      return (
        <NotFound
          message={
            isNotFoundError(dataset.error)
              ? "This dataset no longer exists."
              : "This synthetic dataset no longer exists."
          }
        />
      );
    }
    return (
      <ErrorPanel
        title="Could not load this comparison"
        message={
          dataset.error instanceof Error
            ? dataset.error.message
            : statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Something went wrong."
        }
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/datasets/$datasetId" params={{ datasetId: id }}>
              Back to dataset
            </Link>
          </Button>
        }
      />
    );
  }

  const status = statusQuery.data;
  const failed = status?.status === "failed";
  const running = status?.status === "running";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back">
            <Link
              to="/datasets/$datasetId/synthetic"
              params={{ datasetId: id }}
              title="Back to synthetic generation"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {dataset.data.filename}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Original {dataset.data.total_rows.toLocaleString()} rows ·
              Synthetic {status?.output_rows?.toLocaleString() ?? 0} rows
            </p>
          </div>
          <Badge variant={failed ? "destructive" : "secondary"}>
            {failed ? "Failed" : running ? "Generating" : "Completed"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {exportError && (
            <span className="max-w-56 text-xs text-destructive">
              {exportError}
            </span>
          )}
          {completed && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              Download Excel
            </Button>
          )}
        </div>
      </div>

      {!completed ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {failed ? (
                  <AlertCircleIcon className="size-4 text-destructive" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                {failed ? "Generation failed" : "Generating synthetic data"}
              </CardTitle>
              <CardDescription>
                {failed
                  ? (status?.error ?? "Something went wrong.")
                  : "The comparison will appear as soon as generation finishes."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!failed && (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Loader2Icon className="size-3.5 animate-spin" />
                      {status?.phase ?? "Starting…"}
                    </span>
                    <span className="tabular-nums">
                      {Math.round((status?.progress ?? 0) * 100)}%
                    </span>
                  </div>
                  <Progress value={(status?.progress ?? 0) * 100} />
                  <p className="text-xs text-muted-foreground">
                    {(status?.total_rows ?? 0).toLocaleString()} rows requested
                  </p>
                </>
              )}
              {failed && (
                <Button asChild size="sm" className="w-fit">
                  <Link
                    to="/datasets/$datasetId/synthetic"
                    params={{ datasetId: id }}
                  >
                    Try again
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 lg:p-6">
          <Tabs defaultValue="evaluation" className="flex flex-col flex-1">
            <TabsList className="grid w-full grid-cols-3 gap-x-1 px-1">
              <TabsTrigger
                value="evaluation"
                className="cursor-pointer transition-all hover:bg-accent hover:text-foreground"
              >
                <ListChecksIcon className="size-3.5 mr-1.5" />
                Evaluation Report
              </TabsTrigger>
              <TabsTrigger
                value="column-plot"
                className="cursor-pointer transition-all hover:bg-accent hover:text-foreground"
              >
                <BarChart2Icon className="size-3.5 mr-1.5" />
                Column Distributions
              </TabsTrigger>
              <TabsTrigger
                value="downstream"
                className="cursor-pointer transition-all hover:bg-accent hover:text-foreground"
              >
                <BrainIcon className="size-3.5 mr-1.5" />
                Downstream Evaluation
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="evaluation"
              className="flex-1 mt-4 focus-visible:ring-0"
            >
              {evaluation.isPending ? (
                <EvaluationLoading />
              ) : evaluation.isError ? (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertCircleIcon className="size-4 text-destructive" />
                      Could not evaluate synthetic data
                    </CardTitle>
                    <CardDescription>
                      {evaluation.error instanceof Error
                        ? evaluation.error.message
                        : "Something went wrong."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void evaluation.refetch()}
                    >
                      Retry evaluation
                    </Button>
                  </CardContent>
                </Card>
              ) : evaluation.data ? (
                <EvaluationReport
                  evaluation={evaluation.data}
                  columnNames={firstPage?.columns.map(
                    (column) => column.header,
                  )}
                />
              ) : null}
            </TabsContent>

            <TabsContent
              value="column-plot"
              className="flex-1 mt-4 focus-visible:ring-0"
            >
              {firstPage ? (
                <ColumnPlot
                  datasetId={id}
                  jobId={jobId}
                  columnNames={firstPage.columns.map((c) => c.header)}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <p>No data available for column plots</p>
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="downstream"
              className="flex-1 mt-4 focus-visible:ring-0"
            >
              {firstPage ? (
                <MLEvaluation
                  datasetId={id}
                  jobId={jobId}
                  columnNames={firstPage.columns.map((c) => c.header)}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <p>No data available for downstream evaluation</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Card className="flex h-[34rem] shrink-0 flex-col gap-0 py-0 lg:h-[38rem]">
            <CardHeader className="border-b border-border/60 py-3">
              <CardTitle>Side-by-side preview</CardTitle>
              <CardDescription>
                Original and generated rows are paired by position, not matched
                records. Scroll to load more; on small screens use the pane
                switch.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {comparison.isPending ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : comparison.isError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm font-medium">
                    Could not load comparison rows
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {comparison.error instanceof Error
                      ? comparison.error.message
                      : "Something went wrong."}
                  </p>
                </div>
              ) : firstPage ? (
                <ComparisonTable
                  columns={firstPage.columns}
                  rows={rows}
                  originalTotal={firstPage.original_total}
                  syntheticTotal={firstPage.synthetic_total}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={handleLoadMore}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
