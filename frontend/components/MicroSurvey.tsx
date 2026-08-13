import React, { useEffect, useRef, useState } from 'react';
import { X, Star } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../lib/analytics';
import type { SurveyConfig } from '../contexts/FeedbackContext';

interface MicroSurveyProps {
  config: SurveyConfig;
  onClose: () => void;
}

export default function MicroSurvey({ config, onClose }: MicroSurveyProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auto-dismiss after 8 seconds with no interaction
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interacted = useRef(false);

  const clearAutoDismiss = () => {
    interacted.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (!interacted.current) onClose();
    }, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onClose]);

  const submit = async () => {
    if (!rating) return;
    clearAutoDismiss();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        type: 'survey',
        surveyContext: config.context,
        rating,
        message: comment.trim(),
        email: user?.email ?? null,
        userId: user?.uid ?? null,
        page: window.location.hash || '/',
        createdAt: serverTimestamp(),
      });
      Analytics.surveySubmitted(config.context, rating);
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch {
      // Silent — never crash the app on feedback failure
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
      onMouseEnter={clearAutoDismiss}
      onFocus={clearAutoDismiss}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-5 animate-slide-up">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Thanks — we read every message.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-500 mb-1">
                  Quick question
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{config.question}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 ml-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Star rating */}
            <div
              className="flex gap-1 mb-4"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => { clearAutoDismiss(); setRating(n); }}
                  onMouseEnter={() => { clearAutoDismiss(); setHovered(n); }}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      n <= (hovered || rating)
                        ? 'text-amber-400'
                        : 'text-slate-200 dark:text-slate-700'
                    }`}
                    fill={n <= (hovered || rating) ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-xs text-slate-400 self-center">
                  {['', 'Not great', 'Could be better', 'OK', 'Good', 'Excellent'][rating]}
                </span>
              )}
            </div>

            {/* Optional comment */}
            <textarea
              value={comment}
              onChange={(e) => { clearAutoDismiss(); setComment(e.target.value); }}
              placeholder="Tell us more (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors resize-none mb-3"
            />

            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={submit}
                disabled={!rating || submitting}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
