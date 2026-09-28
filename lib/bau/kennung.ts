// ─── MAKE OS — Build-Kennung (29.09., A2) ───────────────────────────────────
// Ein Browser-Tab, der vor dem Hochladen geöffnet wurde, läuft mit dem ALTEN Code weiter. Schreibt er, kann er mit
// alten Regeln ganze Einträge ersetzen (Prüfung 29.09.: alte Fenster überschrieben Aufgaben nach dem Umbau). Darum
// trägt jeder Bau eine Kennung (next.config.mjs → `NEXT_PUBLIC_MAKE_BAU`, beim Bauen in Browser- UND Server-Code
// eingesetzt). Der Browser schickt sie bei jeder schreibenden Anfrage an /api als Kopf `x-make-bau` mit
// (components/os/BauWache.tsx, `bauHuelle`); geschützte Routen lehnen eine fremde oder fehlende Kennung mit 409
// `{ neuLaden: true }` ab (lib/bau/pruefen.ts), die Oberfläche zeigt „MAKE OS wurde aktualisiert — bitte neu laden“.
// Ohne Kennung (Tests, `vitest`) gibt es keine Prüfung. Dienstaufrufe (x-make-key) sind ausgenommen.

export const BAU_KOPF = 'x-make-bau';
export const NEU_LADEN_EREIGNIS = 'make-neu-laden';
export const NEU_LADEN_TEXT = 'MAKE OS wurde aktualisiert — bitte neu laden. Deine offenen Änderungen bleiben in diesem Tab gemerkt.';

/** Die Kennung dieses Baus (null ohne — dann keine Prüfung). Muss als `process.env.NEXT_PUBLIC_MAKE_BAU` stehen (Ersetzung beim Bauen). */
export function bauKennung(): string | null {
  const b = process.env.NEXT_PUBLIC_MAKE_BAU;
  return typeof b === 'string' && b.trim() ? b.trim() : null;
}

/** Ist das eine Antwort „bitte neu laden“ (Build-Kennung passt nicht)? */
export const istNeuLaden = (status: number, d: unknown): boolean => status === 409 && !!d && typeof d === 'object' && (d as { neuLaden?: unknown }).neuLaden === true;

/**
 * Fetch-Hülle für den Browser (rein, testbar): schreibende Anfragen (nicht GET/HEAD) an den eigenen Ursprung unter /api
 * bekommen den Kopf `x-make-bau`; eine Antwort 409 `{ neuLaden: true }` meldet `melden()` (einmal je Antwort).
 */
export function bauHuelle(original: typeof fetch, ursprung: string, kennung: string | null, melden: () => void): typeof fetch {
  const eigen = (url: string): boolean => {
    try { const u = new URL(url, ursprung); return u.origin === ursprung && u.pathname.startsWith('/api/'); } catch { return false; }
  };
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const methode = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    const schreibt = methode !== 'GET' && methode !== 'HEAD' && eigen(url);
    let weiter = init;
    if (schreibt && kennung) {
      const h = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
      if (!h.has(BAU_KOPF)) h.set(BAU_KOPF, kennung);
      weiter = { ...init, headers: h };
    }
    const r = await original(input, weiter);
    if (schreibt && r.status === 409) {
      r.clone().json().then(d => { if (istNeuLaden(409, d)) melden(); }).catch(() => { /* keine JSON-Antwort */ });
    }
    return r;
  };
}
