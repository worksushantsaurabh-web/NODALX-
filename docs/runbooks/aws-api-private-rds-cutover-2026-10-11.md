# AWS API and private RDS cutover

Status: discovery complete; no infrastructure or application change authorized by this document.

## Verified baseline (11 October 2026)

- AWS account `560246495281`, region `us-east-1`.
- `nodalx-db` is PostgreSQL 18.3, `db.t3.micro`, 20 GiB gp2, single AZ `us-east-1b`, in VPC `vpc-07d2b58b0ef6b06c8`.
- RDS has `PubliclyAccessible=true`. Security group `sg-0333a50a7f3d10246` allows TCP 5432 from `0.0.0.0/0` and one `/32` address. No source security-group rule exists.
- This VPC has six default public subnets, no EC2 instances and no NAT gateway.
- AWS Billing `get-credits` shows five enabled credits: $100 + four $20 credits. All list EC2, RDS, VPC, API Gateway and Lambda as applicable products and expire 2 October 2027. The API reports $180 remaining and approximately $178.21 estimated after pending application. This is a credit balance, not a permanent free tier or a cost estimate. Cost Explorer's current-month service totals are estimated and nearly zero, so they do not establish post-credit monthly spend.
- The AWS CLI profile `nodalx-console` currently authenticates as the account root principal. Use it only for read-only discovery; create a least-privilege deployment identity before writes. Never store root access keys in the repository or on a server.
- Root MFA is enabled; IAM has zero users and six roles. The account is not in AWS Organizations; an IAM Identity Center account instance would not provide AWS account permission sets. The old `default` SSO profile is stale. Establish a non-root IAM console operator with MFA and a separately scoped deployment role before provisioning; use an EC2 instance role instead of AWS keys on the server.
- Two monthly $1 budgets with actual/forecast alerts already exist. Do not create a duplicate. Verify that alerts reach the owner; credit-covered estimated Cost Explorer values near zero are not post-credit cost projections.
- The live browser API runs as Vercel handlers in `api/*.mjs`, with a catch-all route in `api/migration.mjs`. Hosted Supabase Auth and Resend require outbound HTTPS. `server/rds-client.mjs` uses `pg` and the AWS trust bundle. The frontend is a static Vite build on Vercel.

## Decision to validate before provisioning

For this low-traffic application, evaluate one small EC2 instance in the existing RDS VPC as the first API runtime. It can use the VPC's private route to RDS and its own outbound internet path to Supabase Auth and Resend, without a continuously billed NAT gateway. Compare actual EC2, EBS, public IPv4, transfer, monitoring and backup prices with Lambda + API Gateway + VPC NAT before committing. The instance introduces operating-system patching, process supervision and a single-host availability risk. A two-AZ managed design may be preferable when traffic or availability requirements grow.

AWS Price List returned `t4g.micro` at $0.0084/hour (about $6.13 per 730-hour month) and `t4g.small` at $0.0168/hour (about $12.26/month) for Linux shared tenancy in N. Virginia. A 20 GiB gp3 root disk at the published $0.08/GiB-month example rate adds about $1.60/month; one public IPv4 at $0.005/hour adds about $3.65/month. Estimated incremental API cost is therefore about $11.38/month for micro or $17.51/month for small, before transfer, snapshots, monitoring, tax, discounts, credits or free-tier treatment. Existing RDS costs are separate. `t4g.small` (2 GiB RAM) is the initial candidate; measure memory before downsizing. Managed NAT at $0.045/hour is about $32.85/month before processing and transfer charges.

Local code preparation has begun: `server/aws-api-http.mjs` adapts the deployed Vercel handlers to Node HTTP while leaving raw Resend webhook bytes intact, and `scripts/start-aws-api.mjs` binds only to loopback. `npm run build:aws-api` creates a 27-file allowlisted package in ignored `aws/build/api`; it does not include secrets or dependencies. The adapter is tested locally, but no TLS proxy or live API service exists yet.

Do not deploy the existing Vercel handlers directly as a public service. Build and test an HTTP adapter that preserves request body parsing, headers, status codes, routes, method behavior, CORS, webhook signatures, and failure gates. Prefer one API origin and a Vercel rewrite so browser calls remain same-origin. Verify Vercel supports the chosen external rewrite behavior before cutover.

## Reversible sequence

1. **Account and cost:** inspect Billing credits/expiry, current RDS charges, EC2 and network prices; create a budget alert. Establish least-privilege deployment credentials and a patch/backup owner. Confirm the target instance size, region, AZ, EBS size, and expected monthly cost after credits.
2. **Code preparation:** inventory every deployed `/api/*` route and Vercel-specific assumption. Implement the Node HTTP adapter, tests for authentication and critical routes, health and graceful shutdown. Keep feature flags and server-only secrets. Package the exact allowlisted files; do not copy `.env` files.
3. **Parallel AWS deployment:** create an API security group and an instance in the RDS VPC. Expose HTTPS only; restrict administrative access. Add an RDS ingress rule sourced from the API security group while temporarily retaining the current public ingress needed by Vercel. Use a dedicated restricted database login instead of `postgres` for the API, with privileges verified against all app paths. Deploy behind TLS with process supervision, log rotation, resource limits, backups, and monitored health.
4. **Protected verification:** use a staging hostname or protected path. Verify Supabase sign-in, workspace reads, inquiries, website intake, inbound Resend signature/replay, outbound gates, and RDS transaction behavior. Confirm the EC2-to-RDS connection uses private VPC addresses. Run load/connection and failure-restart probes at the intended low traffic scale.
5. **API cutover:** update the Vercel same-origin API rewrite to the AWS HTTPS origin. Monitor errors, latency and database connections. Preserve the former deployment and routing as rollback targets until real traffic passes.
6. **Close the database:** only after all live API traffic uses AWS, remove `0.0.0.0/0` and stale `/32` ingress from the RDS security group. Verify arbitrary external hosts cannot connect. Then modify RDS to `PubliclyAccessible=false`, recheck private API access and health, and update maintenance access to SSM/bastion/VPN as appropriate. Treat this as a separate explicit production approval because it can interrupt the service.

## Rollback and limits

- Before step 6, rollback is the previous Vercel rewrite/deployment. Preserve its database access until the AWS route is proven.
- After step 6, the old Vercel database path will no longer work. Rollback then requires restoring a controlled temporary RDS ingress rule or repairing the AWS API; document who may do that and test the procedure before closure.
- AWS credit application and price estimates must be checked in Billing; do not infer future $0 spend from today's near-zero estimated Cost Explorer result.
- The root-authenticated CLI profile is not a deployment identity.

## Current gate

No EC2 instance, security-group rule, DNS record, secret, Vercel deployment, or RDS setting was changed in this discovery step. Review the runtime/cost choice and approve a concrete parallel deployment before provisioning.
