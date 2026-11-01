// The voice call: connects to the bot, plays its voice, keeps the transcript,
// and runs screen tools the bot asks for (see tools.js / ui_tools.py).
import { getState, setState } from "./store.js";
import { runTool } from "./tools.js";

const SDK = "https://esm.sh/@pipecat-ai/client-js@1.15.0";
const SMALL_WEBRTC = "https://esm.sh/@pipecat-ai/small-webrtc-transport@1.11.1?deps=@pipecat-ai/client-js@1.15.0";
const WEBSOCKET = "https://esm.sh/@pipecat-ai/websocket-transport@1.8.1?deps=@pipecat-ai/client-js@1.15.0";

// On your computer: WebRTC through demo_bot.py. Online: WebSocket through app.py.
export const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const ACCESS_CODE = new URLSearchParams(location.search).get("code") || "";

let client = null;
let botAudio = null;
let audioCtx = null;
let meter = null;

const root = document.documentElement;
const level = { bot: 0, user: 0 };
const target = { bot: 0, user: 0 };
const boost = (v) => Math.min(1, Math.sqrt(Math.max(0, v)) * 1.6);

(function tick() {
  for (const k of ["bot", "user"]) {
    if (meter && k === "bot") {
      meter.analyser.getByteTimeDomainData(meter.buf);
      let sum = 0;
      for (const v of meter.buf) { const d = (v - 128) / 128; sum += d * d; }
      target.bot = Math.max(target.bot, boost(Math.sqrt(sum / meter.buf.length) * 2));
    }
    level[k] += (target[k] - level[k]) * 0.25;
    target[k] *= 0.9;
    root.style.setProperty(`--${k}`, level[k].toFixed(3));
  }
  requestAnimationFrame(tick);
})();

function setCall(patch) {
  setState((s) => ({ call: { ...s.call, ...patch } }));
}
function notice(text) {
  setState({ notice: text });
}

// ---------- transcript ----------
let userLineId = null;
let botLineId = null;
let botHasSentence = false;
let lineSeq = 0;

function upsertLine(id, who, text, final) {
  setState((s) => {
    const lines = s.transcript.slice();
    const i = lines.findIndex((l) => l.id === id);
    if (i >= 0) lines[i] = { ...lines[i], text, final };
    else lines.push({ id, who, text, final });
    return { transcript: lines.slice(-40) };
  });
}

function onUserTranscript(data) {
  if (!data?.text) return;
  if (!userLineId) userLineId = `u${++lineSeq}`;
  upsertLine(userLineId, "user", data.text, !!data.final);
  if (data.final) userLineId = null;
}

function onBotOutput(data) {
  if (!data?.text) return;
  const type = data.output_type || data.aggregated_by || data.text_type || "sentence";
  if (!["sentence", "word", "token"].includes(type)) return;
  if (!botLineId) { botLineId = `b${++lineSeq}`; botHasSentence = false; }
  const current = getState().transcript.find((l) => l.id === botLineId)?.text || "";
  let text = current;
  if (type === "sentence") {
    text = (botHasSentence ? current + " " : "") + data.text.trim();
    botHasSentence = true;
  } else if (!botHasSentence) {
    text = current + (type === "word" && current ? " " : "") + data.text;
  }
  upsertLine(botLineId, "bot", text, true);
}

// ---------- audio ----------
function ensureAudio() {
  if (!botAudio) {
    botAudio = document.createElement("audio");
    botAudio.autoplay = true;
    botAudio.setAttribute("playsinline", "");
    document.body.appendChild(botAudio);
  }
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  audioCtx?.resume?.().catch(() => {});
  botAudio.play().catch(() => {});
}

function playBotTrack(track) {
  const stream = new MediaStream([track]);
  botAudio.srcObject = stream;
  botAudio.play().catch(() => {
    notice("المتصفح منع الصوت. اضغط أي مكان بالصفحة عشان يشتغل.");
    document.addEventListener("click", () => botAudio.play().catch(() => {}), { once: true });
  });
  try {
    if (!audioCtx) return;
    meter?.src.disconnect();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    meter = { src, analyser, buf: new Uint8Array(analyser.fftSize) };
  } catch (e) {
    console.warn("level meter unavailable", e);
  }
}

// ---------- screen tools from the bot ----------
function onServerMessage(data) {
  if (data?.type !== "ui-tool") return;
  const result = runTool(data.name, data.args);
  try {
    client?.sendClientMessage("ui-tool-result", { id: data.id, result });
  } catch (e) {
    console.error("[call] could not send tool result", e);
  }
}

// ---------- start / end ----------
async function preflight() {
  if (IS_LOCAL) return null;
  try {
    const h = await (await fetch("/health", { cache: "no-store" })).json();
    if (!h.openai_key_set) return "المفتاح OPENAI_API_KEY مش محطوط بإعدادات السيرفر.";
    if (h.access_code_required && !ACCESS_CODE) return "هاد الرابط محمي بكلمة سر. افتح الرابط مع ?code=كلمة_السر بآخره.";
  } catch { /* server may be waking up */ }
  return null;
}

export async function startCall() {
  if (getState().call.active || getState().call.status === "connecting") return;
  notice(null);
  setCall({ status: "connecting" });
  ensureAudio();

  const problem = await preflight();
  if (problem) { notice(problem); return resetCall("error"); }

  let PipecatClient, transport;
  try {
    ({ PipecatClient } = await import(SDK));
    if (IS_LOCAL) {
      const { SmallWebRTCTransport } = await import(SMALL_WEBRTC);
      transport = new SmallWebRTCTransport();
    } else {
      const { WebSocketTransport } = await import(WEBSOCKET);
      transport = new WebSocketTransport();
    }
  } catch (e) {
    console.error(e);
    notice("ما قدرنا نحمّل أدوات الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
    return resetCall("error");
  }

  client = new PipecatClient({
    transport,
    enableMic: true,
    enableCam: false,
    callbacks: {
      onBotReady: () => setCall({ status: "ready" }),
      onDisconnected: () => resetCall(),
      onTrackStarted: (track, participant) => {
        if (track.kind === "audio" && !participant?.local) playBotTrack(track);
      },
      onLocalAudioLevel: (v) => { if (!getState().call.micMuted) target.user = Math.max(target.user, boost(v)); },
      onRemoteAudioLevel: (v) => { target.bot = Math.max(target.bot, boost(v)); },
      onUserStartedSpeaking: () => setCall({ status: "user" }),
      onUserStoppedSpeaking: () => setCall({ status: "ready" }),
      onBotStartedSpeaking: () => { setCall({ status: "bot" }); botLineId = null; },
      onBotStoppedSpeaking: () => setCall({ status: "ready" }),
      onUserTranscript,
      onBotOutput,
      onServerMessage,
      onDeviceError: () => notice("المتصفح مانع المايكروفون. اضغط على القفل جنب عنوان الصفحة، خلي Microphone على Allow، وجرّب مرة ثانية."),
      onError: (msg) => {
        console.error("Pipecat error", msg);
        notice("صار خطأ بالمحادثة. جرّب مرة ثانية.");
      },
    },
  });

  try {
    if (IS_LOCAL) {
      await client.connect({ webrtcRequestParams: { endpoint: "/api/offer" } });
    } else {
      const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`
        + (ACCESS_CODE ? `?code=${encodeURIComponent(ACCESS_CODE)}` : "");
      await client.connect({ wsUrl });
    }
    setCall({ status: "ready", active: true });
  } catch (err) {
    console.error(err);
    const blocked = /permission|notallowed|denied/i.test(String(err?.name || err?.message || err));
    notice(blocked
      ? "المتصفح مانع المايكروفون. اضغط على القفل جنب عنوان الصفحة، خلي Microphone على Allow، وجرّب مرة ثانية."
      : IS_LOCAL
        ? "ما قدرنا نوصل للمساعد. تأكد إنه نافذة PowerShell لسا شغالة، وجرّب مرة ثانية."
        : "ما قدرنا نوصل للمساعد. إذا السيرفر كان نايم، استنى دقيقة وجرّب مرة ثانية.");
    try { await client?.disconnect(); } catch {}
    resetCall("error");
  }
}

export async function endCall() {
  try { await client?.disconnect(); } catch {}
  resetCall();
}

export function toggleMic() {
  if (!client) return;
  const muted = !getState().call.micMuted;
  client.enableMic(!muted);
  setCall({ micMuted: muted });
}

function resetCall(status = "idle") {
  client = null;
  userLineId = botLineId = null;
  if (botAudio) botAudio.srcObject = null;
  try { meter?.src.disconnect(); } catch {}
  meter = null;
  target.bot = target.user = 0;
  setState((s) => ({ call: { ...s.call, status, active: false, micMuted: false } }));
}
