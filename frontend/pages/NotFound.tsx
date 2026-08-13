import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold tracking-widest text-teal-600 dark:text-teal-500 uppercase mb-4">
          404
        </p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">
          Page not found
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
