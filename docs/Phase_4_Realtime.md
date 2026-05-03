# Plan: Phase 4 — Realtime Collaboration (WebSocket + Redis Pub/Sub)

## Context

Multiple users work on the same projects simultaneously — tasks get moved on the Kanban board, shapes are drawn on the Whiteboard, task statuses change. Without real-time updates, users see stale data and overwrite each other's changes. The goal is to push live change events to all connected clients so the UI stays in sync without polling.

**Infrastructure already in place:**
- `redis==5.0.4` installed in requirements.txt
- `redis:7-alpine` service running in docker-compose
- `REDIS_URL=redis://redis:6379/0` env var configured
- FastAPI has native WebSocket support (`from fastapi import WebSocket`) — no extra package needed

---

## Architecture

```
Browser A                     FastAPI Backend                   Browser B
──────────                    ──────────────────────            ──────────
WS /api/v1/ws ─────────────▶  WebSocketManager                 WS /api/v1/ws
 subscribe("project:abc")     ├─ connections: dict[str, set]     subscribe("project:abc")
                              │
PATCH /tasks/123 ────────────▶ tasks.py PATCH handler
                              │  broadcasts event to Redis
                              │  channel "project:abc"
                              ▼
                         Redis Pub/Sub
                         channel: "project:abc"
                              │
                         Redis subscriber loop
                         (background task on startup)
                              │
                    ┌─────────▼─────────┐
                    │  forward to all   │
                    │  WS clients in    │
                    │  room "project:abc"│
                    └───────────────────┘
                              │             │
                         Browser A    Browser B
                         receives     receives
                         event        event
```

**Rooms / channels:**
| Room key | Used for |
|----------|----------|
| `project:{id}` | Task create/update/delete, Kanban moves |
| `whiteboard:{id}` | Shape changes (collaborative drawing) |
| `contract:{id}` | Contract/file updates |

---

## Files to Create / Modify

### Backend — New
- `backend/app/core/ws_manager.py` — WebSocket connection registry + Redis pub/sub loop
- `backend/app/api/ws.py` — `GET /ws` WebSocket endpoint

### Backend — Modified
- `backend/app/api/tasks.py` — publish event after every PATCH / POST / DELETE
- `backend/app/api/whiteboards.py` — publish event after PATCH (shapes changed)
- `backend/main.py` — start Redis subscriber background task on startup; register ws router

### Frontend — New
- `frontend/src/features/realtime/useRealtime.ts` — hook: connect WS, subscribe to room, dispatch RTK actions on events
- `frontend/src/features/realtime/realtimeSlice.ts` — connection state (connected/disconnected)

### Frontend — Modified
- `frontend/src/pages/KanbanPage.tsx` — call `useRealtime('project:{id}')` → on `task_updated` event invalidate RTK cache tag
- `frontend/src/pages/TasksPage.tsx` — same
- `frontend/src/pages/WhiteboardPage.tsx` — on `whiteboard_shapes_changed` event, merge remote shapes into local state

---

## Step 1 — WebSocket Manager (`ws_manager.py`)

```python
import asyncio, json
import redis.asyncio as aioredis
from fastapi import WebSocket
from app.core.config import settings

class WebSocketManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = {}   # room → set of WS connections
        self._redis: aioredis.Redis | None = None

    async def startup(self):
        self._redis = aioredis.from_url(settings.REDIS_URL)
        asyncio.create_task(self._subscriber_loop())

    async def shutdown(self):
        if self._redis:
            await self._redis.aclose()

    async def connect(self, ws: WebSocket, rooms: list[str]):
        await ws.accept()
        for room in rooms:
            self.rooms.setdefault(room, set()).add(ws)

    async def disconnect(self, ws: WebSocket):
        for members in self.rooms.values():
            members.discard(ws)

    async def publish(self, room: str, event: dict):
        """Called by API endpoints after a change."""
        if self._redis:
            await self._redis.publish(f"ws:{room}", json.dumps(event))

    async def _subscriber_loop(self):
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe("ws:*")          # subscribe to all ws:* channels
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            channel = message["channel"].removeprefix("ws:")
            data = json.loads(message["data"])
            for ws in list(self.rooms.get(channel, [])):
                try:
                    await ws.send_json(data)
                except Exception:
                    await self.disconnect(ws)

ws_manager = WebSocketManager()   # singleton
```

---

## Step 2 — WebSocket Endpoint (`ws.py`)

```python
@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(...),            # JWT passed as query param
    rooms: str = Query(""),             # comma-separated: "project:abc,project:xyz"
):
    user = verify_token(token)          # reuse existing JWT logic from deps.py
    if not user:
        await ws.close(code=1008)
        return
    room_list = [r.strip() for r in rooms.split(",") if r.strip()]
    await ws_manager.connect(ws, room_list)
    try:
        while True:
            await ws.receive_text()     # keep alive; client can send "ping"
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)
```

---

## Step 3 — Publish in API endpoints

**`tasks.py` PATCH** — after `await db.commit()`:
```python
from app.core.ws_manager import ws_manager

if task.project_id:
    await ws_manager.publish(f"project:{task.project_id}", {
        "event": "task_updated",
        "task_id": task.id,
        "data": task_dict(task),      # existing helper
    })
```

Same pattern for POST (task_created) and DELETE (task_deleted).

**`whiteboards.py` PATCH** — after commit, if shapes changed:
```python
await ws_manager.publish(f"whiteboard:{wb_id}", {
    "event": "whiteboard_shapes_changed",
    "whiteboard_id": wb_id,
    "shapes": wb.shapes,
    "updated_by": current_user.email,
})
```

---

## Step 4 — main.py changes

```python
from app.core.ws_manager import ws_manager
from app.api.ws import router as ws_router

# in lifespan startup:
await ws_manager.startup()

# in lifespan shutdown:
await ws_manager.shutdown()

# router registration:
app.include_router(ws_router)   # no prefix — WS must be at root path
```

---

## Step 5 — Frontend hook (`useRealtime.ts`)

```typescript
export function useRealtime(rooms: string[]) {
  const token = useSelector((s: RootState) => s.auth.token)
  const dispatch = useDispatch()

  useEffect(() => {
    if (!token || rooms.length === 0) return
    const roomParam = rooms.join(',')
    const ws = new WebSocket(
      `${WS_BASE_URL}/api/v1/ws?token=${token}&rooms=${roomParam}`
    )

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      dispatch(realtimeEventReceived(msg))   // → realtimeSlice handles routing
    }

    ws.onclose = () => { /* reconnect with backoff */ }

    return () => ws.close()
  }, [token, rooms.join(',')])
}
```

`WS_BASE_URL`: `ws://localhost:8002` in dev, `wss://` in prod.

---

## Step 6 — RTK Cache invalidation (`realtimeSlice.ts`)

```typescript
// realtimeSlice extra reducer listening to realtimeEventReceived:
case 'task_updated':
case 'task_created':
case 'task_deleted':
  // invalidate RTK Query 'Task' tag → all task queries auto-refetch
  dispatch(tasksApi.util.invalidateTags(['Task']))
  break
case 'whiteboard_shapes_changed':
  // Option A: invalidate tag (simplest, causes full refetch)
  dispatch(whiteboardsApi.util.invalidateTags(['Whiteboard']))
  // Option B (future): merge shapes directly into cache without refetch
  break
```

---

## Step 7 — Page integration

**KanbanPage.tsx** — add one line:
```tsx
useRealtime(projects.map(p => `project:${p.id}`))
```

**TasksPage.tsx** — same:
```tsx
useRealtime(projects.map(p => `project:${p.id}`))
```

**WhiteboardPage.tsx** (when in editor view):
```tsx
useRealtime(activeId ? [`whiteboard:${activeId}`] : [])
```

---

## Collaboration UX Notes

- **Kanban:** Another user moves a card → your board updates within ~200ms (WebSocket latency)
- **Whiteboard:** Another user draws → shapes list is invalidated → full board refetches. For true cursor-level collaboration (like Figma), a future "Step 2" would merge shape deltas directly into local Konva state without a refetch.
- **Conflict handling:** Last-write-wins (simple, sufficient for this team size). No OT/CRDT needed.
- **Reconnection:** Frontend hook reconnects with exponential backoff if connection drops.

---

## Verification

1. Backend starts → Redis connection established (no error in logs)
2. Open two browser tabs, both logged in, both on `/kanban` for the same project
3. Move a card in Tab A → card moves in Tab B within ~200ms without refresh
4. Open `/whiteboard` for the same board in two tabs → draw in one → other tab updates
5. Connection survives page navigation (hook unmounts/remounts cleanly)
6. Disconnect Redis → backend logs error, frontend shows reconnect attempts
