# LifeEcho

> Don't forget the sweet moment.

Lifecho is an web app focusing on second-language communication improvement that you and lifecho can cocreate your life together and generate a diary-based notebook

[Try LifeEcho](https://shiken77.github.io/lifecho/chat)
![lifecho](https://raw.githubusercontent.com/shiken77/lifecho/main/test1.jpg)

## Pain point and solution

1. Disconnection from Reality: Traditional language learning is often detached from daily life. Many students can pass standardized tests but struggle to describe their own day or handle spontaneous scenarios—like chatting with a bartender or a new friend—because textbooks rely on generic, rigid scripts.

2.Speaking Anxiety: Most learners lack a natural language environment. This absence of consistent, low-stakes practice leads to "speaking anxiety," making them hesitant to use the language in the real world.

We were inspired by the Self-Reference Effect: we learn fastest when information relates directly to our own experiences. Furthermore, the acts of co-creation and journaling foster positive emotional engagement, transforming the app into a space for self-care and self-expression.

Thus, we built Lifecho. It turns your personal memories into your primary curriculum, making the language journey more exciting and providing a genuine channel for self-expression.

## Features

1. Scene Conversation practice: An AI coach remind you a real-world scenarios based on your captured memories, allowing you to practice dialogue that actually matters to you

2. Multimodal Scrapbook: lifecho capture your day through your conversation with it, it can generate audio, photos, and narratives podcast script, creating a "living" textbook 

3. Multi-Perspective Learning: The app guide you how to describe the same event from different angles (especially there are causal and polite grammar in Japanese) deepening your linguistic flexibility.

# Tech Stack

## Frontend
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/) (SVG path animations, layout transitions)
- **Icons**: [Lucide React](https://lucide.dev/)

## Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **AI Model**: Google Gemini 3
- **TTS**: Google Cloud Text-to-Speech
- **Language**: Python


## License

[MIT](LICENSE)
