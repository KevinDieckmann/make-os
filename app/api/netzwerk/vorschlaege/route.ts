// ─── MAKE OS — Kontakt-Vorschläge aus dem Postfach ──────────────────────────
// Wer uns schreibt, ist schon ein Kontakt. Diese Route zieht die Absender aus
// dem vorhandenen Postfach-Schnappschuss und schlägt vor, wen wir noch nicht
// im Netzwerk haben — sortiert danach, wie oft man voneinander hört.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/netzwerk-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MsMail { senderName?: string; senderEmail?: string; subject?: string; receivedAt?: string }

/** Absender, die nie eine Person sind. */
const KEINE_PERSON = /no-?reply|noreply|donotreply|newsletter|mailing|notification|benachricht|info@|support@|service@|team@|hello@|kontakt@|automat/i;

export async function GET() {
  const [ms, netz] = await Promise.all([
    loadJson<{ emails: MsMail[]; at?: string }>('microsoft-inbox'),
    loadJson<{ kontakte: Kontakt[] }>('netzwerk'),
  ]);

  const bekannt = new Set(
    (netz?.kontakte ?? []).flatMap(k => [k.email?.toLowerCase().trim(), k.name.toLowerCase().trim()]).filter(Boolean),
  );

  const map = new Map<string, { name: string; email: string; anzahl: number; letzte: string; betreff: string }>();
  for (const m of ms?.emails ?? []) {
    const email = (m.senderEmail ?? '').toLowerCase().trim();
    const name = (m.senderName ?? email).trim();
    if (!email || KEINE_PERSON.test(`${email} ${name}`)) continue;
    if (bekannt.has(email) || bekannt.has(name.toLowerCase())) continue;
    const e = map.get(email);
    if (e) {
      e.anzahl++;
      if ((m.receivedAt ?? '') > e.letzte) { e.letzte = m.receivedAt ?? e.letzte; e.betreff = m.subject ?? e.betreff; }
    } else {
      map.set(email, { name: name || email, email, anzahl: 1, letzte: m.receivedAt ?? '', betreff: m.subject ?? '' });
    }
  }

  const vorschlaege = Array.from(map.values())
    .sort((a, b) => b.anzahl - a.anzahl || b.letzte.localeCompare(a.letzte))
    .slice(0, 60);

  return NextResponse.json({ vorschlaege, stand: ms?.at ?? null, geprueft: (ms?.emails ?? []).length });
}
