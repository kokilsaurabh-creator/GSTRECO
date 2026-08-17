import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Upload, 
  GitCompareArrows, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Settings
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'Import', label: 'Data Import & Settings', icon: Upload, path: '/dashboard/import', badge: null },
  { id: 'Reconciliation', label: 'Reconciliation', icon: GitCompareArrows, path: '/dashboard/reconciliation', badge: 'Live' },
  { id: 'Analytics', label: 'Supplier Analytics', icon: BarChart3, path: '/dashboard/analytics', badge: null },
  { id: 'Settings', label: 'Configuration', icon: Settings, path: '/dashboard/import', badge: null },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item: typeof NAV_ITEMS[0]) => {
    navigate(item.path);
  };

  // Derive active from URL path
  const getActiveId = () => {
    if (location.pathname.includes('/import')) return 'Import';
    if (location.pathname.includes('/analytics')) return 'Analytics';
    return 'Reconciliation';
  };

  const currentActiveId = getActiveId();

  return (
    <aside 
      className={`glass-strong flex flex-col z-30 select-none transition-all duration-300 border-r border-border/60 ${
        sidebarCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary/20 shrink-0">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          {!sidebarCollapsed && (
            <div className="truncate animate-fadeIn">
              <h1 className="font-bold text-foreground tracking-tight text-sm flex items-center">
                GST RECO <span className="ml-1.5 text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">3-WAY</span>
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">Enterprise Platform v2</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {!sidebarCollapsed && (
          <div className="px-3 mb-3">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Navigation</span>
          </div>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentActiveId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-primary/15 text-primary font-semibold border border-primary/20 glow-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary transition-colors'
              }`} />
              {!sidebarCollapsed && (
                <span className="ml-3 truncate flex-1 text-left text-[13px]">{item.label}</span>
              )}
              {!sidebarCollapsed && item.badge && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isActive ? 'bg-primary/20 text-primary' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {item.badge}
                </span>
              )}
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-3 border-t border-border/60 shrink-0">
        {!sidebarCollapsed ? (
          <div className="p-3 rounded-xl bg-surface border border-border/60 text-xs">
            <div className="flex items-center text-emerald-400 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Engine Status: Active
            </div>
            <p className="text-[10px] text-muted-foreground">PostgreSQL Neon DB connected</p>
          </div>
        ) : (
          <div className="flex justify-center p-2 text-emerald-400" title="Engine Active — Neon DB Connected">
            <ShieldCheck className="w-5 h-5" />
          </div>
        )}
      </div>
    </aside>
  );
};
