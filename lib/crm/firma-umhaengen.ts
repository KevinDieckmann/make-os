// ─── Firma wechseln und Firmen zusammenführen — was mit Lead, Deals und Personen passiert (rein, 03.10.) ─────────
// Kevin (Qualifizierung): „Wenn wir in der Qualifizierung sind, kann immer alles irgendwie anders kommen als man denkt.
// Wir brauchen saubere Möglichkeiten, in den Kontakt zu gehen und dort alles anzupassen oder in die Firma zu gehen.“
// Zwei Fälle, beide hier als reine Rechnung (die Vorschau im Dialog und das Schreiben rechnen DASSELBE):
//
//  1. FOLGEN eines Firmenwechsels der Person (die Station selbst ändert die Kartei-Route mit `firmaWechsel`):
//       Lead      der Lead hängt an der Firma (oder, ohne Firma, an der Person). „Mitnehmen“ legt ihn an die neue Firma —
//                 die neue gewinnt, wo beide etwas wissen; die alte Firma gibt ihn ab, wenn dort niemand mehr aktiv ist,
//                 sonst behält sie ihre Kopie.
//       Deals     offene Deals ziehen mit, wenn NUR die gewechselte(n) Person(en) daran hängen; ein Deal mit weiteren
//                 Personen bleibt bei der alten Firma (und wird im Dialog genannt) — nie ein Deal ohne seine Leute.
//       Verlauf   bleibt an der Person (Stationen, Aktivitäten) — dort zeigt die Firmenkarte „ehemalig“.
//  2. FIRMEN ZUSAMMENFÜHREN (Dublette): Personen, Deals, Mandate, Angebote, Events, Follow-ups, Mutter/Tochter und der Lead
//     wandern zur behaltenen Firma; ihre leeren Felder füllt die andere; die andere Firma entfällt.
//
// Reihenfolge der Schreibschritte (Server, firma-umhaengen-server.ts) macht jeden Abbruch folgenlos: zuerst die Seite,
// bei der die Zwischenstände gültig bleiben. Alles hier ist idempotent — ein zweiter Lauf ändert nichts mehr.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Lead } from './typen';
import { OFFENE_STUFEN } from './pipeline';
import { personenJeFirma, stationenVon, stationenVereinen, stationenFelder, type Station } from './stationen';
import { leadSaeubern } from './lead-form';
import { tagVon } from '@/lib/zeit';

export interface FolgenEingabe {
  /** Die Personen, die gewechselt haben (Kennungen). */
  personIds: string[];
  /** Die bisherige Firma (Kennung) — fehlt, wenn die Person vorher keine hatte (dann kommt der Lead von der Person selbst). */
  von?: string;
  /** Die neue Firma (Kennung) — muss in `crm.firmen` stehen. */
  nach: string;
  leadMit: boolean;
  dealsMit: boolean;
}

export interface FolgenPlan {
  /** Was mit dem Lead geschieht: verschoben (alte Firma gibt ihn ab), kopiert (alte behält ihn, weil dort noch jemand aktiv ist), nichts. */
  lead: 'verschoben' | 'kopiert' | 'keiner';
  /** Woher der Lead kommt. */
  leadVon: 'firma' | 'person' | null;
  /** Die neue Firma hatte schon einen Lead (die neue gewinnt, Lücken füllt der mitgebrachte). */
  zielHatteLead: boolean;
  dealsMit: { id: string; titel: string }[];
  dealsBleiben: { id: string; titel: string; grund: string }[];
  /** Wer in der alten Firma noch aktiv ist (Anzahl) — null ohne alte Firma. */
  alteFirmaPersonen: number | null;
}

const gleichePerson = (a: readonly string[], b: ReadonlySet<string>) => a.length > 0 && a.every(id => b.has(id));

/** Lead zweier Quellen vereinen: `ziel` gewinnt, Lücken füllt `quelle` (Kernfragen „unklar“ → bekannt, Stufen, Antworten). */
export function leadVereinen(ziel: Lead | undefined, quelle: Lead | undefined): Lead | undefined {
  if (!ziel || !quelle) return ziel ?? quelle;
  const kriterien = { ...ziel.kriterien };
  for (const [f, v] of Object.entries(quelle.kriterien ?? {}) as [keyof Lead['kriterien'], Lead['kriterien'][keyof Lead['kriterien']]][]) if (kriterien[f] === undefined || (kriterien[f] === 'unklar' && v !== 'unklar')) kriterien[f] = v;
  const fuelle = <T extends object>(a: T | undefined, b: T | undefined): T | undefined => (a || b ? ({ ...(b ?? {}), ...(a ?? {}) } as T) : undefined);
  const antworten = fuelle(ziel.antworten, quelle.antworten), stufen = fuelle(ziel.stufen, quelle.stufen);
  return {
    ...quelle, ...ziel, kriterien,
    ...(antworten ? { antworten } : {}), ...(stufen ? { stufen } : {}),
    ...(ziel.fit === undefined && quelle.fit !== undefined ? { fit: quelle.fit } : {}),
    notiz: [ziel.notiz, quelle.notiz && !(ziel.notiz ?? '').includes(quelle.notiz) ? quelle.notiz : undefined].filter(Boolean).join('\n') || undefined,
  } as Lead;
}

function leadQuelle(crm: Pick<CrmBestand, 'firmen'>, kontakte: readonly Kontakt[], e: FolgenEingabe): { lead: Lead; von: 'firma' | 'person' } | null {
  const ids = new Set(e.personIds);
  const aus = e.von ? crm.firmen.find(f => f.id === e.von)?.lead : undefined;
  if (aus) return { lead: aus, von: 'firma' };
  const person = kontakte.find(k => ids.has(k.id) && k.lead);
  return person?.lead ? { lead: person.lead, von: 'person' } : null;
}

/** Die Vorschau: was der Wechsel für Lead und Deals bedeutet — dieselbe Rechnung schreibt später. */
export function firmaFolgenPlan(crm: Pick<CrmBestand, 'firmen' | 'chancen'>, kontakte: readonly Kontakt[], e: FolgenEingabe): FolgenPlan {
  const ids = new Set(e.personIds);
  const ziel = crm.firmen.find(f => f.id === e.nach);
  // Wer in der alten Firma noch aktiv ist — wer gewechselt hat (Jobwechsel, Korrektur), steht dort nicht mehr; bei „zusätzlich“ schon.
  const rest = e.von ? (personenJeFirma(kontakte, { nurAktiv: true }).get(e.von) ?? []).length : null;
  const q = e.leadMit && ziel ? leadQuelle(crm, kontakte, e) : null;
  const lead: FolgenPlan['lead'] = !q ? 'keiner' : q.von === 'firma' && (rest ?? 0) > 0 ? 'kopiert' : 'verschoben';
  const dealsMit: FolgenPlan['dealsMit'] = [], dealsBleiben: FolgenPlan['dealsBleiben'] = [];
  if (e.dealsMit) {
    for (const c of crm.chancen) {
      if (!OFFENE_STUFEN.includes(c.stufe)) continue;
      // Nur Deals der gewechselten Person(en): am alten Firmen-Deal (oder, ohne alte Firma, an der Person) hängt mindestens eine von ihnen.
      const geh = c.firmaId === e.nach ? false : e.von ? c.firmaId === e.von && c.kontaktIds.some(id => ids.has(id)) : !c.firmaId && c.kontaktIds.some(id => ids.has(id));
      if (!geh) continue;
      if (gleichePerson(c.kontaktIds, ids)) dealsMit.push({ id: c.id, titel: c.titel });
      else dealsBleiben.push({ id: c.id, titel: c.titel, grund: 'weitere Personen hängen am Deal' });
    }
  }
  return { lead, leadVon: q?.von ?? null, zielHatteLead: !!ziel?.lead, dealsMit, dealsBleiben, alteFirmaPersonen: rest };
}

/** CRM-Seite des Wechsels: Lead an die neue Firma, offene Deals mit. Idempotent. */
export function firmaFolgenCrm(crm: CrmBestand, kontakte: readonly Kontakt[], e: FolgenEingabe, jetzt: string, person: string): CrmBestand {
  const ziel = crm.firmen.find(f => f.id === e.nach);
  if (!ziel) return crm;
  const plan = firmaFolgenPlan(crm, kontakte, e);
  const bewegt = new Set(plan.dealsMit.map(d => d.id));
  let firmen = crm.firmen;
  const q = e.leadMit ? leadQuelle(crm, kontakte, e) : null;
  if (q && plan.lead !== 'keiner') {
    const vereint = leadVereinen(ziel.lead, q.lead);
    const neuesLead = vereint ? leadSaeubern({ ...vereint, geaendert: jetzt, geaendertVon: person }) : undefined;
    firmen = firmen.map(f => {
      if (f.id === e.nach) return neuesLead ? { ...f, lead: neuesLead, geaendert: jetzt, geaendertVon: person } : f;
      // Die alte Firma gibt ihren Lead ab, wenn dort niemand mehr aktiv ist (am Zustand gemessen, nicht am Plan — so bleibt ein zweiter Lauf folgenlos).
      if (plan.lead === 'verschoben' && f.id === e.von && e.von !== e.nach && q.von === 'firma' && f.lead) { const { lead: _l, ...rest } = f; return { ...rest, geaendert: jetzt, geaendertVon: person } as Firma; }
      return f;
    });
  }
  const chancen = bewegt.size ? crm.chancen.map(c => (bewegt.has(c.id) ? { ...c, firmaId: ziel.id, firma: ziel.name, geaendert: jetzt, geaendertVon: person } : c)) : crm.chancen;
  return firmen === crm.firmen && chancen === crm.chancen ? crm : { ...crm, firmen, chancen };
}

/** Kartei-Seite des Wechsels: der Lead einer Person, der jetzt an der Firma hängt, verschwindet von der Person (er stünde sonst doppelt). */
export function firmaFolgenKartei(crm: Pick<CrmBestand, 'firmen'>, kontakte: Kontakt[], e: FolgenEingabe, jetzt: string): Kontakt[] {
  if (!e.leadMit || !crm.firmen.find(f => f.id === e.nach)?.lead) return kontakte;
  const ids = new Set(e.personIds);
  let geaendert = false;
  const neu = kontakte.map(k => {
    if (!ids.has(k.id) || !k.lead) return k;
    geaendert = true;
    const { lead: _l, ...rest } = k;
    return { ...rest, geaendertAm: tagVon(jetzt) } as Kontakt;
  });
  return geaendert ? neu : kontakte;
}

// ── Firmen zusammenführen ────────────────────────────────────────────────────

const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Eine Firmen-Kennung in einem ganzen Wert ersetzen — überall (Deals, Mandate, Angebote, Follow-ups, Mutter/Tochter …), als ganzes Wort. */
export function firmenIdErsetzen<T>(wert: T, von: string, nach: string): { wert: T; n: number } {
  const text = JSON.stringify(wert ?? null);
  const re = new RegExp(`(?<![A-Za-z0-9_-])${ESC(von)}(?![A-Za-z0-9_-])`, 'g');
  let n = 0;
  const neu = text.replace(re, () => { n++; return nach; });
  return n ? { wert: JSON.parse(neu) as T, n } : { wert, n: 0 };
}

/** Geht das Zusammenführen? Nennt den Grund, wenn nicht. */
export function firmaZusammenPruefen(firmen: readonly Firma[], behalten: string, weg: string): string | null {
  if (!behalten || !weg || behalten === weg) return 'Zwei verschiedene Firmen wählen.';
  const a = firmen.find(f => f.id === behalten), b = firmen.find(f => f.id === weg);
  if (!a || !b) return 'Eine der beiden Firmen gibt es nicht mehr.';
  // Wer die Tochter der anderen ist, wird nicht in sie hineingeführt (die Konzernstruktur ginge verloren).
  if (a.mutterId === b.id || b.mutterId === a.id) return 'Mutter und Tochter lassen sich nicht zusammenführen — erst die Konzernverbindung lösen.';
  return null;
}

/** Felder, deren abweichender Wert der weggeführten Firma im Vermerk der behaltenen steht (sie gewinnt, aber nichts verschwindet spurlos). */
const VERMERK_FELDER: [keyof Firma, string][] = [['domain', 'Domain'], ['webseite', 'Webseite'], ['stadt', 'Ort'], ['branche', 'Branche'], ['mitarbeiter', 'Mitarbeitende'], ['umsatz', 'Umsatz'], ['telefon', 'Telefon'], ['email', 'E-Mail'], ['linkedin', 'LinkedIn']];
const tagDE = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Die Felder der weggeführten Firma, die die behaltene bekommt — nur leere Lücken, nie ein Überschreiben; Abweichendes steht im Vermerk. */
export function firmaMerge(behalten: Firma, weg: Firma, jetzt: string, person: string): Firma {
  const out = { ...behalten } as unknown as Record<string, unknown>;
  const w = weg as unknown as Record<string, unknown>;
  const leer = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  for (const f of Object.keys(w)) {
    if (['id', 'name', 'lead', 'geaendert', 'geaendertVon', 'rolle', 'mutterId', 'rolleVonHand', 'branchen', 'branche'].includes(f)) continue;
    if (leer(out[f]) && !leer(w[f])) out[f] = w[f];
  }
  if (!behalten.rolleVonHand && behalten.rolle === 'offen' && weg.rolle !== 'offen') { out.rolle = weg.rolle; if (weg.rolleVonHand) out.rolleVonHand = true; }
  else if (!behalten.rolleVonHand && weg.rolleVonHand) { out.rolle = weg.rolle; out.rolleVonHand = true; }
  const branchen = Array.from(new Set([...(behalten.branchen ?? []), ...(weg.branchen ?? [])]));
  if (branchen.length) { out.branchen = branchen; out.branche = branchen.join(' · '); } else if (leer(behalten.branche) && weg.branche) out.branche = weg.branche;
  if (!behalten.mutterId && weg.mutterId && weg.mutterId !== behalten.id) out.mutterId = weg.mutterId;
  const lead = leadVereinen(behalten.lead, weg.lead);
  if (lead) out.lead = lead;
  if (weg.notiz && behalten.notiz && weg.notiz !== behalten.notiz) out.notiz = `${behalten.notiz}\n${weg.notiz}`;
  // Vermerk: wann, aus welcher Firma — und was dort anders stand (nur beim Schreiben, nicht in der Vorschau).
  if (jetzt) {
    const abweichend = VERMERK_FELDER.filter(([f]) => !leer(w[f]) && !leer((behalten as unknown as Record<string, unknown>)[f]) && String(w[f]).trim().toLowerCase() !== String((behalten as unknown as Record<string, unknown>)[f]).trim().toLowerCase()).map(([f, l]) => `${l} ${String(w[f]).trim()}`);
    const vermerk = `Zusammengeführt am ${tagDE(jetzt)} aus „${weg.name}“${abweichend.length ? ` — dort stand anders: ${abweichend.join('; ')}` : ''}.`;
    const mit = [String(out.notiz ?? '').trim(), vermerk].filter(Boolean).join('\n');
    // Nie abschneiden: passt der Vermerk nicht mehr in die Notiz (3.000 Zeichen), bleibt die Notiz, wie sie ist.
    if (mit.length <= 3000 && !String(out.notiz ?? '').includes(vermerk)) out.notiz = mit;
  }
  return { ...(out as unknown as Firma), geaendert: jetzt || behalten.geaendert, ...(person ? { geaendertVon: person } : {}) };
}

export interface ZusammenVorschau {
  personen: number; ehemalig: number; dealsOffen: number; dealsGesamt: number; mandate: number; angebote: number; events: number; followups: number;
  /** Beide haben einen Lead (der der behaltenen gewinnt) bzw. nur die weggeführte. */
  lead: 'beide' | 'nur-weg' | 'keiner';
  /** Felder, die die behaltene Firma neu bekommt. */
  neueFelder: string[];
}

export function firmaZusammenVorschau(crm: CrmBestand, kontakte: readonly Kontakt[], behalten: string, weg: string): ZusammenVorschau | null {
  const a = crm.firmen.find(f => f.id === behalten), b = crm.firmen.find(f => f.id === weg);
  if (!a || !b) return null;
  const aktiv = personenJeFirma(kontakte, { nurAktiv: true }).get(weg) ?? [];
  const alle = personenJeFirma(kontakte, { nurAktiv: false }).get(weg) ?? [];
  const mitWeg = <T extends { firmaId?: string }>(l: readonly T[]) => l.filter(x => x.firmaId === weg).length;
  const merged = firmaMerge(a, b, '', '') as unknown as Record<string, unknown>;
  const alt = a as unknown as Record<string, unknown>;
  const neueFelder = Object.keys(merged).filter(f => !['geaendert', 'geaendertVon'].includes(f) && JSON.stringify(merged[f]) !== JSON.stringify(alt[f]));
  const events = (crm.events ?? []).filter(e => JSON.stringify(e.fuer ?? null).includes(weg)).length;
  const dealsMit = crm.chancen.filter(c => c.firmaId === weg);
  return {
    personen: aktiv.length, ehemalig: alle.length - aktiv.length, dealsOffen: dealsMit.filter(c => OFFENE_STUFEN.includes(c.stufe)).length, dealsGesamt: dealsMit.length,
    mandate: mitWeg(crm.mandate), angebote: mitWeg((crm.angebote ?? []) as { firmaId?: string }[]), events, followups: (crm.followups ?? []).filter(f => f.bezug.art === 'firma' && f.bezug.id === weg).length,
    lead: a.lead && b.lead ? 'beide' : b.lead ? 'nur-weg' : 'keiner', neueFelder,
  };
}

/** Kartei-Seite: Stationen bei `weg` werden Stationen bei `behalten` (doppelte laufende zusammengelegt). Idempotent. */
export function firmaZusammenKartei(kontakte: Kontakt[], behalten: Firma, weg: string, heute: string): Kontakt[] {
  let geaendert = false;
  const neu = kontakte.map(k => {
    const st = stationenVon(k);
    if (!st.some(s => s.firmaId === weg)) return k;
    geaendert = true;
    const andere: Station[] = st.filter(s => s.firmaId !== weg);
    const gewandert: Station[] = st.filter(s => s.firmaId === weg).map(s => ({ ...s, firmaId: behalten.id }));
    const liste = stationenVereinen({ stationen: andere }, { stationen: gewandert }) ?? [...andere, ...gewandert];
    return { ...k, ...stationenFelder(k, liste, heute, id => (id === behalten.id ? behalten.name : undefined)), geaendertAm: heute } as Kontakt;
  });
  return geaendert ? neu : kontakte;
}

/** CRM-Seite: alle Verweise auf `weg` zur behaltenen Firma, Lücken füllen, `weg` entfernen. Idempotent (fehlt `weg`, passiert nichts). */
export function firmaZusammenCrm(crm: CrmBestand, behalten: string, weg: string, jetzt: string, person: string): CrmBestand {
  const a = crm.firmen.find(f => f.id === behalten), b = crm.firmen.find(f => f.id === weg);
  if (!a || !b) return crm;
  const { firmen: _f, ...ohneFirmen } = crm;
  // Verweise überall umbiegen (Listen ohne die Firmenliste selbst); die Namen am Deal folgen der behaltenen Firma.
  const umgebogen = firmenIdErsetzen(ohneFirmen, weg, behalten).wert as Omit<CrmBestand, 'firmen'>;
  const chancen = umgebogen.chancen.map(c => (c.firmaId === behalten && (c.firma ?? '') === b.name ? { ...c, firma: a.name } as Chance : c));
  const firmen = crm.firmen.filter(f => f.id !== weg).map(f => {
    if (f.id === behalten) return firmaMerge(a, b, jetzt, person);
    return f.mutterId === weg ? { ...f, mutterId: behalten } : f;
  });
  return { ...(umgebogen as CrmBestand), chancen, firmen };
}
