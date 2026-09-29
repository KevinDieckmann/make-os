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
  /**
   * Vault-Abgleich (29.09., Paket D-B #97): `letzter_push_stunden` aus der Marke, die deploy/vault-abgleich.sh nach
   * jedem erfolgreichen Push schreibt (lokale Commits zählen nicht); `konflikt` = Rebase abgebrochen (Markerdatei),
   * `push_fehler` = Push gescheitert (Markerdatei). Ohne Marke (altes Skript) gilt `letzter_commit_stunden`.
   */
  vault?: { letzter_commit_stunden?: number; letzter_push_stunden?: number; konflikt?: boolean; push_fehler?: boolean };
  /** Letzte bestätigte Abholung durch den Mac (deploy/sicherung-ausgeben.sh → daten/system/abholung.json, 29.09.). */
  abholung?: { alter_stunden?: number | null; datei?: string | null };
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
  bestaende: { anzahl: number; gesamtMb: number; groesste: { name: string; mb: number }[]; beschaedigt?: { anzahl: number; bestaende: string[] } };
  takt: { letzterLaufMinuten: number | null; fehlerquote24h: number | null; wartend: number; laufend: number };
  fehler: { client24h: number; letzter?: string };
  anmeldungen: { fehl24h: number; neueNetze7d: number };
  csp: { meldungen7d: number; top?: string };
  verschluesselt: boolean;
  /** KI-Schlüssel da? Guthaben leer (seit)? — aus lib/anthropic.ts, dem einen Weg für alle Modellaufrufe. */
  ki: { schluessel: boolean; guthabenLeerSeit: string | null };
  /** Datenschicht (29.09., Paket D-A): Messwerte, Sicherungsfehler, Klartext, .tmp-Reste, zweiter Schreiber, Schlüsselquelle. */
  datenschicht?: DatenschichtLage;
  /** Ergebnis der letzten nächtlichen Sicherung (deploy/sicherung.sh → daten/system/sicherung.json). */
  sicherungLauf?: SicherungLauf | null;
  /** Letzte Durchsicht der Bestände (lib/store/durchsicht.ts, Bestand hoi-durchsicht). */
  durchsicht?: DurchsichtKurz | null;
  /**
   * Datenschutz (29.09., Paket D-B): Pepper für HMAC-Fingerabdrücke gesetzt (sonst v1, ungesalzen)? Grabsteine in einem
   * ausdrücklich konfigurierten Ordner (Server: eigenes Volume, sonst gehen sie mit dem Container verloren)?
   */
  datenschutz?: { pepper: boolean; grabsteinOrdner: boolean; produktion: boolean };
  /** Absichtsprotokoll (29.09., Paket D-C #17): offene und gescheiterte Vorgänge über mehrere Bestände. */
  absichten?: { offen: number; faellig: number; gescheitert: number; arten: string[]; aeltesteMinuten: number | null };
}

export interface Quantile { p50: number | null; p99: number | null; n: number }
export interface DatenschichtLage {
  sperrWarten: Quantile; sperrHalten: Quantile; schreiben: Quantile;
  zaehler: { '409': number; '413': number; sperrZeitlimit: number; sicherungFehler: number; klartextAbgelehnt: number };
  parseLangsam: { bestand: string; maxMs: number; mb: number }[];
  sicherungFehler: { anzahl: number; letzter?: string; zeit?: string };
  klartext: string[];
  tmpReste: number;
  fremderSchreiber: { pid: number; host: string } | null;
  schluesselQuelle: 'datei' | 'umgebung' | 'keiner';
}
/**
 * Ergebnis der Nachtsicherung (deploy/sicherung.sh). Seit 29.09. (Go-Live-Prüfung): `stufe` warnung = Archiv liegt
 * (`archiv: true`), aber nur mit Übergangs-Verschlüsselung (`verfahren: 'openssl'`) oder nicht vollständig geprüft
 * (Dateinamen in `pruefung.*FehlerNamen`) — `ok` ist dann false, der HOI zeigt rot.
 */
export interface SicherungLauf {
  zeit?: string; ok?: boolean; stufe?: 'ok' | 'warnung' | 'fehler'; archiv?: boolean; verfahren?: 'age' | 'openssl';
  grund?: string; datei?: string; groesse_mb?: number; dateien?: number; dauer_s?: number; schnappschuss?: string; ping?: string;
  pruefung?: { ok?: boolean; bestaende?: number; datensaetze?: number; fehler?: number; archivFehler?: number; ablageFehler?: number; fehlerNamen?: string[]; archivFehlerNamen?: string[]; ablageFehlerNamen?: string[] } | null;
}
export interface DurchsichtKurz { zeit: string; bestaende: number; zeilen: number; fehler: number; klartext: number; alteHuellen: number; alteForm: number; spruenge: { name: string; vorher: number; nachher: number }[]; tmpReste: number; verbindungen: { fehler: number; warnung: number; hinweis: number } | { nichtGeprueft: string } }

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
    const v = host.vault;
    const vStunden = v?.letzter_push_stunden ?? v?.letzter_commit_stunden;
    if (v && (vStunden != null || v.konflikt || v.push_fehler)) {
      const rot = !!v.konflikt || !!v.push_fehler;
      const mitPush = v.letzter_push_stunden != null;
      b.push({ id: 'vault', bereich: 'sicherung', label: 'Vault-Abgleich', ampel: rot ? 'rot' : vStunden! <= 48 ? 'gruen' : 'gelb',
        wert: v.konflikt ? 'Konflikt' : v.push_fehler ? 'Push fehlgeschlagen' : `${mitPush ? 'letzter erfolgreicher Push' : 'letzter Stand'} vor ${uhr(vStunden!)}`,
        satz: v.konflikt ? 'Git-Konflikt im Vault (Rebase abgebrochen) — von Hand lösen: git status im Vault' : v.push_fehler ? 'Push zum Vault-Repo scheitert — Zugang/Netz prüfen, lokale Änderungen stauen sich' : 'läuft alle 10 Minuten' });
    }
    if (host.kernel_neustart_noetig) b.push({ id: 'neustart', bereich: 'server', label: 'Neustart nötig', ampel: 'gelb', wert: 'Kernel-Update wartet', satz: 'beim nächsten ruhigen Moment neu starten' });
    if ((host.updates?.sicherheit ?? 0) > 0) b.push({ id: 'updates', bereich: 'sicherheit', label: 'Sicherheitsupdates', ampel: (host.updates!.sicherheit ?? 0) > 10 ? 'rot' : 'gelb', wert: `${host.updates!.sicherheit} offen`, satz: 'unattended-upgrades prüfen bzw. apt upgrade' });
  }

  // ── App (innen) ──
  b.push({ id: 'verschluesselt', bereich: 'sicherheit', label: 'Bestände im Ruhezustand', ampel: innen.verschluesselt ? 'gruen' : 'rot', wert: innen.verschluesselt ? 'verschlüsselt' : 'Klartext', satz: innen.verschluesselt ? 'AES-256-GCM je Datei' : 'MAKE_OS_DATEN_SCHLUESSEL fehlt in der .env' });
  const dsch = innen.datenschutz;
  if (dsch) {
    b.push({ id: 'pepper', bereich: 'sicherheit', label: 'Fingerabdrücke gelöschter Personen', ampel: dsch.pepper ? 'gruen' : 'gelb', wert: dsch.pepper ? 'HMAC mit Pepper (v2)' : 'ohne Pepper (v1)',
      satz: dsch.pepper ? 'Sperrliste, Protokoll-Kennungen und Grabsteine gesalzen' : 'MAKE_OS_PEPPER fehlt — Sperrliste und Protokoll-Kennungen nur ungesalzen (v1): wer eine Mail-Liste hat, erkennt Gelöschte wieder. Erzeugen: openssl rand -hex 32, in die .env (nie wechseln).' });
    if (dsch.produktion && !dsch.grabsteinOrdner) b.push({ id: 'grabsteine', bereich: 'sicherung', label: 'Grabsteine (Art. 17 nach Restore)', ampel: 'gelb', wert: 'kein eigener Ordner', satz: 'MAKE_OS_GRABSTEINE_DIR fehlt — die Grabsteine liegen im Container und gehen beim Neubau verloren; eigenes Volume /srv/make-os/grabsteine einbinden (DEPLOY.md).' });
  }
  const ki = innen.ki;
  b.push({ id: 'ki', bereich: 'app', label: 'KI-Guthaben', ampel: !ki.schluessel ? 'grau' : ki.guthabenLeerSeit ? 'rot' : 'gruen', wert: !ki.schluessel ? 'kein Schlüssel' : ki.guthabenLeerSeit ? `leer seit ${ki.guthabenLeerSeit.slice(11, 16)} Uhr` : 'verfügbar', satz: !ki.schluessel ? 'ANTHROPIC_API_KEY fehlt — Agenten mit KI stehen, Regel-Läufe laufen' : ki.guthabenLeerSeit ? 'console.anthropic.com aufladen — bis dahin pausieren alle KI-Aufrufe (halbstündlich ein Versuch), Regel-Läufe laufen weiter' : 'Modellaufrufe gehen durch' });
  const t = innen.takt;
  b.push({ id: 'takt', bereich: 'app', label: 'Arbeiter (Takt)', ampel: t.letzterLaufMinuten === null ? 'grau' : t.letzterLaufMinuten <= 5 ? 'gruen' : t.letzterLaufMinuten <= 30 ? 'gelb' : 'rot', wert: t.letzterLaufMinuten === null ? 'noch kein Lauf' : `vor ${t.letzterLaufMinuten} min · ${t.laufend} laufend · ${t.wartend} wartend`, satz: t.letzterLaufMinuten === null ? 'Arbeiter hat noch nichts gemeldet' : t.letzterLaufMinuten <= 5 ? 'holt fällige Läufe' : 'holt nichts mehr — Container arbeiter prüfen' });
  if (t.fehlerquote24h !== null) b.push({ id: 'fehlerquote', bereich: 'app', label: 'Fehlerquote der Läufe · 24 h', ampel: t.fehlerquote24h < 10 ? 'gruen' : t.fehlerquote24h < 30 ? 'gelb' : 'rot', wert: `${t.fehlerquote24h} %`, satz: t.fehlerquote24h < 10 ? 'Läufe laufen durch' : 'viele Fehlschläge — Guthaben, Schlüssel oder eine defekte Route' });
  b.push({ id: 'clientfehler', bereich: 'app', label: 'Fehler in der Oberfläche · 24 h', ampel: innen.fehler.client24h === 0 ? 'gruen' : innen.fehler.client24h < 10 ? 'gelb' : 'rot', wert: String(innen.fehler.client24h), satz: innen.fehler.client24h ? `zuletzt: ${(innen.fehler.letzter ?? '').slice(0, 80)}` : 'keine Meldungen' });
  b.push({ id: 'anmeldungen', bereich: 'sicherheit', label: 'Fehlanmeldungen · 24 h', ampel: innen.anmeldungen.fehl24h < 5 ? 'gruen' : innen.anmeldungen.fehl24h < 20 ? 'gelb' : 'rot', wert: `${innen.anmeldungen.fehl24h}${innen.anmeldungen.neueNetze7d ? ` · ${innen.anmeldungen.neueNetze7d} neue Netze in 7 Tagen` : ''}`, satz: innen.anmeldungen.fehl24h < 5 ? 'unauffällig' : 'jemand probiert Passwörter — Bremse und Zweiter Faktor greifen' });
  b.push({ id: 'csp', bereich: 'sicherheit', label: 'CSP-Meldungen · 7 Tage', ampel: innen.csp.meldungen7d === 0 ? 'gruen' : innen.csp.meldungen7d < 20 ? 'gelb' : 'rot', wert: String(innen.csp.meldungen7d), satz: innen.csp.meldungen7d ? `häufigste: ${innen.csp.top ?? '—'}` : 'nichts blockiert' });
  b.push({ id: 'heap', bereich: 'app', label: 'App-Speicher', ampel: innen.prozess.rssMb < 900 ? 'gruen' : innen.prozess.rssMb < 1150 ? 'gelb' : 'rot', wert: `${innen.prozess.rssMb} MB · seit ${uhr(innen.prozess.laufzeitStunden)}`, satz: innen.prozess.rssMb < 900 ? 'unter der Grenze (1280 MB)' : 'nah an der Speichergrenze — Neustart droht' });
  // Beschädigte Bestände (28.09., K1 #39): local-db legt kaputtes JSON als <name>.json.corrupt-<zeit> beiseite und
  // verweigert danach jedes Schreiben (BestandBeschaedigt) — ohne diesen Befund merkt das niemand, bis etwas fehlt.
  const kaputt = innen.bestaende.beschaedigt;
  if (kaputt?.anzahl) b.push({ id: 'beschaedigt', bereich: 'app', label: 'Bestand beschädigt beiseitegelegt', ampel: 'rot', wert: `${kaputt.anzahl} Datei${kaputt.anzahl === 1 ? '' : 'en'}: ${kaputt.bestaende.slice(0, 5).join(', ')}${kaputt.bestaende.length > 5 ? ' …' : ''}`, satz: 'liegt als .corrupt-… im Datenordner; der Bestand wird bis zur Prüfung nicht beschrieben — Kopie prüfen, aus backup/ oder der Sicherung wiederherstellen' });
  b.push({ id: 'bestaende', bereich: 'app', label: 'Bestände', ampel: innen.bestaende.gesamtMb < 50 ? 'gruen' : innen.bestaende.gesamtMb < 200 ? 'gelb' : 'rot', wert: `${innen.bestaende.anzahl} Dateien · ${innen.bestaende.gesamtMb.toFixed(1)} MB`, satz: `größte: ${innen.bestaende.groesste.slice(0, 3).map(x => `${x.name} ${x.mb.toFixed(1)} MB`).join(', ')}` });

  // ── Datenschicht, Sicherung, Durchsicht (29.09., Paket D-A) ──
  b.push(...datenschichtBefunde(innen, host, jetzt));

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

const ms = (x: number | null) => (x === null ? '—' : x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);

/** Befunde zur Datenschicht und zur Sicherung — rein, getestet (tests/hoi-datenschicht.test.ts). */
export function datenschichtBefunde(innen: InnenLage, host: HostLage | null, jetzt: string): Befund[] {
  const b: Befund[] = [];
  const stunden = (zeit?: string) => (zeit ? (Date.parse(jetzt) - Date.parse(zeit)) / 3_600_000 : null);

  // Nächtliche Sicherung: geprüft? Schreibpause? Dead-Man-Ping?
  const s = innen.sicherungLauf;
  if (s === null) b.push({ id: 'sicherung-geprueft', bereich: 'sicherung', label: 'Sicherung geprüft', ampel: 'grau', wert: 'noch kein Prüfergebnis', satz: 'deploy/sicherung.sh schreibt ab dem nächsten Lauf daten/system/sicherung.json' });
  else if (s) {
    const alt = stunden(s.zeit);
    if (!s.ok && s.archiv) {
      // Archiv liegt, aber nicht so, wie es soll: nur openssl statt age, oder einzelne Dateien nicht lesbar/ungeprüft.
      const p = s.pruefung;
      const namen = [...(p?.fehlerNamen ?? []), ...(p?.archivFehlerNamen ?? []), ...(p?.ablageFehlerNamen ?? [])];
      const teile = [
        ...(s.verfahren === 'openssl' ? ['age fehlt — Sicherung nur mit Übergangs-Verschlüsselung'] : []),
        ...(namen.length ? [`teilweise: ${namen.length} Datei${namen.length === 1 ? '' : 'en'} nicht lesbar`] : []),
        ...(p == null ? ['Archiv ungeprüft'] : []),
      ];
      b.push({ id: 'sicherung-geprueft', bereich: 'sicherung', label: 'Sicherung geprüft', ampel: 'rot', wert: teile.join(' · ') || 'Archiv liegt, mit Warnung', satz: (namen.length ? `nicht lesbar: ${namen.slice(0, 5).join(', ')}${namen.length > 5 ? ' …' : ''} — Archiv trotzdem geschrieben` : s.grund || 'Grund im Protokoll /srv/make-os/sicherungen/protokoll.txt').slice(0, 160) });
    } else if (!s.ok) b.push({ id: 'sicherung-geprueft', bereich: 'sicherung', label: 'Sicherung geprüft', ampel: 'rot', wert: 'letzter Lauf gescheitert', satz: (s.grund || 'Grund im Protokoll /srv/make-os/sicherungen/protokoll.txt').slice(0, 160) });
    else {
      const p = s.pruefung;
      const ohnePause = s.schnappschuss === 'ohne-pause';
      b.push({ id: 'sicherung-geprueft', bereich: 'sicherung', label: 'Sicherung geprüft', ampel: alt !== null && alt > 30 ? 'gelb' : ohnePause ? 'gelb' : 'gruen', wert: `${p?.bestaende ?? '?'} Bestände · ${p?.datensaetze ?? '?'} Datensätze · ${s.dateien ?? '?'} Dateien${s.dauer_s != null ? ` · ${s.dauer_s} s` : ''}`, satz: ohnePause ? 'ohne Schreibpause gesichert — die App war nicht erreichbar oder nicht still' : 'entschlüsselt, geparst und gezählt, Archiv mit age-Kopf' });
    }
    b.push({ id: 'sicherung-ping', bereich: 'sicherung', label: 'Dead-Man-Ping der Sicherung', ampel: s.ping === 'ok' ? 'gruen' : 'gelb', wert: s.ping === 'ok' ? (s.ok ? 'meldet' : 'meldet Fehler') : s.ping === 'fehler' ? 'Ping gescheitert' : 'nicht eingerichtet', satz: s.ping === 'ok' ? 'Healthchecks schlägt Alarm, wenn die Sicherung ausbleibt' : 'Pflicht: Ping-Adresse (Healthchecks.io) nach /srv/make-os/.healthchecks-sicherung — sonst merkt niemand, wenn die Sicherung ausfällt' });
  }
  // Abholung durch den Mac (Offsite)
  if (host) {
    const a = host.abholung?.alter_stunden;
    if (a == null) b.push({ id: 'abholung', bereich: 'sicherung', label: 'Sicherung am Mac', ampel: 'gelb', wert: 'noch nie abgeholt', satz: 'zweiter Ort fehlt: am Mac deploy/sicherung-abholen.sh --einrichten + launchd (NOTFALL.md)' });
    else b.push({ id: 'abholung', bereich: 'sicherung', label: 'Sicherung am Mac', ampel: a <= 30 ? 'gruen' : a <= 48 ? 'gelb' : 'rot', wert: `zuletzt vor ${Math.round(a)} h`, satz: a <= 30 ? 'der Mac hat die letzte Sicherung abgeholt und bestätigt' : 'der Mac holt nicht mehr ab — Mac an? launchd de.makeos.sicherung geladen?' });
  }

  const d = innen.datenschicht;
  if (d) {
    if (d.sicherungFehler.anzahl) b.push({ id: 'tagessicherung', bereich: 'sicherung', label: 'Tagessicherung der Bestände', ampel: 'rot', wert: `${d.sicherungFehler.anzahl}× gescheitert`, satz: `zuletzt ${d.sicherungFehler.letzter ?? '?'} — Platz und Rechte von daten/backup prüfen` });
    if (d.klartext.length) b.push({ id: 'klartext', bereich: 'sicherheit', label: 'Klartext-Bestand abgelehnt', ampel: 'rot', wert: `${d.klartext.length}: ${d.klartext.slice(0, 4).join(', ')}${d.klartext.length > 4 ? ' …' : ''}`, satz: 'liegt unverschlüsselt da, obwohl ein Schlüssel gesetzt ist — untergeschoben oder alte Sicherung? prüfen, dann scripts/daten-verschluesselung.mjs --verschluesseln' });
    if (d.tmpReste) b.push({ id: 'tmp-reste', bereich: 'app', label: 'Liegengebliebene .tmp-Dateien', ampel: 'gelb', wert: String(d.tmpReste), satz: 'abgebrochene Schreibungen — nach Prüfung löschen, sie füllen sonst die Platte' });
    if (d.fremderSchreiber) b.push({ id: 'schreiber', bereich: 'app', label: 'Zweiter Schreiber im Datenordner', ampel: 'gelb', wert: `PID ${d.fremderSchreiber.pid} auf ${d.fremderSchreiber.host}`, satz: 'zwei Prozesse schreiben in dieselben Bestände (lokal: Dev-Server und Prüfbau) — einen anhalten' });
    if (d.schluesselQuelle === 'umgebung') b.push({ id: 'schluessel-quelle', bereich: 'sicherheit', label: 'Datenschlüssel', ampel: 'gelb', wert: 'aus der Umgebung (.env)', satz: 'Empfehlung: als Datei 0400 unter /srv/make-os/schluessel/daten und aus der .env nehmen (NOTFALL.md) — dann nicht mehr in docker inspect sichtbar' });
    const w = d.sperrWarten, sc = d.schreiben;
    const wartenRot = d.zaehler.sperrZeitlimit > 0;
    const wartenGelb = (w.p99 ?? 0) > 5000 || (sc.p99 ?? 0) > 2000;
    b.push({ id: 'sperren', bereich: 'app', label: 'Schreibsperren und Schreibdauer', ampel: wartenRot ? 'rot' : wartenGelb ? 'gelb' : 'gruen', wert: `Warten p50 ${ms(w.p50)} · p99 ${ms(w.p99)} · Schreiben p99 ${ms(sc.p99)} · 409: ${d.zaehler['409']} · 413: ${d.zaehler['413']}`, satz: wartenRot ? `${d.zaehler.sperrZeitlimit}× Zeitlimit (30 s) — ein Vorgang hält eine Sperre zu lange` : wartenGelb ? 'Schreibungen stauen sich — großer Import, PDF in der Sperre oder volle Platte?' : 'kein Stau' });
    const langsam = d.parseLangsam[0];
    if (langsam && langsam.maxMs >= 200) b.push({ id: 'parse', bereich: 'app', label: 'Parse-Zeit größter Bestand', ampel: langsam.maxMs >= 1000 ? 'rot' : 'gelb', wert: `${langsam.bestand} ${ms(langsam.maxMs)} · ${langsam.mb} MB`, satz: 'wird der Bestand zu groß? SQLite-Auslöser 1 (DATENARCHITEKTUR.md) prüfen' });
  }

  const ab = innen.absichten;
  if (ab) {
    if (ab.gescheitert) b.push({ id: 'absichten', bereich: 'app', label: 'Abgebrochene Vorgänge', ampel: 'rot', wert: `${ab.gescheitert} gescheitert (${ab.arten.join(', ') || '?'})${ab.offen ? ` · ${ab.offen} offen` : ''}`, satz: 'nach 3 Versuchen nicht fertig — halber Stand über mehrere Bestände: Ursache im Log (docker compose logs app | grep absichten), beheben, dann im Head of IT erneut anstoßen (NOTFALL.md „Absichten“)' });
    else if (ab.offen) b.push({ id: 'absichten', bereich: 'app', label: 'Abgebrochene Vorgänge', ampel: (ab.aeltesteMinuten ?? 0) > 60 ? 'gelb' : 'gruen', wert: `${ab.offen} offen${ab.aeltesteMinuten != null ? ` · älteste ${ab.aeltesteMinuten} min` : ''}`, satz: (ab.aeltesteMinuten ?? 0) > 60 ? 'wartet auf Wiederaufnahme (Takt, Start, Durchsicht) — länger als eine Stunde: Log prüfen' : 'wird gleich fertiggestellt' });
    else b.push({ id: 'absichten', bereich: 'app', label: 'Abgebrochene Vorgänge', ampel: 'gruen', wert: 'keine', satz: 'alle Vorgänge über mehrere Bestände abgeschlossen (Absichtsprotokoll)' });
  }

  const ds = innen.durchsicht;
  if (ds === null) b.push({ id: 'durchsicht', bereich: 'app', label: 'Durchsicht der Bestände', ampel: 'grau', wert: 'noch nicht gelaufen', satz: 'der Takt stößt sie täglich ab 4 Uhr an' });
  else if (ds) {
    const alt = stunden(ds.zeit) ?? 0;
    const v = 'fehler' in ds.verbindungen ? ds.verbindungen : null;
    const rot = ds.fehler > 0 || ds.klartext > 0;
    const gelb = alt > 30 || ds.spruenge.length > 0 || (v?.fehler ?? 0) > 0 || ds.tmpReste > 0;
    const teile = [`${ds.bestaende} Bestände · ${ds.zeilen} Zeilen`];
    if (ds.fehler) teile.push(`${ds.fehler} unlesbar`);
    if (ds.spruenge.length) teile.push(`Sprung: ${ds.spruenge.slice(0, 3).map(x => `${x.name} ${x.vorher}→${x.nachher}`).join(', ')}`);
    if (v) teile.push(`Verbindungen: ${v.fehler} Fehler, ${v.warnung} Warnungen`);
    if (ds.alteHuellen || ds.alteForm) teile.push(`alt: ${ds.alteHuellen} Hüllen v1, ${ds.alteForm} Form`);
    b.push({ id: 'durchsicht', bereich: 'app', label: 'Durchsicht der Bestände', ampel: rot ? 'rot' : gelb ? 'gelb' : 'gruen', wert: teile.join(' · '), satz: rot ? 'ein Bestand ist nicht lesbar oder liegt im Klartext — sofort prüfen' : ds.spruenge.length ? 'ein Bestand ist über Nacht deutlich geschrumpft — gewollt? sonst aus backup/ zurückholen (Einzel-Restore)' : alt > 30 ? 'die Durchsicht ist nicht gelaufen — Takt/Arbeiter prüfen' : 'alles entschlüsselt, geparst und gezählt' });
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
