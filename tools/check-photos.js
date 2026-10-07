/* Zkontroluje, které fotografie uvedené v databázi chybí ve složce photos/.
   Spuštění:  node tools/check-photos.js */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
(async () => {
  const SQL = await initSqlJs();
  const file = path.join(__dirname, '..', 'data', 'zdvac.sqlite');
  if (!fs.existsSync(file)) return console.log('Databáze ještě neexistuje – nejdřív aspoň jednou spusťte server.');
  const db = new SQL.Database(fs.readFileSync(file));
  const rows = (sql) => { const r = db.exec(sql); return r.length ? r[0].values.map((v) => v[0]) : []; };
  const want = new Set();
  rows("SELECT value FROM settings WHERE key IN ('hero_image','about_portrait')").forEach((v) => want.add(v));
  rows('SELECT cover FROM books').forEach((v) => want.add(v));
  rows('SELECT cover FROM programs').forEach((v) => want.add(v));
  rows('SELECT gallery FROM programs').forEach((g) => JSON.parse(g || '[]').forEach((v) => want.add(v)));
  rows('SELECT image FROM games').forEach((v) => want.add(v));
  let missing = 0;
  for (const p of [...want].filter(Boolean).sort()) {
    if (!fs.existsSync(path.join(__dirname, '..', 'photos', p))) { missing++; console.log('CHYBÍ  photos/' + p); }
  }
  console.log(missing ? `\nChybí ${missing} souborů (web zatím zobrazuje barevné zástupné obrázky).` : 'Všechny fotografie jsou na místě.');
})();
