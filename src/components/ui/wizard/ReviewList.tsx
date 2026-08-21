"use client";

import { EditIcon } from "@/components/ui/icons";

export interface ReviewItem {
  key: string;
  label: string;
  /** Rendered as the value. Pass a node for money, badges, or a swatch. */
  value: React.ReactNode;
  /** Shown greyed with "Not set" styling when the field was left blank. */
  empty?: boolean;
  /** Step index this field belongs to; makes the row a jump-to-edit button. */
  stepIndex?: number;
}

interface ReviewListProps {
  items: ReadonlyArray<ReviewItem>;
  /** Usually `wizard.goTo`. Omit to render a read-only summary. */
  onEdit?: (stepIndex: number) => void;
}

/**
 * The final step of every wizard.
 *
 * Splitting a form across screens buys focus at the cost of overview: by the
 * last step nothing on screen shows what the user actually entered. This hands
 * it back, and each row links to the step that owns the field — which is what
 * makes a five-step flow cheap to correct, since fixing a typo on step one
 * otherwise means pressing Back four times and Continue four times.
 */
export default function ReviewList({ items, onEdit }: ReviewListProps) {
  return (
    <div className="well overflow-hidden">
      {items.map((item) => {
        const editable = onEdit != null && item.stepIndex != null;

        const content = (
          <>
            <span className="review-key">{item.label}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="review-value" data-empty={item.empty ? "true" : undefined}>
                {item.empty ? "Not set" : item.value}
              </span>
              {editable && (
                <EditIcon
                  className="w-3.5 h-3.5 flex-shrink-0 text-ink-muted"
                  aria-hidden="true"
                />
              )}
            </span>
          </>
        );

        return editable ? (
          <button
            key={item.key}
            type="button"
            className="review-row"
            onClick={() => onEdit(item.stepIndex!)}
            aria-label={`Edit ${item.label}`}
          >
            {content}
          </button>
        ) : (
          <div key={item.key} className="review-row">
            {content}
          </div>
        );
      })}
    </div>
  );
}
