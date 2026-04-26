/**
 * DocEditorPanel — sidebar doc list + editor canvas.
 * Used in the Project detail Docs tab (scoped to a project)
 * and potentially as an embedded view.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, FileText, Clock } from 'lucide-react'
import { toast } from 'sonner'
import {
  useListDocsQuery,
  useCreateDocMutation,
  useUpdateDocMutation,
  useDeleteDocMutation,
  type Doc,
  type DocBlock,
} from '@/features/docs/docsApi'

// ── Unique id helper ──────────────────────────────────────────────────────────

let _bid = 1
function newBlock(type: DocBlock['type'] = 'text'): DocBlock {
  return { id: `b${_bid++}`, type, content: '' }
}

// ── Timestamp helper ──────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Block editor ──────────────────────────────────────────────────────────────

function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: DocBlock[]
  onChange: (blocks: DocBlock[]) => void
}) {
  const areaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())

  function update(id: string, content: string) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  function addAfter(id: string) {
    const idx = blocks.findIndex((b) => b.id === id)
    const nb = newBlock()
    const next = [...blocks]
    next.splice(idx + 1, 0, nb)
    onChange(next)
    setTimeout(() => areaRefs.current.get(nb.id)?.focus(), 0)
  }

  function remove(id: string) {
    if (blocks.length <= 1) return
    const idx = blocks.findIndex((b) => b.id === id)
    const prev = blocks[idx - 1]
    onChange(blocks.filter((b) => b.id !== id))
    if (prev) setTimeout(() => areaRefs.current.get(prev.id)?.focus(), 0)
  }

  function toggleType(id: string) {
    onChange(blocks.map((b) =>
      b.id === id ? { ...b, type: b.type === 'heading' ? 'text' : 'heading' } : b
    ))
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="space-y-1">
      {blocks.map((block) => (
        <div key={block.id} className="group flex items-start gap-2">
          <button
            onClick={() => toggleType(block.id)}
            className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground border rounded px-1 py-0.5 hover:bg-muted transition-opacity"
            title={block.type === 'heading' ? 'Switch to text' : 'Switch to heading'}
          >
            {block.type === 'heading' ? 'H' : 'T'}
          </button>
          <textarea
            ref={(el) => {
              if (el) { areaRefs.current.set(block.id, el); autoResize(el) }
              else areaRefs.current.delete(block.id)
            }}
            value={block.content}
            onChange={(e) => { update(block.id, e.target.value); autoResize(e.target) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAfter(block.id) }
              if (e.key === 'Backspace' && block.content === '') { e.preventDefault(); remove(block.id) }
            }}
            rows={1}
            placeholder={block.type === 'heading' ? 'Heading…' : 'Type here… (Enter = new block)'}
            className={[
              'flex-1 resize-none bg-transparent outline-none py-1 leading-relaxed w-full',
              block.type === 'heading' ? 'text-xl font-semibold' : 'text-sm',
            ].join(' ')}
          />
        </div>
      ))}
      <button
        onClick={() => {
          const nb = newBlock()
          onChange([...blocks, nb])
          setTimeout(() => areaRefs.current.get(nb.id)?.focus(), 0)
        }}
        className="text-xs text-muted-foreground hover:text-foreground mt-1"
      >
        + Add block
      </button>
    </div>
  )
}

// ── Single doc editor ─────────────────────────────────────────────────────────

function DocEditor({ doc }: { doc: Doc }) {
  const [updateDoc] = useUpdateDocMutation()
  const [title, setTitle] = useState(doc.title)
  const [blocks, setBlocks] = useState<DocBlock[]>(
    doc.blocks.length > 0 ? doc.blocks : [newBlock()]
  )
  const [savedAt, setSavedAt] = useState<string>(doc.updated_at)
  const [dirty, setDirty] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(doc.title)
    setBlocks(doc.blocks.length > 0 ? doc.blocks : [newBlock()])
    setSavedAt(doc.updated_at)
    setDirty(false)
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback((t: string, b: DocBlock[]) => {
    setDirty(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const result = await updateDoc({ id: doc.id, title: t, blocks: b }).unwrap()
        setSavedAt(result.updated_at)
        setDirty(false)
      } catch {
        toast.error('Auto-save failed.')
      }
    }, 1500)
  }, [doc.id, updateDoc])

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4 p-6 overflow-y-auto">
      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); scheduleSave(e.target.value, blocks) }}
        className="w-full text-3xl font-bold bg-transparent outline-none border-b pb-2"
        placeholder="Untitled"
      />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          Created: {fmtTs(doc.created_at)}
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {dirty ? 'Saving…' : `Saved: ${fmtTs(savedAt)}`}
        </span>
      </div>
      <BlockEditor
        blocks={blocks}
        onChange={(b) => { setBlocks(b); scheduleSave(title, b) }}
      />
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  projectId?: string   // when provided, docs are scoped to this project
  height?: string      // css height, default "calc(100vh - 64px)"
}

export default function DocEditorPanel({ projectId, height = 'calc(100vh - 64px)' }: Props) {
  const { data: docs = [], isLoading } = useListDocsQuery(projectId ? { project_id: projectId } : undefined)
  const [createDoc] = useCreateDocMutation()
  const [deleteDoc] = useDeleteDocMutation()
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (docs.length > 0 && !activeId) setActiveId(docs[0].id)
  }, [docs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    try {
      const doc = await createDoc({ title: 'Untitled', project_id: projectId }).unwrap()
      setActiveId(doc.id)
    } catch {
      toast.error('Failed to create document.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(id).unwrap()
      if (activeId === id) setActiveId(docs.find((d) => d.id !== id)?.id ?? null)
      toast.success('Document deleted.')
    } catch {
      toast.error('Failed to delete document.')
    }
  }

  const activeDoc = docs.find((d) => d.id === activeId) ?? null

  return (
    <div className="flex overflow-hidden rounded-lg border" style={{ height }}>
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r flex flex-col bg-muted/20">
        <div className="flex items-center justify-between px-3 py-3 border-b">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docs</span>
          <button onClick={handleCreate} className="text-muted-foreground hover:text-foreground" title="New document">
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground px-3 py-4">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <FileText size={28} className="opacity-20" />
              <p className="text-xs text-muted-foreground">No documents yet.</p>
              <button onClick={handleCreate} className="text-xs text-primary underline">Create one</button>
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setActiveId(doc.id)}
                className={[
                  'group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-transparent hover:bg-muted/50',
                  activeId === doc.id ? 'bg-muted border-l-2 border-l-primary' : '',
                ].join(' ')}
              >
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{doc.title || 'Untitled'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeDoc ? (
          <DocEditor key={activeDoc.id} doc={activeDoc} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <FileText size={52} className="opacity-20" />
            <p className="font-medium">No document selected</p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              <Plus size={14} /> New document
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
