import { createClient } from "@/utils/supabase/client";
import type { CachedSession } from "@/types/chatSession";

export async function fetchChatSessionRemote(
  userId: string
): Promise<{ session: CachedSession; updatedAtMs: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[chat_sessions] fetch failed:", error.message);
    return null;
  }
  if (!data?.payload) return null;

  const payload = data.payload as CachedSession;
  if (!payload.timestamp || !payload.stage) return null;

  const updatedAtMs = data.updated_at
    ? new Date(data.updated_at).getTime()
    : payload.timestamp;

  return { session: payload, updatedAtMs };
}

export async function upsertChatSessionRemote(
  userId: string,
  session: CachedSession
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("chat_sessions").upsert(
    {
      user_id: userId,
      payload: session,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.warn("[chat_sessions] upsert failed:", error.message);
  }
}

export async function deleteChatSessionRemote(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("user_id", userId);
  if (error) {
    console.warn("[chat_sessions] delete failed:", error.message);
  }
}
