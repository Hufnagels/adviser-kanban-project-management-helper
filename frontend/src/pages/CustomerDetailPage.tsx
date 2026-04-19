import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, ChevronRight, ChevronLeft, FileText, Pencil, X, Check } from 'lucide-react'
import {
  useGetCustomerQuery,
  useUpdateCustomerMutation,
  type Customer,
} from '@/features/customers/customerApi'
import {
  useGetContractsQuery,
  useCreateContractMutation,
  useDeleteContractMutation,
  type Contract,
} from '@/features/contracts/contractApi'
import { toast } from 'sonner'

type Tab = 'profile' | 'contracts'

// ── field helpers ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value}</dd>
    </div>
  )
}

function EditField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  name: keyof Customer
  value: string
  onChange: (k: keyof Customer, v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

function EditTextarea({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: keyof Customer
  value: string
  onChange: (k: keyof Customer, v: string) => void
}) {
  return (
    <div className="space-y-1 col-span-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
    </div>
  )
}

// ── section headings ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ customer }: { customer: Customer }) {
  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>({})
  const [error, setError] = useState('')

  function startEdit() {
    setForm({ ...customer })
    setEditing(true)
    setError('')
  }

  function set(key: keyof Customer, value: string) {
    setForm((prev) => ({ ...prev, [key]: value || undefined }))
  }

  async function handleSave() {
    setError('')
    try {
      await updateCustomer({ id: customer.id, ...form }).unwrap()
      setEditing(false)
    } catch (e: any) {
      setError(e?.data?.detail ?? 'Failed to save.')
    }
  }

  const f = form as unknown as Record<keyof Customer, string>
  const v = (k: keyof Customer) => f[k] ?? ''

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Edit customer profile</p>
          <div className="flex gap-2">
            {error && <span className="text-sm text-destructive mr-2">{error}</span>}
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted">
              <X size={13} /> Cancel
            </button>
            <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
              <Check size={13} /> {isLoading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <Section title="General">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Company name" name="name" value={v('name')} onChange={set} />
            <EditField label="Company type" name="company_type" value={v('company_type')} onChange={set} placeholder="Ltd, GmbH, Inc…" />
            <EditField label="Industry" name="industry" value={v('industry')} onChange={set} />
            <EditField label="Website" name="website" value={v('website')} onChange={set} type="url" />
            <EditField label="SAP BP Code" name="sap_bp_code" value={v('sap_bp_code')} onChange={set} />
            <EditField label="Description" name="description" value={v('description')} onChange={set} />
          </div>
        </Section>

        <Section title="Tax">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Tax / VAT Number" name="tax_number" value={v('tax_number')} onChange={set} />
            <EditField label="Tax Group" name="tax_group" value={v('tax_group')} onChange={set} />
          </div>
        </Section>

        <Section title="Address">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Street" name="address_street" value={v('address_street')} onChange={set} />
            <EditField label="City" name="address_city" value={v('address_city')} onChange={set} />
            <EditField label="ZIP / Postal Code" name="address_zip" value={v('address_zip')} onChange={set} />
            <EditField label="State / Region" name="address_state" value={v('address_state')} onChange={set} />
            <EditField label="Country" name="address_country" value={v('address_country')} onChange={set} />
          </div>
        </Section>

        <Section title="Contact">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Phone" name="phone" value={v('phone')} onChange={set} type="tel" />
            <EditField label="Fax" name="fax" value={v('fax')} onChange={set} type="tel" />
            <EditField label="Email" name="email" value={v('email')} onChange={set} type="email" />
          </div>
        </Section>

        <Section title="General Manager / Key Contact">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Name" name="gm_name" value={v('gm_name')} onChange={set} />
            <EditField label="Title / Position" name="gm_title" value={v('gm_title')} onChange={set} />
            <EditField label="Email" name="gm_email" value={v('gm_email')} onChange={set} type="email" />
            <EditField label="Phone" name="gm_phone" value={v('gm_phone')} onChange={set} type="tel" />
          </div>
        </Section>

        <Section title="Banking">
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Bank Name" name="bank_name" value={v('bank_name')} onChange={set} />
            <EditField label="Account Number" name="bank_account" value={v('bank_account')} onChange={set} />
            <EditField label="IBAN" name="bank_iban" value={v('bank_iban')} onChange={set} />
            <EditField label="BIC / SWIFT" name="bank_bic" value={v('bank_bic')} onChange={set} />
          </div>
        </Section>

        <Section title="Notes">
          <div className="grid grid-cols-1">
            <EditTextarea label="Internal notes" name="notes" value={v('notes')} onChange={set} />
          </div>
        </Section>
      </div>
    )
  }

  // ── Read-only view ──────────────────────────────────────────────────────────

  const hasAddress = customer.address_street || customer.address_city || customer.address_zip || customer.address_country
  const hasGm = customer.gm_name || customer.gm_email || customer.gm_phone
  const hasBank = customer.bank_name || customer.bank_iban || customer.bank_account

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={startEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted"
        >
          <Pencil size={13} /> Edit
        </button>
      </div>

      <Section title="General">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Company name" value={customer.name} />
          <Field label="Company type" value={customer.company_type} />
          <Field label="Industry" value={customer.industry} />
          <Field label="Website" value={customer.website} />
          <Field label="SAP BP Code" value={customer.sap_bp_code} />
          <Field label="Description" value={customer.description} />
        </dl>
      </Section>

      <Section title="Tax">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Tax / VAT Number" value={customer.tax_number} />
          <Field label="Tax Group" value={customer.tax_group} />
        </dl>
      </Section>

      {hasAddress && (
        <Section title="Address">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            <Field label="Street" value={customer.address_street} />
            <Field label="City" value={customer.address_city} />
            <Field label="ZIP / Postal Code" value={customer.address_zip} />
            <Field label="State / Region" value={customer.address_state} />
            <Field label="Country" value={customer.address_country} />
          </dl>
        </Section>
      )}

      <Section title="Contact">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Phone" value={customer.phone} />
          <Field label="Fax" value={customer.fax} />
          <Field label="Email" value={customer.email} />
        </dl>
      </Section>

      {hasGm && (
        <Section title="General Manager / Key Contact">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            <Field label="Name" value={customer.gm_name} />
            <Field label="Title / Position" value={customer.gm_title} />
            <Field label="Email" value={customer.gm_email} />
            <Field label="Phone" value={customer.gm_phone} />
          </dl>
        </Section>
      )}

      {hasBank && (
        <Section title="Banking">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            <Field label="Bank Name" value={customer.bank_name} />
            <Field label="Account Number" value={customer.bank_account} />
            <Field label="IBAN" value={customer.bank_iban} />
            <Field label="BIC / SWIFT" value={customer.bank_bic} />
          </dl>
        </Section>
      )}

      {customer.notes && (
        <Section title="Notes">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{customer.notes}</p>
        </Section>
      )}
    </div>
  )
}

// ── Contracts tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-orange-100 text-orange-700',
  terminated: 'bg-red-100 text-red-700',
}

function ContractsTab({ customerId }: { customerId: string }) {
  const { data: contracts = [], isLoading } = useGetContractsQuery({ customer_id: customerId })
  const [createContract] = useCreateContractMutation()
  const [deleteContract] = useDeleteContractMutation()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [contractNumber, setContractNumber] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const c = await createContract({
        name,
        contract_number: contractNumber || undefined,
        customer_id: customerId,
      }).unwrap()
      toast.success('Contract created.')
      setName(''); setContractNumber(''); setShowForm(false)
      navigate(`/contracts/${c.id}`)
    } catch {
      toast.error('Failed to create contract.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          <Plus size={14} /> Add Contract
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-sm">New Contract</h2>
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Contract name"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Contract number (optional)"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border rounded hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        Contracts ({contracts.length})
      </p>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : !contracts.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No contracts yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c: Contract) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 hover:border-primary/50 cursor-pointer group transition-colors"
              onClick={() => navigate(`/contracts/${c.id}`)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-muted'}`}>
                    {c.status}
                  </span>
                </div>
                {c.contract_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.contract_number}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteContract(c.id); toast.info('Contract deleted.') }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'contracts', label: 'Contracts' },
]

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const { data: customer, isLoading } = useGetCustomerQuery(customerId!)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (!customer) return <div className="text-destructive">Customer not found</div>

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('/customers')} className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft size={14} /> Customers
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{customer.name}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        {customer.company_type && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-muted rounded-full">{customer.company_type}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'profile' && <ProfileTab customer={customer} />}
        {tab === 'contracts' && <ContractsTab customerId={customerId!} />}
      </div>
    </div>
  )
}
