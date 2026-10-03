// ─── Gmail — Antworten der Routen (Server, 03.10.2026) ───────────────────────
// Gemeinsame Helfer der Routen unter app/api/gmail/* — in lib, weil eine Route außer den HTTP-Methoden nichts exportieren darf.
import { NextResponse } from 'next/server';
import { GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { GoogleApiFehler } from '@/lib/google/http';
import { AktionFehler } from './aktion';

/** Einen Fehler aus Google/Gmail in eine Antwort übersetzen — nie mit Token, nie mit Mail-Inhalt. */
export function gmailFehlerAntwort(e: unknown): NextResponse {
  if (e instanceof GoogleVerbindungsFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.status });
  if (e instanceof AktionFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  if (e instanceof GoogleApiFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status >= 500 ? 502 : e.status === 429 ? 429 : 409 });
  return NextResponse.json({ ok: false, fehler: 'Gmail ist gerade nicht erreichbar.' }, { status: 502 });
}

/** Dateiname für `Content-Disposition`: keine Pfade, keine Steuerzeichen, UTF-8 nach RFC 5987. */
export function dateinameKopf(name: string): string {
  const sauber = name.replace(/[\u0000-\u001f\u007f"\\/<>:|?*]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'anhang';
  const ascii = sauber.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(sauber).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
