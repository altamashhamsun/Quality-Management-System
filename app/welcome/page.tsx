"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getLastPage } from "@/lib/useTrackPage";

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/");
        return;
      }
      router.replace(getLastPage());
    });
    return () => { active = false; };
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-[#050507] font-sans">
      <p className="text-sm text-zinc-400">Loading...</p>
    </div>
  );
}
