"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { McButton } from "@/components/mc-button";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { user, login, loading, configError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (configError) {
      setError(configError);
      return;
    }
    setPending(true);
    try {
      const r = await login(email, password);
      if (r.error) setError(r.error);
      else router.push("/dashboard");
    } finally {
      setPending(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--mc-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-4">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold text-[var(--mc-accent)]">MC</h1>
        <p className="mt-1 text-center text-sm text-[var(--mc-muted)]">
          Clinical consultation for physicians
        </p>
        {configError && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {configError}
          </p>
        )}
        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5"
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--mc-danger)]" role="alert">
              {error}
            </p>
          )}
          <McButton type="submit" variant="primary" className="w-full py-3" disabled={pending}>
            Sign in
          </McButton>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--mc-muted)]">
          No account?{" "}
          <Link href="/signup" className="font-medium text-[var(--mc-accent)] hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-8 text-center text-xs text-[var(--mc-muted)]">
          Use a Firebase project with Auth, Firestore, and Storage enabled.
        </p>
      </div>
    </div>
  );
}
