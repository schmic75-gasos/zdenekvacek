/*
 * Create responsive-size, high-quality WebP copies next to photos.
 * Originals stay untouched and remain the fallback for browsers that do not
 * support WebP. Requires ImageMagick (`magick`) on the machine running it.
 * Usage: node tools/optimize-photos.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const initSqlJs = require('sql.js');

const ROOT = path.join(__dirname, '..', 'photos');
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const WORKERS = 2;
let savedBytes = 0;
let converted = 0;
let failed = 0;

function isWebp(file) {
  try {
    const header = Buffer.alloc(12);
    const fd = fs.openSync(file, 'r');
    try { if (fs.readSync(fd, header, 0, header.length, 0) !== header.length) return false; }
    finally { fs.closeSync(fd); }
    return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  } catch (_) { return false; }
}

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(file);
    return entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [file] : [];
  });
}

function convert(input) {
  const output = `${input}.webp`;
  const original = fs.statSync(input);
  try {
    if (fs.statSync(output).mtimeMs >= original.mtimeMs && isWebp(output)) return Promise.resolve(false);
    fs.unlinkSync(output);
  } catch (_) { /* output does not exist yet */ }

  return new Promise((resolve) => {
    const child = spawn('magick', [input, '-auto-orient', '-resize', '2560x2560>', '-quality', '88', '-define', 'webp:method=6', output], {
      env: { ...process.env, MAGICK_THREAD_LIMIT: '1', OMP_NUM_THREADS: '1' },
    });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', (err) => { console.error(`CHYBA ${path.relative(ROOT, input)}: ${err.message}`); failed++; resolve(false); });
    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`CHYBA ${path.relative(ROOT, input)}: ${error.trim() || `ImageMagick skončil s kódem ${code}`}`);
        failed++;
        try { fs.unlinkSync(output); } catch (_) { /* žádný neúplný soubor */ }
        resolve(false);
        return;
      }
      savedBytes += original.size - fs.statSync(output).size;
      converted++;
      if (converted % 50 === 0) console.log(`Hotovo ${converted} fotografií…`);
      resolve(true);
    });
  });
}

async function main() {
  if (!fs.existsSync(ROOT)) throw new Error(`Složka nebyla nalezena: ${ROOT}`);
  const dbFile = path.join(__dirname, '..', 'data', 'zdvac.sqlite');
  let files;
  if (process.argv.includes('--all')) {
    files = filesIn(ROOT);
  } else {
    if (!fs.existsSync(dbFile)) throw new Error('Databáze ještě neexistuje. Nejdřív spusťte server, nebo použijte přepínač --all.');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(dbFile));
    const values = [];
    const collect = (sql) => {
      const result = db.exec(sql);
      if (result.length) result[0].values.forEach((row) => row.forEach((value) => {
        if (typeof value !== 'string') return;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) values.push(...parsed.filter((item) => typeof item === 'string'));
          else values.push(value);
        } catch (_) { values.push(value); }
      }));
    };
    collect("SELECT value FROM settings WHERE key IN ('hero_image','about_portrait')");
    collect('SELECT cover FROM books');
    collect('SELECT cover, gallery FROM programs');
    collect('SELECT image FROM games');
    db.close();
    files = [...new Set(values.map((value) => {
      if (/^(https?:)?\/\//i.test(value)) return null;
      const relative = value.replace(/^\/?photos\//i, '').replace(/^\//, '');
      const file = path.resolve(ROOT, relative);
      return file.startsWith(`${ROOT}${path.sep}`) && EXTENSIONS.has(path.extname(file).toLowerCase()) && fs.existsSync(file) ? file : null;
    }).filter(Boolean))];
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (cursor < files.length) await convert(files[cursor++]);
  }));
  console.log(`Vytvořeno ${converted} WebP variant, přeskočeno ${files.length - converted - failed}, chyb ${failed}.`);
  console.log(`Odhadovaná úspora při načítání: ${(savedBytes / 1024 / 1024).toFixed(1)} MB.`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
