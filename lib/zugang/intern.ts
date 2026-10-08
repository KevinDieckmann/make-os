// ─── MAKE OS — Kommt eine Anfrage von innen? (05.10., Paket „Zugang & Schlüssel härten“ Punkt 1) ─────
// Der Dienstschlüssel (MAKE_OS_KEY, Kopf x-make-key) öffnet alles. Bis 05.10. galt er auch von außen — wer ihn
// kannte, kam über Caddy an jede Route. Seitdem gilt er NUR für Anfragen aus dem eigenen Haus:
//   · der Arbeiter-Container (http://app:3000 im Docker-Netz, private Adresse 172.x),
//   · Aufrufe der App an sich selbst (MAKE_OS_INTERN=http://localhost:3000, Loopback),
//   · `docker compose exec app node …` (Sicherung, Schreibpause, Rotation — Loopback),
//   · am Mac die lokale Instanz (localhost:3001, Zulieferer, Skripte).
// Woran erkennbar: Next setzt `x-forwarded-for` selbst auf die Adresse des Gegenübers, wenn der Kopf fehlt
// (base-server.js, `??=`). Hinter Caddy steht dort die öffentliche Adresse des Aufrufers — Caddy verwirft dabei,
// was der Aufrufer selbst mitschickt (keine `trusted_proxies`). Intern ist eine Anfrage also genau dann, wenn JEDE
// Adresse in `x-forwarded-for` Loopback oder privat ist (oder der Kopf fehlt: Tests, Aufrufe ohne Socket).
// Zusätzlich setzt Caddy `X-Make-Vorbau: 1` (deploy/caddy/Caddyfile): steht der Kopf da, ist die Anfrage von außen.
//
// Bewusst NICHT intern: 100.64.0.0/10 (Tailscale/CGNAT) und 169.254.0.0/16 — das sind fremde Geräte.
// Rein und ohne Node-Module: die Middleware (Edge-Laufzeit) und die Routen (Node) nutzen dieselbe Prüfung.

/** IPv4 in vier Zahlen — oder null. */
function v4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const z = m.slice(1).map(Number);
  return z.every(n => n >= 0 && n <= 255) ? z : null;
}

/** Loopback oder privates Netz (RFC 1918, IPv6 ULA fc00::/7, Loopback ::1, IPv4 in IPv6 gemappt). */
export function istPrivateAdresse(roh: string): boolean {
  let ip = roh.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  // „1.2.3.4:5678“ (IPv4 mit Port) — IPv6 hat mehrere Doppelpunkte und bleibt unberührt.
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  const gemappt = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (gemappt) ip = gemappt[1];
  const a = v4(ip);
  if (a) {
    if (a[0] === 127 || a[0] === 10) return true;
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true;
    if (a[0] === 192 && a[1] === 168) return true;
    return false;
  }
  if (!ip.includes(':')) return false;
  if (ip === '::1') return true;
  return /^f[cd][0-9a-f]{0,2}:/.test(ip);
}

/** Kam die Anfrage von innen (Docker-Netz, Loopback, lokaler Mac) — und NICHT über den Vorbau (Caddy)? */
export function anfrageIntern(kopf: { get(n: string): string | null }): boolean {
  if (kopf.get('x-make-vorbau')) return false;
  const xff = kopf.get('x-forwarded-for');
  if (xff === null) return true;
  const teile = xff.split(',').map(s => s.trim()).filter(Boolean);
  if (!teile.length) return true;
  return teile.every(istPrivateAdresse);
}

/** Mindestlänge eingeschränkter Schlüssel (HOI, Zulieferer) — kürzer gilt als nicht gesetzt. */
export const EINGESCHRAENKT_MIN = 24;

/**
 * Der eigene Schlüssel des Mac-Zulieferers (MAKE_OS_ZULIEFERER_KEY): öffnet NUR die Zulieferungs-Routen, nie den
 * Dienstweg. Leer bzw. zu kurz → null; dann gilt der Übergang (MAKE_OS_KEY von außen nur für die Zulieferung).
 */
export function zuliefererSchluessel(): string | null {
  const s = process.env.MAKE_OS_ZULIEFERER_KEY?.trim();
  return s && s.length >= EINGESCHRAENKT_MIN ? s : null;
}

/** Die Routen, die der Mac-Zulieferer beschreiben darf (zulieferer.mjs: POST /api/zulieferung). */
export const ZULIEFERUNG = /^\/api\/zulieferung$/;

// ── Zulieferer abschalten (08.10., Lücke 10 / R6: „alles nur auf dem Server führen“) ─────────────────────────────────
// Die Umgebung `MAKE_OS_ZULIEFERER=aus|an` gewinnt vor der Instanz-Einstellung des Inhabers (lib/zulieferer/schalter.ts). Mit
// `aus` antwortet schon die Middleware auf POST /api/zulieferung mit 410 — vor jeder Schlüsselprüfung, damit auch der Übergang
// (MAKE_OS_KEY von außen) zu ist. Rein und ohne Node-Module (Edge-Laufzeit der Middleware).

/** Die Umgebung schaltet den Zulieferer ausdrücklich: 'aus' | 'an' — sonst null (dann gilt die Einstellung des Inhabers). */
export function zuliefererUmgebung(env: Record<string, string | undefined> = process.env): 'an' | 'aus' | null {
  const w = (env.MAKE_OS_ZULIEFERER ?? '').trim().toLowerCase();
  if (/^(aus|0|nein|false|off)$/.test(w)) return 'aus';
  if (/^(an|1|ja|true|on)$/.test(w)) return 'an';
  return null;
}

/** Der Satz, mit dem der Server einen Zulieferer abweist, der nicht mehr gebraucht wird (410 Gone). Keine Werte, keine Namen. */
export const ZULIEFERER_AUS_TEXT = 'Der Mac-Zulieferer ist abgeschaltet — Erinnerungen und Kontakte führt MAKE OS jetzt selbst. Am Mac den Dienst entfernen: bash scripts/mac-zulieferer-entfernen.sh (erst ohne --ausfuehren ansehen).';
/** Antwort-Körper für 410 (Middleware und Route). */
export const ZULIEFERER_AUS_ANTWORT = { ok: false, abgeschaltet: true, fehler: ZULIEFERER_AUS_TEXT } as const;
