import type { SapRawRecord, Gstr2bRawRecord } from '../data/mockDataFallback';
import type { RecoRecord } from '../data/mockData';

const cleanStr = (val: string | null | undefined): string => {
  if (!val) return '';
  return val.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

export const runClientSideReconciliation = (
  sapRecords: SapRawRecord[],
  gstrRecords: Gstr2bRawRecord[]
): RecoRecord[] => {
  const results: RecoRecord[] = [];
  const matchedGstrIds = new Set<string>();

  // O(1) maps for fast lookup across 15,000+ records
  const gstrByGstinMap = new Map<string, Gstr2bRawRecord[]>();
  
  for (const gstr of gstrRecords) {
    const key = (gstr.supplier_gstin || '').toUpperCase().trim();
    if (!gstrByGstinMap.has(key)) {
      gstrByGstinMap.set(key, []);
    }
    gstrByGstinMap.get(key)!.push(gstr);
  }

  // Iterate over SAP Purchase Register records
  for (const sap of sapRecords) {
    const vendorGstin = (sap.vendor_gstin || '').toUpperCase().trim();
    const sapInvClean = cleanStr(sap.invoice_num);
    const candidateGstrs = gstrByGstinMap.get(vendorGstin) || [];

    let bestMatch: Gstr2bRawRecord | null = null;
    let matchLevel = 'Unmatched';
    let matchStatus: 'Ready to Claim' | 'Review Required' | 'Unmatched' = 'Unmatched';
    let score = 0;

    // Level 1: Exact GSTIN + Cleaned Invoice Number + Tax Amount
    for (const candidate of candidateGstrs) {
      if (matchedGstrIds.has(candidate.id)) continue;
      const gstrInvClean = cleanStr(candidate.invoice_num);
      const taxDiff = Math.abs((sap.total_tax || 0) - (candidate.total_tax || 0));

      if (sapInvClean === gstrInvClean && taxDiff <= 1.0) {
        bestMatch = candidate;
        matchLevel = 'Level 1: Exact Match';
        matchStatus = 'Ready to Claim';
        score = 100;
        break;
      }
    }

    // Level 2: Substring / Normalized Invoice Number Match
    if (!bestMatch) {
      for (const candidate of candidateGstrs) {
        if (matchedGstrIds.has(candidate.id)) continue;
        const gstrInvClean = cleanStr(candidate.invoice_num);
        const taxDiff = Math.abs((sap.total_tax || 0) - (candidate.total_tax || 0));

        const isSubMatch = (sapInvClean.length >= 4 && gstrInvClean.includes(sapInvClean)) ||
                           (gstrInvClean.length >= 4 && sapInvClean.includes(gstrInvClean));

        if (isSubMatch && taxDiff <= 1.0) {
          bestMatch = candidate;
          matchLevel = 'Level 2: Normalized Match';
          matchStatus = 'Ready to Claim';
          score = 95;
          break;
        }
      }
    }

    // Level 3: Tax Amount Discrepancy (Review Required)
    if (!bestMatch) {
      for (const candidate of candidateGstrs) {
        if (matchedGstrIds.has(candidate.id)) continue;
        const gstrInvClean = cleanStr(candidate.invoice_num);
        const isInvMatch = sapInvClean === gstrInvClean || 
                           (sapInvClean.length >= 4 && gstrInvClean.includes(sapInvClean)) ||
                           (gstrInvClean.length >= 4 && sapInvClean.includes(gstrInvClean));

        if (isInvMatch) {
          bestMatch = candidate;
          matchLevel = 'Level 3: Amount Discrepancy';
          matchStatus = 'Review Required';
          score = 80;
          break;
        }
      }
    }

    if (bestMatch) {
      matchedGstrIds.add(bestMatch.id);
      results.push({
        id: `m-${sap.id}-${bestMatch.id}`,
        match_id: `m-${sap.id}-${bestMatch.id}`,
        match_level: matchLevel,
        match_status: matchStatus,
        similarity_score: score,
        confidence_score: score,
        doc_type: bestMatch.invoice_type || 'B2B',
        invoice_type: bestMatch.invoice_type || 'B2B',
        vendor_name: sap.vendor_name,
        vendor_gstin: sap.vendor_gstin,
        invoice_num: sap.invoice_num,
        invoice_date: sap.invoice_date,
        total_tax: sap.total_tax,
        sap_taxable_value: sap.taxable_value,
        supplier_name: bestMatch.supplier_name,
        supplier_gstin: bestMatch.supplier_gstin,
        portal_invoice_num: bestMatch.invoice_num,
        portal_invoice_date: bestMatch.invoice_date,
        portal_total_tax: bestMatch.total_tax,
        portal_taxable_value: bestMatch.taxable_value,
        itc_available: bestMatch.itc_available,
        return_period: sap.return_period,
        sap_record: sap,
        gst_record: bestMatch,
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
  }

  // Level 4: Missing in SAP (GSTR-2B records not matched to any SAP record)
  for (const gstr of gstrRecords) {
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
  }

  return results;
};
