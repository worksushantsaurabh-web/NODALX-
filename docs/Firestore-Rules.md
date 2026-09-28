---
title: Firestore Rules
type: reference
tags: [firestore, security, rules, firebase, auth]
aliases: [security-rules, access-control]
---

# Firestore Rules

> File: `firestore.rules` (root)

---

## Access Matrix

| Collection | Read | Write | Notes |
|------------|------|-------|-------|
| `/users/{userId}` | Own only | Create only (tier=free) | No client updates |
| `/users/{userId}/flows/{flowId}` | Own only | Own only | User workflows |
| `/users/{userId}/profile/{profileId}` | Own only | Own only | User settings |
| `/users/{userId}/data-sources/{sourceId}` | Own only | Own only | Connected sources |
| `/apiKeys/{keyId}` | None | None | Backend-only via Admin SDK |
| `/premiumContent/{contentId}` | Tier=full only | None | Gated content |
| `/whitelisted_emails/{email}` | Auth'd (get only) | None | Email allowlist |
| `/inquiries/{inquiryId}` | None | Auth'd (create only) | Form submissions |
| `/rateLimits/{userId}` | None | None | Backend-only |

---

## Key Rules Explained

### Users can't upgrade themselves
```
allow update: if false;
```
Tier changes (`free` → `full`) happen server-side only via [[Functions]] or admin.

### Premium content gate
```
allow read: if get(/databases/.../users/{uid}).data.tier == 'full';
```
Reads the user's tier doc before granting access. This is a Firestore rule-level check.

### API Keys are invisible to clients
```
allow read, write: if false;
```
Only [[Functions]] (Admin SDK) can create/validate keys.

---

## Deploying Rule Changes

```bash
firebase deploy --only firestore:rules
```

Always test in the Firebase Console → Rules Playground before deploying.

---

## Related

- [[Functions]] — Bypasses rules via Admin SDK
- [[Architecture]] — Trust boundaries
- [[Frontend]] — What the client can/can't do
