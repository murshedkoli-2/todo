import type { Config } from "tailwindcss";

/**
 * Colours here mirror the CSS custom properties in `globals.css` so utility
 * classes and token-driven inline styles stay in sync. Anything theme-aware
 * should reference the `var(--…)` entries rather than the raw hex values.
 *
 * Prefer these utilities over `style={{ color: "var(--text-secondary)" }}`:
 * the utility form supports `hover:`, `focus:` and responsive variants, which
 * an inline style cannot express.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-primary)",
        chrome: "var(--bg-secondary)",
        content: "var(--bg-content)",
        surface: {
          DEFAULT: "var(--bg-card)",
          hover: "var(--bg-card-hover)",
        },
        sunken: "var(--bg-sunken)",
        line: {
          DEFAULT: "var(--border)",
          hover: "var(--border-hover)",
        },
        ink: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          dim: "var(--accent-dim)",
          ink: "var(--accent-ink)",
        },
        status: {
          todo: "var(--accent)",
          in_progress: "var(--yellow)",
          completed: "var(--green)",
          overdue: "var(--red)",
        },
        positive: {
          DEFAULT: "var(--green)",
          soft: "var(--green-soft)",
          ink: "var(--green-ink)",
        },
        negative: {
          DEFAULT: "var(--red)",
          soft: "var(--red-soft)",
          ink: "var(--red-ink)",
        },
        warning: {
          DEFAULT: "var(--yellow)",
          soft: "var(--yellow-soft)",
          ink: "var(--yellow-ink)",
        },
        violet: {
          DEFAULT: "var(--purple)",
          soft: "var(--purple-soft)",
          ink: "var(--purple-ink)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Instrument Serif", "Georgia", "serif"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        well: "var(--radius-well)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        flat: "var(--elevation-flat)",
        raised: "var(--elevation-raised)",
        floating: "var(--elevation-floating)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        popup: "var(--shadow-popup)",
        modal: "var(--shadow-modal)",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
      },
      screens: {
        xs: "420px",
      },
    },
  },
  plugins: [],
};

export default config;
