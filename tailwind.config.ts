import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          primary:   "#0e1217",
          secondary: "#161b22",
          card:      "#1c2128",
          "card-hover": "#21262d",
        },
        accent: {
          DEFAULT: "#4493f8",
          hover:   "#58a6ff",
          dim:     "rgba(68,147,248,0.15)",
        },
        status: {
          todo:        "#4493f8",
          in_progress: "#e3b341",
          completed:   "#3fb950",
          overdue:     "#f85149",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.3)",
        "card-hover": "0 1px 0 rgba(255,255,255,0.1), 0 8px 28px rgba(0,0,0,0.45)",
        glow: "0 0 0 3px rgba(68,147,248,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
