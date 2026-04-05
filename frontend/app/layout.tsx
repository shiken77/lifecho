"use client";

import "./globals.css";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { AuthProvider } from "@/contexts/AuthContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <body
        className="bg-[#FEFCF6] font-sans text-[#3D3630] m-0 p-0 overflow-hidden"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <AuthProvider>
        {/* Hamburger menu button — always visible */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-[#3D3630]/8 shadow-soft flex items-center justify-center text-[#3D3630]/50 hover:text-[#E76F51] hover:border-[#E76F51]/20 hover:shadow-float transition-all"
          aria-label="Open menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="17" y2="12" />
            <line x1="3" y1="18" x2="14" y2="18" />
          </svg>
        </button>

        {/* Sidebar drawer */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Page content */}
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
