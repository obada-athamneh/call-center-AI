// Al Hayat website + voice assistant.
// Build: see web/README.md (esbuild bundles this into ui/app.js).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import * as C from "./content.js";
import { registerNavigator } from "./nav.js";
import { getState, setState, useStore } from "./store.js";
import { showOnScreen } from "./screen.js";
import { endCall, startCall, toggleMic } from "./call.js";
import { runTool } from "./tools.js";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scrollBehavior = () => (prefersReducedMotion() ? "auto" : "smooth");

// ---------------------------------------------------------------- router
const RouterContext = createContext(null);

function Router({ children }) {
  const [loc, setLoc] = useState(() => ({ path: location.pathname, hash: location.hash }));

  // Client-side only: pushState, never a page load (that would end the call).
  const navigate = useCallback((href, { replace = false } = {}) => {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) {
      window.open(url.href, "_blank", "noopener");
      return;
    }
    const next = url.pathname + url.search + url.hash;
    if (replace) history.replaceState(null, "", next);
    else history.pushState(null, "", next);
    setLoc({ path: url.pathname, hash: url.hash });
  }, []);

  useEffect(() => {
    const onPop = () => setLoc({ path: location.pathname, hash: location.hash });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Arriving with an anchor (first load, back button, or a tool that navigated): show that section.
  useEffect(() => {
    const id = decodeURIComponent(loc.hash.replace(/^#/, ""));
    if (id && document.getElementById(id) && getState().focusSectionId !== id) {
      setState((s) => ({ focusSectionId: id, highlightId: null, spotlightId: null, screenTick: s.screenTick + 1 }));
    }
  }, [loc]);

  return <RouterContext.Provider value={{ loc, navigate }}>{children}</RouterContext.Provider>;
}

// Empty client component in the layout: hands the router's navigate to the nav bridge.
function NavigatorRegistrar() {
  const { navigate } = useContext(RouterContext);
  useEffect(() => registerNavigator(navigate), [navigate]);
  return null;
}

// ---------------------------------------------------------------- screen targets
function useSectionFocus(id) {
  const ref = useRef(null);
  const s = useStore();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const st = getState();
    if (st.focusSectionId !== id) return;
    if (!st.highlightId && !st.spotlightId) {
      ref.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2400);
    return () => clearTimeout(t);
  }, [s.screenTick, id]);

  return { ref, pulse, hasSpotlight: !!s.spotlightId && s.focusSectionId === id };
}

function useItemTarget(id) {
  const ref = useRef(null);
  const s = useStore();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const st = getState();
    if (st.highlightId !== id && st.spotlightId !== id) return;
    ref.current?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    if (st.highlightId === id) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 4200);
      return () => clearTimeout(t);
    }
  }, [s.screenTick, id]);

  return { ref, highlighted: flash, spotlit: s.spotlightId === id };
}

function Section({ id, title, lead, children, className = "" }) {
  const { ref, pulse, hasSpotlight } = useSectionFocus(id);
  return (
    <section
      id={id}
      ref={ref}
      className={`section ${className} ${pulse ? "is-focused" : ""} ${hasSpotlight ? "has-spotlight" : ""}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Target({ id, as: Tag = "div", className = "", children, ...rest }) {
  const { ref, highlighted, spotlit } = useItemTarget(id);
  return (
    <Tag
      id={id}
      ref={ref}
      className={`target ${className} ${highlighted ? "is-highlighted" : ""} ${spotlit ? "is-spotlit" : ""}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------- icons
const ICONS = {
  home: "M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6",
  factory: "M3 20V10l6 4V10l6 4V6h6v14zM3 20h18",
  drop: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z",
  heater: "M6 3h12v14H6zM9 21h6M9 7h6M9 11h6",
  battery: "M4 8h14v8H4zM20 11v2M7 11h5",
  plug: "M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4",
  brush: "M14 4l6 6-8 8H6v-6zM4 20l2-2",
  clipboard: "M8 4h8v3H8zM6 6H5v15h14V6h-1M8 12h8M8 16h5",
};
function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function SunMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="20" r="8" fill="var(--sun)" />
      <g stroke="var(--sun)" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="4" x2="18" y2="8" /><line x1="6" y1="10" x2="9" y2="13" />
        <line x1="30" y1="10" x2="27" y2="13" /><line x1="2" y1="22" x2="6" y2="22" />
        <line x1="30" y1="22" x2="34" y2="22" />
      </g>
      <rect x="0" y="28" width="36" height="8" fill="var(--bg)" />
      <line x1="0" y1="28" x2="36" y2="28" stroke="var(--panel)" strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------- layout pieces
function goSection(e, id) {
  e.preventDefault();
  showOnScreen({ section: id });
}

function Header() {
  const active = useStore().call.active;
  return (
    <header className="site-header">
      <a className="brand" href="#home" onClick={(e) => goSection(e, "home")}>
        <SunMark />
        <span>
          <strong>الحياة للطاقة المتجددة</strong>
          <small>Al Hayat Renewable Energy</small>
        </span>
      </a>
      <nav aria-label="أقسام الموقع">
        {C.sectionsNav.map((n) => (
          <a key={n.id} href={`#${n.id}`} onClick={(e) => goSection(e, n.id)}>{n.label}</a>
        ))}
      </nav>
      {!active && (
        <button type="button" className="btn btn-sun header-call" onClick={startCall}>احكي مع المساعد</button>
      )}
    </header>
  );
}

function Hero() {
  const { ref, pulse } = useSectionFocus("home");
  const active = useStore().call.active;
  return (
    <section id="home" ref={ref} className={`hero ${pulse ? "is-focused" : ""} ${active ? "is-live" : ""}`}>
      <div className="hero-sky" aria-hidden="true">
        <div className="hero-sun"><div className="hero-corona" /></div>
      </div>
      <div className="hero-ground" aria-hidden="true" />
      <div className="hero-copy">
        <h1>طاقة الشمس لبيتك، ومساعد بيرد عليك بالصوت</h1>
        <p>اسأل عن الأسعار، التقسيط، الكفالة أو أقرب فرع. المساعد بيحكي معك وبيوريك الجواب على الصفحة.</p>
        <div className="hero-actions">
          {!active
            ? <button type="button" className="btn btn-sun" onClick={startCall}>ابدأ المكالمة</button>
            : <span className="live-pill">المكالمة شغالة، احكي</span>}
          <a className="btn btn-ghost" href="#prices" onClick={(e) => goSection(e, "prices")}>شوف الأسعار</a>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <Section id="about" title="من نحن" lead={C.about.text}>
      <p className="mission">{C.about.mission}</p>
      <dl className="stats">
        {C.about.stats.map((st) => (
          <div key={st.label}><dt>{st.label}</dt><dd>{st.value}</dd></div>
        ))}
      </dl>
    </Section>
  );
}

function Services() {
  return (
    <Section id="services" title="خدماتنا" lead="من سطح البيت لمزرعة كاملة، بنصمّم ونركّب ونتابع.">
      <ul className="grid services">
        {C.services.map((sv) => (
          <Target as="li" key={sv.key} id={`service-${sv.key}`} className="card">
            <span className="card-icon"><Icon name={sv.icon} /></span>
            <h3>{sv.title}</h3>
            <p>{sv.text}</p>
          </Target>
        ))}
      </ul>
    </Section>
  );
}

function Prices() {
  return (
    <Section id="prices" title="الأسعار" lead="بالدينار الأردني.">
      <ul className="price-list">
        {C.prices.map((p) => (
          <Target as="li" key={p.key} id={`price-${p.key}`} className="price-row">
            <span>{p.title}</span>
            <span className="price"><b>{p.price}</b> دينار تقريباً</span>
          </Target>
        ))}
      </ul>
      <p className="note">{C.pricesNote}</p>
    </Section>
  );
}

function Payment() {
  return (
    <Section id="payment" title="الدفع والتقسيط">
      <ul className="grid three">
        {C.payment.map((p) => (
          <Target as="li" key={p.key} id={`pay-${p.key}`} className="card flat">
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </Target>
        ))}
      </ul>
    </Section>
  );
}

function Warranty() {
  return (
    <Section id="warranty" title="الكفالة">
      <ul className="warranty-list">
        {C.warranty.map((w) => (
          <Target as="li" key={w.key} id={`warranty-${w.key}`} className="warranty">
            <span className="years"><b>{w.years}</b> {w.unit}</span>
            <span><strong>{w.title}</strong><small>{w.text}</small></span>
          </Target>
        ))}
      </ul>
    </Section>
  );
}

function Process() {
  return (
    <Section id="process" title="كيف نشتغل" lead="أربع خطوات من أول اتصال لأول كيلوواط.">
      <ol className="steps">
        {C.processSteps.map((st, i) => (
          <li key={st.title} className="step">
            <span className="step-num" aria-hidden="true">{i + 1}</span>
            <h3>{st.title}</h3>
            <p>{st.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Offers() {
  return (
    <Section id="offers" title="العروض الحالية" className="offers-section">
      <ul className="grid three">
        {C.offers.map((o) => (
          <Target as="li" key={o.key} id={`offer-${o.key}`} className="offer">
            <strong>{o.title}</strong>
            <span>{o.text}</span>
          </Target>
        ))}
      </ul>
    </Section>
  );
}

function Branches() {
  return (
    <Section id="branches" title="الفروع وأوقات الدوام" lead={C.hoursNote}>
      <ul className="grid three">
        {C.branches.map((b) => (
          <Target as="li" key={b.key} id={`branch-${b.key}`} className="card flat branch">
            <h3>{b.title}</h3>
            <p>{b.address}</p>
            <p className="hours">{b.hours}</p>
          </Target>
        ))}
      </ul>
    </Section>
  );
}

function VisitForm() {
  const visit = useStore().visit;
  const update = (field) => (e) =>
    setState((s) => ({ visit: { ...s.visit, [field]: e.target.value, sent: false } }));
  const submit = (e) => {
    e.preventDefault();
    setState((s) => ({ visit: { ...s.visit, sent: true } }));
  };
  return (
    <Target as="form" id="visit-form" className="visit-form" onSubmit={submit}>
      <h3>اطلب زيارة ودراسة مجانية</h3>
      {visit.filledByBot && !visit.sent && <p className="bot-filled">المساعد عبّى الطلب. راجعه واضغط تأكيد.</p>}
      <label>الاسم<input value={visit.name} onChange={update("name")} required autoComplete="name" /></label>
      <label>المدينة أو المنطقة<input value={visit.city} onChange={update("city")} required /></label>
      <label>النظام لـ
        <select value={visit.system_type} onChange={update("system_type")}>
          <option value="">اختار</option>
          <option value="home">بيت</option>
          <option value="business">شركة أو مصنع</option>
          <option value="farm">مزرعة</option>
          <option value="not_sure">مش متأكد</option>
        </select>
      </label>
      <label>رقم الهاتف<input value={visit.phone} onChange={update("phone")} inputMode="tel" autoComplete="tel" /></label>
      <button type="submit" className="btn btn-sun">تأكيد الطلب</button>
      {visit.sent && <p className="sent" role="status">تم تأكيد الطلب. (نسخة تجريبية: الطلب ما بينبعت لأي مكان.)</p>}
    </Target>
  );
}

function Contact() {
  return (
    <Section id="contact" title="تواصل معنا">
      <div className="contact-grid">
        <ul className="contact-list">
          <Target as="li" id="contact-phone"><span>الهاتف</span><b dir="ltr">{C.contact.phone}</b></Target>
          <li><span>واتساب</span><b dir="ltr">{C.contact.whatsapp}</b></li>
          <li><span>الإيميل</span><b dir="ltr">{C.contact.email}</b></li>
        </ul>
        <VisitForm />
      </div>
    </Section>
  );
}

function Faq() {
  const openFaq = useStore().openFaq;
  const toggle = (key) => setState((s) => ({ openFaq: { ...s.openFaq, [key]: !s.openFaq[key] } }));
  return (
    <Section id="faq" title="أسئلة شائعة">
      <ul className="faq">
        {C.faq.map((f) => {
          const open = !!openFaq[f.key];
          return (
            <Target as="li" key={f.key} id={`faq-${f.key}`} className={`faq-item ${open ? "open" : ""}`}>
              <button type="button" aria-expanded={open} aria-controls={`faq-a-${f.key}`} onClick={() => toggle(f.key)}>
                <span>{f.q}</span><span className="faq-sign" aria-hidden="true">{open ? "−" : "+"}</span>
              </button>
              <div id={`faq-a-${f.key}`} hidden={!open}><p>{f.a}</p></div>
            </Target>
          );
        })}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------- call bar
const STATUS = {
  idle: "المساعد جاهز",
  connecting: "جاري الاتصال…",
  ready: "بسمعك، احكي",
  user: "بسمعك…",
  bot: "المساعد بيحكي",
  error: "في مشكلة",
};

function CallBar() {
  const { call, transcript, notice } = useStore();
  const [open, setOpen] = useState(false);
  const logRef = useRef(null);
  const last = transcript[transcript.length - 1];

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, transcript]);

  return (
    <aside className={`callbar ${call.active ? "is-active" : ""} ${open ? "is-open" : ""}`} aria-label="المكالمة مع المساعد">
      {open && (
        <div className="callbar-log" ref={logRef} aria-live="polite">
          {transcript.length === 0 && <p className="muted">المحادثة رح تظهر هون.</p>}
          {transcript.map((l) => (
            <p key={l.id} className={`line ${l.who} ${l.final ? "" : "interim"}`}>
              <span className="who">{l.who === "bot" ? "المساعد" : "انت"}</span>{l.text}
            </p>
          ))}
        </div>
      )}
      {notice && <p className="callbar-notice" role="alert">{notice}</p>}
      <div className="callbar-row">
        <span className="mini-sun" aria-hidden="true"><span /></span>
        <div className="callbar-text">
          <span className="status" role="status">{STATUS[call.status] || STATUS.idle}</span>
          <span className="caption">{last ? last.text : "اضغط ابدأ واسأل عن أي إشي"}</span>
        </div>
        <button type="button" className="icon-btn" aria-expanded={open} aria-label={open ? "سكّر المحادثة" : "افتح المحادثة"} onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d={open ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
          </svg>
        </button>
        {call.active && (
          <button type="button" className={`icon-btn ${call.micMuted ? "muted" : ""}`} aria-pressed={call.micMuted} aria-label={call.micMuted ? "شغّل المايكروفون" : "كتم المايكروفون"} onClick={toggleMic}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              {call.micMuted && <line x1="4" y1="4" x2="20" y2="20" />}
            </svg>
          </button>
        )}
        {call.active
          ? <button type="button" className="btn btn-end" onClick={endCall}>إنهاء</button>
          : <button type="button" className="btn btn-sun" disabled={call.status === "connecting"} onClick={startCall}>ابدأ المكالمة</button>}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- app
function Layout() {
  return (
    <>
      <NavigatorRegistrar />
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Prices />
        <Payment />
        <Warranty />
        <Process />
        <Offers />
        <Branches />
        <Faq />
        <Contact />
      </main>
      <footer className="site-footer">
        <p>شركة الحياة للطاقة المتجددة شركة وهمية، والمحتوى لأغراض تعليمية.</p>
      </footer>
      <CallBar />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <Router>
    <Layout />
  </Router>
);

// For testing from the browser console: window.__hayat.runTool("show_prices", { item: "home_5kw" })
window.__hayat = { runTool, getState };
