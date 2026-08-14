import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatINR, formatDate } from '../../utils/formatters';
import type { RecoRecord } from '../../data/mockData';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef, ColGroupDef, RowSelectionOptions, RowStyle } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register ALL community modules (filters, floating filters, clipboard, etc.)
ModuleRegistry.registerModules([AllCommunityModule]);
import { 
  FileJson, 
  FileSpreadsheet, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  FileDiff,
  FileMinus,
  Database,
  Globe,
  Loader2,
  X,
  Search,
  Download,
  Maximize2,
  Minimize2,
  Filter,
  Link2,
  Unlink,
  ShieldCheck,
  Upload,
  CreditCard
} from 'lucide-react';

import axios from 'axios';
import { RecoProgressBanner } from './RecoProgressBanner';

const API_BASE = 'http://localhost:8000/api/v1';

// Custom Cell Renderer for Match Status Badges
const MatchStatusBadgeRenderer: React.FC<any> = (props) => {
  const status = props.value as string;
  if (!status) return null;

  if (status === 'Ready to Claim' || status === 'Completely Matched') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
        <CheckCircle2 style={{ width: 12, height: 12, marginRight: 4 }} />
        {status}
      </span>
    );
  }
  if (status === 'Review Required' || status === 'Review') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
        <AlertTriangle style={{ width: 12, height: 12, marginRight: 4 }} />
        {status}
      </span>
    );
  }
  if (status.includes('Manual')) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
        <ShieldCheck style={{ width: 12, height: 12, marginRight: 4 }} />
        Manually Matched
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
      <XCircle style={{ width: 12, height: 12, marginRight: 4 }} />
      {status}
    </span>
  );
};

export const AgGridWorkspace: React.FC = () => {
  const { 
    records, 
    sapRawRecords,
    gstr2bRawRecords,
    isLoadingData,
    fetchDashboardData,
    setSelectedRowIds, 
    activeGstin, 
    returnPeriod 
  } = useAppStore();

  const gridRef = useRef<any>(null);
  
  // Filtering & View Controls
  const [quickFilterText, setQuickFilterText] = useState<string>('');
  const [globalGstinFilter, setGlobalGstinFilter] = useState<string>('');
  const [leftSapGstinFilter, setLeftSapGstinFilter] = useState<string>('');
  const [rightGstGstinFilter, setRightGstGstinFilter] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(25); // Default 25 like Screenshot 3
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showKpiBar, setShowKpiBar] = useState<boolean>(false); // Collapsed by default to maximize grid space
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Ingestion State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadErrorLog, setUploadErrorLog] = useState<string | null>(null);

  // Document Tab: B2B | CDNR | B2BA | RAW_SAP | RAW_GSTR2B
  const [docTab, setDocTab] = useState<'B2B' | 'CDNR' | 'B2BA' | 'RAW_SAP' | 'RAW_GSTR2B'>('B2B');
  
  // Sub-Tab: MATCHED | REVIEW | UNMATCHED | MANUAL
  const [subTab, setSubTab] = useState<'MATCHED' | 'REVIEW' | 'UNMATCHED' | 'MANUAL'>('MATCHED');

  const [pinnedBottomRowData, setPinnedBottomRowData] = useState<any[]>([]);

  // Dual-Pane Manual Match State
  const [selectedSapRow, setSelectedSapRow] = useState<any | null>(null);
  const [selectedGstRow, setSelectedGstRow] = useState<any | null>(null);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [matchSuccessMsg, setMatchSuccessMsg] = useState<string | null>(null);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    fetchDashboardData(activeGstin, returnPeriod);
  }, [activeGstin, returnPeriod, fetchDashboardData]);

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
      (!r.doc_type || r.doc_type === 'B2B') &&
      r.invoice_type !== 'C' &&
      r.invoice_type !== 'D' &&
      r.invoice_type !== 'AMENDMENT' &&
      r.invoice_type !== 'A' &&
      sapTax >= 0 &&
      gstTax >= 0
    );
  };

  const docFilteredRecords = useMemo(() => {
    if (docTab === 'RAW_SAP' || docTab === 'RAW_GSTR2B') return [];
    return records.filter(r => isDocTypeMatch(r, docTab as any));
  }, [records, docTab]);

  const gstinFilteredRecords = useMemo(() => {
    if (!globalGstinFilter.trim()) return docFilteredRecords;
    const term = globalGstinFilter.trim().toUpperCase();
    return docFilteredRecords.filter(r => {
      const vGstin = r.sap_record?.vendor_gstin || r.vendor_gstin || '';
      const sGstin = r.gst_record?.supplier_gstin || r.supplier_gstin || '';
      return vGstin.toUpperCase().includes(term) || sGstin.toUpperCase().includes(term);
    });
  }, [docFilteredRecords, globalGstinFilter]);

  const gridRowData = useMemo(() => {
    if (docTab === 'RAW_SAP') {
      let dataset = sapRawRecords;
      if (globalGstinFilter.trim()) {
        const term = globalGstinFilter.trim().toUpperCase();
        dataset = dataset.filter(s => (s.vendor_gstin || '').toUpperCase().includes(term));
      }
      return dataset;
    }
    if (docTab === 'RAW_GSTR2B') {
      let dataset = gstr2bRawRecords;
      if (globalGstinFilter.trim()) {
        const term = globalGstinFilter.trim().toUpperCase();
        dataset = dataset.filter(g => (g.supplier_gstin || '').toUpperCase().includes(term));
      }
      return dataset;
    }

    if (subTab === 'MATCHED') {
      return gstinFilteredRecords.filter(r => r.match_status === 'Ready to Claim' && !r.match_level?.includes('Manual'));
    }
    if (subTab === 'REVIEW') {
      return gstinFilteredRecords.filter(r => r.match_status === 'Review Required');
    }
    if (subTab === 'MANUAL') {
      return gstinFilteredRecords.filter(r => r.match_level === 'Manual Override' || r.match_level?.includes('Manual'));
    }
    return gstinFilteredRecords.filter(r => 
      r.match_status === 'Unmatched' || 
      r.match_status === 'Missing in Portal' || 
      r.match_status === 'Missing in SAP' || 
      !r.gst_record || 
      !r.sap_record
    );
  }, [docTab, subTab, sapRawRecords, gstr2bRawRecords, gstinFilteredRecords, globalGstinFilter]);

  // Counts for document tabs & sub-tabs
  const counts = useMemo(() => {
    const b2b = records.filter(r => isDocTypeMatch(r, 'B2B'));
    const cdnr = records.filter(r => isDocTypeMatch(r, 'CDNR'));
    const b2ba = records.filter(r => isDocTypeMatch(r, 'B2BA'));

    const currentDocRecords = docTab === 'CDNR' ? cdnr : docTab === 'B2BA' ? b2ba : b2b;

    let totalTaxSum = 0;
    let readyTaxSum = 0;
    let reviewTaxSum = 0;
    let unmatchedTaxSum = 0;

    currentDocRecords.forEach(r => {
      const tax = r.gst_record?.total_tax || r.sap_record?.total_tax || r.total_tax || 0;
      totalTaxSum += tax;
      if (r.match_status === 'Ready to Claim') readyTaxSum += tax;
      else if (r.match_status === 'Review Required') reviewTaxSum += tax;
      else unmatchedTaxSum += tax;
    });

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

      totalTaxSum,
      readyTaxSum,
      reviewTaxSum,
      unmatchedTaxSum,
    };
  }, [records, docTab]);

  // Derive Unmatched SAP Records for Left Pane
  const unmatchedSapRecords = useMemo(() => {
    let sapList: any[] = [];
    
    records.forEach(r => {
      if (r.sap_record) {
        const isUnmatched = !r.gst_record || 
          r.match_status === 'Unmatched' || 
          r.match_status === 'Missing in Portal' || 
          r.match_level === 'Unmatched';
        if (isUnmatched) {
          const sapObj = r.sap_record as any;
          sapList.push({
            id: sapObj?.id || r.id,
            sap_id: sapObj?.id || r.id,
            vendor_name: sapObj?.vendor_name || r.vendor_name || '-',
            vendor_gstin: sapObj?.vendor_gstin || r.vendor_gstin || '-',
            invoice_num: sapObj?.invoice_num || r.invoice_num || '-',
            invoice_date: sapObj?.invoice_date || r.invoice_date || '-',
            total_tax: sapObj?.total_tax ?? r.total_tax ?? 0,
            taxable_value: sapObj?.taxable_value ?? 0,
            doc_type: r.doc_type || 'B2B'
          });
        }
      }
    });

    if (sapList.length === 0 && sapRawRecords.length > 0) {
      const matchedSapIds = new Set(
        records
          .filter(r => r.sap_record && r.gst_record && r.match_status === 'Ready to Claim')
          .map(r => (r.sap_record as any)?.id)
      );
      sapList = sapRawRecords
        .filter(s => !matchedSapIds.has(s.id))
        .map(s => ({
          id: s.id,
          sap_id: s.id,
          vendor_name: s.vendor_name || '-',
          vendor_gstin: s.vendor_gstin || '-',
          invoice_num: s.document_number || s.invoice_num || '-',
          invoice_date: s.document_date || s.invoice_date || '-',
          total_tax: s.total_tax ?? 0,
          taxable_value: s.taxable_value ?? 0,
          doc_type: s.doc_type || 'B2B'
        }));
    }

    if (leftSapGstinFilter.trim()) {
      const term = leftSapGstinFilter.trim().toUpperCase();
      sapList = sapList.filter(s => (s.vendor_gstin || '').toUpperCase().includes(term) || (s.vendor_name || '').toUpperCase().includes(term));
    } else if (globalGstinFilter.trim()) {
      const term = globalGstinFilter.trim().toUpperCase();
      sapList = sapList.filter(s => (s.vendor_gstin || '').toUpperCase().includes(term) || (s.vendor_name || '').toUpperCase().includes(term));
    }

    return sapList;
  }, [records, sapRawRecords, leftSapGstinFilter, globalGstinFilter]);

  // Derive Unmatched GSTR-2B Records for Right Pane
  const unmatchedGstRecords = useMemo(() => {
    let gstList: any[] = [];

    records.forEach(r => {
      if (r.gst_record) {
        const isUnmatched = !r.sap_record || 
          r.match_status === 'Unmatched' || 
          r.match_status === 'Missing in SAP' || 
          r.match_level === 'Unmatched';
        if (isUnmatched) {
          const gstObj = r.gst_record as any;
          gstList.push({
            id: gstObj?.id || r.id,
            gst_id: gstObj?.id || r.id,
            supplier_name: gstObj?.supplier_name || r.supplier_name || '-',
            supplier_gstin: gstObj?.supplier_gstin || r.supplier_gstin || '-',
            invoice_num: gstObj?.invoice_num || r.portal_invoice_num || '-',
            invoice_date: gstObj?.invoice_date || r.portal_invoice_date || '-',
            total_tax: gstObj?.total_tax ?? r.portal_total_tax ?? 0,
            taxable_value: gstObj?.taxable_value ?? 0,
            doc_type: r.doc_type || 'B2B'
          });
        }
      }
    });

    if (gstList.length === 0 && gstr2bRawRecords.length > 0) {
      const matchedGstIds = new Set(
        records
          .filter(r => r.sap_record && r.gst_record && r.match_status === 'Ready to Claim')
          .map(r => (r.gst_record as any)?.id)
      );
      gstList = gstr2bRawRecords
        .filter(g => !matchedGstIds.has(g.id))
        .map(g => ({
          id: g.id,
          gst_id: g.id,
          supplier_name: g.supplier_name || '-',
          supplier_gstin: g.supplier_gstin || '-',
          invoice_num: g.invoice_number || g.invoice_num || '-',
          invoice_date: g.invoice_date || '-',
          total_tax: g.total_tax ?? 0,
          taxable_value: g.taxable_value ?? 0,
          doc_type: g.doc_type || 'B2B'
        }));
    }

    if (rightGstGstinFilter.trim()) {
      const term = rightGstGstinFilter.trim().toUpperCase();
      gstList = gstList.filter(g => (g.supplier_gstin || '').toUpperCase().includes(term) || (g.supplier_name || '').toUpperCase().includes(term));
    } else if (globalGstinFilter.trim()) {
      const term = globalGstinFilter.trim().toUpperCase();
      gstList = gstList.filter(g => (g.supplier_gstin || '').toUpperCase().includes(term) || (g.supplier_name || '').toUpperCase().includes(term));
    }

    return gstList;
  }, [records, gstr2bRawRecords, rightGstGstinFilter, globalGstinFilter]);

  // Handle Manual Link API Call
  const handleForceManualMatch = async (sapRowParam?: any, gstRowParam?: any) => {
    const sapRow = sapRowParam || selectedSapRow;
    const gstRow = gstRowParam || selectedGstRow;

    if (!sapRow || !gstRow) return;

    setIsMatching(true);
    try {
      const sapId = sapRow.sap_id || sapRow.id;
      const gstId = gstRow.gst_id || gstRow.id;

      const res = await axios.post(`${API_BASE}/reconcile/manual-match`, {
        sap_id: String(sapId),
        gst_id: String(gstId)
      });

      const msg = res.data?.message || `Successfully matched SAP ${sapRow.invoice_num} to GSTR-2B ${gstRow.invoice_num}!`;
      setMatchSuccessMsg(msg);

      setSelectedSapRow(null);
      setSelectedGstRow(null);

      await fetchDashboardData(activeGstin, returnPeriod);
      setSubTab('MANUAL');

      setTimeout(() => setMatchSuccessMsg(null), 5000);

    } catch (err: any) {
      console.error('Error in manual match:', err);
      alert(`Manual Match Error: ${err.response?.data?.detail || err.message || 'Failed to match records'}`);
    } finally {
      setIsMatching(false);
    }
  };

  // Handle Unlink / Undo Manual Match API Call
  const handleUnlinkMatch = async (matchId: string) => {
    if (!matchId) return;
    if (!confirm('Are you sure you want to unlink and undo this match?')) return;

    try {
      const res = await axios.post(`${API_BASE}/reconcile/unlink-match`, { match_id: String(matchId) });
      setMatchSuccessMsg(res.data?.message || 'Record unlinked successfully!');
      await fetchDashboardData(activeGstin, returnPeriod);
      setTimeout(() => setMatchSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error unlinking record:', err);
      alert(`Unlink Error: ${err.response?.data?.detail || err.message || 'Failed to unlink record'}`);
    }
  };

  // Handle CSV Export
  const handleExportCsv = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `GST_Reco_${docTab}_${subTab}_${activeGstin}_${returnPeriod}.csv`
      });
    }
  }, [docTab, subTab, activeGstin, returnPeriod]);

  // Smart Candidate Suggestion Renderer for Right (GSTR-2B) Pane
  const CandidateMatchCellRenderer = (props: any) => {
    const gstRow = props.data;
    if (!selectedSapRow || !gstRow) return null;

    const sameGstin = selectedSapRow.vendor_gstin && gstRow.supplier_gstin && 
      selectedSapRow.vendor_gstin.toUpperCase() === gstRow.supplier_gstin.toUpperCase();
    
    const taxDiff = Math.abs((selectedSapRow.total_tax || 0) - (gstRow.total_tax || 0));
    const isCandidate = sameGstin || taxDiff <= 50.0;

    if (!isCandidate) return null;

    const confidence = sameGstin && taxDiff <= 1.0 ? '98%' : sameGstin ? '90%' : '85%';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
          {confidence}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleForceManualMatch(selectedSapRow, gstRow);
          }}
          style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Match
        </button>
      </div>
    );
  };

  // Unlink Renderer for Manually Matched Tab
  const UnlinkActionCellRenderer = (props: any) => {
    const row = props.data;
    const matchId = row?.id || row?.match_id;

    if (subTab !== 'MANUAL' && !row?.match_level?.includes('Manual')) return null;

    return (
      <button
        onClick={() => handleUnlinkMatch(matchId)}
        style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '11px', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        title="Unlink and return to Unmatched pool"
      >
        <Unlink style={{ width: 12, height: 12 }} />
        <span>Unlink</span>
      </button>
    );
  };

  // Column definitions for Left (SAP) Unmatched Pane
  const unmatchedSapColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'SAP Vendor Name', field: 'vendor_name', flex: 1, minWidth: 160, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Vendor GSTIN', field: 'vendor_gstin', width: 155, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontFamily: 'monospace', fontSize: '11px' } as any },
    { headerName: 'Invoice Num', field: 'invoice_num', width: 135, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 } as any },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 115, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Total Tax', field: 'total_tax', width: 125, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#16a34a' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
  ], []);

  // Column definitions for Right (GSTR-2B) Unmatched Pane
  const unmatchedGstColumnDefs = useMemo<ColDef[]>(() => [
    { 
      headerName: 'Match', 
      width: 90, 
      cellRenderer: CandidateMatchCellRenderer, 
      sortable: false, 
      filter: false,
      pinned: 'left',
    },
    { headerName: 'Supplier Name', field: 'supplier_name', flex: 1, minWidth: 160, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Supplier GSTIN', field: 'supplier_gstin', width: 155, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontFamily: 'monospace', fontSize: '11px' } as any },
    { headerName: 'Portal Inv Num', field: 'invoice_num', width: 135, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 } as any },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 115, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Portal Tax', field: 'total_tax', width: 125, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#2563eb' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
  ], [selectedSapRow]);

  // Dynamic Footer Aggregation
  const updatePinnedBottomRow = useCallback((gridApi: any) => {
    if (!gridApi || docTab === 'RAW_SAP' || docTab === 'RAW_GSTR2B') {
      setPinnedBottomRowData([]);
      return;
    }
    let totalTaxSum = 0;
    let portalTaxSum = 0;
    let count = 0;

    gridApi.forEachNodeAfterFilter((node: any) => {
      if (node.data && node.data.id !== 'footer-sum-row') {
        totalTaxSum += Number(node.data.total_tax || 0);
        portalTaxSum += Number(node.data.portal_total_tax || 0);
        count++;
      }
    });

    setPinnedBottomRowData([
      {
        id: 'footer-sum-row',
        vendor_name: `TOTAL Exposure (${count} ${count === 1 ? 'Record' : 'Records'})`,
        invoice_num: 'FINANCIAL SUM',
        invoice_date: '-',
        total_tax: totalTaxSum,
        match_level: 'Screen Total',
        match_status: '',
        supplier_name: 'Filtered Portal Total Exposure',
        portal_invoice_num: 'FINANCIAL SUM',
        portal_invoice_date: '-',
        portal_total_tax: portalTaxSum,
      }
    ]);
  }, [docTab]);

  const onFilterChanged = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);
  const onGridReady = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);
  const onModelUpdated = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'gstr2b' | 'sap') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);

    setIsUploading(true);
    setUploadErrorLog(null);
    setUploadProgress(15);
    setUploadStatusText(`Uploading ${selectedFiles.length} file(s)...`);

    const formData = new FormData();
    formData.append('active_gstin', activeGstin);
    formData.append('gstin', activeGstin);

    if (type === 'gstr2b') {
      selectedFiles.forEach((file) => formData.append('files', file));
      formData.append('file', selectedFiles[0]);
    } else {
      formData.append('file', selectedFiles[0]);
      formData.append('return_period', returnPeriod);
    }

    try {
      setUploadProgress(45);
      setUploadStatusText(`Parsing & ingesting ${type === 'gstr2b' ? 'GSTR-2B JSON' : 'SAP MM Register'}...`);

      const endpoint = type === 'gstr2b' ? `${API_BASE}/ingest/gstr2b-json` : `${API_BASE}/ingestion/sap-mm`;
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 60) / progressEvent.total);
            setUploadProgress(Math.min(90, 20 + percent));
          }
        }
      });

      setUploadProgress(100);
      let msg = res.data?.message;
      if (type === 'gstr2b' && res.data?.files_processed) {
        msg = `Successfully ingested ${res.data.total_records_parsed} records from ${res.data.files_processed} GSTR-2B file(s)!`;
      }
      setUploadStatusText(msg || `${type === 'gstr2b' ? 'GSTR-2B JSON' : 'SAP Excel'} ingested successfully!`);

      await fetchDashboardData(activeGstin, returnPeriod);

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        setShowUploadModal(false);
      }, 1500);

    } catch (err: any) {
      console.error('File Upload Error:', err);
      setUploadProgress(0);
      setUploadStatusText('Ingestion Error Occurred');

      const detailMsg = err.response?.data?.detail;
      const fullLog = `[ERROR TIMESTAMP: ${new Date().toISOString()}]
[TARGET GSTIN: ${activeGstin}]
[RETURN PERIOD: ${returnPeriod}]
[FILE TYPE: ${type === 'gstr2b' ? 'GSTR-2B JSON' : 'SAP MM Excel'}]

------------------- SERVER ERROR DETAILS / STACK TRACE -------------------
${typeof detailMsg === 'object' ? JSON.stringify(detailMsg, null, 2) : (detailMsg || err.message || 'Unknown processing error')}
`;
      setUploadErrorLog(fullLog);
    } finally {
      e.target.value = '';
    }
  };

  const onSelectionChanged = useCallback((event: any) => {
    const selectedRows = event.api.getSelectedRows() as RecoRecord[];
    setSelectedRowIds(selectedRows.map(r => r.id));
  }, [setSelectedRowIds]);

  const getRowStyle = useCallback((params: any): RowStyle | undefined => {
    if (params.node.rowPinned) {
      return { 
        background: '#f1f5f9', 
        fontWeight: 'bold', 
        borderTop: '2px solid #3b82f6',
        color: '#1e293b' 
      };
    }
    const status = params.data?.match_status;
    if (status === 'Ready to Claim' || status === 'Completely Matched') {
      return { background: '#f0fdf4' };
    }
    if (status === 'Review Required' || status === 'Review') {
      return { background: '#fffbeb' };
    }
    if (status === 'Unmatched' || status === 'Missing in Portal' || status === 'Missing in SAP') {
      return { background: '#fef2f2' };
    }
    return undefined;
  }, []);

  // Grouped Side-by-Side Column Definitions
  const sideBySideColumnDefs = useMemo<(ColDef<RecoRecord> | ColGroupDef<RecoRecord>)[]>(() => [
    {
      headerName: '#',
      valueGetter: (p: any) => p.node.rowPinned ? '' : (p.node.rowIndex + 1),
      width: 50,
      pinned: 'left',
      cellStyle: { textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' },
      sortable: false,
      filter: false,
      resizable: false,
    },
    {
      headerName: 'SAP Purchase Register (Internal)',
      headerClass: 'ag-header-group-sap',
      children: [
        {
          headerName: 'SAP Vendor Name',
          valueGetter: (p: any) => p.data?.sap_record?.vendor_name || p.data?.vendor_name || '-',
          width: 220,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
        },
        {
          headerName: 'Vendor GSTIN',
          valueGetter: (p: any) => p.data?.sap_record?.vendor_gstin || p.data?.vendor_gstin || '-',
          width: 170,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontFamily: 'monospace', fontSize: '11px', color: '#1e40af' },
        },
        {
          headerName: 'Invoice Num',
          valueGetter: (p: any) => p.data?.sap_record?.invoice_num || p.data?.invoice_num || '-',
          width: 160,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#2563eb' },
        },
        {
          headerName: 'Invoice Date',
          valueGetter: (p: any) => p.data?.sap_record?.invoice_date || p.data?.invoice_date || '-',
          width: 130,
          sortable: true,
          filter: 'agDateColumnFilter',
          floatingFilter: true,
          valueFormatter: (p) => p.value === '-' || !p.value ? '-' : formatDate(p.value),
        },
        {
          headerName: 'Total Tax',
          valueGetter: (p: any) => p.data?.sap_record?.total_tax ?? p.data?.total_tax,
          width: 150,
          sortable: true,
          filter: 'agNumberColumnFilter',
          floatingFilter: true,
          cellStyle: { fontWeight: 700, textAlign: 'right', color: '#16a34a' },
          valueFormatter: (p) => p.value != null ? `₹${p.value.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'
        },
      ],
    },
    {
      headerName: 'Reconciliation Decision',
      headerClass: 'ag-header-group-engine',
      children: [
        {
          headerName: 'Match Level',
          valueGetter: (p: any) => p.data?.match_level || '-',
          width: 210,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontWeight: 500, fontSize: '11px' },
        },
        {
          headerName: 'Match Status',
          valueGetter: (p: any) => p.data?.match_status || '-',
          width: 160,
          filter: 'agSetColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellRenderer: MatchStatusBadgeRenderer,
        },
      ],
    },
    {
      headerName: 'GSTR-2B (Government Portal)',
      headerClass: 'ag-header-group-gst',
      children: [
        {
          headerName: 'Supplier Name',
          valueGetter: (p: any) => p.data?.gst_record?.supplier_name || p.data?.supplier_name || '-',
          width: 220,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
        },
        {
          headerName: 'Supplier GSTIN',
          valueGetter: (p: any) => p.data?.gst_record?.supplier_gstin || p.data?.supplier_gstin || '-',
          width: 170,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontFamily: 'monospace', fontSize: '11px', color: '#059669' },
        },
        {
          headerName: 'Portal Inv Num',
          valueGetter: (p: any) => p.data?.gst_record?.invoice_num || p.data?.portal_invoice_num || '-',
          width: 170,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#059669' },
        },
        {
          headerName: 'Portal Date',
          valueGetter: (p: any) => p.data?.gst_record?.invoice_date || p.data?.portal_invoice_date || '-',
          width: 130,
          sortable: true,
          filter: 'agDateColumnFilter',
          floatingFilter: true,
          valueFormatter: (p) => p.value === '-' || !p.value ? '-' : formatDate(p.value),
        },
        {
          headerName: 'Portal Total Tax',
          valueGetter: (p: any) => p.data?.gst_record?.total_tax ?? p.data?.portal_total_tax,
          width: 160,
          sortable: true,
          filter: 'agNumberColumnFilter',
          floatingFilter: true,
          cellStyle: { fontWeight: 700, textAlign: 'right', color: '#2563eb' },
          valueFormatter: (p) => p.value != null ? `₹${p.value.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'
        },
      ],
    },
    {
      headerName: 'Actions',
      width: 140,
      pinned: 'right',
      cellRenderer: UnlinkActionCellRenderer,
      sortable: false,
      filter: false,
      resizable: false,
    }
  ], [subTab]);

  // Raw SAP Register Single-Source Flat Columns
  const rawSapColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: '#', valueGetter: (p: any) => p.node.rowIndex + 1, width: 55, pinned: 'left', cellClass: 'text-center font-mono text-xs text-muted-foreground' },
    { headerName: 'SAP Vendor Name', field: 'vendor_name', width: 220, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Vendor GSTIN', field: 'vendor_gstin', width: 170, cellClass: 'font-mono text-xs font-semibold text-blue-300', filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'SAP Doc No', field: 'sap_doc_no', width: 140, cellClass: 'font-mono text-xs text-blue-400', filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Document Number', field: 'document_number', width: 170, cellClass: 'font-mono text-xs font-bold text-blue-400', filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Document Date', field: 'document_date', width: 140, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Taxable Base', field: 'taxable_value', width: 150, cellClass: 'text-right font-semibold', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'CGST', field: 'cgst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'SGST', field: 'sgst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'IGST', field: 'igst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'Total Tax', field: 'total_tax', width: 150, cellClass: 'text-right font-bold text-emerald-400', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Total Value', field: 'total_value', width: 160, cellClass: 'text-right font-bold', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
  ], []);

  // Raw GSTR-2B Portal Single-Source Flat Columns
  const rawGstr2bColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: '#', valueGetter: (p: any) => p.node.rowIndex + 1, width: 55, pinned: 'left', cellClass: 'text-center font-mono text-xs text-muted-foreground' },
    { headerName: 'Supplier Name', field: 'supplier_name', width: 220, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Supplier GSTIN', field: 'supplier_gstin', width: 170, cellClass: 'font-mono text-xs font-semibold text-emerald-300', filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Invoice Number', field: 'invoice_number', width: 170, cellClass: 'font-mono text-xs font-bold text-emerald-400', filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 140, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Type', field: 'invoice_type', width: 110, cellClass: 'font-bold text-center', filter: 'agTextColumnFilter' },
    { headerName: 'Taxable Value', field: 'taxable_value', width: 150, cellClass: 'text-right font-semibold', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'CGST', field: 'cgst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'SGST', field: 'sgst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'IGST', field: 'igst', width: 130, cellClass: 'text-right', valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'Total Tax', field: 'total_tax', width: 150, cellClass: 'text-right font-bold text-blue-400', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Total Value', field: 'total_value', width: 160, cellClass: 'text-right font-bold', valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
  ], []);

  const activeColumnDefs = useMemo(() => {
    if (docTab === 'RAW_SAP') return rawSapColumnDefs;
    if (docTab === 'RAW_GSTR2B') return rawGstr2bColumnDefs;
    return sideBySideColumnDefs;
  }, [docTab, rawSapColumnDefs, rawGstr2bColumnDefs, sideBySideColumnDefs]);

  const rowSelection = useMemo<RowSelectionOptions>(() => {
    return {
      mode: 'multiRow',
      enableClickSelection: true,
      checkboxes: false,
    };
  }, []);

  return (
    <div className={`flex-1 flex flex-col space-y-2 relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-3 w-screen h-screen overflow-hidden' : ''}`}>
      
      {!isFullscreen && <RecoProgressBanner />}

      {/* File Upload Modal (Triggered by Toolbar Button) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2.5">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Upload GST & Purchase Register Datasets</h3>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded-lg hover:bg-muted text-foreground/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Government Data Card */}
              <div className="bg-background border border-border p-5 rounded-2xl flex flex-col items-center justify-center border-dashed relative overflow-hidden group hover:border-primary/60 transition-all text-center">
                <input 
                  type="file" 
                  accept=".json" 
                  multiple
                  onChange={(e) => handleFileUpload(e, 'gstr2b')}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  disabled={isUploading || isLoadingData}
                />
                <FileJson className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-foreground text-xs">Government GSTR-2B JSON</h4>
                <p className="text-[11px] text-foreground/60 mt-1">Upload GSTR-2B JSON (B2B, CDNR, B2BA, IMPG)</p>
              </div>

              {/* SAP MM Data Card */}
              <div className="bg-background border border-border p-5 rounded-2xl flex flex-col items-center justify-center border-dashed relative overflow-hidden group hover:border-emerald-500/60 transition-all text-center">
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={(e) => handleFileUpload(e, 'sap')}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                  disabled={isUploading || isLoadingData}
                />
                <FileSpreadsheet className="w-8 h-8 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-foreground text-xs">SAP MM Purchase Register</h4>
                <p className="text-[11px] text-foreground/60 mt-1">Upload Purchase Register (Excel / CSV)</p>
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2 py-2">
                <div className="flex justify-between text-xs font-semibold text-foreground/70">
                  <span>{uploadStatusText || 'Uploading...'}</span>
                  <span className="text-primary font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadErrorLog && (
              <pre className="bg-[#080a0e] text-rose-300 font-mono text-xs p-3 rounded-xl max-h-48 overflow-y-auto border border-border whitespace-pre-wrap select-all">
                {uploadErrorLog}
              </pre>
            )}

          </div>
        </div>
      )}

      {/* Main AG Grid Enterprise Workspace Container (Maximizing height to calc(100vh - 160px)) */}
      <div className={`flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-xl relative ${isFullscreen ? 'h-full' : 'h-[calc(100vh-165px)] min-h-[580px]'}`}>
        
        {/* Loading Overlay */}
        {isLoadingData && !isUploading && (
          <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs font-bold text-foreground tracking-wide">
              Fetching live records from database...
            </span>
          </div>
        )}

        {/* WORKSPACE TOP TOOLBAR (Matching Reference Screenshot 3) */}
        <div className="border-b border-border bg-card/95 flex flex-col shrink-0">
          
          {/* Toolbar Row 1: Wide Global Search + Dynamic Filters + Primary Action Buttons */}
          <div className="px-4 py-2 flex flex-wrap items-center justify-between border-b border-border/60 gap-3">
            
            {/* Left: Wide Search Across All Fields (Matching Screenshot 3) */}
            <div className="flex items-center space-x-2 flex-1 max-w-xl">
              <div className="relative flex items-center w-full bg-background border border-border rounded-xl px-3 py-1.5 focus-within:border-primary transition-all shadow-inner">
                <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search across all fields (e.g. Vendor, GSTIN, Invoice Num, ₹ Tax)..."
                  value={quickFilterText}
                  onChange={(e) => setQuickFilterText(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none w-full placeholder:text-muted-foreground/60 font-medium"
                />
                {quickFilterText && (
                  <button onClick={() => setQuickFilterText('')} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Global GSTIN Quick Input */}
              <div className="relative flex items-center bg-background border border-border rounded-xl px-2.5 py-1.5 focus-within:border-primary transition-all shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter GSTIN..."
                  value={globalGstinFilter}
                  onChange={(e) => setGlobalGstinFilter(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none w-28 placeholder:text-muted-foreground/60 font-mono"
                />
                {globalGstinFilter && (
                  <button onClick={() => setGlobalGstinFilter('')} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Rows per page + Upload + Export + Fullscreen toggle */}
            <div className="flex items-center space-x-2 shrink-0">
              
              {/* Rows Per Page Dropdown (Matching Screenshot 3) */}
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-foreground/70 bg-background px-2.5 py-1 rounded-xl border border-border">
                <span className="text-[11px] text-muted-foreground font-bold hidden sm:inline">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={250}>250 / page</option>
                  <option value={500}>500 / page</option>
                  <option value={0}>All Rows</option>
                </select>
              </div>

              {/* KPI Ribbon Toggle Button */}
              <button
                onClick={() => setShowKpiBar(!showKpiBar)}
                className={`p-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center space-x-1 ${
                  showKpiBar ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-background border-border text-foreground/70'
                }`}
                title={showKpiBar ? 'Hide KPI Summary Bar' : 'Show KPI Summary Bar'}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">{showKpiBar ? 'Hide KPIs' : 'KPI Summary'}</span>
              </button>

              {/* Upload Files Modal Button */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-xs border border-border flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-primary" />
                <span>Upload Data</span>
              </button>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {/* Dedicated Full Screen Toggle Button */}
              <button
                onClick={toggleFullscreen}
                className={`p-1.5 rounded-xl border font-bold text-xs transition-all flex items-center space-x-1 ${
                  isFullscreen 
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30' 
                    : 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                }`}
                title={isFullscreen ? 'Exit Full Screen' : 'Expand Grid to Full Screen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden lg:inline text-[11px]">{isFullscreen ? 'Exit Fullscreen' : 'Full Screen Grid'}</span>
              </button>

            </div>
          </div>

          {/* Collapsible Compact KPI Summary Ribbon */}
          {showKpiBar && (
            <div className="px-4 py-2 bg-background/80 border-b border-border/60 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-200">
              <div className="bg-card border border-border p-2.5 rounded-xl border-l-4 border-l-blue-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-foreground/60 font-bold">Total Exposure</div>
                  <div className="text-sm font-black text-foreground">{formatINR(counts.totalTaxSum)}</div>
                </div>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 font-extrabold px-1.5 py-0.5 rounded">{gridRowData.length} Records</span>
              </div>

              <div className="bg-card border border-border p-2.5 rounded-xl border-l-4 border-l-emerald-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-foreground/60 font-bold">Matched & Ready</div>
                  <div className="text-sm font-black text-emerald-400">{formatINR(counts.readyTaxSum)}</div>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">{counts.matched} Invoices</span>
              </div>

              <div className="bg-card border border-border p-2.5 rounded-xl border-l-4 border-l-amber-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-foreground/60 font-bold">Pending Review</div>
                  <div className="text-sm font-black text-amber-400">{formatINR(counts.reviewTaxSum)}</div>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-1.5 py-0.5 rounded">{counts.review} Invoices</span>
              </div>

              <div className="bg-card border border-border p-2.5 rounded-xl border-l-4 border-l-rose-500 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-foreground/60 font-bold">Not Matched</div>
                  <div className="text-sm font-black text-rose-400">{formatINR(counts.unmatchedTaxSum)}</div>
                </div>
                <span className="text-[10px] bg-rose-500/10 text-rose-400 font-extrabold px-1.5 py-0.5 rounded">{counts.unmatched} Pairs</span>
              </div>
            </div>
          )}

          {/* Toolbar Row 2: Document Type Tabs (B2B, CDNR, B2BA, RAW_SAP, RAW_GSTR2B) */}
          <div className="flex items-center space-x-2 px-4 pt-1 bg-card/60 overflow-x-auto border-b border-border/40">
            <button
              onClick={() => setDocTab('B2B')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                docTab === 'B2B' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>B2B Invoices</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-extrabold">{counts.b2bTotal}</span>
            </button>

            <button
              onClick={() => setDocTab('CDNR')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                docTab === 'CDNR' ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}
            >
              <FileMinus className="w-3.5 h-3.5" />
              <span>Credit Notes (CDNR)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-400 font-extrabold">{counts.cdnrTotal}</span>
            </button>

            <button
              onClick={() => setDocTab('B2BA')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                docTab === 'B2BA' ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}
            >
              <FileDiff className="w-3.5 h-3.5" />
              <span>Amendments (B2BA)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-extrabold">{counts.b2baTotal}</span>
            </button>

            <div className="h-4 w-[1px] bg-border mx-1 shrink-0" />

            <button
              onClick={() => setDocTab('RAW_SAP')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                docTab === 'RAW_SAP' ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Raw SAP</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-extrabold">{sapRawRecords.length}</span>
            </button>

            <button
              onClick={() => setDocTab('RAW_GSTR2B')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center space-x-1.5 shrink-0 ${
                docTab === 'RAW_GSTR2B' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Raw GSTR-2B</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold">{gstr2bRawRecords.length}</span>
            </button>
          </div>

          {/* Toolbar Row 3: Sub-Tabs inside Active Document Tab */}
          {docTab !== 'RAW_SAP' && docTab !== 'RAW_GSTR2B' && (
            <div className="flex flex-wrap items-center justify-between px-4 py-1.5 bg-background/60 gap-2">
              <div className="flex items-center space-x-1.5 overflow-x-auto">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                  Sub-Views:
                </span>

                <button
                  onClick={() => setSubTab('MATCHED')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    subTab === 'MATCHED'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>1) Completely Matched</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-extrabold">{counts.matched}</span>
                </button>

                <button
                  onClick={() => setSubTab('REVIEW')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    subTab === 'REVIEW'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>2) Review</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-extrabold">{counts.review}</span>
                </button>

                <button
                  onClick={() => setSubTab('UNMATCHED')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    subTab === 'UNMATCHED'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>3) Not Matched (Split View)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-extrabold">{counts.unmatched}</span>
                </button>

                <button
                  onClick={() => setSubTab('MANUAL')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    subTab === 'MANUAL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-indigo-400/80 hover:text-indigo-400 hover:bg-indigo-500/10'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>4) Manually Matched</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-extrabold">{counts.manual}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Dynamic Workspace Content */}
        {subTab === 'UNMATCHED' && docTab !== 'RAW_SAP' && docTab !== 'RAW_GSTR2B' ? (
          /* SUB-TAB 3: NOT MATCHED — CLEAN DUAL-PANE SPLIT VIEW */
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Success Toast */}
            {matchSuccessMsg && (
              <div className="mx-3 mt-2 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg flex items-center justify-between text-xs font-semibold shrink-0">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{matchSuccessMsg}</span>
                </div>
                <button onClick={() => setMatchSuccessMsg(null)} className="hover:text-green-900 p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Match Action Strip — compact inline bar */}
            <div className="px-3 py-1.5 flex items-center justify-between bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="flex items-center space-x-3 text-xs text-slate-600">
                <span className="font-semibold">Select 1 row on each side to match</span>
                {selectedSapRow && (
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-blue-200">
                    SAP: {selectedSapRow.invoice_num}
                  </span>
                )}
                {selectedGstRow && (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-emerald-200">
                    GST: {selectedGstRow.invoice_num}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleForceManualMatch()}
                disabled={!selectedSapRow || !selectedGstRow || isMatching}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center space-x-1.5 ${
                  selectedSapRow && selectedGstRow
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-95 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>Match Selected</span>
              </button>
            </div>

            {/* Split View 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-1 min-h-0">
              
              {/* Left Pane: Unmatched SAP Records */}
              <div className="flex flex-col border-r border-slate-200 min-h-0">
                <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-slate-200 shrink-0">
                  <div className="flex items-center space-x-2">
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800">SAP Purchase Register</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                      {unmatchedSapRecords.length}
                    </span>
                  </div>
                  <div className="relative flex items-center bg-white border border-slate-300 rounded px-2 py-0.5">
                    <Search className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter GSTIN..."
                      value={leftSapGstinFilter}
                      onChange={(e) => setLeftSapGstinFilter(e.target.value)}
                      className="bg-transparent text-[11px] text-slate-800 focus:outline-none w-24"
                    />
                    {leftSapGstinFilter && (
                      <button onClick={() => setLeftSapGstinFilter('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 ag-theme-alpine w-full min-h-0">
                  <AgGridReact
                    theme="legacy"
                    rowData={unmatchedSapRecords}
                    columnDefs={unmatchedSapColumnDefs as any}
                    rowSelection={{ mode: 'singleRow', enableClickSelection: true, checkboxes: false }}
                    onSelectionChanged={(e) => {
                      const rows = e.api.getSelectedRows();
                      setSelectedSapRow(rows.length > 0 ? rows[0] : null);
                    }}
                    onGridReady={(params) => params.api.sizeColumnsToFit()}
                    defaultColDef={{ resizable: true, sortable: true, filter: true, floatingFilter: true }}
                    animateRows={true}
                    rowHeight={28}
                    headerHeight={32}
                    floatingFiltersHeight={28}
                    enableCellTextSelection={true}
                    ensureDomOrder={true}
                  />
                </div>
              </div>

              {/* Right Pane: Unmatched GSTR-2B Records */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border-b border-slate-200 shrink-0">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800">GSTR-2B Portal</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                      {unmatchedGstRecords.length}
                    </span>
                  </div>
                  <div className="relative flex items-center bg-white border border-slate-300 rounded px-2 py-0.5">
                    <Search className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter GSTIN..."
                      value={rightGstGstinFilter}
                      onChange={(e) => setRightGstGstinFilter(e.target.value)}
                      className="bg-transparent text-[11px] text-slate-800 focus:outline-none w-24"
                    />
                    {rightGstGstinFilter && (
                      <button onClick={() => setRightGstGstinFilter('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 ag-theme-alpine w-full min-h-0">
                  <AgGridReact
                    theme="legacy"
                    rowData={unmatchedGstRecords}
                    columnDefs={unmatchedGstColumnDefs as any}
                    rowSelection={{ mode: 'singleRow', enableClickSelection: true, checkboxes: false }}
                    onSelectionChanged={(e) => {
                      const rows = e.api.getSelectedRows();
                      setSelectedGstRow(rows.length > 0 ? rows[0] : null);
                    }}
                    onGridReady={(params) => params.api.sizeColumnsToFit()}
                    defaultColDef={{ resizable: true, sortable: true, filter: true, floatingFilter: true }}
                    animateRows={true}
                    rowHeight={28}
                    headerHeight={32}
                    floatingFiltersHeight={28}
                    enableCellTextSelection={true}
                    ensureDomOrder={true}
                  />
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* STANDARD FULL HEIGHT AG GRID VIEW */
          <div className="flex-1 ag-theme-alpine w-full h-full min-h-0">
            <AgGridReact
              ref={gridRef}
              theme="legacy"
              rowData={gridRowData}
              columnDefs={activeColumnDefs as any}
              rowSelection={rowSelection}
              getRowStyle={getRowStyle}
              onSelectionChanged={onSelectionChanged}
              onFilterChanged={onFilterChanged}
              onGridReady={onGridReady}
              onModelUpdated={onModelUpdated}
              pinnedBottomRowData={docTab === 'RAW_SAP' || docTab === 'RAW_GSTR2B' ? [] : pinnedBottomRowData}
              quickFilterText={quickFilterText}
              pagination={pageSize > 0}
              paginationPageSize={pageSize > 0 ? pageSize : undefined}
              rowHeight={28}
              headerHeight={32}
              floatingFiltersHeight={28}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true,
                floatingFilter: true,
              }}
              animateRows={true}
            />
          </div>
        )}

      </div>

    </div>
  );
};
