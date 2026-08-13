import React, { useState, useEffect } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { Button } from '../ui';
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-3'
          : 'bg-white dark:bg-slate-950 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between">
        {/* Logo & Theme Toggle */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <NodalXLogo className="w-8 h-8" />
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              NODALxAI
            </span>
          </div>
          <div className="mb-0.5 ml-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {[
            { label: 'How it works', id: 'how-it-works' },
            { label: 'Features', id: 'features' },
            { label: 'FAQ', id: 'faq' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={handleSignIn} disabled={isLoading} loading={isLoading}>
            {!isLoading && <LogIn className="w-4 h-4" />}
            {isLoading ? 'Signing in...' : user ? 'Dashboard' : 'Sign In'}
          </Button>
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
        <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-4 px-4 sm:px-6 flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => { handleSignIn(); setMobileMenuOpen(false); }}
            disabled={isLoading}
            loading={isLoading}
          >
            {!isLoading && <LogIn className="w-4 h-4" />}
            {isLoading ? 'Signing in...' : user ? 'Go to Dashboard' : 'Sign In'}
          </Button>
        </div>
      )}
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </header>
  );
}
