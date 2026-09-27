// ─── Anfrage-Bündler (Browser, 27.09.) ───────────────────────────────────────
// Kevin: „Die Software läuft noch extrem langsam.“ Gemessen im Produktionsbau:
// die einzelnen Antworten sind schnell, aber die Startseite feuert beim Öffnen
// 28 Abfragen, Heute 23, Kalender 17 — viele davon doppelt, weil jedes Widget
// und jede Leiste für sich lädt (Aufgaben dreimal, Stapel dreimal, Kalender
// zweimal). Auf dem Server mit einer CPU reiht sich das hintereinander.
//
// Dieser Bündler liegt EINMAL vor dem fetch des Browsers (AnfrageBuendel.tsx)
// und kennt zwei Regeln für GET-Aufrufe an /api/…:
//   1. Läuft dieselbe Abfrage gerade schon, hängt sich die zweite an — eine
//      Antwort für alle, jeder bekommt seine eigene Kopie (clone).
//   2. Eine fertige Antwort gilt kurz weiter (Standard 8 s), es sei denn, der
//      Aufrufer sagt `cache: 'no-store'` oder `'reload'` — dann nur Regel 1.
// Jeder schreibende Aufruf (POST/PATCH/PUT/DELETE an /api/…) leert den
// Zwischenspeicher, damit das nächste Lesen den neuen Stand sieht. Anfragen
// mit AbortSignal, mit Request-Objekt oder an fremde Adressen gehen unverändert
// durch. Rein und getestet (tests/anfrage-buendel.test.ts).

export interface BuendelOptionen {
  /** Wie lange eine fertige Antwort geteilt wird (ms). */
  frischMs?: number;
  /** Pfade, die nie gebündelt werden (Präfixe). */
  ausnahmen?: string[];
  jetzt?: () => number;
}

interface Eintrag { t: number; p: Promise<Response>; }

const SCHREIBEND = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Schlüssel: Pfad + Abfrage + die Kopfzeilen, die die Antwort ändern (ETag-Vergleich). */
function schluesselFuer(url: string, init?: RequestInit): string {
  const h = new Headers(init?.headers ?? {});
  const etag = h.get('if-none-match') ?? '';
  const person = h.get('x-make-person') ?? '';
  return `${url}|${etag}|${person}`;
}

function istApi(url: string, origin: string): boolean {
  if (url.startsWith('/api/')) return true;
  if (url.startsWith(origin)) return url.slice(origin.length).startsWith('/api/');
  return false;
}

/** Baut aus einem fetch einen bündelnden fetch. `origin` = window.location.origin. */
export function buendelnderFetch(fetchImpl: typeof fetch, origin: string, opt: BuendelOptionen = {}): typeof fetch & { leeren: () => void; stand: () => { laufend: number; frisch: number } } {
  const frischMs = opt.frischMs ?? 8_000;
  const ausnahmen = opt.ausnahmen ?? [];
  const jetzt = opt.jetzt ?? (() => Date.now());
  const laufend = new Map<string, Promise<Response>>();
  const frisch = new Map<string, Eintrag>();

  const leeren = () => { frisch.clear(); };

  const gebuendelt = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : null;
    const methode = (init?.method ?? 'GET').toUpperCase();
    // Nur einfache GET-Aufrufe an die eigene API; alles andere unverändert.
    if (url === null || !istApi(url, origin) || init?.signal) return fetchImpl(input, init);
    if (methode !== 'GET') { if (SCHREIBEND.has(methode)) leeren(); return fetchImpl(input, init); }
    const pfad = url.startsWith('/') ? url : url.slice(origin.length);
    if (ausnahmen.some(a => pfad.startsWith(a))) return fetchImpl(input, init);

    const key = schluesselFuer(pfad, init);
    const nurLaufend = init?.cache === 'no-store' || init?.cache === 'reload' || init?.cache === 'no-cache';
    if (!nurLaufend) {
      const f = frisch.get(key);
      if (f && jetzt() - f.t < frischMs) return (await f.p).clone();
      if (f) frisch.delete(key);
    }
    const l = laufend.get(key);
    if (l) return (await l).clone();

    const p = fetchImpl(input, init).then(r => {
      // Nur gute Antworten teilen; Fehler soll jeder selbst sehen und neu versuchen dürfen.
      if (r.ok || r.status === 304) { if (!nurLaufend) frisch.set(key, { t: jetzt(), p: Promise.resolve(r) }); }
      return r;
    }).finally(() => { laufend.delete(key); });
    laufend.set(key, p);
    return (await p).clone();
  }) as typeof fetch & { leeren: () => void; stand: () => { laufend: number; frisch: number } };
  gebuendelt.leeren = leeren;
  gebuendelt.stand = () => ({ laufend: laufend.size, frisch: frisch.size });
  return gebuendelt;
}
