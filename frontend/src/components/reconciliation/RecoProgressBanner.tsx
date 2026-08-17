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
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="w-full relative z-20 shrink-0">
      <AnimatePresence>
        {/* 1. Active Progress Bar Banner */}
        {(isRunningReco || recoProgress > 0) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border-b border-primary/30 shadow-lg px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center space-x-2">
                    <span>Reconciliation Engine In Progress</span>
                    <span className="text-[10px] font-mono text-primary font-bold bg-primary/10 px-1.5 rounded">{recoProgress}%</span>
                  </h4>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{recoStatusText}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowLogModal(true)}
                className="px-3 py-1.5 rounded-lg bg-surface border border-border/60 hover:border-primary/40 text-[10px] font-bold text-foreground flex items-center space-x-1.5 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>Live Console ({recoLogs.length})</span>
              </button>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-border/50">
              <div 
                className="gradient-primary h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${recoProgress}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* 2. Error Log Alert Banner */}
        {recoError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-destructive/10 border-b border-destructive/30 px-4 py-3 shadow-md flex items-start justify-between"
          >
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-destructive/20 text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-destructive flex items-center space-x-2">
                  <span>Reconciliation Execution Failed</span>
                </h4>
                <p className="text-[11px] font-mono text-foreground/90 bg-background/50 p-2 rounded-lg border border-destructive/20 max-w-3xl leading-relaxed">
                  {recoError}
                </p>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => setShowLogModal(true)}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center space-x-1"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Live Console / Error Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-strong border border-border/60 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-surface">
              <div className="flex items-center space-x-2.5">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Console & Exception Logs</h3>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log Content Area */}
            <div className="p-4 bg-[#0a0c10] font-mono text-[11px] text-slate-300 overflow-y-auto h-80 space-y-1.5 border-y border-border/30">
              {recoLogs.length === 0 ? (
                <p className="text-muted-foreground italic text-center mt-10">No logs recorded for current session.</p>
              ) : (
                recoLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed pl-2 border-l-2 ${
                      log.includes('ERROR') ? 'text-rose-400 font-semibold border-rose-500/50 bg-rose-500/5' : 
                      log.includes('Successful') || log.includes('Completed') ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/5' : 
                      'border-border/30 hover:bg-white/5'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-5 py-3 border-t border-border/60 flex items-center justify-between bg-surface">
              <button
                onClick={clearRecoLogs}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors font-bold"
              >
                Clear Console
              </button>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCopyLogs}
                  disabled={recoLogs.length === 0}
                  className="px-4 py-2 rounded-lg border border-border/60 hover:border-primary/40 bg-card text-xs font-bold text-foreground flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Logs'}</span>
                </button>

                <button
                  onClick={() => setShowLogModal(false)}
                  className="px-5 py-2 rounded-lg gradient-primary text-white text-xs font-bold transition-all shadow-md active:scale-95"
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
