import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatINR } from '../../utils/formatters';
import { motion } from 'framer-motion';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  FileSearch,
  PieChart,
  Target,
  Clock,
  XCircle,
} from 'lucide-react';

interface SupplierRisk {
  supplierName: string;
  supplierGstin: string;
  totalInvoices: number;
  matchedCount: number;
  unmatchedCount: number;
  reviewCount: number;
  totalTaxExposure: number;
  unmatchedTaxValue: number;
  matchRate: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const SupplierAnalyticsView: React.FC = () => {
  const { records, activeGstin, returnPeriod } = useAppStore();

  // ─── Compute KPIs ───
  const kpis = useMemo(() => {
    const total = records.length;
    const matched = records.filter(r => r.match_status === 'Ready to Claim').length;
    const review = records.filter(r => r.match_status === 'Review Required').length;
    const unmatched = records.filter(r => 
      r.match_status === 'Unmatched' || 
      r.match_status === 'Missing in Portal' || 
      r.match_status === 'Missing in SAP'
    ).length;
    const manual = records.filter(r => r.match_level?.includes('Manual')).length;

    const totalTax = records.reduce((sum, r) => sum + (r.gst_record?.total_tax ?? r.total_tax ?? 0), 0);
    const matchedTax = records
      .filter(r => r.match_status === 'Ready to Claim')
      .reduce((sum, r) => sum + (r.gst_record?.total_tax ?? r.total_tax ?? 0), 0);
    const unmatchedTax = records
      .filter(r => r.match_status === 'Unmatched' || r.match_status === 'Missing in Portal' || r.match_status === 'Missing in SAP')
      .reduce((sum, r) => sum + (r.gst_record?.total_tax ?? r.total_tax ?? 0), 0);

    return {
      total,
      matched,
      review,
      unmatched,
      manual,
      matchRate: total > 0 ? ((matched / total) * 100) : 0,
      reviewRate: total > 0 ? ((review / total) * 100) : 0,
      unmatchedRate: total > 0 ? ((unmatched / total) * 100) : 0,
      totalITC: totalTax,
      claimableITC: matchedTax,
      atRiskITC: unmatchedTax,
    };
  }, [records]);

  // ─── Compute Supplier Risk Rankings ───
  const supplierRiskData = useMemo<SupplierRisk[]>(() => {
    const supplierMap = new Map<string, {
      name: string;
      gstin: string;
      total: number;
      matched: number;
      unmatched: number;
      review: number;
      totalTax: number;
      unmatchedTax: number;
    }>();

    records.forEach(r => {
      const gstin = r.gst_record?.supplier_gstin || r.sap_record?.vendor_gstin || r.vendor_gstin || r.supplier_gstin || 'Unknown';
      const name = r.gst_record?.supplier_name || r.sap_record?.vendor_name || r.vendor_name || r.supplier_name || 'Unknown';
      const tax = r.gst_record?.total_tax ?? r.total_tax ?? 0;
      
      if (!supplierMap.has(gstin)) {
        supplierMap.set(gstin, { name, gstin, total: 0, matched: 0, unmatched: 0, review: 0, totalTax: 0, unmatchedTax: 0 });
      }
      const entry = supplierMap.get(gstin)!;
      entry.total++;
      entry.totalTax += tax;
      
      if (r.match_status === 'Ready to Claim') entry.matched++;
      else if (r.match_status === 'Review Required') { entry.review++; }
      else { entry.unmatched++; entry.unmatchedTax += Math.abs(tax); }
    });

    return Array.from(supplierMap.values())
      .map(s => {
        const matchRate = s.total > 0 ? (s.matched / s.total) * 100 : 0;
        const riskScore = (s.unmatched * 3) + (s.review * 1) + (s.unmatchedTax / 10000);
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (riskScore >= 50) riskLevel = 'CRITICAL';
        else if (riskScore >= 20) riskLevel = 'HIGH';
        else if (riskScore >= 5) riskLevel = 'MEDIUM';

        return {
          supplierName: s.name,
          supplierGstin: s.gstin,
          totalInvoices: s.total,
          matchedCount: s.matched,
          unmatchedCount: s.unmatched,
          reviewCount: s.review,
          totalTaxExposure: s.totalTax,
          unmatchedTaxValue: s.unmatchedTax,
          matchRate,
          riskScore,
          riskLevel,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [records]);

  // Outstanding unmatched invoices
  const outstandingInvoices = useMemo(() => {
    return records
      .filter(r => r.match_status === 'Unmatched' || r.match_status === 'Missing in Portal' || r.match_status === 'Missing in SAP')
      .slice(0, 20);
  }, [records]);

  const cardVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.35 }
    })
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'HIGH': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span>Supplier Analytics & Risk Dashboard</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Supplier risk rankings, ITC analysis, and outstanding invoice tracking.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-muted-foreground">
          <span className="bg-surface px-2.5 py-1 rounded-lg border border-border/60">{activeGstin}</span>
          <span className="bg-surface px-2.5 py-1 rounded-lg border border-border/60">{returnPeriod}</span>
        </div>
      </div>

      {/* ═══ KPI CARDS ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Records', value: kpis.total.toString(), icon: FileSearch, color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/20' },
          { label: 'Match Rate', value: `${kpis.matchRate.toFixed(1)}%`, icon: Target, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', trend: kpis.matchRate >= 80 ? 'up' : 'down' },
          { label: 'Matched', value: kpis.matched.toString(), icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
          { label: 'Review', value: kpis.review.toString(), icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
          { label: 'Unmatched', value: kpis.unmatched.toString(), icon: XCircle, color: 'text-rose-400', bgColor: 'bg-rose-500/10', borderColor: 'border-rose-500/20', trend: kpis.unmatched > 0 ? 'down' : 'up' },
          { label: 'Manual', value: kpis.manual.toString(), icon: ShieldCheck, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}
              className={`bg-card border ${kpi.borderColor} rounded-xl p-4 hover:border-primary/30 transition-all`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                {kpi.trend && (
                  <div className={`flex items-center ${kpi.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {kpi.trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  </div>
                )}
              </div>
              <div className={`text-2xl font-black font-financial ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">{kpi.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* ═══ ITC SUMMARY ROW ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-xl p-5"
        >
          <div className="flex items-center space-x-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Total ITC Exposure</span>
          </div>
          <div className="text-xl font-black font-financial text-primary">{formatINR(kpis.totalITC)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Combined tax across all records</div>
        </motion.div>

        <motion.div custom={7} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-emerald-500/20 rounded-xl p-5"
        >
          <div className="flex items-center space-x-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-foreground">Claimable ITC</span>
          </div>
          <div className="text-xl font-black font-financial text-emerald-400">{formatINR(kpis.claimableITC)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Matched & ready to claim</div>
          {kpis.totalITC > 0 && (
            <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(kpis.claimableITC / kpis.totalITC * 100).toFixed(0)}%` }} />
            </div>
          )}
        </motion.div>

        <motion.div custom={8} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-rose-500/20 rounded-xl p-5"
        >
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-foreground">At-Risk ITC</span>
          </div>
          <div className="text-xl font-black font-financial text-rose-400">{formatINR(kpis.atRiskITC)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Unmatched invoices — needs resolution</div>
          {kpis.totalITC > 0 && (
            <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${(kpis.atRiskITC / kpis.totalITC * 100).toFixed(0)}%` }} />
            </div>
          )}
        </motion.div>
      </div>

      {/* ═══ MAIN CONTENT: SUPPLIER TABLE + OUTSTANDING INVOICES ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">

        {/* Supplier Risk Table */}
        <motion.div custom={9} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Supplier Risk Rankings</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{supplierRiskData.length} suppliers</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface border-b border-border/60">
                  <th className="text-left font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Rank</th>
                  <th className="text-left font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Supplier</th>
                  <th className="text-left font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">GSTIN</th>
                  <th className="text-center font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Invoices</th>
                  <th className="text-center font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Matched</th>
                  <th className="text-center font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Unmatched</th>
                  <th className="text-right font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Exposure</th>
                  <th className="text-right font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">At Risk</th>
                  <th className="text-center font-bold text-muted-foreground uppercase tracking-wider px-4 py-2.5 text-[10px]">Risk</th>
                </tr>
              </thead>
              <tbody>
                {supplierRiskData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-muted-foreground py-8 italic">
                      No reconciliation data available. Run the engine to generate supplier analytics.
                    </td>
                  </tr>
                ) : (
                  supplierRiskData.slice(0, 25).map((supplier, index) => (
                    <tr key={supplier.supplierGstin} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-financial font-bold text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-2.5 font-semibold text-foreground max-w-[200px] truncate">{supplier.supplierName}</td>
                      <td className="px-4 py-2.5 font-mono text-primary text-[11px]">{supplier.supplierGstin}</td>
                      <td className="px-4 py-2.5 text-center font-financial font-bold">{supplier.totalInvoices}</td>
                      <td className="px-4 py-2.5 text-center font-financial font-bold text-emerald-400">{supplier.matchedCount}</td>
                      <td className="px-4 py-2.5 text-center font-financial font-bold text-rose-400">{supplier.unmatchedCount}</td>
                      <td className="px-4 py-2.5 text-right font-financial font-semibold">{formatINR(supplier.totalTaxExposure)}</td>
                      <td className="px-4 py-2.5 text-right font-financial font-bold text-rose-400">{formatINR(supplier.unmatchedTaxValue)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRiskColor(supplier.riskLevel)}`}>
                          {supplier.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Outstanding Invoices Sidebar */}
        <motion.div custom={10} initial="hidden" animate="visible" variants={cardVariants}
          className="bg-card border border-border/60 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border/60 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-foreground">Outstanding Invoices</h3>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold">{outstandingInvoices.length}</span>
          </div>
          <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
            {outstandingInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground italic">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/30 mx-auto mb-2" />
                All invoices matched! No outstanding items.
              </div>
            ) : (
              outstandingInvoices.map((inv) => (
                <div key={inv.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground truncate max-w-[60%]">
                      {inv.sap_record?.vendor_name || inv.gst_record?.supplier_name || inv.vendor_name || 'Unknown'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      inv.match_status === 'Missing in Portal' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                      inv.match_status === 'Missing in SAP' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {inv.match_status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] text-muted-foreground">
                    <span className="font-mono">{inv.sap_record?.invoice_num || inv.gst_record?.invoice_num || '-'}</span>
                    <span>•</span>
                    <span className="font-financial font-bold text-foreground">
                      {formatINR(inv.gst_record?.total_tax ?? inv.sap_record?.total_tax ?? inv.total_tax ?? 0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══ MATCH RATE VISUALIZATION ═══ */}
      <motion.div custom={11} initial="hidden" animate="visible" variants={cardVariants}
        className="bg-card border border-border/60 rounded-xl p-5"
      >
        <div className="flex items-center space-x-2 mb-4">
          <PieChart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Reconciliation Distribution</h3>
        </div>
        <div className="flex items-center space-x-6">
          {/* Visual bar */}
          <div className="flex-1">
            <div className="w-full h-6 bg-muted rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${kpis.matchRate}%` }} title={`Matched: ${kpis.matchRate.toFixed(1)}%`} />
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${kpis.reviewRate}%` }} title={`Review: ${kpis.reviewRate.toFixed(1)}%`} />
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${kpis.unmatchedRate}%` }} title={`Unmatched: ${kpis.unmatchedRate.toFixed(1)}%`} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Matched ({kpis.matchRate.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Review ({kpis.reviewRate.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-[10px] text-muted-foreground">Unmatched ({kpis.unmatchedRate.toFixed(1)}%)</span>
                </div>
              </div>
              <span className="text-xs font-bold font-financial text-foreground">{records.length} total</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
