import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.whiteboard import Whiteboard
from app.models.user import User

router = APIRouter(prefix="/whiteboards", tags=["whiteboards"])


def _wb_dict(w: Whiteboard) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "shapes": json.loads(w.shapes) if w.shapes else [],
        "description": w.description,
        "preview": w.preview,
        "customer_id": w.customer_id,
        "contract_id": w.contract_id,
        "project_id": w.project_id,
        "created_at": w.created_at.isoformat(),
        "updated_at": w.updated_at.isoformat(),
    }


@router.get("")
async def list_whiteboards(
    contract_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Whiteboard).where(Whiteboard.created_by == current_user.id)
    if contract_id:
        q = q.where(Whiteboard.contract_id == contract_id)
    q = q.order_by(Whiteboard.updated_at.desc())
    result = await db.execute(q)
    return [_wb_dict(w) for w in result.scalars().all()]


@router.post("", status_code=201)
async def create_whiteboard(
    name: Optional[str] = Body("Untitled Board", embed=True),
    description: Optional[str] = Body(None, embed=True),
    customer_id: Optional[str] = Body(None, embed=True),
    contract_id: Optional[str] = Body(None, embed=True),
    project_id: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wb = Whiteboard(
        name=name or "Untitled Board", shapes="[]", created_by=current_user.id,
        description=description, customer_id=customer_id,
        contract_id=contract_id, project_id=project_id,
    )
    db.add(wb)
    await db.commit()
    await db.refresh(wb)
    return _wb_dict(wb)


@router.get("/{wb_id}")
async def get_whiteboard(
    wb_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wb = await db.get(Whiteboard, wb_id)
    if not wb:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    return _wb_dict(wb)


@router.patch("/{wb_id}")
async def update_whiteboard(
    wb_id: str,
    name: Optional[str] = Body(None, embed=True),
    shapes: Optional[list[Any]] = Body(None, embed=True),
    description: Optional[str] = Body(None, embed=True),
    preview: Optional[str] = Body(None, embed=True),
    customer_id: Optional[str] = Body(None, embed=True),
    contract_id: Optional[str] = Body(None, embed=True),
    project_id: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wb = await db.get(Whiteboard, wb_id)
    if not wb:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    if name is not None:
        wb.name = name
    if shapes is not None:
        wb.shapes = json.dumps(shapes)
    if description is not None:
        wb.description = description
    if preview is not None:
        wb.preview = preview
    if customer_id is not None:
        wb.customer_id = customer_id
    if contract_id is not None:
        wb.contract_id = contract_id
    if project_id is not None:
        wb.project_id = project_id
    wb.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wb)
    return _wb_dict(wb)


@router.delete("/{wb_id}", status_code=204)
async def delete_whiteboard(
    wb_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wb = await db.get(Whiteboard, wb_id)
    if not wb:
        raise HTTPException(status_code=404, detail="Whiteboard not found")
    await db.delete(wb)
    await db.commit()
