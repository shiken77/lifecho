"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../../config";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiFetch";

interface ChatTurnData {
  user_raw_text: string;
  user_ja: string;
  reply: string;
  translation: string;
  translation_en?: string;
  suggestion: string;
  reply_audio_url: string | null;
}

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
  chat_turns: ChatTurnData[];
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
  const { accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [journal, setJournal] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Podcast audio player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Per-turn reply audio player
  const [turnAudioEl, setTurnAudioEl] = useState<HTMLAudioElement | null>(null);
  const [playingTurnIdx, setPlayingTurnIdx] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      setError("请先登录");
      return;
    }
    const fetchJournal = async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/journal/${id}`, accessToken);
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
  }, [id, accessToken, authLoading]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (turnAudioEl) { turnAudioEl.pause(); turnAudioEl.src = ""; }
    };
  }, [turnAudioEl]);

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

  const toggleTurnAudio = async (idx: number, url: string) => {
    if (playingTurnIdx === idx && turnAudioEl) {
      turnAudioEl.pause();
      setPlayingTurnIdx(null);
      return;
    }
    if (turnAudioEl) { turnAudioEl.pause(); turnAudioEl.src = ""; }
    const audio = new Audio(`${API_BASE_URL}${url}`);
    audio.onended = () => setPlayingTurnIdx(null);
    audio.onpause = () => setPlayingTurnIdx(null);
    setTurnAudioEl(audio);
    setPlayingTurnIdx(idx);
    await audio.play();
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
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/archive")}
          className="flex items-center gap-2 text-sm text-[#3D3630]/40 hover:text-[#E76F51] transition-colors group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>Back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-[#3D3630] marker-text truncate">{journal.title || journal.date}</h1>
          <div className="flex items-center gap-3 text-[10px] text-[#3D3630]/40">
            <span>{journal.date}</span>
            <span>Session #{journal.session_num}</span>
            <span>{journal.rounds} rounds</span>
            {journal.role && <span className="text-[#E76F51]">{journal.role}</span>}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">

        {/* Left column: Conversation rounds */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-y-auto px-6 pb-8 md:border-r border-[#3D3630]/8 scrollbar-hide bg-[#FDF6E3]"
        >
          <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-4 sticky top-0 bg-[#FDF6E3] py-2 z-10">Conversation Rounds</p>

          {journal.chat_turns && journal.chat_turns.length > 0 ? (
            <div className="space-y-6">
              {journal.chat_turns.map((turn, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-[#F4A261] bg-[#F4A261]/10 px-2 py-0.5 rounded-full">Round {idx + 1}</span>
                    <div className="flex-1 h-px bg-[#3D3630]/5" />
                  </div>

                  {turn.user_raw_text && (
                    <div className="flex items-end gap-2.5 justify-end">
                      <div className="flex flex-col items-end max-w-[85%]">
                        <div className="bg-[#F4A261]/12 px-4 py-3 rounded-2xl rounded-br-md">
                          <p className="text-sm leading-relaxed">{turn.user_raw_text}</p>
                        </div>
                        {turn.user_ja && turn.user_ja !== turn.user_raw_text && (
                          <p className="mt-1 text-[11px] text-[#3D3630]/50 pr-1">Revised: {turn.user_ja}</p>
                        )}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-[#F4A261]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#E76F51] font-bold text-[9px]">U</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: roleColor + "20" }}>
                      <span className="font-bold text-[9px]" style={{ color: roleColor }}>{(journal.role || "AI").charAt(0)}</span>
                    </div>
                    <div className="flex flex-col items-start max-w-[85%] gap-2">
                      <div className="bg-[#FEFCF6] px-4 py-3 rounded-2xl rounded-bl-md border border-[#3D3630]/5">
                        <p className="text-sm leading-relaxed">{turn.reply}</p>
                        <AnimatePresence>
                          {showTranslation[idx] && (turn.translation || turn.translation_en) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 pt-2 border-t border-[#F4A261]/15">
                              <p className="text-xs text-[#E76F51]/50 italic leading-relaxed">{turn.translation_en || turn.translation}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div className="mt-2 flex gap-2">
                          {turn.reply_audio_url ? (
                            <button
                              onClick={() => toggleTurnAudio(idx, turn.reply_audio_url!)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                playingTurnIdx === idx
                                  ? "bg-[#E76F51] text-white"
                                  : "bg-[#F4A261]/12 text-[#E76F51] hover:bg-[#F4A261]/20"
                              }`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                {playingTurnIdx === idx ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></> : <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>}
                              </svg>
                              {playingTurnIdx === idx ? "Pause" : "Play"}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-[#3D3630]/15 bg-[#3D3630]/4">No Audio</span>
                          )}
                          {(turn.translation || turn.translation_en) && (
                            <button
                              onClick={() => setShowTranslation(p => ({ ...p, [idx]: !p[idx] }))}
                              className="text-[9px] font-bold uppercase tracking-wider text-[#3D3630]/25 hover:text-[#E76F51] flex items-center gap-1 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                              {showTranslation[idx] ? "Hide" : "Translate"}
                            </button>
                          )}
                        </div>
                      </div>

                      {turn.suggestion && typeof turn.suggestion === "string" && turn.suggestion.trim() && !turn.suggestion.includes("Error") && (
                        <div className="bg-[#8CB369]/8 border border-[#8CB369]/15 px-4 py-3 rounded-xl w-full">
                          <p className="text-[10px] font-bold text-[#8CB369] mb-1.5 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                            Tip
                          </p>
                          <div className="space-y-1.5">
                            {turn.suggestion.split("\n").filter((l: string) => l.trim()).map((line: string, li: number) => (
                              <p key={li} className="text-[11px] leading-relaxed text-[#3D3630]/50">{line}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#3D3630]/30 italic text-center py-8">No conversation data.</p>
          )}
        </motion.div>

        {/* Right column: Audio, Images, Diary, Script */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="overflow-y-auto px-6 pb-8 scrollbar-hide"
        >
          <div className="space-y-6 pt-2">

            {/* Podcast player */}
            {journal.podcast_audio_url && (
              <div className="bg-white rounded-2xl shadow-soft border border-[#3D3630]/5 px-5 py-3">
                <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-2">Podcast</p>
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

            {/* Scene images */}
            {(journal.scene_1_url || journal.scene_2_url) && (
              <div className="grid grid-cols-2 gap-4">
                {journal.scene_1_url && (
                  <div className="relative" style={{ transform: "rotate(-2deg)" }}>
                    <div className="absolute -top-2 left-[30%] w-12 h-3.5 bg-[#F4A261]/25 rounded-sm rotate-1 z-10 pointer-events-none" />
                    <div className="bg-white p-1.5 shadow-float rounded-sm">
                      <img src={`${API_BASE_URL}${journal.scene_1_url}`} alt="Scene 1" className="w-full rounded-sm" />
                    </div>
                  </div>
                )}
                {journal.scene_2_url && (
                  <div className="relative" style={{ transform: "rotate(2deg)" }}>
                    <div className="absolute -top-2 right-[25%] w-10 h-3.5 bg-[#8CB369]/20 rounded-sm -rotate-1 z-10 pointer-events-none" />
                    <div className="bg-white p-1.5 shadow-float rounded-sm">
                      <img src={`${API_BASE_URL}${journal.scene_2_url}`} alt="Scene 2" className="w-full rounded-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Diary text */}
            <div className="grid-paper rounded-2xl p-5 border border-[#3D3630]/10 shadow-soft">
              <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3">Diary</p>
              <p className="text-sm leading-[2] journal-font text-[#3D3630]/80 whitespace-pre-wrap">
                {journal.diary_ja || "No diary content."}
              </p>
              {journal.diary_zh && (
                <div className="mt-4 pt-4 border-t border-[#3D3630]/8">
                  <p className="text-xs leading-relaxed text-[#3D3630]/40 italic">{journal.diary_zh}</p>
                </div>
              )}
            </div>

            {/* Podcast script */}
            {journal.podcast_script.length > 0 && (
              <div className="bg-[#FAEBD7]/80 rounded-2xl p-5 border border-[#3D3630]/10 shadow-soft">
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

            {/* Footer */}
            <div className="text-center pt-2 pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="h-px w-8 bg-[#F4A261]/20" />
                <span className="text-[10px] text-[#F4A261]/40">✦</span>
                <div className="h-px w-8 bg-[#F4A261]/20" />
              </div>
              <p className="text-[10px] text-[#3D3630]/20 italic font-serif">LifeEcho Journal &middot; {journal.date}</p>
            </div>

          </div>
        </motion.div>

      </div>
    </div>
  );
}
