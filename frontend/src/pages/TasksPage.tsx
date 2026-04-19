import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import type { RootState } from '@/store'
import TaskTable from '@/components/task/TaskTable'
import ExportMenu from '@/components/ExportMenu'
import { useGetTasksQuery } from '@/features/kanban/taskApi'

function ProjectTaskCount({ projectId }: { projectId: string }) {
  const { data = [] } = useGetTasksQuery({ project_id: projectId })
  return (
    <span className="text-xs font-normal text-muted-foreground ml-1">({data.length})</span>
  )
}
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const PROJECT_COLORS = [
  { dot: 'bg-blue-500',   header: 'text-blue-700',   border: 'border-blue-200',   bg: 'bg-blue-50' },
  { dot: 'bg-violet-500', header: 'text-violet-700', border: 'border-violet-200', bg: 'bg-violet-50' },
  { dot: 'bg-emerald-500',header: 'text-emerald-700',border: 'border-emerald-200',bg: 'bg-emerald-50' },
  { dot: 'bg-orange-500', header: 'text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' },
  { dot: 'bg-rose-500',   header: 'text-rose-700',   border: 'border-rose-200',   bg: 'bg-rose-50' },
  { dot: 'bg-cyan-500',   header: 'text-cyan-700',   border: 'border-cyan-200',   bg: 'bg-cyan-50' },
]

export default function TasksPage() {
  const inWork = useSelector((s: RootState) => s.inWork)
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)

  if (!inWork) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <FolderOpen size={52} className="opacity-20" />
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

  const defaultOpen = inWork?.projects.map((p) => p.id) ?? []

  async function doExport(format: 'excel' | 'pdf') {
    if (!inWork?.projects.length) return
    setExporting(true)
    const tid = toast.loading('Preparing export…')
    try {
      const params = new URLSearchParams()
      inWork!.projects.forEach((p) => { params.append('project_ids', p.id); params.append('project_names', p.name) })
      const token = localStorage.getItem('token')
      const endpoint = format === 'pdf' ? 'export-multi-pdf' : 'export-multi'
      const res = await fetch(`/api/v1/import-export/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename=([^\s;]+)/)
      a.download = match ? match[1] : `tasks_${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      a.href = url; a.click(); URL.revokeObjectURL(url)
      toast.dismiss(tid); toast.success('Export downloaded.')
    } catch {
      toast.dismiss(tid); toast.error('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{inWork.customerName}</span>
            <span>/</span>
            <span className="font-medium text-foreground">{inWork.contractName}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted">{inWork.projects.length} project{inWork.projects.length !== 1 ? 's' : ''}</span>
          </div>
          <ExportMenu
            loading={exporting}
            disabled={!inWork?.projects.length}
            onExportExcel={() => doExport('excel')}
            onExportPdf={() => doExport('pdf')}
          />
        </div>
      </div>

      {inWork.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FolderOpen size={48} className="opacity-20" />
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
                <AccordionTrigger
                  className={`px-4 hover:no-underline ${color.bg}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
                    <span className={`font-semibold text-sm ${color.header}`}>{project.name}</span>
                    <ProjectTaskCount projectId={project.id} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="border-t px-4 py-4">
                    <TaskTable projectId={project.id} />
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
