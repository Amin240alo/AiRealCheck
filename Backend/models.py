import datetime as dt
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    pw_hash = Column(String(200), nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    credits = Column(Integer, default=0, nullable=False)
    credits_reset_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: dt.datetime.utcnow(), nullable=False)

    credit_txs = relationship("CreditTx", back_populates="user", lazy="select")


class CreditTx(Base):
    __tablename__ = "credit_tx"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: dt.datetime.utcnow(), nullable=False)

    user = relationship("User", back_populates="credit_txs")

