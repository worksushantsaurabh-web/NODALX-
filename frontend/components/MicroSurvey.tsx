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
      if (!db) return;
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
      <div className="bg-white  rounded-xl border border-neutral-200  shadow-xl p-5 animate-slide-up">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50  flex items-center justify-center">
              <Star className="w-4 h-4 text-emerald-600 " fill="currentColor" />
            </div>
            <p className="text-sm font-semibold text-neutral-900 ">Thanks — we read every message.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-black    mb-1">
                  Quick question
                </p>
                <p className="text-sm font-semibold text-neutral-900 ">{config.question}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 ml-3 p-1 text-text-secondary hover:text-text-tertiary :text-neutral-200 rounded-md hover:bg-neutral-100 :bg-surface-hover transition-colors"
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
                        : 'text-neutral-200 '
                    }`}
                    fill={n <= (hovered || rating) ? 'currentColor' : 'none'}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-xs text-text-secondary self-center">
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
              className="w-full rounded-lg border border-neutral-200  bg-white  px-3 py-2 text-xs text-neutral-900  placeholder-neutral-400  focus:outline-none focus:ring-2 focus:ring-black  focus:border-black  transition-colors resize-none mb-3"
            />

            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-xs text-text-secondary hover:text-text-tertiary :text-neutral-300 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={submit}
                disabled={!rating || submitting}
                className="px-4 py-2 rounded-lg bg-black  hover:bg-surface-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
