"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SidebarNav from "@/components/shell/SidebarNav";
import MobileTabBar from "@/components/shell/MobileTabBar";
import Brand from "@/components/shell/Brand";
import CommandPalette from "@/components/shell/CommandPalette";
import ShortcutsHelp from "@/components/shell/ShortcutsHelp";
import ThemeToggle from "@/components/ThemeToggle";
import Avatar from "@/components/ui/Avatar";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHotkeys } from "@/hooks/useHotkeys";
import { KeyboardIcon, MenuIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";

interface AppShellProps {
  /** Workspace label shown at the left of the top bar. */
  workspace?: string;
  children: React.ReactNode;
}

/** Sends the same ⌘K the palette listens for, so one path drives both. */
function openPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

/**
 * Application chrome: fixed sidebar on `lg`+, slide-over drawer plus a bottom
 * tab bar below it. Pages render only their own content into `children`.
 */
export default function AppShell({ workspace = "My Workspace", children }: AppShellProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useFocusTrap<HTMLDivElement>(drawerOpen);

  /* App-wide shortcuts. Page-specific ones (quick add, search) are bound by
     the page that owns the control, so a shortcut can never point at a widget
     that is not on screen. Every binding here is listed in `ShortcutsHelp`. */
  useHotkeys(
    useMemo(
      () => [
        { keys: "?", handler: () => window.dispatchEvent(new Event("taskflow:shortcuts")) },
        { keys: "c", handler: () => router.push("/tasks/new") },
        { keys: "g o", handler: () => router.push("/") },
        { keys: "g t", handler: () => router.push("/tasks") },
        { keys: "g l", handler: () => router.push("/ledger") },
        { keys: "g w", handler: () => router.push("/wallet") },
      ],
      [router]
    )
  );

  /* Lock body scroll and allow Escape while the drawer is open. */
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [drawerOpen]);

  const userName = session?.user?.name ?? "User";

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-sidebar flex-col"
        style={{ boxShadow: "var(--shadow-rail)" }}
      >
        <SidebarNav />
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 animate-fade-in"
            style={{ background: "var(--overlay-bg)", backdropFilter: "blur(4px)" }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative w-[272px] max-w-[82vw] h-full animate-slide-in-left shadow-modal"
          >
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="lg:pl-sidebar flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8 flex-shrink-0 bg-chrome border-b border-line">
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-ghost lg:hidden w-10 h-10 px-0 flex-shrink-0"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <Brand compact className="lg:hidden" />

          <h2 className="hidden lg:block text-base font-semibold tracking-tight truncate text-ink">
            {workspace}
          </h2>

          <div className="flex-1" />

          {/* Discoverability for ⌘K — the shortcut alone is invisible. */}
          <button
            onClick={openPalette}
            className="btn-outline hidden md:inline-flex h-10 gap-2 pr-2"
            aria-label="Open command palette"
          >
            <SearchIcon className="w-4 h-4" />
            <span className="text-xs">Search</span>
            <kbd className="kbd">⌘K</kbd>
          </button>

          <button
            onClick={() => window.dispatchEvent(new Event("taskflow:shortcuts"))}
            className="btn-icon hidden md:inline-flex"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <KeyboardIcon className="w-4 h-4" />
          </button>

          <ThemeToggle />

          <Link
            href="/tasks/new"
            className="btn-icon"
            style={{
              background: "var(--accent)",
              borderColor: "var(--accent)",
              color: "var(--on-accent)",
            }}
            aria-label="Create a new task"
            title="New task"
          >
            <PlusIcon className="w-4 h-4" />
          </Link>

          <Avatar name={userName} solid size="md" className="hidden sm:inline-flex" />
        </header>

        <main id="main-content" className="flex-1 w-full pb-24 lg:pb-10 bg-content">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileTabBar />
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}
