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
  User,
  ChevronDown,
  HelpCircle,
  Building2,
  KeyRound,
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
      {/* ===== SAP SHELL BAR ===== */}
      <header className="bg-sap-header text-white h-12 shrink-0 flex items-center px-4 gap-3 shadow-md z-20">
        <div className="flex items-center gap-2 border-r border-sap-header-hover pr-3">
          <div className="w-6 h-6 rounded bg-sap-accent text-sap-header flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide text-[15px]">QMS Portal</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sap-accent" />
          <span className="text-[13px] text-sap-accent hidden sm:inline">
            User Login
          </span>
          <ChevronDown className="w-4 h-4 text-sap-accent" />
        </div>
        <div className="w-px h-6 bg-sap-header-hover mx-1" />
        <HelpCircle className="w-5 h-5 text-sap-accent cursor-pointer" />
      </header>

      {/* ===== CENTERED SAP-STYLE LOGIN CARD ===== */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded bg-sap-accent text-sap-header flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-sap-text leading-tight">
                QMS Portal
              </h1>
              <p className="text-[12px] text-sap-muted">
                Quality Management System
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-sm border border-sap-border">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound className="w-4 h-4 text-sap-primary" />
              <h2 className="text-[15px] font-semibold text-sap-text">
                Sign in
              </h2>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-sap-text mb-1.5">
                User ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sap-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className="w-full pl-9 pr-4 py-2 text-[13px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-1 focus:ring-sap-primary transition"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[12px] font-semibold text-sap-text mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sap-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-9 pr-12 py-2 text-[13px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-1 focus:ring-sap-primary transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sap-muted hover:text-sap-text"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-sap-primary text-white py-2.5 rounded font-semibold text-[13px] hover:bg-sap-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="text-[12px] text-sap-primary hover:underline"
              >
                Forgotten your password?
              </button>
            </div>
          </form>

          <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-sap-muted">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Org: Quality Management
            </span>
            <span className="w-1 h-1 rounded-full bg-sap-muted" />
            <span>ISO 9001</span>
          </div>
        </div>
      </div>

      {/* ===== SAP STATUS BAR ===== */}
      <footer className="h-7 bg-sap-status text-white text-[11px] flex items-center px-4 gap-3 shrink-0">
        <span className="text-sap-accent">© {new Date().getFullYear()} QMS Portal</span>
        <div className="flex-1" />
        <span className="text-sap-accent/80">SAP-style UI</span>
      </footer>
    </div>
  );
}
