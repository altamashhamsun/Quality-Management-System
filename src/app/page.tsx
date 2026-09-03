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
  ChevronDown,
  HelpCircle,
  Building2,
  ClipboardCheck,
  Factory,
  FileCheck2,
  BarChart3,
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
      <header className="bg-sap-header text-white h-14 shrink-0 flex items-center px-5 justify-between shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-sap-accent text-sap-header flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-semibold tracking-wide text-[15px]">
            QMS Portal
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 h-9 px-3 rounded hover:bg-sap-header-hover">
            <span className="text-[13px] text-white/90">User Login</span>
            <ChevronDown className="w-4 h-4 text-sap-accent" />
          </button>
          <span className="w-px h-5 bg-sap-header-hover" />
          <button className="h-9 w-9 flex items-center justify-center rounded hover:bg-sap-header-hover">
            <HelpCircle className="w-5 h-5 text-sap-accent" />
          </button>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <div className="flex-1 flex">
        {/* Left branding panel */}
        <div className="hidden lg:flex w-[46%] bg-sap-header flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-sap-accent text-sap-header flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-[16px] leading-tight">QMS Portal</p>
              <p className="text-[12px] text-sap-accent">Quality Management System</p>
            </div>
          </div>

          <div className="my-16">
            <h1 className="text-[26px] font-semibold leading-snug mb-4">
              Enterprise quality,
              <br />
              one secure gateway.
            </h1>
            <p className="text-[14px] text-white/70 max-w-sm leading-relaxed">
              Centralize your quality control, audits, nonconformities, and
              compliance workflows in one SAP-style portal.
            </p>

            <div className="mt-10 space-y-4">
              <BrandRow icon={ClipboardCheck} text="Streamlined audits & inspections" />
              <BrandRow icon={Factory} text="Branch & department oversight" />
              <BrandRow icon={BarChart3} text="Real-time compliance reporting" />
              <BrandRow icon={FileCheck2} text="ISO 9001 aligned records" />
            </div>
          </div>

          <p className="text-[12px] text-white/50">
            © {new Date().getFullYear()} QMS Portal · Confidential
          </p>
        </div>

        {/* Right login card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-10 h-10 rounded bg-sap-accent text-sap-header flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-[15px] text-sap-text leading-tight">
                  QMS Portal
                </p>
                <p className="text-[12px] text-sap-muted">Quality Management System</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-sap-border">
              <div className="mb-7">
                <h2 className="text-[20px] font-semibold text-sap-text">
                  Sign in
                </h2>
                <p className="text-[13px] text-sap-muted mt-1">
                  Enter your credentials to access the portal
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-2.5 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-[13px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-sap-text mb-2">
                    User ID
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 text-sap-muted">
                      <Mail className="w-[18px] h-[18px]" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                      className="w-full h-11 pl-11 pr-4 text-[14px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[13px] font-semibold text-sap-text">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {}}
                      className="text-[12px] text-sap-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 text-sap-muted">
                      <Lock className="w-[18px] h-[18px]" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      className="w-full h-11 pl-11 pr-12 text-[14px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-2 focus:ring-sap-primary/20 transition"
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
            </div>

            <div className="mt-5 flex items-center justify-center gap-3 text-[12px] text-sap-muted">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Org: Quality Management
              </span>
              <span className="w-1 h-1 rounded-full bg-sap-muted" />
              <span>ISO 9001</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SAP STATUS BAR ===== */}
      <footer className="h-8 bg-sap-header text-white/80 text-[12px] flex items-center px-5 gap-3 shrink-0">
        <span>© {new Date().getFullYear()} QMS Portal</span>
        <span className="flex-1" />
        <span>Quality Management System v1.0</span>
      </footer>
    </div>
  );
}

function BrandRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-sap-accent" />
      </div>
      <span className="text-[14px] text-white/85">{text}</span>
    </div>
  );
}
