import type { EntryType } from "@/lib/types";
import type { DirectionChoice } from "@/components/TransactionWizard";
import { ArrowUpIcon, ArrowDownIcon } from "@/components/ui/icons";

/**
 * The two directions money moves in this book, said the way a person says them.
 *
 * "Receivable" and "payable" are the stored values and the right words for a
 * column header, but nobody at a counter decides between them under those
 * names — they decide between *they owe me* and *I owe them*. Both surfaces
 * that offer the choice, the person's statement and the ledger's quick add,
 * read from this one table so they cannot end up wording the same decision two
 * different ways, which is how the person modal and the add-person wizard had
 * already drifted apart once.
 */
export const ENTRY_DIRECTIONS: ReadonlyArray<DirectionChoice<EntryType>> = [
  {
    value: "receivable",
    label: "They owe me",
    copy: "Money you lent or are owed",
    color: "var(--green)",
    onColor: "var(--on-green)",
    icon: <ArrowUpIcon className="w-4 h-4" />,
    sign: 1,
  },
  {
    value: "payable",
    label: "I owe them",
    copy: "Money you borrowed or must pay",
    color: "var(--red)",
    onColor: "var(--on-red)",
    icon: <ArrowDownIcon className="w-4 h-4" />,
    sign: -1,
  },
];

/** The direction's own entry, for previews and summaries. */
export function entryDirection(type: EntryType): DirectionChoice<EntryType> {
  return ENTRY_DIRECTIONS.find((direction) => direction.value === type) ?? ENTRY_DIRECTIONS[0];
}
