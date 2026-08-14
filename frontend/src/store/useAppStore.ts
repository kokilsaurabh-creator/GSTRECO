import { create } from 'zustand';
import type { RecoRecord } from '../data/mockData';
import axios from 'axios';

export type UserRole = 'Admin' | 'Customer' | 'Auditor';

const API_BASE = 'http://localhost:8000/api/v1';

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
  fetchDashboardData: (gstin?: string, period?: string) => Promise<void>;
  runReconciliation: () => Promise<void>;
  clearRecoError: () => void;
  clearRecoLogs: () => void;
  
  // Bulk actions
  acceptSelectedMatches: () => void;
  rejectSelectedMatches: () => void;
  deferSelectedMatches: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeGstin: '26AAACW1018K1ZH',
  returnPeriod: 'June 2026',
  role: 'Admin',
  sidebarCollapsed: false,
  activeNavTab: '2B Reconciliation',
  isRunningReco: false,
  isLoadingData: false,
  
  records: [],
  sapRawRecords: [],
  gstr2bRawRecords: [],
  selectedRowIds: [],

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

  clearRecoError: () => set({ recoError: null }),
  clearRecoLogs: () => set({ recoLogs: [] }),

  fetchDashboardData: async (gstinOverride?: string, periodOverride?: string) => {
    const activeGstin = gstinOverride || get().activeGstin;
    const returnPeriod = periodOverride || get().returnPeriod;

    if (!activeGstin) return;

    set({ isLoadingData: true });
    try {
      // Parallelized API Requests via Promise.all
      const [resReco, resSap, resGstr2b] = await Promise.all([
        axios.get(`${API_BASE}/reconcile/results`, {
          params: { gstin: activeGstin, period: returnPeriod }
        }),
        axios.get(`${API_BASE}/data/sap`, {
          params: { gstin: activeGstin, period: returnPeriod }
        }),
        axios.get(`${API_BASE}/data/gstr2b`, {
          params: { gstin: activeGstin, period: returnPeriod }
        })
      ]);

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
        // SAP column properties (strictly isolated to sap_record)
        vendor_name: item.sap_record?.vendor_name || '-',
        invoice_num: item.sap_record?.invoice_num || '-',
        invoice_date: item.sap_record?.invoice_date || '-',
        total_tax: item.sap_record?.total_tax ?? 0,
        // GSTR-2B column properties (strictly isolated to gst_record)
        supplier_name: item.gst_record?.supplier_name || '-',
        portal_invoice_num: item.gst_record?.invoice_num || '-',
        portal_invoice_date: item.gst_record?.invoice_date || '-',
        portal_total_tax: item.gst_record?.total_tax ?? 0,
        return_period: item.return_period || returnPeriod,
      })) : [];

      set({
        records: recoData,
        sapRawRecords: Array.isArray(resSap.data) ? resSap.data : [],
        gstr2bRawRecords: Array.isArray(resGstr2b.data) ? resGstr2b.data : []
      });
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      set({ isLoadingData: false });
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
        params: { gstin: activeGstin, period: returnPeriod }
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
      console.error('Error executing reconciliation engine:', err);
      let errMsg = err.response?.data?.detail || err.message || 'Engine execution failed.';
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        errMsg = 'Backend API server at http://localhost:8000 is unreachable. Please verify FastAPI service status.';
      }
      
      const errTime = new Date().toLocaleTimeString();
      set({ 
        isRunningReco: false, 
        recoProgress: 0, 
        recoStatusText: '',
        recoError: errMsg,
        recoLogs: [...get().recoLogs, `[${errTime}] ERROR: ${errMsg}`]
      });
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
  }
}));
