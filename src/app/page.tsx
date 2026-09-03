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
  HelpCircle,
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

  return (
    <div className="min-h-screen flex flex-col bg-sap-bg">
      <header className="bg-sap-header text-white h-14 shrink-0 flex items-center justify-between px-5 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-sap-accent text-sap-header flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-semibold">QMS Portal</span>
        </div>
        <HelpCircle className="w-5 h-5 text-sap-accent" />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded bg-sap-accent text-sap-header flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-semibold text-sap-text">QMS Portal</h1>
            <p className="text-[13px] text-sap-muted mt-1">
              Quality Management System
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2.5 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="bg-white p-7 rounded-lg shadow-sm border border-sap-border space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-sap-text mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-sap-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full h-11 pl-10 pr-4 text-[14px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-sap-text mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-sap-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full h-11 pl-10 pr-12 text-[14px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-sap-muted hover:text-sap-primary rounded"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 bg-sap-primary text-white rounded font-semibold text-[14px] hover:bg-sap-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {}}
              className="text-[13px] text-sap-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>

      <footer className="h-8 bg-sap-header text-white/80 text-[12px] flex items-center px-5 shrink-0">
        © {new Date().getFullYear()} QMS Portal
      </footer>
    </div>
  );
}
