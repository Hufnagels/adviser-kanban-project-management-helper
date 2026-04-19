import os
import shutil
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.task_file import TaskFile
from app.models.user import User

UPLOADS_DIR = "/app/uploads"

router = APIRouter(prefix="/tasks/{task_id}/files", tags=["task-files"])


def _file_dict(f: TaskFile) -> dict:
    return {
        "id": f.id,
        "name": f.original_name,
        "size": f.size,
        "content_type": f.content_type,
        "description": f.description,
        "created_at": f.created_at.isoformat(),
    }


@router.get("")
async def list_files(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskFile).where(TaskFile.task_id == task_id).order_by(TaskFile.created_at)
    )
    return [_file_dict(f) for f in result.scalars().all()]


@router.post("", status_code=201)
async def upload_file(
    task_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dest_dir = os.path.join(UPLOADS_DIR, task_id)
    os.makedirs(dest_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1]
    stored_name = f"{file_id}{ext}"
    dest_path = os.path.join(dest_dir, stored_name)

    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    size = os.path.getsize(dest_path)

    task_file = TaskFile(
        task_id=task_id,
        filename=stored_name,
        original_name=file.filename or stored_name,
        content_type=file.content_type,
        size=size,
        created_by=current_user.id,
    )
    db.add(task_file)
    await db.commit()
    await db.refresh(task_file)
    return _file_dict(task_file)


@router.patch("/{file_id}")
async def update_file(
    task_id: str,
    file_id: str,
    description: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tf = await db.get(TaskFile, file_id)
    if not tf or tf.task_id != task_id:
        raise HTTPException(status_code=404, detail="File not found")
    tf.description = description
    await db.commit()
    await db.refresh(tf)
    return _file_dict(tf)


@router.get("/{file_id}/download")
async def download_file(
    task_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tf = await db.get(TaskFile, file_id)
    if not tf or tf.task_id != task_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, task_id, tf.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path,
        filename=tf.original_name,
        media_type=tf.content_type or "application/octet-stream",
    )


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    task_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tf = await db.get(TaskFile, file_id)
    if not tf or tf.task_id != task_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = os.path.join(UPLOADS_DIR, task_id, tf.filename)
    if os.path.exists(path):
        os.remove(path)
    await db.delete(tf)
    await db.commit()
