export interface RecoRecord {
  id: string;
  match_id?: string;
  // SAP Data (Group 1)
  vendor_name?: string;
  vendor_gstin?: string;
  invoice_num?: string;
  invoice_date?: string;
  total_tax?: number;
  sap_taxable_value?: number;
  sap_record?: {
    id?: string;
    vendor_name?: string;
    vendor_gstin?: string;
    invoice_num?: string;
    document_number?: string;
    invoice_date?: string;
    document_date?: string;
    taxable_value?: number;
    total_tax?: number;
  } | null;
  
  // Reco Engine Decision (Group 2)
  match_level: string;
  match_status: 'Ready to Claim' | 'Review Required' | 'Unmatched' | string;
  confidence_score?: number;
  similarity_score?: number;

  // GSTR-2B Data (Group 3)
  supplier_name?: string;
  supplier_gstin?: string;
  portal_invoice_num?: string;
  portal_invoice_date?: string;
  portal_total_tax?: number;
  portal_taxable_value?: number;
  gst_record?: {
    id?: string;
    supplier_name?: string;
    supplier_gstin?: string;
    invoice_num?: string;
    invoice_number?: string;
    invoice_date?: string;
    invoice_type?: string;
    taxable_value?: number;
    total_tax?: number;
    itc_available?: string;
  } | null;
  itc_available?: string;
  return_period?: string;

  // Document Type Classification
  doc_type?: 'B2B' | 'CDNR' | 'B2BA' | string;
  invoice_type?: string;
}


export const INITIAL_RECO_RECORDS: RecoRecord[] = [];

