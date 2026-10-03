import { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { db, storage } from "./firebase";
import { defaultUserSettings, UserSettings } from "./settings";

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  campus: string;
  settings: UserSettings;
};

export async function ensureUserProfile(user: User): Promise<void> {
  if (!db) return;
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const identity = {
    uid: user.uid,
    displayName:
      user.displayName || user.email?.split("@")[0] || "Campus student",
    email: user.email || "",
    updatedAt: serverTimestamp(),
  };

  if (profileSnapshot.exists()) {
    const data = profileSnapshot.data();
    await setDoc(
      profileRef,
      {
        ...identity,
        ...(typeof data.createdAt === "undefined"
          ? { createdAt: serverTimestamp() }
          : {}),
        ...(typeof data.photoURL === "undefined"
          ? { photoURL: user.photoURL || null }
          : {}),
        ...(typeof data.campus === "string" ? {} : { campus: "North Campus" }),
        ...(data.settings && typeof data.settings === "object"
          ? {
              settings: {
                ...(data.settings.theme === "light" ||
                data.settings.theme === "dark"
                  ? {}
                  : { theme: defaultUserSettings.theme }),
                ...(data.settings.currency === "USD" ||
                data.settings.currency === "LKR"
                  ? {}
                  : { currency: defaultUserSettings.currency }),
              },
            }
          : { settings: defaultUserSettings }),
      },
      { merge: true },
    );
    return;
  }

  await setDoc(profileRef, {
    ...identity,
    createdAt: serverTimestamp(),
    photoURL: user.photoURL || null,
    campus: "North Campus",
    settings: defaultUserSettings,
  });
}

export async function saveUserSettings(
  uid: string,
  settings: Partial<UserSettings>,
): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const fields: Record<string, string | number> = {};
  if (settings.theme) fields["settings.theme"] = settings.theme;
  if (settings.currency) fields["settings.currency"] = settings.currency;
  if (settings.exchangeRate !== undefined) {
    fields["settings.exchangeRate"] = settings.exchangeRate;
  }
  if (settings.exchangeRateUpdatedAt !== undefined) {
    fields["settings.exchangeRateUpdatedAt"] = settings.exchangeRateUpdatedAt;
  }
  await updateDoc(doc(db, "users", uid), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export async function saveProfilePhoto(
  uid: string,
  base64: string,
  contentType: string,
): Promise<string> {
  if (!db || !storage) throw new Error("Firebase Storage is not configured.");
  const photoRef = ref(storage, `users/${uid}/profile/profile-photo`);
  await uploadString(photoRef, base64, "base64", { contentType });
  const photoURL = await getDownloadURL(photoRef);
  await updateDoc(doc(db, "users", uid), {
    photoURL,
    updatedAt: serverTimestamp(),
  });
  return photoURL;
}

/**
 * Uploads a listing product image to Firebase Storage and returns its download URL.
 * Falls back to returning the base64 data URI if Storage is not configured.
 */
export async function saveListingPhoto(
  uid: string,
  listingId: string,
  base64: string,
  contentType: string,
): Promise<string> {
  if (!storage) {
    // Fallback: return a data URI so listings still work without Firebase Storage
    return `data:${contentType};base64,${base64}`;
  }
  const photoRef = ref(
    storage,
    `listings/${uid}/${listingId}/product-photo`,
  );
  await uploadString(photoRef, base64, "base64", { contentType });
  const downloadURL = await getDownloadURL(photoRef);
  return downloadURL;
}
