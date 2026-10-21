import { createFileRoute } from '@tanstack/react-router'

import { DatasetPreview } from '@/components/dataset-preview/dataset-preview'

function DatasetTransformPage() {
  const { datasetId } = Route.useParams()
  return <DatasetPreview id={datasetId} mode="transform" />
}

export const Route = createFileRoute('/_app/datasets/$datasetId/transform')({
  component: DatasetTransformPage,
})
