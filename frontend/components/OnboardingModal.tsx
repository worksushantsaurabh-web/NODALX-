import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NodalXLogo } from './Navbar';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, getAdditionalUserInfo } from 'firebase/auth';
import { Analytics } from '../lib/analytics';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { login, isLoading, setIsLoading } = useAuth();
  const navigate = useNavigate();
  // Track whether auth completed so we can fire abandon on non-completing close
  const didComplete = useRef(false);

  // Prevent body scrolling when modal is open + fire open/abandon events
  useEffect(() => {
    if (isOpen) {
      didComplete.current = false;
      document.body.style.overflow = 'hidden';
      Analytics.onboardingOpen();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (!didComplete.current) {
      Analytics.onboardingAbandon();
    }
    onClose();
  };

  const handleGoogleAuth = async () => {
    Analytics.onboardingGoogleClick();
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      if (result.user) {
        didComplete.current = true;
        const info = getAdditionalUserInfo(result);
        if (info?.isNewUser) {
          // Flag the dashboard to show the onboarding wizard on first load
          localStorage.setItem('nodalx_wizard', '1');
        }
        await login({
          uid: result.user.uid,
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
        });
        Analytics.signupComplete('google');
      }
      onClose();
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Authentication failed", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 animate-scale-in z-10 border border-slate-100 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-7">
          <NodalXLogo className="w-12 h-12 mx-auto mb-5" />
          <h3 id="onboarding-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
            Get early access
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Sign in to generate your API key and set up your inquiry pipeline in under 2 minutes.
          </p>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full py-3 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Connecting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          By continuing, you agree to our{' '}
          <a href="#/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms of Service</a>
          {' '}and{' '}
          <a href="#/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
