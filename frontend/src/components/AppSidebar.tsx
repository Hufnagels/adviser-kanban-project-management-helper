import { useState } from 'react'
import ProjectLogo from '@/components/ProjectLogo'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '@/features/auth/authSlice'
import type { RootState } from '@/store'
import { navRoutes, type RouteConfig } from '@/routes'
import {
  LogOut,
  ChevronsUpDown,
  User,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ── Active styling helpers ────────────────────────────────────────────────────

function activeClass(isActive: boolean, indent = false) {
  return [
    'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors',
    indent ? 'pl-8' : '',
    isActive
      ? 'font-semibold'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  ].join(' ')
}

// ── Leaf nav item ─────────────────────────────────────────────────────────────

function NavItem({ route, indent = false }: { route: RouteConfig; indent?: boolean }) {
  const resolved = useLocation()
  const isActive = route.path === '/'
    ? resolved.pathname === '/'
    : resolved.pathname === route.path || resolved.pathname.startsWith(route.path + '/')

  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={route.label} isActive={isActive} asChild>
        <NavLink
          to={route.path!}
          end={route.path === '/'}
          className={activeClass(isActive, indent)}
          style={isActive ? { backgroundColor: '#383696', color: 'aliceblue', borderRadius: '6px' } : undefined}
        >
          <route.icon size={16} className="shrink-0" />
          <span>{route.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// ── Collapsible group ─────────────────────────────────────────────────────────

function NavGroup({ route }: { route: RouteConfig }) {
  const { pathname } = useLocation()
  const childPaths = route.children?.map((c) => c.path) ?? []
  const isChildActive = childPaths.includes(pathname)
  const [open, setOpen] = useState(isChildActive)

  return (
    <SidebarMenuItem>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors',
          isChildActive
            ? 'font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ].join(' ')}
        style={isChildActive ? { backgroundColor: '#e4e4f0', color: '#222222' } : undefined}
      >
        <route.icon size={16} className="shrink-0" />
        <span className="flex-1 text-left">{route.label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <SidebarMenu className="mt-1">
          {route.children?.map((child) => (
            <NavItem key={child.path} route={child} indent />
          ))}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}

// ── User avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((s: RootState) => s.auth.user)

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  return (
    <Sidebar collapsible="icon">
      {/* Header: app branding style={{ backgroundColor: '#383696' }}*/}
      <SidebarHeader className="bg-sidebar" style={{ backgroundColor: '#383696' }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-[#383696] focus:bg-[#383696] active:bg-[#383696] data-[active=true]:bg-[#383696]"
            >
              <span className="cursor-default">
                <div className="h-12 w-12 ">
                  <ProjectLogo className="h-12 w-12" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="font-semibold truncate" style={{ color: 'aliceblue' }}>Kanban Platform</span>
                </div>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content: navigation */}
      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {navRoutes.map((route) =>
            route.children ? (
              <NavGroup key={route.label} route={route} />
            ) : (
              <NavItem key={route.path} route={route} />
            )
          )}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer: user dropdown */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip={user?.email}
                >
                  <UserAvatar name={user?.full_name ?? user?.email ?? 'U'} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="font-semibold truncate">{user?.full_name ?? user?.email}</span>
                    <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-white"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <UserAvatar name={user?.full_name ?? user?.email ?? 'U'} />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="font-semibold truncate">{user?.full_name ?? user?.email}</span>
                      <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => navigate('/me')}>
                  <User size={14} />
                  <span>Profile</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{user?.role}</span>
                </DropdownMenuItem>
                {user?.role === 'superadmin' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2" onClick={() => navigate('/colleagues')}>
                      <Users size={14} />
                      <span>Colleagues</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={handleLogout}>
                  <LogOut size={14} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
