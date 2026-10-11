// ─── MAKE OS — Fokus: Lesen und Schreiben (Server) — 09.10. ─────────────────────────────────────────────────────────────────────
// EINE Stelle für die Fokus-Bestände (Regeln rein in lib/planung/fokus.ts):
//   · `fokusSichtFuer`   — was eine Person je Horizont sieht: Unser Fokus (Privat bzw. Business je Gesellschaft), Mein Fokus, und je Partner
//                          (anderes VOLLES Mitglied des Haushalts) NUR die Sätze, die er/sie teilt. Konto „nur Business“ bekommt Privat nie.
//   · `fokusSchreiben`   — ein Satz bzw. „teilen“ mit dem Stand, den die Person gesehen hat (sonst Konflikt → 409). Unser Fokus schreiben nur
//                          volle Mitglieder; Mein Fokus jede Person mit Haushalt für sich (Privat nur mit Privat-Zugang).
//   · `fokusZeilenFuer` / `fokusSatzFuer` — für ZOE und die Agenten: der Fokus der AUSLÖSENDEN Person (Unser + Mein + was andere mit ihr teilen),
//                          im `<daten>`-Rahmen. Prompts lesen den Fokus NUR hierüber (gatherBrain, Kalender-Agent, Wochenvorschlag).
// Der bisherige Fokus im gemischten Bestand `ziele` (und `ziele-eigen--<person>`) wird nur gelesen (Altbestand), nie geschrieben.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';
import { speicherFuer } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import { BUSINESS_GESELLSCHAFTEN, finanzOrtName } from '@/lib/einheiten';
import { fokusFuerLaufendesJahr } from './jahr-fokus';
import { eigeneZieleSicht, partnerVon } from './eigene-ziele-sicht';
import {
  FOKUS_GESAMT, FOKUS_HORIZONTE, fokusAlt, fokusPrivatName, fokusBusinessName, fokusEigenName, fokusEigenBusinessName, fokusAnwenden, fokusBestand, fokusGeteilt, fokusSchluesselNeu, fokusZelle,
  type FokusBereich, type FokusDatei, type FokusHorizont, type FokusWessen, type FokusZeile, type FokusZelle, fokusSatz, fokusZeitraum,
} from './fokus';

const laufendesJahr = () => Number(localDay().slice(0, 4));

/** Lesen/Ändern der vier getrennten Bestände — je Name ein eigener Aufruf (der Register-Wächter sieht jeden). */
function fokusLaden(b: FokusBereich, w: FokusWessen, wer: string): Promise<FokusDatei | null> {
  if (b === 'privat') return w === 'unser' ? loadJson<FokusDatei>(fokusPrivatName(wer)) : loadJson<FokusDatei>(fokusEigenName(wer));
  return w === 'unser' ? loadJson<FokusDatei>(fokusBusinessName(wer)) : loadJson<FokusDatei>(fokusEigenBusinessName(wer));
}
function fokusAendern(b: FokusBereich, w: FokusWessen, wer: string, f: (cur: FokusDatei | null) => FokusDatei): Promise<FokusDatei> {
  if (b === 'privat') return w === 'unser' ? updateJson<FokusDatei>(fokusPrivatName(wer), f) : updateJson<FokusDatei>(fokusEigenName(wer), f);
  return w === 'unser' ? updateJson<FokusDatei>(fokusBusinessName(wer), f) : updateJson<FokusDatei>(fokusEigenBusinessName(wer), f);
}
const vorname = (k: { speicher: string; name?: string }) => (k.name ?? '').trim().split(/\s+/)[0] || k.speicher;

/** Die Einheiten des Business-Fokus: gesamt + die Business-Gesellschaften (Namen aus lib/einheiten.ts — je Instanz). */
export function fokusEinheiten(): { id: string; name: string }[] {
  return [{ id: FOKUS_GESAMT, name: 'Gesamt' }, ...BUSINESS_GESELLSCHAFTEN.map(g => ({ id: g, name: finanzOrtName(g) }))];
}
const einheitOk = (e: string | undefined) => !e || fokusEinheiten().some(x => x.id === e);

export interface FokusPartnerZelle { speicher: string; vorname: string; text: string }
export interface FokusHorizontSicht { unser: FokusZelle; mein: FokusZelle & { geteilt: boolean }; partner: FokusPartnerZelle[] }
export interface FokusSicht {
  bereich: FokusBereich; einheit: string; jahr: number; laufend: number;
  horizonte: Record<FokusHorizont, FokusHorizontSicht>;
  einheiten: { id: string; name: string }[];
  partner: { speicher: string; vorname: string }[];
  /** Unser Fokus ändern dürfen nur volle Mitglieder (Konto „nur Business“ liest ihn nur). */
  darfUnser: boolean;
}

export type FokusFehler = { fehler: string; status: 400 | 403 | 404 };

/**
 * Zugang für eine Person und einen Bereich (Privat nur mit Privat-Zugang; ohne Haushalt nichts). `alt`: darf der Altbestand gelesen werden?
 * Nur im Haushalt der Inhaber — `ziele` liegt instanzweit (nicht je Haushalt), ein anderer Haushalt (Testkunde) bekommt nie etwas daraus.
 */
async function zugang(person: string | null | undefined, bereich: FokusBereich): Promise<{ person: string; haushalt: string; voll: boolean; alt: boolean } | FokusFehler> {
  const z = await planZugangFuer(person);
  if (!z) return { fehler: 'Der Fokus gehört zu einem Haushalt — dieses Konto hat keinen.', status: 403 };
  if (bereich === 'privat' && z.sicht !== 'privat') return { fehler: 'Mit Business-Zugang gibt es keinen Privat-Fokus.', status: 403 };
  return { person: z.person, haushalt: z.haushalt, voll: z.sicht === 'privat', alt: await personImHaushaltDesInhabers(z.person) };
}
const altLesen = (erlaubt: boolean, name: string) => (erlaubt ? loadJson<{ fokus?: Record<string, string> }>(name) : Promise.resolve(null));

/** Was die Person sieht — je Horizont Unser, Mein, Partner (nur Geteiltes). */
export async function fokusSichtFuer(person: string | null | undefined, bereich: FokusBereich, o: { einheit?: string; jahr?: number } = {}): Promise<FokusSicht | FokusFehler> {
  const z = await zugang(person, bereich);
  if ('fehler' in z) return z;
  if (!einheitOk(o.einheit)) return { fehler: 'Diese Gesellschaft gibt es nicht.', status: 400 };
  const laufend = laufendesJahr();
  const jahr = o.jahr && Math.abs(o.jahr - laufend) <= 10 ? o.jahr : laufend;
  const einheit = bereich === 'business' ? (o.einheit || FOKUS_GESAMT) : FOKUS_GESAMT;
  const [konten, unser, mein, ziele, eigenAlt] = await Promise.all([
    ladeKonten(),
    fokusLaden(bereich, 'unser', z.haushalt),
    fokusLaden(bereich, 'mein', z.person),
    altLesen(z.alt, 'ziele'),
    altLesen(z.alt, speicherFuer('ziele-eigen', z.person)),
  ]);
  const partner = partnerVon(konten.konten, z.person).map(p => ({ speicher: p, vorname: vorname(konten.konten.find(k => k.speicher === p) ?? { speicher: p }) }));
  // Konto „nur Business“: Partner-Spalten gibt es nicht (partnerVon ist dann leer).
  const partnerDaten = await Promise.all(partner.map(async p => ({
    p, sicht: eigeneZieleSicht(konten.konten, p.speicher, z.person),
    d: await fokusLaden(bereich, 'mein', p.speicher),
    alt: (await altLesen(z.alt, speicherFuer('ziele-eigen', p.speicher)))?.fokus ?? {},
  })));
  const zAlt = fokusFuerLaufendesJahr(ziele?.fokus ?? {}, laufend);
  const horizonte = {} as Record<FokusHorizont, FokusHorizontSicht>;
  const heute = localDay();
  for (const h of FOKUS_HORIZONTE) {
    const kU = fokusSchluesselNeu(h, { jahr, bereich, wessen: 'unser', einheit });
    const kM = fokusSchluesselNeu(h, { jahr, bereich, wessen: 'mein' });
    // Prüf-Fund 11.10.: nur der laufende Zeitraum gilt (ein Tagesfokus von gestern ist heute leer).
    const aktuell = fokusZeitraum(h, heute);
    const m = fokusZelle(mein, kM, fokusAlt(eigenAlt?.fokus, h, { jahr, laufend, bereich }), aktuell);
    horizonte[h] = {
      unser: fokusZelle(unser, kU, fokusAlt(zAlt, h, { jahr, laufend, bereich, einheit }), aktuell),
      mein: { ...m, geteilt: fokusGeteilt(mein, kM) },
      // Partner: NUR einzeln Geteiltes (bzw. alles, wenn die Person ihre eigenen Ziele ganz teilt — Konto › teilt.ziele).
      partner: partnerDaten.flatMap(({ p, sicht, d, alt }) => {
        if (sicht === 'nichts') return [];
        if (sicht === 'geteilte' && !fokusGeteilt(d, kM)) return [];
        const zelle = fokusZelle(d, kM, sicht === 'alles' ? fokusAlt(alt, h, { jahr, laufend, bereich }) : '', aktuell);
        return zelle.text ? [{ speicher: p.speicher, vorname: p.vorname, text: zelle.text }] : [];
      }),
    };
  }
  return { bereich, einheit, jahr, laufend, horizonte, einheiten: bereich === 'business' ? fokusEinheiten() : [], partner, darfUnser: z.voll };
}

/** Kontrollfluss in der Sperre: nichts schreiben (Konflikt oder unverändert). */
class NichtSchreiben extends Error { constructor(readonly grund: 'konflikt' | 'gleich') { super(grund); } }

export interface FokusSchreiben {
  bereich: FokusBereich; wessen: FokusWessen; horizont: FokusHorizont; jahr?: number; einheit?: string;
  /** Neuer Satz (leer = bewusst leer). */
  text?: string;
  /** Nur „Mein Fokus“: teilen ein/aus. */
  geteilt?: boolean;
  /** Der Stand der Zelle, den die Person gesehen hat. */
  stand: string;
}
export type FokusSchreibErgebnis = { ok: true; geaendert: boolean; zelle: FokusZelle & { geteilt?: boolean } } | { ok: false; konflikt: true; zelle: FokusZelle & { geteilt?: boolean } } | ({ ok: false } & FokusFehler);

/** Einen Satz setzen bzw. teilen — Prüfung und Schreiben in EINER Sperre, Protokoll nur mit Schlüssel und Feldname, nie der Text. */
export async function fokusSchreiben(person: string | null | undefined, e: FokusSchreiben, wer: Wer): Promise<FokusSchreibErgebnis> {
  const z = await zugang(person, e.bereich);
  if ('fehler' in z) return { ok: false, ...z };
  if (e.wessen === 'unser' && !z.voll) return { ok: false, fehler: 'Mit Business-Zugang liest du den gemeinsamen Fokus nur — ändern können ihn die Mitglieder des Haushalts.', status: 403 };
  if (e.wessen === 'unser' && typeof e.geteilt === 'boolean') return { ok: false, fehler: 'Teilen gibt es nur für den eigenen Fokus.', status: 400 };
  if (!einheitOk(e.einheit) || (e.einheit && (e.bereich !== 'business' || e.wessen !== 'unser') && e.einheit !== FOKUS_GESAMT)) return { ok: false, fehler: 'Eine Gesellschaft gibt es nur beim gemeinsamen Business-Fokus.', status: 400 };
  const laufend = laufendesJahr();
  const jahr = e.horizont === 'jahr' ? (e.jahr ?? laufend) : laufend;
  if (!Number.isInteger(jahr) || Math.abs(jahr - laufend) > 10) return { ok: false, fehler: 'Jahr höchstens 10 Jahre um heute.', status: 400 };
  const schluessel = fokusSchluesselNeu(e.horizont, { jahr, bereich: e.bereich, wessen: e.wessen, einheit: e.einheit });
  const name = fokusBestand(e.bereich, e.wessen, e.wessen === 'unser' ? z.haushalt : z.person);
  // Altbestand (nur lesen) für den Stand der Zelle — außerhalb der Sperre, er wird nie geschrieben.
  const altQuelle = e.wessen === 'unser' ? fokusFuerLaufendesJahr((await altLesen(z.alt, 'ziele'))?.fokus ?? {}, laufend) : (await altLesen(z.alt, speicherFuer('ziele-eigen', z.person)))?.fokus ?? {};
  const alt = fokusAlt(altQuelle, e.horizont, { jahr, laufend, bereich: e.bereich, einheit: e.einheit });
  // Prüf-Fund 11.10.: der Satz trägt seinen Zeitraum (Tag, Woche, Monat, Quartal) — gelesen wird nur der laufende.
  const aktuell = fokusZeitraum(e.horizont, localDay());
  const zelleVon = (d: FokusDatei | null | undefined) => ({ ...fokusZelle(d, schluessel, alt, aktuell), ...(e.wessen === 'mein' ? { geteilt: fokusGeteilt(d, schluessel) } : {}) });
  try {
    const neu = await fokusAendern(e.bereich, e.wessen, e.wessen === 'unser' ? z.haushalt : z.person, cur => {
      if (fokusZelle(cur, schluessel, alt, aktuell).stand !== e.stand) throw new NichtSchreiben('konflikt');
      const vorher = zelleVon(cur);
      // Derselbe Satz ohne Zeitraum (`unbekannt`) erneut gespeichert = für den laufenden Zeitraum bestätigt (11.10.).
      const textGleich = typeof e.text !== 'string' || (e.text === vorher.text && vorher.quelle !== 'alt' && !vorher.unbekannt);
      const teilenGleich = typeof e.geteilt !== 'boolean' || e.geteilt === vorher.geteilt;
      if (textGleich && teilenGleich) throw new NichtSchreiben('gleich');
      return fokusAnwenden(cur, schluessel, { ...(textGleich ? {} : { text: e.text, zeitraum: aktuell }), ...(teilenGleich ? {} : { geteilt: e.geteilt }) });
    });
    await protokolliere(name, [{ op: 'geaendert', id: schluessel, felder: [typeof e.text === 'string' ? 'text' : '', typeof e.geteilt === 'boolean' ? 'geteilt' : ''].filter(Boolean) }], wer);
    return { ok: true, geaendert: true, zelle: zelleVon(neu) };
  } catch (x) {
    if (!(x instanceof NichtSchreiben)) throw x;
    const aktuell = zelleVon(await fokusLaden(e.bereich, e.wessen, e.wessen === 'unser' ? z.haushalt : z.person));
    return x.grund === 'konflikt' ? { ok: false, konflikt: true, zelle: aktuell } : { ok: true, geaendert: false, zelle: aktuell };
  }
}

/**
 * Der Fokus der AUSLÖSENDEN Person für ZOE/Agenten: je sichtbarem Bereich (Privat nur mit Privat-Zugang) die gesetzten Sätze des laufenden
 * Zeitraums — Unser, Mein und, was Partner mit ihr teilen. Ohne Person/Haushalt: nichts (kein Rückfall auf den Inhaber). Wirft nie.
 */
export async function fokusZeilenFuer(person: string | null | undefined, o: { bereich?: FokusBereich; horizonte?: readonly FokusHorizont[] } = {}): Promise<FokusZeile[]> {
  try {
    const z = await planZugangFuer(person);
    if (!z) return [];
    const bereiche: FokusBereich[] = o.bereich ? [o.bereich] : z.sicht === 'privat' ? ['privat', 'business'] : ['business'];
    const hs = o.horizonte ?? FOKUS_HORIZONTE;
    const aus: FokusZeile[] = [];
    for (const b of bereiche) {
      const einheiten = b === 'business' ? fokusEinheiten().map(x => x.id) : [FOKUS_GESAMT];
      for (const [k, e] of einheiten.entries()) {
        const s = await fokusSichtFuer(person, b, { einheit: e });
        if ('fehler' in s) continue;
        for (const h of hs) {
          const v = s.horizonte[h];
          // Prüf-Fund 11.10.: ein Tagesfokus ohne Zeitraum (vor dem 11.10. gesetzt) kann von einem früheren Tag sein — ZOE bekommt ihn nicht als „Heute“.
          if (h === 'tag' && v.unser.unbekannt) v.unser = { ...v.unser, text: '' };
          if (h === 'tag' && v.mein.unbekannt) v.mein = { ...v.mein, text: '' };
          if (v.unser.text) aus.push({ bereich: b, horizont: h, wer: 'Unser', ...(e !== FOKUS_GESAMT ? { einheit: s.einheiten.find(x => x.id === e)?.name ?? e } : {}), text: v.unser.text });
          // Mein Fokus und Geteiltes hängen nicht an der Gesellschaft — nur einmal je Bereich.
          if (k === 0) {
            if (v.mein.text) aus.push({ bereich: b, horizont: h, wer: 'Mein', text: v.mein.text });
            for (const p of v.partner) aus.push({ bereich: b, horizont: h, wer: `${p.vorname} (geteilt)`, text: p.text });
          }
        }
      }
    }
    return aus;
  } catch { return []; }
}

/** Der Fokus-Block für Prompts (im `<daten>`-Rahmen) — ehrlich „keiner gesetzt“, wenn es nichts gibt. */
export async function fokusSatzFuer(person: string | null | undefined, o: { bereich?: FokusBereich; horizonte?: readonly FokusHorizont[] } = {}): Promise<string> {
  return fokusSatz(await fokusZeilenFuer(person, o));
}
