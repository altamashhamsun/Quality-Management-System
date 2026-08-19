"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

export function useAuth({ redirect = true } = {}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session) {
          setEmail(session.user.email ?? null);
          setLoading(false);
        } else {
          setEmail(null);
          setLoading(false);
          if (redirect) router.replace("/");
        }
      },
    );

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setLoading(false);
      } else {
        setLoading(false);
        if (redirect) router.replace("/");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router, redirect]);

  return { email, loading };
}
