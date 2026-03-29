"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CaseCard } from "@/components/case-card";
import { McCard } from "@/components/mc-card";
import { useAuth } from "@/contexts/auth-context";
import { sortCasesByEngagement, subscribeCases, subscribeMyAnswers } from "@/lib/local-db";
import type { Answer, Case } from "@/lib/types";

function Section({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
        {title}
      </h2>
      {children}
      {empty && <p className="text-sm text-[var(--mc-muted)]">{empty}</p>}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [myAnswers, setMyAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    const unsubCases = subscribeCases(setCases, console.error);
    return () => unsubCases();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMyAnswers(user.id, setMyAnswers, console.error);
    return () => unsub();
  }, [user]);

  const answeredCaseIds = useMemo(
    () => new Set(myAnswers.map((a) => a.caseId)),
    [myAnswers]
  );

  const openCases = useMemo(() => {
    if (!user) return [];
    return sortCasesByEngagement(
      cases.filter((c) => c.createdBy === user.id && c.answerCount === 0)
    );
  }, [cases, user]);

  const inField = useMemo(() => {
    if (!user) return [];
    return sortCasesByEngagement(
      cases.filter((c) => c.specialty === user.specialty && c.createdBy !== user.id)
    );
  }, [cases, user]);

  const yourOpened = useMemo(() => {
    if (!user) return [];
    return sortCasesByEngagement(cases.filter((c) => c.createdBy === user.id));
  }, [cases, user]);

  const yourAnswered = useMemo(() => {
    if (!user) return [];
    return sortCasesByEngagement(cases.filter((c) => answeredCaseIds.has(c.id)));
  }, [cases, user, answeredCaseIds]);

  if (!user) return null;

  return (
    <div>
      <p className="mb-6 text-sm text-[var(--mc-muted)]">
        Case → help → answer → outcome. No feed—just your work.
      </p>

      <div className="mb-8 flex justify-center">
        <Link
          href="/cases/new"
          className="inline-flex w-full max-w-md items-center justify-center rounded-lg bg-[var(--mc-accent)] px-4 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-[var(--mc-accent-hover)]"
        >
          Consult a Case
        </Link>
      </div>

      <Section
        title="Open cases (need help)"
        empty={openCases.length === 0 ? "No open cases waiting for answers." : undefined}
      >
        <div className="flex flex-col gap-3">
          {openCases.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      </Section>

      <Section
        title="Cases in your field"
        empty={
          inField.length === 0
            ? `No cases in ${user.specialty} right now.`
            : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {inField.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      </Section>

      <Section title="Your activity">
        <McCard className="mb-4 p-4">
          <h3 className="text-sm font-medium text-[var(--mc-text)]">Cases you opened</h3>
          <div className="mt-2 flex flex-col gap-2">
            {yourOpened.length === 0 && (
              <p className="text-sm text-[var(--mc-muted)]">None yet.</p>
            )}
            {yourOpened.map((c: Case) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        </McCard>
        <McCard className="p-4">
          <h3 className="text-sm font-medium text-[var(--mc-text)]">Cases you answered</h3>
          <div className="mt-2 flex flex-col gap-2">
            {yourAnswered.length === 0 && (
              <p className="text-sm text-[var(--mc-muted)]">None yet.</p>
            )}
            {yourAnswered.map((c: Case) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        </McCard>
      </Section>

      <p className="text-center text-xs text-[var(--mc-muted)]">
        <Link href="/profile" className="underline hover:text-[var(--mc-text)]">
          Profile & specialty
        </Link>
      </p>
    </div>
  );
}
