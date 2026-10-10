import { useState } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SignInModal from './SignInModal';

function NodalXLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="9" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <path d="M10 10 L26 26 M26 10 L10 26" stroke="var(--color-text-primary)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="2.4" fill="var(--color-accent)" />
      <circle cx="26" cy="10" r="2.4" fill="var(--color-accent)" />
      <circle cx="10" cy="26" r="2.4" fill="var(--color-accent)" />
      <circle cx="26" cy="26" r="2.4" fill="var(--color-accent)" />
    </svg>
  );
}

export { NodalXLogo };

const links = [
  { label: 'How it works', id: 'how-it-works' },
  { label: 'Features', id: 'features' },
  { label: 'FAQ', id: 'faq' },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const { isLoading, user } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = () => {
    setMobileMenuOpen(false);
    if (user) {
      navigate('/dashboard');
    } else {
      setSignInOpen(true);
    }
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 h-[72px] flex items-center justify-between gap-6">
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          onClick={() => window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          })}
          aria-label="NodalX, back to top"
        >
          <NodalXLogo className="w-9 h-9" />
          <span className="text-base font-semibold tracking-tight text-text-primary">NodalX</span>
        </button>

        <nav className="hidden md:flex items-center gap-7 lg:gap-9" aria-label="Main navigation">
          {links.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {item.label}
            </button>
          ))}
          <Button variant="secondary" size="sm" className="!rounded-lg !bg-bg !border-border !backdrop-blur-none" onClick={handleSignIn} disabled={isLoading} loading={isLoading}>
            {user ? 'Dashboard' : 'Sign in'}
            {!isLoading && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />}
          </Button>
        </nav>

        <button
          type="button"
          className="md:hidden p-2 rounded-md text-text-primary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav id="mobile-navigation" className="md:hidden bg-surface border-t border-border px-5 sm:px-6 py-3 pb-5 flex flex-col" aria-label="Mobile navigation">
          {links.map((item) => (
            <button
              key={item.id}
              type="button"
              className="text-left text-sm font-medium text-text-primary py-3 border-b border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              onClick={() => scrollTo(item.id)}
            >
              {item.label}
            </button>
          ))}
          <Button variant="secondary" className="!rounded-lg !bg-bg !border-border !backdrop-blur-none mt-4 w-full" onClick={handleSignIn} disabled={isLoading} loading={isLoading}>
            {user ? 'Go to dashboard' : 'Sign in'}
          </Button>
        </nav>
      )}
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </header>
  );
}
