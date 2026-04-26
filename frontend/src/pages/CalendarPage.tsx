import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useGetTasksQuery } from '@/features/kanban/taskApi'
import { useListMeetingsQuery } from '@/features/meetings/meetingsApi'
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight } from 'lucide-react'
import type { RootState } from '@/store'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const PROJECT_PALETTES = [
  { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  { bg: 'bg-violet-100',  text: 'text-violet-800',  dot: 'bg-violet-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-500' },
  { bg: 'bg-cyan-100',    text: 'text-cyan-800',    dot: 'bg-cyan-500' },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun→6, 1=Mon→0, 2=Tue→1, ... 6=Sat→5
  return (new Date(year, month, 1).getDay() + 6) % 7
}

// ── Single project task fetcher ───────────────────────────────────────────────

function useProjectTasks(projectId: string) {
  const { data = [] } = useGetTasksQuery({ project_id: projectId })
  return data
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ projects }: { projects: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {projects.map((p, i) => {
        const pal = PROJECT_PALETTES[i % PROJECT_PALETTES.length]
        return (
          <span key={p.id} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${pal.dot}`} />
            {p.name}
          </span>
        )
      })}
    </div>
  )
}

// ── Combined calendar ─────────────────────────────────────────────────────────

function CombinedCalendar({
  projects,
  year,
  month,
  contractId,
}: {
  projects: { id: string; name: string }[]
  year: number
  month: number
  contractId: string
}) {
  // Collect tasks per project (hooks called unconditionally in stable order)
  const allProjectTasks: { task: any; palette: typeof PROJECT_PALETTES[0] }[] = []
  for (let i = 0; i < projects.length; i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tasks = useProjectTasks(projects[i].id)
    const pal   = PROJECT_PALETTES[i % PROJECT_PALETTES.length]
    tasks.forEach((t) => allProjectTasks.push({ task: t, palette: pal }))
  }

  // Meetings for this contract
  const { data: meetings = [] } = useListMeetingsQuery(contractId ? { contract_id: contractId } : {})

  const today       = new Date()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDayOfMonth(year, month)
  const cells       = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )

  function taskItemsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allProjectTasks.filter(({ task: t }) => t.due_date === dateStr)
  }

  function meetingsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return meetings.filter(m => m.date === dateStr)
  }

  return (
    <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden text-sm">
      {DAYS.map((d) => (
        <div key={d} className="bg-muted text-center py-2 font-medium text-xs">{d}</div>
      ))}
      {cells.map((day, i) => {
        const taskItems     = day ? taskItemsForDay(day) : []
        const meetingItems  = day ? meetingsForDay(day) : []
        const totalItems    = taskItems.length + meetingItems.length
        const isToday =
          day === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear()
        return (
          <div key={i} className={`bg-card min-h-[90px] p-1 ${!day ? 'opacity-0' : ''}`}>
            {day && (
              <>
                <span className={`text-xs font-medium ${
                  isToday
                    ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center'
                    : ''
                }`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {/* Meetings first */}
                  {meetingItems.map(m => (
                    <div
                      key={m.id}
                      className="text-xs bg-amber-100 text-amber-800 px-1 rounded truncate"
                      title={`📅 ${m.title}`}
                    >
                      📅 {m.title}
                    </div>
                  ))}
                  {/* Tasks */}
                  {taskItems.slice(0, Math.max(0, 4 - meetingItems.length)).map(({ task: t, palette }) => (
                    <div
                      key={t.id}
                      className={`text-xs ${palette.bg} ${palette.text} px-1 rounded truncate`}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {totalItems > 4 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{totalItems - 4} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const inWork   = useSelector((s: RootState) => s.inWork)
  const navigate = useNavigate()
  const today    = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prev() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) } else setMonth((m) => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) } else setMonth((m) => m + 1)
  }

  if (!inWork) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <CalendarDays size={52} className="opacity-20" />
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
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{inWork.customerName}</span>
            <span>/</span>
            <span className="font-medium text-foreground">{inWork.contractName}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">
              {inWork.projects.length} project{inWork.projects.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={prev} className="p-1 hover:bg-muted rounded"><ChevronLeft size={18} /></button>
          <span className="font-semibold min-w-[130px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={next} className="p-1 hover:bg-muted rounded"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Legend */}
      {inWork.projects.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <Legend projects={inWork.projects} />
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Meetings
          </span>
        </div>
      )}

      {/* Calendar grid */}
      {inWork.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <CalendarDays size={48} className="opacity-20" />
          <p className="font-medium">No projects in this contract</p>
        </div>
      ) : (
        <CombinedCalendar projects={inWork.projects} year={year} month={month} contractId={inWork.contractId} />
      )}
    </div>
  )
}
