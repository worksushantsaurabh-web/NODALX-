import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {AnalyticsPreferences} from '../components/AnalyticsConsent';

const EFFECTIVE_DATE = '1 October 2026';
const CONTACT_EMAIL = 'nodalxai@gmail.com';
const COMPANY = 'NodalX';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg text-text-primary ">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary  transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>

        <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate  max-w-none space-y-8 text-sm leading-relaxed text-text-secondary ">

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">1. Who we are</h2>
            <p>{COMPANY} ("we", "us", "our") is a business inquiry automation platform operated from India. We help business operators preserve inbound inquiries, review optional qualification results, and record follow-up actions. Responses are reviewed and sent by the operator.</p>
            <p className="mt-2">Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-text-primary text-text-secondary hover:underline">{CONTACT_EMAIL}</a></p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> your name, email address, and company name when you sign up.</li>
              <li><strong>Inquiry data:</strong> the content of business inquiries submitted through forms you configure on your site, including names, email addresses, and messages from your end-customers.</li>
              <li><strong>Usage data:</strong> actions taken inside the dashboard, feature usage, and timestamps.</li>
              <li><strong>Integration credentials:</strong> connection metadata and server-held credentials used for configured services. Google Sheets imports use a service account; Slack alerts use a webhook. Firebase manages account authentication.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">3. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the {COMPANY} platform.</li>
              <li>To qualify and route inquiries on your behalf as configured.</li>
              <li>To perform optional classification through the configured external processing workflow. Inquiry content is sent to that workflow when analysis is requested or enabled for the source.</li>
              <li>To send you product updates and important service notices (you can opt out at any time).</li>
              <li>We do <strong>not</strong> sell your data. External processing services have their own data-use and retention terms; those terms must be checked before sending sensitive content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">4. Data storage and retention</h2>
            <p>Workspace data is stored on Firebase infrastructure. A separately configured Apps Script intake can also store submissions in Google Sheets. Imported results can be exported from the dashboard. Complete account export or deletion is currently handled through a support request, after ownership verification. Backup copies have a separate retention process; ask us for the applicable schedule before supplying sensitive data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">5. Third-party services</h2>
            <p>We use the following third-party services which have their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Firebase / Google Cloud — authentication and database</li>
              <li>Configured external workflow and any model providers it uses — optional inquiry classification</li>
              <li>Google Sheets API or Apps Script — spreadsheet imports, exports or separately configured intake</li>
              <li>Slack webhook — optional notifications when configured</li>
              <li>Razorpay — subscription checkout and payment records when billing is enabled</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">6. Your rights</h2>
            <p>You have the right to access, correct, export, or delete your personal data at any time. To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-text-primary text-text-secondary hover:underline">{CONTACT_EMAIL}</a> so we can verify ownership and arrange the request.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">7. Cookies</h2>
            <p>Authentication and interface preferences use browser storage. Optional Firebase Analytics is disabled unless this deployment enables it and you choose to allow it. Analytics can use cookies and device identifiers. You can withdraw consent below; existing browser cookies may remain until you clear them.</p>
            <AnalyticsPreferences />
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">8. Changes to this policy</h2>
            <p>We may update this policy from time to time. We will notify users of material changes by email or via the dashboard. Continued use after notification constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-3">9. Contact</h2>
            <p>For any privacy-related questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} className="text-text-primary text-text-secondary hover:underline">{CONTACT_EMAIL}</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
