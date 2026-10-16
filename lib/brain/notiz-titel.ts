// ─── Brain · Anzeigename einer Notiz (Abnahme 15.10. C19, rein) ─────────────────────────────────────────────────────────
// Angezeigt wird der Titel aus dem Kopf (`title:`/`titel:`), sonst die erste Überschrift „# …“, sonst der Dateiname — lesbar gemacht:
// Bindestriche/Unterstriche → Leerzeichen, Umschreibungen (ue/oe/ae) nur dort zu Umlauten, wo es sicher ist (feste Wortstämme, kein
// Raten: „aktuell“, „zuerst“, „Steuer“ bleiben, wie sie sind). Der Dateiname bleibt der Schlüssel für [[Wikilinks]] (`Notiz.titel`).

const MAX = 120;

/** Wortstämme, deren Umschreibung immer ein Umlaut ist — überall im Wort (auch in Zusammensetzungen). */
const STAEMME: readonly [string, string][] = [
  ['gruend', 'gründ'], ['pruef', 'prüf'], ['rueck', 'rück'], ['kuendig', 'kündig'], ['buero', 'büro'], ['fuehr', 'führ'],
  ['gebuehr', 'gebühr'], ['moeglich', 'möglich'], ['loesung', 'lösung'], ['oeffn', 'öffn'], ['aender', 'änder'], ['taeglich', 'täglich'],
  ['bestaetig', 'bestätig'], ['schluess', 'schlüss'], ['geschaeft', 'geschäft'], ['naechst', 'nächst'], ['koenn', 'könn'], ['muess', 'müss'],
];
/** Nur am Wortanfang (in der Wortmitte mehrdeutig). */
const ANFANG: readonly [string, string][] = [['ueber', 'über'], ['uebung', 'übung'], ['aerger', 'ärger']];
/** Nur als ganzes Wort. */
const GANZ: Readonly<Record<string, string>> = { fuer: 'für', ueber: 'über' };

const wieVorher = (alt: string, neu: string) => (alt[0] && alt[0] !== alt[0].toLowerCase() ? neu[0].toUpperCase() + neu.slice(1) : neu);

function wortMitUmlauten(wort: string): string {
  const klein = wort.toLowerCase();
  if (GANZ[klein]) return wieVorher(wort, GANZ[klein]);
  let aus = wort;
  for (const [von, nach] of ANFANG) {
    if (aus.toLowerCase().startsWith(von)) aus = wieVorher(aus, nach) + aus.slice(von.length);
  }
  for (const [von, nach] of STAEMME) {
    let i = aus.toLowerCase().indexOf(von);
    while (i >= 0) {
      aus = aus.slice(0, i) + wieVorher(aus.slice(i, i + 1), nach) + aus.slice(i + von.length);
      i = aus.toLowerCase().indexOf(von, i + nach.length);
    }
  }
  return aus;
}

/** „Gruendung-Nordlicht-Ventures“ → „Gründung Nordlicht Ventures“ (ohne `.md`). */
export function dateinameLesbar(name: string): string {
  const ohne = name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ohne.split(' ').map(wortMitUmlauten).join(' ') || name;
}

/** Markdown-Auszeichnung weg (fett/kursiv/Code, schließende #) — Unterstriche IM Wort bleiben („Zoe_Log“). */
const sauber = (t: string) => t.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/`/g, '').replace(/(^|\s)[*_]+|[*_]+(?=\s|$)/g, '$1').replace(/\s+#+\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, MAX);

/** Der Anzeigename: Kopf-Titel → erste Überschrift erster Ebene → lesbarer Dateiname. */
export function notizAnzeigeTitel(datei: string, felder: Readonly<Record<string, string | string[]>> = {}, rumpf = ''): string {
  for (const k of ['title', 'titel']) {
    const v = felder[k];
    if (typeof v === 'string' && sauber(v)) return sauber(v);
  }
  const h1 = rumpf.match(/^#[ \t]+(.+)$/m);
  if (h1 && sauber(h1[1])) return sauber(h1[1]);
  return dateinameLesbar(datei);
}
