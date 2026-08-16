import React, { useState, useEffect } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { Button } from '../ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import SignInModal from './SignInModal';

function NodalXLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="36" height="36" rx="10" fill="black" className="dark:fill-white" />
      <path d="M10 10 L26 26 M26 10 L10 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" className="dark:stroke-black" />
      <circle cx="10" cy="10" r="3" fill="white" className="dark:fill-black" />
      <circle cx="26" cy="10" r="3" fill="white" className="dark:fill-black" />
      <circle cx="10" cy="26" r="3" fill="white" className="dark:fill-black" />
      <circle cx="26" cy="26" r="3" fill="white" className="dark:fill-black" />
      <circle cx="18" cy="18" r="2.5" fill="white" opacity="0.6" className="dark:fill-black" />
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
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass py-3'
          : 'bg-white/0 dark:bg-black/0 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <NodalXLogo className="w-8 h-8" />
            <span className="text-base font-bold tracking-tight text-black dark:text-white">
              NODALxAI
            </span>
          </div>
          <div className="mb-0.5 ml-2">
            <ThemeToggle />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {[
            { label: 'How it works', id: 'how-it-works' },
            { label: 'Features', id: 'features' },
            { label: 'FAQ', id: 'faq' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
          <Button variant="secondary" size="sm" onClick={handleSignIn} disabled={isLoading} loading={isLoading}>
            {!isLoading && <LogIn className="w-4 h-4" />}
            {isLoading ? 'Signing in...' : user ? 'Dashboard' : 'Sign In'}
          </Button>
        </nav>

        <button
          className="md:hidden p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-xl transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 glass py-4 px-4 sm:px-6 flex flex-col gap-2">
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
