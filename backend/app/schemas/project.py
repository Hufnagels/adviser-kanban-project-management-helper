from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.task import TaskOut


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    customer_id: Optional[str] = None
    contract_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    customer_id: Optional[str] = None
    contract_id: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_id: Optional[str]
    customer_id: Optional[str]
    contract_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectWithTasks(ProjectOut):
    tasks: list[TaskOut] = []
