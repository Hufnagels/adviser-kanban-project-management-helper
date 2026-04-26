import { useEffect, useRef, useState } from 'react'
import {
  Plus, ArrowLeft, Trash2, Play, Square, CheckCircle2,
  Clock, Paperclip, ChevronDown, Printer, Calendar,
  MapPin, Building2, FileText, X, Upload, LayoutList, LayoutGrid, GripVertical,
  RotateCcw, Copy, BookOpenCheck
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import {
  useListMeetingsQuery,
  useGetMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useDeleteMeetingMutation,
  useReorderMeetingsMutation,
  useDuplicateMeetingMutation,
  useAddTopicMutation,
  useUpdateTopicMutation,
  useDeleteTopicMutation,
  useReorderTopicsMutation,
  useUploadMeetingFileMutation,
  useDeleteMeetingFileMutation,
  useUploadTopicFileMutation,
  useDeleteTopicFileMutation,
  meetingFileDownloadUrl,
  topicFileDownloadUrl,
  type Meeting,
  type MeetingTopic,
  type MeetingFile,
  type TopicFile,
} from '@/features/meetings/meetingsApi'
import { useGetCustomersQuery, useGetProjectsQuery } from '@/features/customers/customerApi'
import { useGetContractsQuery } from '@/features/contracts/contractApi'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function fmtMinutes(min: number | null | undefined): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled',
}

function fileIcon(contentType: string | null): string {
  if (!contentType) return '📎'
  if (contentType.includes('pdf')) return '📄'
  if (contentType.includes('image')) return '🖼️'
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('xlsx')) return '📊'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📋'
  return '📎'
}

// ── File chip ─────────────────────────────────────────────────────────────────

function FileChip({
  file,
  downloadUrl,
  onDelete,
}: {
  file: MeetingFile | TopicFile
  downloadUrl: string
  onDelete: () => void
}) {
  const token = useSelector((s: RootState) => s.auth.token)

  async function handleClick() {
    const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    // Try inline preview for PDFs/images, download for others
    if (file.content_type?.includes('pdf') || file.content_type?.includes('image')) {
      window.open(url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <span className="inline-flex items-center gap-1 bg-muted rounded-full px-2.5 py-0.5 text-xs max-w-[160px]">
      <button type="button" onClick={handleClick} className="truncate hover:underline">
        {fileIcon(file.content_type)} {file.name}
      </button>
      <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive shrink-0">
        <X size={10} />
      </button>
    </span>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles(Array.from(e.dataTransfer.files))
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed rounded-lg text-xs text-muted-foreground cursor-pointer transition-colors ${
        over ? 'border-primary bg-primary/5 text-primary' : 'hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <Upload size={12} />
      <span>Drop files or click</span>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
    </div>
  )
}

// ── New meeting modal ─────────────────────────────────────────────────────────

function NewMeetingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const inWork = useSelector((s: RootState) => s.inWork)
  const [createMeeting, { isLoading }] = useCreateMeetingMutation()
  const { data: customers = [] } = useGetCustomersQuery()
  const [customerId, setCustomerId] = useState(inWork?.customerId ?? '')
  const { data: contracts = [] } = useGetContractsQuery(customerId ? { customer_id: customerId } : {})
  const [contractId, setContractId] = useState(inWork?.contractId ?? '')
  const { data: projects = [] } = useGetProjectsQuery({})
  const filteredProjects = projects.filter(p => contractId ? p.contract_id === contractId : customerId ? p.customer_id === customerId : true)

  // Pre-select first inWork project if exactly one
  const defaultProjectId = inWork?.projects.length === 1 ? inWork.projects[0].id : ''
  const [form, setForm] = useState({ title: '', date: '', location: '', project_id: defaultProjectId })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const m = await createMeeting({
        title: form.title,
        date: form.date || undefined,
        location: form.location || undefined,
        customer_id: customerId || undefined,
        contract_id: contractId || undefined,
        project_id: form.project_id || undefined,
      }).unwrap()
      onCreated(m.id)
    } catch {
      toast.error('Failed to create meeting')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-background border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <h2 className="font-semibold text-lg">New Meeting</h2>
        <input
          required
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Meeting title"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="Location (optional)"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={customerId}
          onChange={e => { setCustomerId(e.target.value); setContractId(''); setForm(f => ({ ...f, project_id: '' })) }}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        >
          <option value="">Customer (optional)</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {customerId && (
          <select
            value={contractId}
            onChange={e => { setContractId(e.target.value); setForm(f => ({ ...f, project_id: '' })) }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            <option value="">Contract (optional)</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {filteredProjects.length > 0 && (
          <select
            value={form.project_id}
            onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            <option value="">Project (optional)</option>
            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
            {isLoading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Topic row ─────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  meetingId,
  isActive,
  liveSeconds,
  onStart,
  onStop,
  dragHandle,
}: {
  topic: MeetingTopic
  meetingId: string
  isActive: boolean
  liveSeconds: number
  onStart: () => void
  onStop: () => void
  dragHandle?: React.ReactNode
}) {
  const [updateTopic] = useUpdateTopicMutation()
  const [deleteTopic] = useDeleteTopicMutation()
  const [uploadTopicFile] = useUploadTopicFileMutation()
  const [deleteTopicFile] = useDeleteTopicFileMutation()

  const [decision, setDecision] = useState(topic.decision ?? '')
  const [description, setDescription] = useState(topic.description ?? '')
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState(topic.name)
  const [editMinutes, setEditMinutes] = useState(false)
  const [minutesValue, setMinutesValue] = useState(String(topic.planned_minutes ?? ''))

  // Sync if topic changes externally
  useEffect(() => { setDecision(topic.decision ?? '') }, [topic.decision])
  useEffect(() => { setDescription(topic.description ?? '') }, [topic.description])
  useEffect(() => { setName(topic.name) }, [topic.name])
  useEffect(() => { setMinutesValue(String(topic.planned_minutes ?? '')) }, [topic.planned_minutes])

  const elapsed = isActive ? topic.actual_seconds + liveSeconds : topic.actual_seconds
  const planned = (topic.planned_minutes ?? 0) * 60
  const isOvertime = planned > 0 && elapsed > planned
  const overtime = isOvertime ? elapsed - planned : 0

  async function handleUpload(files: File[]) {
    for (const f of files) {
      const form = new FormData()
      form.append('file', f)
      await uploadTopicFile({ meeting_id: meetingId, topic_id: topic.id, form }).unwrap()
    }
  }

  const isDone = topic.status === 'done'

  return (
    <div className={`border rounded-xl p-4 space-y-3 transition-colors print:border-0 print:pb-4 print:mb-4 print:border-b ${
      isActive ? 'border-primary/50 bg-primary/5' : isDone ? 'bg-muted/30' : 'bg-background'
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        {dragHandle}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold shrink-0 mt-0.5">
          {topic.sort_order + 1}
        </div>
        <div className="flex-1 min-w-0">
          {editName ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={async () => {
                setEditName(false)
                if (name !== topic.name) await updateTopic({ meeting_id: meetingId, topic_id: topic.id, name })
              }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="w-full font-semibold text-sm border-b border-primary focus:outline-none bg-transparent"
            />
          ) : (
            <button type="button" onClick={() => setEditName(true)} className="font-semibold text-sm text-left hover:underline print:no-underline">
              {topic.name}
            </button>
          )}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground print:hidden">
            <Clock size={11} />
            {editMinutes ? (
              <input
                autoFocus
                type="number"
                min={1}
                value={minutesValue}
                onChange={e => setMinutesValue(e.target.value)}
                onBlur={async () => {
                  setEditMinutes(false)
                  const parsed = parseInt(minutesValue)
                  const newVal = isNaN(parsed) || parsed < 1 ? null : parsed
                  if (newVal !== topic.planned_minutes) {
                    await updateTopic({ meeting_id: meetingId, topic_id: topic.id, planned_minutes: newVal })
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="w-14 border-b border-primary focus:outline-none bg-transparent text-xs"
                placeholder="min"
              />
            ) : (
              <button type="button" onClick={() => setEditMinutes(true)} className="hover:underline">
                {fmtMinutes(topic.planned_minutes)} planned
              </button>
            )}
          </div>
          <div className="hidden print:flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock size={11} />{fmtMinutes(topic.planned_minutes)} planned
          </div>
        </div>
        {/* Stopwatch */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <span className={`font-mono text-sm font-semibold tabular-nums ${isOvertime ? 'text-destructive' : ''}`}>
            {fmtSeconds(elapsed)}
          </span>
          {isOvertime && (
            <span className="text-xs text-destructive font-medium">+{fmtSeconds(overtime)}</span>
          )}
          {!isDone && (
            isActive ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <Square size={11} /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Play size={11} /> Start
              </button>
            )
          )}
          {!isActive && (
            <button
              type="button"
              onClick={() => updateTopic({ meeting_id: meetingId, topic_id: topic.id, status: isDone ? 'pending' : 'done' })}
              className={`p-1 rounded ${isDone ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
              title={isDone ? 'Mark pending' : 'Mark done'}
            >
              <CheckCircle2 size={16} />
            </button>
          )}
          {!isActive && topic.actual_seconds > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset timer to 0?')) {
                  updateTopic({ meeting_id: meetingId, topic_id: topic.id, actual_seconds: 0, status: 'pending' })
                }
              }}
              className="p-1 text-muted-foreground hover:text-amber-500"
              title="Reset timer"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteTopic({ meeting_id: meetingId, topic_id: topic.id })}
            className="p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={14} />
          </button>
        </div>
        {/* Print-only time display */}
        <div className="hidden print:flex items-center gap-2 shrink-0 text-sm">
          <span>Elapsed: {fmtSeconds(elapsed)}</span>
          {isOvertime && <span className="text-destructive">⚠ +{fmtSeconds(overtime)}</span>}
        </div>
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        onBlur={() => { if (description !== (topic.description ?? '')) updateTopic({ meeting_id: meetingId, topic_id: topic.id, description }) }}
        placeholder="Description…"
        rows={1}
        className="w-full text-sm text-muted-foreground bg-transparent resize-none focus:outline-none focus:ring-0 border-0 p-0"
      />

      {/* Decision */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decision</label>
        <textarea
          value={decision}
          onChange={e => setDecision(e.target.value)}
          onBlur={() => { if (decision !== (topic.decision ?? '')) updateTopic({ meeting_id: meetingId, topic_id: topic.id, decision }) }}
          placeholder="What was decided…"
          rows={2}
          className="w-full mt-1 text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Topic files */}
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        {topic.files.map(f => (
          <FileChip
            key={f.id}
            file={f}
            downloadUrl={topicFileDownloadUrl(meetingId, topic.id, f.id)}
            onDelete={() => deleteTopicFile({ meeting_id: meetingId, topic_id: topic.id, file_id: f.id })}
          />
        ))}
        <DropZone onFiles={handleUpload} />
      </div>
      {/* Print file list */}
      {topic.files.length > 0 && (
        <p className="hidden print:block text-xs text-muted-foreground">
          Files: {topic.files.map(f => f.name).join(', ')}
        </p>
      )}
    </div>
  )
}

// ── Add topic form ────────────────────────────────────────────────────────────

function AddTopicForm({ meetingId, onDone }: { meetingId: string; onDone: () => void }) {
  const [addTopic, { isLoading }] = useAddTopicMutation()
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await addTopic({
      meeting_id: meetingId,
      name: name.trim(),
      planned_minutes: minutes ? parseInt(minutes) : undefined,
    }).unwrap()
    setName('')
    setMinutes('')
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center border border-dashed rounded-xl px-4 py-3 print:hidden">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Topic name"
        className="flex-1 text-sm focus:outline-none bg-transparent"
      />
      <input
        type="number"
        min={1}
        value={minutes}
        onChange={e => setMinutes(e.target.value)}
        placeholder="min"
        className="w-16 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button type="submit" disabled={isLoading || !name.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
        Add
      </button>
      <button type="button" onClick={onDone} className="text-xs px-2 py-1.5 border rounded-lg hover:bg-muted">
        Cancel
      </button>
    </form>
  )
}

// ── Sortable wrappers ─────────────────────────────────────────────────────────

function SortableTopicRow(props: React.ComponentProps<typeof TopicRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.topic.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <TopicRow
        {...props}
        dragHandle={
          <button
            type="button"
            className="mt-1 p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing print:hidden shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </div>
  )
}

function SortableMeetingCard({ meeting, onOpen, onDelete }: { meeting: Meeting; onOpen: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meeting.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-stretch gap-1"
    >
      <button
        type="button"
        className="flex items-center px-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing print:hidden shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <div className="flex-1 min-w-0">
        <MeetingCard meeting={meeting} onOpen={onOpen} onDelete={onDelete} />
      </div>
    </div>
  )
}

// ── Meeting detail view ───────────────────────────────────────────────────────

function MeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { data: meeting, isLoading } = useGetMeetingQuery(meetingId)
  const [updateMeeting] = useUpdateMeetingMutation()
  const [uploadMeetingFile] = useUploadMeetingFileMutation()
  const [deleteMeetingFile] = useDeleteMeetingFileMutation()
  const [updateTopic] = useUpdateTopicMutation()
  const [reorderTopics] = useReorderTopicsMutation()

  const { data: customers = [] } = useGetCustomersQuery()
  const { data: contracts = [] } = useGetContractsQuery(meeting?.customer_id ? { customer_id: meeting.customer_id } : {})
  const { data: projects = [] } = useGetProjectsQuery({})

  const [showAddTopic, setShowAddTopic] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  // Editable title
  const [editTitle, setEditTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  useEffect(() => { if (meeting) setTitleValue(meeting.title) }, [meeting?.title])

  // Topics DnD order
  const [orderedTopics, setOrderedTopics] = useState<MeetingTopic[]>([])
  useEffect(() => { setOrderedTopics(meeting?.topics ?? []) }, [meeting?.topics])

  const topicSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleTopicsDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedTopics(items => {
      const oldIndex = items.findIndex(t => t.id === active.id)
      const newIndex = items.findIndex(t => t.id === over.id)
      const newOrder = arrayMove(items, oldIndex, newIndex)
      reorderTopics({ meeting_id: meetingId, ids: newOrder.map(t => t.id) })
      return newOrder
    })
  }

  // Stopwatch state
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
  const [liveSeconds, setLiveSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startStopwatch(topicId: string) {
    setActiveTopicId(topicId)
    setLiveSeconds(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setLiveSeconds(s => s + 1), 1000)
  }

  async function stopStopwatch(topicId: string) {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    const topic = meeting?.topics?.find(t => t.id === topicId)
    if (topic) {
      const newSeconds = topic.actual_seconds + liveSeconds
      await updateTopic({ meeting_id: meetingId, topic_id: topicId, actual_seconds: newSeconds, status: 'done' })
    }
    setActiveTopicId(null)
    setLiveSeconds(0)
  }

  async function handleStart(topicId: string) {
    // Auto-stop current active topic first
    if (activeTopicId && activeTopicId !== topicId) {
      await stopStopwatch(activeTopicId)
    }
    // Update topic status to active
    await updateTopic({ meeting_id: meetingId, topic_id: topicId, status: 'active' })
    startStopwatch(topicId)
  }

  async function handleStop() {
    if (activeTopicId) await stopStopwatch(activeTopicId)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // Set document title for PDF print filename
  useEffect(() => {
    const prev = document.title
    document.title = 'KP_MeetingMemo'
    return () => { document.title = prev }
  }, [])

  async function handleMeetingFileUpload(files: File[]) {
    for (const f of files) {
      const form = new FormData()
      form.append('file', f)
      await uploadMeetingFile({ meeting_id: meetingId, form }).unwrap()
    }
  }

  if (isLoading || !meeting) return <div className="text-muted-foreground py-8 text-center">Loading…</div>

  const totalPlannedSec = orderedTopics.reduce((sum, t) => sum + (t.planned_minutes ?? 0) * 60, 0)
  const totalElapsedSec = orderedTopics.reduce((sum, t) => sum + t.actual_seconds, 0) + (activeTopicId ? liveSeconds : 0)
  const totalOvertime = Math.max(0, totalElapsedSec - totalPlannedSec)

  const customerName = customers.find(c => c.id === meeting.customer_id)?.name
  const contractName = contracts.find(c => c.id === meeting.contract_id)?.name
  const projectName = projects.find(p => p.id === meeting.project_id)?.name

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-4 print:hidden">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft size={16} /> Back
        </button>
        {editTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={async () => {
              setEditTitle(false)
              if (titleValue.trim() && titleValue !== meeting.title) {
                await updateMeeting({ id: meetingId, title: titleValue.trim() })
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="text-xl font-bold flex-1 min-w-0 border-b border-primary focus:outline-none bg-transparent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditTitle(true)}
            className="text-xl font-bold flex-1 min-w-0 truncate text-left hover:underline"
            title="Click to rename"
          >
            {meeting.title}
          </button>
        )}
        {/* Quick date edit in toolbar */}
        <input
          type="date"
          defaultValue={meeting.date ?? ''}
          key={meeting.date ?? 'no-date'}
          onBlur={e => updateMeeting({ id: meetingId, date: e.target.value || null })}
          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
          title="Meeting date"
        />

        {/* Status dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusMenu(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[meeting.status]}`}
          >
            {STATUS_LABELS[meeting.status]} <ChevronDown size={12} />
          </button>
          {showStatusMenu && (
            <div className="absolute right-0 top-8 z-10 bg-background border rounded-lg shadow-lg py-1 min-w-[140px]">
              {(['draft', 'in_progress', 'completed', 'canceled'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { updateMeeting({ id: meetingId, status: s }); setShowStatusMenu(false) }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
        >
          <Printer size={14} /> Print
        </button>
        <button
          type="button"
          onClick={() => setShowAddTopic(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <Plus size={14} /> Add Topic
        </button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6 text-center">
        <h2 className="text-xl font-bold">{meeting.title}</h2>
        {meeting.location && <p className="text-sm mt-1">Location: {meeting.location}</p>}
        {customerName && <p className="text-sm">Customer: {customerName}{contractName ? ` → ${contractName}` : ''}{projectName ? ` → ${projectName}` : ''}</p>}
        <hr className="my-3" />
      </div>

      {/* Print footer — fixed at bottom of every page, shows meeting date */}
      <div
        className="hidden print:block"
        style={{
          position: 'fixed',
          bottom: '5mm',
          left: '15mm',
          right: '15mm',
          fontSize: '10px',
          color: '#6b7280',
          borderTop: '1px solid #e5e7eb',
          paddingTop: '3mm',
        }}
      >
        {meeting.date}
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Left: meeting info */}
        <div className="lg:w-64 shrink-0 space-y-4 print:hidden">
          <div className="border rounded-xl p-4 space-y-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meeting Info</p>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> Date</span>
              <input
                type="date"
                defaultValue={meeting.date ?? ''}
                onBlur={e => updateMeeting({ id: meetingId, date: e.target.value || null })}
                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> Location</span>
              <input
                type="text"
                defaultValue={meeting.location ?? ''}
                onBlur={e => updateMeeting({ id: meetingId, location: e.target.value || null })}
                placeholder="e.g. Conference Room A"
                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Building2 size={11} /> Customer</span>
              <select
                value={meeting.customer_id ?? ''}
                onChange={e => updateMeeting({ id: meetingId, customer_id: e.target.value || null, contract_id: null, project_id: null })}
                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
              >
                <option value="">—</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            {meeting.customer_id && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Contract</span>
                <select
                  value={meeting.contract_id ?? ''}
                  onChange={e => updateMeeting({ id: meetingId, contract_id: e.target.value || null, project_id: null })}
                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                >
                  <option value="">—</option>
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            {projects.filter(p => meeting.contract_id ? p.contract_id === meeting.contract_id : meeting.customer_id ? p.customer_id === meeting.customer_id : false).length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Project</span>
                <select
                  value={meeting.project_id ?? ''}
                  onChange={e => updateMeeting({ id: meetingId, project_id: e.target.value || null })}
                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                >
                  <option value="">—</option>
                  {projects
                    .filter(p => meeting.contract_id ? p.contract_id === meeting.contract_id : p.customer_id === meeting.customer_id)
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText size={11} /> Description</span>
              <textarea
                defaultValue={meeting.description ?? ''}
                onBlur={e => updateMeeting({ id: meetingId, description: e.target.value || null })}
                rows={3}
                className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </label>

            {/* Meeting-level files */}
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5"><Paperclip size={11} /> Attachments</p>
              <div className="flex flex-wrap gap-1.5">
                {(meeting.files ?? []).map(f => (
                  <FileChip
                    key={f.id}
                    file={f}
                    downloadUrl={meetingFileDownloadUrl(meetingId, f.id)}
                    onDelete={() => deleteMeetingFile({ meeting_id: meetingId, file_id: f.id })}
                  />
                ))}
              </div>
              <div className="mt-2">
                <DropZone onFiles={handleMeetingFileUpload} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: topics */}
        <div className="flex-1 min-w-0 space-y-3">
          {orderedTopics.length === 0 && !showAddTopic && (
            <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No topics yet. Add your first agenda item.</p>
            </div>
          )}

          <DndContext sensors={topicSensors} collisionDetection={closestCenter} onDragEnd={handleTopicsDragEnd}>
            <SortableContext items={orderedTopics.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {orderedTopics.map(topic => (
                  <SortableTopicRow
                    key={topic.id}
                    topic={topic}
                    meetingId={meetingId}
                    isActive={activeTopicId === topic.id}
                    liveSeconds={activeTopicId === topic.id ? liveSeconds : 0}
                    onStart={() => handleStart(topic.id)}
                    onStop={handleStop}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showAddTopic && (
            <AddTopicForm meetingId={meetingId} onDone={() => setShowAddTopic(false)} />
          )}

          {/* Summary bar */}
          {orderedTopics.length > 0 && (
            <div className="border-t pt-3 mt-2 flex flex-wrap gap-6 text-sm">
              <span className="text-muted-foreground">
                Total planned: <strong>{fmtSeconds(totalPlannedSec)}</strong>
              </span>
              <span className="text-muted-foreground">
                Total elapsed: <strong className={totalOvertime > 0 ? 'text-destructive' : ''}>{fmtSeconds(totalElapsedSec)}</strong>
              </span>
              {totalOvertime > 0 && (
                <span className="text-destructive font-medium">
                  Overtime: +{fmtSeconds(totalOvertime)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Meeting list ──────────────────────────────────────────────────────────────

function MeetingCard({ meeting, onOpen, onDelete }: { meeting: Meeting; onOpen: () => void; onDelete: () => void }) {
  const { data: customers = [] } = useGetCustomersQuery()
  const { data: contracts = [] } = useGetContractsQuery({})
  const { data: projects = [] } = useGetProjectsQuery({})
  const [duplicateMeeting] = useDuplicateMeetingMutation()
  const customer = customers.find(c => c.id === meeting.customer_id)
  const contract = contracts.find(c => c.id === meeting.contract_id)
  const project = projects.find(p => p.id === meeting.project_id)

  return (
    <div className="border rounded-xl p-4 flex items-start gap-4 hover:shadow-sm transition-shadow bg-background">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[meeting.status]}`}>
            {STATUS_LABELS[meeting.status]}
          </span>
          <h3 className="font-semibold text-sm truncate">{meeting.title}</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {meeting.date && <span className="flex items-center gap-1"><Calendar size={11} />{meeting.date}</span>}
          {meeting.location && <span className="flex items-center gap-1"><MapPin size={11} />{meeting.location}</span>}
          {customer && (
            <span className="flex items-center gap-1">
              <Building2 size={11} />
              {customer.name}{contract ? ` → ${contract.name}` : ''}{project ? ` → ${project.name}` : ''}
            </span>
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{meeting.topic_count} topic{meeting.topic_count !== 1 ? 's' : ''}</span>
          {meeting.total_planned_minutes > 0 && <span>{fmtMinutes(meeting.total_planned_minutes)} planned</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted print:hidden"
        >
          <BookOpenCheck size={14} />
        </button>
        <button
          type="button"
          onClick={() => duplicateMeeting(meeting.id)}
          className="p-1.5 text-muted-foreground hover:text-foreground border rounded-lg print:hidden"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-muted-foreground hover:text-destructive border rounded-lg print:hidden"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimePage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: meetings = [], isLoading } = useListMeetingsQuery(statusFilter ? { status: statusFilter } : {})
  const [deleteMeeting] = useDeleteMeetingMutation()
  const [reorderMeetings] = useReorderMeetingsMutation()

  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list')

  // Local ordered state for DnD
  const [orderedMeetings, setOrderedMeetings] = useState<Meeting[]>([])
  useEffect(() => { setOrderedMeetings(meetings) }, [meetings])

  const meetingSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleMeetingsDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedMeetings(items => {
      const oldIndex = items.findIndex(m => m.id === active.id)
      const newIndex = items.findIndex(m => m.id === over.id)
      const newOrder = arrayMove(items, oldIndex, newIndex)
      reorderMeetings(newOrder.map(m => m.id))
      return newOrder
    })
  }

  if (activeMeetingId) {
    return (
      <MeetingDetail
        meetingId={activeMeetingId}
        onBack={() => setActiveMeetingId(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold">Meeting Time Schedule - List</h1>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <Plus size={14} /> New Meeting
        </button>
      </div>

      {/* Filters + view toggle + print */}
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        {[['', 'All'], ['draft', 'Draft'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['canceled', 'Canceled']].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              statusFilter === val ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutList size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              title="Card view"
              className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* Print filtered list */}
          <button
            type="button"
            onClick={() => window.print()}
            title="Print list"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded-lg hover:bg-muted"
          >
            <Printer size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : orderedMeetings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>No meetings yet. Create your first one.</p>
        </div>
      ) : (
        <DndContext sensors={meetingSensors} collisionDetection={closestCenter} onDragEnd={handleMeetingsDragEnd}>
          <SortableContext items={orderedMeetings.map(m => m.id)} strategy={verticalListSortingStrategy}>
            <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
              {orderedMeetings.map(m => (
                <SortableMeetingCard
                  key={m.id}
                  meeting={m}
                  onOpen={() => setActiveMeetingId(m.id)}
                  onDelete={async () => {
                    if (window.confirm(`Delete "${m.title}"?`)) {
                      await deleteMeeting(m.id)
                      toast.success('Meeting deleted.')
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showNewModal && (
        <NewMeetingModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => { setShowNewModal(false); setActiveMeetingId(id) }}
        />
      )}

    </div>
  )
}
