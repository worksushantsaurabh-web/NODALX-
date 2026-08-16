import React, { useState, useEffect } from 'react';
import { X, Link2, CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { Button, Input } from '../ui';
import { Analytics } from '../lib/analytics';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (sheetTitle: string, spreadsheetId: string) => void;
}

type ModalState = 'input' | 'loading' | 'success' | 'error';

export default function GoogleSheetsModal({ isOpen, onClose, onSuccess }: GoogleSheetsModalProps) {
  const { firebaseUser } = useAuth();
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [modalState, setModalState] = useState<ModalState>('input');
  const [errorMessage, setErrorMessage] = useState('');
  const [connectedSheet, setConnectedSheet] = useState<{ title: string; spreadsheetId: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSpreadsheetInput('');
      setModalState('input');
      setErrorMessage('');
      setConnectedSheet(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!spreadsheetInput.trim()) {
      setErrorMessage('Please enter a Google Sheet URL or Spreadsheet ID.');
      setModalState('error');
      return;
    }

    const currentUser = firebaseUser || auth.currentUser;
    if (!currentUser) {
      setErrorMessage('You must be signed in to connect a Google Sheet. Please sign in and try again.');
      setModalState('error');
      return;
    }

    setModalState('loading');
    setErrorMessage('');

    let token: string;
    try {
      token = await currentUser.getIdToken(true);
    } catch (tokenError) {
      console.error('[GoogleSheetsModal] Failed to get auth token:', tokenError);
      setErrorMessage('Authentication error. Please sign out and sign back in.');
      setModalState('error');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';

      const response = await fetch(`${apiBase}/api/connectors/google-sheets/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ spreadsheetId: spreadsheetInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        let friendlyError = data.error || 'Failed to verify Google Sheet.';

        if (response.status === 403 || friendlyError.toLowerCase().includes('permission')) {
          friendlyError = 'Permission denied. Make sure your Google Sheet is shared with the service account email. Check your dashboard settings for the service account address.';
        } else if (response.status === 404 || friendlyError.toLowerCase().includes('not found')) {
          friendlyError = 'Spreadsheet not found. Please check the URL or ID and try again.';
        } else if (response.status === 400 && friendlyError.toLowerCase().includes('invalid')) {
          friendlyError = 'Invalid format. Please enter a valid Google Sheets URL or Spreadsheet ID.';
        }

        setErrorMessage(friendlyError);
        setModalState('error');
        return;
      }

      setConnectedSheet({
        title: data.title || 'Untitled Sheet',
        spreadsheetId: data.spreadsheetId,
      });
      setModalState('success');
      Analytics.integrationConnected('google_sheets');

      if (onSuccess) {
        onSuccess(data.title, data.spreadsheetId);
      }
    } catch (err: any) {
      console.error('[GoogleSheetsModal] Verify error:', err);
      setErrorMessage('Network error. Please check your connection and try again.');
      setModalState('error');
    }
  };

  const handleReset = () => {
    setSpreadsheetInput('');
    setModalState('input');
    setErrorMessage('');
    setConnectedSheet(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 min-h-screen">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-950/50 dark:bg-neutral-950/70 modal-backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal */}
      <div
        className="relative w-full max-w-[500px] bg-white/85 dark:bg-neutral-900/85 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-neutral-900/15 dark:shadow-black/40 p-7 sm:p-8 animate-scale-in z-10 overflow-hidden border border-white/50 dark:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-sheets-modal-title"
      >
        {/* Decorative glass orbs */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-to-br from-neutral-400/10 to-neutral-300/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-gradient-to-tr from-green-400/20 to-emerald-400/20 blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100/80 dark:hover:bg-white/10 rounded-xl transition-all duration-200 z-20 backdrop-blur-sm"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-7 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-600/25 mx-auto mb-5 glass-shine">
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>
          <h3 id="google-sheets-modal-title" className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Connect Google Sheet
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-2 leading-relaxed">
            Link your spreadsheet to sync leads automatically
          </p>
        </div>

        {/* Content based on state */}
        <div className="relative z-10">
          {/* Success State */}
          {modalState === 'success' && connectedSheet && (
            <div className="space-y-5">
              <div className="p-5 bg-emerald-50/80 dark:bg-emerald-500/10 backdrop-blur-sm border border-emerald-200/60 dark:border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      Successfully Connected!
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Your Google Sheet is now linked
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-white/60 dark:bg-black/20 rounded-xl border border-emerald-200/40 dark:border-emerald-500/10">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {connectedSheet.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1 truncate">
                    ID: {connectedSheet.spreadsheetId}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={handleReset}>
                  <RefreshCw className="w-4 h-4" />
                  Connect Different Sheet
                </Button>
                <Button variant="primary" className="flex-1" onClick={onClose}>
                  <CheckCircle2 className="w-4 h-4" />
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Input / Loading / Error States */}
          {modalState !== 'success' && (
            <form onSubmit={handleVerify} className="space-y-5">
              {/* Not Signed In Warning */}
              {!firebaseUser && !auth.currentUser && (
                <div className="p-4 bg-amber-50/80 dark:bg-amber-500/10 backdrop-blur-sm border border-amber-200/60 dark:border-amber-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                      You must be signed in to connect a Google Sheet.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">
                      Please sign in to your account first.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {modalState === 'error' && errorMessage && (
                <div className="p-4 bg-rose-50/80 dark:bg-rose-500/10 backdrop-blur-sm border border-rose-200/60 dark:border-rose-500/20 rounded-xl flex items-start gap-3 animate-shake">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 leading-relaxed">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Input Field */}
              <Input
                label="Google Sheet URL or ID"
                type="text"
                value={spreadsheetInput}
                onChange={(e) => {
                  setSpreadsheetInput(e.target.value);
                  if (modalState === 'error') { setModalState('input'); setErrorMessage(''); }
                }}
                placeholder="https://docs.google.com/spreadsheets/d/... or spreadsheet ID"
                disabled={modalState === 'loading'}
                leftIcon={<Link2 className="w-4 h-4" />}
                helper="Paste the full URL from your browser or just the spreadsheet ID"
              />

              {/* Instructions */}
              <div className="p-4 bg-neutral-50/80 dark:bg-neutral-800/40 backdrop-blur-sm rounded-xl border border-neutral-200/60 dark:border-neutral-700/40">
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Before connecting:
                </p>
                <ul className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">1.</span>
                    <span>Open your Google Sheet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">2.</span>
                    <span>Click "Share" in the top right</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">3.</span>
                    <span>Share with the service account email (found in your dashboard settings)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">4.</span>
                    <span>Grant "Editor" access for full functionality</span>
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={modalState === 'loading' || !spreadsheetInput.trim() || (!firebaseUser && !auth.currentUser)}
                loading={modalState === 'loading'}
              >
                {modalState !== 'loading' && <Link2 className="w-4 h-4" />}
                {modalState === 'loading' ? 'Verifying Access...' : 'Connect & Verify'}
              </Button>

              {/* Help Link */}
              <div className="text-center">
                <a
                  href="https://support.google.com/docs/answer/9331169"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Learn how to share a Google Sheet
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
