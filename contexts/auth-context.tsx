"use client";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Specialty } from "@/lib/constants";
import {
  getDb,
  getFirebaseAuth,
  getFirebasePublicMeta,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import {
  ensureUserDocumentIfMissing,
  fetchUserProfile,
  updateUserSpecialty,
  userProfileFromAuth,
} from "@/lib/local-db";
import type { UserProfile } from "@/lib/types";

/** Load Firestore profile; create doc if missing; last resort in-memory profile so login can finish. */
async function resolveUserProfile(u: FirebaseUser): Promise<UserProfile | null> {
  if (!u.email) {
    try {
      await u.reload();
    } catch {
      /* ignore */
    }
  }

  let profile = await fetchUserProfile(u.uid);
  if (profile) return profile;

  const email = u.email;
  if (email) {
    try {
      await ensureUserDocumentIfMissing(
        u.uid,
        email,
        u.displayName || email.split("@")[0] || "User"
      );
      profile = await fetchUserProfile(u.uid);
      if (profile) return profile;
    } catch {
      /* Firestore may be denied or offline */
    }
    return userProfileFromAuth(u.uid, email, u.displayName);
  }
  return null;
}

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Invalid email.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/operation-not-allowed":
      return "Email/password is turned off in Firebase. In the Firebase Console go to Authentication → Sign-in method → enable Email/Password.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/configuration-not-found":
      return "Firebase Auth has no usable config for this app. Fix: (1) Firebase Console → Build → Authentication → open the tab once (Get started) → Sign-in method → enable Email/Password. (2) Google Cloud Console (same project) → APIs & Services → Library → enable Identity Toolkit API. (3) In `.env.local`, copy apiKey, authDomain, projectId, and appId from the same Firebase web app config, then restart `npm run dev`.";
    case "auth/unauthorized-domain":
      return "This website domain is not allowed to use Firebase Auth. In Firebase Console → Authentication → Settings → Authorized domains, add your production URL (e.g. your-app.vercel.app and any custom domain), save, then try again.";
    case "auth/invalid-api-key":
      return "Invalid Firebase API key. Copy the Web API key from the same Firebase project as projectId in Firebase Console → Project settings → General → Your apps, update Vercel env NEXT_PUBLIC_FIREBASE_API_KEY, then redeploy.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** Auth + Firestore errors during sign-up (setDoc can throw permission-denied, etc.). */
function formatSignupError(e: unknown): string {
  if (!e || typeof e !== "object" || !("code" in e)) {
    return "Something went wrong. Try again.";
  }
  const err = e as { code: string; message?: string };
  const code = String(err.code);
  const authMsg = mapAuthError(code);
  if (authMsg !== "Something went wrong. Try again.") {
    return authMsg;
  }
  switch (code) {
    case "permission-denied":
      return "Firestore blocked saving your profile. Deploy the rules in this repo (firestore.rules) from Firebase Console → Firestore → Rules, or use the CLI: firebase deploy --only firestore:rules.";
    case "unavailable":
      return "Firestore is temporarily unavailable. Try again in a moment.";
    default:
      if (process.env.NODE_ENV === "development" && err.message) {
        return `${err.message} (${code})`;
      }
      return `Sign-up failed (${code}). Check the browser console, Firebase Auth (Email/Password on), and Firestore rules.`;
  }
}

type AuthContextValue = {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  configError: string | null;
  /** Confirms which Firebase project the deployed bundle uses (public metadata only). */
  firebaseMeta: ReturnType<typeof getFirebasePublicMeta>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (input: {
    email: string;
    password: string;
    name: string;
    specialty: Specialty;
  }) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSpecialty: (s: Specialty) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  /** Ignores stale async work when auth changes again before profile resolution finishes. */
  const authStateSeq = useRef(0);

  const refreshUser = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) {
      setUser(null);
      return;
    }
    const profile = await resolveUserProfile(u);
    setUser(profile);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setConfigError(
        "Firebase is not configured. In `.env.local` set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID (copy the whole firebaseConfig from Firebase Console → Project settings → Your apps → Web). Missing AUTH_DOMAIN causes auth/configuration-not-found. Restart `npm run dev` after saving."
      );
      setLoading(false);
      return;
    }
    setConfigError(null);
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      const seq = ++authStateSeq.current;
      setFirebaseUser(u);
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Keep loading true until Firestore profile is loaded. Otherwise RequireAuth sees
      // user=null + loading=false (brief gap) and redirects to /login while Auth succeeded.
      setLoading(true);
      try {
        const profile = await resolveUserProfile(u);
        if (seq !== authStateSeq.current) return;
        setUser(profile);
      } catch {
        if (seq !== authStateSeq.current) return;
        setUser(userProfileFromAuth(u.uid, u.email, u.displayName));
      } finally {
        if (seq === authStateSeq.current) setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isFirebaseConfigured()) {
      return { error: "Firebase is not configured." };
    }
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      return {};
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      return { error: mapAuthError(code) };
    }
  }, []);

  const signup = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      specialty: Specialty;
    }) => {
      if (!isFirebaseConfigured()) {
        return { error: "Firebase is not configured." };
      }
      let cred: UserCredential | null = null;
      try {
        const auth = getFirebaseAuth();
        cred = await createUserWithEmailAndPassword(
          auth,
          input.email.trim().toLowerCase(),
          input.password
        );
        await setDoc(doc(getDb(), "users", cred.user.uid), {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          specialty: input.specialty,
          isVerified: false,
          createdAt: serverTimestamp(),
        });
        const profile =
          (await fetchUserProfile(cred.user.uid)) ??
          userProfileFromAuth(cred.user.uid, cred.user.email, input.name);
        if (profile) setUser(profile);
        return {};
      } catch (e: unknown) {
        console.error("[MC signup]", e);
        if (cred?.user) {
          try {
            await deleteUser(cred.user);
          } catch {
            /* ignore rollback failure */
          }
        }
        return { error: formatSignupError(e) };
      }
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setUser(null);
      return;
    }
    await signOut(getFirebaseAuth());
    setUser(null);
  }, []);

  const setSpecialty = useCallback(
    async (s: Specialty) => {
      if (!isFirebaseConfigured()) return;
      const auth = getFirebaseAuth();
      const u = auth.currentUser;
      if (!u) return;
      await updateUserSpecialty(u.uid, s);
      await refreshUser();
    },
    [refreshUser]
  );

  const firebaseMeta = useMemo(() => getFirebasePublicMeta(), []);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      loading,
      configError,
      firebaseMeta,
      login,
      signup,
      logout,
      refreshUser,
      setSpecialty,
    }),
    [user, firebaseUser, loading, configError, firebaseMeta, login, signup, logout, refreshUser, setSpecialty]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
