import { create } from 'zustand';
import type { RecoRecord } from '../data/mockData';
import { MOCK_SAP_RECORDS, MOCK_GSTR2B_RECORDS } from '../data/mockDataFallback';
import { dbService } from '../services/dbService';
import { runClientSideReconciliation } from '../services/recoEngineService';
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
      // 1. Try fetching from backend if active
      const resReco = await axios.get(`${API_BASE}/reconcile/results`, {
        params: { gstin: activeGstin, period: returnPeriod },
        timeout: 30000
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

      set({
        records: recoData,
        isLoadingData: false
      });
    } catch (err: any) {
      // 2. Client-Side Serverless Mode (IndexedDB)
      try {
        let storedSap = await dbService.getAllSapRecords();
        let storedGstr = await dbService.getAllGstr2bRecords();

        // Always re-run client side reco if we have raw records but are offline
        let storedReco = await dbService.getAllRecoResults();
        if (storedSap.length > 0 || storedGstr.length > 0) {
          storedReco = runClientSideReconciliation(storedSap, storedGstr);
          await dbService.clearRecoResults();
          await dbService.saveRecoResults(storedReco);
        }

        set({
          sapRawRecords: storedSap,
          gstr2bRawRecords: storedGstr,
          records: storedReco,
          isLoadingData: false
        });
      } catch (dbErr) {
        console.error('Error accessing IndexedDB:', dbErr);
        set({ isLoadingData: false });
      }
    }
  },

  runReconciliation: async () => {
    const { activeGstin, returnPeriod, fetchDashboardData } = get();
    const timestamp = new Date().toLocaleTimeString();
    
    set({ 
      isRunningReco: true, 
      recoProgress: 15,
      recoStatusText: 'Initializing Client-Side Reco Engine & Cleared Prior Runs...',
      recoError: null,
      recoLogs: [`[${timestamp}] Executing 4-Level Client-Side Reco Engine for GSTIN ${activeGstin} (${returnPeriod})`]
    });

    let progressTimer: any = null;

    try {
      progressTimer = setInterval(() => {
        set((state) => {
          if (state.recoProgress < 85) {
            const nextProgress = state.recoProgress + 15;
            let status = state.recoStatusText;
            if (nextProgress >= 30 && nextProgress < 60) {
              status = 'Executing Level 1 & Level 2 Matching Logic in Browser RAM...';
            } else if (nextProgress >= 60) {
              status = 'Executing Level 3 & Level 4 Signature Matching...';
            }
            return { recoProgress: nextProgress, recoStatusText: status };
          }
          return state;
        });
      }, 150);

      // Try running via FastAPI backend if active
      await axios.post(`${API_BASE}/reconcile/run`, null, {
        params: { gstin: activeGstin, period: returnPeriod },
        timeout: 30000
      });

      if (progressTimer) clearInterval(progressTimer);
      await fetchDashboardData(activeGstin, returnPeriod);

      const finishTime = new Date().toLocaleTimeString();
      set({ 
        recoProgress: 100, 
        recoStatusText: 'Reconciliation Completed Successfully!',
        recoLogs: [...get().recoLogs, `[${finishTime}] Backend Reco Results & AG Grid View Updated.`]
      });

      setTimeout(() => {
        set({ isRunningReco: false, recoProgress: 0, recoStatusText: '' });
      }, 1500);

    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);

      // Run Client-Side Engine in JS
      const currentSap = get().sapRawRecords.length > 0 ? get().sapRawRecords : await dbService.getAllSapRecords();
      const currentGstr = get().gstr2bRawRecords.length > 0 ? get().gstr2bRawRecords : await dbService.getAllGstr2bRecords();
      const recoResults = runClientSideReconciliation(currentSap, currentGstr);
      
      // Save to IndexedDB
      await dbService.saveRecoResults(recoResults);

      const finishTime = new Date().toLocaleTimeString();
      set({ 
        records: recoResults,
        sapRawRecords: currentSap,
        gstr2bRawRecords: currentGstr,
        recoProgress: 100, 
        recoStatusText: 'Reconciliation Completed (Client-Side IndexedDB Engine)!',
        recoLogs: [...get().recoLogs, `[${finishTime}] Client-side Engine Executed: ${recoResults.length} matches computed and saved to IndexedDB.`]
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
      console.warn('Backend clear API unavailable, clearing IndexedDB state:', err.message);
      await dbService.clearAllData();
      set({ sapRawRecords: [], gstr2bRawRecords: [], records: [] });
      return { status: 'success', message: 'Cleared client-side IndexedDB database state.', sap_deleted: 0, gstr_deleted: 0, reco_deleted: 0 };
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
