
import React, { useState } from 'react';
import { auth, isConfigured } from '../firebase';
import { Button } from '../components/Button';
import { ChefHat, AlertTriangle, Database, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { seedDatabase } from '../utils/seedDatabase';
import { logAction } from '../utils/logger';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      // Normal Login
      await auth.signInWithEmailAndPassword(email, password);
      await logAction('Login', 'User signed in successfully');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4 font-inter transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-500/5 dark:shadow-none w-full max-w-md border border-white dark:border-slate-800 relative z-10 animate-in zoom-in-95 duration-500 fade-in">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="h-16 w-16 rounded-2xl mb-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-300">
            <Lock className="h-8 w-8 stroke-[2px]" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
            Admin Login
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium px-4">
            Welcome back! Please enter your details to securely manage your mess.
          </p>
        </div>

        {/* Alerts */}
        {!isConfigured && (
           <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 relative z-10">
             <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
             <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
               <strong>Config Required:</strong> The Firebase configuration in <code>firebase.ts</code> is a placeholder. Update it with your project keys.
             </div>
           </div>
        )}

        {error && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl mb-6 text-sm text-center border border-emerald-100 dark:border-emerald-900/40 font-medium relative z-10 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 p-4 rounded-xl mb-6 text-sm text-center border border-green-200 dark:border-emerald-900/40 font-medium relative z-10 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" /> {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-medium"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-medium"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <Button 
            type="submit" 
            isLoading={loading} 
            className="w-full justify-center py-4 text-base font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-xl shadow-emerald-500/20 dark:shadow-emerald-900/20 text-white border-0 mt-2"
          >
            <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
          </Button>
        </form>



      </div>
    </div>
  );
};
