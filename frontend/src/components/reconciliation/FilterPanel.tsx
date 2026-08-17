import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Search,
  Filter,
  X,
  CheckCircle2,
  AlertTriangle,
  Unlink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileMinus,
  FileDiff,
  Database,
  Globe
} from 'lucide-react';

interface FilterPanelProps {
  quickFilterText: string;
  setQuickFilterText: (v: string) => void;
  globalGstinFilter: string;
  setGlobalGstinFilter: (v: string) => void;
  docTab: string;
  setDocTab: (v: any) => void;
  subTab: string;
  setSubTab: (v: any) => void;
  counts: {
    b2bTotal: number;
    cdnrTotal: number;
    b2baTotal: number;
    matched: number;
    review: number;
    unmatched: number;
    manual: number;
  };
  sapRawCount: number;
  gstrRawCount: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  quickFilterText,
  setQuickFilterText,
  globalGstinFilter,
  setGlobalGstinFilter,
  docTab,
  setDocTab,
  subTab,
  setSubTab,
  counts,
  sapRawCount,
  gstrRawCount,
}) => {
  const { filterPanelCollapsed, setFilterPanelCollapsed } = useAppStore();

  if (filterPanelCollapsed) {
    return (
      <div className="w-10 bg-card border-r border-border/60 flex flex-col items-center py-4 shrink-0">
        <button
          onClick={() => setFilterPanelCollapsed(false)}
          className="p-1.5 rounded-lg bg-surface border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all mb-4"
          title="Expand filter panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center space-y-3 mt-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary" title="B2B" />
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" title="CDNR" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="B2BA" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-card border-r border-border/60 flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Filters</span>
        </div>
        <button
          onClick={() => setFilterPanelCollapsed(true)}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          title="Collapse filter panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border/40 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search all fields..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            className="w-full bg-surface border border-border/60 rounded-lg pl-8 pr-7 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 transition-colors"
          />
          {quickFilterText && (
            <button onClick={() => setQuickFilterText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by GSTIN..."
            value={globalGstinFilter}
            onChange={(e) => setGlobalGstinFilter(e.target.value)}
            className="w-full bg-surface border border-border/60 rounded-lg pl-7 pr-7 py-1.5 text-[11px] text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 transition-colors"
          />
          {globalGstinFilter && (
            <button onClick={() => setGlobalGstinFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Document Type */}
      <div className="px-4 py-3 border-b border-border/40">
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Document Type</span>
        <div className="mt-2 space-y-1">
          {[
            { id: 'B2B', label: 'B2B Invoices', icon: FileText, count: counts.b2bTotal, color: 'text-primary', active: 'bg-primary/15 border-primary/30 text-primary' },
            { id: 'CDNR', label: 'Credit Notes', icon: FileMinus, count: counts.cdnrTotal, color: 'text-purple-400', active: 'bg-purple-500/15 border-purple-500/30 text-purple-400' },
            { id: 'B2BA', label: 'Amendments', icon: FileDiff, count: counts.b2baTotal, color: 'text-amber-400', active: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = docTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setDocTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? `${item.active} border` : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? item.color : ''}`} />
                  <span>{item.label}</span>
                </div>
                <span className={`text-[10px] font-bold font-financial ${isActive ? '' : 'text-muted-foreground'}`}>{item.count}</span>
              </button>
            );
          })}

          <div className="h-px bg-border/40 my-2" />

          {[
            { id: 'RAW_SAP', label: 'Raw SAP', icon: Database, count: sapRawCount, color: 'text-blue-400', active: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
            { id: 'RAW_GSTR2B', label: 'Raw GSTR-2B', icon: Globe, count: gstrRawCount, color: 'text-emerald-400', active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = docTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setDocTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? `${item.active} border` : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? item.color : ''}`} />
                  <span>{item.label}</span>
                </div>
                <span className={`text-[10px] font-bold font-financial ${isActive ? '' : 'text-muted-foreground'}`}>{item.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Match Status Sub-filter (only for reco tabs) */}
      {docTab !== 'RAW_SAP' && docTab !== 'RAW_GSTR2B' && (
        <div className="px-4 py-3">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Match Status</span>
          <div className="mt-2 space-y-1">
            {[
              { id: 'MATCHED', label: 'Completely Matched', icon: CheckCircle2, count: counts.matched, color: 'text-emerald-400', active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
              { id: 'REVIEW', label: 'Pending Review', icon: AlertTriangle, count: counts.review, color: 'text-amber-400', active: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
              { id: 'UNMATCHED', label: 'Not Matched', icon: Unlink, count: counts.unmatched, color: 'text-rose-400', active: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
              { id: 'MANUAL', label: 'Manual Override', icon: ShieldCheck, count: counts.manual, color: 'text-indigo-400', active: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = subTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSubTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive ? `${item.active} border` : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? item.color : ''}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold font-financial ${isActive ? '' : 'text-muted-foreground'}`}>{item.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
