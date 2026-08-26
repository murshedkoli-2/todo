/**
 * The desk's standing catalogue of jobs, and the information each one needs.
 *
 * Two things live here rather than in `schemas/todo.ts`, where the rest of the
 * task vocabulary sits: the enum itself, and the per-service field definitions.
 * They are together because the fields are keyed by the enum, and they are
 * *here* because the zod schema needs to read the field table to validate a
 * submitted sub-task — importing it the other way round would be a cycle.
 *
 * `schemas/todo.ts` re-exports the enum, so every existing import path still
 * works and nothing outside this file needs to know the enum moved.
 */

/**
 * Every job that walks through the door is one or more of these.
 *
 * Typing "New NID" by hand each time produced six spellings of the same job,
 * which made counting how many passport corrections were open impossible.
 * Keeping it an enum rather than free text is the point: the values are what
 * later filtering and reporting group by.
 *
 * Ordered as the counter thinks of them, and — importantly — with each
 * "correction" sitting directly under the "new" it amends, because that pairing
 * is how the work is sorted at the desk. Reordering is safe: nothing is stored
 * by index, only by key.
 */
export const TASK_SERVICES = [
  "birth_certificate",
  "birth_certificate_correction",
  "new_nid",
  "nid_correction",
  "new_passport",
  "passport_correction",
  "police_clearance",
  "bmet_registration",
  "training_admission",
] as const;

export type TaskService = (typeof TASK_SERVICES)[number];

/** Catalogue position, used to keep a stored set in one canonical order. */
export const SERVICE_ORDER: ReadonlyMap<TaskService, number> = new Map(
  TASK_SERVICES.map((service, index) => [service, index])
);

const SERVICE_KEYS: ReadonlySet<string> = new Set<string>(TASK_SERVICES);

export function isTaskService(value: unknown): value is TaskService {
  return typeof value === "string" && SERVICE_KEYS.has(value);
}

/* ── Per-service information ──────────────────────────────────────────────── */

/**
 * How a field is captured, and — for `secret` — how it must be handled.
 *
 * `secret` is not a cosmetic variant of `text`. It marks a value that is a
 * live credential belonging to the customer, and it changes behaviour in three
 * places: the input masks it, the task view hides it behind a deliberate
 * reveal, and the list endpoint strips it from the payload entirely so a
 * password never rides along in a response that only needed a title.
 */
export type ServiceFieldType = "text" | "date" | "secret";

export interface ServiceFieldDef {
  /** Stable storage key. Never rendered. */
  key: string;
  label: string;
  type: ServiceFieldType;
  /** Shown under the input when the field needs explaining. */
  help?: string;
  placeholder?: string;
}

/** Every stored field value is trimmed and capped at this length. */
export const MAX_FIELD_LENGTH = 200;

/**
 * What to ask for once a service is ticked.
 *
 * The fields are deliberately *optional*. A task is often written down while
 * the customer is still standing at the counter with their papers in a bag, and
 * the wizard's whole design is that any step past the first can be skipped in
 * one press — making these required would mean a walk-in could not be recorded
 * at all until every document number was in hand. The sub-task list shows how
 * many are still blank instead, so the gap stays visible.
 *
 * Adding a service is one entry in `TASK_SERVICES` plus one row here and one in
 * each display table in `lib/types.ts`; TypeScript flags the rows that were
 * missed.
 */
export const SERVICE_FIELDS: Record<TaskService, readonly ServiceFieldDef[]> = {
  birth_certificate: [
    { key: "applicant_name", label: "Applicant name", type: "text", placeholder: "Name as it should be registered" },
    { key: "date_of_birth", label: "Date of birth", type: "date" },
  ],
  birth_certificate_correction: [
    {
      key: "birth_number",
      label: "Birth registration number",
      type: "text",
      placeholder: "17-digit number on the certificate",
      help: "The number printed on the certificate being corrected.",
    },
    {
      key: "date_of_birth",
      label: "Date of birth",
      type: "date",
      help: "As it currently appears on the certificate, not the corrected value.",
    },
  ],
  new_nid: [
    { key: "applicant_name", label: "Applicant name", type: "text" },
    { key: "date_of_birth", label: "Date of birth", type: "date" },
  ],
  nid_correction: [
    { key: "nid_number", label: "NID number", type: "text", placeholder: "Number on the card being corrected" },
    {
      key: "password",
      label: "NID portal password",
      type: "secret",
      help: "The customer's own account password, needed to file the correction. Hidden by default and never sent to the task list.",
    },
  ],
  new_passport: [
    { key: "applicant_name", label: "Applicant name", type: "text" },
    { key: "nid_number", label: "NID number", type: "text" },
  ],
  passport_correction: [
    { key: "passport_number", label: "Passport number", type: "text", placeholder: "Number on the passport being amended" },
  ],
  police_clearance: [
    { key: "passport_number", label: "Passport number", type: "text" },
  ],
  bmet_registration: [
    { key: "passport_number", label: "Passport number", type: "text" },
  ],
  training_admission: [
    { key: "course_name", label: "Course", type: "text", placeholder: "Which training the admission is for" },
  ],
};

/** The definition for one field, or `undefined` if the key is not in the catalogue. */
export function fieldDef(
  service: TaskService,
  key: string
): ServiceFieldDef | undefined {
  return SERVICE_FIELDS[service].find((field) => field.key === key);
}

/** True when any of a service's fields holds a credential. */
export function hasSecretField(service: TaskService): boolean {
  return SERVICE_FIELDS[service].some((field) => field.type === "secret");
}
