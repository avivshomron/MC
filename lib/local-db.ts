"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { Specialty, UrgencyLevel } from "./constants";
import { getDb, getFirebaseStorage } from "./firebase/client";
import type { Answer, Case, Gender, Notification, ProfileStats, UserProfile } from "./types";

function toMs(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === "number") return value;
  return 0;
}

export function caseTitle(question: string, description: string): string {
  const base = question.trim() || description.trim() || "Clinical case";
  return base.length > 80 ? `${base.slice(0, 77)}…` : base;
}

function normalizeUrgency(v: unknown): UrgencyLevel {
  if (v === "low" || v === "medium" || v === "urgent") return v;
  return "medium";
}

/** Lower sort key = higher priority in lists. */
export function caseUrgencyRank(u: UrgencyLevel): number {
  if (u === "urgent") return 0;
  if (u === "medium") return 1;
  return 2;
}

/**
 * Dashboard ordering: urgent → no answers → newest.
 */
export function sortCasesByEngagement(cases: Case[]): Case[] {
  return [...cases].sort((a, b) => {
    const du = caseUrgencyRank(a.urgency) - caseUrgencyRank(b.urgency);
    if (du !== 0) return du;
    const za = a.answerCount === 0 ? 0 : 1;
    const zb = b.answerCount === 0 ? 0 : 1;
    if (za !== zb) return za - zb;
    return b.createdAt - a.createdAt;
  });
}

function mapUserProfile(id: string, data: DocumentData): UserProfile {
  return {
    id,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    specialty: data.specialty as Specialty,
    createdAt: toMs(data.createdAt),
    isVerified: Boolean(data.isVerified),
  };
}

function mapCase(id: string, data: DocumentData): Case {
  const question = String(data.question ?? "");
  const description = String(data.description ?? "");
  return {
    id,
    createdBy: String(data.createdBy ?? ""),
    title: caseTitle(question, description),
    specialty: data.specialty as Specialty,
    age:
      data.age === null || data.age === undefined
        ? null
        : typeof data.age === "number"
          ? data.age
          : Number(data.age),
    gender: (data.gender as Gender | null) ?? null,
    description,
    tests: String(data.tests ?? ""),
    question,
    images: Array.isArray(data.images) ? data.images.map(String) : [],
    isAnonymous: Boolean(data.isAnonymous),
    createdAt: toMs(data.createdAt),
    answerCount: typeof data.answerCount === "number" ? data.answerCount : 0,
    urgency: normalizeUrgency(data.urgency),
  };
}

function mapAnswer(id: string, data: DocumentData): Answer {
  const voted = Array.isArray(data.votedUserIds) ? data.votedUserIds.map(String) : [];
  return {
    id,
    caseId: String(data.caseId ?? ""),
    createdBy: String(data.createdBy ?? ""),
    authorName: String(data.authorName ?? "Unknown"),
    caseCreatedBy: String(data.caseCreatedBy ?? ""),
    specialty: data.specialty as Specialty,
    text: String(data.text ?? ""),
    upvotes: typeof data.upvotes === "number" ? data.upvotes : voted.length,
    votedUserIds: voted,
    isMostHelpful: Boolean(data.isMostHelpful),
    createdAt: toMs(data.createdAt),
  };
}

function mapNotification(id: string, data: DocumentData): Notification {
  const message =
    typeof data.message === "string" && data.message.length > 0
      ? data.message
      : "A new case in your field is waiting for answers";
  return {
    id,
    userId: String(data.userId ?? ""),
    caseId: String(data.caseId ?? ""),
    type: "new_case",
    isRead: Boolean(data.isRead),
    createdAt: toMs(data.createdAt),
    message,
  };
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  return mapUserProfile(snap.id, snap.data());
}

export async function getUserById(id: string): Promise<UserProfile | null> {
  return fetchUserProfile(id);
}

export async function updateUserSpecialty(userId: string, specialty: Specialty): Promise<void> {
  await updateDoc(doc(getDb(), "users", userId), { specialty });
}

export function subscribeCases(
  onNext: (cases: Case[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(collection(getDb(), "cases"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapCase(d.id, d.data())));
    },
    (err) => onError?.(err as Error)
  );
}

export function subscribeCaseById(
  caseId: string,
  onNext: (c: Case | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const r = doc(getDb(), "cases", caseId);
  return onSnapshot(
    r,
    (snap) => {
      if (!snap.exists()) onNext(null);
      else onNext(mapCase(snap.id, snap.data()));
    },
    (err) => onError?.(err as Error)
  );
}

export function subscribeAnswersForCase(
  caseId: string,
  onNext: (answers: Answer[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "answers"),
    where("caseId", "==", caseId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapAnswer(d.id, d.data())));
    },
    (err) => onError?.(err as Error)
  );
}

export function subscribeNotificationsForUser(
  userId: string,
  onNext: (items: Notification[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapNotification(d.id, d.data())));
    },
    (err) => onError?.(err as Error)
  );
}

export function subscribeMyAnswers(
  userId: string,
  onNext: (answers: Answer[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(
    collection(getDb(), "answers"),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      onNext(snap.docs.map((d) => mapAnswer(d.id, d.data())));
    },
    (err) => onError?.(err as Error)
  );
}

export function sortAnswersForDisplay(answers: Answer[]): Answer[] {
  return [...answers].sort((a, b) => {
    if (a.isMostHelpful !== b.isMostHelpful) return a.isMostHelpful ? -1 : 1;
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return a.createdAt - b.createdAt;
  });
}

export function computeProfileStats(answers: Answer[], userId: string): ProfileStats {
  let totalUpvotesReceived = 0;
  let answersMarkedHelpful = 0;
  const helpedCaseIds = new Set<string>();
  for (const a of answers) {
    totalUpvotesReceived += a.upvotes;
    if (a.isMostHelpful) answersMarkedHelpful += 1;
    if (a.caseCreatedBy !== userId) helpedCaseIds.add(a.caseId);
  }
  return {
    totalAnswers: answers.length,
    totalUpvotesReceived,
    casesHelped: helpedCaseIds.size,
    answersMarkedHelpful,
    impactScore: answers.length + 2 * answersMarkedHelpful,
  };
}

function newCaseNotificationMessage(specialty: string, urgency: UrgencyLevel): string {
  if (urgency === "urgent") {
    return `New urgent case in ${specialty} needs your input`;
  }
  return "A new case in your field is waiting for answers";
}

async function createNotificationsForNewCase(
  caseId: string,
  createdBy: string,
  specialty: string,
  urgency: UrgencyLevel
): Promise<void> {
  const db = getDb();
  const message = newCaseNotificationMessage(specialty, urgency);
  const uq = query(collection(db, "users"), where("specialty", "==", specialty));
  const snap = await getDocs(uq);
  let batch = writeBatch(db);
  let n = 0;
  for (const u of snap.docs) {
    if (u.id === createdBy) continue;
    const nref = doc(collection(db, "notifications"));
    batch.set(nref, {
      userId: u.id,
      caseId,
      type: "new_case",
      isRead: false,
      message,
      createdAt: serverTimestamp(),
    });
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

export async function createCaseWithImages(input: {
  createdBy: string;
  specialty: Specialty;
  age: number | null;
  gender: Gender | null;
  description: string;
  tests: string;
  question: string;
  isAnonymous: boolean;
  urgency: UrgencyLevel;
  files: File[];
}): Promise<string> {
  const db = getDb();
  const caseRef = await addDoc(collection(db, "cases"), {
    createdBy: input.createdBy,
    specialty: input.specialty,
    age: input.age,
    gender: input.gender,
    description: input.description,
    tests: input.tests,
    question: input.question,
    images: [] as string[],
    isAnonymous: input.isAnonymous,
    urgency: input.urgency,
    answerCount: 0,
    createdAt: serverTimestamp(),
  });
  const caseId = caseRef.id;

  await createNotificationsForNewCase(
    caseId,
    input.createdBy,
    input.specialty,
    input.urgency
  );

  if (input.files.length > 0) {
    const storage = getFirebaseStorage();
    const urls: string[] = [];
    for (const f of input.files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectRef = ref(storage, `cases/${caseId}/${crypto.randomUUID()}-${safe}`);
      await uploadBytes(objectRef, f, { contentType: f.type || "image/jpeg" });
      urls.push(await getDownloadURL(objectRef));
    }
    await updateDoc(doc(db, "cases", caseId), { images: urls });
  }

  return caseId;
}

export async function addAnswer(input: {
  caseId: string;
  user: UserProfile;
  text: string;
}): Promise<void> {
  const db = getDb();
  const caseRef = doc(db, "cases", input.caseId);
  const caseSnap = await getDoc(caseRef);
  if (!caseSnap.exists()) throw new Error("Case not found");
  const caseCreatedBy = String(caseSnap.data().createdBy ?? "");
  const answerRef = doc(collection(db, "answers"));
  const batch = writeBatch(db);
  batch.set(answerRef, {
    caseId: input.caseId,
    createdBy: input.user.id,
    specialty: input.user.specialty,
    text: input.text.trim(),
    upvotes: 0,
    votedUserIds: [] as string[],
    isMostHelpful: false,
    createdAt: serverTimestamp(),
    authorName: input.user.name,
    caseCreatedBy,
  });
  batch.update(caseRef, { answerCount: increment(1) });
  await batch.commit();
}

export async function toggleAnswerUpvote(answerId: string, userId: string): Promise<void> {
  const db = getDb();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "answers", answerId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Answer not found");
    const data = snap.data();
    const voted: string[] = Array.isArray(data.votedUserIds)
      ? data.votedUserIds.map(String)
      : [];
    const has = voted.includes(userId);
    const next = has ? voted.filter((x) => x !== userId) : [...voted, userId];
    tx.update(ref, { votedUserIds: next, upvotes: next.length });
  });
}

export async function setMostHelpfulAnswer(
  caseId: string,
  answerId: string | null,
  ownerId: string
): Promise<void> {
  const db = getDb();
  const caseRef = doc(db, "cases", caseId);
  const caseSnap = await getDoc(caseRef);
  if (!caseSnap.exists() || String(caseSnap.data().createdBy) !== ownerId) {
    throw new Error("Forbidden");
  }
  const aq = query(collection(db, "answers"), where("caseId", "==", caseId));
  const snap = await getDocs(aq);
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    const helpful = Boolean(answerId && d.id === answerId);
    if (Boolean(d.data().isMostHelpful) !== helpful) {
      batch.update(d.ref, { isMostHelpful: helpful });
      n++;
    }
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(getDb(), "notifications", notificationId), { isRead: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const db = getDb();
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("isRead", "==", false)
  );
  const snap = await getDocs(q);
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.update(d.ref, { isRead: true });
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}
