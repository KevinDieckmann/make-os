// ─── Unternehmen › Schild: Compliance-Ampel, Lage, Fristen und Erinnerungen (rein, client-sicher, 10.10.) ─────────────
// EINE Rechnung für alles, was der Bereich über eine Gesellschaft SAGT: Ampel je Teil (Dokumente · Pflichten · Risiken · Schutz) mit
// „was fehlt“ + Weg zum Beheben, die Ampel gesamt, die Stichtage für den Kalender (`fristen` → lib/kalender/eintraege.ts) und die fälligen
// Erinnerungen (Aufgabe mit fester Kennung + Glocke, Muster `vertragsErinnerungen`). Der Server (lib/gesellschaften/schild-server.ts) lädt
// nur und reicht weiter; der Head of Recht liest dieselbe Lage (`lageAus`). Hinweis, keine Rechtsberatung.

import { aktiveEintraege, alleGesellschaften, anzeigeName, type RegisterDatei, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { imPapierkorb } from '@/lib/eintraege/sicher';
import { bereichVon, istRegisterKennung, type GesellschaftId } from '@/lib/einheiten';
import { WEG } from '@/lib/wege';
import { REGEL_STAND, SCHILD_HINWEIS, type SchildDatei, type SchildGesellschaft } from './typen';
import { kontextVon, type SchildKontext } from './kontext';
import { dokumenteSoll, dokSchwere, ABLAUF_VORLAUF_TAGE, DOK_ZUSTAND_TEXT, type DokSoll } from './dokumente';
import { pflichtenFuer, pflichtSchwere, schwellenFuer, type PflichtEintrag, type SchwelleZeile } from './pflichten';
import { risikoZeilen, rundeFaellig, neuBewertenAnlaesse, aggregation, type RisikoZeile, type Anlass } from './risiken';
import { markeFristen, domainZustand, policeFristen, schutzStichtage, type SchutzStichtag } from './schutz';
import { tagePlus, tagText } from './zeit';

export type Ampel = 'rot' | 'gelb' | 'gruen';
export const AMPEL_TEXT: Record<Ampel, string> = { rot: 'handeln', gelb: 'prüfen', gruen: 'im Lot' };
export type SchildReiter = 'ueberblick' | 'gesellschaften' | 'pflichten' | 'dokumente' | 'risiken' | 'struktur' | 'schutz' | 'vertraege' | 'beschluesse';

export interface Punkt { text: string; weg: string; schwere: 'rot' | 'gelb' }
export interface Teil { ampel: Ampel; punkte: Punkt[]; zahlen: Record<string, number> }
export interface Compliance { ampel: Ampel; teile: { dokumente: Teil; pflichten: Teil; risiken: Teil; schutz: Teil } }

const schlimmer = (a: Ampel, b: Ampel): Ampel => (a === 'rot' || b === 'rot' ? 'rot' : a === 'gelb' || b === 'gelb' ? 'gelb' : 'gruen');
const ampelAus = (p: readonly Punkt[]): Ampel => (p.some(x => x.schwere === 'rot') ? 'rot' : p.length ? 'gelb' : 'gruen');
const weg = (r: SchildReiter, id: string) => WEG.schild(r, id);

/** Die Gesellschaften, die das Schild führt: Business (`bereichVon`), nicht im Papierkorb. Register-Gesellschaften sind immer Business. */
export function schildGesellschaften(register: RegisterDatei | null | undefined): RegisterGesellschaft[] {
  return alleGesellschaften(register).filter(g => !imPapierkorb(g) && (istRegisterKennung(g.id) || bereichVon(g.id) === 'business'));
}
export const eintragVon = (d: SchildDatei | null | undefined, id: string): SchildGesellschaft | undefined => (d?.gesellschaften ?? []).find(x => x.id === id);

export interface GesellschaftLage {
  id: GesellschaftId;
  name: string;
  kontext: SchildKontext;
  compliance: Compliance;
  dokumente: DokSoll[];
  pflichten: PflichtEintrag[];
  schwellen: SchwelleZeile[];
  risiken: RisikoZeile[];
  anlaesse: Anlass[];
  runde: ReturnType<typeof rundeFaellig>;
  aggregation: ReturnType<typeof aggregation>;
  schutz: SchutzStichtag[];
}

/** Alles über eine Gesellschaft (rein). */
export function gesellschaftLage(g: RegisterGesellschaft, s: SchildGesellschaft | null | undefined, heute: string): GesellschaftLage {
  const k = kontextVon(g, s);
  const dokumente = dokumenteSoll(g, s, k, heute);
  const pflichten = pflichtenFuer(k, s, heute);
  const schwellen = schwellenFuer(k, s);
  const risiken = risikoZeilen(s, heute);
  const anlaesse = neuBewertenAnlaesse(g, s, k, heute);
  const runde = rundeFaellig(s, heute);
  const agg = aggregation(s, heute);
  const schutz = schutzStichtage(s, heute);
  const id = g.id;

  // Dokumente
  const dp: Punkt[] = [];
  for (const d of dokumente) {
    const sw = dokSchwere(d);
    if (sw !== 'ok') dp.push({ text: `${d.katalog.titel}: ${DOK_ZUSTAND_TEXT[d.zustand]}${d.stufe === 'pflicht' ? ' (Pflicht)' : ''}`, weg: weg('dokumente', id), schwere: sw });
  }
  // Pflichten
  const pp: Punkt[] = [];
  for (const p of pflichten) {
    const sw = pflichtSchwere(p);
    if (sw !== 'ok') pp.push({ text: `${p.titel} (${p.periodeLabel}) — ${p.status === 'ueberfaellig' ? 'überfällig seit' : 'fällig bis'} ${tagText(p.frist)}`, weg: weg('pflichten', id), schwere: sw });
  }
  if (!k.rechtsform) pp.push({ text: 'Rechtsform fehlt im Steckbrief — ohne sie lassen sich Pflichten und Soll-Dokumente nicht rechnen.', weg: WEG.unternehmen(id), schwere: 'gelb' });
  for (const z of schwellen) if (z.stand === 'erreicht' && !z.umgesetzt) pp.push({ text: `Schwelle erreicht: ${z.def.titel} — ${z.def.pflicht}`, weg: weg('pflichten', id), schwere: 'gelb' });
  if (schwellen.some(z => z.stand === 'unbekannt') && k.aktiv) pp.push({ text: 'Profil unvollständig (Beschäftigte, Umsatz, Bilanzsumme) — die Schwellen-Wächter können nicht prüfen.', weg: weg('pflichten', id), schwere: 'gelb' });
  // Risiken
  const rp: Punkt[] = [];
  if (!risiken.length) rp.push({ text: 'Noch kein Risiko erfasst — Startkatalog übernehmen und bewerten.', weg: weg('risiken', id), schwere: 'gelb' });
  for (const r of risiken) {
    if (r.r.status === 'erledigt') continue;
    if (!r.bewertung) rp.push({ text: `${r.r.titel}: noch nicht bewertet`, weg: weg('risiken', id), schwere: 'gelb' });
    else if (r.ampel === 'rot' && r.ohneMassnahme) rp.push({ text: `${r.r.titel}: rot ohne offene Maßnahme`, weg: weg('risiken', id), schwere: 'rot' });
    else if (r.ampel === 'rot' && r.r.behandlung === 'tragen') rp.push({ text: `${r.r.titel}: rot und bewusst getragen — Beschluss dazu ablegen`, weg: weg('risiken', id), schwere: 'gelb' });
  }
  if (runde.faellig) rp.push({ text: `Quartals-Runde fällig: ${runde.anzahl} Risiko${runde.anzahl === 1 ? '' : 's'} neu bewerten`, weg: weg('risiken', id), schwere: 'gelb' });
  for (const a of anlaesse.slice(0, 5)) rp.push({ text: `Neu bewerten — ${a.text}`, weg: weg('risiken', id), schwere: 'gelb' });
  if (agg.warnung) rp.push({ text: `Zusammen übersteigen die Risiken die Tragfähigkeit (${agg.anteil} %).`, weg: weg('risiken', id), schwere: 'rot' });
  // Schutz: Marken, Domains, Versicherungen
  const sp: Punkt[] = [];
  for (const m of aktiveEintraege(s?.marken)) {
    const f = markeFristen(m, heute);
    if (f.zustand === 'abgelaufen' || f.zustand === 'nachfrist') sp.push({ text: `Marke „${m.bezeichnung}“: ${f.zustand === 'abgelaufen' ? 'Schutz abgelaufen' : `Nachfrist bis ${tagText(f.nachfristBis)}`}`, weg: weg('schutz', id), schwere: 'rot' });
    else if (f.zustand === 'verlaengern') sp.push({ text: `Marke „${m.bezeichnung}“: jetzt verlängern (Schutz endet ${tagText(f.schutzEnde)})`, weg: weg('schutz', id), schwere: 'gelb' });
    else if (f.zustand === 'unbekannt') sp.push({ text: `Marke „${m.bezeichnung}“: Anmeldetag fehlt`, weg: weg('schutz', id), schwere: 'gelb' });
    if (m.inhaberIstGesellschaft === false) sp.push({ text: `Marke „${m.bezeichnung}“: Inhaber ist nicht die Gesellschaft`, weg: weg('schutz', id), schwere: 'gelb' });
  }
  for (const d of aktiveEintraege(s?.domains)) {
    const z = domainZustand(d, heute);
    if (z === 'abgelaufen') sp.push({ text: `Domain ${d.domain}: abgelaufen`, weg: weg('schutz', id), schwere: 'rot' });
    else if (z === 'bald') sp.push({ text: `Domain ${d.domain}: läuft am ${tagText(d.laeuftBis)} ab`, weg: weg('schutz', id), schwere: 'gelb' });
    if (d.inhaberIstGesellschaft === false) sp.push({ text: `Domain ${d.domain}: Inhaber ist nicht die Gesellschaft`, weg: weg('schutz', id), schwere: 'gelb' });
    if (d.zweiFaktor === false) sp.push({ text: `Domain ${d.domain}: ohne zweiten Faktor beim Registrar`, weg: weg('schutz', id), schwere: 'gelb' });
  }
  const policen = aktiveEintraege(s?.versicherungen);
  for (const v of policen) {
    const f = policeFristen(v, heute);
    if (f.zustand === 'kuendigen-bald') sp.push({ text: `Versicherung: kündigen oder verlängern bis ${tagText(f.kuendigenBis)}`, weg: weg('schutz', id), schwere: 'gelb' });
    if (f.zustand === 'abgelaufen') sp.push({ text: 'Versicherung: abgelaufen', weg: weg('schutz', id), schwere: 'gelb' });
  }
  if (!policen.length && k.aktiv) sp.push({ text: 'Keine Versicherung erfasst (Betriebshaftpflicht, Vermögensschaden, D&O, Cyber prüfen).', weg: weg('schutz', id), schwere: 'gelb' });

  const teile = {
    dokumente: { ampel: ampelAus(dp), punkte: dp, zahlen: { soll: dokumente.length, ok: dokumente.filter(d => dokSchwere(d) === 'ok').length } },
    pflichten: { ampel: ampelAus(pp), punkte: pp, zahlen: { offen: pflichten.filter(p => p.status === 'offen' || p.status === 'faellig').length, ueberfaellig: pflichten.filter(p => p.status === 'ueberfaellig').length } },
    risiken: { ampel: ampelAus(rp), punkte: rp, zahlen: { erfasst: risiken.length, rot: risiken.filter(r => r.ampel === 'rot').length } },
    schutz: { ampel: ampelAus(sp), punkte: sp, zahlen: { marken: aktiveEintraege(s?.marken).length, domains: aktiveEintraege(s?.domains).length, versicherungen: policen.length } },
  };
  const ampel = [teile.dokumente, teile.pflichten, teile.risiken, teile.schutz].reduce<Ampel>((a, t) => schlimmer(a, t.ampel), 'gruen');
  return { id, name: anzeigeName(g), kontext: k, compliance: { ampel, teile }, dokumente, pflichten, schwellen, risiken, anlaesse, runde, aggregation: agg, schutz };
}

export interface Lage {
  stand: string;
  hinweis: string;
  heute: string;
  gesellschaften: GesellschaftLage[];
  gesamt: { ampel: Ampel; rot: number; gelb: number; gruen: number; ueberfaellig: number; faellig: number };
}

/** Die Lage aller Business-Gesellschaften (rein) — Grundlage für Überblick, Head of Recht und Erinnerungen. */
export function lageAus(register: RegisterDatei | null | undefined, schild: SchildDatei | null | undefined, heute: string): Lage {
  const gesellschaften = schildGesellschaften(register).map(g => gesellschaftLage(g, eintragVon(schild, g.id), heute));
  const n = (a: Ampel) => gesellschaften.filter(x => x.compliance.ampel === a).length;
  return {
    stand: REGEL_STAND, hinweis: SCHILD_HINWEIS, heute, gesellschaften,
    gesamt: {
      ampel: gesellschaften.reduce<Ampel>((a, x) => schlimmer(a, x.compliance.ampel), 'gruen'), rot: n('rot'), gelb: n('gelb'), gruen: n('gruen'),
      ueberfaellig: gesellschaften.reduce((s, x) => s + x.pflichten.filter(p => p.status === 'ueberfaellig').length, 0),
      faellig: gesellschaften.reduce((s, x) => s + x.pflichten.filter(p => p.status === 'faellig').length, 0),
    },
  };
}

// ── Kalender ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SchildFrist { id: string; art: 'pflicht' | 'vertrag'; tag: string; titel: string; unter: string; href: string; kuendigung?: true; erledigt?: true }

/** Stichtage aller Business-Gesellschaften für die Fristen-Ebene (rein): Pflichten, Dokument-Abläufe, Marken/Domains/Versicherungen. */
export function schildFristen(lage: Lage): SchildFrist[] {
  const raus: SchildFrist[] = [];
  for (const g of lage.gesellschaften) {
    for (const p of g.pflichten) {
      if (p.status === 'nicht-zutreffend') continue;
      raus.push({ id: `pf-${g.id}-${p.schluessel}`, art: 'pflicht', tag: p.frist, titel: `${p.titel} (${p.periodeLabel})`, unter: `${g.name} · ${p.norm}`, href: WEG.schild('pflichten', g.id), ...(p.status === 'erledigt' ? { erledigt: true as const } : {}) });
    }
    for (const d of g.dokumente) {
      if (!d.katalog.ablauf || !d.dok?.gueltigBis) continue;
      raus.push({ id: `pd-${g.id}-${d.dok.id}`, art: 'pflicht', tag: d.dok.gueltigBis, titel: `Läuft ab: ${d.katalog.titel}`, unter: g.name, href: WEG.schild('dokumente', g.id) });
    }
    for (const x of g.schutz) raus.push({ id: `ps-${g.id}-${x.id}`, art: 'vertrag', tag: x.tag, titel: x.titel, unter: g.name, href: WEG.schild('schutz', g.id), ...(x.kuendigung ? { kuendigung: true as const } : {}) });
  }
  return raus;
}

// ── Erinnerungen (Aufgabe + Glocke) ──────────────────────────────────────────────────────────────────────────────

/** Feste, kurze Kennung aus einem Schlüssel (FNV-1a, Basis 36) — idempotent je Gegenstand und Stichtag. */
export function kurzHash(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
/** Kennungs-Präfixe der Aufgaben des Schilds (Telegram neutral: lib/meldungen/speicher.ts). */
export const SCHILD_AUFGABEN_PRAEFIXE = ['usp-', 'usd-', 'usm-', 'usr-'] as const;
export const istSchildAufgabe = (id: string) => SCHILD_AUFGABEN_PRAEFIXE.some(p => id.startsWith(p));

export interface SchildErinnerung { aufgabeId: string; gesellschaftId: GesellschaftId; titel: string; beschreibung: string; dueDate: string; reiter: SchildReiter; erledigt?: true }

/**
 * Welche Erinnerungen sind heute fällig (rein)? Offene Pflichten im Vorlauf (auch überfällige, die noch keine Aufgabe haben), Dokumente
 * vor ihrem Ablauf (90 Tage), Marken/Domains/Versicherungen im Vorlauf, die Quartals-Runde der Risiken und jeder Neubewertungs-Anlass.
 * `erledigt` markiert Pflichten, die inzwischen vermerkt sind — deren offene Aufgabe schließt der Server.
 */
/** Neutrale Beschreibung der Erinnerungs-Aufgaben (Prüf-Fund 11.10.): die Einzelheiten nur im Bereich Unternehmen (Link in der Notiz). */
export const NEUTRAL_BESCHREIBUNG = 'Aus dem Bereich Unternehmen — die Einzelheiten stehen dort (Link in der Notiz).';

export function faelligeSchildErinnerungen(lage: Lage): SchildErinnerung[] {
  const heute = lage.heute;
  const raus: SchildErinnerung[] = [];
  const hinweis = ` ${SCHILD_HINWEIS}`;
  for (const g of lage.gesellschaften) {
    for (const p of g.pflichten) {
      const aufgabeId = `usp-${kurzHash(`${g.id}|${p.schluessel}`)}`;
      if (p.status === 'erledigt' || p.status === 'nicht-zutreffend') { raus.push({ aufgabeId, gesellschaftId: g.id, titel: '', beschreibung: '', dueDate: p.frist, reiter: 'pflichten', erledigt: true }); continue; }
      if (p.status !== 'faellig' && p.status !== 'ueberfaellig') continue;
      if (p.inTagen < -60) continue; // sehr alte, nie vermerkte Pflichten nicht als neue Aufgabe — sie stehen rot im Bereich
      // Aufgaben liegen im Business-Space — dort sehen sie auch Konten „nur Business“, die die Firmen-Akte nicht sehen dürfen (Prüf-Fund 11.10.):
      // Titel und Beschreibung NEUTRAL (keine Pflicht, keine Norm, keine Folge bei Versäumnis) — die Einzelheiten stehen nur im Bereich.
      raus.push({ aufgabeId, gesellschaftId: g.id, dueDate: p.frist, reiter: 'pflichten',
        titel: `Unternehmen: Frist im Pflichten-Kalender — ${g.name} — bis ${tagText(p.frist)}`,
        beschreibung: `${NEUTRAL_BESCHREIBUNG} Erledigt? Im Bereich vermerken und Beleg ablegen.${hinweis}` });
    }
    for (const d of g.dokumente) {
      const bis = d.katalog.ablauf ? d.dok?.gueltigBis : undefined;
      if (!bis || tagePlus(bis, -ABLAUF_VORLAUF_TAGE) > heute || bis < tagePlus(heute, -30)) continue;
      raus.push({ aufgabeId: `usd-${kurzHash(`${g.id}|${d.dok!.id}|${bis}`)}`, gesellschaftId: g.id, dueDate: bis, reiter: 'dokumente',
        titel: `Unternehmen: Dokument läuft ab — ${g.name} — ${tagText(bis)}`, beschreibung: `${NEUTRAL_BESCHREIBUNG} Rechtzeitig erneuern und die neue Fassung vermerken.${hinweis}` });
    }
    for (const x of g.schutz) {
      if (x.tag < heute || tagePlus(x.tag, -x.vorlauf) > heute) continue;
      if (x.id.startsWith('vs-ende-')) continue;
      raus.push({ aufgabeId: `usm-${kurzHash(`${g.id}|${x.id}|${x.tag}`)}`, gesellschaftId: g.id, dueDate: x.tag, reiter: 'schutz',
        titel: `Unternehmen: Frist bei Marken & Versicherungen — ${g.name} — ${tagText(x.tag)}`, beschreibung: `${NEUTRAL_BESCHREIBUNG} Entscheiden und vermerken.${hinweis}` });
    }
    if (g.runde.faellig) {
      raus.push({ aufgabeId: `usr-${kurzHash(`${g.id}|${g.runde.quartal}`)}`, gesellschaftId: g.id, dueDate: tagePlus(heute, 14), reiter: 'risiken',
        titel: `Unternehmen: Risiken neu bewerten (${g.runde.quartal.replace('-', ' ')}) — ${g.name}`, beschreibung: `${NEUTRAL_BESCHREIBUNG} Quartals-Runde des Risiko-Registers.${hinweis}` });
    }
    for (const a of g.anlaesse) {
      raus.push({ aufgabeId: `usr-${kurzHash(`${g.id}|${a.id}`)}`, gesellschaftId: g.id, dueDate: tagePlus(heute, 7), reiter: 'risiken',
        titel: `Unternehmen: Risiken neu bewerten (Anlass) — ${g.name}`, beschreibung: `${NEUTRAL_BESCHREIBUNG} Ein Ereignis seit der letzten Bewertung kann die Risiken verändern.${hinweis}` });
    }
  }
  return raus;
}
