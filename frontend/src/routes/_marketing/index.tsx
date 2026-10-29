import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Database,
  ShieldCheck,
  TableProperties,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import wallpaper from "@/assets/astronaut-facing-mysterious-black-hole-live-wallpaper.webm";

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
      <section className="relative flex min-h-svh items-center overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={wallpaper}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
        <div className="absolute inset-0 bg-background/50" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
            Synthetic data that{" "}
            <span className="bg-linear-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              behaves like the real thing
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Upload a dataset and ApproX learns its structure and distribution,
            then generates fake data that is statistically representative of the
            original without exposing it.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 gap-2 animate-glow-pulse border-violet-400/90 bg-violet-500/25 px-8 text-base text-violet-100 transition-all duration-200 hover:animate-none hover:border-violet-300 hover:bg-violet-500/35 hover:text-white hover:shadow-[inset_0_0_30px_-2px_rgba(139,92,246,1)]"
            >
              <Link to="/login">
                Log in
                <ArrowRight className="size-4" />
              </Link>
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

export const Route = createFileRoute("/_marketing/")({
  component: LandingPage,
});
