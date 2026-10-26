import { BarChart3Icon, InfoIcon, ShieldCheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  EvaluationProperty,
  EvaluationReport as EvaluationReportData,
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

const PROPERTY_HELP: Record<string, string> = {
  "Column Shapes":
    "Compares the distribution of each scored column using KS similarity for numerical and datetime columns, or total-variation similarity for categorical and boolean columns.",
  "Column Pair Trends":
    "Checks whether pairwise relationships are preserved. Only pairs with a strong enough relationship in the original data contribute to the score.",
  "Data Validity":
    "Checks that generated values obey the observed ranges, categories, formats, and key rules.",
  "Data Structure":
    "Checks that the generated table has the same columns and structure as the original.",
};

interface ScoreTone {
  label: string;
  ring: string;
  bar: string;
  text: string;
  badge: "outline" | "secondary" | "destructive";
  badgeClass: string;
}

const TONES: Record<"strong" | "fair" | "review" | "none", ScoreTone> = {
  strong: {
    label: "Strong",
    ring: "text-emerald-500",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "outline",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  fair: {
    label: "Fair",
    ring: "text-amber-500",
    bar: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    badge: "outline",
    badgeClass:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  review: {
    label: "Needs review",
    ring: "text-destructive",
    bar: "bg-destructive",
    text: "text-destructive",
    badge: "destructive",
    badgeClass: "",
  },
  none: {
    label: "Not scored",
    ring: "text-muted-foreground",
    bar: "bg-muted-foreground",
    text: "text-muted-foreground",
    badge: "outline",
    badgeClass: "",
  },
};

function toneFor(score: number | null): ScoreTone {
  if (score === null) return TONES.none;
  if (score >= 0.9) return TONES.strong;
  if (score >= 0.8) return TONES.fair;
  return TONES.review;
}

function asPercent(score: number | null): string {
  if (score === null) return "—";
  return `${(score * 100).toFixed(1)}%`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scoreOf(row: (string | number | boolean | null)[], index: number): number {
  const number = Number(row[index]);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

function HelpTip({ label, help }: { label: string; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <InfoIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-72 leading-relaxed">
        {help}
      </TooltipContent>
    </Tooltip>
  );
}

function ToneBadge({ tone, children }: { tone: ScoreTone; children: ReactNode }) {
  return (
    <Badge variant={tone.badge} className={tone.badgeClass}>
      {children}
    </Badge>
  );
}

function ScoreBar({
  value,
  tone,
  className,
}: {
  value: number | null;
  tone: ScoreTone;
  className?: string;
}) {
  const width = Math.min(100, Math.max(0, (value ?? 0) * 100));

  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${tone.bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ScoreRing({ score, tone }: { score: number | null; tone: ScoreTone }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, score ?? 0));

  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <svg
        viewBox="0 0 100 100"
        className="size-28 -rotate-90"
        role="img"
        aria-label={`Quality score ${asPercent(score)}`}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={`transition-[stroke-dashoffset] duration-500 ${tone.ring}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
            {asPercent(score)}
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">
            Quality
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  help,
}: {
  label: string;
  value: number | null;
  help?: string;
}) {
  const tone = toneFor(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1 font-medium">
          {label}
          {help && <HelpTip label={label} help={help} />}
        </span>
        <span className={`tabular-nums font-medium ${tone.text}`}>
          {asPercent(value)}
        </span>
      </div>
      <ScoreBar value={value} tone={tone} />
    </div>
  );
}

function propertyScore(report: EvaluationReportData, name: string): number | null {
  return report.properties.find((property) => property.property === name)?.score ?? null;
}

function scoredColumnNames(report: EvaluationReportData): Set<string> {
  const shapes = report.properties.find(
    (property) => property.property === "Column Shapes",
  );
  if (!shapes) return new Set<string>();

  const columnIndex = shapes.details.columns.indexOf("Column");
  if (columnIndex < 0) return new Set<string>();

  return new Set(
    shapes.details.rows
      .map((row) => row[columnIndex])
      .filter((value): value is string => typeof value === "string"),
  );
}

function QualityOverview({ evaluation }: { evaluation: SyntheticEvaluation }) {
  const score = evaluation.quality.score;
  const tone = toneFor(score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3Icon className="size-4 text-primary" />
          Quality overview
        </CardTitle>
        <CardDescription>
          How closely the synthetic data reproduces distributions and pairwise
          relationships in the original.
        </CardDescription>
        <CardAction>
          <ToneBadge tone={tone}>{tone.label}</ToneBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ScoreRing score={score} tone={tone} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <MetricRow
            label="Column Shapes"
            value={propertyScore(evaluation.quality, "Column Shapes")}
            help="Distribution similarity for numerical, datetime, categorical, ordinal, and boolean columns."
          />
          <MetricRow
            label="Column Pair Trends"
            value={propertyScore(evaluation.quality, "Column Pair Trends")}
            help="Whether correlations and associations between columns are preserved. Only relationships that are strong in the original data contribute."
          />
          <p className="text-[11px] text-muted-foreground">
            Overall quality is the average of both property scores.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidityCard({
  evaluation,
  columnNames,
}: {
  evaluation: SyntheticEvaluation;
  columnNames?: string[];
}) {
  const tone = toneFor(evaluation.diagnostic.score);
  const scored = useMemo(
    () => scoredColumnNames(evaluation.quality),
    [evaluation.quality],
  );
  const unscored = columnNames?.filter((name) => !scored.has(name)) ?? [];
  const scoredLabel = columnNames
    ? `${scored.size} / ${columnNames.length}`
    : `${scored.size}`;
  const unscoredPreview = unscored.slice(0, 6).join(", ");
  const remaining = unscored.length - 6;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-primary" />
          Validity & coverage
        </CardTitle>
        <CardDescription>
          Checks that values respect types, ranges, categories, and structure.
        </CardDescription>
        <CardAction>
          <ToneBadge tone={tone}>{asPercent(evaluation.diagnostic.score)}</ToneBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-xs">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              Diagnostic score
              <HelpTip
                label="Diagnostic score"
                help="Validity checks are pass/fail-oriented. A high score means values are well-formed; it does not by itself prove that the data is statistically realistic."
              />
            </span>
            <span className={`font-medium tabular-nums ${tone.text}`}>
              {asPercent(evaluation.diagnostic.score)}
            </span>
          </div>
          <ScoreBar value={evaluation.diagnostic.score} tone={tone} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-muted-foreground">Original sample</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums">
              {evaluation.original_sample_rows.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">
              of {evaluation.original_rows.toLocaleString()} rows
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <p className="text-muted-foreground">Synthetic sample</p>
            <p className="mt-0.5 text-sm font-medium tabular-nums">
              {evaluation.synthetic_sample_rows.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">
              of {evaluation.synthetic_rows.toLocaleString()} rows
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              Statistically scored columns
              <HelpTip
                label="Scored columns"
                help="SDV quality scores numerical, datetime, categorical, ordinal, and boolean columns. Other types, such as identifiers and PII, are checked for validity but excluded from the quality score."
              />
            </span>
            <span className="font-medium tabular-nums">{scoredLabel}</span>
          </div>
          {unscored.length > 0 ? (
            <p className="mt-1 leading-relaxed text-muted-foreground" title={unscored.join(", ")}>
              Not statistically scored: {unscoredPreview}
              {remaining > 0 ? `, +${remaining} more` : ""}
            </p>
          ) : columnNames ? (
            <p className="mt-1 text-muted-foreground">
              All selected columns are statistically scored.
            </p>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Generated {formatTimestamp(evaluation.generated_at)}
        </p>
      </CardContent>
    </Card>
  );
}

function formatCell(value: string | number | boolean | null, column: string): string {
  if (value === null) return "—";
  if (column.includes("Correlation") || column.includes("Association")) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(3) : String(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  }
  return String(value);
}

function CellContent({
  value,
  column,
}: {
  value: string | number | boolean | null;
  column: string;
}) {
  if (column === "Score") {
    const number = Number(value);
    if (value !== null && Number.isFinite(number)) {
      const tone = toneFor(number);
      return (
        <div className="flex min-w-28 items-center gap-2">
          <ScoreBar value={number} tone={tone} className="w-16 shrink-0" />
          <span className="w-12 text-right tabular-nums">{asPercent(number)}</span>
        </div>
      );
    }
  }

  if (column === "Meets Threshold?") {
    if (value === null) return <>—</>;
    const meets = value === true || String(value).toLowerCase() === "true";
    return (
      <Badge
        variant="outline"
        className={
          meets
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground"
        }
      >
        {meets ? "Yes" : "No"}
      </Badge>
    );
  }

  if (column === "Error" && value !== null) {
    return <span className="text-destructive">{String(value)}</span>;
  }

  return <>{formatCell(value, column)}</>;
}

function ColumnHeader({ column }: { column: string }) {
  const help = COLUMN_PAIR_HELP[column];
  if (!help) return <>{column}</>;

  return (
    <span className="inline-flex items-center gap-1">
      {column}
      <HelpTip label={column} help={help} />
    </span>
  );
}

function DetailsTable({
  table,
  rows,
}: {
  table: EvaluationTable;
  rows: EvaluationTable["rows"];
}) {
  if (table.rows.length === 0) return null;

  return (
    <div className="max-h-96 overflow-auto rounded-md border border-border/60">
      <table className="min-w-max border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
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
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border/30 transition-colors last:border-0 hover:bg-muted/30"
            >
              {row.map((value, columnIndex) => (
                <td
                  key={columnIndex}
                  className="px-3 py-2 tabular-nums text-foreground/90"
                >
                  <CellContent value={value} column={table.columns[columnIndex] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? "secondary" : "ghost"}
      aria-pressed={active}
      onClick={onClick}
      className="text-[11px]"
    >
      {children}
    </Button>
  );
}

function PropertyCard({ property }: { property: EvaluationProperty }) {
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [contributingOnly, setContributingOnly] = useState(false);
  const isShapes = property.property === "Column Shapes";
  const isPairs = property.property === "Column Pair Trends";
  const tone = toneFor(property.score);
  const scoreIndex = property.details.columns.indexOf("Score");
  const thresholdIndex = property.details.columns.indexOf("Meets Threshold?");

  const rows = useMemo(() => {
    let filtered = [...property.details.rows];

    if (isShapes && onlyWeak && scoreIndex >= 0) {
      filtered = filtered.filter((row) => scoreOf(row, scoreIndex) < 0.9);
    }
    if (isPairs && contributingOnly && thresholdIndex >= 0) {
      filtered = filtered.filter((row) => row[thresholdIndex] === true);
    }
    if (scoreIndex >= 0) {
      filtered.sort((a, b) => scoreOf(a, scoreIndex) - scoreOf(b, scoreIndex));
    }
    return filtered;
  }, [
    contributingOnly,
    isPairs,
    isShapes,
    onlyWeak,
    property.details.rows,
    scoreIndex,
    thresholdIndex,
  ]);

  const total = property.details.rows.length;
  const noun = isPairs ? "pairs" : "columns";
  const countLabel = isPairs
    ? `${rows.length} of ${total} ${noun}`
    : isShapes
      ? `${rows.length} of ${total} ${noun}`
      : `${total} checks`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{property.property}</CardTitle>
        <CardDescription>
          {PROPERTY_HELP[property.property] ??
            "SDV property score across the evaluated columns."}
        </CardDescription>
        <CardAction>
          <ToneBadge tone={tone}>{asPercent(property.score)}</ToneBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ScoreBar value={property.score} tone={tone} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {countLabel}
            {isShapes && onlyWeak ? " below 90%" : ""}
          </p>
          {isShapes && total > 0 && (
            <div className="flex items-center gap-1">
              <FilterButton active={!onlyWeak} onClick={() => setOnlyWeak(false)}>
                All columns
              </FilterButton>
              <FilterButton active={onlyWeak} onClick={() => setOnlyWeak(true)}>
                Below 90%
              </FilterButton>
            </div>
          )}
          {isPairs && total > 0 && (
            <div className="flex items-center gap-1">
              <FilterButton
                active={!contributingOnly}
                onClick={() => setContributingOnly(false)}
              >
                All pairs
              </FilterButton>
              <FilterButton
                active={contributingOnly}
                onClick={() => setContributingOnly(true)}
              >
                Contributing only
              </FilterButton>
            </div>
          )}
        </div>
        {rows.length > 0 ? (
          <DetailsTable table={property.details} rows={rows} />
        ) : total > 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            No {noun} match this filter.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No detailed results were returned for this check.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSection({ report }: { report: EvaluationReportData }) {
  const isQuality = report.report === "quality";
  const tone = toneFor(report.score);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium">
            {isQuality ? "Statistical quality" : "Validity check"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isQuality
              ? "Higher is better. Scores are averaged across the scored columns and contributing pairs."
              : "Pass/fail-oriented checks for ranges, categories, formats, and table structure. This is not a measure of realism."}
          </p>
        </div>
        <ToneBadge tone={tone}>{asPercent(report.score)}</ToneBadge>
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
  columnNames,
}: {
  evaluation: SyntheticEvaluation;
  columnNames?: string[];
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <QualityOverview evaluation={evaluation} />
          <ValidityCard evaluation={evaluation} columnNames={columnNames} />
        </div>

        <ReportSection report={evaluation.quality} />
        <ReportSection report={evaluation.diagnostic} />
      </div>
    </TooltipProvider>
  );
}
