-- ============================================================================
--  Databáze webu Zdeňka Vacka  (SQLite syntaxe, UTF-8)
--  Tento soubor se při PRVNÍM spuštění serveru automaticky načte a vytvoří
--  soubor data/zdvac.sqlite. Chcete-li začít od nuly: smažte data/zdvac.sqlite
--  a restartujte aplikaci.
--  Obsah (knihy, přednášky, hry, texty) můžete upravovat i v administraci /admin.
-- ============================================================================
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',          -- cesta uvnitř složky photos/
  price       INTEGER,                           -- Kč, NULL = cena neuvedena
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','soon')),
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE programs (                          -- nabídka přednášek
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL CHECK (category IN ('skoly','cestopisne')),
  title       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',          -- odstavce oddělené prázdným řádkem
  cover       TEXT NOT NULL DEFAULT '',
  gallery     TEXT NOT NULL DEFAULT '[]',        -- JSON pole cest uvnitř photos/
  duration    TEXT NOT NULL DEFAULT '',
  audience    TEXT NOT NULL DEFAULT '',
  price_note  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','soon')),
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE lectures (                          -- kalendář termínů
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  date          TEXT NOT NULL,                   -- RRRR-MM-DD
  time          TEXT NOT NULL DEFAULT '17:00',   -- HH:MM
  place         TEXT NOT NULL DEFAULT '',
  available     INTEGER NOT NULL DEFAULT 1,      -- 1 = volno, 0 = obsazeno
  link          TEXT NOT NULL DEFAULT '',
  program_slug  TEXT NOT NULL DEFAULT ''         -- propojení s programs.slug (volitelné)
);

CREATE TABLE games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',          -- např. /games/hra.html ; prázdné = již brzy
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','soon')),
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE testimonials (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  text   TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  sort   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE inquiries (                         -- objednávky a dotazy z formulářů
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  kind           TEXT NOT NULL,                  -- kniha | film | foto | prednaska | rezervace | kontakt
  subject        TEXT NOT NULL DEFAULT '',
  name           TEXT NOT NULL,
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  message        TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','done')),
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consents (                          -- souhlas s cookies (bez IP adres)
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL,                      -- all | necessary
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visits (                            -- anonymní statistiky (jen se souhlasem)
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT NOT NULL,
  device     TEXT NOT NULL DEFAULT '',
  is_new     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lectures_date  ON lectures (date);
CREATE INDEX idx_inquiries_stat ON inquiries (status, created_at);
CREATE INDEX idx_visits_created ON visits (created_at);

-- ---------------------------------------------------------------------------
--  OBSAH
-- ---------------------------------------------------------------------------

INSERT INTO settings (key, value) VALUES ('site_name', 'Zdeněk Vacek');
INSERT INTO settings (key, value) VALUES ('tagline', 'Cestovatel, autor a vypravěč');
INSERT INTO settings (key, value) VALUES ('phone', '605 889 550');
INSERT INTO settings (key, value) VALUES ('email', 'zd.vac@seznam.cz');
INSERT INTO settings (key, value) VALUES ('facebook', 'https://www.facebook.com/profile.php?id=61574111846111');
INSERT INTO settings (key, value) VALUES ('hero_image', 'hero/uvod.jpg');
INSERT INTO settings (key, value) VALUES ('about_portrait', 'portrait/tojsemja.jpg');
INSERT INTO settings (key, value) VALUES ('about_text', 'Jsem Zdeněk Vacek, vášnivý cestovatel a autor. Mým cílem je inspirovat ostatní k objevování krás světa.

Na svých cestách se snažím zachytit nejen krásy přírody, ale i kulturu a tradice různých zemí. Z cest autostopem po Norsku, Švédsku a Finsku za polárním kruhem, po Spojených státech i po Azorských ostrovech vznikly knihy, fotografie, filmy a přednášky, které rád předávám dál – ve školách, knihovnách i na besedách pro veřejnost.

Přednáším také o včelách a o planetě Zemi pro děti a školy v Plzni a okolí.');
INSERT INTO settings (key, value) VALUES ('notice_text', '');
INSERT INTO settings (key, value) VALUES ('notice_link', '');
INSERT INTO settings (key, value) VALUES ('privacy_email', 'zd.vac@seznam.cz');

INSERT INTO books (slug, title, tagline, description, cover, price, status, sort) VALUES ('bore-bejvi', 'Bore Bejvi', 'Náš život je tak bohatý, jak ho dokážeme naplnit. To, co prožijeme, je jediné bohatství, které máme.', 'Popis knihy bude přidán již brzy! Máte se na co těšit.', 'books/bejvifr.jpg', NULL, 'soon', 1);
INSERT INTO books (slug, title, tagline, description, cover, price, status, sort) VALUES ('krajinou-mych-snu', 'Krajinou mých snů', 'Život je plný každodenních zázraků, které nás obklopují. Bez nich by neexistoval Život na planetě Zemi a ani Vědomí, které nám dává dar Vidění.', 'Příběh z cesty autostopem po Spojených státech – od Black Hills ve Wyomingu přes Badlands a rezervaci Pine Ridge až po pobřeží Kalifornie. Zážitků z cest je hodně a co se nevešlo do přednášky, se dočtete právě v této knize.', 'books/kmsfr.jpg', NULL, 'available', 2);
INSERT INTO books (slug, title, tagline, description, cover, price, status, sort) VALUES ('jeste-videt-inari', 'Ještě vidět Inari', 'Lidi ani situace v životě nepotkáváme náhodou. Náhoda je jen to, že si to někdo může myslet.', 'Kniha o cestách autostopem za polárním kruhem – k největšímu jezeru Inari a k národu Sámi, který tam žije už přes dvanáct tisíc let.', 'books/fr.jpg', NULL, 'available', 3);

INSERT INTO programs (slug, category, title, subtitle, summary, body, cover, gallery, duration, audience, price_note, status, sort) VALUES ('vcela-zaklad-zivota', 'skoly', 'Včela Základ Života', 'Přednáška pro žáky ZŠ a starší děti MŠ', 'Proč jsou včely důležité pro člověka i pro celý život na Zemi – s vlastními fotografiemi, krátkými filmy a vyzkoušením včelařské kukly.', 'Přednáška Včela základ života je určena pro žáky ZŠ a starší děti MŠ. Je vždy přizpůsobena věku školáků ve třídě. Tématem je důležitost včel pro člověka a celého života na Zemi.

Žáci se dozví přes různé zajímavosti, jak například včely komunikují s květy, o životě ve včelím úlu a co se vše v něm odehrává. Povíme si také o čmelácích a jiném užitečném hmyzu. Součástí přednášky je i ukázka, jak reagovat na včely, nebo při procházkách na včelí roj, abychom nedostali žihadlo. Na závěr se krátce podíváme na školní zahradu do včelařského kroužku na ZŠ v Plzni Na Dlouhých, jak včelaří školáci. Vyprávění je doprovázeno vlastními fotografiemi a krátkými filmy.

Už proběhlo mnoho přednášek na ZŠ i MŠ v Plzni a okolí, na příměstských táborech, na školní zahradě u skleněného úlu a na Včelí stezce v arboretu Sofronka v Plzni-Bolevci. Zájem dětí o přednášky je velký a mají hodně otázek v průběhu i po skončení.

Přednáška je rozdělena na dvě vyučovací hodiny. První hodinu je vyprávění o životě včel, které tvoří jeden organismus, s doprovodem fotek a krátkých filmů. Dále následuje ukázka, jak reagovat na včely, abychom předešli bodnutí, a ještě jak pomoci včelám a čmelákům, i když je nechováme. Druhou hodinu se žáci ve třídě rozdělí na skupiny. Jedna skupina si vyzkouší včelařit s kuklou na malém úlu beze včel a ostatní zatím hledají odpovědi na otázky o včelách a plní různé úkoly, které jsou uzpůsobeny podle věku žáků.', 'vcela/DSC_0035.JPG', '["vcela/DSC_0035.JPG", "vcela/1aa_0117.JPG", "vcela/DSC_0001.JPG", "vcela/DSC_0033.JPG", "vcela/DSC_0049.JPG", "vcela/DSC_0054.JPG", "vcela/DSC_0109.JPG", "vcela/DSC_0115.JPG"]', '2 vyučovací hodiny', 'ZŠ a starší děti MŠ', 'Cena po telefonické domluvě – podle cestovného z Plzně a počtu žáků. Nejlépe dvě až tři přednášky v jeden den na jedné škole.', 'available', 1);
INSERT INTO programs (slug, category, title, subtitle, summary, body, cover, gallery, duration, audience, price_note, status, sort) VALUES ('planeta-zeme', 'skoly', 'Planeta Země', 'Vyprávění o propojení čtyř živlů pro ZŠ i SŠ', 'Země je obrovský živý organismus, ve kterém my lidé žijeme. Čtyři živly, včely, houby, stromy – a hlavolam, ve kterém žáci hledají odpovědi.', 'Vyprávění o planetě Zemi pro školy i střední školy doprovází fotky a krátké filmy. Dozvíme se, jak je vše vzájemně propojeno, protože Země je obrovský živý organismus, ve kterém my lidé žijeme.

Přednáška je pro všechny ročníky základních i středních škol a je vždy přizpůsobena věku posluchačů – proběhla už ve všech ročnících na ZŠ. Trvá 2 vyučovací hodiny s přestávkou. V první hodině je vyprávění o propojení čtyř živlů Země, které doprovází vlastní fotografie a krátké filmy z cest. V druhé hodině skládají žáci ve skupinách hlavolam a hledají odpovědi na otázky, jejichž odpovědi zazněly v přednášce. Na konci si otázky vyhodnotíme a povíme si ještě některé zajímavosti, které s odpověďmi souvisí.

Téma přednášky je o souvislostech, které se na naší planetě odehrávají každý den a bez kterých by neexistoval život. Naši planetu ovládají čtyři živly: země, oheň, voda a vzduch. Každé semínko, aby v něm vznikl život, potřebuje dát do země, pak zalít vodou, zahřát ohněm (světlo a teplo) a potom ještě vzduch, aby se v něm zrodil život. Je to kouzelná planeta. Nebo snad znáte jinou planetu, kde rostou stromy, kvetou květiny, zpívají ptáci, ve vodě plavou ryby a po souši se procházejí zvířata a lidé?

Vše je tu vzájemně propojeno. Každé ráno od severního polárního kruhu k jižnímu se zvedne tolik včel, jako je hvězd v naší Galaxii, aby daly lidem na celé planetě ovoce a zeleninu. A nejen nám, ale všem zvířatům i mikroorganismům, které vytváří život na Zemi. Stromy a rostliny vydechují to, co my vdechujeme, a zadržují vodu v krajině. Houby mají propletené podhoubí jemnými vlákny, rozprostřené pod zemí na hektarech i kilometrech čtverečních. Pomáhají rozkládat staré dřevo na úrodnou půdu, filtrují a čistí zem, dávají výživu všem stromům a rostlinám. Jsou to citlivé organismy a chemické postřiky je snadno zničí.

Strom nejde vyměnit jako lampa na ulici. Je to celé společenství živočichů. Žijí tam ptáci, brouci, housenky motýlů, hmyz, mechy, lišejníky a kolem kořenů je upředena obrovská síť hub. Poražením stromu mizí celé toto společenství, a neměli bychom proto kácet stromy zbytečně. Vykácením pralesa zmizí celý svět zvířat a organismů. Přírodní národy si tohle uvědomují a žijí v souladu s přírodou. Neberou si z ní více, než potřebují, a uchovávají zemi i pro další generace. Můžeme se od nich mnohé naučit.

Každý den se na Zemi odehrávají zázraky, které můžeme objevovat a pozorovat. Co se odehrává na Zemi, neuvidíte na žádné jiné známé planetě. Stačí se jen rozhlédnout kolem sebe. Na rozkvetlých loukách uvidíte sbírat nektar a pyl včely, čmeláky, motýly i jiný hmyz. V lese zase zpívají ptáci, mravenci čistí les, můžete nasbírat houby a spoustu dobrých plodů. V čistých studánkách pramení voda přímo ze země, která je mnohem lepší než voda z vodovodu.

Všech těchto darů bychom si měli vážit, protože je potřebujeme k životu. Jak se budeme starat o přírodu, tak se ona postará o nás. Jsme částí Země a ona je částí nás.', 'planeta/vyhledz.JPG', '["planeta/vyhledz.JPG", "planeta/thebestz.JPG", "planeta/cervenahoraz.JPG", "planeta/firez.JPG", "planeta/houbaz.JPG", "planeta/skalyz.JPG", "planeta/zviratahory.jpg"]', '2 vyučovací hodiny s přestávkou', 'všechny ročníky ZŠ a SŠ', 'Cena po domluvě – odvíjí se od počtu žáků a vzdálenosti od Plzně. Lepší je udělat dvě až tři přednášky v jeden den.', 'available', 2);
INSERT INTO programs (slug, category, title, subtitle, summary, body, cover, gallery, duration, audience, price_note, status, sort) VALUES ('krajinou-mych-snu', 'cestopisne', 'Krajinou mých snů', 'Volání Mato Tipila – autostopem po USA', 'Autostopem po Black Hills, Badlands a rezervací Pine Ridge až do Wounded Knee – bez řidičského průkazu, mobilu a kreditní karty.', 'Přednáška z cesty autostopem po Black Hills ve Wyomingu, kaňonem Sand Creek, vydáme se za bizony do Badlands a pak pojedeme s Indiánem kmene Lakotů rezervací Pine Ridge a k památníku kmene Lakotů ve Wounded Knee v Jižní Dakotě. Vrátíme se Greyhoundem do San Franciska a na závěr projedeme autostopem po pobřeží Kalifornie až na řeku Russian River.

Cestovat po USA bez řidičského průkazu, mobilního telefonu a kreditní karty přinese více dobrodružství, než by člověk očekával. Když vám ale pomůže anděl strážný, všechno dopadne lépe, než si vůbec dokážete představit.

Nejdříve se na chvíli zastavíme na pobřeží Kalifornie a pak se vydáme nejdříve dálkovými autobusy a pak autostopem ze San Franciska přes státy Oregon, Washington, Idaho, Montanu a Wyoming až do Jižní Dakoty. Autostopem pojedeme k posvátné hoře Lakotů Mato Tipila a díky šťastné náhodě dále do kaňonu Sand Creek, kde procestujeme Black Hills, přesuneme se do Badlands a projdeme se krajinou bývalého mořského dna. Země bizonů a chřestýšů.

V Rapid City potkám jednu lakotskou ženu, která mi domluví cestu po indiánské rezervaci Pine Ridge, a nakonec dojedu až do Wounded Knee. Randy mě pak veze zpět na autobus do Rapid City a odtud se vrátíme do Kalifornie. Projedeme si ještě nádherné kalifornské pobřeží až k ústí řeky Russian River.

Zážitků z cest je hodně a co se nevešlo do přednášky, se můžete dočíst v knize Krajinou mých snů.', 'usa/KMSBG.JPG', '["usa/KMSBG.JPG", "usa/DSC_0088r.jpg", "usa/FSC_0239cb.jpg", "usa/FSC_0555.JPG", "usa/xd123.JPG"]', 'cca 2 hodiny', 'knihovny, kluby, veřejnost', 'Cena a termín po domluvě.', 'available', 3);
INSERT INTO programs (slug, category, title, subtitle, summary, body, cover, gallery, duration, audience, price_note, status, sort) VALUES ('azorske-ostrovy', 'cestopisne', 'Azorské ostrovy', 'Ostrovy sopek, hortenzií a barevných květů', 'São Miguel, Flores a Corvo – od moře přes kaňony až po hory a sopky. Dvě hodiny s vlastními fotografiemi a krátkými filmy.', 'Objevte fascinující svět Azorských ostrovů! Od krásy přírodní, společenskou až po architektonickou. Přednáška vás provede od moře přes kaňony až po hory a sopky.

Ostrovy sopek, hortenzií a barevných květů. Dnes navštívíme São Miguel, Flores a Corvo. Přednáška trvá dvě hodiny a je doprovázena vlastními fotografiemi a krátkými filmy.

Nejdříve se vydáme do kráteru sopky v oblasti Sete Cidades, kde půjdeme na trail po hřebenu sopky v oblasti Boca do Inferno. Vykoupeme se také v sopečných termálních pramenech v moři v Termas da Ferraria. Z hlavního města Ponta Delgada se pak vydáme na moře za velrybami a delfíny. Setkání s velrybami a hravými delfíny zanechá v každém nádherné pocity. Po návratu z výletu se podíváme na druhý konec ostrova do Nordeste a projdeme se po pobřeží s divokými vlnami.

Po návratu do hlavního města Ponta Delgada se letecky přesuneme na nejvzdálenější ostrov Flores, kde se projdeme k vodopádům poblíž Fajã Grande a podíváme se do hlavního města ostrova Santa Cruz das Flores. Motorovým člunem přejedeme na malý ostrov Corvo a z městečka Vila do Corvo vystoupáme až na vrchol sopky. Návrat na ostrov Flores zkomplikuje mořská bouře a návrat na hlavní ostrov a domů je ohrožen.

Azorské sopečné ostrovy ovlivňuje Golfský proud a teplota je stabilní ve dne i v noci. Časté přeháňky a teplé počasí způsobují, že ostrov je plný květů a převažují hortenzie s obrovskými květy. Na ostrovech nepotkáte nebezpečná zvířata, hady ani pavouky.', 'azory/AZORY1.JPG', '["azory/AZORY1.JPG", "azory/tahlavni.JPG"]', '2 hodiny', 'knihovny, kluby, veřejnost', 'Cena a termín po domluvě.', 'available', 4);
INSERT INTO programs (slug, category, title, subtitle, summary, body, cover, gallery, duration, audience, price_note, status, sort) VALUES ('zeme-pulnocniho-slunce', 'cestopisne', 'Země půlnočního slunce', 'Pět cest autostopem za polárním kruhem', 'Lofoty, fjordy, tajga, tundra, jezero Inari i Nordkapp – a setkání s národem Sámi, který tam žije přes 12 tisíc let.', 'Vyprávění z pěti cest autostopem po nejodlehlejších oblastech Norska, Švédska a Finska za polárním kruhem. Setkáme se i s národem Sámi, který tam žije přes 12 tisíc let.

Podíváme se na Lofotské ostrovy, překrásné norské fjordy, procestujeme neobydlenou tajgu a tundru až k ruské hranici, kde se nachází největší jezero Inari, a zavítáme i na nejsevernější bod Evropy Nordkapp. Cestou navštívíme mnoho krásných míst nádherné severské přírody a dozvíme se zajímavosti ze života národa Sámi.

Cestovat autostopem s prázdnou kapsou může pro někoho znamenat omezení, ale mně to pomohlo poznat hlouběji lidi a navštívit místa, o kterých turisté ani nevědí. Pojďme se vydat na cestu, kde všechno dopadne lépe, než si vůbec dokážu představit.

Přednáška je doprovázena fotografiemi a krátkými filmy.', 'sever/cover.jpg', '[]', 'cca 2 hodiny', 'knihovny, kluby, veřejnost', 'Cena a termín po domluvě.', 'available', 5);

-- Kalendář termínů je na začátku prázdný – přidejte termíny v administraci (/admin → Kalendář).
-- Příklad ručního vložení:
-- INSERT INTO lectures (name, date, time, place, available, link, program_slug)
--   VALUES ('Azorské ostrovy', '2026-11-12', '17:00', 'Knihovna, Plzeň', 1, '', 'azorske-ostrovy');

INSERT INTO games (slug, title, description, author, image, url, status, sort) VALUES ('pozornost', 'Hra o pozornosti', 'Zbrusu nová hra od Michala Schneidera, která vám hezky procvičí pozornost, postřeh i zrak! Najdete odlišný odstín dříve, než vyprší limit? A zvládnete různé obtížnosti?', 'Michal Schneider', 'games/nahledhrap.png', '/games/pozornost/index.html', 'available', 1);
INSERT INTO games (slug, title, description, author, image, url, status, sort) VALUES ('flappybee', 'FlappyBee', 'Klasika tohoto webu – ovládej včelku tak, aby nenarazila! Hru zahájíš zelenou vlaječkou (po prohře ji stiskni dvakrát).', 'Michal Schneider a kamarádi ze studia (Scratch → TurboWarp)', 'games/beepr.png', '/games/hra.html', 'available', 2);
INSERT INTO games (slug, title, description, author, image, url, status, sort) VALUES ('editor-vlocek', 'Editor vloček', 'Je vaším snem mít vlastní vločku, ale vaše obratnost na PC není taková? Vyzkoušejte náš editor vloček.', 'Michal Schneider', 'games/hravlockap.png', '/games/vanoce/index.html', 'available', 3);
INSERT INTO games (slug, title, description, author, image, url, status, sort) VALUES ('vanocni-detektivka', 'Vánoční detektivka', 'Zachraňte letošní Vánoce vyřešením zajímavých (nejen) hádanek a šifer!', 'Michal Schneider', 'games/detektivka.png', '/games/detektivka/index.html', 'available', 4);
INSERT INTO games (slug, title, description, author, image, url, status, sort) VALUES ('nova-hra', 'Nová hra?!', 'Chcete být součástí týmu mladých vývojářů a mít na internetu vlastní hru? Již brzy se zde dozvíte, co pro to udělat – a je to ZCELA ZDARMA!', '', '', '', 'soon', 5);

INSERT INTO testimonials (text, author, sort) VALUES ('Skvělé přednášky pro všechny generace – jak lidsky, tak obsahově.', 'Michal, účastník přednášky', 1);
INSERT INTO testimonials (text, author, sort) VALUES ('Úžasné zážitky a inspirace z cest!', '', 2);

COMMIT;
