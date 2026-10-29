#
# Pipecat voice demo bot - OpenAI ears + OpenAI brain + Gemini voice
# Based on the repo's examples/voice/voice-openai.py, with the Daily / LiveKit /
# Twilio connection options removed so it only needs your OpenAI key.
#
# Run it with:  uv run demo_bot.py -t webrtc
# Then open http://localhost:7860/client/ and click Connect.
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
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.openai.stt import OpenAIRealtimeSTTService
from pipecat.services.openai.tts import OpenAITTSService
from pipecat.services.google.tts import GeminiTTSService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner
from pipecat.runner.run import app as runner_app
from fastapi.responses import FileResponse

load_dotenv(override=True)

# Company knowledge: the bot reads this text file and answers from it.
# Edit company_info.txt (in the same folder as this file) to change what the bot knows.
_here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_here, "company_info.txt"), encoding="utf-8") as f:
    COMPANY_INFO = f.read()

# Custom interface (hayat_ui.html) now opens at the usual address:
#   http://localhost:7860/client/
# The original Pipecat Playground is kept as a backup at:
#   http://localhost:7860/classic/
# To go back to the original at /client/, delete hayat_ui.html.
_ui_file = os.path.join(_here, "hayat_ui.html")
if os.path.exists(_ui_file):

    @runner_app.get("/client/", include_in_schema=False)
    @runner_app.get("/client", include_in_schema=False)
    @runner_app.get("/hayat", include_in_schema=False)
    async def hayat_ui():
        return FileResponse(_ui_file)

    try:
        from pipecat_ai_prebuilt.frontend import PipecatPrebuiltUI

        runner_app.mount("/classic", PipecatPrebuiltUI)
    except ImportError:
        pass


# Voice: uses Gemini if GOOGLE_API_KEY is in .env, otherwise the OpenAI voice.
USE_GEMINI_VOICE = bool(os.getenv("GOOGLE_API_KEY"))

# Gemini voice to use. Some options:
#   Puck (upbeat), Kore (firm), Charon (informative), Aoede (breezy),
#   Fenrir (excitable), Leda (youthful), Orus (firm), Zephyr (bright)
GEMINI_VOICE = "Puck"

# Only the browser (WebRTC) connection is used in this demo.
transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info("Starting bot")

    # 1) Ears: OpenAI speech-to-text
    stt = OpenAIRealtimeSTTService(api_key=os.environ["OPENAI_API_KEY"])

    # 2) Brain: OpenAI language model
    llm = OpenAILLMService(
        api_key=os.environ["OPENAI_API_KEY"],
        settings=OpenAILLMService.Settings(
            system_instruction=(
                "You are the voice customer-service assistant for Al Hayat Renewable Energy "
                "(شركة الحياة للطاقة المتجددة). Answer questions using ONLY the company "
                "information below. If the answer is not in it, say you don't have that "
                "information and suggest calling the company. Reply in the same language the "
                "user speaks (Arabic or English). Your responses will be spoken aloud, so keep "
                "them short and avoid emojis, bullet points, or other formatting that can't be "
                "spoken.\n\n"
                "=== COMPANY INFORMATION ===\n" + COMPANY_INFO
            ),
        ),
    )

    # 3) Mouth: Gemini text-to-speech (needs GOOGLE_API_KEY in .env)
    #    Change GEMINI_VOICE at the top of this file to try another voice.
    if USE_GEMINI_VOICE:
        tts = GeminiTTSService(
            api_key=os.environ["GOOGLE_API_KEY"],
            settings=GeminiTTSService.Settings(
                model="gemini-3.8-flash-tts",
                voice=GEMINI_VOICE,
                prompt="Warm and conversational, at a relaxed pace.",
            ),
        )
    else:
        tts = OpenAITTSService(
            api_key=os.environ["OPENAI_API_KEY"],
            settings=OpenAITTSService.Settings(voice="ballad"),
        )
    logger.info(f"Voice: {'Gemini ' + GEMINI_VOICE if USE_GEMINI_VOICE else 'OpenAI ballad'}")

    # Conversation memory + voice activity detection (knows when you stop talking)
    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    # The pipeline: mic -> STT -> LLM -> TTS -> speaker
    pipeline = Pipeline(
        [
            transport.input(),  # audio from your browser mic
            stt,  # speech -> text
            user_aggregator,  # add what you said to the conversation
            llm,  # think up a reply
            tts,  # text -> speech
            transport.output(),  # audio back to your browser
            assistant_aggregator,  # add the bot's reply to the conversation
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_out_sample_rate=24000,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
        processor_unusable_policy=ProcessorUnusablePolicy.END,
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
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


async def bot(runner_args: RunnerArguments):
    """Main bot entry point."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
