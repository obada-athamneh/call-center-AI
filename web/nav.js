// Navigation bridge.
// Tools run outside the React tree (they're called from the voice connection), so they
// can't use the router directly. The layout registers the router's navigate function
// here, and tools call goTo().
//
// CRITICAL: navigation must stay client-side (history.pushState through the router).
// A full page load (window.location) tears down the WebRTC/WebSocket connection and
// ends the call mid-sentence. window.location is only a last resort when no router
// has registered yet.

let navigator = null;

export function registerNavigator(fn) {
  navigator = fn;
  return () => {
    if (navigator === fn) navigator = null;
  };
}

export function goTo(href) {
  if (navigator) {
    navigator(href);
    return true;
  }
  console.warn("[nav] no router registered yet; falling back to a full page load");
  window.location.assign(href);
  return false;
}

export function currentPath() {
  return window.location.pathname;
}
