# Web Zdeňka Vacka – nová verze

React (vykreslení webu) + Node.js/Express (server) + databáze v jednom SQL souboru.
Žádné nativní moduly, nic se nekompiluje na serveru, ROOT nepotřebujete.

## Struktura složek (to celé nahrajete na server)

```
zdvac/                      ← kořen aplikace (Application root)
├── server.js               ← spouštěcí soubor (Startup file)
├── package.json
├── .env                    ← vytvoříte z .env.example (hesla, SMTP)
├── node_modules/           ← balíčky serveru (v ZIPu už jsou; jinak "npm install --omit=dev")
├── dist/                   ← HOTOVÝ web (sestavený React) – nic v něm needitujte
├── database/
│   └── zdvac.sql           ← čitelný SQL soubor s veškerým obsahem webu
├── data/
│   └── zdvac.sqlite        ← vznikne SAMO při prvním spuštění; to je ŽIVÁ databáze
├── photos/                 ← VŠECHNY FOTKY (viz tabulka níže)
├── games/                  ← hry (hra.html + složky pozornost, vanoce, detektivka)
├── tools/check-photos.js   ← ukáže, jaké fotky ještě chybí
└── client/                 ← zdrojový kód webu (jen když chcete web upravovat)
```

## Nasazení krok za krokem (typický hosting s Node.js, např. cPanel „Setup Node.js App“)

1. Rozbalte ZIP a nahrajte obsah složky `zdvac/` do složky mimo veřejné `public_html` (např. `~/zdvac`).
2. V administraci hostingu vytvořte Node.js aplikaci: **Application root** = `zdvac`, **Startup file** = `server.js`, **Mode** = production, Node 18 nebo novější.
3. V souboru `.env` (zkopírujte `.env.example`) nastavte heslo správce a SMTP přihlašovací údaje. SMTP používá `smtp.rosti.cz:587` se STARTTLS; heslo nikdy nevkládejte do zdrojového kódu. Hash hesla správce vygenerujete příkazem `node server.js hash "NoveHeslo"` (v terminálu hostingu), nebo prostě napište heslo přímo.
4. Nahrajte fotky do složky `photos/` podle tabulky níže.
5. Spusťte (Restart) aplikaci. Při prvním startu se sama vytvoří databáze `data/zdvac.sqlite` ze souboru `database/zdvac.sql`.
6. Otevřete `https://vase-domena.cz/admin`, přihlaste se a doplňte kalendář termínů.

Pokud hosting nemá tlačítko pro spuštění, stačí `node server.js` (nebo `npm start`) a proxy z Apache/Nginx na port z `.env`.

## Kam s fotkami (složka `photos/`)

| Složka | Soubory (ze starého webu) |
|---|---|
| `photos/hero/` | `uvod.jpg` – hlavní úvodní fotka (třeba původní `Baumit_Blog_vcela1.jpg`, přejmenovaná) |
| `photos/portrait/` | `tojsemja.jpg` |
| `photos/books/` | `bejvifr.jpg`, `kmsfr.jpg`, `fr.jpg` |
| `photos/vcela/` | `DSC_0035.JPG`, `1aa_0117.JPG`, `DSC_0001.JPG`, `DSC_0033.JPG`, `DSC_0049.JPG`, `DSC_0054.JPG`, `DSC_0109.JPG`, `DSC_0115.JPG` (dřív složka `VZZfoto`) |
| `photos/planeta/` | `vyhledz.JPG`, `thebestz.JPG`, `cervenahoraz.JPG`, `firez.JPG`, `houbaz.JPG`, `skalyz.JPG`, `zviratahory.jpg` |
| `photos/usa/` | `KMSBG.JPG`, `DSC_0088r.jpg`, `FSC_0239cb.jpg`, `FSC_0555.JPG`, `xd123.JPG` (dřív složka `fotky`) |
| `photos/azory/` | `AZORY1.JPG`, `tahlavni.JPG` (dřív `AZORYFOTOZDVAC`) |
| `photos/sever/` | `cover.jpg` – fotka pro „Země půlnočního slunce“ (na starém webu žádná nebyla) |
| `photos/games/` | `beepr.png`, `hravlockap.png`, `nahledhrap.png`, `detektivka.png` (náhled detektivky – původní byl cizí obrázek z internetu, dodejte vlastní) |

Velikost fotek: ideálně do ~400 kB na kus (šířka 1600–2000 px). Velké originály z foťáku web zbytečně zpomalí.
Jiné názvy nebo cesty můžete kdykoli změnit v administraci (záložky Přednášky, Knihy, Hry, Nastavení).
Kontrola: `node tools/check-photos.js` vypíše, co ještě chybí. Do té doby web zobrazuje barevné zástupné obrázky.

## Hry (složka `games/`)

- `games/hra.html` (FlappyBee) je už přibalená.
- Složky `pozornost/`, `vanoce/` a `detektivka/` (včetně jejich `index.html`) nebyly v nahraných souborech – zkopírujte je ze starého webu do `games/`.
  Dokud tam nejsou, přepněte jejich stav v administraci na „Již brzy“.

## Administrace `/admin`

Poptávky z formulářů, kalendář termínů, přednášky, knihy, hry, ohlasy, texty a kontakty, statistiky a stažení zálohy databáze (.sql).
Veřejný web se změní okamžitě, nic se nenahrává ani nestaví.

## Databáze

- `database/zdvac.sql` – čitelný SQL soubor (struktura + výchozí obsah). Slouží jako zdroj pravdy a pro obnovu.
- `data/zdvac.sqlite` – živá databáze. **Zálohujte ji** (admin → Záloha, nebo stáhněte soubor).
- Začít znovu od nuly: smažte `data/zdvac.sqlite` a restartujte aplikaci.
- Obnova ze zálohy: zálohový `.sql` soubor nahraďte `database/zdvac.sql`, smažte `data/zdvac.sqlite`, restart.

## Úpravy kódu webu (jen pokud potřebujete)

```
cd client
npm install
npm run build        # vytvoří ../dist
```
Celý frontend je v jediném souboru `client/src/App.jsx`, styly v `client/src/styles.css`.
Server je jediný soubor `server.js`.

### Optimalizace fotografií

Web načítá vedle originálů také WebP varianty v kvalitě 88 a s nejdelší stranou do 2560 px. Originály zůstávají zachované jako záloha. Po výměně fotek nebo změně obsahu databáze vytvořte varianty příkazem `npm run optimize:photos` z kořene projektu (vyžaduje ImageMagick). Přepínač `--all` převede celou složku `photos/`; bez něj se převádějí jen snímky, které web právě používá.

## Bezpečnost

- Heslo správce je jen v `.env` (nikdy ne v kódu). Soubor `.env` a `data/` nesmí být dostupné z webu – proto aplikaci nahrávejte mimo `public_html`.
- Formuláře mají ochranu proti robotům (neviditelné pole, časová kontrola, limit odesílání).
- IP adresy se neukládají. Statistiky jen po souhlasu. Poptávky se po 90 dnech samy mažou (`RETENTION_DAYS`).

### E-mailové notifikace

Po odeslání poptávky přijde zákazníkovi potvrzení na zadaný e-mail a oznámení se odešle na adresy `MAIL_TO`. SMTP nastavení je v `.env.example`; skutečné heslo patří pouze do lokálního `.env` nebo do tajné konfigurace hostingu. Port 587 používá STARTTLS (`SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`).

### Do Not Track a Global Privacy Control

Pokud prohlížeč signalizuje Do Not Track (`DNT: 1`) nebo Global Privacy Control (`Sec-GPC: 1`), web automaticky ponechá jen nezbytné funkce, nezobrazí výzvu ke statistikám a nebude zaznamenávat souhlas ani návštěvy. Server tyto signály ověřuje také přímo na API, takže měření zablokuje i při ručně odeslaném požadavku.
