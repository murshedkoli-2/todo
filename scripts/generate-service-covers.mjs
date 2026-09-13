/**
 * Generates standalone vector SVG feature images for each service in `public/services/`.
 *
 * Each service gets an editorial, jewel-toned 1200x630 vector banner featuring:
 * - Color-matched Aurora gradient background
 * - Concentric guilloche curves and mesh grid line textures
 * - Glassmorphic emblem badge with the official service icon
 * - Clean typographic category and service label
 *
 * Run via:
 *   node scripts/generate-service-covers.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SERVICES = [
  {
    key: "birth_certificate",
    label: "Birth Certificate",
    category: "Civil Registration",
    from: "#033221",
    to: "#09633e",
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.35)",
    iconPath: `<path d="M12 6h17l9 9v26a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M28 6v10h10M18 22h12M18 28h6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="31" cy="33" r="4" stroke="currentColor" stroke-width="3"/>
      <path d="M29 37l-1.5 4 3.5-1.5 3.5 1.5-1.5-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "birth_certificate_correction",
    label: "Birth Certificate Correction",
    category: "Civil Registration · Amendment",
    from: "#042c1d",
    to: "#0a5637",
    accent: "#34d399",
    glow: "rgba(52, 211, 153, 0.35)",
    iconPath: `<path d="M28 6v10h10M10 38V8a2 2 0 012-2h17l9 9v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 22h8M16 30h4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 39l10-10 4 4-10 10H27v-4z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "new_nid",
    label: "New NID",
    category: "Identity Services",
    from: "#171447",
    to: "#372e9c",
    accent: "#6366f1",
    glow: "rgba(99, 102, 241, 0.38)",
    iconPath: `<rect x="6" y="9" width="36" height="30" rx="5" stroke="currentColor" stroke-width="3"/>
      <circle cx="16" cy="21" r="4" stroke="currentColor" stroke-width="3"/>
      <path d="M11 31a5 5 0 0110 0M27 18h8M27 24h6M27 30h5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    key: "nid_correction",
    label: "NID Correction",
    category: "Identity Services · Update",
    from: "#1e1346",
    to: "#43288f",
    accent: "#818cf8",
    glow: "rgba(129, 140, 248, 0.38)",
    iconPath: `<path d="M38 17V12a3 3 0 00-3-3H9a3 3 0 00-3 3v24a3 3 0 003 3h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="16" cy="21" r="4" stroke="currentColor" stroke-width="3"/>
      <path d="M11 31a5 5 0 0110 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <path d="M27 39l11-11 3.5 3.5-11 11H27v-3.5z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "new_passport",
    label: "New Passport",
    category: "Travel & Immigration",
    from: "#2c0e4a",
    to: "#581b8e",
    accent: "#c084fc",
    glow: "rgba(192, 132, 252, 0.35)",
    iconPath: `<rect x="9" y="7" width="30" height="34" rx="5" stroke="currentColor" stroke-width="3"/>
      <path d="M9 14h30" stroke="currentColor" stroke-width="3"/>
      <circle cx="24" cy="26" r="6.5" stroke="currentColor" stroke-width="3"/>
      <path d="M17.5 26h13M24 19.5c2.5 2 4 4.2 4 6.5s-1.5 4.5-4 6.5M24 19.5c-2.5 2-4 4.2-4 6.5s1.5 4.5 4 6.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
  },
  {
    key: "passport_correction",
    label: "Passport Correction",
    category: "Travel & Immigration · Amendment",
    from: "#330d4a",
    to: "#5b1d7d",
    accent: "#d8b4fe",
    glow: "rgba(216, 180, 254, 0.35)",
    iconPath: `<path d="M36 18v-6a5 5 0 00-5-5H13a5 5 0 00-5 5v24a5 5 0 005 5h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <path d="M8 14h24" stroke="currentColor" stroke-width="3"/>
      <circle cx="20" cy="26" r="5" stroke="currentColor" stroke-width="3"/>
      <path d="M15 26h10M20 21a7 7 0 010 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M28 39l10-10 3.5 3.5-10 10H28v-3.5z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "police_clearance",
    label: "Police Clearance",
    category: "Verification & Security",
    from: "#3d1806",
    to: "#78350f",
    accent: "#f97316",
    glow: "rgba(249, 115, 22, 0.38)",
    iconPath: `<path d="M24 6s14 4.5 14 15.5c0 10.5-7.5 18.5-14 20.5-6.5-2-14-10-14-20.5C10 10.5 24 6 24 6z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 23l4.5 4.5 8.5-9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "bmet_registration",
    label: "BMET Registration",
    category: "Overseas Employment",
    from: "#352204",
    to: "#784b06",
    accent: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.38)",
    iconPath: `<circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="3"/>
      <path d="M7 24h34M24 7c4.6 4.6 7 10.4 7 17s-2.4 12.4-7 17M24 7c-4.6 4.6-7 10.4-7 17s2.4 12.4 7 17" stroke="currentColor" stroke-width="2.5"/>
      <path d="M28 14l8 4-3 5 6 3-13 5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    key: "training_admission",
    label: "Training Admission",
    category: "Professional Training",
    from: "#2c2406",
    to: "#6b5409",
    accent: "#fde047",
    glow: "rgba(253, 224, 71, 0.38)",
    iconPath: `<path d="M5 19L24 10l19 9-19 9-19-9z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 23.5v9.5c0 3.6 5.4 7 12 7s12-3.4 12-7v-9.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M43 20v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  },
];

function generateCoverSvg(service) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad_${service.key}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${service.from}" />
      <stop offset="60%" stop-color="${service.to}" />
      <stop offset="100%" stop-color="${service.from}" />
    </linearGradient>

    <!-- Ambient Radial Glow -->
    <radialGradient id="radialGlow_${service.key}" cx="75%" cy="30%" r="55%">
      <stop offset="0%" stop-color="${service.accent}" stop-opacity="0.28" />
      <stop offset="100%" stop-color="${service.accent}" stop-opacity="0" />
    </radialGradient>

    <!-- Glassmorphism Badge Gradient -->
    <linearGradient id="badgeGrad_${service.key}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04" />
    </linearGradient>

    <linearGradient id="badgeBorder_${service.key}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${service.accent}" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.1" />
    </linearGradient>

    <!-- Dot Lattice Pattern -->
    <pattern id="dots_${service.key}" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="#ffffff" fill-opacity="0.06" />
    </pattern>
  </defs>

  <!-- Base background -->
  <rect width="1200" height="630" fill="url(#bgGrad_${service.key})" />
  <rect width="1200" height="630" fill="url(#radialGlow_${service.key})" />
  <rect width="1200" height="630" fill="url(#dots_${service.key})" />

  <!-- Geometric Security Guilloche Curves -->
  <g opacity="0.12" stroke="${service.accent}" fill="none" stroke-width="1.2">
    <ellipse cx="900" cy="315" rx="420" ry="240" transform="rotate(-15 900 315)" />
    <ellipse cx="900" cy="315" rx="380" ry="210" transform="rotate(-10 900 315)" />
    <ellipse cx="900" cy="315" rx="340" ry="180" transform="rotate(-5 900 315)" />
    <ellipse cx="900" cy="315" rx="300" ry="150" />
    <ellipse cx="900" cy="315" rx="260" ry="120" transform="rotate(5 900 315)" />
    <ellipse cx="900" cy="315" rx="220" ry="90" transform="rotate(10 900 315)" />
  </g>

  <!-- Large Watermark Icon in background right -->
  <g transform="translate(820, 155) scale(6.6)" opacity="0.08" stroke="${service.accent}" fill="none">
    ${service.iconPath}
  </g>

  <!-- Left Content Panel / Glassmorphic Showcase -->
  <g transform="translate(100, 140)">
    <!-- Service Category Tag -->
    <rect x="0" y="0" width="260" height="36" rx="18" fill="${service.accent}" fill-opacity="0.16" stroke="${service.accent}" stroke-opacity="0.35" stroke-width="1.2" />
    <text x="24" y="23" fill="${service.accent}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5" text-transform="uppercase">
      ${service.category}
    </text>

    <!-- Main Service Title -->
    <text x="0" y="95" fill="#ffffff" font-family="'Newsreader', Georgia, serif" font-size="52" font-weight="600" letter-spacing="-0.8">
      ${service.label}
    </text>

    <!-- Official Service Badge Card -->
    <g transform="translate(0, 135)">
      <rect width="480" height="110" rx="18" fill="url(#badgeGrad_${service.key})" stroke="url(#badgeBorder_${service.key})" stroke-width="1.5" />
      
      <!-- Icon Container -->
      <rect x="22" y="21" width="68" height="68" rx="14" fill="${service.accent}" fill-opacity="0.2" stroke="${service.accent}" stroke-opacity="0.5" stroke-width="1.5" />
      <g transform="translate(32, 31) scale(1)" stroke="${service.accent}" fill="none">
        ${service.iconPath}
      </g>

      <!-- Badge Text -->
      <text x="108" y="50" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600">
        Standard Desk Service
      </text>
      <text x="108" y="74" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="14">
        Official workflow &amp; document tracking
      </text>
    </g>
  </g>

  <!-- Bottom Accent Strip -->
  <rect x="0" y="622" width="1200" height="8" fill="${service.accent}" opacity="0.8" />
</svg>`;
}

const outDir = join(process.cwd(), "public", "services");
mkdirSync(outDir, { recursive: true });

for (const service of SERVICES) {
  const svg = generateCoverSvg(service);
  const target = join(outDir, `${service.key}.svg`);
  writeFileSync(target, svg, "utf8");
  console.log(`Wrote ${target}`);
}

console.log(`Generated ${SERVICES.length} service cover SVGs in public/services/`);
