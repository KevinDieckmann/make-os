// ─── Inbox 2 — EIN Strom aus allen Postfächern (rein, client-sicher, 06.10.2026) ─────────────────────────────────
// Aus den Köpfen der Spiegel (Gmail: lib/gmail/stand.ts · IMAP: lib/postfach/spiegel.ts — beide in derselben Kopf-Form) werden
// GESPRÄCHE (nicht Einzelmails) mit Fach, Bereich, Gegenseite, Zuordnung, Wiedervorlage. Kennungen:
//   Gmail  `gm~<threadId>`                      (Thread von Google)
//   IMAP   `im~<postfach>~<20 hex>`             (Gespräch über Message-ID · In-Reply-To · References, Schlüssel aus der Wurzel der
//                                                ältesten Nachricht — bleibt beim Abgleich stabil)
//   WhatsApp `wa~<postfach>~<Gesprächspartner>` (Adapter lib/whatsapp/strom.ts, 07.10. — Postfach = Business-Nummer der Instanz)
// Die Bereichstrennung passiert NICHT hier, sondern auf dem Server vor der Antwort (lib/inbox/strom-server.ts `nurBereich`) — diese
// Datei rechnet nur. Kein Mailtext: nur Kopf, Betreff, Ausschnitt.

import { fachVon, fristAus, type FachId, type FachNachricht } from './faecher';
import type { Adr, GmailKopf, Zuordnung } from '@/lib/gmail/typen';
import type { Fenster, WaKopfInfo } from '@/lib/whatsapp/typen';
import type { GespraechTeam } from './teilen';

export type GespraechQuelle = 'gmail' | 'imap' | 'whatsapp';

/**
 * Ein Kopf im Strom (Gmail- oder IMAP-Kopf, plus die Stellen, die nur IMAP hat). `wa` nur bei WhatsApp (07.10.): Art der Nachricht,
 * Zustellstand (ausgehend) und Zustand des Mediums — damit die Gesprächsansicht Medien nur auf Klick lädt und „zugestellt/gelesen“ zeigt.
 */
export type StromKopf = GmailKopf & { postfachId?: string; ordner?: 'e' | 'g' | 'a'; automatisch?: boolean; wurzel?: string; wa?: WaKopfInfo };

export interface PostfachKurz { id: string; quelle: GespraechQuelle; bereich: string | null; anzeigename: string; eigene: string[] }

export interface GespraechZustand { spaeter?: { bis: string; seit: string }; erledigt?: { bis: string; am: string }; zuordnung?: { kontaktId: string; am: string } }

export interface Gespraech {
  id: string;
  quelle: GespraechQuelle;
  postfachId: string;
  bereich: string | null;
  betreff: string;
  gegenueber: Adr;
  anzahl: number;
  /** Jüngste Nachricht (auch automatische) — Zeit und Ausschnitt der Zeile. */
  am: string;
  ausschnitt: string;
  /** Die jüngste ECHTE Nachricht ist von uns. */
  vonUns: boolean;
  ungelesen: boolean;
  /** Liegt (noch) im Posteingang. */
  offen: boolean;
  anhaenge: number;
  fach: FachId | 'geblockt';
  wartetTage?: number;
  nachfassen?: boolean;
  verjaehrt?: boolean;
  /** Seit wann die Gegenseite auf uns wartet (Tage, nur Antworten). */
  wartetAufUns?: number;
  /** Wiedervorlage: `faellig` (heute oder früher) bzw. das Datum, bis zu dem es ruht. */
  wiedervorlage?: 'faellig' | string;
  zuordnung?: Zuordnung;
  /** „Zuordnen“ wurde bestätigt (Verlauf der Akte). */
  zugeordnet?: boolean;
  /** Adresse der Gegenseite (Screener-Entscheidung). */
  absender: string;
  frist?: { datum: string; text: string };
  /** Kennung der jüngsten Nachricht (Antworten bezieht sich darauf). */
  juengste: string;
  /** Alle Nachrichten-Kennungen (nur serverseitig genutzt; im Browser für die Gesprächsansicht). */
  nachrichten: string[];
  /** In der Arbeitsliste (offen bzw. wartend, nicht ruhend, nicht erledigt). */
  inArbeit: boolean;
  /**
   * Nur WhatsApp (07.10., lib/whatsapp/strom.ts): Nummer der Gegenseite (wa_id), Profilname und das 24-h-Kundenservice-Fenster
   * (frei schreiben nur, solange `fenster.offen`; sonst Vorlage). Uhr/Vorlagen-Wähler: components/os/whatsapp/.
   */
  whatsapp?: { nummer: string; fenster: Fenster; profilname?: string };
  /**
   * Team (08.10., Lücke 6): Gespräch eines Team-Postfachs bzw. der WhatsApp-Business-Nummer — „wer kümmert sich“ und gemeinsamer
   * Zustand (lib/inbox/teilen.ts, gesetzt auf dem Server in strom-server.ts).
   */
  team?: GespraechTeam;
}

// ── Gesprächs-Kennungen ─────────────────────────────────────────────────────

export const GESPRAECH_ID = /^(gm~[A-Za-z0-9]{1,40}|im~pf-[0-9a-f-]{36}~[0-9a-f]{20}|wa~pf-[0-9a-f-]{36}~[0-9]{6,20})$/;
export const istGespraechId = (v: unknown): v is string => typeof v === 'string' && GESPRAECH_ID.test(v);
export const gespraechTeile = (id: string): { quelle: GespraechQuelle; postfach: string; schluessel: string } | null => {
  if (!istGespraechId(id)) return null;
  const t = id.split('~');
  if (t[0] === 'gm') return { quelle: 'gmail', postfach: 'gmail', schluessel: t[1] };
  return { quelle: t[0] === 'im' ? 'imap' : 'whatsapp', postfach: t[1], schluessel: t[2] };
};
/** Link zum Gespräch in MAKE OS (Verlauf der Kontaktakte, Aufgaben, Termine) — nur die Kennung, nie Betreff/Adresse. */
export const gespraechPfad = (id: string): string => `/os/inbox?offen=${id}`;

// ── IMAP: Nachrichten zu Gesprächen bündeln (Union-Find über Message-IDs) ─────

/** Gesprächs-Schlüssel je Kopf-Kennung (rein). `hash` liefert den Fingerabdruck der Wurzel (Server: sha256; Tests: beliebig). */
export function imapFaeden(koepfe: readonly StromKopf[], hash: (s: string) => string): Map<string, string> {
  const eltern = new Map<string, string>();
  const finde = (x: string): string => { let r = x; while (eltern.get(r) && eltern.get(r) !== r) r = eltern.get(r)!; let y = x; while (y !== r) { const n = eltern.get(y)!; eltern.set(y, r); y = n; } return r; };
  const vereinen = (a: string, b: string) => { const ra = finde(a), rb = finde(b); if (ra !== rb) eltern.set(rb, ra); };
  const knoten = (k: StromKopf) => k.messageId ?? `<${k.id}>`;
  for (const k of koepfe) {
    const ich = knoten(k);
    if (!eltern.has(ich)) eltern.set(ich, ich);
    for (const r of [...(k.references ?? []), ...(k.inReplyTo ? [k.inReplyTo] : [])]) { if (!eltern.has(r)) eltern.set(r, r); vereinen(ich, r); }
  }
  // Schlüssel je Gruppe: die Wurzel der ältesten Nachricht der Gruppe.
  const aeltester = new Map<string, StromKopf>();
  for (const k of koepfe) { const g = finde(knoten(k)); const a = aeltester.get(g); if (!a || k.am < a.am || (k.am === a.am && k.id < a.id)) aeltester.set(g, k); }
  const raus = new Map<string, string>();
  for (const k of koepfe) { const a = aeltester.get(finde(knoten(k)))!; raus.set(k.id, hash(`${k.postfachId}|${a.wurzel ?? knoten(a)}`)); }
  return raus;
}

// ── Gespräche bauen ─────────────────────────────────────────────────────────

export interface StromEingabe {
  postfaecher: PostfachKurz[];
  /** Köpfe je Postfach-Kennung (Gmail unter `gmail`). */
  koepfe: Record<string, StromKopf[]>;
  /** Zuordnung je Kopf-Kennung (Anzeige). */
  zuordnung: Record<string, Zuordnung>;
  zustand: Record<string, GespraechZustand>;
  absender: Record<string, { status: 'zugelassen' | 'geblockt' }>;
  heute: string;
  /** Schlüsselfunktion für IMAP-Gespräche. */
  hash: (s: string) => string;
}

const tageZwischen = (iso: string, heute: string) => Math.max(0, Math.floor((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T12:00:00Z`)) / 86_400_000));

export function gespraecheBauen(e: StromEingabe): Gespraech[] {
  // Wen haben WIR je angeschrieben (alle Postfächer der Person) — kein „neuer Absender“.
  const angeschrieben = new Set<string>();
  const vonUnsFn = (p: PostfachKurz) => (k: StromKopf): boolean => k.labels.includes('SENT') || k.ordner === 'g' || p.eigene.includes(k.von.email);
  for (const p of e.postfaecher) for (const k of e.koepfe[p.id] ?? []) if (vonUnsFn(p)(k)) for (const a of [...k.an, ...k.cc]) angeschrieben.add(a.email);

  const raus: Gespraech[] = [];
  for (const p of e.postfaecher) {
    const liste = e.koepfe[p.id] ?? [];
    if (!liste.length) continue;
    const vonUns = vonUnsFn(p);
    const gruppen = new Map<string, StromKopf[]>();
    if (p.quelle === 'gmail') for (const k of liste) { const g = `gm~${k.threadId}`; (gruppen.get(g) ?? gruppen.set(g, []).get(g)!).push(k); }
    else {
      const faeden = imapFaeden(liste, e.hash);
      for (const k of liste) { const g = `im~${p.id}~${faeden.get(k.id)}`; (gruppen.get(g) ?? gruppen.set(g, []).get(g)!).push(k); }
    }
    for (const [id, roh] of gruppen) {
      const n = [...roh].sort((a, b) => a.am.localeCompare(b.am) || a.id.localeCompare(b.id));
      const fachN: FachNachricht[] = n.map(k => ({ am: k.am, von: k.von, betreff: k.betreff, ausschnitt: k.ausschnitt, labels: k.labels, liste: k.liste, automatisch: k.automatisch, anhaenge: k.anhaenge, vonUns: vonUns(k) }));
      const z = n.map(k => e.zuordnung[k.id]).find(Boolean);
      const juengste = n[n.length - 1];
      // Gegenseite: aus der jüngsten Nachricht, die nicht von uns ist — sonst der erste Empfänger unserer letzten.
      const fremd = [...n].reverse().find(k => !vonUns(k));
      const unsere = [...n].reverse().find(k => vonUns(k));
      const gegenueber: Adr = fremd ? (fremd.antwortAn ?? fremd.von) : (unsere?.an[0] ?? unsere?.cc[0] ?? juengste.von);
      const absender = gegenueber.email;
      const st = e.zustand[id] ?? {};
      const f = fachVon({ nachrichten: fachN, zugeordnet: !!z && !z.sperre, absender: e.absender[absender]?.status, angeschrieben: angeschrieben.has(absender), heute: e.heute });
      const massgeblich = n[f.massgeblich] ?? juengste;
      const offen = p.quelle === 'gmail' ? n.some(k => k.labels.includes('INBOX')) : n.some(k => k.ordner === 'e');
      // Wiedervorlage: ruht bis `bis`; eine neue Nachricht nach dem Zurücklegen holt das Gespräch sofort zurück.
      const neuerAlsSpaeter = !!st.spaeter && n.some(k => k.am > st.spaeter!.seit);
      const wiedervorlage = st.spaeter && !neuerAlsSpaeter ? (st.spaeter.bis <= e.heute ? 'faellig' as const : st.spaeter.bis) : undefined;
      const erledigtLokal = !!st.erledigt && st.erledigt.bis === juengste.id;
      const ruht = !!wiedervorlage && wiedervorlage !== 'faellig';
      const inArbeit = f.fach !== 'geblockt' && !ruht && !erledigtLokal && (f.fach === 'warten' ? !f.verjaehrt : offen);
      const frist = !massgeblich || vonUns(massgeblich) ? null : fristAus(`${massgeblich.betreff} ${massgeblich.ausschnitt}`, e.heute);
      raus.push({
        id, quelle: p.quelle, postfachId: p.id, bereich: p.bereich, betreff: (n.find(k => k.betreff)?.betreff ?? '').replace(/^((re|aw|antw|wg|fwd?)\s*:\s*)+/i, '') || '(kein Betreff)',
        gegenueber, anzahl: n.length, am: juengste.am, ausschnitt: juengste.ausschnitt, vonUns: vonUns(massgeblich), ungelesen: n.some(k => k.labels.includes('UNREAD') && !vonUns(k)),
        offen, anhaenge: n.reduce((s, k) => s + k.anhaenge.filter(a => !a.eingebettet).length, 0), fach: f.fach,
        ...(f.wartetTage !== undefined ? { wartetTage: f.wartetTage } : {}), ...(f.nachfassen ? { nachfassen: true } : {}), ...(f.verjaehrt ? { verjaehrt: true } : {}),
        ...(f.fach !== 'warten' && f.fach !== 'info' && !vonUns(massgeblich) ? { wartetAufUns: tageZwischen(massgeblich.am, e.heute) } : {}),
        ...(wiedervorlage ? { wiedervorlage } : {}), ...(z ? { zuordnung: z } : {}), ...(st.zuordnung ? { zugeordnet: true } : {}),
        absender, ...(frist ? { frist } : {}), juengste: juengste.id, nachrichten: n.map(k => k.id), inArbeit,
      });
    }
  }
  return raus;
}

// ── Lagebild und ZOE-Satz ───────────────────────────────────────────────────

export interface LageZeile {
  bereich: string | null;
  antworten: number;
  warten: number;
  nachfassen: number;
  termine: number;
  geld: number;
  neu: number;
  info: number;
  wiedervorlage: number;
}

/** Eine Zeile je Bereich (nur Gespräche in Arbeit), Reihenfolge: Privat zuletzt, ohne Bereich ganz am Ende. Rein. */
export function lageBauen(g: readonly Gespraech[]): LageZeile[] {
  const je = new Map<string | null, LageZeile>();
  const zeile = (b: string | null) => je.get(b) ?? je.set(b, { bereich: b, antworten: 0, warten: 0, nachfassen: 0, termine: 0, geld: 0, neu: 0, info: 0, wiedervorlage: 0 }).get(b)!;
  for (const x of g) {
    if (!x.inArbeit || x.fach === 'geblockt') continue;
    const z = zeile(x.bereich);
    z[x.fach]++;
    if (x.fach === 'warten' && x.nachfassen) z.nachfassen++;
    if (x.wiedervorlage === 'faellig') z.wiedervorlage++;
  }
  const rang = (b: string | null) => (b === null ? 2 : b === 'privat' ? 1 : 0);
  return Array.from(je.values()).sort((a, b) => rang(a.bereich) - rang(b.bereich) || String(a.bereich).localeCompare(String(b.bereich)));
}

export interface ZoeSatz { text: string; gespraech?: string }

const name = (g: Gespraech) => g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email;
const tageWort = (n: number) => (n === 0 ? 'heute' : n === 1 ? 'seit gestern' : `seit ${n} Tagen`);

/** Der eine Satz oben — ohne Modell aus dem Strom, nur Vorschlag (ein Klick öffnet das Gespräch). Rein. */
export function zoeSatz(g: readonly Gespraech[]): ZoeSatz {
  const arbeit = g.filter(x => x.inArbeit);
  const wv = arbeit.find(x => x.wiedervorlage === 'faellig');
  if (wv) return { text: `Heute wieder dran: „${wv.betreff}“ mit ${name(wv)}.`, gespraech: wv.id };
  const alt = (l: Gespraech[]) => [...l].sort((a, b) => (b.wartetAufUns ?? b.wartetTage ?? 0) - (a.wartetAufUns ?? a.wartetTage ?? 0) || a.am.localeCompare(b.am));
  const frist = alt(arbeit.filter(x => x.frist && x.fach !== 'info' && x.fach !== 'warten')).sort((a, b) => a.frist!.datum.localeCompare(b.frist!.datum))[0];
  if (frist) return { text: `${name(frist)} braucht „${frist.betreff}“ ${frist.frist!.text.replace(/^spätestens\s+/i, 'bis ')} — am besten heute antworten.`, gespraech: frist.id };
  const bekannt = alt(arbeit.filter(x => x.fach === 'antworten' && x.zuordnung))[0];
  if (bekannt) return { text: `Wichtigste Antwort heute: ${name(bekannt)} wartet ${tageWort(bekannt.wartetAufUns ?? 0)} auf eine Antwort zu „${bekannt.betreff}“.`, gespraech: bekannt.id };
  const nach = alt(arbeit.filter(x => x.fach === 'warten' && x.nachfassen))[0];
  if (nach) return { text: `${name(nach)} hat ${tageWort(nach.wartetTage ?? 0)} nicht geantwortet — „${nach.betreff}“ nachfassen?`, gespraech: nach.id };
  const antwort = alt(arbeit.filter(x => x.fach === 'antworten'))[0];
  if (antwort) return { text: `Als Nächstes: ${name(antwort)} — „${antwort.betreff}“.`, gespraech: antwort.id };
  return { text: 'Nichts Dringendes — die Inbox ist im Griff.' };
}

/** Sortierung je Fach (rein): Wiedervorlage fällig zuerst; Warten: am längsten wartend zuerst; sonst jüngste zuerst. */
export function sortieren<T extends Pick<Gespraech, 'wiedervorlage' | 'fach' | 'wartetTage' | 'am'>>(l: readonly T[]): T[] {
  return [...l].sort((a, b) =>
    Number(b.wiedervorlage === 'faellig') - Number(a.wiedervorlage === 'faellig')
    || (a.fach === 'warten' && b.fach === 'warten' ? (b.wartetTage ?? 0) - (a.wartetTage ?? 0) : 0)
    || b.am.localeCompare(a.am));
}
