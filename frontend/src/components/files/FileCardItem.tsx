import { useEffect, useState } from 'react'
import { Image, Pencil, Download, Trash2, Eye } from 'lucide-react'
import { fmtSize, previewKind, fetchBlobUrl } from '@/utils/fileUtils'
import DescEditModal from './DescEditModal'
import type { FileRecord } from './FileListItem'
import FileTypeIcon from './FileTypeIcon'

interface Props {
  file: FileRecord
  apiUrl: string       // download URL used to fetch the preview blob
  onDownload: (file: FileRecord) => void
  onDelete: (file: FileRecord) => void
  onPreview: (file: FileRecord) => void
  onDescriptionSave: (id: string, description: string) => Promise<void>
  badge?: string
}


function ImagePreview({ apiUrl }: { apiUrl: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    fetchBlobUrl(apiUrl).then((u) => { url = u; setSrc(u) }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [apiUrl])

  if (!src) return <Image size={48} className="opacity-20" />
  return <img src={src} alt="" className="w-full h-full object-cover" />
}

export default function FileCardItem({ file, apiUrl, onDownload, onDelete, onPreview, onDescriptionSave, badge }: Props) {
  const [editingDesc, setEditingDesc] = useState(false)
  const kind = previewKind(file.content_type)

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      {/* Preview area */}
      <div
        className="relative h-36 bg-muted/30 flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => onPreview(file)}
      >
        {kind === 'image' ? (
          <ImagePreview apiUrl={apiUrl} />
        ) : (
          <FileTypeIcon contentType={file.content_type} size={48} />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <Eye size={22} className="text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 flex-1 flex flex-col gap-1 min-w-0">
        <p className="font-medium text-sm truncate" title={file.name}>{file.name}</p>
        <p className="text-xs text-muted-foreground">{fmtSize(file.size)}</p>
        {badge && <p className="text-xs text-muted-foreground/70 truncate">{badge}</p>}
        <div className="flex items-center gap-1 flex-1 mt-0.5">
          {file.description ? (
            <span className="text-xs text-muted-foreground truncate flex-1">{file.description}</span>
          ) : (
            <span className="text-xs text-muted-foreground/40 italic flex-1">No description</span>
          )}
          <button
            onClick={() => setEditingDesc(true)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
            title="Edit description"
          >
            <Pencil size={11} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-2.5 flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDownload(file)} className="text-muted-foreground hover:text-primary transition-colors" title="Download">
          <Download size={14} />
        </button>
        <button onClick={() => onDelete(file)} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {editingDesc && (
        <DescEditModal
          fileName={file.name}
          initialValue={file.description ?? ''}
          onSave={(desc) => onDescriptionSave(file.id, desc)}
          onClose={() => setEditingDesc(false)}
        />
      )}
    </div>
  )
}
