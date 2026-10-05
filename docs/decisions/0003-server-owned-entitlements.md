# ADR 0003: Server-owned entitlements

**Status:** Active
**Date:** 2026-10-01

## Context

Client-writable profile metadata and subscription labels had previously been
able to influence paid access.

## Decision

Only `users/{uid}.tier`, written by server-side redemption or administration,
determines entitlement. Subscription, plan, API key, quota and usage fields are
server-owned metadata.

## Consequences

Client profile updates must use API allowlists and Firestore rules deny direct
writes. Billing state cannot grant access until a verified server-side event
updates the canonical entitlement.
