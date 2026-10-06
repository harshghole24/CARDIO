import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Wallet, Plane, TrendingUp, Settings, LogOut, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

const Sidebar = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'My Cards', icon: CreditCard, path: '/cards' },
    { name: 'Transactions', icon: Wallet, path: '/transactions' },
    { name: 'Travel Goals', icon: Plane, path: '/travel' },
    { name: 'Rewards Hub', icon: Sparkles, path: '/rewards' },
    { name: 'Analytics', icon: TrendingUp, path: '/analytics' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="w-72 bg-dark-surface text-text-primary h-full flex flex-col border-r border-white/5 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-pastel-lavender/10 to-transparent pointer-events-none"></div>
      
      <div className="p-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pastel-lavender to-pastel-pink flex items-center justify-center shadow-lg shadow-pastel-lavender/20">
            <Sparkles className="w-6 h-6 text-dark-base" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">CardIO</h1>
            <p className="text-[10px] text-pastel-lavender uppercase tracking-widest font-semibold mt-0.5">Run Smarter</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4 relative z-10 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-medium ${
                isActive 
                  ? 'bg-gradient-to-r from-pastel-lavender to-pastel-pink text-dark-base shadow-md shadow-pastel-lavender/20' 
                  : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 ${isActive ? 'text-dark-base' : 'text-text-muted'}`} />
                <span>{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill" 
                    className="absolute left-0 w-1 h-8 bg-dark-base rounded-r-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 relative z-10 mt-auto border-t border-white/5">
        <div className="bg-dark-base/50 p-4 rounded-2xl border border-white/5 mb-6 backdrop-blur-sm">
          <p className="text-xs text-text-muted font-medium mb-2">Pro Plan Active</p>
          <div className="w-full bg-dark-elevated rounded-full h-1.5 mb-2">
            <div className="bg-gradient-to-r from-pastel-lavender to-pastel-pink h-1.5 rounded-full w-3/4"></div>
          </div>
          <p className="text-[10px] text-text-muted">75% API Quota Used</p>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-3 px-4 py-3.5 w-full rounded-2xl text-text-muted font-medium hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
