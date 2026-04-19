/**
 * SessionGuard — after IDLE_MS of inactivity shows a dialog:
 *   "Stay logged in" → resets the timer
 *   "Log out"        → dispatches logout → redirects to /login
 *
 * Activity events: mousemove, click, keydown, scroll, touchstart
 */
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '@/features/auth/authSlice'
import type { RootState } from '@/store'

const IDLE_MS  = 30 * 60 * 1000   // 30 min
const WARN_MS  = 60 * 1000        // show warning 1 min before logout

const ACTIVITY_EVENTS = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'] as const

export default function SessionGuard() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const token     = useSelector((s: RootState) => s.auth.token)
  const [show, setShow]       = useState(false)
  const [countdown, setCountdown] = useState(60)
  const idleTimer   = useRef<ReturnType<typeof setTimeout>>()
  const countTimer  = useRef<ReturnType<typeof setInterval>>()

  function clearTimers() {
    clearTimeout(idleTimer.current)
    clearInterval(countTimer.current)
  }

  function reset() {
    clearTimers()
    setShow(false)
    idleTimer.current = setTimeout(() => {
      setShow(true)
      setCountdown(Math.round(WARN_MS / 1000))
      countTimer.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countTimer.current)
            handleLogout()
            return 0
          }
          return c - 1
        })
      }, 1000)
    }, IDLE_MS - WARN_MS)
  }

  function handleStay() {
    reset()
  }

  function handleLogout() {
    clearTimers()
    setShow(false)
    dispatch(logout())
    navigate('/login')
  }

  useEffect(() => {
    if (!token) return
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [token])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Session expiring</h2>
          <p className="text-sm text-muted-foreground">
            You've been inactive. You will be logged out automatically in{' '}
            <span className="font-semibold text-foreground">{countdown}s</span>.
          </p>
        </div>

        {/* Countdown bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(countdown / Math.round(WARN_MS / 1000)) * 100}%` }}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border rounded hover:bg-muted text-destructive border-destructive/30"
          >
            Log out
          </button>
          <button
            autoFocus
            onClick={handleStay}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  )
}
