import difflib
import re
import uuid
from datetime import datetime
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import SapPurchaseRegister, Gstr2bInvoice, ReconciliationSummary, SAPPurchaseRegister, GSTR2BInvoice

router = APIRouter(tags=["reconciliation"])

def safe_float(value) -> float:
    try:
        return float(value) if value is not None else 0.0
    except (ValueError, TypeError):
        return 0.0

def normalize_period(period_input: str) -> str:
    if not period_input:
        return ""
    p = period_input.strip()
    if p.isdigit():
        return p
    
    months = {
        "january": "01", "jan": "01",
        "february": "02", "feb": "02",
        "march": "03", "mar": "03",
        "april": "04", "apr": "04",
        "may": "05",
        "june": "06", "jun": "06",
        "july": "07", "jul": "07",
        "august": "08", "aug": "08",
        "september": "09", "sep": "09", "sept": "09",
        "october": "10", "oct": "10",
        "november": "11", "nov": "11",
        "december": "12", "dec": "12",
    }
    parts = p.split()
    if len(parts) >= 2:
        m_str = parts[0].lower()
        y_str = parts[1]
        if m_str in months and y_str.isdigit():
            return f"{months[m_str]}{y_str}"
    return p

def normalize_inv(inv_str):
    if not inv_str: return ""
    return re.sub(r'[^A-Z0-9]', '', str(inv_str).upper()).lstrip('0')

def clean_gstin(gstin_str):
    if not gstin_str: return ""
    return str(gstin_str).strip().upper()

@router.get("/data/sap")
@router.get("/reconciliation/data/sap")
def get_raw_sap_data(
    gstin: str,
    period: Optional[str] = Query(None),
    return_period: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    target_period = normalize_period(period or return_period or "")
    periods = list(filter(None, set([period, return_period, target_period])))
    query = db.query(SapPurchaseRegister).filter(SapPurchaseRegister.gstin == gstin)
    if periods:
        query = query.filter(SapPurchaseRegister.return_period.in_(periods))
    records = query.all()
    
    res = []
    for r in records:
        res.append({
            "id": str(r.id),
            "gstin": r.gstin,
            "vendor_gstin": r.vendor_gstin,
            "vendor_name": r.vendor_name,
            "sap_doc_no": r.sap_doc_no,
            "document_number": r.document_number,
            "document_date": str(r.document_date) if r.document_date else None,
            "taxable_value": safe_float(r.taxable_value),
            "cgst": safe_float(r.cgst),
            "sgst": safe_float(r.sgst),
            "igst": safe_float(r.igst),
            "cess": safe_float(r.cess),
            "total_tax": safe_float(r.total_tax),
            "total_value": safe_float(r.total_value),
            "return_period": r.return_period,
        })
    return res

@router.get("/data/gstr2b")
@router.get("/reconciliation/data/gstr2b")
def get_raw_gstr2b_data(
    gstin: str,
    period: Optional[str] = Query(None),
    return_period: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    target_period = normalize_period(period or return_period or "")
    periods = list(filter(None, set([period, return_period, target_period])))
    query = db.query(Gstr2bInvoice).filter(Gstr2bInvoice.gstin == gstin)
    if periods:
        query = query.filter(Gstr2bInvoice.return_period.in_(periods))
    records = query.all()
    
    res = []
    for r in records:
        res.append({
            "id": str(r.id),
            "gstin": r.gstin,
            "supplier_gstin": r.supplier_gstin,
            "supplier_name": r.supplier_name,
            "invoice_number": r.invoice_number,
            "invoice_date": str(r.invoice_date) if r.invoice_date else None,
            "invoice_type": r.invoice_type,
            "taxable_value": safe_float(r.taxable_value),
            "cgst": safe_float(r.cgst),
            "sgst": safe_float(r.sgst),
            "igst": safe_float(r.igst),
            "total_tax": safe_float(r.total_tax),
            "total_value": safe_float(r.total_value),
            "itc_available": r.itc_available,
            "ims_status": r.ims_status,
            "return_period": r.return_period,
        })
    return res

@router.post("/reconcile/run")
@router.post("/api/v1/reconcile/run")
def run_reconciliation(
    gstin: str, 
    period: Optional[str] = Query(None), 
    return_period: Optional[str] = Query(None), 
    db: Session = Depends(get_db)
):
    req_period = period or return_period or ""
    target_period = normalize_period(req_period) if req_period else ""
    periods = list(filter(None, set([req_period, target_period])))

    try:
        # Clear previous reconciliation run
        del_query = db.query(ReconciliationSummary).filter(ReconciliationSummary.gstin == gstin)
        if periods:
            del_query = del_query.filter(ReconciliationSummary.return_period.in_(periods))
        del_query.delete(synchronize_session=False)
        db.commit()


        # Fetch SAP Records
        sap_query = db.query(SapPurchaseRegister).filter(SapPurchaseRegister.gstin == gstin)
        if periods:
            sap_query = sap_query.filter(SapPurchaseRegister.return_period.in_(periods))
        sap_records = sap_query.all()

        # Fetch GST Records
        gst_query = db.query(Gstr2bInvoice).filter(Gstr2bInvoice.gstin == gstin)
        if periods:
            gst_query = gst_query.filter(Gstr2bInvoice.return_period.in_(periods))
        gst_records = gst_query.all()

        pending_sap = {sap.id: sap for sap in sap_records}
        pending_gst = {gst.id: gst for gst in gst_records}
        results = []

        def add_result(sap, gst, level, status, score):
            results.append(ReconciliationSummary(
                gstin=gstin,
                return_period=req_period or target_period,
                sap_id=sap.id if sap else None,
                gst_id=gst.id if gst else None,
                match_level=level,
                match_status=status,
                similarity_score=score
            ))

        sap_count = len(sap_records)
        gst_count = len(gst_records)

        print(f"--- DEBUG: RECO ENGINE TRIGGERED ---")
        print(f"Target GSTIN: {gstin} | Period: {req_period}")
        print(f"Total SAP Records Found in DB: {sap_count}")
        print(f"Total GSTR-2B Records Found in DB: {gst_count}")

        if sap_count > 0 and gst_count > 0:
            sample_sap = sap_records[0]
            sample_gst = gst_records[0]
            print(f"SAMPLE SAP -> Vendor GSTIN: '{sample_sap.vendor_gstin}', Inv: '{sample_sap.document_number}'")
            print(f"SAMPLE GST -> Supplier GSTIN: '{sample_gst.supplier_gstin}', Inv: '{sample_gst.invoice_number}'")
        print(f"------------------------------------")

        # --- LEVEL 1: Exact Match ---
        matched_sap_ids, matched_gst_ids = set(), set()
        for sap_id, sap in pending_sap.items():
            for gst_id, gst in pending_gst.items():
                if gst_id in matched_gst_ids:
                    continue
                
                if (clean_gstin(sap.vendor_gstin) == clean_gstin(gst.supplier_gstin) and 
                    str(sap.document_number or "").strip() == str(gst.invoice_number or "").strip() and 
                    sap.document_date == gst.invoice_date and 
                    abs(safe_float(sap.taxable_value) - safe_float(gst.taxable_value)) <= 1.0 and 
                    abs(safe_float(sap.total_tax) - safe_float(gst.total_tax)) <= 1.0):
                    
                    add_result(sap, gst, "Level 1: Exact Match", "Ready to Claim", 1.0)
                    matched_sap_ids.add(sap_id)
                    matched_gst_ids.add(gst_id)
                    break

        for s_id in matched_sap_ids: del pending_sap[s_id]
        for g_id in matched_gst_ids: del pending_gst[g_id]

        # --- LEVEL 2: Normalized Match ---
        matched_sap_ids.clear()
        matched_gst_ids.clear()
        for sap_id, sap in pending_sap.items():
            sap_norm = normalize_inv(sap.document_number)
            for gst_id, gst in pending_gst.items():
                if gst_id in matched_gst_ids:
                    continue
                gst_norm = normalize_inv(gst.invoice_number)
                if (clean_gstin(sap.vendor_gstin) == clean_gstin(gst.supplier_gstin) and sap_norm == gst_norm and 
                    abs(safe_float(sap.taxable_value) - safe_float(gst.taxable_value)) <= 1.0 and 
                    abs(safe_float(sap.total_tax) - safe_float(gst.total_tax)) <= 1.0):
                    
                    add_result(sap, gst, "Level 2: Normalized Match", "Ready to Claim", 1.0)
                    matched_sap_ids.add(sap_id)
                    matched_gst_ids.add(gst_id)
                    break

        for s_id in matched_sap_ids: del pending_sap[s_id]
        for g_id in matched_gst_ids: del pending_gst[g_id]

        # --- LEVEL 3: Financial Signature Match ---
        matched_sap_ids.clear()
        matched_gst_ids.clear()
        for sap_id, sap in pending_sap.items():
            if not sap.document_date: continue
            sap_norm = normalize_inv(sap.document_number)
            
            for gst_id, gst in pending_gst.items():
                if gst_id in matched_gst_ids or not gst.invoice_date: continue
                gst_norm = normalize_inv(gst.invoice_number)
                
                date_diff = abs((sap.document_date - gst.invoice_date).days)
                inv_similarity = difflib.SequenceMatcher(None, sap_norm, gst_norm).ratio()
                
                if (clean_gstin(sap.vendor_gstin) == clean_gstin(gst.supplier_gstin) and 
                    date_diff <= 3 and 
                    abs(safe_float(sap.taxable_value) - safe_float(gst.taxable_value)) <= 1.0 and 
                    abs(safe_float(sap.total_tax) - safe_float(gst.total_tax)) <= 1.0 and
                    inv_similarity > 0.40):
                    
                    add_result(sap, gst, "Level 3: Financial Signature", "Review Required", 0.9)
                    matched_sap_ids.add(sap_id)
                    matched_gst_ids.add(gst_id)
                    break

        for s_id in matched_sap_ids: del pending_sap[s_id]
        for g_id in matched_gst_ids: del pending_gst[g_id]

        # --- LEVEL 4: Fuzzy Match ---
        matched_sap_ids.clear()
        matched_gst_ids.clear()
        for sap_id, sap in pending_sap.items():
            sap_norm = normalize_inv(sap.document_number)
            for gst_id, gst in pending_gst.items():
                if gst_id in matched_gst_ids: continue
                gst_norm = normalize_inv(gst.invoice_number)
                score = difflib.SequenceMatcher(None, sap_norm, gst_norm).ratio()
                
                if (clean_gstin(sap.vendor_gstin) == clean_gstin(gst.supplier_gstin) and 
                    score >= 0.75 and 
                    abs(safe_float(sap.total_tax) - safe_float(gst.total_tax)) <= 1.0):
                    
                    add_result(sap, gst, f"Level 4: Fuzzy Match ({int(score*100)}%)", "Review Required", round(score, 2))
                    matched_sap_ids.add(sap_id)
                    matched_gst_ids.add(gst_id)
                    break

        for s_id in matched_sap_ids: del pending_sap[s_id]
        for g_id in matched_gst_ids: del pending_gst[g_id]

        # --- UNMATCHED ---
        for sap in pending_sap.values(): add_result(sap, None, "Unmatched", "Missing in Portal", 0.0)
        for gst in pending_gst.values(): add_result(None, gst, "Unmatched", "Missing in SAP", 0.0)

        db.bulk_save_objects(results)
        db.commit()
        return {"status": "success", "message": "Engine executed"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reconcile/results")
@router.get("/api/v1/reconcile/results")
def get_reconciliation_results(
    gstin: str, 
    period: Optional[str] = Query(None), 
    return_period: Optional[str] = Query(None), 
    db: Session = Depends(get_db)
):
    req_period = period or return_period or ""
    target_period = normalize_period(req_period) if req_period else ""
    periods = list(filter(None, set([req_period, target_period])))

    query = db.query(ReconciliationSummary).options(
        joinedload(ReconciliationSummary.sap_record),
        joinedload(ReconciliationSummary.gst_record)
    ).filter(ReconciliationSummary.gstin == gstin)
    
    if periods:
        query = query.filter(ReconciliationSummary.return_period.in_(periods))
    
    results = query.all()
    payload = []

    for r in results:
        sap = r.sap_record or (db.query(SapPurchaseRegister).filter_by(id=r.sap_id).first() if r.sap_id else None)
        gst = r.gst_record or (db.query(Gstr2bInvoice).filter_by(id=r.gst_id).first() if r.gst_id else None)

        doc_type = "B2B"

        if gst and gst.invoice_type in ["C", "D"]:
            doc_type = "CDNR"
        elif gst and gst.invoice_type == "AMENDMENT":
            doc_type = "B2BA"
        elif sap and (safe_float(sap.total_tax) < 0 or safe_float(sap.taxable_value) < 0):
            doc_type = "CDNR"

        sap_payload = {
            "id": str(sap.id),
            "vendor_name": sap.vendor_name or "-",
            "vendor_gstin": sap.vendor_gstin or "-",
            "invoice_num": sap.document_number or "-",
            "invoice_date": sap.document_date.strftime('%d %b %Y') if hasattr(sap.document_date, 'strftime') else str(sap.document_date or "-"),
            "total_tax": safe_float(sap.total_tax),
            "taxable_value": safe_float(sap.taxable_value),
        } if sap else None

        gst_payload = {
            "id": str(gst.id),
            "supplier_name": gst.supplier_name or "-",
            "supplier_gstin": gst.supplier_gstin or "-",
            "invoice_num": gst.invoice_number or "-",
            "invoice_date": gst.invoice_date.strftime('%d %b %Y') if hasattr(gst.invoice_date, 'strftime') else str(gst.invoice_date or "-"),
            "total_tax": safe_float(gst.total_tax),
            "taxable_value": safe_float(gst.taxable_value),
            "itc_available": getattr(gst, 'itc_available', 'Y'),
            "invoice_type": getattr(gst, 'invoice_type', None),
        } if gst else None

        payload.append({
            "match_id": str(r.id),
            "id": str(r.id),
            "match_level": r.match_level,
            "match_status": r.match_status,
            "similarity_score": safe_float(r.similarity_score),
            "doc_type": doc_type,
            "invoice_type": gst.invoice_type if gst else None,
            "sap_record": sap_payload,
            "gst_record": gst_payload
        })
    return payload


class ManualMatchRequest(BaseModel):
    sap_id: str
    gst_id: str

@router.post("/reconcile/manual-match")
@router.post("/api/v1/reconcile/manual-match")
def force_manual_match(payload: ManualMatchRequest, db: Session = Depends(get_db)):
    try:
        sap_raw_id = payload.sap_id
        gst_raw_id = payload.gst_id

        # Convert string to UUID if valid 36-char string
        sap_uuid = uuid.UUID(sap_raw_id) if isinstance(sap_raw_id, str) and len(sap_raw_id) == 36 else sap_raw_id
        gst_uuid = uuid.UUID(gst_raw_id) if isinstance(gst_raw_id, str) and len(gst_raw_id) == 36 else gst_raw_id

        # 1. Delete existing unmatched or summary records referencing either sap_id or gst_id
        db.query(ReconciliationSummary).filter(
            (ReconciliationSummary.sap_id == sap_uuid) | 
            (ReconciliationSummary.gst_id == gst_uuid)
        ).delete(synchronize_session=False)
        
        # 2. Fetch base records
        sap = db.query(SapPurchaseRegister).filter_by(id=sap_uuid).first()
        gst = db.query(Gstr2bInvoice).filter_by(id=gst_uuid).first()

        if not sap:
            sap = db.query(SAPPurchaseRegister).filter_by(id=sap_uuid).first()
        if not gst:
            gst = db.query(GSTR2BInvoice).filter_by(id=gst_uuid).first()

        if not sap or not gst:
            raise HTTPException(status_code=404, detail="SAP or GSTR-2B record not found in database")
        
        # 3. Create manually linked summary record
        new_match = ReconciliationSummary(
            id=uuid.uuid4(),
            gstin=sap.gstin,
            return_period=sap.return_period,
            sap_id=sap.id,
            gst_id=gst.id,
            match_level="Manual Override",
            match_status="Ready to Claim",
            similarity_score=1.0
        )
        db.add(new_match)
        db.commit()
        
        print(f"--- MANUAL MATCH SUCCESS: SAP {sap.document_number} linked to GST {gst.invoice_number} ---")
        return {"status": "success", "message": f"Successfully force matched SAP {sap.document_number} with GSTR-2B {gst.invoice_number}!"}
    
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        print(f"MANUAL MATCH ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class UnlinkMatchRequest(BaseModel):
    match_id: str

@router.post("/reconcile/unlink-match")
@router.post("/api/v1/reconcile/unlink-match")
def unlink_manual_match(payload: UnlinkMatchRequest, db: Session = Depends(get_db)):
    try:
        raw_id = payload.match_id
        match_uuid = uuid.UUID(raw_id) if isinstance(raw_id, str) and len(raw_id) == 36 else raw_id

        # Delete summary record by id, sap_id, or gst_id
        deleted_count = db.query(ReconciliationSummary).filter(
            (ReconciliationSummary.id == match_uuid) |
            (ReconciliationSummary.sap_id == match_uuid) |
            (ReconciliationSummary.gst_id == match_uuid)
        ).delete(synchronize_session=False)
        
        db.commit()
        return {"status": "success", "message": f"Successfully unlinked record! ({deleted_count} match entry removed)"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))




