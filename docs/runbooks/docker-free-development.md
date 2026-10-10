# Develop with Supabase Auth and AWS RDS, without local Docker

The default `npm run dev` starts the local Node API and Vite frontend. The browser signs in through hosted Supabase Auth. The API verifies each Supabase session, mirrors only the verified user ID and workspace-name metadata into AWS RDS, and runs application queries in the isolated `nodalx_app` database under the `authenticated` PostgreSQL role. It does not start the Supabase CLI stack or Docker.

1. Put matching hosted Supabase URL and publishable key values in the root `.env.local`: `SUPABASE_URL` / `VITE_SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`. RDS mode needs only these values for hosted Auth; the explicit `dev:cloud` mode also needs `SUPABASE_SERVICE_ROLE_KEY`. Keep that key server-only. Never put it in `frontend/.env*` or a `VITE_` variable.
2. Put the rotated RDS connection string in the gitignored root `.env.rds.local` as `RDS_DATABASE_URL`. It should target the `postgres` maintenance database on the `nodalx-db` instance, use username `postgres`, and include `sslmode=require`. Do not paste its password into commands or commit it.
3. Run `npm run check:rds` to verify credentials and TLS. Run `npm run migrate:rds` to apply tracked migrations to `nodalx_app`; the command refuses to migrate a different database and detects changed migrations. The storage migration is skipped because Supabase Storage remains hosted.
4. In hosted Supabase Auth URL configuration, allow `http://127.0.0.1:5173/auth/callback` for local confirmation, recovery, and OAuth redirects.
5. Run `npm run dev`, then open `http://127.0.0.1:5173`. The API runs on `127.0.0.1:5000`; Vite proxies `/api` requests to it.

The development command disables intake, processing, Make, and outbound email feature gates. This prevents local browsing from triggering those external integrations. `npm run dev:cloud` is an explicit hosted-Supabase database fallback, while `npm run dev:supabase` and `npm run test:supabase` are explicit local-stack commands for isolated database tests.

The existing `postgres` database and earlier partial restore are left untouched. The application schema lives in `nodalx_app`. Hosted Supabase Auth is the source of truth for identity; the RDS `auth.users` table is a minimal server-owned mirror used by the existing foreign keys and SQL functions. The server verifies the bearer token with hosted Supabase Auth on each authenticated request before setting the RDS session claim. Never accept a user ID or workspace ID from the client as that claim.

This local setup does not change the deployed application's environment. Set `DATA_BACKEND=rds` and `RDS_DATABASE_URL` in the deployment's server-only secret manager when deploying this backend, and run the RDS migrations before routing production traffic. Check network reachability from the deployment runtime, TLS verification, and RDS connection capacity before switching traffic.
