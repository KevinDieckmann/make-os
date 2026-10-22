// ─── Prozesse — Agenten-Schritt mit Feldern (M6, 22.10. spät; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.3 M6, ANALYSE_100.md Punkte 54, 56) ─────────
// Ein Agenten-Schritt mit Ergebnis „Vorschlag“ (Research liest das Web — das Ergebnis ist IMMER ein Vorschlag) liefert neben dem Vertrag (nur Kennungen,
// Zahlen, Tage, ja/nein, Auswahl — fließt an die nächsten Rauten) Werte für Felder der Akte. Diese Werte sind FREMDER TEXT: sie gehen nie in den Lauf, sondern
// nur als CRM-Vorschlag in den Stapel (lib/zoe/crm-vorschlag.ts — Firma ergänzen `firma_felder`, Kernfragen `qualifizierung`; Whitelist N4), übernommen erst per
// Häkchen je Feld bzw. Sammelfreigabe. Sie bestimmen nie Weg, Empfänger oder Betrag (Punkt 56). Hier: welche Zielfelder wohin gehören und wie die Antwort des
// Modells gesäubert wird. Rein und client-sicher.

import { FELD_KENNUNG, VORSCHLAG_ZIELFELDER, type VorschlagZielfeld } from './definition';

/** Wohin ein Zielfeld des Agenten-Vorschlags in der Akte gehört: ein Feld der Firma (`firma_felder`) bzw. eine Kernfrage des Leads (`qualifizierung`). */
export const ZIELFELD_ZUR_AKTE: Readonly<Record<VorschlagZielfeld, { ziel: 'firma' | 'lead'; feld: string; max: number; https?: true }>> = {
  'firma.branche': { ziel: 'firma', feld: 'branche', max: 160 },
  'firma.website': { ziel: 'firma', feld: 'webseite', max: 300, https: true },
  'firma.sitz': { ziel: 'firma', feld: 'stadt', max: 120 },
  'firma.mitarbeiter': { ziel: 'firma', feld: 'mitarbeiter', max: 40 },
  'firma.umsatz-klasse': { ziel: 'firma', feld: 'umsatz', max: 60 },
  'firma.beschreibung': { ziel: 'firma', feld: 'marktinfo', max: 800 },
  'firma.linkedin': { ziel: 'firma', feld: 'linkedin', max: 300, https: true },
  'lead.schmerz': { ziel: 'lead', feld: 'schmerz', max: 600 },
  'lead.entscheider': { ziel: 'lead', feld: 'entscheider', max: 600 },
  'lead.budget': { ziel: 'lead', feld: 'budget', max: 600 },
  'lead.zeitpunkt': { ziel: 'lead', feld: 'zeitpunkt', max: 600 },
  'lead.wirkung': { ziel: 'lead', feld: 'wirkung', max: 600 },
  'lead.alternative': { ziel: 'lead', feld: 'alternative', max: 600 },
};

type O = Record<string, unknown>;
const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);
// Steuerzeichen raus, Leerraum zusammen, keine Daten-Rahmen und keine spitzen Klammern (der Text geht nur in einen Vorschlag — trotzdem nie Markup).
// eslint-disable-next-line no-control-regex
const sauber = (v: string): string => v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const httpsOk = (v: string): boolean => /^https:\/\/[^\s]{3,}$/.test(v);

export interface AgentFelder {
  /** Felder der Firma (Kennungen wie lib/zoe/crm-vorschlag.ts `KARTE_FIRMA_FELDER`). */
  firma: Record<string, string>;
  /** Antworten auf Kernfragen (lib/crm/leads.ts `KRITERIEN`). */
  antworten: Record<string, string>;
  /** Wie viele Werte verworfen wurden (unbekanntes Feld, falscher Typ, zu lang bzw. keine https-Adresse) — nur gezählt, nie gekürzt übernommen. */
  verworfen: number;
}

/**
 * Die Felder aus der Antwort des Modells (rein): NUR die Zielfelder des Schritts (`vorschlagFelder`), nur Text, über der Grenze VERWORFEN (nie gekürzt — ein
 * halber Wert ist schlechter als keiner), Webseite/LinkedIn nur als https-Adresse.
 */
export function agentFelderAus(roh: unknown, ziele: readonly string[]): AgentFelder {
  const raus: AgentFelder = { firma: {}, antworten: {}, verworfen: 0 };
  if (!istObj(roh)) return raus;
  const erlaubt = new Set(ziele.filter((z): z is VorschlagZielfeld => (VORSCHLAG_ZIELFELDER as readonly string[]).includes(z)));
  for (const [k, v] of Object.entries(roh)) {
    if (!erlaubt.has(k as VorschlagZielfeld)) { raus.verworfen++; continue; }
    const z = ZIELFELD_ZUR_AKTE[k as VorschlagZielfeld];
    const t = typeof v === 'string' ? sauber(v) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
    if (!t) continue;
    if (t.length > z.max || (z.https && !httpsOk(t))) { raus.verworfen++; continue; }
    if (z.ziel === 'firma') raus.firma[z.feld] = t; else raus.antworten[z.feld] = t;
  }
  return raus;
}

/** Quellen aus der Antwort (rein): nur https-Adressen, ohne Doppelte, höchstens 5 — als Beleg im Vorschlag. */
export function quellenAus(roh: unknown): string[] {
  if (!Array.isArray(roh)) return [];
  const raus: string[] = [];
  for (const x of roh) {
    const t = typeof x === 'string' ? sauber(x) : '';
    if (t.length <= 300 && httpsOk(t) && !raus.includes(t)) raus.push(t);
    if (raus.length >= 5) break;
  }
  return raus;
}

/**
 * Die Werte des Vertrags als Daten des Laufs (rein): `agent.<feld>` — nur das, was der Vertrag zulässt (Kennung, Zahl, Tag, ja/nein, Auswahl; Listen mit Komma).
 * Für die nächsten Rauten (z. B. „Fit ≥ 70“ — nur in harmlose Äste, Punkt 56).
 */
export function agentDaten(werte: Readonly<Record<string, string | number | boolean | readonly (string | number | boolean)[]>>): Record<string, string> {
  const raus: Record<string, string> = {};
  for (const [k, v] of Object.entries(werte)) {
    if (!FELD_KENNUNG.test(k)) continue;
    const t = Array.isArray(v) ? v.map(String).join(',') : String(v);
    if (t.length <= 120) raus[`agent.${k}`] = t;
  }
  return raus;
}

/** Wie das Modell die Felder liefern soll (für den Prompt): „firma.branche (Text, höchstens 160 Zeichen)“ … */
export function felderAuftrag(ziele: readonly string[]): string {
  return ziele.filter((z): z is VorschlagZielfeld => (VORSCHLAG_ZIELFELDER as readonly string[]).includes(z))
    .map(z => `${z} (Text, höchstens ${ZIELFELD_ZUR_AKTE[z].max} Zeichen${ZIELFELD_ZUR_AKTE[z].https ? ', nur https-Adresse' : ''})`).join('; ');
}

// ── „Nur öffentliche Angaben“ (Entscheidung 22.10. nachts) ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was ein Web-Recherche-Agent im Modus „nur öffentliche Angaben“ bekommt — und sonst NICHTS (keine Notiz, keine Personen, keine Kennung, keine Akte). */
export interface OeffentlicheAngaben { name: string; webseite?: string; domain?: string; branche?: string }
/** Höchstlängen — ein Feld darüber (z. B. eine Notiz im Feld „Webseite“) fällt weg, nie gekürzt. */
export const OEFFENTLICH_MAX = { name: 200, webseite: 300, domain: 120, branche: 160 } as const;
// Adresse bzw. Hostname (auch mit Umlauten, IDN) — keine Leerzeichen, kein Text.
// (als `new RegExp`: Unicode-Klassen in Literalen erst ab ES2018 — das Ziel des Projekts ist ES2017.)
const ADRESSE = new RegExp('^(https?://)?[\\p{L}\\p{N}.-]+\\.\\p{L}{2,}(:\\d{1,5})?(/\\S*)?$', 'iu');
const DOMAIN = new RegExp('^[\\p{L}\\p{N}]([\\p{L}\\p{N}-]*[\\p{L}\\p{N}])?(\\.[\\p{L}\\p{N}]([\\p{L}\\p{N}-]*[\\p{L}\\p{N}])?)+$', 'iu');
const einzeilig = (v: unknown, max: number): string => {
  const t = typeof v === 'string' ? sauber(v) : '';
  return t && t.length <= max ? t : '';
};

/**
 * Die öffentlichen Angaben einer Firmenkarte (rein): NUR Name, Webseite (als Adresse), Domain und Branche — jedes Feld einzeilig, ohne Markup, über der
 * Grenze bzw. in falscher Form verworfen (eine Webseite muss wie eine Adresse aussehen, eine Domain wie ein Hostname). Ohne Namen → null (dann gibt es
 * nichts Öffentliches zu recherchieren). Alle übrigen Felder der Karte (Notiz, Marktinfo, Lead, Zahlung, Stadt, Personen …) kommen hier nie heraus.
 */
export function oeffentlicheAngaben(f: { name?: unknown; webseite?: unknown; domain?: unknown; branche?: unknown } | null | undefined): OeffentlicheAngaben | null {
  if (!f) return null;
  const name = einzeilig(f.name, OEFFENTLICH_MAX.name);
  if (!name) return null;
  const webseite = einzeilig(f.webseite, OEFFENTLICH_MAX.webseite);
  const domain = einzeilig(f.domain, OEFFENTLICH_MAX.domain);
  const branche = einzeilig(f.branche, OEFFENTLICH_MAX.branche);
  return {
    name,
    ...(webseite && ADRESSE.test(webseite) ? { webseite } : {}),
    ...(domain && DOMAIN.test(domain) ? { domain } : {}),
    ...(branche ? { branche } : {}),
  };
}
