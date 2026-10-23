import Plotly from "plotly.js-dist-min";
import { useEffect, useRef } from "react";

import type { EvaluationPlot } from "@/features/datasets/types";
import type { Config, Data, Layout } from "plotly.js-dist-min";

interface SyntheticPlotProps {
  figure: EvaluationPlot;
  className?: string;
}

export function SyntheticPlot({ figure, className }: SyntheticPlotProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const data = figure.data as Data[];
    const layout: Partial<Layout> = {
      ...(figure.layout as Partial<Layout>),
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        ...((figure.layout.font as Record<string, unknown> | undefined) ?? {}),
        color: "#e5e7eb",
      },
    };
    delete layout.width;
    delete layout.height;

    const config: Partial<Config> = {
      responsive: true,
      displayModeBar: false,
    };

    void Plotly.react(element, data, layout, config);
    const handleResize = () => {
      void Plotly.Plots.resize(element);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      Plotly.purge(element);
    };
  }, [figure]);

  return <div ref={ref} className={className} />;
}
