// ─── ZOE/Agenten schreiben über die offiziellen Routen (Regel 7) — die EINE Stelle für den internen Hop ──────────────
// Entstanden mit `crm_vorschlag` (28.09., C7): eine eigene Route wird im Prozess aufgerufen — Dienstschlüssel + `x-make-person`
// der AUSLÖSENDEN Person (bei der Freigabe: wer im Stapel geklickt hat). Dieselben Prüfungen wie ein Klick in der Oberfläche
// (Haushalt, privater Finanzzugang, Stand/409, Grenzen/413, Art. 18, Anlass-Pflicht, Deal-Regeln), im Änderungsprotokoll als
// `{ art: 'zoe', person }` (`werAus`).
//
// Seit 09.10. (Funde der Abdeckungs-Analyse, „ZOE-Schreibwege“) auch für die Finanz-, Planungs- und CRM-Altwerkzeuge in
// lib/zoe/werkzeuge.ts: vorher schrieben sie mit `updateJson` direkt in `finanzplan`/`liquiplan`/`finance`/`meilensteine`/`ziele`
// bzw. die Kartei — ohne Fassung/409, ohne `privatFinanzZugang` (ein Konto „nur Business“ schrieb über ZOE, was die Route
// verweigert), ohne Buchung bei „bezahlt“, ohne Kette/Bezugsprüfung, ohne Anlass-Pflicht und Sperrliste.
// Neue schreibende ZOE-Werkzeuge: IMMER über `innen()` — nie am Schreibweg vorbei. Neue Route → Zeile in `ROUTEN`.

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Die Routen, die ZOE/Agenten intern aufrufen dürfen (dynamisch geladen: die Routen lesen ihrerseits das ZOE-Register). */
const ROUTEN = {
  '/api/crm/aktivitaet': () => import('@/app/api/crm/aktivitaet/route'),
  '/api/crm/followup': () => import('@/app/api/crm/followup/route'),
  '/api/crm/deal': () => import('@/app/api/crm/deal/route'),
  '/api/crm/bestand': () => import('@/app/api/crm/bestand/route'),
  '/api/state/kontakte': () => import('@/app/api/state/kontakte/route'),
  '/api/crm/lead': () => import('@/app/api/crm/lead/route'),
  '/api/crm/dubletten': () => import('@/app/api/crm/dubletten/route'),
  '/api/crm/verbindungen': () => import('@/app/api/crm/verbindungen/route'),
  '/api/crm/angebot': () => import('@/app/api/crm/angebot/route'),
  '/api/crm/import': () => import('@/app/api/crm/import/route'),
  '/api/tasks/create': () => import('@/app/api/tasks/create/route'),
  '/api/heads/[head]': () => import('@/app/api/heads/[head]/route'),
  // 29.09. (#K2): Kalender-Vorschläge des Kalender-Agenten — anlegen nur über den Termin-Schreibweg (lib/zoe/kalender-vorschlag.ts).
  '/api/kalender/termin': () => import('@/app/api/kalender/termin/route'),
  // 09.10.: Finanzen (Altweg der Firmenkonten, Rechnungen, Zahlungen — `finanz-privat`), Liquiplan (`finanz-privat`), Controlling (`haushalt`).
  '/api/state/finanzplan': () => import('@/app/api/state/finanzplan/route'),
  '/api/state/liquiplan': () => import('@/app/api/state/liquiplan/route'),
  '/api/state/finance': () => import('@/app/api/state/finance/route'),
  // 09.10.: Planung — Meilensteine (Kette, Bezüge, Liste je Meilenstein) und Ziele (Fokus).
  '/api/state/meilensteine': () => import('@/app/api/state/meilensteine/route'),
  '/api/state/ziele': () => import('@/app/api/state/ziele/route'),
} as const;

export type InnenPfad = keyof typeof ROUTEN;
export type InnenAntwort = { status: number; json: Record<string, unknown> };

/**
 * Eine eigene Route im Prozess aufrufen — wie ein interner Hop (Regel 7): Dienstschlüssel + `x-make-person`.
 * Ohne Person gibt es keinen Aufruf (Regel 5: nie ein Rückfall auf eine feste Person) — 401 wie die Routen.
 */
export async function innen(pfad: InnenPfad, methode: 'GET' | 'POST' | 'PATCH' | 'PUT', body: unknown, person: string, params?: Record<string, string>): Promise<InnenAntwort> {
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return { status: 401, json: { ok: false, fehler: 'Keine Person — ohne auslösende Person schreibt ZOE nichts.' } };
  const schluessel = process.env.MAKE_OS_KEY;
  if (!schluessel) return { status: 503, json: { fehler: 'Dienstschlüssel fehlt (MAKE_OS_KEY) — gerade nicht möglich.' } };
  const mod = await ROUTEN[pfad]() as Record<string, unknown>;
  const h = mod[methode] as Handler | undefined;
  if (typeof h !== 'function') return { status: 405, json: { fehler: `${methode} ${pfad} gibt es nicht.` } };
  // Dynamische Routen (Next 15.5): `params` ist ein Promise — wie Next es der Route übergibt.
  const url = pfad.replace(/\[(\w+)\]/g, (_, n: string) => encodeURIComponent(params?.[n] ?? ''));
  const res = await h(new Request(`http://innen${url}`, {
    method: methode, headers: { 'content-type': 'application/json', 'x-make-key': schluessel, 'x-make-person': person },
    ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
  }), { params: Promise.resolve(params ?? {}) });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { status: res.status, json };
}

/** Der Fehlertext einer Antwort (Routen schreiben `fehler` oder `error`). */
export const innenFehler = (a: InnenAntwort): string => String(a.json.fehler ?? a.json.error ?? `Abgelehnt (${a.status}).`);
/** Hat die Route abgelehnt? */
export const innenNein = (a: InnenAntwort): boolean => a.status >= 400 || a.json.ok === false;
