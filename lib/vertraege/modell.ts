// ─── Verträge — Vorlagen und Verträge (rein, client-sicher, getestet, 01.11.) ─────────────────────────────────────────────
// Kevin 01.11.: „Im Vertrieb unter Angebote ein Thema Vertrag … sodass wir Angebote erstellen können, aber auch verschiedene Verträge
// einfach erstellen können … Vorlagen … Vertrag als eigene Maske, dass wir die Verträge sofort sauber erstellen können wie so ein
// Angebot … hinterlegen unter Unternehmen › Verträge › Vorlagen.“
//
// Hier steht alles ohne Platte: Arten, Felder, Platzhalter (fest + eigene), Säubern von Vorlage und Vertrag, Füllen, Prüfen vor dem
// Fertigstellen, Ampel „anwaltlich geprüft / ungeprüft / geändert seit Prüfung“, Abweichung von der Vorlage, Nummer
// `{KURZ}-V-{JAHR}-{NR4}`, Status-Folge, Personenbezug (Art. 15/17).
// Plattform-Regel: KEINE echten Vertragstexte, Firmen, Personen oder Beträge im Code — Vorlagen sind Daten der Instanz. Die Startvorlagen
// sind leere Gerüste (übliche Überschriften, kein Wortlaut); echte Texte kommen per Import.
// Hinweis, keine Rechtsberatung: jede Vorlage und jeder Vertrag trägt `VERTRAG_HINWEIS`.

import type { Gesellschaftskennung } from '@/lib/einheiten';
import { DARLEHEN_GERECHNET, darlehenAusWerten, darlehenPlatzhalter, istDarlehenVertrag } from './darlehen';

export const VERTRAG_HINWEIS = 'Vorlage, keine Rechtsberatung — vor Verwendung prüfen (lassen).';

// ── Arten ────────────────────────────────────────────────────────────────────

export type VorlageArtFest = 'dienstleistung' | 'handelsvertreter' | 'rahmenvertrag' | 'nda' | 'avv' | 'gesellschaftervertrag' | 'freelancer' | 'sonstiges';
/** Feste Arten + eigene der Instanz (`x-<name>`, im Bestand der Vorlagen). */
export type VorlageArt = VorlageArtFest | `x-${string}`;
export const VORLAGE_ARTEN: readonly { id: VorlageArtFest; label: string }[] = [
  { id: 'dienstleistung', label: 'Dienstleistungsvertrag' }, { id: 'handelsvertreter', label: 'Handelsvertretervertrag' },
  { id: 'rahmenvertrag', label: 'Rahmenvertrag' }, { id: 'nda', label: 'Geheimhaltungsvereinbarung (NDA)' },
  { id: 'avv', label: 'Auftragsverarbeitung (AVV)' }, { id: 'gesellschaftervertrag', label: 'Gesellschaftervertrag' },
  { id: 'freelancer', label: 'Freelancer-Vertrag' }, { id: 'sonstiges', label: 'Sonstiger Vertrag' },
];
export interface EigeneArt { id: `x-${string}`; label: string }
const EIGENE_ART = /^x-[a-z0-9-]{2,40}$/;
export const istFesteArt = (v: unknown): v is VorlageArtFest => VORLAGE_ARTEN.some(a => a.id === v);
export const artLabel = (a: string, eigene: readonly EigeneArt[] = []) => VORLAGE_ARTEN.find(x => x.id === a)?.label ?? eigene.find(x => x.id === a)?.label ?? 'Vertrag';
/** Eine neue eigene Art aus einem Namen (rein). */
export function eigeneArtAus(label: string): EigeneArt | null {
  const t = String(label ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const slug = t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return t.length >= 2 && slug.length >= 2 ? { id: `x-${slug}`, label: t } : null;
}
/** Art im Gesellschafts-Register (`vertraege[]`) — EINE Zuordnung. */
export function registerArt(a: string): 'gesellschaftervereinbarung' | 'kooperation' | 'sonstiges' {
  if (a === 'gesellschaftervertrag') return 'gesellschaftervereinbarung';
  if (a === 'rahmenvertrag' || a === 'handelsvertreter') return 'kooperation';
  return 'sonstiges';
}

// ── Felder und Platzhalter ───────────────────────────────────────────────────

export type FeldTyp = 'text' | 'zahl' | 'betrag' | 'datum' | 'auswahl' | 'person' | 'firma';
export const FELD_TYPEN: readonly { id: FeldTyp; label: string }[] = [
  { id: 'text', label: 'Text' }, { id: 'zahl', label: 'Zahl' }, { id: 'betrag', label: 'Betrag (€)' }, { id: 'datum', label: 'Datum' },
  { id: 'auswahl', label: 'Auswahl' }, { id: 'person', label: 'Person (CRM)' }, { id: 'firma', label: 'Firma (CRM)' },
];
export interface VorlageFeld { schluessel: string; label: string; typ: FeldTyp; pflicht: boolean; vorgabe?: string; optionen?: string[] }

/**
 * Feste Platzhalter — gefüllt aus dem Register (Absender), der CRM-Kartei (Vertragspartner), dem Katalog bzw. Angebot (Leistung) und den
 * Standardfeldern jedes Vertrags. Ein Platzhalter, der hier nicht steht und kein eigenes Feld der Vorlage ist, ist ein Fehler.
 */
export const FESTE_PLATZHALTER: readonly { schluessel: string; label: string; quelle: 'absender' | 'partner' | 'leistung' | 'vertrag' | 'gerechnet' }[] = [
  { schluessel: 'absender.firmierung', label: 'Absender: Firmierung', quelle: 'absender' },
  { schluessel: 'absender.anschrift', label: 'Absender: Anschrift', quelle: 'absender' },
  { schluessel: 'absender.vertretung', label: 'Absender: vertreten durch', quelle: 'absender' },
  { schluessel: 'absender.register', label: 'Absender: Register', quelle: 'absender' },
  { schluessel: 'partner.name', label: 'Vertragspartner: Name', quelle: 'partner' },
  { schluessel: 'partner.anschrift', label: 'Vertragspartner: Anschrift', quelle: 'partner' },
  { schluessel: 'partner.ansprechpartner', label: 'Vertragspartner: Ansprechpartner', quelle: 'partner' },
  { schluessel: 'leistung.titel', label: 'Leistung: Titel', quelle: 'leistung' },
  { schluessel: 'leistung.beschreibung', label: 'Leistung: Beschreibung', quelle: 'leistung' },
  { schluessel: 'vertrag.nummer', label: 'Vertragsnummer', quelle: 'vertrag' },
  // Gerechnet (02.11.): aus den Darlehens-Feldern (lib/vertraege/darlehen.ts) — nie ein Eingabefeld.
  { schluessel: DARLEHEN_GERECHNET.zinsenGesamt, label: 'Darlehen: Zinsen gesamt (gerechnet)', quelle: 'gerechnet' },
  { schluessel: DARLEHEN_GERECHNET.tilgungsplan, label: 'Darlehen: Zins- und Tilgungsplan (gerechnet)', quelle: 'gerechnet' },
];
const GERECHNET = new Set<string>(Object.values(DARLEHEN_GERECHNET));
/** Standardfelder jedes Vertrags (in der Maske immer da; Pflicht, sobald ein aktiver Paragraph sie nutzt). */
export const STANDARD_FELDER: readonly VorlageFeld[] = [
  { schluessel: 'verguetung', label: 'Vergütung', typ: 'text', pflicht: false },
  { schluessel: 'zahlungsziel', label: 'Zahlungsziel (Tage)', typ: 'zahl', pflicht: false },
  { schluessel: 'beginn', label: 'Beginn', typ: 'datum', pflicht: false },
  { schluessel: 'laufzeit', label: 'Laufzeit', typ: 'text', pflicht: false },
  { schluessel: 'ende', label: 'Ende (falls fest)', typ: 'datum', pflicht: false },
  { schluessel: 'kuendigungsfrist', label: 'Kündigungsfrist', typ: 'text', pflicht: false },
  { schluessel: 'kuendigen_bis', label: 'Kündigen bis', typ: 'datum', pflicht: false },
  { schluessel: 'erinnerung_tage', label: 'Erinnerung (Tage vor „kündigen bis“)', typ: 'zahl', pflicht: false },
  { schluessel: 'ort', label: 'Ort', typ: 'text', pflicht: false },
  { schluessel: 'datum', label: 'Datum', typ: 'datum', pflicht: false },
];
const FEST = new Set([...FESTE_PLATZHALTER.map(p => p.schluessel), ...STANDARD_FELDER.map(f => f.schluessel)]);
export const istFesterPlatzhalter = (s: string) => FEST.has(s);
const SCHLUESSEL = /^[a-z][a-z0-9_]{1,39}$/;
const PLATZHALTER = /\{\{\s*([^{}]{1,60}?)\s*\}\}/g;

/** Alle Platzhalter eines Textes (in Reihenfolge, ohne Doppelte). */
export function platzhalterIn(text: string): string[] {
  const raus: string[] = [];
  for (const m of String(text ?? '').matchAll(PLATZHALTER)) if (!raus.includes(m[1])) raus.push(m[1]);
  return raus;
}

// ── Vorlage ──────────────────────────────────────────────────────────────────

export interface VorlageParagraph { id: string; nr: string; titel: string; text: string; optional: boolean; /** Schlüssel eines Feldes: aktiv nur, wenn es gefüllt und nicht „nein“ ist. */ bedingung?: string }
export interface VorlagePruefung { anwaltlichGeprueftAm?: string; von?: string; notiz?: string; /** Fingerabdruck der Paragraphen beim Prüfen. */ fassungHash?: string }
export interface VertragVorlage {
  /** `vv-<uuid>` */
  id: string;
  titel: string;
  art: VorlageArt;
  fassung: string;
  sprache: 'de' | 'en';
  anrede: 'Sie' | 'Du';
  paragraphen: VorlageParagraph[];
  felder: VorlageFeld[];
  pruefung: VorlagePruefung;
  notiz?: string;
  archiviert?: boolean;
  /** Aus welcher Startvorlage (nur Gerüst). */
  start?: string;
  angelegt: string;
  angelegtVon: string;
  geaendert: string;
  geaendertVon: string;
}
export interface VorlagenDatei { vorlagen: VertragVorlage[]; arten?: EigeneArt[] }

export const VERTRAG_GRENZEN = { vorlagen: 200, paragraphen: 200, felder: 60, titel: 160, paragraphTitel: 160, text: 20_000, notiz: 2000, optionen: 30, vertraege: 5000, grund: 600 } as const;

export interface VertragFehler { feld: string; text: string }

const zeile = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const block = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim() : '').slice(0, n + 1);
const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const PARAGRAPH_ID = /^p-[a-z0-9-]{1,60}$/;

/** Fingerabdruck der Paragraphen (FNV-1a, rein) — dient „geändert seit der Prüfung“. */
export function paragraphenHash(l: readonly Pick<VorlageParagraph, 'nr' | 'titel' | 'text' | 'optional' | 'bedingung'>[]): string {
  const t = JSON.stringify(l.map(p => [p.nr, p.titel, p.text, p.optional, p.bedingung ?? '']));
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function feldSaeubern(o: Record<string, unknown>, fehler: VertragFehler[], i: number): VorlageFeld | null {
  const schluessel = zeile(o.schluessel, 40).toLowerCase();
  if (!SCHLUESSEL.test(schluessel)) { fehler.push({ feld: `felder.${i}`, text: `Feld ${i + 1}: Schlüssel nur Kleinbuchstaben, Ziffern, Unterstrich (2–40 Zeichen).` }); return null; }
  if (FEST.has(schluessel)) { fehler.push({ feld: `felder.${i}`, text: `Feld „${schluessel}“ gibt es schon als festen Platzhalter.` }); return null; }
  const typ = (FELD_TYPEN.some(t => t.id === o.typ) ? o.typ : 'text') as FeldTyp;
  const label = zeile(o.label, 80) || schluessel;
  const vorgabe = zeile(o.vorgabe, 400);
  const optionen = typ === 'auswahl' ? (Array.isArray(o.optionen) ? o.optionen : []).map(x => zeile(x, 80)).filter(Boolean) : [];
  if (optionen.length > VERTRAG_GRENZEN.optionen) fehler.push({ feld: `felder.${i}`, text: `Höchstens ${VERTRAG_GRENZEN.optionen} Auswahlwerte.` });
  if (typ === 'auswahl' && !optionen.length) fehler.push({ feld: `felder.${i}`, text: `Feld „${label}“: eine Auswahl braucht Werte.` });
  return { schluessel, label, typ, pflicht: o.pflicht === true, ...(vorgabe ? { vorgabe } : {}), ...(optionen.length ? { optionen: [...new Set(optionen)] } : {}) };
}

/**
 * Eine Vorlage säubern und prüfen (rein): Grenzen → Fehler (nie still gekürzt), Platzhalter müssen fest oder eigenes Feld sein, Bedingungen
 * zeigen auf ein Feld. Prüfvermerk setzt nur der Server (`pruefungSetzen`) — aus dem Körper kommt er nie.
 */
export function vorlageSaeubern(roh: unknown, alt: VertragVorlage | null, basis: { id: string; jetzt: string; person: string; eigeneArten?: readonly EigeneArt[] }): { v?: VertragVorlage; fehler: VertragFehler[] } {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const fehler: VertragFehler[] = [];
  const titelRoh = o.titel !== undefined ? o.titel : alt?.titel;
  if (typeof titelRoh === 'string' && titelRoh.trim().length > VERTRAG_GRENZEN.titel) fehler.push({ feld: 'titel', text: `Titel höchstens ${VERTRAG_GRENZEN.titel} Zeichen.` });
  const titel = zeile(titelRoh, VERTRAG_GRENZEN.titel);
  if (!titel) fehler.push({ feld: 'titel', text: 'Die Vorlage braucht einen Titel.' });
  const art = (o.art !== undefined ? o.art : alt?.art ?? 'sonstiges') as string;
  const artOk = istFesteArt(art) || (EIGENE_ART.test(art) && (basis.eigeneArten ?? []).some(a => a.id === art));
  if (!artOk) fehler.push({ feld: 'art', text: 'Unbekannte Art — eine eigene Art erst anlegen.' });
  const fassung = zeile(o.fassung !== undefined ? o.fassung : alt?.fassung ?? '1', 20) || '1';
  const sprache = (o.sprache ?? alt?.sprache) === 'en' ? 'en' : 'de';
  const anrede = (o.anrede ?? alt?.anrede) === 'Du' ? 'Du' : 'Sie';
  const notizRoh = o.notiz !== undefined ? o.notiz : alt?.notiz;
  const notiz = block(notizRoh, VERTRAG_GRENZEN.notiz);
  if (notiz.length > VERTRAG_GRENZEN.notiz) fehler.push({ feld: 'notiz', text: `Notiz höchstens ${VERTRAG_GRENZEN.notiz} Zeichen.` });

  const feldRoh = o.felder !== undefined ? (Array.isArray(o.felder) ? o.felder : []) : alt?.felder ?? [];
  if (feldRoh.length > VERTRAG_GRENZEN.felder) fehler.push({ feld: 'felder', text: `Höchstens ${VERTRAG_GRENZEN.felder} eigene Felder.` });
  const felder: VorlageFeld[] = [];
  feldRoh.forEach((x, i) => {
    const f = feldSaeubern((x && typeof x === 'object' ? x : {}) as Record<string, unknown>, fehler, i);
    if (f && felder.some(y => y.schluessel === f.schluessel)) fehler.push({ feld: `felder.${i}`, text: `Feld „${f.schluessel}“ steht doppelt.` });
    else if (f) felder.push(f);
  });

  const parRoh = o.paragraphen !== undefined ? (Array.isArray(o.paragraphen) ? o.paragraphen : []) : alt?.paragraphen ?? [];
  if (parRoh.length > VERTRAG_GRENZEN.paragraphen) fehler.push({ feld: 'paragraphen', text: `Höchstens ${VERTRAG_GRENZEN.paragraphen} Paragraphen.` });
  const paragraphen: VorlageParagraph[] = [];
  const bekannt = new Set([...FEST, ...felder.map(f => f.schluessel)]);
  parRoh.forEach((x, i) => {
    const p = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const id = typeof p.id === 'string' && PARAGRAPH_ID.test(p.id) ? p.id : `p-${i + 1}-${basis.id.slice(-8)}`;
    const text = block(p.text, VERTRAG_GRENZEN.text);
    if (text.length > VERTRAG_GRENZEN.text) fehler.push({ feld: `paragraphen.${i}`, text: `Paragraph ${i + 1}: höchstens ${VERTRAG_GRENZEN.text} Zeichen.` });
    const ptitel = zeile(p.titel, VERTRAG_GRENZEN.paragraphTitel);
    const nr = zeile(p.nr, 20);
    for (const ph of platzhalterIn(`${ptitel}\n${text}`)) if (!bekannt.has(ph)) fehler.push({ feld: `paragraphen.${i}`, text: `Unbekannter Platzhalter {{${ph}}} in ${nr || `Paragraph ${i + 1}`} — als eigenes Feld anlegen oder korrigieren.` });
    const bedingung = zeile(p.bedingung, 40);
    if (bedingung && !bekannt.has(bedingung)) fehler.push({ feld: `paragraphen.${i}`, text: `Bedingung „${bedingung}“ ist kein Feld der Vorlage.` });
    if (paragraphen.some(y => y.id === id)) fehler.push({ feld: `paragraphen.${i}`, text: 'Paragraph doppelt.' });
    paragraphen.push({ id, nr, titel: ptitel, text: text.slice(0, VERTRAG_GRENZEN.text), optional: p.optional === true, ...(bedingung ? { bedingung } : {}) });
  });
  if (fehler.length) return { fehler };
  return {
    fehler, v: {
      id: alt?.id ?? basis.id, titel, art: art as VorlageArt, fassung, sprache, anrede, paragraphen, felder,
      pruefung: alt?.pruefung ?? {}, ...(notiz ? { notiz } : {}), ...((o.archiviert !== undefined ? o.archiviert === true : alt?.archiviert) ? { archiviert: true } : {}),
      ...(alt?.start ? { start: alt.start } : typeof o.start === 'string' && STARTVORLAGEN.some(s => s.id === o.start) ? { start: o.start } : {}),
      angelegt: alt?.angelegt ?? basis.jetzt, angelegtVon: alt?.angelegtVon ?? basis.person, geaendert: basis.jetzt, geaendertVon: basis.person,
    },
  };
}

/** Prüfvermerk setzen bzw. löschen (nur Server): hält den Fingerabdruck der heutigen Paragraphen fest. */
export function pruefungSetzen(v: VertragVorlage, p: { am?: unknown; notiz?: unknown; von: string } | null): VertragVorlage | VertragFehler {
  if (!p) return { ...v, pruefung: {} };
  if (!tagOk(p.am)) return { feld: 'am', text: 'Datum der Prüfung bitte als JJJJ-MM-TT.' };
  const notiz = zeile(p.notiz, 300);
  return { ...v, pruefung: { anwaltlichGeprueftAm: p.am, von: p.von, ...(notiz ? { notiz } : {}), fassungHash: paragraphenHash(v.paragraphen) } };
}

export type Ampel = 'gruen' | 'gelb';
export interface AmpelStand { ampel: Ampel; stufe: 'geprueft' | 'ungeprueft' | 'geaendert'; satz: string }
/** Ampel einer Vorlage: anwaltlich geprüft (Datum) · ungeprüft · geändert seit Prüfung. */
export function vorlageAmpel(v: Pick<VertragVorlage, 'pruefung' | 'paragraphen'>): AmpelStand {
  const am = v.pruefung?.anwaltlichGeprueftAm;
  if (!am) return { ampel: 'gelb', stufe: 'ungeprueft', satz: 'Diese Vorlage ist nicht anwaltlich geprüft.' };
  const datum = `${am.slice(8, 10)}.${am.slice(5, 7)}.${am.slice(0, 4)}`;
  if (v.pruefung.fassungHash && v.pruefung.fassungHash !== paragraphenHash(v.paragraphen)) return { ampel: 'gelb', stufe: 'geaendert', satz: `Anwaltlich geprüft am ${datum} — seitdem geändert.` };
  return { ampel: 'gruen', stufe: 'geprueft', satz: `Anwaltlich geprüft am ${datum}.` };
}

// ── Startvorlagen: nur Gerüste (übliche Überschriften, KEIN Wortlaut) ──────────

const G = (...titel: string[]) => titel.map((t, i) => ({ nr: `§ ${i + 1}`, titel: t, text: '' }));
export const STARTVORLAGEN: readonly { id: string; art: VorlageArtFest; titel: string; paragraphen: { nr: string; titel: string; text: string }[] }[] = [
  { id: 'start-dienstleistung', art: 'dienstleistung', titel: 'Dienstleistungsvertrag (Gerüst)', paragraphen: G('Vertragsgegenstand', 'Leistungsumfang', 'Mitwirkung', 'Vergütung und Zahlung', 'Laufzeit und Kündigung', 'Haftung', 'Vertraulichkeit', 'Datenschutz', 'Schlussbestimmungen') },
  { id: 'start-handelsvertreter', art: 'handelsvertreter', titel: 'Handelsvertretervertrag (Gerüst)', paragraphen: G('Vertragsgegenstand und Gebiet', 'Pflichten des Handelsvertreters', 'Pflichten des Unternehmens', 'Provision', 'Abrechnung', 'Wettbewerb', 'Laufzeit und Kündigung', 'Ausgleichsanspruch', 'Schlussbestimmungen') },
  { id: 'start-rahmenvertrag', art: 'rahmenvertrag', titel: 'Rahmenvertrag (Gerüst)', paragraphen: G('Gegenstand', 'Einzelaufträge', 'Vergütung', 'Laufzeit und Kündigung', 'Haftung', 'Schlussbestimmungen') },
  { id: 'start-nda', art: 'nda', titel: 'Geheimhaltungsvereinbarung (Gerüst)', paragraphen: G('Zweck', 'Vertrauliche Informationen', 'Pflichten', 'Ausnahmen', 'Dauer', 'Rückgabe', 'Schlussbestimmungen') },
  { id: 'start-avv', art: 'avv', titel: 'Auftragsverarbeitung (Gerüst)', paragraphen: G('Gegenstand und Dauer', 'Art und Zweck der Verarbeitung', 'Pflichten des Auftragsverarbeiters', 'Technische und organisatorische Maßnahmen', 'Unterauftragsverarbeiter', 'Rechte der betroffenen Personen', 'Löschung und Rückgabe', 'Schlussbestimmungen') },
  { id: 'start-gesellschaftervertrag', art: 'gesellschaftervertrag', titel: 'Gesellschaftervertrag (Gerüst)', paragraphen: G('Gegenstand', 'Beteiligung', 'Rechte und Pflichten', 'Verfügungen über Anteile', 'Ausscheiden', 'Wettbewerb', 'Schlussbestimmungen') },
  { id: 'start-freelancer', art: 'freelancer', titel: 'Freelancer-Vertrag (Gerüst)', paragraphen: G('Vertragsgegenstand', 'Leistungserbringung', 'Vergütung', 'Nutzungsrechte', 'Vertraulichkeit', 'Laufzeit und Kündigung', 'Schlussbestimmungen') },
];

/** Eine neue Vorlage aus einem Gerüst (rein) — Text leer, nichts erfunden. */
export function vorlageAusStart(startId: string): Record<string, unknown> | null {
  const s = STARTVORLAGEN.find(x => x.id === startId);
  if (!s) return null;
  return { titel: s.titel, art: s.art, fassung: '1', sprache: 'de', anrede: 'Sie', start: s.id, felder: [], paragraphen: s.paragraphen.map((p, i) => ({ id: `p-${i + 1}`, ...p, optional: false })) };
}

// ── Vertrag ──────────────────────────────────────────────────────────────────

export type VertragStatus = 'entwurf' | 'fertig' | 'versendet' | 'unterschrieben' | 'aktiv' | 'beendet' | 'gekuendigt';
export const VERTRAG_STATUS: readonly { id: VertragStatus; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'fertig', label: 'fertig' }, { id: 'versendet', label: 'versendet' }, { id: 'unterschrieben', label: 'unterschrieben' },
  { id: 'aktiv', label: 'aktiv' }, { id: 'beendet', label: 'beendet' }, { id: 'gekuendigt', label: 'gekündigt' },
];
export const statusLabel = (s: VertragStatus) => VERTRAG_STATUS.find(x => x.id === s)?.label ?? s;
/** Status-Folge von Hand (Server prüft): fertigstellen und „unterschrieben“ haben eigene Wege. */
export const STATUS_WEITER: Readonly<Record<VertragStatus, readonly VertragStatus[]>> = {
  entwurf: [], fertig: ['versendet'], versendet: [], unterschrieben: ['aktiv', 'beendet', 'gekuendigt'], aktiv: ['beendet', 'gekuendigt'], beendet: [], gekuendigt: [],
};

export interface VertragParagraph extends VorlageParagraph { /** an (Vorgabe) bzw. abgewählt */ aus?: boolean; /** Wortlaut der Vorlage beim Anlegen — für „abweichend“. */ original?: { titel: string; text: string } }
export interface VertragPartner { name: string; zeilen: string[]; ansprechpartner?: string }
export interface VertragAbsender { firmierung: string; zeilen: string[]; vertretung?: string; register?: string }

export interface Vertrag {
  /** `vtr-<uuid>` */
  id: string;
  vorlageId: string;
  vorlageFassung: string;
  titel: string;
  art: VorlageArt;
  sprache: 'de' | 'en';
  anrede: 'Sie' | 'Du';
  gesellschaft: Gesellschaftskennung;
  kontaktId?: string;
  firmaId?: string;
  dealId?: string;
  mandatId?: string;
  angebotId?: string;
  leistungId?: string;
  /** Werte der Felder (Standard + eigene), als Text. */
  werte: Record<string, string>;
  /** Eigene Felder der Vorlage (beim Anlegen festgehalten). */
  felder: VorlageFeld[];
  paragraphen: VertragParagraph[];
  status: VertragStatus;
  version: number;
  vorgaengerId?: string;
  nachfolgerId?: string;
  // ── festgeschrieben beim Fertigstellen ──
  nummer?: string;
  lauf?: { jahr: number; nr: number };
  fertigAm?: string;
  fertigVon?: string;
  absender?: VertragAbsender;
  partner?: VertragPartner;
  /** Gefüllter Wortlaut der aktiven Paragraphen beim Fertigstellen. */
  fassung?: { nr: string; titel: string; text: string }[];
  pruefsumme?: string;
  pdfDateiId?: string;
  /** Ampel der Vorlage beim Fertigstellen (Nachweis, dass gewarnt wurde). */
  ampelBeimFertig?: AmpelStand['stufe'];
  abweichendBeimFertig?: number;
  versendetAm?: string;
  /** Über welches Postfach (maskiert) — nur, wenn MAKE OS ihn gesendet hat (lib/vertraege/versand.ts). */
  versendetUeber?: string;
  /** Darlehen in die Finanzplanung übernommen (Kennung des Darlehens, am, von) — nur der Server (lib/vertraege/finanzen.ts). */
  finanzen?: { darlehenId: string; am: string; von: string; geber?: 'privat' | 'kdc' | 'ug' | 'kdv' | 'extern'; nehmer?: 'privat' | 'kdc' | 'ug' | 'kdv' | 'extern' };
  unterschriebenAm?: string;
  unterschriftDateiId?: string;
  registerVertragId?: string;
  beendetAm?: string;
  personGeloest?: string;
  angelegt: string;
  angelegtVon: string;
  geaendert: string;
  geaendertVon: string;
}
export interface VertraegeDatei { vertraege: Vertrag[] }

export const istVertragEntwurf = (v: Pick<Vertrag, 'status'>) => v.status === 'entwurf';
export const KONTAKT_ID = /^c-[a-z0-9-]{4,60}$/;
export const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;
const KENNUNG = /^[a-z][a-z0-9-]{2,70}$/;

/** Aus einer Vorlage: Paragraphen + Felder kopieren (Wortlaut der Vorlage als `original`), Vorgaben in die Werte. */
export function vertragAusVorlage(v: VertragVorlage, basis: { id: string; gesellschaft: Gesellschaftskennung; jetzt: string; person: string; heute: string; vorbelegung?: Partial<Pick<Vertrag, 'kontaktId' | 'firmaId' | 'dealId' | 'mandatId' | 'angebotId' | 'leistungId'>> & { werte?: Record<string, string> } }): Vertrag {
  const werte: Record<string, string> = { datum: basis.heute };
  for (const f of v.felder) if (f.vorgabe) werte[f.schluessel] = f.vorgabe;
  Object.assign(werte, basis.vorbelegung?.werte ?? {});
  const { werte: _w, ...bezug } = basis.vorbelegung ?? {};
  return {
    id: basis.id, vorlageId: v.id, vorlageFassung: v.fassung, titel: v.titel.replace(/\s*\(Gerüst\)$/, ''), art: v.art, sprache: v.sprache, anrede: v.anrede, gesellschaft: basis.gesellschaft,
    ...Object.fromEntries(Object.entries(bezug).filter(([, x]) => typeof x === 'string' && x)),
    werte, felder: v.felder.map(f => ({ ...f })), paragraphen: v.paragraphen.map(p => ({ ...p, original: { titel: p.titel, text: p.text } })),
    status: 'entwurf', version: 1, angelegt: basis.jetzt, angelegtVon: basis.person, geaendert: basis.jetzt, geaendertVon: basis.person,
  };
}

/** Entwurfsfelder, die aus dem Browser kommen dürfen. */
export const VERTRAG_ENTWURF_FELDER = ['titel', 'gesellschaft', 'kontaktId', 'firmaId', 'dealId', 'mandatId', 'angebotId', 'leistungId', 'werte', 'paragraphen', 'anrede'] as const;

/** Einen Entwurf ändern (rein): nur Entwurfsfelder; Paragraphen behalten ihr `original`; Platzhalter-Prüfung wie bei der Vorlage. */
export function entwurfAendern(alt: Vertrag, roh: Record<string, unknown>, basis: { jetzt: string; person: string; istGesellschaft: (g: unknown) => g is Gesellschaftskennung }): { v?: Vertrag; fehler: VertragFehler[] } {
  const fehler: VertragFehler[] = [];
  const neu: Vertrag = { ...alt, werte: { ...alt.werte }, paragraphen: alt.paragraphen.map(p => ({ ...p })) };
  if (roh.titel !== undefined) { const t = zeile(roh.titel, VERTRAG_GRENZEN.titel); if (!t) fehler.push({ feld: 'titel', text: 'Der Vertrag braucht einen Titel.' }); else neu.titel = t; }
  if (roh.anrede !== undefined) neu.anrede = roh.anrede === 'Du' ? 'Du' : 'Sie';
  if (roh.gesellschaft !== undefined) { if (!basis.istGesellschaft(roh.gesellschaft)) fehler.push({ feld: 'gesellschaft', text: 'Absender: nur eine Business-Gesellschaft mit Absender-Daten.' }); else neu.gesellschaft = roh.gesellschaft; }
  const bezug = (k: 'kontaktId' | 'firmaId' | 'dealId' | 'mandatId' | 'angebotId' | 'leistungId', muster: RegExp) => {
    if (roh[k] === undefined) return;
    if (roh[k] === null || roh[k] === '') { delete neu[k]; return; }
    if (typeof roh[k] !== 'string' || !muster.test(roh[k] as string)) { fehler.push({ feld: k, text: `${k}: Kennung nicht lesbar.` }); return; }
    neu[k] = roh[k] as string;
  };
  bezug('kontaktId', KONTAKT_ID); bezug('firmaId', FIRMA_ID); bezug('dealId', KENNUNG); bezug('mandatId', KENNUNG); bezug('angebotId', KENNUNG); bezug('leistungId', KENNUNG);
  if (roh.werte !== undefined) {
    const w = (roh.werte && typeof roh.werte === 'object' ? roh.werte : {}) as Record<string, unknown>;
    const erlaubt = new Set([...STANDARD_FELDER.map(f => f.schluessel), ...alt.felder.map(f => f.schluessel)]);
    for (const [k, x] of Object.entries(w)) {
      if (!erlaubt.has(k)) { fehler.push({ feld: `werte.${k}`, text: `Unbekanntes Feld „${k}“.` }); continue; }
      if (x === null || x === '') { delete neu.werte[k]; continue; }
      const t = typeof x === 'string' || typeof x === 'number' ? block(String(x), 2000) : '';
      if (t.length > 2000) { fehler.push({ feld: `werte.${k}`, text: `Feld „${k}“: höchstens 2000 Zeichen.` }); continue; }
      const typ = [...STANDARD_FELDER, ...alt.felder].find(f => f.schluessel === k)?.typ;
      if (typ === 'datum' && !tagOk(t)) { fehler.push({ feld: `werte.${k}`, text: `Feld „${k}“: Datum als JJJJ-MM-TT.` }); continue; }
      if (typ === 'zahl' && !/^-?\d+([.,]\d+)?$/.test(t)) { fehler.push({ feld: `werte.${k}`, text: `Feld „${k}“: bitte eine Zahl.` }); continue; }
      const opt = alt.felder.find(f => f.schluessel === k)?.optionen;
      if (typ === 'auswahl' && opt && !opt.includes(t)) { fehler.push({ feld: `werte.${k}`, text: `Feld „${k}“: Wert nicht in der Auswahl.` }); continue; }
      neu.werte[k] = t;
    }
  }
  if (roh.paragraphen !== undefined) {
    const l = Array.isArray(roh.paragraphen) ? roh.paragraphen : [];
    const bekannt = new Set([...FEST, ...alt.felder.map(f => f.schluessel)]);
    for (const x of l) {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const p = neu.paragraphen.find(y => y.id === o.id);
      if (!p) { fehler.push({ feld: 'paragraphen', text: 'Paragraph nicht gefunden — neue Paragraphen kommen aus der Vorlage.' }); continue; }
      if (o.aus !== undefined) {
        if (o.aus === true && !p.optional && !p.bedingung) { fehler.push({ feld: `paragraphen.${p.id}`, text: `${p.nr || p.titel} ist kein optionaler Paragraph.` }); }
        else if (o.aus === true) p.aus = true; else delete p.aus;
      }
      if (o.text !== undefined || o.titel !== undefined) {
        const text = o.text !== undefined ? block(o.text, VERTRAG_GRENZEN.text) : p.text;
        if (text.length > VERTRAG_GRENZEN.text) { fehler.push({ feld: `paragraphen.${p.id}`, text: `${p.nr}: höchstens ${VERTRAG_GRENZEN.text} Zeichen.` }); continue; }
        const titel = o.titel !== undefined ? zeile(o.titel, VERTRAG_GRENZEN.paragraphTitel) : p.titel;
        for (const ph of platzhalterIn(`${titel}\n${text}`)) if (!bekannt.has(ph)) fehler.push({ feld: `paragraphen.${p.id}`, text: `Unbekannter Platzhalter {{${ph}}} in ${p.nr || p.titel}.` });
        p.text = text; p.titel = titel;
      }
    }
  }
  if (fehler.length) return { fehler };
  return { fehler, v: { ...neu, geaendert: basis.jetzt, geaendertVon: basis.person } };
}

/** Ist ein Paragraph im Vertrag aktiv (nicht abgewählt, Bedingung erfüllt)? */
export function paragraphAktiv(p: Pick<VertragParagraph, 'aus' | 'bedingung'>, werte: Readonly<Record<string, string>>): boolean {
  if (p.aus) return false;
  if (!p.bedingung) return true;
  const w = (werte[p.bedingung] ?? '').trim().toLowerCase();
  return !!w && w !== 'nein' && w !== '0';
}
/** Weicht der Paragraph vom Wortlaut der Vorlage ab? */
export const paragraphAbweichend = (p: Pick<VertragParagraph, 'titel' | 'text' | 'original'>) => !!p.original && (p.original.text !== p.text || p.original.titel !== p.titel);

export interface FuellKontext { absender?: VertragAbsender; partner?: VertragPartner; leistung?: { titel?: string; beschreibung?: string }; nummer?: string }

const datumText = (t: string) => (tagOk(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);
/** Alle Werte für die Platzhalter (rein) — leer = nicht gesetzt. */
export function platzhalterWerte(v: Pick<Vertrag, 'werte' | 'felder'>, k: FuellKontext): Record<string, string> {
  const w: Record<string, string> = {
    'absender.firmierung': k.absender?.firmierung ?? '', 'absender.anschrift': (k.absender?.zeilen ?? []).join(', '),
    'absender.vertretung': k.absender?.vertretung ?? '', 'absender.register': k.absender?.register ?? '',
    'partner.name': k.partner?.name ?? '', 'partner.anschrift': (k.partner?.zeilen ?? []).join(', '), 'partner.ansprechpartner': k.partner?.ansprechpartner ?? '',
    'leistung.titel': k.leistung?.titel ?? '', 'leistung.beschreibung': k.leistung?.beschreibung ?? '', 'vertrag.nummer': k.nummer ?? '',
  };
  const typen = new Map([...STANDARD_FELDER, ...v.felder].map(f => [f.schluessel, f.typ]));
  for (const [s, t] of Object.entries(v.werte)) if (!GERECHNET.has(s)) w[s] = typen.get(s) === 'datum' ? datumText(t) : t;
  // Gerechnete Platzhalter (Darlehen) — aus den rohen Werten, nie aus einer Eingabe.
  Object.assign(w, darlehenPlatzhalter(v.werte));
  return w;
}
/** Platzhalter füllen — was leer ist, bleibt als `{{…}}` stehen (wird von `fertigstellenFehlt` gemeldet, nie leer gedruckt). */
export const fuellen = (text: string, werte: Readonly<Record<string, string>>) => String(text ?? '').replace(PLATZHALTER, (m, s: string) => (werte[s]?.trim() ? werte[s] : m));

/**
 * Was fehlt vor dem Fertigstellen (rein, Sätze): Vertragspartner, Absender, Pflichtfelder, leere/unbekannte Platzhalter in aktiven Paragraphen,
 * ein leerer aktiver Paragraph, gar kein aktiver Paragraph. Leer = darf fertiggestellt werden.
 */
export function fertigstellenFehlt(v: Vertrag, k: FuellKontext): string[] {
  const raus: string[] = [];
  if (!v.kontaktId && !v.firmaId) raus.push('Vertragspartner fehlt — Firma oder Kontakt wählen.');
  if (!k.absender?.firmierung) raus.push('Absender unvollständig — Firmierung der Gesellschaft fehlt.');
  const werte = platzhalterWerte(v, k);
  for (const f of v.felder) if (f.pflicht && !(v.werte[f.schluessel] ?? '').trim()) raus.push(`Pflichtfeld „${f.label}“ ist leer.`);
  const aktiv = v.paragraphen.filter(p => paragraphAktiv(p, v.werte));
  if (!aktiv.length) raus.push('Kein Paragraph ausgewählt.');
  const bekannt = new Set([...FEST, ...v.felder.map(f => f.schluessel)]);
  const leer = new Set<string>();
  for (const p of aktiv) {
    if (!p.text.trim()) raus.push(`${p.nr || p.titel || 'Ein Paragraph'} hat noch keinen Text.`);
    for (const ph of platzhalterIn(`${p.titel}\n${p.text}`)) {
      if (ph === 'vertrag.nummer') continue; // vergibt das Fertigstellen
      if (!bekannt.has(ph)) raus.push(`Unbekannter Platzhalter {{${ph}}} in ${p.nr || p.titel}.`);
      else if (!werte[ph]?.trim()) leer.add(ph);
    }
  }
  const label = (s: string) => FESTE_PLATZHALTER.find(x => x.schluessel === s)?.label ?? [...STANDARD_FELDER, ...v.felder].find(f => f.schluessel === s)?.label ?? s;
  // Darlehensvertrag (02.11.): Raten × Anzahl = Betrag, Enddatum = Monat der letzten Rate — sonst ein Satz (→ 400). Gerechnete Platzhalter
  // melden sich nur, wenn sie ohne Darlehens-Felder nicht rechenbar sind (fehlende Pflichtfelder stehen schon oben).
  const dl = istDarlehenVertrag(v) ? darlehenAusWerten(v.werte) : null;
  if (dl && 'fehler' in dl) raus.push(...dl.fehler);
  for (const s of leer) {
    if (GERECHNET.has(s)) {
      if (!dl) raus.push(`„${label(s)}“ wird aus den Darlehens-Feldern gerechnet — die Vorlage hat sie nicht.`);
      else if ('leer' in dl) raus.push(`„${label(s)}“ wird gerechnet, sobald Darlehensbetrag, Auszahlung, erste Rate, Anzahl der Raten und Rate eingetragen sind.`);
      continue;
    }
    raus.push(`„${label(s)}“ ist leer, steht aber im Vertrag ({{${s}}}).`);
  }
  return raus;
}

/** Warnungen beim Fertigstellen (rein): Ampel der Vorlage und abweichende Paragraphen — brauchen ein „trotzdem“. */
export function fertigstellenWarnungen(v: Vertrag, vorlage: Pick<VertragVorlage, 'pruefung' | 'paragraphen'> | null): { warnungen: string[]; ampel: AmpelStand['stufe']; abweichend: number } {
  const a = vorlage ? vorlageAmpel(vorlage) : { ampel: 'gelb' as const, stufe: 'ungeprueft' as const, satz: 'Die Vorlage gibt es nicht mehr — Prüfstand unbekannt.' };
  const abweichend = v.paragraphen.filter(p => paragraphAktiv(p, v.werte) && paragraphAbweichend(p)).length;
  const warnungen = [...(a.ampel === 'gelb' ? [a.satz] : []), ...(abweichend ? [`${abweichend} Paragraph${abweichend === 1 ? '' : 'en'} weich${abweichend === 1 ? 't' : 'en'} von der Vorlage ab.`] : [])];
  return { warnungen, ampel: a.stufe, abweichend };
}

/** Die gefüllte Fassung (aktive Paragraphen) — beim Fertigstellen festgeschrieben. */
export function vertragFassung(v: Vertrag, k: FuellKontext): { nr: string; titel: string; text: string }[] {
  const werte = platzhalterWerte(v, k);
  return v.paragraphen.filter(p => paragraphAktiv(p, v.werte)).map(p => ({ nr: p.nr, titel: fuellen(p.titel, werte), text: fuellen(p.text, werte) }));
}

// ── Nummer ───────────────────────────────────────────────────────────────────

export const VERTRAG_NUMMER_FORMAT = '{KURZ}-V-{JAHR}-{NR4}';
export function vertragNummer(kurz: string, jahr: number, nr: number): string { return `${kurz}-V-${jahr}-${String(nr).padStart(4, '0')}`; }
export function naechsteVertragsnummer(liste: readonly Pick<Vertrag, 'gesellschaft' | 'lauf'>[], gesellschaft: Gesellschaftskennung, jahr: number): number {
  let max = 0;
  for (const v of liste) if (v.gesellschaft === gesellschaft && v.lauf?.jahr === jahr && v.lauf.nr > max) max = v.lauf.nr;
  return max + 1;
}

/** Neue Version (rein): Entwurf mit Bezug auf den Vorgänger, ohne festgeschriebene Felder. */
export function neueVersion(alt: Vertrag, basis: { id: string; jetzt: string; person: string }): Vertrag {
  const { nummer: _n, lauf: _l, fertigAm: _f, fertigVon: _fv, absender: _a, partner: _p, fassung: _fa, pruefsumme: _s, pdfDateiId: _d, ampelBeimFertig: _am, abweichendBeimFertig: _ab,
    versendetAm: _ve, versendetUeber: _vu, finanzen: _fi, unterschriebenAm: _u, unterschriftDateiId: _ud, registerVertragId: _r, beendetAm: _b, nachfolgerId: _nf, ...rest } = alt;
  return { ...rest, id: basis.id, status: 'entwurf', version: alt.version + 1, vorgaengerId: alt.id, angelegt: basis.jetzt, angelegtVon: basis.person, geaendert: basis.jetzt, geaendertVon: basis.person };
}

/** Daten für den Eintrag in `vertraege[]` des Gesellschafts-Registers (rein). */
export function registerEintrag(v: Vertrag): Record<string, unknown> {
  const n = (s: string) => { const x = Number((v.werte[s] ?? '').replace(',', '.')); return Number.isInteger(x) && x >= 0 && x <= 365 ? x : undefined; };
  const t = (s: string) => (tagOk(v.werte[s]) ? v.werte[s] : undefined);
  const parteien = [{ art: 'gesellschaft', id: v.gesellschaft }, ...(v.firmaId ? [{ art: 'firma', id: v.firmaId }] : v.kontaktId ? [{ art: 'kontakt', id: v.kontaktId }] : [])];
  const erinnerung = n('erinnerung_tage');
  return {
    art: registerArt(v.art), titel: `${v.titel}${v.nummer ? ` (${v.nummer})` : ''}`.slice(0, 160), parteien, status: 'unterschrieben',
    ...(v.unterschriftDateiId ? { dateiIds: [v.unterschriftDateiId] } : {}), ...(t('beginn') ? { beginn: t('beginn') } : {}), ...(t('ende') ? { ende: t('ende') } : {}),
    ...(v.werte.kuendigungsfrist ? { kuendigungsfrist: v.werte.kuendigungsfrist.slice(0, 120) } : {}), ...(t('kuendigen_bis') ? { kuendigenBis: t('kuendigen_bis') } : {}),
    ...(erinnerung !== undefined ? { erinnerungTage: erinnerung } : {}), notiz: `Aus Vertrieb › Verträge${v.nummer ? `: ${v.nummer}` : ''}.`,
  };
}

// ── Personenbezug (Art. 15/17, Dubletten) ────────────────────────────────────

export const GELOEST = '[Person gelöst]';
/** Art. 17: Entwürfe der Person fallen weg; fertige Verträge sind Geschäftsunterlagen (§ 257 HGB) — Bezug gelöst, Vertrag bleibt. */
export function vertraegePersonOhne(liste: readonly Vertrag[], id: string, heute: string): { liste: Vertrag[]; n: number } {
  let n = 0;
  const raus = liste.flatMap(v => {
    if (v.kontaktId !== id) return [v];
    n++;
    if (istVertragEntwurf(v)) return [];
    const { kontaktId: _k, ...rest } = v;
    const partner = v.partner ? (v.firmaId ? { ...v.partner, ...(v.partner.ansprechpartner ? { ansprechpartner: GELOEST } : {}) } : { ...v.partner, name: GELOEST, zeilen: [] }) : undefined;
    return [{ ...rest, personGeloest: heute, ...(partner ? { partner } : {}) }];
  });
  return { liste: raus, n };
}
export const vertraegePersonUm = (liste: readonly Vertrag[], alt: string, neu: string): Vertrag[] => liste.map(v => (v.kontaktId === alt ? { ...v, kontaktId: neu } : v));
export function vertraegePersonAuskunft(liste: readonly Vertrag[], id: string) {
  return liste.filter(v => v.kontaktId === id).map(v => ({ id: v.id, ...(v.nummer ? { nummer: v.nummer } : {}), titel: v.titel, status: v.status, gesellschaft: v.gesellschaft, ...(v.fertigAm ? { fertigAm: v.fertigAm } : {}) }));
}
