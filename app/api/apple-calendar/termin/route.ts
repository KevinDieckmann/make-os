// ─── Alter Schreibweg (entfernt 29.09., Paket K5) ───────────────────────────
// Früher: der Wochenplaner spiegelte Blöcke nach Apple (anlegen/löschen) — Verschieben zog nie nach (Verbindungskarte
// Befund 5). Seit K5 IST ein Block ein iCloud-Termin (Modus „Planen“, lib/planung/bloecke.ts); geschrieben wird nur
// über /api/kalender/termin. 410 für alte Tabs.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEG = { ok: false, fehler: 'Dieser Weg ist abgeschaltet — Blöcke und Termine laufen über /api/kalender/termin. Bitte die Seite neu laden.' };
export async function GET() { return NextResponse.json(WEG, { status: 410 }); }
export async function POST() { return NextResponse.json(WEG, { status: 410 }); }
export async function DELETE() { return NextResponse.json(WEG, { status: 410 }); }
