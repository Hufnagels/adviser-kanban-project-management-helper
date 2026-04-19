import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Task } from '@/features/kanban/taskApi'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-200 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

interface Props {
  task: Task
  status: Task['status']
  overlay?: boolean
  onTaskClick?: (task: Task) => void
}

export default function TaskCard({ task, status, overlay, onTaskClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded shadow-sm p-3 select-none flex gap-2 group"
    >
      {/* Drag handle — only this part activates DnD */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground mt-0.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </div>

      {/* Clickable content */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onTaskClick?.(task)}
      >
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        {task.task_type && (
          <p className="text-xs text-muted-foreground mt-0.5">{task.task_type}</p>
        )}
        {task.due_date && (
          <p className="text-xs text-muted-foreground mt-1">Due {task.due_date}</p>
        )}
        <div className="mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  )
}
