import type { RecoRecord } from './mockData';

export interface SapRawRecord {
  id: string;
  gstin: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_num: string;
  document_number: string;
  invoice_date: string;
  document_date: string;
  taxable_value: number;
  total_tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  return_period: string;
  reconciliation_status?: string;
  match_level?: string;
  matched_gstr_invoice_number?: string | null;
  matched_gstr_total_tax?: number | null;
  matched_gstr_supplier_name?: string | null;
}

export interface Gstr2bRawRecord {
  id: string;
  gstin: string;
  supplier_name: string;
  supplier_gstin: string;
  invoice_num: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  taxable_value: number;
  total_tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  itc_available: string;
  return_period: string;
  reconciliation_status?: string;
  match_level?: string;
  matched_sap_document_number?: string | null;
  matched_sap_total_tax?: number | null;
  matched_sap_vendor_name?: string | null;
}

export const MOCK_SAP_RECORDS: SapRawRecord[] = [
  {
    id: 'sap-101',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Siemens India Pvt Ltd',
    vendor_gstin: '27AAACS1420B1Z8',
    invoice_num: 'INV/2026/9081',
    document_number: '510002931',
    invoice_date: '2026-06-10',
    document_date: '2026-06-11',
    taxable_value: 450000.0,
    total_tax: 81000.0,
    cgst: 40500.0,
    sgst: 40500.0,
    igst: 0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-102',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Tata Steel Limited',
    vendor_gstin: '20AAACT2040D1ZP',
    invoice_num: 'TSL-JUN-4410',
    document_number: '510002932',
    invoice_date: '2026-06-12',
    document_date: '2026-06-12',
    taxable_value: 1250000.0,
    total_tax: 225000.0,
    cgst: 0,
    sgst: 0,
    igst: 225000.0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-103',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Reliance Industries Ltd',
    vendor_gstin: '24AAACR5500A1Z5',
    invoice_num: 'RIL-2026-00445',
    document_number: '510002933',
    invoice_date: '2026-06-15',
    document_date: '2026-06-15',
    taxable_value: 820000.0,
    total_tax: 147600.0,
    cgst: 0,
    sgst: 0,
    igst: 147600.0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-104',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Bosch Automotive Components',
    vendor_gstin: '29AAACB1000F1Z4',
    invoice_num: 'BOS/IN/8812',
    document_number: '510002934',
    invoice_date: '2026-06-18',
    document_date: '2026-06-19',
    taxable_value: 340000.0,
    total_tax: 61200.0,
    cgst: 30600.0,
    sgst: 30600.0,
    igst: 0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-105',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Larsen & Toubro Ltd',
    vendor_gstin: '27AAACL0123M1Z2',
    invoice_num: 'LT/ENG/2026/77',
    document_number: '510002935',
    invoice_date: '2026-06-20',
    document_date: '2026-06-20',
    taxable_value: 2100000.0,
    total_tax: 378000.0,
    cgst: 189000.0,
    sgst: 189000.0,
    igst: 0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-106',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Infosys BPM Solutions',
    vendor_gstin: '29AAACI1111H1Z9',
    invoice_num: 'INF/2026/0991',
    document_number: '510002936',
    invoice_date: '2026-06-22',
    document_date: '2026-06-22',
    taxable_value: 600000.0,
    total_tax: 108000.0,
    cgst: 54000.0,
    sgst: 54000.0,
    igst: 0,
    return_period: 'June 2026',
  },
  {
    id: 'sap-107',
    gstin: '26AAACW1018K1ZH',
    vendor_name: 'Hindalco Industries Ltd',
    vendor_gstin: '27AAACH0099K1Z1',
    invoice_num: 'HND-2026-554',
    document_number: '510002937',
    invoice_date: '2026-06-25',
    document_date: '2026-06-26',
    taxable_value: 950000.0,
    total_tax: 171000.0,
    cgst: 85500.0,
    sgst: 85500.0,
    igst: 0,
    return_period: 'June 2026',
  },
];

export const MOCK_GSTR2B_RECORDS: Gstr2bRawRecord[] = [
  {
    id: 'gst-201',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'SIEMENS INDIA PRIVATE LIMITED',
    supplier_gstin: '27AAACS1420B1Z8',
    invoice_num: 'INV/2026/9081',
    invoice_number: 'INV/2026/9081',
    invoice_date: '2026-06-10',
    invoice_type: 'B2B',
    taxable_value: 450000.0,
    total_tax: 81000.0,
    cgst: 40500.0,
    sgst: 40500.0,
    igst: 0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
  {
    id: 'gst-202',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'TATA STEEL LIMITED',
    supplier_gstin: '20AAACT2040D1ZP',
    invoice_num: 'TSL-JUN-4410',
    invoice_number: 'TSL-JUN-4410',
    invoice_date: '2026-06-12',
    invoice_type: 'B2B',
    taxable_value: 1250000.0,
    total_tax: 225000.0,
    cgst: 0,
    sgst: 0,
    igst: 225000.0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
  {
    id: 'gst-203',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'RELIANCE INDUSTRIES LTD',
    supplier_gstin: '24AAACR5500A1Z5',
    invoice_num: 'RIL-2026-00445',
    invoice_number: 'RIL-2026-00445',
    invoice_date: '2026-06-15',
    invoice_type: 'B2B',
    taxable_value: 820000.0,
    total_tax: 147600.0,
    cgst: 0,
    sgst: 0,
    igst: 147600.0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
  {
    id: 'gst-204',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'BOSCH AUTOMOTIVE COMPONENTS',
    supplier_gstin: '29AAACB1000F1Z4',
    invoice_num: 'BOS-IN-8812', // slight variation
    invoice_number: 'BOS-IN-8812',
    invoice_date: '2026-06-18',
    invoice_type: 'B2B',
    taxable_value: 340000.0,
    total_tax: 61200.0,
    cgst: 30600.0,
    sgst: 30600.0,
    igst: 0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
  {
    id: 'gst-205',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'LARSEN AND TOUBRO LIMITED',
    supplier_gstin: '27AAACL0123M1Z2',
    invoice_num: 'LT/ENG/2026/77',
    invoice_number: 'LT/ENG/2026/77',
    invoice_date: '2026-06-20',
    invoice_type: 'B2B',
    taxable_value: 2050000.0, // slight value difference
    total_tax: 369000.0,
    cgst: 184500.0,
    sgst: 184500.0,
    igst: 0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
  {
    id: 'gst-208',
    gstin: '26AAACW1018K1ZH',
    supplier_name: 'ABB INDIA LIMITED',
    supplier_gstin: '29AAACA0001K1Z2',
    invoice_num: 'ABB/JUN/9912',
    invoice_number: 'ABB/JUN/9912',
    invoice_date: '2026-06-28',
    invoice_type: 'B2B',
    taxable_value: 780000.0,
    total_tax: 140400.0,
    cgst: 70200.0,
    sgst: 70200.0,
    igst: 0,
    itc_available: 'Y',
    return_period: 'June 2026',
  },
];

export const generateMockRecoResults = (
  sapRecords: SapRawRecord[] = MOCK_SAP_RECORDS,
  gstrRecords: Gstr2bRawRecord[] = MOCK_GSTR2B_RECORDS
): RecoRecord[] => {
  const results: RecoRecord[] = [];
  const matchedGstrIds = new Set<string>();

  // 1. Level 1 & Level 2 Matching Logic
  sapRecords.forEach((sap) => {
    // Find matching GSTR record
    const match = gstrRecords.find((gstr) => {
      if (matchedGstrIds.has(gstr.id)) return false;
      const gstinMatch = sap.vendor_gstin === gstr.supplier_gstin;
      const invCleanSap = sap.invoice_num.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const invCleanGstr = gstr.invoice_num.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const invMatch = invCleanSap === invCleanGstr || invCleanSap.includes(invCleanGstr) || invCleanGstr.includes(invCleanSap);
      return gstinMatch && invMatch;
    });

    if (match) {
      matchedGstrIds.add(match.id);
      const taxDiff = Math.abs(sap.total_tax - match.total_tax);
      let matchLevel = 'Level 1: Exact Match';
      let matchStatus: 'Ready to Claim' | 'Review Required' | 'Unmatched' = 'Ready to Claim';
      let score = 100;

      if (taxDiff > 5) {
        matchLevel = 'Level 3: Amount Discrepancy';
        matchStatus = 'Review Required';
        score = 85;
      } else if (sap.invoice_num !== match.invoice_num) {
        matchLevel = 'Level 2: Normalized Match';
        matchStatus = 'Ready to Claim';
        score = 95;
      }

      results.push({
        id: `m-${sap.id}-${match.id}`,
        match_id: `m-${sap.id}-${match.id}`,
        match_level: matchLevel,
        match_status: matchStatus,
        similarity_score: score,
        confidence_score: score,
        doc_type: match.invoice_type || 'B2B',
        invoice_type: match.invoice_type || 'B2B',
        vendor_name: sap.vendor_name,
        vendor_gstin: sap.vendor_gstin,
        invoice_num: sap.invoice_num,
        invoice_date: sap.invoice_date,
        total_tax: sap.total_tax,
        sap_taxable_value: sap.taxable_value,
        supplier_name: match.supplier_name,
        supplier_gstin: match.supplier_gstin,
        portal_invoice_num: match.invoice_num,
        portal_invoice_date: match.invoice_date,
        portal_total_tax: match.total_tax,
        portal_taxable_value: match.taxable_value,
        itc_available: match.itc_available,
        return_period: sap.return_period,
        sap_record: sap,
        gst_record: match,
      });
    } else {
      results.push({
        id: `unm-sap-${sap.id}`,
        match_id: `unm-sap-${sap.id}`,
        match_level: 'Unmatched',
        match_status: 'Unmatched',
        similarity_score: 0,
        confidence_score: 0,
        doc_type: 'B2B',
        vendor_name: sap.vendor_name,
        vendor_gstin: sap.vendor_gstin,
        invoice_num: sap.invoice_num,
        invoice_date: sap.invoice_date,
        total_tax: sap.total_tax,
        sap_taxable_value: sap.taxable_value,
        supplier_name: '-',
        portal_invoice_num: '-',
        portal_invoice_date: '-',
        portal_total_tax: 0,
        return_period: sap.return_period,
        sap_record: sap,
        gst_record: null,
      });
    }
  });

  // GSTR Records not in SAP
  gstrRecords.forEach((gstr) => {
    if (!matchedGstrIds.has(gstr.id)) {
      results.push({
        id: `unm-gst-${gstr.id}`,
        match_id: `unm-gst-${gstr.id}`,
        match_level: 'Unmatched: Missing in SAP',
        match_status: 'Unmatched',
        similarity_score: 0,
        confidence_score: 0,
        doc_type: gstr.invoice_type || 'B2B',
        vendor_name: '-',
        invoice_num: '-',
        invoice_date: '-',
        total_tax: 0,
        supplier_name: gstr.supplier_name,
        supplier_gstin: gstr.supplier_gstin,
        portal_invoice_num: gstr.invoice_num,
        portal_invoice_date: gstr.invoice_date,
        portal_total_tax: gstr.total_tax,
        portal_taxable_value: gstr.taxable_value,
        itc_available: gstr.itc_available,
        return_period: gstr.return_period,
        sap_record: null,
        gst_record: gstr,
      });
    }
  });

  return results;
};
