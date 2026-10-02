// ─── Finanzplanung jetzt — Was ist noch leer oder unfertig? (rein, getestet) ─
// Kevin 02.10.: „Die allgemeine Planung fertig machen.“ Eine kurze Liste aus dem Dokument selbst: wo der Plan noch Platzhalter,
// leere Gesellschaften oder fehlende Preise hat — jeder Punkt mit Sprung in das Feld, das ihn schließt. Nichts davon ist ein
// Fehler der Rechnung; es sind die Stellen, an denen der Plan noch nicht Kevins und Malins Zahlen trägt.

import { GESELLSCHAFTEN, finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import type { FinanzDaten, MonatUG } from './rechenkern';
import type { Unterseite } from './plan/hilfen';
import { nettoTabellePlatzhalter } from './plan/operationen';
import { arbeitsplanVon, planszenarienVon } from './szenarien';
import { bausteineVon } from './geschaeft';

export interface Luecke { id: string; text: string; hinweis?: string; ziel: { u: Unterseite; params?: Record<string, string> } }

const SEITE: Record<Gesellschaftskennung, Unterseite> = { ug: 'ug', kdv: 'kdv', kdc: 'selbst' };

/** Umsatz einer Gesellschaft im Planzeitraum — Treiber, Bausteine, bei der Selbstständigkeit auch die Posten des Abschlusses 2026. */
function hatUmsatz(d: FinanzDaten, ort: Gesellschaftskennung, ug: MonatUG[], ps: ReturnType<typeof arbeitsplanVon>): boolean {
  const bausteine = bausteineVon(ps, ort, 'umsatz').some(b => b.an && b.preis !== 0);
  if (ort === 'ug') return bausteine || ug.some(u => u.umsatz > 0);
  if (ort === 'kdv') return bausteine || ug.some(u => u.kdvExit > 0 || u.kdvBausteineEin > 0);
  return bausteine || d.selbst.posten.some(p => p.art === 'einnahme' && !p.aus && p.betrag > 0);
}

/** Offene Stellen des Plans, wichtigste zuerst. `ug` = gerechnete MAKE-Monate (Arbeitsplan). */
export function luecken(d: FinanzDaten, ug: MonatUG[], kontenFehlen: number): Luecke[] {
  const out: Luecke[] = [];
  const ps = arbeitsplanVon(d);
  if (!ps) out.push({ id: 'arbeitsplan', text: 'Noch kein Arbeitsplan — die Zahlen zeigen nur den Treiber, ohne Produkte.', hinweis: 'Ein Szenario anlegen und mit ★ zum Arbeitsplan machen.', ziel: { u: 'planen' } });
  if (nettoTabellePlatzhalter(d)) out.push({ id: 'netto', text: 'Netto-Tabelle fehlt — Netto = Brutto, die Gehälter im Haushalt sind zu hoch gerechnet.', hinweis: 'Unter Annahmen die Brutto-Netto-Paare eintragen.', ziel: { u: 'szenarien' } });
  for (const ort of GESELLSCHAFTEN) {
    if (!hatUmsatz(d, ort, ug, ps)) out.push({ id: `umsatz-${ort}`, text: `${finanzOrtName(ort)}: noch kein Umsatz geplant.`, hinweis: 'Produkte mit Preis, Anzahl und Start anlegen.', ziel: { u: SEITE[ort] } });
  }
  const ohnePreis = (ps?.bausteine ?? []).filter(b => b.art === 'umsatz' && b.an && !b.regler && b.preis === 0);
  if (ohnePreis.length) out.push({ id: 'ohne-preis', text: `${ohnePreis.length} Produkt${ohnePreis.length === 1 ? '' : 'e'} ohne Preis: ${ohnePreis.slice(0, 3).map(b => b.name).join(', ')}${ohnePreis.length > 3 ? ' …' : ''}.`, hinweis: 'Ein Produkt ohne Preis bringt im Plan keinen Umsatz.', ziel: { u: 'planen', params: { feld: 'umsatz' } } });
  if (!d.steuern) out.push({ id: 'steuern', text: 'Steuern noch nicht durchgesehen — gerechnet wird mit den Sätzen aus den Annahmen.', hinweis: 'Je Gesellschaft festlegen, welche Steuern gelten und wie hoch sie sind.', ziel: { u: 'ug', params: { steuern: '1' } } });
  if (!d.annahmen.kevinBrutto && !d.annahmen.malinBrutto && !planszenarienVon(d).some(p => p.annahmen.kevinBrutto || p.annahmen.malinBrutto)) out.push({ id: 'gehaelter', text: 'Keine Gehälter eingetragen — Personal- und Haushaltsrechnung laufen ohne Einkommen.', ziel: { u: 'szenarien' } });
  if (!d.sachkosten.length && !(ps?.bausteine ?? []).some(b => b.art === 'kosten' && b.einheit === 'ug')) out.push({ id: 'kosten-ug', text: `${finanzOrtName('ug')}: keine Fixkosten und keine Kostenbausteine.`, ziel: { u: 'ug' } });
  if (kontenFehlen > 0) out.push({ id: 'konten', text: `${kontenFehlen} Kontostände fehlen — „frei verfügbar“ ist bis dahin geschätzt.`, ziel: { u: 'posten' } });
  if (!d.ziele.length) out.push({ id: 'ziele', text: 'Noch keine Ziele im Plan.', ziel: { u: 'ziele' } });
  return out;
}
