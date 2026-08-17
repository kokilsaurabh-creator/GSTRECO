import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fileParserService } from '../../services/fileParserService';
import { dbService } from '../../services/dbService';
import axios from 'axios';
import {
  FileJson,
  FileSpreadsheet,
  Upload,
  Database,
  Globe,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Server,
  Activity,
  HardDrive,
  ShieldCheck,
  ArrowUpCircle,
  FolderOpen,
  BarChart3,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const DataImportView: React.FC = () => {
  const {
    activeGstin,
    returnPeriod,
    sapRawRecords,
    gstr2bRawRecords,
    records,
    isLoadingData,
    fetchDashboardData,
    clearRawData,
  } = useAppStore();

  useEffect(() => {
    fetchDashboardData(activeGstin, returnPeriod);
  }, [activeGstin, returnPeriod, fetchDashboardData]);

  // Local upload state for multi-file handling
  const [localUploading, setLocalUploading] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localStatus, setLocalStatus] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'SAP' | 'GSTR2B' | 'ALL'>('SAP');
  const [deleteAllPeriods, setDeleteAllPeriods] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'gstr2b' | 'sap') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);

    setLocalUploading(true);
    setLocalError(null);
    setSuccessMsg(null);
    setLocalProgress(15);
    setLocalStatus(`Uploading ${selectedFiles.length} file(s)...`);

    const formData = new FormData();
    formData.append('active_gstin', activeGstin);
    formData.append('gstin', activeGstin);

    if (type === 'gstr2b') {
      selectedFiles.forEach((file) => formData.append('files', file));
      formData.append('file', selectedFiles[0]);
    } else {
      formData.append('file', selectedFiles[0]);
      formData.append('return_period', returnPeriod);
    }

    try {
      setLocalProgress(45);
      setLocalStatus(`Parsing & ingesting ${type === 'gstr2b' ? 'GSTR-2B JSON' : 'SAP MM Register'}...`);

      const endpoint = type === 'gstr2b' ? `${API_BASE}/ingest/gstr2b-json` : `${API_BASE}/ingestion/sap-mm`;
      const res = await axios.post(endpoint, formData, {
        timeout: 5000,
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 60) / progressEvent.total);
            setLocalProgress(Math.min(90, 20 + percent));
          }
        }
      });

      setLocalProgress(100);
      let msg = res.data?.message;
      if (type === 'gstr2b' && res.data?.files_processed) {
        msg = `Successfully ingested ${res.data.total_records_parsed} records from ${res.data.files_processed} GSTR-2B file(s)!`;
      }
      setLocalStatus(msg || 'Ingestion successful!');
      setSuccessMsg(msg || 'Data ingested successfully!');

      await fetchDashboardData(activeGstin, returnPeriod);

      setTimeout(() => {
        setLocalUploading(false);
        setLocalProgress(0);
        setLocalStatus('');
      }, 1500);
    } catch (err: any) {
      console.warn('Backend upload API offline, completing ingestion in client-side IndexedDB mode:', err.message);
      setLocalProgress(80);

      try {
        if (type === 'gstr2b') {
          const parsed = await fileParserService.parseGstr2bJson(selectedFiles, activeGstin, returnPeriod);
          await dbService.saveGstr2bRecords(parsed.gstrRecords || []);
          setLocalProgress(100);
          setLocalStatus(parsed.message);
          setSuccessMsg(parsed.message);
        } else {
          const parsed = await fileParserService.parseSapFile(selectedFiles[0], activeGstin, returnPeriod);
          await dbService.saveSapRecords(parsed.sapRecords || []);
          setLocalProgress(100);
          setLocalStatus(parsed.message);
          setSuccessMsg(parsed.message);
        }

        await fetchDashboardData(activeGstin, returnPeriod);

        setTimeout(() => {
          setLocalUploading(false);
          setLocalProgress(0);
          setLocalStatus('');
        }, 1500);
      } catch (parseErr: any) {
        setLocalProgress(0);
        setLocalStatus('Ingestion Error');
        setLocalError(parseErr.message || 'Failed to parse file client-side.');
        setLocalUploading(false);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteFeedback(null);
    try {
      const res = await clearRawData(deleteTarget, deleteAllPeriods);
      setDeleteFeedback({ type: 'success', message: res.message });
      setTimeout(() => {
        setShowDeleteConfirm(false);
        setIsDeleting(false);
      }, 2000);
    } catch (err: any) {
      setDeleteFeedback({ type: 'error', message: err.message || 'Failed to delete data.' });
      setIsDeleting(false);
    }
  };

  // Computed metrics
  const matchedCount = records.filter(r => r.match_status === 'Ready to Claim').length;
  const reviewCount = records.filter(r => r.match_status === 'Review Required').length;
  const unmatchedCount = records.filter(r => r.match_status === 'Unmatched' || r.match_status === 'Missing in Portal' || r.match_status === 'Missing in SAP').length;

  const cardVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.35 }
    })
  };

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center space-x-2">
            <Upload className="w-5 h-5 text-primary" />
            <span>Data Import & Settings</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload datasets, manage records, and configure your reconciliation workspace.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-muted-foreground">
          <span className="bg-surface px-2.5 py-1 rounded-lg border border-border/60">{activeGstin}</span>
          <span className="bg-surface px-2.5 py-1 rounded-lg border border-border/60">{returnPeriod}</span>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center justify-between animate-slideDown">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400/60 hover:text-emerald-400"><X className="w-4 h-4" /></button>
        </div>
      )}
      {localError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 animate-shake">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 text-destructive text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Ingestion Failed</span>
            </div>
            <button onClick={() => setLocalError(null)} className="text-destructive/60 hover:text-destructive"><X className="w-4 h-4" /></button>
          </div>
          <pre className="font-mono text-[11px] text-destructive/80 bg-background/50 p-2.5 rounded-lg whitespace-pre-wrap max-h-32 overflow-y-auto">{localError}</pre>
        </div>
      )}

      {/* Upload Progress Bar */}
      {localUploading && (
        <div className="bg-surface border border-border/60 rounded-xl p-4 animate-slideDown">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span>{localStatus}</span>
            </div>
            <span className="text-xs font-bold text-primary font-mono">{localProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all duration-300" style={{ width: `${localProgress}%` }} />
          </div>
        </div>
      )}

      {/* ═══ BENTO-BOX GRID ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* ── Card 1: GSTR-2B Upload ── */}
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Government GSTR-2B</h3>
              <p className="text-[10px] text-muted-foreground">Upload JSON from GST Portal</p>
            </div>
          </div>
          <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center hover:border-primary/40 transition-all relative cursor-pointer group/drop">
            <input
              type="file"
              accept=".json"
              multiple
              onChange={(e) => handleFileUpload(e, 'gstr2b')}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              disabled={localUploading || isLoadingData}
            />
            <ArrowUpCircle className="w-8 h-8 text-muted-foreground group-hover/drop:text-primary mx-auto mb-2 transition-colors" />
            <p className="text-xs font-semibold text-muted-foreground group-hover/drop:text-foreground transition-colors">Drop GSTR-2B JSON files here</p>
            <p className="text-[10px] text-muted-foreground mt-1">Supports B2B, CDNR, B2BA, IMPG sections</p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono">{gstr2bRawRecords.length} records loaded</span>
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">Multi-file</span>
          </div>
        </motion.div>

        {/* ── Card 2: SAP MM Upload ── */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-emerald-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">SAP MM Purchase Register</h3>
              <p className="text-[10px] text-muted-foreground">Upload Excel / CSV from SAP</p>
            </div>
          </div>
          <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center hover:border-emerald-500/40 transition-all relative cursor-pointer group/drop">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileUpload(e, 'sap')}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              disabled={localUploading || isLoadingData}
            />
            <ArrowUpCircle className="w-8 h-8 text-muted-foreground group-hover/drop:text-emerald-400 mx-auto mb-2 transition-colors" />
            <p className="text-xs font-semibold text-muted-foreground group-hover/drop:text-foreground transition-colors">Drop SAP Excel/CSV file here</p>
            <p className="text-[10px] text-muted-foreground mt-1">Auto-detects column mappings</p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-mono">{sapRawRecords.length} records loaded</span>
            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">Single file</span>
          </div>
        </motion.div>

        {/* ── Card 3: Data Summary ── */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-accent/30 transition-all"
        >
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Reconciliation Summary</h3>
              <p className="text-[10px] text-muted-foreground">{records.length} total match results</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-foreground">Matched & Ready</span>
              </div>
              <span className="text-xs font-bold font-financial text-emerald-400">{matchedCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-foreground">Pending Review</span>
              </div>
              <span className="text-xs font-bold font-financial text-amber-400">{reviewCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-xs text-foreground">Unmatched</span>
              </div>
              <span className="text-xs font-bold font-financial text-rose-400">{unmatchedCount}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Card 4: Raw Data Inventory ── */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-blue-500/30 transition-all"
        >
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Raw Data Inventory</h3>
              <p className="text-[10px] text-muted-foreground">Records loaded in database</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-foreground">SAP Purchase Register</span>
              </div>
              <span className="text-xs font-bold font-financial text-blue-400">{sapRawRecords.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-foreground">GSTR-2B Portal Invoices</span>
              </div>
              <span className="text-xs font-bold font-financial text-emerald-400">{gstr2bRawRecords.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs text-foreground">Reco Match Results</span>
              </div>
              <span className="text-xs font-bold font-financial text-accent">{records.length}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Card 5: Quick Actions (Data Management) ── */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-destructive/30 transition-all"
        >
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Data Management</h3>
              <p className="text-[10px] text-muted-foreground">Clear or purge uploaded records</p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => { setDeleteTarget('SAP'); setDeleteFeedback(null); setShowDeleteConfirm(true); }}
              className="w-full text-left flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40 hover:border-destructive/30 transition-all group"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-foreground group-hover:text-destructive transition-colors">Clear SAP Data</span>
              </div>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
            </button>
            <button
              onClick={() => { setDeleteTarget('GSTR2B'); setDeleteFeedback(null); setShowDeleteConfirm(true); }}
              className="w-full text-left flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40 hover:border-destructive/30 transition-all group"
            >
              <div className="flex items-center space-x-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-foreground group-hover:text-destructive transition-colors">Clear GSTR-2B Data</span>
              </div>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
            </button>
            <button
              onClick={() => { setDeleteTarget('ALL'); setDeleteFeedback(null); setShowDeleteConfirm(true); }}
              className="w-full text-left flex items-center justify-between p-3 bg-destructive/5 rounded-xl border border-destructive/20 hover:bg-destructive/10 transition-all group"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">Purge All Data</span>
              </div>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          </div>
        </motion.div>

        {/* ── Card 6: Engine Status ── */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-2xl p-6 hover:border-emerald-500/30 transition-all"
        >
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">Platform Status</h3>
              <p className="text-[10px] text-muted-foreground">Engine & database health</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-foreground">Reco Engine</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded">Online</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-foreground">PostgreSQL Neon DB</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/40">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">API Endpoint</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">localhost:8000</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn p-4 select-none">
          <div className="bg-card border border-destructive/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center space-x-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base text-foreground">Purge Data from Database</h3>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-muted-foreground">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-start space-x-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Permanent Action!</span>
                  <p className="text-[11px] mt-0.5">This will permanently delete records for GSTIN <span className="font-mono text-foreground font-bold">{activeGstin}</span>.</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1.5">Target:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SAP', 'GSTR2B', 'ALL'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDeleteTarget(t)}
                      className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all ${
                        deleteTarget === t
                          ? (t === 'ALL' ? 'border-destructive bg-destructive/20 text-destructive' : 'border-primary bg-primary/20 text-primary')
                          : 'border-border bg-surface hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {t === 'GSTR2B' ? 'GSTR-2B' : t === 'ALL' ? 'All Data' : 'Raw SAP'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-foreground mb-1">Period Scope:</label>
                <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-xl border border-border bg-surface hover:bg-muted/50 transition-all">
                  <input type="radio" name="scope" checked={!deleteAllPeriods} onChange={() => setDeleteAllPeriods(false)} className="text-primary" />
                  <div>
                    <div className="font-bold text-foreground text-xs">Active Period Only</div>
                    <div className="text-[10px] text-muted-foreground">Purges: <span className="font-bold text-primary">{returnPeriod}</span></div>
                  </div>
                </label>
                <label className="flex items-center space-x-2.5 cursor-pointer p-2.5 rounded-xl border border-border bg-surface hover:bg-muted/50 transition-all">
                  <input type="radio" name="scope" checked={deleteAllPeriods} onChange={() => setDeleteAllPeriods(true)} className="text-primary" />
                  <div>
                    <div className="font-bold text-foreground text-xs">All Periods</div>
                    <div className="text-[10px] text-muted-foreground">All periods for {activeGstin}</div>
                  </div>
                </label>
              </div>

              {deleteFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  deleteFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}>{deleteFeedback.message}</div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-border/60 pt-4">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting}
                className="px-4 py-2 rounded-xl gradient-danger text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all active:scale-[0.97] disabled:opacity-50">
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Confirm Purge'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
