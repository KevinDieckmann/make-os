// ─── CRM — Archiv & Papierkorb für die übrigen Listen (rein, 04.10., Kevin: „wir müssen alles anpassbar haben“) ─────────
// Dieselbe Regel wie bei den Produkten (lib/crm/produkte.ts, lib/eintraege/sicher.ts) — jetzt für Firmen, Mandate, Events,
// Segmente, Beiträge, Newsletter-Ausgaben und Kampagnen:
//   · Archivieren = `archiviertAm` (ISO, Server-Zeit): aus der Liste ausgeblendet, überall sonst lesbar, jederzeit zurückholbar.
//     Mandate archivieren über den Status „beendet“ (kein eigenes Feld) — darum stehen sie nur im Papierkorb, nicht im Archiv.
//   · Löschen = Papierkorb `geloeschtAm` (ISO, Server-Zeit): für ALLE Leser unsichtbar (`crmSicht` in `ladeCrm` und in der
//     Antwort von /api/crm/bestand), 30 Tage wiederherstellbar, danach entfernt der Morgenlauf ihn — nur ohne Verweise.
//   · Endgültig (`op: 'delete'`) nur, was schon im Papierkorb liegt (409 sonst) — die Verweis-Sperren (lib/crm/crm-stand.ts
//     `loeschSperren`) gelten weiter; Firmen und Mandate kommen nur ohne Verweise überhaupt in den Papierkorb.
// Kompatibilitätsmodus: beide Felder sind optional — ein Stand ohne sie liest sich wie bisher; der Online-Stand ignoriert sie.
// Tests: tests/listen-aktionen.test.ts.

import type { CrmBestand, CrmListe } from './typen';
import type { ListenOp } from '@/lib/sync';
import { papierkorbMarke, papierkorbBis, papierkorbAbgelaufen, PAPIERKORB_TAGE } from '@/lib/eintraege/sicher';

/** Listen mit Papierkorb (die Produkte `leistungen` haben ihren eigenen, lib/crm/produkte.ts — sie bleiben im Stand lesbar). */
export const CRM_PAPIERKORB = ['firmen', 'mandate', 'events', 'segmente', 'beitraege', 'newsletter', 'kampagnen'] as const;
export type PapierkorbListe = (typeof CRM_PAPIERKORB)[number];
/** Listen mit Archiv-Marke (Mandate: Status „beendet“, Deals: verloren/geparkt, Produkte: „eingestellt“). */
export const CRM_ARCHIV = ['firmen', 'events', 'segmente', 'beitraege', 'newsletter', 'kampagnen'] as const;
export type ArchivListe = (typeof CRM_ARCHIV)[number];

export const istPapierkorbListe = (l: string): l is PapierkorbListe => (CRM_PAPIERKORB as readonly string[]).includes(l);
export const istArchivListe = (l: string): l is ArchivListe => (CRM_ARCHIV as readonly string[]).includes(l);

export interface Ablegbar { id: string; geloeschtAm?: string; archiviertAm?: string }

/** Anzeigename eines Eintrags je Liste (Papierkorb, Rückfragen, Fehlertexte). */
export function ablageTitel(liste: PapierkorbListe, e: Record<string, unknown>): string {
  const t = liste === 'firmen' || liste === 'segmente' || liste === 'kampagnen' ? e.name : liste === 'mandate' ? (e.titel || e.kunde) : e.titel;
  return String(t ?? e.id ?? '').trim() || String(e.id ?? '');
}

export const LISTEN_NAME: Record<PapierkorbListe, { ein: string; viele: string }> = {
  firmen: { ein: 'Firma', viele: 'Firmen' }, mandate: { ein: 'Mandat', viele: 'Mandate' }, events: { ein: 'Event', viele: 'Events' },
  segmente: { ein: 'Segment', viele: 'Segmente' }, beitraege: { ein: 'Beitrag', viele: 'Beiträge' },
  newsletter: { ein: 'Ausgabe', viele: 'Newsletter-Ausgaben' }, kampagnen: { ein: 'Kampagne', viele: 'Kampagnen' },
};

/** Die Marken aus einem rohen Eintrag (Säuberer): nur gültige ISO-Zeitpunkte und nur auf Listen, die sie kennen. */
export function ablageZusatz(liste: CrmListe, o: Record<string, unknown>): { geloeschtAm?: string; archiviertAm?: string } {
  const g = istPapierkorbListe(liste) ? papierkorbMarke(o.geloeschtAm) : undefined;
  const a = istArchivListe(liste) ? papierkorbMarke(o.archiviertAm) : undefined;
  return { ...(g ? { geloeschtAm: g } : {}), ...(a ? { archiviertAm: a } : {}) };
}

/** Eine Marke setzt der Server: neu = Server-Zeit, bestehend bleibt — der Browser verschiebt weder Frist noch Archivtag. */
function marke<T extends Ablegbar>(alt: Ablegbar | undefined, neu: T, feld: 'geloeschtAm' | 'archiviertAm', jetzt: string): T {
  const v = neu[feld];
  if (!v) return neu;
  const am = alt?.[feld] ?? jetzt;
  return v === am ? neu : { ...neu, [feld]: am };
}
export function ablageVomServer<T extends Ablegbar>(alt: Ablegbar | undefined, neu: T, jetzt: string): T {
  return marke(alt, marke(alt, neu, 'geloeschtAm', jetzt), 'archiviertAm', jetzt);
}

const ohneKorb = <T extends { geloeschtAm?: string }>(l: readonly T[] | undefined): T[] => (l ?? []).filter(x => !x.geloeschtAm);

/** Der Bestand, wie ALLE Leser ihn sehen: ohne Papierkorb (Produkte ausgenommen — sie haben ihre eigene Sicht). */
export function crmSicht<B extends CrmBestand>(b: B): B {
  if (!CRM_PAPIERKORB.some(l => ((b[l] ?? []) as Ablegbar[]).some(x => x.geloeschtAm)) && !(b.angebote ?? []).some(a => a.geloeschtAm)) return b;
  const n = { ...b } as B;
  for (const l of CRM_PAPIERKORB) (n as Record<string, unknown>)[l] = ohneKorb(b[l] as Ablegbar[]);
  // Angebots-Entwürfe im Papierkorb (04.10., Route /api/crm/angebot) — ebenso für alle Leser unsichtbar.
  n.angebote = ohneKorb(b.angebote);
  return n;
}

/** Angebots-Entwürfe, die länger als die Frist im Papierkorb liegen (Morgenlauf; gestellte kommen nie hinein). */
export function angeboteAbgelaufen(b: CrmBestand, jetzt: string, tage = PAPIERKORB_TAGE): string[] {
  return (b.angebote ?? []).filter(a => a.status === 'entwurf' && papierkorbAbgelaufen(a, jetzt, tage)).map(a => a.id);
}

export interface CrmKorbEintrag { liste: PapierkorbListe; id: string; titel: string; geloeschtAm: string; bisTag: string }

/** Alles, was im Papierkorb liegt — neueste zuerst. */
export function crmPapierkorb(b: CrmBestand): CrmKorbEintrag[] {
  const raus: CrmKorbEintrag[] = [];
  for (const l of CRM_PAPIERKORB) {
    for (const e of (b[l] ?? []) as unknown as (Ablegbar & Record<string, unknown>)[]) {
      if (e.geloeschtAm) raus.push({ liste: l, id: e.id, titel: ablageTitel(l, e), geloeschtAm: e.geloeschtAm, bisTag: papierkorbBis(e.geloeschtAm) });
    }
  }
  return raus.sort((a, b2) => b2.geloeschtAm.localeCompare(a.geloeschtAm));
}

/** Länger als die Frist im Papierkorb (Kandidaten für den Morgenlauf — die Verweise prüft der Server dort). */
export function crmAbgelaufen(b: CrmBestand, jetzt: string, tage = PAPIERKORB_TAGE): { liste: PapierkorbListe; id: string }[] {
  return crmPapierkorb(b).filter(e => papierkorbAbgelaufen(e, jetzt, tage)).map(e => ({ liste: e.liste, id: e.id }));
}

/**
 * Regel „sicher statt endgültig“ (409, ganze Änderung abgelehnt): endgültig löschen nur, was schon im Papierkorb liegt.
 * Was es nicht (mehr) gibt, lehnt nichts ab (doppeltes Löschen ist harmlos).
 */
export function papierkorbPflicht(b: CrmBestand, ops: readonly ListenOp[]): string[] {
  const raus: string[] = [];
  for (const o of ops) {
    if (o?.op !== 'delete' || !istPapierkorbListe(String(o.liste))) continue;
    const l = o.liste as PapierkorbListe;
    const e = ((b[l] ?? []) as unknown as (Ablegbar & Record<string, unknown>)[]).find(x => x.id === String(o.id));
    if (e && !e.geloeschtAm) raus.push(`„${ablageTitel(l, e)}“ liegt nicht im Papierkorb — Löschen legt ${l === 'firmen' || l === 'kampagnen' || l === 'newsletter' ? 'sie' : 'es'} erst in den Papierkorb (${PAPIERKORB_TAGE} Tage wiederherstellbar), endgültig nur von dort.`);
  }
  return raus;
}

/**
 * Ops, die einen Eintrag NEU in den Papierkorb legen (Marke gesetzt, vorher keine) — für die Verweis-Sperren: Firmen und
 * Mandate kommen nur ohne Verweise hinein (sonst zeigten Personen, Rechnungen, Dateien ins Leere, weil alle Leser den
 * Papierkorb ausblenden). Als `delete`-Op geformt, damit `loeschSperren` dieselbe Prüfung nimmt.
 */
export function neuImPapierkorb(b: CrmBestand, ops: readonly ListenOp[], listen: readonly PapierkorbListe[]): ListenOp[] {
  const raus: ListenOp[] = [];
  for (const o of ops) {
    if (!o || !(listen as readonly string[]).includes(String(o.liste)) || o.op === 'delete') continue;
    const roh = ((o.op === 'teil' ? o.felder : o.eintrag) ?? {}) as Record<string, unknown>;
    const id = String(o.op === 'teil' ? o.id : (o.eintrag as { id?: unknown } | undefined)?.id ?? '');
    if (!papierkorbMarke(roh.geloeschtAm)) continue;
    const alt = ((b[o.liste as PapierkorbListe] ?? []) as unknown as Ablegbar[]).find(x => x.id === id);
    if (alt && !alt.geloeschtAm) raus.push({ liste: o.liste, op: 'delete', id });
  }
  return raus;
}

/** Vermerk an einer aus dem Papierkorb zurückgeholten Firma (1.6, 09.10.). */
export const ZURUECK_VERMERK = 'Aus dem Papierkorb zurückgeholt — unter gleichem Namen neu angelegt';
/**
 * Eine Firma, die im Papierkorb liegt, wird beim Anlegen unter gleichem Namen ZURÜCKGEHOLT (1.6, Woche 2): ohne Papierkorb- und
 * Archiv-Marke, mit Vermerk in der Notiz — nie bleibt eine Firma mit Marke stehen, an der dann Personen hängen (sie wäre für alle Leser
 * unsichtbar und die Person nie ein Lead). Genutzt vom Firmen-Upsert (lib/crm/speicher.ts) und von „Person anlegen“ (lib/crm/person-anlegen.ts).
 */
export function firmaZurueckholen<F extends { notiz?: string; geloeschtAm?: string; archiviertAm?: string; geaendert: string }>(f: F, heute: string, jetzt: string): F {
  const { geloeschtAm: _weg, archiviertAm: _a, ...rest } = f;
  const zeile = `${heute}: ${ZURUECK_VERMERK}.`;
  return { ...rest, notiz: f.notiz ? `${f.notiz}\n${zeile}` : zeile, geaendert: jetzt } as F;
}
