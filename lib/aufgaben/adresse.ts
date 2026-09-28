// ─── MAKE OS — Aufgaben: Adressen (rein, 28.09. spät) ───────────────────────
// Kevin (~22:30): „Navigation wie in der Markttraktion“ — jeder Zustand steckt in der Adresse, damit Zurück und
// Links funktionieren. Links nur über `WEG.aufgaben` (lib/wege.ts) bzw. `aufgabenLink` hier.
//
//   /os/aufgaben                                   Überblick (Kacheln + Karten je Privat/Firma/Mandant)
//     ?b=ueberblick | archiv                       ausdrücklich Überblick bzw. Archiv (beendete Mandate, archivierte Projekte)
//     &s=<Space>                                   privat · kdc · kdv · ug · m-<firmaId>
//     &p=<Projekt>                                 Projektseite, &t=aufgaben (Start) · notizen · dateien · felder · verlauf
//     &g=<Gruppe> &l=<Liste>                        Fokus auf eine Gruppe/Liste im Projekt
//     &a=<Aufgabe>                                 Detail offen
//     &ansicht=board | tabelle | kalender          Board, Tabelle, Kalender (C5) statt Liste
//     &space=privat|business                       die Seitenleiste (Privat/Business) — wird aus dem Space mitgeführt
// Alte Adressen bleiben gültig: `offen=<Aufgabe>` (WEG.aufgabe, Meldungen, Suche) = `a`, `r=<Space>` = `s`,
// `space=privat` allein öffnet den Privat-Space, `space=business` allein den Überblick (nur Business).

import { istSpaceId, bereichVonSpace } from './struktur';

export type ProjektReiter = 'aufgaben' | 'notizen' | 'dateien' | 'felder' | 'verlauf';
export const PROJEKT_REITER: { id: ProjektReiter; label: string }[] = [
  { id: 'aufgaben', label: 'Aufgaben' }, { id: 'notizen', label: 'Notizen' }, { id: 'dateien', label: 'Dateien' }, { id: 'felder', label: 'Felder' }, { id: 'verlauf', label: 'Verlauf' },
];
export type AufgabenAnsicht = 'ueberblick' | 'archiv' | 'space';

export interface AufgabenAdresse {
  /** Was gezeigt wird. */
  ansicht: AufgabenAnsicht;
  /** Space (nur bei `space`). */
  s?: string;
  p?: string;
  g?: string;
  l?: string;
  /** Offene Aufgabe (auch im Überblick möglich — dann springt die Seite in ihren Space). */
  a?: string;
  t?: ProjektReiter;
  /** board (sonst Liste). */
  darstellung?: string;
  /** Seitenleiste: Privat oder Business (nur mitgeführt). */
  bereich?: 'privat' | 'business';
}

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const kennung = (x: string | null | undefined): string | undefined => (x && KENNUNG.test(x) ? x : undefined);
const DARSTELLUNG = /^[a-z]{2,20}$/;

/** Die Adresse lesen — alte Parameter werden übersetzt, ungültige Kennungen fallen weg. */
export function adresseLesen(p: { get(name: string): string | null }): AufgabenAdresse {
  const b = p.get('b');
  const space = p.get('space');
  const bereich: 'privat' | 'business' | undefined = space === 'privat' || space === 'business' ? space : undefined;
  const sRoh = p.get('s') ?? p.get('r');
  const s = istSpaceId(sRoh) ? sRoh : undefined;
  const a = kennung(p.get('a') ?? p.get('offen'));
  const tRoh = p.get('t');
  const t = PROJEKT_REITER.some(r => r.id === tRoh) ? (tRoh as ProjektReiter) : undefined;
  const d = p.get('ansicht');
  const darstellung = d && DARSTELLUNG.test(d) && d !== 'liste' ? d : undefined;
  const rest = { ...(a ? { a } : {}), ...(darstellung ? { darstellung } : {}), ...(bereich ? { bereich } : {}) };
  if (b === 'archiv') return { ansicht: 'archiv', ...rest };
  if (b === 'ueberblick') return { ansicht: 'ueberblick', ...rest };
  const imSpace = s ?? (bereich === 'privat' ? 'privat' : undefined);
  if (imSpace) {
    const pr = kennung(p.get('p'));
    return {
      ansicht: 'space', s: imSpace, ...rest,
      ...(pr ? { p: pr } : {}),
      ...(pr && kennung(p.get('g')) ? { g: kennung(p.get('g')) } : {}),
      ...(pr && kennung(p.get('l')) ? { l: kennung(p.get('l')) } : {}),
      ...(pr && t && t !== 'aufgaben' ? { t } : {}),
    };
  }
  return { ansicht: 'ueberblick', ...rest };
}

export const AUFGABEN_PFAD = '/os/aufgaben';

/** Der Link zu einem Zustand (Gegenstück zu `adresseLesen`). Im Space trägt er `space` für die Seitenleiste mit. */
export function aufgabenLink(z: Partial<AufgabenAdresse> = {}): string {
  const q = new URLSearchParams();
  const ansicht = z.ansicht ?? (z.s ? 'space' : 'ueberblick');
  const s = ansicht === 'space' && istSpaceId(z.s) ? z.s : undefined;
  const bereich = s ? bereichVonSpace(s) : z.bereich;
  if (bereich) q.set('space', bereich);
  if (ansicht === 'archiv') q.set('b', 'archiv');
  // Überblick ausdrücklich, wenn sonst `space=privat` allein den Privat-Space öffnen würde.
  if (ansicht === 'ueberblick' && bereich === 'privat') q.set('b', 'ueberblick');
  if (s) {
    q.set('s', s);
    const p = kennung(z.p);
    if (p) {
      q.set('p', p);
      if (kennung(z.g)) q.set('g', z.g!);
      if (kennung(z.l)) q.set('l', z.l!);
      if (z.t && z.t !== 'aufgaben' && PROJEKT_REITER.some(r => r.id === z.t)) q.set('t', z.t);
    }
  }
  if (kennung(z.a)) q.set('a', z.a!);
  if (z.darstellung && DARSTELLUNG.test(z.darstellung) && z.darstellung !== 'liste') q.set('ansicht', z.darstellung);
  const t = q.toString();
  return t ? `${AUFGABEN_PFAD}?${t}` : AUFGABEN_PFAD;
}
