# Plan: Phase 4 — SAP B1 Integration

## Context

The platform manages Customer → Contract → Project → Task hierarchy. SAP B1 is the customer's ERP that holds the authoritative source for Business Partners, Sales Orders and Projects. The goal is to pull data from SAP B1 into the platform on demand, and provide a dedicated admin UI for triggering syncs and monitoring results.

The existing `sap-b1-adapter-service` (BRD/MicroServices) already proves the approach: connect to SAP B1 **Service Layer** (OData REST on port 50001), execute named SQL queries via the `SQLQueries` API, follow `@odata.nextLink` pagination. We adapt that logic directly into this FastAPI backend using `httpx` (already in requirements).

---

## SAP B1 Project Management Tables

Relevant tables and key fields:

| SAP Table | Purpose | Key Fields |
|-----------|---------|------------|
| `OCRD` | Business Partners | `CardCode`, `CardName`, `CardType`, `LicTradNum` (Tax), `Phone1`, `E_Mail`, `City`, `Country` |
| `OPRJ` | Projects | `PrjCode`, `PrjName`, `Status`, `ValidFrom`, `ValidTo`, `BPCode` |
| `PRJ1` | Project Stages | `PrjCode`, `LineNum`, `StgCode`, `StgName`, `StartDate`, `EndDate`, `Status` |
| `PRJ2` | Stage Activities/Tasks | `PrjCode`, `StageAbs`, `LineNum`, `ActivityType`, `Descrip`, `Status`, `DueDate` |
| `OINV` | AR Invoices | `DocNum`, `DocDate`, `CardCode`, `DocTotal`, `DocCur` |
| `OPOR` | Purchase Orders | `DocNum`, `DocDate`, `CardCode`, `DocTotal` |

**SQL query to get EN + HU field descriptions from SAP B1 metadata:**
```sql
SELECT
    F.TableID        AS table_code,
    F.AliasID        AS field_name,
    F.Descr          AS field_desc_en,
    U.Descr          AS field_desc_hu,
    F.Type           AS field_type,
    F.EditSize        AS field_size
FROM CUFD F
LEFT JOIN CUFD U
    ON  U.TableID = F.TableID
    AND U.AliasID = F.AliasID
    AND U.Language = 'H'
WHERE F.Language = 'E'
  AND F.TableID IN ('OPRJ','PRJ1','PRJ2','OPOR','OINV','OCRD','OSLP','OUSR')
ORDER BY F.TableID, F.AliasID;
```

---

## Files to Create / Modify

### Backend — New
- `backend/app/models/sap_sync.py` — `SapSyncLog` table
- `backend/app/api/sap.py` — SAP endpoints
- `backend/app/core/sap_client.py` — Service Layer async HTTP client

### Backend — Modified
- `backend/app/core/config.py` — add SAP env vars
- `backend/main.py` — register router + `CREATE TABLE IF NOT EXISTS sap_sync_logs` + `ALTER TABLE projects ADD COLUMN IF NOT EXISTS sap_prj_code`

### Frontend — New
- `frontend/src/features/sap/sapApi.ts` — RTK Query endpoints
- `frontend/src/pages/SapPage.tsx` — admin page

### Frontend — Modified
- `frontend/src/routes.tsx` — `/sap` route behind `RequireSuperAdmin`
- `frontend/src/components/AppSidebar.tsx` — SAP item in user dropdown (superadmin only)

---

## Step 1 — Config (`config.py`)

Add to `Settings`:
```python
SAP_ENABLED: bool = False
SAP_SERVICE_LAYER_URL: str = ""   # https://host:50001/b1s/v1
SAP_COMPANY_DB: str = ""
SAP_USERNAME: str = ""
SAP_PASSWORD: str = ""
SAP_VERIFY_SSL: bool = False
```
Mapped from existing `.env` keys: `SAP_B1_SERVICE_LAYER_URL`, `SAP_B1_COMPANY_DB`, `SAP_B1_USERNAME`, `SAP_B1_PASSWORD`.

---

## Step 2 — SAP Client (`sap_client.py`)

Async client using `httpx.AsyncClient` (already in requirements.txt):

```python
PREDEFINED_QUERIES = {
    "bp_customers": {
        "sql_code": "kp_bp_cust",
        "description": "Business Partners (Customers)",
        "sql_text": "SELECT CardCode,CardName,LicTradNum,Phone1,E_Mail,City,Country FROM OCRD WHERE CardType='C'"
    },
    "projects": {
        "sql_code": "kp_projects",
        "description": "SAP Projects",
        "sql_text": "SELECT PrjCode,PrjName,Status,ValidFrom,ValidTo,BPCode FROM OPRJ"
    },
    "project_tasks": {
        "sql_code": "kp_prj_tasks",
        "description": "Project Stage Activities",
        "sql_text": "SELECT A.PrjCode,S.StgName,A.Descrip,A.Status,A.DueDate FROM PRJ2 A JOIN PRJ1 S ON S.PrjCode=A.PrjCode AND S.StageAbs=A.StageAbs"
    },
    "table_fields": {
        "sql_code": "kp_tbl_fields",
        "description": "Table field descriptions (EN+HU)",
        "sql_text": "SELECT F.TableID,F.AliasID,F.Descr AS en,U.Descr AS hu,F.Type,F.EditSize FROM CUFD F LEFT JOIN CUFD U ON U.TableID=F.TableID AND U.AliasID=F.AliasID AND U.Language='H' WHERE F.Language='E' AND F.TableID IN ('OPRJ','PRJ1','PRJ2','OPOR','OINV','OCRD') ORDER BY F.TableID,F.AliasID"
    },
}

async def sap_fetch(query_name: str) -> list[dict]:
    # 1. POST /Login
    # 2. GET /SQLQueries('{sql_code}') → 404 → POST /SQLQueries to create
    # 3. POST /SQLQueries('{sql_code}')/List
    # 4. Follow @odata.nextLink pages
    # 5. POST /Logout (finally)
    # Returns list[dict] rows
```

---

## Step 3 — SapSyncLog model (`sap_sync.py`)

```python
class SapSyncLog(Base):
    __tablename__ = "sap_sync_logs"
    id: str (PK, UUID)
    query_name: str           # "bp_customers", "projects", …
    status: str               # "running" | "success" | "failed"
    started_at: datetime
    finished_at: datetime | None
    rows_fetched: int | None
    rows_upserted: int | None
    error: str | None
    triggered_by: str | None  # user email
```

---

## Step 4 — SAP API endpoints (`sap.py`)

All routes: `require_roles("superadmin")`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sap/status` | `{ enabled, url, company_db }` — no secrets |
| GET | `/sap/queries` | List predefined queries |
| POST | `/sap/preview/{query_name}` | Fetch rows from SAP, return as JSON (no DB write) |
| POST | `/sap/sync/{query_name}` | Fetch + upsert into platform DB, log result |
| GET | `/sap/logs` | Last 50 sync log entries |

**`sync/bp_customers` upsert logic:**
```python
# For each SAP row, upsert into customers table:
INSERT INTO customers (id, name, sap_bp_code, tax_number, phone, email, address_city, address_country)
VALUES (...)
ON CONFLICT (sap_bp_code) DO UPDATE SET
    name = EXCLUDED.name,
    tax_number = EXCLUDED.tax_number,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address_city = EXCLUDED.address_city,
    address_country = EXCLUDED.address_country
```
Requires unique index on `customers.sap_bp_code` (add via migration).

**`sync/projects` upsert logic:**
- Match SAP `BPCode` → find `customer_id` in platform
- Upsert into `projects` on `sap_prj_code`

---

## Step 5 — Migrations (`main.py`)

Add to startup:
```python
"CREATE TABLE IF NOT EXISTS sap_sync_logs (id VARCHAR PRIMARY KEY, query_name VARCHAR NOT NULL, status VARCHAR NOT NULL, started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ, rows_fetched INT, rows_upserted INT, error TEXT, triggered_by VARCHAR)",
"ALTER TABLE projects ADD COLUMN IF NOT EXISTS sap_prj_code VARCHAR(50)",
"CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_sap_bp_code ON customers(sap_bp_code) WHERE sap_bp_code IS NOT NULL",
```

---

## Step 6 — Frontend API (`sapApi.ts`)

```typescript
interface SapStatus  { enabled: boolean; url: string; company_db: string }
interface SapQuery   { name: string; description: string }
interface SapLog     { id: string; query_name: string; status: string; started_at: string; finished_at: string | null; rows_fetched: number | null; rows_upserted: number | null; error: string | null }

getSapStatus      → GET  /sap/status        (no tag)
listSapQueries    → GET  /sap/queries       (no tag)
previewSapQuery   → POST /sap/preview/{name}  (mutation, returns list[dict])
triggerSapSync    → POST /sap/sync/{name}     (mutation, invalidates 'SapLog')
listSapLogs       → GET  /sap/logs          (providesTags: ['SapLog'])
```

---

## Step 7 — SAP Page (`SapPage.tsx`)

**Layout:** Page header + two panels side by side (lg:flex-row).

**Left — Queries panel:**
- Connection status banner: green "Connected" / red "Disabled" from `getSapStatus`
- For each query in `listSapQueries`:
  - Name + description
  - "Preview" button → modal with raw data table (first 100 rows)
  - "Sync" button → calls `triggerSapSync`, shows loading spinner, toast result

**Right — History panel:**
- Table: Query | Status badge | Started | Duration | Rows fetched / upserted | Error
- Poll every 30s (`pollingInterval: 30000` in RTK Query)

**Route guard:** `RequireSuperAdmin` (same pattern as `/colleagues`)

---

## Step 8 — Route + Sidebar

`routes.tsx`:
```tsx
import SapPage from '@/pages/SapPage'
<Route path="/sap" element={<RequireSuperAdmin><SapPage /></RequireSuperAdmin>} />
```

`AppSidebar.tsx` — inside superadmin dropdown block, below Colleagues:
```tsx
import { Database } from 'lucide-react'
<DropdownMenuItem className="gap-2" onClick={() => navigate('/sap')}>
  <Database size={14} />
  <span>SAP B1</span>
</DropdownMenuItem>
```

---

## How SAP B1 and the Platform Work Together

```
SAP B1 (ERP)                     Kanban Platform
─────────────────                 ──────────────────────────────
OCRD (Business Partners)  ──→  customers table  (match on sap_bp_code)
OPRJ (Projects)           ──→  projects table   (match on sap_prj_code)
PRJ2 (Activities/Tasks)   ──→  tasks table      (future: match on external_id)
OINV / OPOR (Financials)  ──→  displayed in preview only (no upsert yet)

Flow:
1. Admin opens /sap page
2. Clicks "Sync" on "bp_customers"
3. Platform logs in to SAP B1 Service Layer (HTTPS :50001)
4. Executes SQLQuery "kp_bp_cust" → gets all Customer Business Partners
5. Upserts rows into customers table (keyed on sap_bp_code)
6. Logs result → visible in history panel
7. New/updated customers now appear in /customers list
```

---

## Verification

1. Add to `.env`: `SAP_ENABLED=true`, `SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD`
2. Restart backend → `GET /api/v1/sap/status` returns `{ enabled: true, ... }` (no error)
3. `POST /api/v1/sap/preview/bp_customers` returns rows (requires SAP reachable)
4. `POST /api/v1/sap/sync/bp_customers` → customers upserted, log entry created
5. `/sap` page accessible to superadmin, hidden from other roles
6. Preview modal shows raw SAP rows
7. History panel updates after each sync
