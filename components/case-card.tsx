import Link from "next/link";
import type { Case } from "@/lib/types";

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CaseCard({ c }: { c: Case }) {
  const waiting = c.answerCount === 0;
  const urgent = c.urgency === "urgent";

  return (
    <Link href={`/cases/${c.id}`}>
      <article
        className={`block rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${
          urgent
            ? "border-red-200 border-l-4 border-l-red-600 bg-red-50/40"
            : "border-[var(--mc-border)] bg-[var(--mc-surface)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
          <h3 className="min-w-0 flex-1 font-semibold text-[var(--mc-text)] line-clamp-2">{c.title}</h3>
          {urgent && (
            <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              Urgent
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {waiting ? (
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-300/80">
              Needs Help
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              Active discussion
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--mc-muted)]">
          <span>{c.specialty}</span>
          <span aria-hidden>·</span>
          <span>{formatTime(c.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>
            {c.answerCount} {c.answerCount === 1 ? "answer" : "answers"}
          </span>
        </div>
      </article>
    </Link>
  );
}
