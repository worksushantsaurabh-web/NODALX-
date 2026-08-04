import React, { useState, useEffect } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import SignInModal from './SignInModal';

// nodalX brand logo – an "X" formed by connected nodes on a rounded square
function NodalXLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sleek, darker background with a more subtle gradient */}
      <rect x="0" y="0" width="36" height="36" rx="10" fill="url(#nx-bg-modern)" />

      {/* The "X" shape, bolder and more central */}
      <path d="M10 10 L26 26 M26 10 L10 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />

      {/* Accent nodes, slightly larger and brighter */}
      <circle cx="10" cy="10" r="3" fill="white" />
      <circle cx="26" cy="10" r="3" fill="white" />
      <circle cx="10" cy="26" r="3" fill="white" />
      <circle cx="26" cy="26" r="3" fill="white" />
      
      {/* A vibrant, glowing center point */}
      <circle cx="18" cy="18" r="4.5" fill="white" opacity="0.2" />
      <circle cx="18" cy="18" r="2.5" fill="url(#nx-center-glow)" />

      <defs>
        {/* A modern, darker teal gradient */}
        <linearGradient id="nx-bg-modern" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#083344" />
          <stop offset="1" stopColor="#042f2e" />
        </linearGradient>
        {/* A bright, energetic teal glow for the center */}
        <radialGradient id="nx-center-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(18 18) rotate(45) scale(2.5)">
          <stop stopColor="#67e8f9" />
          <stop offset="0.7" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export { NodalXLogo };

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignIn = () => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    setSignInOpen(true);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200/40 dark:border-white/5 shadow-lg shadow-slate-200/20 dark:shadow-none py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between">
        {/* Logo & Theme Toggle */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => window.scrollTo(0,0)}>
            <div className="relative group-hover:scale-105 transition-transform duration-300">
              <NodalXLogo className="w-9 h-9" />
              <div className="absolute inset-0 rounded-full bg-teal-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              NODALxAI
            </span>
          </div>
          <div className="mb-0.5 ml-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          <div className="relative group">
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-md hover:bg-teal-50/80 dark:hover:bg-teal-900/20 hover:border-teal-300 dark:hover:border-teal-700 text-slate-700 dark:text-slate-200 transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 glass-shine relative z-10 group-hover:scale-105"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoading ? 'Signing in...' : user ? 'Dashboard' : 'Sign In'}
            </button>
            <div className="absolute inset-0 rounded-xl bg-teal-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800 shadow-xl py-4 px-4 sm:px-6 flex flex-col gap-3 animate-slide-up">
          <div className="relative group">
            <button
              onClick={() => {
                handleSignIn();
                setMobileMenuOpen(false);
              }}
              disabled={isLoading}
              className="w-full text-base font-semibold text-white bg-teal-600 hover:bg-teal-700 py-3 flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg shadow-teal-600/20 relative z-10 group-hover:scale-105"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {isLoading ? 'Signing in...' : user ? 'Go to Dashboard' : 'Sign In'}
            </button>
            <div className="absolute inset-0 rounded-xl bg-teal-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
        </div>
      )}
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </header>
  );
}
