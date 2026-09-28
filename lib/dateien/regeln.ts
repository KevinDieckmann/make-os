// ─── Dateiablage · Regeln (rein, client-sicher, getestet, 28.09.) ───────────
// Verträge, Angebote und Rechnungs-PDFs am Kontakt (Reiter „Umsatz“). Hier steht
// alles, was ohne Platte und ohne Schlüssel geht: erlaubte Typen, Größe,
// Dateiname, Erkennung am Inhalt, Säuberung der Metadaten, Filter je Kontakt.
// Die Ablage selbst (verschlüsselt auf der Platte) ist lib/dateien/ablage.ts.
// Grundsatz: Dateien gehen NIE an KI oder Agenten — es gibt kein Werkzeug dafür.

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
export const ANNEHMEN = '.pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Höchstens 15 MB je Datei. */
export const MAX_DATEI_BYTES = 15 * 1024 * 1024;
/** Höchstens so viele Einträge je Haushalt. */
export const MAX_EINTRAEGE = 2000;

/** Kennung eines Eintrags — nur Kleinbuchstaben, Ziffern, Bindestrich (kein Pfad kommt hier durch). */
export const DATEI_ID = /^d-[a-z0-9-]{4,60}$/;
/** Bezüge (Kontakt c-…, Firma f-…, Mandat, Deal, Rechnung r-…). */
const BEZUG_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export interface DateiInfo { name: string; typ: DateiTyp; groesse: number; /** Inhalt liegt als AES-256-GCM-Hülle auf der Platte. */ verschluesselt: boolean }
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

/** Hängt der Eintrag an irgendetwas? Ohne Bezug wird nichts abgelegt (er wäre nirgends zu finden). */
export const hatBezug = (e: Pick<DateiEintrag, 'kontaktId' | 'firmaId' | 'mandatId' | 'dealId' | 'rechnungId'> & Partial<Pick<DateiEintrag, 'angebotId' | 'gesellschaft'>>) => !!(e.kontaktId || e.firmaId || e.mandatId || e.dealId || e.rechnungId || e.angebotId || e.gesellschaft);

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
