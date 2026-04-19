from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.tasks import router as tasks_router
from app.api.projects import router as projects_router
from app.api.time import router as time_router
from app.api.import_export import router as import_export_router
from app.api.customers import router as customers_router
from app.api.colleagues import router as colleagues_router
from app.api.task_files import router as task_files_router
from app.api.contracts import router as contracts_router
from app.api.contract_files import router as contract_files_router
from app.api.files import router as files_router
from app.api.docs import router as docs_router
from app.api.whiteboards import router as whiteboards_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import all models so Base.metadata knows about them
    import app.models.user  # noqa
    import app.models.customer  # noqa
    import app.models.project  # noqa
    import app.models.task  # noqa
    import app.models.time_entry  # noqa
    import app.models.task_file  # noqa
    import app.models.contract  # noqa
    import app.models.contract_file  # noqa
    import app.models.doc  # noqa
    import app.models.whiteboard  # noqa

    # Create tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Incremental column additions (idempotent ALTER TABLE migrations)
        await conn.execute(text(
            "ALTER TABLE docs ADD COLUMN IF NOT EXISTS "
            "project_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL"
        ))
        for _stmt in [
            "ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS description TEXT",
            "ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS preview TEXT",
            "ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id) ON DELETE SET NULL",
            "ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS contract_id VARCHAR REFERENCES contracts(id) ON DELETE SET NULL",
            "ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS project_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL",
        ]:
            await conn.execute(text(_stmt))
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(tasks_router, prefix=settings.API_PREFIX)
app.include_router(projects_router, prefix=settings.API_PREFIX)
app.include_router(time_router, prefix=settings.API_PREFIX)
app.include_router(import_export_router, prefix=settings.API_PREFIX)
app.include_router(customers_router, prefix=settings.API_PREFIX)
app.include_router(colleagues_router, prefix=settings.API_PREFIX)
app.include_router(task_files_router, prefix=settings.API_PREFIX)
app.include_router(contracts_router, prefix=settings.API_PREFIX)
app.include_router(contract_files_router, prefix=settings.API_PREFIX)
app.include_router(files_router, prefix=settings.API_PREFIX)
app.include_router(docs_router, prefix=settings.API_PREFIX)
app.include_router(whiteboards_router, prefix=settings.API_PREFIX)
