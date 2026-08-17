"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const TABS = [
  { label: "NCRs", path: "/public/ncrs" },
  { label: "Performances", path: "/public/performances" },
  { label: "Calendar", path: "/public/calendar" },
  { label: "Audit", path: "/public/audit" },
  { label: "HASM", path: "/public/hasm" },
  { label: "Quality Control", path: "/public/quality-control" },
  { label: "Incidents", path: "/public/incidents" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-page font-sans">
      <header className="border-b border-bdr px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-txt">
              Quality and Compliance IOS
            </h1>
            <span className="rounded border border-bdr-h px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-txt-s">
              Public View
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Link
              href="/"
              className="rounded-lg border border-bdr-h px-3 py-1.5 text-sm text-txt-s transition-colors hover:border-txt hover:text-txt"
            >
              Sign In
            </Link>
          </div>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-txt bg-card-h text-txt"
                    : "border-bdr text-txt-s hover:border-bdr-h hover:text-txt"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-bdr px-4 py-3 text-center text-[11px] text-txt-s">
        Public View is read-only. For full access please sign in.
      </footer>
    </div>
  );
}
