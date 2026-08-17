"use client";

import { useTheme, type Theme } from "@/lib/theme-context";

const LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  navy: "Navy",
};

const NEXT: Record<Theme, Theme> = {
  dark: "light",
  light: "navy",
  navy: "dark",
};

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(NEXT[theme])}
      className="rounded-lg border border-bdr px-2.5 py-1.5 text-xs font-medium text-txt-s transition hover:bg-card-h hover:text-txt"
      title={`Current: ${LABELS[theme]}. Click to cycle.`}
    >
      {LABELS[theme]}
    </button>
  );
}
