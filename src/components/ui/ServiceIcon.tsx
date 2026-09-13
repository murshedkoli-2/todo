import React from "react";
import type { TaskService } from "@/lib/serviceCatalogue";

export type IconProps = React.SVGProps<SVGSVGElement>;

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

/* ── Service Icons ──────────────────────────────────────────────────────── */

/**
 * Birth Certificate: Official registry parchment with header fold and ribbon seal.
 */
export const BirthCertificateIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h8.5l4.5 4.5V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v5h4.5M9 11h6M9 14h3" />
    <circle cx="15.5" cy="16.5" r="2" />
    <path d="M14.5 18.5l-.8 2 1.8-.8 1.8.8-.8-2" />
  </Icon>
);

/**
 * Birth Certificate Correction: Parchment with an amendment quill/stylus.
 */
export const BirthCertificateCorrectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3v5h4.5M5 19V4a1 1 0 011-1h8.5l4.5 4.5v2" />
    <path d="M8 11h4M8 15h2" />
    <path d="M13.5 19.5l5-5 2 2-5 5H13.5v-2z" />
  </Icon>
);

/**
 * New NID: National biometric identity card with portrait silhouette and smartchip.
 */
export const NewNidIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="8" cy="10.5" r="2" />
    <path d="M5.5 15.5a2.5 2.5 0 015 0M13.5 9h4M13.5 12h3M13.5 15h2.5" />
  </Icon>
);

/**
 * NID Correction: Identity card with an update/editing stylus.
 */
export const NidCorrectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 8.5V6a1.5 1.5 0 00-1.5-1.5h-13A1.5 1.5 0 003 6v12A1.5 1.5 0 004.5 19.5h6" />
    <circle cx="8" cy="10.5" r="2" />
    <path d="M5.5 15.5a2.5 2.5 0 015 0" />
    <path d="M13.5 19.5l5.5-5.5 1.8 1.8-5.5 5.5H13.5v-1.8z" />
  </Icon>
);

/**
 * New Passport: Official travel booklet with gold biometric globe emblem.
 */
export const NewPassportIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
    <path d="M4.5 7h15" />
    <circle cx="12" cy="13" r="3.2" />
    <path d="M8.8 13h6.4M12 9.8c1.3 1 2 2.1 2 3.2s-.7 2.2-2 3.2M12 9.8c-1.3 1-2 2.1-2 3.2s.7 2.2 2 3.2" />
  </Icon>
);

/**
 * Passport Correction: Travel booklet with an amendment pencil.
 */
export const PassportCorrectionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 9V6a2.5 2.5 0 00-2.5-2.5h-9A2.5 2.5 0 004 6v12a2.5 2.5 0 002.5 2.5h5" />
    <path d="M4 7h12" />
    <circle cx="10" cy="13" r="2.5" />
    <path d="M7.5 13h5M10 10.5a3.5 3.5 0 010 5" />
    <path d="M14 19.5l5-5 1.8 1.8-5 5H14v-1.8z" />
  </Icon>
);

/**
 * Police Clearance: Security verification shield with integrity checkmark.
 */
export const PoliceClearanceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3s7 2.2 7 7.8c0 5.2-3.8 9.2-7 10.2-3.2-1-7-5-7-10.2C5 5.2 12 3 12 3z" />
    <path d="M9 11.5l2.2 2.2 4.3-4.4" />
  </Icon>
);

/**
 * BMET Registration: Manpower and overseas employment (world globe with flight departure).
 */
export const BmetRegistrationIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5s-1.2 6.2-3.5 8.5" />
    <path d="M12 3.5C9.7 5.8 8.5 8.7 8.5 12s1.2 6.2 3.5 8.5" />
    <path d="M14 7l4 2-1.5 2.5 3 1.5-6.5 2.5" />
  </Icon>
);

/**
 * Training Admission: Education mortarboard graduation cap and academic scroll.
 */
export const TrainingAdmissionIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5z" />
    <path d="M6 11.8v4.7c0 1.8 2.7 3.5 6 3.5s6-1.7 6-3.5v-4.7" />
    <path d="M21.5 10v6" />
  </Icon>
);

/* ── Mapping and Dispatcher ──────────────────────────────────────────────── */

export const SERVICE_ICONS: Record<TaskService, React.ComponentType<IconProps>> = {
  birth_certificate: BirthCertificateIcon,
  birth_certificate_correction: BirthCertificateCorrectionIcon,
  new_nid: NewNidIcon,
  nid_correction: NidCorrectionIcon,
  new_passport: NewPassportIcon,
  passport_correction: PassportCorrectionIcon,
  police_clearance: PoliceClearanceIcon,
  bmet_registration: BmetRegistrationIcon,
  training_admission: TrainingAdmissionIcon,
};

interface ServiceIconProps extends IconProps {
  service: TaskService;
}

export function ServiceIcon({ service, ...props }: ServiceIconProps) {
  const Component = SERVICE_ICONS[service] ?? BirthCertificateIcon;
  return <Component {...props} />;
}

export default ServiceIcon;
