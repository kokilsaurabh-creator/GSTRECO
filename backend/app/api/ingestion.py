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
@router.post("/ingest/sap-mm")
async def ingest_sap_excel(
    active_gstin: Optional[str] = Form(None),
    gstin: Optional[str] = Form(None),
    return_period: Optional[str] = Form(None),
    period: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    try:
        import time as _time
        _t0 = _time.perf_counter()
        print("--- STARTING SAP EXCEL INGESTION ---")
        uploaded_file = file
        if not uploaded_file and files and len(files) > 0:
            uploaded_file = files[0]

        if not uploaded_file:
            raise HTTPException(status_code=400, detail="No file uploaded for SAP ingestion.")

        fallback_gstin = (active_gstin or gstin or "").strip()
        req_period = (return_period or period or "June 2026").strip()

        content = await uploaded_file.read()
        filename = uploaded_file.filename.lower()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            try:
                df = pd.read_excel(io.BytesIO(content), engine='calamine')
            except Exception:
                try:
                    df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
                except Exception as e2:
                    # SAP sometimes exports HTML tables with an .xls extension.
                    try:
                        dfs = pd.read_html(io.BytesIO(content))
                        if dfs:
                            df = dfs[0]
                        else:
                            raise e2
                    except Exception:
                        try:
                            df = pd.read_excel(io.BytesIO(content))
                        except Exception:
                            raise e2

        print(f"Raw rows read from file: {len(df)} ({_time.perf_counter() - _t0:.2f}s)")
        
        # 1. Normalize column names (strip, lowercase, replace spaces/dashes with underscores)
        col_map = {}
        for c in df.columns:
            clean_c = str(c).strip().lower().replace(" ", "_").replace("-", "_")
            col_map[c] = clean_c
        df = df.rename(columns=col_map)
        cols = set(df.columns)
        print(f"Normalized Columns: {list(cols)}")

        # 2. Map Column Aliases
        # Vendor GSTIN
        vendor_gstin_col = next((c for c in ['vendor_gstin', 'supplier_gstin', 'ctin', 'vendor_gst', 'supplier_gst', 'gstin_of_supplier'] if c in cols), None)
        # Document Number / Invoice Num
        doc_num_col = next((c for c in ['document_number', 'invoice_num', 'invoice_number', 'invoice_no', 'doc_no', 'doc_number', 'sap_doc_no', 'bill_no'] if c in cols), None)
        # Vendor Name
        vendor_name_col = next((c for c in ['vendor_name', 'supplier_name', 'name', 'vendor', 'supplier'] if c in cols), None)
        # Company Code
        company_code_col = next((c for c in ['company_code', 'co_code', 'cocode', 'bukrs'] if c in cols), None)
        # Fiscal Year
        fiscal_year_col = next((c for c in ['fiscal_year', 'fisc_year', 'year', 'gjahr'] if c in cols), None)
        # Dates
        date_col = next((c for c in ['posting_date', 'document_date', 'doc_date', 'invoice_date', 'date'] if c in cols), None)
        # Taxable Value
        taxable_col = next((c for c in ['taxable_base', 'taxable_value', 'base_amount', 'taxable_amt', 'taxable_val'] if c in cols), None)

        if not vendor_gstin_col or not doc_num_col:
            # Fall back to positional or search for any column containing 'gstin' and 'inv'/'doc'
            if not vendor_gstin_col:
                vendor_gstin_col = next((c for c in cols if 'gstin' in c or 'ctin' in c), None)
            if not doc_num_col:
                doc_num_col = next((c for c in cols if 'inv' in c or 'doc' in c or 'number' in c or 'no' in c), None)

        if vendor_gstin_col:
            df[vendor_gstin_col] = df[vendor_gstin_col].fillna("")
        if doc_num_col:
            df = df.dropna(subset=[doc_num_col])

        # Clean Financial Columns
        for fcol in ['taxable_base', 'taxable_value', 'cgst', 'sgst', 'igst', 'cess']:
            matched_c = next((c for c in cols if fcol in c), None)
            if matched_c:
                df[matched_c] = df[matched_c].astype(str).str.replace(',', '', regex=False)
                df[fcol] = pd.to_numeric(df[matched_c], errors='coerce').fillna(0.0)
            elif fcol == 'taxable_base' and taxable_col:
                df[taxable_col] = df[taxable_col].astype(str).str.replace(',', '', regex=False)
                df['taxable_base'] = pd.to_numeric(df[taxable_col], errors='coerce').fillna(0.0)
            else:
                df[fcol] = 0.0

        # Compute return period & dates
        if date_col:
            df['date_parsed'] = pd.to_datetime(df[date_col], errors='coerce')
            df['computed_period'] = df['date_parsed'].dt.strftime('%m%Y')
        else:
            df['date_parsed'] = None
            df['computed_period'] = None

        from .reconciliation import normalize_period
        default_norm_period = normalize_period(req_period) or "062026"

        # FIX 1: Pre-collect unique GSTINs and batch-check ONCE (was per-row before)
        unique_gstins = set()
        own_gstin_col_name = 'own_gstin' if 'own_gstin' in cols else None
        if own_gstin_col_name:
            for val in df[own_gstin_col_name].dropna().unique():
                cleaned = str(val).strip().upper()
                if cleaned and cleaned.lower() != "nan":
                    unique_gstins.add(cleaned)
        if fallback_gstin:
            unique_gstins.add(fallback_gstin.upper())
        if not unique_gstins:
            unique_gstins.add("26AAACW1018K1ZH")

        for g in unique_gstins:
            ensure_gst_account_exists(db, g)
        print(f"Batch-checked {len(unique_gstins)} unique GSTIN(s) ({_time.perf_counter() - _t0:.2f}s)")

        # FIX 3: Use to_dict('records') for safer dictionary access
        records_to_insert = []
        for row in df.to_dict(orient='records'):
            # Check own_gstin cleanly
            raw_own = row.get('own_gstin')
            if raw_own is not None and pd.notnull(raw_own) and str(raw_own).strip() != "" and str(raw_own).strip().lower() != "nan":
                rec_own_gstin = str(raw_own).strip().upper()
            else:
                rec_own_gstin = fallback_gstin or "26AAACW1018K1ZH"

            # Date object
            parsed_d = row.get('date_parsed')
            doc_date_obj = parsed_d.date() if parsed_d is not None and pd.notnull(parsed_d) and hasattr(parsed_d, 'date') else None

            # Computed return period
            computed_p = row.get('computed_period')
            rec_period = str(computed_p) if computed_p is not None and pd.notnull(computed_p) and str(computed_p).strip() != "" else default_norm_period

            v_gstin = str(row.get(vendor_gstin_col)).strip().upper() if vendor_gstin_col and pd.notnull(row.get(vendor_gstin_col)) else ""
            v_name = str(row.get(vendor_name_col)).strip() if vendor_name_col and pd.notnull(row.get(vendor_name_col)) else ""
            doc_no = str(row.get(doc_num_col)).strip() if doc_num_col and pd.notnull(row.get(doc_num_col)) else ""
            c_code = str(row.get(company_code_col)).strip() if company_code_col and pd.notnull(row.get(company_code_col)) else ""
            f_year = str(row.get(fiscal_year_col)).strip() if fiscal_year_col and pd.notnull(row.get(fiscal_year_col)) else ""

            # Ensure numeric conversions safely
            try:
                t_val = float(row.get('taxable_base', 0.0))
            except (ValueError, TypeError):
                t_val = 0.0
            try:
                cgst_v = float(row.get('cgst', 0.0))
            except (ValueError, TypeError):
                cgst_v = 0.0
            try:
                sgst_v = float(row.get('sgst', 0.0))
            except (ValueError, TypeError):
                sgst_v = 0.0
            try:
                igst_v = float(row.get('igst', 0.0))
            except (ValueError, TypeError):
                igst_v = 0.0
            try:
                cess_v = float(row.get('cess', 0.0))
            except (ValueError, TypeError):
                cess_v = 0.0
            tot_val = t_val + cgst_v + sgst_v + igst_v + cess_v

            sap_doc_val = row.get('sap_doc_no')
            sap_doc_str = str(sap_doc_val) if pd.notnull(sap_doc_val) else ""

            record = {
                "id": uuid.uuid4(),
                "gstin": rec_own_gstin,
                "vendor_gstin": v_gstin,
                "vendor_name": v_name,
                "company_code": c_code,
                "sap_doc_no": sap_doc_str,
                "fiscal_year": f_year,
                "document_number": doc_no,
                "document_date": doc_date_obj,
                "taxable_value": t_val,
                "cgst": cgst_v,
                "sgst": sgst_v,
                "igst": igst_v,
                "cess": cess_v,
                "total_value": tot_val,
                "return_period": rec_period
            }
            records_to_insert.append(record)

        print(f"Built {len(records_to_insert)} records ({_time.perf_counter() - _t0:.2f}s)")

        BATCH_SIZE = 500
        for i in range(0, len(records_to_insert), BATCH_SIZE):
            batch = records_to_insert[i:i + BATCH_SIZE]
            db.bulk_insert_mappings(SAPPurchaseRegister, batch)
        db.commit()

        elapsed = _time.perf_counter() - _t0
        print(f"--- INGESTION SUCCESS: {len(records_to_insert)} SAP records inserted in {elapsed:.2f}s ---")

        return {
            "status": "success",
            "message": f"Successfully ingested {len(records_to_insert)} SAP MM purchase records!",
            "inserted": len(records_to_insert),
            "failed": 0,
            "count": len(records_to_insert),
            "total_records_parsed": len(records_to_insert),
            "files_processed": 1
        }

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        print(f"FATAL INGESTION ERROR: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing SAP Excel: {str(e)}")



