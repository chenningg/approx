import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { NotFoundPage } from '@/components/not-found'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
})
