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
    companyType: 'Businesses reviewing inbound requests',
    problem:
      'Requests spread across forms and spreadsheets make ownership and next actions difficult to track.',
    outcome:
      'Review saved inquiries in one owner workspace, record outcomes, and identify overdue follow-ups.',
    metric: { value: 'Review', label: 'in one workspace' },
  },
  {
    id: 'agency',
    persona: 'Agency owners and consultants',
    companyType: 'Service businesses doing founder-led sales',
    problem:
      'Founders are simultaneously doing the work and selling it. Inquiry emails pile up and the warmest leads go to whoever replied fastest — usually a competitor.',
    outcome:
      'Use optional classification as a review aid, while keeping final qualification and sending decisions with the founder.',
    metric: { value: 'Human', label: 'follow-up decisions' },
  },
  {
    id: 'saas-founder',
    persona: 'Early-stage SaaS founders',
    companyType: 'Product-led companies moving to sales-led',
    problem:
      'Contact forms on the marketing site collect submissions that nobody processes systematically. Some leads get a reply. Most get a template. The highest-fit ones are indistinguishable from spam.',
    outcome:
      'Connect server-side form intake, preserve original messages, and inspect processing results before acting.',
    metric: { value: 'Saved', label: 'original messages' },
  },
];
