import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatINR, formatDate } from '../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  AlertTriangle,
  Zap,
  Database,
  Globe,
  Loader2
} from 'lucide-react';

export const DiscrepancyPanel: React.FC = () => {
  const {
    selectedRecord,
    discrepancyPanelOpen,
    setDiscrepancyPanelOpen,
    setSelectedRecord,
    acceptPortalValue,
    rejectSelectedMatches,
    deferSelectedMatches,
    setSelectedRowIds,
  } = useAppStore();

  const [isAccepting, setIsAccepting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!selectedRecord) return null;

  const record = selectedRecord;
  const sap = record.sap_record;
  const gst = record.gst_record;

  const handleAcceptPortal = async () => {
    setIsAccepting(true);
    try {
      await acceptPortalValue(record);
      setActionSuccess('Portal value accepted — record marked as Ready to Claim.');
      setTimeout(() => {
        setActionSuccess(null);
        setDiscrepancyPanelOpen(false);
      }, 2000);
    } catch (err: any) {
      console.error('Accept portal value error:', err);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = () => {
    setSelectedRowIds([record.id]);
    rejectSelectedMatches();
    setDiscrepancyPanelOpen(false);
    setSelectedRecord(null);
  };

  const handleDefer = () => {
    setSelectedRowIds([record.id]);
    deferSelectedMatches();
    setDiscrepancyPanelOpen(false);
    setSelectedRecord(null);
  };

  const handleClose = () => {
    setDiscrepancyPanelOpen(false);
    setSelectedRecord(null);
  };

  // Diff computation
  const invNumMatch = sap?.invoice_num === gst?.invoice_num;
  const invDateMatch = sap?.invoice_date === gst?.invoice_date;
  const taxMatch = Math.abs((sap?.total_tax ?? 0) - (gst?.total_tax ?? 0)) <= 1.0;
  const taxableMatch = Math.abs((sap?.taxable_value ?? 0) - (gst?.taxable_value ?? 0)) <= 1.0;
  const taxDiff = (gst?.total_tax ?? 0) - (sap?.total_tax ?? 0);

  const confidenceScore = record.similarity_score ?? 0;
  const confidencePercent = Math.round(confidenceScore * 100);
  const confidenceColor = confidencePercent >= 90 ? 'text-emerald-400' : confidencePercent >= 70 ? 'text-amber-400' : 'text-rose-400';

  return (
    <AnimatePresence>
      {discrepancyPanelOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-primary/30 shadow-2xl max-h-[55vh] overflow-y-auto"
        >
          {/* Handle bar */}
          <div className="flex justify-center py-1.5">
            <div className="w-12 h-1 bg-border/60 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-6 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Discrepancy Analysis</h3>
                <p className="text-[10px] text-muted-foreground">
                  {record.match_level} • Match ID: <span className="font-mono">{record.id?.substring(0, 8)}...</span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Confidence Score */}
              <div className="flex items-center space-x-2 bg-surface border border-border/60 rounded-lg px-3 py-1.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Confidence</span>
                <span className={`text-sm font-black font-financial ${confidenceColor}`}>{confidencePercent}%</span>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Success Message */}
          {actionSuccess && (
            <div className="mx-6 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 flex items-center space-x-2 text-emerald-400 text-xs font-semibold animate-slideDown">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Side-by-Side Comparison */}
          <div className="px-6 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">

              {/* SAP Side */}
              <div className="bg-surface border border-border/60 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">SAP Purchase Register</span>
                </div>
                {sap ? (
                  <div className="space-y-2.5">
                    <FieldRow label="Vendor Name" value={sap.vendor_name || '-'} />
                    <FieldRow label="Vendor GSTIN" value={sap.vendor_gstin || '-'} mono />
                    <FieldRow label="Invoice Number" value={sap.invoice_num || '-'} mono highlight={!invNumMatch} />
                    <FieldRow label="Invoice Date" value={formatDate(sap.invoice_date)} highlight={!invDateMatch} />
                    <FieldRow label="Taxable Value" value={formatINR(sap.taxable_value)} financial />
                    <FieldRow label="Total Tax" value={formatINR(sap.total_tax)} financial highlight={!taxMatch} highlightColor="text-blue-400" />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic p-4 text-center">No SAP record found (Missing in SAP)</div>
                )}
              </div>

              {/* Center Arrow / Diff Indicator */}
              <div className="hidden lg:flex flex-col items-center justify-center space-y-3 py-4">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                {taxDiff !== 0 && (
                  <div className={`text-[10px] font-bold font-financial px-2 py-1 rounded-lg border ${
                    taxDiff > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}>
                    {taxDiff > 0 ? '+' : ''}{formatINR(taxDiff)}
                  </div>
                )}
              </div>

              {/* GSTR-2B Side */}
              <div className="bg-surface border border-border/60 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">GSTR-2B Portal</span>
                </div>
                {gst ? (
                  <div className="space-y-2.5">
                    <FieldRow label="Supplier Name" value={gst.supplier_name || '-'} />
                    <FieldRow label="Supplier GSTIN" value={gst.supplier_gstin || '-'} mono />
                    <FieldRow label="Invoice Number" value={gst.invoice_num || '-'} mono highlight={!invNumMatch} />
                    <FieldRow label="Invoice Date" value={formatDate(gst.invoice_date)} highlight={!invDateMatch} />
                    <FieldRow label="Taxable Value" value={formatINR(gst.taxable_value)} financial />
                    <FieldRow label="Total Tax" value={formatINR(gst.total_tax)} financial highlight={!taxMatch} highlightColor="text-emerald-400" />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic p-4 text-center">No GSTR-2B record found (Missing in Portal)</div>
                )}
              </div>
            </div>

            {/* Field-Level Diff Summary */}
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <DiffChip label="Invoice Number" match={invNumMatch} />
              <DiffChip label="Invoice Date" match={invDateMatch} />
              <DiffChip label="Total Tax" match={taxMatch} />
              <DiffChip label="Taxable Value" match={taxableMatch} />
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
              <div className="text-[10px] text-muted-foreground">
                Choose an action for this discrepancy:
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDefer}
                  className="flex items-center px-4 py-2 bg-surface border border-border/60 hover:border-muted-foreground/40 text-foreground rounded-lg font-semibold text-xs transition-all active:scale-[0.97]"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  Defer to Next Month
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center px-4 py-2 gradient-danger text-white rounded-lg font-semibold text-xs transition-all shadow-md shadow-destructive/15 active:scale-[0.97]"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Reject Match
                </button>
                <button
                  onClick={handleAcceptPortal}
                  disabled={isAccepting}
                  className="flex items-center px-5 py-2 gradient-primary text-white rounded-lg font-bold text-xs transition-all shadow-lg shadow-primary/20 active:scale-[0.97] disabled:opacity-50"
                >
                  {isAccepting ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Accept Portal Value
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Helper Components ──

const FieldRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  financial?: boolean;
  highlight?: boolean;
  highlightColor?: string;
}> = ({ label, value, mono, financial, highlight, highlightColor }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    <span className={`text-xs font-semibold ${
      highlight ? (highlightColor || 'text-amber-400') : 'text-foreground'
    } ${mono ? 'font-mono' : ''} ${financial ? 'font-financial' : ''}`}>
      {value}
    </span>
  </div>
);

const DiffChip: React.FC<{ label: string; match: boolean }> = ({ label, match }) => (
  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs font-medium ${
    match
      ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
      : 'bg-amber-500/8 border-amber-500/20 text-amber-400'
  }`}>
    {match ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
    <span>{label}</span>
    <span className="ml-auto text-[10px] font-bold">{match ? 'Match' : 'Diff'}</span>
  </div>
);
