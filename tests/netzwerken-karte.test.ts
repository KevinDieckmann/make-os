// ─── Netzwerken · Meine Visitenkarten, reine Logik (02.10., Paket B) ─────────────
// vCard 3.0 (Escaping, Umlaute, nur gesetzte Felder, Falten, Logo nur klein und nur als PNG/JPG in der Datei), Prüfung der
// Profile, Firmen-Design (Standard neutral, Kontrastwarnung), SVG-Säuberung, Logo-Prüfung — und der QR-Code: mit einem echten
// Decoder (jsQR) wird geprüft, dass der Code genau diese vCard trägt (auch Umlaute als UTF-8).
import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import {
  vcard, vMaske, vFalten, vcardDateiname, pruefeKarte, kartenDesign, kontrast, kontrastWarnungen, logoPruefen, hexNorm, nameAusKonto, linkedinAdresse, webAdresse,
  MAX_KARTEN, LOGO_MAX, STANDARD_DESIGN, type Visitenkarte,
} from '@/lib/netzwerken/karte';
import { saeubereSvg } from '@/lib/netzwerken/svg';
import { qrMatrix, qrPfad, alsBinaerString } from '@/lib/netzwerken/qr';

const ID = 'v-3f2b9c1e-0000-4000-8000-000000000001';
const karte = (x: Partial<Visitenkarte> = {}): Visitenkarte => ({ id: ID, rang: 0, vorname: 'Erika', nachname: 'Muster', rolle: 'Chief of Staff', firma: 'Beispiel GmbH', email: 'erika@beispiel.invalid', handy: '+49 170 0000000', ...x });
const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const svgUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

describe('vCard 3.0', () => {
  it('trägt nur die gesetzten Felder, mit CRLF, Version 3.0 und N/FN', () => {
    const v = vcard(karte());
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(v.endsWith('END:VCARD\r\n')).toBe(true);
    expect(v).toContain('N:Muster;Erika;;;');
    expect(v).toContain('FN:Erika Muster');
    expect(v).toContain('ORG:Beispiel GmbH');
    expect(v).toContain('TITLE:Chief of Staff');
    expect(v).toContain('EMAIL;TYPE=INTERNET,WORK:erika@beispiel.invalid');
    expect(v).toContain('TEL;TYPE=CELL:+49 170 0000000');
    for (const nicht of ['URL', 'ADR', 'TEL;TYPE=WORK', 'PHOTO', 'LinkedIn']) expect(v).not.toContain(nicht);
  });
  it('nimmt Anschrift, Website und LinkedIn auf, wenn gesetzt — Design-Felder nie', () => {
    const v = vcard(karte({ web: 'https://beispiel.invalid', linkedin: 'https://www.linkedin.com/in/erika-muster', telefon: '+49 30 1234', strasse: 'Musterweg 1', plz: '10115', ort: 'Berlin', land: 'Deutschland', farbe: '#cff008', hintergrund: '#0f1919', textfarbe: '#f6f6f6', schrift: 'urbanist', bezeichnung: 'Profil Eins' }));
    expect(v).toContain('URL:https\\://beispiel.invalid'.replace('\\:', ':'));
    expect(v).toContain('URL;TYPE=LinkedIn:https://www.linkedin.com/in/erika-muster');
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+49 30 1234');
    expect(v).toContain('ADR;TYPE=WORK:;;Musterweg 1;Berlin;;10115;Deutschland');
    for (const nicht of ['cff008', '0f1919', 'urbanist', 'Profil Eins']) expect(v).not.toContain(nicht);
  });
  it('maskiert Backslash, Komma, Semikolon und Zeilenumbruch', () => {
    expect(vMaske('a\\b,c;d\ne')).toBe('a\\\\b\\,c\\;d\\ne');
    const v = vcard(karte({ firma: 'Müller, Meier & Söhne; Co.', rolle: 'Leiter\nVertrieb' }));
    expect(v).toContain('ORG:Müller\\, Meier & Söhne\\; Co.');
    expect(v).toContain('TITLE:Leiter\\nVertrieb');
  });
  it('Umlaute und Sonderzeichen bleiben UTF-8 im Text', () => {
    const v = vcard(karte({ vorname: 'Jürgen', nachname: 'Öztürk-Straße', firma: 'Café Zoë' }));
    expect(v).toContain('N:Öztürk-Straße;Jürgen;;;');
    expect(v).toContain('ORG:Café Zoë');
  });
  it('nur Firma (kein Name): FN = Firma, als Firmenkarte markiert', () => {
    const v = vcard({ id: ID, rang: 0, firma: 'Beispiel GmbH' });
    expect(v).toContain('FN:Beispiel GmbH');
    expect(v).toContain('X-ABShowAs:COMPANY');
  });
  it('faltet in der Datei auf höchstens 75 Oktette, nie mitten im Zeichen; im QR-Text nicht', () => {
    const lang = karte({ rolle: 'Ä'.repeat(120) });
    const datei = vcard(lang, { falten: true });
    for (const z of datei.split('\r\n')) expect(new TextEncoder().encode(z).length).toBeLessThanOrEqual(75);
    // Entfalten ergibt die ungefaltete Fassung zurück
    expect(datei.replace(/\r\n /g, '')).toBe(vcard(lang));
    expect(vcard(lang)).toContain('TITLE:' + 'Ä'.repeat(120));
    expect(vFalten('kurz')).toBe('kurz');
  });
  it('Logo: nur in der Datei, nur als kleines PNG/JPG (PHOTO); nie im QR-Text, nie als SVG, nie zu groß', () => {
    const mitLogo = karte({ logo: PNG_1x1 });
    expect(vcard(mitLogo)).not.toContain('PHOTO');
    expect(vcard(mitLogo, { falten: true, mitLogo: true })).toContain('PHOTO;ENCODING=b;TYPE=PNG:');
    expect(vcard(karte({ logo: svgUrl('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>') }), { mitLogo: true })).not.toContain('PHOTO');
    const gross = 'data:image/png;base64,' + 'A'.repeat(50_000);
    expect(vcard(karte({ logo: gross }), { mitLogo: true })).not.toContain('PHOTO');
  });
  it('Dateiname aus dem Namen, ohne Umlaute und Sonderzeichen', () => {
    expect(vcardDateiname(karte({ vorname: 'Jürgen', nachname: 'Groß-Öztürk' }))).toBe('jurgen-gross-ozturk.vcf');
    expect(vcardDateiname({ id: ID, rang: 0, email: 'a@b.invalid' })).toBe('kontakt.vcf');
  });
});

describe('QR-Code trägt die vCard', () => {
  /** Matrix → Bild mit 6 px je Modul und Rand → jsQR → die gelesenen Bytes als UTF-8. */
  function lesen(text: string): string | null {
    const m = qrMatrix(text);
    const rand = 4, px = 6, n = (m.groesse + rand * 2) * px;
    const data = new Uint8ClampedArray(n * n * 4).fill(255);
    for (let r = 0; r < m.groesse; r++) for (let c = 0; c < m.groesse; c++) if (m.dunkel(r, c)) for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const i = (((r + rand) * px + y) * n + (c + rand) * px + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
    const e = jsQR(data, n, n);
    return e ? new TextDecoder().decode(Uint8Array.from(e.binaryData)) : null;
  }
  it('ein einfaches Profil wird 1:1 zurückgelesen', () => {
    const text = vcard(karte());
    expect(lesen(text)).toBe(text);
  });
  it('mit Umlauten, Sonderzeichen und allen Feldern — als UTF-8', () => {
    const text = vcard(karte({ vorname: 'Jürgen', nachname: 'Öztürk', firma: 'Café Zoë, Süd; Ost', rolle: 'Geschäftsführer ß', web: 'https://beispiel.invalid/ä', linkedin: 'https://www.linkedin.com/in/x', telefon: '+49 30 1234', strasse: 'Straße 5', plz: '10115', ort: 'Köln', land: 'Deutschland' }));
    expect(lesen(text)).toBe(text);
  });
  it('der Pfad hat die Randzone (4 Module) und ist deterministisch', () => {
    const a = qrPfad('x'), b = qrPfad('x');
    expect(a).toEqual(b);
    expect(a.n).toBe(a.module + 8);
    expect(alsBinaerString('ä')).toBe('Ã¤');
  });
  it('zu lange Texte werfen (die Oberfläche zeigt dann einen Hinweis)', () => {
    expect(() => qrMatrix('x'.repeat(5000))).toThrow();
  });
});

describe('Profil prüfen', () => {
  const j = '2026-10-02T10:00:00.000Z';
  it('gültig: Texte geglättet, Mail klein, Web mit https, LinkedIn aus dem Namen', () => {
    const r = pruefeKarte({ id: ID, vorname: '  Erika  ', nachname: 'Muster', email: 'ERIKA@Beispiel.INVALID', web: 'beispiel.invalid', linkedin: 'erika-muster', handy: '0170 123456', rang: 3 }, j);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.karte).toMatchObject({ vorname: 'Erika', email: 'erika@beispiel.invalid', web: 'https://beispiel.invalid', linkedin: 'https://www.linkedin.com/in/erika-muster', rang: 3, geaendert: j });
  });
  it('lehnt ab (nie still kürzen): zu lang, Mail, Telefon, Website, Farbe, Schrift, leere Karte, falsche Kennung', () => {
    const f = (x: Record<string, unknown>) => { const r = pruefeKarte({ id: ID, vorname: 'E', ...x }, j); return r.ok ? null : r.fehler; };
    expect(f({ rolle: 'x'.repeat(101) })).toMatch(/zu lang/);
    expect(f({ email: 'kein-at' })).toMatch(/E-Mail/);
    expect(f({ handy: 'abc' })).toMatch(/Handy/);
    expect(f({ telefon: '12' })).toMatch(/Telefon/);
    expect(f({ web: 'nicht gültig' })).toMatch(/Website/);
    expect(f({ farbe: 'rot' })).toMatch(/Akzentfarbe/);
    expect(f({ hintergrund: '#12' })).toMatch(/Hintergrundfarbe/);
    expect(f({ schrift: 'comic' })).toMatch(/Schrift/);
    expect(pruefeKarte({ id: ID }, j)).toMatchObject({ ok: false });
    expect(pruefeKarte({ id: 'x', vorname: 'E' }, j)).toMatchObject({ ok: false });
  });
  it('Steuerzeichen fallen weg; Standardschrift wird nicht gespeichert; Farben werden normalisiert', () => {
    const r = pruefeKarte({ id: ID, vorname: 'E\u0000r\nika', schrift: 'system', farbe: '#ABC', hintergrund: '#0F1919' }, j);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.karte.vorname).toBe('E r ika'); expect(r.karte.schrift).toBeUndefined(); expect(r.karte.farbe).toBe('#aabbcc'); expect(r.karte.hintergrund).toBe('#0f1919'); }
  });
  it('Hilfen: Konto-Name, LinkedIn, Web, Hex', () => {
    expect(nameAusKonto('Erika Maria Muster')).toEqual({ vorname: 'Erika', nachname: 'Maria Muster' });
    expect(nameAusKonto('Erika')).toEqual({ vorname: 'Erika', nachname: '' });
    expect(linkedinAdresse('linkedin.com/in/x')).toBe('https://linkedin.com/in/x');
    expect(linkedinAdresse('nicht gültig!')).toBe('');
    expect(webAdresse('')).toBe('');
    expect(hexNorm('#FFF')).toBe('#ffffff');
    expect(hexNorm('grün')).toBeNull();
    expect(MAX_KARTEN).toBe(20);
  });
});

describe('Firmen-Design', () => {
  it('Standard ist neutral — keine Marke', () => {
    const d = kartenDesign({});
    expect(d).toMatchObject({ hintergrund: STANDARD_DESIGN.hintergrund, text: STANDARD_DESIGN.text });
    expect(d.schrift).not.toMatch(/urbanist/i);
    expect(kartenDesign({ schrift: 'urbanist' }).schrift).toMatch(/^"Urbanist"/);
    expect(kontrastWarnungen({})).toEqual([]);
  });
  it('Kontrast nach WCAG: Schwarz auf Weiß 21:1, Warnung bei schlecht lesbarem Text', () => {
    expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(kontrastWarnungen({ hintergrund: '#0f1919', textfarbe: '#f6f6f6', farbe: '#cff008' })).toEqual([]);
    const schlecht = kontrastWarnungen({ hintergrund: '#cff008', textfarbe: '#f6f6f6' });
    expect(schlecht.some(w => /Text auf Hintergrund/.test(w))).toBe(true);
    const akzent = kontrastWarnungen({ hintergrund: '#0f1919', textfarbe: '#ffffff', farbe: '#101e1e' });
    expect(akzent.some(w => /Akzentfarbe/.test(w))).toBe(true);
  });
});

describe('SVG säubern', () => {
  const kopf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">';
  it('ein normales Logo mit <style>-Klassen bleibt erhalten', () => {
    const s = saeubereSvg(`<?xml version="1.0"?>${kopf}<defs><style>.cls-1 { fill: #cff008; } .cls-2{fill:#f7f7f7}</style></defs><g><path class="cls-1" d="M0 0h10v10z"/><rect class="cls-2" width="2" height="2"/></g></svg>`);
    expect(s).not.toBeNull();
    expect(s).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">');
    expect(s).toContain('.cls-1{fill:#cff008}');
    expect(s).toContain('<path class="cls-1" d="M0 0h10v10z"/>');
    expect(s).not.toContain('<?xml');
  });
  it('entfernt Skripte, Ereignis-Attribute, foreignObject, image, a, animate — samt Inhalt', () => {
    const s = saeubereSvg(`${kopf}<script>alert(1)</script><path d="M0 0h1" onload="alert(2)" onclick="x()"/><foreignObject><div>hi</div></foreignObject><image href="https://fremd.invalid/x.png"/><a href="javascript:alert(3)"><rect width="1" height="1"/></a><animate attributeName="x"/><circle r="2"/></svg>`)!;
    for (const nicht of ['script', 'alert', 'onload', 'onclick', 'foreignObject', 'div', 'image', 'fremd.invalid', 'javascript', '<a', 'animate']) expect(s).not.toContain(nicht);
    expect(s).toContain('<path d="M0 0h1"/>');
    expect(s).toContain('<circle r="2"/>');
  });
  it('keine externen Verweise: href nur auf #…, url() nur auf #…, kein @import, kein javascript in style', () => {
    const s = saeubereSvg(`${kopf}<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><style>@import url(https://fremd.invalid/a.css); .a{fill:url(https://fremd.invalid/x)} .b{fill:#000}</style></defs><use href="https://fremd.invalid/a.svg#x"/><use xlink:href="#g"/><path fill="url(https://fremd.invalid/f)" d="M0 0h1"/><path fill="url(#g)" style="fill:url(javascript:x);stroke:#111" d="M0 0h2"/></svg>`)!;
    expect(s).not.toContain('fremd.invalid');
    expect(s).not.toContain('@import');
    expect(s).not.toContain('javascript');
    expect(s).toContain('<use href="#g"/>');
    expect(s).toContain('fill="url(#g)"');
    expect(s).toContain('.b{fill:#000}');
    expect(s).toContain('<linearGradient id="g">');
  });
  it('kein SVG / nichts Brauchbares → null; fehlendes xmlns wird ergänzt; Kommentare und DOCTYPE fallen weg', () => {
    expect(saeubereSvg('<html><body>hi</body></html>')).toBeNull();
    expect(saeubereSvg('<svg><script>1</script></svg>')).toBeNull();
    const s = saeubereSvg('<!DOCTYPE svg PUBLIC "x" "http://fremd.invalid/dtd"><!-- c --><svg viewBox="0 0 1 1"><path d="M0 0h1"/></svg>')!;
    expect(s).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(s).not.toContain('DOCTYPE');
    expect(s).not.toContain('fremd.invalid');
    expect(s).not.toContain('<!--');
  });
  it('Text im Logo bleibt, Markup darin nicht', () => {
    const s = saeubereSvg(`${kopf}<text x="1" y="2">Beispiel &amp; Co</text></svg>`)!;
    expect(s).toContain('<text x="1" y="2">Beispiel &amp; Co</text>');
  });
});

describe('Logo prüfen', () => {
  it('PNG mit richtigem Kopf passt, falscher Kopf, falscher Typ, zu groß nicht', () => {
    expect(logoPruefen(PNG_1x1)).toEqual({ ok: true, logo: PNG_1x1 });
    expect(logoPruefen('data:image/png;base64,' + Buffer.from('kein bild').toString('base64'))).toMatchObject({ ok: false });
    expect(logoPruefen('data:image/gif;base64,R0lGOD')).toMatchObject({ ok: false });
    expect(logoPruefen('data:image/png;base64,' + 'A'.repeat(LOGO_MAX))).toMatchObject({ ok: false, fehler: expect.stringMatching(/zu groß/) });
    expect(logoPruefen('https://fremd.invalid/logo.png')).toMatchObject({ ok: false });
  });
  it('SVG wird beim Prüfen gesäubert und neu kodiert — das Original kommt nie zurück', () => {
    const r = logoPruefen(svgUrl('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><script>1</script><path d="M0 0h1v1z"/></svg>'));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const text = Buffer.from(r.logo.split(',')[1], 'base64').toString('utf8');
      expect(text).toContain('<path d="M0 0h1v1z"/>');
      expect(text).not.toMatch(/script|onload/);
    }
    expect(logoPruefen(svgUrl('<svg><script>1</script></svg>'))).toMatchObject({ ok: false });
  });
});

describe('Breites Wortmarken-Logo (ca. 4:1, mit Strichen unter Buchstabengruppen)', () => {
  // Erfundene Wortmarke im Stil „Name mit zweifarbigem Strich darunter, kleine Zeile darunter“ — breites Querformat.
  const WORTMARKE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" width="800" height="200">
  <title>Beispiel</title>
  <defs><style>.t{font-family:Inter,Arial,sans-serif;font-weight:800;fill:#111}.k{font-size:20px;letter-spacing:6px;fill:#444}</style></defs>
  <text class="t" x="0" y="120" font-size="120" textLength="780">BEISPIEL</text>
  <rect x="0" y="136" width="380" height="10" fill="#e5241d"/>
  <rect x="400" y="136" width="380" height="10" fill="#1fa97d"/>
  <text class="k" x="2" y="186">INNOVATION</text>
  <script>alert(1)</script>
</svg>`;
  it('wird sauber angenommen: Formen, Text, Klassen bleiben, Skript fällt weg', () => {
    const r = logoPruefen(svgUrl(WORTMARKE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const text = Buffer.from(r.logo.split(',')[1], 'base64').toString('utf8');
    expect(text).toContain('viewBox="0 0 800 200"');
    expect(text).toContain('<rect x="0" y="136" width="380" height="10" fill="#e5241d"/>');
    expect(text).toContain('fill="#1fa97d"');
    expect(text).toContain('>INNOVATION</text>');
    expect(text).toContain('.t{font-family:Inter,Arial,sans-serif;font-weight:800;fill:#111}');
    expect(text).not.toMatch(/script|alert/);
    expect(r.logo.length).toBeLessThan(LOGO_MAX);
  });
  it('als Karten-Logo gespeichert und von der Karte gezeigt (Querformat, Höhe begrenzt, Breite ≤ 78 %)', async () => {
    const r = pruefeKarte({ id: ID, vorname: 'E', logo: svgUrl(WORTMARKE) }, '2026-10-02T10:00:00.000Z');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { createElement: h } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { KartenAnsicht } = await import('@/components/os/netzwerken/QrKarte');
    const html = renderToStaticMarkup(h(KartenAnsicht, { karte: r.karte }));
    expect(html).toContain('<img src="data:image/svg+xml;base64,');
    expect(html).toContain('max-height:48px');
    expect(html).toContain('max-width:78%');
    expect(html).toContain('object-fit:contain');
  });
});

