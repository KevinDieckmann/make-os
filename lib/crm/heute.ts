// ─── CRM — Wer ist heute dran? (Sales Power Hour, rein, getestet) ──────────
// Kategorien in fester Reihenfolge — eine gebrochene Zusage kostet mehr, als
// ein neuer Kontakt bringt:
//   1 Versprechen  fällige Wiedervorlagen, nächste Schritte, Event-Nachfassen (48 h)
//   2 Signale      unbeantwortete Antwort des Kontakts
//   3 Chancen      nächster Schritt fällig oder Chance hängt
//   4 Kunden       Kündigungstermin ≤ 90 Tage, Review fällig, Health gelb/rot
//   5 Pflege       Kreis A/B, Takt überschritten (Rang = Tage seit Kontakt ÷ Takt)
//   6 Neu          Prio A/B mit Aufhänger — erst Warm-Intro, dann Vernetzen
// Harte Filter: Werbesperre, kein zulässiger Kanal, abgeschlossen, Kontakt vor
// < 3 Werktagen (außer bei unbeantworteter Antwort), fremde Zuständigkeit.
// Zu zweit (25.09.): Jede Karte gehört einer Person — der Chance, dem Mandat,
// der Kampagne, der Einladung zum Event, sonst der Person, die die Beziehung
// hält (ohne Eintrag: Sales-Verantwortung, also Kevin). So ruft nie jemand
// an, den gerade die/der andere anruft.
// Je Karte die Gründe im Klartext mit Punkten — wie die Warum-jetzt-Punkte in
// KEMARIS Operations (dealScore.ts), damit keine Zahl eine Blackbox ist.

import { ABGESCHLOSSEN, anzeigename, KREIS_TAKT, type Kontakt, type Ergebnis, type Stufe } from '@/lib/make-one/crm';
import type { CrmBestand, Chance } from './typen';
import { gesundheit, gesamtwert, OFFENE_STUFEN } from './pipeline';
import { besterKanal, kanalStatus, type KanalStatus } from './recht';
import { mandatLage } from './kunden';
import { followUpBis } from './events';
import { taktVon } from './followup';
import { haeltBeziehung, zustaendig, BEIDE } from './team';
import { hatTyp } from './mehrfach';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { personenDerFirma } from './stationen';
import { werktagePlus as kernWerktagePlus, istWerktag } from '@/lib/zeit/kalender-kern';

export type Kategorie = 'versprechen' | 'signale' | 'chancen' | 'kunden' | 'pflege' | 'neu';
export const KATEGORIEN: { id: Kategorie; label: string; warum: string }[] = [
  { id: 'versprechen', label: 'Versprechen', warum: 'Zugesagt ist zugesagt' },
  { id: 'signale', label: 'Signale', warum: 'Jemand wartet auf dich' },
  { id: 'chancen', label: 'Deals', warum: 'Bewegung halten' },
  { id: 'kunden', label: 'Kunden', warum: 'Bestand sichern' },
  { id: 'pflege', label: 'Pflege', warum: 'Beziehung halten' },
  { id: 'neu', label: 'Neu', warum: 'Pipeline füllen' },
];

export interface Karte {
  kontakt: Kontakt; name: string; kategorie: Kategorie; punkte: number; gruende: string[];
  kanal: KanalStatus | null; chance?: Chance; bezug?: string;
}

const tage = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
/** +n Werktage (Mo–Fr ohne Feiertage NRW) — Kalender-Kern (29.09., K2: vorher zählten Feiertage als Werktag). */
export const werktagePlus = (datum: string, n: number): string => (n > 0 ? kernWerktagePlus(datum, n) : datum);
function werktageSeit(von: string, bis: string): number {
  let n = 0; const d = new Date(`${von}T12:00:00Z`);
  while (d.toISOString().slice(0, 10) < bis) { d.setUTCDate(d.getUTCDate() + 1); if (istWerktag(d.toISOString().slice(0, 10))) n++; }
  return n;
}
const KREIS_GEWICHT: Record<string, number> = { A: 3, B: 2, C: 1, D: 1 };
const c2n = (t?: string) => (t ?? '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

/** Letzte Aktivität ist eine Antwort des Kontakts, auf die noch nichts kam — und sie ist höchstens 14 Tage alt. */
export function unbeantwortet(k: Kontakt, heute?: string): boolean {
  const l = (k.aktivitaeten ?? []).filter(a => a.art !== 'notiz' && a.art !== 'stufe' && a.art !== 'system').sort((a, b) => a.am.localeCompare(b.am));
  if (!l.length || l[l.length - 1].art !== 'antwort') return false;
  return !heute || tage(l[l.length - 1].am, heute) <= 14;
}

/**
 * `ohnePerson` (28.09., Ablaufprüfung): Deals/Mandate ohne Person, deren Firma auch niemanden hat, der angerufen
 * werden kann — sie fehlen hier und werden gezählt (Deals › Liste zeigt sie).
 */
export interface Auswahl { karten: Karte[]; ausgefiltert: { sperre: number; ohneKanal: number; kuerzlich: number; beiAnderen: number; ohnePerson?: number } }

/** Wem eine Karte gehört: Chance → Mandat → Kampagne → Einladung zum Event → wer die Beziehung hält. */
export function karteGehoert(c: Pick<Karte, 'kontakt' | 'chance' | 'bezug'>, crm: CrmBestand): string {
  if (c.chance) return zustaendig(c.chance.besitzer, 'sales');
  if (c.bezug) {
    const m = crm.mandate.find(x => x.id === c.bezug); if (m) return zustaendig(m.zustaendig, 'sales');
    const kp = (crm.kampagnen ?? []).find(x => x.id === c.bezug); if (kp) return zustaendig(kp.zustaendig, 'sales');
    const t = crm.teilnahmen.find(x => x.eventId === c.bezug && x.kontaktId === c.kontakt.id); if (t?.einladenDurch) return t.einladenDurch;
  }
  return haeltBeziehung(c.kontakt);
}

export function werIstDran(kontakte: Kontakt[], crm: CrmBestand, heute: string, person: string, n = 12): Auswahl {
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const chancenJe = new Map<string, Chance[]>();
  for (const c of crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe))) for (const id of c.kontaktIds) chancenJe.set(id, [...(chancenJe.get(id) ?? []), c]);
  const mandatJe = new Set(crm.mandate.filter(m => m.status === 'aktiv' || m.status === 'verhandlung').flatMap(m => m.kontaktIds));
  const kandidaten = new Map<string, Karte>();
  const aus = { sperre: 0, ohneKanal: 0, kuerzlich: 0, beiAnderen: 0, ohnePerson: 0 };
  /**
   * Die Person, über die ein Deal/Mandat angesprochen wird (28.09., Ablaufprüfung): die erste eigene — hat er keine
   * (mehr), eine laufende Person der Firma (nicht gesperrt/eingeschränkt). `ueberFirma` = der Firmenname für den Grund.
   */
  const ansprech = (ids: string[], passt: (f: CrmBestand['firmen'][number]) => boolean): { k?: Kontakt; ueberFirma?: string } => {
    const eigene = ids.map(id => nachId.get(id)).find((k): k is Kontakt => !!k);
    if (eigene) return { k: eigene };
    const f = crm.firmen.find(passt);
    if (!f) return {};
    const k = personenDerFirma(kontakte, f.id, { nurAktiv: true }).find(x => !ausgenommen(x));
    return k ? { k, ueberFirma: f.name } : {};
  };

  const nimm = (k: Kontakt | undefined, kategorie: Kategorie, punkte: number, grund: string, extra: Partial<Karte> = {}) => {
    if (!k) return;
    const alt = kandidaten.get(k.id);
    const rang = (x: Kategorie) => KATEGORIEN.findIndex(c => c.id === x);
    if (alt && rang(alt.kategorie) < rang(kategorie)) { alt.gruende.push(grund); alt.punkte += Math.round(punkte / 3); return; }
    if (alt && rang(alt.kategorie) === rang(kategorie)) { alt.gruende.push(grund); alt.punkte += punkte; return; }
    const ctx = { hatMandat: mandatJe.has(k.id), hatChance: chancenJe.has(k.id) };
    kandidaten.set(k.id, { kontakt: k, name: anzeigename(k), kategorie, punkte, gruende: [grund, ...(alt?.gruende ?? [])], kanal: besterKanal(k, ctx), ...extra });
  };

  // 1 Versprechen
  for (const k of kontakte) {
    if (k.wiedervorlage && k.wiedervorlage <= heute && !ABGESCHLOSSEN.includes(k.stufe)) {
      const d = tage(k.wiedervorlage, heute);
      nimm(k, 'versprechen', 40 + Math.min(20, d), d > 0 ? `Wiedervorlage seit ${d} Tagen überfällig` : 'Wiedervorlage heute');
    }
    // Zusagen gelten auch bei Kunden (gewonnen) — nur bei „ruht“ und „verloren“ nicht mehr.
    if (k.naechsterSchritt && k.naechsterSchritt.datum <= heute && k.stufe !== 'ruht' && k.stufe !== 'verloren') nimm(k, 'versprechen', 40 + Math.min(20, tage(k.naechsterSchritt.datum, heute)), `Zugesagt: ${k.naechsterSchritt.text}`);
  }
  for (const t of crm.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && !t.nachfassenVerzichtet)) {
    const ev = crm.events.find(e => e.id === t.eventId);
    if (!ev || ev.datum > heute) continue;
    const bis = followUpBis(ev);
    nimm(nachId.get(t.kontaktId), 'versprechen', bis >= heute ? 55 : 35, bis >= heute ? `Nachfassen nach „${ev.titel}“ bis ${bis}` : `Nachfassen nach „${ev.titel}“ überfällig`, { bezug: ev.id });
  }
  // 1b Echte Follow-ups (27.09.): die Follow-up-Ebene führt — was dort fällig ist, liegt auch hier oben (Prüfbericht, Punkt 1).
  for (const f of (crm.followups ?? []).filter(f => f.status === 'offen' && f.faellig <= heute && f.kontaktId)) {
    const d = tage(f.faellig, heute);
    nimm(nachId.get(f.kontaktId!), 'versprechen', 45 + Math.min(20, d), d > 0 ? `Follow-up „${f.text}“ seit ${d} Tagen überfällig` : `Follow-up heute: ${f.text}`, f.bezug.art === 'chance' ? { chance: crm.chancen.find(c => c.id === f.bezug.id) } : { bezug: f.bezug.id });
  }
  // 2 Signale
  for (const k of kontakte) if (unbeantwortet(k, heute)) nimm(k, 'signale', 50, (k.aktivitaeten ?? []).slice(-1)[0]?.text?.startsWith('Mail:') ? `hat geschrieben (${(k.aktivitaeten ?? []).slice(-1)[0].text!.slice(6, 70)}) — wartet auf dich` : 'hat geantwortet — wartet auf dich');
  // 3 Chancen
  for (const c of crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe))) {
    const g = gesundheit(c, heute);
    const wertPunkte = Math.round(Math.log10(gesamtwert(c) + 1) * 4);
    // Deal ohne Person (28.09.): über die Firma — sonst fiel er hier still heraus.
    const { k, ueberFirma } = ansprech(c.kontaktIds, f => dealZuFirma(c, f));
    const ueber = ueberFirma ? ` — Deal ohne Person, über ${ueberFirma}` : '';
    const faellig = !!c.naechsterSchritt && c.naechsterSchritt.datum <= heute;
    const bald = !!c.erwartetAm && tage(heute, c.erwartetAm) >= 0 && tage(heute, c.erwartetAm) <= 14;
    if (!k && (faellig || g.ampel === 'rot' || bald)) { aus.ohnePerson++; continue; }
    if (faellig) nimm(k, 'chancen', 40 + wertPunkte, `„${c.titel}“: ${c.naechsterSchritt!.text} (fällig ${c.naechsterSchritt!.datum})${ueber}`, { chance: c });
    else if (g.ampel === 'rot') nimm(k, 'chancen', 30 + wertPunkte, `„${c.titel}“ hängt: ${g.gruende[0]}${ueber}`, { chance: c });
    else if (bald) nimm(k, 'chancen', 20 - Math.round(tage(heute, c.erwartetAm!) / 14 * 20) + wertPunkte, `„${c.titel}“: Entscheidung bis ${c.erwartetAm}${ueber}`, { chance: c });
  }
  // 4 Kunden
  for (const m of crm.mandate.filter(m => m.status === 'aktiv')) {
    const l = mandatLage(m, heute);
    const { k } = ansprech(m.kontaktIds, f => mandatZuFirma(m, f));
    const faellig = (l.kuendigungIn !== null && l.kuendigungIn <= 90) || (!!m.naechstesReview && m.naechstesReview <= heute) || l.ampel === 'rot' || l.ampel === 'gelb';
    if (!k && faellig) { aus.ohnePerson++; continue; }
    if (l.kuendigungIn !== null && l.kuendigungIn < 0) nimm(k, 'kunden', 40, `${m.kunde}: Laufzeit seit ${-l.kuendigungIn} Tagen vorbei — verlängern oder abschließen`, { bezug: m.id });
    else if (l.kuendigungIn !== null && l.kuendigungIn <= 90) nimm(k, 'kunden', 45, `${m.kunde}: Laufzeit endet in ${l.kuendigungIn} Tagen — Verlängerung ansprechen`, { bezug: m.id });
    else if (m.naechstesReview && m.naechstesReview <= heute) nimm(k, 'kunden', 35, `${m.kunde}: Review fällig`, { bezug: m.id });
    else if (l.ampel === 'rot' || l.ampel === 'gelb') nimm(k, 'kunden', l.ampel === 'rot' ? 35 : 20, `${m.kunde}: Health ${l.ampel}`, { bezug: m.id });
  }
  // 5 Pflege
  for (const k of kontakte) {
    if (k.kreis !== 'A' && k.kreis !== 'B' && k.lebensphase !== 'multiplikator') continue;
    // Takt aus den Stammdaten (Wertelisten), wie in der Follow-up-Ebene (Prüfbericht 27.09., Punkt 8).
    const takt = taktVon(k, crm.wertelisten) ?? KREIS_TAKT[k.kreis ?? 'B'];
    const seit = k.letzterKontakt ? tage(k.letzterKontakt, heute) : null;
    if (seit === null || seit >= takt) nimm(k, 'pflege', Math.round((seit === null ? 2 : seit / takt) * 10 * (KREIS_GEWICHT[k.kreis ?? 'B'])), seit === null ? `Kreis ${k.kreis ?? '–'}: noch kein Kontakt vermerkt` : `Kreis ${k.kreis ?? '–'}: ${seit} Tage still (Takt ${takt})`);
  }
  // 5b Aktive Kampagnen: wer noch nicht angesprochen ist, kommt als „Neu“ mit Kampagnen-Bezug.
  for (const kp of (crm.kampagnen ?? []).filter(x => x.status === 'aktiv')) {
    const erledigt = new Set(kp.ergebnisse.map(e => e.kontaktId));
    for (const id of kp.kontaktIds.filter(i => !erledigt.has(i)).slice(0, 10)) nimm(nachId.get(id), 'neu', 24, `Kampagne „${kp.name}“: noch nicht angesprochen`, { bezug: kp.id });
  }
  // 6 Neu (die bisherige Tagesliste, jetzt mit Kanal-Ampel)
  const PRIO: Record<string, number> = { A: 20, B: 10 };
  for (const k of kontakte) {
    if ((k.stufe !== 'neu' && k.stufe !== 'ansprechen') || !(k.prio === 'A' || k.prio === 'B') || !(k.aufhaenger ?? '').trim()) continue;
    if (hatTyp(k, 'Dienstleister') || hatTyp(k, 'Investor')) continue;
    const intro = k.vorgestelltDurch ? ' · Warm-Intro möglich' : '';
    nimm(k, 'neu', PRIO[k.prio] + (k.eignung === 'ja' ? 5 : 0) + (k.vorgestelltDurch ? 10 : 0), `Prio ${k.prio}${k.eignung ? ` · Eignung ${k.eignung}` : ''}${intro}`);
  }

  // Harte Filter — und jede Person nur einmal (die Masterdatei kennt Dubletten).
  const karten: Karte[] = [];
  const gesehen = new Set<string>();
  for (const c of Array.from(kandidaten.values())) {
    const k = c.kontakt;
    if (ausgenommen(k)) { aus.sperre++; continue; }
    const wem = karteGehoert(c, crm);
    if (wem !== person && wem !== BEIDE) { aus.beiAnderen++; continue; }
    if (!c.kanal) { aus.ohneKanal++; continue; }
    const kuerzlich = k.letzterKontakt && werktageSeit(k.letzterKontakt, heute) < 3;
    if (kuerzlich && c.kategorie !== 'signale' && c.kategorie !== 'versprechen') { aus.kuerzlich++; continue; }
    // Neu nur mit einem Weg, der kein Kaltkontakt ist: Vernetzen oder Warm-Intro.
    if (c.kategorie === 'neu' && c.kanal.farbe === 'rot') { aus.ohneKanal++; continue; }
    karten.push(c);
  }
  const rang = (x: Kategorie) => KATEGORIEN.findIndex(c => c.id === x);
  karten.sort((a, b) => rang(a.kategorie) - rang(b.kategorie) || b.punkte - a.punkte);
  // Doppelte Person: die Karte mit der höheren Kategorie bleibt.
  const eindeutig = karten.filter(c => { const key = `${c2n(c.name)}|${c2n(c.kontakt.firma)}`; if (gesehen.has(key)) return false; gesehen.add(key); return true; });
  karten.splice(0, karten.length, ...eindeutig);

  // Umfang: höchstens n, davon mind. 3 aus Pflege+Neu (Law of Replacement), höchstens 4 Neu.
  const neu = karten.filter(k => k.kategorie === 'neu').slice(0, 4);
  const pflege = karten.filter(k => k.kategorie === 'pflege');
  const rest = karten.filter(k => k.kategorie !== 'neu' && k.kategorie !== 'pflege');
  const reserve = [...pflege, ...neu].slice(0, 3);
  const vorn = rest.slice(0, Math.max(0, n - reserve.length));
  const ergebnis = [...vorn, ...reserve];
  for (const k of [...pflege, ...neu]) { if (ergebnis.length >= n) break; if (!ergebnis.includes(k)) ergebnis.push(k); }
  ergebnis.sort((a, b) => rang(a.kategorie) - rang(b.kategorie) || b.punkte - a.punkte);
  return { karten: ergebnis.slice(0, n), ausgefiltert: aus };
}

/** Was ein Ergebnis-Knopf nach sich zieht (Regel, kein Modell). */
export function folgeAus(ergebnis: Ergebnis, heute: string, stufe: Stufe): { wiedervorlage?: string; stufe?: Stufe; werbesperre?: boolean; hinweis: string } {
  switch (ergebnis) {
    case 'nicht_erreicht': return { wiedervorlage: werktagePlus(heute, 2), hinweis: 'In 2 Werktagen nochmal — anderer Zeitslot.' };
    case 'mailbox': return { wiedervorlage: werktagePlus(heute, 3), hinweis: 'In 3 Werktagen nochmal.' };
    case 'rueckruf': return { wiedervorlage: werktagePlus(heute, 1), hinweis: 'Rückruf vereinbart — Datum anpassen, wenn genannt.' };
    case 'gespraech': return { stufe: ['neu', 'ansprechen', 'angesprochen'].includes(stufe) ? 'gespraech' : undefined, wiedervorlage: werktagePlus(heute, 5), hinweis: 'Gespräch geführt — Notiz und nächsten Schritt festhalten.' };
    case 'termin': return { stufe: 'termin', hinweis: 'Termin steht — Vorbereitung als Aufgabe.' };
    case 'kein_bedarf': return { stufe: 'ruht', wiedervorlage: undefined, hinweis: 'Kein Bedarf — ruht. In einem halben Jahr neu prüfen, wenn es passt.' };
    case 'sperre': return { werbesperre: true, stufe: 'ruht', hinweis: 'Werbesperre gesetzt — die Person taucht nirgends mehr auf.' };
  }
}

export { kanalStatus };
