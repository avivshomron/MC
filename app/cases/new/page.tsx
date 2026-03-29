"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { McButton } from "@/components/mc-button";
import { useAuth } from "@/contexts/auth-context";
import { SPECIALTIES, URGENCY_LEVELS, type Specialty, type UrgencyLevel } from "@/lib/constants";
import { createCaseWithImages } from "@/lib/local-db";
import type { Gender } from "@/lib/types";

const GENDERS: Gender[] = ["Female", "Male", "Other", "Prefer not to say"];

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default function NewCasePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [specialty, setSpecialty] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState<Gender | "">("");
  const [description, setDescription] = useState("");
  const [tests, setTests] = useState("");
  const [mainQuestion, setMainQuestion] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel | "">("");
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p));
    };
  }, [previews]);

  if (!user) return null;

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked?.length) return;
    setError(null);
    const nextFiles = [...files];
    const nextPreviews = [...previews];
    for (const f of Array.from(picked)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        setError("Each image must be under 8MB.");
        continue;
      }
      if (nextFiles.length >= MAX_IMAGES) break;
      nextFiles.push(f);
      nextPreviews.push(URL.createObjectURL(f));
    }
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    e.target.value = "";
  }

  function removeImage(i: number) {
    URL.revokeObjectURL(previews[i] ?? "");
    setFiles((prev) => prev.filter((_, j) => j !== i));
    setPreviews((prev) => prev.filter((_, j) => j !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!specialty) {
      setError("Select a specialty.");
      return;
    }
    if (!description.trim()) {
      setError("Add a case description.");
      return;
    }
    if (!mainQuestion.trim()) {
      setError("Add your main question.");
      return;
    }
    if (!urgency) {
      setError("Select an urgency level.");
      return;
    }
    let age: number | null = null;
    if (patientAge.trim()) {
      const n = Number(patientAge);
      if (!Number.isFinite(n) || n < 0 || n > 130) {
        setError("Enter a valid age or leave blank.");
        return;
      }
      age = Math.round(n);
    }
    setSubmitting(true);
    try {
      const caseId = await createCaseWithImages({
        createdBy: user.id,
        specialty: specialty as Specialty,
        age,
        gender: patientGender || null,
        description: description.trim(),
        tests: tests.trim(),
        question: mainQuestion.trim(),
        isAnonymous: anonymous,
        urgency: urgency as UrgencyLevel,
        files,
      });
      router.push(`/cases/${caseId}`);
    } catch (err) {
      console.error(err);
      setError("Could not create case. Check your connection and Firebase rules.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--mc-muted)] hover:text-[var(--mc-text)]"
        >
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-[var(--mc-text)]">Request help on a case</h1>
      <p className="mt-1 text-sm text-[var(--mc-muted)]">
        Use non-identifiable information only. Images upload to Firebase Storage.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 flex flex-col gap-8">
        <div>
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">Routing</h2>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">
              Specialty
            </span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Colleagues in this specialty get notified when you post.
            </p>
            <select
              required
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5 text-[var(--mc-text)]"
            >
              <option value="">Select specialty</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">
              Urgency level <span className="text-[var(--mc-danger)]">*</span>
            </span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Urgent cases surface first for colleagues and send a stronger notification.
            </p>
            <select
              required
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel | "")}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5 text-[var(--mc-text)]"
            >
              <option value="">Select urgency</option>
              {URGENCY_LEVELS.map((u) => (
                <option key={u} value={u}>
                  {u === "low" ? "Low" : u === "medium" ? "Medium" : "Urgent"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">Patient overview</h2>
          <fieldset className="mt-3 rounded-lg border border-[var(--mc-border)] p-4">
            <legend className="px-1 text-xs font-medium text-[var(--mc-muted)]">
              Non-identifiable only
            </legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">Age</span>
                <p className="mb-1.5 text-xs text-[var(--mc-muted)]">Optional. Helps frame risk and differentials.</p>
                <input
                  type="number"
                  min={0}
                  max={130}
                  placeholder="e.g. 62"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2 text-[var(--mc-text)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">Gender</span>
                <p className="mb-1.5 text-xs text-[var(--mc-muted)]">Optional. Only if clinically relevant.</p>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value as Gender | "")}
                  className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2 text-[var(--mc-text)]"
                >
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">Clinical details</h2>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">
              Case description
            </span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Symptoms, timeline, comorbidities, exam—without names or identifiers.
            </p>
            <textarea
              required
              rows={5}
              placeholder="Describe symptoms, relevant history, and key findings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5 text-[var(--mc-text)] placeholder:text-slate-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">
              Tests / findings
            </span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Labs, imaging reads, vitals—paste key values or summaries.
            </p>
            <textarea
              rows={4}
              placeholder="Include lab results, imaging, or other relevant data"
              value={tests}
              onChange={(e) => setTests(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5 text-[var(--mc-text)] placeholder:text-slate-400"
            />
          </label>

          <div className="mt-4">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">Images</span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Upload imaging strips or photos (no identifiers). Stored in Firebase Storage.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFiles}
            />
            <McButton
              type="button"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              Add images ({files.length}/{MAX_IMAGES})
            </McButton>
            {previews.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {previews.map((url, i) => (
                  <li
                    key={url}
                    className="relative aspect-square overflow-hidden rounded-lg border border-[var(--mc-border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
                      onClick={() => removeImage(i)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">Your question</h2>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--mc-text)]">
              Main question <span className="text-[var(--mc-danger)]">*</span>
            </span>
            <p className="mb-1.5 text-xs text-[var(--mc-muted)]">
              Be specific: diagnosis vs next step vs interpretation—this drives the consult title.
            </p>
            <textarea
              required
              rows={3}
              placeholder="What would you like help with? (e.g. diagnosis, next step, interpretation)"
              value={mainQuestion}
              onChange={(e) => setMainQuestion(e.target.value)}
              className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-surface)] px-3 py-2.5 text-[var(--mc-text)] placeholder:text-slate-400"
            />
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--mc-text)]">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--mc-border)]"
          />
          Post anonymously
        </label>

        {error && (
          <p className="text-sm text-[var(--mc-danger)]" role="alert">
            {error}
          </p>
        )}

        <McButton type="submit" variant="primary" className="w-full py-3 text-base" disabled={submitting}>
          {submitting ? "Sending…" : "Request Help"}
        </McButton>
      </form>
    </div>
  );
}
