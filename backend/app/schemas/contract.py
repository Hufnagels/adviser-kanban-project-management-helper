from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.project import ProjectOut


class ContractBase(BaseModel):
    name: str
    contract_number: Optional[str] = None
    status: str = "active"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    contract_value: Optional[float] = None
    currency: Optional[str] = "EUR"
    payment_terms: Optional[str] = None
    billing_cycle: Optional[str] = None
    discount: Optional[float] = None


class ContractCreate(ContractBase):
    customer_id: str


class ContractUpdate(ContractBase):
    name: Optional[str] = None
    customer_id: Optional[str] = None


class ContractOut(ContractBase):
    id: str
    customer_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContractWithProjects(ContractOut):
    projects: list[ProjectOut] = []
