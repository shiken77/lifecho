"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: string;
}

export default function LoginModal({ isOpen, onClose, prompt }: LoginModalProps) {
  const router = useRouter();
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
        onClose();
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[3px] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="w-full max-w-md rounded-2xl bg-white/95 border border-[#F4A261]/20 shadow-float p-8 space-y-5 relative"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-[#3D3630]/30 hover:text-[#E76F51] hover:bg-[#E76F51]/10 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-serif font-black text-[#3D3630]">
                LifeEcho
              </h2>
              <p className="text-xs text-[#3D3630]/50">
                {prompt || (mode === "signin" ? "登录以同步你的日记" : "注册新账号")}
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
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
