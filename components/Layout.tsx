
import React, { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './Sidebar';
import { Settings, LogOut, LogIn, ChefHat, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { InstallPWA } from './InstallPWA';

import { useData } from '../DataContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { messName, loading } = useData();
  const [user, setUser] = useState<firebase.User | null>(auth.currentUser);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Theme Listener
  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (isDark) {
      root.classList.add('dark');
      body.classList.add('dark');
      body.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      body.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const isLoginPage = window.location.hash === '#/login';

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
        {/* Animated Background Circles */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -ml-48 -mt-48 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-48 -mb-48 animate-pulse delay-1000"></div>

        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-1000">
          {/* Logo Container */}
          <div className="relative">
             <div className="h-24 w-24 bg-transparent flex items-center justify-center shadow-2xl shadow-indigo-600/40 animate-bounce transition-all duration-1000 rounded-[2rem] overflow-hidden">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
             </div>
             {/* Ring Animation */}
             <div className="absolute -inset-4 border border-indigo-500/30 rounded-[2.5rem] animate-ping opacity-20"></div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase">
              Rice<span className="text-indigo-500">Manager</span>
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] opacity-80">
              Advanced Mess Management System
            </p>
          </div>

          {/* Sleek Loading Bar */}
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
             <div className="h-full bg-indigo-600 w-1/2 rounded-full animate-[loading_2s_infinite_ease-in-out]"></div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Developed by <span className="text-slate-300">MD AL AMIN</span>
           </p>
           <p className="text-[8px] font-bold text-slate-600 mt-1">VERSION 2.0.4</p>
        </div>

        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex font-inter bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {!isLoginPage && <Sidebar isDark={isDark} toggleTheme={toggleTheme} />}
      
      <main className={`flex-1 ${!isLoginPage ? 'md:ml-64' : ''} h-full flex flex-col relative overflow-y-auto`}>
        {/* Mobile Header */}
        {!isLoginPage && (
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between md:hidden sticky top-0 z-40">
             <a 
               href="https://mdalamins20.netlify.app/" 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center gap-2 hover:opacity-80 transition-opacity"
             >
               <div className="bg-transparent p-0 rounded-lg">
                  <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
               </div>
               <span className="font-bold text-xl text-indigo-600 tracking-tight">{messName}</span>
             </a>
             
             <div className="flex items-center gap-2">
                <button onClick={toggleTheme} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors mr-1">
                   {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                
                <InstallPWA className="mr-2 text-xs py-1.5 px-3" />
  
                {user ? (
                  <>
                     <button onClick={() => navigate('/settings')} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <Settings className="h-6 w-6 stroke-[1.5px]" />
                     </button>
                     <button onClick={() => { auth.signOut(); navigate('/login'); }} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <LogOut className="h-6 w-6 stroke-[1.5px]" />
                     </button>
                  </>
                ) : (
                  <button onClick={() => navigate('/login')} className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                      <LogIn className="h-5 w-5" />
                  </button>
                )}
             </div>
          </div>
        )}

        <div className={`${isLoginPage ? 'h-full flex items-center justify-center' : 'p-4 md:p-8 max-w-7xl mx-auto w-full flex-1 pb-24 md:pb-8'}`}>
          {children}
        </div>

        {/* Bottom Nav for Mobile */}
        {!isLoginPage && <BottomNav />}
      </main>
    </div>
  );
};
