// ─── Head of Recht: der wöchentliche Recht-Check — Regelwerk OHNE Modell (rein, client-sicher, 10.10.) ───────────────────────────────
// Kevin 10.10.: „Wöchentlicher Recht-Check (montags): Fristen der nächsten 4 Wochen, Pflichten-Ampel je Gesellschaft, was fehlt (Dokumente,
// Meldungen) — aus `unternehmenLage`, ohne Modell als Grundlauf.“ Der Check rechnet NICHTS Eigenes: Ampeln, Pflichten, Dokumente, Schutz kommen aus
// derselben Lage wie die Oberfläche (lib/gesellschaften/schild/ampel.ts `lageAus`), die Vertragsfristen aus dem Register (`vertragsStichtage`), die
// Datenschutz-Zähler aus System › Datenschutz (nur Zahlen). Hier wird nur zusammengestellt, sortiert und als Bericht/Vorschlag formuliert.
// Was der Morgenlauf schon als Aufgabe anlegt (fällige Pflichten, ablaufende Dokumente, Marken/Domains/Policen, Risiko-Runde — `schildErinnerungen`),
// schlägt der Check NICHT noch einmal vor; er schlägt nur vor, was sonst nirgends ankommt (fehlende Pflichtdokumente, erreichte Schwellen, AVV,
// Eskalation → Anwalts-Mappe). Hinweis, keine Rechtsberatung.

import type { Lage, GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import type { VertragsStichtag } from '@/lib/gesellschaften/modell';
import type { BeschlussOffen } from '@/lib/gesellschaften/beschluesse';
import { tagePlus, tageZwischen, tagText } from '@/lib/gesellschaften/schild/zeit';
import { dokSchwere, DOK_ZUSTAND_TEXT } from '@/lib/gesellschaften/schild/dokumente';
import { isoWoche } from '@/lib/zeit/kalender-kern';
import { WEG } from '@/lib/wege';
import {
  CHECK_TAGE, RECHT_HINWEIS, VORSCHLAEGE_JE_WOCHE, WIEDER_NACH_TAGEN, eskalationText,
  type Ampel, type CheckFehlt, type CheckFrist, type CheckGesellschaft, type CheckVorschlag, type DatenschutzZahlen, type RechtStand, type WochenCheck,
} from './typen';

/** ISO-Woche als Kennung `JJJJ-Www` (Riegel des Wochen-Checks). */
export function kwVon(tag: string): string {
  const w = isoWoche(tag);
  return `${w.jahr}-W${String(w.kw).padStart(2, '0')}`;
}

const schlimmer = (a: Ampel, b: Ampel): Ampel => (a === 'rot' || b === 'rot' ? 'rot' : a === 'gelb' || b === 'gelb' ? 'gelb' : 'gruen');
/** Kurzer, stabiler Fingerabdruck (FNV-1a, Basis 36) für Vorschlag-Schlüssel. */
export function rechtHash(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/** Fristen der nächsten `CHECK_TAGE` Tage einer Gesellschaft (rein) — offene Pflichten (auch überfällige), Dokument-Abläufe, Schutzrechte. */
function fristenVon(g: GesellschaftLage, heute: string): CheckFrist[] {
  const bis = tagePlus(heute, CHECK_TAGE);
  const raus: CheckFrist[] = [];
  for (const p of g.pflichten) {
    if (p.status === 'erledigt' || p.status === 'nicht-zutreffend') continue;
    if (p.frist > bis) continue;
    // Sehr alte, nie vermerkte Pflichten stehen rot im Bereich — im Bericht nur die der letzten 60 Tage (wie die Erinnerungen).
    if (p.inTagen < -60) continue;
    raus.push({ tag: p.frist, inTagen: p.inTagen, titel: `${p.titel} (${p.periodeLabel})`, unter: `${g.name} · ${p.norm}`, art: 'pflicht', href: WEG.schild('pflichten', g.id), ...(p.eskalation ? { eskalation: true as const } : {}) });
  }
  for (const d of g.dokumente) {
    const t = d.katalog.ablauf ? d.dok?.gueltigBis : undefined;
    if (!t || t > bis || t < tagePlus(heute, -30)) continue;
    raus.push({ tag: t, inTagen: tageZwischen(heute, t), titel: `Läuft ab: ${d.katalog.titel}`, unter: g.name, art: 'dokument', href: WEG.schild('dokumente', g.id) });
  }
  for (const x of g.schutz) {
    if (x.tag < heute || x.tag > bis) continue;
    raus.push({ tag: x.tag, inTagen: tageZwischen(heute, x.tag), titel: x.titel, unter: g.name, art: 'schutz', href: WEG.schild('schutz', g.id) });
  }
  return raus;
}

/** Was fehlt — Dokumente, Meldungen (Ereignis-/Register-Pflichten), Profil, Schwellen, Risiken, Schutz (aus den Punkten der Lage). */
function fehltVon(g: GesellschaftLage): CheckFehlt[] {
  const raus: CheckFehlt[] = [];
  const basis = { gesellschaftId: g.id, gesellschaft: g.name };
  for (const d of g.dokumente) {
    const sw = dokSchwere(d);
    if (sw === 'ok') continue;
    raus.push({ ...basis, art: 'dokument', text: `${d.katalog.titel}: ${DOK_ZUSTAND_TEXT[d.zustand]}${d.stufe === 'pflicht' ? ' (Pflicht)' : ''}`, weg: WEG.schild('dokumente', g.id), schwere: sw });
  }
  for (const p of g.pflichten) {
    if ((p.gruppe !== 'ereignis' && p.gruppe !== 'register') || (p.status !== 'faellig' && p.status !== 'ueberfaellig')) continue;
    raus.push({ ...basis, art: 'meldung', text: `${p.titel} — ${p.status === 'ueberfaellig' ? 'überfällig seit' : 'fällig bis'} ${tagText(p.frist)} (${p.norm})`, weg: WEG.schild('pflichten', g.id), schwere: p.status === 'ueberfaellig' || p.eskalation ? 'rot' : 'gelb' });
  }
  if (!g.kontext.rechtsform) raus.push({ ...basis, art: 'profil', text: 'Rechtsform fehlt im Steckbrief — ohne sie lassen sich Pflichten nicht rechnen.', weg: WEG.unternehmen(g.id), schwere: 'gelb' });
  if (g.kontext.aktiv && g.schwellen.some(z => z.stand === 'unbekannt')) raus.push({ ...basis, art: 'profil', text: 'Profil unvollständig (Beschäftigte, Umsatz, Bilanzsumme) — die Schwellen-Wächter können nicht prüfen.', weg: WEG.schild('pflichten', g.id), schwere: 'gelb' });
  for (const z of g.schwellen) if (z.stand === 'erreicht' && !z.umgesetzt) raus.push({ ...basis, art: 'schwelle', text: `Schwelle erreicht: ${z.def.titel} — ${z.def.pflicht} (${z.def.norm})`, weg: WEG.schild('pflichten', g.id), schwere: 'gelb' });
  for (const p of g.compliance.teile.risiken.punkte) raus.push({ ...basis, art: 'risiko', text: p.text, weg: p.weg, schwere: p.schwere });
  for (const p of g.compliance.teile.schutz.punkte) raus.push({ ...basis, art: 'schutz', text: p.text, weg: p.weg, schwere: p.schwere });
  return raus;
}

/** Datenschutz & Compliance als „was fehlt“ (nur Zähler). */
function datenschutzFehlt(d: DatenschutzZahlen | null): CheckFehlt[] {
  if (!d) return [];
  const raus: CheckFehlt[] = [];
  if (d.avvOffen) raus.push({ art: 'datenschutz', text: `${d.avvOffen} Auftragsverarbeiter ohne bestätigten AVV`, weg: WEG.datenschutz('empfaenger'), schwere: 'gelb' });
  if (d.drittlandOhneGarantie) raus.push({ art: 'datenschutz', text: `${d.drittlandOhneGarantie} Empfänger im Drittland ohne belegte Garantie`, weg: WEG.datenschutz('empfaenger'), schwere: 'gelb' });
  if (d.pannen?.dringend) raus.push({ art: 'datenschutz', text: `${d.pannen.dringend} Datenpanne${d.pannen.dringend === 1 ? '' : 'n'} mit offener Pflicht (Meldung binnen 72 Stunden bzw. Benachrichtigung)`, weg: WEG.datenschutz('pannen'), schwere: 'rot' });
  const rest = d.gesamt - d.erfuellt;
  if (rest > 0) raus.push({ art: 'datenschutz', text: `Selbstprüfung: ${rest} von ${d.gesamt} Punkten offen${d.offen.length ? ` (${d.offen.slice(0, 3).join(', ')}${d.offen.length > 3 ? ' …' : ''})` : ''}`, weg: WEG.datenschutz('pruefung'), schwere: 'gelb' });
  return raus;
}

const AMPEL_WORT: Record<Ampel, string> = { rot: 'handeln', gelb: 'prüfen', gruen: 'im Lot' };
/** Eine Pflicht mit Eskalation (Anwalt/Steuerbüro einbeziehen), die noch nicht vermerkt ist. */
const eskalationOffen = (p: GesellschaftLage['pflichten'][number]) => !!p.eskalation && (p.status === 'offen' || p.status === 'faellig' || p.status === 'ueberfaellig');

/** Beschlüsse ohne Anmeldung bzw. Eintragung (Beschluss-Buch, 10.10.) als „was fehlt“ — gelb (die Fristen selbst führt der Pflichten-Kalender). */
function beschluesseFehlt(l: readonly BeschlussOffen[] | undefined, namen: ReadonlyMap<string, string>): CheckFehlt[] {
  return (l ?? []).filter(b => namen.has(b.gesellschaftId)).map(b => ({
    gesellschaftId: b.gesellschaftId, gesellschaft: namen.get(b.gesellschaftId), art: 'beschluss' as const,
    text: b.text, weg: WEG.beschluss(b.gesellschaftId, b.beschlussId), schwere: 'gelb' as const,
  }));
}

/**
 * Der Wochen-Check (rein). `vertragsFristen` = Stichtage der Verträge der BUSINESS-Gesellschaften (der Aufrufer filtert), `datenschutz` = Zähler
 * aus System › Datenschutz oder null (nicht lesbar bzw. nicht für diese Sicht), `beschluesse` = Beschlüsse ohne Anmeldung bzw. Eintragung
 * (lib/gesellschaften/beschluesse.ts `beschluesseOhneEintragung`, nur Business-Gesellschaften).
 */
export function wochenCheck(o: { lage: Lage; vertragsFristen: readonly VertragsStichtag[]; datenschutz: DatenschutzZahlen | null; heute: string; beschluesse?: readonly BeschlussOffen[] }): WochenCheck {
  const { lage, heute } = o;
  const bis = tagePlus(heute, CHECK_TAGE);
  const gesellschaften: CheckGesellschaft[] = lage.gesellschaften.map(g => ({
    id: g.id, name: g.name, ampel: g.compliance.ampel,
    teile: { dokumente: g.compliance.teile.dokumente.ampel, pflichten: g.compliance.teile.pflichten.ampel, risiken: g.compliance.teile.risiken.ampel, schutz: g.compliance.teile.schutz.ampel },
    offen: Object.values(g.compliance.teile).reduce((n, t) => n + t.punkte.length, 0),
  }));
  const namen = new Map(lage.gesellschaften.map(g => [g.id, g.name]));
  const fristen: CheckFrist[] = [
    ...lage.gesellschaften.flatMap(g => fristenVon(g, heute)),
    ...o.vertragsFristen.filter(v => namen.has(v.gesellschaftId) && v.tag >= heute && v.tag <= bis)
      .map(v => ({ tag: v.tag, inTagen: tageZwischen(heute, v.tag), titel: v.titel, unter: v.unter ?? namen.get(v.gesellschaftId) ?? '', art: 'vertrag' as const, href: WEG.unternehmen(v.gesellschaftId, 'vertraege') })),
  ].sort((a, b) => a.tag.localeCompare(b.tag) || a.titel.localeCompare(b.titel, 'de'));
  const fehlt = [...lage.gesellschaften.flatMap(fehltVon), ...beschluesseFehlt(o.beschluesse, namen), ...datenschutzFehlt(o.datenschutz)];
  // Eskalation sofort, solange die Pflicht offen ist (nicht erst im Vorlauf): Zahlungsunfähigkeit, Überschuldung, Verlust der Hälfte (research › 6a Nr. 4).
  const eskalation = lage.gesellschaften.flatMap(g => g.pflichten.filter(eskalationOffen)
    .map(p => eskalationText(`${p.titel} (${g.name}, ${p.norm})`)));
  const vorschlaege = checkVorschlaege(lage, o.datenschutz);
  let ampel: Ampel = lage.gesamt.ampel;
  if (o.datenschutz?.pannen?.dringend) ampel = schlimmer(ampel, 'rot');
  else if (o.datenschutz && (o.datenschutz.avvOffen || o.datenschutz.drittlandOhneGarantie)) ampel = schlimmer(ampel, 'gelb');
  const check: WochenCheck = { kw: kwVon(heute), heute, stand: lage.stand, ampel, gesellschaften, fristen, fehlt, eskalation, datenschutz: o.datenschutz, vorschlaege, text: '' };
  return { ...check, text: checkText(check) };
}

/** Vorschläge des Checks — nur, was nicht schon als Erinnerung kommt; Pflichtdokumente, Schwellen, AVV, Eskalation. Rein. */
function checkVorschlaege(lage: Lage, d: DatenschutzZahlen | null): CheckVorschlag[] {
  const raus: CheckVorschlag[] = [];
  for (const g of lage.gesellschaften) {
    for (const x of g.dokumente) {
      if (x.stufe !== 'pflicht' || x.zustand !== 'fehlt') continue;
      raus.push({ schluessel: `dok:${g.id}:${x.katalog.art}`, art: 'aufgabe', gesellschaftId: g.id, titel: `Pflichtdokument ablegen: ${x.katalog.titel} — ${g.name}`, text: `Aus dem Recht-Check: „${x.katalog.titel}“ fehlt in der Firmen-Akte (${x.katalog.norm}). Beschaffen bzw. vorhandene Fassung unter Unternehmen › Dokumente ablegen.`, weg: WEG.schild('dokumente', g.id) });
    }
    for (const z of g.schwellen) {
      if (z.stand !== 'erreicht' || z.umgesetzt) continue;
      raus.push({ schluessel: `sw:${g.id}:${z.def.id}`, art: 'aufgabe', gesellschaftId: g.id, titel: `Schwelle umsetzen: ${z.def.titel} — ${g.name}`, text: `Aus dem Recht-Check: ${z.def.pflicht} (${z.def.norm}). Umgesetzt? Unter Unternehmen › Pflichten vermerken.`, weg: WEG.schild('pflichten', g.id) });
    }
    const esk = g.pflichten.filter(eskalationOffen);
    if (esk.length) raus.push({ schluessel: `esk:${g.id}:${esk.map(p => p.schluessel).sort().join(',')}`, art: 'mappe', gesellschaftId: g.id, titel: `Anwalts-Mappe zusammenstellen — ${g.name}`, text: eskalationText(esk.map(p => p.titel).join('; ')), weg: WEG.schild('ueberblick', g.id) });
  }
  if (d?.avvOffen) raus.push({ schluessel: 'avv', art: 'aufgabe', titel: `AVV prüfen: ${d.avvOffen} Auftragsverarbeiter ohne bestätigten Vertrag`, text: 'Aus dem Recht-Check: Im Empfänger-Register (System › Datenschutz) fehlt bei Auftragsverarbeitern der bestätigte AVV (Art. 28 DSGVO). Vertrag abschließen bzw. Bestätigung mit Datum und Unterlage eintragen.', weg: WEG.datenschutz('empfaenger') });
  // Reihenfolge: Eskalation zuerst, dann Pflichtdokumente, Schwellen, AVV.
  const rang = (v: CheckVorschlag) => (v.art === 'mappe' ? 0 : v.schluessel.startsWith('dok:') ? 1 : v.schluessel.startsWith('sw:') ? 2 : 3);
  return raus.sort((a, b) => rang(a) - rang(b) || a.schluessel.localeCompare(b.schluessel));
}

/** Welche Vorschläge jetzt neu in den Stapel gehen (rein): ohne Marke bzw. Marke älter als `WIEDER_NACH_TAGEN`, höchstens `VORSCHLAEGE_JE_WOCHE`. */
export function neueVorschlaege(v: readonly CheckVorschlag[], marken: Readonly<Record<string, string>> | undefined, heute: string, schonDa: ReadonlySet<string> = new Set()): CheckVorschlag[] {
  return v.filter(x => !schonDa.has(x.schluessel) && (!marken?.[x.schluessel] || tageZwischen(marken[x.schluessel], heute) >= WIEDER_NACH_TAGEN)).slice(0, VORSCHLAEGE_JE_WOCHE);
}

/** Der Bericht (rein) — Fristen, Ampel je Gesellschaft, was fehlt, Datenschutz-Zähler, Eskalation, Hinweis. Keine Personen. */
export function checkText(c: Omit<WochenCheck, 'text'>): string {
  const z: string[] = [`RECHT-CHECK ${c.kw.replace('-W', ' · KW ')} — gesamt: ${AMPEL_WORT[c.ampel]}`];
  if (!c.gesellschaften.length) z.push('Noch keine Business-Gesellschaft im Register — das Schild führt nur Gesellschaften im Bereich Business.');
  for (const g of c.gesellschaften) z.push(`• ${g.name}: ${AMPEL_WORT[g.ampel]} (Dokumente ${AMPEL_WORT[g.teile.dokumente]} · Pflichten ${AMPEL_WORT[g.teile.pflichten]} · Risiken ${AMPEL_WORT[g.teile.risiken]} · Schutz ${AMPEL_WORT[g.teile.schutz]})`);
  z.push('', `FRISTEN der nächsten ${CHECK_TAGE} Tage (${c.fristen.length}):`);
  if (!c.fristen.length) z.push('keine');
  for (const f of c.fristen.slice(0, 20)) z.push(`• ${tagText(f.tag)} — ${f.titel} · ${f.unter}${f.inTagen < 0 ? ' · ÜBERFÄLLIG' : ''}${f.eskalation ? ' · Anwalt/Steuerbüro einbeziehen' : ''}`);
  if (c.fristen.length > 20) z.push(`… und ${c.fristen.length - 20} weitere (Unternehmen › Pflichten)`);
  z.push('', `WAS FEHLT (${c.fehlt.length}):`);
  if (!c.fehlt.length) z.push('nichts');
  for (const f of c.fehlt.slice(0, 20)) z.push(`• ${f.schwere === 'rot' ? '[rot] ' : ''}${f.gesellschaft ? `${f.gesellschaft}: ` : ''}${f.text}`);
  if (c.fehlt.length > 20) z.push(`… und ${c.fehlt.length - 20} weitere`);
  if (c.datenschutz) {
    const d = c.datenschutz;
    z.push('', `DATENSCHUTZ & COMPLIANCE (nur Zähler): Selbstprüfung ${d.erfuellt}/${d.gesamt} erfüllt · ${d.empfaenger} Empfänger, ${d.avvOffen} ohne bestätigten AVV, ${d.drittlandOhneGarantie} Drittland ohne Garantie · Verzeichnis ${d.verzeichnis} Verarbeitungen${d.pannen ? ` · Pannen offen ${d.pannen.offen} (dringend ${d.pannen.dringend})` : ''}`);
  }
  if (c.eskalation.length) z.push('', 'ESKALATION:', ...c.eskalation.map(e => `• ${e}`));
  z.push('', `Stand der Regeln: ${tagText(c.stand)}. ${RECHT_HINWEIS}`);
  return z.join('\n');
}

/** Ist der Wochen-Check dran? Einmal je ISO-Woche (montags beim ersten Morgenlauf; verpasst → am nächsten Lauf derselben Woche). Rein. */
export const wocheFaellig = (stand: Pick<RechtStand, 'woche'> | null | undefined, heute: string): boolean => stand?.woche?.kw !== kwVon(heute);
