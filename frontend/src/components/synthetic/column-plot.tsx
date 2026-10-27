"use client"

import { useQuery } from "@tanstack/react-query"
import { BarChartIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { syntheticColumnPlotQueryOptions } from "@/features/datasets/queries"
import type { ColumnPlotResponse } from "@/features/datasets/types"

interface ColumnPlotProps {
  datasetId: string
  jobId: string
  columnNames: string[]
  className?: string
}

function PlotlyChart({ figure }: { figure: ColumnPlotResponse["plot"] }) {
  const ref = useMemo(() => {
    if (typeof window === "undefined") return null
    return import("react-plotly.js").then((mod) => mod.default)
  }, [])

  const [Plotly, setPlotly] = useState<React.ComponentType<any> | null>(null)

  if (!Plotly && ref) {
    ref.then(setPlotly)
  }

  if (!Plotly || !figure) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Plotly
      data={figure.data}
      layout={figure.layout}
      config={{ displayModeBar: true, responsive: true }}
      style={{ width: "100%", height: "400px" }}
    />
  )
}

function PlotError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-[400px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCwIcon className="size-3.5 mr-1.5" />
        Retry
      </Button>
    </div>
  )
}

export function ColumnPlot({ datasetId, jobId, columnNames, className }: ColumnPlotProps) {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(columnNames[0] ?? null)

  const query = useQuery({
    ...syntheticColumnPlotQueryOptions(datasetId, jobId, selectedColumn ?? ""),
    enabled: !!selectedColumn,
    retry: 1,
  })

  const handleColumnChange = useCallback((value: string) => {
    setSelectedColumn(value)
  }, [])

  const handleRetry = useCallback(() => {
    query.refetch()
  }, [query])

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChartIcon className="size-4 text-primary" />
              Column Distribution
            </CardTitle>
            <CardDescription>
              Compare the distribution of a single column between original and synthetic data.
            </CardDescription>
          </div>
          <Select value={selectedColumn ?? ""} onValueChange={handleColumnChange} disabled={columnNames.length === 0}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Select a column…" />
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
      </CardHeader>
      <CardContent className="pt-0">
        {selectedColumn ? (
          query.isPending ? (
            <Skeleton className="h-[400px] w-full" />
          ) : query.isError ? (
            <PlotError
              message={
                query.error instanceof Error
                  ? query.error.message
                  : "Failed to load column plot"
              }
              onRetry={handleRetry}
            />
          ) : query.data?.plot ? (
            <PlotlyChart figure={query.data.plot} />
          ) : (
            <div className="flex h-[400px] w-full items-center justify-center text-muted-foreground">
              <p>No plot available for this column</p>
            </div>
          )
        ) : (
          <div className="flex h-[400px] w-full items-center justify-center text-muted-foreground">
            <p>Select a column to view its distribution</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}