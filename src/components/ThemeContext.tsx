"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const STORAGE_KEY = "theme";
/** Matches the `html.theme-switching` rule in `globals.css`. */
const SWITCHING_CLASS = "theme-switching";
const SWITCHING_RESET_MS = 60;

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the default; the inline script in the root layout has already
  // applied the stored preference before first paint, so this only syncs state.
  const [theme, setTheme] = useState<Theme>("light");

  /*
   * Whether the stored preference has been read yet.
   *
   * The state above has to start as `light` so the client's first render
   * matches the server's, but that meant the apply-effect below ran once with
   * `light` before the read-effect had a chance to correct it — repainting the
   * page light and writing `"light"` over the stored `"dark"`, on every single
   * load. A dark-mode user saw the flash the inline script exists to prevent.
   *
   * Gating the apply-effect on this leaves the pre-paint class alone until the
   * provider actually knows what the preference is.
   */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") setTheme(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;

    // Suppress transitions across the swap so no element stays painted in the
    // outgoing theme (browsers do not re-target transitions on `var()` changes).
    root.classList.add(SWITCHING_CLASS);
    root.classList.toggle("light", theme === "light");

    // Force a synchronous recalc while transitions are still off, so every
    // element commits the new token values before they are re-enabled.
    void root.offsetHeight;

    localStorage.setItem(STORAGE_KEY, theme);

    const timer = setTimeout(() => root.classList.remove(SWITCHING_CLASS), SWITCHING_RESET_MS);
    return () => clearTimeout(timer);
  }, [theme, hydrated]);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
