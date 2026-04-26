import { Outlet, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { Separator } from '@/components/ui/separator'
import SessionGuard from '@/components/SessionGuard'
import type { RootState } from '@/store'
import { clearInWork } from '@/features/inWork/inWorkSlice'
import { ChevronRight, X } from 'lucide-react'

function InWorkBreadcrumb() {
  const inWork = useSelector((s: RootState) => s.inWork)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  if (!inWork) return null

  const projectLabel = inWork.projects.length
    ? inWork.projects.map((p) => p.name).join(', ')
    : 'No projects'

  return (
    <>
      <Separator orientation="vertical" className="h-4" />
      <div className="flex items-center gap-1.5 text-sm overflow-hidden">
        <button
          onClick={() => navigate(`/customers/${inWork.customerId}`)}
          className="shrink-0 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-medium text-xs hover:bg-blue-100 transition-colors"
        >
          {inWork.customerName}
        </button>
        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
        <button
          onClick={() => navigate(`/contracts/${inWork.contractId}`)}
          className="shrink-0 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium text-xs hover:bg-indigo-100 transition-colors"
        >
          {inWork.contractName}
        </button>
        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
        <span className="px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-green-800 text-xs truncate max-w-[200px]">
          {projectLabel}
        </span>
        <button
          onClick={() => dispatch(clearInWork())}
          className="shrink-0 ml-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Clear inWork context"
        >
          <X size={13} />
        </button>
      </div>
    </>
  )
}

export default function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 min-h-screen">
        {/* Top bar */}
        <header className="flex h-12 items-center gap-2 border-b px-4 bg-background shrink-0 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <InWorkBreadcrumb />
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <SessionGuard />
    </SidebarProvider>
  )
}
