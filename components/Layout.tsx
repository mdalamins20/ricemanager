import React, { useState } from 'react';
import { Sidebar, MobileNav } from './Sidebar';
import { Menu } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      <MobileNav isOpen={isMobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Mobile Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between md:hidden sticky top-0 z-10">
           <span className="font-bold text-blue-600">RiceManager</span>
           <button onClick={() => setMobileNavOpen(true)} className="p-2 text-slate-600">
             <Menu className="h-6 w-6" />
           </button>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};