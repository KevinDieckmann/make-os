// ─── MAKE OS — Demo-Instanz: die Schutzregeln (rein, getestet) ─────────────────────────────────────────────────────────
// Kevin 04./05.10.: „Wir müssen alles anpassbar haben, auch wenn wir mal einen Demo-Account machen.“ Plattform-Regel: „Zeigbar —
// alles mit erfundenen Beispieldaten (Demo-Instanz) vorführbar“ und „Testkunden nie auf unserer Instanz — eigene Instanz
// (eigener Container/Datenordner/Schlüssel/Adresse)“. Doku: DEMO.md.
//
// Hier steht NUR, wann gesät bzw. zurückgesetzt werden darf — mehrere unabhängige Riegel, jeder für sich reicht zum Abbruch:
//   1. Demo-Schalter     `MAKE_OS_DEMO=1` — ohne ihn gibt es den Zurücksetzen-Weg nicht (Route 404).
//   2. Eigener Ordner    `MAKE_OS_DATEN_DIR` ausdrücklich gesetzt; nie `<repo>/.data`, nie ein Pfad mit einem `.data`-Glied
//                        (unser echter Datenordner heißt so — lokal und auf dem Server).
//   3. Säen              nur in einen LEEREN Ordner (bis auf Systemdateien wie `.DS_Store`).
//   4. Zurücksetzen      nur, wenn die Demo-Marke (Bestand `demo-instanz`) da ist UND alle Konten auf `@example.invalid` enden.
//   5. Umgebung          keine echten Quellen (Vault, iCloud-Dokumente, Mac-Programme, Google, iCloud-Kalender, Telegram) und die
//                        internen Aufrufe bleiben in der eigenen Instanz (`MAKE_OS_INTERN` oder `PORT`) — sonst gingen sie an :3001.

import path from 'node:path';

/** Bestand mit der Demo-Marke (kein Personenbezug) — nur die Saat legt ihn an. */
export const DEMO_MARKE = 'demo-instanz';
/** Version der Saat (steht in der Marke; ändert sich, wenn sich die Beispieldaten grundlegend ändern). */
export const DEMO_SAAT_VERSION = 1;
/** Konten der Demo tragen nur reservierte Adressen (RFC 2606) — echte Adressen = kein Demo-Ordner. */
export const DEMO_DOMAIN = 'example.invalid';
/** Dateien, die ein „leerer“ Ordner haben darf. */
const SYSTEM_DATEIEN = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);
/** Diese Dateien bleiben beim Zurücksetzen liegen (der Such-Index ist im laufenden Server geöffnet und baut sich selbst nach). */
export const BLEIBT_BEIM_ZURUECKSETZEN = /^brain-index\.sqlite(?:-wal|-shm|-journal)?$/;

export type Umgebung = Record<string, string | undefined>;

export const istDemoInstanz = (env: Umgebung = process.env): boolean => env.MAKE_OS_DEMO === '1';

/** Riegel 2: Ist das ein eigener, ausdrücklich gesetzter Datenordner und nicht unserer? Gründe für den Abbruch (leer = ok). */
export function ordnerGruende(o: { env: Umgebung; cwd: string }): string[] {
  const roh = o.env.MAKE_OS_DATEN_DIR?.trim();
  if (!roh) return ['MAKE_OS_DATEN_DIR ist nicht gesetzt — ohne eigenen Datenordner läge die Demo in den echten Beständen (<repo>/.data).'];
  const dir = path.resolve(roh);
  const gruende: string[] = [];
  if (dir === path.resolve(o.cwd, '.data')) gruende.push('Der Datenordner ist <repo>/.data — das ist der echte Bestand.');
  if (dir.split(path.sep).some(t => t === '.data')) gruende.push(`Der Pfad enthält „.data“ (${dir}) — so heißt unser echter Datenordner; die Demo bekommt einen eigenen Namen.`);
  if (dir === path.parse(dir).root) gruende.push('Der Datenordner ist das Wurzelverzeichnis.');
  return gruende;
}

/** Riegel 3: Säen nur in einen leeren Ordner. `dateien` = Einträge des Ordners (fehlt der Ordner: leer). */
export function leerGruende(dateien: readonly string[]): string[] {
  const rest = dateien.filter(d => !SYSTEM_DATEIEN.has(d));
  return rest.length ? [`Der Datenordner ist nicht leer (${rest.length} Einträge, z. B. ${rest.slice(0, 3).join(', ')}) — gesät wird nur in einen leeren Ordner.`] : [];
}

/** Riegel 4: Zurücksetzen nur in einer Demo — Marke da, alle Konten mit reservierter Adresse. */
export function zuruecksetzenGruende(o: { marke: unknown; konten: readonly { email?: unknown; weitereEmails?: unknown }[] | null }): string[] {
  const gruende: string[] = [];
  const m = o.marke as { saat?: unknown } | null;
  if (!m || typeof m !== 'object' || typeof m.saat !== 'number') gruende.push('Keine Demo-Marke im Datenordner — das ist keine gesäte Demo-Instanz.');
  const adressen = (o.konten ?? []).flatMap(k => [k.email, ...(Array.isArray(k.weitereEmails) ? k.weitereEmails : [])]);
  const fremd = adressen.filter(a => typeof a !== 'string' || !a.toLowerCase().endsWith(`@${DEMO_DOMAIN}`));
  if (fremd.length) gruende.push(`${fremd.length} Konto-Adresse${fremd.length === 1 ? '' : 'n'} ohne @${DEMO_DOMAIN} — echte Konten werden nie zurückgesetzt.`);
  return gruende;
}

/**
 * Riegel 5: Umgebung einer Demo-Instanz. Liefert Gründe, warum die laufende Instanz echte Quellen erreichen könnte.
 * `dir` = Datenordner (der Vault der Demo muss darin liegen, damit Zurücksetzen ihn mit erfasst).
 */
export function umgebungGruende(env: Umgebung, dir: string | undefined): string[] {
  const g: string[] = [];
  if (env.MAKE_OS_OHNE_APPLE !== '1') g.push('MAKE_OS_OHNE_APPLE=1 fehlt — am Mac läsen Mail, Kalender, Erinnerungen und Kontakte sonst die echten Programme.');
  if (env.MAKE_OS_DOKU_WURZEL !== 'aus') g.push('MAKE_OS_DOKU_WURZEL=aus fehlt — das Brain läse sonst die echten iCloud-Dokumente.');
  const vault = env.MAKE_VAULT_DIR?.trim();
  if (!vault) g.push('MAKE_VAULT_DIR fehlt — das Brain läse sonst den echten Vault.');
  else if (dir && !path.resolve(vault).startsWith(path.resolve(dir) + path.sep)) g.push('MAKE_VAULT_DIR liegt nicht im Datenordner der Demo — Wissen gehört in die Demo (z. B. <daten>/wissen).');
  if (!env.MAKE_OS_INTERN?.trim() && !env.PORT?.trim()) g.push('MAKE_OS_INTERN bzw. PORT fehlt — interne Aufrufe (Morgenlauf, Tageslauf) gingen sonst an localhost:3001, die echte Instanz.');
  if (env.ICLOUD_APPLE_ID || env.ICLOUD_APP_PASSWORT) g.push('ICLOUD_* ist gesetzt — die Demo zeigt Termine nur aus ihrem eigenen Bestand, nie aus einem echten Kalender.');
  if (env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET) g.push('GOOGLE_* ist gesetzt — keine echten Google-Konten in der Demo.');
  if (env.TELEGRAM_BOT_TOKEN) g.push('TELEGRAM_BOT_TOKEN ist gesetzt — die Demo verschickt nichts.');
  if (env.WHOOP_CLIENT_ID || env.MS_CLIENT_ID) g.push('WHOOP_*/MS_* ist gesetzt — keine echten Verbindungen in der Demo.');
  return g;
}

/**
 * Hinweise (blockieren nichts): ohne diese Variablen zeigt die Demo die Namen unserer Instanz (die drei festen Gesellschaften,
 * das Markttraktion-Team) — lib/einheiten.ts, lib/crm/team.ts.
 */
export function namenHinweise(env: Umgebung): string[] {
  const h: string[] = [];
  if (!env.NEXT_PUBLIC_MAKE_OS_EINHEITEN) h.push('NEXT_PUBLIC_MAKE_OS_EINHEITEN fehlt — die drei festen Gesellschaften hießen sonst wie in unserer Instanz.');
  if (!env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM) h.push('NEXT_PUBLIC_MAKE_OS_CRM_TEAM fehlt — Markttraktion zeigte sonst unser Team als Zuständige.');
  return h;
}

/** Deterministische UUID (Form v4) aus einem Text — gleiche Saat, gleiche Kennungen (Links bleiben nach dem Zurücksetzen gültig). */
export function demoUuid(text: string, hash: (s: string) => string): string {
  const h = hash(`make-os-demo:${text}`).slice(0, 32).split('');
  h[12] = '4';
  h[16] = '89ab'[parseInt(h[16], 16) % 4];
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
