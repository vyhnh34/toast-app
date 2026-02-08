import asyncio
import logging
import re

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
)
from livekit.plugins import anthropic, cartesia, deepgram, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from notion_connector import get_persona

# Default voice ID for the assistant
DEFAULT_VOICE_ID = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"

logger = logging.getLogger("livekit.agents")
load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self, persona_name="Helpful Assistant") -> None:
        self.persona_name = persona_name
        self.current_persona = None
        instructions = """You are a helpful voice AI assistant for user testing simulation.

Users can ask you to roleplay as different personas by saying "Talk to [Persona Name]".

Available personas: Boomer Dad, Gen Z Intern, The VC Bro, Stressed Mom, The Engineer

IMPORTANT: Keep responses SHORT (1-2 sentences). NEVER use asterisks or action descriptions like *clears throat* or *squints*. Just speak naturally."""

        super().__init__(instructions=instructions)
        self._agent_session = None
        print(f"Assistant initialized with default persona: {persona_name}")

    async def initialize_persona(self):
        """Async initialization of persona data"""
        print(f"Fetching persona data for: {self.persona_name}")
        persona = get_persona(self.persona_name)
        if persona:
            self.current_persona = persona
            if persona["name"] != "Helpful Assistant":
                self._instructions = f"""You are roleplaying as {persona['name']}.

BACKSTORY: {persona['backstory']}

ROAST STYLE: {persona['roast_style']}

Stay in character. Be brutally honest and SHORT (1-2 sentences max).
NEVER use asterisks or action descriptions like *clears throat* or *squints*. Just speak naturally."""
            print(f"Persona initialized: {persona['name']}")
        else:
            print("Failed to fetch persona, using default instructions")

    async def switch_persona(self, persona_name: str):
        logger.info(f"Switching to persona: {persona_name}")
        new_persona = get_persona(persona_name)

        if new_persona:
            self.current_persona = new_persona

            if new_persona["name"] != "Helpful Assistant":
                new_instructions = f"""You are now roleplaying as {new_persona["name"]}.

BACKSTORY: {new_persona["backstory"]}

ROAST STYLE: {new_persona["roast_style"]}

Stay in character. React to product ideas as this persona would.
Be brutally honest and entertaining. Keep responses SHORT (1-2 sentences).
NEVER use asterisks or action descriptions like *clears throat* - just speak naturally."""
            else:
                new_instructions = """You are a helpful voice AI assistant for user testing simulation."""

            self._instructions = new_instructions

            # Switch voice using the TTS update_options method
            if self._agent_session:
                voice_id = new_persona.get("voice_id") or DEFAULT_VOICE_ID
                print(f"[VOICE SWITCH] Attempting to switch to voice_id: {voice_id}")
                logger.info(f"Switching Cartesia voice to: {voice_id}")
                logger.info(f"Current TTS instance: {self._agent_session.tts}")

                try:
                    # Update the voice on the existing TTS instance via session.tts property
                    tts_instance = self._agent_session.tts
                    print(f"[VOICE SWITCH] TTS instance: {tts_instance}")
                    if tts_instance:
                        print(f"[VOICE SWITCH] Calling update_options with voice={voice_id}")
                        tts_instance.update_options(voice=voice_id)
                        print(f"[VOICE SWITCH] Successfully updated voice to {voice_id}")
                        logger.info(
                            f"Successfully switched voice to {voice_id} for {new_persona['name']}"
                        )
                    else:
                        print("[VOICE SWITCH] ERROR: No TTS instance available!")
                        logger.error("No TTS instance available on session!")

                except Exception as e:
                    logger.error(f"Failed to update voice: {e}")
                    import traceback

                    traceback.print_exc()

            return new_persona

        return None


async def entrypoint(ctx: JobContext):
    assistant = Assistant()

    print("Initializing STT, LLM, and TTS...")
    stt = deepgram.STT()
    llm = anthropic.LLM(model="claude-3-haiku-20240307")
    tts = cartesia.TTS(model="sonic-2", voice=DEFAULT_VOICE_ID)
    print("Providers initialized")

    session = AgentSession(
        stt=stt,
        llm=llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )
    print("AgentSession instance created")

    assistant._agent_session = session

    print(f"Starting job {ctx.job.id} for room {ctx.room.name}")
    logger.info(f"Starting job {ctx.job.id} for room {ctx.room.name}")

    await ctx.connect()
    print("Connected to room")

    await session.start(
        agent=assistant,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    print("Session started")

    # Initialize persona data after session start to not block connection
    await assistant.initialize_persona()

    print("Generating initial greeting...")
    await session.generate_reply(
        instructions=(
            "Introduce yourself as Toast, a User Testing Simulator! "
            "Tell them you can roleplay as different personas to help test their product ideas. "
            "Mention a few available personas: Boomer Dad, Gen Z Intern, The VC Bro. "
            "Ask them which persona they'd like to talk to, or what product idea they want to test. "
            "Keep it brief, friendly, and enthusiastic."
        ),
        allow_interruptions=True,
    )
    print("Initial greeting generated")

    background_tasks = set()

    @session.on("user_input_transcribed")
    def on_user_speech(event):
        # Create async task for the handler since .on() doesn't support async callbacks
        task = asyncio.create_task(_handle_user_speech(event))
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)

    async def _handle_user_speech(event):
        try:
            print(f"[DEBUG] Event received: {event}")
            # Only process final transcripts
            if not event.is_final:
                return

            text = event.transcript
            print(f"[DEBUG] User said (final): {text}")
            logger.info(f"User said (final): {text}")

            text_lower = text.lower()
            persona_name = None

            # Try various "switch to" patterns
            patterns = [
                r"talk to (.*?)(?:\.|$|,)",
                r"switch to (.*?)(?:\.|$|,)",
                r"change to (.*?)(?:\.|$|,)",
                r"let me talk to (.*?)(?:\.|$|,)",
            ]
            for pattern in patterns:
                match = re.search(pattern, text_lower)
                if match:
                    persona_name = match.group(1).strip().title()
                    break

            if not persona_name:
                # Try matching known persona names directly (including common mishearings)
                persona_patterns = {
                    "boomer dad": "Boomer Dad",
                    "boomer": "Boomer Dad",
                    "gen z intern": "Gen Z Intern",
                    "gen z": "Gen Z Intern",
                    "genz": "Gen Z Intern",
                    "vc bro": "The VC Bro",
                    "vc pro": "The VC Bro",  # common mishearing
                    "vb bro": "The VC Bro",  # common mishearing
                    "stressed mom": "Stressed Mom",
                    "mom": "Stressed Mom",
                    "engineer": "The Engineer",
                }
                for pattern, full_name in persona_patterns.items():
                    if pattern in text_lower:
                        persona_name = full_name
                        break

            if persona_name:
                print(f"[DEBUG] User requested persona: {persona_name}")
                logger.info(f"User requested persona: {persona_name}")

                new_persona = await assistant.switch_persona(persona_name)

                if new_persona and new_persona["name"] != "Helpful Assistant":
                    await session.generate_reply(
                        instructions=(
                            f"You just became {new_persona['name']}. "
                            "Introduce yourself VERY briefly in character (one short sentence). "
                            "Then ask what product they want you to test. "
                            "Stay in character!"
                        ),
                        allow_interruptions=True,
                    )
        except Exception as e:
            print(f"[ERROR] Exception in _handle_user_speech: {e}")
            import traceback

            traceback.print_exc()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
