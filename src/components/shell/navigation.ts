import {
  OverviewIcon, TasksIcon,
} from "@/components/ui/icons";

export interface NavSection {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  description: string;
}

/** Single source of truth for the sidebar, mobile drawer, and bottom tab bar. */
export const NAV_SECTIONS: NavSection[] = [
  { href: "/",      label: "Overview", icon: OverviewIcon, description: "Everything at a glance" },
  { href: "/tasks", label: "Tasks",    icon: TasksIcon,    description: "Plan and track your work" },
];

/**
 * `/` matches exactly and nothing else.
 *
 * It used to stand in for the task list, so it claimed `/tasks*` too. Now that
 * the overview lives there and tasks have a section of their own, a prefix
 * match would light up both rows at once on every task page.
 */
export function isActiveSection(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
