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

/** One ticked service and everything recorded against it. */
export interface TaskSubtask {
  service: TaskService;
  /** Ticked off by the operator once that leg of the errand is finished. */
  done: boolean;
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

/** Either shape the field values may arrive in — a client map, or stored pairs. */
export type FieldSource =
  | Record<string, unknown>
  | readonly StoredField[]
  | null
  | undefined;

/** What a caller may submit. Every part is optional and separately distrusted. */
export interface SubtaskInput {
  service: string;
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
        done: row?.done === true,
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
): Array<{ service: TaskService; done: boolean; fields: StoredField[] }> {
  return subtasks.map((subtask) => ({
    service: subtask.service,
    done: subtask.done,
    fields: SERVICE_FIELDS[subtask.service]
      .filter((definition) => subtask.fields[definition.key] !== undefined)
      .map((definition) => ({
        key: definition.key,
        value: subtask.fields[definition.key],
      })),
  }));
}

/** How far through the checklist a task is. `total` is the number of sub-tasks. */
export function subtaskProgress(
  subtasks: readonly TaskSubtask[]
): { done: number; total: number } {
  return {
    done: subtasks.reduce((count, subtask) => count + (subtask.done ? 1 : 0), 0),
    total: subtasks.length,
  };
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
