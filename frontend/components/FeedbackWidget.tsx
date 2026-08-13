import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, AlertCircle, Lightbulb, HelpCircle, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../lib/analytics';

type Category = 'bug' | 'feature' | 'question' | 'general';

const categories: { id: Category; label: string; Icon: React.ElementType; placeholder: string }[] = [
  { id: 'bug',     label: 'Bug',     Icon: AlertCircle,    placeholder: "What happened? What did you expect instead?" },
  { id: 'feature', label: 'Feature', Icon: Lightbulb,      placeholder: "What would you like to see added?" },
  { id: 'question',label: 'Question',Icon: HelpCircle,     placeholder: "What can we help with?" },
  { id: 'general', label: 'Feedback',Icon: MessageSquare,  placeholder: "Tell us anything." },
];

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pre-fill email from auth
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const reset = () => {
    setCategory('general');
    setMessage('');
    if (!user?.email) setEmail('');
    setSubmitted(false);
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    // Delay reset so close animation can play
    setTimeout(reset, 300);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        type: 'widget',
        category,
        message: message.trim(),
        email: email.trim() || user?.email || null,
        userId: user?.uid ?? null,
        page: window.location.hash || '/',
        createdAt: serverTimestamp(),
      });
      Analytics.feedbackSubmitted(category);
      setSubmitted(true);
      setTimeout(handleClose, 2200);
    } catch {
      // Silent failure — don't crash the app
    } finally {
      setSubmitting(false);
    }
  };

  const activeCat = categories.find(c => c.id === category)!;

  return (
    <div ref={panelRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Expandable panel */}
      {open && (
        <div className="w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">What's on your mind?</p>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Sent! Thanks.</p>
                <p className="text-xs text-slate-400 mt-1">We read every piece of feedback.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="p-4 space-y-3">
              {/* Category pills */}
              <div className="flex gap-1.5 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      category === cat.id
                        ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <cat.Icon className="w-3 h-3" />
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={activeCat.placeholder}
                required
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors resize-none"
              />

              {/* Email */}
              {!user?.email && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com (optional)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                />
              )}

              {user?.email && (
                <p className="text-xs text-slate-400">
                  Sending as <span className="font-medium text-slate-500 dark:text-slate-300">{user.email}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={!message.trim() || submitting}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={open ? handleClose : handleOpen}
        className={`group flex items-center gap-2 rounded-full shadow-lg transition-all ${
          open
            ? 'w-10 h-10 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            : 'pl-3 pr-4 h-10 bg-teal-600 hover:bg-teal-700 text-white'
        }`}
        aria-label="Open feedback"
      >
        {open
          ? <X className="w-4 h-4 mx-auto" />
          : (
            <>
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold whitespace-nowrap">Feedback</span>
            </>
          )
        }
      </button>
    </div>
  );
}
