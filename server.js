/* ==========================================================================
   Web Zdeňka Vacka – backend (Express + SQLite přes sql.js)
   --------------------------------------------------------------------------
   • Jediný soubor, žádné nativní moduly (běží i na hostingu bez ROOT práv)
   • Databáze: data/zdvac.sqlite – při prvním startu se sama vytvoří
     z čitelného SQL souboru database/zdvac.sql
   • Nastavení se čte ze souboru .env (viz .env.example)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const initSqlJs = require('sql.js');

const ROOT = __dirname;

/* ---------- .env (bez závislosti na dotenv) ---------- */
(function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const CFG = {
  port: process.env.PORT || 8080,
  dbFile: path.resolve(ROOT, process.env.DB_FILE || 'data/zdvac.sqlite'),
  seedFile: path.join(ROOT, 'database', 'zdvac.sql'),
  adminUser: process.env.ADMIN_USER || 'zdenek',
  adminPass: process.env.ADMIN_PASSWORD || '',
  retentionDays: parseInt(process.env.RETENTION_DAYS || '90', 10),
  siteUrl: (process.env.SITE_URL || '').replace(/\/$/, ''),
  mailTo: (process.env.MAIL_TO || 'zd.vac@seznam.cz,misaamaminka@seznam.cz').split(',').map((x) => x.trim()).filter(Boolean),
};

/* ---------- CLI: node server.js hash "heslo" ---------- */
if (process.argv[2] === 'hash') {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(process.argv[3] || ''), salt, 64).toString('hex');
  console.log(`scrypt$${salt}$${hash}`);
  process.exit(0);
}

/* ==========================================================================
   Databáze
   ========================================================================== */
let SQL = null;
let db = null;
let dbMtime = 0;

function persist() {
  const tmp = CFG.dbFile + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, CFG.dbFile);
  dbMtime = fs.statSync(CFG.dbFile).mtimeMs;
}

async function openDb() {
  SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(CFG.dbFile), { recursive: true });
  if (fs.existsSync(CFG.dbFile)) {
    db = new SQL.Database(fs.readFileSync(CFG.dbFile));
    dbMtime = fs.statSync(CFG.dbFile).mtimeMs;
  } else {
    db = new SQL.Database();
    db.exec(fs.readFileSync(CFG.seedFile, 'utf8'));
    persist();
    console.log('[db] Vytvořena nová databáze ze souboru database/zdvac.sql');
  }
}

/* když soubor změní jiný proces (víc workerů), načteme ho znovu */
function refreshDb() {
  try {
    const m = fs.statSync(CFG.dbFile).mtimeMs;
    if (m !== dbMtime) {
      db = new SQL.Database(fs.readFileSync(CFG.dbFile));
      dbMtime = m;
    }
  } catch (_) { /* ignorujeme */ }
}

function all(sql, params = []) {
  const st = db.prepare(sql);
  try {
    st.bind(params);
    const rows = [];
    while (st.step()) rows.push(st.getAsObject());
    return rows;
  } finally { st.free(); }
}
const one = (sql, params) => all(sql, params)[0] || null;
function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = one('SELECT last_insert_rowid() AS id').id;
  persist();
  return { changes, lastId };
}

/* ==========================================================================
   Pomocné funkce
   ========================================================================== */
const hits = new Map(); // jednoduchý rate-limit v paměti
function limiter(name, max, windowMs) {
  return (req, res, next) => {
    const key = name + ':' + req.ip;
    const now = Date.now();
    const rec = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (rec.length >= max) {
      res.set('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Příliš mnoho požadavků, zkuste to prosím později.' });
    }
    rec.push(now);
    hits.set(key, rec);
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

const wrap = (fn) => (req, res, next) => { try { refreshDb(); Promise.resolve(fn(req, res, next)).catch(next); } catch (e) { next(e); } };
const clip = (v, n = 4000) => String(v == null ? '' : v).trim().slice(0, n);
const privacyOptOut = (req) => req.headers.dnt === '1' || req.headers['sec-gpc'] === '1';

function deviceOf(ua = '') {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobil';
  return 'počítač';
}

/* ---------- přihlášení správce ---------- */
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(path.dirname(CFG.dbFile), 'session.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8');
}
let SECRET = '';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function passwordOk(input) {
  if (!CFG.adminPass) return false;
  if (CFG.adminPass.startsWith('scrypt$')) {
    const [, salt, hash] = CFG.adminPass.split('$');
    const test = crypto.scryptSync(String(input), salt, 64);
    const real = Buffer.from(hash, 'hex');
    return real.length === test.length && crypto.timingSafeEqual(real, test);
  }
  return safeEq(input, CFG.adminPass);
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function readSession(req) {
  const m = /(?:^|;\s*)zv_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (_) { return null; }
}
function requireAdmin(req, res, next) {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: 'Nejste přihlášen(a).' });
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'zdvac') return res.status(403).json({ error: 'Neplatný požadavek.' });
  req.admin = s;
  next();
}

/* ---------- e-mailová notifikace (volitelná) ---------- */
let transporter = null;
function mailer() {
  if (transporter !== null) return transporter;
  transporter = false;
  if (!process.env.SMTP_HOST) return transporter;
  try {
    transporter = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: (process.env.SMTP_REQUIRE_TLS || 'true') !== 'false',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } catch (e) { console.warn('[mail] nodemailer není nainstalován:', e.message); }
  return transporter;
}
async function notify(q) {
  const t = mailer();
  if (!t) return;
  const text = [
    `Typ: ${q.kind}`, `Předmět: ${q.subject}`, `Jméno: ${q.name}`, `E-mail: ${q.email}`, `Telefon: ${q.phone}`,
    `Preferovaný termín: ${q.preferred_date}`, '', q.message,
  ].join('\n');
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const messages = [t.sendMail({
    from,
    to: CFG.mailTo,
    replyTo: q.email || undefined,
    subject: `Nová poptávka z webu: ${q.kind} – ${q.name.replace(/[\r\n]+/g, ' ')}`,
    text,
  })];
  if (q.email) {
    messages.push(t.sendMail({
      from,
      to: q.email,
      subject: `Potvrzení přijetí zprávy – ${(q.subject || 'Zdeněk Vacek').replace(/[\r\n]+/g, ' ')}`,
      text: [
        `Dobrý den${q.name ? `, ${q.name}` : ''},`, '',
        'děkuji za zprávu. Vaše poptávka byla doručena a ozvu se vám co nejdříve.', '',
        'Kopie vaší zprávy:', text, '', 'Zdeněk Vacek',
      ].join('\n'),
    }));
  }
  const results = await Promise.allSettled(messages);
  results.forEach((result) => {
    if (result.status === 'rejected') console.warn('[mail] odeslání selhalo:', result.reason.message);
  });
}

/* ==========================================================================
   Entity spravovatelné v administraci
   typy: s=text, b=ano/ne, n=číslo, j=JSON pole textů, e:a|b=výběr
   ========================================================================== */
const ENTITIES = {
  lectures: {
    order: 'date DESC, time DESC',
    required: ['name', 'date'],
    fields: { name: 's', date: 's', time: 's', place: 's', available: 'b', link: 's', program_slug: 's' },
  },
  books: {
    order: 'sort, id',
    required: ['slug', 'title'],
    fields: { slug: 's', title: 's', tagline: 's', description: 's', cover: 's', price: 'n', status: 'e:available|soon', sort: 'n' },
  },
  programs: {
    order: 'category, sort, id',
    required: ['slug', 'title', 'category'],
    fields: {
      slug: 's', category: 'e:skoly|cestopisne', title: 's', subtitle: 's', summary: 's', body: 's', cover: 's', gallery: 'j',
      duration: 's', audience: 's', price_note: 's', status: 'e:available|soon', sort: 'n',
    },
  },
  games: {
    order: 'sort, id',
    required: ['slug', 'title'],
    fields: { slug: 's', title: 's', description: 's', author: 's', image: 's', url: 's', status: 'e:available|soon', sort: 'n' },
  },
  testimonials: {
    order: 'sort, id',
    required: ['text'],
    fields: { text: 's', author: 's', sort: 'n' },
  },
};

function cleanFields(def, body, partial) {
  const out = {};
  for (const [k, t] of Object.entries(def.fields)) {
    if (!(k in body)) { if (!partial && def.required.includes(k)) throw new Error(`Chybí pole „${k}“.`); continue; }
    let v = body[k];
    if (t === 's') v = clip(v, 20000);
    else if (t === 'b') v = v ? 1 : 0;
    else if (t === 'n') { v = v === '' || v == null ? null : parseInt(v, 10); if (Number.isNaN(v)) v = null; }
    else if (t === 'j') {
      let arr = v;
      if (typeof v === 'string') { try { arr = JSON.parse(v || '[]'); } catch (_) { arr = v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); } }
      if (!Array.isArray(arr)) throw new Error(`Pole „${k}“ musí být seznam.`);
      v = JSON.stringify(arr.map((x) => clip(x, 300)).filter(Boolean));
    } else if (t.startsWith('e:')) {
      if (!t.slice(2).split('|').includes(v)) throw new Error(`Neplatná hodnota pole „${k}“.`);
    }
    out[k] = v;
  }
  for (const r of def.required) if (!partial && (out[r] == null || out[r] === '')) throw new Error(`Chybí pole „${r}“.`);
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('Datum musí být ve tvaru RRRR-MM-DD.');
  if (out.time && !/^\d{1,2}:\d{2}$/.test(out.time)) throw new Error('Čas musí být ve tvaru HH:MM.');
  return out;
}

/* ==========================================================================
   Express
   ========================================================================== */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  // hry (TurboWarp apod.) potřebují volnější CSP než zbytek webu
  if (!req.path.startsWith('/games')) {
    res.set('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
      "font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  }
  next();
});
app.use(express.json({ limit: '100kb' }));

/* ---------- veřejné API ---------- */
app.get('/api/content', wrap((req, res) => {
  const settings = {};
  for (const r of all('SELECT key, value FROM settings')) settings[r.key] = r.value;
  const parse = (rows) => rows.map((r) => (r.gallery !== undefined ? { ...r, gallery: JSON.parse(r.gallery || '[]') } : r));
  res.set('Cache-Control', 'no-cache');
  res.json({
    settings,
    books: all('SELECT * FROM books ORDER BY sort, id'),
    programs: parse(all('SELECT * FROM programs ORDER BY sort, id')),
    games: all('SELECT * FROM games ORDER BY sort, id'),
    testimonials: all('SELECT * FROM testimonials ORDER BY sort, id'),
  });
}));

app.get('/api/lectures', wrap((req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(all('SELECT * FROM lectures ORDER BY date, time'));
}));

app.get('/api/lectures/:id/ics', wrap((req, res) => {
  const l = one('SELECT * FROM lectures WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!l) return res.status(404).send('Nenalezeno');
  const [h, m] = (l.time || '17:00').split(':').map((x) => parseInt(x, 10));
  const d = l.date.replace(/-/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zdenek Vacek//Web//CS', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:lecture-${l.id}@zdvac`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${pad(h)}${pad(m)}00`, `DTEND:${d}T${pad((h + 2) % 24)}${pad(m)}00`,
    `SUMMARY:${esc(l.name)}`, `LOCATION:${esc(l.place)}`, `DESCRIPTION:${esc('Přednáška Zdeňka Vacka' + (CFG.siteUrl ? ' – ' + CFG.siteUrl : ''))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="prednaska-${l.id}.ics"` });
  res.send(ics);
}));

app.post('/api/inquiries', limiter('inq', 6, 3600e3), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });                       // honeypot
  if (Number(b.t) < 1500) return res.status(400).json({ error: 'Formulář byl odeslán příliš rychle.' });
  const q = {
    kind: ['kniha', 'film', 'foto', 'prednaska', 'rezervace', 'kontakt'].includes(b.kind) ? b.kind : 'kontakt',
    subject: clip(b.subject, 200), name: clip(b.name, 120), email: clip(b.email, 160), phone: clip(b.phone, 40),
    message: clip(b.message, 3000), preferred_date: clip(b.preferred_date, 60),
  };
  if (q.name.length < 2) return res.status(400).json({ error: 'Vyplňte prosím jméno.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q.email) && q.phone.replace(/\D/g, '').length < 9)
    return res.status(400).json({ error: 'Vyplňte prosím platný e-mail nebo telefon.' });
  run('INSERT INTO inquiries (kind, subject, name, email, phone, message, preferred_date) VALUES (?,?,?,?,?,?,?)',
    [q.kind, q.subject, q.name, q.email, q.phone, q.message, q.preferred_date]);
  await notify(q);
  res.json({ ok: true });
}));

app.post('/api/consent', limiter('consent', 30, 3600e3), wrap((req, res) => {
  if (privacyOptOut(req)) return res.json({ ok: true, level: 'necessary', optedOut: true });
  const level = req.body && req.body.level === 'all' ? 'all' : 'necessary';
  run('INSERT INTO consents (level) VALUES (?)', [level]);
  res.json({ ok: true });
}));

app.post('/api/track', limiter('track', 120, 3600e3), wrap((req, res) => {
  const b = req.body || {};
  if (privacyOptOut(req) || !b.consent) return res.json({ ok: true });
  run('INSERT INTO visits (page, device, is_new) VALUES (?,?,?)',
    [clip(b.page, 120) || '/', deviceOf(req.headers['user-agent']), b.isNew ? 1 : 0]);
  res.json({ ok: true });
}));

/* ---------- administrace ---------- */
app.post('/api/admin/login', limiter('login', 8, 15 * 60e3), wrap((req, res) => {
  if (!CFG.adminPass) return res.status(503).json({ error: 'Heslo správce není nastaveno v souboru .env (ADMIN_PASSWORD).' });
  const { username, password } = req.body || {};
  const ok = safeEq(username || '', CFG.adminUser) & passwordOk(password || '');
  if (!ok) return res.status(401).json({ error: 'Nesprávné jméno nebo heslo.' });
  const maxAge = 8 * 3600;
  const token = sign({ u: CFG.adminUser, exp: Date.now() + maxAge * 1000 });
  res.set('Set-Cookie', `zv_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, user: CFG.adminUser });
}));
app.post('/api/admin/logout', (req, res) => {
  res.set('Set-Cookie', 'zv_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => {
  const s = readSession(req);
  res.json(s ? { user: s.u } : { user: null });
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/inquiries', wrap((req, res) => res.json(all('SELECT * FROM inquiries ORDER BY id DESC LIMIT 500'))));
app.patch('/api/admin/inquiries/:id', wrap((req, res) => {
  const status = req.body && req.body.status === 'done' ? 'done' : 'new';
  run('UPDATE inquiries SET status = ? WHERE id = ?', [status, parseInt(req.params.id, 10) || 0]);
  res.json({ ok: true });
}));
app.delete('/api/admin/inquiries/:id', wrap((req, res) => {
  run('DELETE FROM inquiries WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  res.json({ ok: true });
}));

app.get('/api/admin/settings', wrap((req, res) => res.json(all('SELECT key, value FROM settings ORDER BY key'))));
app.put('/api/admin/settings', wrap((req, res) => {
  const body = req.body || {};
  for (const [k, v] of Object.entries(body)) {
    if (!/^[a-z_]{2,40}$/.test(k)) continue;
    db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, clip(v, 20000)]);
  }
  persist();
  res.json({ ok: true });
}));

app.get('/api/admin/stats', wrap((req, res) => {
  res.json({
    daily: all("SELECT date(created_at) AS d, COUNT(*) AS c FROM visits WHERE created_at >= datetime('now','-30 days') GROUP BY d ORDER BY d"),
    pages: all("SELECT page, COUNT(*) AS c FROM visits WHERE created_at >= datetime('now','-30 days') GROUP BY page ORDER BY c DESC LIMIT 10"),
    devices: all("SELECT device, COUNT(*) AS c FROM visits WHERE created_at >= datetime('now','-30 days') GROUP BY device ORDER BY c DESC"),
    totals: one("SELECT COUNT(*) AS visits, COALESCE(SUM(is_new),0) AS newVisitors FROM visits WHERE created_at >= datetime('now','-30 days')"),
    consents: all('SELECT level, COUNT(*) AS c FROM consents GROUP BY level'),
    newInquiries: one("SELECT COUNT(*) AS c FROM inquiries WHERE status = 'new'").c,
  });
}));

app.get('/api/admin/export.sql', wrap((req, res) => {
  const q = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const out = ['-- Záloha databáze webu Zdeňka Vacka', `-- Vytvořeno: ${new Date().toISOString()}`, 'PRAGMA foreign_keys = OFF;', 'BEGIN TRANSACTION;', ''];
  const objs = all("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY (type = 'table') DESC, name");
  for (const o of objs.filter((x) => x.type === 'table')) {
    out.push(o.sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ') + ';');
    for (const r of all(`SELECT * FROM "${o.name}"`)) {
      const cols = Object.keys(r);
      out.push(`INSERT INTO "${o.name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((c) => q(r[c])).join(', ')});`);
    }
    out.push('');
  }
  for (const o of objs.filter((x) => x.type === 'index')) out.push(o.sql.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ') + ';');
  out.push('COMMIT;', '');
  res.set({ 'Content-Type': 'application/sql; charset=utf-8', 'Content-Disposition': `attachment; filename="zdvac-zaloha-${new Date().toISOString().slice(0, 10)}.sql"` });
  res.send(out.join('\n'));
}));

/* generické CRUD: /api/admin/e/:entity */
function entityOf(req, res) {
  const def = ENTITIES[req.params.entity];
  if (!def) { res.status(404).json({ error: 'Neznámá položka.' }); return null; }
  return def;
}
app.get('/api/admin/e/:entity', wrap((req, res) => {
  const def = entityOf(req, res); if (!def) return;
  res.json(all(`SELECT * FROM ${req.params.entity} ORDER BY ${def.order}`));
}));
app.post('/api/admin/e/:entity', wrap((req, res) => {
  const def = entityOf(req, res); if (!def) return;
  try {
    const d = cleanFields(def, req.body || {}, false);
    const cols = Object.keys(d);
    const r = run(`INSERT INTO ${req.params.entity} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => d[c]));
    res.json({ ok: true, id: r.lastId });
  } catch (e) { res.status(400).json({ error: /UNIQUE/.test(e.message) ? 'Takový identifikátor (slug) už existuje.' : e.message }); }
}));
app.put('/api/admin/e/:entity/:id', wrap((req, res) => {
  const def = entityOf(req, res); if (!def) return;
  try {
    const d = cleanFields(def, req.body || {}, true);
    const cols = Object.keys(d);
    if (!cols.length) return res.json({ ok: true });
    run(`UPDATE ${req.params.entity} SET ${cols.map((c) => c + ' = ?').join(', ')} WHERE id = ?`, [...cols.map((c) => d[c]), parseInt(req.params.id, 10) || 0]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: /UNIQUE/.test(e.message) ? 'Takový identifikátor (slug) už existuje.' : e.message }); }
}));
app.delete('/api/admin/e/:entity/:id', wrap((req, res) => {
  const def = entityOf(req, res); if (!def) return;
  run(`DELETE FROM ${req.params.entity} WHERE id = ?`, [parseInt(req.params.id, 10) || 0]);
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Nenalezeno' }));

/* ---------- robots + sitemap ---------- */
const baseUrl = (req) => CFG.siteUrl || `${req.protocol}://${req.get('host')}`;
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', wrap((req, res) => {
  const urls = ['/', '/knihy', '/prednasky', '/kalendar', '/film-foto', '/hry', '/o-mne', '/kontakt', '/soukromi',
    ...all('SELECT slug FROM programs').map((p) => '/prednasky/' + p.slug)];
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${baseUrl(req)}${u}</loc></url>`).join('\n') + '\n</urlset>');
}));

/* ---------- statické soubory ---------- */
const week = { maxAge: '7d' };
app.use('/photos', express.static(path.join(ROOT, 'photos'), week));
app.use('/games', express.static(path.join(ROOT, 'games'), week));
app.use('/assets', express.static(path.join(ROOT, 'dist', 'assets'), { maxAge: '365d', immutable: true }));
app.use(express.static(path.join(ROOT, 'dist'), { index: false, maxAge: '1h' }));
app.use(['/photos', '/games', '/assets'], (req, res) => res.status(404).type('text/plain').send('Soubor nenalezen'));
app.get('*', (req, res) => {
  const index = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(index)) return res.status(503).send('Frontend není sestaven (chybí složka dist/). Spusťte „npm run build“ nebo nahrajte hotovou složku dist.');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(index);
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[chyba]', err);
  res.status(500).json({ error: 'Chyba serveru.' });
});

/* ---------- start ---------- */
function purge() {
  try {
    if (CFG.retentionDays > 0) db.run(`DELETE FROM inquiries WHERE created_at < datetime('now', '-${CFG.retentionDays} days')`);
    db.run("DELETE FROM visits WHERE created_at < datetime('now', '-400 days')");
    persist();
  } catch (e) { console.warn('[purge]', e.message); }
}

(async () => {
  await openDb();
  SECRET = sessionSecret();
  purge();
  setInterval(() => { refreshDb(); purge(); }, 24 * 3600e3).unref();
  app.listen(CFG.port, () => {
    console.log(`[web] Běží na portu ${CFG.port}`);
    if (!CFG.adminPass) console.warn('[web] POZOR: ADMIN_PASSWORD není nastaveno – administrace je vypnutá.');
  });
})().catch((e) => { console.error(e); process.exit(1); });
