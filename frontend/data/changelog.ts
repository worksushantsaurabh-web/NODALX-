export interface ChangelogItem {
  type: 'new' | 'improved' | 'fixed';
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  items: ChangelogItem[];
}

// ─── Releases — newest first ───────────────────────────────────────────────
// To add a new release, prepend a new entry to this array.

export const changelog: ChangelogEntry[] = [
  {
    version: '1.1',
    date: '2026-08-11',
    title: 'Onboarding wizard & design system',
    summary:
      'New users now reach their first qualified lead in under 2 minutes. A complete design system overhaul makes the dashboard and marketing site visually consistent.',
    items: [
      { type: 'new',      text: 'Step-by-step onboarding wizard — generate API key, add the snippet, and send a test inquiry in one flow.' },
      { type: 'new',      text: 'Floating feedback widget — submit bug reports, feature requests, and questions from any page.' },
      { type: 'new',      text: 'Micro-surveys after key actions — 5-star surveys fire after form submissions and onboarding completion.' },
      { type: 'new',      text: 'Privacy Policy and Terms of Service pages at /privacy and /terms.' },
      { type: 'new',      text: 'Compiled Tailwind CSS build — replaced CDN with a proper build pipeline (87 KB vs 350 KB runtime).' },
      { type: 'improved', text: 'Button and form system — all buttons, inputs, and form fields now use shared primitives with consistent focus rings, hover states, and sizes.' },
      { type: 'improved', text: 'Dashboard stat cards, status badges, and panel padding unified across all tabs.' },
      { type: 'improved', text: 'Dashboard lazy-loads as a separate chunk — initial page load is now 140 KB lighter for homepage visitors.' },
      { type: 'improved', text: 'Sign-in modal shows a loading spinner while Firebase resolves auth state on return visits.' },
      { type: 'fixed',    text: 'Stray script tag in index.html was firing a 404 error on every page load.' },
      { type: 'fixed',    text: 'Primary buttons on ClosingCTA and Footer now hover darker (teal-700), not lighter.' },
      { type: 'fixed',    text: 'ProcessTimeline heading and label were invisible in dark mode.' },
      { type: 'fixed',    text: 'CustomerOnboarding silently swallowed API key generation and name update errors — both now surface visible messages.' },
      { type: 'fixed',    text: 'Vertex AI proxy shim no longer logs to the browser console in production.' },
    ],
  },
  {
    version: '1.0',
    date: '2026-08-01',
    title: 'Launch',
    summary:
      'NODALxAI is live. Connect a contact form, qualify leads automatically, and send AI-drafted replies in minutes.',
    items: [
      { type: 'new', text: 'Embeddable inquiry form widget — one script tag, works on any site.' },
      { type: 'new', text: 'AI lead qualification — each submission scored against your criteria with a written explanation.' },
      { type: 'new', text: 'Reply drafting — context-aware draft replies generated for every qualified inquiry.' },
      { type: 'new', text: 'Live pipeline dashboard — inquiry queue, qualification scores, response times.' },
      { type: 'new', text: 'Google Sheets integration — every lead and reply syncs automatically.' },
      { type: 'new', text: 'Slack notifications — get alerted on high-fit leads.' },
      { type: 'new', text: 'Google, email, and phone sign-in.' },
      { type: 'new', text: 'API key generation — connect any external form in under 15 minutes.' },
    ],
  },
];
