# Firebase setup

SceneSeek uses Firebase Authentication for email and password accounts. The SDK is loaded only
in the browser, so the prerendered pages do not need Firebase credentials at build time.

## Configure the Firebase project

1. Create or select a Firebase project and register a Web App in Project settings.
2. In Authentication, enable the **Email/Password** sign-in provider.
3. Add the production domain and any local development domain to Authentication's authorized
   domains (for example, `sceneseek.itkamianets.com` and `localhost`).
4. Copy the Web App's `apiKey`, `authDomain`, `projectId`, and `appId` values into the
   `firebase` object in `src/environments/environment.prod.ts`.
5. For local development, use the same fields in `src/environments/environment.ts` if you want
   to use a separate Firebase project. That file currently inherits the production settings.

These Firebase web configuration values identify the Firebase app; they are not server secrets.
Never place service-account credentials or Admin SDK private keys in the browser app.

## Current integration

- Email and password registration and sign-in
- Local browser auth persistence and signed-in profile details
- Password reset email with a non-enumerating confirmation message
- Sign-out and return to the originally requested History or Saved page
- Friendly handling for common Firebase Auth errors

History and Saved content are not persisted to Firestore yet. Their data model and access rules
should be decided before adding database writes. The production Firebase Web App configuration
is now set; authentication still requires the Email/Password provider and authorized domains above
to be enabled in the Firebase Console.
