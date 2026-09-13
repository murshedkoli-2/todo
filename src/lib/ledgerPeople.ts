/**
 * Naming a counterparty.
 *
 * The ledger's quick add lets an entry name its person instead of picking one,
 * which is the whole point of it — most entries are for somebody already in the
 * book, and the ones that are not should not cost a second trip through "add
 * person" first. That convenience creates exactly one problem: "Rahim",
 * "rahim " and "Rahim  Uddin" typed on three different days must not become
 * three people, each holding a third of one balance.
 *
 * So a typed name is tidied to one display form and compared through one key,
 * both defined here. The client uses them to tell the user which person an
 * entry is about to land on; the service uses the same tidy form when it writes
 * and a case-insensitive collation when it looks up, so the two agree about
 * what counts as the same name.
 */

/**
 * The display form of a typed name: trimmed, with runs of whitespace collapsed.
 *
 * Collapsing rather than rejecting is deliberate — a double space is a typo the
 * user cannot see, and refusing the save over it would be pedantry about a
 * character that has no meaning here.
 */
export function tidyPersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * The comparison form. Case is not identity: somebody who types "rahim" today
 * means the "Rahim" they entered last week.
 */
export function personNameKey(raw: string): string {
  return tidyPersonName(raw).toLowerCase();
}

/** The named person, or `null`. Names are compared through {@link personNameKey}. */
export function findPersonByName<T extends { name: string }>(
  persons: readonly T[],
  name: string
): T | null {
  const key = personNameKey(name);
  if (!key) return null;
  return persons.find((person) => personNameKey(person.name) === key) ?? null;
}

/**
 * People worth offering for what has been typed so far, best match first.
 *
 * A name that *starts with* the query is ranked above one that merely contains
 * it, because a picker that answers "ra" with "Abdur Rahman" before "Rahim" is
 * one the user learns to ignore. Notes are searched too — this book holds shop
 * names and half-remembered relations, and "the tailor" is often the only thing
 * the user can recall.
 */
export function suggestPersons<T extends { name: string; note?: string }>(
  persons: readonly T[],
  query: string,
  limit = 6
): T[] {
  const key = personNameKey(query);
  if (!key) return persons.slice(0, limit);

  const scored: Array<{ person: T; rank: number }> = [];

  for (const person of persons) {
    const name = personNameKey(person.name);
    const note = person.note?.toLowerCase() ?? "";

    if (name.startsWith(key)) scored.push({ person, rank: 0 });
    else if (name.includes(key)) scored.push({ person, rank: 1 });
    else if (note.includes(key)) scored.push({ person, rank: 2 });
  }

  /* A stable sort by rank alone keeps the caller's order — most recent activity
     — inside each band, which is the right tie-break for a book where the same
     few people come up all week. */
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map((row) => row.person);
}
