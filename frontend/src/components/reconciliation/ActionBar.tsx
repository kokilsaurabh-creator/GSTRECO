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
      'ID', 'SAP Vendor Name', 'SAP GSTIN', 'SAP Invoice Num', 'SAP Invoice Date', 'SAP Tax (INR)',
      'Match Level', 'Match Status',
      'Portal Supplier Name', 'Portal GSTIN', 'Portal Invoice Num', 'Portal Invoice Date', 'Portal Tax (INR)'
    ];

    const csvRows = [
      headers.join(','),
      ...exportData.map(r => [
        `"${r.id}"`,
        `"${r.sap_record ? r.sap_record.vendor_name : '-'}"`,
        `"${r.sap_record ? r.sap_record.vendor_gstin : '-'}"`,
        `"${r.sap_record ? r.sap_record.invoice_num : '-'}"`,
        `"${r.sap_record ? r.sap_record.invoice_date : '-'}"`,
        r.sap_record ? r.sap_record.total_tax : 0,
        `"${r.match_level}"`,
        `"${r.match_status}"`,
        `"${r.gst_record ? r.gst_record.supplier_name : '-'}"`,
        `"${r.gst_record ? r.gst_record.supplier_gstin : '-'}"`,
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-strong shadow-2xl rounded-2xl px-5 py-3 flex items-center space-x-5 select-none"
        >
          {/* Selection Indicator */}
          <div className="flex items-center space-x-3 pr-4 border-r border-border/60">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shadow-inner">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                {selectedCount} {selectedCount === 1 ? 'Record' : 'Records'} Selected
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bulk Actions Ready</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            
            {/* Accept Match */}
            <button
              onClick={acceptSelectedMatches}
              className="flex items-center px-4 py-2 gradient-success text-white rounded-lg font-bold text-xs transition-all shadow-md active:scale-95"
              title="Approve fuzzy match and move to Ready to Claim"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Accept Match
            </button>

            {/* Reject Match */}
            <button
              onClick={rejectSelectedMatches}
              className="flex items-center px-4 py-2 gradient-danger text-white rounded-lg font-bold text-xs transition-all shadow-md active:scale-95"
              title="Break fuzzy match link and mark as Unmatched"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Reject Match
            </button>

            {/* Defer to Next Month */}
            <button
              onClick={deferSelectedMatches}
              className="flex items-center px-4 py-2 bg-surface hover:bg-muted border border-border/60 text-foreground rounded-lg font-bold text-xs transition-all active:scale-95"
              title="Flag invoice to be checked against next month's GSTR-2B"
            >
              <Clock className="w-4 h-4 mr-1.5 text-muted-foreground" />
              Defer to Next Month
            </button>

            {/* Export Exceptions */}
            <button
              onClick={handleExportExceptions}
              className="flex items-center px-4 py-2 bg-surface hover:bg-muted border border-border/60 text-foreground rounded-lg font-bold text-xs transition-all active:scale-95 ml-2"
              title="Download selected exception records to CSV"
            >
              <Download className="w-4 h-4 mr-1.5 text-muted-foreground" />
              Export CSV
            </button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
