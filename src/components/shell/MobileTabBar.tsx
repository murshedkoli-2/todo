"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isActiveSection } from "@/components/shell/navigation";

/** Bottom tab bar — the sidebar's stand-in below the `lg` breakpoint. */
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom"
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -4px 20px -12px rgba(24,28,54,0.4)",
      }}
      aria-label="Section navigation"
    >
      <div className="flex items-stretch">
        {NAV_SECTIONS.map(({ href, label, icon: SectionIcon }) => {
          const active = isActiveSection(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              aria-current={active ? "page" : undefined}
            >
              <span
                className="flex items-center justify-center h-7 w-12 rounded-full"
                style={{ background: active ? "var(--accent-soft)" : "transparent" }}
              >
                <SectionIcon className="w-[18px] h-[18px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
