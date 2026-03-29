import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function readConfig() {
  return {
    apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim(),
    authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "").trim(),
  };
}

/** Auth needs apiKey, authDomain, projectId, and appId. Missing authDomain causes auth/configuration-not-found. */
export function isFirebaseConfigured(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

/** Safe to show in the UI — same values are already in the client bundle. Used to confirm Vercel built the right project. */
export function getFirebasePublicMeta(): {
  configured: boolean;
  projectId: string;
  authDomain: string;
} {
  const c = readConfig();
  return {
    configured: isFirebaseConfigured(),
    projectId: c.projectId || "—",
    authDomain: c.authDomain || "—",
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, and APP_ID (see .env.local.example)."
    );
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(readConfig());
  }
  return app;
}

export function getDb(): Firestore {
  if (db) return db;
  const firebaseApp = getFirebaseApp();
  const forceLong =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === "1";
  try {
    db = initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
      ...(forceLong ? { experimentalForceLongPolling: true } : {}),
    });
  } catch {
    db = getFirestore(firebaseApp);
  }
  return db;
}

/**
 * Prefer IndexedDB + localStorage persistence so sessions survive reloads reliably
 * (important for production hosts like Vercel; default getAuth() can be flaky in some browsers).
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  if (typeof window !== "undefined") {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      auth = getAuth(firebaseApp);
    }
  } else {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
