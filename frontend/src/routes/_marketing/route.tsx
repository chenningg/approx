import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-heading text-xl font-bold tracking-tight">
              ApproX
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Synthetic data from real data
            </span>
          </div>
          <Button asChild>
            <Link to="/login">Log in</Link>
          </Button>
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
  )
}

export const Route = createFileRoute('/_marketing')({
  component: MarketingLayout,
})