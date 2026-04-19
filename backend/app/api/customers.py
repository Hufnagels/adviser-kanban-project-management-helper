from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.contract import Contract
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate, CustomerWithProjects

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    contracts_count_sq = (
        select(func.count(Contract.id))
        .where(Contract.customer_id == Customer.id)
        .correlate(Customer)
        .scalar_subquery()
    )
    stmt = select(Customer, contracts_count_sq.label("contracts_count")).order_by(Customer.name)
    rows = (await db.execute(stmt)).all()
    result = []
    for row in rows:
        out = CustomerOut.model_validate(row[0])
        out.contracts_count = row[1] or 0
        result.append(out)
    return result


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerWithProjects)
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)
    await db.commit()
