import re
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.project import Project
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.schemas.project import ProjectCreate, ProjectDuplicate, ProjectOut, ProjectUpdate, ProjectWithTasks

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Project)
    if customer_id:
        q = q.where(Project.customer_id == customer_id)
    result = await db.execute(q.order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(**payload.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectWithTasks)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Use exclude_none=False so that explicit null values (e.g. contract_id=null) are applied
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/duplicate", response_model=ProjectOut, status_code=201)
async def duplicate_project(
    project_id: str,
    payload: ProjectDuplicate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await db.get(Project, project_id)
    if not source:
        raise HTTPException(status_code=404, detail="Project not found")

    new_project = Project(
        name=source.name,
        description=source.description,
        customer_id=payload.target_customer_id,
        contract_id=payload.target_contract_id,
        owner_id=current_user.id,
    )
    db.add(new_project)
    await db.flush()

    # Pre-fetch existing task IDs for this year to build the sequence
    yy = str(date.today().year)[2:]
    prefix = f"T-{yy}-"
    eid_result = await db.execute(select(Task.external_id).where(Task.external_id.like(f"{prefix}%")))
    existing_eids = eid_result.scalars().all()
    counter = max(
        (int(m.group(1)) for eid in existing_eids if eid and (m := re.match(rf"T-{yy}-(\d+)$", eid))),
        default=0,
    )

    for task in source.tasks:
        counter += 1
        db.add(Task(
            title=task.title,
            task_type=task.task_type,
            description=task.description,
            status=TaskStatus.todo,
            priority=task.priority,
            listing_date=None,
            due_date=None,
            finishing_date=None,
            approval=False,
            notes=task.notes,
            project_id=new_project.id,
            created_by=current_user.id,
            external_id=f"{prefix}{counter:03d}",
        ))

    await db.commit()
    await db.refresh(new_project)
    return new_project


@router.get("/{project_id}/timeline", response_model=ProjectWithTasks)
async def project_timeline(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Returns project with tasks sorted by listing_date for Gantt."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.tasks.sort(key=lambda t: (t.listing_date or t.created_at.date()))
    return project
