"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Branches", path: "/branches", dot: "bg-cyan-400" },
  { label: "Calendar", path: "/calendar", dot: "bg-pink-400" },
  { label: "Audit", path: "/audit", dot: "bg-violet-400" },
] as const;

export default function Header({ email }: { email?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const currentItem =
    NAV_ITEMS.find((item) => pathname.startsWith(item.path)) ?? NAV_ITEMS[0];

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const dropdownClass =
    "absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[0_0_30px_rgba(0,0,0,0.8)]";

  return (
    <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 sm:px-6">
      <h1 className="neon-text-cyan text-xl font-bold tracking-tight sm:text-2xl">
        Compliance IOS
      </h1>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-zinc-500 md:inline">
          {email}
        </span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/50 px-3 py-1.5 text-sm font-medium text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all duration-300 hover:bg-cyan-400/10 hover:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
          >
            <span className={`h-2 w-2 rounded-full ${currentItem.dot}`} />
            {currentItem.label}
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            >
              <path
                d="M1 1l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {open && (
            <div className={dropdownClass}>
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "bg-cyan-400/10 text-cyan-300"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-cyan-200"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    {item.label}
                    {item.label === "Branches" && (
                      <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                        Default
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-pink-500/60 hover:text-pink-400"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
