import { Outlet, createFileRoute } from "@tanstack/react-router";

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="fixed inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-xl font-bold tracking-tight">
              ApproX
            </span>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ApproX — representative fake data
            from your real data.
          </p>
        </div>
      </footer>
    </div>
  );
}

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});
