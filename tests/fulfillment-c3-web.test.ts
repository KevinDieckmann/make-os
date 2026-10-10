// ─── Fulfillment C3 · Web-Abruf mit Schutz (`web_lesen`, 10.10.; FULFILLMENT_KONZEPT.md 4.8) ──────────────────────────────────────────────────
// Nachgebautes Netz (`_netzSetzen`) — nie das echte: private, Loopback, CGNAT und IPv6-ULA abgelehnt; DNS-Rebinding (zweite Auflösung anders) wirkt nicht
// (es wird EINMAL aufgelöst und mit genau dieser Adresse verbunden); Weiterleitung auf ein internes Ziel abgelehnt; > 2 MB Abbruch; nur Text; Ziel
// außerhalb der Erlaubnis → `rechte`; robots.txt; gesperrte Domains. Dazu der echte Abruf (`httpAbrufen`) gegen einen lokalen Server: er verbindet mit der
// festgehaltenen Adresse, auch wenn der Name gar nicht auflösbar ist — der Beweis, dass keine zweite Auflösung stattfindet.
import { describe, it, expect, afterEach, afterAll, beforeAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { webLesen, neuerWebLauf, _netzSetzen, httpAbrufen, WEB, type NetzZugang, type Antwort } from '@/lib/fulfillment/analyse/web-lesen';

const HEUTE = '2026-10-10';
const OEFFENTLICH = '93.184.216.34';
interface Seite { status?: number; typ?: string; text?: string; ort?: string; bytes?: Buffer; zuGross?: true }

/** Ein Netz aus einer Tabelle: Name → Adressen (je Aufruf die nächste Antwort), Adresse+Pfad → Seite. */
function netz(dns: Record<string, string[][]>, seiten: Record<string, Seite>) {
  const aufrufe: { url: string; adresse: string }[] = [];
  const aufloesungen: string[] = [];
  const zaehler = new Map<string, number>();
  const n: NetzZugang = {
    aufloesen: async h => {
      aufloesungen.push(h);
      const liste = dns[h];
      if (!liste) throw new Error('ENOTFOUND');
      const i = zaehler.get(h) ?? 0;
      zaehler.set(h, i + 1);
      return (liste[Math.min(i, liste.length - 1)]).map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
    },
    abrufen: async a => {
      aufrufe.push({ url: a.url.toString(), adresse: a.ziel.adresse });
      const s = seiten[`${a.ziel.adresse} ${a.url.pathname}`] ?? seiten[a.url.toString()] ?? { status: 404, text: '' };
      const r: Antwort = { status: s.status ?? 200, kopf: { 'content-type': s.typ ?? 'text/html; charset=utf-8', ...(s.ort ? { location: s.ort } : {}) }, bytes: s.bytes ?? Buffer.from(s.text ?? '') };
      return s.zuGross ? { ...r, zuGross: true } : r;
    },
  };
  return { n, aufrufe, aufloesungen };
}
const lauf = (urls: string[] = []) => { const l = neuerWebLauf({ domains: ['beispiel-firma.example'], urls, heute: HEUTE }); l.warten = async () => {}; return l; };

afterEach(() => _netzSetzen(null));

describe('web_lesen — Schutz', () => {
  it('liest eine erlaubte Seite: nur Text, Kopfzeile außerhalb, Inhalt im fremd-Rahmen, Skripte weg', async () => {
    const { n } = netz({ 'beispiel-firma.example': [[OEFFENTLICH]] }, {
      [`${OEFFENTLICH} /`]: { text: '<html><head><script>alert(1)</script></head><body><h1>Willkommen</h1><p>Wir bauen Beispiele.</p><img src="x.png"></body></html>' },
    });
    _netzSetzen(n);
    const l = lauf();
    const r = await webLesen({ url: 'https://beispiel-firma.example/' }, l);
    expect(r.ok).toBe(true);
    expect(r.meldung).toMatch(/^Seite: https:\/\/beispiel-firma\.example\/ · abgerufen 2026-10-10/);
    expect(r.meldung).toContain('<fremde_daten quelle="web">');
    expect(r.meldung).toContain('Wir bauen Beispiele.');
    expect(r.meldung).not.toContain('alert');
    expect(l.gelesen.has('https://beispiel-firma.example/')).toBe(true);
  });
  it('privat, Loopback, CGNAT, IPv6-ULA, Metadaten-Dienst → abgelehnt (rechte), es wird nichts abgerufen', async () => {
    for (const ip of ['10.0.0.5', '127.0.0.1', '100.64.1.1', 'fd00::5', '169.254.169.254']) {
      const { n, aufrufe } = netz({ 'beispiel-firma.example': [[ip]] }, {});
      _netzSetzen(n);
      const r = await webLesen({ url: 'https://beispiel-firma.example/' }, lauf());
      expect(r, ip).toMatchObject({ ok: false, klasse: 'rechte' });
      expect(aufrufe.filter(a => !a.url.endsWith('/robots.txt')), ip).toEqual([]);
    }
  });
  it('DNS-Rebinding: aufgelöst wird EINMAL je Abruf, verbunden mit genau dieser Adresse — die zweite (interne) Antwort wirkt nicht', async () => {
    const { n, aufrufe, aufloesungen } = netz({ 'beispiel-firma.example': [[OEFFENTLICH], ['127.0.0.1']] }, { [`${OEFFENTLICH} /robots.txt`]: { status: 404 }, [`${OEFFENTLICH} /`]: { text: 'ok' } });
    _netzSetzen(n);
    // robots.txt löst einmal auf (öffentlich), der Seitenabruf noch einmal (jetzt „intern“) → abgelehnt statt verbunden
    const r = await webLesen({ url: 'https://beispiel-firma.example/' }, lauf());
    expect(r).toMatchObject({ ok: false, klasse: 'rechte' });
    expect(aufloesungen).toEqual(['beispiel-firma.example', 'beispiel-firma.example']);
    expect(aufrufe.every(a => a.adresse === OEFFENTLICH)).toBe(true);
  });
  it('Weiterleitung auf ein internes Ziel → abgelehnt; auf ein fremdes Ziel außerhalb der Erlaubnis → abgelehnt', async () => {
    const intern = netz({ 'beispiel-firma.example': [[OEFFENTLICH]], 'intern.beispiel-firma.example': [['10.1.1.1']] }, {
      [`${OEFFENTLICH} /alt`]: { status: 301, ort: 'https://intern.beispiel-firma.example/admin' },
    });
    _netzSetzen(intern.n);
    expect(await webLesen({ url: 'https://beispiel-firma.example/alt' }, lauf())).toMatchObject({ ok: false, klasse: 'rechte' });
    expect(intern.aufrufe.some(a => a.adresse === '10.1.1.1')).toBe(false);
    const fremd = netz({ 'beispiel-firma.example': [[OEFFENTLICH]], 'angreifer.example': [['93.184.216.99']] }, {
      [`${OEFFENTLICH} /weg`]: { status: 302, ort: 'https://angreifer.example/' },
    });
    _netzSetzen(fremd.n);
    const r = await webLesen({ url: 'https://beispiel-firma.example/weg' }, lauf());
    expect(r).toMatchObject({ ok: false, klasse: 'rechte' });
    expect(r.meldung).toMatch(/nicht erlaubten Ziel/);
  });
  it('mehr als 3 Weiterleitungen → Abbruch; > 2 MB → Abbruch; kein Text (Bild, ZIP) → abgelehnt', async () => {
    const k = netz({ 'beispiel-firma.example': [[OEFFENTLICH]] }, {
      [`${OEFFENTLICH} /a`]: { status: 302, ort: '/b' }, [`${OEFFENTLICH} /b`]: { status: 302, ort: '/c' }, [`${OEFFENTLICH} /c`]: { status: 302, ort: '/d' }, [`${OEFFENTLICH} /d`]: { status: 302, ort: '/e' },
      [`${OEFFENTLICH} /gross`]: { zuGross: true }, [`${OEFFENTLICH} /bild`]: { typ: 'image/png', text: 'png' }, [`${OEFFENTLICH} /zip`]: { typ: 'application/zip', text: 'PK' },
    });
    _netzSetzen(k.n);
    expect(await webLesen({ url: 'https://beispiel-firma.example/a' }, lauf())).toMatchObject({ ok: false, klasse: 'grenze' });
    expect((await webLesen({ url: 'https://beispiel-firma.example/gross' }, lauf())).meldung).toMatch(/2 MB/);
    expect(await webLesen({ url: 'https://beispiel-firma.example/bild' }, lauf())).toMatchObject({ ok: false, klasse: 'rechte' });
    expect(await webLesen({ url: 'https://beispiel-firma.example/zip' }, lauf())).toMatchObject({ ok: false, klasse: 'rechte' });
  });
  it('Ziel außerhalb der Erlaubnis, gesperrte Plattform, Zugangsdaten, Port, IP-Literal → abgelehnt, ohne Netz', async () => {
    const { n, aufloesungen } = netz({}, {});
    _netzSetzen(n);
    for (const url of ['https://anderer.example/', 'https://www.linkedin.com/in/x', 'https://nutzer:pw@beispiel-firma.example/', 'https://beispiel-firma.example:8080/', `https://${OEFFENTLICH}/`, 'ftp://beispiel-firma.example/', 'file:///etc/passwd']) {
      const r = await webLesen({ url }, lauf(['https://www.linkedin.com/in/x']));
      expect(r.ok, url).toBe(false);
    }
    expect(aufloesungen).toEqual([]);
  });
  it('Adressen aus der Suche dieses Laufs sind erlaubt — genau diese', async () => {
    const { n } = netz({ 'presse.example': [[OEFFENTLICH]] }, { [`${OEFFENTLICH} /artikel`]: { text: 'Bericht' } });
    _netzSetzen(n);
    expect((await webLesen({ url: 'https://presse.example/artikel' }, lauf(['https://presse.example/artikel']))).ok).toBe(true);
    expect(await webLesen({ url: 'https://presse.example/andere' }, lauf(['https://presse.example/artikel']))).toMatchObject({ ok: false, klasse: 'rechte' });
  });
  it('robots.txt verbietet → abgelehnt; höchstens 20 Abrufe je Lauf; Teil 2 ohne neuen Abruf', async () => {
    const lang = 'x'.repeat(WEB.zeichen + 10);
    const { n, aufrufe } = netz({ 'beispiel-firma.example': [[OEFFENTLICH]] }, {
      [`${OEFFENTLICH} /robots.txt`]: { typ: 'text/plain', text: 'User-agent: *\nDisallow: /intern' },
      [`${OEFFENTLICH} /intern/x`]: { text: 'geheim' }, [`${OEFFENTLICH} /lang`]: { typ: 'text/plain', text: lang },
      ...Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`${OEFFENTLICH} /s${i}`, { text: `Seite ${i}` }])),
    });
    _netzSetzen(n);
    const l = lauf();
    expect((await webLesen({ url: 'https://beispiel-firma.example/intern/x' }, l)).meldung).toMatch(/robots\.txt/);
    expect(aufrufe.some(a => a.url.endsWith('/intern/x'))).toBe(false);
    const t1 = await webLesen({ url: 'https://beispiel-firma.example/lang' }, l);
    expect(t1.meldung).toMatch(/Teil 1 von 2/);
    const vor = aufrufe.length;
    const t2 = await webLesen({ url: 'https://beispiel-firma.example/lang', teil: 2 }, l);
    expect(t2.meldung).toMatch(/Teil 2 von 2/);
    expect(aufrufe.length).toBe(vor);
    for (let i = 0; i < 25; i++) await webLesen({ url: `https://beispiel-firma.example/s${i}` }, l);
    expect(l.abrufe).toBe(WEB.abrufeJeLauf);
    expect((await webLesen({ url: 'https://beispiel-firma.example/s24' }, l)).meldung).toMatch(/20 Abrufe/);
  });
});

describe('der echte Abruf verbindet mit der festgehaltenen Adresse', () => {
  let server: Server;
  let port = 0;
  const gesehen: string[] = [];
  beforeAll(async () => {
    server = createServer((req, res) => { gesehen.push(String(req.headers.host)); res.writeHead(200, { 'content-type': 'text/plain' }); res.end(req.url === '/gross' ? 'y'.repeat(3 * 1024 * 1024) : 'hallo'); });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>(r => server.close(() => r())));
  it('ein nicht auflösbarer Name erreicht den Server über die festgehaltene Adresse — es gibt keine zweite Auflösung', async () => {
    const ctl = new AbortController();
    const r = await httpAbrufen({ url: new URL(`http://nicht-aufloesbar.invalid:${port}/`), ziel: { adresse: '127.0.0.1', familie: 4 }, signal: ctl.signal, maxBytes: WEB.maxBytes, verbindenMs: 2000, kopf: {} });
    expect(r.status).toBe(200);
    expect(r.bytes.toString()).toBe('hallo');
    expect(gesehen.at(-1)).toBe(`nicht-aufloesbar.invalid:${port}`);
  });
  it('über 2 MB bricht der Abruf ab', async () => {
    const r = await httpAbrufen({ url: new URL(`http://nicht-aufloesbar.invalid:${port}/gross`), ziel: { adresse: '127.0.0.1', familie: 4 }, signal: new AbortController().signal, maxBytes: WEB.maxBytes, verbindenMs: 2000, kopf: {} });
    expect(r.zuGross).toBe(true);
  });
});
