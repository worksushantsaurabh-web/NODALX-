# Inquiry confirmation email polish — 5 October 2026

## Changes

- Branded HTML email with a plain-text fallback and a NodalX display name.
- A personalized greeting, saved company/service details and the actual stored
  inquiry reference. Form service keys are converted to readable labels.
- Clear next steps, an invitation to reply with workflow context and a link to
  the existing website. No booking, activation or response-time promises.
- Reply-to remains the existing configured owner inbox. The actual sender is
  still the executing Google account, not a new domain mailbox.
- Customer strings are HTML-escaped. Original inquiry messages, internal
  classification and hashes are not included in the customer email. No tracking
  images, external fonts, attachments or new provider dependencies were added.
- Existing storage, authorization, duplicate suppression and independently
  caught owner/customer email errors are unchanged.

## Checks and publication

- 27 intake/security tests pass, including injection escaping, readable service
  names, missing service, generated row reference and 500-character field cases.
  Working-tree secret scan and diff whitespace checks pass.
- Synthetic browser previews were checked at normal and mobile widths. Mobile
  document width matched its viewport, without horizontal overflow. This is not
  a certification of all Gmail/Outlook clients.
- A private pre-edit script backup was saved outside the repository. The edited
  Apps Script source matched the tested canonical file before deployment.
- The owner approved publishing. The existing live web app reports
  **Deployment successfully updated — Version 5, 5 Oct 2026, 18:15 IST**.
  Deployment URL, execute-as account, access policy, secrets and Sheet headings
  were not changed. Version 4 is available for rollback through deployments.
- No Vercel redeploy was needed: Apps Script, not the frontend server, sends
  these confirmations. The template source, tests, preview script and release
  notes are included in this Git release; pushing GitHub does not update the
  separate Apps Script deployment.
- After separate owner approval, one new labelled test operation was submitted
  to the controlled Gmail inbox. The confirmation and owner notification both
  appeared at 18:18 IST. The delivered customer email was opened and visually
  checked in Gmail: NodalX sender display name, branded header, personalized
  greeting, readable service, matching reference, next steps, website button and
  footer rendered correctly. Old received messages do not change.
- The initial public request returned 502 `INTAKE_UNAVAILABLE` after 23.534
  seconds despite successful email delivery. One identical retry, using the
  same operation key, also returned 502 after 15.648 seconds. No different test
  key was created. These are unconfirmed API responses, not proof of missing
  storage or broken duplicate protection. No new Sheet inspection was performed.
- Operation key for a future safe retry:
  `nodalx-email-design-n6xmae7p5j-20261005`. Preserve the exact original test
  payload from this conversation; changed content under this key must conflict.
- Public acknowledgement reliability was an open issue during this email-design
  check. The subsequent receipt-recovery repair is now live: three unchanged
  retries returned HTTP 202, including automatic recovery from a real Google
  receipt 404. See `intake-receipt-recovery-2026-10-05.md`. Google outages can
  still exhaust the deadline; do not describe either repair as eliminating all
  possible intake failures.

## Local preview

Run `node scripts/preview-inquiry-email.mjs` from the repository root. It renders
the canonical template with synthetic data to `/private/tmp/nodalx-inquiry-email.html`
without reading credentials, sending email or writing spreadsheet rows.
