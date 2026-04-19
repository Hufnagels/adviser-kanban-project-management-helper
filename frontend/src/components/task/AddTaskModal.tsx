import { useState } from 'react'
import { useCreateTaskMutation, type Task } from '@/features/kanban/taskApi'

interface Props {
  initialStatus: Task['status']
  onClose: () => void
  projectId?: string
}

export default function AddTaskModal({ initialStatus, onClose, projectId }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [createTask, { isLoading }] = useCreateTaskMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({ title, priority, status: initialStatus, approval: false, project_id: projectId })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4"
      >
        <h2 className="font-semibold text-lg">New Task</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Task title…"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {['low', 'medium', 'high', 'critical'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
