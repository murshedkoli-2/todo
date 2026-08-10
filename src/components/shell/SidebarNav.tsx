"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isActiveSection } from "@/components/shell/navigation";
import Brand from "@/components/shell/Brand";
import UserMenu from "@/components/shell/UserMenu";
import { PlusIcon, CloseIcon } from "@/components/ui/icons";

interface SidebarNavProps {
  /** Rendered inside the mobile drawer — adds a close button and dismisses on navigate. */
  onNavigate?: () => void;
}

export default function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--bg-secondary)" }}
    >
      {/* Brand row — height matches the top bar so the two align */}
      <div
        className="flex items-center justify-between h-16 px-5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Brand />
        {onNavigate && (
          <button onClick={onNavigate} className="btn-ghost w-9 h-9 px-0" aria-label="Close menu">
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary navigation */}
      <nav className="flex flex-col pt-5" aria-label="Main navigation">
        <p className="text-eyebrow px-5 mb-2">Workspace</p>
        {NAV_SECTIONS.map(({ href, label, icon: SectionIcon }) => {
          const active = isActiveSection(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className="nav-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <SectionIcon className="w-[18px] h-[18px] flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Quick action */}
      <div className="px-5 mt-6">
        <Link href="/tasks/new" onClick={onNavigate} className="btn-primary w-full">
          <PlusIcon className="w-4 h-4" />
          New task
        </Link>
      </div>

      <div className="flex-1" />

      {/* Profile */}
      <div className="py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <UserMenu />
      </div>
    </div>
  );
}
