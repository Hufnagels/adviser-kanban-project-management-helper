import { useEffect, useState } from 'react'
import { X, Download, File, FileText, Image } from 'lucide-react'
import { fetchBlobUrl, previewKind } from '@/utils/fileUtils'

interface Props {
  apiUrl: string
  name: string
  contentType: string | null
  onClose: () => void
}

export default function FilePreviewModal({ apiUrl, name, contentType, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const kind = previewKind(contentType)

  useEffect(() => {
    let revoke: string | null = null
    fetchBlobUrl(apiUrl)
      .then((url) => {
        revoke = url
        setBlobUrl(url)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [apiUrl])

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    a.click()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 900, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="font-medium text-sm truncate max-w-[70%]">{name}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!blobUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded hover:bg-muted disabled:opacity-40"
            >
              <Download size={13} /> Download
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex items-center justify-center min-h-0 bg-muted/20">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">Failed to load file.</p>
          )}
          {!loading && !error && blobUrl && kind === 'image' && (
            <img
              src={blobUrl}
              alt={name}
              className="max-w-full max-h-full object-contain p-4"
            />
          )}
          {!loading && !error && blobUrl && kind === 'pdf' && (
            <iframe
              src={blobUrl}
              title={name}
              className="w-full h-full border-0"
              style={{ minHeight: '70vh' }}
            />
          )}
          {!loading && !error && blobUrl && kind === 'none' && (
            <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
              <File size={56} className="opacity-30" />
              <p className="font-medium text-sm">{name}</p>
              <p className="text-xs opacity-60">No preview available for this file type.</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                <Download size={14} /> Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
