"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/chat";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/chat` },
        });
        if (err) throw err;
        setError(null);
        alert("若项目开启邮箱验证，请查收邮件；否则可直接登录。");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        router.replace(nextPath.startsWith("/") ? nextPath : "/chat");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#FEFCF6] paper-texture p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-white/90 border border-[#F4A261]/20 shadow-float p-8 space-y-6"
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-serif font-black text-[#3D3630]">
            LifeEcho
          </h1>
          <p className="text-xs text-[#3D3630]/50">
            {mode === "signin" ? "登录以同步你的日记" : "注册新账号"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#3D3630]/40 mb-1">
              邮箱
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#F4A261]/20 bg-[#FEFCF6] px-4 py-3 text-sm outline-none focus:border-[#E76F51]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#3D3630]/40 mb-1">
              密码
            </label>
            <input
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#F4A261]/20 bg-[#FEFCF6] px-4 py-3 text-sm outline-none focus:border-[#E76F51]/40"
            />
          </div>

          {error && (
            <p className="text-sm text-[#E76F51] bg-[#E76F51]/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#E76F51] text-white font-bold text-sm shadow-float hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {loading ? "请稍候…" : mode === "signin" ? "登录" : "注册"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="w-full text-center text-xs text-[#E76F51] hover:underline"
        >
          {mode === "signin" ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </motion.div>
    </div>
  );
}
