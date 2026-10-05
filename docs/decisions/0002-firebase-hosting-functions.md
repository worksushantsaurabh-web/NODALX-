# ADR 0002: Firebase production boundary

**Status:** Active, API deployment blocked
**Date:** 2026-10-01

## Context

The domain is serving Firebase Hosting. Historical docs described Vercel and a
Cloud Run backend as active, while the current API source and Hosting rewrite
target Firebase Functions.

## Decision

Firebase Hosting is the production frontend and `functions/` is the intended
production API. `backend/` is local development-only until a separate decision
changes the boundary. Apps Script is an external connector, not a browser-held
secret.

## Consequences

One deployment target reduces drift, but the Functions API requires a billing
account. During the current dispute, Hosting can release independently while
the API remains unavailable.
