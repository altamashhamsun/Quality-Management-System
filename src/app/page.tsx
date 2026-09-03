"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ClipboardCheck,
  Eye,
  EyeOff,
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

  const inputClass =
    "w-full h-12 px-4 pr-11 text-[15px] text-slate-900 placeholder-slate-400 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/20">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to access your audits
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className={inputClass}
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
            className="w-full h-12 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
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

        <p className="mt-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Audit Portal
        </p>
      </div>
    </div>
  );
}
