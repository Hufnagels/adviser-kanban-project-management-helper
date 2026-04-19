import { useState } from 'react'
import ProjectLogo from '@/components/ProjectLogo'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useLoginMutation, useGetMeQuery } from '@/features/auth/authApi'
import { setCredentials } from '@/features/auth/authSlice'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('changeme')
  const [error, setError] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const data = await login({ email, password }).unwrap()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      })
      const user = await res.json()
      dispatch(setCredentials({ token: data.access_token, user }))
      navigate('/')
    } catch {
      setError('Invalid credentials')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Subtle overlay so the card stays readable */}
      <div className="absolute inset-0 bg-black/30" />
        
      <form
        onSubmit={handleSubmit}
        className="relative z-10 bg-card/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-sm space-y-4"
      >
        <ProjectLogo className="h-24 w-24" />

        <h1 className="text-2xl font-bold text-center">Kanban Platform</h1>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary text-primary-foreground py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

