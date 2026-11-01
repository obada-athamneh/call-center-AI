// Small UI store shared by React components and by the voice tools (which live outside React).
import { useSyncExternalStore } from "react";

const initialState = {
  // In-page movement, driven by the voice tools or the header links.
  focusSectionId: null, // a whole section to scroll to
  highlightId: null, // one item to scroll to and mark
  spotlightId: null, // one item to bring forward while the rest of its section dims
  screenTick: 0, // bumps on every request, so asking for the same thing twice still scrolls

  // FAQ items opened by the bot or the visitor.
  openFaq: {},

  // Free site-visit request, filled by the visitor or by the bot.
  visit: { name: "", city: "", system_type: "", phone: "", filledByBot: false, sent: false },

  // Call state.
  call: { status: "idle", active: false, micMuted: false },
  transcript: [], // [{ id, who: "user" | "bot", text, final }]
  notice: null,
};

let state = initialState;
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}
