import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Section, SectionHeader } from '../ui';

const faqs = [
  {
    "q": "Do I need to replace my existing contact form?",
    "a": "No. A developer can forward submissions from your form server or trusted automation to the intake API. Keep the workspace API key server-side; a browser-only embed is not provided."
  },
  {
    "q": "How does qualification work?",
    "a": "A configured external workflow can return classification and fit signals. Processing must be configured and tested first. Results are suggestions for human review, not guaranteed accuracy."
  },
  {
    "q": "Can I inspect the original inquiry?",
    "a": "Yes. The Inquiry Desk retains the submitted message and shows available processing results alongside it. Missing analysis is not presented as a completed score."
  },
  {
    "q": "Does this work with our existing CRM?",
    "a": "Google Sheets supports explicit import and optional results export. Slack supports configured alerts. Continuous CRM sync and automatic HubSpot onboarding are not included in the pilot."
  },
  {
    "q": "Where is my data stored?",
    "a": "The dashboard reads inquiries stored in Firebase Firestore. Sheets is an import/export connector, not the dashboard database. Contact support to request export or deletion; there is no self-service account deletion yet."
  },
  {
    "q": "Does NodalX send replies automatically?",
    "a": "No. Where a processing workflow supplies a draft, you can review it and open your email app. Marking an inquiry Contacted does not prove a message was sent or delivered."
  },
  {
    "q": "How long does setup take?",
    "a": "Setup depends on your existing form server, credentials, and spreadsheet permissions. Sheets uses service-account sharing and a verification tab, not an OAuth grant. Validate a test inquiry before inviting users."
  },
  {
    "q": "What happens when processing fails?",
    "a": "The saved inquiry remains visible. Review the processing status and retry through the supported job flow after resolving configuration or provider failures."
  },
  {
    "q": "What happens after the trial?",
    "a": "The trial lasts fourteen days. Expired plans and exhausted allowances block additional processing. Usage and billing shows current limits; checkout is available only when a payment provider is configured."
  },
  {
    "q": "What should I review before collecting personal data?",
    "a": "Read the Privacy Policy, disclose your purposes and processors, and obtain appropriate permissions for the information you collect. Legal obligations depend on your users and region; NodalX does not guarantee regulatory compliance."
  }
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section id="faq" bg="surface" border innerClassName="!max-w-3xl">
      <SectionHeader label="FAQ" heading="Questions we actually get asked" />
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className={`g-card rounded-2xl px-6 transition-all ${open === i ? 'g-card-open' : ''}`}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              aria-controls={`faq-answer-${i}`}
              className="w-full flex items-start justify-between gap-6 py-5 text-left group"
            >
              <span className="text-sm font-semibold text-text-primary leading-snug group-hover:text-accent transition-colors">
                {faq.q}
              </span>
              <span className="shrink-0 mt-0.5 text-text-tertiary">
                {open === i ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
            </button>
            {open === i && (
              <div id={`faq-answer-${i}`} className="pb-5">
                <p className="text-sm text-text-secondary leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
