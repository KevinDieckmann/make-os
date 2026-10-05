// ─── MAKE OS — Einen Auftrag ausführen ──────────────────────────────────────
// Der Arbeiter ruft das je Auftrag auf — er selbst kennt keine Fachlogik.
// Dadurch gibt es weiterhin nur EINEN Weg zur Wirkung: fuehreAus mit Risiko-
// Stufe, Trockenlauf und Protokoll. Ein Werkzeug, das eine Freigabe braucht,
// landet auch aus dem Hintergrund im Stapel statt im Bestand.

import { NextResponse } from 'next/server';
import { lies, melde, pachtGueltig } from '@/lib/zoe/auftraege';
import { fuehreAus } from '@/lib/zoe/ausfuehren';
import { runAgent, AUSFUEHRBAR, type Ausfuehrbar } from '@/lib/zoe/agenten';
import { innenAdresse } from '@/lib/innen';
import { istDienst } from '@/lib/zugang/dienst';
import { imHintergrund } from '@/lib/datenschutz/ki-lauf';
import { kiSchalterFuer } from '@/lib/datenschutz/ki-einstellungen';
import { KI_LAEUFE } from '@/lib/zoe/takt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ ok: false, error: 'Nur der Arbeiter (Dienstschlüssel).' }, { status: 403 });
  let body: { id?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(body.id ?? '');
  if (!(await lies()).some(x => x.id === id)) return NextResponse.json({ ok: false, error: 'Auftrag nicht gefunden.' }, { status: 404 });
  // Pacht-Token (29.09., Paket D-A #20): nur der aktuelle Halter führt aus — ein Läufer mit abgelaufener
  // oder neu vergebener Pacht bekommt 409 und wirkt nicht (kein doppelter Lauf, keine doppelten KI-Kosten).
  const a = await pachtGueltig(id, body.token);
  if (!a) return NextResponse.json({ ok: false, error: 'Pacht abgelaufen oder neu vergeben — nicht ausgeführt.' }, { status: 409 });
  const token = a.pachtToken!;

  const origin = innenAdresse(req);
  try {
    if (a.art === 'agent') {
      if (!(AUSFUEHRBAR as readonly string[]).includes(a.name)) {
        await melde(a.id, token, 'fehler', `Unbekannter Agent: ${a.name}`);
        return NextResponse.json({ ok: false, error: 'Unbekannter Agent.' });
      }
      // Der Lauf sagt selbst, ob er geklappt hat. Vorher wurde das am Text
      // erraten — und ein gutes Board-Pack dreimal wiederholt, weil darin
      // „… ist nicht erreichbar" über die Run-Rate stand (gefunden 07.09.).
      // Datenschutz (05.10.): was der Takt eingereiht hat, ist ein Hintergrund-Lauf — mit ausgeschalteter Hintergrund-KI
      // laufen die KI-Läufe gar nicht erst (Entscheidung, kein Aussetzer: nicht neu einreihen); sonst trägt der Lauf die
      // Art im selben Prozess (AsyncLocalStorage) und über den Kopf `x-make-lauf` weiter ans KI-Tor.
      const hintergrund = /^Takt:/.test(a.anlass ?? '');
      if (hintergrund && KI_LAEUFE.has(a.name) && !(await kiSchalterFuer(a.person ?? null)).hintergrund) {
        await melde(a.id, token, 'fertig', 'Hintergrund-KI ist ausgeschaltet (System › Datenschutz) — nicht gelaufen.', true);
        return NextResponse.json({ ok: true, ergebnis: 'Hintergrund-KI aus' });
      }
      const lauf = hintergrund
        ? await imHintergrund(() => runAgent(a.name as Ausfuehrbar, a.auftrag ?? '', origin, a.person ?? undefined, { hintergrund: true }))
        : await runAgent(a.name as Ausfuehrbar, a.auftrag ?? '', origin, a.person ?? undefined);
      // Ein abgeschalteter Agent ist eine Entscheidung, kein Aussetzer —
      // den Auftrag deshalb nicht wieder in die Schlange legen.
      const abgeschaltet = /ist ausgeschaltet/.test(lauf.text);
      await melde(a.id, token, lauf.ok ? 'fertig' : 'fehler', lauf.text, abgeschaltet);
      return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text });
    }
    // Die Identität kommt aus dem AUFTRAG, nicht aus dieser Anfrage: der
    // Arbeiter ruft hier an, nicht die Person. Sonst liefe alles, was nachts
    // passiert, unter einer Dienst-Identität.
    const lauf = await fuehreAus(a.name, a.eingabe, origin, { anlass: a.anlass, person: a.person, hintergrund: true });
    await melde(a.id, token, lauf.ok ? 'fertig' : 'fehler', lauf.text);
    return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text, gestapelt: lauf.gestapelt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await melde(a.id, token, 'fehler', msg);
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) });
  }
}
