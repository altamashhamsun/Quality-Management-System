"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

export function useAuth() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let redirecting = false;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setEmail(session.user.email ?? null);
          setLoading(false);
        } else if (!redirecting) {
          // Do NOT redirect here: on first load the listener may fire with
          // null before getSession/refresh resolves. Redirect only after we
          // confirmed there is genuinely no recoverable session.
          setEmail(null);
        }
      },
    );

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setEmail(data.session.user.email ?? null);
          setLoading(false);
          return;
        }
        // Access token may have expired while the app was closed. Try to
        // refresh the session (using the persisted refresh token) before
        // treating the user as logged out.
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshed.session) {
          setEmail(refreshed.session.user.email ?? null);
          setLoading(false);
          return;
        }
      } catch {
        // Network/storage glitch: don't force a sign-out because of it.
        // The auth listener above will still surface any real session.
        if (!active) return;
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          setEmail(data.session.user.email ?? null);
          setLoading(false);
          return;
        }
        redirecting = true;
        router.replace("/");
        return;
      }
      redirecting = true;
      router.replace("/");
    })();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return { email, loading };
}
