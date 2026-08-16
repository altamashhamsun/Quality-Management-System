"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Branches", path: "/branches" },
  { label: "Calendar", path: "/calendar" },
  { label: "Audit", path: "/audit" },
  { label: "Performances", path: "/performances" },
  { label: "CEO Reporting", path: "/ceo-reporting" },
  { label: "HASM", path: "/hasm" },
  { label: "Incident Log", path: "/incidents" },
  { label: "Settings", path: "/settings" },
] as const;

export default function Header({ email }: { email?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("settings")
      .select("owner_name")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.owner_name) setOwnerName(data.owner_name);
      });
    return () => {
      active = false;
    };
  }, []);

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
    "absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-[0_0_30px_rgba(0,0,0,0.8)]";

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3 sm:px-6">
      <h1 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-2xl">
        Quality and Compliance IOS
      </h1>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-zinc-500 md:inline">
          {ownerName || email}
        </span>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors duration-300 hover:border-zinc-300 hover:text-white"
          >
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
                        ? "bg-zinc-100 text-zinc-950"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {item.label === "Branches" && (
                      <span className="ml-auto rounded border border-zinc-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
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
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
