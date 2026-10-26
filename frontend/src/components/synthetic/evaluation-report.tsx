import {
  BarChart3Icon,
  DatabaseIcon,
  InfoIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  EvaluationProperty,
  EvaluationReport,
  EvaluationTable,
  SyntheticEvaluation,
} from "@/features/datasets/types";

const COLUMN_PAIR_HELP: Record<string, string> = {
  "Real Correlation":
    "Pearson correlation in the original data for numeric or datetime column pairs. Ranges from -1 to 1; values near ±1 indicate a strong linear relationship. Blank for pairs evaluated as categorical.",
  "Synthetic Correlation":
    "Pearson correlation for the same pair in the generated data. Compare it with Real Correlation to see whether the synthetic data preserved the relationship.",
  "Real Association":
    "Cramér's V association in the original data for categorical or mixed/binned column pairs. Ranges from 0 (independent) to 1 (strongly related). Blank when both columns use the correlation metric.",
  "Meets Threshold?":
    "Whether the original relationship is strong enough to count toward the Column Pair Trends score. Numeric pairs need |real correlation| > 0.5; association pairs need real association > 0.3. Pairs that do not meet the threshold are excluded from the average.",
};

function asPercent(score: number | null): string {
  if (score === null) return "—";
  return `${(score * 100).toFixed(1)}%`;
}

function formatCell(
  value: string | number | boolean | null,
  column: string,
): string {
  if (value === null) return "—";
  if (column === "Score") {
    const number = Number(value);
    return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : String(value);
  }
  if (column.includes("Correlation") || column.includes("Association")) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(3) : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(3);
  }
  return String(value);
}

function ColumnHeader({ column }: { column: string }) {
  const help = COLUMN_PAIR_HELP[column];
  if (!help) return <>{column}</>;

  return (
    <span className="inline-flex items-center gap-1">
      {column}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${column}`}
            className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={4}
          className="max-w-72 leading-relaxed"
        >
          {help}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function DetailsTable({ table }: { table: EvaluationTable }) {
  if (table.rows.length === 0) return null;

  return (
    <div className="max-h-80 overflow-auto rounded-md border border-border/60">
      <table className="min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            {table.columns.map((column) => (
              <th
                key={column}
                className="border-b border-border/60 px-3 py-2 text-left font-medium text-muted-foreground"
              >
                <ColumnHeader column={column} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/30 last:border-0">
              {row.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  className="px-3 py-1.5 tabular-nums text-foreground/90"
                >
                  {formatCell(value, table.columns[columnIndex] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertyCard({ property }: { property: EvaluationProperty }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{property.property}</CardTitle>
        <CardDescription>
          SDV property score across the evaluated columns.
        </CardDescription>
        <CardAction>
          <Badge variant={property.score === null ? "outline" : "secondary"}>
            {asPercent(property.score)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={(property.score ?? 0) * 100} />
        <DetailsTable table={property.details} />
      </CardContent>
    </Card>
  );
}

function ReportSection({ report }: { report: EvaluationReport }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-medium capitalize">
          {report.report} report
        </h2>
        <Badge variant="outline">{asPercent(report.score)}</Badge>
      </div>
      <div className="grid gap-4">
        {report.properties.map((property) => (
          <PropertyCard key={property.property} property={property} />
        ))}
      </div>
    </section>
  );
}

export function EvaluationReport({
  evaluation,
}: {
  evaluation: SyntheticEvaluation;
}) {
  const sampleDescription = evaluation.sampled
    ? `Sampled ${evaluation.sample_rows.toLocaleString()} rows for evaluation`
    : `${evaluation.sample_rows.toLocaleString()} rows evaluated`;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            icon={BarChart3Icon}
            label="Quality score"
            value={asPercent(evaluation.quality.score)}
            description="Column shapes and pair trends"
          />
          <SummaryCard
            icon={ShieldCheckIcon}
            label="Diagnostic score"
            value={asPercent(evaluation.diagnostic.score)}
            description="Validity and table structure"
          />
          <SummaryCard
            icon={DatabaseIcon}
            label="Rows evaluated"
            value={evaluation.sample_rows.toLocaleString()}
            description={sampleDescription}
          />
        </div>

        <ReportSection report={evaluation.quality} />
        <ReportSection report={evaluation.diagnostic} />
      </div>
    </TooltipProvider>
  );
}
