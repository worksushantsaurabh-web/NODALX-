import React, { useEffect } from 'react';
import { X, UserPlus, LayoutTemplate, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NodalXLogo } from './Navbar';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { login, isLoading, setIsLoading } = useAuth();
  const navigate = useNavigate();

  // Prevent body scrolling when modal is open
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

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      if (result.user) {
        await login({
          uid: result.user.uid,
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
        });
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

  const steps = [
    {
      icon: UserPlus,
      title: 'Connect Account',
      description: 'Securely link your Google account to get started.',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      icon: LayoutTemplate,
      title: 'Select Automation Template',
      description: 'Choose a pre-built flow tailored to your industry.',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      icon: Zap,
      title: 'Launch Flow',
      description: 'Go live and let AI handle your inbound inquiries.',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with glassmorphism */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal Card */}
      <div 
        className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 animate-scale-in z-10 overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-teal-50 to-transparent opacity-80 pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-20"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="mx-auto mb-6">
            <NodalXLogo className="w-16 h-16 mx-auto" />
          </div>
          <h3 id="onboarding-title" className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
            Welcome to NODALxAI
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-base">
            You're just 3 steps away from automating your inbound sales pipeline.
          </p>
        </div>

        {/* 3-Step Checklist */}
        <div className="space-y-6 mb-10 relative z-10">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${step.bgColor} flex items-center justify-center flex-shrink-0 border border-slate-100`}>
                <step.icon className={`w-6 h-6 ${step.color}`} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 mb-1">
                  {index + 1}. {step.title}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="relative z-10">
          <button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-lg transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-80 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google to Launch
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-400 mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
