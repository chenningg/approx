"use client"

import { useMutation } from "@tanstack/react-query"
import { BarChart2Icon, BrainIcon, Loader2Icon, RotateCcwIcon, SparklesIcon, TargetIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { runSyntheticMLEvaluation } from "@/features/datasets/api"
import type { MLEvaluationRequest, MLEvaluationResponse } from "@/features/datasets/types"

const METRIC_LABELS: Record<string, string> = {
  orig_accuracy: "Accuracy",
  orig_precision_macro: "Precision (Macro)",
  orig_recall_macro: "Recall (Macro)",
  orig_f1_macro: "F1 (Macro)",
  orig_precision_weighted: "Precision (Weighted)",
  orig_recall_weighted: "Recall (Weighted)",
  orig_f1_weighted: "F1 (Weighted)",
  orig_roc_auc: "ROC-AUC",
  orig_roc_auc_ovr: "ROC-AUC (OvR)",
  orig_roc_auc_ovo: "ROC-AUC (OvO)",
  synth_accuracy: "Accuracy",
  synth_precision_macro: "Precision (Macro)",
  synth_recall_macro: "Recall (Macro)",
  synth_f1_macro: "F1 (Macro)",
  synth_precision_weighted: "Precision (Weighted)",
  synth_recall_weighted: "Recall (Weighted)",
  synth_f1_weighted: "F1 (Weighted)",
  synth_roc_auc: "ROC-AUC",
  synth_roc_auc_ovr: "ROC-AUC (OvR)",
  synth_roc_auc_ovo: "ROC-AUC (OvO)",
  orig_mse: "MSE",
  orig_rmse: "RMSE",
  orig_r2: "R²",
  synth_mse: "MSE",
  synth_rmse: "RMSE",
  synth_r2: "R²",
}

const METRIC_FORMAT: Record<string, (v: number) => string> = {
  orig_accuracy: (v) => `${(v * 100).toFixed(1)}%`,
  orig_precision_macro: (v) => `${(v * 100).toFixed(1)}%`,
  orig_recall_macro: (v) => `${(v * 100).toFixed(1)}%`,
  orig_f1_macro: (v) => `${(v * 100).toFixed(1)}%`,
  orig_precision_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  orig_recall_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  orig_f1_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  orig_roc_auc: (v) => v.toFixed(3),
  orig_roc_auc_ovr: (v) => v.toFixed(3),
  orig_roc_auc_ovo: (v) => v.toFixed(3),
  synth_accuracy: (v) => `${(v * 100).toFixed(1)}%`,
  synth_precision_macro: (v) => `${(v * 100).toFixed(1)}%`,
  synth_recall_macro: (v) => `${(v * 100).toFixed(1)}%`,
  synth_f1_macro: (v) => `${(v * 100).toFixed(1)}%`,
  synth_precision_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  synth_recall_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  synth_f1_weighted: (v) => `${(v * 100).toFixed(1)}%`,
  synth_roc_auc: (v) => v.toFixed(3),
  synth_roc_auc_ovr: (v) => v.toFixed(3),
  synth_roc_auc_ovo: (v) => v.toFixed(3),
  orig_mse: (v) => v.toFixed(4),
  orig_rmse: (v) => v.toFixed(4),
  orig_r2: (v) => v.toFixed(4),
  synth_mse: (v) => v.toFixed(4),
  synth_rmse: (v) => v.toFixed(4),
  synth_r2: (v) => v.toFixed(4),
}

function MetricCard({
  label,
  value,
  isBetter,
  className,
}: {
  label: string
  value: number | null | undefined
  isBetter?: boolean
  className?: string
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <div className={className}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-mono tabular-nums text-muted-foreground">—</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-mono tabular-nums font-semibold ${isBetter ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {METRIC_FORMAT[label] ? METRIC_FORMAT[label](value) : value.toFixed(3)}
      </p>
    </div>
  )
}

function MetricRow({
  metricKey,
  origTrainOrigTest,
  origTrainSynthTest,
  synthTrainSynthTest,
  synthTrainOrigTest,
}: {
  metricKey: string
  origTrainOrigTest: number | undefined
  origTrainSynthTest: number | undefined
  synthTrainSynthTest: number | undefined
  synthTrainOrigTest: number | undefined
}) {
  const label = METRIC_LABELS[metricKey] ?? metricKey

  // For classification, higher is better for most metrics; for regression, lower is better for MSE/RMSE, higher for R2
  const isHigherBetter = !metricKey.includes("mse") && !metricKey.includes("rmse")

  const values = [
    { key: "origTrainOrigTest", value: origTrainOrigTest },
    { key: "origTrainSynthTest", value: origTrainSynthTest },
    { key: "synthTrainSynthTest", value: synthTrainSynthTest },
    { key: "synthTrainOrigTest", value: synthTrainOrigTest },
  ].filter((v) => v.value !== undefined && Number.isFinite(v.value))

  let bestKey: string | null = null
  if (values.length > 0) {
    bestKey = isHigherBetter
      ? values.reduce((a, b) => (a.value! > b.value! ? a : b)).key
      : values.reduce((a, b) => (a.value! < b.value! ? a : b)).key
  }

  return (
    <div className="grid grid-cols-5 gap-3 p-3 rounded-lg bg-muted/30">
      <div className="font-medium text-sm text-foreground col-span-1">{label}</div>
      <MetricCard
        label="Orig→Orig"
        value={origTrainOrigTest}
        isBetter={bestKey === "origTrainOrigTest"}
        className="col-span-1"
      />
      <MetricCard
        label="Orig→Synth"
        value={origTrainSynthTest}
        isBetter={bestKey === "origTrainSynthTest"}
        className="col-span-1"
      />
      <MetricCard
        label="Synth→Synth"
        value={synthTrainSynthTest}
        isBetter={bestKey === "synthTrainSynthTest"}
        className="col-span-1"
      />
      <MetricCard
        label="Synth→Orig"
        value={synthTrainOrigTest}
        isBetter={bestKey === "synthTrainOrigTest"}
        className="col-span-1"
      />
    </div>
  )
}

function ConfusionMatrix({
  matrix,
  labels,
  title,
}: {
  matrix: number[][] | null
  labels: string[] | null
  title: string
}) {
  if (!matrix || matrix.length === 0) return null

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <h4 className="mb-3 text-sm font-medium">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-border/60 px-2 py-1 text-left font-medium text-muted-foreground">
                Actual \ Predicted
              </th>
              {matrix[0].map((_, j) => (
                <th key={j} className="border-b border-border/60 px-3 py-1 text-center font-medium text-muted-foreground">
                  {labels?.[j] ?? `Class ${j}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="border-b border-border/30 px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">
                  {labels?.[i] ?? `Class ${i}`}
                </td>
                {row.map((val, j) => (
                  <td key={j} className="border-b border-border/30 px-3 py-1 text-center tabular-nums font-mono">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MLEvaluation({
  datasetId,
  jobId,
  columnNames,
}: {
  datasetId: string
  jobId: string
  columnNames: string[]
}) {
  const [targetColumn, setTargetColumn] = useState<string>("")
  const [testSize, setTestSize] = useState(0.2)
  const [results, setResults] = useState<MLEvaluationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (request: MLEvaluationRequest) => runSyntheticMLEvaluation(datasetId, jobId, request),
    onSuccess: (data) => {
      setResults(data)
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to run ML evaluation")
      setResults(null)
    },
  })

  const handleRun = useCallback(() => {
    if (!targetColumn) return
    mutation.mutate({ target_column: targetColumn, test_size: testSize })
  }, [targetColumn, testSize, mutation])

  const handleReset = useCallback(() => {
    setResults(null)
    setError(null)
    setTargetColumn("")
  }, [])

  const classificationMetrics = useMemo(() => [
    "orig_accuracy", "orig_precision_macro", "orig_recall_macro", "orig_f1_macro",
    "orig_precision_weighted", "orig_recall_weighted", "orig_f1_weighted",
    "orig_roc_auc", "orig_roc_auc_ovr", "orig_roc_auc_ovo",
    "synth_accuracy", "synth_precision_macro", "synth_recall_macro", "synth_f1_macro",
    "synth_precision_weighted", "synth_recall_weighted", "synth_f1_weighted",
    "synth_roc_auc", "synth_roc_auc_ovr", "synth_roc_auc_ovo",
  ], [])

  const regressionMetrics = useMemo(() => [
    "orig_mse", "orig_rmse", "orig_r2",
    "synth_mse", "synth_rmse", "synth_r2",
  ], [])

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BrainIcon className="size-4 text-primary" />
              Downstream Evaluation
            </CardTitle>
            <CardDescription>
              Train a logistic regression (or linear regression) on original vs synthetic data and compare
              predictive performance on held-out test sets.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm font-medium mb-1.5">Target Column</label>
            <Select value={targetColumn} onValueChange={setTargetColumn} disabled={mutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select target column…" />
              </SelectTrigger>
              <SelectContent>
                {columnNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 sm:w-[160px]">
            <label className="block text-sm font-medium mb-1.5 w-full">Test Size</label>
            <Select value={String(testSize)} onValueChange={(v) => setTestSize(Number(v))} disabled={mutation.isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">10%</SelectItem>
                <SelectItem value="0.2">20%</SelectItem>
                <SelectItem value="0.3">30%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRun}
              disabled={mutation.isPending || !targetColumn}
              className="flex-1 sm:flex-none"
            >
              {mutation.isPending ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                  Running…
                </>
              ) : (
                <>
                  <SparklesIcon className="size-3.5 mr-1.5" />
                  Run Evaluation
                </>
              )}
            </Button>
            {results && (
              <Button variant="outline" onClick={handleReset} disabled={mutation.isPending}>
                <RotateCcwIcon className="size-3.5 mr-1.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {results && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <TargetIcon className="size-3" />
                Target: {results.target_column}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <BarChart2Icon className="size-3" />
                {results.task_type === "classification" ? "Classification" : "Regression"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                Features: {results.n_features}
              </Badge>
              <Badge variant="outline" className="gap-1">
                Original: {results.n_samples_original.toLocaleString()} rows
              </Badge>
              <Badge variant="outline" className="gap-1">
                Synthetic: {results.n_samples_synthetic.toLocaleString()} rows
              </Badge>
            </div>

            <Separator />

            <h4 className="text-sm font-medium">Performance Comparison</h4>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="grid grid-cols-5 border-b border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-1">Metric</div>
                <div className="col-span-1 text-center">Orig → Orig</div>
                <div className="col-span-1 text-center">Orig → Synth</div>
                <div className="col-span-1 text-center">Synth → Synth</div>
                <div className="col-span-1 text-center">Synth → Orig</div>
              </div>
              <div className="divide-y divide-border/30">
                {(results.task_type === "classification" ? classificationMetrics : regressionMetrics).map((key) => (
                  <MetricRow
                    key={key}
                    metricKey={key}
                    origTrainOrigTest={results.original_train_original_test[key]}
                    origTrainSynthTest={results.original_train_synthetic_test[key]}
                    synthTrainSynthTest={results.synthetic_train_synthetic_test[key]}
                    synthTrainOrigTest={results.synthetic_train_original_test[key]}
                  />
                ))}
              </div>
            </div>

            {results.task_type === "classification" && (
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-medium">Confusion Matrices</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ConfusionMatrix
                    matrix={results.confusion_matrix_orig_train_orig_test}
                    labels={results.class_labels}
                    title="Train: Original → Test: Original"
                  />
                  <ConfusionMatrix
                    matrix={results.confusion_matrix_orig_train_synth_test}
                    labels={results.class_labels}
                    title="Train: Original → Test: Synthetic"
                  />
                  <ConfusionMatrix
                    matrix={results.confusion_matrix_synth_train_synth_test}
                    labels={results.class_labels}
                    title="Train: Synthetic → Test: Synthetic"
                  />
                  <ConfusionMatrix
                    matrix={results.confusion_matrix_synth_train_orig_test}
                    labels={results.class_labels}
                    title="Train: Synthetic → Test: Original"
                  />
                </div>
              </div>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Interpretation:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li><strong>Orig → Orig:</strong> Baseline performance on real data (upper bound)</li>
                <li><strong>Orig → Synth:</strong> How well real-data model generalizes to synthetic data</li>
                <li><strong>Synth → Synth:</strong> Internal consistency of synthetic data</li>
                <li><strong>Synth → Orig:</strong> How well synthetic-data model transfers to real data (key metric)</li>
              </ul>
              {results.task_type === "classification" ? (
                <p>For classification: higher Accuracy, Precision, Recall, F1, and ROC-AUC are better.</p>
              ) : (
                <p>For regression: lower MSE/RMSE and higher R² are better.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}