// ─── Prozesse — welche Werte ein Feld in „nur wenn …“ hat (Feinschliff 24.10., Bau-Test: „Produkt ist Vertriebsaufbau“ traf nie) ───────────────────────────
// Der Motor vergleicht Kennungen (`mandat.produkt` = `l-…`, `deal.stufe` = `angebot`, `lead.zustaendig` = Speichername …) — ein Name als freier Text trifft nie.
// Regel (Kevin, Runde 2): Felder mit Kennungs-Werten bekommen eine AUSWAHL (Name sichtbar, Kennung gespeichert); Freitext nur für echte Textfelder.
//   · `FELD_WERTE`   je Feld die Werte: eine feste Liste (Status, Temperatur, BEAN, Ampel …) oder eine Auswahlquelle des Haushalts (Produkte, Stufen, Gesellschaften,
//                    Personen, Pakete — der Server liefert sie über GET /api/prozesse/katalog?auswahl=1, nur Business, nur Kennung + Name).
//   · `feldWerte`    die Optionen eines Felds (ja/nein-Felder und Agenten-Ausgaben mit Auswahl ergeben sich aus ihrer Art).
//   · `wertLage`     wie ein gespeicherter Wert zur Liste steht: Kennung (gut), genau ein Name (alter Freitext → „bitte aus der Liste wählen“, nie still umgeschrieben),
//                    fremd (steht nicht in der Liste).
//   · `bedingungWertBefunde` dieselbe Regel als Befund (`offen`: der Entwurf speichert, veröffentlicht wird erst mit einem Wert aus der Liste).
// Rein und client-sicher.

import { GESELLSCHAFT_DES_FALLS, type AuswahlQuelle } from './baustein-katalog';
import { EREIGNIS_FELDER, FALL_FELDER } from './ausloeser';
import { KG_FALL_FELDER } from './kundengewinnung/felder';
import { TEMPERATUREN, type Bedingung, type Befund, type ProzessDefinition } from './definition';
import { LIFECYCLE_WAHL } from '@/lib/crm/lifecycle';
import type { EventAnmeldung, KampagnenErgebnis, KampagnenStatus, LeadStatus, MandatStatus } from '@/lib/crm/typen';

export interface WertOption { id: string; label: string; hinweis?: string }
/** Woher die Werte eines Felds kommen: feste Liste bzw. eine Auswahlquelle des Haushalts (`dazu` = feste Zusätze, `ohne` = Werte der Quelle, die hier nicht passen). */
export type FeldWerte = { art: 'liste'; optionen: readonly WertOption[] } | { art: 'quelle'; quelle: AuswahlQuelle; dazu?: readonly WertOption[]; ohne?: readonly string[] };

const aus = <K extends string>(m: Readonly<Record<K, string>>): WertOption[] => (Object.entries(m) as [K, string][]).map(([id, label]) => ({ id, label }));
// Die Listen spiegeln die Typen des CRM (Record über den Typ → tsc meldet jede fehlende Kennung).
const LEAD_STATUS: Readonly<Record<LeadStatus, string>> = { neu: 'Neu', kontaktiert: 'Kontaktiert', im_gespraech: 'Im Gespräch', qualifizierung: 'Qualifizierung', sql: 'SQL', kunde: 'Kunde', kein_fit: 'Kein Fit', ruht: 'Ruht' };
const MANDAT_STATUS: Readonly<Record<MandatStatus, string>> = { angebot: 'Angebot', verhandlung: 'Verhandlung', aktiv: 'Aktiv', pausiert: 'Pausiert', beendet: 'Beendet' };
const ANMELDUNG: Readonly<Record<EventAnmeldung, string>> = { geplant: 'Geplant', angemeldet: 'Angemeldet', abgesagt: 'Abgesagt', besucht: 'Besucht' };
const KAMPAGNE_STATUS: Readonly<Record<KampagnenStatus, string>> = { entwurf: 'Entwurf', aktiv: 'Aktiv', abgeschlossen: 'Abgeschlossen', abgebrochen: 'Abgebrochen' };
const KAMPAGNE_ERGEBNIS: Readonly<Record<KampagnenErgebnis | 'offen', string>> = { offen: 'noch keins', angesprochen: 'Angesprochen', reagiert: 'Reagiert', gespraech: 'Gespräch', chance: 'Chance', kein_interesse: 'Kein Interesse' };
const EVENT_STATUS: Readonly<Record<'idee' | 'geplant' | 'einladung' | 'durchgefuehrt' | 'abgesagt', string>> = { idee: 'Idee', geplant: 'Geplant', einladung: 'Einladung', durchgefuehrt: 'Durchgeführt', abgesagt: 'Abgesagt' };
const TEMPERATUR_NAME: Readonly<Record<(typeof TEMPERATUREN)[number], string>> = { kalt: 'kalt', lau: 'lau', warm: 'warm', heiss: 'heiß' };
const BEAN: Readonly<Record<'B' | 'E' | 'A' | 'N', string>> = { B: 'B · Bestandskunde', E: 'E · Ehemalig', A: 'A · Angebotskunde', N: 'N · Neu' };
const AMPEL: Readonly<Record<'gruen' | 'gelb' | 'rot', string>> = { gruen: 'grün', gelb: 'gelb', rot: 'rot' };
const KANAL: Readonly<Record<'mail' | 'telefon' | 'linkedin' | 'keiner', string>> = { mail: 'Mail', telefon: 'Telefon', linkedin: 'LinkedIn', keiner: 'keiner' };
/** ja/nein-Felder: gespeichert wird der Wahrheitswert (der Motor liefert true/false). */
export const JA_NEIN: readonly WertOption[] = [{ id: 'true', label: 'ja' }, { id: 'false', label: 'nein' }];
/** Zuständig im CRM = Speichername eines Kontos oder „beide“ (lib/crm/team.ts). */
const BEIDE: readonly WertOption[] = [{ id: 'beide', label: 'Beide' }];

const liste = (optionen: readonly WertOption[]): FeldWerte => ({ art: 'liste', optionen });
const quelle = (q: AuswahlQuelle, o: { dazu?: readonly WertOption[]; ohne?: readonly string[] } = {}): FeldWerte => ({ art: 'quelle', quelle: q, ...o });

/** Die Werte je Feld (Kennung des Felds → Liste bzw. Quelle). Felder ohne Eintrag sind Text bzw. Zahl (frei). */
export const FELD_WERTE: Readonly<Record<string, FeldWerte>> = {
  'lead.status': liste(aus(LEAD_STATUS)), 'firma.lead-status': liste(aus(LEAD_STATUS)),
  'lead.temperatur': liste(aus(TEMPERATUR_NAME)), 'lead.bean': liste(aus(BEAN)), 'firma.bean': liste(aus(BEAN)),
  'lead.lifecycle': liste(LIFECYCLE_WAHL.map(x => ({ id: x.id, label: x.label }))),
  'lead.zustaendig': quelle('konto-person', { dazu: BEIDE }), 'deal.zustaendig': quelle('konto-person', { dazu: BEIDE }), 'mandat.zustaendig': quelle('konto-person', { dazu: BEIDE }),
  'deal.stufe': quelle('pipeline-stufe'),
  'deal.gesellschaft': quelle('gesellschaft', { ohne: [GESELLSCHAFT_DES_FALLS] }), 'mandat.gesellschaft': quelle('gesellschaft', { ohne: [GESELLSCHAFT_DES_FALLS] }),
  'mandat.status': liste(aus(MANDAT_STATUS)),
  'mandat.produkt': quelle('produkt'), 'bezug.leistungid': quelle('produkt'),
  'fall.paket': quelle('paket'), 'bezug.vorlageid': quelle('paket'),
  'event.anmeldung': liste(aus(ANMELDUNG)), 'event.status': liste(aus(EVENT_STATUS)),
  'kampagne.status': liste(aus(KAMPAGNE_STATUS)), 'lead.kampagnen-ergebnis': liste(aus(KAMPAGNE_ERGEBNIS)),
  'lead.ampel-mail': liste(aus(AMPEL)), 'lead.ampel-telefon': liste(aus(AMPEL)), 'deal.ampel': liste(aus(AMPEL)), 'deal.ampel-mail': liste(aus(AMPEL)),
  'mandat.ampel': liste(aus(AMPEL)), 'mandat.ampel-mail': liste(aus(AMPEL)),
  'lead.bester-kanal': liste(aus(KANAL)), 'firma.bester-kanal': liste(aus(KANAL)),
  'mandat.verlaengerung': liste(aus({ auto: 'automatisch', manuell: 'von Hand', offen: 'offen' })),
  'lead.einladungsweg': liste(aus({ mail: 'Mail', persoenlich: 'persönlich' })),
  'lead.buchung-folge': liste(aus({ deal: 'Deal', qualifizierung: 'Qualifizierung', keine: 'keine' })),
};

/** Die Art eines Felds (Ereignis, Fall, Kundengewinnung) — ja/nein-Felder bekommen die Auswahl ja/nein. */
const ART_JE_FELD: ReadonlyMap<string, string> = new Map([...EREIGNIS_FELDER, ...Object.values(FALL_FELDER).flat(), ...Object.values(KG_FALL_FELDER).flat()].map(f => [f.id, f.art]));

/** Woher die Werte eines Felds kommen (rein) — auch ja/nein-Felder und Agenten-Ausgaben (Auswahl bzw. ja/nein); sonst null (frei). */
export function feldWerteDef(feld: string, d?: Pick<ProzessDefinition, 'knoten'>): FeldWerte | null {
  const fest = FELD_WERTE[feld];
  if (fest) return fest;
  if (ART_JE_FELD.get(feld) === 'ja-nein') return liste(JA_NEIN);
  if (feld.startsWith('agent.') && d) {
    const id = feld.slice(6);
    for (const k of d.knoten) {
      const f = k.agent?.ausgabe.find(x => x.id === id);
      if (f?.art === 'ja-nein') return liste(JA_NEIN);
      if (f?.art === 'auswahl' && f.optionen?.length) return liste(f.optionen.map(o => ({ id: o, label: o })));
    }
  }
  return null;
}

/** Die Optionen eines Felds (rein): feste Liste bzw. die Werte der Quelle (`auswahl` — vom Server, nur Business). null = frei; [] = Quelle noch leer/unbekannt. */
export function feldWerte(feld: string, auswahl: Partial<Record<AuswahlQuelle, readonly WertOption[]>>, d?: Pick<ProzessDefinition, 'knoten'>): WertOption[] | null {
  const w = feldWerteDef(feld, d);
  if (!w) return null;
  if (w.art === 'liste') return [...w.optionen];
  return [...(auswahl[w.quelle] ?? []).filter(o => !w.ohne?.includes(o.id)), ...(w.dazu ?? [])];
}

/** Text-Vergleichsform (wie lib/prozesse/bedingung.ts). */
const norm = (v: unknown): string => String(v ?? '').normalize('NFC').trim().toLowerCase();
/** ja/nein als Wahrheitswert (Option „true“/„false“) — so liefert ihn der Motor. */
export const wertAusOption = (feld: string, id: string, d?: Pick<ProzessDefinition, 'knoten'>): string | boolean => {
  const w = feldWerteDef(feld, d);
  return w?.art === 'liste' && w.optionen === JA_NEIN ? id === 'true' : id;
};

export type WertLage = { art: 'leer' } | { art: 'kennung'; option: WertOption } | { art: 'name'; option: WertOption } | { art: 'fremd' };
/**
 * Wie ein Wert zur Liste steht (rein): Kennung → gut; genau ein Name passt (alter Freitext, z. B. „Vertriebsaufbau“) → `name` (die Werkstatt zeigt „bitte aus der Liste
 * wählen“ — umgeschrieben wird nie still); sonst `fremd`.
 */
export function wertLage(wert: unknown, optionen: readonly WertOption[]): WertLage {
  if (wert === undefined || wert === null || (typeof wert === 'string' && !wert.trim())) return { art: 'leer' };
  const k = optionen.find(o => norm(o.id) === norm(wert));
  if (k) return { art: 'kennung', option: k };
  const n = optionen.filter(o => norm(o.label) === norm(wert));
  return n.length === 1 ? { art: 'name', option: n[0] } : { art: 'fremd' };
}

/**
 * Befunde für Bedingungen mit Werten außerhalb der Liste (rein): `offen` — der Entwurf speichert, veröffentlicht wird erst mit einem Wert aus der Liste (verglichen
 * wird die Kennung; ein Name trifft nie). `ids` = die gültigen Kennungen einer Quelle (Server: `PruefKontext.auswahl`; null = unbekannt → nicht prüfen).
 */
export function bedingungWertBefunde(bedingungen: readonly Bedingung[] | undefined, o: { ids: (q: AuswahlQuelle) => readonly string[] | null; d?: Pick<ProzessDefinition, 'knoten'>; wo: string; feldName: (id: string) => string; knotenId?: string }): Befund[] {
  const raus: Befund[] = [];
  (bedingungen ?? []).forEach((b, i) => {
    if (b.op !== 'gleich' && b.op !== 'ungleich' && b.op !== 'einer-von') return;
    const w = feldWerteDef(b.feld, o.d);
    if (!w) return;
    const ids = w.art === 'liste' ? w.optionen.map(x => x.id) : (() => { const l = o.ids(w.quelle); return l ? [...l.filter(x => !w.ohne?.includes(x)), ...(w.dazu ?? []).map(x => x.id)] : null; })();
    if (!ids) return;
    const werte = Array.isArray(b.wert) ? b.wert : [b.wert];
    const fremd = werte.filter(x => x !== undefined && x !== null && !(typeof x === 'string' && !x.trim()) && !ids.some(id => norm(id) === norm(x)));
    if (fremd.length) {
      raus.push({ stufe: 'offen', text: `${o.wo} ${i + 1}: „${fremd.map(String).join(', ')}“ steht nicht in der Liste von „${o.feldName(b.feld)}“ — bitte aus der Liste wählen (verglichen wird die Kennung, ein Name trifft nie).`, feld: 'bedingungen', ...(o.knotenId ? { knotenId: o.knotenId } : {}) });
    }
  });
  return raus;
}
