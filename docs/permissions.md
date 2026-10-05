# NODALxAI permissions

## Pilot policy

The effective pilot role is **Owner**: one Firebase Auth UID owns one workspace.
Authorization is enforced in the API and Firestore rules. Hiding a control in
the frontend is never a permission boundary.

| Action | Owner | Future Admin | Future Member | Future Viewer |
|---|---:|---:|---:|---:|
| Read workspace records | Yes | Yes | Yes | Yes |
| Create inquiry through owned source | Yes | Yes | No | No |
| Update inquiry status/notes | Yes | Yes | Yes | No |
| Configure sources | Yes | Yes | No | No |
| Configure qualification criteria | Yes | Yes | No | No |
| Generate/revoke API keys | Yes | Yes | No | No |
| View usage | Yes | Yes | Yes | Yes |
| Change plan/cancel billing | Yes | No | No | No |
| Change membership | Yes | No | No | No |
| Read another workspace | No | No | No | No |
| Change entitlement/quota/subscription | No client role | No | No | No |

## Authorization rules

- Verify the Firebase ID token at the API boundary.
- Derive the owner UID from the verified token, never from a request body.
- Read or mutate only records whose stored owner is that UID.
- Return `404` for another owner's resource to avoid resource enumeration.
- Firestore client rules deny direct inquiry, API-key, rate-limit, profile and
  data-source writes; Admin SDK routes perform controlled mutations.
- Every new route must include an authorization test for unauthenticated,
  owner and cross-owner requests.
