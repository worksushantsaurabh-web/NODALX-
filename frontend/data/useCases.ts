// Use-case cards for the homepage social proof section.
//
// These describe buyer personas and outcomes — not fabricated customer quotes.
// When you have a real case study, add a `caseStudy` field with the actual
// customer data. The component will render it differently once populated.

export interface UseCase {
  id: string;
  persona: string;
  companyType: string;
  problem: string;
  outcome: string;
  metric: { value: string; label: string };
  // Populate with real data once you have a case study
  caseStudy?: {
    company: string;
    quote: string;
    author: string;
    role: string;
  };
}

export const useCases: UseCase[] = [
  {
    id: 'sales-ops',
    persona: 'Sales and ops teams',
    companyType: 'B2B companies with 50–500 employees',
    problem:
      'Manual inquiry triage eats 2+ hours a day. Qualified leads wait hours for a reply. Deals go cold before anyone reads the message.',
    outcome:
      'Every submission is scored, routed to the right person, and replied to within minutes — without adding headcount.',
    metric: { value: '< 3 min', label: 'average first response' },
  },
  {
    id: 'agency',
    persona: 'Agency owners and consultants',
    companyType: 'Service businesses doing founder-led sales',
    problem:
      'Founders are simultaneously doing the work and selling it. Inquiry emails pile up and the warmest leads go to whoever replied fastest — usually a competitor.',
    outcome:
      'AI handles first-touch qualification and reply drafting. Founders review and approve. The pipeline runs without them watching it.',
    metric: { value: '15 min', label: 'setup time' },
  },
  {
    id: 'saas-founder',
    persona: 'Early-stage SaaS founders',
    companyType: 'Product-led companies moving to sales-led',
    problem:
      'Contact forms on the marketing site collect submissions that nobody processes systematically. Some leads get a reply. Most get a template. The highest-fit ones are indistinguishable from spam.',
    outcome:
      'High-fit leads are identified, scored, and replied to before a human reads them. Low-fit leads get a polite, automated response. No more guessing.',
    metric: { value: '94%', label: 'qualification accuracy (beta)' },
  },
];
