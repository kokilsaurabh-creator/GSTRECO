import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatINR } from '../../utils/formatters';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';

export const KpiRibbon: React.FC = () => {
  const { records } = useAppStore();

  const metrics = useMemo(() => {
    let totalItc = 0;
    let readyItc = 0;
    let reviewItc = 0;
    let unmatchedItc = 0;

    let readyCount = 0;
    let reviewCount = 0;
    let unmatchedCount = 0;

    records.forEach((r) => {
      const val = r.gst_record ? (r.gst_record.total_tax || 0) : (r.sap_record ? (r.sap_record.total_tax || 0) : 0);
      totalItc += val;


      if (r.match_status === 'Ready to Claim') {
        readyItc += val;
        readyCount++;
      } else if (r.match_status === 'Review Required') {
        reviewItc += val;
        reviewCount++;
      } else {
        unmatchedItc += val;
        unmatchedCount++;
      }
    });

    return {
      totalItc,
      totalCount: records.length,
      readyItc,
      readyCount,
      reviewItc,
      reviewCount,
      unmatchedItc,
      unmatchedCount,
    };
  }, [records]);

  const cards = [
    {
      id: 'total-itc',
      title: 'Total ITC Available (GSTR-2B)',
      amount: metrics.totalItc,
      subtitle: `From ${metrics.totalCount} Total Invoices`,
      borderColor: 'border-l-blue-500',
      badgeBg: 'bg-blue-500/10 text-blue-400',
      icon: CreditCard,
    },
    {
      id: 'ready-to-claim',
      title: 'Matched & Ready to Claim',
      amount: metrics.readyItc,
      subtitle: `${metrics.readyCount} Invoices • 100% Exact & Normalized`,
      borderColor: 'border-l-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-400',
      icon: CheckCircle2,
    },
    {
      id: 'pending-review',
      title: 'Pending Review (Fuzzy/Date)',
      amount: metrics.reviewItc,
      subtitle: `${metrics.reviewCount} Invoices • Level 3 & 4 Matches`,
      borderColor: 'border-l-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-400',
      icon: AlertTriangle,
    },
    {
      id: 'missing-unmatched',
      title: 'Missing / Unmatched',
      amount: metrics.unmatchedItc,
      subtitle: `${metrics.unmatchedCount} Invoices • Missing in SAP or Portal`,
      borderColor: 'border-l-rose-500',
      badgeBg: 'bg-rose-500/10 text-rose-400',
      icon: XCircle,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`bg-card border border-border border-l-4 ${card.borderColor} p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground/60 tracking-tight">
                {card.title}
              </span>
              <div className={`p-2 rounded-xl ${card.badgeBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-black text-foreground tracking-tight">
                {formatINR(card.amount)}
              </div>
              <p className="text-[11px] font-medium text-foreground/50 mt-1">
                {card.subtitle}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
