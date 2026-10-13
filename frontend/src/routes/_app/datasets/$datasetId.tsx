import { createFileRoute } from '@tanstack/react-router'

import { DatasetPreview } from '@/components/dataset-preview/dataset-preview'

function DatasetPreviewPage() {
  const { datasetId } = Route.useParams()
  return <DatasetPreview id={datasetId} />
}

export const Route = createFileRoute('/_app/datasets/$datasetId')({
  component: DatasetPreviewPage,
})
