export const SPECIALTIES = [
  "Cardiology",
  "Neurology",
  "Pulmonology",
  "Gastroenterology",
  "Endocrinology",
  "Nephrology",
  "Hematology / Oncology",
  "Infectious Disease",
  "Rheumatology",
  "Dermatology",
  "Psychiatry",
  "Emergency Medicine",
  "General Internal Medicine",
  "Pediatrics",
  "Surgery",
  "Obstetrics & Gynecology",
  "Radiology",
  "Pathology",
  "Anesthesiology",
  "Other",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

export const URGENCY_LEVELS = ["low", "medium", "urgent"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];
