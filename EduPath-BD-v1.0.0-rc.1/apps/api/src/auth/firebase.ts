import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "../config.js";

export type VerifiedFirebaseIdentity = {
  firebaseUid: string;
  email: string;
  phone?: string;
  displayName?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

function ensureFirebaseApp() {
  if (getApps().length) return getApps()[0];
  if (!config.firebaseProjectId) throw new Error("Firebase Admin is not configured.");

  const credential = config.firebaseServiceAccountJson
    ? cert(JSON.parse(config.firebaseServiceAccountJson))
    : applicationDefault();

  return initializeApp({ credential, projectId: config.firebaseProjectId });
}

export async function verifyFirebaseIdentity(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const decoded = await getAuth(ensureFirebaseApp()).verifyIdToken(idToken, true);
  if (!decoded.email && !decoded.phone_number) throw new Error("A Firebase email or phone identity is required.");
  const email = decoded.email ?? `${decoded.uid}@phone.edupath.invalid`;

  return {
    firebaseUid: decoded.uid,
    email,
    phone: decoded.phone_number,
    displayName: typeof decoded.name === "string" ? decoded.name : undefined,
    emailVerified: decoded.email_verified === true,
    phoneVerified: Boolean(decoded.phone_number)
  };
}
