"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    label: "Chat",
    href: "/chat",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Calendar",
    href: "/archive",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const sidebarVariants = {
  closed: { x: "-100%" },
  open: { x: 0 },
};

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Sidebar drawer */}
          <motion.nav
            className="fixed top-0 left-0 h-full w-64 z-50 flex flex-col shadow-float"
            style={{
              background: "linear-gradient(180deg, #FFF8F0 0%, #FAEBD7 100%)",
            }}
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
          >
            {/* Header */}
            <div className="px-5 pt-6 pb-4 border-b border-[#F4A261]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#E76F51]/15 flex items-center justify-center">
                    <span className="text-sm">📒</span>
                  </div>
                  <span className="text-lg font-bold text-[#3D3630] tracking-wide">
                    LifeEcho
                  </span>
                </div>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3D3630]/40 hover:text-[#E76F51] hover:bg-[#E76F51]/10 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-[10px] text-[#3D3630]/30 italic font-serif tracking-wide">
                Don&apos;t forget the sweet moments.
              </p>
            </div>

            {/* Navigation items */}
            <div className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#E76F51]/12 text-[#E76F51] shadow-soft"
                        : "text-[#3D3630]/60 hover:bg-[#F4A261]/10 hover:text-[#3D3630]"
                    }`}
                  >
                    <span className={isActive ? "text-[#E76F51]" : "text-[#3D3630]/40"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-dot"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E76F51]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Footer decoration */}
            <div className="px-5 py-4 border-t border-[#F4A261]/15">
              <div className="flex items-center gap-2 text-[10px] text-[#3D3630]/25">
                <span>☕</span>
                <span className="italic font-serif">Your daily journal companion</span>
              </div>
            </div>

            {/* Decorative tape at top-right corner */}
            <div
              className="absolute -top-1 right-6 w-10 h-4 rounded-sm pointer-events-none"
              style={{
                background: "rgba(244, 162, 97, 0.3)",
                transform: "rotate(3deg)",
              }}
            />
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
