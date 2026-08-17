import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AgGridWorkspace } from './AgGridWorkspace';
import { FilterPanel } from './FilterPanel';
import { DiscrepancyPanel } from './DiscrepancyPanel';
import { ActionBar } from './ActionBar';
import type { RecoRecord } from '../../data/mockData';

export const Workspace: React.FC = () => {
  const { records, sapRawRecords, gstr2bRawRecords } = useAppStore();

  // Filtering & View Controls (lifted from AgGrid to share with FilterPanel)
  const [quickFilterText, setQuickFilterText] = useState<string>('');
  const [globalGstinFilter, setGlobalGstinFilter] = useState<string>('');

  // Document Tab: B2B | CDNR | B2BA | RAW_SAP | RAW_GSTR2B
  const [docTab, setDocTab] = useState<'B2B' | 'CDNR' | 'B2BA' | 'RAW_SAP' | 'RAW_GSTR2B'>('B2B');
  
  // Sub-Tab: MATCHED | REVIEW | UNMATCHED | MANUAL
  const [subTab, setSubTab] = useState<'MATCHED' | 'REVIEW' | 'UNMATCHED' | 'MANUAL'>('MATCHED');

  // Document Type Filter Helper
  const isDocTypeMatch = (r: RecoRecord, targetDoc: 'B2B' | 'CDNR' | 'B2BA') => {
    const sapTax = r.sap_record?.total_tax ?? r.total_tax ?? 0;
    const gstTax = r.gst_record?.total_tax ?? r.portal_total_tax ?? 0;

    if (targetDoc === 'CDNR') {
      return (
        r.doc_type === 'CDNR' ||
        r.invoice_type === 'C' ||
        r.invoice_type === 'D' ||
        sapTax < 0 ||
        gstTax < 0
      );
    }
    if (targetDoc === 'B2BA') {
      return r.doc_type === 'B2BA' || r.invoice_type === 'AMENDMENT' || r.invoice_type === 'A';
    }
    return (
      (!r.doc_type || r.doc_type === 'B2B' || r.doc_type === 'R') &&
      r.invoice_type !== 'C' &&
      r.invoice_type !== 'D' &&
      r.invoice_type !== 'AMENDMENT' &&
      r.invoice_type !== 'A' &&
      sapTax >= 0 &&
      gstTax >= 0
    );
  };

  // Counts for filter panel
  const counts = useMemo(() => {
    const b2b = records.filter(r => isDocTypeMatch(r, 'B2B'));
    const cdnr = records.filter(r => isDocTypeMatch(r, 'CDNR'));
    const b2ba = records.filter(r => isDocTypeMatch(r, 'B2BA'));

    const currentDocRecords = docTab === 'CDNR' ? cdnr : docTab === 'B2BA' ? b2ba : b2b;

    return {
      b2bTotal: b2b.length,
      cdnrTotal: cdnr.length,
      b2baTotal: b2ba.length,
      
      matched: currentDocRecords.filter(r => r.match_status === 'Ready to Claim' && !r.match_level?.includes('Manual')).length,
      review: currentDocRecords.filter(r => r.match_status === 'Review Required').length,
      unmatched: currentDocRecords.filter(r => 
        r.match_status === 'Unmatched' || 
        r.match_status === 'Missing in Portal' || 
        r.match_status === 'Missing in SAP' || 
        !r.gst_record || 
        !r.sap_record
      ).length,
      manual: currentDocRecords.filter(r => r.match_level === 'Manual Override' || r.match_level?.includes('Manual')).length,
    };
  }, [records, docTab]);

  return (
    <div className="flex-1 flex relative h-full min-h-0 overflow-hidden">
      {/* Sticky Left Filter Panel */}
      <FilterPanel
        quickFilterText={quickFilterText}
        setQuickFilterText={setQuickFilterText}
        globalGstinFilter={globalGstinFilter}
        setGlobalGstinFilter={setGlobalGstinFilter}
        docTab={docTab}
        setDocTab={setDocTab}
        subTab={subTab}
        setSubTab={setSubTab}
        counts={counts}
        sapRawCount={sapRawRecords.length}
        gstrRawCount={gstr2bRawRecords.length}
      />

      {/* Main AG Grid Workspace */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AgGridWorkspace
          quickFilterText={quickFilterText}
          globalGstinFilter={globalGstinFilter}
          docTab={docTab}
          subTab={subTab}
        />
      </div>

      {/* Floating Bottom Action Bar for Bulk Selection */}
      <ActionBar />

      {/* Slide-up Discrepancy Analysis Panel */}
      <DiscrepancyPanel />
    </div>
  );
};
