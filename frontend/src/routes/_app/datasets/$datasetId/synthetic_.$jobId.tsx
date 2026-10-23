import { createFileRoute } from '@tanstack/react-router'

import { SyntheticComparisonView } from '@/components/synthetic/synthetic-comparison'

function SyntheticComparisonPage() {
  const { datasetId, jobId } = Route.useParams()
  return <SyntheticComparisonView id={datasetId} jobId={jobId} />
}

export const Route = createFileRoute(
  '/_app/datasets/$datasetId/synthetic_/$jobId',
)({
  component: SyntheticComparisonPage,
})
