"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Theme = "dark" | "light" | "navy";

const ThemeCtx = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("app-theme") as Theme | null;
    if (stored && ["dark", "light", "navy"].includes(stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("app-theme", t);
  }

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
