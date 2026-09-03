"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  BarChart3,
  ClipboardCheck,
  Factory,
  Users,
  FileCheck2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/15 backdrop-blur p-2.5 rounded-xl">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-xl font-semibold tracking-tight">
            QMS Portal
          </span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight mb-6">
            Enterprise Quality
            <br />
            Management Portal
          </h1>
          <p className="text-blue-100 text-lg mb-10 max-w-md">
            A single, secure gateway to your organization&apos;s quality
            management workflows, audits, and compliance records.
          </p>
          <div className="space-y-4">
            <FeatureRow
              icon={ClipboardCheck}
              text="Streamlined quality control & audits"
            />
            <FeatureRow icon={BarChart3} text="Real-time compliance dashboards" />
            <FeatureRow icon={Factory} text="Centralized operations management" />
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-blue-200 text-sm">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" /> 240+ Users
          </span>
          <span className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" /> ISO 9001
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center bg-white p-8 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold">QMS Portal</span>
          </div>

          <div className="lg:hidden text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Enterprise Quality Portal
            </h2>
            <p className="text-slate-500 mt-2">Sign in to your account</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-2">Sign in to access the portal</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-12 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-600">Remember me</span>
              </label>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <div className="mt-8 text-center text-[13px] text-slate-400">
            Need an account?{" "}
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-blue-600 font-medium hover:text-blue-700"
            >
              Contact your administrator
            </a>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-slate-400">
          © {new Date().getFullYear()} QMS Portal · Confidential
        </p>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  text,
}: {
  icon: any;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-white/15 p-2 rounded-lg">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-blue-50">{text}</span>
    </div>
  );
}
