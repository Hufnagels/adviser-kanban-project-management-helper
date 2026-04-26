import { useState } from 'react'
import { Pencil, Download, Trash2, Eye } from 'lucide-react'
import { fmtSize } from '@/utils/fileUtils'
import DescEditModal from './DescEditModal'
import FileTypeIcon from './FileTypeIcon'

export interface FileRecord {
  id: string
  name: string
  size: number
  content_type?: string | null
  description?: string | null
  created_at?: string
}

interface Props {
  file: FileRecord
  onDownload: (file: FileRecord) => void
  onDelete: (file: FileRecord) => void
  onPreview: (file: FileRecord) => void
  onDescriptionSave: (id: string, description: string) => Promise<void>
  /** Optional badge shown below the name, e.g. "Contract: My Deal" */
  badge?: string
}

export default function FileListItem({ file, onDownload, onDelete, onPreview, onDescriptionSave, badge }: Props) {
  const [editingDesc, setEditingDesc] = useState(false)

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 group">
      <FileTypeIcon contentType={file.content_type} size={22} className="mt-0.5" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{fmtSize(file.size)}</span>
        </div>

        {badge && (
          <span className="text-xs text-muted-foreground mt-0.5 block">{badge}</span>
        )}

        <div className="flex items-center gap-1 mt-0.5">
          {file.description ? (
            <span className="text-xs text-muted-foreground truncate">{file.description}</span>
          ) : (
            <span className="text-xs text-muted-foreground/40 italic">No description</span>
          )}
          <button
            onClick={() => setEditingDesc(true)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
            title="Edit description"
          >
            <Pencil size={11} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <button onClick={() => onPreview(file)} className="text-muted-foreground hover:text-primary transition-colors" title="Preview">
          <Eye size={14} />
        </button>
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
