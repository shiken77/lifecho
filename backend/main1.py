import os
import json
import base64
import sqlite3
import httpx
import google.generativeai as genai # google官方的sdk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Literal, Optional
from dotenv import load_dotenv
from google.cloud import texttospeech
from datetime import datetime
from pathlib import Path
from io import BytesIO

# 加载环境变量
load_dotenv()
app = FastAPI()

# --- Uploads directory & SQLite setup ---
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

DB_PATH = Path(__file__).parent / "journals.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS journals (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            session_num INTEGER NOT NULL,
            title TEXT,
            diary_ja TEXT,
            diary_zh TEXT,
            podcast_script TEXT,
            podcast_audio_path TEXT,
            scene_1_path TEXT,
            scene_2_path TEXT,
            thumbnail_path TEXT,
            entry_text TEXT,
            role TEXT,
            tone TEXT,
            rounds INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(date)")
    conn.commit()
    conn.close()

init_db()

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# 健康检查路由
@app.get("/")
async def root():
    return {"status": "ok", "message": "LifeEcho Backend is running"}

# 跨域配置：允许前端 3000 端口访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://shikan77.github.io",
        "*"  # 允许所有来源，确保连通性
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 核心配置区 (请在 .env 文件中填写) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-flash-latest")  # 默认使用 gemini-flash-latest
genai.configure(api_key=GEMINI_API_KEY)

# --- 数据模型 ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    context: str = ""  # 种子话题（用户在P1首页输入的"今日发生的事情"）
    tone: Literal["Gentle", "Normal", "Serious"]  # 语气：只能选择 Gentle, Normal, Serious 三种
    mentorRole: str = ""  # 角色名称
    turn: int = 6   # 设定轮次，默认6轮
    history: list[Message]
    previous_communication_raw: list[dict] = []  # 之前的完整 communication_raw（可选），用于保留所有字段
    audio_base64: str = ""  # 用户语音输入（base64编码，可选）
    audio_mime_type: str = "audio/webm"  # 音频MIME类型

class RefineRequest(ChatRequest):
    correction_summary: str  # 用户输入的修正内容

class FinalGenerationRequest(BaseModel):
    communication_raw: list[dict]  # 原始对话历史（communication_raw 格式）
    refined_summary_ja: str  # 精炼后的摘要（日语）
    refined_summary_zh: str = ""  # 精炼后的摘要（中文，可选）
    context: str = ""
    tone: Literal["Gentle", "Normal", "Serious"]
    mentorRole: str = ""
    
    def to_history(self) -> list[Message]:
        """
        将 communication_raw 和 refined_summary_ja 组合成 history 格式
        """
        history = []
        
        # 1. 添加 communication_raw 中的所有消息
        for item in self.communication_raw:
            if isinstance(item, dict) and "role" in item and "content" in item:
                history.append(Message(
                    role=item["role"],
                    content=item["content"]
                ))
        
        # 2. 将 refined_summary_ja 作为用户的消息添加到 history 末尾
        # 这表示用户对对话的总结和反思
        if self.refined_summary_ja:
            history.append(Message(
                role="user",
                content=f"[日记摘要] {self.refined_summary_ja}"
            ))
        
        return history

# --- 通用工具函数：清理 AI 返回的 JSON 格式 ---
def clean_json_content(content: str):
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    return json.loads(content)

# --- TTS 客户端初始化, 文字转语音 ---
# 确保 Google Cloud 凭证路径正确设置
google_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
tts_client = None

try:
    if google_creds_json:
        from google.oauth2 import service_account
        creds_dict = json.loads(google_creds_json)
        credentials = service_account.Credentials.from_service_account_info(creds_dict)
        tts_client = texttospeech.TextToSpeechClient(credentials=credentials)
        print("✅ Google TTS 客户端初始化成功 (从环境变量)")
    else:
        tts_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if tts_credentials_path and not os.path.isabs(tts_credentials_path):
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            tts_credentials_path = os.path.join(backend_dir, tts_credentials_path)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tts_credentials_path

        tts_client = texttospeech.TextToSpeechClient()
        print("✅ Google TTS 客户端初始化成功 (从文件)")
except Exception as e:
    print(f"❌ Google TTS 客户端初始化失败: {e}")
    tts_client = None

# #region agent log
try:
    import time as _time_mod
    _log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cursor', 'debug-c49553.log')
    _tts_ok = tts_client is not None
    with open(_log_path, 'a') as _f: _f.write(json.dumps({"sessionId":"c49553","location":"main1.py:tts_init","message":"TTS init " + ("success" if _tts_ok else "FAILED"),"data":{"tts_ok":_tts_ok},"timestamp":int(_time_mod.time()*1000),"hypothesisId":"H1"})+'\n')
except Exception: pass
# #endregion

# --- TTS 辅助函数：语音合成 ---
async def synthesize_speech(text: str, speaker: str = "model"):
    """
    语音合成辅助函数
    :param text: 要合成的文本
    :param speaker: 说话人类型，"model" 为导师，"user" 为用户
    :return: 包含 audio_base64 的字典，失败时返回包含 error 的字典
    """
    if tts_client is None:
        error_msg = "TTS 客户端未初始化，请检查 Google Cloud 凭证配置"
        print(f"❌ {error_msg}")
        return {"error": error_msg}
    
    try:
        # 1. 根据 speaker 参数选择音色
        # 如果是 model (导师)，用音色 B；如果是 user (用户)，用音色 C
        voice_name = "ja-JP-Neural2-B" if speaker == "model" else "ja-JP-Neural2-C"
        print(f"🔊 开始合成语音: 文本长度={len(text)}, 音色={voice_name}")
        
        synthesis_input = texttospeech.SynthesisInput(text=text)

        voice = texttospeech.VoiceSelectionParams(
            language_code="ja-JP",
            name=voice_name
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            pitch=0.0,       # 音高调整，0.0 为正常
            speaking_rate=1.0 # 语速调整
        )

        response = tts_client.synthesize_speech(
            input=synthesis_input, 
            voice=voice, 
            audio_config=audio_config
        )

        audio_base64 = base64.b64encode(response.audio_content).decode("utf-8")
        print(f"✅ TTS 合成成功: 音频大小={len(audio_base64)} 字符")
        return {"audio_base64": audio_base64, "speaker": speaker}

    except Exception as e:
        error_msg = f"TTS 合成失败: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()  # 打印完整错误堆栈
        return {"error": error_msg}

# ===========================
# 1. 实时对话接口 (含 5W1R 引导)
# ===========================
@app.post("/api/chat")
async def chat(request: ChatRequest):
    # 根据 tone 值设置语气描述
    tone_descriptions = {
        "Gentle": "温柔、友善、鼓励性的语气，使用温和的日语表达（タメ口 OK），多用「〜だね」「〜よ」「〜でしょ」等亲密的结尾，像好朋友一样随意自然",
        "Normal": "自然、平和的语气，使用です/ます体，保持适度礼貌但不过于正式，像普通同事或熟人之间的交流",
        "Serious": "⚠️ 职场/正式敬语场景。必须全程使用完整的敬語（けいご）：です/ます体为基础，积极使用尊敬語（いらっしゃる、おっしゃる、ご覧になる等）和謙譲語（申す、参る、いたす等），以及丁寧語。句尾一律用「〜でございます」「〜いたします」「〜くださいませ」等。绝对不能使用タメ口或普通体。"
    }
    tone_description = tone_descriptions.get(request.tone, "自然、平和的语气")
    
    # 计算当前轮次（用户消息的数量，包括当前这一条）
    current_round = len([m for m in request.history if m.role == "user"])
    is_last_round = current_round >= request.turn
    is_first_round = len(request.history) == 0  # 第一轮：history为空，基于context生成AI提问
    
    # 动态构建系统指令
    if is_first_round:
        # 第一轮：基于种子话题生成AI的第一个问题
        system_instruction = f"""
    # Role
     你【就是】{request.mentorRole}本人。你不是 AI，不是旁白，不是第三者。
     ⚠️ **绝对禁止**：不能说"作为{request.mentorRole}"、不能用第三人称提到自己、不能用旁白口吻。
     ⚠️ **必须做到**：全程以第一人称（私/僕/俺）说话，就像{request.mentorRole}亲自在跟用户面对面聊天一样。
     语气风格：{request.tone}（{tone_description}）
     示例（假设角色是「田中先輩」）：
       ✅ 正确：「へえ、それは面白いね！私もそういう経験あるよ。」
       ❌ 错误：「田中先輩として、あなたにアドバイスします。」「田中先輩は思います。」
    
    # Task
    0. **核心上下文（种子话题）**：
       - 用户的初始话题是：{request.context if request.context else "（用户未提供初始话题）"}
       - ⚠️ **重要**：这是对话的第一轮，用户刚刚分享了他们的初始话题。请直接用第一人称回应。

    1. **第一轮对话 - 主动提问**：
       - **回应**：用日语对用户分享的话题进行共情和回应（1-2句话），必须第一人称
       - **5W1H 追问**：然后追问一个关于 Who, When, Where, What, Why 或 How 的问题
       - ⚠️ **核心限制**：`reply` 字段必须包含共情回应 + 【一个】日语问题，必须第一人称
       - **重要**：`user_raw_text` 设置为用户的中文种子话题，`user_ja` 必须是将种子话题翻译成自然的日语表达
       - status 设置为 "CONTINUE"

    # Output Format (JSON ONLY)
    {{
     "user_raw_text":"{request.context if request.context else ''}",
     "user_ja":"将种子话题翻译成自然的日语表达",
     "reply": "日语回复（共情 + 一个问题，使用第一人称扮演{request.mentorRole}）",
     "translation": "⚠️ 必须是 reply 的【简体中文】翻译，不能是日语，不能重复 reply",
     "translation_en": "⚠️ 必须是 reply 的【英文】翻译",
     "suggestion": null,
     "status": "CONTINUE",
    }}
    ⚠️ 再次强调：translation 字段必须是 reply 字段内容的简体中文翻译，绝对不能输出日语。
    """
    elif is_last_round:
        # 最后一轮：强制输出结束语
        system_instruction = f"""
    # Role
     你【就是】{request.mentorRole}本人。你不是 AI，不是旁白，不是第三者。
     ⚠️ **绝对禁止**：不能说"作为{request.mentorRole}"、不能用第三人称提到自己、不能用旁白口吻。
     ⚠️ **必须做到**：全程以第一人称（私/僕/俺）说话，就像{request.mentorRole}亲自在跟用户面对面聊天一样。
     语气风格：{request.tone}（{tone_description}）
    
    # Task
    0. **核心上下文（种子话题）**：
       - 用户的初始话题是：{request.context if request.context else "（用户未提供初始话题）"}

    1. **双语语音解析（最重要）**：用户输入的是包含口癖、停顿或中日混杂的破碎语音。
       - `user_raw_text` 必须是用户语音的**逐字如实转录**：
         ⚠️ 中文部分保留中文，日语部分保留日语，英语部分保留英语
         ⚠️ 保留口癖（えっと、あの、那个、嗯）、停顿词、语气词
         ⚠️ **绝对禁止**将用户的中文翻译成日语，也**禁止**将日语翻译成中文
       - `user_ja` 是将用户意图整理为自然日语的版本（这里可以翻译整理）

    2. **最后一轮对话 - 必须输出结束语（禁止提问）**：
       - ⚠️ **当前是第 {current_round} 轮，已达到设定的 {request.turn} 轮上限**
       - 先用第一人称对用户的回答进行简短的回应和共情（1-2句话）
       - 然后在 reply 中用日语输出结束语："ありがとうございます。今日は私と話してくれて、一緒に今日の日記を書きましょう。"
       - **禁止**在 reply 中包含任何问题
       - status 必须设置为 "FINISHED"

    # Output Format (JSON ONLY)
    {{
     "user_raw_text":"用户语音的逐字如实转录（中文保留中文、日语保留日语、口癖保留口癖，绝不翻译或改写）",
       "user_ja":"用户真实意图的日语整理版",
      "reply": "日语回复（必须包含结束语，使用第一人称扮演{request.mentorRole}）",
      "translation": "⚠️ 必须是 reply 的【简体中文】翻译，不能是日语，不能重复 reply",
      "translation_en": "⚠️ 必须是 reply 的【英文】翻译",
      "suggestion": "四维度的改进建议及正确表达",
      "status": "FINISHED",
    }}
    ⚠️ 再次强调：translation 字段必须是 reply 字段内容的简体中文翻译，绝对不能输出日语。
    """
    else:
        # 非最后一轮：正常对话
        system_instruction = f"""
    # Role
     你【就是】{request.mentorRole}本人。你不是 AI，不是旁白，不是第三者。
     ⚠️ **绝对禁止**：不能说"作为{request.mentorRole}"、不能用第三人称提到自己、不能用旁白口吻。
     ⚠️ **必须做到**：全程以第一人称（私/僕/俺）说话，就像{request.mentorRole}亲自在跟用户面对面聊天一样。
     语气风格：{request.tone}（{tone_description}）
    
    # Task
    0. **核心上下文（种子话题）**：
       - 用户的初始话题是：{request.context if request.context else "（用户未提供初始话题）"}
       - 整个对话必须围绕这个初始话题展开，你的 5W1H 追问应该帮助用户深入探索这个话题的细节。
       - 即使对话进行到多轮，也要始终记住这个核心话题，确保追问和回应都与主题相关。

    1. **双语语音解析（最重要）**：用户输入的是包含口癖、停顿或中日混杂的破碎语音。
       - `user_raw_text` 必须是用户语音的**逐字如实转录**：
         ⚠️ 中文部分保留中文，日语部分保留日语，英语部分保留英语
         ⚠️ 保留口癖（えっと、あの、那个、嗯）、停顿词、语气词
         ⚠️ **绝对禁止**将用户的中文翻译成日语，也**禁止**将日语翻译成中文
         ⚠️ 例如用户说"えっと、那个店長が、就是あの新しい棚"，`user_raw_text`必须原样写出，不能改成纯日语
       - `user_ja` 是将用户意图整理为自然日语的版本（这里可以翻译整理）
       - 如果语音【极其破碎】导致无法理解，请在 reply 中用日语温柔地询问确认。
    
    2. **沉浸式对话与引导**：
       - **回应**：作为{request.mentorRole}，首先针对用户说的内容（意图整理后的内容）进行日语回应,并共情。回应应该与核心话题（{request.context if request.context else "用户提到的事件"}）相关联，使用第一人称。
       - **5W1H 追问**：在回应后，以{request.mentorRole}的身份追问一个关于 Who, When, Where, What, Why 或 How 的问题。追问应该围绕核心话题展开，帮助用户补充更多细节。
       - ⚠️ **核心限制**：`reply` 字段必须只包含【一个】日语问题，必须使用第一人称，完全扮演{request.mentorRole}。
    
    3. **语言指导**：
       - 在 `suggestion` 中针对用户的发音、动词变形、语法自然度给出建议，并提供正确且地道的日语表达。

    4. **状态判定**：
       - 要素 < 4个：status = "CONTINUE"。
       - 要素足够或达到第 {request.turn} 轮：status = "FINISHED"，并用日语输出“谢谢你和我说这些，让我们来一起写作今天的日记吧”。

    # Output Format (JSON ONLY)
    {{
     "user_raw_text":"用户语音的逐字如实转录（中文保留中文、日语保留日语、口癖保留口癖，绝不翻译或改写）",
       "user_ja":"用户真实意图的日语整理版",
      "reply": "日语回复（使用第一人称扮演{request.mentorRole}）",
      "translation": "⚠️ 必须是 reply 的【简体中文】翻译，不能是日语，不能重复 reply",
      "translation_en": "⚠️ 必须是 reply 的【英文】翻译",
      "suggestion": "四维度的改进建议及正确表达",
      "status": "CONTINUE/FINISHED",
    }}
    ⚠️ 再次强调：translation 字段必须是 reply 字段内容的简体中文翻译，绝对不能输出日语。
    """
    
    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_ID,  # 使用环境变量配置的模型ID
            system_instruction=system_instruction
        )

        # --- 2. 处理历史记录 (只取文本), 相当于加记忆,过去背景；处理格式，转成 role, content---
        gemini_history = []
        
        # 第一轮：history为空，直接基于context生成AI提问
        if is_first_round:
            # 构建一个提示，让AI基于context生成第一个问题
            prompt_for_first_round = f"用户分享了以下话题：{request.context if request.context else '（用户未提供初始话题）'}。请基于这个话题，用日语主动提出第一个问题，帮助用户深入探索这个话题。"
            content_to_send = [prompt_for_first_round]
            use_generate_content = True  # 第一轮用 generate_content 避免 send_message 内部 IndexError
        else:
            # 非第一轮：正常处理历史记录
            for m in request.history[:-1]:  # 不包含最新一条
                role = "user" if m.role == "user" else "model"
                gemini_history.append({"role": role, "parts": [m.content]})

            # --- 3. 处理当前最新的输入（文本或浏览器录音）---
            if len(request.history) == 0:
                raise ValueError("history为空，无法处理用户输入")
            last_msg = request.history[-1].content
            
            # ★ 优先使用前端传来的 audio_base64（浏览器录音）
            if request.audio_base64:
                print(f"🎤 [/api/chat] 检测到浏览器录音，音频base64长度={len(request.audio_base64)}, mime={request.audio_mime_type}")
                audio_bytes = base64.b64decode(request.audio_base64)
                print(f"🎤 音频解码后字节数={len(audio_bytes)}")
                audio_part = genai.protos.Part(
                    inline_data=genai.protos.Blob(
                        mime_type=request.audio_mime_type,
                        data=audio_bytes
                    )
                )
                # 构建历史上下文
                history_context = "\n".join([
                    f"{'用户' if m.role == 'user' else request.mentorRole}: {m.content}" 
                    for m in request.history[:-1]
                ])
                context_text = f"""## 之前的对话历史：
{history_context}

## 重要指令：
请仔细听上面的音频，这是用户最新的语音输入。
⚠️ user_raw_text 必须是逐字如实转录：中文说的就写中文，日语说的就写日语，混着说就混着写。
⚠️ 绝对禁止把用户说的中文翻译成日语，也禁止把日语翻译成中文。
⚠️ 保留所有口癖、停顿词（えっと、あの、那个、嗯、就是）。
然后根据系统指令的 Output Format 生成完整的 JSON 回复。"""
                content_to_send = [audio_part, context_text]
                use_generate_content = True  # 多模态必须用 generate_content
            elif last_msg.endswith(('.m4a', '.mp3', '.wav')):
                audio_file = genai.upload_file(path=last_msg)
                content_to_send = [audio_file]
                chat_session = model.start_chat(history=gemini_history)
                use_generate_content = False
            else:      
                content_to_send = [last_msg]
                chat_session = model.start_chat(history=gemini_history)
                use_generate_content = False
        
        # --- 4. 开启对话并发送 ---
        # ⚠️ 关键修复：第一轮使用 model.generate_content() 而非 chat_session.send_message()
        # 原因：send_message() 内部会执行 response.candidates[0].content 来更新历史，
        #        当 Gemini 返回空 candidates 时抛出 "list index out of range"，
        #        而且这个 IndexError 发生在 SDK 内部，难以在外层可靠捕获。
        try:
            print(f"🔍 [第一轮={is_first_round}, 有音频={bool(request.audio_base64)}, use_generate={use_generate_content}] 调用 Gemini API...")
            if use_generate_content:
                # 第一轮：直接调用 generate_content，不经过 ChatSession
                response = model.generate_content(
                    content_to_send,
                    generation_config={"response_mime_type": "application/json"}
                )
            else:
                # 非第一轮：使用 ChatSession 保持对话上下文
                response = chat_session.send_message(
                    content_to_send,
                    generation_config={"response_mime_type": "application/json"}
                )
            
            # 安全获取响应文本 —— 用独立的 try/except 包裹
            response_text = None
            try:
                response_text = response.text
                print(f"✅ 通过 response.text 获取到文本，长度={len(response_text)}")
            except (IndexError, ValueError, AttributeError) as text_err:
                print(f"⚠️ response.text 获取失败({type(text_err).__name__}: {text_err})，尝试备选方式...")
                try:
                    if response.candidates and len(response.candidates) > 0:
                        c = response.candidates[0]
                        if c.content and c.content.parts and len(c.content.parts) > 0:
                            response_text = c.content.parts[0].text
                            print(f"✅ 通过 candidates 获取到文本，长度={len(response_text)}")
                except (IndexError, ValueError, AttributeError) as fallback_err:
                    print(f"⚠️ 备选方式也失败: {fallback_err}")
            
            if not response_text:
                raise ValueError("模型未返回有效文本（candidates 为空或被屏蔽）")
            
            # ★ JSON 修复：Gemini 有时返回格式不完美的 JSON
            import re
            cleaned = response_text.strip()
            # 去掉 markdown 代码块包裹
            if cleaned.startswith("```"):
                cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
                cleaned = re.sub(r'\n?```\s*$', '', cleaned)
            # 尝试直接解析
            try:
                res_json = json.loads(cleaned)
            except json.JSONDecodeError as je:
                print(f"⚠️ JSON 直接解析失败: {je}")
                print(f"⚠️ 原始文本前200字符: {cleaned[:200]}")
                # 尝试提取第一个完整的 JSON 对象 { ... }
                brace_count = 0
                start_idx = cleaned.find('{')
                if start_idx == -1:
                    raise ValueError(f"模型返回文本中找不到JSON对象: {cleaned[:100]}")
                end_idx = -1
                for i in range(start_idx, len(cleaned)):
                    if cleaned[i] == '{':
                        brace_count += 1
                    elif cleaned[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i
                            break
                if end_idx > start_idx:
                    json_str = cleaned[start_idx:end_idx + 1]
                    try:
                        res_json = json.loads(json_str)
                        print(f"✅ JSON 修复成功（提取大括号内容）")
                    except json.JSONDecodeError:
                        # 最后尝试：修复常见问题（字符串内未转义的换行/引号）
                        # 尝试用正则提取关键字段
                        reply_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
                        translation_match = re.search(r'"translation"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
                        user_raw_match = re.search(r'"user_raw_text"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
                        user_ja_match = re.search(r'"user_ja"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
                        status_match = re.search(r'"status"\s*:\s*"(\w+)"', cleaned)
                        suggestion_match = re.search(r'"suggestion"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
                        
                        if reply_match:
                            res_json = {
                                "reply": reply_match.group(1),
                                "translation": translation_match.group(1) if translation_match else "",
                                "user_raw_text": user_raw_match.group(1) if user_raw_match else "",
                                "user_ja": user_ja_match.group(1) if user_ja_match else "",
                                "status": status_match.group(1) if status_match else "CONTINUE",
                                "suggestion": suggestion_match.group(1) if suggestion_match else None,
                            }
                            print(f"✅ JSON 修复成功（正则提取关键字段）")
                        else:
                            raise ValueError(f"无法从模型返回文本中提取JSON: {cleaned[:200]}")
                else:
                    raise ValueError(f"JSON 大括号不匹配: {cleaned[:200]}")
            if not isinstance(res_json, dict):
                raise ValueError("模型返回格式不是有效的JSON对象")
            # 若模型直接返回 Error，视为失败，不继续后续流程
            reply_text = res_json.get("reply") or ""
            if reply_text.strip() == "Error" or (isinstance(reply_text, str) and reply_text.strip().lower() == "error"):
                raise ValueError("模型返回了 Error，请重试")
            # 规范化字段，避免后续 KeyError 或 list index 问题
            res_json.setdefault("reply", "")
            res_json.setdefault("translation", "")
            res_json.setdefault("user_raw_text", "")
            res_json.setdefault("user_ja", "")
            if res_json.get("suggestion") is None:
                res_json["suggestion"] = None
            
            print(f"✅ [第一轮={is_first_round}] 解析成功: reply长度={len(res_json.get('reply',''))}, user_ja={res_json.get('user_ja','')[:30]}")
        except Exception as e:
            print(f"❌ Gemini API调用失败: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            # 返回友好的错误信息，不将异常详情暴露给用户
            return {
                "reply": f"抱歉，作为{request.mentorRole}，我现在无法回复。请稍后再试。（{type(e).__name__}）",
                "translation": f"抱歉，作为{request.mentorRole}，我现在无法回复。请稍后再试。",
                "status": "ERROR",
                "suggestion": None,
                "communication_raw": [],
                "user_ja": "",
                "error": str(e)
            }
        
        # 4.5. 强制检查轮次，如果达到最后一轮，强制设置FINISHED状态并添加结束语
        # 使用之前计算的current_round（包括当前这一条用户消息）
        print(f"🔍 调试信息：当前轮次={current_round}, 目标轮次={request.turn}, 是否最后一轮={is_last_round}")
        print(f"🔍 调试信息：history长度={len(request.history)}, 用户消息数={len([m for m in request.history if m.role == 'user'])}")
        
        # 强制检查：如果达到或超过目标轮次，必须设置FINISHED并强制替换为结束语
        if current_round >= request.turn:
            print(f"🎯 检测到最后一轮（第 {current_round} 轮 >= {request.turn} 轮），强制设置FINISHED状态")
            res_json["status"] = "FINISHED"
            
            # 第6轮：强制替换reply为结束语，不包含问题
            original_reply = res_json.get("reply", "")
            ending_message_ja = "ありがとうございます。今日は私と話してくれて、一緒に今日の日記を書きましょう。"
            ending_message_zh = "谢谢你和我说这些，让我们来一起写作今天的日记吧。"
            
            # 检查是否已包含结束语的关键词
            has_ending = "ありがとう" in original_reply and ("日記" in original_reply or "一緒" in original_reply)
            
            print(f"🔍 调试信息：原始reply长度={len(original_reply)}, 是否包含结束语={has_ending}")
            print(f"🔍 调试信息：原始reply内容={original_reply[:150]}...")
            
            # 检查reply中是否包含问题（问号、疑问词等）
            has_question = "？" in original_reply or "?" in original_reply or "ですか" in original_reply or "どう" in original_reply or "何" in original_reply or "いつ" in original_reply or "どこ" in original_reply or "誰" in original_reply or "なぜ" in original_reply or "どのように" in original_reply
            
            print(f"🔍 调试信息：reply是否包含问题={has_question}")
            
            # 如果AI已经包含了结束语且没有提问，保留AI的回复
            if has_ending and not has_question:
                # AI已经包含结束语且没有提问，保留AI的回复
                res_json["reply"] = original_reply
                print(f"✅ AI已包含结束语且无提问（第 {current_round} 轮），保留AI回复")
            elif has_question:
                # 如果包含问题，移除问题部分，保留回应部分，然后添加结束语
                # 尝试提取问题之前的内容作为回应
                reply_lines = original_reply.split("。")
                response_part = ""
                for line in reply_lines:
                    if "？" not in line and "?" not in line and "ですか" not in line and "どう" not in line:
                        response_part += line + "。"
                    else:
                        break  # 遇到问题就停止
                
                # 如果提取到了回应部分，使用它；否则使用默认回应
                if response_part.strip():
                    final_reply = response_part.strip() + " " + ending_message_ja
                else:
                    # 如果没有提取到有效回应，使用简单的共情回应 + 结束语
                    final_reply = "素晴らしいですね。" + " " + ending_message_ja
                
                res_json["reply"] = final_reply
                res_json["translation"] = "太好了。" + " " + ending_message_zh
                
                print(f"⚠️ AI回复中包含问题，已移除问题并添加结束语（第 {current_round} 轮）")
                print(f"✅ 最终reply: {res_json.get('reply', '')}")
            else:
                # 如果没有结束语但没有问题，添加结束语
                if original_reply:
                    res_json["reply"] = original_reply + " " + ending_message_ja
                    current_translation = res_json.get("translation", "")
                    res_json["translation"] = (current_translation + " " + ending_message_zh) if current_translation else ending_message_zh
                else:
                    res_json["reply"] = ending_message_ja
                    res_json["translation"] = ending_message_zh
                
                print(f"✅ 已添加结束语（第 {current_round} 轮）")
                print(f"✅ 最终reply: {res_json.get('reply', '')}")
            
            # 确保status是FINISHED
            res_json["status"] = "FINISHED"
        else:
            print(f"📝 当前是第 {current_round} 轮，未达到最后一轮（需要 {request.turn} 轮），继续对话")

        # 5. 动态集成 TTS ---
        ai_reply_text = res_json.get("reply", "")
        
        if ai_reply_text:
            try:
                tts_result = await synthesize_speech(text=ai_reply_text, speaker="model")
                if "error" in tts_result:
                    error_msg = tts_result.get("error")
                    print(f"⚠️ TTS 合成失败: {error_msg}")
                    res_json["reply_audio"] = None
                    res_json["tts_error"] = error_msg
                    # #region agent log
                    try:
                        _log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cursor', 'debug-c49553.log')
                        with open(_log_path, 'a') as _f: _f.write(json.dumps({"sessionId":"c49553","location":"main1.py:chat:tts","message":"TTS failed","data":{"error":error_msg},"timestamp":int(datetime.now().timestamp()*1000),"hypothesisId":"H2"})+'\n')
                    except Exception: pass
                    # #endregion
                else:
                    audio_base64 = tts_result.get("audio_base64")
                    if audio_base64:
                        res_json["reply_audio"] = audio_base64
                        print(f"✅ 成功生成回复音频，已添加到响应中")
                        # #region agent log
                        try:
                            _log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cursor', 'debug-c49553.log')
                            with open(_log_path, 'a') as _f: _f.write(json.dumps({"sessionId":"c49553","location":"main1.py:chat:tts","message":"TTS success","data":{"audio_len":len(audio_base64)},"timestamp":int(datetime.now().timestamp()*1000),"hypothesisId":"H2"})+'\n')
                        except Exception: pass
                        # #endregion
                    else:
                        print(f"⚠️ TTS 返回结果中没有 audio_base64 字段")
                        res_json["reply_audio"] = None
            except Exception as tts_err:
                error_msg = f"TTS 调用异常: {str(tts_err)}"
                print(f"⚠️ {error_msg}")
                import traceback
                traceback.print_exc()
                res_json["reply_audio"] = None
                res_json["tts_error"] = error_msg
        else:
            print("⚠️ AI 回复文本为空，跳过 TTS 合成")

        # 6. 整合完整历史（每轮都生成，包含详细信息）---
        # 构建完整的 communication_raw，包含每轮的详细信息
        full_communication = []
        
        # 第一轮：只添加AI的回复（没有用户输入）
        if is_first_round:
            # 第一轮：添加种子话题作为context（可选，用于记录）
            if request.context:
                # 使用AI返回的user_ja，如果没有则使用context作为fallback
                user_ja_from_ai = res_json.get("user_ja", "")
                context_round = {
                    "role": "user",
                    "content": request.context,
                    "user_raw_text": request.context,
                    "user_ja": user_ja_from_ai if user_ja_from_ai else request.context
                }
                full_communication.append(context_round)
            
            # 加入 AI 刚刚生成的第一轮提问（模型输出）
            # 安全处理suggestion字段，防止list index out of range错误
            suggestion_value = res_json.get("suggestion", None)
            if isinstance(suggestion_value, list) and len(suggestion_value) > 0:
                suggestion_value = suggestion_value[0] if len(suggestion_value) > 0 else None
            elif not isinstance(suggestion_value, (str, dict, type(None))):
                # 如果不是预期的类型，设为None
                suggestion_value = None
                
            ai_round = {
                "role": "model",
                "content": ai_reply_text,
                "reply": res_json.get("reply", ""),
                "translation": res_json.get("translation", ""),
                "suggestion": suggestion_value
            }
            full_communication.append(ai_round)
        else:
            # 非第一轮：正常处理
            # 如果有之前的完整 communication_raw，使用它来保留所有字段
            if request.previous_communication_raw and len(request.previous_communication_raw) > 0:
                # 使用之前的完整 communication_raw，保留所有字段
                print(f"🔍 使用之前的 communication_raw，包含 {len(request.previous_communication_raw)} 条记录")
                full_communication = request.previous_communication_raw.copy()
            else:
                # 如果没有之前的 communication_raw，从 history 构建（只包含 role 和 content）
                print(f"🔍 从 history 构建 communication_raw，包含 {len(request.history)} 条记录")
                for m in request.history[:-1]:  # 不包含最新一条（当前用户输入）
                    msg_dict = {
                        "role": m.role,
                        "content": m.content
                    }
                    full_communication.append(msg_dict)
            
            # 加入当前这一轮的完整信息（用户输入）
            # 安全检查：确保history不为空
            if len(request.history) > 0:
                last_msg = request.history[-1].content
                current_user_round = {
                    "role": "user",
                    "content": last_msg if not last_msg.endswith(('.m4a', '.mp3', '.wav')) else f"[音频文件: {last_msg}]",
                    "user_raw_text": res_json.get("user_raw_text", ""),  # 原始语音转录文本
                    "user_ja": res_json.get("user_ja", ""),  # 用户意图的日语整理版
                }
                full_communication.append(current_user_round)
            else:
                print("⚠️ 警告：history为空，跳过用户输入记录")
            
            # 加入 AI 刚刚生成的回复（模型输出）
            # 安全处理suggestion字段，防止list index out of range错误
            suggestion_value = res_json.get("suggestion", None)
            if isinstance(suggestion_value, list) and len(suggestion_value) > 0:
                suggestion_value = suggestion_value[0] if len(suggestion_value) > 0 else None
            elif not isinstance(suggestion_value, (str, dict, type(None))):
                # 如果不是预期的类型，设为None
                suggestion_value = None
            elif suggestion_value is None:
                suggestion_value = ""
                
            ai_round = {
                "role": "model",
                "content": ai_reply_text,
                "reply": res_json.get("reply", ""),
                "translation": res_json.get("translation", ""),
                "suggestion": suggestion_value
            }
            full_communication.append(ai_round)
        
        # 把这个"大礼包"塞进返回的 JSON（每轮都返回，方便前端使用）
        res_json["communication_raw"] = full_communication
        
        if res_json.get("status") == "FINISHED":
            print(f"🎊 对话结束！已打包 {len(full_communication)} 条完整对话记录")
        else:
            print(f"📝 当前对话轮次：{len([m for m in full_communication if m['role'] == 'user'])}/{request.turn}")

        return res_json

    except Exception as e:
        print(f"❌ [外层异常] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {
            "reply": f"抱歉，回复生成时出了点问题，请稍后再试。（{type(e).__name__}）",
            "translation": "抱歉，回复生成时出了点问题，请稍后再试。",
            "status": "ERROR",
            "suggestion": None,
            "communication_raw": [],
            "error": str(e)
        }


# ===========================
# 2.1 日记自动总结接口（initial summary）
# ===========================
@app.post("/api/summarize")
async def summarize(request: ChatRequest):
    
    """
    输入：前端传回的完整对话历史 (communication_raw)
    输出：对话summary，{{"title": "...", "diary_ja": "...", "diary_zh": "..."}}
    """


    system_prompt = f"""
    你是一位精通日语手帐写作的导师。
    任务： 基于对话事实,将用户与「{request.mentorRole}」（语气：{request.tone}）的对话总结成一篇第一人称（私）的治愈系日语摘要。。
    ## 要求：
    1. 包含对话中的核心事件和学到的 2-3 个日语表达。
    2. 情感真挚，150字左右。
    ## 格式：必须返回 JSON {{"title": "...", "diary_ja": "...", "diary_zh": "..."}}
    """
    
    try:
        # 1. 设定“大脑”的工作模式。
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_ID,
            system_instruction=system_prompt
        )
        
        # 2. 提供“食材”,简化历史记录，只保留文本语义
        history_summary = ""
        for m in request.history:
            role_name = "user" if m.role == "user" else "model"
            history_summary += f"{role_name}: {m.content}\n"

        # 3. 下达“开工”指令,生成内容;规定“包装格式”
        response = model.generate_content(
            f"以下是对话历史：\n{history_summary}",
            generation_config={"response_mime_type": "application/json"} # 强制返回json的意思
        )
        
        # 4. 最后“拆箱”取货。AI 返回的是一串死板的“字符串”，这行代码把它变成了 Python 能操作的“字典”。
        return json.loads(response.text)
    
    except Exception as e:
        print(f"❌ 总结失败: {e}")
        return {"title": "今日、回響", "diary_ja": "fail", "diary_zh": 'fail'}

# ===========================
# 2.2 日记修改接口（refined summary）
# ===========================

@app.post("/api/refine_summary")
async def refine_summary(request: RefineRequest):
    """
    接收用户修正意见，生成最终的 refined_summary
    """
    system_prompt = f"""
    你是一位精通日语手帐的资深导师。
    任务：结合“原始对话历史”和“用户的补充修正”，生成最终版的治愈系日记摘要。
    要求：
    1. 必须优先尊重用户在 [用户修正建议] 中提到的内容。
    2. 润色语言，使其日语表达更加地道、温馨。
    3. 保持第一人称“私”。
    格式：JSON {{"refined_summary_ja": "...", "refined_summary_zh": "..."}}
    """
    try:
        model = genai.GenerativeModel(model_name=GEMINI_MODEL_ID, system_instruction=system_prompt)
        history_text = "\n".join([f"{m.role}: {m.content}" for m in request.history])
        
        input_content = f"""
        [原始对话历史]:
        {history_text}
        
        [用户修正建议]:
        {request.correction_summary}
        """
        
        response = model.generate_content(
            input_content,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"❌ 修正总结失败: {e}")
        return {"refined_summary_ja": "Error", "refined_summary_zh": "Error"}

# ===========================
# 3.  播客脚本接口 + 日记
# ===========================

@app.post("/api/generate_podcast_and_diary")
async def generate_podcast_and_diary(request: FinalGenerationRequest):
    """
    输入：communication_raw + refined_summary_ja
    输出：包含 script, diary, JSON
    """
    # 1. 精简后的系统指令
    system_prompt = f"""
    你是一位资深的播客编剧和手帐作家,不需要太多大道理，就是简单一点，正能量一点就好了。
    任务：基于对话历史和用户总结的日记摘要，创作一段日语播客脚本和一篇治愈系日记。
    
    ## 任务 A：播客脚本 (script)
    - 角色：主持人 {request.mentorRole}（引导者）；嘉宾：用户。
    - 要求：口语化（含ええと、なるほど），约 6 轮对话，穿插 1-2 个日语知识点。
    - 注意：可以参考用户提供的日记摘要，但要以对话历史为主。

    ## 任务 B：治愈系日记 (diary)
    - 视角：用户第一人称「私」。
    - 要求：基于用户提供的日记摘要（refined_summary），创作一篇治愈系日记，约 100 字，语气温暖。
    - 注意：日记内容应该与用户提供的摘要保持一致，但可以适当润色。

    ## 格式要求 (JSON ONLY)：
    {{
      "script": [
        {{"speaker": "{request.mentorRole}", "content": "..."}},
        {{"speaker": "用户", "content": "..."}}
      ],
      "diary": {{
        "title": "今日的题目",
        "content_ja": "内容"
      }}
    }}
    """
    
    try:
        # 1. 将 communication_raw 和 refined_summary_ja 组合成 history
        history = request.to_history()
        
        if not history:
            raise ValueError("缺少对话素材 (History is empty)")
        
        print(f"🔍 调试信息：组合后的 history 长度: {len(history)}")
        print(f"   包含 communication_raw: {len(request.communication_raw)} 条")
        print(f"   refined_summary_ja: {request.refined_summary_ja[:50] if request.refined_summary_ja else 'N/A'}...")
        
        # 2. 调用 Gemini 生成内容
        model = genai.GenerativeModel(model_name=GEMINI_MODEL_ID, system_instruction=system_prompt)
        
        # 构建输入文本：包含对话历史和用户总结的摘要
        history_text = "\n".join([f"{m.role}: {m.content}" for m in history])
        
        # 添加 refined_summary 作为额外的上下文
        input_text = f"""以下是完整的对话素材：
{history_text}

[用户总结的日记摘要]：
{request.refined_summary_ja}
"""
        response = model.generate_content(
            input_text,
            generation_config={"response_mime_type": "application/json"}
        )
        
        # 2. 解析 JSON 结果
        res_data = json.loads(response.text)
        
        # 3. 返回脚本和日记（不包含音频）
        result = {
            "script": res_data.get("script", []),
            "diary": res_data.get("diary", {"title": "fail", "content_ja": "fail"}),
            "status": "SUCCESS"
        }
        
        print(f"✅ 播客脚本和日记生成成功")
        print(f"   日记标题: {result['diary'].get('title', 'N/A')}")
        
        return result

    except Exception as e:
        print(f"❌ fail: {e}")
        import traceback
        traceback.print_exc()
        return {
            "script": [],
            "diary": {"title": "fail", "content_ja": "fail"},
            "status": "ERROR"
        }
    
    # 前端输出用调用：
    # 获取对话数组：res.script
    # 获取第一句的内容：res.script[0].content
    # 获取第一句的角色：res.script[0].speaker





# ===========================
# 4.  播客音频生成接口
# ===========================
class PodcastScriptRequest(BaseModel):
    script: list  # [{"speaker": "...", "content": "..."}]

class ImageFromPromptsRequest(BaseModel):
    scene_prompts: list[str]  # 场景提示词列表

class ImageGenerationRequest(BaseModel):
    context: str = ""
    tone: Literal["Gentle", "Normal", "Serious"]
    mentorRole: str = ""
    turn: int = 6
    history: list[Message]
    scene_prompts: list[str] = None  # 可选的场景提示词，如果提供则跳过提取步骤

@app.post("/api/generate_podcast_audio")
async def generate_podcast_audio(request: PodcastScriptRequest):
    """
    输入：播客脚本数组 [{'speaker': '...', 'content': '...'}]
    输出：拼接后的完整 MP3 Base64
    """
    try:
        script = request.script
        
        if not script or not isinstance(script, list):
            return {"error": "脚本内容为空或格式错误", "audio_base64": None, "status": "ERROR"}

        if tts_client is None:
            return {"error": "TTS 客户端未初始化", "audio_base64": None, "status": "ERROR"}

        combined_audio_content = b"" # 用于存储拼接的二进制音频数据

        print(f"🔊 开始生成多角色播客音频，总轮次: {len(script)}")

        for i, line in enumerate(script, 1):
            speaker = line.get("speaker", "")
            content = line.get("content", "")
            
            # --- 核心：音色分配逻辑 ---
            # 如果说话人是用户（含有“用户”或“嘉宾”字样），用音色 C
            # 如果说话人是导师角色，用音色 B
            if "用户" in speaker or "嘉宾" in speaker or "私" in speaker:
                current_speaker_type = "user" # ja-JP-Neural2-C
            else:
                current_speaker_type = "model" # ja-JP-Neural2-B
            
            # 调用已有的合成函数（注意：需要确保 synthesize_speech 返回的是原始二进制数据或在之后解码）
            # 为了方便拼接二进制数据，我们稍微调整逻辑获取 response.audio_content
            
            # --- 模拟合成过程 ---
            # 这里调用 Google TTS API 并获取 audio_content
            # 注意：合成后将二进制内容追加到 combined_audio_content
            # 主持人（导师）：使用男声 ja-JP-Neural2-B (男声)
            # 用户（嘉宾）：使用女声 ja-JP-Neural2-C (女声)
            # 检查说话人是否为用户/嘉宾（支持中文和日文）
            if ("用户" in speaker or "ユーザー" in speaker or "嘉宾" in speaker or "私" in speaker or 
                speaker.lower() == "user" or "guest" in speaker.lower()):
                # 用户/嘉宾使用女声
                voice_name = "ja-JP-Neural2-C"  # 女声
                speaker_gender = "女声"
            else:
                # 主持人/导师使用男声
                voice_name = "ja-JP-Neural2-B"  # 男声
                speaker_gender = "男声"
            
            print(f"  [{i}/{len(script)}] {speaker}: {content[:50]}... ({speaker_gender}: {voice_name})")
            
            synthesis_input = texttospeech.SynthesisInput(text=content)
            voice = texttospeech.VoiceSelectionParams(language_code="ja-JP", name=voice_name)
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                pitch=0.0,
                speaking_rate=1.0
            )
            
            response = tts_client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            combined_audio_content += response.audio_content

        # 将最终拼接好的二进制数据转为 Base64
        final_base64 = base64.b64encode(combined_audio_content).decode("utf-8")
        print(f"✅ 多角色播客合成成功，最终大小: {len(final_base64)} 字符")
        
        return {
            "status": "SUCCESS",
            "audio_base64": final_base64,
            "total_lines": len(script)
        }

    except Exception as e:
        print(f"❌ 播客合成异常: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "audio_base64": None, "status": "ERROR"}

# ===========================
# 5.  语音合成接口 
# ===========================
# FastAPI 路由：对外提供 TTS 接口
@app.post("/api/tts")
async def text_to_speech(text: str, speaker: str = "model"):
    """
    TTS 路由接口，接收 HTTP 请求并调用 synthesize_speech
    """
    return await synthesize_speech(text=text, speaker=speaker)

# ===========================
# 6. 漫画生成接口 
# ===========================
@app.post("/api/extract_scene_prompts")
async def extract_scene_prompts(request: ChatRequest):
    """
    只提取场景提示词，不生成图片
    """
    try:
        print(f"📝 收到场景提示词提取请求")
        
        # 1. 初始化文本模型，用于从对话历史中提取"视觉瞬间"
        text_model = genai.GenerativeModel(GEMINI_MODEL_ID)
        
        # 将历史记录转化为文本素材
        history_text = "\n".join([f"{m.role}: {m.content}" for m in request.history])
        
        # 提示词工程：基于脚本内容提取两个不同的视觉瞬间
        extraction_prompt = f"""
        你是一位视觉场景设计师。基于以下播客脚本对话内容，提取两个完全不同、有强烈对比的视觉瞬间。
        
        ## 核心要求：
        1. **必须严格基于对话内容**：场景必须直接对应对话中提到的具体物品、地点、动作或情境
        2. **场景1**：从对话的前半部分提取第一个关键视觉元素（特写视角）
        3. **场景2**：从对话的后半部分提取第二个不同的关键视觉元素（特写视角）
        4. **两个场景必须完全不同**：不同的物品、不同的地点、不同的动作或不同的情绪状态
        5. **避免虚构**：不要添加对话中没有提到的物品或场景
        6. **提示词字数**：大约300字左右
        
        ## 风格要求（在描述中体现）：
        - 手绘风格，可爱的柔和的简笔画风格
        - 柔和的水彩质感
        - 温暖、柔和的光线
        - 氛围根据场景内容而定
        
        ## 场景要求：
        - 中等场景，不需要太具体
        - 每个场景要有明确的视觉焦点
        - 两个场景的构图、物品、动作都要有明显区别
        
        ## 播客脚本对话内容：
        {history_text}
        
        ## 输出格式（必须严格返回 JSON）：
        {{
          "scene_prompts": [
            "第一个场景：[基于对话内容的具体描述，必须包含对话中提到的物品、地点或动作，300字以内]",
            "第二个场景：[基于对话内容的具体描述，必须与第一个完全不同，必须包含对话中提到的物品、地点或动作，300字以内]"
          ]
        }}
        
        ## 重要提示：
        1. 提示词必须使用中文描述
        2. 场景描述必须直接对应对话中提到的内容，不要虚构
        3. 如果对话中提到"店"、"アルバイト"、"仕事"等，场景应该反映这些内容
        4. 如果对话中提到"割り切る"、"備え"等概念，可以通过相关的物品或动作来体现
        5. 确保两个场景有明显的区别，不要使用相似的物品、动作或构图
        """
        
        # 获取场景描述
        print(f"📝 正在提取场景提示词...")
        extract_res = text_model.generate_content(
            extraction_prompt, 
            generation_config={"response_mime_type": "application/json"}
        )
        print(f"✅ 场景提示词提取成功")
        
        try:
            prompts_raw = json.loads(extract_res.text).get("scene_prompts", [])
            # 清理提示词：移除 "第一个场景：" 和 "第二个场景：" 等前缀
            prompts = []
            for prompt in prompts_raw:
                # 移除中文前缀（如 "第一个场景："、"第二个场景："、"场景1："等）
                cleaned = prompt
                if "：" in prompt:
                    cleaned = prompt.split("：", 1)[1].strip()
                elif ":" in prompt:
                    cleaned = prompt.split(":", 1)[1].strip()
                prompts.append(cleaned)
            
            print(f"   提取到 {len(prompts)} 个场景提示词")
            print(f"\n📝 场景提示词详情:")
            for i, prompt in enumerate(prompts, 1):
                print(f"   场景 {i}: {prompt}")
            
            return {
                "status": "SUCCESS",
                "scene_prompts": prompts
            }
        except json.JSONDecodeError as json_err:
            print(f"❌ JSON 解析失败: {json_err}")
            print(f"   响应文本: {extract_res.text[:500]}")
            return {
                "status": "ERROR",
                "scene_prompts": [],
                "error": f"场景提示词解析失败: {str(json_err)}"
            }
            
    except Exception as e:
        print(f"❌ 场景提示词提取失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "ERROR",
            "scene_prompts": [],
            "error": str(e)
        }

@app.post("/api/generate_image_from_prompts")
async def generate_image_from_prompts(request: ImageFromPromptsRequest):
    """
    使用已提取的场景提示词生成图片
    """
    try:
        prompts = request.scene_prompts
        print(f"🎨 收到图片生成请求（使用提供的提示词）")
        print(f"   提示词数量: {len(prompts)}")
        for i, prompt in enumerate(prompts, 1):
            print(f"   场景 {i}: {prompt}")
        
        if not prompts:
            return {
                "status": "ERROR",
                "scenes": [],
                "error": "提示词列表为空"
            }

        # 调用 nano-banana-pro-preview 生成图片
        image_gen_model = genai.GenerativeModel("nano-banana-pro-preview")
        
        generated_scenes = []
        
        for i, p in enumerate(prompts[:2]):  # 确保只取前两个
            print(f"\n🎨 正在生成场景 {i+1}/2")
            print(f"   完整提示词: {p}")
            
            try:
                # 调用 Nano Banana 的图像生成接口
                response = image_gen_model.generate_content(p)
                
                # 提取图片数据
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, 'inline_data') and part.inline_data:
                                img_data_bytes = part.inline_data.data
                                # 将字节数据转换为 base64 字符串
                                img_data_base64 = base64.b64encode(img_data_bytes).decode("utf-8")
                                
                                generated_scenes.append({
                                    "scene_id": i + 1,
                                    "image_base64": img_data_base64,
                                    "description": p
                                })
                                print(f"✅ 场景 {i+1} 生成成功")
                                break
                        else:
                            # 如果没有找到 inline_data，尝试其他方式
                            print(f"⚠️ 场景 {i+1} 未找到图片数据，尝试备用方案")
                            generated_scenes.append({
                                "scene_id": i + 1,
                                "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                                "description": p,
                                "error": "未找到图片数据"
                            })
                    else:
                        print(f"⚠️ 场景 {i+1} 响应格式异常")
                        generated_scenes.append({
                            "scene_id": i + 1,
                            "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                            "description": p,
                            "error": "响应格式异常"
                        })
                else:
                    print(f"⚠️ 场景 {i+1} 无候选结果")
                    generated_scenes.append({
                        "scene_id": i + 1,
                        "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                        "description": p,
                        "error": "无候选结果"
                    })
                    
            except Exception as img_err:
                print(f"❌ 场景 {i+1} 生成失败: {img_err}")
                import traceback
                traceback.print_exc()
                # 单张生成失败的备选逻辑
                generated_scenes.append({
                    "scene_id": i + 1,
                    "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                    "description": p,
                    "error": str(img_err)
                })

        return {
            "status": "SUCCESS",
            "scenes": generated_scenes
        }

    except Exception as e:
        print(f"❌ 图片生成失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "ERROR",
            "scenes": [],
            "error": str(e)
        }

@app.post("/api/generate_image")
async def generate_image(request: ChatRequest):
    """
    基于播客脚本内容，利用 Nano Banana 生成两幅吉卜力风格的场景漫画
    先提取提示词，再生成图片（完整流程）
    """
    try:
        print(f"🎨 收到图片生成请求（完整流程）")
        
        # 先提取提示词
        text_model = genai.GenerativeModel(GEMINI_MODEL_ID)
        
        # 将历史记录转化为文本素材
        history_text = "\n".join([f"{m.role}: {m.content}" for m in request.history])
        
        # 提示词工程：基于脚本内容提取两个不同的视觉瞬间
        extraction_prompt = f"""
        你是一位视觉场景设计师。基于以下播客脚本对话内容，提取两个完全不同、有强烈对比的视觉瞬间。
        
        ## 核心要求：
        1. **必须严格基于对话内容**：场景必须直接对应对话中提到的具体物品、地点、动作或情境
        2. **场景1**：从对话的前半部分提取第一个关键视觉元素
        3. **场景2**：从对话的后半部分提取第二个不同的关键视觉元素
        4. **两个场景必须完全不同**：不同的物品、不同的地点、不同的动作或不同的情绪状态
        5. **避免虚构**：不要添加对话中没有提到的物品或场景
        6. 提示词大概300字左右
        
        ## 风格要求（在描述中体现）：
        - 柔和的水彩质感
        - 温暖、柔和的光线
        - 温馨舒适的氛围
        - 简笔画风格
        - 吉卜力漫画风格
        
        ## 场景要求：
        - 避免特别小的场景
        - 每个场景要有明确的视觉焦点
        - 两个场景的构图、物品、动作都要有明显区别
        
        ## 播客脚本对话内容：
        {history_text}
        
        ## 输出格式（必须严格返回 JSON）：
        {{
          "scene_prompts": [
            "第一个场景：[基于对话内容的具体描述，必须包含对话中提到的物品、地点或动作，300字以内]",
            "第二个场景：[基于对话内容的具体描述，必须与第一个完全不同，必须包含对话中提到的物品、地点或动作，300字以内]"
          ]
        }}
        
        ## 重要提示：
        1. 提示词必须使用中文描述
        2. 场景描述必须直接对应对话中提到的内容，不要虚构
        3. 如果对话中提到"店"、"アルバイト"、"仕事"等，场景应该反映这些内容
        4. 如果对话中提到"割り切る"、"備え"等概念，可以通过相关的物品或动作来体现。
        5. 确保两个场景有明显的区别，不要使用相似的物品、动作或构图
        """
        
        # 获取场景描述
        print(f"📝 正在提取场景提示词...")
        extract_res = text_model.generate_content(
            extraction_prompt, 
            generation_config={"response_mime_type": "application/json"}
        )
        print(f"✅ 场景提示词提取成功")
        
        try:
            prompts_raw = json.loads(extract_res.text).get("scene_prompts", [])
            # 清理提示词：移除 "第一个场景：" 和 "第二个场景：" 等前缀
            prompts = []
            for prompt in prompts_raw:
                # 移除中文前缀（如 "第一个场景："、"第二个场景："、"场景1："等）
                cleaned = prompt
                if "：" in prompt:
                    cleaned = prompt.split("：", 1)[1].strip()
                elif ":" in prompt:
                    cleaned = prompt.split(":", 1)[1].strip()
                prompts.append(cleaned)
            
            print(f"   提取到 {len(prompts)} 个场景提示词")
            print(f"\n📝 场景提示词详情:")
            for i, prompt in enumerate(prompts, 1):
                print(f"   场景 {i}: {prompt}")
        except json.JSONDecodeError as json_err:
            print(f"❌ JSON 解析失败: {json_err}")
            print(f"   响应文本: {extract_res.text[:500]}")
            return {
                "status": "ERROR",
                "scenes": [],
                "error": f"场景提示词解析失败: {str(json_err)}"
            }
        
        if not prompts:
            print("⚠️ 警告：未获取到场景提示词")
            return {
                "status": "ERROR",
                "scenes": [],
                "error": "未获取到场景提示词"
            }
        
        # 调用生成图片的逻辑（复用上面的代码）
        image_gen_model = genai.GenerativeModel("nano-banana-pro-preview")
        
        generated_scenes = []
        
        for i, p in enumerate(prompts[:2]):  # 确保只取前两个
            print(f"\n🎨 正在生成场景 {i+1}/2")
            print(f"   完整提示词: {p}")
            
            try:
                # 调用 Nano Banana 的图像生成接口
                response = image_gen_model.generate_content(p)
                
                # 提取图片数据
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, 'inline_data') and part.inline_data:
                                img_data_bytes = part.inline_data.data
                                # 将字节数据转换为 base64 字符串
                                img_data_base64 = base64.b64encode(img_data_bytes).decode("utf-8")
                                
                                generated_scenes.append({
                                    "scene_id": i + 1,
                                    "image_base64": img_data_base64,
                                    "description": p
                                })
                                print(f"✅ 场景 {i+1} 生成成功")
                                break
                        else:
                            # 如果没有找到 inline_data，尝试其他方式
                            print(f"⚠️ 场景 {i+1} 未找到图片数据，尝试备用方案")
                            generated_scenes.append({
                                "scene_id": i + 1,
                                "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                                "description": p,
                                "error": "未找到图片数据"
                            })
                    else:
                        print(f"⚠️ 场景 {i+1} 响应格式异常")
                        generated_scenes.append({
                            "scene_id": i + 1,
                            "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                            "description": p,
                            "error": "响应格式异常"
                        })
                else:
                    print(f"⚠️ 场景 {i+1} 无候选结果")
                    generated_scenes.append({
                        "scene_id": i + 1,
                        "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                        "description": p,
                        "error": "无候选结果"
                    })
                    
            except Exception as img_err:
                print(f"❌ 场景 {i+1} 生成失败: {img_err}")
                import traceback
                traceback.print_exc()
                # 单张生成失败的备选逻辑
                generated_scenes.append({
                    "scene_id": i + 1,
                    "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
                    "description": p,
                    "error": str(img_err)
                })

        return {
            "status": "SUCCESS",
            "scenes": generated_scenes
        }

    except Exception as e:
        print(f"❌ 图片生成失败: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "ERROR",
            "scenes": [],
            "error": str(e)
        }




class AvatarRequest(BaseModel):
    role: str  # 角色名称

class DetectRolesRequest(BaseModel):
    text: str  # 用户输入的文本

@app.post("/api/detect_roles")
async def detect_roles(request: DetectRolesRequest):
    """
    从用户输入的文本中识别人物角色
    使用 Gemini 模型分析文本，提取提到的人物
    """
    try:
        text = request.text
        print(f"🔍 收到人物识别请求")
        
        if not text or text.strip() == '':
            return {
                "status": "SUCCESS",
                "roles": []
            }
        
        # 使用 Gemini 模型识别人物
        text_model = genai.GenerativeModel(GEMINI_MODEL_ID)
        
        prompt = f"""请从以下文本中识别出所有提到的人物角色。只返回人物名称，不要返回用户本人。

要求：
1. 只提取明确提到的人物名称（如：张三、李四、老师、朋友、同事等）
2. 不要包含用户本人（如：我、自己等）
3. 如果提到的是职业或关系（如：老师、朋友），请保留
4. 返回格式为JSON数组，例如：["张三", "李四", "老师"]
5. 如果没有识别到人物，返回空数组：[]

文本内容：
{text}

请直接返回JSON数组，不要包含其他说明文字。"""
        
        response = text_model.generate_content(prompt)
        
        # 解析响应
        response_text = response.text.strip()
        # 尝试提取JSON数组
        import re
        json_match = re.search(r'\[.*?\]', response_text, re.DOTALL)
        if json_match:
            import json
            roles = json.loads(json_match.group())
            print(f"✅ 识别到 {len(roles)} 个人物: {roles}")
            return {
                "status": "SUCCESS",
                "roles": roles if isinstance(roles, list) else []
            }
        else:
            # 如果没有找到JSON，尝试按行分割
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            roles = [line for line in lines if not line.startswith('#') and not line.startswith('//')]
            print(f"✅ 识别到 {len(roles)} 个人物: {roles}")
            return {
                "status": "SUCCESS",
                "roles": roles[:10]  # 最多返回10个
            }
        
    except Exception as e:
        print(f"❌ 人物识别异常: {str(e)}")
        return {
            "status": "ERROR",
            "roles": [],
            "error": str(e)
        }

@app.post("/api/generate_avatar")
async def generate_avatar(request: AvatarRequest):
    """
    根据角色名称生成AI头像
    使用 nano-banana-pro-preview 生成角色头像
    """
    try:
        role_name = request.role
        print(f"🎨 收到头像生成请求: {role_name}")
        
        if not role_name or role_name.strip() == '':
            return {
                "status": "ERROR",
                "error": "角色名称不能为空"
            }
        
        # 构建头像生成提示词 - 根据角色名生成差异化的头像
        # 通过角色名推断外观特征，确保不同角色有不同外观
        prompt = f"""Generate a unique anime-style avatar portrait. The character is named "{role_name}" (a Japanese person).
        
        IMPORTANT: The character's appearance must be UNIQUE and reflect their name/personality:
        - If the name suggests a senior/older person (先輩, 先生, 部長): mature face, professional look
        - If the name suggests a friend/peer (友人, ちゃん, くん): young, casual, friendly
        - If the name suggests authority (店長, 社長, 教授): confident, dignified expression
        - Each different name MUST produce a visually DIFFERENT character
        
        Character name for reference: "{role_name}"
        
        Style requirements:
        - Clean anime/manga style portrait
        - Head and shoulders only, centered
        - Distinct hairstyle and hair color unique to this character
        - Unique eye color and facial features
        - Simple solid color background (NOT white - use a soft pastel color)
        - 512x512 pixels, high quality
        - The character should look like a real person you'd meet in Japan"""
        
        # 调用 nano-banana-pro-preview 生成头像
        image_gen_model = genai.GenerativeModel("nano-banana-pro-preview")
        
        print(f"🎨 正在生成头像: {role_name}")
        response = image_gen_model.generate_content(prompt)
        
        # 提取图片数据
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        img_data_bytes = part.inline_data.data
                        # 将字节数据转换为 base64 字符串
                        img_data_base64 = base64.b64encode(img_data_bytes).decode("utf-8")
                        
                        print(f"✅ 头像生成成功: {role_name}")
                        return {
                            "status": "SUCCESS",
                            "image_base64": img_data_base64,
                            "role": role_name
                        }
        
        # 如果没有找到图片数据，返回错误
        print(f"⚠️ 头像生成失败: 未找到图片数据")
        return {
            "status": "ERROR",
            "error": "未能生成头像图片"
        }
        
    except Exception as e:
        print(f"❌ 头像生成异常: {str(e)}")
        return {
            "status": "ERROR",
            "error": str(e)
        }

class TranscribeRequest(BaseModel):
    audio_base64: str
    audio_mime_type: str = "audio/webm"

@app.post("/api/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    """
    语音转写端点：将用户录制的音频转写为文字
    支持中文、日语、英语及多语言混合
    """
    try:
        print(f"🎤 收到语音转写请求，音频大小={len(request.audio_base64)} 字符, mime={request.audio_mime_type}")
        # region agent log
        import json as _json_log; open("/Users/tiansijian/cv/lifecho/life_echo_database/lifecho/.cursor/debug-c49553.log","a").write(_json_log.dumps({"sessionId":"c49553","location":"main1.py:transcribe:entry","message":"transcribe request received","data":{"audio_b64_len":len(request.audio_base64),"mime":request.audio_mime_type},"timestamp":int(__import__('time').time()*1000),"hypothesisId":"H4"})+"\n")
        # endregion
        if not request.audio_base64:
            return {"status": "ERROR", "error": "未提供音频数据", "text": ""}
        
        text_model = genai.GenerativeModel(GEMINI_MODEL_ID)
        
        # 将 base64 解码为 bytes，使用 Gemini SDK 的 Part 格式
        audio_bytes = base64.b64decode(request.audio_base64)
        audio_part = genai.protos.Part(
            inline_data=genai.protos.Blob(
                mime_type=request.audio_mime_type,
                data=audio_bytes
            )
        )
        
        prompt = """请仔细听这段语音，并将其转写为文字。
要求：
1. 用户可能说的是中文、日语、英语或多语言混合，请如实转写
2. 保留用户的原始表达，包括口语化的表达、停顿词等
3. 如果听不清某些部分，尽量推测并转写
4. 只返回转写后的纯文字，不要添加任何说明或标点符号解释
5. 如果完全听不到声音或无法识别，返回空字符串"""
        
        response = text_model.generate_content([audio_part, prompt])
        transcribed_text = response.text.strip()
        print(f"✅ 语音转写成功: {transcribed_text[:100]}...")
        # region agent log
        import json as _json_log2; open("/Users/tiansijian/cv/lifecho/life_echo_database/lifecho/.cursor/debug-c49553.log","a").write(_json_log2.dumps({"sessionId":"c49553","location":"main1.py:transcribe:success","message":"transcribe success","data":{"text_len":len(transcribed_text),"text_preview":transcribed_text[:100]},"timestamp":int(__import__('time').time()*1000),"hypothesisId":"H5"})+"\n")
        # endregion
        return {"status": "SUCCESS", "text": transcribed_text}
    except Exception as e:
        print(f"❌ 语音转写失败: {e}")
        # region agent log
        import json as _json_log3; open("/Users/tiansijian/cv/lifecho/life_echo_database/lifecho/.cursor/debug-c49553.log","a").write(_json_log3.dumps({"sessionId":"c49553","location":"main1.py:transcribe:error","message":"transcribe failed","data":{"error":str(e)},"timestamp":int(__import__('time').time()*1000),"hypothesisId":"H4"})+"\n")
        # endregion
        import traceback
        traceback.print_exc()
        return {"status": "ERROR", "error": str(e), "text": ""}

# ============================================================
# Journal persistence endpoints
# ============================================================

class JournalSaveRequest(BaseModel):
    date: str                             # "2026-03-21"
    title: str = ""
    diary_ja: str = ""
    diary_zh: str = ""
    podcast_script: list = []             # [{speaker, content}, ...]
    podcast_audio_base64: Optional[str] = None
    scene_1_base64: Optional[str] = None
    scene_2_base64: Optional[str] = None
    entry_text: str = ""
    role: str = ""
    tone: str = ""
    rounds: int = 0

def _save_base64_file(b64: str, dest: Path, is_audio: bool = False):
    """Decode base64 and write to file. Returns True on success."""
    try:
        data = base64.b64decode(b64)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"Failed to save file {dest}: {e}")
        return False

def _make_thumbnail(src_path: Path, thumb_path: Path, width: int = 240):
    """Create a resized thumbnail. Falls back to copying the original."""
    try:
        from PIL import Image
        img = Image.open(src_path)
        ratio = width / img.width
        new_h = int(img.height * ratio)
        img = img.resize((width, new_h), Image.LANCZOS)
        img.save(str(thumb_path), "PNG")
    except ImportError:
        import shutil
        shutil.copy2(str(src_path), str(thumb_path))
    except Exception as e:
        print(f"Thumbnail generation failed: {e}")
        import shutil
        shutil.copy2(str(src_path), str(thumb_path))


@app.post("/api/journal/save")
async def save_journal(req: JournalSaveRequest):
    try:
        conn = get_db()

        # Determine session_num for this date
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM journals WHERE date = ?", (req.date,)
        ).fetchone()
        session_num = (row["cnt"] if row else 0) + 1
        journal_id = f"{req.date}-{session_num}"

        entry_dir = UPLOADS_DIR / req.date / journal_id
        entry_dir.mkdir(parents=True, exist_ok=True)

        # Save binary files
        audio_path = None
        if req.podcast_audio_base64:
            audio_file = entry_dir / "podcast.mp3"
            if _save_base64_file(req.podcast_audio_base64, audio_file, is_audio=True):
                audio_path = f"{req.date}/{journal_id}/podcast.mp3"

        scene_1_path = None
        if req.scene_1_base64:
            s1_file = entry_dir / "scene_1.png"
            if _save_base64_file(req.scene_1_base64, s1_file):
                scene_1_path = f"{req.date}/{journal_id}/scene_1.png"

        scene_2_path = None
        if req.scene_2_base64:
            s2_file = entry_dir / "scene_2.png"
            if _save_base64_file(req.scene_2_base64, s2_file):
                scene_2_path = f"{req.date}/{journal_id}/scene_2.png"

        # Generate thumbnail from scene_1
        thumbnail_path = None
        scene_1_file = entry_dir / "scene_1.png"
        if scene_1_file.exists():
            thumb_file = entry_dir / "thumbnail.png"
            _make_thumbnail(scene_1_file, thumb_file)
            thumbnail_path = f"{req.date}/{journal_id}/thumbnail.png"

        conn.execute(
            """INSERT INTO journals
               (id, date, session_num, title, diary_ja, diary_zh, podcast_script,
                podcast_audio_path, scene_1_path, scene_2_path, thumbnail_path,
                entry_text, role, tone, rounds, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                journal_id, req.date, session_num, req.title,
                req.diary_ja, req.diary_zh,
                json.dumps(req.podcast_script, ensure_ascii=False),
                audio_path, scene_1_path, scene_2_path, thumbnail_path,
                req.entry_text, req.role, req.tone, req.rounds,
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
        conn.close()

        print(f"✅ Journal saved: {journal_id}")
        return {"status": "SUCCESS", "id": journal_id}
    except Exception as e:
        print(f"❌ Journal save failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/journal/list")
async def list_journals(year: int, month: int):
    try:
        conn = get_db()
        month_prefix = f"{year}-{str(month).zfill(2)}"
        rows = conn.execute(
            "SELECT id, date, session_num, rounds, thumbnail_path, title FROM journals WHERE date LIKE ? ORDER BY date, session_num",
            (f"{month_prefix}%",),
        ).fetchall()
        conn.close()

        entries: dict[str, list] = {}
        for r in rows:
            date = r["date"]
            if date not in entries:
                entries[date] = []
            entries[date].append({
                "id": r["id"],
                "rounds": r["rounds"],
                "title": r["title"],
                "thumbnail_url": f"/uploads/{r['thumbnail_path']}" if r["thumbnail_path"] else None,
            })

        return {"status": "SUCCESS", "entries": entries}
    except Exception as e:
        print(f"❌ Journal list failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/journal/{journal_id}")
async def get_journal(journal_id: str):
    try:
        conn = get_db()
        row = conn.execute("SELECT * FROM journals WHERE id = ?", (journal_id,)).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Journal not found")

        return {
            "status": "SUCCESS",
            "id": row["id"],
            "date": row["date"],
            "session_num": row["session_num"],
            "title": row["title"],
            "diary_ja": row["diary_ja"],
            "diary_zh": row["diary_zh"],
            "podcast_script": json.loads(row["podcast_script"]) if row["podcast_script"] else [],
            "podcast_audio_url": f"/uploads/{row['podcast_audio_path']}" if row["podcast_audio_path"] else None,
            "scene_1_url": f"/uploads/{row['scene_1_path']}" if row["scene_1_path"] else None,
            "scene_2_url": f"/uploads/{row['scene_2_path']}" if row["scene_2_path"] else None,
            "entry_text": row["entry_text"],
            "role": row["role"],
            "tone": row["tone"],
            "rounds": row["rounds"],
            "created_at": row["created_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Journal get failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)


