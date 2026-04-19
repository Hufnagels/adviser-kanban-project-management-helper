import {
  Gantt,
  type Column,
  type ColumnProps,
  type Task as GanttTask,
  type TaskOrEmpty,
  ViewMode,
} from '@wamra/gantt-task-react'
import '@wamra/gantt-task-react/dist/style.css'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useGetTasksQuery } from '@/features/kanban/taskApi'
import { GanttChart, ArrowRight } from 'lucide-react'
import type { RootState } from '@/store'

// ── Project colour palette (bar bg / progress) ────────────────────────────────

const PROJECT_PALETTES = [
  { bg: '#93c5fd99', progress: '#3b82f6' }, // blue
  { bg: '#c4b5fd99', progress: '#7c3aed' }, // violet
  { bg: '#6ee7b799', progress: '#059669' }, // emerald
  { bg: '#fdba7499', progress: '#ea580c' }, // orange
  { bg: '#fca5a599', progress: '#dc2626' }, // rose
  { bg: '#67e8f999', progress: '#0891b2' }, // cyan
]

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: ViewMode.Day,   label: 'Day' },
  { id: ViewMode.Week,  label: 'Week' },
  { id: ViewMode.Month, label: 'Month' },
]

// ── Per-project task fetcher ───────────────────────────────────────────────────

function useProjectGanttTasks(projectId: string) {
  const { data: tasks = [], isLoading } = useGetTasksQuery({ project_id: projectId })
  const rows: GanttTask[] = tasks
    .filter((t) => t.listing_date && t.due_date)
    .map((t) => {
      const start = new Date(t.listing_date!)
      const end   = new Date(t.due_date!)
      if (end <= start) end.setDate(start.getDate() + 1)
      return {
        id: t.id,
        name: t.title,
        start,
        end,
        parent: `project-${projectId}`,
        progress:
          t.status === 'done'        ? 100 :
          t.status === 'in_review'   ? 75  :
          t.status === 'in_progress' ? 40  : 0,
        type: 'task',
      } as GanttTask
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  return { rows, isLoading }
}

// ── Colour legend ─────────────────────────────────────────────────────────────

function Legend({ projects }: { projects: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {projects.map((p, i) => {
        const pal = PROJECT_PALETTES[i % PROJECT_PALETTES.length]
        return (
          <span key={p.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: pal.progress }}
            />
            {p.name}
          </span>
        )
      })}
    </div>
  )
}

// ── Combined chart (renders once all data is ready) ───────────────────────────

function CombinedGantt({
  projects,
  viewMode,
}: {
  projects: { id: string; name: string }[]
  viewMode: ViewMode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Translate touch swipe to horizontal scroll so the Gantt timeline is
  // navigable on touch devices (the library's internal SVG blocks native scroll)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let startX = 0
    let startScrollLeft = 0

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startScrollLeft = el!.scrollLeft
    }

    function onTouchMove(e: TouchEvent) {
      const dx = startX - e.touches[0].clientX
      el!.scrollLeft = startScrollLeft + dx
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  const allRows: GanttTask[] = []
  const loadingFlags: boolean[] = []
  const paletteByProjectRowId = new Map(
    projects.map((project, index) => [`project-${project.id}`, PROJECT_PALETTES[index % PROJECT_PALETTES.length]]),
  )

  // Collect per-project rows (hooks must be called unconditionally in the
  // same order every render — projects list is stable from Redux state).
  for (let i = 0; i < projects.length; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { rows, isLoading } = useProjectGanttTasks(projects[i].id)
    loadingFlags.push(isLoading)

    if (rows.length > 0) {
      // Project header row
      const starts = rows.map((r) => r.start.getTime())
      const ends   = rows.map((r) => r.end.getTime())

      allRows.push({
        id:       `project-${projects[i].id}`,
        name:     projects[i].name,
        start:    new Date(Math.min(...starts)),
        end:      new Date(Math.max(...ends)),
        progress: 0,
        hideChildren: false,
        type: 'project',
      } as GanttTask)

      allRows.push(...rows)
    }
  }

  if (loadingFlags.some(Boolean)) {
    return <div className="text-sm text-muted-foreground py-4">Loading…</div>
  }

  if (allRows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No tasks with both listing_date and due_date found across these projects.
      </p>
    )
  }
  const getProjectCellStyle = (task: TaskOrEmpty) => {
    if (task.type !== 'project') return undefined
    const palette = paletteByProjectRowId.get(task.id)
    if (!palette) return undefined
    return { backgroundColor: palette.progress, color: '#fff' }
  }

  const columns: Column[] = [
    {
      id: 'project-name',
      title: 'Name',
      width: 220,
      Cell: function ProjectNameCell({ data }: ColumnProps) {
        const task = data.task
        const expanderSymbol = task.type === 'project'
          ? task.hideChildren === false ? '▼' : '▶'
          : ''

        return (
          <div className="h-full flex items-center gap-2 px-3 text-sm" style={getProjectCellStyle(task)}>
            <button
              type="button"
              className={`w-4 shrink-0 text-left ${expanderSymbol ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => task.type === 'project' && data.onExpanderClick(task as GanttTask)}
              aria-label={expanderSymbol ? `Toggle ${task.name}` : undefined}
            >
              {expanderSymbol || '•'}
            </button>
            <span className="truncate font-medium">{task.name}</span>
          </div>
        )
      },
    },
    {
      id: 'project-from',
      title: 'From',
      width: 180,
      Cell: function ProjectFromCell({ data }: ColumnProps) {
        const task = data.task
        const value = 'start' in task ? task.start.toLocaleDateString() : ''
        return (
          <div className="h-full flex items-center px-3 text-sm" style={getProjectCellStyle(task)}>
            {value}
          </div>
        )
      },
    },
    {
      id: 'project-to',
      title: 'To',
      width: 180,
      Cell: function ProjectToCell({ data }: ColumnProps) {
        const task = data.task
        const value = 'end' in task ? task.end.toLocaleDateString() : ''
        return (
          <div className="h-full flex items-center px-3 text-sm" style={getProjectCellStyle(task)}>
            {value}
          </div>
        )
      },
    },
  ]

  return (
    <div ref={containerRef} className="border rounded-lg overflow-auto" style={{ touchAction: 'pan-y' }}>
      <Gantt
        tasks={allRows}
        columns={columns}
        viewMode={viewMode}
        distances={{
          columnWidth: viewMode === ViewMode.Day ? 40 : viewMode === ViewMode.Week ? 120 : 200,
          rowHeight: 40,
        }}
        fontSize="13px"
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const inWork    = useSelector((s: RootState) => s.inWork)
  const navigate  = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)

  if (!inWork) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Gantt Chart</h1>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <GanttChart size={52} className="opacity-20" />
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gantt Chart</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{inWork.customerName}</span>
            <span>/</span>
            <span className="font-medium text-foreground">{inWork.contractName}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">
              {inWork.projects.length} project{inWork.projects.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                viewMode === m.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-transparent'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {inWork.projects.length > 0 && <Legend projects={inWork.projects} />}

      {inWork.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <GanttChart size={48} className="opacity-20" />
          <p className="font-medium">No projects in this contract</p>
        </div>
      ) : (
        <CombinedGantt projects={inWork.projects} viewMode={viewMode} />
      )}
    </div>
  )
}
