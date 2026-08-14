import React from 'react';
import { AgGridWorkspace } from './AgGridWorkspace';
import { ActionBar } from './ActionBar';

export const Workspace: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col relative h-full min-h-0 overflow-hidden">
      {/* 2.1 AG Grid Workspace & Multi-file Ingestion */}
      <AgGridWorkspace />

      {/* 2.2 Sticky Bottom Action Bar for Bulk Selection */}
      <ActionBar />
    </div>
  );
};
