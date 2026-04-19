import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Building2, X, ChevronRight, Trash2, Briefcase } from 'lucide-react'
import { useGetContractsQuery, useCreateContractMutation, useDeleteContractMutation, type Contract } from '@/features/contracts/contractApi'
import { useGetCustomersQuery } from '@/features/customers/customerApi'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-orange-100 text-orange-700',
  terminated: 'bg-red-100 text-red-700',
}

export default function ContractsPage() {
  const navigate = useNavigate()
  const { data: contracts = [], isLoading } = useGetContractsQuery({})
  const { data: customers = [] } = useGetCustomersQuery()
  const [createContract] = useCreateContractMutation()
  const [deleteContract] = useDeleteContractMutation()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !customerId) return
    try {
      const c = await createContract({ name, contract_number: contractNumber || undefined, customer_id: customerId }).unwrap()
      toast.success('Contract created.')
      setName(''); setContractNumber(''); setCustomerId(''); setShowForm(false)
      navigate(`/contracts/${c.id}`)
    } catch {
      toast.error('Failed to create contract.')
    }
  }

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]))

  const visible = filterCustomer
    ? contracts.filter((c) => c.customer_id === filterCustomer)
    : contracts

  // Group by customer
  const grouped: { customerId: string; customerName: string; contracts: Contract[] }[] = []
  customers.forEach((cust) => {
    const group = visible.filter((c) => c.customer_id === cust.id)
    if (group.length > 0) grouped.push({ customerId: cust.id, customerName: cust.name, contracts: group })
  })
  const unassigned = visible.filter((c) => !customers.find((cu) => cu.id === c.customer_id))
  if (unassigned.length > 0) grouped.push({ customerId: '__none', customerName: 'Unassigned', contracts: unassigned })

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Contracts</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            <Plus size={14} /> New Contract
          </button>
        </div>
      </div>

      {/* New contract form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border rounded-xl p-5 space-y-3 max-w-md shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Contract</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            <option value="">— Select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            autoFocus required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contract name"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            placeholder="Contract number (optional)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Create</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {contracts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">No contracts yet</p>
          <p className="text-xs mt-1">Create your first contract to get started</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No contracts match the selected filter.</div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.customerId}>
              {/* Customer group header */}
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={15} className="text-muted-foreground shrink-0" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.customerName}</h2>
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{group.contracts.length}</span>
                {group.customerId !== '__none' && (
                  <button
                    onClick={() => navigate(`/customers/${group.customerId}`)}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    View customer →
                  </button>
                )}
              </div>

              {/* Contract cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.contracts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/contracts/${c.id}`)}
                    className="group relative bg-card border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    {/* Action buttons */}
                    <div
                      className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        disabled
                        title="Set as active work context (coming soon)"
                        className="p-1 rounded text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Briefcase size={13} />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete contract"
                          >
                            <Trash2 size={13} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete contract?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{c.name}</strong> will be permanently deleted. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteContract(c.id).unwrap()
                                  toast.success('Contract deleted.')
                                } catch {
                                  toast.error('Failed to delete contract.')
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                      <FileText size={18} />
                    </div>
                    <div className="flex items-start justify-between gap-2 pr-14">
                      <p className="font-semibold text-sm leading-tight">{c.name}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-muted'}`}>
                        {c.status}
                      </span>
                    </div>
                    {c.contract_number && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.contract_number}</p>
                    )}
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">View contract</span>
                      <ChevronRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
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
