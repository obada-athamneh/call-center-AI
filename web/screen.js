// What a tool uses to put something in front of the caller.
// The decision lives here, not in the model:
//   - caller not on the page that holds the section -> navigate there (client-side) with the anchor
//   - caller already there -> only change UI state (scroll / highlight / spotlight), no navigation
import { currentPath, goTo } from "./nav.js";
import { getState, setState } from "./store.js";

// The page this site is served at ("/" online, "/client/" on your computer).
export const SITE_PATH = location.pathname || "/";

// Which page holds each section. One page today; add pages here later without touching tools.
const SECTION_PAGE = {
  home: SITE_PATH,
  about: SITE_PATH,
  services: SITE_PATH,
  prices: SITE_PATH,
  payment: SITE_PATH,
  warranty: SITE_PATH,
  process: SITE_PATH,
  offers: SITE_PATH,
  branches: SITE_PATH,
  contact: SITE_PATH,
  faq: SITE_PATH,
};

const samePage = (a, b) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

// Make sure the caller is on the page that shows `sectionId`.
// Returns true if it had to navigate.
export function ensureScreen(sectionId) {
  const page = SECTION_PAGE[sectionId] || SITE_PATH;
  if (!samePage(currentPath(), page)) {
    goTo(`${page}${location.search}#${sectionId}`);
    return true;
  }
  return false;
}

let spotlightTimer = null;

// mode: "focus" (whole section), "highlight" (one item), "spotlight" (one item, rest dimmed)
export function showOnScreen({ section, item = null, mode = item ? "highlight" : "focus" }) {
  const navigated = ensureScreen(section);
  const tick = getState().screenTick + 1;
  setState({
    focusSectionId: section,
    highlightId: mode === "highlight" ? item : null,
    spotlightId: mode === "spotlight" ? item : null,
    screenTick: tick,
  });
  if (mode === "spotlight") {
    clearTimeout(spotlightTimer);
    spotlightTimer = setTimeout(() => {
      if (getState().screenTick === tick) setState({ spotlightId: null });
    }, 9000);
  }
  return navigated;
}
