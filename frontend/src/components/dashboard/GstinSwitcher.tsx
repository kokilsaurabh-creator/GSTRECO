import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

// Mock list of GSTINs for demonstration. In production, this would be fetched from the backend.
const MOCK_GSTINS = [
  { gstin: '27AAAAA0000A1Z5', name: 'Maharashtra Operations' },
  { gstin: '29BBBBB0000B1Z5', name: 'Karnataka Operations' },
  { gstin: '07CCCCC0000C1Z5', name: 'Delhi Corporate' }
];

export const GstinSwitcher: React.FC = () => {
  const { setActiveGstin, role } = useAppStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const handleProceed = () => {
    if (selected) {
      setActiveGstin(selected);
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    if (!role) {
      navigate('/');
    }
  }, [role, navigate]);

  if (!role) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-card/90 backdrop-blur-md border border-border p-8 rounded-2xl shadow-xl z-10"
      >
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary/20 rounded-lg text-primary">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Select Operating GSTIN</h2>
            <p className="text-xs text-foreground/60">Choose the GSTIN context for this session</p>
          </div>
        </div>

        <div className="space-y-3 mt-6">
          {MOCK_GSTINS.map((item) => {
            const isSelected = selected === item.gstin;
            return (
              <button
                key={item.gstin}
                onClick={() => setSelected(item.gstin)}
                className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                  isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border bg-background/50 hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="font-semibold text-foreground">{item.gstin}</div>
                  <div className="text-xs text-foreground/60">{item.name}</div>
                </div>
                {isSelected && (
                  <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleProceed}
            disabled={!selected}
            className="flex items-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            Enter Workspace
            <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
