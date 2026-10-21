import { createFileRoute } from '@tanstack/react-router'

import { DatasetPreview } from '@/components/dataset-preview/dataset-preview'

function DatasetInspectPage() {
  const { datasetId } = Route.useParams()
  return <DatasetPreview id={datasetId} mode="inspect" />
}

export const Route = createFileRoute('/_app/datasets/$datasetId/')({
  component: DatasetInspectPage,
})
