import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { UserRole } from '../../store/useAppStore';
import { 
  Building2, 
  Calendar, 
  UserCheck, 
  ChevronDown, 
  Sparkles,
  Bell,
  Play,
  RefreshCw
} from 'lucide-react';

const GSTIN_OPTIONS = [
  { gstin: '26AAACW1018K1ZH', label: '26AAACW1018K1ZH', state: 'Gujarat Operations' },
  { gstin: '27AAAAA0000A1Z5', label: '27AAAAA0000A1Z5', state: 'Maharashtra Operations' },
  { gstin: '29BBBBB0000B1Z5', label: '29BBBBB0000B1Z5', state: 'Karnataka Operations' },
  { gstin: '07CCCCC0000C1Z5', label: '07CCCCC0000C1Z5', state: 'Delhi Corporate' }
];

const PERIOD_OPTIONS = [
  'June 2026',
  'July 2026',
  'August 2026',
  'July 2023',
  'August 2023',
  'September 2023'
];

const ROLES: UserRole[] = ['Admin', 'Customer', 'Auditor'];

export const Header: React.FC = () => {
  const { 
    activeGstin, 
    setActiveGstin, 
    returnPeriod, 
    setReturnPeriod, 
    role, 
    setRole,
    runReconciliation,
    isRunningReco
  } = useAppStore();

  const allGstinOptions = useMemo(() => {
    const exists = GSTIN_OPTIONS.some(opt => opt.gstin === activeGstin);
    if (!exists && activeGstin) {
      return [{ gstin: activeGstin, label: activeGstin, state: 'Uploaded Account' }, ...GSTIN_OPTIONS];
    }
    return GSTIN_OPTIONS;
  }, [activeGstin]);

  return (
    <header className="h-14 glass-strong border-b border-border/60 px-6 flex items-center justify-between z-20 shrink-0">
      
      {/* Title / Context Indicator */}
      <div className="flex items-center space-x-3">
        <div className="hidden sm:flex items-center space-x-2 bg-primary/8 px-3 py-1.5 rounded-lg border border-primary/15">
          <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-[11px] font-semibold text-primary tracking-wide">4-Level Reco Engine (IndexedDB Serverless)</span>
        </div>
      </div>

      {/* Top Header Controls (Context Bar) */}
      <div className="flex items-center space-x-3">
        
        {/* GSTIN Switcher */}
        <div className="relative flex items-center bg-surface border border-border/60 rounded-lg px-3 py-1.5 focus-within:border-primary/40 transition-colors">
          <Building2 className="w-3.5 h-3.5 text-primary mr-2 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-muted-foreground leading-none tracking-wider">GSTIN</span>
            <select
              value={activeGstin}
              onChange={(e) => setActiveGstin(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-foreground focus:outline-none cursor-pointer pr-4 font-mono"
            >
              {allGstinOptions.map((opt) => (
                <option key={opt.gstin} value={opt.gstin} className="bg-card text-foreground">
                  {opt.gstin} ({opt.state})
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none absolute right-2.5" />
        </div>

        {/* Period Selector */}
        <div className="relative flex items-center bg-surface border border-border/60 rounded-lg px-3 py-1.5 focus-within:border-primary/40 transition-colors">
          <Calendar className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-muted-foreground leading-none tracking-wider">Period</span>
            <select
              value={returnPeriod}
              onChange={(e) => setReturnPeriod(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-foreground focus:outline-none cursor-pointer pr-4"
            >
              {PERIOD_OPTIONS.map((period) => (
                <option key={period} value={period} className="bg-card text-foreground">
                  {period}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none absolute right-2.5" />
        </div>

        {/* Primary Run Reconciliation Button */}
        <button
          onClick={runReconciliation}
          disabled={isRunningReco}
          className="flex items-center px-4 py-2 gradient-primary hover:opacity-90 text-white rounded-lg font-bold text-[11px] transition-all shadow-lg shadow-primary/20 active:scale-[0.97] disabled:opacity-50 shrink-0 space-x-2"
          title="Run 4-Level Reconciliation Engine"
        >
          {isRunningReco ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isRunningReco ? 'Running...' : 'Run Reconciliation'}</span>
        </button>

        {/* Notifications */}
        <button className="p-2 rounded-lg bg-surface border border-border/60 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full"></span>
        </button>

        {/* User Profile & Role Switcher */}
        <div className="flex items-center space-x-2.5 pl-3 border-l border-border/60">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-[10px] shadow-md shadow-primary/15">
            AP
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-[11px] font-bold text-foreground leading-tight">Apex Admin</span>
            <div className="flex items-center">
              <UserCheck className="w-3 h-3 text-emerald-400 mr-1" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="bg-transparent text-[10px] font-semibold text-primary focus:outline-none cursor-pointer"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="bg-card text-foreground">
                    Role: {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
