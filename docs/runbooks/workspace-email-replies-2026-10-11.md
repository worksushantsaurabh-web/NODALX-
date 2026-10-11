# Workspace email replies — staged implementation (11 October 2026)

The managed identity is `<alias>@reply.nodalx.in`. Each workspace receives a
server-generated alias; the owner can change it explicitly once per 24 hours.
The old alias is retained for inbound replies and cannot be claimed again.
The dashboard shows the address and received messages. A reply is attached to
an inquiry only when its `In-Reply-To` matches the RFC Message-ID of a sent
email and its sender matches the stored recipient; other messages remain in
the workspace inbox for manual review. All content is
treated as untrusted text. The original inquiry is never overwritten.

The sender uses the managed address as both `From` and `Reply-To` only when
`WORKSPACE_INBOUND_ENABLED=true`, `WORKSPACE_INBOUND_RECEIVING_ENABLED=true`,
and `WORKSPACE_EMAIL_DOMAIN=reply.nodalx.in`. These switches are off by default.
The signed `email.received` webhook has a separate receiving switch and records
messages idempotently through a service-only database function.

## Before activation

1. Verify `reply.nodalx.in` for sending and receiving in Resend. Confirm its
   MX records without altering the existing `nodalx.in` mail route.
2. Configure the `email.received` webhook to `/api/resend-inbound` and store its
   signing secret as a server-only environment variable.
3. Apply the reviewed migration to the live RDS database and deploy the matching
   application in a Preview. Keep both switches false.
4. Enable the receiving switch in Preview, send a labelled real test email to
   a test workspace alias, and confirm the message appears once in that
   workspace and in no other workspace. Test a reply to an old alias too.
5. Verify a sent message's `From`, `Reply-To`, provider acceptance, actual
   inbox delivery, and a lead's Reply returning to the same workspace. Only
   then enable managed sending. Repeat in Production after owner approval.

## Known limits

- The reviewed migration is applied to live RDS `nodalx_app` (11 October 2026).
  Resend verified all five Cloudflare DNS records for `reply.nodalx.in`; the
  existing root mail route stayed intact. Protected Preview deployment
  `dpl_B6HtAda83ZK3tvmw7jzpXLWLC6Bc` processed one labelled real inbound
  message through a signed Resend webhook into the correct RDS workspace inbox.
  Resend reported webhook success and replay left exactly one inbox row. The
  temporary Preview webhook and access bypass were removed afterward, along
  with the branch-scoped signing secret and receiving switch. Managed sending
  remains off. A dashboard outbound message and its actual lead reply have
  not been tested; Production application code has not been deployed.
- An old alias has not been exercised with live mail because the only live
  workspace has never changed its alias. SQL tests cover retention and routing.
- Received messages are displayed as text. Attachments are not surfaced in
  the dashboard yet. The inbox has manual refresh rather than notifications.
- A provider failure to return the sent RFC Message-ID leaves later replies
  in the workspace inbox instead of claiming an unverified thread match.
- Customers with a custom domain can use the NodalX address now. Sending from
  their own domain requires a separate verification and integration flow later;
  merely owning a domain does not authorize NodalX to send from it.
