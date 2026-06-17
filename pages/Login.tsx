
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
  
  // Setup Mode State
  const [isSetupMode, setIsSetupMode] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isSetupMode) {
        // Create Admin Account
        await auth.createUserWithEmailAndPassword(email, password);
        await logAction('System Setup', 'Created new admin account');
        setSuccessMsg("Admin account created! You can now initialize the database.");
      } else {
        // Normal Login
        await auth.signInWithEmailAndPassword(email, password);
        await logAction('Login', 'User signed in successfully');
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please login.');
      } else {
        setError('Authentication failed. Check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDbInit = async () => {
    setLoading(true);
    const result = await seedDatabase();
    setLoading(false);
    if (result.success) {
      setSuccessMsg(result.message);
      logAction('Database Seed', 'Initialized default database structure');
      // Optional: Automatically switch to login mode after success
      setTimeout(() => {
        setIsSetupMode(false);
        setError('');
      }, 2000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-inter transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none w-full max-w-md border border-slate-100 dark:border-slate-800 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className={`p-4 rounded-2xl mb-5 shadow-lg transition-all duration-300 ${isSetupMode ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200 dark:shadow-blue-900/20' : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200 dark:shadow-red-900/20'}`}>
            {isSetupMode ? <Database className="h-8 w-8 stroke-[1.5px]" /> : <ChefHat className="h-8 w-8 stroke-[1.5px]" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isSetupMode ? 'System Setup' : 'Admin Portal'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {isSetupMode ? 'Create admin & initialize data' : 'Sign in to manage rice meals'}
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
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm text-center border border-red-100 dark:border-red-900/40 font-medium relative z-10 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 p-4 rounded-xl mb-6 text-sm text-center border border-green-200 dark:border-emerald-900/40 font-medium relative z-10 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" /> {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-base text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-base text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <Button 
            type="submit" 
            isLoading={loading} 
            className={`w-full justify-center py-3.5 text-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${isSetupMode ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-200 dark:shadow-none'}`}
          >
            {isSetupMode ? 'Create Admin Account' : <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Sign In</span>}
          </Button>
        </form>

        {/* Setup Actions */}
        {isSetupMode && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 relative z-10">
             <Button 
               type="button" 
               variant="secondary" 
               onClick={handleDbInit} 
               isLoading={loading}
               className="w-full justify-center py-3 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
             >
               <Database className="h-4 w-4" /> Initialize Database Structure
             </Button>
             <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">
               *Click this to create default settings and collections automatically.
             </p>
          </div>
        )}

        {/* Toggle Mode */}
        <div className="mt-8 text-center relative z-10">
          <button 
            type="button"
            onClick={() => {
              setIsSetupMode(!isSetupMode);
              setError('');
              setSuccessMsg('');
            }}
            className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 mx-auto py-2 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {isSetupMode ? (
              <>Back to Login <ArrowRight className="h-3 w-3 stroke-[2.5px]" /></>
            ) : (
              <><ShieldCheck className="h-4 w-4" /> First time setup?</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
