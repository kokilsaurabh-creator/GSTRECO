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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Globe,
  Loader2,
  X,
  Search,
  Download,
  Maximize2,
  Minimize2,
  Link2,
  Unlink,
  ShieldCheck,
} from 'lucide-react';

import axios from 'axios';
import { RecoProgressBanner } from './RecoProgressBanner';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Custom Cell Renderer for Match Status Badges (Dark Theme)
const MatchStatusBadgeRenderer: React.FC<any> = (props) => {
  const status = props.value as string;
  if (!status) return null;

  if (status === 'Ready to Claim' || status === 'Completely Matched') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  }
  if (status === 'Review Required' || status === 'Review') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  }
  if (status.includes('Manual')) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
        <ShieldCheck className="w-3 h-3 mr-1" />
        Manually Matched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
      <XCircle className="w-3 h-3 mr-1" />
      {status}
    </span>
  );
};

interface AgGridWorkspaceProps {
  quickFilterText: string;
  globalGstinFilter: string;
  docTab: string;
  subTab: string;
}

export const AgGridWorkspace: React.FC<AgGridWorkspaceProps> = ({
  quickFilterText,
  globalGstinFilter,
  docTab,
  subTab,
}) => {
  const { 
    records, 
    sapRawRecords,
    gstr2bRawRecords,
    isLoadingData,
    fetchDashboardData,
    setRecords,
    setSelectedRowIds, 
    setSelectedRecord,
    activeGstin, 
    returnPeriod 
  } = useAppStore();

  const gridRef = useRef<any>(null);
  
  // View Controls
  const [pageSize, setPageSize] = useState<number>(50);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Dual-Pane Manual Match State
  const [leftSapGstinFilter, setLeftSapGstinFilter] = useState<string>('');
  const [rightGstGstinFilter, setRightGstGstinFilter] = useState<string>('');
  const [selectedSapRow, setSelectedSapRow] = useState<any | null>(null);
  const [selectedGstRow, setSelectedGstRow] = useState<any | null>(null);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [matchSuccessMsg, setMatchSuccessMsg] = useState<string | null>(null);

  const [pinnedBottomRowData, setPinnedBottomRowData] = useState<any[]>([]);

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
      }, { timeout: 2500 });

      const msg = res.data?.message || `Successfully matched SAP ${sapRow.invoice_num} to GSTR-2B ${gstRow.invoice_num}!`;
      setMatchSuccessMsg(msg);

      setSelectedSapRow(null);
      setSelectedGstRow(null);

      await fetchDashboardData(activeGstin, returnPeriod);

      setTimeout(() => setMatchSuccessMsg(null), 5000);

    } catch (err: any) {
      console.warn('Backend API offline, applying manual match in client-side demo mode:', err.message);
      const msg = `Successfully matched SAP ${sapRow.invoice_num} to GSTR-2B ${gstRow.invoice_num} (Demo Mode)!`;
      setMatchSuccessMsg(msg);

      // Local state update
      const updated = records.map((r) => {
        if (r.sap_record?.id === sapRow.id || r.id === sapRow.id) {
          return {
            ...r,
            match_status: 'Ready to Claim',
            match_level: 'Level 2: Manually Accepted',
            gst_record: gstRow,
            supplier_name: gstRow.supplier_name,
            portal_invoice_num: gstRow.invoice_num,
            portal_invoice_date: gstRow.invoice_date,
            portal_total_tax: gstRow.total_tax
          };
        }
        return r;
      });
      setRecords(updated);
      setSelectedSapRow(null);
      setSelectedGstRow(null);

      setTimeout(() => setMatchSuccessMsg(null), 5000);
    } finally {
      setIsMatching(false);
    }
  };

  // Handle Unlink / Undo Manual Match API Call
  const handleUnlinkMatch = async (matchId: string) => {
    if (!matchId) return;
    if (!confirm('Are you sure you want to unlink and undo this match?')) return;

    try {
      const res = await axios.post(`${API_BASE}/reconcile/unlink-match`, { match_id: String(matchId) }, { timeout: 2500 });
      setMatchSuccessMsg(res.data?.message || 'Record unlinked successfully!');
      await fetchDashboardData(activeGstin, returnPeriod);
      setTimeout(() => setMatchSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn('Backend API offline, unlinking in client-side demo mode:', err.message);
      const updated = records.map((r) => {
        if (r.id === matchId || r.match_id === matchId) {
          return { ...r, match_status: 'Unmatched', match_level: 'Unmatched', gst_record: null, portal_invoice_num: '-' };
        }
        return r;
      });
      setRecords(updated);
      setMatchSuccessMsg('Record unlinked successfully (Demo Mode)!');
      setTimeout(() => setMatchSuccessMsg(null), 4000);
    }
  };

  // Handle CSV Export
  const handleExportCsv = useCallback(() => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `GST_Reco_${docTab}_${subTab}_${activeGstin}_${returnPeriod}.csv`
      });
    } else {
      // Fallback manual CSV export for dual pane view (Unmatched Tab)
      const headers = [
        'ID', 'SAP Vendor Name', 'SAP GSTIN', 'SAP Invoice Num', 'SAP Invoice Date', 'SAP Tax (INR)',
        'Match Level', 'Match Status',
        'Portal Supplier Name', 'Portal GSTIN', 'Portal Invoice Num', 'Portal Invoice Date', 'Portal Tax (INR)'
      ];

      const csvRows = [
        headers.join(','),
        ...gridRowData.map((r: any) => [
          `"${r.id}"`,
          `"${r.sap_record ? r.sap_record.vendor_name : '-'}"`,
          `"${r.sap_record ? r.sap_record.vendor_gstin : '-'}"`,
          `"${r.sap_record ? r.sap_record.invoice_num : '-'}"`,
          `"${r.sap_record ? r.sap_record.invoice_date : '-'}"`,
          r.sap_record ? r.sap_record.total_tax : 0,
          `"${r.match_level}"`,
          `"${r.match_status}"`,
          `"${r.gst_record ? r.gst_record.supplier_name : '-'}"`,
          `"${r.gst_record ? r.gst_record.supplier_gstin : '-'}"`,
          `"${r.gst_record ? r.gst_record.invoice_num : '-'}"`,
          `"${r.gst_record ? r.gst_record.invoice_date : '-'}"`,
          r.gst_record ? r.gst_record.total_tax : 0
        ].join(','))
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GST_Reco_${docTab}_${subTab}_${activeGstin}_${returnPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [docTab, subTab, activeGstin, returnPeriod, gridRowData]);

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
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          {confidence}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleForceManualMatch(selectedSapRow, gstRow);
          }}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded gradient-primary text-white border-none cursor-pointer"
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
        className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-400 font-bold text-[10px] border border-rose-500/30 cursor-pointer flex items-center gap-1 hover:bg-rose-500/25 transition-colors"
        title="Unlink and return to Unmatched pool"
      >
        <Unlink className="w-3 h-3" />
        <span>Unlink</span>
      </button>
    );
  };

  // Column definitions for Left (SAP) Unmatched Pane
  const unmatchedSapColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'SAP Vendor Name', field: 'vendor_name', flex: 1, minWidth: 160, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Vendor GSTIN', field: 'vendor_gstin', width: 155, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Invoice Num', field: 'invoice_num', width: 135, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontWeight: 600 } as any },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 115, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Total Tax', field: 'total_tax', width: 125, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#60a5fa' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
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
    { headerName: 'Supplier GSTIN', field: 'supplier_gstin', width: 155, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Portal Inv Num', field: 'invoice_num', width: 135, filter: 'agTextColumnFilter', floatingFilter: true, cellStyle: { fontWeight: 600 } as any },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 115, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Portal Tax', field: 'total_tax', width: 125, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#34d399' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
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
        vendor_name: `TOTAL (${count} Records)`,
        invoice_num: '—',
        invoice_date: '-',
        total_tax: totalTaxSum,
        match_level: 'Screen Total',
        match_status: '',
        supplier_name: 'Portal Total',
        portal_invoice_num: '—',
        portal_invoice_date: '-',
        portal_total_tax: portalTaxSum,
      }
    ]);
  }, [docTab]);

  const onFilterChanged = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);
  const onGridReady = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);
  const onModelUpdated = useCallback((params: any) => updatePinnedBottomRow(params.api), [updatePinnedBottomRow]);

  const onSelectionChanged = useCallback((event: any) => {
    const selectedRows = event.api.getSelectedRows() as RecoRecord[];
    setSelectedRowIds(selectedRows.map(r => r.id));
  }, [setSelectedRowIds]);

  // Row click -> open discrepancy panel for review records
  const onRowClicked = useCallback((event: any) => {
    const data = event.data as RecoRecord;
    if (!data || data.id === 'footer-sum-row') return;
    if (docTab === 'RAW_SAP' || docTab === 'RAW_GSTR2B') return;
    
    // Open discrepancy panel for Review Required or any matched record
    if (data.match_status === 'Review Required' || data.sap_record || data.gst_record) {
      setSelectedRecord(data);
    }
  }, [docTab, setSelectedRecord]);

  const getRowStyle = useCallback((params: any): RowStyle | undefined => {
    if (params.node.rowPinned) {
      return { 
        background: '#111827', 
        fontWeight: 'bold', 
        borderTop: '2px solid #3b82f6',
        color: '#e2e8f0' 
      };
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
      cellStyle: { textAlign: 'center', fontSize: '11px', color: '#64748b' },
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
          cellStyle: { color: '#60a5fa' },
        },
        {
          headerName: 'Invoice Num',
          valueGetter: (p: any) => p.data?.sap_record?.invoice_num || p.data?.invoice_num || '-',
          width: 160,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontWeight: 700, color: '#60a5fa' },
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
          cellStyle: { fontWeight: 700, textAlign: 'right', color: '#60a5fa' },
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
          filter: 'agTextColumnFilter',
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
          cellStyle: { color: '#34d399' },
        },
        {
          headerName: 'Portal Inv Num',
          valueGetter: (p: any) => p.data?.gst_record?.invoice_num || p.data?.portal_invoice_num || '-',
          width: 170,
          filter: 'agTextColumnFilter',
          sortable: true,
          floatingFilter: true,
          cellStyle: { fontWeight: 700, color: '#34d399' },
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
          cellStyle: { fontWeight: 700, textAlign: 'right', color: '#34d399' },
          valueFormatter: (p) => p.value != null ? `₹${p.value.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'
        },
      ],
    },
    {
      headerName: 'Actions',
      width: 100,
      pinned: 'right',
      cellRenderer: UnlinkActionCellRenderer,
      sortable: false,
      filter: false,
      resizable: false,
    }
  ], [subTab]);

  // Raw SAP Register Single-Source Flat Columns
  const rawSapColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: '#', valueGetter: (p: any) => p.node.rowIndex + 1, width: 55, pinned: 'left', cellStyle: { textAlign: 'center', fontSize: '11px', color: '#64748b' } as any },
    { headerName: 'SAP Vendor Name', field: 'vendor_name', width: 220, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Vendor GSTIN', field: 'vendor_gstin', width: 170, cellStyle: { color: '#60a5fa' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'SAP Doc No', field: 'sap_doc_no', width: 140, cellStyle: { color: '#60a5fa' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Document Number', field: 'document_number', width: 170, cellStyle: { fontWeight: 700, color: '#60a5fa' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Document Date', field: 'document_date', width: 140, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Taxable Base', field: 'taxable_value', width: 150, cellStyle: { textAlign: 'right', fontWeight: 600 } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'CGST', field: 'cgst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'SGST', field: 'sgst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'IGST', field: 'igst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'Total Tax', field: 'total_tax', width: 150, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#34d399' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Total Value', field: 'total_value', width: 160, cellStyle: { textAlign: 'right', fontWeight: 700 } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Reco Status', field: 'reconciliation_status', width: 140, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Match Level', field: 'match_level', width: 160, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched Portal Inv', field: 'matched_gstr_invoice_number', width: 170, cellStyle: { color: '#34d399' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched Portal Supplier', field: 'matched_gstr_supplier_name', width: 180, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched Portal Tax', field: 'matched_gstr_total_tax', width: 150, cellStyle: { textAlign: 'right', color: '#34d399' } as any, valueFormatter: (p) => p.value != null ? formatINR(p.value) : '-', filter: 'agNumberColumnFilter', floatingFilter: true },
  ], []);

  // Raw GSTR-2B Portal Single-Source Flat Columns
  const rawGstr2bColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: '#', valueGetter: (p: any) => p.node.rowIndex + 1, width: 55, pinned: 'left', cellStyle: { textAlign: 'center', fontSize: '11px', color: '#64748b' } as any },
    { headerName: 'Supplier Name', field: 'supplier_name', width: 220, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Supplier GSTIN', field: 'supplier_gstin', width: 170, cellStyle: { color: '#34d399' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Invoice Number', field: 'invoice_number', width: 170, cellStyle: { fontWeight: 700, color: '#34d399' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Invoice Date', field: 'invoice_date', width: 140, valueFormatter: (p) => formatDate(p.value), filter: 'agDateColumnFilter', floatingFilter: true },
    { headerName: 'Type', field: 'invoice_type', width: 110, cellStyle: { fontWeight: 700, textAlign: 'center' } as any, filter: 'agTextColumnFilter' },
    { headerName: 'Taxable Value', field: 'taxable_value', width: 150, cellStyle: { textAlign: 'right', fontWeight: 600 } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'CGST', field: 'cgst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'SGST', field: 'sgst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'IGST', field: 'igst', width: 120, cellStyle: { textAlign: 'right' } as any, valueFormatter: (p) => formatINR(p.value) },
    { headerName: 'Total Tax', field: 'total_tax', width: 150, cellStyle: { textAlign: 'right', fontWeight: 700, color: '#60a5fa' } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Total Value', field: 'total_value', width: 160, cellStyle: { textAlign: 'right', fontWeight: 700 } as any, valueFormatter: (p) => formatINR(p.value), filter: 'agNumberColumnFilter', floatingFilter: true },
    { headerName: 'Reco Status', field: 'reconciliation_status', width: 140, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Match Level', field: 'match_level', width: 160, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched SAP Doc', field: 'matched_sap_document_number', width: 170, cellStyle: { color: '#60a5fa' } as any, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched SAP Vendor', field: 'matched_sap_vendor_name', width: 180, filter: 'agTextColumnFilter', floatingFilter: true },
    { headerName: 'Matched SAP Tax', field: 'matched_sap_total_tax', width: 150, cellStyle: { textAlign: 'right', color: '#60a5fa' } as any, valueFormatter: (p) => p.value != null ? formatINR(p.value) : '-', filter: 'agNumberColumnFilter', floatingFilter: true },
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
    <div className={`flex-1 flex flex-col relative ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-3 w-screen h-screen overflow-hidden' : ''}`}>
      
      {!isFullscreen && <RecoProgressBanner />}

      {/* Toolbar Strip */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border/60 shrink-0">
        <div className="flex items-center space-x-2 text-[11px] text-muted-foreground font-semibold">
          <span className="font-financial text-foreground">{gridRowData.length}</span>
          <span>records</span>
          {docTab !== 'RAW_SAP' && docTab !== 'RAW_GSTR2B' && (
            <>
              <span className="text-border">•</span>
              <span className="text-primary font-bold">{subTab}</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-[11px] text-muted-foreground bg-surface px-2.5 py-1 rounded-lg border border-border/60">
            <span>Rows:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={0}>All</option>
            </select>
          </div>
          <button onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg gradient-success text-white font-bold text-[11px] flex items-center space-x-1.5 transition-all active:scale-[0.97]">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg border text-xs transition-all ${
              isFullscreen ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : 'bg-surface border-border/60 text-muted-foreground hover:text-primary'
            }`}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoadingData && (
        <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs font-bold text-foreground tracking-wide">
            Fetching live records from database...
          </span>
        </div>
      )}

      {/* Dynamic Workspace Content */}
      {subTab === 'UNMATCHED' && docTab !== 'RAW_SAP' && docTab !== 'RAW_GSTR2B' ? (
        /* SUB-TAB 3: NOT MATCHED — DUAL-PANE SPLIT VIEW */
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Success Toast */}
          {matchSuccessMsg && (
            <div className="mx-3 mt-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-lg flex items-center justify-between text-xs font-semibold shrink-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{matchSuccessMsg}</span>
              </div>
              <button onClick={() => setMatchSuccessMsg(null)} className="hover:text-emerald-300 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Match Action Strip */}
          <div className="px-3 py-1.5 flex items-center justify-between bg-surface border-b border-border/60 shrink-0">
            <div className="flex items-center space-x-3 text-xs text-muted-foreground">
              <span className="font-semibold">Select 1 row on each side to match</span>
              {selectedSapRow && (
                <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-blue-500/30">
                  SAP: {selectedSapRow.invoice_num}
                </span>
              )}
              {selectedGstRow && (
                <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border border-emerald-500/30">
                  GST: {selectedGstRow.invoice_num}
                </span>
              )}
            </div>
            <button
              onClick={() => handleForceManualMatch()}
              disabled={!selectedSapRow || !selectedGstRow || isMatching}
              className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center space-x-1.5 ${
                selectedSapRow && selectedGstRow
                  ? 'gradient-primary text-white shadow-md active:scale-[0.97] cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>Match Selected</span>
            </button>
          </div>

          {/* Split View 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-1 min-h-0">
            
            {/* Left Pane: Unmatched SAP Records */}
            <div className="flex flex-col border-r border-border/60 min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 bg-blue-500/8 border-b border-border/60 shrink-0">
                <div className="flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <h4 className="text-xs font-bold text-foreground">SAP Purchase Register</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold border border-blue-500/30">
                    {unmatchedSapRecords.length}
                  </span>
                </div>
                <div className="relative flex items-center bg-surface border border-border/60 rounded px-2 py-0.5">
                  <Search className="w-3 h-3 text-muted-foreground mr-1 shrink-0" />
                  <input type="text" placeholder="Filter..." value={leftSapGstinFilter}
                    onChange={(e) => setLeftSapGstinFilter(e.target.value)}
                    className="bg-transparent text-[11px] text-foreground focus:outline-none w-20" />
                  {leftSapGstinFilter && (
                    <button onClick={() => setLeftSapGstinFilter('')} className="text-muted-foreground hover:text-foreground">
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
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-500/8 border-b border-border/60 shrink-0">
                <div className="flex items-center space-x-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <h4 className="text-xs font-bold text-foreground">GSTR-2B Portal</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                    {unmatchedGstRecords.length}
                  </span>
                </div>
                <div className="relative flex items-center bg-surface border border-border/60 rounded px-2 py-0.5">
                  <Search className="w-3 h-3 text-muted-foreground mr-1 shrink-0" />
                  <input type="text" placeholder="Filter..." value={rightGstGstinFilter}
                    onChange={(e) => setRightGstGstinFilter(e.target.value)}
                    className="bg-transparent text-[11px] text-foreground focus:outline-none w-20" />
                  {rightGstGstinFilter && (
                    <button onClick={() => setRightGstGstinFilter('')} className="text-muted-foreground hover:text-foreground">
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
            onRowClicked={onRowClicked}
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
  );
};
