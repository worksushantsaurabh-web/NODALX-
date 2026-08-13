import React, { useState, useEffect, useRef } from 'react';
import { X, LogIn, Mail, Lock, AlertCircle, RefreshCw, KeyRound, Eye, EyeOff, Phone, MessageSquare, User, Building } from 'lucide-react';
import { Analytics } from '../lib/analytics';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { api } from '../src/services/api';

type AuthMode = 'email' | 'phone' | 'google';
type EmailStep = 'signin' | 'signup' | 'forgot';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<AuthMode>('email');
  const [emailStep, setEmailStep] = useState<EmailStep>('signin');

  // Email/Password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Phone auth fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Shared
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Reset states when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setPhoneNumber('');
      setOtpCode('');
      setOtpStep('phone');
      setConfirmationResult(null);
      setEmailStep('signin');
      setAuthMode('email');
      setErrorMsg(null);
      setInfoMsg(null);
      setIsSubmitting(false);
      setShowPassword(false);
      setResendTimer(0);
      setFullName('');
      setCompanyName('');
    } else {
      // Initialise recaptcha verifier when modal opens
      // (Needs to be done after modal is rendered)
      setTimeout(() => {
        initRecaptcha();
      }, 100);
    }
  }, [isOpen]);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {}
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Prevent scrolling when modal is open
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

  const initRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
    }
    if (!recaptchaContainerRef.current) return;

    try {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
      });
    } catch (err) {
      console.error('RecaptchaVerifier init error:', err);
    }
  };

  // ==================== EMAIL / PASSWORD ====================

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      Analytics.signinComplete('email');
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setErrorMsg('No account found with this email and password combination.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Invalid email format.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many failed attempts. Please try again later.');
      } else {
        setErrorMsg(err.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName || !companyName) {
      setErrorMsg('Please fill out all fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(userCred.user, { displayName: fullName });

      // Save user details to Firestore
      const userDocRef = doc(db, 'users', userCred.user.uid);
      await setDoc(userDocRef, {
        uid: userCred.user.uid,
        email: userCred.user.email,
        displayName: fullName,
        companyName: companyName,
        createdAt: new Date(),
      });

      // Create HubSpot contact for new user
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      try {
        await api.post('/api/hubspot/contact', {
          email: userCred.user.email,
          firstName,
          lastName,
        });
      } catch (hubspotErr) {
        console.warn('[HubSpot] Failed to create contact:', hubspotErr);
      }

      // Send verification email
      await sendEmailVerification(userCred.user);

      setInfoMsg('Account created! Please check your email to verify your address before signing in.');
      setEmailStep('signin');
      setPassword('');
      setFullName('');
      setCompanyName('');

    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Please sign in instead.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Invalid email format.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password is too weak. Use at least 6 characters.');
      } else {
        setErrorMsg(err.message || 'Sign-up failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setInfoMsg('Password reset email sent! Check your inbox.');
      setEmailStep('signin');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        setErrorMsg('No account found with this email.');
      } else if (code === 'auth/invalid-email') {
        setErrorMsg('Invalid email format.');
      } else {
        setErrorMsg(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== GOOGLE SIGN-IN ====================

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      // Map the Firebase user
      if (result.user) {
        // Check if this is a new user by looking for their Firestore doc
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userDocRef);
        const isNewUser = !userDoc.exists();

        if (isNewUser) {
          // Save to Firestore
          await setDoc(userDocRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || '',
            createdAt: new Date(),
          });

          // Create HubSpot contact for new Google user
          const displayName = result.user.displayName || '';
          const nameParts = displayName.trim().split(' ');
          const firstName = nameParts[0] || result.user.email?.split('@')[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          try {
            await api.post('/api/hubspot/contact', {
              email: result.user.email,
              firstName,
              lastName,
            });
          } catch (hubspotErr) {
            console.warn('[HubSpot] Failed to create contact:', hubspotErr);
          }
        }

        await login({
          uid: result.user.uid,
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'User',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
        });
        Analytics.signinComplete('google');
      }
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg(null); // Don't show error if user just closed popup
      } else if (code === 'auth/cancelled-popup-request') {
        setErrorMsg(null);
      } else {
        setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== PHONE AUTHENTICATION ====================

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setErrorMsg('Please enter your phone number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      // Ensure recaptcha verifier exists
      if (!recaptchaVerifierRef.current) {
        initRecaptcha();
        // Wait a tick for it to initialise
        await new Promise(r => setTimeout(r, 500));
      }

      if (!recaptchaVerifierRef.current) {
        setErrorMsg('Could not initialise reCAPTCHA. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifierRef.current
      );
      setConfirmationResult(confirmation);
      setOtpStep('otp');
      setResendTimer(30);
      setInfoMsg('OTP sent to your phone!');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/invalid-phone-number') {
        setErrorMsg('Invalid phone number. Use E.164 format (e.g., +1234567890).');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many requests. Please try again later.');
      } else if (code === 'auth/quota-exceeded') {
        setErrorMsg('SMS quota exceeded. Try again later.');
      } else {
        setErrorMsg(err.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setErrorMsg('Please enter the OTP code.');
      return;
    }
    if (!confirmationResult) {
      setErrorMsg('Session expired. Please request a new OTP.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await confirmationResult.confirm(otpCode);
      if (result.user) {
        // Check if this is a new user
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userDocRef);
        const isNewUser = !userDoc.exists();

        if (isNewUser) {
          // Save to Firestore
          await setDoc(userDocRef, {
            uid: result.user.uid,
            phoneNumber: result.user.phoneNumber || phoneNumber,
            displayName: result.user.displayName || '',
            createdAt: new Date(),
          });

          // Create HubSpot contact for new phone user (phone number as identifier)
          if (result.user.email) {
            try {
              await api.post('/api/hubspot/contact', {
                email: result.user.email,
                firstName: result.user.displayName || 'Phone User',
                lastName: '',
              });
            } catch (hubspotErr) {
              console.warn('[HubSpot] Failed to create contact:', hubspotErr);
            }
          }
        }

        await login({
          uid: result.user.uid,
          displayName: result.user.displayName || 'User',
          email: result.user.email || '',
          phoneNumber: result.user.phoneNumber || phoneNumber,
          photoURL: result.user.photoURL || '',
        });
        Analytics.signinComplete('phone');
      }
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/invalid-verification-code') {
        setErrorMsg('Invalid OTP. Please try again.');
      } else if (code === 'auth/code-expired') {
        setErrorMsg('OTP expired. Please request a new one.');
        setOtpStep('phone');
        setConfirmationResult(null);
      } else {
        setErrorMsg(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setConfirmationResult(null);
    setOtpStep('phone');
    setOtpCode('');
    setResendTimer(0);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  if (!isOpen) return null;

  const renderTab = (mode: AuthMode, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => {
        setAuthMode(mode);
        setErrorMsg(null);
        setInfoMsg(null);
        setOtpStep('phone');
        setConfirmationResult(null);
        setOtpCode('');
        setEmailStep('signin');
        setPassword('');
      }}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
        authMode === mode
          ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-300/40'
          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 min-h-screen">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/50 dark:bg-slate-950/70 modal-backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal */}
      <div
        className="relative w-full max-w-[420px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 p-6 sm:p-8 animate-scale-in z-10 overflow-hidden border border-white/40 dark:border-white/10"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative glass orbs */}
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-teal-400/20 to-blue-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-tr from-purple-400/15 to-teal-400/15 blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/10 rounded-xl transition-all duration-200 z-20 backdrop-blur-sm"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/30 mx-auto mb-4 glass-shine">
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1.5">
            Sign In
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Access your NODALxAI dashboard
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex gap-2 mb-5 bg-slate-100/70 dark:bg-slate-800/40 p-1 rounded-xl relative z-10">
          {renderTab('email', 'Email', <Mail className="w-3.5 h-3.5" />)}
          {renderTab('google', 'Google', (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          ))}
          {renderTab('phone', 'Phone', <Phone className="w-3.5 h-3.5" />)}
        </div>

        {/* Info Message */}
        {infoMsg && (
          <div className="mb-4 p-3.5 bg-teal-50/80 dark:bg-teal-500/10 backdrop-blur-sm border border-teal-200/60 dark:border-teal-500/20 rounded-xl text-teal-800 dark:text-teal-400 text-xs font-semibold leading-relaxed animate-slide-up">
            {infoMsg}
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50/80 dark:bg-rose-500/10 backdrop-blur-sm border border-rose-200/60 dark:border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-400 animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-semibold leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Forms */}
        <div className="relative z-10">
          {/* EMAIL AUTH */}
          {authMode === 'email' && (
            <>
              {emailStep === 'signin' && (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-10 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setEmailStep('forgot')}
                      className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 glass-shine"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </>
                    )}
                  </button>

                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setEmailStep('signup'); setErrorMsg(null); setInfoMsg(null); }}
                      className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Create one
                    </button>
                  </div>
                </form>
              )}

              {emailStep === 'signup' && (
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Company Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Inc."
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full pl-10 pr-10 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 glass-shine"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Create Account
                      </>
                    )}
                  </button>

                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { setEmailStep('signin'); setErrorMsg(null); setInfoMsg(null); }}
                      className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}

              {emailStep === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Enter your email and we'll send you a password reset link.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 glass-shine"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending Reset Link...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Reset Link
                      </>
                    )}
                  </button>

                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                    Remember your password?{' '}
                    <button
                      type="button"
                      onClick={() => { setEmailStep('signin'); setErrorMsg(null); setInfoMsg(null); }}
                      className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* GOOGLE AUTH */}
          {authMode === 'google' && (
            <div className="space-y-4">
              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                Sign in securely with your Google account.
              </div>
              <button
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-sm rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {isSubmitting ? 'Signing in...' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                <span className="text-xs text-slate-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              </div>

              <button
                onClick={() => { setAuthMode('email'); setEmailStep('signin'); }}
                className="w-full py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Sign in with Email Instead
              </button>
            </div>
          )}

          {/* PHONE AUTH */}
          {authMode === 'phone' && (
            <>
              {otpStep === 'phone' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1234567890"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">Enter your phone number in E.164 format (e.g., +1234567890)</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 glass-shine"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        Send OTP
                      </>
                    )}
                  </button>
                </form>
              )}

              {otpStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Enter OTP
                      </label>
                      <button
                        type="button"
                        onClick={() => { setOtpStep('phone'); setConfirmationResult(null); setErrorMsg(null); setInfoMsg(null); }}
                        className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                      >
                        Change Number
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-black/20 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none tracking-[0.3em] font-bold focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 glass-shine"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Verify & Sign In
                      </>
                    )}
                  </button>

                  {/* Resend OTP */}
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                    Didn't receive a code?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-slate-500 dark:text-slate-400">
                        Resend in {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:
                        {String(resendTimer % 60).padStart(2, '0')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                        disabled={isSubmitting}
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* reCAPTCHA container (invisible) */}
        <div ref={recaptchaContainerRef}></div>
      </div>
    </div>
  );
}