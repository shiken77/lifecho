"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, Send, Sparkles, ChevronRight, PenLine, Mic, 
  Languages, Volume2, Info, CheckCircle2, Headphones, Layers,
  Download, Share2
} from 'lucide-react';
import { API_BASE_URL } from '../config';

 

// --- 类型定义 ---
interface ChatTurn {
  user_raw_text: string;
  user_ja: string;
  reply: string;
  translation: string;
  translation_en?: string;
  suggestion: any;
}

function HandwrittenTitle() {
  // SVG paths for "LifeECHO" in a handwritten style
  const paths = [
    // L
    { d: "M 20,15 L 20,65 L 45,65", color: "#3D3630" },
    // i
    { d: "M 55,35 L 55,65 M 55,22 L 55,24", color: "#3D3630" }, 
    // f
    { d: "M 75,15 C 70,10 65,10 65,15 L 65,85 M 55,35 L 75,35", color: "#3D3630" },
    // e
    { d: "M 90,50 L 110,50 C 115,40 105,35 95,40 C 90,45 95,65 110,60", color: "#3D3630" },
    // E
    { d: "M 135,15 L 135,65 M 135,15 L 160,15 M 135,40 L 155,40 M 135,65 L 160,65", color: "#E76F51" },
    // C
    { d: "M 195,20 C 170,20 165,60 195,60", color: "#E76F51" },
    // H
    { d: "M 215,15 L 215,65 M 245,15 L 245,65 M 215,40 L 245,40", color: "#E76F51" },
    // O
    { d: "M 280,20 C 255,20 255,60 280,60 C 305,60 305,20 280,20", color: "#E76F51" }
  ];

  return (
    <div className="relative h-48 w-[40rem] mx-auto">
      <svg viewBox="0 0 320 90" className="w-full h-full overflow-visible">
        {paths.map((path, i) => (
          <motion.path
            key={i}
            d={path.d}
            fill="transparent"
            stroke={path.color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ 
              pathLength: { duration: 0.6, ease: "easeInOut", delay: i * 0.2 + 0.2 },
              opacity: { duration: 0.1, delay: i * 0.2 + 0.2 }
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function LifeCHOPage() {
  const [stage, setStage] = useState<'entry' | 'interaction'>('entry');
  const [subStage, setSubStage] = useState<'chatting' | 'summarizing' | 'final'>('chatting');
  
  // 数据状态
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [finalOutput, setFinalOutput] = useState<any>(null);
  const [editableSummary, setEditableSummary] = useState<any>(null);
  
  const [currentRound, setCurrentRound] = useState(0); 
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  // 用户配置状态
  const [tone, setTone] = useState<'温柔/友人' | '正常' | '严肃/工作'>('温柔/友人');
  const [role, setRole] = useState('实验室的朋友');
  
  // Entry页面状态
  const [entryText, setEntryText] = useState('');
  const [detectedRoles, setDetectedRoles] = useState<string[]>([]);
  const [isDetectingRoles, setIsDetectingRoles] = useState(false);
  
  // 头像状态
  const [userAvatar, setUserAvatar] = useState<string>('/cache/user_avatar.png'); // 默认用户头像
  const [aiAvatar, setAiAvatar] = useState<string | null>(null); // AI头像，根据角色生成
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  
  // 播客播放器状态
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 手帐容器引用
  const journalRef = React.useRef<HTMLDivElement>(null);

  // 录音相关状态
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isEntryRecording, setIsEntryRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(12).fill(3));

  // Journal saving state
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);

  // 获取支持的 mimeType
  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  // 开始录音
  const startRecording = async (): Promise<boolean> => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:startRecording',message:'startRecording called',data:{},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // #region agent log
      fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:startRecording:gotStream',message:'getUserMedia success',data:{tracks:stream.getTracks().length},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      streamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200); // 每200ms触发一次ondataavailable
      
      // 启动音频分析（波形可视化）
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // 实时更新波形
      const updateLevels = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        // 取前12个频段，映射到3-28的高度
        const levels = Array.from(data.slice(0, 12)).map(v => Math.max(3, (v / 255) * 28));
        setAudioLevels(levels);
        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(updateLevels);
        }
      };
      requestAnimationFrame(updateLevels);
      
      // 启动计时器
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Unable to access microphone. Please allow microphone permission.');
      return false;
    }
  };

  // 停止录音并返回 base64
  const stopRecording = (): Promise<{ base64: string; mimeType: string } | null> => {
    // 停止计时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    // 停止音频分析
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    setAudioLevels(new Array(12).fill(3));
    
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }
      
      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const chunks = audioChunksRef.current;
        console.log(`🎤 录音结束: ${chunks.length} chunks, mimeType=${mimeType}`);
        // #region agent log
        fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:stopRecording:onstop',message:'mediaRecorder onstop fired',data:{chunksCount:chunks.length,mimeType:mimeType},timestamp:Date.now(),hypothesisId:'H2,H3'})}).catch(()=>{});
        // #endregion
        const audioBlob = new Blob(chunks, { type: mimeType });
        console.log(`🎤 音频Blob大小: ${audioBlob.size} bytes`);
        // 停止所有轨道
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:stopRecording:blobSize',message:'audio blob created',data:{blobSize:audioBlob.size},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        if (audioBlob.size < 500) {
          console.warn('🎤 音频太小，可能没有录到声音');
          // #region agent log
          fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:stopRecording:tooSmall',message:'audio too small, returning null',data:{blobSize:audioBlob.size},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
          // #endregion
          resolve(null);
          return;
        }
        
        // 转 base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1];
          console.log(`🎤 Base64编码完成，长度=${base64.length}`);
          // 将 mimeType 简化（去掉 codecs 部分）
          const simpleMime = mimeType.split(';')[0];
          resolve({ base64, mimeType: simpleMime });
        };
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.stop();
    });
  };

  // 识别人物的函数
  const detectRoles = async (text: string) => {
    if (!text || text.trim() === '') {
      setDetectedRoles([]);
      return;
    }
    
    setIsDetectingRoles(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/detect_roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS' && data.roles && Array.isArray(data.roles)) {
          setDetectedRoles(data.roles);
          // 如果识别到角色，默认选择第一个
          if (data.roles.length > 0) {
            setRole(data.roles[0]);
          }
        } else if (data.status === 'ERROR') {
          console.error('API returned error:', data.error);
          setDetectedRoles([]);
        }
      } else {
        const errorText = await response.text();
        console.error(`HTTP error ${response.status}:`, errorText);
      }
    } catch (err) {
      console.error('Failed to detect roles:', err);
    } finally {
      setIsDetectingRoles(false);
    }
  };

  // 生成AI头像的函数
  const generateAiAvatar = async (roleName: string) => {
    if (!roleName || roleName.trim() === '') return;
    
    setIsGeneratingAvatar(true);
    try {
      // 调用后端API生成头像
      const response = await fetch('http://127.0.0.1:8000/api/generate_avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: roleName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS' && data.image_base64) {
          setAiAvatar(`data:image/png;base64,${data.image_base64}`);
        } else if (data.status === 'ERROR') {
          console.error('API returned error:', data.error);
          setAiAvatar(null);
        }
      } else {
        const errorText = await response.text();
        console.error(`HTTP error ${response.status}:`, errorText);
        setAiAvatar(null);
      }
    } catch (err) {
      console.error('Failed to generate avatar:', err);
      setAiAvatar(null);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 保存手帐为PNG
  const saveJournalAsPNG = async () => {
    if (!journalRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      // 截图目标：右侧“手帐区”容器（含格子背景）
      const panelEl = (document.querySelector('.grid-paper') as HTMLElement) || (journalRef.current.closest('.grid-paper') as HTMLElement) || journalRef.current;
      const canvas = await html2canvas(panelEl as HTMLElement, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        onclone: (doc) => {
          const exclude = doc.querySelector('.export-exclude') as HTMLElement | null;
          if (exclude) exclude.style.display = 'none';
        },
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `LifeEcho_Journal_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Save PNG failed:', error);
      alert('Save failed, please try again later');
    }
  };

  const blobUrlToBase64 = async (blobUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1] || null);
        };
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const saveToJournal = async () => {
    if (isSavingJournal || journalSaved) return;
    setIsSavingJournal(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const audioB64 = podcastAudioUrl ? await blobUrlToBase64(podcastAudioUrl) : null;
      const scene1B64 = sceneImages.scene_1 ? await blobUrlToBase64(sceneImages.scene_1) : null;
      const scene2B64 = sceneImages.scene_2 ? await blobUrlToBase64(sceneImages.scene_2) : null;

      const toneMap: Record<string, string> = { '温柔/友人': 'Gentle', '正常': 'Normal', '严肃/工作': 'Serious' };

      const response = await fetch(`${API_BASE_URL}/api/journal/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          title: summaryData?.title || '',
          diary_ja: finalOutput?.diary?.content_ja || summaryData?.diary_ja || '',
          diary_zh: summaryData?.diary_zh || '',
          podcast_script: finalOutput?.script || [],
          podcast_audio_base64: audioB64,
          scene_1_base64: scene1B64,
          scene_2_base64: scene2B64,
          entry_text: entryText,
          role: role,
          tone: toneMap[tone] || tone,
          rounds: chatTurns.length,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Journal saved:', data.id);
        setJournalSaved(true);
      } else {
        const errText = await response.text();
        console.error('Journal save failed:', errText);
        alert('Failed to save journal. Please try again.');
      }
    } catch (err) {
      console.error('Journal save error:', err);
      alert('Network error. Please check if backend is running.');
    } finally {
      setIsSavingJournal(false);
    }
  };

  // 分享到社交媒体
  const shareToSocialMedia = async () => {
    if (!journalRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const panelEl = (document.querySelector('.grid-paper') as HTMLElement) || (journalRef.current.closest('.grid-paper') as HTMLElement) || journalRef.current;
      const canvas = await html2canvas(panelEl as HTMLElement, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        onclone: (doc) => {
          const exclude = doc.querySelector('.export-exclude') as HTMLElement | null;
          if (exclude) exclude.style.display = 'none';
        },
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], `LifeEcho_Journal_${new Date().getTime()}.png`, { type: 'image/png' });
          try {
            await navigator.share({
              title: summaryData?.title || 'LifeEcho Journal',
              text: 'Sharing my journal',
              files: [file],
            });
            return;
          } catch (err) {
            // fallback
          }
        }
        
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          alert('Image copied to clipboard');
        } catch (err) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `LifeEcho_Journal_${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          alert('Image downloaded, you can share it manually');
        }
      });
    } catch (error) {
      console.error('Share failed:', error);
      alert('Share failed, please try again later');
    }
  };

  // 根据角色名生成固定的色块颜色（不再调用头像API，加速加载）
  const getRoleColor = (name: string) => {
    const colors = ['#B54C62', '#4C7AB5', '#6B4CB5', '#B5874C', '#4CB59A', '#B54C90', '#7A4CB5', '#4C6BB5'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // 当角色改变时，不再调用API生成头像，直接用色块
  useEffect(() => {
    // generateAiAvatar(role); // 禁用：头像生成太慢
    setAiAvatar(null); // 确保使用色块
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // 延迟识别人物（用户输入后1秒）
  useEffect(() => {
    if (!entryText.trim()) {
      setDetectedRoles([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      detectRoles(entryText);
    }, 1000);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryText]);

  // 清理音频播放器
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = '';
      }
    };
  }, [audioPlayer]);

  // 对话历史状态（用于API调用）
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [communicationRaw, setCommunicationRaw] = useState<any[]>([]);
  const [podcastAudioUrl, setPodcastAudioUrl] = useState<string | null>(null);
  const [sceneImages, setSceneImages] = useState<{scene_1: string | null, scene_2: string | null}>({scene_1: null, scene_2: null});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isGeneratingFirstRound, setIsGeneratingFirstRound] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [hasStartedConversation, setHasStartedConversation] = useState(false); // 标记是否已开始对话
  
  // 初始化：不再加载缓存，改为空状态
  useEffect(() => {
    setLoading(false);
  }, []);
  
  // 当进入总结阶段时，调用总结API
  useEffect(() => {
    if (subStage === 'summarizing' && communicationRaw.length > 0 && !summaryData) {
      const generateSummary = async () => {
        setIsGeneratingSummary(true);
        setApiError(null);
        try {
          const toneMap: Record<string, string> = {
            '温柔/友人': 'Gentle',
            '正常': 'Normal',
            '严肃/工作': 'Serious'
          };
          
          const response = await fetch(`${API_BASE_URL}/api/summarize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: entryText,
              tone: toneMap[tone] || 'Gentle',
              mentorRole: role,
              turn: 6,
              history: conversationHistory
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setSummaryData(data);
            setEditableSummary(data);
          } else {
            const errorText = await response.text();
            console.error('Failed to generate summary:', errorText);
            setApiError('Failed to generate summary, please retry');
          }
        } catch (err) {
          console.error('Failed to call summarize API:', err);
          setApiError('Network error, please check if backend is running');
        } finally {
          setIsGeneratingSummary(false);
        }
      }
      generateSummary();
    }
  }, [subStage, communicationRaw, summaryData, conversationHistory, entryText, tone, role]);
  
  // 当进入最终阶段时，生成播客、日记、音频和图片
  useEffect(() => {
    if (subStage === 'final' && summaryData && !finalOutput) {
      const generateFinalOutput = async () => {
        setIsGeneratingFinal(true);
        setApiError(null);
        try {
          const toneMap: Record<string, string> = {
            '温柔/友人': 'Gentle',
            '正常': 'Normal',
            '严肃/工作': 'Serious'
          };
          
          // 1. 生成播客和日记
          const podcastResponse = await fetch(`${API_BASE_URL}/api/generate_podcast_and_diary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              communication_raw: communicationRaw,
              refined_summary_ja: summaryData.diary_ja || editableSummary?.diary_ja || '',
              refined_summary_zh: summaryData.diary_zh || editableSummary?.diary_zh || '',
              context: entryText,
              tone: toneMap[tone] || 'Gentle',
              mentorRole: role
            }),
          });
          
          if (podcastResponse.ok) {
            const podcastData = await podcastResponse.json();
            setFinalOutput(podcastData);
            
            // 2. 生成播客音频
            if (podcastData.script && podcastData.script.length > 0) {
              const audioResponse = await fetch(`${API_BASE_URL}/api/generate_podcast_audio`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  script: podcastData.script
                }),
              });
              
              if (audioResponse.ok) {
                const audioData = await audioResponse.json();
                if (audioData.audio_base64) {
                  // 将base64转换为blob URL
                  const audioBlob = await fetch(`data:audio/mp3;base64,${audioData.audio_base64}`).then(res => res.blob());
                  const audioUrl = URL.createObjectURL(audioBlob);
                  setPodcastAudioUrl(audioUrl);
                }
              }
            }
            
            // 3. 生成场景图片
            const imageResponse = await fetch(`${API_BASE_URL}/api/generate_image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                context: entryText,
                tone: toneMap[tone] || 'Gentle',
                mentorRole: role,
                turn: 6,
                history: conversationHistory
              }),
            });
            
            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              if (imageData.scenes && imageData.scenes.length >= 2) {
                const scene1 = imageData.scenes[0];
                const scene2 = imageData.scenes[1];
                
                // 将base64转换为blob URL
                if (scene1.image_base64) {
                  const imgBlob1 = await fetch(`data:image/png;base64,${scene1.image_base64}`).then(res => res.blob());
                  const imgUrl1 = URL.createObjectURL(imgBlob1);
                  setSceneImages(prev => ({...prev, scene_1: imgUrl1}));
                }
                
                if (scene2.image_base64) {
                  const imgBlob2 = await fetch(`data:image/png;base64,${scene2.image_base64}`).then(res => res.blob());
                  const imgUrl2 = URL.createObjectURL(imgBlob2);
                  setSceneImages(prev => ({...prev, scene_2: imgUrl2}));
                }
              }
            }
          } else {
            const errorText = await podcastResponse.text();
            console.error('Failed to generate podcast and diary:', errorText);
            setApiError('Failed to generate podcast & diary, please retry');
          }
        } catch (err) {
          console.error('Failed to generate final output:', err);
          setApiError('Network error, please check if backend is running');
        } finally {
          setIsGeneratingFinal(false);
        }
      }
      generateFinalOutput();
    }
  }, [subStage, summaryData, finalOutput, communicationRaw, conversationHistory, entryText, tone, role, editableSummary]);

  // 播放AI回复音频（从API返回的base64）
  // 回复音频播放器：每轮 AI 回复独立存储音频
  const [replyAudios, setReplyAudios] = useState<Record<number, string>>({}); // idx -> base64
  const [currentReplyAudio, setCurrentReplyAudio] = useState<HTMLAudioElement | null>(null);
  const [playingReplyIdx, setPlayingReplyIdx] = useState<number | null>(null);

  const playReplyVoice = async (audioBase64: string | null, turnIdx?: number) => {
    if (!audioBase64) {
      console.warn('No audio data available');
      return;
    }
    try {
      // 存储音频数据以便之后重放
      if (turnIdx !== undefined) {
        setReplyAudios(prev => ({ ...prev, [turnIdx]: audioBase64 }));
      }
      // 停止之前的回复音频
      if (currentReplyAudio) {
        currentReplyAudio.pause();
        currentReplyAudio.src = '';
      }
      // 将base64转换为blob URL
      const audioBlob = await fetch(`data:audio/mp3;base64,${audioBase64}`).then(res => res.blob());
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const idx = turnIdx !== undefined ? turnIdx : -1;
      audio.onended = () => {
        setPlayingReplyIdx(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onpause = () => setPlayingReplyIdx(null);
      audio.onplay = () => setPlayingReplyIdx(idx);
      setCurrentReplyAudio(audio);
      setPlayingReplyIdx(idx);
      await audio.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      setPlayingReplyIdx(null);
    }
  };

  const toggleReplyAudioForTurn = async (idx: number) => {
    // 如果当前正在播放这一轮，暂停
    if (playingReplyIdx === idx && currentReplyAudio) {
      currentReplyAudio.pause();
      return;
    }
    // 否则播放这一轮的音频
    const base64 = replyAudios[idx];
    if (base64) {
      await playReplyVoice(base64, idx);
    }
  };

  // 处理第一轮AI提问：用户点击Start后调用API
  const handleFirstRoundAIQuestion = async () => {
    if (!entryText.trim()) {
      alert('Please enter a topic');
      return;
    }
    
    if (!role || role.trim() === '') {
      alert('Please select a role first');
      return;
    }
    
    setIsGeneratingFirstRound(true);
    setApiError(null);
    
    try {
      const toneMap: Record<string, string> = {
        '温柔/友人': 'Gentle',
        '正常': 'Normal',
        '严肃/工作': 'Serious'
      };
      
      // 调用API生成第一轮AI提问（history为空）
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: entryText,
          tone: toneMap[tone] || 'Gentle',
          mentorRole: role,
          turn: 6,
          history: [],  // 第一轮：history为空
          previous_communication_raw: []
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 添加详细的日志输出用于调试
        console.log('API返回数据:', data);
        console.log('communication_raw:', data.communication_raw);
        console.log('reply:', data.reply);
        
        // 检查返回数据格式
        if (!data || !data.reply) {
          throw new Error('API返回数据格式错误：缺少reply字段');
        }
        
        // 第一轮若为错误响应：不写入对话、不开启录音，视为失败
        const isErrorResponse = data.status === 'ERROR' 
          || (typeof data.reply === 'string' && data.reply.trim() === 'Error');
        if (isErrorResponse) {
          const friendlyMessage = (data.reply && data.reply.trim() !== 'Error')
            ? data.reply
            : 'First round failed. Please click Start to retry. If it still fails, check if the backend is running.';
          setApiError(friendlyMessage);
          setHasStartedConversation(false);
          alert(friendlyMessage);
          return;
        }
        
        // 处理对话数据，更新chatTurns
        const processed: ChatTurn[] = [];
        
        // 更新communication_raw
        if (data.communication_raw && Array.isArray(data.communication_raw) && data.communication_raw.length > 0) {
          setCommunicationRaw(data.communication_raw);
          
          const rawArray = data.communication_raw;
          console.log('rawArray长度:', rawArray.length);
          console.log('rawArray内容:', rawArray);
          
          // communication_raw结构：
          // 第一轮：[context(可选), AI回复]
          // 需要显示：用户的种子输入 + AI的第一轮回复
          
          // 先添加用户的种子输入（如果有context项）
          if (rawArray.length > 0 && rawArray[0].role === 'user' && rawArray[0].content === entryText) {
            // 找到AI回复
            const aiReply = rawArray.find((item: any) => item.role === 'model');
            console.log('找到AI回复:', aiReply);
            
            if (aiReply) {
              // 使用后端返回的user_ja，确保是日语版本
              const userJa = rawArray[0].user_ja || data.user_ja || '';
              processed.push({
                user_raw_text: entryText,
                user_ja: userJa, // 使用后端返回的日语版本
                reply: aiReply.reply || aiReply.content || '',
                translation: aiReply.translation || '',
                suggestion: aiReply.suggestion || null
              });
            } else {
              console.warn('在communication_raw中未找到AI回复，使用fallback');
              // Fallback: 使用data.reply
              const userJa = rawArray[0].user_ja || data.user_ja || '';
              processed.push({
                user_raw_text: entryText,
                user_ja: userJa, // 使用后端返回的日语版本
                reply: data.reply,
                translation: data.translation || '',
                suggestion: data.suggestion || null
              });
            }
          } else {
            // 如果没有context项，手动添加用户的种子输入
            const aiReply = rawArray.find((item: any) => item.role === 'model');
            console.log('找到AI回复（无context）:', aiReply);
            
            if (aiReply) {
              // 使用后端返回的user_ja
              const userJa = data.user_ja || '';
              processed.push({
                user_raw_text: entryText,
                user_ja: userJa, // 使用后端返回的日语版本
                reply: aiReply.reply || aiReply.content || '',
                translation: aiReply.translation || '',
                suggestion: aiReply.suggestion || null
              });
            } else {
              console.warn('在communication_raw中未找到AI回复，使用fallback');
              // Fallback: 使用data.reply
              const userJa = data.user_ja || '';
              processed.push({
                user_raw_text: entryText,
                user_ja: userJa, // 使用后端返回的日语版本
                reply: data.reply,
                translation: data.translation || '',
                suggestion: data.suggestion || null
              });
            }
          }
        } else {
          // Fallback: communication_raw为空或不存在，直接使用data.reply创建对话项
          console.warn('communication_raw为空或不存在，使用fallback逻辑');
          const userJa = data.user_ja || '';
          processed.push({
            user_raw_text: entryText,
            user_ja: userJa, // 使用后端返回的日语版本
            reply: data.reply,
            translation: data.translation || '',
            suggestion: data.suggestion || null
          });
        }
        
        // 确保processed数组不为空
        if (processed.length === 0) {
          console.error('processed数组为空，使用最小fallback');
          const userJa = data.user_ja || '';
          processed.push({
            user_raw_text: entryText,
            user_ja: userJa, // 使用后端返回的日语版本
            reply: data.reply || 'Generating AI reply...',
            translation: data.translation || '',
            suggestion: null
          });
        }
        
        console.log('最终processed数组:', processed);
        setChatTurns(processed);
        
        // 标记对话已开始
        setHasStartedConversation(true);
        setApiError(null); // 清除之前的错误
        
        // #region agent log
        fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:firstRound:replyAudio',message:'first round reply_audio check',data:{hasReplyAudio:!!data.reply_audio,replyAudioLen:data.reply_audio?data.reply_audio.length:0,ttsError:data.tts_error||null},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        // 播放AI回复音频（第一轮 turnIdx=0）
        if (data.reply_audio) {
          await playReplyVoice(data.reply_audio, 0);
        }
        
        // 初始化conversationHistory（第一轮只有AI回复）
        setConversationHistory([
          { role: 'model', content: data.reply }
        ]);
        
        // 第一轮AI提问已完成，currentRound设为0
        setCurrentRound(0);
      } else {
        const errorText = await response.text();
        console.error('API call failed:', errorText);
        const errorMessage = 'Failed to generate first round. Error: ' + errorText;
        setApiError(errorMessage);
        // 标记对话未开始，但显示错误信息
        setHasStartedConversation(false);
        alert(errorMessage);
      }
    } catch (err: any) {
      console.error('Failed to call chat API:', err);
      const errorMessage = 'Network error: ' + (err.message || 'Please check if backend is running');
      setApiError(errorMessage);
      // 标记对话未开始，但显示错误信息
      setHasStartedConversation(false);
      alert(errorMessage);
    } finally {
      setIsGeneratingFirstRound(false);
    }
  };

  const handleMicAction = async () => {
    // 工作流校验
    if (chatTurns.length === 0 || !hasStartedConversation) {
      alert('Please start the conversation first before recording.');
      return;
    }
    setVoiceError(null);
    const started = await startRecording();
    if (started) {
      setIsUserSpeaking(true);
    }
  };

  // 处理录音结束：停止录音，将音频发送到后端，获取AI回复
  const handleMicRelease = async () => {
    if (!isUserSpeaking) return;
    setIsUserSpeaking(false);
    
    // 停止录音，获取音频数据
    const audioData = await stopRecording();
    
    if (!audioData) {
      console.warn('🎤 没有录到音频数据');
      setVoiceError('没有录到声音，请再说一遍');
      // 3秒后自动清除提示
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }
    console.log(`🎤 [chat] 音频数据: base64长度=${audioData.base64.length}, mime=${audioData.mimeType}`);
    
    setIsGeneratingReply(true);
    setApiError(null);
      
    try {
      const toneMap: Record<string, string> = {
        '温柔/友人': 'Gentle',
        '正常': 'Normal',
        '严肃/工作': 'Serious'
      };
      
      // 发送音频到后端，Gemini 会同时进行转写和生成回复
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: entryText,
          tone: toneMap[tone] || 'Gentle',
          mentorRole: role,
          turn: 6,
          history: [
            ...conversationHistory,
            { role: 'user', content: '[voice input]' }
          ],
          previous_communication_raw: communicationRaw,
          audio_base64: audioData.base64,
          audio_mime_type: audioData.mimeType
        }),
      });
        
        if (response.ok) {
          const data = await response.json();
          
          // 检查是否返回了ERROR状态（后端内部错误但HTTP 200）
          if (data.status === 'ERROR') {
            console.error('Backend returned ERROR:', data.error || data.reply);
            setVoiceError('AI回复失败，请再说一遍');
            setTimeout(() => setVoiceError(null), 3000);
            setIsGeneratingReply(false);
            return; // 保留当前聊天历史，不更新任何状态
          }
          
          // 检查返回数据格式
          if (!data || !data.reply) {
            throw new Error('API返回数据格式错误');
          }
          
          // 更新对话历史（语音输入时，user_raw_text 由 Gemini 转写返回）
          const userText = data.user_raw_text || '[voice input]';
          const newHistory = [
            ...conversationHistory,
            { role: 'user', content: userText },
            { role: 'model', content: data.reply }
          ];
          setConversationHistory(newHistory);
          
          // 更新communication_raw
          if (data.communication_raw) {
            setCommunicationRaw(data.communication_raw);
            
            // 处理对话数据，更新chatTurns
            const processed: ChatTurn[] = [];
            const rawArray = data.communication_raw;
            
            // communication_raw结构：
            // 第一轮：[context(可选), AI回复]
            // 后续轮次：[context(可选), AI第一轮, User第二轮, AI第二轮, User第三轮, AI第三轮...]
            // 配对逻辑：从索引0开始查找，每找到一对(user, model)就配对
            
            let i = 0;
            // 跳过第一个context项（如果有且role是user但没有user_raw_text）
            if (rawArray.length > 0 && rawArray[0].role === 'user' && !rawArray[0].user_raw_text && rawArray[0].content === entryText) {
              // 第一轮：添加用户的种子输入
              const firstAIReply = rawArray.find((item: any) => item.role === 'model');
              if (firstAIReply) {
                processed.push({
                  user_raw_text: entryText,
                  user_ja: rawArray[0].user_ja || entryText,
                  reply: firstAIReply.reply || firstAIReply.content || '',
                  translation: firstAIReply.translation || '',
                  translation_en: firstAIReply.translation_en || '',
                  suggestion: firstAIReply.suggestion || null
                });
              }
              i = 1;  // 跳过context
            }
            
            // 配对User和AI消息（从第二轮开始）
            while (i < rawArray.length) {
              const current = rawArray[i];
              
              // 如果是AI回复（model），且前面有用户消息
              if (current.role === 'model' && i > 0 && rawArray[i-1].role === 'user') {
                const userMsg = rawArray[i-1];
                const aiMsg = current;
                
                // 跳过第一轮的context项
                if (userMsg.content !== entryText || userMsg.user_raw_text) {
                  processed.push({
                    user_raw_text: userMsg.user_raw_text || userMsg.content || '',
                    user_ja: userMsg.user_ja || '',
                    reply: aiMsg.reply || aiMsg.content || '',
                    translation: aiMsg.translation || '',
                    translation_en: aiMsg.translation_en || '',
                    suggestion: aiMsg.suggestion || null
                  });
                }
              }
              
              i++;
            }
            
            setChatTurns(processed);
            
            // #region agent log
            fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:micRelease:replyAudio',message:'micRelease reply_audio check',data:{hasReplyAudio:!!data.reply_audio,replyAudioLen:data.reply_audio?data.reply_audio.length:0,ttsError:data.tts_error||null,turnIdx:processed.length-1},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
            // #endregion
            // 播放AI回复音频（使用当前轮次索引）
            if (data.reply_audio) {
              await playReplyVoice(data.reply_audio, processed.length - 1);
            }
          }
          
          // 检查是否完成对话
          if (data.status === 'FINISHED') {
            // 先让 currentRound 前进，确保最后一轮的对话内容能显示
            setCurrentRound(prev => Math.max(prev + 1, chatTurns.length - 1));
            setTimeout(() => {
              setSubStage('summarizing');
            }, 2000);
          } else {
            // 自动进入下一轮
            setTimeout(() => {
              nextStep();
            }, 500);
          }
        } else {
          const errorText = await response.text();
          console.error('API call failed:', errorText);
          setApiError('Failed to get AI reply, please retry');
          alert('Failed to get AI reply: ' + errorText);
        }
      } catch (err: any) {
        console.error('Failed to call chat API:', err);
        setApiError('Network error, please check if backend is running');
        alert('Network error: ' + (err.message || 'Please check if backend is running'));
      } finally {
        setIsGeneratingReply(false);
      }
  };

  const nextStep = () => {
    if (currentRound < 5) {
      setCurrentRound(prev => prev + 1);
    } else {
      // 第六轮结束后，显示AI的结束语，然后进入总结阶段
      setSubStage('summarizing');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#FEFCF6]"><div className="w-6 h-6 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin"></div></div>;

  // 手帐风格的装饰食物emoji
  // 暖色系装饰图标 — 四周 + 中间散落，自然随意
  const decoItems = [
    { emoji: '🍞', top: '3%',  left: '4%',   cls: 'float-1', size: 'text-7xl' },
    { emoji: '🌙', top: '2%',  left: '22%',  cls: 'float-4', size: 'text-6xl' },
    { emoji: '☁️', top: '4%',  left: '42%',  cls: 'float-2', size: 'text-7xl' },
    { emoji: '🧁', top: '3%',  right: '16%', cls: 'float-3', size: 'text-8xl' },
    { emoji: '🍰', top: '5%',  right: '2%',  cls: 'float-6', size: 'text-7xl' },
    { emoji: '🥐', top: '22%', left: '2%',   cls: 'float-5', size: 'text-7xl' },
    { emoji: '🐱', top: '46%', left: '3%',   cls: 'float-3', size: 'text-7xl' },
    { emoji: '☀️', top: '20%', right: '3%',  cls: 'float-2', size: 'text-6xl' },
    { emoji: '🐻', top: '44%', right: '2%',  cls: 'float-6', size: 'text-7xl' },
    { emoji: '🐰', top: '72%', right: '3%',  cls: 'float-5', size: 'text-7xl' },
    { emoji: '🍪', bottom: '3%', left: '8%',  cls: 'float-6', size: 'text-7xl' },
    { emoji: '☕', bottom: '4%', left: '44%', cls: 'float-4', size: 'text-8xl' },
    { emoji: '🍦', bottom: '3%', right: '22%',cls: 'float-1', size: 'text-7xl' },
    { emoji: '💛', bottom: '5%', right: '6%', cls: 'float-3', size: 'text-6xl' },
    { emoji: '⭐', top: '16%', left: '16%',  cls: 'float-5', size: 'text-5xl' },
    { emoji: '🍳', top: '32%', left: '14%',  cls: 'float-1', size: 'text-6xl' },
    { emoji: '🌷', top: '60%', left: '16%',  cls: 'float-2', size: 'text-6xl' },
    { emoji: '🍊', top: '18%', right: '15%', cls: 'float-4', size: 'text-6xl' },
    { emoji: '🎀', top: '55%', right: '14%', cls: 'float-6', size: 'text-5xl' },
    { emoji: '🧸', top: '35%', right: '12%', cls: 'float-3', size: 'text-6xl' },
    { emoji: '🍩', top: '68%', left: '30%',  cls: 'float-5', size: 'text-5xl' },
    { emoji: '🌸', top: '12%', left: '55%',  cls: 'float-1', size: 'text-5xl' },
  ];

  return (
    <div className="h-screen w-screen bg-[#FEFCF6] text-[#3D3630] font-sans selection:bg-[#F4A261]/20 overflow-hidden">
      <main className="w-full h-full">
        
        <AnimatePresence mode="wait">
          {stage === 'entry' && (
            <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="w-full h-full relative overflow-hidden paper-texture">
              
              {decoItems.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                  className={`absolute ${item.cls} ${item.size} pointer-events-none select-none`}
                  style={{ 
                    top: item.top, left: item.left, right: item.right, bottom: item.bottom,
                    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))',
                    zIndex: 1
                  }}
                >
                  {item.emoji}
                </motion.div>
              ))}
              
              {/* 中心内容 */}
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-6">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  transition={{ delay: 0.3 }}
                  className="w-full max-w-xl space-y-8"
                >
                  {/* 标题区 - 手帐风格 */}
                  <div className="text-center space-y-3">
                    <motion.div 
                      initial={{ scale: 0.9 }} animate={{ scale: 1 }} 
                      transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
                    >
                      <HandwrittenTitle />
                    </motion.div>
                    <p className="text-base font-serif italic text-[#3D3630]/50 tracking-wide">
                      Don&apos;t forget the sweet moments.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <div className="h-px w-12 bg-[#F4A261]/40"></div>
                      <span className="text-xs text-[#F4A261]">&#10047;</span>
                      <div className="h-px w-12 bg-[#F4A261]/40"></div>
                    </div>
                  </div>

                  {/* 输入卡片 - 手帐纸张风格 */}
                  <div className="relative bg-white rounded-2xl shadow-float p-6 border border-[#3D3630]/5">
                    {/* 胶带装饰 */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#F4A261]/30 rounded-sm -rotate-1"></div>
                    
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#3D3630]/30 uppercase tracking-widest">Today&apos;s Topic</p>
                      </div>
                      <textarea
                        value={entryText}
                        onChange={(e) => setEntryText(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-dashed border-[#F4A261]/30 p-3 text-base outline-none focus:border-[#F4A261] resize-none min-h-[120px] placeholder:text-[#3D3630]/25 leading-relaxed"
                        placeholder="Write or speak about a small moment today... &#10;(What did you eat? Who did you meet?)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            if (entryText.trim()) setStage('interaction');
                          }
                        }}
                      />
                      {voiceError && (
                        <div className="flex items-center gap-2 text-xs text-[#E76F51] bg-[#E76F51]/10 px-3 py-2 rounded-lg">
                          <span>&#9888;</span>
                          <span>{voiceError}</span>
                        </div>
                      )}
                      {isDetectingRoles && (
                        <div className="flex items-center gap-2 text-xs text-[#F4A261]">
                          <div className="w-3 h-3 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin"></div>
                          Detecting characters...
                        </div>
                      )}
                    </div>
                    
                    {/* 录音/开始 组合按钮 */}
                    <div className="flex justify-center pt-2 pb-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const hasText = entryText && entryText.trim().length > 0;
                          
                          // 如果有文本且不在录音/转写中，则进入下一阶段
                          if (hasText && !isEntryRecording && !isTranscribing) {
                            setStage('interaction');
                            return;
                          }

                          if (isEntryRecording) {
                            // 停止录音 → 转写
                            setIsEntryRecording(false);
                            setVoiceError(null);
                            const audioData = await stopRecording();
                            if (!audioData) {
                              setVoiceError('没有录到声音，请再说一遍');
                              return;
                            }
                            setIsTranscribing(true);
                            try {
                              console.log(`🎤 发送音频到 /api/transcribe, base64长度=${audioData.base64.length}, mime=${audioData.mimeType}`);
                              // #region agent log
                              fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:entry:transcribeCall',message:'calling /api/transcribe',data:{base64Len:audioData.base64.length,mimeType:audioData.mimeType},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
                              // #endregion
                              const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ audio_base64: audioData.base64, audio_mime_type: audioData.mimeType }),
                              });
                              const data = await res.json();
                              console.log('🎤 转写结果:', data);
                              // #region agent log
                              fetch('http://127.0.0.1:7285/ingest/efbeea11-004f-4cbf-94ce-bea60844fd1a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c49553'},body:JSON.stringify({sessionId:'c49553',location:'chat/page.tsx:entry:transcribeResult',message:'transcribe API response',data:{status:data.status,text:data.text?.substring(0,100),error:data.error},timestamp:Date.now(),hypothesisId:'H4,H5'})}).catch(()=>{});
                              // #endregion
                              if (data.status === 'SUCCESS' && data.text && data.text.trim()) {
                                setEntryText(prev => prev ? prev + ' ' + data.text : data.text);
                                setVoiceError(null);
                              } else {
                                setVoiceError('没有识别到语音内容，请再说一遍');
                              }
                            } catch (err) {
                              console.error('Transcribe failed:', err);
                              setVoiceError('语音识别失败，请重试');
                            } finally {
                              setIsTranscribing(false);
                            }
                          } else {
                            // 开始录音
                            setVoiceError(null);
                            const started = await startRecording();
                            if (started) setIsEntryRecording(true);
                          }
                        }}
                        className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-sm transition-all ${
                          isEntryRecording 
                            ? 'bg-[#E76F51] text-white animate-pulse ring-4 ring-[#E76F51]/20' 
                            : isTranscribing
                              ? 'bg-[#F4A261]/20 text-[#F4A261] cursor-wait'
                              : (entryText && entryText.trim().length > 0)
                                ? 'bg-[#E76F51] text-white hover:bg-[#E76F51]/90 shadow-md ring-2 ring-[#E76F51]/20'
                                : 'bg-[#E76F51] text-white hover:bg-[#E76F51]/90 shadow-md'
                        }`}
                      >
                        {(entryText && entryText.trim().length > 0 && !isEntryRecording && !isTranscribing) ? (
                          <>
                            <Sparkles size={20} />
                            Start Conversation
                          </>
                        ) : (
                          <>
                            <Mic size={20} />
                            {isEntryRecording ? 'Stop Recording' : isTranscribing ? 'Transcribing...' : 'Tap to Speak'}
                          </>
                        )}
                      </motion.button>
                    </div>

                    {/* 识别到的角色标签 */}
                    {detectedRoles.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-dashed border-[#3D3630]/10">
                        <p className="text-[10px] font-bold text-[#3D3630]/30 uppercase tracking-widest mb-2">Characters</p>
                        <div className="flex flex-wrap gap-2">
                          {detectedRoles.map((r, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-[#FEFCF6] border border-[#F4A261]/30 rounded-full text-xs font-medium text-[#E76F51] hover-3d cursor-default">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>


                </motion.div>
              </div>
            </motion.div>
          )}

          {stage === 'interaction' && (
            <motion.div key="interaction" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full grid grid-cols-[2fr_3fr] gap-5 p-5 min-h-0 bg-[#F4A261]">
              
              {/* 左侧：控制交互栏 - 手帐侧边栏风格 */}
              <div className="flex flex-col min-h-0 bg-white rounded-2xl shadow-lg overflow-hidden">
                
                {/* 模块：Session Config */}
                <div className="p-5 space-y-4 border-b border-dashed border-[#3D3630]/10">
                  <div className="flex items-center gap-2 pb-2">
                    <div className="w-6 h-6 rounded-full bg-[#F4A261]/20 flex items-center justify-center">
                      <Layers size={12} className="text-[#E76F51]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3D3630]/40">Session Config</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <p className="text-[9px] font-bold text-[#3D3630]/40 uppercase">Role</p>
                        <div className="group relative">
                          <Info size={9} className="text-[#3D3630]/20 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-44 p-2 bg-[#3D3630] text-white text-[9px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            Should be a character from the event
                          </div>
                        </div>
                      </div>
                      <select 
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-[#FEFCF6] border border-[#F4A261]/20 p-2 text-xs font-bold text-[#E76F51] rounded-lg outline-none focus:border-[#E76F51]/50 cursor-pointer"
                      >
                        {detectedRoles.length > 0 ? (
                          detectedRoles.map((r, idx) => (
                            <option key={idx} value={r}>{r}</option>
                          ))
                        ) : (
                          <option value="">Enter event first</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-[#3D3630]/40 uppercase">Tone</p>
                      <select 
                        value={tone}
                        onChange={(e) => setTone(e.target.value as '温柔/友人' | '正常' | '严肃/工作')}
                        className="w-full bg-[#FEFCF6] border border-[#F4A261]/20 p-2 text-xs font-bold rounded-lg outline-none focus:border-[#E76F51]/50 cursor-pointer"
                      >
                        <option value="温柔/友人">Gentle / Friend</option>
                        <option value="正常">Normal</option>
                        <option value="严肃/工作">Serious / Keigo</option>
                      </select>
                    </div>
                  </div>
                  {/* 进度条 */}
                  <div className="pt-1">
                    <div className="flex justify-between items-center text-[10px] font-bold mb-1.5 text-[#3D3630]/30">
                      <span>Progress</span>
                      <span className="text-[#E76F51]">ROUND {currentRound + 1}/6</span>
                    </div>
                    <div className="h-1.5 bg-[#3D3630]/5 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-[#F4A261] to-[#E76F51] rounded-full" initial={{ width: 0 }} animate={{ width: `${((currentRound + 1)/6)*100}%` }} />
                    </div>
                  </div>
                  
                  {/* Start按钮 */}
                  {!hasStartedConversation && chatTurns.length === 0 && !isGeneratingFirstRound && (
                    <div className="pt-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleFirstRoundAIQuestion}
                        disabled={!role || !entryText.trim()}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                          !role || !entryText.trim()
                            ? 'bg-[#3D3630]/8 text-[#3D3630]/25 cursor-not-allowed'
                            : 'bg-[#E76F51] text-white shadow-float hover:shadow-float-lg'
                        }`}
                      >
                        Start Conversation
                      </motion.button>
                      {apiError && (
                        <div className="mt-3 p-3 bg-[#E76F51]/5 border border-[#E76F51]/20 rounded-xl">
                          <p className="text-xs text-[#E76F51]">{apiError}</p>
                          <button onClick={() => { setApiError(null); handleFirstRoundAIQuestion(); }} className="mt-2 text-xs text-[#E76F51] underline">
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 模块：对话流 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
                    {chatTurns.slice(0, currentRound + 1).map((turn, idx) => (
                      <div key={idx} className="space-y-5">
                        {/* User bubble */}
                        {turn.user_raw_text && (
                          <div className="flex items-end gap-2.5 justify-end">
                            <div className="flex flex-col items-end max-w-[85%]">
                              <div className="bg-[#F4A261]/15 p-3.5 rounded-2xl rounded-br-md shadow-soft">
                                <p className="text-sm leading-relaxed">{turn.user_raw_text}</p>
                              </div>
                              <p className="mt-1 text-xs text-[#3D3630]/70 font-medium pr-1">
                                Input revised: {turn.user_ja || '...'}
                              </p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-[#F4A261]/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#E76F51] font-bold text-xs">U</span>
                            </div>
                          </div>
                        )}

                        {/* AI bubble */}
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getRoleColor(role) + '25' }}>
                            <span className="font-bold text-xs" style={{ color: getRoleColor(role) }}>{(role || 'AI').charAt(0)}</span>
                          </div>
                          <div className="flex flex-col items-start gap-3 max-w-[85%]">
                            <div className="bg-white p-4 rounded-2xl rounded-bl-md shadow-soft border border-[#3D3630]/5">
                              <p className="text-sm leading-relaxed">{turn.reply}</p>
                              <AnimatePresence>
                                {showTranslation[idx] && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-[#F4A261]/15">
                                    <p className="text-xs text-[#E76F51]/60 italic leading-relaxed font-serif">
                                      {turn.translation_en || turn.translation}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              <div className="mt-3 flex gap-3">
                                <button
                                  onClick={() => toggleReplyAudioForTurn(idx)}
                                  disabled={!replyAudios[idx]}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    playingReplyIdx === idx
                                      ? 'bg-[#E76F51] text-white shadow-soft'
                                      : replyAudios[idx]
                                        ? 'bg-[#F4A261]/15 text-[#E76F51] hover:bg-[#F4A261]/25'
                                        : 'bg-[#3D3630]/5 text-[#3D3630]/20 cursor-not-allowed'
                                  }`}
                                >
                                  <Volume2 size={12} className={playingReplyIdx === idx ? 'animate-pulse' : ''} />
                                  {playingReplyIdx === idx ? 'Pause' : !replyAudios[idx] ? 'No Audio' : 'Play'}
                                </button>
                                {(turn.translation || turn.translation_en) && (
                                  <button onClick={() => setShowTranslation(p => ({...p, [idx]: !p[idx]}))} className="text-[9px] font-bold uppercase tracking-wider text-[#3D3630]/25 hover:text-[#E76F51] flex items-center gap-1 transition-colors">
                                    <Languages size={10} /> {showTranslation[idx] ? 'Hide' : 'Translate'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {turn.suggestion && typeof turn.suggestion === 'string' && !turn.suggestion.includes('index out of range') && !turn.suggestion.includes('Error') && (
                              <div className="bg-[#8CB369]/10 border border-[#8CB369]/20 p-3 text-[10px] leading-relaxed text-[#3D3630]/50 rounded-xl">
                                <p className="font-bold mb-1 text-[#8CB369] flex items-center gap-1"><Info size={10}/> Tip</p>
                                <div className="whitespace-pre-line">{turn.suggestion}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* 加载状态：正在生成第一轮AI提问 */}
                    {isGeneratingFirstRound && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getRoleColor(role) + '25' }}>
                          <div className="w-3.5 h-3.5 border-2 border-[#E76F51]/30 border-t-[#E76F51] rounded-full animate-spin"></div>
                        </div>
                        <div className="flex flex-col items-start gap-3 max-w-[85%]">
                          <div className="bg-white p-4 rounded-2xl rounded-bl-md shadow-soft border border-[#3D3630]/5">
                            <div className="flex items-center gap-2">
                              <div className="w-3.5 h-3.5 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin"></div>
                              <p className="text-sm text-[#3D3630]/40 italic">Preparing...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 加载状态：正在生成AI回复 */}
                    {isGeneratingReply && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getRoleColor(role) + '25' }}>
                          <div className="w-3.5 h-3.5 border-2 border-[#E76F51]/30 border-t-[#E76F51] rounded-full animate-spin"></div>
                        </div>
                        <div className="flex flex-col items-start gap-3 max-w-[85%]">
                          <div className="bg-white p-4 rounded-2xl rounded-bl-md shadow-soft border border-[#3D3630]/5">
                            <div className="flex items-center gap-2">
                              <div className="w-3.5 h-3.5 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin"></div>
                              <p className="text-sm text-[#3D3630]/40 italic">Preparing...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 错误提示 */}
                    {apiError && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#E76F51]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#E76F51] text-xs font-bold">!</span>
                        </div>
                        <div className="max-w-[85%]">
                          <div className="bg-[#E76F51]/5 p-3.5 border border-[#E76F51]/15 rounded-2xl rounded-bl-md">
                            <p className="text-xs text-[#E76F51]">{apiError}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 第六轮结束后的AI结束语 - 仅在对话全部完成后显示 */}
                    {chatTurns.length >= 6 && subStage !== 'chatting' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="flex items-start gap-2.5 mt-4"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getRoleColor(role) + '25' }}>
                          <span className="font-bold text-xs" style={{ color: getRoleColor(role) }}>{(role || 'AI').charAt(0)}</span>
                        </div>
                        <div className="flex flex-col items-start gap-3 max-w-[85%]">
                          <div className="bg-white p-4 rounded-2xl rounded-bl-md shadow-soft border border-[#3D3630]/5">
                            <p className="text-sm font-medium leading-relaxed">
                              お疲れ様でした。今日一日の努力、一緒に今日の日記を書きましょう。
                            </p>
                            <p className="mt-3 text-xs text-[#B54C62] italic leading-relaxed">
                              You've worked hard today. Let's write today's diary together.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Recording Area */}
                  <div className="p-4 border-t border-dashed border-[#3D3630]/8 bg-white/50">
                    <div className="flex items-center gap-3">
                      {/* 麦克风按钮 */}
                      <div className="relative flex items-center justify-center flex-shrink-0">
                        {isUserSpeaking && (
                          <span className="absolute w-14 h-14 rounded-full bg-[#F4A261]/20 mic-ripple" />
                        )}
                        <motion.button 
                          whileTap={chatTurns.length > 0 && hasStartedConversation ? { scale: 1.1 } : {}}
                          onMouseDown={chatTurns.length > 0 && hasStartedConversation ? handleMicAction : undefined}
                          onMouseUp={chatTurns.length > 0 && hasStartedConversation ? handleMicRelease : undefined}
                          onMouseLeave={chatTurns.length > 0 && hasStartedConversation ? handleMicRelease : undefined}
                          onTouchStart={chatTurns.length > 0 && hasStartedConversation ? handleMicAction : undefined}
                          onTouchEnd={chatTurns.length > 0 && hasStartedConversation ? handleMicRelease : undefined}
                          className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            chatTurns.length === 0 || !hasStartedConversation
                              ? 'bg-[#F4A261]/30 cursor-not-allowed opacity-50'
                              : isUserSpeaking
                                ? 'bg-[#E76F51] shadow-float-lg'
                                : 'bg-[#F4A261] hover:bg-[#E76F51] shadow-float hover:shadow-float-lg'
                          }`}
                          title={chatTurns.length === 0 || !hasStartedConversation ? 'Start conversation first' : 'Hold to record'}
                        >
                          <Mic size={20} className="text-white" />
                        </motion.button>
                      </div>
                      
                      {/* 波形 + 计时 */}
                      <div className="flex-1 flex items-center gap-2">
                        {isUserSpeaking ? (
                          <>
                            {/* 实时音频波形 */}
                            <div className="flex items-center gap-[2px] h-8 flex-1">
                              {audioLevels.map((level, i) => (
                                <div
                                  key={i}
                                  className="w-1 rounded-full bg-[#E76F51] transition-all duration-100"
                                  style={{ height: `${level}px` }}
                                />
                              ))}
                            </div>
                            {/* 录音计时 */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-[#E76F51] animate-pulse" />
                              <span className="text-sm font-mono text-[#E76F51] font-bold tabular-nums">
                                {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center">
                            {voiceError ? (
                              <p className="text-xs text-[#E76F51] font-medium">{voiceError}</p>
                            ) : (chatTurns.length === 0 || !hasStartedConversation) ? (
                              <p className="text-[10px] text-[#3D3630]/30">Start conversation first</p>
                            ) : isGeneratingReply ? (
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin" />
                                <p className="text-[10px] text-[#3D3630]/30">Processing voice...</p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-[#3D3630]/30">Hold mic button to speak</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧：进化面板（手帐区） */}
              <div className="relative grid-paper rounded-2xl shadow-lg flex flex-col overflow-hidden">
                <AnimatePresence>
                  {subStage === 'chatting' && (
                    <motion.div exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center opacity-[0.04]">
                      <span className="text-8xl">📝</span>
                      <p className="font-serif italic text-xl mt-4 text-[#3D3630]">Collecting your sparkles...</p>
                    </motion.div>
                  )}

                  {subStage === 'summarizing' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center p-8 bg-[#FEFCF6]/95">
                      <div className="max-w-xl w-full bg-white rounded-2xl shadow-float p-10 space-y-8 relative">
                        {/* 胶带装饰 */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#8CB369]/30 rounded-sm rotate-1"></div>
                        
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 bg-[#E76F51] rounded-full"></div>
                          <h2 className="text-2xl font-serif font-black text-[#3D3630]">Today&apos;s Summary</h2>
                        </div>
                        {isGeneratingSummary ? (
                          <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin mb-3"></div>
                            <p className="text-sm text-[#3D3630]/40">Generating summary...</p>
                          </div>
                        ) : apiError ? (
                          <div className="bg-[#E76F51]/5 border border-[#E76F51]/20 p-4 rounded-xl text-[#E76F51] text-sm">
                            {apiError}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <input className="w-full bg-[#FEFCF6] p-3 font-bold rounded-xl outline-none border border-[#F4A261]/15 focus:border-[#E76F51]/30" defaultValue={summaryData?.title} />
                            <textarea className="w-full bg-[#FEFCF6] p-3 h-40 text-sm leading-[1.8] outline-none resize-none font-serif rounded-xl border border-[#F4A261]/15 focus:border-[#E76F51]/30" defaultValue={summaryData?.diary_ja} />
                          </div>
                        )}
                        {!isGeneratingSummary && !apiError && (
                        <button 
                          onClick={async () => {
                            // 如果用户修改了总结，先调用refine_summary API
                            const titleInput = document.querySelector('input[defaultValue]') as HTMLInputElement;
                            const summaryTextarea = document.querySelector('textarea[defaultValue]') as HTMLTextAreaElement;
                            
                            if (titleInput && summaryTextarea) {
                              const newTitle = titleInput.value;
                              const newSummary = summaryTextarea.value;
                              
                              // 如果内容有变化，调用refine API
                              if (newTitle !== summaryData?.title || newSummary !== summaryData?.diary_ja) {
                                try {
                                  const toneMap: Record<string, string> = {
                                    '温柔/友人': 'Gentle',
                                    '正常': 'Normal',
                                    '严肃/工作': 'Serious'
                                  };
                                  
                                  const refineResponse = await fetch(`${API_BASE_URL}/api/refine_summary`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      context: entryText,
                                      tone: toneMap[tone] || 'Gentle',
                                      mentorRole: role,
                                      turn: 6,
                                      history: conversationHistory,
                                      correction_summary: newSummary
                                    }),
                                  });
                                  
                                  if (refineResponse.ok) {
                                    const refinedData = await refineResponse.json();
                                    setSummaryData({
                                      ...summaryData,
                                      title: newTitle,
                                      diary_ja: refinedData.refined_summary_ja,
                                      diary_zh: refinedData.refined_summary_zh
                                    });
                                    setEditableSummary({
                                      ...summaryData,
                                      title: newTitle,
                                      diary_ja: refinedData.refined_summary_ja,
                                      diary_zh: refinedData.refined_summary_zh
                                    });
                                  }
                                } catch (err) {
                                  console.error('Failed to refine summary:', err);
                                }
                              }
                            }
                            
                            setSubStage('final');
                          }} 
                          className="w-full py-4 bg-[#E76F51] text-white font-bold rounded-xl shadow-float hover:shadow-float-lg transition-shadow"
                        >
                          Confirm & Generate ✨
                        </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {subStage === 'final' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col p-6 overflow-hidden">
                      {isGeneratingFinal ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-3 border-[#F4A261]/30 border-t-[#F4A261] rounded-full animate-spin mb-3"></div>
                          <p className="text-base text-[#3D3630]/40 journal-font">Generating journal...</p>
                          <p className="text-xs text-[#3D3630]/25 mt-1">Please wait a moment ☕</p>
                        </div>
                      ) : apiError ? (
                        <div className="bg-[#E76F51]/5 border border-[#E76F51]/15 p-5 rounded-2xl text-[#E76F51]">
                          <p className="font-bold mb-1 text-sm">Generation Failed</p>
                          <p className="text-xs opacity-70">{apiError}</p>
                        </div>
                      ) : finalOutput ? (
                      <React.Fragment>
                      <div ref={journalRef} className="flex-1 flex flex-col min-h-0">
                      
                      {/* 日期 + LOOK BACK: title - 记号笔风格 */}
                      <div className="mb-3 flex-shrink-0">
                        <p className="marker-text text-3xl text-[#3D3630] uppercase tracking-wide leading-tight">
                          {new Date().toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} {new Date().getDate()}
                        </p>
                        <p className="text-base text-[#3D3630]/70 leading-snug mt-0.5">
                          <span className="marker-text uppercase tracking-wide">LOOK BACK:</span>{" "}
                          <span className="marker-text text-[#E76F51]">{summaryData?.title || 'Untitled'}</span>
                        </p>
                      </div>

                      {/* 播客播放器 */}
                      <div className="bg-white rounded-2xl shadow-soft border border-[#3D3630]/5 px-4 py-2.5 mb-3 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                          <button 
                            onClick={async () => {
                              if (!audioPlayer) {
                                const audioUrl = podcastAudioUrl || '/cache/podcast_complete.mp3';
                                const audio = new Audio(audioUrl);
                                audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
                                audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
                                audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); });
                                setAudioPlayer(audio);
                                await audio.play();
                                setIsPlaying(true);
                              } else {
                                if (isPlaying) { audioPlayer.pause(); setIsPlaying(false); }
                                else { await audioPlayer.play(); setIsPlaying(true); }
                              }
                            }} 
                            className="w-8 h-8 bg-[#E76F51] rounded-full flex items-center justify-center shadow-soft hover:scale-105 transition-all flex-shrink-0"
                          >
                            {isPlaying ? <Pause fill="white" size={12} /> : <Play fill="white" size={12} />}
                          </button>
                          <input
                            type="range" min="0" max={duration || 100} value={currentTime}
                            onChange={(e) => { const t = parseFloat(e.target.value); setCurrentTime(t); if (audioPlayer) audioPlayer.currentTime = t; }}
                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-[#E76F51]"
                            style={{ background: `linear-gradient(to right, #E76F51 0%, #E76F51 ${(currentTime / (duration || 1)) * 100}%, #3D363010 ${(currentTime / (duration || 1)) * 100}%, #3D363010 100%)` }}
                          />
                          <div className="text-sm text-[#3D3630]/50 font-mono font-bold flex-shrink-0">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </div>
                        </div>
                      </div>

                      {/* 主体内容区 - 固定高度, 参考手帐布局 */}
                      <div className="flex-1 relative min-h-0">
                        {/* 图片2 - 左上，大幅歪斜 */}
                        <div className="absolute top-0 left-0 w-[42%] z-10" style={{ transform: 'rotate(-5deg) translate(-4px, 0)' }}>
                          <div className="bg-white p-1.5 shadow-float" style={{ borderRadius: '2px' }}>
                            <img src={sceneImages.scene_2 || '/cache/scene_2.png'} className="w-full object-cover" style={{ aspectRatio: '4/3', borderRadius: '1px' }} onError={(e) => e.currentTarget.src='https://via.placeholder.com/400?text=Scene+2'} />
                          </div>
                        </div>
                        
                        {/* 播客脚本区 - 右上 */}
                        <div className="absolute top-0 right-0 w-[54%] h-[55%] bg-[#FAEBD7]/80 rounded-2xl p-4 overflow-y-auto scrollbar-hide border border-[#3D3630]/10 shadow-float">
                          <div className="space-y-2.5">
                            {finalOutput?.script && finalOutput.script.length > 0 ? (
                              finalOutput.script.map((line: any, idx: number) => {
                                const speakerLower = (line.speaker || '').toLowerCase();
                                const isUser = speakerLower === '用户' || speakerLower === 'user' || speakerLower.includes('ユーザー');
                                const displaySpeaker = isUser ? 'Me' : (role || line.speaker || 'AI');
                                return (
                                  <div key={idx} className={`flex ${isUser ? 'items-end gap-2 justify-end' : 'items-start gap-2'}`}>
                                    {!isUser && (
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: getRoleColor(role) + '25' }}>
                                        <span className="font-bold text-[10px]" style={{ color: getRoleColor(role) }}>{(displaySpeaker).charAt(0)}</span>
                                      </div>
                                    )}
                                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                      <p className="text-[10px] text-[#3D3630]/50 mb-1 font-bold journal-font">{displaySpeaker}</p>
                                      <div className={`${isUser ? 'bg-[#F4A261]/10' : 'bg-[#FEFCF6]'} px-3 py-2.5 rounded-lg`}>
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
                              })
                            ) : (
                              <p className="text-xs text-[#3D3630]/30 italic text-center py-2 journal-font">Loading...</p>
                            )}
                          </div>
                        </div>

                        {/* 图片1 - 左下，歪斜 */}
                        <div className="absolute bottom-0 left-0 w-[40%] z-10" style={{ transform: 'rotate(4deg) translate(8px, 4px)' }}>
                          <div className="bg-white p-1.5 shadow-float" style={{ borderRadius: '2px' }}>
                            <img src={sceneImages.scene_1 || '/cache/scene_1.png'} className="w-full object-cover" style={{ aspectRatio: '4/3', borderRadius: '1px' }} onError={(e) => e.currentTarget.src='https://via.placeholder.com/400?text=Scene+1'} />
                          </div>
                        </div>

                        {/* 日记区 - 右下 */}
                        <div className="absolute bottom-0 right-0 w-[54%] h-[40%] bg-[#FAEBD7]/80 rounded-2xl p-4 overflow-y-auto scrollbar-hide border border-[#3D3630]/10 shadow-float">
                          <p className="text-sm leading-[2] journal-font text-[#3D3630]/80">
                            {finalOutput?.diary?.content_ja || "Loading..."}
                          </p>
                        </div>
                      </div>

                      </div>
                      {/* 操作按钮 */}
                      <div className="export-exclude flex items-center justify-center gap-3 pt-3 mt-2 border-t border-dashed border-[#3D3630]/8 flex-shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={saveToJournal}
                          disabled={isSavingJournal || journalSaved}
                          className={`flex items-center gap-2 px-5 py-2 rounded-xl shadow-soft font-medium text-xs transition-all ${
                            journalSaved
                              ? 'bg-[#8CB369] text-white cursor-default'
                              : isSavingJournal
                                ? 'bg-[#F4A261]/50 text-white cursor-wait'
                                : 'bg-[#E76F51] text-white hover:bg-[#E76F51]/90'
                          }`}
                        >
                          {journalSaved ? (
                            <><CheckCircle2 size={13} /><span>Saved</span></>
                          ) : isSavingJournal ? (
                            <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                          ) : (
                            <><PenLine size={13} /><span>Save to Journal</span></>
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={saveJournalAsPNG}
                          className="flex items-center gap-2 px-5 py-2 bg-white border border-[#3D3630]/10 text-[#3D3630] rounded-xl shadow-soft font-medium text-xs"
                        >
                          <Download size={13} />
                          <span>PNG</span>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={shareToSocialMedia}
                          className="flex items-center gap-2 px-5 py-2 bg-white border border-[#3D3630]/10 text-[#3D3630] rounded-xl shadow-soft font-medium text-xs"
                        >
                          <Share2 size={13} />
                          <span>Share</span>
                        </motion.button>
                      </div>
                      </React.Fragment>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Kosugi+Maru&family=M+PLUS+Rounded+1c:wght@300;400;500&family=Zen+Maru+Gothic:wght@400;500&family=Permanent+Marker&family=Patrick+Hand&family=Caveat:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif SC', serif; }
      `}</style>
    </div>
  );
}
