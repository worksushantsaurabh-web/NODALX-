import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const EFFECTIVE_DATE = '11 August 2026';
const CONTACT_EMAIL = 'nodalxai@gmail.com';
const COMPANY = 'NODALxAI';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">1. Who we are</h2>
            <p>{COMPANY} ("we", "us", "our") is a business inquiry automation platform operated from India. We help businesses capture, qualify, and respond to inbound inquiries automatically.</p>
            <p className="mt-2">Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-600 dark:text-teal-400 hover:underline">{CONTACT_EMAIL}</a></p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> your name, email address, and company name when you sign up.</li>
              <li><strong>Inquiry data:</strong> the content of business inquiries submitted through forms you configure on your site, including names, email addresses, and messages from your end-customers.</li>
              <li><strong>Usage data:</strong> actions taken inside the dashboard, feature usage, and timestamps.</li>
              <li><strong>Integration credentials:</strong> OAuth tokens for Google Sheets and Slack, stored encrypted. We never store passwords.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the {COMPANY} platform.</li>
              <li>To qualify and route inquiries on your behalf as configured.</li>
              <li>To draft reply suggestions using AI — your inquiry content is sent to AI model APIs for processing.</li>
              <li>To send you product updates and important service notices (you can opt out at any time).</li>
              <li>We do <strong>not</strong> sell your data. We do <strong>not</strong> use your inquiry content to train AI models.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">4. Data storage and retention</h2>
            <p>Data is stored on Firebase (Google Cloud) infrastructure. Inquiry data is retained until you delete it from your dashboard or close your account. You can request full deletion at any time by emailing us.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">5. Third-party services</h2>
            <p>We use the following third-party services which have their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Firebase / Google Cloud — authentication and database</li>
              <li>Google Vertex AI / Gemini — AI inference for lead scoring and reply drafting</li>
              <li>Google Sheets API — if you connect a spreadsheet</li>
              <li>Slack API — if you connect a Slack workspace</li>
              <li>HubSpot — used to manage our own CRM (your sign-up details may be added)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">6. Your rights</h2>
            <p>You have the right to access, correct, export, or delete your personal data at any time. To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-600 dark:text-teal-400 hover:underline">{CONTACT_EMAIL}</a> and we will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">7. Cookies</h2>
            <p>We use only functional cookies required for authentication (Firebase session tokens). We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">8. Changes to this policy</h2>
            <p>We may update this policy from time to time. We will notify users of material changes by email or via the dashboard. Continued use after notification constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">9. Contact</h2>
            <p>For any privacy-related questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-600 dark:text-teal-400 hover:underline">{CONTACT_EMAIL}</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
