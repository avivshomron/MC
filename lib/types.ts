import type { Specialty, UrgencyLevel } from "./constants";

export type Gender = "Female" | "Male" | "Other" | "Prefer not to say";

/** App user profile (Firestore `users` + auth uid). */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  specialty: Specialty;
  createdAt: number;
  isVerified: boolean;
}

/** Case document mapped for UI (`title` derived from question + description). */
export interface Case {
  id: string;
  createdBy: string;
  title: string;
  specialty: Specialty;
  age: number | null;
  gender: Gender | null;
  description: string;
  tests: string;
  question: string;
  images: string[];
  isAnonymous: boolean;
  createdAt: number;
  answerCount: number;
  urgency: UrgencyLevel;
}

/** Answer document + denormalized fields for display and stats. */
export interface Answer {
  id: string;
  caseId: string;
  createdBy: string;
  authorName: string;
  caseCreatedBy: string;
  specialty: Specialty;
  text: string;
  upvotes: number;
  votedUserIds: string[];
  isMostHelpful: boolean;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  caseId: string;
  type: "new_case";
  isRead: boolean;
  createdAt: number;
  /** Denormalized at read time; legacy docs get a default message. */
  message: string;
}

export interface ProfileStats {
  totalAnswers: number;
  totalUpvotesReceived: number;
  casesHelped: number;
  answersMarkedHelpful: number;
  /** totalAnswers + 2 × answersMarkedHelpful */
  impactScore: number;
}
