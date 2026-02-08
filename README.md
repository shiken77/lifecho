# LifeEcho

> Don't forget the sweet moment.

LifeEcho is an AI-powered interactive journal application that combines cute, handwritten-style aesthetics with intelligent role-playing and voice interaction. It helps you capture and cherish your daily moments through engaging conversations.

![LifeEcho Demo](https://via.placeholder.com/800x400?text=LifeEcho+Preview)

## Features

- **🎨 Cute Handwritten UI**: A unique, comforting interface featuring Japanese handwritten fonts and animated stroke-by-stroke titles.
- **🤖 AI Role-Play**: Chat with different personas (Gentle Friend, Normal, Serious) powered by Google Gemini.
- **🗣️ Voice Interaction**: Support for voice input and text-to-speech feedback.
- **📝 Memory Summarization**: Automatically summarizes your conversations into journal entries.
- **🎌 Bilingual Support**: Designed for Japanese/English interaction contexts.

## Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/) (SVG path animations, layout transitions)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **AI Model**: Google Gemini Pro
- **TTS**: Google Cloud Text-to-Speech
- **Language**: Python

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Google Gemini API Key
- Google Cloud Credentials (for TTS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shiken77/lifecho.git
   cd lifecho
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.

3. **Backend Setup**
   ```bash
   cd backend
   # Create virtual environment (optional but recommended)
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install fastapi uvicorn google-generativeai python-dotenv google-cloud-texttospeech
   
   # Setup Environment Variables
   # Create a .env file in backend/ with:
   # GEMINI_API_KEY=your_api_key_here
   
   # Run the server
   uvicorn main1:app --reload --port 8000
   ```

## License

[MIT](LICENSE)
