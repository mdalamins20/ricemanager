import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Utensils, FileText, Settings, LogOut } from 'lucide-react';
import { auth } from '../firebase';

export const Sidebar: React.FC = () => {
  const handleLogout = () => {
    auth.signOut();
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Members', path: '/members' },
    { icon: Utensils, label: 'Daily Meals', path: '/meals' },
    { icon: FileText, label: 'Monthly Report', path: '/reports' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col z-10 hidden md:flex">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Utensils className="h-6 w-6" />
          RiceManager
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${isActive 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
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
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 w-full rounded-lg transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export const MobileNav: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
         {/* Reusing logic from Sidebar mainly, but keeping it simple for this snippet */}
         <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h1 className="text-xl font-bold text-blue-600">RiceManager</h1>
            <button onClick={onClose} className="text-slate-500">&times;</button>
         </div>
         <nav className="p-4 space-y-2">
            <NavLink to="/" onClick={onClose} className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded">Dashboard</NavLink>
            <NavLink to="/members" onClick={onClose} className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded">Members</NavLink>
            <NavLink to="/meals" onClick={onClose} className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded">Daily Meals</NavLink>
            <NavLink to="/reports" onClick={onClose} className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded">Reports</NavLink>
            <NavLink to="/settings" onClick={onClose} className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded">Settings</NavLink>
            <button onClick={() => auth.signOut()} className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded">Sign Out</button>
         </nav>
      </div>
    </div>
  );
};