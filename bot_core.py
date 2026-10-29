#
# The voice bot itself: OpenAI ears + OpenAI brain + OpenAI or Gemini voice.
# Shared by both ways of running the project:
#   - demo_bot.py  -> on your computer (WebRTC, run-pipecat-demo.ps1)
#   - app.py       -> on Vercel (WebSocket)
#

import os

from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker, ProcessorUnusablePolicy
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.stt import OpenAIRealtimeSTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.transports.base_transport import BaseTransport
from pipecat.workers.runner import WorkerRunner

load_dotenv(override=True)

HERE = os.path.dirname(os.path.abspath(__file__))

# Company knowledge: the bot reads this text file and answers from it.
# Edit company_info.txt to change what the bot knows.
with open(os.path.join(HERE, "company_info.txt"), encoding="utf-8") as f:
    COMPANY_INFO = f.read()

# Gemini voice to use (only when GOOGLE_API_KEY is set). Some options:
#   Puck (upbeat), Kore (firm), Charon (informative), Aoede (breezy),
#   Fenrir (excitable), Leda (youthful), Orus (firm), Zephyr (bright)
GEMINI_VOICE = "Puck"

SYSTEM_INSTRUCTION = (
    "You are the voice customer-service assistant for Al Hayat Renewable Energy "
    "(شركة الحياة للطاقة المتجددة). Answer questions using ONLY the company "
    "information below. If the answer is not in it, say you don't have that "
    "information and suggest calling the company. Reply in the same language the "
    "user speaks (Arabic or English). Your responses will be spoken aloud, so keep "
    "them short and avoid emojis, bullet points, or other formatting that can't be "
    "spoken.\n\n"
    "=== COMPANY INFORMATION ===\n" + COMPANY_INFO
)


def make_tts():
    """Voice: Gemini if GOOGLE_API_KEY is set, otherwise OpenAI."""
    if os.getenv("GOOGLE_API_KEY"):
        from pipecat.services.google.tts import GeminiTTSService

        logger.info(f"Voice: Gemini {GEMINI_VOICE}")
        return GeminiTTSService(
            api_key=os.environ["GOOGLE_API_KEY"],
            settings=GeminiTTSService.Settings(
                model="gemini-3.8-flash-tts",
                voice=GEMINI_VOICE,
                prompt="Warm and conversational, at a relaxed pace.",
            ),
        )
    logger.info("Voice: OpenAI ballad")
    return OpenAITTSService(
        api_key=os.environ["OPENAI_API_KEY"],
        settings=OpenAITTSService.Settings(voice="ballad"),
    )


async def run_bot(
    transport: BaseTransport,
    idle_timeout_secs: int | None = 300,
    handle_sigint: bool = False,
):
    """Run one conversation on the given transport until the caller hangs up."""
    logger.info("Starting bot")

    # 1) Ears: OpenAI speech-to-text
    stt = OpenAIRealtimeSTTService(api_key=os.environ["OPENAI_API_KEY"])

    # 2) Brain: OpenAI language model, answering from company_info.txt
    llm = OpenAILLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        settings=OpenAILLMService.Settings(system_instruction=SYSTEM_INSTRUCTION),
    )

    # 3) Mouth: text-to-speech
    tts = make_tts()

    # Conversation memory + voice activity detection (knows when you stop talking)
    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    # The pipeline: mic -> STT -> LLM -> TTS -> speaker
    pipeline = Pipeline(
        [
            transport.input(),  # audio from the browser mic
            stt,  # speech -> text
            user_aggregator,  # add what the caller said to the conversation
            llm,  # think up a reply
            tts,  # text -> speech
            transport.output(),  # audio back to the browser
            assistant_aggregator,  # add the bot's reply to the conversation
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        idle_timeout_secs=idle_timeout_secs,
        processor_unusable_policy=ProcessorUnusablePolicy.END,
    )

    runner = WorkerRunner(handle_sigint=handle_sigint)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        # The bot speaks first and introduces itself.
        context.add_message(
            {
                "role": "developer",
                "content": "Greet the user in Arabic as the assistant of Al Hayat Renewable Energy and ask how you can help.",
            }
        )
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await runner.cancel()

    await runner.run()
