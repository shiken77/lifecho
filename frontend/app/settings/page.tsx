"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface SettingItemProps {
  icon: string;
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingItem({ icon, label, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-amber-200/40 shadow-soft hover:shadow-float transition-shadow">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#3D3630]">{label}</p>
        <p className="text-[11px] text-[#3D3630]/35 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div className={`w-10 h-[22px] rounded-full relative transition-colors cursor-pointer ${
      checked ? "bg-[#E76F51]" : "bg-[#3D3630]/10"
    }`}>
      <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
        checked ? "left-[22px]" : "left-[3px]"
      }`} />
    </div>
  );
}

export default function SettingsPage() {
  const [voiceModel, setVoiceModel] = useState("natural");
  const [theme, setTheme] = useState("warm");

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] paper-texture overflow-auto">
      <div className="max-w-xl mx-auto px-6 pt-20 pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-end gap-3">
            <span className="text-4xl">⚙️</span>
            <div>
              <h1 className="text-2xl font-black text-[#3D3630] marker-text">Settings</h1>
              <p className="text-xs text-[#3D3630]/30 mt-0.5">Customize your LifeEcho experience</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-amber-200/50" />
            <span className="text-[10px] text-[#F4A261]/50">✦</span>
            <div className="h-px flex-1 bg-amber-200/50" />
          </div>
        </motion.div>

        {/* Settings sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-8"
        >
          {/* Voice & AI */}
          <section>
            <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3 pl-1">Voice & AI</p>
            <div className="space-y-2.5">
              <SettingItem icon="🎙️" label="Voice Model" description="Choose the voice for podcast generation">
                <select
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-1.5 text-xs font-medium text-[#3D3630] outline-none focus:border-[#E76F51]/40 cursor-pointer"
                >
                  <option value="natural">Natural</option>
                  <option value="warm">Warm</option>
                  <option value="calm">Calm</option>
                  <option value="energetic">Energetic</option>
                </select>
              </SettingItem>

              <SettingItem icon="🌐" label="Language" description="Interface and conversation language">
                <select
                  className="bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-1.5 text-xs font-medium text-[#3D3630] outline-none focus:border-[#E76F51]/40 cursor-pointer"
                  defaultValue="ja"
                >
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </SettingItem>

              <SettingItem icon="🔄" label="Conversation Rounds" description="Number of dialogue rounds per session">
                <span className="bg-amber-50 border border-amber-200/60 rounded-lg px-4 py-1.5 text-xs font-bold text-[#E76F51]">6</span>
              </SettingItem>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3 pl-1">Appearance</p>
            <div className="space-y-2.5">
              <SettingItem icon="🎨" label="Theme" description="Choose your journal color palette">
                <div className="flex items-center gap-2">
                  {[
                    { id: "warm", colors: ["#F4A261", "#E76F51"] },
                    { id: "sage", colors: ["#8CB369", "#5A8A3C"] },
                    { id: "sky", colors: ["#7EC8E3", "#4A9BBF"] },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        theme === t.id ? "border-[#3D3630]/40 scale-110" : "border-transparent"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
                    >
                      {theme === t.id && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </SettingItem>

              <SettingItem icon="✏️" label="Journal Font" description="Font style for diary output">
                <span className="bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-1.5 text-xs font-medium text-[#3D3630] journal-font">
                  手帐体
                </span>
              </SettingItem>

              <SettingItem icon="🔔" label="Notifications" description="Daily reminder to write your journal">
                <Toggle checked={true} />
              </SettingItem>
            </div>
          </section>

          {/* Account */}
          <section>
            <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-[0.2em] mb-3 pl-1">Account</p>
            <div className="space-y-2.5">
              <SettingItem icon="👤" label="Profile" description="Manage your avatar and display name">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3D3630" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </SettingItem>

              <SettingItem icon="☁️" label="Data Sync" description="Backup journals to the cloud">
                <Toggle checked={false} />
              </SettingItem>
            </div>
          </section>
        </motion.div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-px w-8 bg-[#F4A261]/20" />
            <span className="text-[10px] text-[#F4A261]/40">✦</span>
            <div className="h-px w-8 bg-[#F4A261]/20" />
          </div>
          <p className="text-[10px] text-[#3D3630]/20 italic font-serif">LifeEcho v0.1.0</p>
        </div>

      </div>
    </div>
  );
}
