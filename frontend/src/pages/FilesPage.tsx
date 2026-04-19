import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, Search, List, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { useGetAllFilesQuery, type CentralFileRecord } from '@/features/files/filesApi'
import FileListItem from '@/components/files/FileListItem'
import FileCardItem from '@/components/files/FileCardItem'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import { fetchBlobUrl } from '@/utils/fileUtils'

const SOURCE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'contract', label: 'Contracts' },
  { value: 'task', label: 'Tasks' },
]

export default function FilesPage() {
  const navigate = useNavigate()
  const [sourceType, setSourceType] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [preview, setPreview] = useState<CentralFileRecord | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card')

  const { data: files = [], isLoading } = useGetAllFilesQuery({ source_type: sourceType, search })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  async function handleDownload(file: CentralFileRecord) {
    const base = file.source_type === 'contract'
      ? `/api/v1/contracts/${file.source_id}/files/${file.id}/download`
      : `/api/v1/tasks/${file.source_id}/files/${file.id}/download`
    try {
      const url = await fetchBlobUrl(base)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed.')
    }
  }

  function handlePreview(file: CentralFileRecord) {
    setPreview(file)
  }

  function handleDelete() {
    // Central page is read-only for deletions — direct user to source
    toast.info('To delete a file, open the source contract or task.')
  }

  function previewApiUrl(file: CentralFileRecord) {
    return file.source_type === 'contract'
      ? `/api/v1/contracts/${file.source_id}/files/${file.id}/download`
      : `/api/v1/tasks/${file.source_id}/files/${file.id}/download`
  }

  function handleBadgeClick(file: CentralFileRecord) {
    if (file.source_type === 'contract') navigate(`/contracts/${file.source_id}?tab=documents`)
    else navigate(`/tasks`)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Files</h1>
        <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        {/* Source type filter */}
        <div className="flex rounded-lg border overflow-hidden">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSourceType(f.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                sourceType === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, description…"
              className="pl-7 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-52"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-sm border rounded hover:bg-muted">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput('') }}
              className="px-3 py-1.5 text-sm border rounded hover:bg-muted text-muted-foreground"
            >
              Clear
            </button>
          )}
        </form>

        {/* View toggle */}
        <div className="flex rounded-lg border overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="List view"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            title="Card view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* File list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <Paperclip size={52} className="opacity-20" />
          <p className="font-medium text-base">No files found</p>
          <p className="text-sm text-center max-w-xs">
            Upload files from a contract's <strong>Documents</strong> tab or from a task's <strong>Files</strong> tab.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {files.map((f) => (
            <FileListItem
              key={f.id}
              file={f}
              badge={`${f.source_type === 'contract' ? 'Contract' : 'Task'}: ${f.source_name}`}
              onDownload={() => handleDownload(f)}
              onDelete={() => handleDelete()}
              onPreview={() => handlePreview(f)}
              onDescriptionSave={async () => {
                toast.info('Edit description from the source contract or task.')
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {files.map((f) => (
            <FileCardItem
              key={f.id}
              file={f}
              apiUrl={previewApiUrl(f)}
              badge={`${f.source_type === 'contract' ? 'Contract' : 'Task'}: ${f.source_name}`}
              onDownload={() => handleDownload(f)}
              onDelete={() => handleDelete()}
              onPreview={() => handlePreview(f)}
              onDescriptionSave={async () => {
                toast.info('Edit description from the source contract or task.')
              }}
            />
          ))}
        </div>
      )}

      {preview && (
        <FilePreviewModal
          apiUrl={previewApiUrl(preview)}
          name={preview.name}
          contentType={preview.content_type}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
