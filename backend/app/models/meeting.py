import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")  # draft | in_progress | completed

    customer_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    contract_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    topics: Mapped[list["MeetingTopic"]] = relationship(
        "MeetingTopic",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="MeetingTopic.sort_order",
        lazy="selectin",
    )
    files: Mapped[list["MeetingFile"]] = relationship(
        "MeetingFile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MeetingTopic(Base):
    __tablename__ = "meeting_topics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id: Mapped[str] = mapped_column(
        String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")  # pending | active | done

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="topics")
    files: Mapped[list["TopicFile"]] = relationship(
        "TopicFile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MeetingFile(Base):
    __tablename__ = "meeting_files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id: Mapped[str] = mapped_column(
        String, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class TopicFile(Base):
    __tablename__ = "topic_files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id: Mapped[str] = mapped_column(
        String, ForeignKey("meeting_topics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
