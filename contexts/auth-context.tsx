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
  useState,
} from "react";
import type { Specialty } from "@/lib/constants";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { fetchUserProfile, updateUserSpecialty } from "@/lib/local-db";
import type { UserProfile } from "@/lib/types";

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  for (let i = 0; i < 6; i++) {
    const p = await fetchUserProfile(uid);
    if (p) return p;
    await new Promise((r) => setTimeout(r, 200));
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

  const refreshUser = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) {
      setUser(null);
      return;
    }
    const profile = await loadUserProfile(u.uid);
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
      setFirebaseUser(u);
      if (!u) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const profile = await loadUserProfile(u.uid);
        setUser(profile);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
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
        const profile = await fetchUserProfile(cred.user.uid);
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

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      loading,
      configError,
      login,
      signup,
      logout,
      refreshUser,
      setSpecialty,
    }),
    [user, firebaseUser, loading, configError, login, signup, logout, refreshUser, setSpecialty]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
