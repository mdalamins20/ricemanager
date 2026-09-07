
import React, { useState, useEffect } from 'react';
import { Sidebar, BottomNav } from './Sidebar';
import { Settings, LogOut, LogIn, ChefHat, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import firebase from 'firebase/compat/app';
import { InstallPWA } from './InstallPWA';

import { useSettings } from '../contexts';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { messName, loading } = useSettings();
  const [user, setUser] = useState<firebase.User | null>(auth.currentUser);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser: firebase.User | null) => {
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
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6 animate-in fade-in zoom-in-95 duration-1000">
          {/* Logo Container with Ripple */}
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="absolute inset-0 border border-emerald-500/30 rounded-[2.5rem] animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
            <div className="absolute inset-0 border border-emerald-400/20 rounded-[2.5rem] animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]"></div>
            
            <div className="relative h-28 w-28 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl shadow-emerald-900/50 flex items-center justify-center p-2 overflow-hidden transform hover:scale-105 transition-transform duration-500 z-10">
                <div className="h-full w-full bg-white rounded-[1.5rem] p-1 shadow-inner">
                    <img src="/logo.png" alt="RiceManager Logo" className="h-full w-full object-cover rounded-xl" />
                </div>
            </div>
          </div>

          {/* Typography */}
          <div className="text-center space-y-2 mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight flex items-center justify-center drop-shadow-lg">
              Meal<span className="text-emerald-500">Manager</span>
            </h1>
            <p className="text-emerald-400/80 text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] drop-shadow-md">
              Smart Mess Management
            </p>
          </div>

          {/* Premium Loading Bar */}
          <div className="w-full max-w-[200px] space-y-4">
             <div className="h-1 w-full bg-slate-800/80 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
                 <div className="h-full bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-600 w-1/3 rounded-full animate-[loading_1.5s_infinite_ease-in-out] bg-[length:200%_100%]"></div>
             </div>
             <p className="text-center text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] animate-pulse">Initializing System...</p>
          </div>
        </div>

        {/* Developer Credit */}
        <div className="absolute bottom-8 left-0 right-0 text-center opacity-50 hover:opacity-100 transition-opacity duration-500 animate-in fade-in slide-in-from-bottom-4 delay-700">
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
              Crafted by <span className="text-emerald-500">MD AL AMIN</span>
           </p>
           <p className="text-[8px] font-bold text-slate-700 mt-1.5 tracking-widest">VERSION 2.0.4 PRO</p>
        </div>

        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); background-position: 100% 0; }
            100% { transform: translateX(300%); background-position: -100% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex font-inter bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {!isLoginPage && <Sidebar isDark={isDark} toggleTheme={toggleTheme} />}
      
      <main className={`flex-1 ${!isLoginPage ? 'md:ml-64' : ''} h-full flex flex-col relative overflow-hidden`}>
        {/* Mobile Header */}
        {!isLoginPage && (
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between md:hidden z-40 shrink-0">
             <a 
               href="https://mdalamins20.netlify.app/" 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center gap-2 hover:opacity-80 transition-opacity"
             >
               <div className="bg-transparent p-0 rounded-lg">
                  <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
               </div>
               <span className="font-bold text-xl text-emerald-600 tracking-tight">{messName}</span>
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
                  <button onClick={() => navigate('/login')} className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
                      <LogIn className="h-5 w-5" />
                  </button>
                )}
             </div>
          </div>
        )}

        <div className={`${isLoginPage ? 'h-full flex items-center justify-center overflow-y-auto' : 'p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col overflow-hidden pb-24 md:pb-8'}`}>
          {children}
        </div>

        {/* Bottom Nav for Mobile */}
        {!isLoginPage && <BottomNav />}
      </main>
    </div>
  );
};
