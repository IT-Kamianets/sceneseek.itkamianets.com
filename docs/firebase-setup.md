# Firebase setup

SceneSeek uses Firebase Authentication for email/password and Google accounts. The SDK is loaded only
in the browser, so the prerendered pages do not need Firebase credentials at build time.

## Configure the Firebase project

1. Create or select a Firebase project and register a Web App in Project settings.
2. In Authentication, enable the **Email/Password** and **Google** sign-in providers. Select a
   support email when enabling Google.
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
- Per-account saved scenes in Cloud Firestore

## Enable saved scenes

1. In Firebase Console, open **Build > Firestore Database** and create a database in **Production
   mode**. Choose a region in Europe that suits your users; the database location cannot be changed
   after creation.
2. Open the database's **Rules** tab and publish the rules from [`../firestore.rules`](../firestore.rules).
   They allow each signed-in user to read and change only documents under their own UID.

The app stores each saved scene at `users/{uid}/savedScenes/{sceneId}`. Search history is not yet
persisted. The production Firebase Web App configuration is set; Email/Password and authorized
domains must also be enabled in the Firebase Console.
