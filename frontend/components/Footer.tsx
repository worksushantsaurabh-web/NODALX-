import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NodalXLogo } from './Navbar';
import { Mail, Phone, ArrowUpRight, Heart, Send, Check, Sparkles, Activity, FileText, LayoutDashboard } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isHoveringTop, setIsHoveringTop] = useState(false);

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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      {/* CTA Banner */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-14">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                Ready to automate your inquiry pipeline?
              </h3>
              <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                Qualify leads, draft personalized responses, and route deals — all in real-time.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={(e) => scrollToSection(e, 'how-it-works')}
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition-colors flex items-center gap-2"
              >
                See How It Works
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-sm transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Body */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 mb-12">
          
          {/* Brand & Description Column (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={scrollToTop}
            >
              <NodalXLogo className="w-8 h-8" />
              <span className="text-base font-bold tracking-tight text-white">NODALxAI</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              AI-powered business inquiry assistant. Capture inbound inquiries, qualify with advanced AI models, and automate response routing seamlessly.
            </p>

            {/* Direct Contact Info */}
            <div className="space-y-2 pt-2">
              <a
                href="mailto:nodalxai@gmail.com"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>nodalxai@gmail.com</span>
              </a>
              <a
                href="tel:+918051037012"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>+91 80510 37012</span>
              </a>
            </div>
          </div>

          {/* Product Section Navigation (4 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Platform Features</h4>
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
                    className="text-sm text-slate-400 hover:text-slate-200 transition-colors text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter Box (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Newsletter</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Get product updates and AI inquiry automation insights delivered to your inbox.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2.5 text-xs rounded-lg bg-slate-900 border border-slate-700/80 focus:border-teal-500/60 text-white placeholder-slate-500 outline-none transition-all focus:ring-1 focus:ring-teal-500/30"
                  required
                />
                <button
                  type="submit"
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    subscribed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {subscribed ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Subscribe
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800/80 mb-8"></div>

        {/* Bottom Copyright Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {currentYear} <span className="font-semibold text-slate-400">NODALxAI</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <a href="#/changelog" className="hover:text-slate-300 transition-colors">Changelog</a>
            <a href="#/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#/terms" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="mailto:nodalxai@gmail.com" className="hover:text-slate-300 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> in <span className="font-medium text-slate-400">India</span>
          </div>
          <button
            onClick={scrollToTop}
            onMouseEnter={() => setIsHoveringTop(true)}
            onMouseLeave={() => setIsHoveringTop(false)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors group/top px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Back to top <span className={`transition-transform duration-200 ${isHoveringTop ? '-translate-y-1' : 'translate-y-0'}`}>↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
