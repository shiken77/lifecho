export interface ChatTurn {
  user_raw_text: string;
  user_ja: string;
  reply: string;
  translation: string;
  translation_en?: string;
  suggestion: unknown;
}

/** 与 localStorage / Supabase 同步的对话快照 */
export interface CachedSession {
  timestamp: number;
  stage: "entry" | "interaction";
  subStage: "chatting" | "summarizing" | "final";
  chatTurns: ChatTurn[];
  currentRound: number;
  entryText: string;
  role: string;
  tone: string;
  detectedRoles: string[];
  conversationHistory: unknown[];
  communicationRaw: unknown[];
  hasStartedConversation: boolean;
  replyAudios: Record<number, string>;
  summaryData: unknown;
  editableSummary: unknown;
  pendingUserText?: string | null;
  wantImages?: boolean;
}
