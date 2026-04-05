# 对话进度云端同步（Supabase）

登录用户的对话缓存会写入 **Supabase 表 `chat_sessions`**，与浏览器 `localStorage` 双写；换设备登录后会自动拉取较新的一份。

## 你需要做的操作

### 1. 在 Supabase 创建表与策略

1. 打开 [Supabase Dashboard](https://supabase.com) → 你的项目。
2. 左侧 **SQL Editor** → **New query**。
3. 将仓库内文件  
   [`supabase/migrations/20260404120000_chat_sessions.sql`](../supabase/migrations/20260404120000_chat_sessions.sql)  
   的**全部内容**复制粘贴到编辑器中。
4. 点击 **Run**。应显示成功；若表已存在可忽略「already exists」类提示（或先 `drop table` 再执行，仅限开发环境）。

### 2. 确认前端环境变量

`frontend/.env.local` 中已配置（与现有 Auth 一致即可）：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

无需新增变量。

### 3. 本地验证

1. 启动前端与后端，使用**已登录**账号打开 `/chat`，进行至少一轮对话（或填写 entry）。
2. 等待约 **2 秒**（防抖上传）。
3. 在 Supabase **Table Editor** 打开 `chat_sessions`，应能看到你的 `user_id` 与 `payload`（JSON）。
4. 换浏览器或使用无痕窗口**同一账号登录**，进入 `/chat`，应弹出「发现未完成的对话」或等价恢复流程（与本地逻辑一致）。

### 4. 退出登录说明

- **退出**时只会清除**当前用户**在本机的 `localStorage` 键，**不会**删除云端 `chat_sessions` 行，因此再次登录仍可恢复。
- 在恢复弹窗中选择**放弃/不恢复**时，会同时删除本地缓存与云端该行。

## 注意事项

- **payload 体积**：若包含大量 `replyAudios`（base64），单行可能较大；若遇写入失败，可考虑后续改为不存音频仅存文本，或压缩/拆分存储。
- **RLS**：仅 `auth.uid() = user_id` 时可读写；匿名用户不会写入该表（代码仅在 `uid` 存在时同步）。
