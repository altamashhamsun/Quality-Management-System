"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ClipboardCheck,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Invalid email or password."
          : error.message
      );
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const fieldClass =
    "w-full h-[54px] px-4 text-[15px] text-navy placeholder:text-slate-400 bg-white border border-slate-200 rounded-[10px] focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition";

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* ============ LEFT: BRANDING ============ */}
      <div className="hidden lg:flex flex-col w-[45%] bg-deep-navy text-white relative overflow-hidden">
        {/* subtle background pattern: fine grid + points */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "160px 160px",
            backgroundPosition: "60px 60px",
          }}
        />
        {/* soft top glow, subtle */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

        {/* brand lockup */}
        <div className="relative z-10 px-10 md:px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-semibold tracking-tight">
                Audit Portal
              </span>
            </div>
          </div>
        </div>

        {/* centered main content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 md:px-12">
          <div className="max-w-[400px]">
            {/* eyebrow */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[12px] font-medium tracking-[0.12em] uppercase text-blue-200/80">
                Compliance platform
              </span>
            </div>

            <h2 className="text-[46px] md:text-[52px] leading-[1.05] font-semibold tracking-tight">
              Quality.
              <br />
              Compliance.
              <br />
              Confidence.
            </h2>

            <p className="mt-7 text-[15px] leading-relaxed text-blue-100/65 max-w-[360px]">
              One centralized platform to manage audits, findings, corrective
              actions and compliance across your organization.
            </p>

            {/* audit workflow visualization */}
            <div className="mt-10 max-w-[340px]">
              <WorkflowVisual />
            </div>
          </div>
        </div>

        {/* bottom badges */}
        <div className="relative z-10 px-10 md:px-12 pb-10">
          <div className="flex items-center gap-5 text-[12px] text-blue-100/50 font-medium">
            <span className="tracking-wide">ISO 9001</span>
            <span className="w-px h-3 bg-white/15" />
            <span className="tracking-wide">ISO 45001</span>
            <span className="w-px h-3 bg-white/15" />
            <span className="tracking-wide">ISO 22000</span>
            <span className="flex-1" />
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Secure access
            </span>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: AUTH ============ */}
      <div className="flex flex-col flex-1 bg-[#F8FAFC]">
        {/* top bar (mobile brand + desktop spacer) */}
        <div className="lg:hidden flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold text-navy">Audit Portal</span>
          </div>
        </div>

        {/* centered auth */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-10">
              <div className="text-[12px] font-medium tracking-[0.14em] text-slate-500 mb-3">
                AUDIT MANAGEMENT PORTAL
              </div>
              <h1 className="text-[38px] md:text-[40px] leading-tight font-bold tracking-tight text-navy">
                Welcome back
              </h1>
              <p className="text-[15px] text-slate-500 mt-3">
                Sign in to continue to your workspace.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-2.5 p-3.5 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-navy"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className={fieldClass}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-navy"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="text-[13px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className={`${fieldClass} pr-14`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="group w-full h-[54px] bg-blue-600 text-white rounded-[10px] font-semibold text-[15px] hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-blue-700/30 hover:-translate-y-px"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-center">
              <p className="text-[13px] text-slate-400">
                © 2026 Audit Portal ·{" "}
                <span className="text-slate-500">Secure Access</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowVisual() {
  return (
    <div className="relative">
      {/* vertical connecting line */}
      <div className="absolute left-[17px] top-5 bottom-5 w-px bg-gradient-to-b from-white/10 via-white/20 to-white/10" />

      <div className="relative space-y-5">
        <WorkflowStep
          step="01"
          label="Audit"
          states={["Planned", "In progress", "Completed"]}
          index={0}
        />
        <WorkflowStep
          step="02"
          label="Findings"
          states={["Logged", "Assigned", "Accepted"]}
          index={1}
        />
        <WorkflowStep
          step="03"
          label="Corrective action"
          states={["Open", "In review", "Verified"]}
          index={2}
        />
        <WorkflowStep
          step="04"
          label="Closure"
          states={["Approved", "Closed"]}
          index={3}
          complete
        />
      </div>
    </div>
  );
}

function WorkflowStep({
  step,
  label,
  states,
  index,
  complete,
}: {
  step: string;
  label: string;
  states: string[];
  index: number;
  complete?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3.5">
      {/* status node */}
      <div
        className={`relative z-10 w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ${
          complete
            ? "bg-blue-600 text-white"
            : "bg-white/5 border border-white/15 text-blue-200"
        }`}
      >
        {complete ? (
          <Check className="w-[18px] h-[18px]" />
        ) : (
          <span className="text-[11px] font-semibold">{step}</span>
        )}
      </div>

      {/* label + status pills */}
      <div className="flex items-center justify-between flex-1 min-w-0">
        <div>
          <p className="text-[14px] font-medium text-white/90">{label}</p>
          <p className="text-[11px] text-blue-100/40 mt-0.5">
            {states[index % states.length]}
          </p>
        </div>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            complete
              ? "bg-blue-600/20 text-blue-200"
              : "bg-white/5 text-blue-100/50 border border-white/10"
          }`}
        >
          {complete ? "Complete" : index === 0 ? "Active" : "Pending"}
        </span>
      </div>
    </div>
  );
}
