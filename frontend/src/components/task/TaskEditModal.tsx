import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useUpdateTaskMutation, useCreateTaskMutation, type Task } from '@/features/kanban/taskApi'

const STATUS_OPTIONS: Task['status'][] = ['todo', 'in_progress', 'in_review', 'done']
const PRIORITY_OPTIONS: Task['priority'][] = ['low', 'medium', 'high', 'critical']

interface Props {
  /** Pass a task to edit, or null to create a new one */
  task?: Task | null
  projectId?: string
  onClose: () => void
}

export default function TaskEditModal({ task, projectId, onClose }: Props) {
  const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation()
  const [createTask, { isLoading: isCreating }] = useCreateTaskMutation()
  const isSaving = isUpdating || isCreating

  const [form, setForm] = useState({
    title: '',
    task_type: '',
    description: '',
    status: 'todo' as Task['status'],
    priority: 'medium' as Task['priority'],
    listing_date: '',
    due_date: '',
    finishing_date: '',
    approval: false,
    notes: '',
  })

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title ?? '',
        task_type: task.task_type ?? '',
        description: task.description ?? '',
        status: task.status,
        priority: task.priority,
        listing_date: task.listing_date ?? '',
        due_date: task.due_date ?? '',
        finishing_date: task.finishing_date ?? '',
        approval: task.approval,
        notes: task.notes ?? '',
      })
    }
  }, [task])

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: form.title.trim(),
      task_type: form.task_type || undefined,
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      listing_date: form.listing_date || undefined,
      due_date: form.due_date || undefined,
      finishing_date: form.finishing_date || undefined,
      approval: form.approval,
      notes: form.notes || undefined,
    }
    if (task) {
      await updateTask({ id: task.id, ...payload })
    } else {
      await createTask({ ...payload, project_id: projectId })
    }
    onClose()
  }

  const isNew = !task

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-base">{isNew ? 'New Task' : 'Edit Task'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input
              autoFocus
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Task title…"
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <input
                value={form.task_type}
                onChange={(e) => set('task_type', e.target.value)}
                placeholder="e.g. Bug, Feature…"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as Task['status'])}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority + Approval */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as Task['priority'])}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Approval</label>
              <div className="flex items-center h-[38px]">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <input
                    type="checkbox"
                    checked={form.approval}
                    onChange={(e) => set('approval', e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  Approved
                </label>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Listing Date</label>
              <input
                type="date"
                value={form.listing_date}
                onChange={(e) => set('listing_date', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Finishing Date</label>
              <input
                type="date"
                value={form.finishing_date}
                onChange={(e) => set('finishing_date', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short description…"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Internal notes…"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
