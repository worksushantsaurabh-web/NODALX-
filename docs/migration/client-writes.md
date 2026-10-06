# Direct Client Writes

During the Firebase to Supabase migration, these direct client writes must be replaced with authenticated API calls. Currently, they bypass the shared API client and write directly to Firestore using the client SDK.

## Inventory

| File | Line | Action | Collection/Document | Replacement API Route (Planned) |
|---|---|---|---|---|
| `frontend/components/FeedbackWidget.tsx` | 74 | `addDoc` | `feedback` | `POST /api/feedback` |
| `frontend/components/MicroSurvey.tsx` | 44 | `addDoc` | `feedback` | `POST /api/feedback` |
| `frontend/components/SignInModal.tsx` | 221 | `setDoc` | `users/{uid}` | `PUT /api/user/profile` |
| `frontend/components/SignInModal.tsx` | 338 | `setDoc` | `users/{uid}` | `PUT /api/user/profile` |
| `frontend/components/SignInModal.tsx` | 479 | `setDoc` | `users/{uid}` | `PUT /api/user/profile` |

## Migration Notes
- The `feedback` writes are currently unauthenticated or loosely authenticated. The replacement API will need to accept these submissions and safely store them in Supabase, potentially with rate limiting.
- The `users` profile writes in `SignInModal` will be replaced by the authentication and continuity logic in Phase 3. The `PUT /api/user/profile` route already exists and can be used once the session migration is complete.
