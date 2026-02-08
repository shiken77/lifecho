"""
检查API配置和Gemini连接
"""
import os
from dotenv import load_dotenv

print("=" * 60)
print("API Configuration Check")
print("=" * 60)

# 检查.env文件
env_path = os.path.join("backend", ".env")
if os.path.exists(env_path):
    print(f"\n[OK] Found .env file at: {env_path}")
    load_dotenv(env_path)
else:
    print(f"\n[WARN] .env file not found at: {env_path}")
    print("   Trying to load from backend directory...")
    load_dotenv()

# 检查Gemini API Key
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    print(f"\n[OK] GEMINI_API_KEY is set")
    print(f"   Key length: {len(gemini_key)} characters")
    print(f"   Key preview: {gemini_key[:10]}...{gemini_key[-5:]}")
else:
    print(f"\n[ERROR] GEMINI_API_KEY is NOT set")
    print("   Please add GEMINI_API_KEY to your .env file")

# 检查Gemini Model ID
gemini_model = os.getenv("GEMINI_MODEL_ID", "gemini-flash-latest")
print(f"\n[OK] GEMINI_MODEL_ID: {gemini_model}")

# 测试Gemini连接
if gemini_key:
    print("\n" + "=" * 60)
    print("Testing Gemini API Connection")
    print("=" * 60)
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        
        # 测试文本模型
        print("\nTesting text model...")
        text_model = genai.GenerativeModel(gemini_model)
        response = text_model.generate_content("Say hello in one word")
        print(f"[OK] Text model works! Response: {response.text}")
        
        # 测试图片生成模型
        print("\nTesting image generation model...")
        try:
            image_model = genai.GenerativeModel("nano-banana-pro-preview")
            print("[OK] Image model 'nano-banana-pro-preview' is available")
        except Exception as e:
            print(f"[WARN] Image model test failed: {str(e)}")
            print("   This might be normal if the model requires special access")
        
    except ImportError:
        print("[ERROR] google-generativeai package not installed")
        print("   Install with: pip install google-generativeai")
    except Exception as e:
        print(f"[ERROR] Gemini API connection failed: {type(e).__name__}: {str(e)}")
        if "API_KEY" in str(e) or "key" in str(e).lower():
            print("   This suggests the API key is invalid or expired")
        elif "quota" in str(e).lower() or "limit" in str(e).lower():
            print("   This suggests API quota has been exceeded")
        else:
            print("   Check your internet connection and API key validity")
else:
    print("\n[WARN] Skipping Gemini API test (no API key)")

print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
if gemini_key:
    print("[OK] Configuration looks good!")
    print("   Make sure backend server is running: cd backend && python main1.py")
else:
    print("[ERROR] Configuration incomplete")
    print("   Please set GEMINI_API_KEY in backend/.env file")

