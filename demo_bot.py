#
# Run the bot on your computer (WebRTC).
# The bot itself lives in bot_core.py, shared with the Vercel version (app.py).
#
# Easiest: run run-pipecat-demo.ps1. Or directly:  uv run demo_bot.py -t webrtc
# Then open http://localhost:7860/client/
#

import os

from fastapi.responses import FileResponse

from pipecat.runner.run import app as runner_app
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import TransportParams

from bot_core import HERE, run_bot

# Custom interface (hayat_ui.html) opens at the usual address:
#   http://localhost:7860/client/
# The original Pipecat Playground is kept as a backup at:
#   http://localhost:7860/classic/
# To go back to the original at /client/, delete hayat_ui.html.
_ui_file = os.path.join(HERE, "hayat_ui.html")
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


# Only the browser (WebRTC) connection is used on your computer.
transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
    ),
}


async def bot(runner_args: RunnerArguments):
    """Main bot entry point for the Pipecat runner."""
    transport = await create_transport(runner_args, transport_params)
    await run_bot(
        transport,
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
        handle_sigint=runner_args.handle_sigint,
    )


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
