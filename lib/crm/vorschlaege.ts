// ─── Markttraktion · Vorschläge für Auswahlfelder (rein, getestet, 27.09.) ───
// Kevin: „Das ständige Anklicken muss smarter werden.“ Leere Felder zeigen
// einen Vorschlag aus den Daten, den man mit EINEM Klick übernimmt — nie still
// gespeichert, nie erfunden. Jede Regel nennt ihren Grund im Klartext.
//   dealRolleVorschlag      Position/Jobtitel/Seniorität (+ warm?) → Rolle am Deal
//   offeneRollenVorschlaege / vorschlaegeAnwenden / vorschlaegeZuruecknehmen
//                           Sammel-Übernahme am Deal (ein Schreibvorgang, Rückgängig)
//   kontaktRollenVorschlag  Typ/Kategorie/Firmen-Rolle → Rollen der Person
//   anredeVorschlag         Kategorie, Rolle „Freund“, eigene Nachrichten → Du/Sie
// Deutsche und englische Titel, Groß-/Kleinschreibung egal. „Bremst“ (blocker)
// wird nie vorgeschlagen — das weiß nur, wer mit der Person gesprochen hat.

import { rollenVon, ROLLE_LABEL, type Kontakt, type Rolle } from '@/lib/make-one/crm';
import { echtesGespraech } from './pipeline';
import { normiere, type WahlVorschlag } from './wahl';
import type { DealRolle, Firma, Chance } from './typen';

/** Wie lange ein echtes Gespräch die Person „warm“ hält. */
export const WARM_TAGE = 90;

const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis.slice(0, 10)}T12:00:00Z`) - Date.parse(`${von.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

// Muster laufen auf der normierten Form (klein, ä→ae, ß→ss). Wortgrenzen über (^|[^a-z]).
const W = '(?:^|[^a-z])';
/** Assistenz/Referat „der Geschäftsführung“ ist keine Geschäftsführung. */
const ZUARBEIT = new RegExp(`${W}(assisten\\w*|referent\\w*|sekretaer\\w*|office manager\\w*)\\s+(der|des|to|to the|of the|fuer die)\\s`);
const ZUARBEIT_WORT = /((?:vorstand|geschaeftsfuehrung|geschaeftsleitung)s?(?:assisten|referent|sekretaer|buero)\w*|executive assistant|ceo office|office of the ceo)/;
const EHEMALIG = new RegExp(`${W}(ehem\\.?|ehemalige?[rns]?|frueher|former)(?=[^a-z]|$)|${W}ex-[a-z]`);
const STELLV = new RegExp(`${W}(stellv\\.?|stellvertretende?[rns]?|deputy|vice)(?=\\s|$|[^a-z])`);

// Deutsche Wörter stehen oft in Zusammensetzungen („Softwareentwickler“, „Vertriebsleiterin“, „Finanzvorstand“) —
// sie brauchen keine Wortgrenze vorn; englische Kürzel und Wörter schon (sonst steckt „cto“ in „director“).
const ENTSCHEIDER = new RegExp(`(geschaeftsfuehr\\w*|geschaeftsleitung|unternehmensleitung|inhaber\\w*|eigentuemer\\w*|gruender\\w*|vorstand\\w*|praesident\\w*)|${W}(co-?founder\\w*|founder\\w*|(?<!(?:product|process|service|data|content) )owner|president|managing director|managing partner|general manager|ceo|cfo|coo|cto|cmo|cio|cdo|cpo|cro|chro|cco|chief [a-z]+ officer|c[-_ ]?level|c[-_ ]?suite)(?=[^a-z]|$)`);
const MITTE = new RegExp(`(leiter\\w*|leitung\\w*|prokurist\\w*|direktor\\w*)|${W}(team ?lead\\w*|head of [a-z&-]+|head|director|vp|vice president|lead)(?=[^a-z]|$)`);
const NUTZER = new RegExp(`(referent\\w*|mitarbeiter\\w*|sachbearbeit\\w*|entwickler\\w*|ingenieur\\w*|berater\\w*|assisten\\w*|spezialist\\w*|analyst\\w*|werkstudent\\w*|praktikant\\w*|fachkraft)|${W}(developer|engineer|consultant|assistant|specialist|associate|trainee|junior|intern|sales representative|account executive)(?=[^a-z]|$)`);
const C_LEVEL = /(c[-_ ]?level|c[-_ ]?suite|owner|inhaber|founder|gruender|vorstand|geschaeftsfuehr|partner)/;

/** Den getroffenen Begriff im Originaltext wiederfinden — für den Grund („Geschäftsführerin laut Position“). */
function originalTreffer(original: string, treffer: string): string {
  const rand = (w: string) => w.replace(/^[^a-z&]+|[^a-z&]+$/g, '');
  const ziel = treffer.trim().split(/\s+/).map(rand).filter(Boolean);
  const woerter = original.trim().split(/\s+/);
  for (let i = 0; ziel.length && i + ziel.length <= woerter.length; i++) {
    if (ziel.every((z, j) => normiere(woerter[i + j]).includes(z))) return woerter.slice(i, i + ziel.length).join(' ').replace(/[,;:·|]+$/, '');
  }
  return treffer.trim();
}

/** Die erste belegte Gruppe eines Treffers (die Muster haben einen deutschen und einen englischen Zweig). */
const gruppe = (m: RegExpMatchArray | null): string | null => (m ? m.slice(1).find(x => x !== undefined) ?? m[0] : null);

interface TitelTreffer { stufe: 'entscheider' | 'mitte' | 'nutzer'; wort: string; feld: string }

/** Einstufung eines Titels. Reihenfolge: Zuarbeit (Assistenz der GF) → Entscheider → Mitte → Nutzer. */
function stufeAusTitel(text: string | undefined, feld: string): TitelTreffer | null {
  if (!text?.trim()) return null;
  const n = normiere(text);
  if (EHEMALIG.test(n)) return null;
  const zu = n.match(ZUARBEIT) ?? n.match(ZUARBEIT_WORT);
  if (zu) return { stufe: 'nutzer', wort: text.trim().length <= 48 ? text.trim() : originalTreffer(text, zu[1] ?? zu[0]), feld };
  const stellv = STELLV.test(n);
  const e = gruppe(n.match(ENTSCHEIDER));
  if (e && !stellv) return { stufe: 'entscheider', wort: originalTreffer(text, e), feld };
  if (e && stellv) return { stufe: 'mitte', wort: text.trim().length <= 48 ? text.trim() : originalTreffer(text, e), feld };
  const m = gruppe(n.match(MITTE));
  if (m) return { stufe: 'mitte', wort: originalTreffer(text, m), feld };
  const u = gruppe(n.match(NUTZER));
  if (u) return { stufe: 'nutzer', wort: originalTreffer(text, u), feld };
  return null;
}

/** Warm = echtes Gespräch in den letzten 90 Tagen oder ein Beziehungskreis gesetzt. */
export function warmGrund(k: Pick<Kontakt, 'aktivitaeten' | 'kreis'>, heute: string): string | null {
  const letztes = (k.aktivitaeten ?? []).filter(a => echtesGespraech(a) && a.am).map(a => a.am.slice(0, 10)).filter(d => d <= heute).sort().pop();
  if (letztes && tageZwischen(letztes, heute) <= WARM_TAGE) {
    const t = tageZwischen(letztes, heute);
    return t === 0 ? 'Gespräch heute' : t === 1 ? 'Gespräch gestern' : `Gespräch vor ${t} Tagen`;
  }
  if (k.kreis) return `Kreis ${k.kreis}`;
  return null;
}

/**
 * Rolle am Deal aus Position, Jobtitel und Seniorität.
 *  - Geschäftsführung, CEO/C-Level, Inhaber, Gründer, Vorstand, Managing Partner → Entscheider;
 *    Head of / Leitung ebenfalls, wenn die Seniorität C-Level sagt.
 *  - Teamleitung, Bereichsleitung, Head of → Fürsprecher nur, wenn warm (echtes Gespräch ≤ 90 Tage
 *    oder Kreis gesetzt), sonst Nutzer.
 *  - Referent, Mitarbeiter, Entwickler, Berater, Assistenz → Nutzer.
 *  - „Bremst“ nie. Ohne verwertbaren Titel: kein Vorschlag.
 */
export function dealRolleVorschlag(k: Pick<Kontakt, 'position' | 'jobtitel' | 'senioritaet' | 'aktivitaeten' | 'kreis'>, heute: string): WahlVorschlag<DealRolle> | null {
  const treffer = [stufeAusTitel(k.position, 'Position'), stufeAusTitel(k.jobtitel, 'Jobtitel')].filter((t): t is TitelTreffer => !!t);
  const seniorN = k.senioritaet ? normiere(k.senioritaet) : '';
  const cLevel = !!seniorN && C_LEVEL.test(seniorN) && !EHEMALIG.test(seniorN);
  const beste = treffer.find(t => t.stufe === 'entscheider') ?? treffer.find(t => t.stufe === 'mitte') ?? treffer.find(t => t.stufe === 'nutzer')
    ?? (seniorN ? stufeAusTitel(k.senioritaet, 'Seniorität') : null);
  if (beste?.stufe === 'entscheider') return { id: 'entscheider', grund: `${beste.wort} laut ${beste.feld}` };
  if (beste?.stufe === 'mitte') {
    if (cLevel && beste.feld !== 'Seniorität') return { id: 'entscheider', grund: `${beste.wort} laut ${beste.feld}, Seniorität ${k.senioritaet!.trim()}` };
    const warm = warmGrund(k, heute);
    return warm ? { id: 'fuersprecher', grund: `${beste.wort} laut ${beste.feld} · ${warm}` } : { id: 'nutzer', grund: `${beste.wort} laut ${beste.feld} · noch kein warmer Draht` };
  }
  if (cLevel) return { id: 'entscheider', grund: `Seniorität ${k.senioritaet!.trim()}` };
  if (beste?.stufe === 'nutzer') return { id: 'nutzer', grund: `${beste.wort} laut ${beste.feld}` };
  return null;
}

/**
 * Wer am Deal ist wohl der Entscheider? Die erste Person ohne gesetzte Rolle,
 * für die der Vorschlag „Entscheider“ lautet — für den Sprung aus dem Hinweis
 * „Noch kein Entscheider“. Null, wenn die Daten keinen hergeben.
 */
export function besterEntscheider<K extends Pick<Kontakt, 'id' | 'position' | 'jobtitel' | 'senioritaet' | 'aktivitaeten' | 'kreis'>>(personen: readonly K[], chance: Pick<Chance, 'personenRollen'>, heute: string): { kontakt: K; vorschlag: WahlVorschlag<DealRolle> } | null {
  for (const k of personen) {
    if (chance.personenRollen?.[k.id]) continue;
    const v = dealRolleVorschlag(k, heute);
    if (v?.id === 'entscheider') return { kontakt: k, vorschlag: v };
  }
  return null;
}

/**
 * Offene Rollen-Vorschläge am Deal: je Person ohne gesetzte Rolle der
 * Vorschlag aus dealRolleVorschlag (Reihenfolge der Personen). Personen mit
 * Rolle und ohne verwertbaren Titel fehlen. Grundlage für „Vorschläge
 * übernehmen (n)“ in der Deal-Akte.
 */
export function offeneRollenVorschlaege(personen: readonly Pick<Kontakt, 'id' | 'position' | 'jobtitel' | 'senioritaet' | 'aktivitaeten' | 'kreis'>[], chance: Pick<Chance, 'personenRollen'>, heute: string): Record<string, WahlVorschlag<DealRolle>> {
  const aus: Record<string, WahlVorschlag<DealRolle>> = {};
  for (const k of personen) {
    if (chance.personenRollen?.[k.id] || aus[k.id]) continue;
    const v = dealRolleVorschlag(k, heute);
    if (v && v.id !== 'blocker') aus[k.id] = v;
  }
  return aus;
}

/**
 * Sammel-Übernahme: alle Vorschläge in EIN neues personenRollen-Objekt (ein
 * Schreibvorgang am Deal). Bestehende Rollen werden nie überschrieben,
 * „Bremst“ nie gesetzt. `gesetzt` = was neu dazukam (für Meldung und Rückgängig).
 */
export function vorschlaegeAnwenden(personenRollen: Readonly<Record<string, DealRolle>> | undefined, vorschlaege: Readonly<Record<string, WahlVorschlag<DealRolle> | null | undefined>>): { rollen: Record<string, DealRolle>; gesetzt: Record<string, DealRolle> } {
  const rollen: Record<string, DealRolle> = { ...(personenRollen ?? {}) };
  const gesetzt: Record<string, DealRolle> = {};
  for (const [pid, v] of Object.entries(vorschlaege)) {
    if (!v || v.id === 'blocker' || rollen[pid]) continue;
    rollen[pid] = v.id;
    gesetzt[pid] = v.id;
  }
  return { rollen, gesetzt };
}

/**
 * Rückgängig nach der Sammel-Übernahme: nimmt genau die übernommenen Rollen
 * wieder heraus — aber nur, wo seitdem niemand die Rolle von Hand geändert hat
 * (dann bleibt die Hand-Änderung). Alles andere bleibt, wie es jetzt ist.
 */
export function vorschlaegeZuruecknehmen(aktuell: Readonly<Record<string, DealRolle>> | undefined, gesetzt: Readonly<Record<string, DealRolle>>): Record<string, DealRolle> {
  const rollen: Record<string, DealRolle> = { ...(aktuell ?? {}) };
  for (const [pid, r] of Object.entries(gesetzt)) if (rollen[pid] === r) delete rollen[pid];
  return rollen;
}

// Typ, Kategorie und Firmen-Rolle → Rolle der Person. Deutsch und Englisch, normiert.
const ROLLE_WOERTER: { rolle: Rolle; muster: RegExp }[] = [
  { rolle: 'partner', muster: /^(partner\w*|kooperationspartner\w*|vertriebspartner\w*|channel partner)$/ },
  { rolle: 'multiplikator', muster: /^(multiplikator\w*|multiplier|influencer|botschafter\w*|ambassador)$/ },
  { rolle: 'dienstleister', muster: /^(dienstleister\w*|lieferant\w*|anbieter|service provider|vendor|supplier)$/ },
  { rolle: 'investor', muster: /^(investor\w*|investoren|business angel\w*|vc|venture capital|kapitalgeber\w*)$/ },
  { rolle: 'netzwerk', muster: /^(netzwerk\w*|network\w*)$/ },
  { rolle: 'freund', muster: /^(freunde & familie|freunde und familie|friends & family|friends and family|freund\w*|familie|friend\w*|family)$/ },
];
const rolleAusWort = (wert: string | undefined): Rolle | null => {
  if (!wert?.trim()) return null;
  const n = normiere(wert);
  return ROLLE_WOERTER.find(r => r.muster.test(n))?.rolle ?? null;
};
const FIRMA_ROLLE: Partial<Record<Firma['rolle'], Rolle>> = { partner: 'partner', dienstleister: 'dienstleister', investor: 'investor', netzwerk: 'netzwerk' };

/**
 * Rollen der Person, die die Daten nahelegen und die noch nicht gesetzt sind:
 * Typ („Partner“ → Partner), Kategorie („Freunde & Familie“ → Freund,
 * „Investor“ → Investor) und die Rolle der Firma (Partner, Dienstleister,
 * Investor, Netzwerk). Jede Rolle höchstens einmal, mit Grund.
 * „Privat“ als Typ gilt nicht als Freund — das wäre geraten.
 */
export function kontaktRollenVorschlag(k: Pick<Kontakt, 'typ' | 'kategorie' | 'rollen' | 'lebensphase'>, firma?: Pick<Firma, 'rolle'> | null): WahlVorschlag<Rolle>[] {
  const gesetzt = new Set(rollenVon(k));
  const aus: WahlVorschlag<Rolle>[] = [];
  const dazu = (r: Rolle | null | undefined, grund: string) => { if (r && !gesetzt.has(r) && !aus.some(x => x.id === r)) aus.push({ id: r, grund }); };
  dazu(rolleAusWort(k.typ), `Typ „${k.typ?.trim()}“`);
  dazu(rolleAusWort(k.kategorie), `Kategorie „${k.kategorie?.trim()}“`);
  const ausFirma = firma ? FIRMA_ROLLE[firma.rolle] : undefined;
  if (ausFirma) dazu(ausFirma, `Firma ist als ${ROLLE_LABEL[ausFirma]} geführt`);
  return aus;
}

// Anrede aus eigenen Nachrichten: nur ausgehende Texte (Mail, LinkedIn), nie Gesprächsnotizen
// (dort steht „sie“ als dritte Person). Sie-Formen nur großgeschrieben mitten im Text.
const DU_WOERTER = /(?:^|[^A-Za-zÄÖÜäöüß])(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)(?=[^A-Za-zÄÖÜäöüß]|$)/i;
const SIE_WOERTER = /(?:^|[^A-Za-zÄÖÜäöüß])(Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?=[^A-Za-zÄÖÜäöüß]|$)/;
const SIE_MITTEN = /[a-zäöüß,]\s+Sie(?=[^A-Za-zÄÖÜäöüß]|$)/;

/**
 * Du oder Sie — nur wenn eindeutig: Kategorie „Freunde & Familie“ oder Rolle
 * „Freund“ → Du; sonst die eigenen Nachrichten an die Person (Mail, LinkedIn):
 * duzen sie durchweg → Du, siezen sie durchweg → Sie. Gemischt oder nichts
 * Verwertbares: kein Vorschlag. Ist die Anrede gesetzt, gibt es keinen.
 */
export function anredeVorschlag(k: Pick<Kontakt, 'anrede' | 'kategorie' | 'rollen' | 'lebensphase' | 'aktivitaeten'>): WahlVorschlag<'Sie' | 'Du'> | null {
  if (k.anrede) return null;
  if (rolleAusWort(k.kategorie) === 'freund') return { id: 'Du', grund: `Kategorie „${k.kategorie!.trim()}“` };
  if (rollenVon(k).includes('freund')) return { id: 'Du', grund: 'Rolle „Freund“' };
  const texte = (k.aktivitaeten ?? []).filter(a => (a.art === 'mail' || a.art === 'linkedin') && a.von !== 'system' && a.text?.trim()).map(a => a.text!);
  const du = texte.filter(t => DU_WOERTER.test(t)).length;
  const sie = texte.filter(t => SIE_WOERTER.test(t) || SIE_MITTEN.test(t)).length;
  if (du && !sie) return { id: 'Du', grund: du === 1 ? 'Eure letzte Nachricht duzt' : `${du} Nachrichten duzen` };
  if (sie && !du) return { id: 'Sie', grund: sie === 1 ? 'Die letzte Nachricht siezt' : `${sie} Nachrichten siezen` };
  return null;
}
