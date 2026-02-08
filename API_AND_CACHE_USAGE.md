# API 和 Cache 使用情况分析

## 📊 总体概览

项目中**前端主要使用缓存文件**来展示数据，**API主要用于实时生成功能**。

---

## 🗂️ **使用 CACHE（缓存文件）的部分**

### 前端加载的缓存文件（`frontend/public/cache/`）

1. **对话数据**
   - `/cache/communication_raw.json` - 原始对话数据
   - 位置：`frontend/app/chat/page.tsx:210`
   - 用途：加载对话历史，显示聊天记录

2. **总结数据**
   - `/cache/summarize_result.json` - 总结结果
   - 位置：`frontend/app/chat/page.tsx:211`
   - 用途：显示总结标题和内容

3. **最终输出数据**
   - `/cache/podcast_and_diary_result.json` - 播客和日记结果
   - 位置：`frontend/app/chat/page.tsx:212`
   - 用途：显示最终日记内容和播客脚本

4. **音频文件**
   - `/cache/ai_replies/reply_1.mp3` ~ `reply_6.mp3` - AI回复音频
   - 位置：`frontend/app/chat/page.tsx:245`
   - 用途：播放AI语音回复

5. **图片文件**
   - `/cache/scene_1.png` - 场景图片1
   - `/cache/scene_2.png` - 场景图片2
   - 位置：`frontend/app/chat/page.tsx:520, 523`
   - 用途：在最终日记页面显示场景图片

6. **播客音频**
   - `/cache/podcast_complete.mp3` - 完整播客音频
   - 位置：`frontend/app/chat/page.tsx:627`
   - 用途：播放最终生成的播客

### 缓存文件加载时机
- **页面加载时**：通过 `useEffect` 在组件挂载时一次性加载所有缓存文件
- **代码位置**：`frontend/app/chat/page.tsx:205-218`

---

## 🔌 **使用 API 的部分**

### 前端调用的 API（`http://127.0.0.1:8000/api/`）

1. **识别人物角色 API**
   - 端点：`POST /api/detect_roles`
   - 位置：`frontend/app/chat/page.tsx:63`
   - 用途：从用户输入的文本中自动识别提到的人物
   - 触发时机：用户在entry页面输入文字后1秒自动触发
   - 依赖：Gemini API（需要网络连接）

2. **生成AI头像 API**
   - 端点：`POST /api/generate_avatar`
   - 位置：`frontend/app/chat/page.tsx:134`
   - 用途：根据角色名称生成AI头像图片
   - 触发时机：当用户选择或输入角色名称时自动触发
   - 依赖：Gemini API + nano-banana-pro-preview 模型（需要网络连接）

### 后端提供的所有 API（`backend/main1.py`）

1. **核心对话API**
   - `POST /api/chat` - 处理对话请求
   - `POST /api/summarize` - 生成总结
   - `POST /api/refine_summary` - 精炼总结

2. **内容生成API**
   - `POST /api/generate_podcast_and_diary` - 生成播客和日记
   - `POST /api/generate_podcast_audio` - 生成播客音频
   - `POST /api/generate_image` - 生成场景图片（完整流程）
   - `POST /api/generate_image_from_prompts` - 从提示词生成图片

3. **辅助API**
   - `POST /api/tts` - 文本转语音
   - `POST /api/extract_scene_prompts` - 提取场景提示词
   - `POST /api/detect_roles` - 识别人物角色 ⭐（前端使用）
   - `POST /api/generate_avatar` - 生成头像 ⭐（前端使用）

---

## 📝 **总结**

### 当前使用模式

**✅ 缓存文件（主要数据源）**
- 对话历史
- 总结内容
- 最终输出（日记、播客）
- 音频文件
- 场景图片

**✅ API调用（实时功能）**
- 人物角色识别（可选，失败不影响使用）
- AI头像生成（可选，失败时显示默认文字头像）

### 关键发现

1. **前端主要依赖缓存文件**：所有核心数据（对话、总结、日记）都从缓存文件加载
2. **API主要用于增强功能**：人物识别和头像生成是增强功能，不是必需的
3. **API失败不影响核心功能**：即使API不可用，用户仍可以：
   - 手动输入角色名称
   - 使用默认的文字头像（显示"AI"）
   - 正常查看所有缓存的数据

### 建议

如果API在中国无法使用，可以考虑：
1. 移除API调用，改为手动输入角色
2. 使用预设的头像图片替代生成
3. 所有功能仍然可以正常使用，只是缺少自动识别和头像生成功能


