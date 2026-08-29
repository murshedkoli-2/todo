/**
 * Sub-tasks: the ticked services, with the information each one needs.
 *
 * A task carries two related facts about its services — *which* jobs it covers,
 * and *what was captured* for each. They are stored as two fields (`services`
 * for the flat, indexed set the filters query, and `subtasks` for the payload)
 * and the obvious failure mode is those two disagreeing: a sub-task holding a
 * passport number for a service the user has since unticked, or a ticked
 * service with no sub-task row at all, which renders as a gap in the checklist.
 *
 * `normalizeSubtasks` is the single function that produces both, so they cannot
 * drift — every write path calls it and stores what it returns. Everything here
 * is pure, because this is exactly the logic that is cheap to get wrong and
 * expensive to reproduce through a browser.
 */

import {
  MAX_FIELD_LENGTH, SERVICE_FIELDS, TASK_SERVICES,
  fieldDef, isTaskService,
} from "@/lib/serviceCatalogue";
import type { TaskService } from "@/lib/serviceCatalogue";
import { TODO_STATUSES } from "@/lib/schemas/todo";
import type { TodoStatus } from "@/lib/schemas/todo";

/**
 * How far along one leg of the errand is.
 *
 * Deliberately the same three values as the task's own status rather than a
 * vocabulary of its own. A sub-task *is* a task on this desk — "at the passport
 * office" is the thing an operator wants to record, and it is the same thing
 * whether it is said about the whole errand or about one leg of it. Sharing the
 * enum also means one set of labels, one set of colours, and a checklist whose
 * rows read in the same language as the badge at the top of the page.
 */
export type SubtaskStatus = TodoStatus;

/** One ticked service and everything recorded against it. */
export interface TaskSubtask {
  service: TaskService;
  /**
   * Where this leg has got to. Replaced the boolean `done` this field used to
   * be: a checklist that can only say "finished" or "not started" cannot say
   * the thing operators actually needed to write down, which is that a job has
   * been lodged and is now waiting on somebody else.
   */
  status: SubtaskStatus;
  /**
   * Captured values, keyed by `ServiceFieldDef.key`. Only keys in the
   * catalogue survive normalization, and a blank value is dropped rather than
   * stored as `""` — "not asked yet" and "answered with nothing" are the same
   * thing here, and keeping both spellings would make the count of missing
   * fields wrong.
   */
  fields: Record<string, string>;
}

/**
 * A stored field pair.
 *
 * Mongo holds `fields` as an array of these rather than as an object keyed by
 * field name, even though every other layer treats it as a map. Dynamic keys in
 * a document mean either `Mixed` (which loses change tracking and validation)
 * or a `Map` (which hydrates as a `Map` but comes back from `.lean()` as a
 * plain object, so the type is a lie on one of the two read paths). A fixed
 * two-key sub-document has neither problem, and the map shape is rebuilt on the
 * way out where it is actually convenient.
 */
export interface StoredField {
  key: string;
  value: string;
}

/** True for one of the three statuses, narrowing an untrusted string. */
export function isSubtaskStatus(value: unknown): value is SubtaskStatus {
  return typeof value === "string" && (TODO_STATUSES as readonly string[]).includes(value);
}

/**
 * The status of a row that may predate the field.
 *
 * Every sub-task written before this change carries `done` and no `status`, and
 * there is no migration: the boolean maps cleanly onto two of the three values,
 * and running the mapping on every read costs nothing and cannot leave a
 * half-converted collection behind. An unrecognised status falls back the same
 * way, so a value retired from the enum later degrades to "todo" rather than
 * rendering as a row with no state at all.
 */
export function resolveSubtaskStatus(
  status: unknown,
  done: unknown
): SubtaskStatus {
  if (isSubtaskStatus(status)) return status;
  return done === true ? "completed" : "todo";
}

/** Whether this leg is finished. The only meaning "done" has now. */
export function isSubtaskDone(subtask: { status: SubtaskStatus }): boolean {
  return subtask.status === "completed";
}

/** Whether work has started on this leg — ticked off, or under way. */
export function isSubtaskStarted(subtask: { status: SubtaskStatus }): boolean {
  return subtask.status !== "todo";
}

/** Either shape the field values may arrive in — a client map, or stored pairs. */
export type FieldSource =
  | Record<string, unknown>
  | readonly StoredField[]
  | null
  | undefined;

/** What a caller may submit. Every part is optional and separately distrusted. */
export interface SubtaskInput {
  service: string;
  status?: string | null;
  /** @deprecated The pre-`status` spelling. Still read, never written. */
  done?: boolean | null;
  fields?: FieldSource;
}

/**
 * Keeps only the keys this service actually defines, trimmed and capped.
 *
 * Dropping unknown keys rather than rejecting them is deliberate: a service's
 * field list will change over time, and an edit submitted from a page loaded
 * before a field was retired should save the rest of the form rather than fail
 * outright. The cap is a second line behind the schema's own — this function is
 * also reachable from the migration path for documents written earlier.
 */
export function normalizeFields(
  service: TaskService,
  fields: FieldSource
): Record<string, string> {
  if (!fields) return {};

  /* Stored pairs are folded into a map first so the catalogue walk below is the
     same code for both read paths. A later pair wins, which cannot happen from
     a well-formed document but is the safer of the two answers. */
  const source: Record<string, unknown> = Array.isArray(fields)
    ? Object.fromEntries(
        (fields as readonly StoredField[])
          .filter((pair) => typeof pair?.key === "string")
          .map((pair) => [pair.key, pair.value])
      )
    : (fields as Record<string, unknown>);

  const result: Record<string, string> = {};
  // Iterating the catalogue rather than the input fixes key order and means a
  // hostile payload with 10,000 keys costs nothing beyond the lookups.
  for (const definition of SERVICE_FIELDS[service]) {
    const raw = source[definition.key];
    if (typeof raw !== "string") continue;
    const value = raw.trim().slice(0, MAX_FIELD_LENGTH);
    if (value.length > 0) result[definition.key] = value;
  }
  return result;
}

/**
 * Reconciles a selection of services with the sub-task rows submitted for them.
 *
 * The selection wins: a row whose service is not ticked is discarded, and a
 * ticked service with no row gets an empty one. The result is exactly one row
 * per service, in catalogue order, matching `services` element for element.
 *
 * `services` is returned alongside rather than taken on trust, because the
 * caller's copy may hold duplicates or arrive in tap order.
 */
export function normalizeSubtasks(
  services: readonly string[],
  subtasks: readonly SubtaskInput[] | null | undefined
): { services: TaskService[]; subtasks: TaskSubtask[] } {
  const selected = new Set<TaskService>(services.filter(isTaskService));

  /* Last row wins on a duplicate service. The alternative — merging their
     fields — would resurrect a value the user had just cleared. */
  const submitted = new Map<TaskService, SubtaskInput>();
  for (const row of subtasks ?? []) {
    if (isTaskService(row?.service)) submitted.set(row.service, row);
  }

  const ordered = TASK_SERVICES.filter((service) => selected.has(service));

  return {
    services: [...ordered],
    subtasks: ordered.map((service) => {
      const row = submitted.get(service);
      return {
        service,
        status: resolveSubtaskStatus(row?.status, row?.done),
        fields: normalizeFields(service, row?.fields),
      };
    }),
  };
}

/**
 * Rebuilds sub-tasks for a task read back from the database.
 *
 * Every row written before this feature existed has `services` but no
 * `subtasks`, and a task view that showed those as an empty checklist would
 * read as "nothing selected" rather than "selected, nothing captured". Running
 * stored data back through the same reconciliation gives them a row each.
 */
export function readSubtasks(
  services: readonly string[] | null | undefined,
  subtasks: readonly SubtaskInput[] | null | undefined
): { services: TaskService[]; subtasks: TaskSubtask[] } {
  return normalizeSubtasks(services ?? [], subtasks);
}

/**
 * Flattens the map form back to the pair array Mongo stores.
 *
 * Keys are emitted in catalogue order, not insertion order, so two saves of the
 * same values produce byte-identical documents — which keeps a no-op edit from
 * showing up as a change.
 */
export function toStoredSubtasks(
  subtasks: readonly TaskSubtask[]
): Array<{ service: TaskService; status: SubtaskStatus; fields: StoredField[] }> {
  return subtasks.map((subtask) => ({
    service: subtask.service,
    status: subtask.status,
    fields: SERVICE_FIELDS[subtask.service]
      .filter((definition) => subtask.fields[definition.key] !== undefined)
      .map((definition) => ({
        key: definition.key,
        value: subtask.fields[definition.key],
      })),
  }));
}

/** A tally of the checklist by state. `total` is the number of sub-tasks. */
export interface SubtaskProgress {
  /** Not started. */
  todo: number;
  /** Under way — lodged, submitted, waiting on somebody else. */
  inProgress: number;
  /** Finished. */
  done: number;
  /** Anything past "not started" — the count that decides whether a task has
      stopped being untouched. */
  started: number;
  total: number;
}

/** How far through the checklist a task is. */
export function subtaskProgress(subtasks: readonly TaskSubtask[]): SubtaskProgress {
  const tally = { todo: 0, inProgress: 0, done: 0, started: 0, total: subtasks.length };

  for (const subtask of subtasks) {
    if (subtask.status === "completed") tally.done += 1;
    else if (subtask.status === "in_progress") tally.inProgress += 1;
    else tally.todo += 1;
  }
  tally.started = tally.inProgress + tally.done;

  return tally;
}

/** How many of a sub-task's catalogue fields are still blank. */
export function missingFieldCount(subtask: TaskSubtask): number {
  return SERVICE_FIELDS[subtask.service].filter(
    (definition) => !subtask.fields[definition.key]
  ).length;
}

/** Stands in for a credential wherever one is summarised rather than revealed. */
export const SECRET_MASK = "••••••••";

export interface DescribedField {
  key: string;
  label: string;
  /** The stored value, or {@link SECRET_MASK} when `secret` and not revealed. */
  value: string;
  secret: boolean;
}

/**
 * A sub-task's answered fields, in catalogue order, ready to print.
 *
 * Blank fields are left out — a summary line reading "Passport number: —" is
 * noise, and the count of what is still missing is reported separately by
 * `missingFieldCount`. Credentials are masked unless the caller has an explicit
 * reason to reveal one, so the *default* on every read-only surface is safe and
 * showing a password takes a deliberate argument.
 */
export function describeSubtaskFields(
  subtask: TaskSubtask,
  { revealSecrets = false }: { revealSecrets?: boolean } = {}
): DescribedField[] {
  const described: DescribedField[] = [];

  for (const definition of SERVICE_FIELDS[subtask.service]) {
    const value = subtask.fields[definition.key];
    if (!value) continue;

    const secret = definition.type === "secret";
    described.push({
      key: definition.key,
      label: definition.label,
      value: secret && !revealSecrets ? SECRET_MASK : value,
      secret,
    });
  }

  return described;
}

/**
 * Strips credential values, keeping the key so the UI can still say the field
 * is set without saying what it is.
 *
 * Used on the list endpoint. A password belongs to the customer, and the only
 * screen with a reason to hold one is the single task being worked on — sending
 * fifty of them to render a page of titles widens the blast radius of any
 * logging, caching, or client-side leak for no benefit.
 */
export function redactSecrets(subtasks: readonly TaskSubtask[]): TaskSubtask[] {
  return subtasks.map((subtask) => {
    const fields: Record<string, string> = {};
    let redacted = false;

    for (const [key, value] of Object.entries(subtask.fields)) {
      if (fieldDef(subtask.service, key)?.type === "secret") {
        redacted = true;
        continue;
      }
      fields[key] = value;
    }

    return redacted ? { ...subtask, fields } : subtask;
  });
}
