import { createFileRoute } from '@tanstack/react-router'

import { SyntheticGenerator } from '@/components/synthetic/synthetic-generator'

function DatasetSyntheticPage() {
  const { datasetId } = Route.useParams()
  return <SyntheticGenerator id={datasetId} />
}

export const Route = createFileRoute('/_app/datasets/$datasetId/synthetic')({
  component: DatasetSyntheticPage,
})
