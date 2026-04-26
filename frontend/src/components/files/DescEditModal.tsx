import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  initialValue: string
  fileName: string
  onSave: (description: string) => Promise<void>
  onClose: () => void
}

export default function DescEditModal({ initialValue, fileName, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(value)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-lg p-5 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm truncate max-w-[80%]">{fileName}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
            placeholder="Add a description…"
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground opacity-60">⌘/Ctrl + Enter to save</p>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border rounded hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
