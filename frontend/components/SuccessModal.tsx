import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SuccessModal({ isOpen, onClose }: SuccessModalProps) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with glassmorphism */}
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal Card */}
      <div 
        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 text-center animate-scale-in z-10 overflow-hidden border border-neutral-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-neutral-50 to-transparent opacity-80 pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors z-20"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Success Icon */}
        <div className="relative flex justify-center mb-8 mt-4">
          <div className="absolute inset-0 bg-neutral-100 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-60 scale-150"></div>
          <div className="relative w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10">
            <CheckCircle2 className="w-10 h-10 text-black dark:text-white animate-scale-in" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>

        {/* Content */}
        <h3 id="modal-title" className="text-2xl sm:text-3xl font-extrabold text-neutral-900 mb-5 tracking-tight">
          Thank You!
        </h3>

        <div className="space-y-3 text-neutral-600 text-base leading-relaxed mb-10">
          <p className="font-medium text-neutral-800">Your inquiry has been received.</p>
          <p>Our AI assistant is processing your request.</p>
          <p>A business representative will contact you shortly.</p>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-lg transition-all shadow-lg shadow-neutral-900/20 hover:shadow-neutral-900/30 hover:-translate-y-0.5"
        >
          Done
        </button>
      </div>
    </div>
  );
}