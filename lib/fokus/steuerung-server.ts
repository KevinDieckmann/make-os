// ─── MAKE OS — Fokus-Steuerung: Lesen und Schreiben (Server) — 10.10. ──────────────────────────────────────────────────────────
// EINE Stelle für die Prioritäten und die Zeit je Bereich (Regeln rein in lib/fokus/steuerung.ts):
//   · `steuerungSichtFuer` — was eine Person in EINEM Bereich sieht: die Themen des Haushalts (dieses Bereichs), ihr eigenes Soll, ihre eigene
//                            Ist-Zeit NUR aus Schlüsseln/Blöcken dieses Bereichs, die Passung. Konto „nur Business“ bekommt Privat nie (403).
//   · `themenSchreiben`    — die Themenliste eines Bereichs mit dem Stand, den die Person gesehen hat (sonst Konflikt → 409); nur volle
//                            Mitglieder. Spiegelt die Gewichte in den früheren Fokus-Regler (nur die Säulen des eigenen Bereichs), damit
//                            Tagesplan, Planen und der Wochenvorschlag weiter danach gewichten.
//   · `sollSchreiben`      — die eigene Soll-Zeit je Thema (jede Person für sich, auch Konten „nur Business“ im Business).
// Der Altbestand (`fokus-regler`, `ordnung`) wird nur gelesen — und nur im Haushalt des Inhabers (er liegt instanzweit).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeZeit, aufgabenKurz } from '@/lib/zeitmessung/speicher';
import { bild } from '@/lib/zeitmessung/modell';
import { bloeckeImZeitraum, nurBusinessBloecke, einheitVonBlock, brauchtMandate, type AufgabeKurz } from '@/lib/zeitmessung/einheiten';
import { mandateKurz } from '@/lib/planung/mandat-server';
import { gesellschaftAusEinheit, privatArbeitsEinheit } from '@/lib/einheiten';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { montagVon } from '@/lib/zeit/kalender-kern';
import {
  BLOCK_ZEIT_QUELLE, einheitenFuer, istJeThema, passung, reglerAusThemen, sollAnwenden, sollPruefen, themenPruefen, themenStand,
  vorgabeThemen, wirksameThemen, zeitQuellenFuer,
  type Altbestand, type PassStufe, type PassZeile, type SaeuleKey, type SollDatei, type SteuerBereich, type SteuerDatei, type SteuerThema,
  type ThemaIst, type ThemenQuelle,
} from './steuerung';

/** Die vier Bestandsnamen — je einzeln, damit der Register-Wächter (tests/datenschutz-register.test.ts) jeden Namen sieht. */
export const steuerungPrivatName = (haushalt: string) => `fokus-steuerung-privat--${haushalt}`;
export const steuerungBusinessName = (haushalt: string) => `fokus-steuerung-business--${haushalt}`;
export const sollPrivatName = (person: string) => `fokus-soll-privat--${person}`;
export const sollBusinessName = (person: string) => `fokus-soll-business--${person}`;

const themenLaden = (b: SteuerBereich, h: string) => (b === 'privat' ? loadJson<SteuerDatei>(steuerungPrivatName(h)) : loadJson<SteuerDatei>(steuerungBusinessName(h)));
const themenAendern = (b: SteuerBereich, h: string, f: (cur: SteuerDatei | null) => SteuerDatei) =>
  (b === 'privat' ? updateJson<SteuerDatei>(steuerungPrivatName(h), f) : updateJson<SteuerDatei>(steuerungBusinessName(h), f));
const sollLaden = (b: SteuerBereich, p: string) => (b === 'privat' ? loadJson<SollDatei>(sollPrivatName(p)) : loadJson<SollDatei>(sollBusinessName(p)));
const sollAendern = (b: SteuerBereich, p: string, f: (cur: SollDatei | null) => SollDatei) =>
  (b === 'privat' ? updateJson<SollDatei>(sollPrivatName(p), f) : updateJson<SollDatei>(sollBusinessName(p), f));

export type SteuerFehler = { fehler: string; status: 400 | 403 | 404 };

/** Zugang: Haushalt nötig, Privat nur mit Privat-Zugang. `voll` = darf die Themen ändern; `alt` = darf den Altbestand lesen. */
async function zugang(person: string | null | undefined, b: SteuerBereich): Promise<{ person: string; haushalt: string; voll: boolean; alt: boolean } | SteuerFehler> {
  const z = await planZugangFuer(person);
  if (!z) return { fehler: 'Die Steuerung gehört zu einem Haushalt — dieses Konto hat keinen.', status: 403 };
  if (b === 'privat' && z.sicht !== 'privat') return { fehler: 'Mit Business-Zugang gibt es keine Privat-Steuerung.', status: 403 };
  return { person: z.person, haushalt: z.haushalt, voll: z.sicht === 'privat', alt: await personImHaushaltDesInhabers(z.person) };
}

/** Altbestand (nur lesen): die früheren Regler und die Themen-Reihenfolge — nur im Haushalt des Inhabers. */
async function altbestand(erlaubt: boolean): Promise<Altbestand | null> {
  if (!erlaubt) return null;
  const [r, o] = await Promise.all([loadJson<{ regler?: Partial<Record<SaeuleKey, number>> }>('fokus-regler'), loadJson<{ reihenfolge?: string[] }>('ordnung')]);
  return { regler: r?.regler ?? null, reihenfolge: o?.reihenfolge ?? null };
}

/** Sekunden der Fokus-Blöcke je Einheit (7 Tage) — nur Blöcke dieses Bereichs (Business: Business-Blöcke ohne Privat-Einheit; Privat: Privat-Arbeit). */
async function einheitSekunden(b: SteuerBereich, person: string, heute: string, themen: readonly SteuerThema[]): Promise<Record<string, number>> {
  if (!themen.some(t => t.einheit)) return {};
  const datei = await ladeZeit(person);
  const aufgaben: AufgabeKurz[] = await aufgabenKurz().catch(() => []);
  const karte = new Map(aufgaben.map(a => [a.id, a]));
  const mandate = brauchtMandate([datei], aufgaben) ? await mandateKurz().catch(() => null) : null;
  const einheit = (x: Parameters<typeof einheitVonBlock>[0]) => gesellschaftAusEinheit(einheitVonBlock(x, karte, mandate));
  const pruefer = b === 'business'
    ? (x: Parameters<typeof nurBusinessBloecke>[0]) => nurBusinessBloecke(x) && !privatArbeitsEinheit(einheit(x))
    : (x: Parameters<typeof nurBusinessBloecke>[0]) => !!privatArbeitsEinheit(einheit(x));
  const aus: Record<string, number> = {};
  for (const x of bloeckeImZeitraum(datei, tagPlus(heute, -6), heute, pruefer)) {
    const g = einheit(x);
    if (g) aus[g] = (aus[g] ?? 0) + x.sek;
  }
  return aus;
}

/** Eingeplante Blöcke dieser Woche je Zeit-Quelle (nur Privat: Erholung, Reha) — aus dem Kalender der Person; Fehler = nichts eingeplant. */
async function eingeplantPrivat(person: string, heute: string): Promise<Record<string, number>> {
  try {
    const { planBloeckeLesen } = await import('@/lib/planung/bloecke-server');
    const von = montagVon(heute);
    const bloecke = await planBloeckeLesen({ person, betrachter: person, von, bis: tagPlus(von, 7), archiv: false });
    const aus: Record<string, number> = {};
    for (const x of bloecke) {
      const q = BLOCK_ZEIT_QUELLE[x.art];
      if (q && x.dauerMin > 0) aus[q] = (aus[q] ?? 0) + x.dauerMin * 60;
    }
    return aus;
  } catch { return {}; }
}

export interface SteuerThemaSicht extends SteuerThema { ist: ThemaIst; soll: number | null; pass: PassZeile }
export interface SteuerSicht {
  bereich: SteuerBereich;
  heute: string;
  themen: SteuerThemaSicht[];
  quelle: ThemenQuelle;
  /** Stand der Themenliste — beim Schreiben mitschicken. */
  stand: string;
  passung: { stufe: PassStufe; satz: string };
  /** Gemessene Zeit des Bereichs, 7 Tage (Seiten + bewusst), Sekunden. */
  gesamtSek: number;
  /** Auswahl für die Zeit-Quellen und die Einheiten-Themen — nur dieses Bereichs. */
  quellen: { id: string; label: string }[];
  einheiten: { id: string; name: string }[];
  /** Themen ändern dürfen nur volle Mitglieder (Konto „nur Business“ liest sie und pflegt sein eigenes Soll). */
  darfThemen: boolean;
}

/** Was die Person in einem Bereich sieht — Themen des Haushalts, eigenes Soll, eigene Ist-Zeit NUR dieses Bereichs. */
export async function steuerungSichtFuer(person: string | null | undefined, b: SteuerBereich, heute = localDay()): Promise<SteuerSicht | SteuerFehler> {
  const z = await zugang(person, b);
  if ('fehler' in z) return z;
  const [datei, sollD, alt, zeitDatei] = await Promise.all([themenLaden(b, z.haushalt), sollLaden(b, z.person), altbestand(z.alt), ladeZeit(z.person)]);
  const w = wirksameThemen(b, datei, alt);
  const bi = bild(zeitDatei, heute);
  const [einheitSek, eingeplant] = await Promise.all([
    einheitSekunden(b, z.person, heute, w.themen).catch(() => ({})),
    b === 'privat' ? eingeplantPrivat(z.person, heute) : Promise.resolve({}),
  ]);
  const ist = istJeThema(b, w.themen, bi.sieben, einheitSek, eingeplant);
  const soll = Object.fromEntries(Object.entries(sollD?.soll ?? {}).filter(([id, v]) => typeof v === 'number' && v > 0 && w.themen.some(t => t.id === id)));
  const gesamtSek = bi.sieben.gesamt[b] ?? 0;
  const p = passung(w.themen, soll, ist, gesamtSek);
  return {
    bereich: b, heute, quelle: w.quelle, stand: themenStand(w.themen, w.quelle),
    themen: w.themen.map((t, i) => ({ ...t, ist: ist[t.id], soll: soll[t.id] ?? null, pass: p.zeilen[i] })),
    passung: { stufe: p.stufe, satz: p.satz }, gesamtSek,
    quellen: zeitQuellenFuer(b), einheiten: einheitenFuer(b), darfThemen: z.voll,
  };
}

/** Kontrollfluss in der Sperre: nichts schreiben (Konflikt oder unverändert). */
class NichtSchreiben extends Error { constructor(readonly grund: 'konflikt' | 'gleich') { super(grund); } }

export type ThemenErgebnis = { ok: true; geaendert: boolean } | { ok: false; konflikt: true } | ({ ok: false } & SteuerFehler) | { ok: false; status: 400 | 413; fehler: string };

/** Die Themenliste eines Bereichs ersetzen (`themen`) bzw. auf die Vorgabe zurücksetzen (`vorgabe: true`) — mit Stand, in EINER Sperre. */
export async function themenSchreiben(person: string | null | undefined, b: SteuerBereich, e: { themen?: unknown; vorgabe?: boolean; stand: string }, wer: Wer): Promise<ThemenErgebnis> {
  const z = await zugang(person, b);
  if ('fehler' in z) return { ok: false, ...z };
  if (!z.voll) return { ok: false, fehler: 'Die Themen ändern die Mitglieder des Haushalts — mit Business-Zugang pflegst du dein eigenes Soll.', status: 403 };
  const p = e.vorgabe ? { ok: true as const, wert: vorgabeThemen(b) } : themenPruefen(e.themen, b);
  if (!p.ok) return { ok: false, status: p.status, fehler: p.fehler };
  const alt = await altbestand(z.alt);
  const name = b === 'privat' ? steuerungPrivatName(z.haushalt) : steuerungBusinessName(z.haushalt);
  let neu: SteuerThema[] = p.wert;
  try {
    const d = await themenAendern(b, z.haushalt, cur => {
      const w = wirksameThemen(b, cur, alt);
      if (themenStand(w.themen, w.quelle) !== e.stand) throw new NichtSchreiben('konflikt');
      if (w.quelle === 'neu' && JSON.stringify(w.themen) === JSON.stringify(p.wert)) throw new NichtSchreiben('gleich');
      return { ...(cur ?? {}), themen: p.wert };
    });
    neu = d.themen ?? p.wert;
  } catch (x) {
    if (!(x instanceof NichtSchreiben)) throw x;
    return x.grund === 'konflikt' ? { ok: false, konflikt: true } : { ok: true, geaendert: false };
  }
  await protokolliere(name, [{ op: 'geaendert', id: 'themen', felder: ['themen'] }], wer);
  // Spiegel in den früheren Fokus-Regler (instanzweit, nur im Haushalt des Inhabers): nur die Säulen DIESES Bereichs.
  if (z.alt) {
    const spiegel = reglerAusThemen(b, neu);
    if (Object.keys(spiegel).length) {
      await updateJson<{ regler?: Partial<Record<SaeuleKey, number>>; stand?: string }>('fokus-regler', cur => {
        const regler = { health: 50, business: 50, planning: 50, finance: 50, social: 50, ...(cur?.regler ?? {}), ...spiegel };
        return JSON.stringify(regler) === JSON.stringify(cur?.regler) ? (cur as { regler: typeof regler }) : { regler, stand: new Date().toISOString() };
      }).catch(() => undefined);
    }
  }
  return { ok: true, geaendert: true };
}

export type SollErgebnis = { ok: true; soll: Record<string, number> } | ({ ok: false } & SteuerFehler) | { ok: false; status: 400 | 413; fehler: string };

/** Eigenes Soll (h/Woche je Thema) setzen — nur bekannte Themen DIESES Bereichs; jede Person für sich. */
export async function sollSchreiben(person: string | null | undefined, b: SteuerBereich, roh: unknown, wer: Wer): Promise<SollErgebnis> {
  const z = await zugang(person, b);
  if ('fehler' in z) return { ok: false, ...z };
  const w = wirksameThemen(b, await themenLaden(b, z.haushalt), await altbestand(z.alt));
  const p = sollPruefen(roh, w.themen);
  if (!p.ok) return { ok: false, status: p.status, fehler: p.fehler };
  // Unverändert schreibt local-db nicht (gleicher Stand).
  const d = await sollAendern(b, z.person, cur => sollAnwenden(cur, p.wert));
  await protokolliere(b === 'privat' ? sollPrivatName(z.person) : sollBusinessName(z.person), [{ op: 'geaendert', id: 'soll', felder: Object.keys(p.wert) }], wer);
  return { ok: true, soll: d.soll ?? {} };
}
