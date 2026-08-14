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
    { id: 'Admin', icon: Shield, desc: 'System Setup & Allocations', color: 'bg-indigo-500' },
    { id: 'Customer', icon: User, desc: 'Daily Operations & Uploads', color: 'bg-emerald-500' },
    { id: 'Auditor', icon: Eye, desc: 'Read-only Reviews', color: 'bg-amber-500' }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/30 rounded-full blur-3xl"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">GST 3-Way Reco Platform</h1>
          <p className="text-sm text-foreground/60 mt-2">Select your role to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="grid gap-4">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id as any)}
                  className={`flex items-center p-4 rounded-xl border transition-all duration-300 ${
                    isSelected 
                      ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                      : 'border-border bg-background/50 hover:border-primary/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${r.color} bg-opacity-20 mr-4`}>
                    <Icon className={`w-6 h-6 ${r.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{r.id}</div>
                    <div className="text-xs text-foreground/60">{r.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          
          <button
            type="submit"
            disabled={!selectedRole}
            className="w-full mt-6 py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enter Platform
          </button>
        </form>
      </motion.div>
    </div>
  );
};
