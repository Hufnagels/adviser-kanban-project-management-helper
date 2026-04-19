import uuid
from datetime import datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    customer_id: Mapped[str] = mapped_column(
        String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── Details ───────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contract_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    start_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Financial ─────────────────────────────────────────────────────────────
    contract_value: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True, default="EUR")
    payment_terms: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_cycle: Mapped[str | None] = mapped_column(String(50), nullable=True)
    discount: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    # ── Relations ─────────────────────────────────────────────────────────────
    projects: Mapped[list["Project"]] = relationship(  # noqa: F821
        "Project",
        primaryjoin="Contract.id == foreign(Project.contract_id)",
        lazy="selectin",
    )
