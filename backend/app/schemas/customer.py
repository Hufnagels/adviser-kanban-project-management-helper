from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from app.schemas.project import ProjectOut


class CustomerBase(BaseModel):
    name: str
    description: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    sap_bp_code: Optional[str] = None
    tax_number: Optional[str] = None
    tax_group: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_zip: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    gm_name: Optional[str] = None
    gm_title: Optional[str] = None
    gm_email: Optional[str] = None
    gm_phone: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_iban: Optional[str] = None
    bank_bic: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    name: Optional[str] = None


class CustomerOut(CustomerBase):
    id: str
    created_at: datetime
    contracts_count: int = 0

    model_config = {"from_attributes": True}


class CustomerWithProjects(CustomerOut):
    projects: list[ProjectOut] = []
