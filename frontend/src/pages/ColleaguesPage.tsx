import { useState, useEffect } from 'react'
import { api } from '@/api/baseApi'
import { Plus, Users, X, UserX, UserCheck, Eye, EyeOff } from 'lucide-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'

// ── API ───────────────────────────────────────────────────────────────────────

interface Colleague {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

const TAG = 'Colleague' as const

const colleagueApi = api.injectEndpoints({
  endpoints: (build) => ({
    getColleagues: build.query<Colleague[], void>({
      query: () => '/colleagues',
      providesTags: [TAG],
    }),
    inviteColleague: build.mutation<Colleague, { email: string; full_name: string; password: string; role: string }>({
      query: (body) => ({ url: '/colleagues', method: 'POST', body }),
      invalidatesTags: [TAG],
    }),
    updateColleague: build.mutation<Colleague, { id: string; full_name?: string; email?: string; role?: string; password?: string }>({
      query: ({ id, ...body }) => ({ url: `/colleagues/${id}`, method: 'PATCH', body }),
      invalidatesTags: [TAG],
    }),
    deactivateColleague: build.mutation<Colleague, string>({
      query: (id) => ({ url: `/colleagues/${id}/deactivate`, method: 'PATCH' }),
      invalidatesTags: [TAG],
    }),
    reactivateColleague: build.mutation<Colleague, string>({
      query: (id) => ({ url: `/colleagues/${id}/reactivate`, method: 'PATCH' }),
      invalidatesTags: [TAG],
    }),
  }),
})

const {
  useGetColleaguesQuery,
  useInviteColleagueMutation,
  useUpdateColleagueMutation,
  useDeactivateColleagueMutation,
  useReactivateColleagueMutation,
} = colleagueApi

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
  viewer: 'bg-slate-100 text-slate-600',
}

const ROLES = ['viewer', 'operator', 'admin', 'superadmin']

function avatarLetters(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Password strength ─────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-orange-400' }
  if (score <= 3) return { score, label: 'Good',   color: 'bg-yellow-400' }
  if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' }
  return                 { score, label: 'Very strong', color: 'bg-emerald-500' }
}

function PasswordInput({ value, onChange, placeholder, required, autoComplete, name }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  name?: string
}) {
  const [show, setShow] = useState(false)
  const strength = passwordStrength(value)

  return (
    <div className="space-y-1.5">
      <div className="flex items-stretch overflow-hidden rounded-lg border focus-within:ring-1 focus-within:ring-primary">
        <input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete ?? 'new-password'}
          name={name}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="min-w-0 flex-1 border-0 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="shrink-0 border-l px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {value && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= strength.score ? strength.color : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className={`text-xs font-medium ${
            strength.score <= 1 ? 'text-red-500' :
            strength.score <= 2 ? 'text-orange-500' :
            strength.score <= 3 ? 'text-yellow-600' :
            'text-green-600'
          }`}>{strength.label}</p>
        </div>
      )}
    </div>
  )
}

// ── Edit drawer ───────────────────────────────────────────────────────────────

function ColleagueDrawer({
  colleague,
  open,
  onClose,
  canManage,
  currentUserEmail,
}: {
  colleague: Colleague | null
  open: boolean
  onClose: () => void
  canManage: boolean
  currentUserEmail?: string
}) {
  const [updateColleague, { isLoading: isSaving }] = useUpdateColleagueMutation()
  const [deactivate, { isLoading: isDeactivating }] = useDeactivateColleagueMutation()
  const [reactivate, { isLoading: isReactivating }] = useReactivateColleagueMutation()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [pwError, setPwError] = useState('')
  const [isSavingPw, setIsSavingPw] = useState(false)

  useEffect(() => {
    if (open && colleague) {
      setFullName(colleague.full_name)
      setEmail(colleague.email)
      setRole(colleague.role)
      setNewPassword('')
      setError('')
      setPwError('')
    }
  }, [open, colleague])

  if (!colleague) return null

  const isSelf = colleague.email === currentUserEmail

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const body: { full_name?: string; email?: string; role?: string } = {}
      if (fullName !== colleague!.full_name) body.full_name = fullName
      if (email !== colleague!.email) body.email = email
      if (role !== colleague!.role) body.role = role
      if (Object.keys(body).length) await updateColleague({ id: colleague!.id, ...body }).unwrap()
      toast.success('Colleague updated.')
      onClose()
    } catch (err: any) {
      const msg = err?.data?.detail ?? 'Failed to save'
      setError(msg)
      toast.error(msg)
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword) return
    setPwError('')
    setIsSavingPw(true)
    try {
      await updateColleague({ id: colleague!.id, password: newPassword }).unwrap()
      toast.success('Password updated.')
      setNewPassword('')
    } catch (err: any) {
      const msg = err?.data?.detail ?? 'Failed to update password'
      setPwError(msg)
      toast.error(msg)
    } finally {
      setIsSavingPw(false)
    }
  }

  return (
    <Sheet
      modal={false}
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0 pr-12">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold select-none shrink-0">
            {avatarLetters(colleague.full_name)}
          </div>
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold leading-tight">{colleague.full_name}</SheetTitle>
            <p className="text-xs text-muted-foreground truncate">{colleague.email}</p>
          </div>
        </div>

        {/* Status */}
        <div className="px-5 py-3 border-b shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            colleague.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {colleague.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
            {colleague.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Scrollable body: profile form + change password */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!canManage}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:bg-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canManage}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:bg-muted"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={!canManage}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background disabled:opacity-60 disabled:bg-muted"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {canManage && (
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>

          {/* Change password — inside scroll area so it's far from the deactivate button */}
          {canManage && (
            <form onSubmit={handlePasswordSave} className="px-5 py-4 border-t space-y-3 pb-16">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change Password</p>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password"
                autoComplete="new-password"
                name="new-password"
              />
              {pwError && <p className="text-xs text-destructive">{pwError}</p>}
              <button
                type="submit"
                disabled={isSavingPw || !newPassword}
                className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {isSavingPw ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>

        {/* Deactivate / Reactivate — fixed at bottom, outside scroll */}
        {canManage && !isSelf && (
          <div className="px-5 py-4 border-t shrink-0">
            {colleague.is_active ? (
              <button
                type="button"
                onClick={async () => { await deactivate(colleague.id); toast.info(`${colleague.full_name} deactivated.`); onClose() }}
                disabled={isDeactivating}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-destructive/40 text-destructive rounded-lg hover:bg-destructive/5 disabled:opacity-50"
              >
                <UserX size={14} />
                {isDeactivating ? 'Deactivating…' : 'Deactivate user'}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => { await reactivate(colleague.id); toast.success(`${colleague.full_name} reactivated.`); onClose() }}
                disabled={isReactivating}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-green-500/40 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                <UserCheck size={14} />
                {isReactivating ? 'Reactivating…' : 'Reactivate user'}
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ColleaguesPage() {
  const { data: colleagues = [], isLoading } = useGetColleaguesQuery()
  const [inviteColleague] = useInviteColleagueMutation()
  const currentUser = useSelector((s: RootState) => s.auth.user)
  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin'

  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'operator' })
  const [error, setError] = useState('')
  const [drawerColleague, setDrawerColleague] = useState<Colleague | null>(null)

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await inviteColleague(form).unwrap()
      toast.success(`${form.full_name} invited successfully.`)
      setForm({ email: '', full_name: '', password: '', role: 'operator' })
      setShowForm(false)
    } catch (err: any) {
      const msg = err?.data?.detail ?? 'Failed to invite'
      setError(msg)
      toast.error(msg)
    }
  }

  const inactiveCount = colleagues.filter((c) => !c.is_active).length
  const visible = showInactive ? colleagues : colleagues.filter((c) => c.is_active)

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Colleagues</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors ${
              showInactive
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'text-muted-foreground border-transparent hover:bg-muted'
            }`}
          >
            <UserX size={14} />
            Inactive
            {inactiveCount > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                showInactive ? 'bg-slate-300 text-slate-700' : 'bg-muted text-muted-foreground'
              }`}>
                {inactiveCount}
              </span>
            )}
          </button>
          {canManage && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              <Plus size={14} /> Invite
            </button>
          )}
        </div>
      </div>

      {/* Invite form */}
      {showForm && (
        <form onSubmit={handleInvite} className="bg-card border rounded-xl p-5 space-y-3 max-w-lg shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Invite Colleague</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input required value={form.full_name} onChange={(e) => setField('full_name', e.target.value)}
              placeholder="Full name"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <input required type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
              placeholder="Email"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <PasswordInput
            value={form.password}
            onChange={(v) => setField('password', v)}
            placeholder="Temporary password"
            required
            autoComplete="new-password"
            name="temporary-password"
          />
          <select value={form.role} onChange={(e) => setField('role', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Invite</button>
          </div>
        </form>
      )}

      {/* Table */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>{showInactive ? 'No colleagues.' : 'No active colleagues.'}</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => setDrawerColleague(c)}
                  className={`border-b last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${
                    i % 2 ? 'bg-muted/10' : ''
                  } ${!c.is_active ? 'opacity-55' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold select-none shrink-0">
                        {avatarLetters(c.full_name)}
                      </div>
                      <span className="font-medium">{c.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[c.role] ?? 'bg-muted'}`}>
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      c.is_active ? 'text-green-600' : 'text-slate-400'
                    }`}>
                      {c.is_active ? <UserCheck size={12} /> : <UserX size={12} />}
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      <ColleagueDrawer
        colleague={drawerColleague}
        open={!!drawerColleague}
        onClose={() => setDrawerColleague(null)}
        canManage={canManage}
        currentUserEmail={currentUser?.email}
      />
    </div>
  )
}
