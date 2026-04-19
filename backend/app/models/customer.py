import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # ── General ──────────────────────────────────────────────────────────────
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_type: Mapped[str | None] = mapped_column(String(100), nullable=True)   # Ltd, GmbH, Inc …
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── SAP identifiers ───────────────────────────────────────────────────────
    sap_bp_code: Mapped[str | None] = mapped_column(String(50), nullable=True)     # SAP Business Partner code
    tax_number: Mapped[str | None] = mapped_column(String(50), nullable=True)      # VAT / Tax ID
    tax_group: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Address ───────────────────────────────────────────────────────────────
    address_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Main contact ──────────────────────────────────────────────────────────
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fax: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── General Manager / Key contact ─────────────────────────────────────────
    gm_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gm_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gm_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gm_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Banking ───────────────────────────────────────────────────────────────
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_iban: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_bic: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # ── Internal notes ────────────────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    projects: Mapped[list["Project"]] = relationship(  # noqa: F821
        "Project",
        primaryjoin="Customer.id == foreign(Project.customer_id)",
        lazy="selectin",
    )
