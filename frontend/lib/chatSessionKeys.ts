/** localStorage key：按用户隔离，需与历史数据一致 */
export function chatSessionLocalKey(userId: string) {
  return `lifecho_chat_session_${userId}`;
}
