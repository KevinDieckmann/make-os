// ─── Fulfillment · Analyse — Web-Abruf mit Schutz (`web_lesen`, C3, 10.10.; FULFILLMENT_KONZEPT.md 4.8) — nur Server ─────────────────────────
// Entscheidung 10.10. (22:30): „Web-Fetch wird gebaut, mit Schutz (nur öffentliche http/https-Adressen, nur Text, Größen-/Zeitgrenze, alles durch fremd()).“
//   · nur http/https, Port 80/443, keine Zugangsdaten in der Adresse, kein IP-Literal
//   · DNS EINMAL auflösen und prüfen (lib/netz/oeffentlich.ts — Loopback, privat, link-lokal, CGNAT, Multicast, IPv6 ULA/link-lokal, IPv4-mapped
//     abgelehnt), dann mit GENAU DIESER Adresse verbinden (eigenes `lookup`) — eine zweite, andere Auflösung (DNS-Rebinding) wirkt nicht
//   · höchstens 3 Weiterleitungen, jede neu geprüft; Verbinden 5 s, insgesamt 15 s; höchstens 2 MB, sonst Abbruch
//   · nur text/html, application/xhtml+xml, text/plain, application/pdf — HTML nur zu Text (`htmlZuText`: keine Skripte, Bilder nie geladen)
//   · GET ohne Cookies und Formulare, eigener User-Agent mit der Adresse der Instanz; robots.txt wird beachtet (`*` und unser Agent)
//   · höchstens 1 Abruf je Sekunde und Host, höchstens 20 Abrufe je Lauf
//   · ERLAUBTE ZIELE je Lauf (gegen Prompt-Injection): Domains des Mandats samt Subdomains, Adressen aus dem Such-Schritt DIESES Laufs und
//     Adressen, die ein Mensch in den Eingaben genannt hat — alles andere → `rechte`. Gesperrte Domains (LinkedIn, Register …) nie.
//   · Antwort ≤ 30.000 Zeichen je Aufruf („Teil x von y“, weiter mit `teil`); Kopfzeile außerhalb, der Inhalt in `fremd('web', …)`.
//   · Seiten werden NICHT gespeichert — im Dossier stehen nur Aussagen mit Adresse und Abrufdatum.
// Das Netz ist austauschbar (`_netzSetzen`) — Tests laufen mit einem nachgebauten Netz, nie gegen das echte.

import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { fremd } from '@/lib/anthropic';
import { erfolg, fehlschlag, type WerkzeugErgebnis } from '@/lib/werkzeuge/vertrag';
import { htmlZuText } from '@/lib/gmail/html';
import { oeffentlichesZiel, istIpAdresse, type Ziel } from '@/lib/netz/oeffentlich';
import { hostPasst, hostVon, istGesperrt, urlNormal } from './quellen';

export const WEB = {
  zeichen: 30_000,
  maxBytes: 2 * 1024 * 1024,
  verbindenMs: 5_000,
  gesamtMs: 15_000,
  weiterleitungen: 3,
  abrufeJeLauf: 20,
  abstandMs: 1_000,
  typen: ['text/html', 'application/xhtml+xml', 'text/plain', 'application/pdf'] as const,
} as const;

export const USER_AGENT_NAME = 'MAKE-OS-Recherche';
export const userAgent = (env: Record<string, string | undefined> = process.env): string => `${USER_AGENT_NAME}/1.0 (+${(env.MAKE_OS_ADRESSE ?? '').trim() || 'ohne Adresse'})`;

// ── Das Netz (austauschbar) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Antwort { status: number; kopf: Record<string, string>; bytes: Buffer; zuGross?: true }
export interface NetzZugang {
  aufloesen(host: string): Promise<{ address: string; family: number }[]>;
  /** Ein GET an die FESTGEHALTENE Adresse `ziel` (nie neu auflösen), ohne Weiterleitungen zu folgen. */
  abrufen(a: { url: URL; ziel: Ziel; signal: AbortSignal; maxBytes: number; verbindenMs: number; kopf: Record<string, string> }): Promise<Antwort>;
}

/** Der echte Abruf: Node http/https mit eigenem `lookup` — die Verbindung geht an die geprüfte Adresse, SNI/Host bleiben der Name. */
export function httpAbrufen(a: Parameters<NetzZugang['abrufen']>[0]): Promise<Antwort> {
  return new Promise((ok, fehler) => {
    const https = a.url.protocol === 'https:';
    const req = (https ? httpsRequest : httpRequest)({
      protocol: a.url.protocol, hostname: a.url.hostname, port: a.url.port || (https ? 443 : 80), path: `${a.url.pathname}${a.url.search}`, method: 'GET',
      headers: a.kopf, signal: a.signal, agent: false,
      ...(https ? { servername: a.url.hostname } : {}),
      // Festgehaltene Adresse (gegen DNS-Rebinding): jede Auflösung während der Verbindung liefert genau das geprüfte Ziel.
      lookup: ((_h: string, o: { all?: boolean } | undefined, cb: (e: Error | null, adr: string | { address: string; family: number }[], fam?: number) => void) => {
        if (o && o.all) cb(null, [{ address: a.ziel.adresse, family: a.ziel.familie }]);
        else cb(null, a.ziel.adresse, a.ziel.familie);
      }) as never,
    });
    const verbinden = setTimeout(() => req.destroy(new Error('Zeitgrenze beim Verbinden (5 s).')), a.verbindenMs);
    req.on('socket', s => { s.once(https ? 'secureConnect' : 'connect', () => clearTimeout(verbinden)); });
    req.on('error', e => { clearTimeout(verbinden); fehler(e); });
    req.on('response', (res: IncomingMessage) => {
      clearTimeout(verbinden);
      const kopf: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) if (typeof v === 'string') kopf[k.toLowerCase()] = v; else if (Array.isArray(v)) kopf[k.toLowerCase()] = v.join(', ');
      const teile: Buffer[] = [];
      let n = 0;
      res.on('data', (c: Buffer) => {
        n += c.length;
        if (n > a.maxBytes) { res.destroy(); ok({ status: res.statusCode ?? 0, kopf, bytes: Buffer.alloc(0), zuGross: true }); return; }
        teile.push(c);
      });
      res.on('end', () => ok({ status: res.statusCode ?? 0, kopf, bytes: Buffer.concat(teile) }));
      res.on('error', fehler);
    });
    req.end();
  });
}

const ECHT: NetzZugang = { aufloesen: h => dnsLookup(h, { all: true, verbatim: true }), abrufen: httpAbrufen };
let netz: NetzZugang = ECHT;
/** Nur Tests: ein nachgebautes Netz (null = das echte). */
export function _netzSetzen(n: NetzZugang | null): void { netz = n ?? ECHT; }

// ── robots.txt ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RobotsRegel { erlaubt: boolean; pfad: string }
/** robots.txt lesen (rein): die Gruppe unseres Agenten, sonst `*`. */
export function robotsLesen(text: string, agent = USER_AGENT_NAME): RobotsRegel[] {
  const gruppen: { agenten: string[]; regeln: RobotsRegel[] }[] = [];
  let aktuell: { agenten: string[]; regeln: RobotsRegel[] } | null = null;
  let regelnGesehen = false;
  for (const zeile of text.split(/\r?\n/)) {
    const z = zeile.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(z);
    if (!m) continue;
    const feld = m[1].toLowerCase(), wert = m[2].trim();
    if (feld === 'user-agent') {
      if (!aktuell || regelnGesehen) { aktuell = { agenten: [], regeln: [] }; gruppen.push(aktuell); regelnGesehen = false; }
      aktuell.agenten.push(wert.toLowerCase());
    } else if ((feld === 'disallow' || feld === 'allow') && aktuell) {
      regelnGesehen = true;
      if (wert || feld === 'allow') aktuell.regeln.push({ erlaubt: feld === 'allow', pfad: wert });
    }
  }
  const eigene = gruppen.filter(g => g.agenten.some(a => a !== '*' && agent.toLowerCase().includes(a)));
  return (eigene.length ? eigene : gruppen.filter(g => g.agenten.includes('*'))).flatMap(g => g.regeln);
}
/** Darf dieser Pfad gelesen werden (längste passende Regel gewinnt, bei Gleichstand „erlaubt“)? */
export function robotsErlaubt(regeln: readonly RobotsRegel[], pfad: string): boolean {
  let best: RobotsRegel | null = null;
  for (const r of regeln) {
    if (!r.pfad) continue;
    // `*` = beliebig, `$` am Ende = Ende des Pfads; ein `$` mitten im Pfad wird wörtlich genommen.
    const roh = r.pfad.endsWith('$') ? r.pfad.slice(0, -1) : r.pfad;
    const muster = new RegExp(`^${roh.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}${r.pfad.endsWith('$') ? '$' : ''}`);
    if (!muster.test(pfad)) continue;
    if (!best || r.pfad.length > best.pfad.length || (r.pfad.length === best.pfad.length && r.erlaubt)) best = r;
  }
  return !best || best.erlaubt;
}

// ── Ein Lauf ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Der Zustand des Web-Abrufs in EINEM Analyse-Lauf (lebt nur im Speicher des Laufs). */
export interface WebLauf {
  /** Domains des Mandats (samt Subdomains erlaubt). */
  domains: readonly string[];
  /** Adressen aus dem Such-Schritt und aus den Eingaben (genau diese Adressen). */
  urls: Set<string>;
  heute: string;
  abrufe: number;
  zuletzt: Map<string, number>;
  robots: Map<string, RobotsRegel[]>;
  /** Gelesene Seiten (normalisierte Adresse → Text) — nur für „Teil 2“ desselben Laufs, nie gespeichert. */
  texte: Map<string, string>;
  /** Normalisierte Adressen, die gelesen wurden (belegbar im Dossier). */
  gelesen: Set<string>;
  jetzt?: () => number;
  warten?: (ms: number) => Promise<void>;
}
export function neuerWebLauf(o: { domains: readonly string[]; urls: Iterable<string>; heute: string }): WebLauf {
  return { domains: o.domains, urls: new Set([...o.urls].map(u => urlNormal(u)).filter((u): u is string => !!u)), heute: o.heute, abrufe: 0, zuletzt: new Map(), robots: new Map(), texte: new Map(), gelesen: new Set() };
}

/** Ist dieses Ziel in DIESEM Lauf erlaubt (Domain des Mandats oder genannte Adresse)? */
export function zielErlaubt(l: Pick<WebLauf, 'domains' | 'urls'>, url: string): boolean {
  const n = urlNormal(url), host = hostVon(url);
  if (!n || !host) return false;
  return l.domains.some(d => hostPasst(host, d)) || l.urls.has(n);
}

class Abgelehnt extends Error { constructor(public klasse: 'rechte' | 'eingabe' | 'nicht_gefunden' | 'voruebergehend' | 'grenze', m: string) { super(m); } }

/** Form der Adresse prüfen (rein): Schema, Port, Zugangsdaten, IP-Literal, gesperrte Domain. */
export function adresseGeprueft(roh: string): URL {
  let u: URL;
  try { u = new URL(roh); } catch { throw new Abgelehnt('eingabe', 'Keine gültige Adresse.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Abgelehnt('rechte', 'Nur http- und https-Adressen.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Abgelehnt('rechte', 'Nur die Ports 80 und 443.');
  if (u.username || u.password) throw new Abgelehnt('rechte', 'Keine Zugangsdaten in der Adresse.');
  if (istIpAdresse(u.hostname)) throw new Abgelehnt('rechte', 'Nur Namen, keine IP-Adressen.');
  if (istGesperrt(u.hostname)) throw new Abgelehnt('rechte', 'Diese Plattform liest kein Agent (Nutzungsbedingungen bzw. Register — ein Mensch legt die Unterlage ab).');
  u.hash = '';
  return u;
}

async function warteAufHost(l: WebLauf, host: string): Promise<void> {
  const jetzt = l.jetzt ?? Date.now;
  const vor = l.zuletzt.get(host);
  if (vor !== undefined) { const rest = WEB.abstandMs - (jetzt() - vor); if (rest > 0) await (l.warten ?? (ms => new Promise(r => setTimeout(r, ms))))(rest); }
  l.zuletzt.set(host, jetzt());
}

/** EIN geschützter GET (ohne Weiterleitungen): Auflösen → Prüfen → mit der festgehaltenen Adresse abrufen. */
async function einAbruf(l: WebLauf, u: URL, signal: AbortSignal): Promise<Antwort> {
  let ziel: Ziel | null;
  try { ziel = oeffentlichesZiel(await netz.aufloesen(u.hostname)); } catch { throw new Abgelehnt('nicht_gefunden', `Den Namen „${u.hostname.slice(0, 80)}“ gibt es nicht (DNS).`); }
  if (!ziel) throw new Abgelehnt('rechte', 'Dieses Ziel liegt im eigenen bzw. privaten Netz — abgelehnt.');
  await warteAufHost(l, u.hostname);
  return netz.abrufen({ url: u, ziel, signal, maxBytes: WEB.maxBytes, verbindenMs: WEB.verbindenMs, kopf: { 'user-agent': userAgent(), accept: 'text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8', 'accept-language': 'de,en;q=0.7' } });
}

async function robotsFuer(l: WebLauf, u: URL, signal: AbortSignal): Promise<RobotsRegel[]> {
  const host = u.hostname;
  const da = l.robots.get(host);
  if (da) return da;
  let regeln: RobotsRegel[] = [];
  try {
    const r = await einAbruf(l, new URL(`${u.protocol}//${host}/robots.txt`), signal);
    if (r.status >= 200 && r.status < 300 && !r.zuGross) regeln = robotsLesen(r.bytes.toString('utf8').slice(0, 200_000));
    // 401/403 auf robots.txt: wie „alles verboten“ (vorsichtig); 404 und andere: keine Regeln.
    if (r.status === 401 || r.status === 403) regeln = [{ erlaubt: false, pfad: '/' }];
  } catch (e) { if (e instanceof Abgelehnt && e.klasse === 'rechte') throw e; }
  l.robots.set(host, regeln);
  return regeln;
}

const typVon = (kopf: Record<string, string>): string => (kopf['content-type'] ?? '').split(';')[0].trim().toLowerCase();

/** Text aus der Antwort (nur erlaubte Typen). */
async function textAus(a: Antwort): Promise<string> {
  const typ = typVon(a.kopf);
  if (!(WEB.typen as readonly string[]).includes(typ)) throw new Abgelehnt('rechte', `Nur Text-Seiten (HTML, Text, PDF) — diese Antwort ist „${typ || 'ohne Typ'}“.`);
  if (typ === 'application/pdf') {
    const { textAuslesen } = await import('@/lib/dateien/text-auslesen');
    return (await textAuslesen(a.bytes, 'application/pdf'))?.text ?? '';
  }
  const roh = a.bytes.toString('utf8');
  return typ === 'text/plain' ? roh : htmlZuText(roh).text;
}

/** Den Text einer Seite in Teile zu 30.000 Zeichen schneiden (rein). */
export function teilVon(text: string, teil: number): { inhalt: string; teil: number; teile: number } {
  const teile = Math.max(1, Math.ceil(text.length / WEB.zeichen));
  const t = Math.min(Math.max(1, Math.floor(teil) || 1), teile);
  return { inhalt: text.slice((t - 1) * WEB.zeichen, t * WEB.zeichen), teil: t, teile };
}

/** Das Werkzeug `web_lesen` für EINEN Lauf (gibt ein typisiertes Ergebnis; der Inhalt steht in `fremd('web', …)`). */
export async function webLesen(eingabe: { url?: unknown; teil?: unknown }, l: WebLauf): Promise<WerkzeugErgebnis> {
  try {
    if (typeof eingabe.url !== 'string') throw new Abgelehnt('eingabe', '„url“ fehlt.');
    const start = adresseGeprueft(eingabe.url.trim());
    if (!zielErlaubt(l, start.toString())) throw new Abgelehnt('rechte', 'Diese Adresse ist in diesem Lauf nicht erlaubt (nur Domains des Mandats, Adressen aus der Suche dieses Laufs und Adressen aus den Eingaben).');
    const teil = typeof eingabe.teil === 'number' ? eingabe.teil : 1;
    const schluessel = start.toString();
    let text = l.texte.get(schluessel);
    let endUrl = schluessel;
    if (text === undefined) {
      const ctl = new AbortController();
      const uhr = setTimeout(() => ctl.abort(), WEB.gesamtMs);
      try {
        let u = start;
        for (let sprung = 0; ; sprung++) {
          if (l.abrufe >= WEB.abrufeJeLauf) throw new Abgelehnt('grenze', `Höchstens ${WEB.abrufeJeLauf} Abrufe je Lauf — erreicht.`);
          const regeln = await robotsFuer(l, u, ctl.signal);
          if (!robotsErlaubt(regeln, `${u.pathname}${u.search}`)) throw new Abgelehnt('rechte', 'Die Seite erlaubt das Lesen durch Programme nicht (robots.txt).');
          l.abrufe++;
          const r = await einAbruf(l, u, ctl.signal);
          if (r.zuGross) throw new Abgelehnt('grenze', 'Die Seite ist größer als 2 MB — abgebrochen.');
          if (r.status >= 300 && r.status < 400 && r.kopf.location) {
            if (sprung >= WEB.weiterleitungen) throw new Abgelehnt('grenze', `Mehr als ${WEB.weiterleitungen} Weiterleitungen — abgebrochen.`);
            const naechste = adresseGeprueft(new URL(r.kopf.location, u).toString());
            // Eine Weiterleitung bleibt auf derselben Seite (Host oder Unter-/Oberdomain) oder führt zu einem erlaubten Ziel.
            const gleich = hostPasst(naechste.hostname, u.hostname.replace(/^www\./, '')) || hostPasst(u.hostname, naechste.hostname.replace(/^www\./, ''));
            if (!gleich && !zielErlaubt(l, naechste.toString())) throw new Abgelehnt('rechte', 'Die Weiterleitung führt zu einem nicht erlaubten Ziel.');
            u = naechste;
            continue;
          }
          if (r.status === 404 || r.status === 410) throw new Abgelehnt('nicht_gefunden', `Seite nicht gefunden (${r.status}).`);
          if (r.status === 401 || r.status === 403) throw new Abgelehnt('rechte', `Kein Zugang (${r.status}) — Anmeldungen und Bezahlschranken umgehen wir nicht.`);
          if (r.status >= 400) throw new Abgelehnt(r.status === 429 || r.status >= 500 ? 'voruebergehend' : 'nicht_gefunden', `Die Seite antwortet mit ${r.status}.`);
          text = (await textAus(r)).replace(/\u0000/g, '').trim();
          endUrl = u.toString();
          break;
        }
      } catch (e) {
        if (e instanceof Abgelehnt) throw e;
        const m = e instanceof Error ? e.message : '';
        throw new Abgelehnt('voruebergehend', ctl.signal.aborted ? 'Zeitgrenze (15 s) erreicht — abgebrochen.' : /Zeitgrenze/.test(m) ? m : 'Die Seite war nicht erreichbar.');
      } finally { clearTimeout(uhr); }
      l.texte.set(schluessel, text);
      l.gelesen.add(schluessel);
      l.gelesen.add(endUrl);
    }
    const t = teilVon(text, teil);
    const kopf = `Seite: ${endUrl} · abgerufen ${l.heute} · ${text.length.toLocaleString('de-DE')} Zeichen${t.teile > 1 ? ` · Teil ${t.teil} von ${t.teile} (weiter mit "teil": ${t.teil < t.teile ? t.teil + 1 : t.teile})` : ''}`;
    return erfolg(`${kopf}\n${fremd('web', t.inhalt || '(kein Text auf der Seite)')}`);
  } catch (e) {
    if (e instanceof Abgelehnt) return fehlschlag(e.klasse, `Nicht gelesen: ${e.message}`);
    return fehlschlag('intern', 'Nicht gelesen: interner Fehler beim Abruf.');
  }
}
