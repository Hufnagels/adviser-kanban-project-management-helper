# Plan: File Handling — Description, Organizer Tab & Central Files Page

## Context
Files can already be attached to tasks (via TaskDrawer) and contracts (via DocumentsSection). Three gaps need filling:
1. No description on uploaded files — user wants to annotate each file after upload
2. No organizer/catalog view — user wants preview + description in a dedicated tab on ContractDetailPage
3. No central files page — user wants a single app-wide page listing all files (task + contract) with preview

User confirmed: description editable **after** upload (inline in file list), preview for **all file types** (images inline, PDFs embedded iframe, Office/others icon only), central page covers **all files** (contracts + tasks).

---

## Part 1 — Backend

### 1a. Add `description` column to both file models

**`backend/app/models/task_file.py`**
```python
description: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

**`backend/app/models/contract_file.py`**
```python
description: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

### 1b. Update API list responses to include `description`

**`backend/app/api/task_files.py`** — add `"description": f.description` to all response dicts.

**`backend/app/api/contract_files.py`** — same.

### 1c. Add PATCH endpoints for description update

**`backend/app/api/task_files.py`**
```python
@router.patch("/{file_id}")
async def update_file(task_id, file_id, body: dict, db, current_user):
    # Accept {"description": "..."}; update and return record
```

**`backend/app/api/contract_files.py`** — identical pattern.

### 1d. New central files endpoint

**`backend/app/api/files.py`** (new file)
- `GET /files` — query both `task_files` and `contract_files` tables
- Join to get parent entity name (task title / contract name)
- Returns unified list: `id, name, size, content_type, description, created_at, source_type ("task"|"contract"), source_id, source_name`
- Supports optional query params: `?source_type=task|contract`, `?search=...`
- Register in `main.py`

---

## Part 2 — Frontend

### 2a. Shared file utilities

**`frontend/src/utils/fileUtils.ts`** (new)
- `fmtSize(bytes)` — B/KB/MB formatter (currently duplicated in 3 places)
- `fileIcon(contentType)` — returns lucide icon component based on MIME
- `isPreviewable(contentType)` — returns `"image" | "pdf" | "none"`
- `fetchBlobUrl(url, token)` — auth-fetch → objectURL (currently duplicated)

### 2b. Shared FilePreviewModal component

**`frontend/src/components/files/FilePreviewModal.tsx`** (new)
- Props: `{ url: string; name: string; contentType: string; onClose: () => void }`
- Images: `<img src={blobUrl} />` inside a centered modal
- PDFs: `<iframe src={blobUrl} />` full height
- Others: icon + name + "Download" button (no native preview possible)
- Fetches blob URL with auth token on mount, revokes on unmount

### 2c. Update task file RTK Query — add description + PATCH

**`frontend/src/features/kanban/taskApi.ts`**
- Add `description?: string` to `TaskFile` interface
- Add `updateTaskFileDescription` mutation: `PATCH /tasks/{taskId}/files/{fileId}` with `{ description }`

### 2d. Update contract file RTK Query — add description + PATCH

**`frontend/src/features/contracts/contractFileApi.ts`**
- Add `description?: string` to `ContractFileRecord`
- Add `updateContractFileDescription` mutation: `PATCH /contracts/{contractId}/files/{fileId}` with `{ description }`

### 2e. Shared `FileListItem` component

**`frontend/src/components/files/FileListItem.tsx`** (new)
- Props: `{ file, onDownload, onDelete, onPreview, onDescriptionSave }`
- Row: icon | name | size | description (inline editable — click pencil → input → save/cancel) | preview button | download button | delete button
- Inline edit: `useState` for edit mode, `onDescriptionSave(id, text)` callback on save
- Used by both `DocumentsSection` (contracts), `FilesTab` (tasks), and central files page

### 2f. Update `DocumentsSection` in `ContractDetailPage`

- Replace hand-rolled file row with `<FileListItem>`
- Wire `onDescriptionSave` → `updateContractFileDescription` mutation

### 2g. Update `FilesTab` in `TaskDrawer`

- Replace hand-rolled file row with `<FileListItem>`
- Wire `onDescriptionSave` → `updateTaskFileDescription` mutation

### 2h. Add "Documents" organizer tab to `ContractDetailPage`

- Add new tab `'documents'` to `TABS` array with label `"Documents"`
- `DocumentsTab` component: uses `useListContractFilesQuery`, renders `FileListItem` grid + `FilePreviewModal` on click
- Move `DocumentsSection` drop zone + list from DetailsTab → DocumentsTab entirely
- Remove `DocumentsSection` from DetailsTab (it becomes its own full tab)

### 2i. Central Files page

**`frontend/src/pages/FilesPage.tsx`** (new)
- RTK Query endpoint `useGetAllFilesQuery` in new `frontend/src/features/files/filesApi.ts`
- Page layout: filter bar (All / Contracts / Tasks, search input) + file grid
- Each file: `FileListItem` card with source badge ("Contract: XYZ" or "Task: ABC")
- `FilePreviewModal` on preview click

### 2j. Register route

**`frontend/src/routes.tsx`**
- Add `FilesPage` import and route `<Route path="/files" element={<FilesPage />} />`
- Add to `navRoutes` under Content group: `{ path: '/files', label: 'Files', icon: Paperclip }`

---

## Files to create
- `backend/app/api/files.py`
- `frontend/src/utils/fileUtils.ts`
- `frontend/src/components/files/FilePreviewModal.tsx`
- `frontend/src/components/files/FileListItem.tsx`
- `frontend/src/features/files/filesApi.ts`
- `frontend/src/pages/FilesPage.tsx`

## Files to modify
- `backend/app/models/task_file.py` — add `description`
- `backend/app/models/contract_file.py` — add `description`
- `backend/app/api/task_files.py` — include `description` in responses, add PATCH
- `backend/app/api/contract_files.py` — include `description` in responses, add PATCH
- `backend/main.py` — register new `/files` router
- `frontend/src/features/kanban/taskApi.ts` — add description field + PATCH mutation
- `frontend/src/features/contracts/contractFileApi.ts` — add description field + PATCH mutation
- `frontend/src/pages/ContractDetailPage.tsx` — add Documents tab, use FileListItem
- `frontend/src/components/task/TaskDrawer.tsx` — use FileListItem
- `frontend/src/routes.tsx` — add FilesPage route + nav entry

---

## Verification
1. Upload a file to a contract → file appears in list → click pencil → type description → save → description shown
2. Upload a file to a task (via TaskDrawer) → same inline-edit description flow
3. Contract detail → "Documents" tab → files listed with preview button → click → modal opens (image/PDF/icon)
4. Navigate to `/files` → all files from all contracts and tasks appear → filter by type works → search works → preview opens
