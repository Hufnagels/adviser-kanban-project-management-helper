import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { setCredentials } from '@/features/auth/authSlice'
import { api } from '@/api/baseApi'
import { toast } from 'sonner'

// ── API ───────────────────────────────────────────────────────────────────────

const profileApi = api.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<{ id: string; email: string; full_name: string; role: string; is_active: boolean }, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    updateMe: build.mutation<
      { id: string; email: string; full_name: string; role: string; is_active: boolean },
      { full_name?: string; email?: string; password?: string }
    >({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
  }),
  overrideExisting: false,
})

const { useGetMeQuery, useUpdateMeMutation } = profileApi

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const dispatch = useDispatch()
  const storeUser = useSelector((s: RootState) => s.auth.user)
  const { data: me, isLoading } = useGetMeQuery()
  const [updateMe, { isLoading: isSaving }] = useUpdateMeMutation()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editMode, setEditMode] = useState(false)

  function startEdit() {
    setFullName(me?.full_name ?? '')
    setEmail(me?.email ?? '')
    setPassword('')
    setConfirm('')
    setError('')
    setSuccess('')
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setError('')
    setSuccess('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    const body: { full_name?: string; email?: string; password?: string } = {}
    if (fullName && fullName !== me?.full_name) body.full_name = fullName
    if (email && email !== me?.email) body.email = email
    if (password) body.password = password

    if (!Object.keys(body).length) {
      setEditMode(false)
      return
    }

    try {
      const updated = await updateMe(body).unwrap()
      dispatch(setCredentials({
        token: localStorage.getItem('token')!,
        user: { email: updated.email, full_name: updated.full_name, role: updated.role, id: updated.id },
      }))
      toast.success('Profile updated.')
      setEditMode(false)
      setPassword('')
      setConfirm('')
    } catch (err: any) {
      const msg = err?.data?.detail ?? 'Failed to save.'
      setError(msg)
      toast.error(msg)
    }
  }

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>
  if (!me) return <div className="text-destructive">Could not load profile.</div>

  const initials = me.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Avatar + summary */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
          {initials}
        </div>
        <div>
          <p className="text-lg font-semibold">{me.full_name}</p>
          <p className="text-sm text-muted-foreground">{me.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-muted capitalize">{me.role}</span>
        </div>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      {!editMode ? (
        <div className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground">Full name</span>
            <span className="font-medium">{me.full_name}</span>
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{me.email}</span>
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{me.role}</span>
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium ${me.is_active ? 'text-green-600' : 'text-destructive'}`}>
              {me.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button
            onClick={startEdit}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Edit profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">New password <span className="text-muted-foreground font-normal">(leave blank to keep)</span></label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {password && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 text-sm border rounded hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
