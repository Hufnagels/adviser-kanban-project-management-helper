import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { ChevronLeft, Pencil, X, Check, Plus, Trash2, ChevronRight, FolderOpen, Briefcase, Upload, List, LayoutGrid, PenLine } from 'lucide-react'
import type { RootState } from '@/store'
import { setInWork, clearInWork } from '@/features/inWork/inWorkSlice'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import {
  useGetContractQuery,
  useUpdateContractMutation,
  useDeleteContractMutation,
  useCreateProjectInContractMutation,
  useAddProjectToContractMutation,
  useRemoveProjectFromContractMutation,
  type Contract,
  type ContractWithProjects,
} from '@/features/contracts/contractApi'
import {
  useListContractFilesQuery,
  useUploadContractFileMutation,
  useDeleteContractFileMutation,
  useUpdateContractFileDescriptionMutation,
} from '@/features/contracts/contractFileApi'
import FileListItem from '@/components/files/FileListItem'
import FileCardItem from '@/components/files/FileCardItem'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import { fetchBlobUrl } from '@/utils/fileUtils'
import { useGetCustomerQuery, useGetCustomersQuery, useGetProjectsQuery } from '@/features/customers/customerApi'
import { useListWhiteboardsQuery } from '@/features/whiteboards/whiteboardsApi'
import { toast } from 'sonner'

type Tab = 'details' | 'financial' | 'projects' | 'documents' | 'settings'

const STATUS_OPTIONS = ['draft', 'active', 'expired', 'terminated']
const BILLING_OPTIONS = ['monthly', 'quarterly', 'semi-annual', 'annual', 'one-time']
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-orange-100 text-orange-700',
  terminated: 'bg-red-100 text-red-700',
}

// ── shared helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value}</dd>
    </div>
  )
}

function EField({
  label, name, value, onChange, type = 'text', placeholder,
}: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  )
}

function ESelect({
  label, name, value, onChange, options,
}: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void; options: string[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(name, e.target.value)}
        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function EQuill({
  label, name, value, onChange,
}: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-1 col-span-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="quill-wrapper rounded border overflow-hidden">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={(html) => onChange(name, html)}
          modules={{ toolbar: [[{ header: [1, 2, false] }], ['bold', 'italic', 'underline'], ['link'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] }}
        />
      </div>
    </div>
  )
}

// ── Edit toolbar ──────────────────────────────────────────────────────────────

function EditBar({ onCancel, onSave, isSaving, error }: {
  onCancel: () => void; onSave: () => void; isSaving: boolean; error: string
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">Editing…</p>
      <div className="flex gap-2">
        {error && <span className="text-sm text-destructive mr-2">{error}</span>}
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted">
          <X size={13} /> Cancel
        </button>
        <button onClick={onSave} disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
          <Check size={13} /> {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ contractId }: { contractId: string }) {
  const { data: files = [], isLoading } = useListContractFilesQuery(contractId)
  const [uploadFile] = useUploadContractFileMutation()
  const [deleteFile] = useDeleteContractFileMutation()
  const [updateDesc] = useUpdateContractFileDescriptionMutation()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<{ id: string; name: string; contentType: string | null } | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card')

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploading(true)
    const tid = toast.loading(`Uploading ${fileList.length} file${fileList.length > 1 ? 's' : ''}…`)
    let ok = 0
    for (const file of Array.from(fileList)) {
      try {
        await uploadFile({ contractId, file }).unwrap()
        ok++
      } catch {
        toast.error(`Failed to upload "${file.name}"`)
      }
    }
    toast.dismiss(tid)
    if (ok > 0) toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded.`)
    setUploading(false)
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files)
  }, [contractId])

  async function handleDownload(file: { id: string; name: string }) {
    try {
      const url = await fetchBlobUrl(`/api/v1/contracts/${contractId}/files/${file.id}/download`)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed.')
    }
  }

  async function handleDelete(file: { id: string; name: string }) {
    if (!confirm(`Delete "${file.name}"?`)) return
    try {
      await deleteFile({ contractId, fileId: file.id }).unwrap()
      toast.success('File deleted.')
    } catch {
      toast.error('Failed to delete file.')
    }
  }

  async function handleDescriptionSave(fileId: string, description: string) {
    await updateDesc({ contractId, fileId, description }).unwrap()
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors select-none ${
          dragging
            ? 'border-primary bg-primary/5 text-primary'
            : uploading
            ? 'border-muted bg-muted/30 opacity-60 pointer-events-none'
            : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40 text-muted-foreground'
        }`}
      >
        <Upload size={26} className="opacity-70" />
        <p className="text-sm font-medium">
          {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs opacity-60">Any file type accepted</p>
        <input type="file" multiple className="hidden" disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)} />
      </label>

      {/* File list header */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</span>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="List view"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Card view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {files.map((f) => (
            <FileListItem
              key={f.id}
              file={f}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={(file) => setPreview({ id: file.id, name: file.name, contentType: file.content_type ?? null })}
              onDescriptionSave={handleDescriptionSave}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map((f) => (
            <FileCardItem
              key={f.id}
              file={f}
              apiUrl={`/api/v1/contracts/${contractId}/files/${f.id}/download`}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={(file) => setPreview({ id: file.id, name: file.name, contentType: file.content_type ?? null })}
              onDescriptionSave={handleDescriptionSave}
            />
          ))}
        </div>
      )}

      {preview && (
        <FilePreviewModal
          apiUrl={`/api/v1/contracts/${contractId}/files/${preview.id}/download`}
          name={preview.name}
          contentType={preview.contentType}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Boards section */}
      <BoardsSection contractId={contractId} />
    </div>
  )
}

function BoardsSection({ contractId }: { contractId: string }) {
  const navigate = useNavigate()
  const { data: boards = [], isLoading } = useListWhiteboardsQuery({ contract_id: contractId })

  if (isLoading) return null
  if (boards.length === 0) return null

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
        <PenLine size={13} />
        Boards
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
          {boards.length}
        </span>
      </div>
      <div className="space-y-1">
        {boards.map((board) => (
          <button
            key={board.id}
            type="button"
            onClick={() => navigate(`/whiteboard?board=${board.id}`)}
            className="w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted transition-colors"
          >
            {board.preview ? (
              <img src={board.preview} alt={board.name} className="w-12 h-8 rounded object-cover border shrink-0" />
            ) : (
              <div className="w-12 h-8 rounded border bg-muted flex items-center justify-center shrink-0">
                <PenLine size={14} className="text-muted-foreground/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{board.name}</p>
              {board.description && (
                <p className="text-xs text-muted-foreground truncate">{board.description}</p>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {new Date(board.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Details tab ───────────────────────────────────────────────────────────────

function DetailsTab({ contract }: { contract: Contract }) {
  const [update, { isLoading }] = useUpdateContractMutation()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  function startEdit() {
    setForm({
      name: contract.name ?? '',
      contract_number: contract.contract_number ?? '',
      status: contract.status ?? 'active',
      start_date: contract.start_date ?? '',
      end_date: contract.end_date ?? '',
      description: contract.description ?? '',
      notes: contract.notes ?? '',
    })
    setEditing(true)
    setError('')
  }

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSave() {
    setError('')
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      )
      await update({ id: contract.id, ...payload }).unwrap()
      toast.success('Contract saved.')
      setEditing(false)
    } catch (e: any) {
      const msg = e?.data?.detail ?? 'Failed to save.'
      setError(msg)
      toast.error(msg)
    }
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <EditBar onCancel={() => setEditing(false)} onSave={handleSave} isSaving={isLoading} error={error} />
        <Section title="General">
          <div className="grid grid-cols-2 gap-3">
            <EField label="Contract name" name="name" value={form.name} onChange={set} />
            <EField label="Contract number" name="contract_number" value={form.contract_number} onChange={set} />
            <ESelect label="Status" name="status" value={form.status} onChange={set} options={STATUS_OPTIONS} />
            <EField label="Start date" name="start_date" value={form.start_date} onChange={set} type="date" />
            <EField label="End date" name="end_date" value={form.end_date} onChange={set} type="date" />
          </div>
        </Section>
        <Section title="Description & Notes">
          <div className="grid grid-cols-1 gap-3">
            <EQuill label="Description" name="description" value={form.description} onChange={set} />
            <EQuill label="Internal notes" name="notes" value={form.notes} onChange={set} />
          </div>
        </Section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted">
          <Pencil size={13} /> Edit
        </button>
      </div>
      <Section title="General">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Contract name" value={contract.name} />
          <Field label="Contract number" value={contract.contract_number} />
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status] ?? 'bg-muted'}`}>
                {contract.status}
              </span>
            </dd>
          </div>
          <Field label="Start date" value={contract.start_date} />
          <Field label="End date" value={contract.end_date} />
        </dl>
      </Section>
      {contract.description && (
        <Section title="Description">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{contract.description}</p>
        </Section>
      )}
      {contract.notes && (
        <Section title="Internal notes">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{contract.notes}</p>
        </Section>
      )}
    </div>
  )
}

// ── Payment terms help ────────────────────────────────────────────────────────

const PAYMENT_TERMS_HELP = [
  { term: 'Due on receipt',  meaning: 'Payment expected immediately upon receiving the invoice' },
  { term: 'Net 7',          meaning: 'Payment due within 7 days from invoice date' },
  { term: 'Net 14',         meaning: 'Payment due within 14 days from invoice date' },
  { term: 'Net 30',         meaning: 'Payment due within 30 days from invoice date' },
  { term: 'Net 60',         meaning: 'Payment due within 60 days from invoice date' },
  { term: 'Net 90',         meaning: 'Payment due within 90 days from invoice date' },
  { term: '2/10 Net 30',    meaning: '2% discount if paid within 10 days, otherwise full amount due in 30 days' },
  { term: 'EOM',            meaning: 'End of Month — payment due at end of the month the invoice was issued' },
  { term: 'COD',            meaning: 'Cash on Delivery — payment collected when goods/services are delivered' },
  { term: 'Prepaid',        meaning: 'Full payment required before delivery or service begins' },
]

function PaymentTermsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-blue-700 font-medium"
      >
        <span className="flex items-center gap-2">
          <span className="text-base leading-none">ℹ</span>
          Payment Terms reference
        </span>
        <span className="text-xs opacity-60">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-blue-200">
                <th className="py-1.5 pr-4 text-left font-semibold text-blue-800 w-36">Term</th>
                <th className="py-1.5 text-left font-semibold text-blue-800">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_TERMS_HELP.map((row) => (
                <tr key={row.term} className="border-b border-blue-100 last:border-0">
                  <td className="py-1.5 pr-4 font-mono text-blue-900 whitespace-nowrap">{row.term}</td>
                  <td className="py-1.5 text-blue-800">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-blue-600 italic">
            This field is informational — it records the agreed payment window for reference on invoices.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Financial tab ─────────────────────────────────────────────────────────────

function FinancialTab({ contract }: { contract: Contract }) {
  const [update, { isLoading }] = useUpdateContractMutation()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  function startEdit() {
    setForm({
      contract_value: contract.contract_value?.toString() ?? '',
      currency: contract.currency ?? 'EUR',
      payment_terms: contract.payment_terms ?? '',
      billing_cycle: contract.billing_cycle ?? '',
      discount: contract.discount?.toString() ?? '',
    })
    setEditing(true)
    setError('')
  }

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSave() {
    setError('')
    try {
      await update({
        id: contract.id,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : undefined,
        currency: form.currency || undefined,
        payment_terms: form.payment_terms || undefined,
        billing_cycle: form.billing_cycle || undefined,
        discount: form.discount ? parseFloat(form.discount) : undefined,
      } as any).unwrap()
      toast.success('Financial details saved.')
      setEditing(false)
    } catch (e: any) {
      const msg = e?.data?.detail ?? 'Failed to save.'
      setError(msg)
      toast.error(msg)
    }
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <EditBar onCancel={() => setEditing(false)} onSave={handleSave} isSaving={isLoading} error={error} />
        <Section title="Financials">
          <div className="grid grid-cols-2 gap-3">
            <EField label="Contract value" name="contract_value" value={form.contract_value} onChange={set} type="number" placeholder="0.00" />
            <EField label="Currency" name="currency" value={form.currency} onChange={set} placeholder="EUR" />
            <EField label="Payment terms" name="payment_terms" value={form.payment_terms} onChange={set} placeholder="e.g. Net 30" />
            <ESelect label="Billing cycle" name="billing_cycle" value={form.billing_cycle || ''} onChange={set} options={['', ...BILLING_OPTIONS]} />
            <EField label="Discount (%)" name="discount" value={form.discount} onChange={set} type="number" placeholder="0" />
            <PaymentTermsHelp />
          </div>
        </Section>
      </div>
    )
  }

  const fmt = (n?: number) => n != null ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : undefined

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted">
          <Pencil size={13} /> Edit
        </button>
      </div>
      <Section title="Financials">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          <Field label="Contract value" value={contract.contract_value != null ? `${fmt(contract.contract_value)} ${contract.currency ?? ''}` : undefined} />
          <Field label="Currency" value={contract.currency} />
          <Field label="Payment terms" value={contract.payment_terms} />
          <Field label="Billing cycle" value={contract.billing_cycle} />
          <Field label="Discount" value={contract.discount != null ? `${contract.discount}%` : undefined} />
        </dl>
        <PaymentTermsHelp />
      </Section>
    </div>
  )
}

// ── Projects tab ──────────────────────────────────────────────────────────────

function ProjectsTab({ contract }: { contract: { id: string; customer_id: string; projects: any[] } }) {
  const [createProject] = useCreateProjectInContractMutation()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createProject({
        name,
        description: description || undefined,
        contract_id: contract.id,
        customer_id: contract.customer_id,
      }).unwrap()
      toast.success('Project created.')
      setName(''); setDescription(''); setShowForm(false)
    } catch {
      toast.error('Failed to create project.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">
          <Plus size={14} /> Add Project
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-card border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-sm">New Project</h2>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border rounded hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        Projects ({contract.projects.length})
      </p>

      {!contract.projects.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No projects yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contract.projects.map((p) => (
            <div key={p.id}
              className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 hover:border-primary/50 cursor-pointer group transition-colors"
              onClick={() => navigate(`/projects/${p.id}`)}>
              <div>
                <p className="font-medium">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ contract }: { contract: ContractWithProjects }) {
  const [update] = useUpdateContractMutation()
  const [addProject] = useAddProjectToContractMutation()
  const [removeProject] = useRemoveProjectFromContractMutation()
  const { data: customers = [] } = useGetCustomersQuery()
  const { data: allProjects = [] } = useGetProjectsQuery({})
  const navigate = useNavigate()

  // Customer reassignment
  const [newCustomerId, setNewCustomerId] = useState(contract.customer_id)
  const [custSaving, setCustSaving] = useState(false)

  async function handleCustomerChange() {
    if (newCustomerId === contract.customer_id) return
    setCustSaving(true)
    try {
      await update({ id: contract.id, customer_id: newCustomerId }).unwrap()
      toast.success('Customer reassigned.')
    } catch {
      toast.error('Failed to reassign customer.')
    } finally {
      setCustSaving(false)
    }
  }

  // Unlinked projects of this customer that could be linked
  const linkedIds = new Set(contract.projects?.map((p: any) => p.id) ?? [])
  const linkable = allProjects.filter(
    (p) => p.customer_id === contract.customer_id && !linkedIds.has(p.id)
  )

  async function linkProject(projectId: string) {
    try {
      await addProject({ project_id: projectId, contract_id: contract.id }).unwrap()
      toast.success('Project linked to contract.')
    } catch {
      toast.error('Failed to link project.')
    }
  }

  async function unlinkProject(projectId: string) {
    try {
      await removeProject({ project_id: projectId, contract_id: contract.id }).unwrap()
      toast.success('Project unlinked.')
    } catch {
      toast.error('Failed to unlink project.')
    }
  }

  return (
    <div className="space-y-8">
      {/* Chain overview */}
      <Section title="Customer → Contract → Project Chain">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 font-medium text-blue-800">
            {customers.find((c) => c.id === contract.customer_id)?.name ?? '—'}
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
          <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 font-medium text-indigo-800">
            {contract.name}
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
          <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
            {contract.projects?.length ? contract.projects.map((p: any) => p.name).join(', ') : 'No projects'}
          </div>
        </div>
      </Section>

      {/* Reassign customer */}
      <Section title="Reassign Customer">
        <p className="text-xs text-muted-foreground mb-3">Move this contract to a different customer.</p>
        <div className="flex items-center gap-2">
          <select
            value={newCustomerId}
            onChange={(e) => setNewCustomerId(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background"
          >
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={handleCustomerChange}
            disabled={custSaving || newCustomerId === contract.customer_id}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
          >
            {custSaving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </Section>

      {/* Link existing projects */}
      <Section title="Link Existing Projects">
        <p className="text-xs text-muted-foreground mb-3">
          Projects belonging to this customer that are not yet linked to this contract.
        </p>
        {linkable.length === 0 ? (
          <p className="text-sm text-muted-foreground">All customer projects are already linked.</p>
        ) : (
          <div className="space-y-2">
            {linkable.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-card">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <button
                  onClick={() => linkProject(p.id)}
                  className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                >
                  Link
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Unlink projects */}
      {(contract.projects?.length ?? 0) > 0 && (
        <Section title="Unlink Projects">
          <p className="text-xs text-muted-foreground mb-3">Remove a project from this contract (project is kept).</p>
          <div className="space-y-2">
            {contract.projects?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-card">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <button
                  onClick={() => unlinkProject(p.id)}
                  className="text-xs px-3 py-1 border border-destructive/40 text-destructive rounded hover:bg-destructive/5"
                >
                  Unlink
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Danger zone */}
      <Section title="Danger Zone">
        <p className="text-xs text-muted-foreground mb-3">
          Navigate directly to the customer or projects in this contract.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/customers/${contract.customer_id}`)}
            className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
          >
            Open Customer
          </button>
          {contract.projects?.map((p: any) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="px-3 py-1.5 text-sm border rounded hover:bg-muted"
            >
              Open "{p.name}"
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Contract Details' },
  { id: 'financial', label: 'Financial' },
  { id: 'projects', label: 'Projects' },
  { id: 'documents', label: 'Documents' },
  { id: 'settings', label: 'Settings' },
]

export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>()
  const { data: contract, isLoading } = useGetContractQuery(contractId!)
  const [deleteContract] = useDeleteContractMutation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [tab, setTab] = useState<Tab>('details')

  const inWork = useSelector((s: RootState) => s.inWork)
  const isInWork = inWork?.contractId === contractId

  const { data: customer } = useGetCustomerQuery(contract?.customer_id ?? '', {
    skip: !contract?.customer_id,
  })

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (!contract) return <div className="text-destructive">Contract not found</div>

  async function handleDelete() {
    if (!confirm(`Delete contract "${contract!.name}"?`)) return
    try {
      await deleteContract(contract!.id).unwrap()
      if (isInWork) dispatch(clearInWork())
      toast.success('Contract deleted.')
      navigate(`/customers/${contract!.customer_id}`)
    } catch {
      toast.error('Failed to delete contract.')
    }
  }

  function handleInWork() {
    if (isInWork) {
      dispatch(clearInWork())
    } else {
      dispatch(setInWork({
        customerId: contract!.customer_id,
        customerName: customer?.name ?? '…',
        contractId: contract!.id,
        contractName: contract!.name,
        projects: contract!.projects?.map((p: any) => ({ id: p.id, name: p.name })) ?? [],
      }))
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => navigate('/customers')} className="hover:text-foreground">Customers</button>
        <span>/</span>
        <button onClick={() => navigate(`/customers/${contract.customer_id}`)} className="hover:text-foreground">
          {customer?.name ?? '…'}
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{contract.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/customers/${contract.customer_id}`)}
              className="text-muted-foreground hover:text-foreground">
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-2xl font-bold">{contract.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {contract.contract_number && (
              <span className="text-xs text-muted-foreground font-mono">{contract.contract_number}</span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status] ?? 'bg-muted'}`}>
              {contract.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInWork}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border font-medium transition-colors ${
              isInWork
                ? 'bg-primary text-primary-foreground border-primary hover:opacity-90'
                : 'border-foreground/30 hover:bg-muted'
            }`}
          >
            <Briefcase size={13} />
            {isInWork ? 'inWork ✓' : 'inWork'}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-destructive/40 text-destructive rounded hover:bg-destructive/5">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {tab === 'details' && <DetailsTab contract={contract} />}
        {tab === 'financial' && <FinancialTab contract={contract} />}
        {tab === 'projects' && <ProjectsTab contract={contract} />}
        {tab === 'documents' && <DocumentsTab contractId={contract.id} />}
        {tab === 'settings' && <SettingsTab contract={contract} />}
      </div>
    </div>
  )
}
