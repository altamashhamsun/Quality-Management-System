"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  LogOut,
  ShieldCheck,
  ClipboardList,
  FileCheck,
  CalendarClock,
  ArrowUpRight,
} from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-[#EEF1F6]">
      {/* header */}
      <header className="bg-[#0B1F3A] text-white h-16 shrink-0 flex items-center px-6 gap-3 shadow-md z-10">
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

      {/* content */}
      <div className="flex-1 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {/* page heading */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
              <ShieldCheck className="w-4 h-4" /> Workspace
            </div>
            <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-navy">
              Welcome back, {userEmail?.split("@")[0] || "User"}
            </h1>
            <p className="text-[15px] text-slate-500 mt-1.5">
              Choose a module to get started.
            </p>
          </div>

          {/* Audit Management hero tile — with soft shading */}
          <button
            className="group w-full bg-white rounded-2xl border border-white p-8 md:p-10 flex items-center gap-6 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            style={{
              boxShadow:
                "0 20px 50px -12px rgba(11,31,58,0.25), 0 8px 24px -12px rgba(37,99,235,0.12)",
            }}
            onClick={() => {}}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/40">
              <ClipboardCheck className="w-9 h-9 md:w-10 md:h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight text-navy">
                Audit Management
              </h2>
              <p className="text-[14px] text-slate-500 mt-1.5">
                Plan, conduct and track audits, findings and corrective actions
                across your organization.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </button>

          {/* supporting modules */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
            <ModuleTile
              icon={ClipboardList}
              label="Quality Records"
              desc="Manage QMS records"
            />
            <ModuleTile
              icon={FileCheck}
              label="Nonconformities"
              desc="Track and close NCRs"
            />
            <ModuleTile
              icon={CalendarClock}
              label="Audit Calendar"
              desc="Schedule upcoming audits"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleTile({
  icon: Icon,
  label,
  desc,
}: {
  icon: any;
  label: string;
  desc: string;
}) {
  return (
    <button
      className="group bg-white rounded-2xl border border-white p-6 flex items-center gap-4 text-left transition-all duration-300 hover:-translate-y-1"
      style={{
        boxShadow:
          "0 14px 34px -10px rgba(11,31,58,0.18), 0 6px 18px -10px rgba(37,99,235,0.10)",
      }}
      onClick={() => {}}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-navy">{label}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 truncate">{desc}</p>
      </div>
    </button>
  );
}
