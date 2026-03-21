"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function JournalDetail({ id }: { id: string }) {
  const router = useRouter();

  const datePart = id?.split("-").slice(0, 3).join("-") || "";
  const entryNum = id?.split("-")[3] || "1";

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture overflow-auto">
      <div className="max-w-2xl mx-auto px-6 pt-24 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Back button */}
          <button
            onClick={() => router.push("/archive")}
            className="flex items-center gap-2 text-sm text-[#3D3630]/40 hover:text-[#E76F51] transition-colors mb-6 group"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span>Back to Calendar</span>
          </button>

          {/* Journal card */}
          <div className="relative">
            {/* Decorative tape */}
            <div className="absolute -top-2 left-[25%] w-14 h-4 bg-[#F4A261]/30 rounded-sm -rotate-2 z-10 pointer-events-none" />
            <div className="absolute -top-2 right-[15%] w-10 h-3.5 bg-[#8CB369]/25 rounded-sm rotate-2 z-10 pointer-events-none" />

            <div className="bg-white rounded-2xl shadow-float border border-[#3D3630]/5 overflow-hidden">
              {/* Header band */}
              <div className="bg-amber-50/80 px-8 py-5 border-b border-amber-200/40">
                <p className="text-xs font-bold text-[#3D3630]/30 tracking-[0.2em] uppercase">Journal Entry</p>
                <h1 className="mt-1 text-2xl font-black text-[#3D3630] marker-text">{datePart}</h1>
                <p className="mt-1 text-xs text-[#F4A261]">Session #{entryNum}</p>
              </div>

              {/* Content area */}
              <div className="px-8 py-8 grid-paper min-h-[320px] flex flex-col items-center justify-center">
                <div className="text-center space-y-4">
                  <span className="text-5xl block">📖</span>
                  <p className="text-sm text-[#3D3630]/35 max-w-xs leading-relaxed">
                    This is where the full journal content for this session will be displayed —
                    including conversation, diary, podcast script, and scene images.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <div className="h-px w-8 bg-[#F4A261]/30" />
                    <span className="text-[10px] text-[#F4A261]/50 italic font-serif">content coming soon</span>
                    <div className="h-px w-8 bg-[#F4A261]/30" />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-4 border-t border-amber-200/30 flex items-center justify-between">
                <span className="text-[10px] text-[#3D3630]/20 italic font-serif">LifeEcho Journal</span>
                <span className="text-[10px] text-[#3D3630]/20">ID: {id}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
