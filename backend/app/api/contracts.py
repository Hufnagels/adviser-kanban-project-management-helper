from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.contract import Contract
from app.models.user import User
from app.schemas.contract import ContractCreate, ContractOut, ContractUpdate, ContractWithProjects

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("", response_model=list[ContractOut])
async def list_contracts(
    customer_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Contract).order_by(Contract.name)
    if customer_id:
        q = q.where(Contract.customer_id == customer_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ContractOut, status_code=201)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = Contract(**payload.model_dump())
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return contract


@router.get("/{contract_id}", response_model=ContractWithProjects)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.patch("/{contract_id}", response_model=ContractOut)
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contract, field, value)
    await db.commit()
    await db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    await db.delete(contract)
    await db.commit()
