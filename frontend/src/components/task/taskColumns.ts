// Shared column widths used by TaskTable and TimelinePage
export const TASK_COLS = [
  { key: 'external_id',    label: 'Task ID',        width: 'w-24' },
  { key: 'title',          label: 'Title',           width: 'w-60' },
  { key: 'task_type',      label: 'Type',            width: 'w-24' },
  { key: 'status',         label: 'Status',          width: 'w-32' },
  { key: 'priority',       label: 'Priority',        width: 'w-24' },
  { key: 'listing_date',   label: 'Listing Date',    width: 'w-28' },
  { key: 'due_date',       label: 'Due Date',        width: 'w-28' },
  { key: 'finishing_date', label: 'Finishing Date',  width: 'w-28' },
  { key: 'notes',          label: 'Notes',           width: 'w-48' },
  { key: 'approval',       label: 'Approval',        width: 'w-20' },
] as const

export const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-yellow-100 text-yellow-800',
  done:        'bg-green-100 text-green-700',
  canceled:    'bg-red-100 text-red-700',
}

export const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-slate-100 text-slate-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}
