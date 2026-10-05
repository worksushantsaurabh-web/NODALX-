import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NodalXLogo } from './Navbar';
import { Mail, Phone, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();

  const scrollToTop = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };


  return (
    <footer className="bg-bg text-text-secondary border-t border-border">
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 py-14">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2 tracking-tight">
                Ready to automate your inquiry pipeline?
              </h3>
              <p className="text-text-secondary text-sm max-w-md leading-relaxed">
                Organize inquiries, review optional processing results, and track human follow-up.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:shrink-0">
              <button
                onClick={(e) => scrollToSection(e, 'how-it-works')}
                className="min-h-11 px-5 py-2.5 rounded-md bg-accent hover:opacity-90 text-[#fff] font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                See How It Works
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="min-h-11 px-5 py-2.5 rounded-md border border-border-strong hover:border-text-tertiary text-text-secondary hover:text-text-primary font-medium text-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 mb-12">
          <div className="md:col-span-5 space-y-6">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={scrollToTop}>
              <NodalXLogo className="w-8 h-8" />
              <span className="text-base font-bold tracking-tight text-text-primary">NodalX</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md">
              Business inquiry intake and follow-up workspace. Preserve original messages and choose the next action with context.
            </p>
            <div className="space-y-2 pt-2">
              <a
                href="mailto:nodalxai@gmail.com"
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>nodalxai@gmail.com</span>
              </a>
              <a
                href="tel:+918051037012"
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>+91 80510 37012</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-cosmos">Platform</h4>
            <ul className="space-y-3">
              {[
                { label: 'How It Works', target: 'how-it-works' },
                { label: 'Features', target: 'features' },
                { label: 'FAQ', target: 'faq' },
                { label: 'Dashboard', target: null },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={(e) => item.target ? scrollToSection(e, item.target) : navigate('/dashboard')}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-cosmos">Product updates</h4>
            <p className="text-text-secondary text-xs leading-relaxed">Read the changelog for updates. Newsletter subscriptions are not available yet.</p>
            <button onClick={() => navigate('/changelog')} className="text-sm text-accent hover:underline">View changelog</button>
          </div>
        </div>

        <div className="h-px bg-border mb-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-tertiary">
            &copy; {currentYear} <span className="font-medium text-text-secondary">NodalX</span>. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-text-tertiary">
            <a href="#/changelog" className="hover:text-text-primary transition-colors">Changelog</a>
            <a href="#/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</a>
            <a href="#/terms" className="hover:text-text-primary transition-colors">Terms of Service</a>
            <a href="mailto:nodalxai@gmail.com" className="hover:text-text-primary transition-colors">Contact</a>
          </div>
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-surface-hover"
          >
            Back to top <span>&uarr;</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
