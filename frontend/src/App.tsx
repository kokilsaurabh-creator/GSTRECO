import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/auth/Login';
import { GstinSwitcher } from './components/dashboard/GstinSwitcher';
import { Shell } from './components/layout/Shell';
import { Workspace } from './components/reconciliation/Workspace';
import { DataImportView } from './components/import/DataImportView';
import { SupplierAnalyticsView } from './components/analytics/SupplierAnalyticsView';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/gstin-switcher" element={<GstinSwitcher />} />
        
        {/* Three Primary Views inside Shell */}
        <Route path="/dashboard/import" element={
          <Shell><DataImportView /></Shell>
        } />
        <Route path="/dashboard/reconciliation" element={
          <Shell><Workspace /></Shell>
        } />
        <Route path="/dashboard/analytics" element={
          <Shell><SupplierAnalyticsView /></Shell>
        } />

        {/* Default redirect */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/reconciliation" replace />} />
        <Route path="*" element={<Navigate to="/dashboard/reconciliation" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
