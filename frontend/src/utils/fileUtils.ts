export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type PreviewKind = 'image' | 'pdf' | 'none'

export function previewKind(contentType: string | null | undefined): PreviewKind {
  if (!contentType) return 'none'
  if (contentType.startsWith('image/')) return 'image'
  if (contentType === 'application/pdf') return 'pdf'
  return 'none'
}

export function fileIconName(contentType: string | null | undefined): string {
  if (!contentType) return 'File'
  if (contentType.startsWith('image/')) return 'Image'
  if (contentType === 'application/pdf') return 'FileText'
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv')) return 'Sheet'
  if (contentType.includes('word') || contentType.includes('document')) return 'FileType'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'Presentation'
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'Archive'
  return 'File'
}

export async function fetchBlobUrl(apiUrl: string): Promise<string> {
  const token = localStorage.getItem('token')
  const res = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch file')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
