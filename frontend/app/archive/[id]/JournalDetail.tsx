"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../../config";

interface JournalData {
  id: string;
  date: string;
  session_num: number;
  title: string;
  diary_ja: string;
  diary_zh: string;
  podcast_script: { speaker: string; content: string }[];
  podcast_audio_url: string | null;
  scene_1_url: string | null;
  scene_2_url: string | null;
  entry_text: string;
  role: string;
  tone: string;
  rounds: number;
  created_at: string;
}

const getRoleColor = (name: string) => {
  const colors = ["#B54C62", "#4C7AB5", "#6B4CB5", "#B5874C", "#4CB59A", "#B54C90"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

function formatTime(seconds: number) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function JournalDetail({ id }: { id: string }) {
  const router = useRouter();
  const [journal, setJournal] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const fetchJournal = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/journal/${id}`);
        if (res.ok) {
          const data = await res.json();
          setJournal(data);
        } else if (res.status === 404) {
          setError("Journal not found");
        } else {
          setError("Failed to load journal");
        }
      } catch (err) {
        console.error("Fetch journal failed:", err);
        setError("Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchJournal();
  }, [id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const toggleAudio = async () => {
    if (!journal?.podcast_audio_url) return;
    if (!audioRef.current) {
      const audio = new Audio(`${API_BASE_URL}${journal.podcast_audio_url}`);
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
      audio.addEventListener("ended", () => { setIsPlaying(false); setCurrentTime(0); });
      audioRef.current = audio;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#FEFCF6] paper-texture flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="h-screen w-screen bg-[#FEFCF6] paper-texture flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="text-5xl block">📭</span>
          <p className="text-sm text-[#3D3630]/40">{error || "Journal not found"}</p>
          <button onClick={() => router.push("/archive")} className="text-xs text-[#E76F51] underline">
            Back to Calendar
          </button>
        </div>
      </div>
    );
  }

  const roleColor = getRoleColor(journal.role || "AI");

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture overflow-auto">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

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

          {/* Header card */}
          <div className="relative mb-6">
            <div className="absolute -top-2 left-[20%] w-14 h-4 bg-[#F4A261]/30 rounded-sm -rotate-2 z-10 pointer-events-none" />
            <div className="bg-white rounded-2xl shadow-float border border-[#3D3630]/5 overflow-hidden">
              <div className="bg-amber-50/80 px-8 py-5 border-b border-amber-200/40">
                <p className="text-xs font-bold text-[#3D3630]/30 tracking-[0.2em] uppercase">Journal Entry</p>
                <h1 className="mt-1 text-2xl font-black text-[#3D3630] marker-text">{journal.title || journal.date}</h1>
                <div className="mt-2 flex items-center gap-3 text-xs text-[#3D3630]/40">
                  <span>{journal.date}</span>
                  <span>Session #{journal.session_num}</span>
                  <span>{journal.rounds} rounds</span>
                  {journal.role && <span className="text-[#E76F51]">{journal.role}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Podcast player */}
          {journal.podcast_audio_url && (
            <div className="bg-white rounded-2xl shadow-soft border border-[#3D3630]/5 px-5 py-3 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAudio}
                  className="w-10 h-10 bg-[#E76F51] rounded-full flex items-center justify-center shadow-soft hover:scale-105 transition-all flex-shrink-0"
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
                <input
                  type="range" min="0" max={duration || 100} value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setCurrentTime(t);
                    if (audioRef.current) audioRef.current.currentTime = t;
                  }}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-[#E76F51]"
                  style={{ background: `linear-gradient(to right, #E76F51 0%, #E76F51 ${(currentTime / (duration || 1)) * 100}%, #3D363010 ${(currentTime / (duration || 1)) * 100}%, #3D363010 100%)` }}
                />
                <span className="text-xs text-[#3D3630]/40 font-mono font-bold flex-shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          )}

          {/* Two-column: Script + Diary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Podcast script */}
            {journal.podcast_script.length > 0 && (
              <div className="bg-[#FAEBD7]/80 rounded-2xl p-5 border border-[#3D3630]/10 shadow-soft max-h-[400px] overflow-y-auto scrollbar-hide">
                <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3">Podcast Script</p>
                <div className="space-y-2.5">
                  {journal.podcast_script.map((line, idx) => {
                    const speakerLower = (line.speaker || "").toLowerCase();
                    const isUser = speakerLower === "用户" || speakerLower === "user" || speakerLower.includes("ユーザー");
                    const displaySpeaker = isUser ? "Me" : (journal.role || line.speaker || "AI");
                    return (
                      <div key={idx} className={`flex ${isUser ? "items-end gap-2 justify-end" : "items-start gap-2"}`}>
                        {!isUser && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: roleColor + "25" }}>
                            <span className="font-bold text-[10px]" style={{ color: roleColor }}>{displaySpeaker.charAt(0)}</span>
                          </div>
                        )}
                        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[80%]`}>
                          <p className="text-[10px] text-[#3D3630]/50 mb-1 font-bold journal-font">{displaySpeaker}</p>
                          <div className={`${isUser ? "bg-[#F4A261]/10" : "bg-[#FEFCF6]"} px-3 py-2.5 rounded-lg`}>
                            <p className="text-sm leading-relaxed journal-font">{line.content}</p>
                          </div>
                        </div>
                        {isUser && (
                          <div className="w-6 h-6 rounded-full bg-[#F4A261]/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#E76F51] font-bold text-[9px]">Me</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Diary text */}
            <div className="grid-paper rounded-2xl p-5 border border-[#3D3630]/10 shadow-soft max-h-[400px] overflow-y-auto scrollbar-hide">
              <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3">Diary</p>
              <p className="text-sm leading-[2] journal-font text-[#3D3630]/80 whitespace-pre-wrap">
                {journal.diary_ja || "No diary content."}
              </p>
              {journal.diary_zh && (
                <div className="mt-4 pt-4 border-t border-[#3D3630]/8">
                  <p className="text-xs leading-relaxed text-[#3D3630]/40 italic">
                    {journal.diary_zh}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Scene images */}
          {(journal.scene_1_url || journal.scene_2_url) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {journal.scene_1_url && (
                <div className="relative" style={{ transform: "rotate(-2deg)" }}>
                  <div className="absolute -top-2 left-[30%] w-12 h-3.5 bg-[#F4A261]/25 rounded-sm rotate-1 z-10 pointer-events-none" />
                  <div className="bg-white p-2 shadow-float rounded-sm">
                    <img src={`${API_BASE_URL}${journal.scene_1_url}`} alt="Scene 1" className="w-full rounded-sm" />
                  </div>
                </div>
              )}
              {journal.scene_2_url && (
                <div className="relative" style={{ transform: "rotate(2deg)" }}>
                  <div className="absolute -top-2 right-[25%] w-10 h-3.5 bg-[#8CB369]/20 rounded-sm -rotate-1 z-10 pointer-events-none" />
                  <div className="bg-white p-2 shadow-float rounded-sm">
                    <img src={`${API_BASE_URL}${journal.scene_2_url}`} alt="Scene 2" className="w-full rounded-sm" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="h-px w-8 bg-[#F4A261]/20" />
              <span className="text-[10px] text-[#F4A261]/40">✦</span>
              <div className="h-px w-8 bg-[#F4A261]/20" />
            </div>
            <p className="text-[10px] text-[#3D3630]/20 italic font-serif">LifeEcho Journal &middot; {journal.date}</p>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
