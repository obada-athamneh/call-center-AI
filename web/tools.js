// Browser side of the voice tools (server side: ui_tools.py).
// Each handler decides for itself whether to navigate or only move the screen
// (see showOnScreen / ensureScreen), then returns { ok, shown, hint }.
// `hint` tells the model what to say next, so the main prompt stays short.
import { showOnScreen, ensureScreen } from "./screen.js";
import { getState, setState } from "./store.js";
import * as C from "./content.js";

const find = (list, key) => list.find((x) => x.key === key);

function show(section, item, mode, shown, hint) {
  showOnScreen({ section, item, mode });
  return { ok: true, shown, hint };
}

export const tools = {
  show_services({ service } = {}) {
    const s = find(C.services, service);
    if (!s) {
      return show("services", null, "focus", "all services",
        "The services are on screen. Name two or three that fit the caller, not the whole list, then ask what they need it for.");
    }
    return show("services", `service-${s.key}`, "spotlight", s.title,
      `"${s.title}" is spotlighted on screen. Explain it in one or two sentences, then ask if it's for a home or a business.`);
  },

  show_prices({ item } = {}) {
    const p = find(C.prices, item);
    if (!p) {
      return show("prices", null, "focus", "price list",
        "The price list is on screen. Give at most two prices that fit the question and say final prices come after a site visit.");
    }
    return show("prices", `price-${p.key}`, "highlight", `${p.title}: ${p.price} JD`,
      `The price row is highlighted on screen. Say the price once (about ${p.price} dinars), add that it's approximate until the site visit, and mention installments are available.`);
  },

  show_payment_options({ topic } = {}) {
    const t = find(C.payment, topic);
    return show("payment", t ? `pay-${t.key}` : null, t ? "highlight" : "focus", t ? t.title : "payment options",
      t
        ? `"${t.title}" is highlighted on screen. Answer only that point in one sentence.`
        : "Payment options are on screen. Mention 36 months with no interest and the 20% down payment; skip the rest unless asked.");
  },

  show_warranty({ part } = {}) {
    const w = find(C.warranty, part);
    if (!w) {
      return show("warranty", null, "focus", "all warranties",
        "All warranties are on screen. Mention panels 25 years and inverter 10 years; the rest only if asked.");
    }
    return show("warranty", `warranty-${w.key}`, "highlight", w.title,
      `The ${w.title} warranty is highlighted. State its length (${w.years} ${w.unit}) in one sentence.`);
  },

  show_installation_steps() {
    return show("process", null, "focus", "how we work",
      "The four steps are on screen. Say homes take 2 to 4 days to install and the company handles the electricity connection; don't read every step.");
  },

  show_current_offers({ offer } = {}) {
    const o = find(C.offers, offer);
    return show("offers", o ? `offer-${o.key}` : null, o ? "spotlight" : "focus", o ? o.title : "offers",
      o
        ? `"${o.title}" is spotlighted. Say it in one sentence.`
        : "Offers are on screen. Mention the single most relevant offer; the others only if asked.");
  },

  show_branches({ branch } = {}) {
    const b = find(C.branches, branch);
    if (!b) {
      return show("branches", null, "focus", "all branches",
        "Branches are on screen. Name the three cities and ask which is closest; don't read addresses yet.");
    }
    return show("branches", `branch-${b.key}`, "spotlight", b.title,
      `${b.title} is spotlighted. Give its address and hours in one or two sentences.`);
  },

  show_contact_info() {
    return show("contact", "contact-phone", "highlight", "contact details",
      "Contact details are on screen. Say the phone number once, slowly, and mention WhatsApp is also on screen.");
  },

  show_common_answer({ topic } = {}) {
    const f = find(C.faq, topic);
    if (!f) {
      return show("faq", null, "focus", "common questions",
        "Common questions are on screen. Ask which one they mean.");
    }
    setState((s) => ({ openFaq: { ...s.openFaq, [f.key]: true } }));
    return show("faq", `faq-${f.key}`, "highlight", f.q,
      "The answer is open on screen. Summarise it in one sentence.");
  },

  show_about_company() {
    return show("about", null, "focus", "about the company",
      "About the company is on screen. Two sentences: founded 2015 in Amman, over 3,000 home systems installed.");
  },

  go_to_home() {
    return show("home", null, "focus", "home",
      "The caller is back at the top. Ask briefly what they'd like to know.");
  },

  // Changes state: make sure the caller is looking at the form first, even if they were elsewhere.
  book_site_visit({ name = "", city = "", system_type = "", phone = "" } = {}) {
    ensureScreen("contact");
    const prev = getState().visit;
    setState({
      visit: {
        ...prev,
        name: name || prev.name,
        city: city || prev.city,
        system_type: system_type || prev.system_type,
        phone: phone || prev.phone,
        filledByBot: true,
        sent: false,
      },
    });
    showOnScreen({ section: "contact", item: "visit-form", mode: "spotlight" });
    const missing = [];
    if (!(name || prev.name)) missing.push("name");
    if (!(city || prev.city)) missing.push("city");
    return {
      ok: true,
      shown: "site visit form, filled in",
      hint: missing.length
        ? `The form is on screen but ${missing.join(" and ")} is missing. Ask for it, then call book_site_visit again.`
        : "The filled form is on screen. Ask the caller to check it and press the confirm button themselves; don't say it's booked until they do.",
    };
  },
};

export function runTool(name, args) {
  const fn = tools[name];
  if (!fn) {
    return { ok: false, hint: "That screen isn't available. Answer by voice only." };
  }
  try {
    return fn(args || {});
  } catch (e) {
    console.error("[tools]", name, e);
    return { ok: false, hint: "The screen didn't update. Answer by voice only, without mentioning the screen." };
  }
}
