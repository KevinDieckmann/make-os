// ─── KI-Prüfendpunkt: Modell-Aufrufe für lokale Prüfungen an ein nachgebautes Modell (09.10.2026, „Agenten live durchgeklickt“) ─────
// Kevin 09.10.: „Das muss perfekt laufen. Schau, dass alles verbunden ist und die Agents sauber laufen.“ Bisher war der Agenten-Bereich nur in
// Vitest (Fake-fetch) geprüft — niemand hatte die Oberfläche mit antwortenden Agenten bedient. Dafür lenkt EINE eng gefasste Variable die
// Messages-API (lib/anthropic.ts: askText, askStream, askJson, askWithSearch) auf ein nachgebautes Modell (scripts/ki-pruefmodell.mjs) um:
//
//   MAKE_OS_KI_PRUEFENDPUNKT=http://127.0.0.1:4599     (Basis-Adresse; „/v1/messages“ wird angehängt, wenn es fehlt)
//
// Sie gilt NUR, wenn
//   (a) das Ziel loopback ist — Host genau 127.0.0.1, localhost oder [::1], http oder https, ohne Benutzer/Passwort — UND
//   (b) MAKE_OS_DEMO=1 (Demo-Instanz mit erfundenen Daten) ODER NODE_ENV ≠ production (Entwicklung, Tests).
// Sonst wird sie IGNORIERT (askText spricht wie immer mit api.anthropic.com) und beim Start gewarnt; auf einer öffentlichen Instanz (Start-Riegel
// „scharf“/„streng“) startet MAKE OS mit gesetzter Variable gar nicht (lib/zugang/start-riegel.ts), der Head of IT zeigt sie rot.
// Mit Umlenkung geht NIE der echte Schlüssel hinaus — immer der feste Platzhalter `PRUEF_SCHLUESSEL` (auch wenn ANTHROPIC_API_KEY gesetzt ist).
// Nicht umgelenkt (bewusst): Claude über Vertex EU, Bilder/Video/Tiefenbericht (Google Vertex) und Transkription (Mistral) — sie gehen über
// lib/ki/adapter/http.ts mit fester Host-Liste je Anbieter; ohne deren Einrichtung sind sie in einer Prüf-Instanz ohnehin aus.
// Rein und ohne Node-Module (die Middleware/der Riegel dürfen es laden).

export const PRUEF_VARIABLE = 'MAKE_OS_KI_PRUEFENDPUNKT';
/** Fester Platzhalter statt des echten Schlüssels — das Prüfmodell braucht keinen, und ein echter Schlüssel reist nie an einen Prüfendpunkt. */
export const PRUEF_SCHLUESSEL = 'pruefmodell-kein-echter-schluessel';

type Env = Record<string, string | undefined>;

export type PruefGrund = 'kein-loopback' | 'produktion' | 'ungueltig';
export type PruefLage =
  | { gesetzt: false }
  | { gesetzt: true; aktiv: true; url: string }
  | { gesetzt: true; aktiv: false; grund: PruefGrund };

/** Genau diese Hosts gelten als loopback — kein Namensauflösen, keine Teilnamen („localhost.example.com“, „127.0.0.1.nip.io“ zählen nicht). */
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** Ist die Umlenkung wirksam? Rein: liest nur `env`. */
export function pruefEndpunkt(env: Env = process.env): PruefLage {
  const roh = (env[PRUEF_VARIABLE] ?? '').trim();
  if (!roh) return { gesetzt: false };
  let u: URL;
  try { u = new URL(roh); } catch { return { gesetzt: true, aktiv: false, grund: 'ungueltig' }; }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password || u.search || u.hash) return { gesetzt: true, aktiv: false, grund: 'ungueltig' };
  if (!LOOPBACK.has(u.hostname.toLowerCase())) return { gesetzt: true, aktiv: false, grund: 'kein-loopback' };
  if (env.NODE_ENV === 'production' && (env.MAKE_OS_DEMO ?? '').trim() !== '1') return { gesetzt: true, aktiv: false, grund: 'produktion' };
  const pfad = u.pathname.replace(/\/+$/, '');
  const url = `${u.protocol}//${u.host}${pfad.endsWith('/v1/messages') ? pfad : `${pfad}/v1/messages`}`;
  return { gesetzt: true, aktiv: true, url };
}

/** Kurzform: die Ziel-Adresse der Umlenkung — `null` = keine (dann gilt api.anthropic.com). */
export function pruefUrl(env: Env = process.env): string | null {
  const p = pruefEndpunkt(env);
  return p.gesetzt && p.aktiv ? p.url : null;
}

/** Ein Satz für Log und Head of IT — nie der Wert der Variable (er ist zwar kein Geheimnis, gehört aber nicht in Berichte). */
export function pruefSatz(p: PruefLage): string | null {
  if (!p.gesetzt) return null;
  if (p.aktiv) return `${PRUEF_VARIABLE} ist aktiv — Modell-Antworten kommen vom nachgebauten Prüfmodell (lokal), kein echter KI-Aufruf, kein echter Schlüssel.`;
  if (p.grund === 'produktion') return `${PRUEF_VARIABLE} ist gesetzt, wird aber IGNORIERT (Produktion ohne MAKE_OS_DEMO=1) — die Zeile aus der .env nehmen.`;
  if (p.grund === 'kein-loopback') return `${PRUEF_VARIABLE} ist gesetzt, wird aber IGNORIERT (Ziel ist nicht 127.0.0.1/localhost/[::1]) — die Zeile aus der .env nehmen.`;
  return `${PRUEF_VARIABLE} ist gesetzt, aber keine gültige http(s)-Adresse — wird ignoriert.`;
}
