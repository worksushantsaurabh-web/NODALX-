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
    <footer className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-300 overflow-hidden border-t border-slate-800/60">
      {/* Animated gradient background glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-teal-600/5 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Glowing accent border */}
      <div className="h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent"></div>

      {/* Main CTA Banner */}
      <div className="relative z-10 border-b border-white/10 bg-gradient-to-r from-teal-950/20 via-slate-900/40 to-blue-950/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <h3 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
                Ready to automate your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">inquiry pipeline</span>?
              </h3>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
                Qualify leads with AI, draft personalized responses, and route deals — all in real-time.
              </p>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-4 w-full sm:w-auto justify-center">
              <button
                onClick={(e) => scrollToSection(e, 'contact')}
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm transition-all shadow-lg shadow-teal-600/25 hover:shadow-teal-600/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
              >
                Try Interactive Form
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-teal-500/50 text-white font-semibold text-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Body */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 mb-12">
          
          {/* Brand & Description Column (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group inline-flex" 
              onClick={scrollToTop}
            >
              <NodalXLogo className="w-9 h-9 group-hover:scale-105 transition-transform" />
              <span className="text-xl font-bold tracking-tight text-white">
                nodal<span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-300">X</span>{' '}
                <span className="text-slate-400 font-semibold text-base">AI</span>
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              AI-powered business inquiry assistant. Capture inbound inquiries, qualify with advanced AI models, and automate response routing seamlessly.
            </p>

            {/* Direct Contact Info */}
            <div className="space-y-3 pt-2">
              <a 
                href="mailto:nodalxai@gmail.com" 
                className="flex items-center gap-3 text-sm text-slate-300 hover:text-teal-400 transition-colors group w-fit"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 group-hover:bg-teal-500/20 group-hover:border-teal-500/40 flex items-center justify-center transition-all">
                  <Mail className="w-4 h-4 text-teal-400" />
                </div>
                <span>nodalxai@gmail.com</span>
              </a>
              <a 
                href="tel:+918051037012" 
                className="flex items-center gap-3 text-sm text-slate-300 hover:text-teal-400 transition-colors group w-fit"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 group-hover:bg-teal-500/20 group-hover:border-teal-500/40 flex items-center justify-center transition-all">
                  <Phone className="w-4 h-4 text-teal-400" />
                </div>
                <span>+91 80510 37012</span>
              </a>
            </div>
          </div>

          {/* Product Section Navigation (4 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Platform Features</h4>
            <ul className="space-y-3">
              {[
                { label: 'Submit Inquiry Demo', icon: Sparkles, target: 'contact' },
                { label: 'Real-Time AI Analysis', icon: Activity, target: 'ai-analysis' },
                { label: 'Auto-Drafted Emails', icon: FileText, target: 'email-draft' },
                { label: 'Pipeline Command Center', icon: LayoutDashboard, target: 'pipeline' },
              ].map((item) => (
                <li key={item.label}>
                  <button 
                    onClick={(e) => scrollToSection(e, item.target)} 
                    className="text-sm text-slate-400 hover:text-teal-400 transition-colors inline-flex items-center gap-2 group text-left"
                  >
                    <item.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                    <span>{item.label}</span>
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
