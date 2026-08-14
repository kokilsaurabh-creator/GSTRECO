import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Calculator, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { id: '2B Reconciliation', label: '2B Reconciliation', icon: FileSpreadsheet, badge: 'Live' },
  { id: '3B Preparation', label: '3B Preparation', icon: Calculator, badge: null },
  { id: 'Reports', label: 'Reports', icon: BarChart3, badge: null },
  { id: 'Settings', label: 'Settings', icon: Settings, badge: null },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed, activeNavTab, setActiveNavTab } = useAppStore();

  return (
    <aside 
      className={`bg-card border-r border-border transition-all duration-300 flex flex-col z-30 select-none ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          {!sidebarCollapsed && (
            <div className="truncate">
              <h1 className="font-bold text-foreground tracking-tight text-sm flex items-center">
                GST RECO <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono">3-WAY</span>
              </h1>
              <p className="text-[11px] text-foreground/50 truncate">Enterprise Platform</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-background/80 transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNavTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNavTab(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20'
                  : 'text-foreground/70 hover:text-foreground hover:bg-background/60'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-foreground/60 group-hover:text-primary'}`} />
              {!sidebarCollapsed && (
                <span className="ml-3 truncate flex-1 text-left">{item.label}</span>
              )}
              {!sidebarCollapsed && item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-3 border-t border-border bg-background/30">
        {!sidebarCollapsed ? (
          <div className="p-2.5 rounded-xl bg-card border border-border/80 text-xs">
            <div className="flex items-center text-emerald-400 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Engine Status: Active
            </div>
            <p className="text-[11px] text-foreground/50">PostgreSQL Neon DB connected</p>
          </div>
        ) : (
          <div className="flex justify-center p-2 text-emerald-400" title="Engine Active - Neon DB Connected">
            <ShieldCheck className="w-5 h-5" />
          </div>
        )}
      </div>
    </aside>
  );
};
