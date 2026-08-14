from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from typing import Any, List, Optional
import json
import io
import uuid
import pandas as pd
from datetime import datetime

from ..database import get_db
from ..models import GSTR2BInvoice, SAPPurchaseRegister, GSTAccount
from ..services.parser_service import parse_gstr2b_json

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

def ensure_gst_account_exists(db: Session, gstin: str):
    if not gstin:
        return
    account = db.query(GSTAccount).filter(GSTAccount.gstin == gstin).first()
    if not account:
        account = GSTAccount(gstin=gstin, legal_name=f"Entity {gstin}")
        db.add(account)
        db.commit()

def bulk_insert_gstr2b(db: Session, records_to_insert: List[dict]):
    if not records_to_insert:
        return
    dialect = db.bind.dialect.name
    BATCH_SIZE = 100
    for i in range(0, len(records_to_insert), BATCH_SIZE):
        batch = records_to_insert[i:i + BATCH_SIZE]
        try:
            if dialect == "sqlite":
                stmt = sqlite_insert(GSTR2BInvoice).values(batch)
                stmt = stmt.on_conflict_do_nothing(
                    index_elements=['gstin', 'supplier_gstin', 'invoice_number', 'return_period']
                )
                db.execute(stmt)
            else:
                stmt = pg_insert(GSTR2BInvoice).values(batch)
                stmt = stmt.on_conflict_do_nothing(
                    index_elements=['gstin', 'supplier_gstin', 'invoice_number', 'return_period']
                )
                db.execute(stmt)
        except Exception:
            db.rollback()
            for rec in batch:
                try:
                    obj = GSTR2BInvoice(**rec)
                    db.add(obj)
                    db.commit()
                except Exception:
                    db.rollback()
    db.commit()

@router.post("/gstr2b")
@router.post("/gstr2b-json")
async def upload_gstr2b_json(
    active_gstin: Optional[str] = Form(None),
    gstin: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    target_gstin = active_gstin or gstin
    if not target_gstin:
        raise HTTPException(status_code=400, detail="GSTIN is required.")
        
    uploaded_files: List[UploadFile] = []
    if files:
        uploaded_files.extend(files)
    if file:
        uploaded_files.append(file)
        
    if not uploaded_files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    records_to_insert = []
    for f in uploaded_files:
        if not f.filename.lower().endswith(".json"):
            continue
        content = await f.read()
        try:
            json_payload = json.loads(content.decode("utf-8-sig", errors="replace"))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in file {f.filename}: {str(e)}")

        parsed = parse_gstr2b_json(json_payload, target_gstin)
        for rec in parsed:
            rec["id"] = uuid.uuid4()
            records_to_insert.append(rec)

    if not records_to_insert:
        return {
            "status": "success",
            "message": "No valid B2B records found in JSON files.",
            "files_processed": len(uploaded_files),
            "total_records_parsed": 0,
            "count": 0
        }

    ensure_gst_account_exists(db, target_gstin)

    try:
        bulk_insert_gstr2b(db, records_to_insert)

        return {
            "status": "success",
            "message": f"Successfully ingested GSTR-2B data from {len(uploaded_files)} file(s).",
            "files_processed": len(uploaded_files),
            "total_records_parsed": len(records_to_insert),
            "count": len(records_to_insert)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing GSTR-2B JSON files: {str(e)}")

@router.post("/gstr2b-multi")
async def ingest_gstr2b_multi(
    files: list[UploadFile] = File(...),
    own_gstin: str = Form(...),
    return_period: str = Form(...),
    db: Session = Depends(get_db)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    records_to_insert = []
    for f in files:
        if not f.filename.lower().endswith(".json"):
            continue
        content = await f.read()
        try:
            json_payload = json.loads(content.decode("utf-8-sig", errors="replace"))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in file {f.filename}: {str(e)}")

        parsed = parse_gstr2b_json(json_payload, own_gstin)
        # Override return_period if provided
        for rec in parsed:
            rec["id"] = uuid.uuid4()
            if return_period:
                rec["return_period"] = return_period
            records_to_insert.append(rec)

    if not records_to_insert:
        return {
            "status": "success",
            "message": "No valid records found in JSON files.",
            "files_processed": len(files),
            "total_records_parsed": 0,
            "count": 0
        }

    ensure_gst_account_exists(db, own_gstin)

    try:
        bulk_insert_gstr2b(db, records_to_insert)

        return {
            "status": "success",
            "message": f"Successfully ingested GSTR-2B data from {len(files)} file(s).",
            "files_processed": len(files),
            "total_records_parsed": len(records_to_insert),
            "count": len(records_to_insert)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing GSTR-2B JSON files: {str(e)}")

@router.post("/sap-mm")
@router.post("/sap-excel")
@router.post("/ingest/sap-excel")
async def ingest_sap_excel(
    gstin: Optional[str] = Form(None),
    return_period: Optional[str] = Form(None),
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    try:
        print("--- STARTING SAP EXCEL INGESTION ---")
        content = await file.read()
        filename = file.filename.lower()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            try:
                df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            except Exception:
                df = pd.read_excel(io.BytesIO(content))

        print(f"Raw rows read from Excel: {len(df)}")
        print(f"Excel Columns: {list(df.columns)}")

        # Handle column names flexible mapping
        if 'vendor_gstin' in df.columns and 'invoice_num' in df.columns:
            df = df.dropna(subset=['vendor_gstin', 'invoice_num'])
        elif 'vendor_gstin' in df.columns and 'document_number' in df.columns:
            df['invoice_num'] = df['document_number']
            df = df.dropna(subset=['vendor_gstin', 'invoice_num'])

        print(f"Rows after dropping missing GSTIN/Invoice: {len(df)}")

        financial_columns = ['taxable_base', 'taxable_value', 'cgst', 'sgst', 'igst', 'cess']
        for col in financial_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(',', '', regex=False)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
            else:
                df[col] = 0.0

        if 'taxable_base' not in df.columns and 'taxable_value' in df.columns:
            df['taxable_base'] = df['taxable_value']

        if 'posting_date' in df.columns:
            df['posting_date'] = pd.to_datetime(df['posting_date'], errors='coerce')
            df = df.dropna(subset=['posting_date']) 
            df['return_period_computed'] = df['posting_date'].dt.strftime('%m%Y')
        elif 'document_date' in df.columns:
            df['doc_date_dt'] = pd.to_datetime(df['document_date'], errors='coerce')
            df['return_period_computed'] = df['doc_date_dt'].dt.strftime('%m%Y')
        else:
            df['return_period_computed'] = return_period or "062026"

        print(f"Rows surviving date validation: {len(df)}")

        df['total_value'] = df['taxable_base'] + df['cgst'] + df['sgst'] + df['igst'] + df['cess']
        df['total_tax'] = df['cgst'] + df['sgst'] + df['igst'] + df['cess']

        records_to_insert = []
        for index, row in df.iterrows():
            target_own_gstin = str(row.get('own_gstin', gstin or ''))
            if target_own_gstin:
                ensure_gst_account_exists(db, target_own_gstin)

            raw_inv_date = row.get('invoice_date', row.get('posting_date', row.get('document_date', None)))
            doc_date_obj = None
            if pd.notnull(raw_inv_date):
                try:
                    doc_date_obj = pd.to_datetime(raw_inv_date).date()
                except Exception:
                    doc_date_obj = None

            ret_pd = str(row.get('return_period_computed', return_period or '062026'))

            record = {
                "id": uuid.uuid4(),
                "gstin": target_own_gstin,
                "vendor_gstin": str(row.get('vendor_gstin', '')),
                "vendor_name": str(row.get('vendor_name', '')),
                "sap_doc_no": str(row.get('sap_doc_no', '')),
                "document_number": str(row.get('invoice_num', row.get('document_number', ''))),
                "document_date": doc_date_obj,
                "taxable_value": float(row['taxable_base']),
                "cgst": float(row['cgst']),
                "sgst": float(row['sgst']),
                "igst": float(row['igst']),
                "cess": float(row['cess']),
                "total_value": float(row['total_value']),
                "return_period": ret_pd
            }
            records_to_insert.append(record)

        BATCH_SIZE = 500
        for i in range(0, len(records_to_insert), BATCH_SIZE):
            batch = records_to_insert[i:i + BATCH_SIZE]
            db.bulk_insert_mappings(SAPPurchaseRegister, batch)
        db.commit()

        print(f"--- INGESTION SUCCESS: {len(records_to_insert)} SAP records inserted ---")

        return {
            "status": "success", 
            "inserted": len(records_to_insert), 
            "failed": 0,
            "count": len(records_to_insert)
        }


    except Exception as e:
        print(f"FATAL INGESTION ERROR: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing SAP Excel: {str(e)}")


