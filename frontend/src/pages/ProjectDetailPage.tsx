import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useGetTasksQuery, useUpdateTaskMutation, type Task } from '@/features/kanban/taskApi'
import DocEditorPanel from '@/components/docs/DocEditorPanel'
import { api } from '@/api/baseApi'
import TaskTable from '@/components/task/TaskTable'
import TaskDrawer from '@/components/task/TaskDrawer'
import TaskCard from '@/components/task/TaskCard'
import AddTaskModal from '@/components/task/AddTaskModal'
import {
  DndContext, type DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Gantt,
  DateEndColumn,
  DateStartColumn,
  TitleColumn,
  type Column,
  type Task as GanttTask,
  ViewMode,
} from '@wamra/gantt-task-react'
import '@wamra/gantt-task-react/dist/style.css'

const projectApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProject: build.query<{ id: string; name: string; description?: string; customer_id?: string }, string>({
      query: (id) => `/projects/${id}`,
    }),
  }),
  overrideExisting: false,
})

const { useGetProjectQuery } = projectApi

type Tab = 'tasks' | 'kanban' | 'gantt' | 'docs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'docs', label: 'Docs' },
]

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project, isLoading } = useGetProjectQuery(projectId!)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('tasks')

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (!project) return <div className="text-destructive">Project not found</div>

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — pass project_id as context */}
      <div className="pt-2">
        {tab === 'tasks' && <ProjectTasksTab projectId={projectId!} />}
        {tab === 'kanban' && <ProjectKanbanTab projectId={projectId!} />}
        {tab === 'gantt' && <ProjectGanttTab projectId={projectId!} />}
        {tab === 'docs' && <DocEditorPanel projectId={projectId!} height="600px" />}
      </div>
    </div>
  )
}

// ── scoped tab components ────────────────────────────────────────────────────

function ProjectTasksTab({ projectId }: { projectId: string }) {
  // Re-use TasksPage but scoped to this project via query param
  // We override the page to filter internally
  return <ScopedTasksPage projectId={projectId} />
}

function ProjectKanbanTab({ projectId }: { projectId: string }) {
  return <ScopedKanbanPage projectId={projectId} />
}

function ProjectGanttTab({ projectId }: { projectId: string }) {
  return <ScopedGanttPage projectId={projectId} />
}

// ── scoped implementations ───────────────────────────────────────────────────

function ScopedTasksPage({ projectId }: { projectId: string }) {
  return <TaskTable projectId={projectId} />
}

const KANBAN_COLS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'bg-slate-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'in_review', label: 'In Review', color: 'bg-yellow-50' },
  { id: 'done', label: 'Done', color: 'bg-green-50' },
]

function ScopedKanbanPage({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useGetTasksQuery({ project_id: projectId })
  const [updateTask] = useUpdateTaskMutation()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [addingToStatus, setAddingToStatus] = useState<Task['status'] | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const liveDrawerTask = drawerTask
    ? (tasks.find(t => t.id === drawerTask.id) ?? drawerTask)
    : null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const targetStatus = over.data.current?.status as Task['status'] | undefined
    if (targetStatus) updateTask({ id: active.id as string, status: targetStatus })
    setActiveTask(null)
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={(e) => setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)}
        onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-3 items-start">
          {KANBAN_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id)
            return (
              <div key={col.id} className={`rounded-lg p-3 ${col.color} min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 shadow-sm">{colTasks.length}</span>
                </div>
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task} status={col.id} onTaskClick={setDrawerTask} />
                    ))}
                  </div>
                </SortableContext>
                <button onClick={() => setAddingToStatus(col.id)}
                  className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground border border-dashed rounded py-1">
                  + Add task
                </button>
              </div>
            )
          })}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} status={activeTask.status} overlay />}
        </DragOverlay>
        {addingToStatus && (
          <AddTaskModal
            initialStatus={addingToStatus}
            projectId={projectId}
            onClose={() => setAddingToStatus(null)}
          />
        )}
      </DndContext>

      <TaskDrawer
        task={liveDrawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
      />
    </>
  )
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#94a3b8', in_progress: '#3b82f6', in_review: '#f59e0b', done: '#22c55e',
}

const PROJECT_GANTT_COLUMNS: Column[] = [
  { id: 'TitleColumn', title: 'Name', Cell: TitleColumn, width: 180 },
  { id: 'DateStartColumn', title: 'From', Cell: DateStartColumn, width: 180 },
  { id: 'DateEndColumn', title: 'To', Cell: DateEndColumn, width: 180 },
]

function ScopedGanttPage({ projectId }: { projectId: string }) {
  const { data: tasks = [] } = useGetTasksQuery({ project_id: projectId })
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week)

  const ganttTasks: GanttTask[] = tasks
    .filter(t => t.listing_date && t.due_date)
    .map(t => {
      const start = new Date(t.listing_date!)
      const end = new Date(t.due_date!)
      if (end <= start) end.setDate(start.getDate() + 1)
      return {
        id: t.id,
        name: t.title,
        start,
        end,
        progress: t.status === 'done' ? 100 : t.status === 'in_review' ? 75 : t.status === 'in_progress' ? 40 : 0,
        styles: { progressColor: STATUS_COLOR[t.status], backgroundColor: STATUS_COLOR[t.status] + '99' },
        type: 'task',
      } as GanttTask
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (!ganttTasks.length)
    return <p className="text-sm text-muted-foreground">No tasks with listing_date + due_date set.</p>

  const VIEW_MODES: { id: ViewMode; label: string }[] = [
    { id: ViewMode.Day, label: 'Day' },
    { id: ViewMode.Week, label: 'Week' },
    { id: ViewMode.Month, label: 'Month' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-1 justify-end">
        {VIEW_MODES.map(m => (
          <button key={m.id} onClick={() => setViewMode(m.id)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${viewMode === m.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-transparent'}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="border rounded-lg overflow-auto">
        <Gantt
          tasks={ganttTasks}
          columns={PROJECT_GANTT_COLUMNS}
          viewMode={viewMode}
          distances={{
            columnWidth: viewMode === ViewMode.Day ? 40 : viewMode === ViewMode.Week ? 120 : 200,
            rowHeight: 38,
          }}
          fontSize="13px"
        />
      </div>
    </div>
  )
}
