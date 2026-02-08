# 缓存和API使用情况分析

## 📊 总体概览

**当前状态：**
- ✅ **已使用API**：人物角色识别、AI头像生成
- ❌ **使用缓存**：对话数据、总结数据、最终输出、音频文件、图片文件

---

## 🔌 **已使用API的部分（无需修改）**

### 1. 人物角色识别 API ✅
- **端点**：`POST /api/detect_roles`
- **位置**：`frontend/app/chat/page.tsx:67`
- **功能**：从用户输入文本中自动识别提到的人物
- **状态**：✅ 已实现，正常工作

### 2. AI头像生成 API ✅
- **端点**：`POST /api/generate_avatar`
- **位置**：`frontend/app/chat/page.tsx:105`
- **功能**：根据角色名称生成AI头像图片
- **状态**：✅ 已实现，正常工作

---

## ❌ **使用缓存的部分（需要替换为API）**

### 1. 对话数据（Communication Raw）
- **缓存文件**：`/cache/communication_raw.json`
- **位置**：`frontend/app/chat/page.tsx:339`
- **后端API**：`POST /api/chat`
- **需要替换**：✅ 需要替换

### 2. 总结数据（Summarize Result）
- **缓存文件**：`/cache/summarize_result.json`
- **位置**：`frontend/app/chat/page.tsx:340`
- **后端API**：`POST /api/summarize`
- **需要替换**：✅ 需要替换

### 3. 精炼总结（Refined Summary）
- **缓存文件**：`/cache/refined_summary_result.json`（可能使用）
- **后端API**：`POST /api/refine_summary`
- **需要替换**：✅ 需要替换

### 4. 最终输出（Podcast and Diary）
- **缓存文件**：`/cache/podcast_and_diary_result.json`
- **位置**：`frontend/app/chat/page.tsx:341`
- **后端API**：`POST /api/generate_podcast_and_diary`
- **需要替换**：✅ 需要替换

### 5. AI回复音频文件
- **缓存文件**：`/cache/ai_replies/reply_1.mp3` ~ `reply_6.mp3`
- **位置**：`frontend/app/chat/page.tsx:374`
- **后端API**：`POST /api/tts` 或 `POST /api/generate_podcast_audio`
- **需要替换**：✅ 需要替换

### 6. 播客完整音频
- **缓存文件**：`/cache/podcast_complete.mp3`
- **位置**：`frontend/app/chat/page.tsx:726`
- **后端API**：`POST /api/generate_podcast_audio`
- **需要替换**：✅ 需要替换

### 7. 场景图片
- **缓存文件**：`/cache/scene_1.png`, `/cache/scene_2.png`
- **位置**：`frontend/app/chat/page.tsx:416, 784, 787`
- **后端API**：`POST /api/generate_image` 或 `POST /api/generate_image_from_prompts`
- **需要替换**：✅ 需要替换

### 8. 用户头像（可选）
- **缓存文件**：`/cache/user_avatar.png`
- **位置**：`frontend/app/chat/page.tsx:45`
- **后端API**：无（使用默认头像）
- **需要替换**：❌ 可选，保持默认即可

---

## 📋 **后端API完整列表**

### 核心对话API
1. **`POST /api/chat`** - 处理对话请求，返回对话回复
   - 输入：`ChatRequest` (context, tone, mentorRole, turn, history)
   - 输出：对话回复（包含user_raw_text, user_ja, reply, translation, suggestion）

2. **`POST /api/summarize`** - 生成总结
   - 输入：`ChatRequest`
   - 输出：总结数据（包含title, summary_ja等）

3. **`POST /api/refine_summary`** - 精炼总结
   - 输入：`RefineRequest` (包含correction_summary)
   - 输出：精炼后的总结

### 内容生成API
4. **`POST /api/generate_podcast_and_diary`** - 生成播客和日记
   - 输入：`FinalGenerationRequest` (communication_raw, refined_summary_ja等)
   - 输出：播客脚本和日记内容

5. **`POST /api/generate_podcast_audio`** - 生成播客音频
   - 输入：播客脚本
   - 输出：音频文件（base64或URL）

6. **`POST /api/generate_image`** - 生成场景图片（完整流程）
   - 输入：`FinalGenerationRequest`
   - 输出：图片（base64或URL）

7. **`POST /api/generate_image_from_prompts`** - 从提示词生成图片
   - 输入：场景提示词
   - 输出：图片（base64或URL）

### 辅助API
8. **`POST /api/tts`** - 文本转语音
   - 输入：text, speaker
   - 输出：音频（base64或URL）

9. **`POST /api/extract_scene_prompts`** - 提取场景提示词
   - 输入：`ChatRequest`
   - 输出：场景提示词列表

10. **`POST /api/detect_roles`** ✅ - 识别人物角色（已使用）
11. **`POST /api/generate_avatar`** ✅ - 生成头像（已使用）

---

## 🔄 **替换计划**

### 阶段1：对话流程
1. 替换 `/cache/communication_raw.json` → 调用 `POST /api/chat`
2. 替换 `/cache/ai_replies/reply_*.mp3` → 调用 `POST /api/tts`

### 阶段2：总结流程
3. 替换 `/cache/summarize_result.json` → 调用 `POST /api/summarize`
4. 替换 `/cache/refined_summary_result.json` → 调用 `POST /api/refine_summary`

### 阶段3：最终生成
5. 替换 `/cache/podcast_and_diary_result.json` → 调用 `POST /api/generate_podcast_and_diary`
6. 替换 `/cache/podcast_complete.mp3` → 调用 `POST /api/generate_podcast_audio`
7. 替换 `/cache/scene_*.png` → 调用 `POST /api/generate_image`

---

## ⚠️ **注意事项**

1. **数据流**：需要按照正确的顺序调用API（对话 → 总结 → 精炼 → 最终生成）
2. **状态管理**：需要添加loading状态和错误处理
3. **音频处理**：API返回的音频可能是base64，需要转换为blob URL
4. **图片处理**：API返回的图片可能是base64，需要转换为图片URL
5. **错误处理**：需要处理API调用失败的情况，提供友好的错误提示
