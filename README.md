# 🍞 Toast AI: User Testing Simulator

**Toast AI** is a state-of-the-art voice agent designed to simulate user testing sessions. It can instantly pivot between various user personas, allowing you to test your product ideas against diverse (and often brutally honest) perspectives.

Built with [LiveKit Agents](https://github.com/livekit/agents), Toast leverages OpenAI for intelligence, Cartesia for lifelike expressive voices, and AssemblyAI for high-accuracy speech-to-text.

## ✨ Features

- **Dynamic Roleplaying**: Switch personas mid-conversation to see how different users react.
- **Brutally Honest Feedback**: No sugar-coating. Get the roast your product deserves.
- **Low Latency**: Lightning-fast responses for a natural, conversational feel.
- **Multimodal**: Supports voice, text, and rich data interaction.

## 👥 Available Personas

Toast can roleplay as several distinct characters, including:
- **👴 Boomer Dad**: Skeptical, loves "the good old days," and struggles with modern tech jargon.
- **🤳 Gen Z Intern**: Extremely online, uses high-slang, and cares about "the vibe."
- **👔 The VC Bro**: Obsessed with "synergies," "scale," and "AI-first" pivots.
- **🤱 Stressed Mom**: Has no time for fluff; needs things to work immediately for her kids.
- **🛠️ The Engineer**: Highly technical, pedantic about performance, and hates unnecessary abstractions.

## 🚀 Quick Start

### 1. Setup

Install dependencies using [uv](https://docs.astral.sh/uv/getting-started/installation/):

```shell
uv sync
```

### 2. Configuration

Copy `.env.example` to `.env.local` and fill in your LiveKit credentials:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `CARTESIA_API_KEY` (Required for lifelike voices)
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`

### 3. Run the Agent

First, download the necessary VAD and turn-detection models:

```shell
uv run python src/agent.py download-files
```

Start the agent in development mode:

```shell
uv run python src/agent.py dev
```

### 4. Start Testing

Open the [LiveKit Agents Playground](https://agents-playground.livekit.io/) to start talking to Toast!

**Try saying:**
- *"Switch to Boomer Dad"*
- *"I want to talk to the VC Bro"*
- *"What do you think of my new AI-powered toaster?*

---

## 🛠️ Tech Stack

- **Platform**: [LiveKit Cloud](https://cloud.livekit.io)
- **STT**: [AssemblyAI](https://www.assemblyai.com/)
- **LLM**: [OpenAI GPT-4o-mini](https://openai.com/)
- **TTS**: [Cartesia](https://cartesia.ai/)
- **VAD**: [Silero](https://github.com/snakers4/silero-vad)

## 🧪 Tests and Evals

Run the test suite with:

```shell
uv run pytest
```

Happy testing with Toast! 🍞