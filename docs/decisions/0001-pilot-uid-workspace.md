# ADR 0001: UID-owned pilot workspace

**Status:** Active
**Date:** 2026-10-01

## Context

The current product has two Firebase Auth users and UID-scoped Firestore/API
records. Team membership would require a broad data and permission migration.

## Decision

For the pilot, one Firebase Auth UID owns one workspace. Team roles and invites
are explicitly out of scope.

## Alternatives considered

- Introduce organisation documents and membership roles now: rejected as too
  much unvalidated product surface for the pilot.
- Keep unauthorised shared collections: rejected because it weakens isolation.

## Consequences

The model is simple and easy to test, but it cannot support shared team access.
The future migration must add workspace IDs and membership records before team
features are advertised.
