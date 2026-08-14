import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/auth/Login';
import { GstinSwitcher } from './components/dashboard/GstinSwitcher';
import { Shell } from './components/layout/Shell';
import { Workspace } from './components/reconciliation/Workspace';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/gstin-switcher" element={<GstinSwitcher />} />
        <Route 
          path="/dashboard" 
          element={
            <Shell>
              <Workspace />
            </Shell>
          } 
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
