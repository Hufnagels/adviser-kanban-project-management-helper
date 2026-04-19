from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.task import Priority, TaskStatus


class TaskCreate(BaseModel):
    title: str
    external_id: Optional[str] = None
    task_type: Optional[str] = None
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.todo
    priority: Priority = Priority.medium
    listing_date: Optional[date] = None
    due_date: Optional[date] = None
    finishing_date: Optional[date] = None
    approval: bool = False
    notes: Optional[str] = None
    project_id: Optional[str] = None
    assignee_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    external_id: Optional[str] = None
    task_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    listing_date: Optional[date] = None
    due_date: Optional[date] = None
    finishing_date: Optional[date] = None
    approval: Optional[bool] = None
    notes: Optional[str] = None
    project_id: Optional[str] = None
    assignee_id: Optional[str] = None


class TaskOut(BaseModel):
    id: str
    external_id: Optional[str]
    title: str
    task_type: Optional[str]
    description: Optional[str]
    status: TaskStatus
    priority: Priority
    listing_date: Optional[date]
    due_date: Optional[date]
    finishing_date: Optional[date]
    approval: bool
    notes: Optional[str]
    project_id: Optional[str]
    assignee_id: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
