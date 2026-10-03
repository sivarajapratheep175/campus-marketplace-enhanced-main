import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Listing } from "./types";

export async function createListing(listing: Listing): Promise<string> {
  if (!db) throw new Error("Firebase is not configured.");
  const reference = await addDoc(collection(db, "listings"), {
    ...listing,
    createdAt: serverTimestamp(),
  });
  return reference.id;
}

export async function markListingAsSold(
  listingId: string,
  sellerId: string,
): Promise<void> {
  if (!db) return;
  const listingRef = doc(db, "listings", listingId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    if (!snapshot.exists()) throw new Error("This listing no longer exists.");
    const listing = snapshot.data();
    if (listing.sellerId !== sellerId) {
      throw new Error("Only the seller can update this listing.");
    }
    if (listing.status === "sold") {
      throw new Error("This listing has already been sold.");
    }
    if (listing.status && listing.status !== "available") {
      throw new Error("This listing is not currently available.");
    }
    transaction.update(listingRef, {
      status: "sold",
      updatedAt: serverTimestamp(),
    });
  });
}
