import { TasksIcon, LedgerIcon, WalletIcon } from "@/components/ui/icons";

export interface NavSection {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  description: string;
}

/** Single source of truth for the sidebar, mobile drawer, and bottom tab bar. */
export const NAV_SECTIONS: NavSection[] = [
  { href: "/",       label: "Tasks",  icon: TasksIcon,  description: "Plan and track your work" },
  { href: "/ledger", label: "Ledger", icon: LedgerIcon, description: "Receivables and payables" },
  { href: "/wallet", label: "Wallet", icon: WalletIcon, description: "Cash, mobile and bank balances" },
];

export function isActiveSection(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/tasks");
  return pathname === href || pathname.startsWith(`${href}/`);
}
