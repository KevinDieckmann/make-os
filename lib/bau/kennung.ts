// ─── MAKE OS — Build-Kennung (29.09., A2) ───────────────────────────────────
// Ein Browser-Tab, der vor dem Hochladen geöffnet wurde, läuft mit dem ALTEN Code weiter. Schreibt er, kann er mit
// alten Regeln ganze Einträge ersetzen (Prüfung 29.09.: alte Fenster überschrieben Aufgaben nach dem Umbau). Darum
// trägt jeder Bau eine Kennung (next.config.mjs → `NEXT_PUBLIC_MAKE_BAU`, beim Bauen in Browser- UND Server-Code
// eingesetzt). Der Browser schickt sie bei jeder schreibenden Anfrage an /api als Kopf `x-make-bau` mit
// (components/os/BauWache.tsx, `bauHuelle`); geschützte Routen lehnen eine fremde oder fehlende Kennung mit 409
// `{ neuLaden: true }` ab (lib/bau/pruefen.ts), die Oberfläche zeigt „MAKE OS wurde aktualisiert — bitte neu laden“
// (NEU_LADEN_TEXT als Serverantwort für alte Tabs, NEU_LADEN_HINWEIS im festen Hinweis neuer Tabs).
// Ohne Kennung (Tests, `vitest`) gibt es keine Prüfung. Dienstaufrufe (x-make-key) sind ausgenommen.

export const BAU_KOPF = 'x-make-bau';
export const NEU_LADEN_EREIGNIS = 'make-neu-laden';
/**
 * Die 409-Meldung des Servers. Sie erreicht vor allem ALTE Tabs (Code von vor dem Hochladen), die nur den Fehlertext
 * anzeigen und nichts gemerkt haben — darum verspricht sie nichts (Go-Live-Prüfung 29.09.). Auch der CRM-Hinweis nutzt sie:
 * CRM-Eingaben werden nicht gemerkt.
 */
export const NEU_LADEN_TEXT = 'MAKE OS wurde gerade aktualisiert. Bitte die Seite neu laden. Die letzte Eingabe wurde nicht gespeichert — bitte danach noch einmal eingeben.';
/**
 * Der feste Hinweis NEUER Tabs (components/os/BauWache.tsx). Stimmt so: offene Aufgaben-Änderungen merkt sich der Tab
 * (context/TasksContext.tsx, sessionStorage) und schickt sie nach dem Neuladen mit ihrem alten Stand erneut (bei
 * zwischenzeitlicher Änderung als Konflikt) — alles andere (CRM, Formulare) nicht.
 */
export const NEU_LADEN_HINWEIS = 'MAKE OS wurde aktualisiert — bitte neu laden. Offene Aufgaben-Änderungen bleiben in diesem Tab gemerkt und gehen danach erneut raus; andere Eingaben (z. B. im CRM) bitte noch einmal machen.';

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
