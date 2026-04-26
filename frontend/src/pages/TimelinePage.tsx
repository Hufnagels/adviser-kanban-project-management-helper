import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, AlignLeft, ArrowRight } from 'lucide-react'
import { useGetTasksQuery, type Task } from '@/features/kanban/taskApi'
import { TASK_COLS, STATUS_COLORS, PRIORITY_COLORS } from '@/components/task/taskColumns'
import type { RootState } from '@/store'
import TaskDrawer from '@/components/task/TaskDrawer'
import ExportMenu from '@/components/ExportMenu'
import { toast } from 'sonner'

// ── Date bucket logic ─────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function mondayOf(d: Date) {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff))
}

type Bucket = 'past' | 'today' | 'this_week' | 'next_week' | 'later' | 'no_date'

function getBucket(dueDate: string | undefined): Bucket {
  if (!dueDate) return 'no_date'
  const now   = startOfDay(new Date())
  const due   = startOfDay(new Date(dueDate))
  const thisMonday = mondayOf(now)
  const nextMonday = new Date(thisMonday.getTime() + 7 * 86400000)
  const afterNext  = new Date(nextMonday.getTime() + 7 * 86400000)

  if (due < now)                              return 'past'
  if (due.getTime() === now.getTime())        return 'today'
  if (due >= thisMonday && due < nextMonday)  return 'this_week'
  if (due >= nextMonday && due < afterNext)   return 'next_week'
  return 'later'
}

// ── Bucket config ─────────────────────────────────────────────────────────────

const BUCKETS: {
  id: Bucket
  label: string
  labelColor: string
  countColor: string
  defaultOpen: boolean
}[] = [
  { id: 'past',      label: 'Past Dates',    labelColor: 'text-red-600',     countColor: 'text-red-400',     defaultOpen: true  },
  { id: 'today',     label: 'Today',         labelColor: 'text-green-600',   countColor: 'text-green-400',   defaultOpen: true  },
  { id: 'this_week', label: 'This week',     labelColor: 'text-teal-600',    countColor: 'text-teal-400',    defaultOpen: true  },
  { id: 'next_week', label: 'Next week',     labelColor: 'text-cyan-600',    countColor: 'text-cyan-400',    defaultOpen: false },
  { id: 'later',     label: 'Later',         labelColor: 'text-yellow-600',  countColor: 'text-yellow-400',  defaultOpen: false },
  { id: 'no_date',   label: 'Without a date',labelColor: 'text-slate-500',   countColor: 'text-slate-400',   defaultOpen: false },
]

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do', in_progress: 'In Progress', in_review: 'In Review', done: 'Done', canceled: 'Canceled',
}

const PROJECT_PALETTE = [
  'text-blue-600', 'text-violet-600', 'text-emerald-600',
  'text-orange-600', 'text-rose-600', 'text-cyan-600',
]

// ── Per-project task loader ───────────────────────────────────────────────────

function useAllTasks(projects: { id: string; name: string }[]) {
  // hooks called unconditionally in stable order
  const results: { task: Task; projectName: string; projectColor: string }[] = []
  for (let i = 0; i < projects.length; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data = [] } = useGetTasksQuery({ project_id: projects[i].id })
    const color = PROJECT_PALETTE[i % PROJECT_PALETTE.length]
    data.forEach((t) => results.push({ task: t, projectName: projects[i].name, projectColor: color }))
  }
  return results
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[value] ?? 'bg-muted'}`}>
      {value.replace('_', ' ')}
    </span>
  )
}

function TaskRow({
  task,
  projectName,
  projectColor,
  onEdit,
}: {
  task: Task
  projectName: string
  projectColor: string
  onEdit: (task: Task) => void
}) {
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'

  return (
    <tr
      className="border-b hover:bg-muted/30 transition-colors text-sm cursor-pointer"
      onClick={() => onEdit(task)}
    >
      {/* Task ID — w-24 */}
      <td className="w-24 px-3 py-2 text-xs text-muted-foreground font-mono">{task.external_id ?? '—'}</td>
      {/* Title — w-60 */}
      <td className="w-60 px-3 py-2 font-medium truncate max-w-[240px]">{task.title}</td>
      {/* Type — w-24 */}
      <td className="w-24 px-3 py-2 text-xs text-muted-foreground">{task.task_type ?? '—'}</td>
      {/* Status — w-32 */}
      <td className="w-32 px-3 py-2">
        <Badge value={task.status} map={STATUS_COLORS} />
      </td>
      {/* Priority — w-24 */}
      <td className="w-24 px-3 py-2">
        <Badge value={task.priority} map={PRIORITY_COLORS} />
      </td>
      {/* Listing Date — w-28 */}
      <td className="w-28 px-3 py-2 text-xs text-muted-foreground">{fmt(task.listing_date)}</td>
      {/* Due Date — w-28 */}
      <td className="w-28 px-3 py-2 text-xs text-muted-foreground">{fmt(task.due_date)}</td>
      {/* Finishing Date — w-28 */}
      <td className="w-28 px-3 py-2 text-xs text-muted-foreground">{fmt(task.finishing_date)}</td>
      {/* Notes — w-48 */}
      <td className="w-48 px-3 py-2 text-xs text-muted-foreground truncate max-w-[192px]">
        {task.notes ? <span dangerouslySetInnerHTML={{ __html: task.notes }} /> : '—'}
      </td>
      {/* Approval — w-20 */}
      <td className="w-20 px-3 py-2">
        {task.approval
          ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Approved</span>
          : <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Pending</span>
        }
      </td>
      {/* Project — extra column */}
      <td className="px-3 py-2">
        <span className={`text-xs font-medium ${projectColor}`}>{projectName}</span>
      </td>
    </tr>
  )
}

// ── Bucket group ──────────────────────────────────────────────────────────────

function BucketGroup({
  bucket,
  rows,
  onEdit,
}: {
  bucket: typeof BUCKETS[0]
  rows: { task: Task; projectName: string; projectColor: string }[]
  onEdit: (task: Task) => void
}) {
  const [open, setOpen] = useState(bucket.defaultOpen)

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-4 py-2.5 bg-card hover:bg-muted/50 transition-colors text-left"
      >
        {open
          ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        }
        <span className={`text-sm font-semibold ${bucket.labelColor}`}>{bucket.label}</span>
        <span className={`text-xs font-normal ${bucket.countColor}`}>
          {rows.length} item{rows.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Table */}
      {open && (
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
              {TASK_COLS.map((col) => (
                <th key={col.key} className={`${col.width} px-3 py-2 text-left font-medium`}>{col.label}</th>
              ))}
              <th className="px-3 py-2 text-left font-medium">Project</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="pl-8 py-3 text-xs text-muted-foreground">
                  No items
                </td>
              </tr>
            ) : (
              rows.map(({ task, projectName, projectColor }) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectName={projectName}
                  projectColor={projectColor}
                  onEdit={onEdit}
                />
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const inWork   = useSelector((s: RootState) => s.inWork)
  const navigate = useNavigate()
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [exporting, setExporting] = useState(false)

  if (!inWork) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <AlignLeft size={52} className="opacity-20" />
          <p className="font-medium text-base">No active work context</p>
          <p className="text-sm text-center max-w-xs">
            Select a customer and contract in{' '}
            <button
              onClick={() => navigate('/contracts')}
              className="text-primary underline hover:opacity-80"
            >
              Clients / Contracts
            </button>{' '}
            and click <strong>inWork</strong> to activate it here.
          </p>
          <button
            onClick={() => navigate('/contracts')}
            className="flex items-center gap-2 mt-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Go to Contracts <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  const allRows = useAllTasks(inWork.projects)
  const liveDrawerTask = drawerTask
    ? (allRows.find((r) => r.task.id === drawerTask.id)?.task ?? drawerTask)
    : null

  async function doExport(format: 'excel' | 'pdf') {
    setExporting(true)
    const tid = toast.loading('Preparing export…')
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      inWork!.projects.forEach((p) => { params.append('project_ids', p.id); params.append('project_names', p.name) })
      const endpoint = format === 'pdf' ? 'export-timeline-pdf' : 'export-timeline'
      const res = await fetch(`/api/v1/import-export/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename=([^\s;]+)/)
      a.download = match ? match[1] : `timeline_${new Date().toISOString().slice(0,10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      a.href = url; a.click(); URL.revokeObjectURL(url)
      toast.dismiss(tid); toast.success('Export downloaded.')
    } catch {
      toast.dismiss(tid); toast.error('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  // Bucket rows
  const grouped = Object.fromEntries(
    BUCKETS.map((b) => [b.id, [] as typeof allRows])
  ) as Record<Bucket, typeof allRows>

  allRows.forEach((r) => {
    grouped[getBucket(r.task.due_date)].push(r)
  })

  // Sort each bucket by due_date asc (no_date by title)
  BUCKETS.forEach(({ id }) => {
    grouped[id].sort((a, b) => {
      if (id === 'no_date') return a.task.title.localeCompare(b.task.title)
      return (a.task.due_date ?? '').localeCompare(b.task.due_date ?? '')
    })
  })

  const total = allRows.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timeline</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{inWork.customerName}</span>
            <span>/</span>
            <span className="font-medium text-foreground">{inWork.contractName}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">
              {inWork.projects.length} project{inWork.projects.length !== 1 ? 's' : ''}
            </span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">{total} task{total !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <ExportMenu
          loading={exporting}
          onExportExcel={() => doExport('excel')}
          onExportPdf={() => doExport('pdf')}
        />
      </div>

      {/* Bucket groups */}
      <div className="space-y-3">
        {BUCKETS.map((bucket) => (
          <BucketGroup key={bucket.id} bucket={bucket} rows={grouped[bucket.id]} onEdit={setDrawerTask} />
        ))}
      </div>

      <TaskDrawer
        task={liveDrawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
      />
    </div>
  )
}
