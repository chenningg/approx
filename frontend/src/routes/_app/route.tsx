import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { BoxesIcon } from 'lucide-react'

import { useAuthStore } from '@/features/auth/store'

function UserAvatar({ username }: { username?: string }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : '??'

  return (
    <div
      className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/20"
      aria-label={username ? `${username}'s profile` : 'User profile'}
    >
      {initials}
    </div>
  )
}

function AppLayout() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/upload" className="flex items-center gap-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BoxesIcon className="size-4" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight">
              ApproX
            </span>
          </Link>
          <UserAvatar username={user?.username} />
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})
