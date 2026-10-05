# AWS intake pilot

This is a local, dependency-free replacement candidate for public contact intake
only. It does **not** migrate Firebase Auth, Firestore, dashboard APIs or workers.
Nothing has been provisioned or deployed.

From the repository root:

```sh
npm run test:intake
npm run build:aws-intake
```

`template.json` expects the generated `build/intake/` bundle and an existing
owner-approved Secrets Manager ARN. Never package the entire checkout.

Read [the staged migration runbook](../docs/runbooks/aws-migration.md) before
deployment. Account/region verification, cost approval, SAM validation, real
provider checks and abuse prevention are required. Keep current Firebase
resources until the complete workspace migration and rollback are verified.
