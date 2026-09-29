// ─── Alter Schreibweg (entfernt 29.09., Paket K5) ───────────────────────────
// Früher: Termine per AppleScript bzw. iCloud ohne Rückgabe der UID anlegen (Events bekamen eine erfundene Kennung,
// Verbindungskarte Befund 4). Heute schreibt nur noch /api/kalender/termin (Browser) bzw. lib/kalender/termin-server.ts
// (Server: Blöcke, Spiegel, Kalender-Agent) — mit echter UID, Bezug und Änderungsprotokoll. 410 für alte Tabs.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEG = { ok: false, fehler: 'Dieser Weg ist abgeschaltet — Termine legt MAKE OS über /api/kalender/termin an. Bitte die Seite neu laden.' };
export async function POST() { return NextResponse.json(WEG, { status: 410 }); }
