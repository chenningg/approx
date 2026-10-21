import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/datasets/$datasetId')({
  component: DatasetRoute,
})

function DatasetRoute() {
  return <Outlet />
}
