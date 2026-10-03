'use client';

// ─── Mandant überall klickbar (28.09., Kevin: „Mach das ganze Thema mit Mandanten auch klickbar“) ─
// Ein Baustein für jede Stelle außerhalb des CRM, an der ein Mandant steht — Zeit je
// Mandat, Mandat-Chip, Ziele/Meilensteine, Finanzplanung, Liquidität, Mandatsakte.
// Der Klick führt in die CRM-Akte, Mandat vor Firma (lib/crm/adresse.ts `mandantZiel`).
// Aussehen wie im CRM (DealAkte, Kontakt-Mandate): Name in Textfarbe, ohne Unterstrich,
// davor der Mandats-Punkt bzw. 🏢 für die Firma; Hover über die globale Link-Regel.
//   · privat              → nichts (Privat kennt keine Mandanten)
//   · kein CRM-Zugang     → nur der Name
//   · Mandat/Firma weg    → „Name (gelöscht)“ als Text
//   · nur Text-Kunde      → mit `nachName` per eindeutigem Namen aufgelöst, sonst Text
// Ob es Mandat/Firma noch gibt, weiß der Baustein aus der Mandat-Kurzform (`useMandate`,
// ein gemeinsamer Abruf je Minute im Fenster); die Stelle kann es mit `mandatDa`/`firmaDa`
// selbst sagen (z. B. das CRM, das den Bestand schon hat).
// Klicks gehen nicht an die Zeile dahinter (Zeilen öffnen sich sonst mit).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import { mandantZiel, type MandantZiel } from '@/lib/crm/adresse';
import { mandantAusName, mandantName, mandantPruefung } from '@/lib/crm/mandant-link';
import { useMandate } from '../zeit/useMandate';
import { Punkt } from '../ui';

export interface MandantLinkProps {
  mandatId?: string | null;
  firmaId?: string | null;
  /** Anzeigename; fehlt er, kommt er aus dem Mandat-Bestand („Firma · Mandatstitel“ bzw. Firmenname). */
  name?: string | null;
  /** Kleiner, ohne Zeichen davor — für dichte Zeilen. */
  klein?: boolean;
  /** Im Privat-Bereich: der Baustein zeigt nichts. */
  privat?: boolean;
  /** Weiß die Stelle selbst, ob es Mandat/Firma noch gibt? (sonst prüft der Bestand) */
  mandatDa?: boolean;
  firmaDa?: boolean;
  /** Ohne Kennung: per eindeutigem Namen auflösen (z. B. Rechnungs-Kunde als Text). */
  nachName?: boolean;
  /** Zeichen davor (Mandats-Punkt bzw. 🏢) — Standard: an, außer `klein`. */
  zeichen?: boolean;
  /** Eigener Inhalt NUR als Link (z. B. „›“ neben dem Chip) — ohne Ziel erscheint dann nichts. */
  children?: ReactNode;
  /** Textfarbe des Links (Standard: wie der Text drumherum). */
  farbe?: string;
}

const TITEL: Record<'mandat' | 'firma', string> = { mandat: 'Mandat im CRM öffnen', firma: 'Firmenakte im CRM öffnen' };

/** Die reine Ansicht zu einem schon berechneten Ziel (ohne Abruf) — auch für Tests. */
export function MandantLinkAnsicht({ ziel, name, klein, zeichen, children, farbe }: {
  ziel: MandantZiel; name: string; klein?: boolean; zeichen?: boolean; children?: ReactNode; farbe?: string;
}) {
  if (ziel.art === 'aus') return null;
  const groesse = klein ? 12.5 : undefined;
  if (ziel.art === 'text') return children ? null : <span style={{ fontSize: groesse }}>{name}</span>;
  if (ziel.art === 'geloescht') {
    return children ? null : <span title="Im CRM gelöscht" style={{ fontSize: groesse, color: C.inkLeise }}>{name} (gelöscht)</span>;
  }
  const mitZeichen = zeichen ?? !klein;
  const titel = ziel.art === 'firma' && ziel.mandatGeloescht ? 'Mandat gelöscht — Firmenakte im CRM öffnen' : TITEL[ziel.art];
  return (
    <Link href={ziel.href} title={titel} aria-label={children ? titel : undefined} onClick={e => e.stopPropagation()} data-mandant={ziel.art}
      style={{ color: farbe ?? 'inherit', textDecoration: 'none', fontSize: groesse, display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, maxWidth: '100%' }}>
      {mitZeichen && !children && (ziel.art === 'mandat' ? <Punkt farbe={LEUCHT.geld} groesse={7} /> : <span aria-hidden>🏢</span>)}
      {children ?? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>}
    </Link>
  );
}

/** Mandant als Link in die CRM-Akte — der eine Baustein für alle Stellen außerhalb des CRM. */
export function MandantLink({ mandatId, firmaId, name, klein, privat, mandatDa, firmaDa, nachName, zeichen, children, farbe }: MandantLinkProps) {
  const stand = useMandate();
  if (privat) return null;
  // Nur Text-Kunde: per eindeutigem Namen (erst, wenn der Bestand da ist).
  const aufgeloest = !mandatId && !firmaId && nachName && stand.geladen && stand.zugang ? mandantAusName(name, stand.mandate) : null;
  const ids = aufgeloest ?? { mandatId, firmaId };
  const pruefung = mandantPruefung(ids, stand);
  const ziel = mandantZiel({
    ...ids, ...pruefung,
    ...(mandatDa !== undefined ? { mandatDa } : {}),
    ...(firmaDa !== undefined ? { firmaDa } : {}),
  });
  const anzeige = (name ?? '').trim() || mandantName(ids, stand.karte) || (ids.mandatId ? 'Mandat' : 'Firma');
  return <MandantLinkAnsicht ziel={ziel} name={anzeige} klein={klein} zeichen={zeichen} farbe={farbe}>{children}</MandantLinkAnsicht>;
}
