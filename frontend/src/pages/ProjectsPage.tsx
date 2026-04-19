import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, FolderOpen, Building2, X } from 'lucide-react'
import {
  useGetCustomersQuery,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  type Project,
} from '@/features/customers/customerApi'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { data: customers = [] } = useGetCustomersQuery()
  const { data: projects = [], isLoading } = useGetProjectsQuery({})
  const [createProject] = useCreateProjectMutation()
  const [deleteProject] = useDeleteProjectMutation()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [customerId, setCustomerId] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createProject({
      name,
      description: description || undefined,
      customer_id: customerId || undefined,
    })
    setName('')
    setDescription('')
    setCustomerId('')
    setShowForm(false)
  }

  // Group projects by customer
  const grouped: { customerId: string | null; customerName: string; projects: Project[] }[] = []

  customers.forEach((c) => {
    const cProjects = projects.filter((p) => p.customer_id === c.id)
    if (cProjects.length > 0) {
      grouped.push({ customerId: c.id, customerName: c.name, projects: cProjects })
    }
  })

  const unassigned = projects.filter((p) => !p.customer_id)
  if (unassigned.length > 0) {
    grouped.push({ customerId: null, customerName: 'Unassigned', projects: unassigned })
  }

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* New project form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-card border rounded-xl p-5 space-y-3 max-w-md shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Project</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            <option value="">— No customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">
              Create
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No projects yet</p>
          <p className="text-xs mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.customerId ?? '__unassigned'}>
              {/* Customer group header */}
              <div className="flex items-center gap-2 mb-3">
                {group.customerId ? (
                  <Building2 size={15} className="text-muted-foreground shrink-0" />
                ) : (
                  <FolderOpen size={15} className="text-muted-foreground shrink-0" />
                )}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.customerName}
                </h2>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  {group.projects.length}
                </span>
                {group.customerId && (
                  <button
                    onClick={() => navigate(`/customers/${group.customerId}`)}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    View customer →
                  </button>
                )}
              </div>

              {/* Project cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="group relative bg-card border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject({ id: p.id, customer_id: p.customer_id }) }}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <FolderOpen size={18} />
                    </div>

                    {/* Name */}
                    <p className="font-semibold text-sm leading-tight pr-5">{p.name}</p>

                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                    )}

                    {/* Footer */}
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">View project</span>
                      <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
