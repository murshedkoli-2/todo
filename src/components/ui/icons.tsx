/**
 * Shared 24×24 stroke icon set.
 *
 * Every icon takes the standard SVG props, so sizing and colour come from
 * `className` (`w-4 h-4`) and `currentColor` at the call site.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────────── */
export const TasksIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 12l2.5 2.5L16 9.5" />
  </Icon>
);

export const LedgerIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4H18a2 2 0 012 2v12a2 2 0 01-2 2H5.5A1.5 1.5 0 014 18.5z" />
    <path d="M8 4v16M11.5 9h5M11.5 13h3" />
  </Icon>
);

export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5A2.5 2.5 0 015.5 6H18a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3z" />
    <path d="M3 9h15M16.5 13.5h.01" />
  </Icon>
);

/* ── Actions ────────────────────────────────────────────────────────────── */
export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4l10.5-10.5a2.12 2.12 0 00-3-3L5 17v3z" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12.5A1.5 1.5 0 008.5 21h7a1.5 1.5 0 001.5-1.5L18 7" />
    <path d="M10 11.5v5M14 11.5v5" />
  </Icon>
);

export const SortIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h13M4 12h9M4 17h5" /></Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M6 9l6 6 6-6" /></Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M9 6l6 6-6 6" /></Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M15 6l-6 6 6 6" /></Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} {...p}><path d="M5 13l4 4L19 7" /></Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} {...p}>
    <circle cx="12" cy="5" r="0.6" /><circle cx="12" cy="12" r="0.6" /><circle cx="12" cy="19" r="0.6" />
  </Icon>
);

export const SignOutIcon = (p: IconProps) => (
  <Icon {...p}><path d="M15 16l4-4-4-4M19 12H9M11 5H7a2 2 0 00-2 2v10a2 2 0 002 2h4" /></Icon>
);

/* ── Status & meta ──────────────────────────────────────────────────────── */
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16h.01" /></Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M4 17l4.5-4.5a2 2 0 012.8 0L20 20" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0113 0M16.5 5.2a3.5 3.5 0 010 5.6M18 14.2a6.5 6.5 0 013.5 5.8" />
  </Icon>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M12 5v14M18 13l-6 6-6-6" /></Icon>
);

export const ScalesIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 005 0zM19 8l2.5 6a3 3 0 01-5 0z" /></Icon>
);

export const CashIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </Icon>
);

export const BankIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3.5 10h17M12 3.5L20.5 8h-17zM6 10v7M10 10v7M14 10v7M18 10v7M3.5 20.5h17" /></Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></Icon>
);

export const BoardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
    <rect x="15.5" y="4" width="5" height="14" rx="1.5" />
  </Icon>
);

export const CommandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 10 3 3z" />
  </Icon>
);

export const TrendUpIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></Icon>
);

export const TrendDownIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}><path d="M3 7l6 6 4-4 8 8M15 17h6v-6" /></Icon>
);

export const SpinnerIcon = ({ className = "", ...p }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-spin ${className}`}
    aria-hidden="true"
    {...p}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
