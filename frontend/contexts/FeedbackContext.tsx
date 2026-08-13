import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import MicroSurvey from '../components/MicroSurvey';

export interface SurveyConfig {
  question: string;
  context: 'form_submission' | 'onboarding_complete' | 'key_generated';
  delayMs?: number;
}

interface FeedbackContextType {
  showSurvey: (config: SurveyConfig) => void;
}

const FeedbackContext = createContext<FeedbackContextType>({ showSurvey: () => {} });

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [activeSurvey, setActiveSurvey] = useState<SurveyConfig | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSurvey = useCallback((config: SurveyConfig) => {
    const sessionKey = `nodalx_surveyed_${config.context}`;
    // Don't re-show the same survey type in the same session
    if (sessionStorage.getItem(sessionKey)) return;

    const delay = config.delayMs ?? 1500;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setActiveSurvey(config);
    }, delay);
  }, []);

  const handleClose = useCallback(() => {
    if (activeSurvey) {
      sessionStorage.setItem(`nodalx_surveyed_${activeSurvey.context}`, '1');
    }
    setActiveSurvey(null);
  }, [activeSurvey]);

  return (
    <FeedbackContext.Provider value={{ showSurvey }}>
      {children}
      {activeSurvey && (
        <MicroSurvey config={activeSurvey} onClose={handleClose} />
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextType {
  return useContext(FeedbackContext);
}
