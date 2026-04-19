import { Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  LayoutDashboard, Kanban, GanttChartSquare, FileText, PenLine,
  Calendar, Clock, List, Building2, FolderOpen, ScrollText, Users, AlignLeft, Paperclip,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RootState } from '@/store'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import KanbanPage from '@/pages/KanbanPage'
import GanttPage from '@/pages/GanttPage'
import DocsPage from '@/pages/DocsPage'
import WhiteboardPage from '@/pages/WhiteboardPage'
import CalendarPage from '@/pages/CalendarPage'
import TimePage from '@/pages/TimePage'
import TasksPage from '@/pages/TasksPage'
import CustomersPage from '@/pages/CustomersPage'
import CustomerDetailPage from '@/pages/CustomerDetailPage'
import ProjectDetailPage from '@/pages/ProjectDetailPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ColleaguesPage from '@/pages/ColleaguesPage'
import ProfilePage from '@/pages/ProfilePage'
import ContractDetailPage from '@/pages/ContractDetailPage'
import ContractsPage from '@/pages/ContractsPage'
import TimelinePage from '@/pages/TimelinePage'
import FilesPage from '@/pages/FilesPage'
import DashboardPage from '@/pages/DashboardPage'

// ── Route / nav config ────────────────────────────────────────────────────────

export interface RouteConfig {
  path?: string
  label: string
  icon: LucideIcon
  children?: RouteConfig[]
}

export const navRoutes: RouteConfig[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Clients',
    icon: Building2,
    children: [
      { path: '/customers', label: 'Customers', icon: Building2 },
      { path: '/contracts', label: 'Contracts', icon: ScrollText },
      { path: '/projects',  label: 'Projects',  icon: FolderOpen },
    ],
  },
  // { path: '/colleagues', label: 'Colleagues', icon: Users },
  {
    label: 'inWorking',
    icon: List,
    children: [
      { path: '/tasks',    label: 'All Tasks', icon: List },
      { path: '/timeline', label: 'Timeline',  icon: AlignLeft },
      { path: '/kanban',   label: 'Kanban',    icon: Kanban },
      { path: '/gantt',    label: 'Gantt',     icon: GanttChartSquare },
      { path: '/calendar', label: 'Calendar',  icon: Calendar },
      { path: '/time',     label: 'Time',      icon: Clock },
    ],
  },
  {
    label: 'Content',
    icon: FileText,
    children: [
      { path: '/docs',       label: 'Docs',       icon: FileText },
      { path: '/whiteboard', label: 'Whiteboard', icon: PenLine },
      { path: '/files',      label: 'Files',      icon: Paperclip },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const role = useSelector((s: RootState) => s.auth.user?.role)
  return role === 'superadmin' ? <>{children}</> : <Navigate to="/" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/gantt" element={<GanttPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/whiteboard" element={<WhiteboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/time" element={<TimePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/contracts/:contractId" element={<ContractDetailPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/colleagues" element={<RequireSuperAdmin><ColleaguesPage /></RequireSuperAdmin>} />
        <Route path="/me" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}
