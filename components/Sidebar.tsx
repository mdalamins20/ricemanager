
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UsersRound, UtensilsCrossed, PieChart, Settings2, LogOut, ChefHat, WalletCards, LogIn } from 'lucide-react';
import { auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { InstallPWA } from './InstallPWA';

const NavItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/' },
  { icon: UsersRound, label: 'Members', path: '/members' },
  { icon: UtensilsCrossed, label: 'Meals', path: '/meals' },
  { icon: WalletCards, label: 'Money', path: '/money' },
  { icon: PieChart, label: 'Report', path: '/reports' },
];

import { useData } from '../DataContext';
import { Moon, Sun } from 'lucide-react';

interface SidebarProps {
  isDark?: boolean;
  toggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isDark, toggleTheme }) => {
  const { messName } = useData();
  const [user, setUser] = useState<firebase.User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col z-20 hidden md:flex border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-300">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <a 
          href="https://mdalamins20.netlify.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-2xl font-bold text-red-600 flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group"
          title="Visit Developer Website"
        >
          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
            <ChefHat className="h-6 w-6 stroke-[2.5px]" />
          </div>
          <span className="tracking-tight">{messName}</span>
        </a>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {NavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-red-100 dark:ring-red-900/40' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}
            `}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'stroke-[2px]' : 'stroke-[1.5px]'}`} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {user && (
          <NavLink
            to="/settings"
            className={({ isActive }) => `
              group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm ring-1 ring-red-100 dark:ring-red-900/40' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}
            `}
          >
            {({ isActive }) => (
              <>
                <Settings2 className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'stroke-[2px]' : 'stroke-[1.5px]'}`} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
        {/* Dark Mode Toggle for Desktop */}
        {toggleTheme && (
           <button 
             onClick={toggleTheme}
             className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all group border border-slate-100 dark:border-slate-700"
           >
              <div className="flex items-center gap-3">
                 {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
                 <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isDark ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
           </button>
        )}

        {/* Install App Button for Desktop */}
        <InstallPWA className="w-full justify-center bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700" />

        {user ? (
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 w-full rounded-xl transition-all group"
          >
            <LogOut className="h-5 w-5 group-hover:translate-x-1 transition-transform stroke-[1.5px]" />
            Sign Out
          </button>
        ) : (
          <button 
            onClick={handleLogin}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 w-full rounded-xl transition-all shadow-md shadow-red-200 dark:shadow-red-900/20"
          >
            <LogIn className="h-5 w-5 stroke-[2px]" />
            Log In
          </button>
        )}
      </div>
    </aside>
  );
};

export const BottomNav: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 md:hidden z-50 pb-safe transition-colors duration-300">
      <div className="flex justify-around items-center h-16">
        {NavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center w-full h-full gap-1
              ${isActive ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`transition-transform duration-200 ${isActive ? '-translate-y-1' : ''}`}>
                    <item.icon className={`h-6 w-6 ${isActive ? 'fill-current stroke-[2px]' : 'stroke-[1.5px]'}`} />
                </div>
                <span className={`text-[10px] font-medium transition-opacity ${isActive ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                    {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export const MobileNav: React.FC = () => null; // Deprecated in favor of BottomNav
