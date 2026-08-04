import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import InquiryForm from '../components/InquiryForm';
import AiAnalysisPreview from '../components/AiAnalysisPreview';
import EmailPreview from '../components/EmailPreview';
import DashboardPreview from '../components/DashboardPreview';
import Footer from '../components/Footer';
import OnboardingModal from '../components/OnboardingModal';

export default function Home() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-teal-100 selection:text-teal-900 dark:selection:bg-teal-900/30 dark:selection:text-teal-100 transition-colors duration-300 overflow-x-hidden w-full max-w-full">
      <Navbar />
      <main>
        <Hero onGetStarted={() => setIsOnboardingOpen(true)} />
        <InquiryForm />
        <AiAnalysisPreview />
        <EmailPreview />
        <DashboardPreview />
      </main>
      <Footer />
      <OnboardingModal 
        isOpen={isOnboardingOpen} 
        onClose={() => setIsOnboardingOpen(false)} 
      />
    </div>
  );
}
