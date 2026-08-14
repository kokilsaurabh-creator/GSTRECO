import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://neondb_owner:npg_LUGCA2tQwq3x@ep-divine-base-ax9trds9-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")

# Handle standard postgresql:// for psycopg2
if DATABASE_URL.startswith("postgresql://"):
    pass # psycopg2 is fine with it

DDL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. GSTIN Configuration Table
CREATE TABLE IF NOT EXISTS gst_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gstin VARCHAR(15) UNIQUE NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SAP Purchase Register (Inward Supplies from MM/P2P)
CREATE TABLE IF NOT EXISTS sap_purchase_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gstin VARCHAR(15) NOT NULL REFERENCES gst_accounts(gstin),
    vendor_gstin VARCHAR(15) NOT NULL,
    vendor_name VARCHAR(255),
    sap_doc_no VARCHAR(50), -- RBKP-BELNR
    document_number VARCHAR(100) NOT NULL, -- RBKP-XBLNR (Reference No)
    document_date DATE NOT NULL, -- RBKP-BLDAT
    taxable_value NUMERIC(15, 2) NOT NULL,
    cgst NUMERIC(15, 2) DEFAULT 0.00,
    sgst NUMERIC(15, 2) DEFAULT 0.00,
    igst NUMERIC(15, 2) DEFAULT 0.00,
    cess NUMERIC(15, 2) DEFAULT 0.00,
    total_tax NUMERIC(15, 2) GENERATED ALWAYS AS (cgst + sgst + igst + cess) STORED,
    total_value NUMERIC(15, 2) NOT NULL,
    return_period VARCHAR(6) NOT NULL, -- MMYYYY
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Government GSTR-2B Invoices (Flattened from Portal JSON)
CREATE TABLE IF NOT EXISTS gstr2b_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gstin VARCHAR(15) NOT NULL REFERENCES gst_accounts(gstin),
    supplier_gstin VARCHAR(15) NOT NULL, -- ctin
    supplier_name VARCHAR(255), -- trdnm
    invoice_number VARCHAR(100) NOT NULL, -- inum
    invoice_date DATE NOT NULL, -- dt (Parsed from DD-MM-YYYY)
    invoice_type VARCHAR(10), -- typ (R = Regular, etc.)
    taxable_value NUMERIC(15, 2) NOT NULL, -- txval
    cgst NUMERIC(15, 2) DEFAULT 0.00, -- cgst
    sgst NUMERIC(15, 2) DEFAULT 0.00, -- sgst
    igst NUMERIC(15, 2) DEFAULT 0.00, -- igst
    total_tax NUMERIC(15, 2) GENERATED ALWAYS AS (cgst + sgst + igst) STORED,
    total_value NUMERIC(15, 2) NOT NULL, -- val
    itc_available VARCHAR(1) DEFAULT 'Y', -- itcavl
    ims_status VARCHAR(10) DEFAULT 'N', -- imsStatus
    return_period VARCHAR(6) NOT NULL, -- rtnprd
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Reconciliation Results Mapping Table
CREATE TABLE IF NOT EXISTS reconciliation_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gstin VARCHAR(15) NOT NULL REFERENCES gst_accounts(gstin),
    return_period VARCHAR(6) NOT NULL,
    sap_id UUID REFERENCES sap_purchase_register(id) ON DELETE SET NULL,
    gst_id UUID REFERENCES gstr2b_invoices(id) ON DELETE SET NULL,
    match_level VARCHAR(50) NOT NULL, -- Level 1, Level 2, Level 3, Level 4, Unmatched
    match_status VARCHAR(50) NOT NULL, -- Ready to Claim, Review Required, Missing in Portal, Missing in SAP
    similarity_score NUMERIC(5, 2) DEFAULT 1.00,
    user_action VARCHAR(20) DEFAULT 'PENDING', -- ACCEPTED, REJECTED, PENDING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sap_lookup ON sap_purchase_register(gstin, vendor_gstin, return_period);
CREATE INDEX IF NOT EXISTS idx_gst_lookup ON gstr2b_invoices(gstin, supplier_gstin, return_period);
CREATE INDEX IF NOT EXISTS idx_reco_status ON reconciliation_summary(gstin, return_period, match_status);
"""

def init_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        print("Executing DDL...")
        cur.execute(DDL)
        conn.commit()
        cur.close()
        conn.close()
        print("Database schema created successfully.")
    except Exception as e:
        print(f"Error creating database schema: {e}")

if __name__ == "__main__":
    init_db()
