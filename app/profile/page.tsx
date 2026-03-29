"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { McCard } from "@/components/mc-card";
import { useAuth } from "@/contexts/auth-context";
import { SPECIALTIES } from "@/lib/constants";
import type { Specialty } from "@/lib/constants";
import { computeProfileStats, subscribeMyAnswers } from "@/lib/local-db";
import type { Answer } from "@/lib/types";

export default function ProfilePage() {
  const { user, setSpecialty } = useAuth();
  const [myAnswers, setMyAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeMyAnswers(user.id, setMyAnswers, console.error);
  }, [user]);

  const stats = useMemo(
    () => (user ? computeProfileStats(myAnswers, user.id) : null),
    [user, myAnswers]
  );

  if (!user) return null;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[var(--mc-muted)] hover:text-[var(--mc-text)]"
      >
        ← Dashboard
      </Link>
      <h1 className="text-xl font-semibold text-[var(--mc-text)]">Profile</h1>
      <p className="mt-1 text-sm text-[var(--mc-muted)]">
        Trust-focused summary — no social metrics.
      </p>

      <McCard className="mt-6 p-5">
        <p className="text-sm text-[var(--mc-muted)]">Name</p>
        <p className="text-lg font-medium text-[var(--mc-text)]">{user.name}</p>
        <p className="mt-4 text-sm text-[var(--mc-muted)]">Specialty</p>
        <select
          value={user.specialty}
          onChange={(e) => void setSpecialty(e.target.value as Specialty)}
          className="mt-1 w-full max-w-md rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2 text-[var(--mc-text)]"
        >
          {SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-[var(--mc-muted)]">
          Used to match cases in your field and route notifications.
        </p>

        {user.isVerified ? (
          <p className="mt-4 text-sm text-[var(--mc-muted)]">Verified clinician</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--mc-muted)]">Verification: not verified yet</p>
        )}

        {stats && (
          <div className="mt-6 border-t border-[var(--mc-border)] pt-6">
            <div className="rounded-xl border border-[var(--mc-accent)]/30 bg-[var(--mc-accent)]/5 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-accent)]">
                Impact score
              </p>
              <p className="mt-1 text-3xl font-bold text-[var(--mc-text)]">{stats.impactScore}</p>
              <p className="mt-1 text-xs text-[var(--mc-muted)]">
                Total answers + (2 × answers marked most helpful)
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-semibold text-[var(--mc-text)]">{stats.casesHelped}</p>
                <p className="text-sm text-[var(--mc-muted)]">Cases helped</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--mc-text)]">
                  {stats.answersMarkedHelpful}
                </p>
                <p className="text-sm text-[var(--mc-muted)]">Marked helpful</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--mc-text)]">{stats.totalAnswers}</p>
                <p className="text-sm text-[var(--mc-muted)]">Total answers</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--mc-text)]">
                  {stats.totalUpvotesReceived}
                </p>
                <p className="text-sm text-[var(--mc-muted)]">Upvotes received</p>
              </div>
            </div>
          </div>
        )}
      </McCard>

      <div className="mt-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-4 py-2.5 text-sm font-medium text-[var(--mc-text)] hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
