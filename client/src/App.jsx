/* ==========================================================================
   Web Zdeňka Vacka – celá aplikace v jednom souboru (React 18 + React Router)
   Obsah:  1) pomocné funkce   2) ikony a základní prvky   3) rozvržení
           4) stránky          5) administrace             6) kořen aplikace
   ========================================================================== */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/* ==========================================================================
   1) POMOCNÉ FUNKCE
   ========================================================================== */
async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'zdvac', ...(opts.headers || {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* prázdná odpověď */ }
  if (!res.ok) throw new Error((data && data.error) || 'Něco se nepovedlo, zkuste to prosím znovu.');
  return data;
}
const photo = (p) => (p ? (/^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : `/photos/${p}`) : '');
const webpPhoto = (p) => {
  const original = photo(p);
  return original && !/^(https?:)?\/\//.test(p) && /^\/photos\//.test(original) && /\.(jpe?g|png)$/i.test(original)
    ? `${original}.webp` : '';
};
const stripDia = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const daysUntil = (iso) => Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
const fmtDate = (iso, opts) => new Date(iso + 'T12:00:00').toLocaleDateString('cs-CZ', opts || { day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (t) => { const [h, m] = String(t || '17:00').split(':'); return `${pad2(h)}:${pad2(m || 0)}`; };
const phoneHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const paras = (t) => String(t || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
const hueOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const hasPrivacyOptOut = () => {
  if (typeof navigator === 'undefined') return false;
  return navigator.globalPrivacyControl === true ||
    ['1', 'yes'].includes(String(navigator.doNotTrack || (typeof window !== 'undefined' && window.doNotTrack) || navigator.msDoNotTrack || '').toLowerCase());
};

const PAGE_DESCRIPTIONS = {
  '': 'Cestovatelské přednášky pro školy, knihovny i veřejnost, knihy, film a fotografie. Příběhy Zdeňka Vacka z cest po Severu, Americe a Azorách.',
  Knihy: 'Knihy Zdeňka Vacka o cestách autostopem, setkáních a příbězích z různých koutů světa. Objednejte si výtisk přímo od autora.',
  Přednášky: 'Cestovatelské přednášky pro školy, knihovny a veřejnost. Vyberte si téma a objednejte program od Zdeňka Vacka.',
  'Kalendář přednášek': 'Aktuální termíny cestovatelských přednášek Zdeňka Vacka. Najděte nejbližší besedu a rezervujte si místo.',
  'Film a foto': 'Filmy, fotografie a další tvorba cestovatele a autora Zdeňka Vacka.',
  Hry: 'Hry a interaktivní projekty Zdeňka Vacka pro zábavu i poznávání.',
  'O mně': 'Poznejte cestovatele, autora a přednášejícího Zdeňka Vacka z Plzně a jeho příběhy z cest.',
  Kontakt: 'Kontaktujte Zdeňka Vacka kvůli cestovatelské přednášce, besedě, knize, filmu nebo focení.',
  'Ochrana soukromí': 'Informace o tom, jak web Zdeňka Vacka zpracovává osobní údaje a používá cookies.',
};
function useTitle(title, description) {
  useEffect(() => {
    const pageTitle = title ? `${title} – Zdeněk Vacek` : 'Zdeněk Vacek – cestovatel, autor a vypravěč';
    const pageDescription = description || PAGE_DESCRIPTIONS[title] || `${title} – cestovatelské příběhy, přednášky a tvorba Zdeňka Vacka.`;
    const canonical = `${window.location.origin}${window.location.pathname.replace(/\/$/, '') || '/'}`;
    document.title = pageTitle;
    const setMeta = (selector, attr, value) => {
      const node = document.head.querySelector(selector);
      if (node) node.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', pageDescription);
    setMeta('meta[property="og:title"]', 'content', pageTitle);
    setMeta('meta[property="og:description"]', 'content', pageDescription);
    setMeta('meta[name="twitter:title"]', 'content', pageTitle);
    setMeta('meta[name="twitter:description"]', 'content', pageDescription);
    setMeta('link[rel="canonical"]', 'href', canonical);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:image"]', 'content', `${window.location.origin}/photos/portrait/tojsemja.jpg`);
    setMeta('meta[name="twitter:image"]', 'content', `${window.location.origin}/photos/portrait/tojsemja.jpg`);
    setMeta('meta[name="robots"]', 'content', title === 'Správa webu' || title.endsWith('nenalezena') ? 'noindex, nofollow' : 'index, follow');
  }, [title, description]);
}

const ContentCtx = createContext(null);
const useContent = () => useContext(ContentCtx);
const InquiryCtx = createContext(() => {});
const useInquiry = () => useContext(InquiryCtx);

function useLectures() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    api('/api/lectures').then((d) => live && setRows(d)).catch(() => live && setRows([]));
    return () => { live = false; };
  }, []);
  return rows;
}

/* ==========================================================================
   2) IKONY A ZÁKLADNÍ PRVKY
   ========================================================================== */
const ICONS = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h10',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M5.6 18.4L7 17m10-10l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4.2-4.2',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  fb: 'M14 8h3V4h-3a4 4 0 00-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5a.5.5 0 01.5-.5z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  clock: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v4.5l3 1.8',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  book: 'M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM6 11a6 6 0 0012 0M12 17v4',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
  game: 'M7 8h10a4 4 0 014 4v2a3 3 0 01-5.2 2L14.5 15h-5l-1.3 1A3 3 0 013 14v-2a4 4 0 014-4zM8 11v3M6.5 12.5h3M16 12h.01M18 13.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  zoom: 'M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4.2-4.2M8.5 11h5M11 8.5v5',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
  out: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
};
function Icon({ n, size }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={size ? { width: size, height: size } : undefined}>
      <path d={ICONS[n]} />
    </svg>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--forest)" />
      <path d="M32 8l20 11.5v23L32 54 12 42.5v-23z" fill="none" stroke="var(--honey)" strokeWidth="3" />
      <path d="M22 23h20L22 41h20" fill="none" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* obrázek s elegantní náhradou, dokud fotka není nahraná */
function Img({ src, alt = '', seed = '', eager = false, className = '', ...rest }) {
  const [bad, setBad] = useState(!src);
  const [useWebp, setUseWebp] = useState(true);
  useEffect(() => { setBad(!src); setUseWebp(true); }, [src]);
  if (bad) {
    const h = hueOf(seed || alt || src || 'x');
    return (
      <div className={`img ph-fallback ${className}`} role="img" aria-label={alt}
        style={{ background: `linear-gradient(135deg, hsl(${h} 38% 30%), hsl(${(h + 55) % 360} 46% 20%))` }}>
        <Icon n="image" />
      </div>
    );
  }
  return (
    <div className={`img ${className}`}>
      <picture>
        {useWebp && webpPhoto(src) && <source srcSet={webpPhoto(src)} type="image/webp" />}
        <img src={photo(src)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
          fetchPriority={eager ? 'high' : undefined}
          onError={() => { if (useWebp && webpPhoto(src)) setUseWebp(false); else setBad(true); }} {...rest} />
      </picture>
    </div>
  );
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ '--d': `${delay}s` }} {...rest}>{children}</Tag>;
}

function Modal({ onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = ref.current && ref.current.querySelector('input, textarea, select, button:not(.x)');
    if (first) first.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (prev && prev.focus) prev.focus({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <button className="icon-btn x" onClick={onClose} aria-label="Zavřít"><Icon n="close" /></button>
        {children}
      </div>
    </div>
  );
}

/* ---------- formulář poptávky / objednávky ---------- */
const KIND_TITLE = {
  kniha: 'Objednat knihu', film: 'Poptat film nebo střih', foto: 'Poptat focení', prednaska: 'Objednat přednášku',
  rezervace: 'Zarezervovat místo', kontakt: 'Napsat zprávu',
};
function InquiryForm({ kind, subject, withDate = false }) {
  const { content } = useContent();
  const phone = content.settings.phone;
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '', preferred_date: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const t0 = useRef(Date.now());
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api('/api/inquiries', { method: 'POST', body: { ...f, kind, subject, t: Date.now() - t0.current } });
      setDone(true);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  if (done) {
    return (
      <div className="okbox" role="status">
        <b>Děkuji, zpráva je na cestě!</b>
        Ozvu se vám co nejdříve. Kdyby to spěchalo, zavolejte na <a href={phoneHref(phone)}>{phone}</a>.
      </div>
    );
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="f-name">Jméno a příjmení *</label>
        <input id="f-name" required autoComplete="name" value={f.name} onChange={set('name')} /></div>
      <div className="row2">
        <div className="field"><label htmlFor="f-mail">E-mail</label>
          <input id="f-mail" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="f-tel">Telefon</label>
          <input id="f-tel" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></div>
      </div>
      {withDate && (
        <div className="field"><label htmlFor="f-date">Preferovaný termín (nepovinné)</label>
          <input id="f-date" value={f.preferred_date} onChange={set('preferred_date')} placeholder="např. jaro 2027, nebo konkrétní datum" /></div>
      )}
      <div className="field"><label htmlFor="f-msg">Zpráva</label>
        <textarea id="f-msg" value={f.message} onChange={set('message')} placeholder={kind === 'kniha' ? 'Počet kusů, adresa doručení, případné přání…' : 'Kam, pro koho, kolik posluchačů…'} /></div>
      <div className="hp" aria-hidden="true"><label>Web <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>
      <p className="note">Vyplňte prosím e-mail nebo telefon. Údaje použiji jen k vyřízení vaší zprávy a po vyřízení je nejdéle do tří měsíců smažu. <Link to="/soukromi">Více o soukromí</Link>.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn honey" disabled={busy}>{busy ? 'Odesílám…' : 'Odeslat'} <Icon n="arrow" /></button>
    </form>
  );
}

/* ---------- vrstevnicové pozadí (canvas) ---------- */
function ContourField() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    let raf = 0, last = 0, visible = true, w = 0, h = 0, cols = 0, rows = 0, cw = 0, ch = 0, field = null;
    const mouse = { x: -9, y: -9, tx: -9, ty: -9 };
    const CELL = 15, LEVELS = 13;
    let colors = { soft: 'rgba(31,61,54,.2)', strong: 'rgba(196,81,47,.45)' };
    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      colors = { soft: s.getPropertyValue('--contour').trim() || colors.soft, strong: s.getPropertyValue('--contour-strong').trim() || colors.strong };
    };
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = r.width; h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL) + 1; rows = Math.ceil(h / CELL) + 1;
      cw = w / (cols - 1); ch = h / (rows - 1);
      field = new Float32Array(cols * rows);
      readColors();
    };
    const sample = (t) => {
      const sx = 5.2 / cols, sy = 3.1 / rows;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * sx, y = j * sy;
          let v = Math.sin(x * 1.25 + t * 0.22) * Math.cos(y * 1.15 - t * 0.17)
            + 0.55 * Math.sin((x + y) * 0.95 + t * 0.11)
            + 0.35 * Math.sin(x * 2.6 - y * 2.2 + t * 0.07);
          const dx = i / cols - mouse.x, dy = (j / rows - mouse.y) * (h / w);
          v += 1.4 * Math.exp(-(dx * dx + dy * dy) / 0.012);
          field[j * cols + i] = v;
        }
      }
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      for (let L = 0; L < LEVELS; L++) {
        const level = -1.75 + L * 0.3;
        const strong = L % 4 === 0;
        ctx.strokeStyle = strong ? colors.strong : colors.soft;
        ctx.lineWidth = strong ? 1.6 : 1;
        ctx.beginPath();
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = field[j * cols + i], b = field[j * cols + i + 1], c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
            const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x0 = i * cw, y0 = j * ch;
            const tx = x0 + ((level - a) / (b - a)) * cw, ty = y0;
            const rx = x0 + cw, ry = y0 + ((level - b) / (c - b)) * ch;
            const bx = x0 + ((level - d) / (c - d)) * cw, by = y0 + ch;
            const lx = x0, ly = y0 + ((level - a) / (d - a)) * ch;
            const seg = (px, py, qx, qy) => { ctx.moveTo(px, py); ctx.lineTo(qx, qy); };
            switch (idx) {
              case 1: case 14: seg(lx, ly, bx, by); break;
              case 2: case 13: seg(bx, by, rx, ry); break;
              case 3: case 12: seg(lx, ly, rx, ry); break;
              case 4: case 11: seg(tx, ty, rx, ry); break;
              case 5: seg(lx, ly, tx, ty); seg(bx, by, rx, ry); break;
              case 6: case 9: seg(tx, ty, bx, by); break;
              case 7: case 8: seg(lx, ly, tx, ty); break;
              case 10: seg(tx, ty, rx, ry); seg(lx, ly, bx, by); break;
              default: break;
            }
          }
        }
        ctx.stroke();
      }
    };
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 40) return;
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
      sample(now / 1000); draw();
    };
    const onMove = (e) => {
      const r = cv.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height;
    };
    resize();
    sample(3); draw();
    const ro = new ResizeObserver(() => { resize(); sample(3); draw(); });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(cv);
    const mo = new MutationObserver(() => { readColors(); sample(3); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduced) {
      raf = requestAnimationFrame(frame);
      window.addEventListener('pointermove', onMove, { passive: true });
    }
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduced]);
  return <canvas ref={ref} aria-hidden="true" />;
}

/* ---------- psací stroj v úvodu ---------- */
const WORDS = [
  { t: 'knihy o dobrodružných cestách', to: '/knihy' },
  { t: 'super zábavné přednášky', to: '/prednasky' },
  { t: 'hru, která se tu někde skrývá', to: '/hry' },
  { t: 'skvělý film, který ti nastříhám', to: '/film-foto' },
];
function Typewriter() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [n, setN] = useState(reduced ? WORDS[0].t.length : 0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (reduced) return undefined;
    const w = WORDS[i].t;
    let t;
    if (!del && n < w.length) t = setTimeout(() => setN(n + 1), 70);
    else if (!del) t = setTimeout(() => setDel(true), 1700);
    else if (n > 0) t = setTimeout(() => setN(n - 1), 30);
    else { setDel(false); setI((i + 1) % WORDS.length); }
    return () => clearTimeout(t);
  }, [n, del, i, reduced]);
  const w = WORDS[i];
  return <Link to={w.to} tabIndex={-1} aria-hidden="true">{w.t.slice(0, n)}<span className="caret" /></Link>;
}

/* ---------- mapa cest (abstraktní, bez mapových podkladů) ---------- */
const PX = (lon) => (lon + 135) * 5.556;
const PY = (lat) => (75 - lat) * 5.556 + 24;
const HOME = { name: 'Plzeň', lat: 49.75, lon: 13.38, to: '/kontakt' };
const TRIPS = [
  { name: 'Za polárním kruhem', lat: 69.6, lon: 20.5, to: '/prednasky/zeme-pulnocniho-slunce', dx: -10, dy: -14, anchor: 'end' },
  { name: 'Dakota a Kalifornie', lat: 42.5, lon: -112.5, to: '/prednasky/krajinou-mych-snu', dx: 14, dy: 22, anchor: 'start' },
  { name: 'Azory', lat: 38.6, lon: -28.4, to: '/prednasky/azorske-ostrovy', dx: 0, dy: 28, anchor: 'middle' },
];
function RouteMap() {
  const nav = useNavigate();
  const hx = PX(HOME.lon), hy = PY(HOME.lat);
  const arcs = TRIPS.map((t) => {
    const x = PX(t.lon), y = PY(t.lat);
    const mx = (hx + x) / 2, my = Math.min(hy, y) - Math.abs(hx - x) * 0.28 - 20;
    return `M${hx},${hy} Q${mx},${my} ${x},${y}`;
  });
  const grat = [];
  for (let lon = -135; lon <= 45; lon += 15) grat.push(`M${PX(lon)},0 V${PY(25)}`);
  for (let lat = 30; lat <= 75; lat += 15) grat.push(`M0,${PY(lat)} H1000`);
  return (
    <div className="mapbox">
      <svg viewBox="0 0 1000 300" role="img" aria-label="Schematická mapa cest: Plzeň, polární kruh, Dakota a Kalifornie, Azory">
        <path className="grat" d={grat.join(' ')} />
        <text className="land-label" x="40" y="70">SEVERNÍ AMERIKA</text>
        <text className="land-label" x="560" y="270">ATLANTIK</text>
        <text className="land-label" x="720" y="120">EVROPA</text>
        {arcs.map((d, i) => <path key={i} className="route" d={d} style={{ animationDelay: `${i * -4}s` }} />)}
        {TRIPS.map((t) => (
          <g className="pin" key={t.name} transform={`translate(${PX(t.lon)} ${PY(t.lat)})`}>
            <a href={t.to} onClick={(e) => { e.preventDefault(); nav(t.to); }}>
              <circle className="pulse" r="6" /><circle className="dot" r="6" />
              <text x={t.dx} y={t.dy} textAnchor={t.anchor}>{t.name}</text>
            </a>
          </g>
        ))}
        <g className="pin home" transform={`translate(${hx} ${hy})`}>
          <circle className="pulse" r="6" /><circle className="dot" r="6" />
          <text x="-10" y="26" textAnchor="end">{HOME.name} – domov</text>
        </g>
      </svg>
      <div className="legend">
        {TRIPS.map((t) => <Link key={t.name} to={t.to}>{t.name}</Link>)}
      </div>
    </div>
  );
}

/* ==========================================================================
   3) ROZVRŽENÍ: hlavička, menu, hledání, patička, souhlas s cookies
   ========================================================================== */
const NAV = [
  { to: '/knihy', label: 'Knihy', sub: 'cestopisy' },
  { to: '/prednasky', label: 'Přednášky', sub: 'školy a knihovny' },
  { to: '/kalendar', label: 'Kalendář', sub: 'termíny' },
  { to: '/film-foto', label: 'Film & Foto', sub: 'natáčení a střih' },
  { to: '/hry', label: 'Hry', sub: 'zábava' },
  { to: '/o-mne', label: 'O mně', sub: '' },
  { to: '/kontakt', label: 'Kontakt', sub: '' },
];

function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('zv_theme', next); } catch (_) { /* soukromý režim */ }
    setTheme(next);
  };
  return (
    <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}>
      <Icon n={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

function Header({ onSearch }) {
  const { content } = useContent();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hide, setHide] = useState(false);
  const lastY = useRef(0);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (y > 260 && y - lastY.current > 8) setHide(true);
      else if (y - lastY.current < -8 || y < 260) setHide(false);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const { settings } = content;
  return (
    <>
      <header className={`header ${scrolled ? 'scrolled' : ''} ${hide && !open ? 'hide' : ''}`}>
        <div className="wrap row">
          <Link to="/" className="brand" aria-label={`${settings.site_name} – úvod`}><Logo /><span>{settings.site_name}</span></Link>
          <nav className="nav" aria-label="Hlavní navigace">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>)}
          </nav>
          <div className="tools">
            <button className="search-btn" onClick={onSearch} aria-label="Hledat na webu"><Icon n="search" /> Hledat <span className="kbd">Ctrl K</span></button>
            <button className="icon-btn" onClick={onSearch} aria-label="Hledat na webu" id="search-icon"><Icon n="search" /></button>
            <ThemeToggle />
            <button className="icon-btn burger" onClick={() => setOpen(true)} aria-label="Otevřít menu" aria-expanded={open}><Icon n="menu" /></button>
          </div>
        </div>
      </header>
      {open && (
        <div className="menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="top">
            <Link to="/" className="brand"><Logo /><span>{settings.site_name}</span></Link>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Zavřít menu"><Icon n="close" /></button>
          </div>
          <nav aria-label="Mobilní navigace">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}<small>{n.sub}</small></NavLink>)}
          </nav>
          <div className="actions">
            <a className="btn honey" href={phoneHref(settings.phone)}><Icon n="phone" /> Zavolat {settings.phone}</a>
            <a className="btn ghost" href={`mailto:${settings.email}`}><Icon n="mail" /> {settings.email}</a>
          </div>
        </div>
      )}
    </>
  );
}

function NoticeBar() {
  const { content } = useContent();
  const { notice_text: text, notice_link: link } = content.settings;
  const [gone, setGone] = useState(() => { try { return sessionStorage.getItem('zv_notice') === text; } catch (_) { return false; } });
  if (!text || gone) return null;
  const body = link ? (link.startsWith('/') ? <Link to={link}>{text}</Link> : <a href={link}>{text}</a>) : text;
  return (
    <div className="notice" role="status">
      {body}
      <button aria-label="Zavřít oznámení" onClick={() => { try { sessionStorage.setItem('zv_notice', text); } catch (_) { /* nic */ } setGone(true); }}><Icon n="close" size={16} /></button>
    </div>
  );
}

function SearchPalette({ onClose }) {
  const { content } = useContent();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const index = useMemo(() => [
    ...NAV.map((n) => ({ label: n.label, hint: 'stránka', to: n.to })),
    { label: 'Ochrana soukromí', hint: 'stránka', to: '/soukromi' },
    ...content.programs.map((p) => ({ label: p.title, hint: p.category === 'skoly' ? 'přednáška pro školy' : 'cestopisná přednáška', to: `/prednasky/${p.slug}`, extra: p.summary })),
    ...content.books.map((b) => ({ label: b.title, hint: 'kniha', to: '/knihy', extra: b.tagline })),
    ...content.games.map((g) => ({ label: g.title, hint: 'hra', to: g.url ? `/hry/${g.slug}` : '/hry', extra: g.description })),
  ], [content]);
  const results = useMemo(() => {
    const t = stripDia(q).trim();
    if (!t) return index.slice(0, 8);
    return index.filter((r) => stripDia(`${r.label} ${r.hint} ${r.extra || ''}`).includes(t)).slice(0, 8);
  }, [q, index]);
  useEffect(() => setSel(0), [q]);
  const go = (r) => { onClose(); nav(r.to); };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && results[sel]) go(results[sel]);
  };
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Hledání">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Hledat knihu, přednášku, hru…" aria-label="Hledaný výraz" />
        <ul role="listbox">
          {results.map((r, i) => (
            <li key={r.to + r.label}>
              <button role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
                <b>{r.label}</b><small>{r.hint}</small>
              </button>
            </li>
          ))}
        </ul>
        {!results.length && <div className="none">Nic jsem nenašel. Zkuste třeba „Azory“, „včela“ nebo „kniha“.</div>}
      </div>
    </div>
  );
}

function Footer() {
  const { content } = useContent();
  const s = content.settings;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <p className="big">Pojďme se vydat na cestu.</p>
            <p style={{ opacity: 0.8 }}>{s.tagline}. Plzeň a okolí – za přednáškou rád zajedu i dál.</p>
          </div>
          <div>
            <h4>Web</h4>
            <ul>{NAV.map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}</ul>
          </div>
          <div>
            <h4>Kontakt</h4>
            <ul>
              <li><a href={phoneHref(s.phone)}>{s.phone}</a></li>
              <li><a href={`mailto:${s.email}`}>{s.email}</a></li>
              {s.facebook && <li><a href={s.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
            </ul>
          </div>
          <div>
            <h4>Právní</h4>
            <ul>
              <li><Link to="/soukromi">Ochrana soukromí a cookies</Link></li>
              <li><button className="linklike" style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--honey)' }} onClick={() => window.dispatchEvent(new Event('zv:consent-reset'))}>Nastavení cookies</button></li>
              <li><Link to="/admin">Správa webu</Link></li>
            </ul>
          </div>
        </div>
        <div className="bottom">
          <span>© {new Date().getFullYear()} {s.site_name} &amp; Michal Schneider (web). Všechna práva vyhrazena.</span>
          <span>Fotografie a texty © Zdeněk Vacek</span>
        </div>
      </div>
    </footer>
  );
}

function ConsentBanner({ onChoose }) {
  return (
    <div className="consent" role="dialog" aria-label="Souhlas s cookies">
      <h3>Soukromí na prvním místě</h3>
      <p>Web si pamatuje jen to nejnutnější (např. tmavý režim). S vaším souhlasem měřím anonymní návštěvnost – bez IP adres, bez reklam a bez sledování mezi weby.</p>
      <div className="acts">
        <button className="btn honey small" onClick={() => onChoose('all')}>Přijmout statistiky</button>
        <button className="btn ghost small" onClick={() => onChoose('necessary')}>Jen nezbytné</button>
        <Link className="btn ghost small" to="/soukromi">Podrobnosti</Link>
      </div>
    </div>
  );
}

/* ==========================================================================
   4) STRÁNKY
   ========================================================================== */
function SectionHead({ eyebrow, title, children, action }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

function PageIntro({ eyebrow, title, children }) {
  return (
    <section className="section" style={{ paddingBottom: '1.5rem' }}>
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.6rem)', maxWidth: '16ch' }}>{title}</h1>
        {children && <p className="lead" style={{ marginTop: '1.2rem' }}>{children}</p>}
      </div>
    </section>
  );
}

function DateRow({ l, programs }) {
  const openInquiry = useInquiry();
  const prog = programs.find((p) => p.slug === l.program_slug);
  const diff = daysUntil(l.date);
  const past = diff < 0;
  const d = new Date(l.date + 'T12:00:00');
  const when = diff === 0 ? 'dnes' : diff === 1 ? 'zítra' : diff > 1 ? `za ${diff} ${diff < 5 ? 'dny' : 'dní'}` : 'proběhlo';
  const title = prog ? <Link to={`/prednasky/${prog.slug}`}>{l.name}</Link> : l.link ? <a href={l.link}>{l.name}</a> : l.name;
  return (
    <article className={`date-row ${past ? 'past' : ''}`}>
      <div className="dbox" aria-hidden="true"><b>{d.getDate()}</b><span>{d.toLocaleDateString('cs-CZ', { month: 'short' }).replace('.', '')}</span></div>
      <div>
        <h3>{title}</h3>
        <div className="meta">
          <span><Icon n="cal" />{fmtDate(l.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span><Icon n="clock" />{fmtTime(l.time)}</span>
          {l.place && <span><Icon n="pin" />{l.place}</span>}
        </div>
      </div>
      <div className="acts">
        <span className="chip honey">{when}</span>
        <span className={`chip ${l.available ? 'ok' : 'no'}`}>{l.available ? 'Volno' : 'Obsazeno'}</span>
        {!past && <a className="btn ghost small" href={`/api/lectures/${l.id}/ics`}><Icon n="download" /> Do kalendáře</a>}
        {!past && (
          <button className="btn small honey" disabled={!l.available}
            onClick={() => openInquiry({ kind: 'rezervace', subject: `${l.name} – ${fmtDate(l.date)} ${fmtTime(l.time)}${l.place ? ' – ' + l.place : ''}` })}>
            Zarezervovat
          </button>
        )}
      </div>
    </article>
  );
}

function ProgramCard({ p }) {
  return (
    <Link to={`/prednasky/${p.slug}`} className="card">
      <div className="media"><Img src={p.cover} alt="" seed={p.slug} /></div>
      <div className="body">
        <span className="tag">{p.category === 'skoly' ? 'Pro školy a knihovny' : 'Cestopisná přednáška'}</span>
        <h3>{p.title}</h3>
        <p>{p.summary}</p>
        <div className="chips">
          {p.duration && <span className="chip">{p.duration}</span>}
          {p.status === 'soon' && <span className="chip honey">Již brzy</span>}
        </div>
      </div>
    </Link>
  );
}

/* ---------- úvod ---------- */
function Home() {
  useTitle('');
  const { content } = useContent();
  const { settings: s, programs, testimonials } = content;
  const openInquiry = useInquiry();
  const lectures = useLectures();
  const upcoming = (lectures || []).filter((l) => l.date >= todayISO()).slice(0, 3);
  const next = upcoming.find((l) => l.available) || upcoming[0];
  const about = paras(s.about_text)[0];
  return (
    <>
      <section className="hero">
        <ContourField />
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Cestovatel · autor · vypravěč</span>
            <h1>
              <span className="l1">Užij si</span>
              <span className="l2"><span className="sr">knihy, přednášky, hry i film</span><Typewriter /></span>
            </h1>
            <p className="lead">{s.tagline}. Příběhy z cest autostopem za polárním kruhem, po Americe i po Azorách – v knihách, na fotografiích i naživo před publikem.</p>
            <div className="cta">
              <Link className="btn honey" to="/kalendar"><Icon n="cal" /> Kalendář přednášek</Link>
              <button className="btn ghost" onClick={() => openInquiry({ kind: 'prednaska', subject: 'Přednáška na míru', withDate: true })}>Objednat přednášku</button>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div className="polaroid">
              <div className="ph"><Img src={s.hero_image} alt="Zdeněk Vacek na cestách" seed="hero" eager /></div>
              <div className="cap">{s.site_name}</div>
            </div>
            {next && (
              <Link to="/kalendar" className="next-chip">
                Nejbližší přednáška
                <b>{next.name}</b>
                {fmtDate(next.date, { day: 'numeric', month: 'long' })} · {fmtTime(next.time)}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: '1rem' }}>
        <div className="wrap">
          <SectionHead eyebrow="Co nabízím" title="Tři cesty, jak se vydat dál" />
          <div className="paths">
            {[
              { to: '/knihy', c: '#c4512f', i: 'book', t: 'Knihy', p: 'Autentické příběhy ze všech koutů světa – kniha putuje přímo k vám domů.', g: 'Objednat knihu' },
              { to: '/prednasky', c: '#1f3d36', i: 'mic', t: 'Přednášky', p: 'O přírodě, včelách i dalekých cestách. Pro školy, knihovny a besedy, vždy na míru posluchačům.', g: 'Vybrat přednášku' },
              { to: '/film-foto', c: '#b9780a', i: 'film', t: 'Film & Foto', p: 'Natočím a sestříhám film z vaší akce, reklamu i dovolenou. Včetně barev, zvuku a efektů.', g: 'Poptat film' },
            ].map((x, k) => (
              <Reveal key={x.to} delay={k * 0.1}>
                <Link to={x.to} className="path" style={{ '--c': x.c }}>
                  <span className="ico"><Icon n={x.i} /></span>
                  <h3>{x.t}</h3>
                  <p>{x.p}</p>
                  <span className="go">{x.g} <Icon n="arrow" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow="Kalendář" title="Nejbližší setkání" action={<Link className="btn ghost small" to="/kalendar">Celý kalendář <Icon n="arrow" /></Link>} />
          {upcoming.length ? (
            <div className="dates">{upcoming.map((l) => <DateRow key={l.id} l={l} programs={programs} />)}</div>
          ) : (
            <div className="empty">
              <b>Nové termíny se připravují</b>
              Máte zájem o přednášku u vás ve škole, knihovně nebo klubu? Napište, domluvíme se.
              <div style={{ marginTop: '1rem' }}>
                <button className="btn honey small" onClick={() => openInquiry({ kind: 'prednaska', subject: 'Přednáška na míru', withDate: true })}>Objednat přednášku</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0, overflow: 'hidden' }}>
        <div className="wrap">
          <SectionHead eyebrow="Přednášky" title="Vyprávění s fotografiemi a filmy" action={<Link className="btn ghost small" to="/prednasky">Všechny přednášky <Icon n="arrow" /></Link>} />
        </div>
        <div className="snap" tabIndex={0} aria-label="Nabídka přednášek – posouvejte do stran">
          {programs.map((p) => <ProgramCard key={p.slug} p={p} />)}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow="Mapa cest" title="Odkud vyprávím">Klepněte na bod a otevřete přednášku z dané cesty.</SectionHead>
          <Reveal><RouteMap /></Reveal>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <SectionHead eyebrow="Ohlasy" title="Co říkají posluchači" />
            <div className="quotes">
              {testimonials.map((t, k) => (
                <Reveal key={t.id} delay={k * 0.1} className="qcard"><p>{t.text}</p>{t.author && <cite>— {t.author}</cite>}</Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap about">
          <div className="portrait"><Img src={s.about_portrait} alt={s.site_name} seed="portrait" /></div>
          <div>
            <span className="eyebrow">O mně</span>
            <h2 style={{ marginBottom: '1.2rem' }}>Inspirovat k objevování krás světa</h2>
            <p className="lead">{about}</p>
            <Link className="btn ghost" to="/o-mne">Více o mně <Icon n="arrow" /></Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <h2>Vymyslíme přednášku, která zaujme.</h2>
            <p>Napište nebo zavolejte – rád doladím téma, délku i formu přesně pro vaše posluchače.</p>
            <div className="cta" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <a className="btn honey" href={phoneHref(s.phone)}><Icon n="phone" /> {s.phone}</a>
              <Link className="btn ghost" style={{ color: 'inherit', borderColor: 'rgba(255,255,255,.35)' }} to="/kontakt">Napsat zprávu</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- knihy ---------- */
function Tilt({ children }) {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 12}deg)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div className="cover-wrap" onPointerMove={move} onPointerLeave={leave}>
      <div className="cover" ref={ref}>{children}</div>
    </div>
  );
}

function Books() {
  useTitle('Knihy');
  const { content } = useContent();
  const openInquiry = useInquiry();
  return (
    <>
      <PageIntro eyebrow="Cestovatelské knihy" title="Příběhy, které se nevešly do přednášky">
        Objevte autentické příběhy ze všech koutů světa prostřednictvím knih Zdeňka Vacka.
      </PageIntro>
      <div className="wrap" style={{ paddingBottom: '4rem' }}>
        {content.books.map((b, i) => (
          <Reveal as="article" className="book" key={b.slug} id={b.slug}>
            <Tilt><Img src={b.cover} alt={`Obálka knihy ${b.title}`} seed={b.slug} /></Tilt>
            <div>
              <span className="eyebrow">Kniha {i + 1}</span>
              <h2>{b.title}</h2>
              {b.tagline && <blockquote className="quote">{b.tagline}</blockquote>}
              {b.description && <p className="desc">{b.description}</p>}
              <div className="acts">
                <button className="btn honey" onClick={() => openInquiry({ kind: 'kniha', subject: `Kniha: ${b.title}` })}>
                  <Icon n="book" /> {b.status === 'soon' ? 'Mám zájem' : 'Objednat knihu'}
                </button>
                {b.price != null && <span className="chip">{b.price} Kč</span>}
                {b.status === 'soon' && <span className="chip honey">Popis již brzy</span>}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}

/* ---------- přednášky ---------- */
function Programs() {
  useTitle('Přednášky');
  const { content } = useContent();
  const openInquiry = useInquiry();
  const [sp, setSp] = useSearchParams();
  const typ = sp.get('typ') === 'cestopisne' ? 'cestopisne' : 'skoly';
  const list = content.programs.filter((p) => p.category === typ);
  return (
    <>
      <PageIntro eyebrow="Přednášky" title="Vyprávění, při kterém se nezívá">
        Doprovázím je vlastními fotografiemi a krátkými filmy. Každou přizpůsobím věku i zájmům posluchačů.
      </PageIntro>
      <div className="wrap" style={{ paddingBottom: '5rem' }}>
        <div className="seg" role="tablist" aria-label="Typ přednášek" style={{ marginBottom: '2rem' }}>
          <button role="tab" aria-selected={typ === 'skoly'} onClick={() => setSp({}, { replace: true })}>Pro školy a knihovny</button>
          <button role="tab" aria-selected={typ === 'cestopisne'} onClick={() => setSp({ typ: 'cestopisne' }, { replace: true })}>Cestopisné</button>
        </div>
        <div className="grid">{list.map((p) => <Reveal key={p.slug}><ProgramCard p={p} /></Reveal>)}</div>
        <div className="box" style={{ marginTop: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><h3 style={{ marginBottom: '0.3rem' }}>Cena a termín po domluvě</h3><span className="muted">Odvíjí se od počtu posluchačů a vzdálenosti. Ideální je více přednášek v jeden den.</span></div>
          <button className="btn honey" onClick={() => openInquiry({ kind: 'prednaska', subject: typ === 'skoly' ? 'Přednáška pro školu / knihovnu' : 'Cestopisná přednáška', withDate: true })}>Objednat přednášku</button>
        </div>
      </div>
    </>
  );
}

function Lightbox({ images, index, onClose, onIndex }) {
  const [zoom, setZoom] = useState(false);
  const touch = useRef(null);
  const n = images.length;
  const go = useCallback((d) => { setZoom(false); onIndex((index + d + n) % n); }, [index, n, onIndex]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [go, onClose]);
  useEffect(() => { [1, -1].forEach((d) => { const im = new Image(); im.src = photo(images[(index + d + n) % n]); }); }, [index, images, n]);
  const src = photo(images[index]);
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Prohlížeč fotografií"
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null || zoom) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
      <div className="lb-top">
        <span className="count">{index + 1} / {n}</span>
        <button className="icon-btn" onClick={() => setZoom((z) => !z)} aria-label="Přiblížit"><Icon n="zoom" /></button>
        <a className="icon-btn" href={src} download aria-label="Stáhnout fotografii"><Icon n="download" /></a>
        <button className="icon-btn" onClick={onClose} aria-label="Zavřít"><Icon n="close" /></button>
      </div>
      <div className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {n > 1 && <button className="icon-btn lb-nav prev" onClick={() => go(-1)} aria-label="Předchozí"><Icon n="left" /></button>}
        <img className={zoom ? 'zoom' : ''} src={src} alt="" onClick={() => setZoom((z) => !z)} />
        {n > 1 && <button className="icon-btn lb-nav next" onClick={() => go(1)} aria-label="Další"><Icon n="right" /></button>}
      </div>
    </div>
  );
}

function ProgramDetail() {
  const { slug } = useParams();
  const { content } = useContent();
  const openInquiry = useInquiry();
  const lectures = useLectures();
  const [lb, setLb] = useState(null);
  const idx = content.programs.findIndex((p) => p.slug === slug);
  const p = content.programs[idx];
  useTitle(p ? p.title : 'Přednáška nenalezena', p?.summary || p?.subtitle);
  if (!p) return <NotFound />;
  const prev = content.programs[(idx - 1 + content.programs.length) % content.programs.length];
  const next = content.programs[(idx + 1) % content.programs.length];
  const dates = (lectures || []).filter((l) => l.program_slug === p.slug && l.date >= todayISO()).slice(0, 4);
  const order = () => openInquiry({ kind: 'prednaska', subject: `Přednáška: ${p.title}`, withDate: true });
  const phone = content.settings.phone;
  return (
    <>
      <section className="phero">
        <div className="bg"><Img src={p.cover} alt="" seed={p.slug} eager /></div>
        <div className="wrap">
          <div className="crumbs"><Link to="/prednasky">Přednášky</Link> / <Link to={`/prednasky?typ=${p.category}`}>{p.category === 'skoly' ? 'Pro školy a knihovny' : 'Cestopisné'}</Link></div>
          <h1>{p.title}</h1>
          {p.subtitle && <p className="sub">{p.subtitle}</p>}
          <div className="facts">
            {p.duration && <div className="fact"><small>Délka</small><b>{p.duration}</b></div>}
            {p.audience && <div className="fact"><small>Pro koho</small><b>{p.audience}</b></div>}
            {p.price_note && <div className="fact"><small>Cena</small><b>Po domluvě</b></div>}
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: '2rem' }}>
        <div className="wrap article">
          <div>
            <div className="prose">{paras(p.body).map((t, i) => <p key={i}>{t}</p>)}</div>
            {p.gallery.length > 0 && (
              <div style={{ marginTop: '3rem' }}>
                <h3 style={{ marginBottom: '1.2rem' }}>Fotografie z přednášky</h3>
                <div className="gallery">
                  {p.gallery.map((g, i) => (
                    <button key={g} onClick={() => setLb(i)} aria-label={`Zvětšit fotografii ${i + 1}`}><Img src={g} alt="" seed={g} /></button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="aside">
            <div className="box">
              <h3>Objednat přednášku</h3>
              {p.price_note && <p className="muted" style={{ fontSize: '0.95rem' }}>{p.price_note}</p>}
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <button className="btn honey" onClick={order}>Objednat <Icon n="arrow" /></button>
                <a className="btn ghost" href={phoneHref(phone)}><Icon n="phone" /> {phone}</a>
              </div>
            </div>
            <div className="box">
              <h3>Nejbližší termíny</h3>
              {dates.length ? (
                <div className="mini">{dates.map((l) => (
                  <Link key={l.id} to="/kalendar"><b>{fmtDate(l.date, { day: 'numeric', month: 'long' })} · {fmtTime(l.time)}</b>{l.place}</Link>
                ))}</div>
              ) : <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>Veřejný termín zatím není vypsán. Přednášku ale rád přivezu k vám.</p>}
            </div>
          </aside>
        </div>
        <div className="wrap">
          <div className="pager">
            <Link to={`/prednasky/${prev.slug}`}><small>← Předchozí</small><b>{prev.title}</b></Link>
            <Link to={`/prednasky/${next.slug}`}><small>Další →</small><b>{next.title}</b></Link>
          </div>
        </div>
      </section>
      <div className="mobile-bar">
        <button className="btn honey" onClick={order}>Objednat</button>
        <a className="btn ghost" href={phoneHref(phone)}><Icon n="phone" /> Zavolat</a>
      </div>
      {lb !== null && <Lightbox images={p.gallery} index={lb} onIndex={setLb} onClose={() => setLb(null)} />}
    </>
  );
}

/* ---------- kalendář ---------- */
function Calendar() {
  useTitle('Kalendář přednášek');
  const { content } = useContent();
  const openInquiry = useInquiry();
  const lectures = useLectures();
  const [tab, setTab] = useState('next');
  const today = todayISO();
  const rows = useMemo(() => {
    const all = lectures || [];
    return tab === 'next' ? all.filter((l) => l.date >= today) : all.filter((l) => l.date < today).reverse();
  }, [lectures, tab, today]);
  const groups = useMemo(() => {
    const m = new Map();
    rows.forEach((l) => { const k = l.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(l); });
    return [...m.entries()];
  }, [rows]);
  return (
    <>
      <PageIntro eyebrow="Kalendář" title="Kde se potkáme">
        Veřejné přednášky a besedy. U každého termínu si můžete zarezervovat místo nebo si ho uložit do kalendáře v telefonu.
      </PageIntro>
      <div className="wrap" style={{ paddingBottom: '5rem' }}>
        <div className="seg" role="tablist" aria-label="Termíny">
          <button role="tab" aria-selected={tab === 'next'} onClick={() => setTab('next')}>Nadcházející</button>
          <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Proběhlé</button>
        </div>
        {lectures === null && <p className="muted" style={{ marginTop: '2rem' }}>Načítám termíny…</p>}
        {lectures !== null && !rows.length && (
          <div className="empty" style={{ marginTop: '2rem' }}>
            <b>{tab === 'next' ? 'Nové termíny se připravují' : 'Zatím tu nic není'}</b>
            {tab === 'next' && 'Máte zájem o přednášku u vás? Napište, domluvíme se.'}
            {tab === 'next' && <div style={{ marginTop: '1rem' }}><button className="btn honey small" onClick={() => openInquiry({ kind: 'prednaska', subject: 'Přednáška na míru', withDate: true })}>Objednat přednášku</button></div>}
          </div>
        )}
        {groups.map(([k, ls]) => (
          <div key={k}>
            <h2 className="month-h">{fmtDate(k + '-01', { month: 'long', year: 'numeric' })}</h2>
            <div className="dates">{ls.map((l) => <DateRow key={l.id} l={l} programs={content.programs} />)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- film a foto ---------- */
function FilmFoto() {
  useTitle('Film a foto');
  const openInquiry = useInquiry();
  const post = ['Color grading', 'Sound design', 'VFX efekty', 'Motion graphics'];
  return (
    <>
      <PageIntro eyebrow="Film & Foto" title="Natočeno, sestříháno, doladěno">
        Filmové, fotografické a střihové práce – od krátké reklamy po film z vaší dovolené.
      </PageIntro>
      <div className="wrap" style={{ paddingBottom: '5rem' }}>
        <div className="two">
          <Reveal className="service">
            <span className="eyebrow" style={{ margin: 0 }}>Film a střih</span>
            <h2 style={{ fontSize: '2rem' }}>Pohyblivé příběhy</h2>
            <ul>
              <li>krátké reklamní a propagační filmy</li>
              <li>natočím a sestříhám svatby, oslavy, koncerty, klipy a další akce</li>
              <li>sestříhám vaše filmy z dovolené, narozenin nebo jiných oslav</li>
            </ul>
            <button className="btn honey" onClick={() => openInquiry({ kind: 'film', subject: 'Film / střih', withDate: true })}><Icon n="film" /> Poptat film</button>
          </Reveal>
          <Reveal className="service" delay={0.1}>
            <span className="eyebrow" style={{ margin: 0 }}>Fotografie</span>
            <h2 style={{ fontSize: '2rem' }}>Zastavené okamžiky</h2>
            <ul>
              <li>reklamní a propagační fotografie</li>
              <li>svatby</li>
              <li>oslavy</li>
              <li>koncerty</li>
            </ul>
            <button className="btn honey" onClick={() => openInquiry({ kind: 'foto', subject: 'Focení', withDate: true })}><Icon n="image" /> Poptat focení</button>
          </Reveal>
        </div>
        <Reveal className="box" style={{ marginTop: '1.2rem' }}>
          <h3>Postprodukce</h3>
          <div className="chips" style={{ marginTop: '0.8rem' }}>{post.map((x) => <span key={x} className="chip honey">{x}</span>)}</div>
        </Reveal>
        <p className="muted" style={{ marginTop: '2rem' }}>Hledáte přednášky pro školy a knihovny? Najdete je v <Link to="/prednasky">nabídce přednášek</Link>, knihy pak <Link to="/knihy">tady</Link>.</p>
      </div>
    </>
  );
}

/* ---------- hry ---------- */
function Games() {
  useTitle('Hry');
  const { content } = useContent();
  return (
    <>
      <PageIntro eyebrow="Hry" title="Chvilka zábavy mezi cestami">
        Malé hry z dílny Michala Schneidera, autora tohoto webu. Zkuste, jak jste na tom s pozorností, včelím letem a vánočními šiframi.
      </PageIntro>
      <div className="wrap" style={{ paddingBottom: '5rem' }}>
        <div className="grid">
          {content.games.map((g, i) => {
            const ready = g.status === 'available' && g.url;
            return (
              <Reveal as="article" key={g.slug} className="game" delay={(i % 3) * 0.08}>
                <div className="media"><Img src={g.image} alt="" seed={g.slug} /></div>
                <div className="body">
                  <h3>{g.title}</h3>
                  <p>{g.description}</p>
                  {g.author && <span className="by">Autor: {g.author}</span>}
                  {ready ? <Link className="btn honey" to={`/hry/${g.slug}`}><Icon n="game" /> Hrát</Link> : <span className="btn ghost disabled">Již brzy</span>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </>
  );
}

function GamePlay() {
  const { slug } = useParams();
  const { content } = useContent();
  const g = content.games.find((x) => x.slug === slug);
  const [loaded, setLoaded] = useState(false);
  const box = useRef(null);
  useTitle(g ? g.title : 'Hra nenalezena');
  if (!g || !g.url) return <NotFound />;
  return (
    <div className="wrap" style={{ padding: '2rem 0 5rem' }}>
      <div className="crumbs"><Link to="/hry">Hry</Link> / {g.title}</div>
      <div className="section-head" style={{ marginBottom: '1.2rem' }}>
        <div><h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)' }}>{g.title}</h1><p className="muted" style={{ marginTop: '0.6rem', maxWidth: '60ch' }}>{g.description}</p></div>
        <div className="chips">
          <button className="btn ghost small" onClick={() => box.current && box.current.requestFullscreen && box.current.requestFullscreen()}><Icon n="expand" /> Celá obrazovka</button>
          <a className="btn ghost small" href={g.url} target="_blank" rel="noopener noreferrer">Otevřít samostatně</a>
        </div>
      </div>
      <div className="player" ref={box}>
        {!loaded && <div className="loading"><div><div className="spinner" />Hra se načítá…<br /><small style={{ opacity: 0.7 }}>Některé hry mají desítky MB, chvilku strpení.</small></div></div>}
        <iframe title={g.title} src={g.url} allow="fullscreen; autoplay; gamepad" onLoad={() => setLoaded(true)} />
      </div>
    </div>
  );
}

/* ---------- o mně, kontakt, soukromí ---------- */
function About() {
  useTitle('O mně');
  const { content } = useContent();
  const s = content.settings;
  return (
    <>
      <section className="section">
        <div className="wrap about">
          <div className="portrait"><Img src={s.about_portrait} alt={s.site_name} seed="portrait" eager /></div>
          <div>
            <span className="eyebrow">O mně</span>
            <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', marginBottom: '1.5rem' }}>{s.site_name}</h1>
            {paras(s.about_text).map((t, i) => <p key={i} className={i === 0 ? 'lead' : ''} style={i === 0 ? { maxWidth: 'none' } : undefined}>{t}</p>)}
            <div className="chips" style={{ marginTop: '1.5rem' }}>
              <Link className="btn honey" to="/prednasky">Moje přednášky</Link>
              <Link className="btn ghost" to="/knihy">Knihy</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow="Mapa cest" title="Kde všude jsem byl" />
          <RouteMap />
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="narrow">
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>O webu</h2>
          <p className="muted">Tento web vytvořil Michal Schneider s podklady Zdeňka Vacka (první verze 2024, nová verze 2026). Hry vznikly ve Scratchi s kamarády ze studia a byly převedeny do HTML a JavaScriptu pomocí TurboWarp. Fotografie jsou dílem Zdeňka Vacka.</p>
          <p className="muted">Web je postaven na Reactu, běží na Node.js a data uchovává v jediném SQL souboru. Písma Fraunces a Inter jsou šířena pod licencí SIL OFL. Děkujeme Microsoftu za VS Code.</p>
        </div>
      </section>
    </>
  );
}

function Contact() {
  useTitle('Kontakt');
  const { content } = useContent();
  const s = content.settings;
  return (
    <>
      <PageIntro eyebrow="Kontakt" title="Napište nebo zavolejte">Na přednášku, knihu, film i obyčejný dotaz odpovím co nejdřív.</PageIntro>
      <div className="wrap contact-grid" style={{ paddingBottom: '5rem' }}>
        <div>
          <div className="clist">
            <a href={phoneHref(s.phone)}><Icon n="phone" /><span>{s.phone}<small>telefon</small></span></a>
            <a href={`mailto:${s.email}`}><Icon n="mail" /><span>{s.email}<small>e-mail</small></span></a>
            {s.facebook && <a href={s.facebook} target="_blank" rel="noopener noreferrer"><Icon n="fb" /><span>Facebook<small>novinky z cest</small></span></a>}
          </div>
        </div>
        <div className="box" style={{ padding: 'clamp(1.2rem, 4vw, 2rem)' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>Kontaktní formulář</h2>
          <InquiryForm kind="kontakt" subject="Obecný dotaz" withDate={false} />
        </div>
      </div>
    </>
  );
}

function Privacy() {
  useTitle('Ochrana soukromí');
  const { content } = useContent();
  const mail = content.settings.privacy_email || content.settings.email;
  return (
    <section className="section">
      <div className="narrow prose">
        <span className="eyebrow">Soukromí</span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', marginBottom: '2rem' }}>Ochrana soukromí a cookies</h1>
        <h3>Správce údajů</h3>
        <p>Správcem údajů je {content.settings.site_name}. Kontakt: <a href={`mailto:${mail}`}>{mail}</a>.</p>
        <h3>Formuláře a objednávky</h3>
        <p>Když odešlete objednávku, rezervaci nebo zprávu, uložím jméno, e-mail, telefon a text zprávy. Použiji je výhradně k vyřízení vaší žádosti a po vyřízení je nejdéle do tří měsíců automaticky smažu.</p>
        <h3>Statistiky návštěvnosti</h3>
        <p>Pouze s vaším souhlasem ukládám anonymní údaje: navštívená stránka, typ zařízení (mobil, tablet, počítač), zda jde o nového návštěvníka, a čas návštěvy. IP adresy ani otisky prohlížeče neukládám a nepoužívám žádné reklamní ani sledovací služby třetích stran. Zaznamenávám jen to, zda jste statistiky povolili, nebo odmítli (bez IP adresy).</p>
        <h3>Do Not Track a Global Privacy Control</h3>
        <p>Pokud váš prohlížeč posílá signál Do Not Track (DNT) nebo Global Privacy Control (GPC), respektuji ho: nezobrazím nabídku zapnutí statistik a nebudu ukládat statistiky návštěvnosti ani záznam o volbě souhlasu. Web v takovém případě používá pouze nezbytné funkce.</p>
        <h3>Cookies a úložiště prohlížeče</h3>
        <p>Web používá pouze úložiště prohlížeče pro vaše nastavení (světlý/tmavý režim, volba souhlasu). Přihlašovací cookie existuje jen pro správce webu.</p>
        <h3>Vaše práva</h3>
        <p>Máte právo na přístup ke svým údajům, jejich opravu a výmaz. Napište na <a href={`mailto:${mail}`}>{mail}</a>. Souhlas se statistikami můžete kdykoli změnit:</p>
        <button className="btn honey" onClick={() => window.dispatchEvent(new Event('zv:consent-reset'))}>Změnit nastavení cookies</button>
      </div>
    </section>
  );
}

function NotFound() {
  useTitle('Stránka nenalezena');
  return (
    <section className="section">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <span className="eyebrow">Chyba 404</span>
        <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 5rem)' }}>Tady cesta končí</h1>
        <p className="lead" style={{ margin: '1.2rem auto 2rem' }}>Stránku, kterou hledáte, jsem na mapě nenašel. Zkuste začít od začátku.</p>
        <Link className="btn honey" to="/">Zpět na úvod</Link>
      </div>
    </section>
  );
}

/* ==========================================================================
   5) ADMINISTRACE (/admin)
   ========================================================================== */
const ADMIN_ENTITIES = {
  lectures: {
    label: 'Kalendář', singular: 'termín', title: (r) => `${fmtDate(r.date)} · ${r.name}`, sub: (r) => `${fmtTime(r.time)} · ${r.place || '—'} · ${r.available ? 'volno' : 'obsazeno'}`,
    empty: { name: '', date: todayISO(), time: '17:00', place: '', available: true, link: '', program_slug: '' },
    fields: [
      ['name', 'Název', 'text'], ['date', 'Datum', 'date'], ['time', 'Čas', 'time'], ['place', 'Místo', 'text'],
      ['program_slug', 'Propojená přednáška (identifikátor)', 'text', 'např. azorske-ostrovy'], ['link', 'Odkaz (nepovinné)', 'text'], ['available', 'Volno k rezervaci', 'check'],
    ],
  },
  programs: {
    label: 'Přednášky', singular: 'přednášku', title: (r) => r.title, sub: (r) => `${r.category === 'skoly' ? 'školy' : 'cestopisná'} · /${r.slug}`,
    empty: { slug: '', category: 'skoly', title: '', subtitle: '', summary: '', body: '', cover: '', gallery: [], duration: '', audience: '', price_note: '', status: 'available', sort: 0 },
    fields: [
      ['title', 'Název', 'text'], ['slug', 'Identifikátor v URL (bez diakritiky)', 'text', 'azorske-ostrovy'],
      ['category', 'Kategorie', 'select', [['skoly', 'Pro školy a knihovny'], ['cestopisne', 'Cestopisná']]],
      ['subtitle', 'Podtitul', 'text'], ['summary', 'Krátký popis (karta)', 'area'], ['body', 'Celý text (odstavce odděl prázdným řádkem)', 'area', '', 10],
      ['cover', 'Hlavní fotka (cesta ve složce photos)', 'text', 'azory/AZORY1.JPG'], ['gallery', 'Galerie – jedna cesta na řádek', 'lines'],
      ['duration', 'Délka', 'text'], ['audience', 'Pro koho', 'text'], ['price_note', 'Poznámka k ceně', 'area'],
      ['status', 'Stav', 'select', [['available', 'Dostupná'], ['soon', 'Již brzy']]], ['sort', 'Pořadí (menší = výš)', 'number'],
    ],
  },
  books: {
    label: 'Knihy', singular: 'knihu', title: (r) => r.title, sub: (r) => (r.status === 'soon' ? 'již brzy' : 'dostupná'),
    empty: { slug: '', title: '', tagline: '', description: '', cover: '', price: '', status: 'available', sort: 0 },
    fields: [
      ['title', 'Název', 'text'], ['slug', 'Identifikátor', 'text'], ['tagline', 'Citát / motto', 'area'], ['description', 'Popis', 'area', '', 6],
      ['cover', 'Obálka (cesta ve složce photos)', 'text', 'books/kmsfr.jpg'], ['price', 'Cena v Kč (prázdné = neuvádět)', 'number'],
      ['status', 'Stav', 'select', [['available', 'Dostupná'], ['soon', 'Již brzy']]], ['sort', 'Pořadí', 'number'],
    ],
  },
  games: {
    label: 'Hry', singular: 'hru', title: (r) => r.title, sub: (r) => r.url || 'již brzy',
    empty: { slug: '', title: '', description: '', author: '', image: '', url: '', status: 'available', sort: 0 },
    fields: [
      ['title', 'Název', 'text'], ['slug', 'Identifikátor', 'text'], ['description', 'Popis', 'area'], ['author', 'Autor', 'text'],
      ['image', 'Náhled (cesta ve složce photos)', 'text', 'games/beepr.png'], ['url', 'Adresa hry', 'text', '/games/hra.html'],
      ['status', 'Stav', 'select', [['available', 'Dostupná'], ['soon', 'Již brzy']]], ['sort', 'Pořadí', 'number'],
    ],
  },
  testimonials: {
    label: 'Ohlasy', singular: 'ohlas', title: (r) => r.text.slice(0, 70), sub: (r) => r.author || '—',
    empty: { text: '', author: '', sort: 0 },
    fields: [['text', 'Text', 'area'], ['author', 'Kdo to řekl', 'text'], ['sort', 'Pořadí', 'number']],
  },
};

function Field({ def, value, onChange }) {
  const [key, label, type, extra, rows] = def;
  const id = 'a-' + key;
  if (type === 'check') {
    return <label className="checkrow"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {type === 'area' && <textarea id={id} rows={rows || 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {type === 'lines' && <textarea id={id} rows={5} value={(value || []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} />}
      {type === 'select' && <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{extra.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
      {!['area', 'lines', 'select'].includes(type) && <input id={id} type={type} value={value ?? ''} placeholder={typeof extra === 'string' ? extra : ''} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function EntityAdmin({ entity, onChanged }) {
  const cfg = ADMIN_ENTITIES[entity];
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api(`/api/admin/e/${entity}`).then((r) => setRows(r.map((x) => (typeof x.gallery === 'string' ? { ...x, gallery: JSON.parse(x.gallery || '[]') } : x)))).catch((e) => setErr(e.message)), [entity]);
  useEffect(() => { setRows(null); setEdit(null); load(); }, [load]);
  async function save(e) {
    e.preventDefault(); setErr('');
    const body = { ...edit };
    delete body.id;
    if (Array.isArray(body.gallery)) body.gallery = body.gallery.map((x) => x.trim()).filter(Boolean);
    try {
      if (edit.id) await api(`/api/admin/e/${entity}/${edit.id}`, { method: 'PUT', body });
      else await api(`/api/admin/e/${entity}`, { method: 'POST', body });
      setEdit(null); await load(); onChanged();
    } catch (x) { setErr(x.message); }
  }
  async function del(r) {
    if (!window.confirm(`Opravdu smazat: ${cfg.title(r)}?`)) return;
    try { await api(`/api/admin/e/${entity}/${r.id}`, { method: 'DELETE' }); await load(); onChanged(); } catch (x) { setErr(x.message); }
  }
  if (edit) {
    return (
      <form className="form box" onSubmit={save}>
        <h3>{edit.id ? 'Upravit' : 'Přidat'} {cfg.singular}</h3>
        {cfg.fields.map((f) => <Field key={f[0]} def={f} value={edit[f[0]]} onChange={(v) => setEdit((s) => ({ ...s, [f[0]]: v }))} />)}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="chips"><button className="btn honey">Uložit</button><button type="button" className="btn ghost" onClick={() => { setEdit(null); setErr(''); }}>Zrušit</button></div>
      </form>
    );
  }
  return (
    <div>
      <button className="btn honey" style={{ marginBottom: '1rem' }} onClick={() => { setErr(''); setEdit({ ...cfg.empty }); }}>+ Přidat {cfg.singular}</button>
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null ? <p className="muted">Načítám…</p> : !rows.length ? <div className="empty">Zatím nic. Přidejte první položku.</div> : (
        <div className="list">{rows.map((r) => (
          <div className="item" key={r.id}>
            <div className="head"><div><b>{cfg.title(r)}</b><div className="muted" style={{ fontSize: '0.9rem' }}>{cfg.sub(r)}</div></div>
              <div className="acts"><button className="btn ghost small" onClick={() => { setErr(''); setEdit({ ...r, available: !!r.available }); }}>Upravit</button><button className="btn ghost small" onClick={() => del(r)}>Smazat</button></div></div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function InquiriesAdmin({ onChanged }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api('/api/admin/inquiries').then(setRows).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (r) => { await api(`/api/admin/inquiries/${r.id}`, { method: 'PATCH', body: { status: r.status === 'new' ? 'done' : 'new' } }); load(); onChanged(); };
  const del = async (r) => { if (window.confirm('Smazat tuto poptávku?')) { await api(`/api/admin/inquiries/${r.id}`, { method: 'DELETE' }); load(); onChanged(); } };
  if (rows === null) return <p className="muted">Načítám…</p>;
  if (!rows.length) return <div className="empty"><b>Žádné poptávky</b>Jakmile někdo vyplní formulář, objeví se tady.</div>;
  return (
    <div className="list">{rows.map((r) => (
      <div className="item" key={r.id} style={r.status === 'new' ? { borderColor: 'var(--honey)' } : { opacity: 0.7 }}>
        <div className="head">
          <div><b>{r.name}</b> <span className={`chip ${r.status === 'new' ? 'honey' : 'ok'}`}>{r.status === 'new' ? 'nové' : 'vyřízeno'}</span> <span className="chip">{r.kind}</span></div>
          <span className="muted" style={{ fontSize: '0.85rem' }}>{r.created_at}</span>
        </div>
        {r.subject && <div><b>{r.subject}</b></div>}
        <div className="chips">
          {r.email && <a className="chip" href={`mailto:${r.email}`}>{r.email}</a>}
          {r.phone && <a className="chip" href={phoneHref(r.phone)}>{r.phone}</a>}
          {r.preferred_date && <span className="chip">termín: {r.preferred_date}</span>}
        </div>
        {r.message && <pre>{r.message}</pre>}
        <div className="acts"><button className="btn ghost small" onClick={() => toggle(r)}>{r.status === 'new' ? 'Označit jako vyřízené' : 'Vrátit mezi nové'}</button><button className="btn ghost small" onClick={() => del(r)}>Smazat</button></div>
      </div>
    ))}</div>
  );
}

const SETTING_FIELDS = [
  ['site_name', 'Jméno na webu', 'text'], ['tagline', 'Podtitul', 'text'], ['phone', 'Telefon', 'text'], ['email', 'E-mail', 'text'], ['facebook', 'Facebook (odkaz)', 'text'],
  ['hero_image', 'Úvodní fotka (cesta ve složce photos)', 'text', 'hero/uvod.jpg'], ['about_portrait', 'Portrét v „O mně“', 'text', 'portrait/tojsemja.jpg'],
  ['about_text', 'Text „O mně“ (odstavce odděl prázdným řádkem)', 'area', '', 9],
  ['notice_text', 'Oznámení nahoře na webu (prázdné = žádné)', 'text'], ['notice_link', 'Odkaz oznámení (např. /kalendar)', 'text'],
  ['privacy_email', 'E-mail pro ochranu soukromí', 'text'],
];
function SettingsAdmin({ onChanged }) {
  const [vals, setVals] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/settings').then((r) => setVals(Object.fromEntries(r.map((x) => [x.key, x.value])))); }, []);
  if (!vals) return <p className="muted">Načítám…</p>;
  const save = async (e) => { e.preventDefault(); await api('/api/admin/settings', { method: 'PUT', body: vals }); setMsg('Uloženo.'); onChanged(); };
  return (
    <form className="form box" onSubmit={save}>
      {SETTING_FIELDS.map((f) => <Field key={f[0]} def={f} value={vals[f[0]]} onChange={(v) => { setMsg(''); setVals((s) => ({ ...s, [f[0]]: v })); }} />)}
      <div className="chips"><button className="btn honey">Uložit nastavení</button>{msg && <span className="chip ok" role="status">{msg}</span>}</div>
    </form>
  );
}

function StatsAdmin() {
  const [st, setSt] = useState(null);
  useEffect(() => { api('/api/admin/stats').then(setSt); }, []);
  if (!st) return <p className="muted">Načítám…</p>;
  const max = Math.max(1, ...st.daily.map((d) => d.c));
  const cons = Object.fromEntries(st.consents.map((c) => [c.level, c.c]));
  return (
    <div>
      <div className="stats">
        <div className="box stat"><b>{st.totals.visits}</b>zobrazení (30 dní)</div>
        <div className="box stat"><b>{st.totals.newVisitors}</b>noví návštěvníci</div>
        <div className="box stat"><b>{cons.all || 0} / {(cons.all || 0) + (cons.necessary || 0)}</b>souhlas se statistikami</div>
      </div>
      <div className="box" style={{ marginBottom: '1rem' }}>
        <h3>Návštěvnost po dnech</h3>
        {st.daily.length ? <div className="bars" role="img" aria-label="Graf návštěvnosti">{st.daily.map((d) => <i key={d.d} title={`${d.d}: ${d.c}`} style={{ height: `${(d.c / max) * 100}%` }} />)}</div> : <p className="muted">Zatím žádná data (počítají se jen návštěvníci se souhlasem).</p>}
      </div>
      <div className="two">
        <div className="box"><h3>Nejčastější stránky</h3><table className="table"><tbody>{st.pages.map((p) => <tr key={p.page}><td>{p.page}</td><td>{p.c}</td></tr>)}</tbody></table></div>
        <div className="box"><h3>Zařízení</h3><table className="table"><tbody>{st.devices.map((p) => <tr key={p.device}><td>{p.device}</td><td>{p.c}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}

function Admin() {
  useTitle('Správa webu');
  const { reload } = useContent();
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('inquiries');
  const [badge, setBadge] = useState(0);
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const refreshBadge = useCallback(() => api('/api/admin/stats').then((s) => setBadge(s.newInquiries)).catch(() => {}), []);
  useEffect(() => { api('/api/admin/me').then((r) => setUser(r.user)).catch(() => setUser(null)); }, []);
  useEffect(() => { if (user) refreshBadge(); }, [user, refreshBadge]);
  const login = async (e) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/api/admin/login', { method: 'POST', body: f }); setUser(r.user); } catch (x) { setErr(x.message); }
  };
  const logout = async () => { await api('/api/admin/logout', { method: 'POST' }); setUser(null); };
  const changed = () => { reload(); refreshBadge(); };
  if (user === undefined) return <div className="wrap admin"><p className="muted">Načítám…</p></div>;
  if (!user) {
    return (
      <div className="wrap admin">
        <form className="login box form" onSubmit={login}>
          <h1 style={{ fontSize: '2rem' }}>Správa webu</h1>
          <div className="field"><label htmlFor="u">Uživatel</label><input id="u" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
          <div className="field"><label htmlFor="pw">Heslo</label><input id="pw" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn honey">Přihlásit</button>
        </form>
      </div>
    );
  }
  const tabs = [['inquiries', 'Poptávky'], ['lectures', 'Kalendář'], ['programs', 'Přednášky'], ['books', 'Knihy'], ['games', 'Hry'], ['testimonials', 'Ohlasy'], ['settings', 'Nastavení'], ['stats', 'Statistiky'], ['backup', 'Záloha']];
  return (
    <div className="wrap admin">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>Správa webu</h1>
        <button className="btn ghost small" onClick={logout}><Icon n="out" /> Odhlásit ({user})</button>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{k === 'inquiries' && badge > 0 && <span className="badge">{badge}</span>}</button>)}
      </div>
      {tab === 'inquiries' && <InquiriesAdmin onChanged={changed} />}
      {ADMIN_ENTITIES[tab] && <EntityAdmin entity={tab} onChanged={changed} />}
      {tab === 'settings' && <SettingsAdmin onChanged={changed} />}
      {tab === 'stats' && <StatsAdmin />}
      {tab === 'backup' && (
        <div className="box">
          <h3>Záloha databáze</h3>
          <p className="muted">Stáhne se kompletní SQL soubor (struktura i data). Doporučuji zálohovat jednou za čas – uložte si ho na počítač.</p>
          <a className="btn honey" href="/api/admin/export.sql"><Icon n="download" /> Stáhnout zálohu (.sql)</a>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   6) KOŘEN APLIKACE
   ========================================================================== */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) { const el = document.getElementById(hash.slice(1)); if (el) { el.scrollIntoView(); return; } }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Loading() {
  return <div className="wrap" style={{ padding: '30vh 0', textAlign: 'center' }}><div className="spinner" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--honey)' }} /><span className="muted">Načítám…</span></div>;
}

export default function App() {
  const [content, setContent] = useState(null);
  const [failed, setFailed] = useState(false);
  const [inq, setInq] = useState(null);
  const [searching, setSearching] = useState(false);
  const privacyOptOut = hasPrivacyOptOut();
  const [consent, setConsent] = useState(() => {
    if (hasPrivacyOptOut()) return 'necessary';
    try { return localStorage.getItem('zv_consent'); } catch (_) { return 'necessary'; }
  });
  const { pathname } = useLocation();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  const isAdmin = pathname.startsWith('/admin');

  const reload = useCallback(() => api('/api/content').then(setContent).catch(() => setFailed(true)), []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(true); } };
    const onReset = () => { try { localStorage.removeItem('zv_consent'); } catch (_) { /* nic */ } setConsent(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('zv:consent-reset', onReset);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('zv:consent-reset', onReset); };
  }, []);

  const choose = (level) => {
    if (privacyOptOut) { setConsent('necessary'); return; }
    try { localStorage.setItem('zv_consent', level); } catch (_) { /* nic */ }
    api('/api/consent', { method: 'POST', body: { level } }).catch(() => {});
    setConsent(level);
  };

  useEffect(() => { // anonymní statistiky – jen se souhlasem
    if (privacyOptOut || consent !== 'all' || isAdmin) return;
    let isNew = false;
    try { if (!localStorage.getItem('zv_seen')) { isNew = true; localStorage.setItem('zv_seen', '1'); } } catch (_) { /* nic */ }
    api('/api/track', { method: 'POST', body: { consent: true, page: pathname, isNew } }).catch(() => {});
  }, [pathname, consent, isAdmin, privacyOptOut]);

  const ctx = useMemo(() => (content ? { content, reload } : null), [content, reload]);

  if (failed) return <div className="wrap" style={{ padding: '20vh 0', textAlign: 'center' }}><h1 style={{ fontSize: '2.4rem' }}>Web se nepodařilo načíst</h1><p className="muted">Zkuste prosím obnovit stránku, nebo zavolejte na 605 889 550.</p></div>;
  if (!ctx) return <Loading />;

  return (
    <ContentCtx.Provider value={ctx}>
      <InquiryCtx.Provider value={setInq}>
        <a className="skip" href="#obsah">Přeskočit na obsah</a>
        <motion.div className="progress" style={{ scaleX: progress }} />
        <NoticeBar />
        <Header onSearch={() => setSearching(true)} />
        <ScrollManager />
        <main id="obsah" className="page" tabIndex={-1}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname.split('/').slice(0, 2).join('/')} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/knihy" element={<Books />} />
                <Route path="/prednasky" element={<Programs />} />
                <Route path="/prednasky/:slug" element={<ProgramDetail />} />
                <Route path="/kalendar" element={<Calendar />} />
                <Route path="/film-foto" element={<FilmFoto />} />
                <Route path="/hry" element={<Games />} />
                <Route path="/hry/:slug" element={<GamePlay />} />
                <Route path="/o-mne" element={<About />} />
                <Route path="/kontakt" element={<Contact />} />
                <Route path="/soukromi" element={<Privacy />} />
                <Route path="/admin" element={<Admin />} />
                {/* adresy ze starého webu */}
                <Route path="/prednaskyCESTOPISNE.html" element={<Navigate to="/prednasky?typ=cestopisne" replace />} />
                <Route path="/prednasky.html" element={<Navigate to="/prednasky" replace />} />
                <Route path="/knihy.html" element={<Navigate to="/knihy" replace />} />
                <Route path="/filmy" element={<Navigate to="/film-foto" replace />} />
                <Route path="/filmy.html" element={<Navigate to="/film-foto" replace />} />
                <Route path="/rozcestihry" element={<Navigate to="/hry" replace />} />
                <Route path="/hra.html" element={<Navigate to="/hry/flappybee" replace />} />
                <Route path="/pozornost" element={<Navigate to="/hry/pozornost" replace />} />
                <Route path="/VZZ.html" element={<Navigate to="/prednasky/vcela-zaklad-zivota" replace />} />
                <Route path="/planetazeme.html" element={<Navigate to="/prednasky/planeta-zeme" replace />} />
                <Route path="/azory.html" element={<Navigate to="/prednasky/azorske-ostrovy" replace />} />
                <Route path="/KMSpreNEW.html" element={<Navigate to="/prednasky/krajinou-mych-snu" replace />} />
                <Route path="/ZPSpreNEW.html" element={<Navigate to="/prednasky/zeme-pulnocniho-slunce" replace />} />
                <Route path="/blank.html" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        {!isAdmin && <Footer />}
        {inq && (
          <Modal onClose={() => setInq(null)} label={KIND_TITLE[inq.kind]}>
            <h2>{KIND_TITLE[inq.kind]}</h2>
            {inq.subject && <div className="subject">{inq.subject}</div>}
            <InquiryForm kind={inq.kind} subject={inq.subject} withDate={!!inq.withDate} />
          </Modal>
        )}
        {searching && <SearchPalette onClose={() => setSearching(false)} />}
        {consent === null && !isAdmin && !privacyOptOut && <ConsentBanner onChoose={choose} />}
      </InquiryCtx.Provider>
    </ContentCtx.Provider>
  );
}
