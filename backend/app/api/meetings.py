import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.meeting import Meeting, MeetingFile, MeetingTopic, TopicFile
from app.models.user import User

UPLOADS_DIR = "/app/uploads/meetings"

router = APIRouter(prefix="/meetings", tags=["meetings"])


# ── Serializers ───────────────────────────────────────────────────────────────

def _file_dict(f: MeetingFile | TopicFile) -> dict:
    return {
        "id": f.id,
        "name": f.original_name,
        "size": f.size,
        "content_type": f.content_type,
        "description": f.description,
        "created_at": f.created_at.isoformat(),
    }


def _topic_dict(t: MeetingTopic) -> dict:
    return {
        "id": t.id,
        "meeting_id": t.meeting_id,
        "sort_order": t.sort_order,
        "name": t.name,
        "description": t.description,
        "planned_minutes": t.planned_minutes,
        "actual_seconds": t.actual_seconds,
        "decision": t.decision,
        "status": t.status,
        "files": [_file_dict(f) for f in t.files],
    }


def _meeting_dict(m: Meeting, full: bool = False) -> dict:
    d: dict = {
        "id": m.id,
        "title": m.title,
        "date": m.date.isoformat() if m.date else None,
        "location": m.location,
        "description": m.description,
        "status": m.status,
        "sort_order": m.sort_order,
        "customer_id": m.customer_id,
        "contract_id": m.contract_id,
        "project_id": m.project_id,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
        "topic_count": len(m.topics),
        "total_planned_minutes": sum(t.planned_minutes or 0 for t in m.topics),
    }
    if full:
        d["topics"] = [_topic_dict(t) for t in m.topics]
        d["files"] = [_file_dict(f) for f in m.files]
    return d


# ── Meeting CRUD ──────────────────────────────────────────────────────────────

@router.get("")
async def list_meetings(
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    contract_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Meeting).order_by(Meeting.sort_order.asc(), Meeting.date.asc().nullslast(), Meeting.created_at.asc())
    if status:
        q = q.where(Meeting.status == status)
    if customer_id:
        q = q.where(Meeting.customer_id == customer_id)
    if contract_id:
        q = q.where(Meeting.contract_id == contract_id)
    result = await db.execute(q)
    return [_meeting_dict(m) for m in result.scalars().all()]


@router.post("", status_code=201)
async def create_meeting(
    title: str = Body(...),
    date: Optional[str] = Body(None),
    location: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    customer_id: Optional[str] = Body(None),
    contract_id: Optional[str] = Body(None),
    project_id: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as _date
    parsed_date = _date.fromisoformat(date) if date else None
    m = Meeting(
        title=title,
        date=parsed_date,
        location=location,
        description=description,
        customer_id=customer_id,
        contract_id=contract_id,
        project_id=project_id,
        created_by=current_user.id,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return _meeting_dict(m, full=True)


@router.post("/reorder", status_code=200)
async def reorder_meetings(
    ids: list[str] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    for i, meeting_id in enumerate(ids):
        m = await db.get(Meeting, meeting_id)
        if m:
            m.sort_order = i
    await db.commit()
    return {"ok": True}


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return _meeting_dict(m, full=True)


@router.patch("/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    title: Optional[str] = Body(None),
    date: Optional[str] = Body(None),
    location: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    status: Optional[str] = Body(None),
    customer_id: Optional[str] = Body(None),
    contract_id: Optional[str] = Body(None),
    project_id: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from datetime import date as _date
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if title is not None:
        m.title = title
    if date is not None:
        m.date = _date.fromisoformat(date) if date else None
    if location is not None:
        m.location = location
    if description is not None:
        m.description = description
    if status is not None:
        m.status = status
    if customer_id is not None:
        m.customer_id = customer_id
    if contract_id is not None:
        m.contract_id = contract_id
    if project_id is not None:
        m.project_id = project_id
    m.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(m)
    return _meeting_dict(m, full=True)


@router.post("/{meeting_id}/duplicate", status_code=201)
async def duplicate_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    src = await db.get(Meeting, meeting_id)
    if not src:
        raise HTTPException(status_code=404, detail="Meeting not found")
    new_m = Meeting(
        title=f"{src.title} (copy)",
        date=src.date,
        location=src.location,
        description=src.description,
        status="draft",
        customer_id=src.customer_id,
        contract_id=src.contract_id,
        project_id=src.project_id,
        created_by=current_user.id,
        sort_order=src.sort_order + 1,
    )
    db.add(new_m)
    await db.flush()
    for t in src.topics:
        db.add(MeetingTopic(
            meeting_id=new_m.id,
            sort_order=t.sort_order,
            name=t.name,
            description=t.description,
            planned_minutes=t.planned_minutes,
            actual_seconds=0,
            decision=None,
            status="pending",
        ))
    await db.commit()
    await db.refresh(new_m)
    return _meeting_dict(new_m, full=True)


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    # Remove uploaded files from disk
    folder = os.path.join(UPLOADS_DIR, meeting_id)
    if os.path.exists(folder):
        shutil.rmtree(folder, ignore_errors=True)
    await db.delete(m)
    await db.commit()


# ── Topics ────────────────────────────────────────────────────────────────────

@router.post("/{meeting_id}/topics", status_code=201)
async def add_topic(
    meeting_id: str,
    name: str = Body(...),
    description: Optional[str] = Body(None),
    planned_minutes: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    # sort_order = count of existing topics
    existing = await db.execute(select(MeetingTopic).where(MeetingTopic.meeting_id == meeting_id))
    sort_order = len(existing.scalars().all())
    t = MeetingTopic(
        meeting_id=meeting_id,
        name=name,
        description=description,
        planned_minutes=planned_minutes,
        sort_order=sort_order,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _topic_dict(t)


@router.patch("/{meeting_id}/topics/{topic_id}")
async def update_topic(
    meeting_id: str,
    topic_id: str,
    name: Optional[str] = Body(None),
    description: Optional[str] = Body(None),
    planned_minutes: Optional[int] = Body(None),
    actual_seconds: Optional[int] = Body(None),
    decision: Optional[str] = Body(None),
    status: Optional[str] = Body(None),
    sort_order: Optional[int] = Body(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = await db.get(MeetingTopic, topic_id)
    if not t or t.meeting_id != meeting_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    if name is not None:
        t.name = name
    if description is not None:
        t.description = description
    if planned_minutes is not None:
        t.planned_minutes = planned_minutes
    if actual_seconds is not None:
        t.actual_seconds = actual_seconds
    if decision is not None:
        t.decision = decision
    if status is not None:
        t.status = status
    if sort_order is not None:
        t.sort_order = sort_order
    await db.commit()
    await db.refresh(t)
    return _topic_dict(t)


@router.post("/{meeting_id}/topics/reorder", status_code=200)
async def reorder_topics(
    meeting_id: str,
    ids: list[str] = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    for i, topic_id in enumerate(ids):
        t = await db.get(MeetingTopic, topic_id)
        if t and t.meeting_id == meeting_id:
            t.sort_order = i
    await db.commit()
    return {"ok": True}


@router.delete("/{meeting_id}/topics/{topic_id}", status_code=204)
async def delete_topic(
    meeting_id: str,
    topic_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = await db.get(MeetingTopic, topic_id)
    if not t or t.meeting_id != meeting_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    # Remove topic files from disk
    folder = os.path.join(UPLOADS_DIR, meeting_id, "topics", topic_id)
    if os.path.exists(folder):
        shutil.rmtree(folder, ignore_errors=True)
    await db.delete(t)
    await db.commit()


# ── Meeting-level files ───────────────────────────────────────────────────────

@router.post("/{meeting_id}/files", status_code=201)
async def upload_meeting_file(
    meeting_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = await db.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    dest_dir = os.path.join(UPLOADS_DIR, meeting_id, "files")
    os.makedirs(dest_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1]
    stored = f"{file_id}{ext}"
    dest_path = os.path.join(dest_dir, stored)
    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)
    mf = MeetingFile(
        meeting_id=meeting_id,
        filename=stored,
        original_name=file.filename or stored,
        content_type=file.content_type,
        size=os.path.getsize(dest_path),
        created_by=current_user.id,
    )
    db.add(mf)
    await db.commit()
    await db.refresh(mf)
    return _file_dict(mf)


@router.get("/{meeting_id}/files/{file_id}/download")
async def download_meeting_file(
    meeting_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    mf = await db.get(MeetingFile, file_id)
    if not mf or mf.meeting_id != meeting_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, meeting_id, "files", mf.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path, filename=mf.original_name, media_type=mf.content_type or "application/octet-stream")


@router.delete("/{meeting_id}/files/{file_id}", status_code=204)
async def delete_meeting_file(
    meeting_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    mf = await db.get(MeetingFile, file_id)
    if not mf or mf.meeting_id != meeting_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, meeting_id, "files", mf.filename)
    if os.path.exists(path):
        os.remove(path)
    await db.delete(mf)
    await db.commit()


# ── Topic-level files ─────────────────────────────────────────────────────────

@router.post("/{meeting_id}/topics/{topic_id}/files", status_code=201)
async def upload_topic_file(
    meeting_id: str,
    topic_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = await db.get(MeetingTopic, topic_id)
    if not t or t.meeting_id != meeting_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    dest_dir = os.path.join(UPLOADS_DIR, meeting_id, "topics", topic_id)
    os.makedirs(dest_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1]
    stored = f"{file_id}{ext}"
    dest_path = os.path.join(dest_dir, stored)
    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)
    tf = TopicFile(
        topic_id=topic_id,
        filename=stored,
        original_name=file.filename or stored,
        content_type=file.content_type,
        size=os.path.getsize(dest_path),
        created_by=current_user.id,
    )
    db.add(tf)
    await db.commit()
    await db.refresh(tf)
    return _file_dict(tf)


@router.get("/{meeting_id}/topics/{topic_id}/files/{file_id}/download")
async def download_topic_file(
    meeting_id: str,
    topic_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tf = await db.get(TopicFile, file_id)
    if not tf or tf.topic_id != topic_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, meeting_id, "topics", topic_id, tf.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path, filename=tf.original_name, media_type=tf.content_type or "application/octet-stream")


@router.delete("/{meeting_id}/topics/{topic_id}/files/{file_id}", status_code=204)
async def delete_topic_file(
    meeting_id: str,
    topic_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tf = await db.get(TopicFile, file_id)
    if not tf or tf.topic_id != topic_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, meeting_id, "topics", topic_id, tf.filename)
    if os.path.exists(path):
        os.remove(path)
    await db.delete(tf)
    await db.commit()
