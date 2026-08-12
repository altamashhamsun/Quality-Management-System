"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      router.replace("/branches");
    });
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-[#050507] font-sans">
      <p className="neon-text-cyan text-sm">Loading...</p>
    </div>
  );
}
