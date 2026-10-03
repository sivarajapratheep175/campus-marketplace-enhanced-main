import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User,
} from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserProfile } from "./userData";

function requireAuth() {
  if (!auth) {
    throw new Error(
      "Firebase is not configured. Add your Firebase Web app values to .env and restart Expo.",
    );
  }
  return auth;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    requireAuth(),
    email.trim(),
    password,
  );
  return credential.user;
}

export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    requireAuth(),
    email.trim(),
    password,
  );
  await updateProfile(credential.user, { displayName: displayName.trim() });
  await ensureUserProfile(credential.user);
  return credential.user;
}

export function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email or password is incorrect.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Could not connect to Firebase. Check your internet connection.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is disabled. Enable it in Firebase Authentication settings.";
    default:
      return error instanceof Error
        ? error.message
        : "Authentication failed. Please try again.";
  }
}
