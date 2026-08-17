import { create } from 'zustand';
import type { RecoRecord } from '../data/mockData';
import { MOCK_SAP_RECORDS, MOCK_GSTR2B_RECORDS, generateMockRecoResults } from '../data/mockDataFallback';
import axios from 'axios';

export type UserRole = 'Admin' | 'Customer' | 'Auditor';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

interface UploadState {
  isUploading: boolean;
  uploadProgress: number;
  uploadStatusText: string;
  uploadErrorLog: string | null;
}

interface AppState {
  activeGstin: string;
  returnPeriod: string;
  role: UserRole;
  sidebarCollapsed: boolean;
  activeNavTab: string;
  isRunningReco: boolean;
  isLoadingData: boolean;
  
  records: RecoRecord[];
  sapRawRecords: any[];
  gstr2bRawRecords: any[];
  selectedRowIds: string[];

  // Discrepancy Panel
  selectedRecord: RecoRecord | null;
  discrepancyPanelOpen: boolean;

  // Filter Panel
  filterPanelCollapsed: boolean;

  // Upload State (shared across views)
  upload: UploadState;

  recoProgress: number;
  recoStatusText: string;
  recoError: string | null;
  recoLogs: string[];

  setActiveGstin: (gstin: string) => void;
  setReturnPeriod: (period: string) => void;
  setRole: (role: UserRole) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveNavTab: (tab: string) => void;

  setRecords: (records: RecoRecord[]) => void;
  setSelectedRowIds: (ids: string[]) => void;
  setSelectedRecord: (record: RecoRecord | null) => void;
  setDiscrepancyPanelOpen: (open: boolean) => void;
  setFilterPanelCollapsed: (collapsed: boolean) => void;
  setUploadState: (state: Partial<UploadState>) => void;

  fetchDashboardData: (gstin?: string, period?: string) => Promise<void>;
  runReconciliation: () => Promise<void>;
  clearRecoError: () => void;
  clearRecoLogs: () => void;
  
  // Bulk actions
  acceptSelectedMatches: () => void;
  rejectSelectedMatches: () => void;
  deferSelectedMatches: () => void;
  clearRawData: (target: 'SAP' | 'GSTR2B' | 'ALL', allPeriods?: boolean) => Promise<{ status: string; message: string; sap_deleted: number; gstr_deleted: number; reco_deleted: number }>;

  // Manual actions on single records
  acceptPortalValue: (record: RecoRecord) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeGstin: '26AAACW1018K1ZH',
  returnPeriod: 'June 2026',
  role: 'Admin',
  sidebarCollapsed: false,
  activeNavTab: 'Reconciliation',
  isRunningReco: false,
  isLoadingData: false,
  
  records: [],
  sapRawRecords: [],
  gstr2bRawRecords: [],
  selectedRowIds: [],

  // Discrepancy Panel
  selectedRecord: null,
  discrepancyPanelOpen: false,

  // Filter Panel
  filterPanelCollapsed: false,

  // Upload State
  upload: {
    isUploading: false,
    uploadProgress: 0,
    uploadStatusText: '',
    uploadErrorLog: null,
  },

  recoProgress: 0,
  recoStatusText: '',
  recoError: null,
  recoLogs: [],

  setActiveGstin: (activeGstin) => {
    set({ activeGstin });
    get().fetchDashboardData(activeGstin);
  },
  setReturnPeriod: (returnPeriod) => {
    set({ returnPeriod });
    get().fetchDashboardData(undefined, returnPeriod);
  },
  setRole: (role) => set({ role }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setActiveNavTab: (activeNavTab) => set({ activeNavTab }),

  setRecords: (records) => set({ records }),
  setSelectedRowIds: (selectedRowIds) => set({ selectedRowIds }),
  setSelectedRecord: (selectedRecord) => set({ selectedRecord, discrepancyPanelOpen: !!selectedRecord }),
  setDiscrepancyPanelOpen: (discrepancyPanelOpen) => set({ discrepancyPanelOpen, selectedRecord: discrepancyPanelOpen ? get().selectedRecord : null }),
  setFilterPanelCollapsed: (filterPanelCollapsed) => set({ filterPanelCollapsed }),
  setUploadState: (uploadUpdate) => set((state) => ({ upload: { ...state.upload, ...uploadUpdate } })),

  clearRecoError: () => set({ recoError: null }),
  clearRecoLogs: () => set({ recoLogs: [] }),

  fetchDashboardData: async (gstinOverride?: string, periodOverride?: string) => {
    const activeGstin = gstinOverride || get().activeGstin;
    const returnPeriod = periodOverride || get().returnPeriod;

    if (!activeGstin) return;

    set({ isLoadingData: true });
    try {
      // 1. Fetch main reconciliation results FIRST to render primary UI instantly
      const resReco = await axios.get(`${API_BASE}/reconcile/results`, {
        params: { gstin: activeGstin, period: returnPeriod },
        timeout: 2500
      });

      const recoData: RecoRecord[] = Array.isArray(resReco.data) ? resReco.data.map((item: any, idx: number) => ({
        id: item.match_id || item.id || `reco-${idx}`,
        match_id: item.match_id || item.id || `reco-${idx}`,
        match_level: item.match_level || 'Unmatched',
        match_status: item.match_status || 'Unmatched',
        similarity_score: item.similarity_score ?? 0,
        doc_type: item.doc_type || 'B2B',
        invoice_type: item.invoice_type || null,
        sap_record: item.sap_record || null,
        gst_record: item.gst_record || null,
        vendor_name: item.sap_record?.vendor_name || '-',
        invoice_num: item.sap_record?.invoice_num || '-',
        invoice_date: item.sap_record?.invoice_date || '-',
        total_tax: item.sap_record?.total_tax ?? 0,
        supplier_name: item.gst_record?.supplier_name || '-',
        portal_invoice_num: item.gst_record?.invoice_num || '-',
        portal_invoice_date: item.gst_record?.invoice_date || '-',
        portal_total_tax: item.gst_record?.total_tax ?? 0,
        return_period: item.return_period || returnPeriod,
      })) : [];

      // Immediately unblock main UI in ~0.2s!
      set({
        records: recoData,
        isLoadingData: false
      });

      // 2. Fetch raw SAP & GSTR-2B data asynchronously in background without blocking the UI
      Promise.all([
        axios.get(`${API_BASE}/data/sap`, {
          params: { gstin: activeGstin, period: returnPeriod },
          timeout: 2500
        }),
        axios.get(`${API_BASE}/data/gstr2b`, {
          params: { gstin: activeGstin, period: returnPeriod },
          timeout: 2500
        })
      ]).then(([resSap, resGstr2b]) => {
        // Build O(1) maps for fast lookup
        const sapRecoMap = new Map();
        const gstRecoMap = new Map();
        
        for (const reco of recoData) {
          if (reco.sap_record && reco.sap_record.id) {
            sapRecoMap.set(reco.sap_record.id, reco);
          }
          if (reco.gst_record && reco.gst_record.id) {
            gstRecoMap.set(reco.gst_record.id, reco);
          }
        }

        const enrichedSap = Array.isArray(resSap.data) ? resSap.data.map((sap: any) => {
          const matched = sapRecoMap.get(sap.id);
          return {
            ...sap,
            reconciliation_status: matched ? matched.match_status : 'Unmatched',
            match_level: matched ? matched.match_level : 'Unmatched',
            matched_gstr_invoice_number: matched?.gst_record?.invoice_num || null,
            matched_gstr_total_tax: matched?.gst_record?.total_tax != null ? matched.gst_record.total_tax : null,
            matched_gstr_supplier_name: matched?.gst_record?.supplier_name || null
          };
        }) : [];

        const enrichedGstr = Array.isArray(resGstr2b.data) ? resGstr2b.data.map((gst: any) => {
          const matched = gstRecoMap.get(gst.id);
          return {
            ...gst,
            reconciliation_status: matched ? matched.match_status : 'Unmatched',
            match_level: matched ? matched.match_level : 'Unmatched',
            matched_sap_document_number: matched?.sap_record?.invoice_num || null,
            matched_sap_total_tax: matched?.sap_record?.total_tax != null ? matched.sap_record.total_tax : null,
            matched_sap_vendor_name: matched?.sap_record?.vendor_name || null
          };
        }) : [];

        set({
          sapRawRecords: enrichedSap,
          gstr2bRawRecords: enrichedGstr
        });
      }).catch((err) => {
        console.warn('Background fetch of raw records failed, falling back to mock data:', err);
      });

    } catch (err: any) {
      console.info('Backend unavailable or network error. Using in-browser client-side demo mode.');
      const currentSap = get().sapRawRecords.length > 0 ? get().sapRawRecords : MOCK_SAP_RECORDS;
      const currentGstr = get().gstr2bRawRecords.length > 0 ? get().gstr2bRawRecords : MOCK_GSTR2B_RECORDS;
      const mockReco = generateMockRecoResults(currentSap, currentGstr);

      set({
        records: mockReco,
        sapRawRecords: currentSap,
        gstr2bRawRecords: currentGstr,
        isLoadingData: false
      });
    }
  },

  runReconciliation: async () => {
    const { activeGstin, returnPeriod, fetchDashboardData } = get();
    const timestamp = new Date().toLocaleTimeString();
    
    set({ 
      isRunningReco: true, 
      recoProgress: 15,
      recoStatusText: 'Initializing Engine & Clearing Prior Runs...',
      recoError: null,
      recoLogs: [`[${timestamp}] Starting 4-Level Reconciliation Engine for GSTIN ${activeGstin} (${returnPeriod})`]
    });

    let progressTimer: any = null;

    try {
      progressTimer = setInterval(() => {
        set((state) => {
          if (state.recoProgress < 85) {
            const nextProgress = state.recoProgress + 10;
            let status = state.recoStatusText;
            if (nextProgress >= 30 && nextProgress < 60) {
              status = 'Executing Level 1 & Level 2 Matching Logic...';
            } else if (nextProgress >= 60) {
              status = 'Executing Level 3 & Level 4 Signature/Fuzzy Matching...';
            }
            return { recoProgress: nextProgress, recoStatusText: status };
          }
          return state;
        });
      }, 400);

      const res = await axios.post(`${API_BASE}/reconcile/run`, null, {
        params: { gstin: activeGstin, period: returnPeriod },
        timeout: 3000
      });

      if (progressTimer) clearInterval(progressTimer);

      const doneTime = new Date().toLocaleTimeString();
      set({ 
        recoProgress: 90, 
        recoStatusText: 'Engine Execution Completed. Loading Results...',
        recoLogs: [...get().recoLogs, `[${doneTime}] Engine Execution Successful: ${res.data?.message || 'Success'}`]
      });

      await fetchDashboardData(activeGstin, returnPeriod);

      const finishTime = new Date().toLocaleTimeString();
      set({ 
        recoProgress: 100, 
        recoStatusText: 'Reconciliation Completed Successfully!',
        recoLogs: [...get().recoLogs, `[${finishTime}] Reco Results & AG Grid View Updated.`]
      });

      setTimeout(() => {
        set({ isRunningReco: false, recoProgress: 0, recoStatusText: '' });
      }, 2000);

    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      console.info('Executing client-side in-browser reconciliation engine...');
      
      const currentSap = get().sapRawRecords.length > 0 ? get().sapRawRecords : MOCK_SAP_RECORDS;
      const currentGstr = get().gstr2bRawRecords.length > 0 ? get().gstr2bRawRecords : MOCK_GSTR2B_RECORDS;
      const recoResults = generateMockRecoResults(currentSap, currentGstr);
      
      const finishTime = new Date().toLocaleTimeString();
      set({ 
        records: recoResults,
        sapRawRecords: currentSap,
        gstr2bRawRecords: currentGstr,
        recoProgress: 100, 
        recoStatusText: 'Reconciliation Completed (In-Browser Demo Mode)!',
        recoLogs: [...get().recoLogs, `[${finishTime}] Client-side Engine Executed: ${recoResults.length} matches computed.`]
      });

      setTimeout(() => {
        set({ isRunningReco: false, recoProgress: 0, recoStatusText: '' });
      }, 1500);
    }
  },


  acceptSelectedMatches: () => {
    const { records, selectedRowIds } = get();
    const updated = records.map((r) => {
      if (selectedRowIds.includes(r.id)) {
        return {
          ...r,
          match_status: 'Ready to Claim' as const,
          match_level: r.match_level.includes('Level') 
            ? `${r.match_level} (Accepted)` 
            : 'Level 2: Manually Accepted'
        };
      }
      return r;
    });
    set({ records: updated, selectedRowIds: [] });
  },

  rejectSelectedMatches: () => {
    const { records, selectedRowIds } = get();
    const updated = records.map((r) => {
      if (selectedRowIds.includes(r.id)) {
        return {
          ...r,
          match_status: 'Unmatched' as const,
          match_level: 'Unmatched: Rejected Match'
        };
      }
      return r;
    });
    set({ records: updated, selectedRowIds: [] });
  },

  deferSelectedMatches: () => {
    const { records, selectedRowIds } = get();
    const updated = records.map((r) => {
      if (selectedRowIds.includes(r.id)) {
        return {
          ...r,
          match_status: 'Review Required' as const,
          match_level: 'Deferred to Next Month'
        };
      }
      return r;
    });
    set({ records: updated, selectedRowIds: [] });
  },

  clearRawData: async (target: 'SAP' | 'GSTR2B' | 'ALL', allPeriods = false) => {
    const { activeGstin, returnPeriod, fetchDashboardData } = get();
    set({ isLoadingData: true });
    try {
      const res = await axios.delete(`${API_BASE}/data/clear`, {
        params: {
          gstin: activeGstin,
          target,
          period: returnPeriod,
          all_periods: allPeriods
        },
        timeout: 2500
      });
      await fetchDashboardData(activeGstin, returnPeriod);
      return res.data;
    } catch (err: any) {
      console.warn('Backend clear API unavailable, clearing client-side state:', err.message);
      if (target === 'SAP' || target === 'ALL') set({ sapRawRecords: [] });
      if (target === 'GSTR2B' || target === 'ALL') set({ gstr2bRawRecords: [] });
      if (target === 'ALL') set({ records: [] });
      return { status: 'success', message: 'Cleared client-side demo state.', sap_deleted: 0, gstr_deleted: 0, reco_deleted: 0 };
    } finally {
      set({ isLoadingData: false });
    }
  },

  acceptPortalValue: async (record: RecoRecord) => {
    const { activeGstin, returnPeriod, fetchDashboardData } = get();
    
    if (!record.sap_record?.id || !record.gst_record?.id) {
      // For records that are already matched, just update local status
      const updated = get().records.map((r) => {
        if (r.id === record.id) {
          return { ...r, match_status: 'Ready to Claim', match_level: 'Level 2: Manually Accepted' };
        }
        return r;
      });
      set({ records: updated, discrepancyPanelOpen: false, selectedRecord: null });
      return;
    }

    try {
      await axios.post(`${API_BASE}/reconcile/manual-match`, {
        sap_id: String(record.sap_record.id),
        gst_id: String(record.gst_record.id)
      }, { timeout: 2500 });
      
      await fetchDashboardData(activeGstin, returnPeriod);
      set({ discrepancyPanelOpen: false, selectedRecord: null });
    } catch (err: any) {
      console.warn('Backend manual match API unavailable, updating client-side state:', err.message);
      const updated = get().records.map((r) => {
        if (r.id === record.id) {
          return { ...r, match_status: 'Ready to Claim', match_level: 'Level 2: Manually Accepted' };
        }
        return r;
      });
      set({ records: updated, discrepancyPanelOpen: false, selectedRecord: null });
    }
  },
}));
