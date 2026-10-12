export interface UploadedDataset {
  id: string
  filename: string
  size: number
}

export async function uploadDataset(file: File): Promise<UploadedDataset> {
  // TODO: POST the file to the datasets API once the endpoint exists.
  return {
    id: crypto.randomUUID(),
    filename: file.name,
    size: file.size,
  }
}