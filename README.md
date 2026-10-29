# call-center-AI

A voice customer-service assistant for **Al Hayat Renewable Energy** (شركة الحياة للطاقة المتجددة), a fictional company used for learning.
You talk to it in the browser and it talks back, answering from the company information file.

Built on [Pipecat](https://github.com/pipecat-ai/pipecat).

![Call screen](desk-call.png)

## How it works

| Part | Service |
| --- | --- |
| Speech to text (ears) | OpenAI |
| Reply (brain) | OpenAI, using `company_info.txt` |
| Text to speech (voice) | OpenAI, or Gemini if `GOOGLE_API_KEY` is set |
| Interface | `hayat_ui.html`, served at `/client/` |

## Files

- `run-pipecat-demo.ps1`: sets up everything and starts the bot (Windows)
- `demo_bot.py`: the voice bot, based on Pipecat's `examples/voice/voice-openai.py`
- `company_info.txt`: what the assistant knows about the company (edit it to change its answers)
- `hayat_ui.html`: the custom interface

## Run it (Windows)

1. Install [Git for Windows](https://git-scm.com/download/win).
2. Open PowerShell in this folder and run:
   ```
   powershell -ExecutionPolicy Bypass -File .\run-pipecat-demo.ps1
   ```
3. Paste your OpenAI API key when asked. For the Gemini key, paste it or press Enter to skip.
   Keys are saved only in `pipecat\.env` on your PC and are never committed.
4. Open http://localhost:7860/client/, click **ابدأ المكالمة**, allow the microphone and start talking.

The original Pipecat Playground is still available at http://localhost:7860/classic/.

## Notes

- The OpenAI account needs billing credit.
- Gemini's free tier allows about 10 voice requests per day. After that the bot shows text with no voice.
- The script clones Pipecat into a `pipecat` folder the first time. That folder is not part of this repo.
