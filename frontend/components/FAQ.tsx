import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Section, SectionHeader } from '../ui';

const faqs = [
  {
    q: 'Do I need to replace my existing contact form?',
    a: 'No. You can use the NODALxAI embeddable form, or forward submissions from your current form to our intake endpoint. Your existing setup stays intact — you just add a destination.',
  },
  {
    q: 'How does the lead scoring actually work?',
    a: 'You define qualification criteria in plain language — budget range, company size, geography, urgency keywords. NODALxAI evaluates each submission against these rules and assigns a score with a written explanation. Nothing is a black box; you can read why every lead scored the way it did.',
  },
  {
    q: 'Can I see what data the AI used to score a lead?',
    a: 'Yes. Every qualification score includes a written breakdown — which signals were weighted, what matched your criteria, and the final score. Every decision is traceable. If a score looks wrong, you can read exactly why it was assigned and adjust your criteria.',
  },
  {
    q: 'Does this work with our existing CRM?',
    a: 'Google Sheets and Slack sync automatically today. HubSpot contacts are created on sign-up. Direct CRM integrations (Salesforce, Pipedrive, HubSpot deals) are on the roadmap. In the meantime, most CRMs can pull from Google Sheets via Zapier or a native CSV import.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Inquiry data lives in your connected Google Sheet or in the NODALxAI dashboard — your choice. We do not use your data to train models, and you can delete everything at any time through the dashboard.',
  },
  {
    q: 'Can I control how the reply drafts sound?',
    a: 'Yes. You set a tone profile (formal, direct, conversational) and can paste in sample replies to calibrate style. You can also add mandatory inclusions like pricing links or booking links, and the draft will incorporate them where appropriate.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most teams are live in under 15 minutes. Embedding the form is one script tag. Connecting Google Sheets takes two clicks and an OAuth grant. Defining scoring criteria takes five minutes the first time, less when you refine it later.',
  },
  {
    q: 'What happens if the AI is unsure about a lead?',
    a: "If a score falls below your confidence threshold, the inquiry is flagged for manual review rather than auto-replied. You set the threshold. Nothing goes out without you seeing it first — unless you explicitly enable auto-send for high-confidence leads.",
  },
  {
    q: 'What happens after the free period?',
    a: "Paid plans are based on inquiry volume and team size. You'll see your options in the dashboard before anything changes. Nothing switches off automatically — you'll get an email with options before any limit is reached.",
  },
  {
    q: 'Is this GDPR compliant?',
    a: 'We store inquiry data on Firebase (Google Cloud infrastructure), do not use it to train models, and provide full deletion on request. If you are processing personal data of EU residents, you should review our Privacy Policy and ensure your inquiry forms include appropriate consent language.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Section id="faq" bg="muted" border innerClassName="max-w-3xl mx-auto px-4 sm:px-6 md:px-12">
      <SectionHeader label="FAQ" heading="Questions we actually get asked" />
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {faqs.map((faq, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-start justify-between gap-6 py-5 text-left"
            >
              <span className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                {faq.q}
              </span>
              <span className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500">
                {open === i ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
            </button>
            {open === i && (
              <div className="pb-5">
                <p className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
