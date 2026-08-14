from datetime import datetime
from typing import List, Dict, Any

def extract_tax_values(inv: Dict[str, Any]):
    txval = float(inv.get("txval", 0.0) or 0.0)
    cgst = float(inv.get("cgst", 0.0) or 0.0)
    sgst = float(inv.get("sgst", 0.0) or 0.0)
    igst = float(inv.get("igst", 0.0) or 0.0)
    val = float(inv.get("val", 0.0) or 0.0)

    items = inv.get("items", inv.get("itms", []))
    if isinstance(items, list) and items and txval == 0.0 and cgst == 0.0 and sgst == 0.0 and igst == 0.0:
        for itm in items:
            if isinstance(itm, dict):
                txval += float(itm.get("txval", 0.0) or 0.0)
                cgst += float(itm.get("cgst", 0.0) or 0.0)
                sgst += float(itm.get("sgst", 0.0) or 0.0)
                igst += float(itm.get("igst", 0.0) or 0.0)
                val += float(itm.get("val", 0.0) or 0.0)
    return txval, cgst, sgst, igst, val

def parse_gstr2b_json(json_payload: Dict[str, Any], target_gstin: str) -> List[Dict[str, Any]]:
    parsed_records = []
    if not isinstance(json_payload, dict):
        return parsed_records
    
    data_block = json_payload.get("data", json_payload) if isinstance(json_payload.get("data"), dict) else json_payload
    rtnprd = str(data_block.get("rtnprd", json_payload.get("rtnprd", "")))
    
    docdata = data_block.get("docdata", data_block) if isinstance(data_block.get("docdata"), dict) else data_block
    def get_date(raw_dt):
        if not raw_dt:
            return datetime.now().date()
        for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(str(raw_dt).strip(), fmt).date()
            except ValueError:
                continue
        return datetime.now().date()

    # 1. B2B Invoices
    for vendor in docdata.get("b2b", []) if isinstance(docdata, dict) else []:
        supplier_gstin = str(vendor.get("ctin", vendor.get("gstin", "")))
        supplier_name = str(vendor.get("trdnm", vendor.get("trade_name", "")))
        for inv in vendor.get("inv", []):
            txval, cgst, sgst, igst, val = extract_tax_values(inv)
            parsed_records.append({
                "gstin": target_gstin,
                "supplier_gstin": supplier_gstin,
                "supplier_name": supplier_name,
                "invoice_number": str(inv.get("inum", inv.get("inv_no", ""))).strip(),
                "invoice_date": get_date(inv.get("dt", inv.get("date", ""))),
                "invoice_type": str(inv.get("typ", "R")),
                "taxable_value": txval,
                "cgst": cgst,
                "sgst": sgst,
                "igst": igst,
                "total_value": val or (txval + cgst + sgst + igst),
                "itc_available": str(inv.get("itcavl", "Y")),
                "ims_status": str(inv.get("imsStatus", "N")),
                "return_period": rtnprd or "072023"
            })

    # 2. CDNR (Credit / Debit Notes)
    for vendor in docdata.get("cdnr", []) if isinstance(docdata, dict) else []:
        supplier_gstin = str(vendor.get("ctin", vendor.get("gstin", "")))
        supplier_name = str(vendor.get("trdnm", vendor.get("trade_name", "")))
        for note in vendor.get("nt", []):
            raw_txval, raw_cgst, raw_sgst, raw_igst, raw_val = extract_tax_values(note)
            parsed_records.append({
                "gstin": target_gstin,
                "supplier_gstin": supplier_gstin,
                "supplier_name": supplier_name,
                "invoice_number": str(note.get("ntnum", note.get("nt_num", ""))).strip(),
                "invoice_date": get_date(note.get("dt", note.get("date", ""))),
                "invoice_type": str(note.get("typ", note.get("ntty", "C"))),
                "taxable_value": -abs(raw_txval),
                "cgst": -abs(raw_cgst),
                "sgst": -abs(raw_sgst),
                "igst": -abs(raw_igst),
                "total_value": -abs(raw_val or (raw_txval + raw_cgst + raw_sgst + raw_igst)),
                "itc_available": str(note.get("itcavl", "Y")),
                "ims_status": str(note.get("imsStatus", "N")),
                "return_period": rtnprd or "072023"
            })

    # 3. B2BA (Amended B2B Invoices)
    for vendor in docdata.get("b2ba", []) if isinstance(docdata, dict) else []:
        supplier_gstin = str(vendor.get("ctin", vendor.get("gstin", "")))
        supplier_name = str(vendor.get("trdnm", vendor.get("trade_name", "")))
        for inv in vendor.get("inv", []):
            txval, cgst, sgst, igst, val = extract_tax_values(inv)
            parsed_records.append({
                "gstin": target_gstin,
                "supplier_gstin": supplier_gstin,
                "supplier_name": supplier_name,
                "invoice_number": str(inv.get("oinum", inv.get("inum", inv.get("inv_no", "")))).strip(),
                "invoice_date": get_date(inv.get("dt", inv.get("date", ""))),
                "invoice_type": "AMENDMENT",
                "taxable_value": txval,
                "cgst": cgst,
                "sgst": sgst,
                "igst": igst,
                "total_value": val or (txval + cgst + sgst + igst),
                "itc_available": str(inv.get("itcavl", "Y")),
                "ims_status": str(inv.get("imsStatus", "N")),
                "return_period": rtnprd or "072023"
            })

    # 4. IMPG (Import of Goods)
    for imp in docdata.get("impg", []) if isinstance(docdata, dict) else []:
        supplier_gstin = "IMPG"  # Special identifier for Imports
        supplier_name = "Import of Goods"
        txval, cgst, sgst, igst, val = extract_tax_values(imp)
        parsed_records.append({
            "gstin": target_gstin,
            "supplier_gstin": supplier_gstin,
            "supplier_name": supplier_name,
            "invoice_number": str(imp.get("boenum", imp.get("boe_num", ""))).strip(),
            "invoice_date": get_date(imp.get("boedt", imp.get("dt", ""))),
            "invoice_type": "IMPG",
            "taxable_value": txval,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_value": val or (txval + cgst + sgst + igst),
            "itc_available": str(imp.get("itcavl", "Y")),
            "ims_status": str(imp.get("imsStatus", "N")),
            "return_period": rtnprd or "072023"
        })

    return parsed_records

