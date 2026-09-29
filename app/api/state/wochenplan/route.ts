// ─── Alter Wochenplan-Bestand (abgeschaltet 29.09., Paket K5) ───────────────
// Bis K5 lagen die Blöcke des Wochenplaners hier (`wochenplan` = Kevin, `wochenplan--<person>`), neben dem Kalender und
// mit einer Apple-Kopie, die beim Verschieben stehen blieb. Seit K5 IST ein Block ein iCloud-Termin (Modus „Planen“ im
// Kalender, lib/planung/bloecke.ts): lesen GET /api/planung/bloecke, schreiben /api/kalender/termin. Den alten Bestand
// liest nur noch die Übernahme (lib/planung/wochenplan-uebernahme*.ts, /api/planung/uebernahme) — er bleibt unverändert
// als Archiv. 410 für alte Tabs und Skripte.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEG = { ok: false, error: 'Der Wochenplan lebt jetzt im Kalender (Modus „Planen“) — Blöcke lesen: /api/planung/bloecke, schreiben: /api/kalender/termin. Bitte die Seite neu laden.' };
export async function GET() { return NextResponse.json(WEG, { status: 410 }); }
export async function PUT() { return NextResponse.json(WEG, { status: 410 }); }
export async function PATCH() { return NextResponse.json(WEG, { status: 410 }); }
