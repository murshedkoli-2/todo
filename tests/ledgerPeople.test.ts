import { describe, expect, test } from "vitest";
import {
  findPersonByName, personNameKey, suggestPersons, tidyPersonName,
} from "@/lib/ledgerPeople";

/**
 * The quick add lets an entry name its counterparty instead of picking one,
 * and everything that can go wrong with that goes wrong quietly: a name that
 * fails to match an existing person does not error, it splits one balance
 * across two rows that both look right. So the matching rule is pinned here
 * rather than left to the two places that apply it.
 */

interface Person {
  _id: string;
  name: string;
  note?: string;
}

const person = (name: string, note?: string): Person => ({ _id: name, name, note });

describe("tidyPersonName", () => {
  test("trims the edges", () => {
    expect(tidyPersonName("  Rahim  ")).toBe("Rahim");
  });

  test("collapses a run of spaces rather than rejecting it", () => {
    // A double space is a typo the user cannot see. Failing the save over one
    // would be pedantry about a character with no meaning here.
    expect(tidyPersonName("Rahim   Uddin")).toBe("Rahim Uddin");
  });

  test("leaves an ordinary name exactly as typed", () => {
    expect(tidyPersonName("Rahim Uddin")).toBe("Rahim Uddin");
  });

  test("preserves case — this is the display form", () => {
    expect(tidyPersonName("RAHIM")).toBe("RAHIM");
  });
});

describe("personNameKey", () => {
  test("treats case as noise", () => {
    expect(personNameKey("rahim")).toBe(personNameKey("Rahim"));
  });

  test("treats surrounding and repeated whitespace as noise", () => {
    expect(personNameKey("  Rahim   Uddin ")).toBe(personNameKey("rahim uddin"));
  });

  test("keeps two genuinely different names apart", () => {
    expect(personNameKey("Rahim")).not.toBe(personNameKey("Rahima"));
  });
});

describe("findPersonByName", () => {
  const book = [person("Rahim Uddin"), person("Karim"), person("Ayesha Begum")];

  test("finds the person however the name was capitalised", () => {
    expect(findPersonByName(book, "rahim uddin")?.name).toBe("Rahim Uddin");
  });

  test("finds them through sloppy spacing", () => {
    expect(findPersonByName(book, " Rahim  Uddin ")?.name).toBe("Rahim Uddin");
  });

  test("returns null for a name that is not in the book", () => {
    // This is the branch that creates a person, so a false negative costs a
    // duplicate row and a false positive puts money on the wrong person.
    expect(findPersonByName(book, "Rahim")).toBeNull();
  });

  test("returns null for a blank query rather than matching the first row", () => {
    expect(findPersonByName(book, "   ")).toBeNull();
  });

  test("returns null against an empty book", () => {
    expect(findPersonByName([], "Rahim")).toBeNull();
  });
});

describe("suggestPersons", () => {
  const book = [
    person("Abdur Rahman"),
    person("Rahim Uddin"),
    person("Karim", "the tailor"),
    person("Salma"),
  ];

  test("ranks a name that starts with the query above one that contains it", () => {
    /* A picker that answers "rah" with "Abdur Rahman" first is one the user
       learns to ignore, and then types past — straight into a duplicate. */
    expect(suggestPersons(book, "rah").map((p) => p.name))
      .toEqual(["Rahim Uddin", "Abdur Rahman"]);
  });

  test("matches a note, because that is often all the user remembers", () => {
    expect(suggestPersons(book, "tailor").map((p) => p.name)).toEqual(["Karim"]);
  });

  test("ranks a name match above a note match", () => {
    const withNote = [person("Salma", "karim's sister"), person("Karim")];
    expect(suggestPersons(withNote, "karim").map((p) => p.name)).toEqual(["Karim", "Salma"]);
  });

  test("keeps the caller's order inside one rank", () => {
    // The list arrives sorted by recent activity, which is the right tie-break
    // for a book where the same few people come up all week.
    const sameRank = [person("Rahim A"), person("Rahim B"), person("Rahim C")];
    expect(suggestPersons(sameRank, "rahim").map((p) => p.name))
      .toEqual(["Rahim A", "Rahim B", "Rahim C"]);
  });

  test("offers the top of the book when nothing has been typed yet", () => {
    expect(suggestPersons(book, "", 2).map((p) => p.name))
      .toEqual(["Abdur Rahman", "Rahim Uddin"]);
  });

  test("ignores case and stray spacing the same way matching does", () => {
    expect(suggestPersons(book, "  RAHIM ").map((p) => p.name)).toEqual(["Rahim Uddin"]);
  });

  test("caps the list so a long book cannot fill the screen", () => {
    const many = Array.from({ length: 40 }, (_, index) => person(`Rahim ${index}`));
    expect(suggestPersons(many, "rahim")).toHaveLength(6);
  });

  test("returns nothing when no name or note matches", () => {
    expect(suggestPersons(book, "zzz")).toEqual([]);
  });
});
