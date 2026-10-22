// ─── ZOE · CRM-Vorschläge mit Häkchen je Feld bzw. Sammelfreigabe (22.10. spät, Prozesse M6 / N4) ───────────────────────────────────────────────────────
// Ein Agenten-Schritt eines Prozesses (z. B. Research) legt Felder der Akte als CRM-Vorschlag in den Stapel (lib/zoe/crm-vorschlag.ts — Firma ergänzen,
// Kontakt ergänzen, Kernfragen). Wie übernommen wird, sagt der Schritt (`uebernahme`), festgehalten im Vorschlag als `_uebernahme`:
//   je-feld   die freigebende Person hakt einzelne Felder ab — übernommen wird nur die AUSWAHL der vorbereiteten Werte (nie ein neuer Wert, nie ein anderes Feld)
//   sammel    nur Stammdaten der Firma — „alle freigeben“ im Stapel nimmt ihn mit (wie risikoarme ZOE-Aufgaben)
// Rein und client-sicher (Stapel-Ansicht UND Freigabe-Weg rechnen mit derselben Regel).

type O = Record<string, unknown>;
const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);

/** Wie die Felder im Stapel heißen. */
export const FELD_NAME: Readonly<Record<string, string>> = {
  branche: 'Branche', branchen: 'Branchen', mitarbeiter: 'Mitarbeitende', stadt: 'Sitz', webseite: 'Webseite', linkedin: 'LinkedIn', marktinfo: 'Beschreibung', umsatz: 'Umsatz',
  aufhaenger: 'Aufhänger', signale: 'Signale', recherche: 'Stand der Recherche', steckbrief: 'Steckbrief', vorgestelltDurch: 'Vorgestellt durch',
  'antworten.schmerz': 'Schmerz', 'antworten.entscheider': 'Entscheider', 'antworten.budget': 'Budget', 'antworten.zeitpunkt': 'Zeitpunkt', 'antworten.wirkung': 'Wirkung',
  'antworten.alternative': 'Alternative',
};

const ARTEN_JE_FELD = new Set(['firma_felder', 'kontakt_felder', 'qualifizierung']);

/** Ein Feld zur Wahl (Kennung, Name, vorbereiteter Wert). */
export interface FeldWahl { id: string; name: string; wert: string }

/** Die Felder, die man bei diesem Vorschlag einzeln abhaken kann — null, wenn er nur als Ganzes freigegeben wird. */
export function felderZurWahl(eingabe: Readonly<O> | null | undefined): FeldWahl[] | null {
  if (!eingabe || eingabe._uebernahme !== 'je-feld' || !ARTEN_JE_FELD.has(String(eingabe.art))) return null;
  const f = istObj(eingabe.felder) ? eingabe.felder : {};
  const raus: FeldWahl[] = [];
  const text = (v: unknown) => (Array.isArray(v) ? v.map(String).join(', ') : String(v ?? ''));
  if (eingabe.art === 'qualifizierung') {
    for (const [k, v] of Object.entries(istObj(f.antworten) ? f.antworten : {})) raus.push({ id: `antworten.${k}`, name: FELD_NAME[`antworten.${k}`] ?? k, wert: text(v) });
  } else for (const [k, v] of Object.entries(f)) if (k !== 'firmaWechsel') raus.push({ id: k, name: FELD_NAME[k] ?? k, wert: text(v) });
  return raus.length > 1 ? raus : null;
}

/**
 * Nur die gewählten Felder (rein) — `gewaehlt` = Kennungen aus `felderZurWahl`. Unbekannte Kennung bzw. nichts gewählt → Fehler (nichts übernommen).
 * Übernommen werden ausschließlich die vorbereiteten Werte (ein Teil davon) — nie ein neuer Wert.
 */
export function nurGewaehlteFelder(eingabe: Readonly<O>, gewaehlt: readonly unknown[]): { ok: true; eingabe: O } | { ok: false; fehler: string } {
  const wahl = felderZurWahl(eingabe);
  if (!wahl) return { ok: false, fehler: 'Dieser Vorschlag wird nur als Ganzes freigegeben.' };
  const ids = new Set(wahl.map(w => w.id));
  const g = Array.from(new Set(gewaehlt.filter((x): x is string => typeof x === 'string')));
  if (!g.length) return { ok: false, fehler: 'Kein Feld gewählt — nichts übernommen.' };
  if (g.some(x => !ids.has(x))) return { ok: false, fehler: 'Ein gewähltes Feld gehört nicht zu diesem Vorschlag — nichts übernommen.' };
  const f = istObj(eingabe.felder) ? eingabe.felder : {};
  if (eingabe.art === 'qualifizierung') {
    const a = istObj(f.antworten) ? f.antworten : {};
    const neu = Object.fromEntries(Object.entries(a).filter(([k]) => g.includes(`antworten.${k}`)));
    return { ok: true, eingabe: { ...eingabe, felder: { ...f, antworten: neu } } };
  }
  return { ok: true, eingabe: { ...eingabe, felder: Object.fromEntries(Object.entries(f).filter(([k]) => g.includes(k) || k === 'firmaWechsel')) } };
}

/** Darf „alle freigeben“ diesen CRM-Vorschlag mitnehmen? Nur „Firma ergänzen“ mit Sammelfreigabe (nur Stammdaten). */
export function crmSammelTauglich(v: { bezug?: { art: string } | null; eingabe?: Readonly<O> | null }): boolean {
  return v.bezug?.art === 'crm' && v.eingabe?.art === 'firma_felder' && v.eingabe._uebernahme === 'sammel';
}
