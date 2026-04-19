import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useGetTasksQuery, useUpdateTaskMutation, type Task } from '@/features/kanban/taskApi'
import TaskCard from '@/components/task/TaskCard'
import AddTaskModal from '@/components/task/AddTaskModal'
import TaskDrawer from '@/components/task/TaskDrawer'
import ExportMenu from '@/components/ExportMenu'
import { Kanban, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import type { RootState } from '@/store'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const COLUMNS: { id: Task['status']; label: string; color: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'bg-slate-100' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'in_review',   label: 'In Review',   color: 'bg-yellow-50' },
  { id: 'done',        label: 'Done',        color: 'bg-green-50' },
]

const PROJECT_COLORS = [
  { dot: 'bg-blue-500',    header: 'text-blue-700',    border: 'border-blue-200',    bg: 'bg-blue-50' },
  { dot: 'bg-violet-500',  header: 'text-violet-700',  border: 'border-violet-200',  bg: 'bg-violet-50' },
  { dot: 'bg-emerald-500', header: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  { dot: 'bg-orange-500',  header: 'text-orange-700',  border: 'border-orange-200',  bg: 'bg-orange-50' },
  { dot: 'bg-rose-500',    header: 'text-rose-700',    border: 'border-rose-200',    bg: 'bg-rose-50' },
  { dot: 'bg-cyan-500',    header: 'text-cyan-700',    border: 'border-cyan-200',    bg: 'bg-cyan-50' },
]

// ── Single project board ───────────────────────────────────────────────────────

function KanbanBoard({ projectId }: { projectId: string }) {
  const { data: tasks = [], isLoading } = useGetTasksQuery({ project_id: projectId })
  const [updateTask] = useUpdateTaskMutation()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [addingToStatus, setAddingToStatus] = useState<Task['status'] | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const targetStatus = over.data.current?.status as Task['status'] | undefined
    if (targetStatus) updateTask({ id: active.id as string, status: targetStatus })
    setActiveTask(null)
  }

  const liveDrawerTask = drawerTask
    ? (tasks.find((t) => t.id === drawerTask.id) ?? drawerTask)
    : null

  if (isLoading) return <div className="text-sm text-muted-foreground py-4">Loading…</div>

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id)
            return (
              <div key={col.id} className={`rounded-lg p-3 ${col.color} min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 shadow-sm">
                    {colTasks.length}
                  </span>
                </div>
                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} status={col.id} onTaskClick={setDrawerTask} />
                    ))}
                  </div>
                </SortableContext>
                <button
                  onClick={() => setAddingToStatus(col.id)}
                  className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground border border-dashed rounded py-1"
                >
                  + Add task
                </button>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} status={activeTask.status} overlay />}
        </DragOverlay>
      </DndContext>

      {addingToStatus && (
        <AddTaskModal
          initialStatus={addingToStatus}
          projectId={projectId}
          onClose={() => setAddingToStatus(null)}
        />
      )}

      <TaskDrawer
        task={liveDrawerTask}
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
      />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const inWork = useSelector((s: RootState) => s.inWork)
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)

  async function doExport(format: 'excel' | 'pdf') {
    if (!inWork) return
    setExporting(true)
    const tid = toast.loading('Preparing Kanban export…')
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      inWork.projects.forEach((p) => params.append('project_ids', p.id))
      const endpoint = format === 'pdf' ? 'export-kanban-pdf' : 'export-kanban'
      const res = await fetch(`/api/v1/import-export/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`
      a.href = url
      a.download = `kanban_${ts}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.dismiss(tid)
      toast.success('Kanban exported.')
    } catch {
      toast.dismiss(tid)
      toast.error('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (!inWork) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <Kanban size={52} className="opacity-20" />
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

  const defaultOpen = inWork.projects.map((p) => p.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{inWork.customerName}</span>
            <span>/</span>
            <span className="font-medium text-foreground">{inWork.contractName}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">
              {inWork.projects.length} project{inWork.projects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ExportMenu
            loading={exporting}
            onExportExcel={() => doExport('excel')}
            onExportPdf={() => doExport('pdf')}
          />
        </div>
      </div>

      {inWork.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Kanban size={48} className="opacity-20" />
          <p className="font-medium">No projects in this contract</p>
          <p className="text-xs">Add projects to the contract first.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
          {inWork.projects.map((project, i) => {
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length]
            return (
              <AccordionItem
                key={project.id}
                value={project.id}
                className={`rounded-xl border ${color.border} overflow-hidden`}
              >
                <AccordionTrigger className={`px-4 hover:no-underline ${color.bg}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
                    <span className={`font-semibold text-sm ${color.header}`}>{project.name}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="border-t px-4 py-4 overflow-x-auto">
                    <KanbanBoard projectId={project.id} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
