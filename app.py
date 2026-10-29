#
# The online version (Render, Railway, ...): one FastAPI app that serves the page
# and runs the bot. The browser talks to the bot over a WebSocket at /ws
# (hosting platforms can't carry the WebRTC audio the local version uses).
#
# Start command:  uvicorn app:app --host 0.0.0.0 --port $PORT
#
# Environment variables (set them in the hosting dashboard, never in the code):
#   OPENAI_API_KEY   required
#   GOOGLE_API_KEY   optional, switches the voice to Gemini
#   ACCESS_CODE      optional password; callers then open  https://your-site/?code=PASSWORD
#

import hmac
import os

from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from loguru import logger

from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from bot_core import HERE, run_bot

app = FastAPI()
UI_FILE = os.path.join(HERE, "hayat_ui.html")


@app.get("/", include_in_schema=False)
async def home():
    return FileResponse(UI_FILE, headers={"Cache-Control": "no-cache"})


@app.get("/client", include_in_schema=False)
@app.get("/client/", include_in_schema=False)
async def client_page():
    # Same address as on your computer.
    return RedirectResponse("/")


@app.get("/health", include_in_schema=False)
async def health():
    return JSONResponse(
        {
            "ok": True,
            "openai_key_set": bool(os.getenv("OPENAI_API_KEY")),
            "voice": "gemini" if os.getenv("GOOGLE_API_KEY") else "openai",
            "access_code_required": bool(os.getenv("ACCESS_CODE")),
        }
    )


def _code_ok(websocket: WebSocket) -> bool:
    required = os.getenv("ACCESS_CODE")
    if not required:
        return True
    given = websocket.query_params.get("code", "")
    return hmac.compare_digest(given.encode(), required.encode())


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    if not os.getenv("OPENAI_API_KEY"):
        logger.error("OPENAI_API_KEY is not set in the Vercel environment variables")
        await websocket.close(code=1011)
        return
    if not _code_ok(websocket):
        logger.warning("Rejected call: wrong or missing access code")
        await websocket.close(code=4003)
        return

    await websocket.accept()

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=ProtobufFrameSerializer(),
        ),
    )
    try:
        await run_bot(transport, idle_timeout_secs=120, handle_sigint=False)
    except Exception:
        logger.exception("Bot session ended with an error")
