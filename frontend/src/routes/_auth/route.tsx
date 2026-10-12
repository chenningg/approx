import { Outlet, createFileRoute } from '@tanstack/react-router'

function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Outlet />
    </div>
  )
}

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})