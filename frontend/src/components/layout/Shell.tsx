import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Context Bar */}
        <Header />

        {/* Page Workspace View */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
