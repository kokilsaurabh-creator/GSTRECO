import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  AlertTriangle, 
  X, 
  Terminal, 
  Copy, 
  Check, 
  RefreshCw 
} from 'lucide-react';

export const RecoProgressBanner: React.FC = () => {
  const { 
    isRunningReco, 
    recoProgress, 
    recoStatusText, 
    recoError, 
    recoLogs, 
    clearRecoError, 
    clearRecoLogs 
  } = useAppStore();

  const [showLogModal, setShowLogModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = () => {
    const text = recoLogs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-3 mb-4">
      {/* 1. Active Progress Bar Banner */}
      {(isRunningReco || recoProgress > 0) && (
        <div className="bg-card/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-lg transition-all animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center space-x-2">
                  <span>Reconciliation Engine In Progress</span>
                  <span className="text-[11px] font-mono text-primary font-bold">({recoProgress}%)</span>
                </h4>
                <p className="text-[11px] font-medium text-foreground/70">{recoStatusText}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogModal(true)}
              className="px-3 py-1.5 rounded-xl bg-background border border-border hover:border-primary/40 text-xs font-semibold text-foreground/80 flex items-center space-x-1.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>Live Console ({recoLogs.length})</span>
            </button>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden border border-border/50">
            <div 
              className="bg-gradient-to-r from-primary via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${recoProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Error Log Alert Banner */}
      {recoError && (
        <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-4 shadow-md flex items-start justify-between animate-shake">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-destructive/20 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-destructive flex items-center space-x-2">
                <span>Reconciliation Execution Failed</span>
              </h4>
              <p className="text-xs font-mono text-foreground/90 bg-background/50 p-2 rounded-lg border border-destructive/20 max-w-3xl leading-relaxed">
                {recoError}
              </p>
              <div className="flex items-center space-x-3 pt-1">
                <button
                  onClick={() => setShowLogModal(true)}
                  className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
                >
                  <Terminal className="w-3 h-3" />
                  <span>View Full Exception Logs</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={clearRecoError}
            className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive/80 hover:text-destructive transition-colors"
            title="Dismiss Error Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Live Console / Error Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center space-x-2.5">
                <Terminal className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Reconciliation Console & Exception Logs</h3>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg hover:bg-secondary text-foreground/60 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log Content Area */}
            <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-y-auto max-h-96 space-y-1.5 border-y border-border/40">
              {recoLogs.length === 0 ? (
                <p className="text-slate-500 italic">No logs recorded for current session.</p>
              ) : (
                recoLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed ${log.includes('ERROR') ? 'text-rose-400 font-semibold' : log.includes('Successful') || log.includes('Completed') ? 'text-emerald-400' : 'text-slate-300'}`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/20">
              <button
                onClick={clearRecoLogs}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
              >
                Clear Console
              </button>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCopyLogs}
                  disabled={recoLogs.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-border hover:border-primary/40 bg-background text-xs font-semibold text-foreground flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
                </button>

                <button
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
