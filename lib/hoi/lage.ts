// ─── Head of IT — die Lage bewerten (rein, getestet, 27.09.) ─────────────────
// Kevin: „Der HOI muss das ganze System immer überwachen, auf Sicherheit
// achten … auch von außen.“ Drei Quellen fließen hier zusammen:
//   innen   — was die App selbst weiß (Prozess, Bestände, Warteschlange, Fehler, Anmeldungen)
//   host    — was deploy/lage-sammeln.sh alle 5 Minuten nach .data/system/lage.json schreibt
//             (Platte, Speicher, Container, fail2ban, Zertifikat, Sicherung)
//   außen   — was die GitHub-Aktion hoi-aussenblick.yml alle 6 Stunden meldet
//             (Status, Antwortzeit, Kopfzeilen, TLS-Rest)
// Jede Zahl bekommt eine Ampel mit Schwelle und Satz; daraus entsteht die Gesamt-
// ampel. Keine Inhalte, keine Adressen, keine Personen — nur Zähler und Zustände.

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau';
export interface Befund { id: string; bereich: 'server' | 'app' | 'sicherheit' | 'aussen' | 'sicherung'; label: string; ampel: Ampel; wert: string; satz: string; seit?: string }

/** Was das Host-Skript liefert (alles optional — ohne Skript bleibt der Teil grau). */
export interface HostLage {
  zeit?: string;
  platte?: { frei_gb?: number; belegt_prozent?: number };
  speicher?: { frei_mb?: number; gesamt_mb?: number; swap_belegt_mb?: number };
  last?: { m1?: number; m5?: number; m15?: number; kerne?: number };
  container?: { name: string; status: string; gesund?: string; neustarts?: number }[];
  fail2ban?: { gesperrt?: number; versuche_24h?: number };
  ssh?: { fehlversuche_24h?: number };
  zertifikat?: { tage?: number; bis?: string };
  sicherung?: { alter_stunden?: number; groesse_mb?: number; datei?: string };
  vault?: { letzter_commit_stunden?: number; konflikt?: boolean };
  kernel_neustart_noetig?: boolean;
  updates?: { sicherheit?: number };
}

export interface AussenLage {
  zeit?: string;
  status?: number;
  ms?: number;
  tlsTage?: number;
  /** Sicherheits-Kopfzeilen, die die Aktion gesehen hat (Name → vorhanden). */
  kopfzeilen?: Record<string, boolean>;
  observatory?: { note?: string; punkte?: number };
}

export interface InnenLage {
  zeit: string;
  prozess: { laufzeitStunden: number; heapMb: number; rssMb: number; node: string };
  bestaende: { anzahl: number; gesamtMb: number; groesste: { name: string; mb: number }[] };
  takt: { letzterLaufMinuten: number | null; fehlerquote24h: number | null; wartend: number; laufend: number };
  fehler: { client24h: number; letzter?: string };
  anmeldungen: { fehl24h: number; neueNetze7d: number };
  csp: { meldungen7d: number; top?: string };
  verschluesselt: boolean;
}

const uhr = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} Tage`);

export function befundeAus(innen: InnenLage, host: HostLage | null, aussen: AussenLage | null, jetzt: string): Befund[] {
  const b: Befund[] = [];
  const alterMin = (zeit?: string) => (zeit ? Math.round((Date.parse(jetzt) - Date.parse(zeit)) / 60_000) : null);

  // ── Server (Host-Skript) ──
  const hostAlter = alterMin(host?.zeit);
  if (!host || hostAlter === null) b.push({ id: 'host', bereich: 'server', label: 'Lage-Sammler', ampel: 'grau', wert: 'keine Daten', satz: 'deploy/lage-sammeln.sh läuft noch nicht (Cron alle 5 min) — Platte, Container, fail2ban und Sicherung bleiben unsichtbar.' });
  else {
    b.push({ id: 'host', bereich: 'server', label: 'Lage-Sammler', ampel: hostAlter <= 15 ? 'gruen' : hostAlter <= 60 ? 'gelb' : 'rot', wert: `vor ${hostAlter} min`, satz: hostAlter <= 15 ? 'meldet regelmäßig' : 'meldet nicht mehr — Cron oder Server prüfen' });
    const p = host.platte;
    if (p?.belegt_prozent != null) b.push({ id: 'platte', bereich: 'server', label: 'Platte', ampel: p.belegt_prozent < 80 ? 'gruen' : p.belegt_prozent < 90 ? 'gelb' : 'rot', wert: `${p.belegt_prozent} % belegt${p.frei_gb != null ? ` · ${p.frei_gb} GB frei` : ''}`, satz: p.belegt_prozent < 80 ? 'genug Platz' : 'aufräumen: Docker-Bilder, Logs, alte Sicherungen' });
    const s = host.speicher;
    if (s?.frei_mb != null && s.gesamt_mb) { const anteil = Math.round((s.frei_mb / s.gesamt_mb) * 100); b.push({ id: 'speicher', bereich: 'server', label: 'Arbeitsspeicher', ampel: anteil >= 15 ? 'gruen' : anteil >= 7 ? 'gelb' : 'rot', wert: `${s.frei_mb} MB frei${s.swap_belegt_mb ? ` · Swap ${s.swap_belegt_mb} MB` : ''}`, satz: anteil >= 15 ? 'Luft vorhanden' : 'knapp — Speichergrenzen der Container prüfen, Upgrade auf 4 GB erwägen' }); }
    const l = host.last;
    if (l?.m5 != null && l.kerne) { const q = l.m5 / l.kerne; b.push({ id: 'last', bereich: 'server', label: 'Auslastung (5 min)', ampel: q < 0.8 ? 'gruen' : q < 1.5 ? 'gelb' : 'rot', wert: `${l.m5.toFixed(2)} auf ${l.kerne} Kern${l.kerne > 1 ? 'en' : ''}`, satz: q < 0.8 ? 'ruhig' : 'dauerhaft ausgelastet — Läufe verteilen oder Kern dazu' }); }
    for (const c of host.container ?? []) {
      const tot = !/up/i.test(c.status); const krank = c.gesund && c.gesund !== 'healthy' && c.gesund !== 'none' && c.gesund !== '';
      b.push({ id: `container:${c.name}`, bereich: 'server', label: `Container ${c.name}`, ampel: tot ? 'rot' : krank ? 'rot' : (c.neustarts ?? 0) >= 3 ? 'gelb' : 'gruen', wert: `${c.status}${c.gesund ? ` · ${c.gesund}` : ''}${c.neustarts ? ` · ${c.neustarts} Neustarts` : ''}`, satz: tot ? 'läuft nicht' : krank ? 'Healthcheck schlägt fehl' : (c.neustarts ?? 0) >= 3 ? 'startet auffällig oft neu — Logs lesen' : 'läuft' });
    }
    if (host.zertifikat?.tage != null) b.push({ id: 'zertifikat', bereich: 'sicherheit', label: 'TLS-Zertifikat', ampel: host.zertifikat.tage > 14 ? 'gruen' : host.zertifikat.tage > 5 ? 'gelb' : 'rot', wert: `${host.zertifikat.tage} Tage gültig`, satz: host.zertifikat.tage > 14 ? 'Caddy erneuert von allein' : 'Erneuerung stockt — Caddy-Logs und Port 80 prüfen' });
    if (host.fail2ban) b.push({ id: 'fail2ban', bereich: 'sicherheit', label: 'SSH-Abwehr', ampel: (host.fail2ban.versuche_24h ?? 0) < 200 ? 'gruen' : 'gelb', wert: `${host.fail2ban.versuche_24h ?? 0} Versuche · ${host.fail2ban.gesperrt ?? 0} gesperrt`, satz: 'fail2ban arbeitet — Passwort-Login ist aus, nur Schlüssel' });
    if (host.sicherung?.alter_stunden != null) b.push({ id: 'sicherung', bereich: 'sicherung', label: 'Letzte Sicherung', ampel: host.sicherung.alter_stunden <= 30 ? 'gruen' : host.sicherung.alter_stunden <= 54 ? 'gelb' : 'rot', wert: `vor ${uhr(host.sicherung.alter_stunden)}${host.sicherung.groesse_mb != null ? ` · ${host.sicherung.groesse_mb} MB` : ''}`, satz: host.sicherung.alter_stunden <= 30 ? 'nächtlich, verschlüsselt' : 'Sicherung ausgefallen — Cron 03:15 und Platz prüfen' });
    else b.push({ id: 'sicherung', bereich: 'sicherung', label: 'Letzte Sicherung', ampel: 'rot', wert: 'keine gefunden', satz: 'in /srv/make-os/sicherungen liegt nichts — sicherung.sh prüfen' });
    if (host.vault?.letzter_commit_stunden != null) b.push({ id: 'vault', bereich: 'sicherung', label: 'Vault-Abgleich', ampel: host.vault.konflikt ? 'rot' : host.vault.letzter_commit_stunden <= 48 ? 'gruen' : 'gelb', wert: host.vault.konflikt ? 'Konflikt' : `letzter Stand vor ${uhr(host.vault.letzter_commit_stunden)}`, satz: host.vault.konflikt ? 'Git-Konflikt im Vault — von Hand lösen' : 'läuft alle 10 Minuten' });
    if (host.kernel_neustart_noetig) b.push({ id: 'neustart', bereich: 'server', label: 'Neustart nötig', ampel: 'gelb', wert: 'Kernel-Update wartet', satz: 'beim nächsten ruhigen Moment neu starten' });
    if ((host.updates?.sicherheit ?? 0) > 0) b.push({ id: 'updates', bereich: 'sicherheit', label: 'Sicherheitsupdates', ampel: (host.updates!.sicherheit ?? 0) > 10 ? 'rot' : 'gelb', wert: `${host.updates!.sicherheit} offen`, satz: 'unattended-upgrades prüfen bzw. apt upgrade' });
  }

  // ── App (innen) ──
  b.push({ id: 'verschluesselt', bereich: 'sicherheit', label: 'Bestände im Ruhezustand', ampel: innen.verschluesselt ? 'gruen' : 'rot', wert: innen.verschluesselt ? 'verschlüsselt' : 'Klartext', satz: innen.verschluesselt ? 'AES-256-GCM je Datei' : 'MAKE_OS_DATEN_SCHLUESSEL fehlt in der .env' });
  const t = innen.takt;
  b.push({ id: 'takt', bereich: 'app', label: 'Arbeiter (Takt)', ampel: t.letzterLaufMinuten === null ? 'grau' : t.letzterLaufMinuten <= 5 ? 'gruen' : t.letzterLaufMinuten <= 30 ? 'gelb' : 'rot', wert: t.letzterLaufMinuten === null ? 'noch kein Lauf' : `vor ${t.letzterLaufMinuten} min · ${t.laufend} laufend · ${t.wartend} wartend`, satz: t.letzterLaufMinuten === null ? 'Arbeiter hat noch nichts gemeldet' : t.letzterLaufMinuten <= 5 ? 'holt fällige Läufe' : 'holt nichts mehr — Container arbeiter prüfen' });
  if (t.fehlerquote24h !== null) b.push({ id: 'fehlerquote', bereich: 'app', label: 'Fehlerquote der Läufe · 24 h', ampel: t.fehlerquote24h < 10 ? 'gruen' : t.fehlerquote24h < 30 ? 'gelb' : 'rot', wert: `${t.fehlerquote24h} %`, satz: t.fehlerquote24h < 10 ? 'Läufe laufen durch' : 'viele Fehlschläge — Guthaben, Schlüssel oder eine defekte Route' });
  b.push({ id: 'clientfehler', bereich: 'app', label: 'Fehler in der Oberfläche · 24 h', ampel: innen.fehler.client24h === 0 ? 'gruen' : innen.fehler.client24h < 10 ? 'gelb' : 'rot', wert: String(innen.fehler.client24h), satz: innen.fehler.client24h ? `zuletzt: ${(innen.fehler.letzter ?? '').slice(0, 80)}` : 'keine Meldungen' });
  b.push({ id: 'anmeldungen', bereich: 'sicherheit', label: 'Fehlanmeldungen · 24 h', ampel: innen.anmeldungen.fehl24h < 5 ? 'gruen' : innen.anmeldungen.fehl24h < 20 ? 'gelb' : 'rot', wert: `${innen.anmeldungen.fehl24h}${innen.anmeldungen.neueNetze7d ? ` · ${innen.anmeldungen.neueNetze7d} neue Netze in 7 Tagen` : ''}`, satz: innen.anmeldungen.fehl24h < 5 ? 'unauffällig' : 'jemand probiert Passwörter — Bremse und Zweiter Faktor greifen' });
  b.push({ id: 'csp', bereich: 'sicherheit', label: 'CSP-Meldungen · 7 Tage', ampel: innen.csp.meldungen7d === 0 ? 'gruen' : innen.csp.meldungen7d < 20 ? 'gelb' : 'rot', wert: String(innen.csp.meldungen7d), satz: innen.csp.meldungen7d ? `häufigste: ${innen.csp.top ?? '—'}` : 'nichts blockiert' });
  b.push({ id: 'heap', bereich: 'app', label: 'App-Speicher', ampel: innen.prozess.rssMb < 900 ? 'gruen' : innen.prozess.rssMb < 1150 ? 'gelb' : 'rot', wert: `${innen.prozess.rssMb} MB · seit ${uhr(innen.prozess.laufzeitStunden)}`, satz: innen.prozess.rssMb < 900 ? 'unter der Grenze (1280 MB)' : 'nah an der Speichergrenze — Neustart droht' });
  b.push({ id: 'bestaende', bereich: 'app', label: 'Bestände', ampel: innen.bestaende.gesamtMb < 50 ? 'gruen' : innen.bestaende.gesamtMb < 200 ? 'gelb' : 'rot', wert: `${innen.bestaende.anzahl} Dateien · ${innen.bestaende.gesamtMb.toFixed(1)} MB`, satz: `größte: ${innen.bestaende.groesste.slice(0, 3).map(x => `${x.name} ${x.mb.toFixed(1)} MB`).join(', ')}` });

  // ── Außen ──
  const aAlter = alterMin(aussen?.zeit);
  if (!aussen || aAlter === null) b.push({ id: 'aussen', bereich: 'aussen', label: 'Außenblick', ampel: 'grau', wert: 'keine Meldung', satz: 'GitHub-Aktion hoi-aussenblick.yml meldet alle 6 Stunden — braucht MAKE_OS_KEY_HOI und MAKE_OS_ADRESSE in den Repo-Einstellungen.' });
  else {
    const frisch = aAlter <= 8 * 60;
    b.push({ id: 'aussen', bereich: 'aussen', label: 'Erreichbar von außen', ampel: !frisch ? 'gelb' : aussen.status === 200 ? (aussen.ms != null && aussen.ms > 3000 ? 'gelb' : 'gruen') : 'rot', wert: `Status ${aussen.status ?? '—'} · ${aussen.ms ?? '—'} ms · vor ${uhr(aAlter / 60)}`, satz: !frisch ? 'letzte Meldung ist alt — läuft die Aktion?' : aussen.status === 200 ? 'antwortet' : 'antwortet nicht wie erwartet' });
    if (aussen.tlsTage != null) b.push({ id: 'tls-aussen', bereich: 'aussen', label: 'Zertifikat (von außen)', ampel: aussen.tlsTage > 14 ? 'gruen' : aussen.tlsTage > 5 ? 'gelb' : 'rot', wert: `${aussen.tlsTage} Tage`, satz: 'gesehen vom GitHub-Läufer' });
    const k = aussen.kopfzeilen ?? {};
    const fehlen = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy'].filter(h => !k[h]);
    b.push({ id: 'kopfzeilen', bereich: 'aussen', label: 'Sicherheits-Kopfzeilen', ampel: !fehlen.length ? 'gruen' : fehlen.length <= 2 ? 'gelb' : 'rot', wert: fehlen.length ? `fehlt: ${fehlen.join(', ')}` : 'alle sechs gesetzt', satz: fehlen.length ? 'next.config.mjs bzw. Caddyfile prüfen' : 'HSTS, CSP, nosniff, Referrer, Frame, Permissions' });
    if (aussen.observatory?.note) b.push({ id: 'observatory', bereich: 'aussen', label: 'Mozilla Observatory', ampel: /^A/.test(aussen.observatory.note) ? 'gruen' : /^B/.test(aussen.observatory.note) ? 'gelb' : 'rot', wert: `${aussen.observatory.note}${aussen.observatory.punkte != null ? ` · ${aussen.observatory.punkte}` : ''}`, satz: 'wöchentlicher Scan' });
  }
  return b;
}

const RANG: Record<Ampel, number> = { rot: 3, gelb: 2, gruen: 1, grau: 0 };
/** Gesamtampel: rot schlägt gelb schlägt grün; grau zählt nicht (nur, wenn alles grau ist). */
export function gesamt(befunde: Befund[]): { ampel: Ampel; rot: number; gelb: number; gruen: number; grau: number } {
  const z = { rot: 0, gelb: 0, gruen: 0, grau: 0 };
  for (const b of befunde) z[b.ampel]++;
  const ampel: Ampel = z.rot ? 'rot' : z.gelb ? 'gelb' : z.gruen ? 'gruen' : 'grau';
  return { ampel, ...z };
}
export const nachRang = (l: Befund[]) => [...l].sort((a, b) => RANG[b.ampel] - RANG[a.ampel]);

/** Kurztext für Telegram / Wochenbericht. */
export function kurzbericht(befunde: Befund[], jetzt: string): string {
  const g = gesamt(befunde);
  const kopf = `🛠 Head of IT · ${jetzt.slice(0, 10)} · ${g.ampel === 'gruen' ? 'alles grün' : g.ampel === 'gelb' ? `${g.gelb} gelb` : `${g.rot} ROT, ${g.gelb} gelb`}`;
  const zeilen = nachRang(befunde).filter(b => b.ampel === 'rot' || b.ampel === 'gelb').slice(0, 8).map(b => `${b.ampel === 'rot' ? '🔴' : '🟡'} ${b.label}: ${b.wert} — ${b.satz}`);
  return [kopf, ...zeilen].join('\n');
}
