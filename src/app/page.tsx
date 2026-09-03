"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ClipboardCheck,
  Eye,
  EyeOff,
  ShieldCheck,
  FileCheck2,
  CheckCircle2,
  BarChart3,
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
    "w-full h-11 px-4 text-[15px] text-slate-900 placeholder:text-slate-400 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition";

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ===== LEFT: BRANDING ===== */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#0f1f3d] text-white relative overflow-hidden p-12">
        {/* subtle geometric / audit-inspired visual */}
        <div className="absolute inset-0 opacity-[0.05]">
          <div className="absolute right-0 top-0 h-full w-full">
            <svg
              className="w-full h-full"
              viewBox="0 0 600 800"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 500Q150 520 300 500T600 480V800H0Z"
                fill="#ffffff"
              />
              <path
                d="M0 580Q180 550 340 590T600 560V800H0Z"
                fill="#ffffff"
              />
              <path d="M0 660Q200 640 400 680T600 650V800H0Z" fill="#4f7dff" />
            </svg>
          </div>
        </div>
        {/* dotted grid pattern (audit/checklist-inspired) */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">
              Audit Portal
            </span>
          </div>
        </div>

        {/* headline */}
        <div className="relative z-10 max-w-sm">
          <h2 className="text-[28px] font-semibold leading-tight mb-4">
            Quality. Compliance.
            <br />
            Continuous improvement.
          </h2>
          <p className="text-blue-100/70 text-[15px] leading-relaxed">
            A unified portal to plan, conduct, and track audits across your
            organization while maintaining ISO-aligned quality standards.
          </p>

          {/* visual trust markers */}
          <div className="mt-10 grid grid-cols-1 gap-4">
            <TrustRow
              icon={ShieldCheck}
              title="Integrated compliance"
              desc="Keep every control, finding, and action traceable."
            />
            <TrustRow
              icon={FileCheck2}
              title="Audit-ready records"
              desc="Evidence captured in a clear, structured format."
            />
            <TrustRow
              icon={BarChart3}
              title="Operational insight"
              desc="Track performance and close gaps with confidence."
            />
          </div>
        </div>

        {/* footer */}
        <div className="relative z-10 flex items-center gap-6 text-[13px] text-blue-100/50">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> ISO 9001
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> Secure access
          </span>
        </div>
      </div>

      {/* ===== RIGHT: LOGIN ===== */}
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-10 bg-slate-50">
        {/* mobile brand */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold text-slate-900">
            Audit Portal
          </span>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-[15px] text-slate-500 mt-2">
              Sign in to access your audit management portal.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
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
                  className="text-sm font-medium text-slate-700"
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
                  className={`${fieldClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              className="w-full h-11 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* footer inside login section */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-center">
            <p className="text-[13px] text-slate-400">
              © 2026 Audit Portal · <span className="text-slate-500">Secure Access</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-blue-300" />
      </div>
      <div>
        <p className="text-[15px] font-medium text-white">{title}</p>
        <p className="text-[13px] text-blue-100/60 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
