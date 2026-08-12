"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Welcome() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Welcome!
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You are signed in as
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">
          {email}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-8 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
