from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TimeEntryOut(BaseModel):
    id: str
    task_id: str
    user_id: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: Optional[int] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_duration(cls, entry):
        obj = cls.model_validate(entry)
        if entry.end_time and entry.start_time:
            obj.duration_seconds = int((entry.end_time - entry.start_time).total_seconds())
        return obj


class TimeReportItem(BaseModel):
    task_id: str
    task_title: str
    total_seconds: int
