import { useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  useGetTasksQuery,
  useDeleteTaskMutation,
  type Task,
} from '@/features/kanban/taskApi'
import { useImportTasksMutation } from '@/features/tasks/importExportApi'
import {
  Upload, Download, Plus, Trash2,
  ChevronUp, ChevronDown, Search, X,
} from 'lucide-react'
import TaskDrawer from './TaskDrawer'

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Task['status'][] = ['todo', 'in_progress', 'in_review', 'done']
const PRIORITY_OPTIONS: Task['priority'][] = ['low', 'medium', 'high', 'critical']

import { TASK_COLS, STATUS_COLORS, PRIORITY_COLORS } from './taskColumns'

const COLS = [
  ...TASK_COLS,
  { key: null, label: '', width: 'w-10' },
] as const

type SortKey = typeof COLS[number]['key']
type SortDir = 'asc' | 'desc'

// ── helpers ───────────────────────────────────────────────────────────────────

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[value] ?? 'bg-muted'}`}>
      {value.replace('_', ' ')}
    </span>
  )
}

function sortTasks(tasks: Task[], key: SortKey, dir: SortDir): Task[] {
  if (!key) return tasks
  return [...tasks].sort((a, b) => {
    const av = (a as any)[key] ?? ''
    const bv = (b as any)[key] ?? ''
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [importTasks, { isLoading }] = useImportTasksMutation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  function pickFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.warning('Please select an Excel file (.xlsx or .xls)')
      return
    }
    setFile(f)
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) pickFile(dropped)
  }, [])

  async function handleUpload() {
    if (!file) {
      toast.warning('Please select a file first.')
      return
    }

    const tid = toast.loading('Importing tasks…')
    const form = new FormData()
    form.append('file', file)
    form.append('project_id', projectId)

    try {
      const res = await importTasks(form).unwrap() as { imported: number; skipped: number }
      toast.dismiss(tid)

      if (res.imported === 0 && res.skipped > 0) {
        toast.warning(`All ${res.skipped} rows already exist — nothing imported.`)
      } else if (res.imported === 0) {
        toast.info('No tasks found in the file.')
      } else if (res.skipped > 0) {
        toast.success(
          `Imported ${res.imported} task${res.imported !== 1 ? 's' : ''}`,
          { description: `${res.skipped} duplicate${res.skipped !== 1 ? 's' : ''} skipped.` },
        )
      } else {
        toast.success(`Imported ${res.imported} task${res.imported !== 1 ? 's' : ''} successfully.`)
      }

      onClose()
    } catch {
      toast.dismiss(tid)
      toast.error('Import failed.', { description: 'Check the file format and try again.' })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl shadow-lg p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Import from Excel</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Required: <code className="bg-muted px-1 rounded">title</code><br />
          Optional: <code className="bg-muted px-1 rounded">task_id</code> <code className="bg-muted px-1 rounded">status</code> <code className="bg-muted px-1 rounded">priority</code> <code className="bg-muted px-1 rounded">type</code> <code className="bg-muted px-1 rounded">listing_date</code> <code className="bg-muted px-1 rounded">due_date</code> <code className="bg-muted px-1 rounded">finishing_date</code> <code className="bg-muted px-1 rounded">notes</code><br />
          Duplicates are skipped (matched by task_id or title).
        </p>

        {/* Drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors select-none ${
            dragging
              ? 'border-primary bg-primary/5 text-primary'
              : file
              ? 'border-green-400 bg-green-50 text-green-700'
              : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40 text-muted-foreground'
          }`}
        >
          <Upload size={28} className="opacity-70" />
          {file ? (
            <>
              <p className="text-sm font-medium truncate max-w-[220px]">{file.name}</p>
              <p className="text-xs opacity-70">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs opacity-60">.xlsx / .xls</p>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isLoading || !file}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TaskTable ─────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
}

export default function TaskTable({ projectId }: Props) {
  const { data: tasks = [], isLoading } = useGetTasksQuery({ project_id: projectId })
  const [deleteTask] = useDeleteTaskMutation()

  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [addDrawer, setAddDrawer] = useState(false)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)

  const liveDrawerTask = drawerTask
    ? (tasks.find((t) => t.id === drawerTask.id) ?? drawerTask)
    : null

  function handleSort(key: SortKey) {
    if (!key) return
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronUp size={11} className="opacity-20" />
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id).unwrap()
      toast.success('Task deleted.')
    } catch {
      toast.error('Failed to delete task.')
    }
  }

  async function handleExport() {
    const tid = toast.loading('Preparing export…')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/v1/import-export/export?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'tasks.xlsx'; a.click()
      URL.revokeObjectURL(url)
      toast.dismiss(tid)
      toast.success('Export downloaded.')
    } catch {
      toast.dismiss(tid)
      toast.error('Export failed.')
    }
  }

  const filtered = sortTasks(
    tasks.filter((t) => {
      const q = search.toLowerCase()
      const matchSearch = !q || t.title.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)
      const matchStatus = !statusFilter || t.status === statusFilter
      const matchPriority = !priorityFilter || t.priority === priorityFilter
      return matchSearch && matchStatus && matchPriority
    }),
    sortKey,
    sortDir,
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-7 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-44"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-background"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-background"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          <Upload size={13} /> Import
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          <Download size={13} /> Export
        </button>
        <button
          onClick={() => setAddDrawer(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          <Plus size={13} /> Add Task
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b">
              {COLS.map(({ key, label, width }) => (
                <th
                  key={label}
                  className={`${width} px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap ${key ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                  onClick={() => key && handleSort(key)}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    {key && <SortIcon col={key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">No tasks found.</td></tr>
            ) : (
              filtered.map((task, i) => (
                <tr
                  key={task.id}
                  onClick={() => setDrawerTask(task)}
                  className={`border-b last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${i % 2 ? 'bg-muted/10' : ''}`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[7rem]">
                    {(task as any).external_id || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2 font-medium max-w-xs truncate">{task.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {(task as any).task_type || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2"><Badge value={task.status} map={STATUS_COLORS} /></td>
                  <td className="px-3 py-2"><Badge value={task.priority} map={PRIORITY_COLORS} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {task.listing_date || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {task.due_date || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {(task as any).finishing_date || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[12rem] truncate text-xs text-muted-foreground">
                    {task.notes || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {task.approval
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Yes</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">No</span>
                    }
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showImport && <ImportModal projectId={projectId} onClose={() => setShowImport(false)} />}

      <TaskDrawer
        task={liveDrawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
      />
      <TaskDrawer
        task={null}
        open={addDrawer}
        onClose={() => setAddDrawer(false)}
        mode="create"
        projectId={projectId}
      />
    </div>
  )
}
