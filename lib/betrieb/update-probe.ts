// ─── MAKE OS — Update-Probe mit Altbestand: die reine Vergleichs-Logik (10.10.) ─────────────────────────────────────────
// Kevin 10.10.: „Malin trägt schon aktuelle Daten ein — die müssen nach dem Update auch noch da sein!“ Pflicht-Gate vor jedem Upload:
// Bestand mit der ONLINE-Version anlegen, die neue Version darauf starten, je Bestand vorher/nachher vergleichen — fehlt etwas, kein Upload.
// Ablauf und Aufruf: scripts/update-probe.mjs (Doku DEPLOY.md › „Update-Probe“). Hier steht NUR, was als Verlust zählt (rein, getestet):
//
//   · Jeder Bestand von vorher existiert nachher noch und ist lesbar; kein Bestand wurde als beschädigt beiseitegelegt (`.corrupt-…`).
//   · Jede Kennung von vorher existiert noch: Einträge in Listen werden über ihre Kennung (`id`, `uid`, `kennung`, `speicher`, `schluessel`)
//     einander zugeordnet, nicht über die Stelle in der Liste. Listen ohne Kennung: gleicher Inhalt zuerst, sonst der ähnlichste Eintrag.
//   · Jedes Feld, das vorher einen Wert hatte (auch `false` und `0`), hat ihn noch. Neue Felder, neue Einträge, neue Bestände sind in Ordnung.
//   · Steht ein Wert nicht mehr an seiner Stelle, aber unverändert im selben Eintrag (z. B. Text → `{ text }`), ist das eine
//     Formänderung — kein Verlust, aber im Bericht genannt.
//   · Dateien (Ablage, Bilder, Archiv, Wissen) von vorher sind noch da und mit demselben Inhalt (Klartext-Fingerabdruck).
//   · Format bleibt wie live (kompatibel = v1): keine v2-Hülle, kein `_v`, keine Datei „MKOSDAT2“, kein Klartext-Bestand.
//
// Ausnahmen stehen in ERLAUBT — JEDE mit Grund. Eine Ausnahme ist nie pauschal „Feld darf fehlen“, sondern trifft einen Bestand, eine Stelle
// und eine Art; Zeitstempel dürfen sich nur ändern, wenn vorher UND nachher ein Zeitpunkt ist (dann ist es ein Auffrischen, kein Verlust).

import { createHash } from 'node:crypto';
import { alteFassungGehoben } from '@/lib/crm/datenschutz';

// ── Bilder (Schnappschuss) ────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Bestand im Schnappschuss. `daten` = entschlüsselter, geparster Inhalt (nur erfundene Werte — die Probe läuft nie auf echten Daten). */
export interface BestandBild {
  name: string;
  /** 0 = Klartext, 1 = Hülle v1 (kompatibel), 2 = Hülle v2. */
  huelle: 0 | 1 | 2;
  /** Trägt der Inhalt oben `_v` (Schemaversion — nur Format v2)? */
  mitV: boolean;
  lesbar: boolean;
  fehler?: string;
  /** Zahl der Einträge mit Kennung (sonst Schlüssel der obersten Ebene). */
  anzahl: number;
  /** Stelle des Eintrags → Fingerabdruck seiner Felder. */
  eintraege: Record<string, string>;
  daten?: unknown;
}

/** Eine Datei außerhalb der Bestände (Ablage, Bilder, Archiv, Wissen). */
export interface DateiBild {
  pfad: string;
  groesse: number;
  /** MKOSDAT1 / MKOSDAT2 (Dateihülle), huelle1 / huelle2 (JSON-Hülle), medien (eigene Hülle der Fotos & Videos), klar. */
  form: 'MKOSDAT1' | 'MKOSDAT2' | 'huelle1' | 'huelle2' | 'medien' | 'klar';
  /** Fingerabdruck des Klartexts (bzw. der Rohbytes, wenn nicht zu öffnen). */
  inhalt: string;
  offen: boolean;
}

export interface Schnappschuss {
  ordner: string;
  zeit: string;
  bestaende: Record<string, BestandBild>;
  dateien: Record<string, DateiBild>;
  /** Beiseitegelegte, beschädigte Bestände (`<name>.json.corrupt-…`). */
  beschaedigt: string[];
  /** Tageskopien unter backup/ (rotieren, werden nicht verglichen — nur gezählt). */
  tageskopien: number;
}

// ── Hilfen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

const istObjekt = (w: unknown): w is Record<string, unknown> => !!w && typeof w === 'object' && !Array.isArray(w);
const istPrimitiv = (w: unknown): w is string | number | boolean => typeof w === 'string' || typeof w === 'number' || typeof w === 'boolean';

/** „Kein Wert“: null, undefined, leerer Text, leere Liste, leeres Objekt. `false` und `0` SIND Werte. */
export function leer(w: unknown): boolean {
  if (w === null || w === undefined || w === '') return true;
  if (Array.isArray(w)) return w.length === 0;
  if (istObjekt(w)) return Object.keys(w).length === 0;
  return false;
}

/** JSON mit sortierten Schlüsseln — gleicher Inhalt, gleicher Text. */
export function kanonisch(w: unknown): string {
  if (Array.isArray(w)) return `[${w.map(kanonisch).join(',')}]`;
  if (istObjekt(w)) return `{${Object.keys(w).sort().filter(k => w[k] !== undefined).map(k => `${JSON.stringify(k)}:${kanonisch(w[k])}`).join(',')}}`;
  return JSON.stringify(w ?? null);
}

export const fingerabdruck = (w: unknown): string => createHash('sha256').update(kanonisch(w)).digest('hex').slice(0, 16);

/**
 * Schlüssel, über die Listeneinträge einander zugeordnet werden (der erste, der in der ganzen Liste eindeutig ist). Tageslisten ohne
 * Kennung (Schnappschüsse je Tag) werden über ihren Tag zugeordnet — nur, wenn er in der Liste eindeutig ist.
 */
export const KENNUNG_SCHLUESSEL = ['id', 'uid', 'kennung', 'speicher', 'schluessel', 'date', 'datum', 'tag'] as const;

/** Kennungs-Schlüssel einer Liste — nur, wenn JEDES Element ein Objekt mit eindeutigem, nicht leerem Wert dafür ist. */
export function kennungVon(liste: readonly unknown[]): string | null {
  if (!liste.length || !liste.every(istObjekt)) return null;
  for (const k of KENNUNG_SCHLUESSEL) {
    const werte = (liste as Record<string, unknown>[]).map(e => e[k]);
    if (!werte.every(v => (typeof v === 'string' && v !== '') || typeof v === 'number')) continue;
    if (new Set(werte.map(String)).size === werte.length) return k;
  }
  return null;
}

/** Alle Blätter (Stelle → kanonischer Wert) — für die Ähnlichkeit von Einträgen ohne Kennung. */
function blaetter(w: unknown, pfad = '', aus = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(w)) w.forEach((x, i) => blaetter(x, `${pfad}[${i}]`, aus));
  else if (istObjekt(w)) for (const [k, v] of Object.entries(w)) blaetter(v, `${pfad}.${k}`, aus);
  else if (!leer(w)) aus.set(pfad, kanonisch(w));
  return aus;
}

/** Steckt der Wert irgendwo (als Blatt) in `w`? Für Formänderungen (Text → { text }). */
function enthaeltWert(w: unknown, wert: string | number | boolean): boolean {
  if (Array.isArray(w)) return w.some(x => enthaeltWert(x, wert));
  if (istObjekt(w)) return Object.values(w).some(x => enthaeltWert(x, wert));
  return w === wert;
}

const kurz = (w: unknown, n = 120): string => {
  const t = typeof w === 'string' ? w : kanonisch(w);
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// ── Einträge eines Bestands ────────────────────────────────────────────────────────────────────────────────────────────

/** Einträge mit Kennung (in jeder Tiefe) → Fingerabdruck. Ohne solche: die Schlüssel der obersten Ebene (Tage, Personen …). */
export function eintraegeVon(daten: unknown): Record<string, string> {
  const aus: Record<string, string> = {};
  const lauf = (w: unknown, pfad: string) => {
    if (Array.isArray(w)) {
      const k = kennungVon(w);
      w.forEach((x, i) => {
        const p = k ? `${pfad}[${k}=${String((x as Record<string, unknown>)[k])}]` : `${pfad}[#${i}]`;
        if (k) aus[p] = fingerabdruck(x);
        lauf(x, p);
      });
    } else if (istObjekt(w)) for (const [s, v] of Object.entries(w)) lauf(v, pfad ? `${pfad}.${s}` : s);
  };
  lauf(daten, '');
  if (!Object.keys(aus).length && istObjekt(daten)) for (const [s, v] of Object.entries(daten)) aus[s] = fingerabdruck(v);
  return aus;
}

/** Das Bild eines gelesenen Bestands. */
export function bestandBild(name: string, daten: unknown, huelle: 0 | 1 | 2): BestandBild {
  const eintraege = eintraegeVon(daten);
  return { name, huelle, mitV: istObjekt(daten) && '_v' in daten, lesbar: true, anzahl: Object.keys(eintraege).length, eintraege, daten };
}

// ── Vergleich ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Art =
  | 'bestand-fehlt' | 'unlesbar' | 'beschaedigt'
  | 'kennung-fehlt' | 'wert-fehlt' | 'wert-geaendert'
  | 'datei-fehlt' | 'datei-geaendert' | 'format';

export interface Abweichung { art: Art; bestand: string; pfad: string; vorher?: string; nachher?: string }
export interface Formaenderung { bestand: string; pfad: string; wert: string }

/** Eine bewusste Ausnahme — trifft Bestand (Muster), optional Stelle und Arten, optional eine Zusatzbedingung. Grund ist Pflicht. */
export interface ErlaubtRegel {
  bestand: RegExp;
  pfad?: RegExp;
  arten?: readonly Art[];
  wenn?: (a: Abweichung, ctx: PruefKontext) => boolean;
  grund: string;
}
/** Was eine Ausnahme über den Lauf wissen darf: der Berliner Tag des Laufs der neuen Version. */
export interface PruefKontext { heute?: string }

const ZEITPUNKT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const istZeitpunkt = (s: string | undefined) => !!s && ZEITPUNKT.test(s.replace(/^"|"$/g, ''));

/**
 * Bewusste Ausnahmen (Stand 10.10.) — jede mit Grund. Neue Ausnahme NUR, wenn der Grund belegt ist (Code-Stelle nennen);
 * ein echtes Verschwinden von Inhalten gehört nie hierher.
 */
export const ERLAUBT: readonly ErlaubtRegel[] = [
  {
    bestand: /.*/, arten: ['wert-geaendert'],
    wenn: a => istZeitpunkt(a.vorher) && istZeitpunkt(a.nachher) && (a.nachher ?? '') >= (a.vorher ?? ''),
    grund: 'Zeitstempel aufgefrischt (vorher und nachher ein Zeitpunkt, nachher nicht früher) — der Server pflegt ihn (letzter Lauf, geändert am …).',
  },
  {
    bestand: /.*/, pfad: /(^|\.)(stand|fassung|hash|etag|version)$/, arten: ['wert-geaendert'],
    grund: 'Stand/Fingerabdruck einer Zeile — rechnet der Server bei jeder Änderung neu (lib/store/fingerabdruck.ts).',
  },
  {
    bestand: /^tagesstart$/, pfad: /^laeuft(\.|$)/,
    grund: 'Riegel „Morgenlauf läuft“ — der Lauf löscht ihn am Ende selbst (app/api/tagesstart/route.ts).',
  },
  {
    bestand: /^zoe-auftraege$|^zoe-warteschlange$/,
    grund: 'Arbeitswarteschlange: erledigte Aufträge verlassen die Schlange, Pacht/Versuche zählt der Arbeiter (lib/zoe/auftraege.ts).',
  },
  {
    bestand: /^performance(--[a-z0-9-]+)?$/, pfad: /^snapshots\[date=\d{4}-\d{2}-\d{2}\]\./, arten: ['wert-geaendert', 'wert-fehlt'],
    wenn: (a, ctx) => !!ctx.heute && a.pfad.startsWith(`snapshots[date=${ctx.heute}]`),
    grund: 'Tages-Schnappschuss des Wachstums-Scores von HEUTE — wird bei jeder Berechnung am selben Tag ersetzt (app/api/performance/route.ts POST, „ohneHeute“); frühere Tage bleiben.',
  },
  {
    bestand: /^protokoll-siegel$/, pfad: /^dateien\.[a-z0-9-]+\.(anzahl|kopf)$/, arten: ['wert-geaendert'],
    wenn: a => !a.pfad.endsWith('.anzahl') || Number(a.nachher) > Number(a.vorher),
    grund: 'Siegel der Protokoll-Kette: Zahl der Einträge und Kopf-Hash der wachsenden Protokolle — nur steigend (lib/store/protokoll-kette.ts `siegeln`).',
  },
  {
    bestand: /^datei:system\/takt\.txt$/, arten: ['datei-geaendert'],
    grund: 'Herzschlag des Takts (Zeitpunkt des letzten Laufs) — Betriebsdatei, kein Inhalt (lib/hoi/innen.ts `herzschlag`, aus dem Takt).',
  },
  {
    bestand: /^calendar-cache$|^kalender-icloud$|^apple-reminders-cache$|^apple-contacts-cache$/,
    grund: 'Spiegel eines fremden Kalenders bzw. Mac-Zulieferung — wird bei jedem Abgleich neu geschrieben, Wahrheit liegt in Apple.',
  },
  {
    // 14.10. (Abnahme B13, lib/planung/kaskade.ts `istRatenziel`/`abgeleiteterTitel`): ein Raten-Ziel („25.000 € je Monat“) wird nicht mehr durch 12
    // geteilt, Teilbeträge tragen die Einheit. Nur ABGELEITETE Ziele (Kennung `<eltern>~<ebene>`), nur Titel/Zielwert; von Hand angepasste zieht die
    // Kaskade nie nach. Der Titel behält den Teil des Jahresziels vor „ · “.
    bestand: /^ziele(-eigen--[a-z0-9-]+)?$/, pfad: /^(quartal|monat|woche|tag)\[id=[^\]]+~(quartal|monat|woche|tag)\]\.(titel|zielwert)$/, arten: ['wert-geaendert'],
    wenn: a => {
      if (a.pfad.endsWith('.zielwert')) return Number(a.nachher) > 0;
      const kopf = (t: string | undefined) => (t ?? '').replace(/^"|"$/g, '').split(' · ')[0];
      return !!kopf(a.vorher) && kopf(a.vorher) === kopf(a.nachher);
    },
    grund: 'Kaskade nach Regel neu gerechnet (Abnahme B13): abgeleitete Ziele eines Raten-Ziels tragen den Zielwert ungeteilt, Teilbeträge mit Einheit — nur abgeleitete Ziele, nichts von Hand Eingegebenes.',
  },
  {
    // 16.10. (C17, lib/planung/meilenstein-aufgaben.ts `zieleFortschrittAnwenden`): Fortschritt aus Unterzielen bzw. dem Elternziel — nachgezogen
    // wird nur ein nie gesetzter Wert (0); ein Wert von Hand bleibt (Test tests/ziel-fortschritt-hand.test.ts).
    bestand: /^ziele(-eigen--[a-z0-9-]+)?$/, pfad: /^(jahr|quartal|monat|woche|tag)\[id=[^\]]+\]\.fortschritt$/, arten: ['wert-geaendert'],
    wenn: a => Number(String(a.vorher ?? '').replace(/^"|"$/g, '')) === 0 && Number(String(a.nachher ?? '').replace(/^"|"$/g, '')) > 0,
    grund: 'Ziel-Fortschritt aus Unterzielen/Elternziel nachgezogen — nur von 0 (nie gesetzt); ein Wert von Hand wird nie überschrieben.',
  },
  {
    // DSGVO-Nachtrag 04.10. (lib/crm/datenschutz.ts `ALTE_FASSUNGEN`): eine UNVERÄNDERTE alte Fassung eines Verzeichnis-Textes wird gehoben —
    // von Hand Geändertes bleibt. Erlaubt nur, wenn `vorher` genau eine bekannte alte Fassung ist.
    bestand: /^crm$/, pfad: /^verarbeitungen\[id=vv-[a-z0-9-]+\]\.[a-z]+$/i, arten: ['wert-geaendert'],
    wenn: a => {
      const m = a.pfad.match(/^verarbeitungen\[id=(vv-[a-z0-9-]+)\]\.([a-z]+)$/i);
      if (!m) return false;
      // Die Probe hält Werte gekürzt fest (`kurz`) — verglichen wird mit derselben Kürzung, alt UND neu müssen passen.
      return alteFassungGehoben(m[1], m[2], a.vorher ?? '', a.nachher ?? '', t => kurz(t));
    },
    grund: 'Verzeichnis (Art. 30): unveränderte alte Fassung eines Textes auf die neue gehoben — von Hand Geändertes bleibt.',
  },
];

function erlaubtFuer(a: Abweichung, regeln: readonly ErlaubtRegel[], ctx: PruefKontext): ErlaubtRegel | null {
  for (const r of regeln) {
    if (!r.bestand.test(a.bestand)) continue;
    if (r.pfad && !r.pfad.test(a.pfad)) continue;
    if (r.arten && !r.arten.includes(a.art)) continue;
    if (r.wenn && !r.wenn(a, ctx)) continue;
    return r;
  }
  return null;
}

interface Sammler { bestand: string; abw: Abweichung[]; form: Formaenderung[] }

/** Eintrag (mit Kennung) vorher/nachher, in dem ein Wert umziehen darf (Formänderung). */
interface Eintrag { vor: unknown; nach: unknown }

/**
 * Ist der Wert umgezogen? Nur, wenn er im Eintrag nachher MINDESTENS so oft vorkommt wie vorher — ein Wert, der vorher schon woanders im
 * Eintrag stand (z. B. `angelegtVon: 'lena'` neben `assignee: 'lena'`), zählt nie als Ersatz für ein verlorenes Feld.
 */
function umgezogen(vor: unknown, nach: unknown, wert: string | number | boolean): boolean {
  const c = kanonisch(wert);
  const wie = (w: unknown) => [...blaetter(w).values()].filter(x => x === c).length;
  return wie(nach) >= wie(vor);
}

/**
 * Werte von vorher in nachher wiederfinden — rekursiv, nach den Regeln oben. `eintrag` = der Eintrag (mit Kennung), in dem ein Wert
 * umziehen darf (Formänderung); außerhalb eines Eintrags mit Kennung (undefined) zieht nichts um.
 */
function vergleicheWert(v: unknown, n: unknown, pfad: string, s: Sammler, eintrag: Eintrag | undefined): void {
  if (leer(v)) return;
  const ab = (art: Art, vorher?: unknown, nachher?: unknown) =>
    s.abw.push({ art, bestand: s.bestand, pfad, ...(vorher !== undefined ? { vorher: kurz(vorher) } : {}), ...(nachher !== undefined ? { nachher: kurz(nachher) } : {}) });

  if (istPrimitiv(v)) {
    if (n === v) return;
    if (n === undefined || n === null || n === '') {
      if (eintrag && umgezogen(eintrag.vor, eintrag.nach, v)) { s.form.push({ bestand: s.bestand, pfad, wert: kurz(v) }); return; }
      ab('wert-fehlt', v);
      return;
    }
    if (!istPrimitiv(n) && enthaeltWert(n, v)) { s.form.push({ bestand: s.bestand, pfad, wert: kurz(v) }); return; }
    ab('wert-geaendert', v, n);
    return;
  }

  if (istObjekt(v)) {
    if (!istObjekt(n)) {
      if (n === undefined || n === null) { ab('wert-fehlt', v); return; }
      // Form geändert (Objekt → Liste/Text): jedes Blatt muss im neuen Wert stecken.
      for (const [p, w] of blaetter(v)) {
        const roh = JSON.parse(w) as unknown;
        if (istPrimitiv(roh) && enthaeltWert(n, roh)) s.form.push({ bestand: s.bestand, pfad: `${pfad}${p}`, wert: kurz(roh) });
        else s.abw.push({ art: 'wert-fehlt', bestand: s.bestand, pfad: `${pfad}${p}`, vorher: kurz(roh) });
      }
      return;
    }
    for (const [k, w] of Object.entries(v)) vergleicheWert(w, n[k], pfad ? `${pfad}.${k}` : k, s, eintrag);
    return;
  }

  if (Array.isArray(v)) {
    if (!Array.isArray(n)) {
      if (n === undefined || n === null) { ab('wert-fehlt', v); return; }
      for (const x of v) {
        if (istPrimitiv(x) && enthaeltWert(n, x)) s.form.push({ bestand: s.bestand, pfad: `${pfad}[]`, wert: kurz(x) });
        else vergleicheWert(x, undefined, `${pfad}[]`, s, eintrag);
      }
      return;
    }
    const k = kennungVon(v);
    if (k) {
      const nachKennung = new Map<string, unknown>();
      for (const x of n) if (istObjekt(x) && (typeof x[k] === 'string' || typeof x[k] === 'number')) nachKennung.set(String(x[k]), x);
      for (const x of v as Record<string, unknown>[]) {
        const id = String(x[k]);
        const p = `${pfad}[${k}=${id}]`;
        const gegen = nachKennung.get(id);
        if (gegen === undefined) {
          s.abw.push({ art: 'kennung-fehlt', bestand: s.bestand, pfad: p, vorher: kurz(x) });
          continue;
        }
        vergleicheWert(x, gegen, p, s, { vor: x, nach: gegen });
      }
      return;
    }
    // Ohne Kennung: Werte als Menge, Objekte über gleichen Inhalt, sonst den ähnlichsten Eintrag.
    const nachWerte = new Set(n.filter(istPrimitiv).map(x => kanonisch(x)));
    const nachObjekte = n.map((x, i) => ({ x, i })).filter(o => !istPrimitiv(o.x) && !leer(o.x));
    const genutzt = new Set<number>();
    const nachKanon = new Map<string, number[]>();
    for (const o of nachObjekte) { const c = kanonisch(o.x); nachKanon.set(c, [...(nachKanon.get(c) ?? []), o.i]); }
    v.forEach((x, i) => {
      if (leer(x)) return;
      const p = `${pfad}[#${i}]`;
      if (istPrimitiv(x)) {
        if (nachWerte.has(kanonisch(x))) return;
        if (umgezogen(v, n, x) || (eintrag && umgezogen(eintrag.vor, eintrag.nach, x))) { s.form.push({ bestand: s.bestand, pfad: p, wert: kurz(x) }); return; }
        s.abw.push({ art: 'wert-fehlt', bestand: s.bestand, pfad: p, vorher: kurz(x) });
        return;
      }
      const gleich = (nachKanon.get(kanonisch(x)) ?? []).find(j => !genutzt.has(j));
      if (gleich !== undefined) { genutzt.add(gleich); return; }
      const bv = blaetter(x);
      let best: { i: number; punkte: number } | null = null;
      for (const o of nachObjekte) {
        const bn = blaetter(o.x);
        let punkte = 0;
        for (const [pp, ww] of bv) if (bn.get(pp) === ww) punkte++;
        const besser = !best || punkte > best.punkte || (punkte === best.punkte && genutzt.has(best.i) && !genutzt.has(o.i));
        if (besser) best = { i: o.i, punkte };
      }
      if (!best) { s.abw.push({ art: 'wert-fehlt', bestand: s.bestand, pfad: p, vorher: kurz(x) }); return; }
      genutzt.add(best.i);
      vergleicheWert(x, n[best.i], p, s, eintrag);
    });
  }
}

/** Vorher/nachher eines einzelnen Bestands (rein — auch für Tests). */
export function vergleicheBestand(name: string, vorher: unknown, nachher: unknown): { abweichungen: Abweichung[]; formaenderungen: Formaenderung[] } {
  const s: Sammler = { bestand: name, abw: [], form: [] };
  vergleicheWert(vorher, nachher, '', s, undefined);
  return { abweichungen: s.abw, formaenderungen: s.form };
}

/** Format wie live (kompatibel): v1-Hüllen, kein `_v`, keine „MKOSDAT2“-Datei, mit Schlüssel kein Klartext-Bestand. */
export function formatPruefen(nachher: Schnappschuss, opt: { mitSchluessel: boolean }): Abweichung[] {
  const aus: Abweichung[] = [];
  for (const b of Object.values(nachher.bestaende)) {
    if (!b.lesbar) continue;
    if (b.huelle === 2) aus.push({ art: 'format', bestand: b.name, pfad: '', nachher: 'Hülle v2 (live läuft kompatibel = v1)' });
    if (opt.mitSchluessel && b.huelle === 0) aus.push({ art: 'format', bestand: b.name, pfad: '', nachher: 'Klartext, obwohl ein Datenschlüssel gesetzt ist' });
    if (b.mitV) aus.push({ art: 'format', bestand: b.name, pfad: '_v', nachher: '`_v` geschrieben (nur Format v2 darf das)' });
  }
  for (const d of Object.values(nachher.dateien)) {
    if (d.form === 'MKOSDAT2' || d.form === 'huelle2') aus.push({ art: 'format', bestand: `datei:${d.pfad}`, pfad: '', nachher: `${d.form} (live läuft kompatibel = v1)` });
  }
  return aus;
}

export interface VergleichErgebnis {
  verlustfrei: boolean;
  /** Echte Abweichungen (Verlust, Änderung, Format) — jede blockiert den Upload. */
  abweichungen: Abweichung[];
  /** Abweichungen, die eine Ausnahme abdeckt (mit Grund). */
  erlaubt: (Abweichung & { grund: string })[];
  /** Werte, die nur ihre Form geändert haben (Wert erhalten). */
  formaenderungen: Formaenderung[];
  neueBestaende: string[];
  neueDateien: string[];
  /** Gegenprobe (alte Version, gleiche Läufe und Klicks auf einer Kopie): Abweichungen, die die ALTE Version genauso hat — kein Verlust
   *  durch das Update, aber ein bestehender Fehler. Nur gesetzt nach `mitGegenprobe`. */
  auchAlt?: Abweichung[];
  /** … und was nur die alte Version verliert (die neue nicht mehr). */
  nurAlt?: Abweichung[];
  zahlen: { bestaendeVorher: number; bestaendeNachher: number; eintraegeVorher: number; eintraegeNachher: number; dateienVorher: number; dateienNachher: number };
  /** Format nachher: Bestände je Hülle (0 = Klartext, 1, 2), mit `_v`, Dateien je Form — live erwartet: nur Hülle 1, kein `_v`, MKOSDAT1. */
  format: { huelle: Record<string, number>; mitV: number; dateien: Record<string, number> };
}

/**
 * Selbsttest der Probe an echten Bildern: entfernt im Nachher-Bild (Kopie im Speicher) den ersten Eintrag mit Kennung und ein Feld eines
 * anderen Eintrags — der Vergleich muss beides melden. So ist belegt, dass das Werkzeug auf der Form der Bestände überhaupt Verluste sieht.
 */
export function selbsttest(vorher: Schnappschuss, nachher: Schnappschuss, opt: { mitSchluessel: boolean; erlaubt?: readonly ErlaubtRegel[]; heute?: string }): { ok: boolean; erwartet: string[]; gefunden: string[] } {
  const kopie = JSON.parse(JSON.stringify(nachher)) as Schnappschuss;
  const erwartet: string[] = [];
  for (const b of Object.values(kopie.bestaende)) {
    if (erwartet.length >= 2 || !b.lesbar || !istObjekt(b.daten) || !vorher.bestaende[b.name]?.lesbar) continue;
    for (const [k, w] of Object.entries(b.daten)) {
      if (!Array.isArray(w) || w.length < 2 || !kennungVon(w)) continue;
      const kk = kennungVon(w) as string;
      const vorherListe = (vorher.bestaende[b.name].daten as Record<string, unknown>)?.[k];
      if (!Array.isArray(vorherListe) || kennungVon(vorherListe) !== kk) continue;
      const weg = (w as Record<string, unknown>[])[0];
      const feldEintrag = (w as Record<string, unknown>[]).slice(1).find(x => vorherListe.some(y => istObjekt(y) && y[kk] === x[kk] && Object.entries(y).some(([f, v]) => f !== kk && istPrimitiv(v) && x[f] === v)));
      if (!feldEintrag) continue;
      const vorherEintrag = vorherListe.find(y => istObjekt(y) && y[kk] === feldEintrag[kk]) as Record<string, unknown>;
      const feld = Object.keys(vorherEintrag).find(f => f !== kk && istPrimitiv(vorherEintrag[f]) && feldEintrag[f] === vorherEintrag[f]) as string;
      if (!vorherListe.some(y => istObjekt(y) && y[kk] === weg[kk])) continue;
      b.daten = { ...b.daten, [k]: (w as Record<string, unknown>[]).filter(x => x !== weg).map(x => (x === feldEintrag ? Object.fromEntries(Object.entries(x).filter(([f]) => f !== feld)) : x)) };
      erwartet.push(`${b.name} ${k}[${kk}=${String(weg[kk])}]`, `${b.name} ${k}[${kk}=${String(feldEintrag[kk])}].${feld}`);
      break;
    }
  }
  const e = vergleiche(vorher, kopie, opt);
  const gefunden = erwartet.filter(x => e.abweichungen.some(a => `${a.bestand} ${a.pfad}` === x));
  return { ok: erwartet.length === 2 && gefunden.length === 2, erwartet, gefunden };
}

/** Ganzer Vergleich zweier Schnappschüsse. */
export function vergleiche(vorher: Schnappschuss, nachher: Schnappschuss, opt: { mitSchluessel: boolean; erlaubt?: readonly ErlaubtRegel[]; heute?: string } = { mitSchluessel: true }): VergleichErgebnis {
  const regeln = opt.erlaubt ?? ERLAUBT;
  const roh: Abweichung[] = [];
  const formaenderungen: Formaenderung[] = [];
  for (const [name, b] of Object.entries(vorher.bestaende)) {
    const n = nachher.bestaende[name];
    if (!n) { roh.push({ art: 'bestand-fehlt', bestand: name, pfad: '', vorher: `${b.anzahl} Einträge` }); continue; }
    if (!n.lesbar) { roh.push({ art: 'unlesbar', bestand: name, pfad: '', nachher: n.fehler ?? 'nicht lesbar' }); continue; }
    if (!b.lesbar) continue;
    const r = vergleicheBestand(name, b.daten, n.daten);
    roh.push(...r.abweichungen);
    formaenderungen.push(...r.formaenderungen);
  }
  for (const c of nachher.beschaedigt) if (!vorher.beschaedigt.includes(c)) roh.push({ art: 'beschaedigt', bestand: c.replace(/\.json\.corrupt-.*$/, ''), pfad: '', nachher: c });
  for (const [p, d] of Object.entries(vorher.dateien)) {
    const n = nachher.dateien[p];
    if (!n) { roh.push({ art: 'datei-fehlt', bestand: `datei:${p}`, pfad: '', vorher: `${d.groesse} Bytes` }); continue; }
    if (d.offen && n.offen && d.inhalt !== n.inhalt) roh.push({ art: 'datei-geaendert', bestand: `datei:${p}`, pfad: '', vorher: d.inhalt, nachher: n.inhalt });
  }
  roh.push(...formatPruefen(nachher, opt));
  const abweichungen: Abweichung[] = [];
  const erlaubt: (Abweichung & { grund: string })[] = [];
  for (const a of roh) {
    const r = a.art === 'format' ? null : erlaubtFuer(a, regeln, { heute: opt.heute });
    if (r) erlaubt.push({ ...a, grund: r.grund }); else abweichungen.push(a);
  }
  const summe = (s: Schnappschuss) => Object.values(s.bestaende).reduce((x, b) => x + b.anzahl, 0);
  const zaehle = (l: readonly string[]) => l.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});
  const lesbar = Object.values(nachher.bestaende).filter(b => b.lesbar);
  return {
    format: { huelle: zaehle(lesbar.map(b => String(b.huelle))), mitV: lesbar.filter(b => b.mitV).length, dateien: zaehle(Object.values(nachher.dateien).map(d => d.form)) },
    verlustfrei: abweichungen.length === 0,
    abweichungen, erlaubt, formaenderungen,
    neueBestaende: Object.keys(nachher.bestaende).filter(n => !vorher.bestaende[n]).sort(),
    neueDateien: Object.keys(nachher.dateien).filter(p => !vorher.dateien[p]).sort(),
    zahlen: {
      bestaendeVorher: Object.keys(vorher.bestaende).length, bestaendeNachher: Object.keys(nachher.bestaende).length,
      eintraegeVorher: summe(vorher), eintraegeNachher: summe(nachher),
      dateienVorher: Object.keys(vorher.dateien).length, dateienNachher: Object.keys(nachher.dateien).length,
    },
  };
}

/**
 * Gegenprobe einrechnen: eine Abweichung, die die alte Version bei denselben Läufen und Klicks genauso zeigt (gleiche Art, Bestand, Stelle),
 * ist kein Verlust DURCH das Update — sie wandert nach `auchAlt` (bleibt im Bericht sichtbar). Formatfehler zählen immer.
 */
export function mitGegenprobe(e: VergleichErgebnis, kontrolle: VergleichErgebnis): VergleichErgebnis {
  const schl = (a: Abweichung) => `${a.art}|${a.bestand}|${a.pfad}`;
  const alt = new Set(kontrolle.abweichungen.map(schl));
  const neu = new Set(e.abweichungen.map(schl));
  const auchAlt = e.abweichungen.filter(a => a.art !== 'format' && alt.has(schl(a)));
  const abweichungen = e.abweichungen.filter(a => a.art === 'format' || !alt.has(schl(a)));
  const nurAlt = kontrolle.abweichungen.filter(a => !neu.has(schl(a)));
  return { ...e, abweichungen, auchAlt, nurAlt, verlustfrei: abweichungen.length === 0 };
}

// ── Bericht ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface LaufBericht {
  /** Schritte eines Laufs (Saat, neue Version, Rückweg) — Name, ok, kurze Info. */
  schritte?: { name: string; ok: boolean; info?: string }[];
  /** Lesende Routen: Zahl je Status, und welche 5xx/Fehler lieferten. */
  routen?: { aufgerufen: number; jeStatus: Record<string, number>; fehler: string[] };
  /** Marken aus der Saat, die nachher in keiner Antwort an ihre Person mehr auftauchen. */
  unsichtbar?: string[];
  /** … davon in der Gegenprobe (alte Version) genauso unsichtbar — kein Update-Verlust. */
  unsichtbarAuchAlt?: string[];
  /** Rückweg: Bestände, die die alte Version nicht mehr lesen kann. */
  unlesbarAlt?: string[];
}

const zeile = (a: Abweichung) => `| ${a.art} | \`${a.bestand}\` | \`${a.pfad || '—'}\` | ${(a.vorher ?? '').replace(/\|/g, '\\|')} | ${(a.nachher ?? '').replace(/\|/g, '\\|')} |`;

/** Bericht als Markdown (Kopf: VERLUSTFREI ja/nein). */
export function berichtMarkdown(e: VergleichErgebnis, meta: { alt: string; neu: string; ordner: string; zeit: string; saat?: LaufBericht; neuLauf?: LaufBericht; gegenprobe?: LaufBericht; rueckweg?: LaufBericht; schonVorherUnsichtbar?: string[]; selbsttest?: string; sichtprobe?: string }): string {
  const t: string[] = [];
  t.push('# Update-Probe mit Altbestand', '');
  t.push(`**VERLUSTFREI: ${e.verlustfrei ? 'ja' : 'nein'}**${e.auchAlt ? ' (Verluste durch das Update — Gegenprobe mit der alten Version eingerechnet)' : ''}`, '');
  t.push(`- Alt (online): \`${meta.alt}\``, `- Neu: \`${meta.neu}\``, `- Datenordner: \`${meta.ordner}\``, `- Zeit: ${meta.zeit}`, '');
  const z = e.zahlen;
  t.push('## Zahlen', '', `| | vorher | nachher |`, `|---|---:|---:|`,
    `| Bestände | ${z.bestaendeVorher} | ${z.bestaendeNachher} |`,
    `| Einträge (mit Kennung) | ${z.eintraegeVorher} | ${z.eintraegeNachher} |`,
    `| Dateien | ${z.dateienVorher} | ${z.dateienNachher} |`, '');
  const f = e.format;
  t.push(`Format nachher: Bestände je Hülle ${Object.entries(f.huelle).sort().map(([h, n]) => `v${h}: ${n}`).join(' · ') || '—'} · mit \`_v\`: ${f.mitV} · Dateien ${Object.entries(f.dateien).sort().map(([h, n]) => `${h}: ${n}`).join(' · ') || '—'} (live: nur v1, kein \`_v\`, MKOSDAT1).`, '');
  if (meta.selbsttest) t.push(`Selbsttest der Probe (ein Eintrag und ein Feld im Nachher-Bild entfernt): ${meta.selbsttest}`, '');
  if (meta.sichtprobe) t.push(`Sichtprobe: ${meta.sichtprobe}`, '');
  t.push(`## Echte Abweichungen (${e.abweichungen.length})`, '');
  if (e.abweichungen.length) {
    t.push('| Art | Bestand | Stelle | vorher | nachher |', '|---|---|---|---|---|');
    for (const a of e.abweichungen) t.push(zeile(a));
  } else t.push('Keine.');
  t.push('');
  if (meta.neuLauf?.unsichtbar?.length) {
    t.push(`## Nachher nicht mehr sichtbar (${meta.neuLauf.unsichtbar.length})`, '', 'Marken aus der Saat, die in keiner Antwort an ihre Person mehr auftauchen (Daten liegen evtl. noch, werden aber nicht gezeigt):', '');
    for (const m of meta.neuLauf.unsichtbar) t.push(`- ${m}`);
    t.push('');
  }
  if (e.auchAlt?.length || meta.neuLauf?.unsichtbarAuchAlt?.length) {
    t.push(`## Bestehende Verluste — die alte Version genauso (${(e.auchAlt?.length ?? 0) + (meta.neuLauf?.unsichtbarAuchAlt?.length ?? 0)})`, '',
      'Kein Verlust durch das Update (die Gegenprobe mit der alten Version zeigt dieselbe Abweichung bei denselben Läufen und Klicks) — aber ein Fehler, der heute schon live Daten kostet.', '');
    if (e.auchAlt?.length) { t.push('| Art | Bestand | Stelle | vorher | nachher |', '|---|---|---|---|---|'); for (const a of e.auchAlt) t.push(zeile(a)); t.push(''); }
    for (const m of meta.neuLauf?.unsichtbarAuchAlt ?? []) t.push(`- nicht mehr sichtbar: ${m}`);
    t.push('');
  }
  if (e.nurAlt?.length) {
    t.push(`## Nur die alte Version verliert (${e.nurAlt.length}) — die neue nicht mehr`, '', '| Art | Bestand | Stelle | vorher | nachher |', '|---|---|---|---|---|');
    for (const a of e.nurAlt) t.push(zeile(a));
    t.push('');
  }
  t.push(`## Formänderungen (Wert erhalten, ${e.formaenderungen.length})`, '');
  for (const f of e.formaenderungen.slice(0, 80)) t.push(`- \`${f.bestand}\` \`${f.pfad}\`: ${f.wert}`);
  if (e.formaenderungen.length > 80) t.push(`- … und ${e.formaenderungen.length - 80} weitere (JSON-Bericht)`);
  t.push('');
  t.push(`## Erlaubte Abweichungen (${e.erlaubt.length})`, '');
  const jeGrund = new Map<string, number>();
  for (const a of e.erlaubt) jeGrund.set(`${a.bestand} · ${a.grund}`, (jeGrund.get(`${a.bestand} · ${a.grund}`) ?? 0) + 1);
  for (const [g, n] of [...jeGrund].sort()) t.push(`- ${n}× ${g}`);
  t.push('');
  t.push(`## Neu (in Ordnung)`, '', `- Bestände: ${e.neueBestaende.length ? e.neueBestaende.map(n => `\`${n}\``).join(', ') : '—'}`, `- Dateien: ${e.neueDateien.length}`, '');
  const lauf = (titel: string, l?: LaufBericht) => {
    if (!l) return;
    t.push(`## ${titel}`, '');
    for (const s of l.schritte ?? []) t.push(`- ${s.ok ? '✓' : '✗'} ${s.name}${s.info ? ` — ${s.info}` : ''}`);
    if (l.routen) {
      t.push('', `Lesende Routen: ${l.routen.aufgerufen} Aufrufe · ${Object.entries(l.routen.jeStatus).sort().map(([s, n]) => `${s}: ${n}`).join(' · ')}`);
      if (l.routen.fehler.length) { t.push('', '<details><summary>Fehler/5xx</summary>', ''); for (const f of l.routen.fehler) t.push(`- ${f}`); t.push('', '</details>'); }
    }
    if (l.unlesbarAlt) t.push('', `Bestände, die die alte Version nicht lesen kann: ${l.unlesbarAlt.length ? l.unlesbarAlt.map(n => `\`${n}\``).join(', ') : 'keine'}`);
    t.push('');
  };
  if (meta.schonVorherUnsichtbar?.length) {
    t.push(`## Schon in der alten Version nicht sichtbar (${meta.schonVorherUnsichtbar.length})`, '', 'Gesät, aber schon vor dem Update in keiner Antwort an die Person — zählt nicht für das Update, ist aber ein Hinweis:', '');
    for (const m of meta.schonVorherUnsichtbar) t.push(`- ${m}`);
    t.push('');
  }
  lauf('Saat mit der alten Version', meta.saat);
  lauf('Lauf der neuen Version', meta.neuLauf);
  lauf('Gegenprobe (alte Version, dieselben Läufe und Klicks auf einer Kopie)', meta.gegenprobe);
  lauf('Rückweg (alte Version auf dem neuen Stand)', meta.rueckweg);
  return t.join('\n');
}
