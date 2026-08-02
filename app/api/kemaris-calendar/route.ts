import { NextResponse } from 'next/server';
import { saveJson } from '@/lib/store/local-db';

// ─── KEMARIS (Microsoft 365) Kalender — via Claude MCP geholt ────────────────
// Konto: k.dieckmann@kemaris.de (M365). Zeiten sind bereits auf Europe/Berlin
// (Sommerzeit, UTC+2) umgerechnet und als lokale Wall-Clock-ISO gespeichert —
// passend zum Apple-Kalender-Format (/api/apple-calendar).
//
// AKTUALISIEREN: Kevin sagt Claude "KEMARIS-Kalender aktualisieren" →
// Claude ruft outlook_calendar_search auf und überschreibt EVENTS + lastUpdated.

const LAST_UPDATED = '2026-07-29T09:00:00';

export interface KemarisEvent {
  id: string;
  title: string;
  start: string;        // Europe/Berlin wall-clock ISO (no Z)
  end: string;
  company: 'KEMARIS';
  source: 'microsoft-365';
  isTeams: boolean;
  webLink?: string;
}

const EVENTS: KemarisEvent[] = [
  // ── Mi 29.07. ──
  { id: 'ms-1', title: 'Verträge Björn',      start: '2026-07-29T10:00:00', end: '2026-07-29T11:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: false },
  { id: 'ms-2', title: 'Björn × Kevin',       start: '2026-07-29T10:00:00', end: '2026-07-29T11:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
  { id: 'ms-3', title: 'Block Verträge',      start: '2026-07-29T14:00:00', end: '2026-07-29T15:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: false },
  // ── Do 30.07. ──
  { id: 'ms-4', title: 'Arzt MRT Besprechung', start: '2026-07-30T09:00:00', end: '2026-07-30T10:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: false },
  { id: 'ms-5', title: 'KEMARIS Check In',    start: '2026-07-30T10:00:00', end: '2026-07-30T11:30:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
  // ── Fr 31.07. ──
  { id: 'ms-6', title: 'Versicherung make',   start: '2026-07-31T10:00:00', end: '2026-07-31T11:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: false },
  { id: 'ms-7', title: 'POINCAP TownHall',      start: '2026-07-31T10:00:00', end: '2026-07-31T11:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
  { id: 'ms-8', title: 'CheckIn (Reach-Out)', start: '2026-07-31T12:00:00', end: '2026-07-31T12:30:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: false },
  // ── Mo 03.08. ──
  { id: 'ms-9',  title: 'KEMARIS CheckIn',            start: '2026-08-03T09:30:00', end: '2026-08-03T11:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
  { id: 'ms-10', title: 'KEMARIS Innov. Group Weekly', start: '2026-08-03T11:00:00', end: '2026-08-03T12:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
  { id: 'ms-11', title: 'Weekly POINCAP',               start: '2026-08-03T14:00:00', end: '2026-08-03T15:00:00', company: 'KEMARIS', source: 'microsoft-365', isTeams: true },
];

/** Ab wann ein Stand nicht mehr als Wahrheit durchgeht. */
const MAX_TAGE = 7;

export async function GET() {
  const alterTage = Math.floor((Date.now() - Date.parse(LAST_UPDATED)) / 86_400_000);
  const veraltet = !Number.isFinite(alterTage) || alterTage > MAX_TAGE;

  // Write-through in den Store — damit das Brain (Loops, Tageslauf, Jarvis)
  // die KEMARIS-Termine sieht. ABER: Ein zu alter Stand darf nicht mehr in
  // den Store, sonst prüft Jarvis Terminkollisionen gegen Vergangenes und
  // meldet fälschlich „frei".
  if (!veraltet) {
    try { await saveJson('kemaris-calendar', { events: EVENTS, at: LAST_UPDATED }); } catch { /* Anzeige geht vor */ }
  }

  return NextResponse.json(
    {
      lastUpdated: LAST_UPDATED,
      events: EVENTS,
      alterTage: Number.isFinite(alterTage) ? alterTage : null,
      veraltet,
      ...(veraltet ? { hinweis: `Stand ist ${alterTage} Tage alt — nicht als aktueller Kalender verwenden. Neu abrufen über die KEMARIS-Kalenderanbindung.` } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
