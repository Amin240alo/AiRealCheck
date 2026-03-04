from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Float,
    JSON,
    Index,
    func,
    text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(120), nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="user", nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    plan_type = Column(String(20), nullable=False, default="free", server_default=text("'free'"))
    subscription_active = Column(Boolean, default=False, nullable=False, server_default=text("false"))
    credits_total = Column(Integer, default=0, nullable=False, server_default=text("0"))
    credits_used = Column(Integer, default=0, nullable=False, server_default=text("0"))
    last_credit_reset = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    credit_ledger = relationship("CreditLedger", back_populates="user", lazy="select")
    credit_transactions = relationship("CreditTransaction", back_populates="user", lazy="select")
    analyses = relationship("Analysis", back_populates="user", lazy="select")
    subscriptions = relationship("Subscription", back_populates="user", lazy="select")
    refresh_tokens = relationship("RefreshToken", back_populates="user", lazy="select")
    email_verify_tokens = relationship("EmailVerifyToken", back_populates="user", lazy="select")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", lazy="select")
    consents = relationship("UserConsent", back_populates="user", lazy="select")


class UserConsent(Base):
    __tablename__ = "user_consents"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consent_type = Column(String(50), nullable=False)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="consents")

    __table_args__ = (
        Index("ix_user_consents_user_type", "user_id", "consent_type"),
    )


class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    ref_type = Column(String(50), nullable=True)
    ref_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="credit_ledger")

    __table_args__ = (
        Index("ix_credit_ledger_user_created", "user_id", "created_at"),
    )


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    amount = Column(Integer, nullable=False)
    analysis_id = Column(String(36), nullable=True)
    media_type = Column(String(20), nullable=True)
    idempotency_key = Column(String(64), unique=True, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="credit_transactions")

    __table_args__ = (
        Index("ix_credit_transactions_user_created", "user_id", "created_at"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    cancel_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="subscriptions")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False)
    media_type = Column(String(20), nullable=True)
    result_json = Column(JSON, nullable=True)
    final_score_ai01 = Column(Float, nullable=True)
    cost_credits = Column(Integer, nullable=True)
    charge_idempotency_key = Column(String(64), unique=True, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="analyses")

    __table_args__ = (
        Index("ix_analyses_user_created", "user_id", "created_at"),
    )


class EmailVerifyToken(Base):
    __tablename__ = "email_verify_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="email_verify_tokens")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="password_reset_tokens")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)

    user = relationship("User", back_populates="refresh_tokens")
