---
title: Domain Setup
type: guide
tags: [firebase, hosting, godaddy, dns]
---

# Connect `nodalx.in` to Firebase Hosting

The public brand is **NodalX**. Keep the existing Firebase project ID `nodalxai-b9eb5`: it is an infrastructure identifier, not the customer-facing name. The existing `firebaseapp.com` URL stays available after adding a custom domain.

## 1. Add the domain in Firebase

1. Open Firebase Console → project `nodalxai-b9eb5` → Hosting → **Add custom domain**.
2. Enter `nodalx.in`. Choose it as the primary domain. Also add `www.nodalx.in` and configure a redirect to `nodalx.in` if offered.
3. Copy the **exact** TXT verification record and the A/AAAA or CNAME records shown by Firebase. Do not guess the verification token or use a generic IP address in place of Firebase's current instructions.

## 2. Update GoDaddy DNS

In GoDaddy → My Products → `nodalx.in` → DNS → Manage DNS:

- Add the Firebase verification TXT record with the host/name Firebase specifies (often `@` for the apex). Paste the entire value unchanged.
- Add the Firebase-provided A/AAAA records for `@`. Remove only conflicting web-hosting or forwarding records for the same host; preserve MX, SPF, DKIM, DMARC, and other unrelated records.
- For `www`, add the CNAME or other records Firebase provides. Remove any conflicting `www` web-hosting or forwarding entry first.
- If restrictive CAA records exist, allow the certificate authorities Firebase requests. Leave CAA untouched when none exist.

Return to Firebase Hosting and select **Verify**. DNS propagation and certificate provisioning can take time. Do not change nameservers merely to connect Hosting.

## 3. Check authentication and integrations

- In Firebase Console → Authentication → Settings → Authorized domains, add `nodalx.in` and `www.nodalx.in` if both serve sign-in. Keep the Firebase default domains authorized.
- Test Google sign-in from `https://nodalx.in`. If popup or redirect sign-in fails, check the Firebase Auth Google provider's OAuth redirect configuration. A custom `authDomain` and `https://nodalx.in/__/auth/handler` redirect may be needed; make those changes together only after Hosting serves the domain.
- If any external webhook or integration uses the old public Hosting URL, update its callback to `https://nodalx.in/...` **after** the custom domain is active. Existing `firebaseapp.com` callbacks do not need immediate removal.
- Do not replace the Firebase project ID, service-account addresses, or the current contact Gmail address with a guessed new value. Switch the public contact address only after a `@nodalx.in` mailbox exists.

## 4. Build, deploy, verify

From the repository root:

```bash
npm --prefix frontend run build
firebase deploy --only hosting --project nodalxai-b9eb5
```

Open `https://nodalx.in` and verify the TLS lock, home page, sign-in, dashboard, inquiry submission, `/api` route, and `https://nodalx.in/sitemap.xml`. Check `https://www.nodalx.in` redirects to the primary domain. Rebuild and redeploy after any `VITE_` environment change.

Official references: [Firebase custom domains](https://firebase.google.com/docs/hosting/custom-domain), [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [GoDaddy A records](https://www.godaddy.com/help/add-or-edit-an-a-record-42546), and [GoDaddy TXT records](https://help-center-east.dc-aws.godaddy.com/help/add-a-txt-record-19232).
