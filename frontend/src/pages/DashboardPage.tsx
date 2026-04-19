import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Building2, ScrollText, FolderOpen, FileText, Paperclip,
  ChevronRight, ArrowRight, AlertCircle, Clock, List, Kanban, AlignLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RootState } from '@/store'
import type { InWorkState } from '@/features/inWork/inWorkSlice'
import { useGetCustomersQuery, useGetProjectsQuery } from '@/features/customers/customerApi'
import { useGetContractsQuery } from '@/features/contracts/contractApi'
import { useGetTasksQuery } from '@/features/kanban/taskApi'
import { useListDocsQuery } from '@/features/docs/docsApi'
import { useGetAllFilesQuery } from '@/features/files/filesApi'
import { Skeleton } from '@/components/ui/skeleton'
import { STATUS_COLORS } from '@/components/task/taskColumns'

// ── Palette ───────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  { dot: 'bg-blue-500',    header: 'text-blue-700',    border: 'border-blue-200',    bg: 'bg-blue-50' },
  { dot: 'bg-violet-500',  header: 'text-violet-700',  border: 'border-violet-200',  bg: 'bg-violet-50' },
  { dot: 'bg-emerald-500', header: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  { dot: 'bg-orange-500',  header: 'text-orange-700',  border: 'border-orange-200',  bg: 'bg-orange-50' },
  { dot: 'bg-rose-500',    header: 'text-rose-700',    border: 'border-rose-200',    bg: 'bg-rose-50' },
  { dot: 'bg-cyan-500',    header: 'text-cyan-700',    border: 'border-cyan-200',    bg: 'bg-cyan-50' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, isLoading,
}: {
  icon: LucideIcon; label: string; value: number; isLoading?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm flex items-center gap-3">
      <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLoading
          ? <Skeleton className="h-6 w-10 mt-1" />
          : <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        }
      </div>
    </div>
  )
}

// ── SummaryRow ────────────────────────────────────────────────────────────────

function SummaryRow() {
  const { data: customers = [], isLoading: lc } = useGetCustomersQuery()
  const { data: contracts = [], isLoading: ln } = useGetContractsQuery({})
  const { data: projects  = [], isLoading: lp } = useGetProjectsQuery({})
  const { data: docs      = [], isLoading: ld } = useListDocsQuery()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard icon={Building2}   label="Customers"  value={customers.length} isLoading={lc} />
      <StatCard icon={ScrollText}  label="Contracts"  value={contracts.length} isLoading={ln} />
      <StatCard icon={FolderOpen}  label="Projects"   value={projects.length}  isLoading={lp} />
      <StatCard icon={FileText}    label="Documents"  value={docs.length}      isLoading={ld} />
    </div>
  )
}

// ── NoInWorkCTA ───────────────────────────────────────────────────────────────

function NoInWorkCTA() {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-8 flex flex-col items-center gap-4 text-center">
      <FolderOpen size={48} className="text-muted-foreground/30" />
      <div>
        <p className="font-semibold text-base">No active work context</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Select a customer and contract, then click <strong>inWork</strong> to activate tasks, kanban, and timeline.
        </p>
      </div>
      <button
        onClick={() => navigate('/contracts')}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
      >
        Go to Contracts <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ── NavLinkButton ─────────────────────────────────────────────────────────────

function NavLinkButton({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon size={13} /> {label}
    </button>
  )
}

// ── InWorkPanel ───────────────────────────────────────────────────────────────

function InWorkPanel({ inWork }: { inWork: InWorkState }) {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Context</p>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => navigate(`/customers/${inWork.customerId}`)}
          className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-medium text-xs hover:bg-blue-100 transition-colors"
        >
          {inWork.customerName}
        </button>
        <ChevronRight size={12} className="text-muted-foreground" />
        <button
          onClick={() => navigate(`/contracts/${inWork.contractId}`)}
          className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium text-xs hover:bg-indigo-100 transition-colors"
        >
          {inWork.contractName}
        </button>
      </div>

      {/* Project pills */}
      {inWork.projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {inWork.projects.map((p, i) => {
            const c = PROJECT_COLORS[i % PROJECT_COLORS.length]
            return (
              <span
                key={p.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${c.border} ${c.bg} ${c.header}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                {p.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Quick links */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <NavLinkButton to="/tasks"    icon={List}      label="Tasks" />
        <NavLinkButton to="/kanban"   icon={Kanban}    label="Kanban" />
        <NavLinkButton to="/timeline" icon={AlignLeft} label="Timeline" />
      </div>
    </div>
  )
}

// ── TaskStatsForProject ───────────────────────────────────────────────────────

function TaskStatsForProject({
  project, colorIndex,
}: {
  project: { id: string; name: string }
  colorIndex: number
}) {
  const { data: tasks = [], isLoading } = useGetTasksQuery({ project_id: project.id })
  const today = new Date().toISOString().slice(0, 10)
  const c = PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]

  const byStatus = {
    todo:        tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    in_review:   tasks.filter((t) => t.status === 'in_review').length,
    done:        tasks.filter((t) => t.status === 'done').length,
  }
  const overdue = tasks.filter(
    (t) => t.due_date && t.due_date.slice(0, 10) < today && t.status !== 'done'
  ).length
  const needsApproval = tasks.filter(
    (t) => t.approval && t.status !== 'done'
  ).length

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-2.5">
      <div className={`flex items-center gap-2 text-sm font-semibold ${c.header}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
        {project.name}
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['todo', 'in_progress', 'in_review', 'done'] as const).map((s) => (
              <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] ?? 'bg-muted'}`}>
                {byStatus[s]} {s.replace('_', ' ')}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {overdue > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <AlertCircle size={12} /> {overdue} overdue
              </span>
            )}
            {needsApproval > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock size={12} /> {needsApproval} need approval
              </span>
            )}
            {overdue === 0 && needsApproval === 0 && (
              <span className="text-muted-foreground">All on track</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── TaskStatsSection ──────────────────────────────────────────────────────────

function TaskStatsSection({ inWork }: { inWork: InWorkState }) {
  if (inWork.projects.length === 0) return null
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {inWork.projects.map((p, i) => (
          <TaskStatsForProject key={p.id} project={p} colorIndex={i} />
        ))}
      </div>
    </div>
  )
}

// ── RecentDocsSection ─────────────────────────────────────────────────────────

function RecentDocsSection() {
  const navigate = useNavigate()
  const { data: docs = [], isLoading } = useListDocsQuery()
  const recent = [...docs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3)

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <FileText size={15} /> Recent Documents
        </h2>
        <button
          onClick={() => navigate('/docs')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight size={11} />
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No documents yet</p>
      ) : (
        <div className="divide-y">
          {recent.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate('/docs')}
              className="w-full text-left py-2.5 first:pt-0 last:pb-0 hover:text-primary transition-colors group"
            >
              <p className="text-sm font-medium line-clamp-1 group-hover:underline">
                {doc.title || 'Untitled'}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {doc.customer_name && <span>{doc.customer_name}</span>}
                {doc.contract_name && <><span className="opacity-40">›</span><span>{doc.contract_name}</span></>}
                {doc.project_name  && <><span className="opacity-40">›</span><span>{doc.project_name}</span></>}
                <span className="ml-auto shrink-0">{fmtDate(doc.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RecentFilesSection ────────────────────────────────────────────────────────

function RecentFilesSection() {
  const navigate = useNavigate()
  const { data: files = [], isLoading } = useGetAllFilesQuery({})
  const recent = [...files].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Paperclip size={15} /> Recent Files
        </h2>
        <button
          onClick={() => navigate('/files')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight size={11} />
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No files yet</p>
      ) : (
        <div className="divide-y">
          {recent.map((file) => (
            <button
              key={file.id}
              onClick={() =>
                file.source_type === 'contract'
                  ? navigate(`/contracts/${file.source_id}?tab=documents`)
                  : navigate('/files')
              }
              className="w-full text-left py-2.5 first:pt-0 last:pb-0 hover:text-primary transition-colors group"
            >
              <p className="text-sm font-medium line-clamp-1 group-hover:underline">{file.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                    file.source_type === 'contract'
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {file.source_type === 'contract' ? 'Contract' : 'Task'}
                </span>
                <span className="truncate">{file.source_name}</span>
                <span className="ml-auto shrink-0">{fmtDate(file.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const inWork = useSelector((s: RootState) => s.inWork)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <SummaryRow />

      {inWork ? (
        <>
          <InWorkPanel inWork={inWork} />
          <TaskStatsSection inWork={inWork} />
        </>
      ) : (
        <NoInWorkCTA />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentDocsSection />
        <RecentFilesSection />
      </div>
    </div>
  )
}
