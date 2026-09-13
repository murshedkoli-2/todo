import Link from "next/link";
import Brand from "@/components/shell/Brand";
import { TasksIcon, CheckIcon, CashIcon } from "@/components/ui/icons";

interface AuthLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Rendered under the form card, e.g. the "already have an account" link. */
  footer?: React.ReactNode;
}

const HIGHLIGHTS = [
  { icon: <TasksIcon className="w-4 h-4" />, label: "Tasks & Subtasks", copy: "Multi-service workflows, covers & checklist tracking" },
  { icon: <CheckIcon className="w-4 h-4" />, label: "Instant Status", copy: "Live transitions across list, grid and board views" },
  { icon: <CashIcon className="w-4 h-4" />, label: "Installments", copy: "Task pricing, payment tracking & installment schedules" },
];

/**
 * Two-panel auth chrome: a periwinkle brand column on `lg`+ and the form card
 * on the right. Collapses to a single centred column on smaller screens.
 */
export default function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "var(--bg-content)" }}>
      {/* ── Brand panel ─────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Soft accent blooms */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -left-16 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--accent-dim) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -right-10 w-[28rem] h-[28rem] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--purple-soft) 0%, transparent 70%)" }}
        />

        <Link href="/" className="relative z-10 w-fit">
          <Brand />
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-display mb-4">
            Your tasks and your money, in one calm workspace.
          </h2>

          <ul className="flex flex-col gap-3 mt-8">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-card p-3.5"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <span
                  className="w-9 h-9 rounded-well flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {item.label}
                  </span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {item.copy}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "var(--text-muted)" }}>
          TaskFlow · Personal task &amp; finance dashboard
        </p>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="lg:hidden flex justify-center mb-8">
            <Brand />
          </Link>

          <div
            className="rounded-panel p-7 sm:p-8 animate-scale-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h1 className="text-display !text-[2rem]">{title}</h1>
            <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>

            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
