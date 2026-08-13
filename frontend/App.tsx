import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackWidget from './components/FeedbackWidget';
import Home from './pages/Home';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import Changelog from './pages/Changelog';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));

function DashboardFallback() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-6 h-6 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-xs text-slate-400 dark:text-slate-500">Loading dashboard…</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <FeedbackProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<DashboardFallback />}>
                        <Dashboard />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </HashRouter>
            {/* Global feedback widget — visible on all pages */}
            <FeedbackWidget />
          </FeedbackProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
