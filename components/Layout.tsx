import React, { useState } from 'react';
import { Sidebar, MobileNav } from './Sidebar';
import { Menu } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter">
      <Sidebar />
      <MobileNav isOpen={isMobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Mobile Header - Modern & Red */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden sticky top-0 z-30 shadow-sm">
           <div className="flex items-center gap-2">
             <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg active:bg-slate-200">
               <Menu className="h-6 w-6" />
             </button>
             <span className="font-bold text-lg text-slate-800">RiceManager</span>
           </div>
           <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xs">
             A
           </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 pb-24 md:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
};