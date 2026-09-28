// ─── CRM-Bestand — Stand je Eintrag und Löschsperre bei Verweisen (28.09., K4) ─
// Nur Server (node:crypto über lib/store/fingerabdruck.ts).
//
// Stand (#35/#42/#107): Jeder Eintrag der CRM-Listen geht mit `stand` hinaus —
// dem Fingerabdruck des gespeicherten Datensatzes (wie `listePatchen`). Schickt
// der Browser ihn mit `teil`/`upsert`/`delete` zurück und passt er nicht mehr,
// hat inzwischen jemand anders geschrieben: 409 mit dem aktuellen Eintrag, nichts
// wird überschrieben. Ohne Stand (Altweg: ZOE, Heads, Server) bleibt nur `teil`
// erlaubt — feldweise, er überschreibt keine fremden Felder. Ein `upsert` auf
// einen bestehenden Eintrag ohne Stand ist abgelehnt; einzige Ausnahme sind
// Firmen: dort füllt ein Upsert mit bestehender Kennung nur leere Felder
// (`firmaZusammenfuehren`, F1) und überschreibt nie.
//
// Löschsperre (#49): Eine Firma mit Personen, Deals, Mandaten oder Rechnungen und
// ein Mandat mit Rechnungen werden nicht gelöscht — 409 mit den Anzahlen (keine
// Namen, keine Beträge), die Oberfläche zeigt den Text.

import { fingerabdruck } from '@/lib/store/fingerabdruck';
import type { ListenOp } from '@/lib/sync';
import { CRM_LISTEN, type CrmBestand, type CrmListe } from './typen';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { rechnungPasst, type RechnungKurz } from './kunden';
import { personenDerFirma } from './stationen';
import { toechter } from './konzern';
import type { Kontakt } from '@/lib/make-one/crm';

export type CrmKonfliktGrund = 'inzwischen geändert' | 'inzwischen gelöscht' | 'ohne Stand';
export interface CrmKonflikt { liste: CrmListe; id: string; grund: CrmKonfliktGrund; aktuell?: Record<string, unknown> & { stand: string } }

/** Fingerabdruck eines gespeicherten CRM-Eintrags (ohne das Feld `stand`). */
export const standVon = (e: object): string => fingerabdruck(e as Record<string, unknown>);

/** Der Bestand, wie er an den Browser geht: jeder Eintrag jeder CRM-Liste mit `stand`. Nie so speichern. */
export function crmMitStand(b: CrmBestand): CrmBestand {
  const neu: Record<string, unknown> = { ...b };
  for (const l of CRM_LISTEN) neu[l] = ((b[l] ?? []) as unknown as Record<string, unknown>[]).map(e => ({ ...e, stand: standVon(e) }));
  return neu as unknown as CrmBestand;
}

const istListe = (l: string): l is CrmListe => (CRM_LISTEN as readonly string[]).includes(l);
const opId = (o: ListenOp): string => String((o.op === 'upsert' ? (o.eintrag as { id?: unknown } | undefined)?.id : o.id) ?? '');
/**
 * Stand der Änderung — nur am Op. Ein `stand` IM Eintrag zählt nicht: Oberflächen bauen Einträge oft aus dem
 * Browser-Stand zusammen (`{ ...f, notiz }`), der mitgeschleppte Wert sagt nichts darüber, was der Schreiber sah.
 */
const standDer = (o: ListenOp): string | undefined => (typeof o.stand === 'string' && o.stand ? o.stand : undefined);

/**
 * Welche Änderungen auf einen veralteten Stand treffen — geprüft gegen den Bestand IN der Sperre (aendereCrm).
 * Ein Konflikt lehnt die ganze Änderung ab (wie `listePatchen`): halbe Stände sind schlimmer als eine Nachfrage.
 */
export function crmKonflikte(b: CrmBestand, ops: ListenOp[]): CrmKonflikt[] {
  const k: CrmKonflikt[] = [];
  for (const o of ops) {
    if (!istListe(o.liste)) continue;
    const id = opId(o);
    const alt = ((b[o.liste] ?? []) as unknown as Record<string, unknown>[]).find(e => String(e.id) === id);
    const stand = standDer(o);
    if (stand === undefined) {
      // Altweg ohne Stand: `teil` (feldweise) und `delete` wie bisher; ein ganzer Eintrag über einen bestehenden nur mit Stand.
      if (o.op === 'upsert' && alt && o.liste !== 'firmen') k.push({ liste: o.liste, id, grund: 'ohne Stand', aktuell: { ...alt, stand: standVon(alt) } });
      continue;
    }
    if (!alt) { k.push({ liste: o.liste, id, grund: 'inzwischen gelöscht' }); continue; }
    const jetzt = standVon(alt);
    if (jetzt !== stand) k.push({ liste: o.liste, id, grund: 'inzwischen geändert', aktuell: { ...alt, stand: jetzt } });
  }
  return k;
}

/** Was beim Löschen gebraucht wird, aber nicht im CRM-Bestand liegt: Personen (Kartei) und Rechnungen (Finanzplan). */
export interface VerweisKontext { kontakte?: Pick<Kontakt, 'id' | 'firmaId' | 'position' | 'stationen'>[]; rechnungen?: (RechnungKurz & { mandatId?: string })[] }
/** `personen` zählt jede Station (auch beendete — sonst verlöre die Historie ihre Firma); `toechter` die Firmen mit dieser Mutter (28.09.). */
export interface VerweisAnzahl { personen: number; deals: number; mandate: number; rechnungen: number; toechter?: number }
export interface LoeschSperre { liste: 'firmen' | 'mandate'; id: string; anzahl: VerweisAnzahl; text: string }

const wort = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
/** „noch 3 Personen · 1 Deal · 2 Rechnungen“ — nur Anzahlen, nie Namen oder Beträge. */
export function verweisText(name: string, a: VerweisAnzahl): string {
  const teile = [
    a.personen && wort(a.personen, 'Person', 'Personen'), a.deals && wort(a.deals, 'Deal', 'Deals'),
    a.mandate && wort(a.mandate, 'Mandat', 'Mandate'), a.rechnungen && wort(a.rechnungen, 'Rechnung', 'Rechnungen'),
    a.toechter && wort(a.toechter, 'Tochterfirma', 'Tochterfirmen'),
  ].filter(Boolean);
  return `„${name}“ wird nicht gelöscht: daran hängen noch ${teile.join(' · ')} — erst umhängen oder beenden, dann löschen.`;
}

/**
 * Löschsperre: Firmen mit Personen/Deals/Mandaten/Rechnungen und Mandate mit Rechnungen.
 * Rechnungen gehören zu einem Mandat über `mandatId`; ältere ohne Kennung über den Kunden-Namen (`rechnungPasst`, dieselbe Regel wie der Zahlungs-Faktor).
 */
export function loeschSperren(b: CrmBestand, ops: ListenOp[], kontext: VerweisKontext = {}): LoeschSperre[] {
  const kontakte = kontext.kontakte ?? [];
  const rechnungen = kontext.rechnungen ?? [];
  const sperren: LoeschSperre[] = [];
  for (const o of ops) {
    if (o.op !== 'delete' || o.id == null) continue;
    const id = String(o.id);
    if (o.liste === 'firmen') {
      const f = b.firmen.find(x => x.id === id);
      if (!f) continue;
      const mandate = b.mandate.filter(m => mandatZuFirma(m, f));
      const mandatIds = new Set(mandate.map(m => m.id));
      const anzahl: VerweisAnzahl = {
        personen: personenDerFirma(kontakte, f.id, { nurAktiv: false }).length,
        deals: b.chancen.filter(c => dealZuFirma(c, f)).length,
        mandate: mandate.length,
        rechnungen: rechnungen.filter(r => (r.mandatId ? mandatIds.has(r.mandatId) : rechnungPasst({ kunde: f.name }, r))).length,
        ...(toechter(b.firmen, f.id).length ? { toechter: toechter(b.firmen, f.id).length } : {}),
      };
      if (anzahl.personen || anzahl.deals || anzahl.mandate || anzahl.rechnungen || anzahl.toechter) sperren.push({ liste: 'firmen', id, anzahl, text: verweisText(f.name, anzahl) });
    } else if (o.liste === 'mandate') {
      const m = b.mandate.find(x => x.id === id);
      if (!m) continue;
      const anzahl: VerweisAnzahl = { personen: 0, deals: 0, mandate: 0, rechnungen: rechnungen.filter(r => (r.mandatId ? r.mandatId === m.id : rechnungPasst(m, r))).length };
      if (anzahl.rechnungen) sperren.push({ liste: 'mandate', id, anzahl, text: verweisText(m.titel, anzahl) });
    }
  }
  return sperren;
}
