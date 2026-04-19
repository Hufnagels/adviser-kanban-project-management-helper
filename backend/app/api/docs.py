import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.doc import Doc
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/docs", tags=["docs"])


async def _doc_dict(d: Doc, db: AsyncSession) -> dict:
    project_name: str | None = None
    contract_name: str | None = None
    customer_name: str | None = None
    project_id: str | None = d.project_id

    if project_id:
        project = await db.get(Project, project_id)
        if project:
            project_name = project.name
            if project.contract_id:
                contract = await db.get(Contract, project.contract_id)
                if contract:
                    contract_name = contract.name
                    if contract.customer_id:
                        customer = await db.get(Customer, contract.customer_id)
                        if customer:
                            customer_name = customer.name

    return {
        "id": d.id,
        "title": d.title,
        "blocks": json.loads(d.blocks) if d.blocks else [],
        "project_id": project_id,
        "project_name": project_name,
        "contract_name": contract_name,
        "customer_name": customer_name,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


def _doc_dict_simple(d: Doc) -> dict:
    """Fast dict without DB lookups — used when we already have context."""
    return {
        "id": d.id,
        "title": d.title,
        "blocks": json.loads(d.blocks) if d.blocks else [],
        "project_id": d.project_id,
        "project_name": None,
        "contract_name": None,
        "customer_name": None,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


@router.get("")
async def list_docs(
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Doc).where(Doc.created_by == current_user.id)
    if project_id is not None:
        q = q.where(Doc.project_id == project_id)
    q = q.order_by(Doc.updated_at.desc())
    result = await db.execute(q)
    docs = result.scalars().all()
    return [await _doc_dict(d, db) for d in docs]


@router.post("", status_code=201)
async def create_doc(
    title: Optional[str] = Body("Untitled", embed=True),
    project_id: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = Doc(
        title=title or "Untitled",
        blocks="[]",
        project_id=project_id,
        created_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return await _doc_dict(doc, db)


@router.get("/{doc_id}")
async def get_doc(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = await db.get(Doc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    return await _doc_dict(doc, db)


@router.patch("/{doc_id}")
async def update_doc(
    doc_id: str,
    title: Optional[str] = Body(None, embed=True),
    blocks: Optional[list[Any]] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = await db.get(Doc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    if title is not None:
        doc.title = title
    if blocks is not None:
        doc.blocks = json.dumps(blocks)
    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doc)
    return await _doc_dict(doc, db)


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = await db.get(Doc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    await db.delete(doc)
    await db.commit()
