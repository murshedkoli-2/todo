"use client";

import { useTheme } from "@/components/ThemeContext";
import { SunIcon, MoonIcon } from "@/components/ui/icons";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      id="theme-toggle-btn"
      className="btn-icon relative overflow-hidden"
    >
      <SunIcon
        className="w-4 h-4 absolute transition-all duration-300"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? "none" : "rotate(80deg) scale(0.4)",
        }}
      />
      <MoonIcon
        className="w-4 h-4 absolute transition-all duration-300"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? "rotate(-80deg) scale(0.4)" : "none",
        }}
      />
    </button>
  );
}
