// ─── Head of Recht: die Quartals-Risikorunde VORBEREITEN — nie bewerten (rein, client-sicher, 10.10.) ─────────────────────────────────
// Kevin 10.10.: „Quartals-Risikorunde vorbereiten: Veränderungen seit der letzten Bewertung, neue Risiken aus Ereignissen, Vorschlag je Risiko —
// ihr bewertet im Schild.“ Grundlage ist dieselbe Lage wie im Schild (Risiko-Zeilen, Anlässe, Runde — lib/gesellschaften/schild/risiken.ts); hier
// kommt nur die Vorbereitung dazu: je Risiko eine PRÜFFRAGE (nie eine Zahl), dazu Kandidaten aus dem Startkatalog (R1–R17), die ein Ereignis,
// eine Schwelle oder der Stand der Schutzrechte nahelegen und die noch nicht im Register stehen. Übernehmen und Bewerten macht ein Mensch.

import { aktiveEintraege } from '@/lib/gesellschaften/modell';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import { RISIKO_KATALOG, letzteRunde } from '@/lib/gesellschaften/schild/risiken';
import { ereignisDef } from '@/lib/gesellschaften/schild/pflichten';
import type { EreignisArt, SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { RECHT_HINWEIS, type RundeNeu, type RundeRisiko, type RundeVorbereitung } from './typen';

/**
 * Welche Katalog-Risiken ein Ereignis nahelegt (Regel, Annahme nach research › 3b): die Zuordnung ist ein Vorschlag zum Prüfen — ob ein Risiko
 * besteht, entscheidet ihr. Kennungen aus `RISIKO_KATALOG`.
 */
export const EREIGNIS_RISIKEN: Readonly<Partial<Record<EreignisArt, readonly string[]>>> = {
  anteilsuebertragung: ['R7', 'R13', 'R12'],
  kapitalmassnahme: ['R2', 'R13'],
  'gf-wechsel': ['R4', 'R7'],
  satzungsaenderung: ['R5', 'R13'],
  'sitz-anschrift': ['R5'],
  prokura: ['R4'],
  'gewerbe-aenderung': ['R5'],
  betriebseroeffnung: ['R5', 'R17'],
  'erste-beschaeftigung': ['R7', 'R15', 'R8'],
  'neuer-vertrag': ['R10', 'R17', 'R3'],
  'verlust-haelfte': ['R2', 'R1'],
  'ug-drohende-zu': ['R1', 'R2'],
  zahlungsunfaehigkeit: ['R1'],
  ueberschuldung: ['R2'],
  // Ereignis-Assistent (11.10.): weitere Lebensereignisse
  'beteiligung-erwerb': ['R12', 'R13', 'R14'],
  gruendung: ['R1', 'R5', 'R4'],
  aufloesung: ['R1', 'R2', 'R5'],
};

/** Kandidaten aus dem Startkatalog (rein): Ereignisse seit der letzten Runde, erreichte Schwellen, Holding, Schutzrechte — ohne die schon erfassten. */
export function neueRisikenVon(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, heute: string): RundeNeu[] {
  const da = new Set(aktiveEintraege(s?.risiken).map(r => r.katalogId).filter(Boolean));
  const seit = letzteRunde(s) ?? '';
  const raus = new Map<string, string>();
  const dazu = (id: string, grund: string) => { if (!da.has(id) && !raus.has(id) && RISIKO_KATALOG.some(r => r.id === id)) raus.set(id, grund); };
  for (const e of aktiveEintraege(s?.ereignisse)) {
    if (e.datum <= seit || e.datum > heute) continue;
    for (const id of EREIGNIS_RISIKEN[e.art] ?? []) {
      if (id === 'R13' && g.kontext.gesellschafter < 2) continue;
      if (id === 'R12' && !g.kontext.holding) continue;
      dazu(id, `Ereignis „${ereignisDef(e.art)?.label ?? e.art}“ am ${tagText(e.datum)}`);
    }
  }
  for (const z of g.schwellen) if (z.stand === 'erreicht') dazu('R15', `Schwelle erreicht: ${z.def.titel}`);
  if (g.kontext.holding) dazu('R12', 'Gesellschaft ist als Holding geführt');
  if (aktiveEintraege(s?.marken).some(m => m.inhaberIstGesellschaft === false) || aktiveEintraege(s?.domains).some(d => d.inhaberIstGesellschaft === false)) dazu('R11', 'Marke oder Domain läuft nicht auf die Gesellschaft');
  if (g.kontext.einpersonen) dazu('R4', 'Einpersonen-Gesellschaft — Vertretung bei Ausfall regeln');
  // Ohne ein einziges erfasstes Risiko: der Kern des Startkatalogs (Liquidität, Fristen, Daten) — Übernehmen im Schild übernimmt auf Wunsch alle 17.
  if (!aktiveEintraege(s?.risiken).length) for (const id of ['R1', 'R5', 'R8', 'R9']) dazu(id, 'Noch kein Risiko erfasst — Startkatalog');
  return Array.from(raus, ([katalogId, grund]) => ({ katalogId, titel: RISIKO_KATALOG.find(r => r.id === katalogId)!.titel, grund }));
}

/** Prüffrage je Risiko (rein) — NIE eine Bewertung, nur was sich verändert hat und was zu prüfen ist. */
function vorschlagFuer(z: GesellschaftLage['risiken'][number], anlaesse: readonly string[]): string {
  if (!z.bewertung) return 'Noch nicht bewertet — Eintritt und Wirkung (je 1–5) einschätzen und eine Behandlung wählen.';
  const teile: string[] = [];
  if (anlaesse.length) teile.push(`Seit der letzten Bewertung: ${anlaesse.join('; ')} — prüfen, ob sich Eintritt oder Wirkung verändert haben.`);
  if (z.ampel === 'rot' && z.ohneMassnahme) teile.push('Rot ohne offene Maßnahme — eine Maßnahme mit Frist festlegen oder bewusst tragen (mit Beschluss).');
  else if (z.ampel === 'gelb' && z.ohneMassnahme) teile.push('Gelb ohne offene Maßnahme — prüfen, ob eine Maßnahme nötig ist.');
  if (z.ueberfaellig && !teile.length) teile.push(`Prüftermin erreicht (zuletzt ${tagText(z.bewertung.am)}: ${z.bewertung.eintritt} × ${z.bewertung.wirkung}) — bestätigen oder neu bewerten.`);
  return teile.join(' ') || 'Keine Veränderung erkannt — eine kurze Bestätigung genügt.';
}

/**
 * Die Vorbereitung der Risikorunde einer Gesellschaft (rein). `quartal` aus der Lage (`runde.quartal`), Veränderungen = Anlässe der Lage (Ereignisse,
 * neue Verträge, Gesellschafterwechsel, Schwellen) + überfällige Pflichten + Probleme bei Dokumenten/Schutzrechten; neue Risiken = Katalog-Kandidaten.
 */
export function rundeVorbereiten(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, heute: string): RundeVorbereitung {
  const seit = letzteRunde(s) ?? '';
  const veraenderungen = [
    ...g.anlaesse.map(a => ({ am: a.am, text: a.text })),
    ...g.pflichten.filter(p => p.status === 'ueberfaellig' && p.inTagen >= -90).map(p => ({ am: p.frist, text: `Pflicht überfällig: ${p.titel} (${p.periodeLabel})` })),
    ...g.compliance.teile.schutz.punkte.filter(p => p.schwere === 'rot').map(p => ({ am: heute, text: p.text })),
    ...g.compliance.teile.dokumente.punkte.filter(p => p.schwere === 'rot').map(p => ({ am: heute, text: p.text })),
  ].sort((a, b) => b.am.localeCompare(a.am));
  const anlassTexte = g.anlaesse.map(a => a.text);
  const jeRisiko: RundeRisiko[] = g.risiken.filter(z => z.r.status !== 'erledigt').map(z => ({
    risikoId: z.r.id, titel: z.r.titel, ampel: z.ampel,
    ...(z.bewertung ? { letzte: { am: z.bewertung.am, eintritt: z.bewertung.eintritt, wirkung: z.bewertung.wirkung, art: z.bewertung.art } } : {}),
    anlaesse: z.bewertung ? anlassTexte : [],
    vorschlag: vorschlagFuer(z, z.bewertung ? anlassTexte : []),
  }));
  const neueRisiken = neueRisikenVon(g, s, heute);
  const v: Omit<RundeVorbereitung, 'text'> = { gesellschaftId: g.id, name: g.name, quartal: g.runde.quartal, seit, veraenderungen, neueRisiken, jeRisiko };
  return { ...v, text: rundeText(v) };
}

/** Der Text der Vorbereitung (rein). */
export function rundeText(v: Omit<RundeVorbereitung, 'text'>): string {
  const z = [`RISIKORUNDE ${v.quartal.replace('-', ' ')} — ${v.name} (vorbereitet, bewertet wird im Schild)`, v.seit ? `Letzte Bewertung: ${tagText(v.seit)}` : 'Noch keine Bewertung im Register.'];
  z.push('', `VERÄNDERUNGEN seit der letzten Bewertung (${v.veraenderungen.length}):`, ...(v.veraenderungen.length ? v.veraenderungen.slice(0, 15).map(x => `• ${tagText(x.am)} — ${x.text}`) : ['keine erkannt']));
  z.push('', `JE RISIKO (${v.jeRisiko.length}):`, ...(v.jeRisiko.length ? v.jeRisiko.map(r => `• ${r.titel}${r.letzte ? ` (zuletzt ${r.letzte.eintritt} × ${r.letzte.wirkung}, ${r.ampel})` : ' (offen)'}: ${r.vorschlag}`) : ['noch keins erfasst']));
  if (v.neueRisiken.length) z.push('', 'NEUE RISIKEN ZUM PRÜFEN (Startkatalog):', ...v.neueRisiken.map(r => `• ${r.katalogId} ${r.titel} — ${r.grund}`));
  z.push('', RECHT_HINWEIS);
  return z.join('\n');
}

/**
 * Braucht diese Gesellschaft eine Vorbereitung? Runde fällig (Prüftermin eines Risikos erreicht — alle drei Monate) bzw. aktiv und noch nichts
 * erfasst — und in diesem Quartal noch keine. Einzelne Anlässe dazwischen meldet der Morgenlauf als Aufgabe (`usr-…`, lib/gesellschaften/schild-server.ts). Rein.
 */
export function rundeBrauchtVorbereitung(g: GesellschaftLage, s: SchildGesellschaft | null | undefined, schon: { quartal: string } | undefined): boolean {
  if (schon?.quartal === g.runde.quartal) return false;
  return g.runde.faellig || (g.kontext.aktiv && !aktiveEintraege(s?.risiken).length);
}
