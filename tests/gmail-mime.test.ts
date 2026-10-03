// Gmail: MIME lesen und bauen (lib/gmail/mime.ts, html.ts) — multipart/alternative, Umlaute (UTF-8, Latin-1, Windows-1252),
// Quoted-Printable und Base64, RFC-2047-Kopfzeilen, Anhänge nur als Metadaten, HTML säubern (Skripte, Tracking-Pixel, Links),
// Antwort bauen (Thread-Köpfe, kein Header-Injection).
import { describe, it, expect } from 'vitest';
import { rfc2047Lesen, rfc2047Bauen, adressenLesen, adresseBauen, nachrichtAus, quotedPrintableBauen, quotedPrintableLesen, mimeBauen, rfc822Lesen, antwortBetreff, referenzenFuer, zeichensatzLesen, teilFinden, adresseGueltig, type GMessage, type GPart } from '@/lib/gmail/mime';
import { htmlZuText, linkSauber, entitaetenLesen } from '@/lib/gmail/html';
import { stuecke } from '@/components/os/inbox/GmailText';

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const teil = (mimeType: string, text: string, charset = 'utf-8', extra: Partial<GPart> = {}): GPart => ({ mimeType, headers: [{ name: 'Content-Type', value: `${mimeType}; charset="${charset}"` }], body: { size: text.length, data: b64u(Buffer.from(text, charset === 'utf-8' ? 'utf8' : 'latin1')) }, ...extra });
const nachricht = (payload: GPart, kopf: Record<string, string> = {}, extra: Partial<GMessage> = {}): GMessage => ({
  id: '18c0000001ab', threadId: '18c0000001ab', labelIds: ['INBOX', 'UNREAD'], internalDate: String(Date.parse('2026-10-03T09:00:00Z')), snippet: 'Hallo &amp; Willkommen',
  payload: { ...payload, headers: [...Object.entries({ From: 'Anna Müller <anna@firma.example.invalid>', To: 'kevin@makeinnovation.test', Subject: 'Angebot', ...kopf }).map(([name, value]) => ({ name, value })), ...(payload.headers ?? [])] }, ...extra,
});

describe('RFC 2047 und Adressen', () => {
  it('liest Q- und B-Wörter, setzt benachbarte Wörter zusammen, kennt Zeichensätze', () => {
    expect(rfc2047Lesen('=?UTF-8?Q?M=C3=BCller_&_S=C3=B6hne?=')).toBe('Müller & Söhne');
    expect(rfc2047Lesen('=?UTF-8?B?QW5nZWJvdCBmw7xyIFNpZQ==?=')).toBe('Angebot für Sie');
    expect(rfc2047Lesen('=?utf-8?B?w4RyZ2Vy?=\r\n =?utf-8?B?bGljaA==?=')).toBe('Ärgerlich');
    expect(rfc2047Lesen('=?ISO-8859-1?Q?Gr=FC=DFe_aus_K=F6ln?=')).toBe('Grüße aus Köln');
    expect(rfc2047Lesen('Ohne Kodierung')).toBe('Ohne Kodierung');
  });
  it('baut RFC-2047-Wörter nur bei Bedarf, in Stücken ≤ 75 Zeichen, nie mitten in einem Umlaut', () => {
    expect(rfc2047Bauen('Angebot')).toBe('Angebot');
    const lang = rfc2047Bauen('Größenänderung für Übergabe '.repeat(6));
    for (const w of lang.split(' ')) expect(w.length).toBeLessThanOrEqual(75);
    expect(rfc2047Lesen(lang)).toBe('Größenänderung für Übergabe '.repeat(6).trim());
  });
  it('liest Adresslisten: Kommas in Namen, Anführungszeichen, kodierte Namen, Ungültiges fällt weg, keine Doppelten', () => {
    const l = adressenLesen('"Müller, Anna" <Anna@Firma.example.invalid>, =?UTF-8?Q?J=C3=B6rg?= <joerg@x.example.invalid>, kaputt, <leer@>, anna@firma.example.invalid');
    expect(l).toEqual([{ name: 'Müller, Anna', email: 'anna@firma.example.invalid' }, { name: 'Jörg', email: 'joerg@x.example.invalid' }]);
    expect(adressenLesen('x@y.example.invalid\r\nBcc: evil@example.invalid')).toEqual([]);
    expect(adresseGueltig('a@b.example.invalid')).toBe(true);
    expect(adresseGueltig('a b@c.example.invalid')).toBe(false);
    expect(adresseGueltig('a@b')).toBe(false);
  });
  it('baut Adressen für Kopfzeilen — Name ohne Umbruch, Umlaut als Wort', () => {
    expect(adresseBauen({ name: 'Kevin "K" Beispiel', email: 'k@x.example.invalid' })).toBe('"Kevin \\"K\\" Beispiel" <k@x.example.invalid>');
    expect(adresseBauen({ name: 'Jörg\r\nBcc: x@y.example.invalid', email: 'j@x.example.invalid' })).not.toMatch(/\r|\n/);
    expect(adresseBauen({ email: 'k@x.example.invalid' })).toBe('k@x.example.invalid');
  });
});

describe('Quoted-Printable und Zeichensätze', () => {
  it('Rundlauf mit Umlauten, Gleichheitszeichen, langen Zeilen und Leerzeichen am Zeilenende', () => {
    const text = `Grüße aus Köln: a=b ${'ä'.repeat(90)}\nZeile mit Leerzeichen am Ende   \nÜberschrift ß €`;
    const qp = quotedPrintableBauen(text);
    for (const z of qp.split('\r\n')) expect(z.length).toBeLessThanOrEqual(76);
    expect(qp).not.toMatch(/[^\x00-\x7f]/);
    expect(quotedPrintableLesen(qp).toString('utf8').replace(/\r\n/g, '\n')).toBe(text);
  });
  it('liest Latin-1 und Windows-1252 (€ in 1252), unbekannte Zeichensätze fallen auf UTF-8', () => {
    expect(zeichensatzLesen(Buffer.from('Grüße', 'latin1'), 'iso-8859-1')).toBe('Grüße');
    expect(zeichensatzLesen(Buffer.from([0x80, 0x20, 0xe4]), 'windows-1252')).toBe('€ ä');
    expect(zeichensatzLesen(Buffer.from('Grüße', 'utf8'), 'x-gibts-nicht')).toBe('Grüße');
    expect(zeichensatzLesen(Buffer.from([0xff, 0xfe, 0x41]), 'utf-8')).toContain('A');
  });
});

describe('Nachrichtenbaum → Kopf + Text', () => {
  it('multipart/alternative: text/plain gewinnt, Umlaute stimmen, Betreff und Name aus RFC-2047', () => {
    const baum: GPart = { mimeType: 'multipart/alternative', headers: [{ name: 'Content-Type', value: 'multipart/alternative; boundary=x' }, ], body: { size: 0 }, parts: [teil('text/plain', 'Guten Tag,\nanbei das Angebot für Sie. Grüße'), teil('text/html', '<p>HTML-Fassung <b>anders</b></p>')] };
    const { kopf, text } = nachrichtAus(nachricht(baum, { From: '=?UTF-8?Q?Anna_M=C3=BCller?= <ANNA@firma.example.invalid>', Subject: '=?UTF-8?Q?Angebot_f=C3=BCr_Sie?=' }));
    expect(text).toBe('Guten Tag,\nanbei das Angebot für Sie. Grüße');
    expect(kopf.von).toEqual({ name: 'Anna Müller', email: 'anna@firma.example.invalid' });
    expect(kopf.betreff).toBe('Angebot für Sie');
    expect(kopf.am).toBe('2026-10-03T09:00:00.000Z');
    expect(kopf.labels).toEqual(['INBOX', 'UNREAD']);
    expect(kopf.ausschnitt).toBe('Hallo & Willkommen');
  });
  it('nur HTML: wird zu Text; Latin-1-Körper (charset im Teil) und Windows-1252', () => {
    const html = nachrichtAus(nachricht(teil('text/html', '<div>Gr&uuml;&szlig;e<br>Zeile 2</div>')));
    expect(html.text).toBe('Grüße\nZeile 2');
    const latin = nachrichtAus(nachricht(teil('text/plain', 'Größe: 5 m²', 'iso-8859-1')));
    expect(latin.text).toBe('Größe: 5 m²');
    const w = nachricht({ mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset=windows-1252' }], body: { size: 3, data: b64u(Buffer.from([0x80, 0x20, 0xe4])) } });
    expect(nachrichtAus(w).text).toBe('€ ä');
  });
  it('Anhänge nur als Metadaten (Name, Typ, Größe, Teil) — nie Inhalt; eingebettete Bilder markiert', () => {
    const baum: GPart = { partId: '0', mimeType: 'multipart/mixed', body: { size: 0 }, parts: [
      { partId: '0.0', ...teil('text/plain', 'Siehe Anhang.') },
      { partId: '0.1', mimeType: 'application/pdf', filename: '=?UTF-8?B?QW5nZWJvdC5wZGY=?=', headers: [{ name: 'Content-Disposition', value: 'attachment; filename="Angebot.pdf"' }], body: { attachmentId: 'ANG1', size: 123456 } },
      { partId: '0.2', mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-ID', value: '<cid1>' }, { name: 'Content-Disposition', value: 'inline' }], body: { attachmentId: 'ANG2', size: 900, data: b64u('PNGDATEN') } },
    ] };
    const { kopf, text } = nachrichtAus(nachricht(baum));
    expect(text).toBe('Siehe Anhang.');
    expect(kopf.anhaenge).toEqual([
      { teil: '0.1', name: 'Angebot.pdf', typ: 'application/pdf', groesse: 123456 },
      { teil: '0.2', name: 'logo.png', typ: 'image/png', groesse: 900, eingebettet: true },
    ]);
    expect(JSON.stringify(kopf)).not.toContain('PNGDATEN');
    expect(JSON.stringify(kopf)).not.toContain('ANG1');
    expect(teilFinden(baum, '0.1')?.body?.attachmentId).toBe('ANG1');
  });
  it('Thread-Köpfe, Reply-To, Newsletter-Merkmal, Kürzung, kaputte Kopfzeilen werfen nie', () => {
    const lang = 'x'.repeat(50_000);
    const { kopf, text } = nachrichtAus(nachricht(teil('text/plain', lang), { 'Message-ID': '<abc@mail.example.invalid>', 'In-Reply-To': '<vorher@mail.example.invalid>', References: '<a@x.example.invalid> <vorher@mail.example.invalid>', 'Reply-To': 'Antwort <antwort@firma.example.invalid>', 'List-Unsubscribe': '<mailto:u@x.example.invalid>' }));
    expect(kopf.messageId).toBe('<abc@mail.example.invalid>');
    expect(kopf.inReplyTo).toBe('<vorher@mail.example.invalid>');
    expect(kopf.references).toEqual(['<a@x.example.invalid>', '<vorher@mail.example.invalid>']);
    expect(kopf.antwortAn?.email).toBe('antwort@firma.example.invalid');
    expect(kopf.liste).toBe(true);
    expect(kopf.gekuerzt).toBe(true);
    expect(text.length).toBe(40_000);
    expect(() => nachrichtAus({ id: 'x1y2z3a4', threadId: 't', payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: '≠≠' }], body: { data: '!!!' } } })).not.toThrow();
  });
});

describe('Antwort bauen (RFC 5322)', () => {
  const basis = { von: { name: 'Kevin Beispiel', email: 'kevin@makeinnovation.test' }, an: [{ name: 'Anna Müller', email: 'anna@firma.example.invalid' }], betreff: 'Re: Angebot für Sie', text: 'Hallo Anna,\n\nvielen Dank — Grüße, Kevin\n' };
  it('Thread-Köpfe, UTF-8 Quoted-Printable, Betreff als Wort, Rundlauf', () => {
    const roh = mimeBauen({ ...basis, inReplyTo: '<abc@mail.example.invalid>', references: ['<a@x.example.invalid>', '<abc@mail.example.invalid>'], datum: new Date('2026-10-03T10:00:00Z') });
    const r = rfc822Lesen(roh);
    expect(r.kopf['in-reply-to']).toEqual(['<abc@mail.example.invalid>']);
    expect(r.kopf['references']).toEqual(['<a@x.example.invalid> <abc@mail.example.invalid>']);
    expect(rfc2047Lesen(r.kopf.subject[0])).toBe('Re: Angebot für Sie');
    expect(r.kopf['content-transfer-encoding']).toEqual(['quoted-printable']);
    expect(r.kopf['mime-version']).toEqual(['1.0']);
    expect(r.kopf['message-id'][0]).toMatch(/^<[A-Za-z0-9_-]{20,}@makeinnovation\.test>$/);
    expect(adressenLesen(r.kopf.from[0])).toEqual([{ name: 'Kevin Beispiel', email: 'kevin@makeinnovation.test' }]);
    expect(adressenLesen(r.kopf.to[0])).toEqual([{ name: 'Anna Müller', email: 'anna@firma.example.invalid' }]);
    expect(r.text).toBe('Hallo Anna,\n\nvielen Dank — Grüße, Kevin');
    expect(roh).not.toMatch(/[^\x00-\x7f]/);
    expect(roh.split('\r\n').every(z => z.length <= 78)).toBe(true);
  });
  it('kein Header-Injection: Zeilenumbrüche in Betreff und Namen werden zu Leerzeichen, ungültige Adressen werfen', () => {
    const roh = mimeBauen({ ...basis, betreff: 'Hallo\r\nBcc: evil@example.invalid', von: { name: 'Kevin\r\nBcc: x@y.example.invalid', email: 'kevin@makeinnovation.test' } });
    const kopf = roh.split('\r\n\r\n')[0];
    expect(kopf).not.toMatch(/^Bcc:/im);
    expect(() => mimeBauen({ ...basis, an: [{ email: 'a@b.example.invalid\r\nBcc: e@x.example.invalid' }] })).toThrow();
    expect(() => mimeBauen({ ...basis, an: [] })).toThrow();
  });
  it('Re: genau einmal, References ohne Doppelte und ungültige Kennungen', () => {
    expect(antwortBetreff('Angebot')).toBe('Re: Angebot');
    expect(antwortBetreff('Re: Angebot')).toBe('Re: Angebot');
    expect(antwortBetreff('AW: Angebot')).toBe('AW: Angebot');
    expect(antwortBetreff('')).toBe('Re: (kein Betreff)');
    expect(referenzenFuer(['<a@x.example.invalid>', 'kaputt', '<a@x.example.invalid>'], '<b@x.example.invalid>')).toEqual(['<a@x.example.invalid>', '<b@x.example.invalid>']);
  });
});

describe('HTML säubern', () => {
  it('Skripte, Styles, Kommentare, Formulare, Frames: weg samt Inhalt — auch verschachtelt getarnt', () => {
    const h = htmlZuText('<p>Hallo</p><script>alert(1)</script><style>p{color:red}</style><!-- <script>x</script> --><iframe src="https://evil.example.invalid"></iframe><scr<script>ipt>alert(2)</scr</script>ipt><form action="x"><input value="geheim"></form><noscript><img src="https://t.example.invalid/n.gif"></noscript>Ende');
    // Ein getarntes, nie geschlossenes <script> verschluckt den Rest — lieber zu wenig Text als ein durchgerutschtes Tag.
    expect(h.text.startsWith('Hallo')).toBe(true);
    expect(h.text).not.toMatch(/script|alert|color|evil|geheim|t\.example|</i);
    expect(htmlZuText('<p>A</p><script>x()</script><p>B</p><style>.a{}</style>C').text).toBe('A\n\nB\nC');
  });
  it('Tracking-Pixel und Bilder: nie geladen, nie angezeigt (nur Alternativtext), gezählt', () => {
    const h = htmlZuText('<p>Text</p><img src="https://track.example.invalid/p.gif?u=123" width="1" height="1"><img src="https://x.example.invalid/logo.png" alt="Firmenlogo"><img src="data:image/gif;base64,AAAA">');
    expect(h.bilder).toBe(3);
    expect(h.text).toBe('Text\n [Bild: Firmenlogo]'.replace('\n ', '\n').replace(/^Text\n/, 'Text\n'));
    expect(h.text).not.toMatch(/track|123|data:|logo\.png/);
  });
  it('Links: die echte Adresse steht immer dabei, nur http(s)/mailto, Tracking-Parameter weg, javascript: weg', () => {
    const h = htmlZuText('<a href="https://sparkasse.example.invalid/login?utm_source=nl&fbclid=1&id=7">Zur Sparkasse</a> <a href="https://x.example.invalid/">https://x.example.invalid/</a> <a href="javascript:alert(1)">Klick</a> <a href="mailto:anna@firma.example.invalid">Schreib mir</a> <a href="/relativ">rel</a>');
    expect(h.text).toContain('Zur Sparkasse (https://sparkasse.example.invalid/login?id=7)');
    expect(h.text).not.toContain('utm_');
    expect(h.text).not.toContain('fbclid');
    expect(h.text).not.toContain('javascript');
    expect(h.text).toContain('Schreib mir (mailto:anna@firma.example.invalid)');
    expect(h.text.match(/https:\/\/x\.example\.invalid\/?/g)?.length).toBe(1); // Text = Adresse → nicht doppelt
    expect(h.text).not.toContain('/relativ');
    expect(linkSauber('https://user:pw@x.example.invalid/')).toBeNull();
    expect(linkSauber('ftp://x.example.invalid/')).toBeNull();
    expect(linkSauber('java\nscript:alert(1)')).toBeNull();
  });
  it('Entitäten, Listen, Absätze; unsichtbare Steuerzeichen und Richtungsumschalter fallen weg', () => {
    expect(entitaetenLesen('&auml;&#252;&#x20AC; &amp;lt; &nbsp;&unbekannt; &#8238;')).toBe('äü€ &lt;  &unbekannt; ');
    const h = htmlZuText('<ul><li>Eins</li><li>Zwei</li></ul><p>Absatz​ eins</p><p>Absatz zwei</p>');
    expect(h.text).toBe('• Eins\n• Zwei\n\nAbsatz eins\n\nAbsatz zwei');
    expect(htmlZuText('<b>offen').text).toBe('offen');
    expect(htmlZuText('<div>' + 'a'.repeat(10) + '</div><![CDATA[x]]><?php echo 1 ?>').text).toBe('a'.repeat(10));
  });
});

describe('Text anzeigen: nur Web-Adressen anklickbar', () => {
  it('erkennt http(s), schneidet Satzzeichen ab, lässt javascript:/data: Klartext', () => {
    const s = stuecke('Siehe https://x.example.invalid/pfad?a=1, oder (http://y.example.invalid). javascript:alert(1) data:text/html,x');
    expect(s.filter(x => x.url).map(x => x.url)).toEqual(['https://x.example.invalid/pfad?a=1', 'http://y.example.invalid/']);
    expect(s.map(x => x.text).join('')).toContain('javascript:alert(1)');
    expect(s.every(x => !x.url || /^https?:/.test(x.url))).toBe(true);
  });
});
