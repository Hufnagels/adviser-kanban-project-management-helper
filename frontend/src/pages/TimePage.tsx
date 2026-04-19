import { useState } from 'react'
import { api } from '@/api/baseApi'
import { useGetTasksQuery } from '@/features/kanban/taskApi'

const timeApi = api.injectEndpoints({
  endpoints: (build) => ({
    startTimer: build.mutation<{ id: string; start_time: string }, string>({
      query: (taskId) => ({ url: `/time/start/${taskId}`, method: 'POST' }),
    }),
    stopTimer: build.mutation<{ id: string; duration_seconds: number }, string>({
      query: (entryId) => ({ url: `/time/stop/${entryId}`, method: 'POST' }),
    }),
    getReport: build.query<{ task_id: string; task_title: string; total_seconds: number }[], void>({
      query: () => '/time/report',
    }),
  }),
})

const { useStartTimerMutation, useStopTimerMutation, useGetReportQuery } = timeApi

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}h ${m}m ${sec}s`
}

export default function TimePage() {
  const { data: tasks = [] } = useGetTasksQuery({})
  const { data: report = [], refetch } = useGetReportQuery()
  const [startTimer] = useStartTimerMutation()
  const [stopTimer] = useStopTimerMutation()
  const [activeEntry, setActiveEntry] = useState<{ id: string; taskId: string } | null>(null)
  const [selectedTask, setSelectedTask] = useState('')

  async function handleStart() {
    if (!selectedTask) return
    const entry = await startTimer(selectedTask).unwrap()
    setActiveEntry({ id: entry.id, taskId: selectedTask })
  }

  async function handleStop() {
    if (!activeEntry) return
    await stopTimer(activeEntry.id).unwrap()
    setActiveEntry(null)
    refetch()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Time Tracking</h1>

      <div className="bg-card border rounded-lg p-4 space-y-3 max-w-md">
        <h2 className="font-semibold">Timer</h2>
        <select
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          disabled={!!activeEntry}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          <option value="">Select task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {!activeEntry ? (
          <button
            onClick={handleStart}
            disabled={!selectedTask}
            className="w-full bg-primary text-primary-foreground py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-destructive text-destructive-foreground py-2 rounded text-sm hover:opacity-90"
          >
            ■ Stop
          </button>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Time Report</h2>
        {report.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <table className="w-full text-sm border rounded overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2">Task</th>
                <th className="text-right px-3 py-2">Total Time</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row) => (
                <tr key={row.task_id} className="border-t">
                  <td className="px-3 py-2">{row.task_title}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatSeconds(row.total_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
