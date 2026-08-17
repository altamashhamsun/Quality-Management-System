"use client";

import { ThemeProvider } from "@/lib/theme-context";
import type { ReactNode } from "react";

export default function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
