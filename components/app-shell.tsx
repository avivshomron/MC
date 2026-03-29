"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { McButton } from "@/components/mc-button";
import { NotificationsBell } from "@/components/notifications-bell";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--mc-border)] bg-[var(--mc-surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-[var(--mc-accent)]"
          >
            MC
          </Link>
          <nav className="flex items-center gap-2">
            <NotificationsBell />
            <Link
              href="/profile"
              className="text-sm text-[var(--mc-muted)] hover:text-[var(--mc-text)]"
            >
              Profile
            </Link>
            <McButton
              variant="ghost"
              className="!py-1.5 !px-2 text-sm"
              onClick={() => {
                void logout().then(() => router.push("/login"));
              }}
            >
              Sign out
            </McButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
