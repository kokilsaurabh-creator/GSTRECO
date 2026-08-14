import re
from datetime import datetime
import difflib

def clean_gstin(gstin_str) -> str:
    if not gstin_str:
        return ""
    return str(gstin_str).strip().upper()

def normalize_invoice_number(inv_str: str) -> str:
    if not inv_str:
        return ""
    inv_str = str(inv_str).upper()
    inv_str = re.sub(r'[^A-Z0-9]', '', inv_str)
    return inv_str.lstrip('0')

def get_similarity_score(str1: str, str2: str) -> float:
    return difflib.SequenceMatcher(None, str1, str2).ratio()

def execute_reconciliation_engine(sap_records: list, gst_records: list, gstin: str, return_period: str):
    results = []
    pending_sap = sap_records.copy()
    pending_gst = gst_records.copy()

    # LEVEL 1: EXACT MATCH (Strict GSTIN Equality)
    for sap in pending_sap[:]:
        sap_gstin = clean_gstin(sap.get('vendor_gstin'))
        if not sap_gstin:
            continue
        for gst in pending_gst[:]:
            gst_gstin = clean_gstin(gst.get('supplier_gstin'))
            if sap_gstin != gst_gstin:
                continue

            if (sap['document_number'] == gst['invoice_number'] and
                sap['document_date'] == gst['invoice_date'] and
                abs(sap['taxable_value'] - gst['taxable_value']) <= 1.0 and
                abs(sap['total_tax'] - gst['total_tax']) <= 1.0):
                
                results.append({
                    "gstin": gstin, "return_period": return_period,
                    "sap_id": sap['id'], "gst_id": gst['id'],
                    "match_level": "Level 1: Exact Match",
                    "match_status": "Ready to Claim", "similarity_score": 1.0
                })
                pending_sap.remove(sap)
                pending_gst.remove(gst)
                break

    # LEVEL 2: NORMALIZED STRING MATCH (Strict GSTIN Equality)
    for sap in pending_sap[:]:
        sap_gstin = clean_gstin(sap.get('vendor_gstin'))
        if not sap_gstin:
            continue
        sap_norm = normalize_invoice_number(sap['document_number'])
        for gst in pending_gst[:]:
            gst_gstin = clean_gstin(gst.get('supplier_gstin'))
            if sap_gstin != gst_gstin:
                continue

            gst_norm = normalize_invoice_number(gst['invoice_number'])
            if (sap_norm == gst_norm and
                abs(sap['taxable_value'] - gst['taxable_value']) <= 1.0 and
                abs(sap['total_tax'] - gst['total_tax']) <= 1.0):
                
                results.append({
                    "gstin": gstin, "return_period": return_period,
                    "sap_id": sap['id'], "gst_id": gst['id'],
                    "match_level": "Level 2: Normalized Match",
                    "match_status": "Ready to Claim", "similarity_score": 1.0
                })
                pending_sap.remove(sap)
                pending_gst.remove(gst)
                break

    # LEVEL 3: FINANCIAL SIGNATURE MATCH (Date Shift + Amount Match + Loose Invoice Check)
    for sap in pending_sap[:]:
        sap_gstin = clean_gstin(sap.get('vendor_gstin'))
        if not sap_gstin or not sap.get('document_date'):
            continue
        sap_norm = normalize_invoice_number(sap['document_number'])
        sap_date = datetime.strptime(sap['document_date'], '%Y-%m-%d') if isinstance(sap['document_date'], str) else sap['document_date']
        
        for gst in pending_gst[:]:
            gst_gstin = clean_gstin(gst.get('supplier_gstin'))
            if sap_gstin != gst_gstin or not gst.get('invoice_date'):
                continue

            gst_norm = normalize_invoice_number(gst['invoice_number'])
            gst_date = datetime.strptime(gst['invoice_date'], '%Y-%m-%d') if isinstance(gst['invoice_date'], str) else gst['invoice_date']
            date_diff = abs((sap_date - gst_date).days)
            inv_similarity = get_similarity_score(sap_norm, gst_norm)
            
            # STRICT FIX: Even if amounts match, the invoice numbers must be at least 40% similar to prevent stealing
            if (date_diff <= 3 and
                abs(float(sap['taxable_value']) - float(gst['taxable_value'])) <= 1.0 and
                abs(float(sap['total_tax']) - float(gst['total_tax'])) <= 1.0 and
                inv_similarity > 0.40):
                
                results.append({
                    "gstin": gstin, "return_period": return_period,
                    "sap_id": sap['id'], "gst_id": gst['id'],
                    "match_level": "Level 3: Financial Signature",
                    "match_status": "Review Required", "similarity_score": 0.90
                })
                pending_sap.remove(sap)
                pending_gst.remove(gst)
                break

    # LEVEL 4: FUZZY MATCH (Typo Catching)
    for sap in pending_sap[:]:
        sap_gstin = clean_gstin(sap.get('vendor_gstin'))
        if not sap_gstin:
            continue
        sap_norm = normalize_invoice_number(sap['document_number'])
        for gst in pending_gst[:]:
            gst_gstin = clean_gstin(gst.get('supplier_gstin'))
            if sap_gstin != gst_gstin:
                continue

            gst_norm = normalize_invoice_number(gst['invoice_number'])
            similarity = get_similarity_score(sap_norm, gst_norm)
            
            if (similarity >= 0.75 and
                abs(float(sap['total_tax']) - float(gst['total_tax'])) <= 1.0):
                
                results.append({
                    "gstin": gstin, "return_period": return_period,
                    "sap_id": sap['id'], "gst_id": gst['id'],
                    "match_level": f"Level 4: Fuzzy Match ({round(similarity*100)}%)",
                    "match_status": "Review Required", "similarity_score": round(similarity, 2)
                })
                pending_sap.remove(sap)
                pending_gst.remove(gst)
                break


    # UNMATCHED SAP RECORDS
    for sap in pending_sap:
        results.append({
            "gstin": gstin, "return_period": return_period,
            "sap_id": sap['id'], "gst_id": None,
            "match_level": "Unmatched", "match_status": "Missing in Portal", "similarity_score": 0.0
        })

    # UNMATCHED GST RECORDS
    for gst in pending_gst:
        results.append({
            "gstin": gstin, "return_period": return_period,
            "sap_id": None, "gst_id": gst['id'],
            "match_level": "Unmatched", "match_status": "Missing in SAP", "similarity_score": 0.0
        })

    return results
