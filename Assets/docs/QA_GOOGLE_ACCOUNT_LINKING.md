# Google Account Linking (Manual Test)

Goal: Ensure Google OAuth links to an existing password account with the same email (no duplicate users).

## Preconditions
- Google OAuth configured and reachable.
- Access to admin view or DB to verify user count.

## Steps
1. Register a user via email + password (e.g. `linking.test@example.com`).
2. Confirm the user exists exactly once (Admin panel or DB query).
3. Sign in with Google using the same email address.
4. Verify:
   - Login succeeds and loads the app.
   - No second user record is created for the same email.
   - The existing user is marked `email_verified=true`.

## Expected Result
- Only one user row exists for the email.
- The same user ID is used before and after Google login.
