import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AnimatedAuthCard } from '../components/AnimatedAuthCard';

const Login = () => {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorToast, setErrorToast] = useState('');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // UI State
  const [isFlipped, setIsFlipped] = useState(false);

  // If user hits /login but is already logged in, App.tsx will handle it if we are checking session.
  // Wait, let's explicitly redirect if session exists.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 5000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorToast('');

    // Validation
    if (isRegistering && password !== confirmPassword) {
      showError('Passwords do not match');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
        
        // If email confirmation is disabled, user is immediately logged in
        if (data.session) {
          navigate('/');
        } else {
          showError('Please check your email to verify your account.');
          setIsRegistering(false); // Switch to login view
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      showError(error.message);
    }
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-dark-base flex flex-col md:flex-row relative">
      
      {/* Toast Notification for Errors */}
      <AnimatePresence>
        {errorToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-6 left-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg backdrop-blur text-sm font-medium border border-red-400"
          >
            {errorToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Animated Blobs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-pastel-lavender/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob pointer-events-none"></div>
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-pastel-pink/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-pastel-blue/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000 pointer-events-none"></div>

      {/* LEFT SIDE: Branding & 3D Animation */}
      <div className="hidden md:flex flex-1 flex-col justify-center items-center relative z-10 p-12 border-r border-white/10 bg-dark-surface/30 backdrop-blur-sm">
        <div className="absolute top-12 left-12 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-pastel-lavender to-pastel-pink flex items-center justify-center shadow-lg shadow-pastel-lavender/20">
            <Sparkles className="w-6 h-6 text-dark-base" />
          </div>
          <span className="text-2xl font-display font-bold text-text-primary tracking-tight">CardIO</span>
        </div>

        <motion.div 
          className="animate-float"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <AnimatedAuthCard name={fullName} isFlipped={isFlipped} />
        </motion.div>

        <div className="mt-16 text-center max-w-md">
          <h2 className="text-3xl font-display font-bold text-text-primary mb-4">Run Your Cards Smarter</h2>
          <p className="text-text-muted text-lg">AI-powered insights to maximize your credit card rewards, travel miles, and cashback.</p>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Form */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-6 sm:p-12 h-full overflow-y-auto custom-scrollbar">
        
        {/* Mobile Header */}
        <div className="md:hidden absolute top-8 left-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pastel-lavender to-pastel-pink flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-dark-base" />
          </div>
          <span className="text-xl font-display font-bold text-text-primary tracking-tight">CardIO</span>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md glass-card p-8 sm:p-10"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-text-primary mb-2">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-text-muted">
              {isRegistering ? 'Sign up to optimize your wallet.' : 'Enter your details to access your dashboard.'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleAuth}>
            <AnimatePresence mode="popLayout">
              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <label className="block text-sm font-medium text-text-muted">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted/50" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full glass-input py-3 pl-12 pr-4"
                      placeholder="John Doe"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-muted">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full glass-input py-3 pl-12 pr-4"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-muted">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted/50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsFlipped(true)}
                  onBlur={() => setIsFlipped(false)}
                  className="w-full glass-input py-3 pl-12 pr-4"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1"
                >
                  <label className="block text-sm font-medium text-text-muted">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted/50" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setIsFlipped(true)}
                      onBlur={() => setIsFlipped(false)}
                      className="w-full glass-input py-3 pl-12 pr-4"
                      placeholder="••••••••"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 pastel-button flex justify-center items-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-dark-base border-t-transparent rounded-full animate-spin" />
                ) : isRegistering ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-text-muted text-sm font-medium">Or continue with</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3.5 glass-input hover:bg-white/5 flex items-center justify-center gap-3 font-medium transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorToast('');
              }}
              className="text-text-muted hover:text-pastel-lavender text-sm font-medium transition-colors"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
