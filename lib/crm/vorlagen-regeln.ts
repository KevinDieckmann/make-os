// ─── Markttraktion — Playbooks und Event-Vorlagen bearbeiten: die Regeln (rein, client-sicher; Restpunkte 24.10.) ───────────────────────────────────────────
// Kevin 22.10.: „alles muss anpassbar sein und es muss auch immer mal wieder zu bearbeiten sein.“ Die Playbooks der Kampagnen (lib/crm/kampagnen.ts `PLAYBOOKS`)
// und die Vorlagen eigener Abende (lib/crm/eventplanung.ts `VORLAGEN`) bleiben die Vorgabe im Code; je Haushalt gespeichert werden NUR Abweichungen und eigene
// Vorlagen (Kopien) — zusammengesetzt in lib/crm/vorlagen-anpassung.ts, gelesen NUR über lib/crm/vorlagen-anpassung-server.ts (`playbooksFuer`, `eventVorlagenFuer`).
// Hier: was bearbeitbar ist, die Grenzen (darüber 413, nie gekürzt), das Prüfen einer Eingabe (400 mit Satz) und die Hinweise über bearbeitete Texte.
// Gesetzlich Festes ist NIE bearbeitbar: der Rechtshinweis eines Playbooks (`recht`), sein Zielgruppen-Filter (`zusatz`), für wen es gilt (`fuer`) und der
// Kanal des Vernetzen-Playbooks (es steuert die Vernetzen-Runde) kommen immer aus dem Code; wechselt der Kanal, hängt der feste Satz des neuen Kanals an.
// Keine Personendaten in Vorlagen — der Bestand trägt nur Texte, Zahlen und Kennungen (wer geändert hat, steht im Änderungsprotokoll).

import { werbeWoerter } from './netzwerken-recht';

export type VorlagenArt = 'playbook' | 'event';
export const VORLAGEN_ARTEN: readonly VorlagenArt[] = ['playbook', 'event'];

/** Die Kanäle einer Kampagne (wie `Kampagne['kanal']`) mit Anzeige-Namen. */
export const PLAYBOOK_KANAELE = [
  { id: 'persoenlich', label: 'persönlich' }, { id: 'telefon', label: 'Telefon' }, { id: 'mail', label: 'Mail' },
  { id: 'linkedin', label: 'LinkedIn' }, { id: 'event', label: 'Event' }, { id: 'mix', label: 'gemischt' },
] as const;
export type PlaybookKanal = typeof PLAYBOOK_KANAELE[number]['id'];
/** Werbliche Kanäle — dort sind werbliche Wörter Werbung per elektronischer Post (§ 7 UWG). Wie lib/crm/personen-schranke.ts `WERBLICHE_KANAELE`. */
export const WERBLICH: ReadonlySet<string> = new Set(['mail', 'linkedin']);
/**
 * Der feste Rechtssatz je Kanal (Hinweis, keine Rechtsberatung) — hängt an den Rechtshinweis eines Playbooks, wenn sein Kanal von der Vorgabe abweicht.
 * Fest im Code: nie gespeichert, nie bearbeitbar.
 */
export const KANAL_RECHT: Readonly<Record<PlaybookKanal, string>> = {
  persoenlich: 'Persönlich im Gespräch — Werbung danach per Mail nur mit Einwilligung.',
  telefon: 'Anruf nur mit Anlass aus der Beziehung (mutmaßliche Einwilligung, § 7 Abs. 2 Nr. 1 UWG).',
  mail: 'Werbung per Mail nur mit Einwilligung oder als Bestandskunde mit Widerspruchshinweis (§ 7 Abs. 2 Nr. 2, Abs. 3 UWG).',
  linkedin: 'LinkedIn-Nachrichten zählen als elektronische Post — ohne Einwilligung nur Vernetzen (§ 7 UWG).',
  event: 'Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG); Teilnahme ist keine Einwilligung.',
  mix: 'Je Kanal gilt seine Ampel — Mail und LinkedIn nur mit Grundlage (§ 7 UWG).',
};
/** Der feste Satz über jeder Event-Vorlage (nie bearbeitbar). */
export const EVENT_RECHT = 'Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG): per Mail nur mit Grundlage, sonst persönlich. Teilnahme ist keine Einwilligung.';
/** Playbooks, deren Kanal fest bleibt und die nicht kopiert werden (sie steuern einen eigenen Ablauf): Vernetzen = die Vernetzen-Runde auf LinkedIn. */
export const KANAL_FEST: ReadonlySet<string> = new Set(['vernetzen']);
export const NICHT_KOPIERBAR: ReadonlySet<string> = new Set(['vernetzen']);

export const VORLAGEN_GRENZEN = {
  eigene: 30,
  name: 80, kurz: 200, warum: 1000, kennzahl: 160, schritte: 20, schrittText: 300, schrittTag: 365,
  label: 60, beschreibung: 400, kapazitaet: 1000, ablauf: 30, ablaufPunkt: 200, checkliste: 40, checklistenText: 300, tageVorherMin: -90, tageVorherMax: 180,
  budget: 20, posten: 120,
} as const;

/** Was an einem Playbook bearbeitbar ist (alles andere kommt aus dem Code). `segmentId` = Segment-Vorschlag (null = die Zielgruppe der Vorgabe). */
export interface PlaybookTeil {
  name?: string; kurz?: string; warum?: string; kennzahl?: string; kanal?: PlaybookKanal;
  segmentId?: string | null;
  schritte?: { text: string; tag: number }[];
}
export const PLAYBOOK_FELDER = ['name', 'kurz', 'warum', 'kennzahl', 'kanal', 'segmentId', 'schritte'] as const;
/** Was an einer Event-Vorlage bearbeitbar ist (Format kommt aus dem Code bzw. der Vorlage, von der kopiert wurde). */
export interface EventTeil {
  label?: string; beschreibung?: string; uhrzeit?: string; kapazitaet?: number; mixZiel?: { zielkunden: number; kunden: number };
  ablauf?: { zeit: string; punkt: string }[];
  checkliste?: { id: string; text: string; tageVorher: number }[];
  budget?: { id: string; posten: string }[];
}
export const EVENT_FELDER = ['label', 'beschreibung', 'uhrzeit', 'kapazitaet', 'mixZiel', 'ablauf', 'checkliste', 'budget'] as const;

/** Eine eigene Vorlage: die bearbeitbaren Felder + die Vorlage im Code, von der sie kopiert wurde (`basis` — daher kommen Recht, Filter, Format). */
export type EigenesPlaybook = Required<Omit<PlaybookTeil, 'segmentId'>> & { id: string; basis: string; segmentId?: string };
export type EigeneEventVorlage = Required<EventTeil> & { id: string; basis: string };

/** Der Bestand je Haushalt: Abweichungen je Kennung der Code-Vorlage + eigene Vorlagen. Kein Personenbezug. */
export interface VorlagenBestand<T, E> { v: 1; geaendert: Record<string, T>; eigene: E[]; geaendertAm?: string }
export type PlaybookBestand = VorlagenBestand<PlaybookTeil, EigenesPlaybook>;
export type EventVorlagenBestand = VorlagenBestand<EventTeil, EigeneEventVorlage>;
export const leererBestand = <T, E>(): VorlagenBestand<T, E> => ({ v: 1, geaendert: {}, eigene: [] });

/** Kennung einer eigenen Vorlage (≤ 40 Zeichen — so lang darf `Kampagne.playbook` bzw. `Event.vorlage` sein): Präfix, Basis, 8 Zeichen Zufall. */
export const EIGEN_ID: Record<VorlagenArt, RegExp> = { playbook: /^pb-([a-z0-9]{1,20})-[0-9a-f]{8}$/, event: /^evv-([a-z0-9]{1,20})-[0-9a-f]{8}$/ };
export const eigeneId = (art: VorlagenArt, basis: string, zufall: string): string => `${art === 'playbook' ? 'pb' : 'evv'}-${basis}-${zufall.replace(/[^0-9a-f]/g, '').slice(0, 8).padEnd(8, '0')}`;
/** Von welcher Code-Vorlage stammt eine eigene Kennung? (null = keine eigene Kennung) */
export const basisVon = (art: VorlagenArt, id: string): string | null => EIGEN_ID[art].exec(id)?.[1] ?? null;

export type PruefFehler = { status: 400 | 413; fehler: string };
const t = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : null);
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const PUNKT_ID = /^[a-z0-9][a-z0-9-]{0,60}$/;

/** Ein Textfeld: Pflicht (nicht leer), über der Grenze 413 — nie gekürzt. */
function text(v: unknown, name: string, max: number, pflicht = true): string | PruefFehler {
  const s = t(v);
  if (s === null || (pflicht && !s)) return { status: 400, fehler: `${name} fehlt.` };
  if (s.length > max) return { status: 413, fehler: `${name}: höchstens ${max} Zeichen (${s.length}). Nichts gespeichert.` };
  return s;
}
const istFehler = (x: unknown): x is PruefFehler => !!x && typeof x === 'object' && 'fehler' in x && 'status' in x;
const ganz = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * Die bearbeitbaren Felder eines Playbooks prüfen (rein). Nur bekannte Felder (sonst 400), Texte gesäubert, Grenzen 413. `kanalFest` = Kanal darf nicht
 * wechseln (Vernetzen). Liefert die gesäuberten Felder — fehlt ein Feld, bleibt es unberührt.
 */
export function playbookTeilPruefen(roh: unknown, o: { kanalFest?: string } = {}): { ok: true; teil: PlaybookTeil } | ({ ok: false } & PruefFehler) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Vorlage fehlt.' };
  const r = roh as Record<string, unknown>;
  const fremd = Object.keys(r).filter(k => !(PLAYBOOK_FELDER as readonly string[]).includes(k));
  if (fremd.length) return { ok: false, status: 400, fehler: `Nicht bearbeitbar: ${fremd.slice(0, 3).join(', ')} — Rechtshinweis, Filter und Zuständigkeit bleiben fest im System.` };
  const teil: PlaybookTeil = {};
  const G = VORLAGEN_GRENZEN;
  for (const [k, name, max] of [['name', 'Name', G.name], ['kurz', 'Kurzbeschreibung', G.kurz], ['warum', 'Warum es wirkt', G.warum], ['kennzahl', 'Messgröße', G.kennzahl]] as const) {
    if (!(k in r)) continue;
    const s = text(r[k], name, max);
    if (istFehler(s)) return { ok: false, ...s };
    teil[k] = s;
  }
  if ('kanal' in r) {
    if (!PLAYBOOK_KANAELE.some(x => x.id === r.kanal)) return { ok: false, status: 400, fehler: `Kanal: ${PLAYBOOK_KANAELE.map(x => x.label).join(', ')}.` };
    if (o.kanalFest && r.kanal !== o.kanalFest) return { ok: false, status: 400, fehler: 'Dieses Playbook steuert die Vernetzen-Runde — sein Kanal bleibt LinkedIn.' };
    teil.kanal = r.kanal as PlaybookKanal;
  }
  if ('segmentId' in r) {
    if (r.segmentId !== null && (typeof r.segmentId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(r.segmentId))) return { ok: false, status: 400, fehler: 'Segment-Vorschlag: ein gespeichertes Segment (oder leer = Zielgruppe der Vorgabe).' };
    teil.segmentId = r.segmentId as string | null;
  }
  if ('schritte' in r) {
    if (!Array.isArray(r.schritte) || !r.schritte.length) return { ok: false, status: 400, fehler: 'Nachfass-Schritte: mindestens einer.' };
    if (r.schritte.length > G.schritte) return { ok: false, status: 413, fehler: `Höchstens ${G.schritte} Schritte (${r.schritte.length}). Nichts gespeichert.` };
    const l: { text: string; tag: number }[] = [];
    for (const [i, x] of r.schritte.entries()) {
      const s = x && typeof x === 'object' ? x as Record<string, unknown> : {};
      const tx = text(s.text, `Schritt ${i + 1}`, G.schrittText);
      if (istFehler(tx)) return { ok: false, ...tx };
      if (!ganz(s.tag, 0, G.schrittTag)) return { ok: false, status: 400, fehler: `Schritt ${i + 1}: Tag als ganze Zahl 0–${G.schrittTag}.` };
      l.push({ text: tx, tag: s.tag as number });
    }
    teil.schritte = l.sort((a, b) => a.tag - b.tag);
  }
  return { ok: true, teil };
}

/**
 * Die bearbeitbaren Felder einer Event-Vorlage prüfen (rein). Kennungen von Checklisten-Punkten und Budget-Posten bleiben (eine zweite Vorlage legt sonst
 * Punkte doppelt an); neue Punkte ohne Kennung bekommen eine über `neueId`.
 */
export function eventTeilPruefen(roh: unknown, neueId: (praefix: string) => string): { ok: true; teil: EventTeil } | ({ ok: false } & PruefFehler) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Vorlage fehlt.' };
  const r = roh as Record<string, unknown>;
  const fremd = Object.keys(r).filter(k => !(EVENT_FELDER as readonly string[]).includes(k));
  if (fremd.length) return { ok: false, status: 400, fehler: `Nicht bearbeitbar: ${fremd.slice(0, 3).join(', ')}.` };
  const G = VORLAGEN_GRENZEN;
  const teil: EventTeil = {};
  if ('label' in r) { const s = text(r.label, 'Name', G.label); if (istFehler(s)) return { ok: false, ...s }; teil.label = s; }
  if ('beschreibung' in r) { const s = text(r.beschreibung, 'Beschreibung', G.beschreibung, false); if (istFehler(s)) return { ok: false, ...s }; teil.beschreibung = s; }
  if ('uhrzeit' in r) { if (typeof r.uhrzeit !== 'string' || !UHR.test(r.uhrzeit)) return { ok: false, status: 400, fehler: 'Uhrzeit: HH:MM.' }; teil.uhrzeit = r.uhrzeit; }
  if ('kapazitaet' in r) { if (!ganz(r.kapazitaet, 1, G.kapazitaet)) return { ok: false, status: 400, fehler: `Plätze: ganze Zahl 1–${G.kapazitaet}.` }; teil.kapazitaet = r.kapazitaet as number; }
  if ('mixZiel' in r) {
    const m = r.mixZiel && typeof r.mixZiel === 'object' ? r.mixZiel as Record<string, unknown> : {};
    if (!ganz(m.zielkunden, 0, 100) || !ganz(m.kunden, 0, 100) || (m.zielkunden as number) + (m.kunden as number) > 100) return { ok: false, status: 400, fehler: 'Soll-Mischung: Zielkunden und Kunden in Prozent, zusammen höchstens 100.' };
    teil.mixZiel = { zielkunden: m.zielkunden as number, kunden: m.kunden as number };
  }
  if ('ablauf' in r) {
    if (!Array.isArray(r.ablauf)) return { ok: false, status: 400, fehler: 'Ablauf: eine Liste.' };
    if (r.ablauf.length > G.ablauf) return { ok: false, status: 413, fehler: `Höchstens ${G.ablauf} Ablauf-Punkte (${r.ablauf.length}). Nichts gespeichert.` };
    const l: { zeit: string; punkt: string }[] = [];
    for (const [i, x] of r.ablauf.entries()) {
      const a = x && typeof x === 'object' ? x as Record<string, unknown> : {};
      if (typeof a.zeit !== 'string' || !UHR.test(a.zeit)) return { ok: false, status: 400, fehler: `Ablauf ${i + 1}: Uhrzeit HH:MM.` };
      const p = text(a.punkt, `Ablauf ${i + 1}`, G.ablaufPunkt);
      if (istFehler(p)) return { ok: false, ...p };
      l.push({ zeit: a.zeit, punkt: p });
    }
    teil.ablauf = l;
  }
  if ('checkliste' in r) {
    if (!Array.isArray(r.checkliste)) return { ok: false, status: 400, fehler: 'Checkliste: eine Liste.' };
    if (r.checkliste.length > G.checkliste) return { ok: false, status: 413, fehler: `Höchstens ${G.checkliste} Checklisten-Punkte (${r.checkliste.length}). Nichts gespeichert.` };
    const l: { id: string; text: string; tageVorher: number }[] = [];
    for (const [i, x] of r.checkliste.entries()) {
      const c = x && typeof x === 'object' ? x as Record<string, unknown> : {};
      const tx = text(c.text, `Checkliste ${i + 1}`, G.checklistenText);
      if (istFehler(tx)) return { ok: false, ...tx };
      if (!ganz(c.tageVorher, G.tageVorherMin, G.tageVorherMax)) return { ok: false, status: 400, fehler: `Checkliste ${i + 1}: Tage vorher als ganze Zahl ${G.tageVorherMin}–${G.tageVorherMax} (negativ = danach).` };
      l.push({ id: typeof c.id === 'string' && PUNKT_ID.test(c.id) ? c.id : neueId('pk'), text: tx, tageVorher: c.tageVorher as number });
    }
    if (new Set(l.map(c => c.id)).size !== l.length) return { ok: false, status: 400, fehler: 'Checkliste: ein Punkt steht doppelt.' };
    teil.checkliste = l.sort((a, b) => b.tageVorher - a.tageVorher);
  }
  if ('budget' in r) {
    if (!Array.isArray(r.budget)) return { ok: false, status: 400, fehler: 'Budget: eine Liste.' };
    if (r.budget.length > G.budget) return { ok: false, status: 413, fehler: `Höchstens ${G.budget} Budget-Posten (${r.budget.length}). Nichts gespeichert.` };
    const l: { id: string; posten: string }[] = [];
    for (const [i, x] of r.budget.entries()) {
      const b = x && typeof x === 'object' ? x as Record<string, unknown> : {};
      const p = text(b.posten, `Budget-Posten ${i + 1}`, G.posten);
      if (istFehler(p)) return { ok: false, ...p };
      l.push({ id: typeof b.id === 'string' && PUNKT_ID.test(b.id) ? b.id : neueId('b'), posten: p });
    }
    if (new Set(l.map(b => b.id)).size !== l.length) return { ok: false, status: 400, fehler: 'Budget: ein Posten steht doppelt.' };
    teil.budget = l;
  }
  return { ok: true, teil };
}

/**
 * Hinweise über die bearbeiteten Texte eines Playbooks (rein) — die Ampel-Prüfung läuft auch über eigene Texte: werbliche Wörter in einem werblichen Kanal
 * sind Werbung per elektronischer Post (§ 7 UWG). Nur ein Hinweis, nie eine Sperre (die Ampel je Person greift beim Planen der Kampagne).
 */
export function playbookHinweise(p: { kanal: string; name: string; kurz: string; warum: string; kennzahl: string; schritte: readonly { text: string }[] }): string[] {
  const woerter = werbeWoerter([p.name, p.kurz, p.warum, p.kennzahl, ...p.schritte.map(s => s.text)].join(' \n '));
  if (!woerter.length) return [];
  return WERBLICH.has(p.kanal)
    ? [`Werbliche Wörter (${woerter.slice(0, 4).join(', ')}) über ${p.kanal === 'mail' ? 'Mail' : 'LinkedIn'}: das ist Werbung per elektronischer Post (§ 7 UWG) — nur an Personen mit Einwilligung, die Ampel je Person entscheidet beim Planen.`]
    : [`Werbliche Wörter (${woerter.slice(0, 4).join(', ')}): geht daraus eine Mail oder LinkedIn-Nachricht hervor, ist das Werbung (§ 7 UWG) — nur mit Einwilligung.`];
}
