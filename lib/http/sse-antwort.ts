// ─── Streaming-Antwort einer Route (09.10., Server) ─────────────────────────────────────────────────────────────────────────
// EINE Stelle, an der eine Route aus einem Lauf einen Server-Sent-Events-Strom macht (Format: lib/http/sse.ts). Die Route prüft ALLES,
// was sie ohne Streaming prüft (Tor-Zeile, `bauPruefen`, `jsonBegrenzt`, `modellSchranke`) VORHER und antwortet bei einem Fehler wie
// bisher mit JSON und Status — erst danach ruft sie `sseAntwort`. Die Arbeit bekommt:
//   sende(e)  Text-Stücke und Werkzeug-Stände (nur Anzeige)
//   signal    abgebrochen, sobald der Browser die Verbindung schließt (Tab zu, Stopp, Netz weg) — der Lauf bricht dann sauber ab und
//             speichert nichts Halbes (die Aufrufer prüfen `signal.aborted`, bevor sie schreiben)
// und liefert am Ende { status, body } — GENAU die JSON-Antwort ohne Streaming; sie geht als Ereignis `ende` hinaus.
// Köpfe: kein Zwischenspeicher, `no-transform` (kein Packen unterwegs — gzip würde die Stücke sammeln), `X-Accel-Buffering: no`.

import { ereignisZeile, sseZeile, SSE_TYP, type StromEnde, type StromEreignis } from './sse';

export interface StromArbeit {
  sende: (e: StromEreignis) => void;
  signal: AbortSignal;
}

/** Alle 15 s eine Kommentarzeile — Proxys schließen sonst eine Verbindung, auf der gerade ein Werkzeug läuft. */
const PING_MS = 15_000;

export function sseAntwort(req: Request, arbeit: (s: StromArbeit) => Promise<StromEnde>, o: { pingMs?: number } = {}): Response {
  const ab = new AbortController();
  const weg = () => ab.abort();
  if (req.signal?.aborted) ab.abort();
  else req.signal?.addEventListener('abort', weg, { once: true });
  const enc = new TextEncoder();
  let zu = false;
  let ping: ReturnType<typeof setInterval> | undefined;

  const strom = new ReadableStream<Uint8Array>({
    start(controller) {
      const schreib = (t: string) => {
        if (zu) return;
        try { controller.enqueue(enc.encode(t)); } catch { zu = true; ab.abort(); }
      };
      schreib(': strom\n\n');
      ping = setInterval(() => schreib(': ping\n\n'), o.pingMs ?? PING_MS);
      void (async () => {
        let ende: StromEnde;
        try {
          ende = await arbeit({ sende: e => schreib(ereignisZeile(e)), signal: ab.signal });
        } catch (err) {
          console.warn('[strom] Lauf gescheitert:', err instanceof Error ? err.message.slice(0, 160) : 'unbekannt');
          ende = { status: 500, body: { ok: false, fehler: 'Interner Fehler — bitte noch einmal versuchen.', error: 'Interner Fehler — bitte noch einmal versuchen.' } };
        }
        clearInterval(ping);
        schreib(sseZeile('ende', ende));
        req.signal?.removeEventListener('abort', weg);
        if (!zu) { zu = true; try { controller.close(); } catch { /* schon zu */ } }
      })();
    },
    cancel() {
      zu = true;
      clearInterval(ping);
      ab.abort();
    },
  });

  return new Response(strom, {
    status: 200,
    headers: { 'Content-Type': `${SSE_TYP}; charset=utf-8`, 'Cache-Control': 'no-cache, no-store, no-transform', 'X-Accel-Buffering': 'no' },
  });
}
