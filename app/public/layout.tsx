"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { label: "NCRs", path: "/public/ncrs" },
  { label: "Performances", path: "/public/performances" },
  { label: "Calendar", path: "/public/calendar" },
  { label: "Audit", path: "/public/audit" },
  { label: "HASM", path: "/public/hasm" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-[#050507] font-sans">
      <header className="border-b border-zinc-800/80 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">
              Quality and Compliance IOS
            </h1>
            <span className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
              Public View
            </span>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
          >
            Sign In
          </Link>
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
                    ? "border-zinc-300 bg-zinc-100 text-zinc-950"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
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
      <footer className="border-t border-zinc-800/80 px-4 py-3 text-center text-[11px] text-zinc-600">
        Public View is read-only. For full access please sign in.
      </footer>
    </div>
  );
}
