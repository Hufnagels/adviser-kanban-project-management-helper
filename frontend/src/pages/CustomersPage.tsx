import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Building2, X, ScrollText, CalendarDays } from 'lucide-react'
import {
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useDeleteCustomerMutation,
} from '@/features/customers/customerApi'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useGetCustomersQuery()
  const [createCustomer] = useCreateCustomerMutation()
  const [deleteCustomer] = useDeleteCustomerMutation()
  const navigate = useNavigate()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createCustomer({ name, description: description || undefined })
    setName('')
    setDescription('')
    setShowForm(false)
  }

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          <Plus size={14} /> Add Customer
        </button>
      </div>

      {/* New customer form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-card border rounded-xl p-5 space-y-3 max-w-md shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Customer</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
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

      {/* Cards grid */}
      {customers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No customers yet</p>
          <p className="text-xs mt-1">Add your first customer to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {customers.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/customers/${c.id}`)}
              className="group relative bg-card border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            >
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id) }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold mb-3 select-none">
                {initials(c.name) || <Building2 size={18} />}
              </div>

              {/* Name */}
              <p className="font-semibold text-sm leading-tight pr-5">{c.name}</p>

              {/* Description */}
              {c.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
              )}

              {/* Footer */}
              <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays size={11} />
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ScrollText size={11} />
                  {c.contracts_count} contract{c.contracts_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
