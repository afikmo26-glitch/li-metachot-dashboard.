/**
 * The app's own server (diary-app/server), shared by everyone who installs the app.
 * Fill these in before publishing (or set them in .env.local); a server typed in Settings takes precedence.
 */
export const SERVER = {
  url: process.env.EXPO_PUBLIC_SERVER_URL ?? '',
  appKey: process.env.EXPO_PUBLIC_APP_KEY ?? '',
};

/** Google sign-in: the *web* OAuth client ID from Google Cloud (see server/README.md). */
export const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};
