"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// --- Mock data: date string -> journal entries ---
const MOCK_JOURNALS: Record<string, { id: string; rounds: number; thumbnail?: string }[]> = {
  "2026-03-03": [
    { id: "2026-03-03-1", rounds: 4, thumbnail: "https://picsum.photos/seed/mar3a/120/90" },
  ],
  "2026-03-07": [
    { id: "2026-03-07-1", rounds: 6, thumbnail: "https://picsum.photos/seed/mar7a/120/90" },
    { id: "2026-03-07-2", rounds: 3 },
  ],
  "2026-03-10": [
    { id: "2026-03-10-1", rounds: 5, thumbnail: "https://picsum.photos/seed/mar10/120/90" },
  ],
  "2026-03-14": [
    { id: "2026-03-14-1", rounds: 6, thumbnail: "https://picsum.photos/seed/mar14/120/90" },
    { id: "2026-03-14-2", rounds: 2 },
    { id: "2026-03-14-3", rounds: 6, thumbnail: "https://picsum.photos/seed/mar14b/120/90" },
  ],
  "2026-03-18": [
    { id: "2026-03-18-1", rounds: 1 },
  ],
  "2026-03-21": [
    { id: "2026-03-21-1", rounds: 6, thumbnail: "https://picsum.photos/seed/mar21/120/90" },
  ],
  "2026-02-10": [
    { id: "2026-02-10-1", rounds: 4, thumbnail: "https://picsum.photos/seed/feb10/120/90" },
  ],
  "2026-02-14": [
    { id: "2026-02-14-1", rounds: 6, thumbnail: "https://picsum.photos/seed/feb14/120/90" },
    { id: "2026-02-14-2", rounds: 6, thumbnail: "https://picsum.photos/seed/feb14b/120/90" },
  ],
  "2026-02-22": [
    { id: "2026-02-22-1", rounds: 3 },
  ],
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const MONTH_NAMES_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday = 0 ... Sunday = 6 (ISO style)
function getStartDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// Accent colors for round dots
const DOT_COLORS = ["#E76F51", "#F4A261", "#8CB369", "#7EC8E3", "#B54C62", "#6B4CB5"];

export default function ArchivePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const startDay = useMemo(() => getStartDayOfWeek(year, month), [year, month]);

  const goPrev = () => {
    setDirection(-1);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const goNext = () => {
    setDirection(1);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture overflow-auto">
      <div className="px-8 pt-20 pb-10">

        {/* Month header */}
        <div className="flex items-end justify-between mb-8">
          <div className="flex items-end gap-4">
            <motion.span
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-7xl font-black text-[#3D3630] leading-none marker-text"
            >
              {month + 1}
            </motion.span>
            <div className="pb-1">
              <motion.p
                key={`en-${year}-${month}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs font-bold text-[#3D3630]/30 tracking-[0.25em] uppercase"
              >
                {MONTH_NAMES_EN[month]}
              </motion.p>
              <p className="text-xs text-[#3D3630]/20 mt-0.5">{year}</p>
            </div>
          </div>

          {/* Navigation arrows */}
          <div className="flex items-center gap-2 pb-1">
            <button
              onClick={goPrev}
              className="w-9 h-9 rounded-xl bg-white border border-amber-200/60 shadow-soft flex items-center justify-center text-[#3D3630]/40 hover:text-[#E76F51] hover:border-[#E76F51]/30 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              onClick={goNext}
              className="w-9 h-9 rounded-xl bg-white border border-amber-200/60 shadow-soft flex items-center justify-center text-[#3D3630]/40 hover:text-[#E76F51] hover:border-[#E76F51]/30 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        {/* Decorative tape */}
        <div className="relative">
          <div className="absolute -top-2 left-[30%] w-12 h-3.5 bg-[#F4A261]/25 rounded-sm -rotate-2 z-10 pointer-events-none" />
          <div className="absolute -top-2 right-[20%] w-10 h-3.5 bg-[#8CB369]/20 rounded-sm rotate-1 z-10 pointer-events-none" />

          {/* Calendar card */}
          <div className="bg-white rounded-2xl shadow-float border border-[#3D3630]/5 overflow-hidden">

            {/* Weekday header row */}
            <div className="grid grid-cols-7 border-b border-amber-200/50">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={day}
                  className={`py-2.5 text-center text-xs font-bold tracking-wider ${
                    i >= 5 ? "text-[#E76F51]/60" : "text-[#3D3630]/35"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid with animation */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${year}-${month}`}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="grid grid-cols-7"
              >
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-28 border-r border-b border-amber-100/60 bg-amber-50/20" />;
                  }

                  const key = dateKey(year, month, day);
                  const entries = MOCK_JOURNALS[key] || [];
                  const hasEntries = entries.length > 0;
                  const firstThumb = entries.find(e => e.thumbnail)?.thumbnail;
                  const todayMark = isToday(day);

                  return (
                    <div
                      key={key}
                      className={`relative h-28 border-r border-b border-amber-200/50 transition-all duration-200 group ${
                        hasEntries
                          ? "bg-amber-50/70 hover:bg-amber-100/60 hover:scale-[1.04] hover:z-10 hover:shadow-float cursor-pointer"
                          : "bg-[#FEFCF6]"
                      }`}
                    >
                      {/* Date number */}
                      <span className={`absolute top-1.5 right-2 text-[11px] font-bold ${
                        todayMark
                          ? "text-white bg-[#E76F51] w-5 h-5 rounded-full flex items-center justify-center -top-0 -right-0 mt-1 mr-1"
                          : hasEntries
                            ? "text-[#3D3630]/70"
                            : "text-[#3D3630]/20"
                      }`}>
                        {day}
                      </span>

                      {/* Thumbnail image */}
                      {firstThumb && (
                        <div className="absolute inset-x-1 top-6 bottom-7 overflow-hidden rounded-md opacity-60 group-hover:opacity-90 transition-opacity">
                          <img src={firstThumb} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Round dots */}
                      {hasEntries && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-[3px] flex-wrap">
                          {entries.map((entry, ei) => (
                            <Link
                              key={entry.id}
                              href={`/archive/${entry.id}`}
                              onClick={(e) => e.stopPropagation()}
                              title={`${entry.rounds} rounds`}
                            >
                              <span
                                className="block w-3 h-3 rounded-full border-[1.5px] hover:scale-125 transition-transform"
                                style={{
                                  backgroundColor: entry.rounds >= 6 ? DOT_COLORS[ei % DOT_COLORS.length] : "transparent",
                                  borderColor: DOT_COLORS[ei % DOT_COLORS.length],
                                }}
                              />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center justify-center gap-6 text-[10px] text-[#3D3630]/30">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E76F51]" />
            <span>Completed (6 rounds)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-[1.5px] border-[#F4A261]" />
            <span>In progress</span>
          </div>
        </div>

      </div>
    </div>
  );
}
