import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Wallet, Plane, TrendingUp, LogOut, Sparkles, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

const QUOTES = [
  { text: "Collect miles, not regrets.", author: "CardIO" },
  { text: "Your next business class seat is hiding in your daily spend.", author: "CardIO" },
  { text: "Every rupee spent is a mile earned.", author: "CardIO" },
  { text: "Smart cards, smarter travel.", author: "CardIO" },
  { text: "Points are currency for those who plan.", author: "CardIO" },
  { text: "The airport lounge awaits. Start collecting.", author: "CardIO" },
  { text: "Fly free. Spend smart.", author: "CardIO" },
];

// Rotate quote daily based on day-of-year
const todayQuote = QUOTES[new Date().getDay() % QUOTES.length];

const Sidebar = () => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'My Cards', icon: CreditCard, path: '/cards' },
    { name: 'Transactions', icon: Wallet, path: '/transactions' },
    { name: 'Travel Goals', icon: Plane, path: '/travel' },
    { name: 'Best Card', icon: Zap, path: '/best-card' },
    { name: 'Rewards Hub', icon: Sparkles, path: '/rewards' },
    { name: 'Analytics', icon: TrendingUp, path: '/analytics' },
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
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-medium relative ${
                isActive 
                  ? 'bg-gradient-to-r from-pastel-lavender to-pastel-pink text-dark-base shadow-md shadow-pastel-lavender/20' 
                  : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-dark-base' : 'text-text-muted'}`} />
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
        {/* Airplane illustration + rotating quote — replaces fake "Pro Plan Active" */}
        <div className="bg-dark-base/60 p-4 rounded-2xl border border-white/5 mb-5 overflow-hidden relative">
          {/* SVG plane illustration */}
          <div className="flex justify-center mb-3">
            <motion.svg
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg" className="w-20 h-12 opacity-80"
            >
              {/* Sky gradient */}
              <defs>
                <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C3B1E1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#F4C2D7" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {/* Clouds */}
              <ellipse cx="15" cy="35" rx="10" ry="5" fill="white" fillOpacity="0.06"/>
              <ellipse cx="65" cy="42" rx="12" ry="5" fill="white" fillOpacity="0.06"/>
              {/* Plane body */}
              <path d="M10 25 Q40 10 70 22 L68 28 Q40 18 12 31 Z" fill="#C3B1E1" fillOpacity="0.9"/>
              {/* Wing */}
              <path d="M30 25 L45 10 L50 22 Z" fill="#F4C2D7" fillOpacity="0.9"/>
              {/* Tail */}
              <path d="M12 27 L8 18 L15 24 Z" fill="#B8E6D3" fillOpacity="0.9"/>
              {/* Windows */}
              <circle cx="45" cy="23" r="2" fill="#0F0F1A" fillOpacity="0.7"/>
              <circle cx="52" cy="25" r="2" fill="#0F0F1A" fillOpacity="0.7"/>
              <circle cx="59" cy="26" r="2" fill="#0F0F1A" fillOpacity="0.7"/>
              {/* Exhaust trail */}
              <path d="M10 26 Q5 26 0 24" stroke="#C3B1E1" strokeWidth="1" strokeOpacity="0.4" fill="none" strokeDasharray="2 2"/>
            </motion.svg>
          </div>
          <blockquote className="text-[10px] text-text-muted italic text-center leading-relaxed">
            "{todayQuote.text}"
          </blockquote>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-3 px-4 py-3.5 w-full rounded-2xl text-text-muted font-medium hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20 mb-4"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>

        <div className="text-center">
          <p className="text-[9px] text-text-muted/60 leading-tight">
            Data as of 7 Oct 2026.<br/>Ratios and award prices change without notice.<br/>Always verify with the provider.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
