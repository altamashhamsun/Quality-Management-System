"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

async function tryGetSession(
  retries = 2,
  delayMs = 800,
): Promise<import("@supabase/supabase-js").Session | null> {
  for (let i = 0; i <= retries; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    if (i < retries) {
      const { data: r } = await supabase.auth.refreshSession();
      if (r.session) return r.session;
      await new Promise((ok) => setTimeout(ok, delayMs));
    }
  }
  return null;
}

export function useAuth() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const gaveUp = useRef(false);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session) {
          setEmail(session.user.email ?? null);
          setLoading(false);
          gaveUp.current = false;
        } else if (!gaveUp.current) {
          setEmail(null);
        }
      },
    );

    (async () => {
      const session = await tryGetSession();
      if (!active) return;
      if (session) {
        setEmail(session.user.email ?? null);
        setLoading(false);
        return;
      }
      gaveUp.current = true;
      router.replace("/");
    })();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return { email, loading };
}
