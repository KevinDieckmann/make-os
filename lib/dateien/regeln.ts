// ─── Dateiablage · Regeln (rein, client-sicher, getestet, 28.09.) ───────────
// Verträge, Angebote und Rechnungs-PDFs am Kontakt (Reiter „Umsatz“). Hier steht
// alles, was ohne Platte und ohne Schlüssel geht: erlaubte Typen, Größe,
// Dateiname, Erkennung am Inhalt, Säuberung der Metadaten, Filter je Kontakt.
// Die Ablage selbst (verschlüsselt auf der Platte) ist lib/dateien/ablage.ts.
// Grundsatz: Die CRM-Ablage (Angebote, Rechnungen, Einwilligungsbelege, Mandatsunterlagen) geht NIE an KI
// oder Agenten — es gibt kein Werkzeug dafür. Dateien an Projekten und Aufgaben (28.09., Paket C2) liegen in
// einem EIGENEN Bestand (lib/dateien/aufgaben-ablage.ts, `aufgaben-dateien--<haushalt>`); nur diese liest ZOE,
// immer als Fremdtext gekapselt (lib/zoe/aufgaben-unterlagen.ts).

import type { AufgabenDateiTyp } from './aufgaben-regeln';

export type DateiArt = 'vertrag' | 'angebot' | 'rechnung' | 'sonstig';
export type Vertragsart = 'rahmen' | 'auftrag' | 'nda' | 'av' | 'sonstig';
export type AngebotStatus = 'offen' | 'angenommen' | 'abgelehnt';

export const DATEI_ARTEN: readonly { id: DateiArt; label: string }[] = [
  { id: 'vertrag', label: 'Vertrag' }, { id: 'angebot', label: 'Angebot' }, { id: 'rechnung', label: 'Rechnung' }, { id: 'sonstig', label: 'Sonstiges' },
];
export const VERTRAGSARTEN: readonly { id: Vertragsart; label: string }[] = [
  { id: 'rahmen', label: 'Rahmenvertrag' }, { id: 'auftrag', label: 'Auftrag' }, { id: 'nda', label: 'NDA' }, { id: 'av', label: 'AV-Vertrag' }, { id: 'sonstig', label: 'Sonstiger Vertrag' },
];
export const ANGEBOT_STATUS: readonly { id: AngebotStatus; label: string }[] = [
  { id: 'offen', label: 'offen' }, { id: 'angenommen', label: 'angenommen' }, { id: 'abgelehnt', label: 'abgelehnt' },
];

/** Die vier erlaubten Typen — mit Endungen. Alles andere: 415. */
export const ERLAUBTE_TYPEN = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
} as const;
export type DateiTyp = keyof typeof ERLAUBTE_TYPEN;

/**
 * Sprachnotizen (02.10., Netzwerken): Aufnahme am Handy, abgelegt am Kontakt. NICHT über den Upload der Oberfläche
 * (`typErkennen` bleibt bei den vier Typen oben) — nur der Server-Weg lib/crm/netzwerken-server.ts legt sie ab, und der
 * Typ kommt aus dem INHALT (`sprachnotizTypErkennen`), nie aus der Angabe des Browsers.
 */
export const SPRACHNOTIZ_TYPEN = { 'audio/webm': ['webm'], 'audio/mp4': ['m4a', 'mp4'], 'audio/ogg': ['ogg'], 'audio/mpeg': ['mp3'], 'audio/wav': ['wav'], 'audio/aac': ['aac'] } as const;
export type SprachnotizTyp = keyof typeof SPRACHNOTIZ_TYPEN;
export const ANNEHMEN = '.pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Höchstens 15 MB je Datei. */
export const MAX_DATEI_BYTES = 15 * 1024 * 1024;
/** Höchstens so viele Einträge je Haushalt. */
export const MAX_EINTRAEGE = 2000;

/** Kennung eines Eintrags — nur Kleinbuchstaben, Ziffern, Bindestrich (kein Pfad kommt hier durch). */
export const DATEI_ID = /^d-[a-z0-9-]{4,60}$/;
/** Bezüge (Kontakt c-…, Firma f-…, Mandat, Deal, Rechnung r-…). */
const BEZUG_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export interface DateiInfo { name: string; /** CRM: die vier Typen oben (+ Sprachnotizen, nur Server-Weg); Aufgaben-Dateien (C2): AUFGABEN_TYPEN. */ typ: DateiTyp | SprachnotizTyp | AufgabenDateiTyp; groesse: number; /** Inhalt liegt als AES-256-GCM-Hülle auf der Platte. */ verschluesselt: boolean }
export interface VertragDaten { vertragsart: Vertragsart; von?: string; bis?: string; /** frei, z. B. „3 Monate zum Quartalsende“. */ kuendigungsfrist?: string }
export interface AngebotDaten { nummer?: string; datum?: string; betrag?: number; status: AngebotStatus; gueltigBis?: string }

/** Ein Eintrag der Ablage: Metadaten (+ optional die Datei). Ein Angebot darf ohne PDF stehen. */
export interface DateiEintrag {
  id: string;
  art: DateiArt;
  titel?: string;
  datei?: DateiInfo;
  kontaktId?: string;
  firmaId?: string;
  mandatId?: string;
  dealId?: string;
  rechnungId?: string;
  /**
   * Angebot aus dem Angebots-Tool (28.09., crm.angebote) — setzt NUR der Server beim Stellen (PDF). Ein solcher
   * Eintrag ist eine Geschäftsunterlage: nicht löschbar (`istBeleg`), Personenbezug nur lösbar.
   */
  angebotId?: string;
  /** Logo einer Gesellschaft (28.09., Stammdaten › Gesellschaften) — setzt NUR der Server. */
  gesellschaft?: 'kdc' | 'kdv' | 'ug';
  /**
   * Dateien an Projekten und Aufgaben (28.09., Paket C2) — nur im Bestand `aufgaben-dateien--<haushalt>`
   * (lib/dateien/aufgaben-ablage.ts), nie in der CRM-Ablage. Kennungen wie in lib/aufgaben/saeubern.ts.
   */
  projektId?: string;
  aufgabeId?: string;
  /** Privat oder Business — aus dem Space des Projekts bzw. der Aufgabe abgeleitet (Server). Privat nie in CRM-Sichten. */
  bereich?: 'privat' | 'business';
  vertrag?: VertragDaten;
  angebot?: AngebotDaten;
  notiz?: string;
  hochgeladenAm: string;
  hochgeladenVon: string;
  geaendert?: string;
  geaendertVon?: string;
  /**
   * Tag, an dem die Verbindungsprüfung (lib/crm/verbindungen.ts) bemerkt hat, dass die Datei
   * zu diesem Eintrag nicht mehr auf der Platte liegt (28.09.) — nur eine Markierung, gelöscht wird nichts.
   */
  dateiFehlt?: string;
}

const txt = (v: unknown, n: number) => { const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const bezug = (v: unknown) => (typeof v === 'string' && BEZUG_ID.test(v) ? v : undefined);

/** Endung eines Dateinamens (klein, ohne Punkt). */
export const endung = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? '').toLowerCase();

/**
 * Dateiname säubern: nur der letzte Teil (kein Pfad), keine Steuerzeichen,
 * keine Zeichen, die in Kopfzeilen oder Dateisystemen stören, höchstens 120
 * Zeichen, die Endung bleibt. Leer → „datei.<endung>“.
 */
export function dateinameSaeubern(roh: unknown, ersatzEndung = 'pdf'): string {
  const letzter = String(roh ?? '').split(/[\\/]/).pop() ?? '';
  const e = endung(letzter) || ersatzEndung;
  const stamm = letzter.replace(/\.[a-z0-9]{1,5}$/i, '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f"<>:|?*;%\\/`$]/g, '')
    .replace(/\.{2,}/g, '.').replace(/^[.\s-]+/, '').replace(/\s+/g, ' ').trim()
    .slice(0, 110);
  return `${stamm || 'datei'}.${e}`;
}

/** ASCII-Fassung für `filename=` in Content-Disposition (die UTF-8-Fassung steht in `filename*`). */
export const dateinameAscii = (name: string) => name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'datei';

const beginntMit = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

/**
 * Typ am INHALT erkennen und mit der Endung abgleichen — die Angabe des
 * Browsers zählt nicht. PDF „%PDF-“, PNG-Signatur, JPEG FF D8 FF, DOCX = ZIP
 * („PK\x03\x04“) mit Endung .docx. Passt es nicht: null (→ 415).
 */
export function typErkennen(name: string, kopf: Uint8Array): DateiTyp | null {
  const e = endung(name);
  if (e === 'pdf' && beginntMit(kopf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (e === 'png' && beginntMit(kopf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if ((e === 'jpg' || e === 'jpeg') && beginntMit(kopf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (e === 'docx' && beginntMit(kopf, [0x50, 0x4b, 0x03, 0x04])) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

/** Sprachnotiz am Inhalt erkennen: WebM/Matroska (EBML), MP4/M4A (`ftyp`), Ogg, MP3 (ID3 oder Frame-Sync), AAC (ADTS), WAV (RIFF/WAVE). Sonst null. */
export function sprachnotizTypErkennen(kopf: Uint8Array): SprachnotizTyp | null {
  const gleich = (ab: number, text: string) => text.split('').every((c, i) => kopf[ab + i] === c.charCodeAt(0));
  if (beginntMit(kopf, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
  if (gleich(4, 'ftyp')) return 'audio/mp4';
  if (gleich(0, 'OggS')) return 'audio/ogg';
  if (gleich(0, 'RIFF') && gleich(8, 'WAVE')) return 'audio/wav';
  if (gleich(0, 'ID3')) return 'audio/mpeg';
  if (kopf[0] === 0xff && (kopf[1] & 0xf0) === 0xf0 && (kopf[1] & 0x06) === 0) return 'audio/aac';
  if (kopf[0] === 0xff && (kopf[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return null;
}

function vertragSaeubern(v: unknown): VertragDaten | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const vertragsart = VERTRAGSARTEN.some(a => a.id === o.vertragsart) ? o.vertragsart as Vertragsart : 'sonstig';
  return { vertragsart, ...(tag(o.von) ? { von: tag(o.von) } : {}), ...(tag(o.bis) ? { bis: tag(o.bis) } : {}), ...(txt(o.kuendigungsfrist, 80) ? { kuendigungsfrist: txt(o.kuendigungsfrist, 80) } : {}) };
}
function angebotSaeubern(v: unknown): AngebotDaten | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const betrag = Number(o.betrag);
  return {
    status: ANGEBOT_STATUS.some(s => s.id === o.status) ? o.status as AngebotStatus : 'offen',
    ...(txt(o.nummer, 60) ? { nummer: txt(o.nummer, 60) } : {}), ...(tag(o.datum) ? { datum: tag(o.datum) } : {}),
    ...(o.betrag != null && String(o.betrag) !== '' && Number.isFinite(betrag) && betrag >= 0 ? { betrag: Math.round(Math.min(betrag, 1e9) * 100) / 100 } : {}),
    ...(tag(o.gueltigBis) ? { gueltigBis: tag(o.gueltigBis) } : {}),
  };
}

/** Die änderbaren Metadaten eines Eintrags — aus dem Netz, gesäubert. `art` fehlt → undefined (Aufrufer entscheidet). */
export function metaSaeubern(roh: unknown): Partial<Pick<DateiEintrag, 'art' | 'titel' | 'kontaktId' | 'firmaId' | 'mandatId' | 'dealId' | 'rechnungId' | 'vertrag' | 'angebot' | 'notiz'>> {
  if (!roh || typeof roh !== 'object') return {};
  const o = roh as Record<string, unknown>;
  const art = DATEI_ARTEN.some(a => a.id === o.art) ? o.art as DateiArt : undefined;
  const vertrag = art === 'vertrag' ? vertragSaeubern(o.vertrag) ?? { vertragsart: 'sonstig' as const } : undefined;
  const angebot = art === 'angebot' ? angebotSaeubern(o.angebot) ?? { status: 'offen' as const } : undefined;
  return {
    ...(art ? { art } : {}), ...(txt(o.titel, 160) ? { titel: txt(o.titel, 160) } : {}),
    ...(bezug(o.kontaktId) ? { kontaktId: bezug(o.kontaktId) } : {}), ...(bezug(o.firmaId) ? { firmaId: bezug(o.firmaId) } : {}),
    ...(bezug(o.mandatId) ? { mandatId: bezug(o.mandatId) } : {}), ...(bezug(o.dealId) ? { dealId: bezug(o.dealId) } : {}),
    ...(bezug(o.rechnungId) ? { rechnungId: bezug(o.rechnungId) } : {}),
    ...(vertrag ? { vertrag } : {}), ...(angebot ? { angebot } : {}),
    ...(txt(o.notiz, 600) ? { notiz: txt(o.notiz, 600) } : {}),
  };
}

/**
 * Hängt der Eintrag an einer Rechnung oder einem Mandat (28.09., K3 · #50/#81)? Dann ist er ein Beleg
 * und wird nicht gelöscht (DELETE → 409) — nur vom Bezug gelöst (PATCH `{ rechnungId: null, mandatId: null }`).
 */
export const istBeleg = (e: Pick<DateiEintrag, 'rechnungId' | 'mandatId'> & Partial<Pick<DateiEintrag, 'angebotId'>>) => !!(e.rechnungId || e.mandatId || e.angebotId);

/**
 * Hängt der Eintrag an irgendetwas? Ohne Bezug wird nichts abgelegt (er wäre nirgends zu finden).
 * Seit 28.09. (C2) zählen auch Projekt und Aufgabe — gesetzt nur über die Aufgaben-Ablage (dort Pflicht: Projekt).
 */
export const hatBezug = (e: Pick<DateiEintrag, 'kontaktId' | 'firmaId' | 'mandatId' | 'dealId' | 'rechnungId'> & Partial<Pick<DateiEintrag, 'angebotId' | 'gesellschaft' | 'projektId' | 'aufgabeId'>>) => !!(e.kontaktId || e.firmaId || e.mandatId || e.dealId || e.rechnungId || e.angebotId || e.gesellschaft || e.projektId || e.aufgabeId);

/** Gehört der Eintrag zu Projekten/Aufgaben (C2)? Solche Einträge erscheinen nie in einer CRM-Sicht. */
export const istAufgabenDatei = (e: Pick<DateiEintrag, 'projektId' | 'aufgabeId' | 'bereich'>) => !!(e.projektId || e.aufgabeId || e.bereich);
/** Nur Einträge der CRM-Ablage — Schutz in der Tiefe: Aufgaben-Dateien (v. a. privat) nie in CRM-Listen. */
export const nurCrm = <T extends Pick<DateiEintrag, 'projektId' | 'aufgabeId' | 'bereich'>>(l: readonly T[]): T[] => l.filter(e => !istAufgabenDatei(e));

/** Bezüge, die nur der Server setzt (Angebots-PDF, Logo) — `metaSaeubern` liest sie nie aus dem Netz. */
export interface FesteBezuege { angebotId?: string; gesellschaft?: 'kdc' | 'kdv' | 'ug' }

export interface DateiFilter { kontaktId?: string; firmaId?: string; mandatIds?: string[]; dealIds?: string[]; rechnungIds?: string[] }
/** Einträge eines Kontakts: an ihm, an seiner Firma, an seinen Mandaten, Deals oder Rechnungen. Neueste zuerst. */
export function eintraegeFuer(liste: DateiEintrag[], f: DateiFilter): DateiEintrag[] {
  const m = new Set(f.mandatIds ?? []), d = new Set(f.dealIds ?? []), r = new Set(f.rechnungIds ?? []);
  return liste.filter(e => (f.kontaktId && e.kontaktId === f.kontaktId) || (f.firmaId && e.firmaId === f.firmaId)
    || (e.mandatId && m.has(e.mandatId)) || (e.dealId && d.has(e.dealId)) || (e.rechnungId && r.has(e.rechnungId)))
    .sort((a, b) => b.hochgeladenAm.localeCompare(a.hochgeladenAm));
}

/** Größe lesbar: „820 KB“, „3,4 MB“. */
export function groesseText(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}
