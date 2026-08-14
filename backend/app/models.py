import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, DateTime, Computed, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from .database import Base

class GSTAccount(Base):
    __tablename__ = "gst_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gstin = Column(String(15), unique=True, nullable=False)
    legal_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SAPPurchaseRegister(Base):
    __tablename__ = "sap_purchase_register"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gstin = Column(String(15), ForeignKey("gst_accounts.gstin"), nullable=False)
    vendor_gstin = Column(String(15), nullable=False)
    vendor_name = Column(String(255))
    sap_doc_no = Column(String(50))
    document_number = Column(String(100), nullable=False)
    document_date = Column(Date, nullable=False)
    taxable_value = Column(Numeric(15, 2), nullable=False)
    cgst = Column(Numeric(15, 2), default=0.00)
    sgst = Column(Numeric(15, 2), default=0.00)
    igst = Column(Numeric(15, 2), default=0.00)
    cess = Column(Numeric(15, 2), default=0.00)
    total_tax = Column(Numeric(15, 2), Computed("cgst + sgst + igst + cess"))
    total_value = Column(Numeric(15, 2), nullable=False)
    return_period = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GSTR2BInvoice(Base):
    __tablename__ = "gstr2b_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gstin = Column(String(15), ForeignKey("gst_accounts.gstin"), nullable=False)
    supplier_gstin = Column(String(15), nullable=False)
    supplier_name = Column(String(255))
    invoice_number = Column(String(100), nullable=False)
    invoice_date = Column(Date, nullable=False)
    invoice_type = Column(String(10))
    taxable_value = Column(Numeric(15, 2), nullable=False)
    cgst = Column(Numeric(15, 2), default=0.00)
    sgst = Column(Numeric(15, 2), default=0.00)
    igst = Column(Numeric(15, 2), default=0.00)
    total_tax = Column(Numeric(15, 2), Computed("cgst + sgst + igst"))
    total_value = Column(Numeric(15, 2), nullable=False)
    itc_available = Column(String(1), default='Y')
    ims_status = Column(String(10), default='N')
    return_period = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('gstin', 'supplier_gstin', 'invoice_number', 'return_period', name='unique_gstr2b_invoice'),
    )

class ReconciliationSummary(Base):
    __tablename__ = "reconciliation_summary"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gstin = Column(String(15), ForeignKey("gst_accounts.gstin"), nullable=False)
    return_period = Column(String(6), nullable=False)
    sap_id = Column(UUID(as_uuid=True), ForeignKey("sap_purchase_register.id"))
    gst_id = Column(UUID(as_uuid=True), ForeignKey("gstr2b_invoices.id"))
    match_level = Column(String(50), nullable=False)
    match_status = Column(String(50), nullable=False)
    similarity_score = Column(Numeric(5, 2), default=1.00)
    user_action = Column(String(20), default='PENDING')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sap_record = relationship("SAPPurchaseRegister")
    gst_record = relationship("GSTR2BInvoice")

# Model aliases for matching engine imports
SapPurchaseRegister = SAPPurchaseRegister
Gstr2bInvoice = GSTR2BInvoice

