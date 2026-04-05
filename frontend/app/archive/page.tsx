"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../config";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

interface JournalEntry {
  id: string;
  rounds: number;
  title: string;
  thumbnail_url: string | null;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const MONTH_NAMES_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

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

const DOT_COLORS = ["#E76F51", "#F4A261", "#8CB369", "#7EC8E3", "#B54C62", "#6B4CB5"];

/** 本月 JLPT 统计占位；后续可改为 GET /api/journal/month-stats 等 */
function usePlaceholderMonthStats(year: number, month: number) {
  return useMemo(
    () => ({
      vocab: {
        n1: 3,
        n2: 5,
        n345: 12,
      },
      grammar: {
        n1: 1,
        n2: 2,
        n345: 4,
      },
    }),
    [year, month]
  );
}

function StatBlock({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: number }[];
}) {
  return (
    <div className="w-full rounded-2xl border border-amber-200/60 bg-[#FEFCF6]/90 px-4 py-3 shadow-soft">
      <p className="text-xs font-bold text-[#E76F51] mb-2.5 tracking-wide">{title}</p>
      <ul className="space-y-2 text-[11px] sm:text-xs text-[#3D3630]/85 leading-relaxed">
        {lines.map((row) => (
          <li key={row.label} className="flex justify-between gap-2 border-b border-[#3D3630]/6 pb-2 last:border-0 last:pb-0">
            <span className="text-[#3D3630]/65">{row.label}</span>
            <span className="font-semibold tabular-nums shrink-0">
              {row.value}
              <span className="text-[#3D3630]/45 font-normal ml-0.5">个</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Phase A：静态示意图占位，表达「话题网络」心智，无真实数据 */
function TopicMapSchematicPlaceholder() {
  return (
    <div className="w-full rounded-2xl border border-amber-200/60 bg-[#FEFCF6]/90 px-3 py-3 shadow-soft">
      <p className="text-xs font-bold text-[#E76F51] mb-2 tracking-wide">本月话题地图</p>
      <div
        className="h-52 w-full rounded-xl bg-white/60 border border-[#3D3630]/6 overflow-hidden"
        aria-hidden
      >
        <svg viewBox="0 0 280 168" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="topicEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E76F51" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F4A261" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <path d="M 44 88 L 108 52" stroke="url(#topicEdge)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 108 52 L 188 44" stroke="url(#topicEdge)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 44 88 L 96 118" stroke="url(#topicEdge)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M 96 118 L 178 128" stroke="url(#topicEdge)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M 188 44 L 228 96" stroke="url(#topicEdge)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.75" />
          <path d="M 108 52 L 118 108" stroke="#3D3630" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.2" />
          <path d="M 118 108 L 178 128" stroke="#3D3630" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.2" />
          <circle cx="44" cy="88" r="11" fill="#E76F51" opacity="0.92" />
          <circle cx="108" cy="52" r="13" fill="#F4A261" opacity="0.95" />
          <circle cx="188" cy="44" r="10" fill="#E76F51" opacity="0.85" />
          <circle cx="228" cy="96" r="9" fill="#F4A261" opacity="0.88" />
          <circle cx="96" cy="118" r="10" fill="#8CB369" opacity="0.75" />
          <circle cx="178" cy="128" r="9" fill="#F4A261" opacity="0.7" />
          <circle cx="118" cy="108" r="8" fill="#3D3630" opacity="0.18" />
          <text x="44" y="91" textAnchor="middle" fill="white" style={{ fontSize: "7px", fontWeight: 700 }}>A</text>
          <text x="108" y="55" textAnchor="middle" fill="white" style={{ fontSize: "7px", fontWeight: 700 }}>B</text>
          <text x="188" y="47" textAnchor="middle" fill="white" style={{ fontSize: "7px", fontWeight: 700 }}>C</text>
        </svg>
      </div>
      <p className="text-[9px] text-[#3D3630]/35 text-center mt-2 leading-relaxed">
        示意图 · 数据接入后展示真实话题关系
      </p>
    </div>
  );
}

export default function ArchivePage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [direction, setDirection] = useState(0);
  const [entries, setEntries] = useState<Record<string, JournalEntry[]>>({});
  const [loading, setLoading] = useState(false);

  const monthStats = usePlaceholderMonthStats(year, month);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const startDay = useMemo(() => getStartDayOfWeek(year, month), [year, month]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `${API_BASE_URL}/api/journal/list?year=${year}&month=${month + 1}`,
          accessToken
        );
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || {});
        }
      } catch (err) {
        console.error("Failed to fetch journal list:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [year, month, accessToken, authLoading]);

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

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture overflow-auto">
      <div className="px-4 sm:px-8 pt-20 pb-10 max-w-[1500px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-stretch gap-6 md:gap-0">
          <aside className="shrink-0 w-full md:w-[30%] md:min-w-[140px] md:max-w-[320px] lg:sticky lg:top-24 md:pr-4 self-start md:self-stretch">
            <div className="rounded-2xl bg-[#FFF5EB]/95 border border-amber-200/50 shadow-soft px-6 py-6 w-full flex flex-col items-start gap-4">
              <motion.span
                key={`${year}-${month}-num`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[clamp(2.5rem,8vw,4rem)] font-black text-[#3D3630] leading-none marker-text tabular-nums"
              >
                {month + 1}
              </motion.span>
              <motion.p
                key={`en-${year}-${month}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] sm:text-xs font-bold text-[#3D3630]/50 tracking-[0.2em] uppercase"
              >
                {MONTH_NAMES_EN[month]}
              </motion.p>
              <p className="text-sm text-[#3D3630]/35 font-semibold tabular-nums">{year}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="w-10 h-10 rounded-xl bg-[#FEFCF6] border border-amber-200/60 shadow-soft flex items-center justify-center text-[#3D3630]/55 hover:text-[#E76F51] hover:border-[#E76F51]/35 transition-all"
                  aria-label="Previous month"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="w-10 h-10 rounded-xl bg-[#FEFCF6] border border-amber-200/60 shadow-soft flex items-center justify-center text-[#3D3630]/55 hover:text-[#E76F51] hover:border-[#E76F51]/35 transition-all"
                  aria-label="Next month"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <StatBlock
                title="现在活用了"
                lines={[
                  { label: "N1 单词", value: monthStats.vocab.n1 },
                  { label: "N2 单词", value: monthStats.vocab.n2 },
                  { label: "N3·N4·N5 单词", value: monthStats.vocab.n345 },
                ]}
              />
              <StatBlock
                title="现在活用了"
                lines={[
                  { label: "N1 语法", value: monthStats.grammar.n1 },
                  { label: "N2 语法", value: monthStats.grammar.n2 },
                  { label: "N3·N4·N5 语法", value: monthStats.grammar.n345 },
                ]}
              />
              <p className="text-[9px] text-[#3D3630]/35 w-full text-center -mt-1">
                数据统计将接入后端后显示
              </p>

              <TopicMapSchematicPlaceholder />
            </div>
          </aside>

          <div className="relative flex-1 min-w-0 md:w-[70%]">
            <div className="absolute -top-2 left-[8%] w-12 h-3.5 bg-[#F4A261]/25 rounded-sm -rotate-2 z-10 pointer-events-none" />
            <div className="absolute -top-2 right-[12%] w-10 h-3.5 bg-[#F4A261]/20 rounded-sm rotate-1 z-10 pointer-events-none" />

            <div className="rounded-2xl shadow-float border border-amber-200/40 overflow-hidden bg-[#FFF9F3]">
              <div className="grid grid-cols-7 bg-[#F4A261]">
                {WEEKDAYS.map((day, i) => (
                  <div
                    key={day}
                    className={`py-2.5 text-center text-[11px] sm:text-xs font-bold tracking-wider ${
                      i >= 5 ? "text-[#5C4033]" : "text-white"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${year}-${month}`}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="grid grid-cols-7 gap-px bg-amber-100/60 p-px"
                >
                  {cells.map((day, idx) => {
                    const row = Math.floor(idx / 7);
                    const zebra = row % 2 === 0 ? "bg-[#FFF8F0]" : "bg-[#FBF0E4]";

                    if (day === null) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className={`relative aspect-[3/4] min-h-[80px] ${zebra}`}
                        />
                      );
                    }

                    const key = dateKey(year, month, day);
                    const dayEntries = entries[key] || [];
                    const hasEntries = dayEntries.length > 0;
                    const firstThumb = dayEntries.find((e) => e.thumbnail_url)?.thumbnail_url;
                    const firstWithThumb = dayEntries.find((e) => e.thumbnail_url);
                    const todayMark = isToday(day);

                    return (
                      <div
                        key={key}
                        className={`relative aspect-[3/4] min-h-[80px] transition-all duration-200 group ${zebra} ${
                          hasEntries
                            ? "hover:bg-[#F5E6D8]/80 hover:z-10 hover:shadow-[0_4px_14px_rgba(92,64,51,0.12)] cursor-pointer"
                            : ""
                        }`}
                      >
                        <span
                          className={`absolute top-1 right-1 z-[2] text-[10px] sm:text-[11px] font-bold ${
                            todayMark
                              ? "text-white bg-[#E76F51] w-5 h-5 rounded-full flex items-center justify-center"
                              : hasEntries
                                ? "text-[#3D3630]/85"
                                : "text-[#3D3630]/40"
                          }`}
                        >
                          {day}
                        </span>

                        {firstThumb && firstWithThumb && (
                          <Link
                            href={`/archive/${firstWithThumb.id}`}
                            className="absolute inset-[3px] top-7 bottom-8 z-[1] rounded-sm overflow-hidden bg-[#F0E4D8] block ring-1 ring-amber-200/40"
                          >
                            <img
                              src={`${API_BASE_URL}${firstThumb}`}
                              alt=""
                              className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                          </Link>
                        )}

                        {hasEntries && (
                          <div className="absolute bottom-1 left-1 right-1 flex items-center gap-[3px] flex-wrap justify-end z-[2]">
                            {dayEntries.map((entry, ei) => (
                              <Link
                                key={entry.id}
                                href={`/archive/${entry.id}`}
                                onClick={(e) => e.stopPropagation()}
                                title={`${entry.title || `${entry.rounds} rounds`}`}
                              >
                                <span
                                  className="block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-[1.5px] hover:scale-125 transition-transform"
                                  style={{
                                    backgroundColor:
                                      entry.rounds >= 6 ? DOT_COLORS[ei % DOT_COLORS.length] : "transparent",
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
        </div>

        <div className="mt-5 flex items-center justify-center gap-6 text-[10px] text-[#3D3630]/30 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E76F51]" />
            <span>Completed (6 rounds)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-[1.5px] border-[#F4A261]" />
            <span>In progress</span>
          </div>
          {loading && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin" />
              <span>Loading...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
