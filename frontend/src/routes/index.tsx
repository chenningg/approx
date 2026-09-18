import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Database,
  ShieldCheck,
  Sparkles,
  TableProperties,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Feature = {
  icon: LucideIcon;
  accent: string;
  title: string;
  body: string;
};

const features: Feature[] = [
  {
    icon: Activity,
    accent: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
    title: "Representative",
    body: "Synthetic records mirror the shape of your data — distributions, ranges and correlations survive the copy.",
  },
  {
    icon: ShieldCheck,
    accent: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    title: "Privacy-safe",
    body: "Outputs are generated, never copied. Real records never leave your pipeline as-is.",
  },
  {
    icon: TableProperties,
    accent: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
    title: "Schema-aware",
    body: "Column types, formats and constraints are respected, so generated data drops into existing systems.",
  },
  {
    icon: Database,
    accent: "bg-fuchsia-500/10 text-fuchsia-400 ring-fuchsia-500/20",
    title: "Dataset-driven",
    body: "ApproX learns from your dataset and inherits its statistical character — bias included, visibly.",
  },
];

function LandingPage() {
  return (
    <>
      <section className="approx-bg">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-20 text-center sm:px-6 sm:pt-28">
          <Badge
            variant="outline"
            className="mb-6 h-6 gap-1.5 rounded-full px-3"
          >
            <Sparkles className="size-3" />
            Generate representative fake data
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            Synthetic data that{" "}
            <span className="bg-linear-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              behaves like the real thing
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Upload a dataset and ApproX learns its structure and distribution,
            then generates fake data that is statistically representative of the
            original — without exposing it.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-8 text-base">
              <Link to="/login">Log in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 px-8 text-base"
            >
              <a href="#features">How it works</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mx-auto max-w-2xl text-center font-heading text-3xl font-semibold tracking-tight">
            Why ApproX
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div
                    className={`mb-2 flex size-10 items-center justify-center rounded-lg ring-1 ${feature.accent}`}
                  >
                    <feature.icon className="size-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {feature.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export const Route = createFileRoute("/")({
  component: LandingPage,
});
