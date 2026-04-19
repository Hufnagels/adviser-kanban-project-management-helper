from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.contract_file import ContractFile
from app.models.contract import Contract
from app.models.task_file import TaskFile
from app.models.task import Task
from app.models.user import User

router = APIRouter(prefix="/files", tags=["files"])


@router.get("")
async def list_all_files(
    source_type: Optional[str] = Query(None, description="Filter by 'task' or 'contract'"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    results = []

    if source_type != "task":
        # Contract files joined with contract name
        q = (
            select(ContractFile, Contract.name)
            .join(Contract, ContractFile.contract_id == Contract.id)
            .order_by(ContractFile.created_at.desc())
        )
        rows = (await db.execute(q)).all()
        for row in rows:
            cf: ContractFile = row[0]
            contract_name: str = row[1]
            if search and search.lower() not in (cf.original_name or "").lower() \
                    and search.lower() not in (cf.description or "").lower() \
                    and search.lower() not in (contract_name or "").lower():
                continue
            results.append({
                "id": cf.id,
                "name": cf.original_name,
                "size": cf.size,
                "content_type": cf.content_type,
                "description": cf.description,
                "created_at": cf.created_at.isoformat(),
                "source_type": "contract",
                "source_id": cf.contract_id,
                "source_name": contract_name,
            })

    if source_type != "contract":
        # Task files joined with task title
        q = (
            select(TaskFile, Task.title)
            .join(Task, TaskFile.task_id == Task.id)
            .order_by(TaskFile.created_at.desc())
        )
        rows = (await db.execute(q)).all()
        for row in rows:
            tf: TaskFile = row[0]
            task_title: str = row[1]
            if search and search.lower() not in (tf.original_name or "").lower() \
                    and search.lower() not in (tf.description or "").lower() \
                    and search.lower() not in (task_title or "").lower():
                continue
            results.append({
                "id": tf.id,
                "name": tf.original_name,
                "size": tf.size,
                "content_type": tf.content_type,
                "description": tf.description,
                "created_at": tf.created_at.isoformat(),
                "source_type": "task",
                "source_id": tf.task_id,
                "source_name": task_title,
            })

    # Sort combined results by created_at desc
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return results
