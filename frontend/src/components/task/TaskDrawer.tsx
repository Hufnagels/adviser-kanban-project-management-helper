import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { toast } from 'sonner'
import { Paperclip } from 'lucide-react'
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet'
import {
  useUpdateTaskMutation,
  useCreateTaskMutation,
  useGetTaskFilesQuery,
  useUploadTaskFileMutation,
  useDeleteTaskFileMutation,
  useUpdateTaskFileDescriptionMutation,
  type Task,
} from '@/features/kanban/taskApi'
import FileListItem from '@/components/files/FileListItem'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import { fetchBlobUrl } from '@/utils/fileUtils'

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Task['status']; label: string; color: string }[] = [
  { value: 'todo', label: 'To Do', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_review', label: 'In Review', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-700' },
]

const PRIORITY_OPTIONS: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
]

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
}


// ── sub-components ────────────────────────────────────────────────────────────

type Tab = 'details' | 'notes' | 'files'

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0 mt-1.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ── Details tab ───────────────────────────────────────────────────────────────

function DetailsTab({ task, onChange }: { task: Task; onChange: (patch: Partial<Task>) => void }) {
  return (
    <div className="divide-y">
      {/* Status */}
      <FieldRow label="Status">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ status: s.value })}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                task.status === s.value
                  ? s.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </FieldRow>

      {/* Priority */}
      <FieldRow label="Priority">
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => onChange({ priority: p.value })}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
                task.priority === p.value
                  ? p.color + ' ring-2 ring-offset-1 ring-current'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </FieldRow>

      {/* Type */}
      <FieldRow label="Type">
        <input
          defaultValue={task.task_type ?? ''}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== (task.task_type ?? '')) onChange({ task_type: v || undefined })
          }}
          placeholder="e.g. Bug, Feature…"
          className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
        />
      </FieldRow>

      {/* Dates */}
      <FieldRow label="Listing Date">
        <input
          type="date"
          defaultValue={task.listing_date ?? ''}
          onChange={(e) => onChange({ listing_date: e.target.value || undefined })}
          className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </FieldRow>
      <FieldRow label="Due Date">
        <input
          type="date"
          defaultValue={task.due_date ?? ''}
          onChange={(e) => onChange({ due_date: e.target.value || undefined })}
          className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </FieldRow>
      <FieldRow label="Finishing Date">
        <input
          type="date"
          defaultValue={task.finishing_date ?? ''}
          onChange={(e) => onChange({ finishing_date: e.target.value || undefined })}
          className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </FieldRow>

      {/* Approval */}
      <FieldRow label="Approval">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={task.approval}
            onChange={(e) => onChange({ approval: e.target.checked })}
            className="accent-primary w-4 h-4"
          />
          <span className="text-sm">{task.approval ? 'Approved' : 'Pending'}</span>
        </label>
      </FieldRow>
    </div>
  )
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ task, onChange }: { task: Task; onChange: (patch: Partial<Task>) => void }) {
  const [value, setValue] = useState(task.notes ?? '')
  const [saved, setSaved] = useState(true)

  // reset when task changes
  useEffect(() => {
    setValue(task.notes ?? '')
    setSaved(true)
  }, [task.id])

  function handleChange(html: string) {
    setValue(html)
    setSaved(false)
  }

  function handleSave() {
    onChange({ notes: value || undefined })
    setSaved(true)
    toast.success('Notes saved.')
  }

  return (
    <div className="space-y-3">
      <div className="quill-wrapper rounded-lg border overflow-hidden">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={handleChange}
          modules={QUILL_MODULES}
          placeholder="Add notes, links, or any context…"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {saved ? 'All changes saved' : 'Unsaved changes'}
        </span>
        <button
          onClick={handleSave}
          disabled={saved}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── Files tab ─────────────────────────────────────────────────────────────────

function FilesTab({ taskId }: { taskId: string }) {
  const { data: files = [], isLoading } = useGetTaskFilesQuery(taskId)
  const [uploadFile, { isLoading: isUploading }] = useUploadTaskFileMutation()
  const [deleteFile] = useDeleteTaskFileMutation()
  const [updateDesc] = useUpdateTaskFileDescriptionMutation()
  const [preview, setPreview] = useState<{ id: string; name: string; contentType: string | null } | null>(null)

  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        const form = new FormData()
        form.append('file', file)
        try {
          await uploadFile({ taskId, form }).unwrap()
          toast.success(`Uploaded "${file.name}".`)
        } catch {
          toast.error(`Failed to upload "${file.name}".`)
        }
      }
    },
    [taskId, uploadFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true })

  async function handleDownload(file: { id: string; name: string }) {
    try {
      const url = await fetchBlobUrl(`/api/v1/tasks/${taskId}/files/${file.id}/download`)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed.')
    }
  }

  async function handleDelete(file: { id: string; name: string }) {
    await deleteFile({ taskId, fileId: file.id })
    toast.info(`"${file.name}" removed.`)
  }

  async function handleDescriptionSave(fileId: string, description: string) {
    await updateDesc({ taskId, fileId, description }).unwrap()
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input {...getInputProps()} />
        <Paperclip size={28} className="mx-auto mb-2 text-muted-foreground/50" />
        {isUploading ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : isDragActive ? (
          <p className="text-sm text-primary font-medium">Drop files here</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag & drop files here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <FileListItem
              key={f.id}
              file={f}
              onDownload={(file) => handleDownload(file)}
              onDelete={(file) => handleDelete(file)}
              onPreview={(file) => setPreview({ id: file.id, name: file.name, contentType: file.content_type ?? null })}
              onDescriptionSave={handleDescriptionSave}
            />
          ))}
        </div>
      )}

      {preview && (
        <FilePreviewModal
          apiUrl={`/api/v1/tasks/${taskId}/files/${preview.id}/download`}
          name={preview.name}
          contentType={preview.contentType}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// ── Create form (shown when mode="create") ────────────────────────────────────

function CreateForm({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const [createTask, { isLoading }] = useCreateTaskMutation()
  const [form, setForm] = useState({
    title: '',
    task_type: '',
    status: 'todo' as Task['status'],
    priority: 'medium' as Task['priority'],
    listing_date: '',
    due_date: '',
    finishing_date: '',
    approval: false,
    description: '',
    notes: '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await createTask({
        title: form.title.trim(),
        task_type: form.task_type || undefined,
        status: form.status,
        priority: form.priority,
        listing_date: form.listing_date || undefined,
        due_date: form.due_date || undefined,
        finishing_date: form.finishing_date || undefined,
        approval: form.approval,
        description: form.description || undefined,
        notes: form.notes || undefined,
        project_id: projectId,
      }).unwrap()
      toast.success('Task created.')
      onClose()
    } catch {
      toast.error('Failed to create task.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="px-5 py-4 border-b shrink-0 pr-12">
        <SheetTitle className="text-xl font-semibold">New Task</SheetTitle>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title *</label>
          <input autoFocus required value={form.title} onChange={e => set('title', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Task title…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <input value={form.task_type} onChange={e => set('task_type', e.target.value)}
              placeholder="Bug, Feature…"
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as Task['status'])}
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value as Task['priority'])}
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background">
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Approval</label>
            <div className="flex items-center h-[34px]">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.approval} onChange={e => set('approval', e.target.checked)} className="accent-primary w-4 h-4" />
                Approved
              </label>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['listing_date', 'due_date', 'finishing_date'] as const).map(k => (
            <div key={k} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground capitalize">{k.replace('_', ' ')}</label>
              <input type="date" value={form[k]} onChange={e => set(k, e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t shrink-0">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-muted">Cancel</button>
        <button type="submit" disabled={isLoading}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
          {isLoading ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

interface Props {
  task: Task | null
  open: boolean
  onClose: () => void
  projectId?: string
  mode?: 'edit' | 'create'
}

export default function TaskDrawer({ task, open, onClose, projectId, mode = 'edit' }: Props) {
  const [updateTask] = useUpdateTaskMutation()
  const [tab, setTab] = useState<Tab>('details')
  const [title, setTitle] = useState('')
  const [titleEditing, setTitleEditing] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setTab('details')
      setTitleEditing(false)
    }
  }, [task?.id])

  // Create mode: show the simple create form
  if (mode === 'create') {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col gap-0">
          <CreateForm projectId={projectId} onClose={onClose} />
        </SheetContent>
      </Sheet>
    )
  }

  if (!task) return null

  const statusMeta = STATUS_OPTIONS.find((s) => s.value === task.status)

  function handlePatch(patch: Partial<Task>) {
    updateTask({ id: task!.id, ...patch })
  }

  function handleTitleSave() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task!.title) {
      handlePatch({ title: trimmed })
    } else {
      setTitle(task!.title)
    }
    setTitleEditing(false)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'notes', label: 'Notes' },
    { id: 'files', label: 'Files' },
  ]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0 pr-12">
          <div className="min-w-0">
            {/* Status badge */}
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${statusMeta?.color ?? 'bg-muted'}`}>
              {statusMeta?.label ?? task.status}
            </span>

            {/* Editable title */}
            {titleEditing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') { setTitle(task.title); setTitleEditing(false) }
                }}
                className="w-full text-xl font-semibold bg-transparent border-b-2 border-primary focus:outline-none"
              />
            ) : (
              <SheetTitle
                className="text-xl font-semibold cursor-text hover:text-primary/80 transition-colors leading-tight"
                onClick={() => setTitleEditing(true)}
                title="Click to edit title"
              >
                {task.title}
              </SheetTitle>
            )}

            {task.task_type && (
              <p className="text-xs text-muted-foreground mt-1">{task.task_type}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'details' && <DetailsTab key={task.id} task={task} onChange={handlePatch} />}
          {tab === 'notes' && <NotesTab key={task.id} task={task} onChange={handlePatch} />}
          {tab === 'files' && <FilesTab taskId={task.id} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
