// ─── MAKE OS — Einen Auftrag ausführen ──────────────────────────────────────
// Der Arbeiter ruft das je Auftrag auf — er selbst kennt keine Fachlogik.
// Dadurch gibt es weiterhin nur EINEN Weg zur Wirkung: fuehreAus mit Risiko-
// Stufe, Trockenlauf und Protokoll. Ein Werkzeug, das eine Freigabe braucht,
// landet auch aus dem Hintergrund im Stapel statt im Bestand.

import { NextResponse } from 'next/server';
import { lies, melde } from '@/lib/jarvis/auftraege';
import { fuehreAus } from '@/lib/jarvis/ausfuehren';
import { runAgent, AUSFUEHRBAR, type Ausfuehrbar } from '@/lib/jarvis/agenten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(body.id ?? '');
  const a = (await lies()).find(x => x.id === id);
  if (!a) return NextResponse.json({ ok: false, error: 'Auftrag nicht gefunden.' }, { status: 404 });

  const origin = new URL(req.url).origin;
  try {
    if (a.art === 'agent') {
      if (!(AUSFUEHRBAR as readonly string[]).includes(a.name)) {
        await melde(a.id, 'fehler', `Unbekannter Agent: ${a.name}`);
        return NextResponse.json({ ok: false, error: 'Unbekannter Agent.' });
      }
      // Der Lauf sagt selbst, ob er geklappt hat. Vorher wurde das am Text
      // erraten — und ein gutes Board-Pack dreimal wiederholt, weil darin
      // „… ist nicht erreichbar" über die Run-Rate stand (gefunden 07.09.).
      const lauf = await runAgent(a.name as Ausfuehrbar, a.auftrag ?? '', origin);
      // Ein abgeschalteter Agent ist eine Entscheidung, kein Aussetzer —
      // den Auftrag deshalb nicht wieder in die Schlange legen.
      const abgeschaltet = /ist ausgeschaltet/.test(lauf.text);
      await melde(a.id, lauf.ok ? 'fertig' : 'fehler', lauf.text, abgeschaltet);
      return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text });
    }
    // Die Identität kommt aus dem AUFTRAG, nicht aus dieser Anfrage: der
    // Arbeiter ruft hier an, nicht die Person. Sonst liefe alles, was nachts
    // passiert, unter einer Dienst-Identität.
    const lauf = await fuehreAus(a.name, a.eingabe, origin, { anlass: a.anlass, person: a.person, hintergrund: true });
    await melde(a.id, lauf.ok ? 'fertig' : 'fehler', lauf.text);
    return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text, gestapelt: lauf.gestapelt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await melde(a.id, 'fehler', msg);
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) });
  }
}
