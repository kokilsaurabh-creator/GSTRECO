import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Eye, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login: React.FC = () => {
  const setRole = useAppStore(state => state.setRole);
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'Admin' | 'Customer' | 'Auditor' | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole) {
      setRole(selectedRole);
      navigate('/gstin-switcher');
    }
  };

  const roles = [
    { id: 'Admin', icon: Shield, desc: 'System Setup & Allocations', color: 'bg-primary text-primary' },
    { id: 'Customer', icon: User, desc: 'Daily Operations & Uploads', color: 'bg-emerald-500 text-emerald-400' },
    { id: 'Auditor', icon: Eye, desc: 'Read-only Reviews', color: 'bg-amber-500 text-amber-400' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md glass-strong p-8 rounded-2xl shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">GST 3-Way Reco Platform</h1>
          <p className="text-sm font-medium text-muted-foreground mt-2 uppercase tracking-widest">Enterprise Edition</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="grid gap-3">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id as any)}
                  className={`flex items-center p-4 rounded-xl border transition-all duration-300 text-left ${
                    isSelected 
                      ? 'border-primary bg-primary/10 glow-primary' 
                      : 'border-border/60 bg-surface hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-opacity-10 mr-4 ${isSelected ? 'bg-primary text-primary border border-primary/30' : 'bg-surface border border-border/60 text-muted-foreground'}`}>
                    <Icon className={`w-5 h-5 ${isSelected ? '' : ''}`} />
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>{r.id}</div>
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5">{r.desc}</div>
                  </div>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] ml-2"></div>
                  )}
                </button>
              );
            })}
          </div>
          
          <button
            type="submit"
            disabled={!selectedRole}
            className="w-full mt-6 py-3 px-4 gradient-primary text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Authenticate & Enter Platform
          </button>
        </form>
      </motion.div>
    </div>
  );
};
