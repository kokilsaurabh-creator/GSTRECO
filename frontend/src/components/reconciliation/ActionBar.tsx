import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ActionBar: React.FC = () => {
  const { 
    selectedRowIds, 
    acceptSelectedMatches, 
    rejectSelectedMatches, 
    deferSelectedMatches,
    records 
  } = useAppStore();

  const selectedCount = selectedRowIds.length;

  // Handle Export Exceptions
  const handleExportExceptions = () => {
    const selectedRecords = records.filter(r => selectedRowIds.includes(r.id));
    const exportData = selectedRecords.length > 0 ? selectedRecords : records;

    const headers = [
      'ID', 'SAP Vendor Name', 'SAP Invoice Num', 'SAP Invoice Date', 'SAP Tax (INR)',
      'Match Level', 'Match Status',
      'Portal Supplier Name', 'Portal Invoice Num', 'Portal Invoice Date', 'Portal Tax (INR)'
    ];

    const csvRows = [
      headers.join(','),
      ...exportData.map(r => [
        `"${r.id}"`,
        `"${r.sap_record ? r.sap_record.vendor_name : '-'}"`,
        `"${r.sap_record ? r.sap_record.invoice_num : '-'}"`,
        `"${r.sap_record ? r.sap_record.invoice_date : '-'}"`,
        r.sap_record ? r.sap_record.total_tax : 0,
        `"${r.match_level}"`,
        `"${r.match_status}"`,
        `"${r.gst_record ? r.gst_record.supplier_name : '-'}"`,
        `"${r.gst_record ? r.gst_record.invoice_num : '-'}"`,
        `"${r.gst_record ? r.gst_record.invoice_date : '-'}"`,
        r.gst_record ? r.gst_record.total_tax : 0
      ].join(','))

    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GST_Reco_Exceptions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-2xl px-6 py-3.5 flex items-center space-x-6 select-none"
        >
          {/* Selection Indicator */}
          <div className="flex items-center space-x-3 pr-4 border-r border-border">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                {selectedCount} {selectedCount === 1 ? 'Record' : 'Records'} Selected
              </div>
              <p className="text-[10px] text-foreground/60">Bulk Actions Ready</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            
            {/* Accept Match */}
            <button
              onClick={acceptSelectedMatches}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-95"
              title="Approve fuzzy match and move to Ready to Claim"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Accept Match
            </button>

            {/* Reject Match */}
            <button
              onClick={rejectSelectedMatches}
              className="flex items-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-rose-600/20 active:scale-95"
              title="Break fuzzy match link and mark as Unmatched"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Reject Match
            </button>

            {/* Defer to Next Month */}
            <button
              onClick={deferSelectedMatches}
              className="flex items-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl font-semibold text-xs transition-all active:scale-95"
              title="Flag invoice to be checked against next month's GSTR-2B"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              Defer to Next Month
            </button>

            {/* Export Exceptions */}
            <button
              onClick={handleExportExceptions}
              className="flex items-center px-4 py-2 border border-border bg-background hover:bg-card text-foreground rounded-xl font-semibold text-xs transition-all active:scale-95"
              title="Download selected exception records to CSV"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Exceptions
            </button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
