import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import TrustStrip from '../components/TrustStrip';
import WorkflowPreview from '../components/WorkflowPreview';
import Problem from '../components/Problem';
import UseCases from '../components/UseCases';
import HowItWorks from '../components/HowItWorks';
import Features from '../components/Features';
import FAQ from '../components/FAQ';
import InquiryForm from '../components/InquiryForm';
import ClosingCTA from '../components/ClosingCTA';
import Footer from '../components/Footer';
import OnboardingModal from '../components/OnboardingModal';

export default function Home() {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const handleGetStarted = () => setIsOnboardingOpen(true);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-teal-100 selection:text-teal-900 dark:selection:bg-teal-900/30 dark:selection:text-teal-100 transition-colors duration-300 overflow-x-hidden w-full max-w-full">
      <Navbar />
      <main>
        <Hero onGetStarted={handleGetStarted} />
        <TrustStrip />
        <WorkflowPreview />
        <Problem />
        <UseCases />
        <HowItWorks />
        <Features />
        <FAQ />
        <InquiryForm />
        <ClosingCTA onGetStarted={handleGetStarted} />
      </main>
      <Footer />
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}
