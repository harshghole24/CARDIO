import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyCards from './pages/MyCards';
import Transactions from './pages/Transactions';
import TravelGoals from './pages/TravelGoals';
import RewardsHub from './pages/RewardsHub';
import Analytics from './pages/Analytics';
import Sidebar from './components/Sidebar';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

    return () => subscription.unsubscribe();
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
        <div className="flex h-[100dvh] w-screen bg-dark-base text-text-primary overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard session={session} />} />
              <Route path="/cards" element={<MyCards session={session} />} />
              <Route path="/transactions" element={<Transactions session={session} />} />
              <Route path="/travel" element={<TravelGoals />} />
              <Route path="/rewards" element={<RewardsHub />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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
