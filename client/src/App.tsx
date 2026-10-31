import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyCards from './pages/MyCards';
import Transactions from './pages/Transactions';
import TravelGoals from './pages/TravelGoals';
import RewardsHub from './pages/RewardsHub';
import Analytics from './pages/Analytics';
import BestCard from './pages/BestCard';
import Sidebar from './components/Sidebar';

import { Menu, Sparkles } from 'lucide-react';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-dark-base text-pastel-lavender">
        <div className="w-10 h-10 border-4 border-pastel-lavender border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      {session ? (
        <div className="flex h-[100dvh] w-screen bg-dark-base text-text-primary overflow-hidden flex-col lg:flex-row">
          <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
          <div className="flex-1 overflow-auto flex flex-col min-w-0">
            {/* Mobile / Tablet Header (< lg) */}
            <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-dark-surface border-b border-white/5 shrink-0 z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pastel-lavender to-pastel-pink flex items-center justify-center shadow-md shrink-0">
                  <Sparkles className="w-4 h-4 text-dark-base" />
                </div>
                <div>
                  <span className="font-display font-bold text-lg text-text-primary tracking-tight">CardIO</span>
                  <span className="text-[9px] text-pastel-lavender uppercase tracking-widest font-semibold ml-2">Run Smarter</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-white transition-colors cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard session={session} />} />
                <Route path="/cards" element={<MyCards session={session} />} />
                <Route path="/transactions" element={<Transactions session={session} />} />
                <Route path="/travel" element={<TravelGoals />} />
                <Route path="/best-card" element={<BestCard session={session} />} />
                <Route path="/rewards" element={<RewardsHub />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </Router>
  );
};

export default App;
