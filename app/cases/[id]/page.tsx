"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { McButton } from "@/components/mc-button";
import { useAuth } from "@/contexts/auth-context";
import {
  addAnswer,
  getUserById,
  setMostHelpfulAnswer,
  sortAnswersForDisplay,
  subscribeAnswersForCase,
  subscribeCaseById,
  toggleAnswerUpvote,
} from "@/lib/local-db";
import type { Answer, Case } from "@/lib/types";

function formatFullTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [c, setC] = useState<Case | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerSuccess, setAnswerSuccess] = useState(false);

  useEffect(() => {
    if (!id) {
      setC(null);
      return;
    }
    return subscribeCaseById(id, setC, console.error);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeAnswersForCase(id, setAnswers, console.error);
  }, [id]);

  useEffect(() => {
    if (!c || c.isAnonymous) {
      setAuthorName(null);
      return;
    }
    let cancelled = false;
    void getUserById(c.createdBy).then((u) => {
      if (!cancelled) setAuthorName(u?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [c]);

  useEffect(() => {
    if (!answerSuccess) return;
    const t = setTimeout(() => setAnswerSuccess(false), 8000);
    return () => clearTimeout(t);
  }, [answerSuccess]);

  const sortedAnswers = useMemo(() => sortAnswersForDisplay(answers), [answers]);

  if (!user) return null;

  if (c === undefined) {
    return (
      <div className="text-sm text-[var(--mc-muted)]">Loading case…</div>
    );
  }

  if (c === null) {
    return (
      <div>
        <p className="text-[var(--mc-muted)]">Case not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--mc-accent)]">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isOwner = c.createdBy === user.id;

  async function onSubmitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !c) return;
    const text = answerText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await addAnswer({ caseId: c.id, user, text });
      setAnswerText("");
      setAnswerSuccess(true);
      await refreshUser();
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[var(--mc-muted)] hover:text-[var(--mc-text)]"
      >
        ← Dashboard
      </Link>

      <header className="border-b border-[var(--mc-border)] pb-6">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="text-xl font-semibold text-[var(--mc-text)]">{c.title}</h1>
          {c.urgency === "urgent" && (
            <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Urgent
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--mc-muted)]">
          <span>{c.specialty}</span>
          <span>·</span>
          <span>{formatFullTime(c.createdAt)}</span>
          {c.isAnonymous && (
            <>
              <span>·</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-[var(--mc-muted)]">
                Anonymous
              </span>
            </>
          )}
        </div>
        {!c.isAnonymous && authorName && (
          <p className="mt-2 text-sm text-[var(--mc-muted)]">
            Posted by <span className="text-[var(--mc-text)]">{authorName}</span>
          </p>
        )}
        {c.isAnonymous && (
          <p className="mt-2 text-sm text-[var(--mc-muted)]">Posted anonymously.</p>
        )}
      </header>

      <section className="mt-6 space-y-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
            Case description
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[var(--mc-text)]">{c.description}</p>
        </div>
        {(c.age != null || c.gender) && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
              Patient (non-identifiable)
            </h2>
            <p className="mt-2 text-sm text-[var(--mc-text)]">
              {c.age != null && <span>Age {c.age}</span>}
              {c.age != null && c.gender && " · "}
              {c.gender && <span>{c.gender}</span>}
            </p>
          </div>
        )}
        {c.tests.trim() && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
              Tests / findings
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[var(--mc-text)]">{c.tests}</p>
          </div>
        )}
        {c.question.trim() && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
              Question
            </h2>
            <p className="mt-2 text-[var(--mc-text)]">{c.question}</p>
          </div>
        )}
        {c.images.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-muted)]">
              Images
            </h2>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {c.images.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-[var(--mc-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Finding ${i + 1}`} className="max-h-80 w-full object-contain" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--mc-text)]">
          Answers ({answers.length})
        </h2>
        {answers.length === 0 && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              isOwner
                ? "border-slate-200 bg-slate-50 text-slate-800"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
            role="status"
          >
            {isOwner ? (
              <p className="font-medium">Waiting for responses from colleagues</p>
            ) : (
              <p className="font-medium">No answers yet — be the first to help</p>
            )}
          </div>
        )}
        <ul className="flex flex-col gap-4">
          {sortedAnswers.map((a: Answer) => (
            <li
              key={a.id}
              className={`rounded-xl border p-4 shadow-sm ${
                a.isMostHelpful
                  ? "border-amber-400/80 bg-amber-50/80 ring-1 ring-amber-200"
                  : "border-[var(--mc-border)] bg-[var(--mc-surface)]"
              }`}
            >
              {a.isMostHelpful && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Most helpful answer
                </p>
              )}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--mc-text)]">{a.authorName}</p>
                  <p className="text-sm text-[var(--mc-muted)]">{a.specialty}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <McButton
                      type="button"
                      variant={a.isMostHelpful ? "primary" : "secondary"}
                      className="!py-1 !px-2 text-xs"
                      onClick={() => {
                        const next = a.isMostHelpful ? null : a.id;
                        void setMostHelpfulAnswer(c.id, next, user.id).catch(console.error);
                      }}
                    >
                      {a.isMostHelpful ? "★ Most helpful" : "☆ Mark most helpful"}
                    </McButton>
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--mc-text)]">{a.text}</p>
              <div className="mt-3 flex items-center gap-2">
                <McButton
                  type="button"
                  variant="ghost"
                  className="!py-1 !px-2 text-xs"
                  onClick={() => {
                    void toggleAnswerUpvote(a.id, user.id).catch(console.error);
                  }}
                >
                  👍 {a.upvotes}
                  {a.votedUserIds.includes(user.id) ? " (you)" : ""}
                </McButton>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {answerSuccess && (
        <div
          className="fixed bottom-20 left-0 right-0 z-30 mx-auto max-w-3xl px-4"
          role="status"
        >
          <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-md">
            <p className="font-medium">
              Your input was shared. You just helped with a real clinical case.
            </p>
            <button
              type="button"
              className="shrink-0 text-emerald-800 underline"
              onClick={() => setAnswerSuccess(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t border-[var(--mc-border)] bg-[var(--mc-bg)]/95 p-4 backdrop-blur">
        <form
          onSubmit={(e) => void onSubmitAnswer(e)}
          className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your answer</span>
            <textarea
              rows={2}
              placeholder="Share your professional opinion or recommendation…"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2 text-sm text-[var(--mc-text)] placeholder:text-slate-400"
            />
          </label>
          <McButton type="submit" variant="primary" className="shrink-0 sm:w-auto" disabled={submitting}>
            Submit Answer
          </McButton>
        </form>
      </footer>
    </div>
  );
}
