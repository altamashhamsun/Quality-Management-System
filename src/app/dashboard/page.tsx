"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserEmail(user.email ?? null);
      setLoading(false);
    };
    init();
  }, [router]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-blue-600 animate-pulse flex items-center gap-2 text-[15px] font-medium">
          <ShieldCheck className="w-6 h-6" /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* simple header */}
      <header className="bg-[#0B1F3A] text-white h-16 shrink-0 flex items-center px-6 gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">
            Audit Portal
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-[13px] text-blue-200/70 hidden sm:block">
            {userEmail}
          </span>
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
            {userEmail ? userEmail[0].toUpperCase() : "U"}
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-[13px] font-medium"
          title="Sign out"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span className="hidden md:inline">Sign out</span>
        </button>
      </header>

      {/* centered single tile */}
      <div className="flex-1 flex items-center justify-center p-6">
        <button
          className="group w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 p-8 flex flex-col items-center text-center"
          onClick={() => {}}
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-navy mt-5">
            Audit Management
          </h1>
          <p className="text-[14px] text-slate-500 mt-2">
            Open the audit management module
          </p>
        </button>
      </div>
    </div>
  );
}
