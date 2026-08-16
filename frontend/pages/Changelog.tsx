import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { changelog } from '../data/changelog';

const typeStyles = {
  new:      { dot: 'bg-black dark:bg-white',    label: 'New',      text: 'text-neutral-800 dark:text-neutral-400',    bg: 'bg-neutral-50 dark:bg-neutral-900/20' },
  improved: { dot: 'bg-blue-500',    label: 'Improved', text: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  fixed:    { dot: 'bg-emerald-500', label: 'Fixed',    text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
};

export default function Changelog() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-black dark:text-white dark:text-black dark:bg-white uppercase mb-3">
            Product updates
          </p>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight mb-3">
            Changelog
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Every release, in plain English. Newest first.
          </p>
        </div>

        <div className="space-y-12">
          {changelog.map((entry) => (
            <div key={entry.version}>
              {/* Release header */}
              <div className="flex items-start gap-4 mb-5">
                <div className="shrink-0 mt-1">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900">
                    v{entry.version}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-0.5">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white">{entry.title}</h2>
                    <span className="text-xs text-neutral-400">{entry.date}</span>
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{entry.summary}</p>
                </div>
              </div>

              {/* Change items */}
              <div className="ml-[3.75rem] space-y-2">
                {entry.items.map((item, i) => {
                  const s = typeStyles[item.type];
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.text} ${s.bg} shrink-0 mt-px`}>
                          {s.label}
                        </span>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ml-[3.75rem] mt-6 h-px bg-neutral-100 dark:bg-neutral-800" />
            </div>
          ))}
        </div>

        <p className="ml-[3.75rem] mt-8 text-xs text-neutral-400">
          Have a bug or feature request?{' '}
          <a href="mailto:nodalxai@gmail.com" className="text-black dark:text-white dark:text-neutral-400 hover:underline">
            nodalxai@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
