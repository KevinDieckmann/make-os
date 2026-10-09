// ─── Streaming für ZOE und den Agenten-Chat: das Format auf der Leitung (09.10., AGENTEN_KONZEPT.md C8 Risiko 8) ──────────────
// Kevin: „wie Claude“ — der Text erscheint, während er entsteht. Server-Sent Events (text/event-stream), nur wenn der Browser
// `Accept: text/event-stream` schickt; sonst antworten die Routen wie bisher mit JSON. Rein, ohne Abhängigkeiten — Server
// (lib/http/sse-antwort.ts), Browser (lib/http/strom-client.ts) und Tests nehmen DIESE Stelle.
//
// Ereignisse (je eine Zeile `event:` + eine Zeile `data:` mit JSON, Leerzeile dazwischen):
//   text      { text }            ein Stück der Antwort, in Reihenfolge — nur Anzeige; gespeichert wird allein das Endergebnis
//   werkzeug  { name, status }    ein Werkzeug läuft bzw. ist fertig — nur der Name, nie Eingaben oder Ergebnisse
//   ende      { status, body }    GENAU die JSON-Antwort ohne Streaming (Status + Körper) — die Wahrheit, mit der die Oberfläche endet
// Kommentarzeilen (`: …`) halten die Leitung offen (Proxys schließen sonst stille Verbindungen).

export const SSE_TYP = 'text/event-stream';

export type WerkzeugStand = 'laeuft' | 'fertig' | 'fehler' | 'vorgeschlagen';

/** Was während eines Laufs an die Oberfläche geht (nie Inhalte von Werkzeugen, nie Eingaben). */
export type StromEreignis =
  | { art: 'text'; text: string }
  | { art: 'werkzeug'; name: string; status: WerkzeugStand };

/** Das letzte Ereignis: dieselbe Antwort wie ohne Streaming. */
export interface StromEnde { status: number; body: unknown }

/** Will der Browser einen Strom? (Nur dann — sonst JSON wie bisher.) */
export function willStrom(req: Pick<Request, 'headers'>): boolean {
  return (req.headers.get('accept') ?? '').toLowerCase().includes(SSE_TYP);
}

/** Ein Ereignis als Text auf der Leitung. JSON trägt nie einen rohen Zeilenumbruch — eine `data:`-Zeile reicht. */
export function sseZeile(name: string, daten: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(daten ?? null)}\n\n`;
}

/** Ein Stück-Ereignis aus der Schleife in die Leitung. */
export function ereignisZeile(e: StromEreignis): string {
  return e.art === 'text' ? sseZeile('text', { text: e.text }) : sseZeile('werkzeug', { name: e.name, status: e.status });
}

export interface Roh { name: string; daten: unknown }

/**
 * Den gelesenen Puffer in fertige Ereignisse zerlegen (rein). `rest` = was noch nicht mit einer Leerzeile abgeschlossen ist —
 * beim nächsten Stück davor hängen. Kommentare und unbekannte Felder fallen weg; `data:` ohne gültiges JSON wird übersprungen.
 */
export function sseZerlegen(puffer: string): { ereignisse: Roh[]; rest: string } {
  const text = puffer.replace(/\r\n?/g, '\n');
  const bloecke = text.split('\n\n');
  const rest = bloecke.pop() ?? '';
  const ereignisse: Roh[] = [];
  for (const b of bloecke) {
    let name = 'message';
    const daten: string[] = [];
    for (const zeile of b.split('\n')) {
      if (!zeile || zeile.startsWith(':')) continue;
      const i = zeile.indexOf(':');
      const feld = i < 0 ? zeile : zeile.slice(0, i);
      const wert = i < 0 ? '' : zeile.slice(i + 1).replace(/^ /, '');
      if (feld === 'event') name = wert;
      else if (feld === 'data') daten.push(wert);
    }
    if (!daten.length) continue;
    try { ereignisse.push({ name, daten: JSON.parse(daten.join('\n')) }); } catch { /* kaputtes Stück — überspringen */ }
  }
  return { ereignisse, rest };
}

/** Ein rohes Ereignis als Strom-Ereignis bzw. Ende (rein) — alles andere ist null. */
export function ereignisAus(r: Roh): StromEreignis | { art: 'ende'; ende: StromEnde } | null {
  const d = (r.daten && typeof r.daten === 'object' ? r.daten : {}) as Record<string, unknown>;
  if (r.name === 'text' && typeof d.text === 'string') return { art: 'text', text: d.text };
  if (r.name === 'werkzeug' && typeof d.name === 'string' && (d.status === 'laeuft' || d.status === 'fertig' || d.status === 'fehler' || d.status === 'vorgeschlagen')) {
    return { art: 'werkzeug', name: d.name.slice(0, 80), status: d.status };
  }
  if (r.name === 'ende' && typeof d.status === 'number') return { art: 'ende', ende: { status: d.status, body: d.body ?? null } };
  return null;
}

/**
 * Was in der Oberfläche gerade entsteht: der Text bisher und das Werkzeug, das gerade läuft (rein). Die Chats halten es im Zustand und
 * zeigen es, bis die fertige Antwort (`ende`) bzw. der Thread vom Server sie ersetzt.
 */
export interface Entstehend { text: string; werkzeug: string | null; laufend: number }
export const ENTSTEHEND_LEER: Entstehend = { text: '', werkzeug: null, laufend: 0 };
export function entstehendNach(s: Entstehend, e: StromEreignis): Entstehend {
  if (e.art === 'text') return { ...s, text: s.text + e.text };
  if (e.status === 'laeuft') return { ...s, werkzeug: e.name, laufend: s.laufend + 1 };
  const laufend = Math.max(0, s.laufend - 1);
  return { ...s, laufend, werkzeug: laufend ? s.werkzeug : null };
}
