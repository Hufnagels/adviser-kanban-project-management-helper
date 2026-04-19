import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, FileText, Clock, Search, X, List, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import {
  useListDocsQuery,
  useCreateDocMutation,
  useUpdateDocMutation,
  useDeleteDocMutation,
  type Doc,
  type DocBlock,
} from '@/features/docs/docsApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _bid = 1
function newBlock(type: DocBlock['type'] = 'text'): DocBlock {
  return { id: `b${_bid++}`, type, content: '' }
}

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function docSnippet(doc: Doc): string {
  for (const b of doc.blocks) {
    if (b.content.trim()) return b.content.trim().slice(0, 120)
  }
  return 'No content'
}

// ── Block editor (reused inside the modal) ────────────────────────────────────

function BlockEditor({ blocks, onChange }: { blocks: DocBlock[]; onChange: (b: DocBlock[]) => void }) {
  const areaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())

  function update(id: string, content: string) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, content } : b)))
  }
  function addAfter(id: string) {
    const idx = blocks.findIndex((b) => b.id === id)
    const nb = newBlock()
    const next = [...blocks]; next.splice(idx + 1, 0, nb); onChange(next)
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
    onChange(blocks.map((b) => b.id === id ? { ...b, type: b.type === 'heading' ? 'text' : 'heading' } : b))
  }
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="space-y-1">
      {blocks.map((block) => (
        <div key={block.id} className="group flex items-start gap-2">
          <button
            onClick={() => toggleType(block.id)}
            className="mt-1.5 shrink-0 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground border rounded px-1 py-0.5 hover:bg-muted transition-opacity"
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
            placeholder={block.type === 'heading' ? 'Heading…' : 'Type here…'}
            className={[
              'flex-1 resize-none bg-transparent outline-none py-1 leading-relaxed w-full',
              block.type === 'heading' ? 'text-xl font-semibold' : 'text-sm',
            ].join(' ')}
          />
        </div>
      ))}
      <button
        onClick={() => {
          const nb = newBlock(); onChange([...blocks, nb])
          setTimeout(() => areaRefs.current.get(nb.id)?.focus(), 0)
        }}
        className="text-xs text-muted-foreground hover:text-foreground mt-1"
      >
        + Add block
      </button>
    </div>
  )
}

// ── Doc editor modal ──────────────────────────────────────────────────────────

function DocEditorModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [updateDoc] = useUpdateDocMutation()
  const [title, setTitle] = useState(doc.title)
  const [blocks, setBlocks] = useState<DocBlock[]>(doc.blocks.length > 0 ? doc.blocks : [newBlock()])
  const [savedAt, setSavedAt] = useState(doc.updated_at)
  const [dirty, setDirty] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(doc.title); setBlocks(doc.blocks.length > 0 ? doc.blocks : [newBlock()])
    setSavedAt(doc.updated_at); setDirty(false)
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback((t: string, b: DocBlock[]) => {
    setDirty(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const result = await updateDoc({ id: doc.id, title: t, blocks: b }).unwrap()
        setSavedAt(result.updated_at); setDirty(false)
      } catch { toast.error('Auto-save failed.') }
    }, 1500)
  }, [doc.id, updateDoc])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '90vw', maxWidth: 860, height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
            <span className="flex items-center gap-1 shrink-0">
              <Clock size={11} /> Created: {fmtTs(doc.created_at)}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock size={11} /> {dirty ? 'Saving…' : `Saved: ${fmtTs(savedAt)}`}
            </span>
            {doc.project_id && (
              <>
                <span>·</span>
                <DocBreadcrumb doc={doc} />
              </>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 ml-4">
            <X size={18} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleSave(e.target.value, blocks) }}
            className="w-full text-3xl font-bold bg-transparent outline-none border-b pb-2"
            placeholder="Untitled"
          />
          <BlockEditor
            blocks={blocks}
            onChange={(b) => { setBlocks(b); scheduleSave(title, b) }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Breadcrumb helper ─────────────────────────────────────────────────────────

function DocBreadcrumb({ doc }: { doc: Doc }) {
  const parts = [doc.customer_name, doc.contract_name, doc.project_name].filter(Boolean)
  if (!parts.length) return null
  return (
    <span className="text-xs text-muted-foreground truncate">
      {parts.join(' › ')}
    </span>
  )
}

// ── List item ─────────────────────────────────────────────────────────────────

function DocListItem({ doc, onOpen, onDelete }: { doc: Doc; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:shadow-sm transition-shadow cursor-pointer group"
      onClick={onOpen}
    >
      <FileText size={18} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{doc.title || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          <DocBreadcrumb doc={doc} />
          {!doc.project_id && (
            <span className="text-xs text-muted-foreground truncate">{docSnippet(doc)}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right hidden sm:block">
        <p className="text-xs text-muted-foreground">{fmtDate(doc.updated_at)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Card item ─────────────────────────────────────────────────────────────────

function DocCardItem({ doc, onOpen, onDelete }: { doc: Doc; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      className="rounded-xl border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow cursor-pointer group relative"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <FileText size={18} className="text-muted-foreground shrink-0 mt-0.5" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <p className="font-semibold text-sm truncate">{doc.title || 'Untitled'}</p>
      <DocBreadcrumb doc={doc} />
      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{docSnippet(doc)}</p>
      <div className="mt-auto pt-1">
        <span className="text-xs text-muted-foreground">{fmtDate(doc.updated_at)}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const { data: docs = [], isLoading } = useListDocsQuery()
  const [createDoc] = useCreateDocMutation()
  const [deleteDoc] = useDeleteDocMutation()
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card')

  // Keep active doc in sync with fresh data from cache
  const liveActive = activeDoc ? (docs.find((d) => d.id === activeDoc.id) ?? activeDoc) : null

  const filtered = docs.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.title.toLowerCase().includes(q) ||
      d.blocks.some((b) => b.content.toLowerCase().includes(q))
    )
  })

  async function handleCreate() {
    try {
      const doc = await createDoc({ title: 'Untitled' }).unwrap()
      setActiveDoc(doc)
    } catch {
      toast.error('Failed to create document.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoc(id).unwrap()
      if (activeDoc?.id === id) setActiveDoc(null)
      toast.success('Document deleted.')
    } catch {
      toast.error('Failed to delete document.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Docs</h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <Plus size={14} /> New doc
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput) }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, content…"
              className="pl-7 pr-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary w-52"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-sm border rounded hover:bg-muted">Search</button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput('') }}
              className="px-3 py-1.5 text-sm border rounded hover:bg-muted text-muted-foreground"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-muted-foreground">{filtered.length} doc{filtered.length !== 1 ? 's' : ''}</span>
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Card view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* List / cards */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
          <FileText size={52} className="opacity-20" />
          <p className="font-medium text-base">{search ? 'No results' : 'No documents yet'}</p>
          {!search && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              <Plus size={14} /> New document
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {filtered.map((doc) => (
            <DocListItem
              key={doc.id}
              doc={doc}
              onOpen={() => setActiveDoc(doc)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((doc) => (
            <DocCardItem
              key={doc.id}
              doc={doc}
              onOpen={() => setActiveDoc(doc)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {liveActive && (
        <DocEditorModal doc={liveActive} onClose={() => setActiveDoc(null)} />
      )}
    </div>
  )
}
