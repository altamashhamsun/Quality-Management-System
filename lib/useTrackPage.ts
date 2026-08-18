"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LAST_PAGE_KEY = "lastVisitedPage";
const IGNORE_PATHS = ["/", "/public", "/public/ncrs", "/public/audit", "/public/calendar", "/public/hasm", "/public/quality-control", "/public/incidents", "/public/performances"];

export function useTrackPage() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || IGNORE_PATHS.includes(pathname)) return;
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
