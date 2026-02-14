import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Utensils, FileText, Settings, LogOut, X } from 'lucide-react';
import { auth } from '../firebase';

const NavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Members', path: '/members' },
  { icon: Utensils, label: 'Daily Meals', path: '/meals' },
  { icon: FileText, label: 'Monthly Report', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const Sidebar: React.FC = () => {
  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col z-20 hidden md:flex shadow-sm">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-red-600 flex items-center gap-2">
          <div className="bg-red-100 p-1.5 rounded-lg">
            <Utensils className="h-6 w-6" />
          </div>
          RiceMgr
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
              ${isActive 
                ? 'bg-red-50 text-red-600 shadow-sm border border-red-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 w-full rounded-xl transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50">
            <h1 className="text-xl font-bold text-red-600 flex items-center gap-2">
               <Utensils className="h-5 w-5" /> RiceManager
            </h1>
            <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-500 shadow-sm hover:text-red-600">
              <X className="h-5 w-5" />
            </button>
         </div>
         
         <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
            {NavItems.map((item) => (
              <NavLink 
                key={item.path}
                to={item.path} 
                onClick={onClose} 
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all
                  ${isActive 
                    ? 'bg-red-600 text-white shadow-md shadow-red-200' 
                    : 'text-slate-600 hover:bg-slate-50'}
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
         </nav>

         <div className="p-4 border-t border-slate-100 pb-8">
            <button onClick={() => auth.signOut()} className="flex items-center gap-3 w-full px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-xl font-medium transition-colors">
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
         </div>
      </div>
    </>
  );
};