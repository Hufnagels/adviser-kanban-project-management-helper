from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.task import Task
from app.models.time_entry import TimeEntry
from app.models.user import User
from app.schemas.time_entry import TimeEntryOut, TimeReportItem

router = APIRouter(prefix="/time", tags=["time"])


@router.post("/start/{task_id}", response_model=TimeEntryOut, status_code=201)
async def start_timer(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # stop any open timer for this user first
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == current_user.id,
            TimeEntry.end_time.is_(None),
        )
    )
    for open_entry in result.scalars().all():
        open_entry.end_time = datetime.now(timezone.utc)

    entry = TimeEntry(
        task_id=task_id,
        user_id=current_user.id,
        start_time=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return TimeEntryOut.from_orm_with_duration(entry)


@router.post("/stop/{entry_id}", response_model=TimeEntryOut)
async def stop_timer(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = await db.get(TimeEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.end_time:
        raise HTTPException(status_code=400, detail="Timer already stopped")

    entry.end_time = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return TimeEntryOut.from_orm_with_duration(entry)


@router.get("", response_model=list[TimeEntryOut])
async def list_entries(
    task_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(TimeEntry).where(TimeEntry.user_id == current_user.id)
    if task_id:
        q = q.where(TimeEntry.task_id == task_id)
    result = await db.execute(q.order_by(TimeEntry.start_time.desc()))
    return [TimeEntryOut.from_orm_with_duration(e) for e in result.scalars().all()]


@router.get("/report", response_model=list[TimeReportItem])
async def time_report(
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(TimeEntry, Task).join(Task, TimeEntry.task_id == Task.id).where(
        TimeEntry.end_time.isnot(None),
        TimeEntry.user_id == current_user.id,
    )
    if project_id:
        q = q.where(Task.project_id == project_id)

    result = await db.execute(q)
    rows = result.all()

    totals: dict[str, dict] = {}
    for entry, task in rows:
        if task.id not in totals:
            totals[task.id] = {"task_id": task.id, "task_title": task.title, "total_seconds": 0}
        totals[task.id]["total_seconds"] += int((entry.end_time - entry.start_time).total_seconds())

    return list(totals.values())
