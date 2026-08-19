"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LAST_PAGE_KEY = "lastVisitedPage";
const IGNORE_PREFIXES = ["/public", "/welcome", "/seed-fsl-areas"];
const IGNORE_PATHS = ["/"];

function shouldIgnore(path: string): boolean {
  if (IGNORE_PATHS.includes(path)) return true;
  return IGNORE_PREFIXES.some((p) => path.startsWith(p));
}

export function useTrackPage() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || shouldIgnore(pathname)) return;
    try {
      window.localStorage.setItem(LAST_PAGE_KEY, pathname);
    } catch {}
  }, [pathname]);
}

export function getLastPage(): string {
  try {
    const saved = window.localStorage.getItem(LAST_PAGE_KEY);
    if (saved && saved !== "/") return saved;
  } catch {}
  return "/branches";
}
