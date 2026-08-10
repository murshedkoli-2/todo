import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm min-w-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="font-medium hover:underline flex-shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRightIcon
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
