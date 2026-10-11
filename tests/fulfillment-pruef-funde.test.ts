// ─── Fulfillment — Prüf-Funde 11.10. (Sicherheit, Datenschutz, Funktion) — die reinen Teile ──────────────────────────────────────────────────
// Jeder Fund hat hier seinen Angriffs- bzw. Funktionsfall (Laufzeit-Grenzen gemessen): robots.txt linear (1), HEIC-iloc ohne Fortschritt (2),
// HTML-Säuberung linear + 500 KB für `web_lesen` (3), Personenteil-Gate und Namen-Varianten (5), aktive Inhalte in Office/PDF (7), höchstens EIN
// gültiger Kunden-Link (8), Token schwärzen (9), nur geteilte Entscheidungen beim Kunden (11). Dazu die Funde der Funktions-Prüfung: Fortschritt
// über alle Blätter + Playbook-Formular abgeleitet, Bestandsmandate ohne Flut, Ablauf-Import idempotent, Rückgängig mit höherer Fassung, Nachfass-
// Takt ab dem Messetag, Messlücken ohne Messung, Glocke je Kunden-Link. Erfundene Daten, kein Netz.
import { describe, it, expect } from 'vitest';
import { crc32, deflateRawSync, deflateSync } from 'node:zlib';
import { robotsLesen, robotsErlaubt, robotsPasst, textAus, WEB, ROBOTS } from '@/lib/fulfillment/analyse/web-lesen';
import { heicOhneMetadaten } from '@/lib/fulfillment/kunde/upload';
import { htmlZuText } from '@/lib/gmail/html';
import { aktiveInhalte, relsPruefen, ohneStroeme } from '@/lib/dateien/aktive-inhalte';
import { aufgabenTypErkennen } from '@/lib/dateien/aufgaben-regeln';
import { linkAnwenden, aktiverLink, type LinkKontext } from '@/lib/fulfillment/kunde/link';
import { tokenSchwaerzen } from '@/lib/fulfillment/kunde/token';
import { reportZusatz } from '@/lib/fulfillment/kunde/report-zusatz';
import { kundenSicht, kundeHinweis } from '@/lib/fulfillment/kunde/sicht';
import { namenErsetzen } from '@/lib/fulfillment/analyse/pruefen';
import { laufFuerAntwort } from '@/lib/fulfillment/analyse/sicht';
import { tiefenberichtFrageGrund, PERSONEN_AGENTEN } from '@/lib/fulfillment/analyse/lauf';
import { fallFortschritt, aktuellerKnoten, onboardingKandidaten, istBestand, MARKE_FULFILLMENT_SEIT } from '@/lib/fulfillment/regeln';
import { fallStarten, fallAnwenden, OB_PLAYBOOK_FORMULAR_ID, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { fallWirksam, type OnboardingAbleitung } from '@/lib/fulfillment/prozesse/onboarding';
import { importAnwenden, importVorschau, importRueckgaengig } from '@/lib/fulfillment/prozesse/import';
import { leerKunde, leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { MUSTER_P1, MUSTER_P2, MUSTER_P3 } from '@/lib/fulfillment/muster';
import { MESSE_NACHFASS_TAGE } from '@/lib/fulfillment/prozesse/bausteine';
import { berechneModell } from '@/lib/kennzahlen/kern';
import { pruefeEingabe, eintragAus, einfuegen, leererBestand } from '@/lib/meldungen/regeln';
import type { AnalyseLauf, Fall, KundeDatei, KundenLink } from '@/lib/fulfillment/typen';

const dauer = (f: () => unknown): number => { const t = performance.now(); f(); return performance.now() - t; };

// ── 1 · robots.txt linear ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 1: robots.txt ohne RegExp aus fremden Regeln', () => {
  it('bösartige Regel (viele Sterne, langer Pfad) bleibt unter 50 ms und gibt ein sinnvolles Ergebnis', () => {
    // Die frühere RegExp brauchte für 5 Sterne und 200 Zeichen rund 9,5 s.
    const boese = robotsLesen(`User-agent: *\nDisallow: /${'*a'.repeat(15)}*b$`);
    const pfad = `/${'a'.repeat(2000)}`;
    expect(dauer(() => robotsErlaubt(boese, pfad))).toBeLessThan(50);
    expect(robotsErlaubt(boese, pfad)).toBe(true); // endet nicht auf „b“
    expect(robotsErlaubt(boese, `${pfad}b`)).toBe(false);
    // Viele solcher Regeln (Deckel) und ein langer Pfad: ebenso schnell.
    const viele = robotsLesen(`User-agent: *\n${Array.from({ length: 1500 }, () => `Disallow: /${'*aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab'.repeat(14)}`).join('\n')}`);
    expect(dauer(() => robotsErlaubt(viele, `/${'a'.repeat(2040)}`))).toBeLessThan(150);
  });
  it('dieselbe Bedeutung wie bisher: `*`, `$` am Ende, `$` mitten im Pfad wörtlich, längste Regel gewinnt', () => {
    const r = robotsLesen('User-agent: *\nDisallow: /intern\nAllow: /intern/presse\nDisallow: /*.pdf$\nDisallow: /a$b');
    expect(robotsErlaubt(r, '/intern/x')).toBe(false);
    expect(robotsErlaubt(r, '/intern/presse/1')).toBe(true);
    expect(robotsErlaubt(r, '/unterlagen/a.pdf')).toBe(false);
    expect(robotsErlaubt(r, '/unterlagen/a.pdf?x=1')).toBe(true);
    expect(robotsErlaubt(r, '/a$b/c')).toBe(false);
    expect(robotsPasst('/x*y*z', '/x1y2z3')).toBe(true);
    expect(robotsPasst('/x*y*z$', '/x1y2z3')).toBe(false);
    expect(robotsPasst('/x*y*z$', '/xyz')).toBe(true);
    expect(robotsPasst('/x**y', '/xy')).toBe(true);
    expect(robotsPasst('*', '/egal')).toBe(true);
  });
  it('über den Grenzen vorsichtig: zu lange/sternreiche Disallow gilt, zu langer Pfad bzw. zu viele Regeln → nicht erlaubt', () => {
    expect(robotsPasst(`/${'x'.repeat(ROBOTS.regelZeichen)}`, '/x')).toBeNull();
    expect(robotsErlaubt([{ erlaubt: false, pfad: `/${'*x'.repeat(ROBOTS.sterne + 1)}` }], '/egal')).toBe(false);
    expect(robotsErlaubt([{ erlaubt: true, pfad: `/${'*x'.repeat(ROBOTS.sterne + 1)}` }, { erlaubt: false, pfad: '/' }], '/egal')).toBe(false);
    expect(robotsErlaubt([], `/${'a'.repeat(ROBOTS.pfadZeichen + 1)}`)).toBe(false);
    expect(robotsErlaubt(Array.from({ length: ROBOTS.regeln + 1 }, () => ({ erlaubt: true, pfad: '/x' })), '/y')).toBe(false);
  });
});

// ── 2 · HEIC ohne Endlosschleife ──────────────────────────────────────────────────────────────────────────────────────────────────────

const box = (art: string, inhalt: Buffer) => { const b = Buffer.alloc(8); b.writeUInt32BE(8 + inhalt.length, 0); b.write(art, 4); return Buffer.concat([b, inhalt]); };
function heic(iloc: Buffer, nutz = Buffer.from('Exif\0\0GPS-51.2N')): Uint8Array {
  const ftyp = box('ftyp', Buffer.concat([Buffer.from('heic'), Buffer.alloc(4), Buffer.from('mif1')]));
  const infe = box('infe', Buffer.concat([Buffer.from([2, 0, 0, 0]), Buffer.from([0, 1]), Buffer.from([0, 0]), Buffer.from('Exif'), Buffer.from([0])]));
  const iinf = box('iinf', Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from([0, 1]), infe]));
  return new Uint8Array(Buffer.concat([ftyp, box('meta', Buffer.concat([Buffer.from([0, 0, 0, 0]), iinf, box('iloc', iloc)])), box('mdat', nutz)]));
}

describe('Fund 2: HEIC-iloc ohne Fortschritt wird abgelehnt', () => {
  it('Größen 0 und je Element 65.535 Ausdehnungen → null in unter 50 ms (früher bis zu 10 Minuten bei 25 MB)', () => {
    const n = 20_000;
    const eintrag = Buffer.from([0, 1, 0, 0, 0, 0, 0xff, 0xff]); // id 1, Methode 0, dref 0, Basis (0 Bytes), 65.535 Ausdehnungen à 0 Bytes
    const iloc = Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.from([0x00, 0x00]), Buffer.from([n >> 8, n & 0xff]), ...Array.from({ length: n }, () => eintrag)]);
    const b = heic(iloc);
    let r: Uint8Array | null = new Uint8Array(1);
    expect(dauer(() => { r = heicOhneMetadaten(b); })).toBeLessThan(50);
    expect(r).toBeNull();
  });
  it('mehr Ausdehnungen als Bytes im iloc → null; unzulässige Größen → null; ein echtes Element wird weiter genullt', () => {
    const zuViele = Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.from([0x44, 0x00]), Buffer.from([0, 1]), Buffer.from([0, 1, 0, 0, 0, 0, 0x10, 0x00]), Buffer.alloc(8)]);
    expect(heicOhneMetadaten(heic(zuViele))).toBeNull();
    const krumm = Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.from([0x33, 0x00]), Buffer.from([0, 1]), Buffer.from([0, 1, 0, 0, 0, 0, 0, 1]), Buffer.alloc(6)]);
    expect(heicOhneMetadaten(heic(krumm))).toBeNull();
    // gültig: eine Ausdehnung (Versatz/Länge je 4 Bytes) auf die Nutzdaten im mdat
    const nutz = Buffer.from('Exif\0\0GPS-51.2N');
    const bau = (off: number) => Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.from([0x44, 0x00]), Buffer.from([0, 1]), Buffer.from([0, 1, 0, 0, 0, 0, 0, 1]), (() => { const x = Buffer.alloc(8); x.writeUInt32BE(off, 0); x.writeUInt32BE(nutz.length, 4); return x; })()]);
    const start = heic(bau(0)).length - nutz.length;
    const r = heicOhneMetadaten(heic(bau(start)))!;
    expect(Buffer.from(r).includes(Buffer.from('GPS'))).toBe(false);
  });
});

// ── 3 · HTML-Säuberung linear ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 3: HTML zu Text linear (über `web_lesen` von jeder fremden Seite erreichbar)', () => {
  const ZWEI_MB = 2 * 1024 * 1024;
  const fuell = (s: string) => s.repeat(Math.ceil(ZWEI_MB / s.length)).slice(0, ZWEI_MB);
  for (const [name, boese] of [
    ['offene <script>', fuell('<script>')], ['offene <?', fuell('<?')], ['offene <!x', fuell('<!x')], ['Tags ohne >', fuell('<a ')],
    ['offene Anführungszeichen', fuell('<a "')], ['Kommentar-Anfänge', fuell('<!--x')], ['<title> ohne Ende', fuell('<title>x')],
    ['viele </td> (Leerzeichen-Lauf)', fuell('</td>')], ['verschachtelte Links', fuell('<a href="https://x.example/">')], ['<<<<', fuell('<')],
  ] as const) {
    it(`2 MB ${name} → unter 200 ms`, () => {
      expect(dauer(() => htmlZuText(boese))).toBeLessThan(200);
    });
  }
  it('wohlgeformtes HTML wie bisher (Skripte samt Inhalt, Kommentare, Links mit Adresse, offenes Skript schneidet ab)', () => {
    expect(htmlZuText('<p>A</p><script>x()</script><p>B</p><style>.a{}</style>C').text).toBe('A\n\nB\nC');
    expect(htmlZuText('<p>Hallo</p><!-- <b>weg</b> --><?xml v?><a href="https://x.example/a?utm_source=q">Mehr</a>').text).toBe('Hallo\nMehr (https://x.example/a)');
    expect(htmlZuText('Text<SCRIPT type="x">alert(1)</script >weiter').text).toBe('Textweiter');
    expect(htmlZuText('<p>Vorher</p><script>alert(1)<p>nie</p>').text).toBe('Vorher');
    expect(htmlZuText('<scr<script>x</script>ipt>alert(2)</script>Ende').text).toBe('Ende');
    expect(htmlZuText('<b>offen').text).toBe('offen');
    expect(htmlZuText('a<x').text).toBe('a');
    expect(htmlZuText('<td>a</td>    <td>b</td>\n  <br>c').text).toBe('a b\nc');
  });
  it('web_lesen: HTML wird nur bis 500 KB gelesen (gekürzt vermerkt), Text und PDF nicht', async () => {
    const gross = Buffer.from(`<p>Anfang</p>${'<p>x</p>'.repeat(80_000)}<p>ENDE-NIE</p>`);
    expect(gross.length).toBeGreaterThan(WEB.htmlBytes);
    const r = await textAus({ status: 200, kopf: { 'content-type': 'text/html; charset=utf-8' }, bytes: gross });
    expect(r.gekuerzt).toBe(true);
    expect(r.text.startsWith('Anfang')).toBe(true);
    expect(r.text).not.toContain('ENDE-NIE');
    const t = await textAus({ status: 200, kopf: { 'content-type': 'text/plain' }, bytes: Buffer.from('nur Text') });
    expect(t).toEqual({ text: 'nur Text', gekuerzt: false });
  });
});

// ── 5/6 · Personenteil: Gate, Zähler, Namen ───────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 5: Personenteil — Agenten, Entwürfe, Namen, eigene Tiefenbericht-Frage', () => {
  it('A4 und A11–A13 brauchen den Personenteil', () => {
    expect([...PERSONEN_AGENTEN].sort()).toEqual(['a11', 'a12', 'a13', 'a4']);
  });
  it('Entwürfe von A11–A13 an Konten ohne Recht nur als Zähler (gleiche Form, leere Einträge) — mit Recht vollständig', () => {
    const l = { id: 'al-1', agent: 'a12', status: 'fertig', schaetzungCent: 1, bestaetigtCent: 1, grenzeCent: 1, gestartetAm: '2026-10-10T08:00:00Z', gestartetVon: 'pia', versuch: 1,
      ergebnis: { abschnitte: { fazit: [{ id: 'da-1', text: 'Frau Muster entscheidet allein', quellen: [] }] }, quellen: [{ id: 'dq-1', url: 'https://x.example/' }], diagnose: { top5: [{ text: 'Muster überzeugen' }], quickWins: [], fragen: [{ frage: 'Wie geht es Frau Muster?' }] }, befunde: [{ text: 'Muster' }], zaehler: { verworfen: 0, ohneQuelle: 0, gesperrt: 0, gekuerzt: 0, negativ: 0, namen: 0 }, ausgelassen: [] },
    } as unknown as AnalyseLauf;
    const ohne = laufFuerAntwort(l, Date.parse('2026-10-10T08:01:00Z'));
    expect(JSON.stringify(ohne)).not.toContain('Muster');
    const e = ohne.ergebnis as { nurZaehler: boolean; abschnitte: Record<string, unknown[]>; diagnose: { top5: unknown[]; fragen: unknown[] } };
    expect(e.nurZaehler).toBe(true);
    expect(e.abschnitte.fazit).toHaveLength(1);
    expect(e.diagnose.fragen).toHaveLength(1);
    expect(JSON.stringify(laufFuerAntwort(l, Date.parse('2026-10-10T08:01:00Z'), true))).toContain('Frau Muster');
    // Agenten ohne Personenbezug: unverändert
    expect(JSON.stringify(laufFuerAntwort({ ...l, agent: 'a2' } as AnalyseLauf, Date.now()))).toContain('Frau Muster');
  });
  it('namenErsetzen: voller Name, Anrede/Titel, Schreibweise ohne Umlaute, Nachname allein (auch Genitiv) — nicht mitten im Wort', () => {
    const karten = [{ name: 'Jörg Müller', funktion: 'Geschäftsführer' }];
    const t = 'Jörg Müller sagt ja. Herr Müller bleibt. Laut Frau Dr. Müller und Joerg Mueller. Müllers Team. Mueller war da. Die Müllerei bleibt.';
    const r = namenErsetzen(t, karten);
    expect(r.text).not.toMatch(/Müller(?!ei)|Mueller|Jörg|Joerg/);
    expect(r.text).toContain('Müllerei');
    expect(r.ersetzt).toBe(6);
    // der Vorname allein bleibt (nur voller Name und Nachname zählen)
    expect(namenErsetzen('Anna kommt', [{ name: 'Anna Bergmann', funktion: 'x' }]).ersetzt).toBe(0);
  });
  it('eigene Tiefenbericht-Frage: Negativliste und Namen der Personenkarten → abgelehnt; eine Unternehmensfrage geht', () => {
    const karten = [{ name: 'Jörg Müller', funktion: 'Geschäftsführer' }];
    expect(tiefenberichtFrageGrund('Ist Herr Müller verheiratet?', karten)).toMatch(/Negativliste/);
    expect(tiefenberichtFrageGrund('Was macht Jörg Müller beruflich?', karten)).toMatch(/Person beim Namen/);
    expect(tiefenberichtFrageGrund('Wie ist der Markt für Logistik-Software?', karten)).toBeNull();
  });
});

// ── 7 · Aktive Inhalte ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function zip(eintraege: Record<string, string | Buffer>): Uint8Array {
  const lokal: Buffer[] = [], zentral: Buffer[] = [];
  let versatz = 0;
  for (const [name, inhalt] of Object.entries(eintraege)) {
    const roh = typeof inhalt === 'string' ? Buffer.from(inhalt, 'utf8') : inhalt, gepackt = deflateRawSync(roh), n = Buffer.from(name, 'utf8'), crc = crc32(roh);
    const lk = Buffer.alloc(30); lk.writeUInt32LE(0x04034b50, 0); lk.writeUInt16LE(20, 4); lk.writeUInt16LE(8, 8); lk.writeUInt32LE(crc, 14); lk.writeUInt32LE(gepackt.length, 18); lk.writeUInt32LE(roh.length, 22); lk.writeUInt16LE(n.length, 26);
    const zk = Buffer.alloc(46); zk.writeUInt32LE(0x02014b50, 0); zk.writeUInt16LE(20, 4); zk.writeUInt16LE(20, 6); zk.writeUInt16LE(8, 10); zk.writeUInt32LE(crc, 16); zk.writeUInt32LE(gepackt.length, 20); zk.writeUInt32LE(roh.length, 24); zk.writeUInt16LE(n.length, 28); zk.writeUInt32LE(versatz, 42);
    lokal.push(lk, n, gepackt); zentral.push(zk, n);
    versatz += 30 + n.length + gepackt.length;
  }
  const z = Buffer.concat(zentral);
  const ende = Buffer.alloc(22); ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(zentral.length / 2, 8); ende.writeUInt16LE(zentral.length / 2, 10); ende.writeUInt32LE(z.length, 12); ende.writeUInt32LE(versatz, 16);
  return new Uint8Array(Buffer.concat([...lokal, z, ende]));
}
const CT = '<?xml version="1.0"?><Types/>';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const rels = (...r: string[]) => `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${r.join('')}</Relationships>`;
const rel = (typ: string, ziel: string, extern = false) => `<Relationship Id="r${Math.random().toString(36).slice(2, 6)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${typ}" Target="${ziel}"${extern ? ' TargetMode="External"' : ''}/>`;
const docx = (mehr: Record<string, string | Buffer> = {}) => zip({ '[Content_Types].xml': CT, 'word/document.xml': '<w:document/>', 'word/_rels/document.xml.rels': rels(rel('styles', 'styles.xml')), ...mehr });
const pdf = (s: string | Buffer[]) => new Uint8Array(Array.isArray(s) ? Buffer.concat(s) : Buffer.from(s, 'latin1'));

describe('Fund 7: aktive Inhalte in Office und PDF → 415 (Kunden-Upload und Aufgaben-Ablage)', () => {
  it('Office: sauber geht; Makro, ActiveX, eingebettetes OLE, Vorlage aus dem Netz, externes Bild → abgelehnt', () => {
    expect(aktiveInhalte(DOCX, docx())).toBeNull();
    expect(aktiveInhalte(DOCX, docx({ 'word/_rels/document.xml.rels': rels(rel('hyperlink', 'https://x.example/', true)) }))).toBeNull();
    expect(aktiveInhalte(DOCX, docx({ 'word/vbaData.xml': '<x/>' }))).toMatch(/Makro/);
    expect(aktiveInhalte(DOCX, docx({ 'word/activeX/activeX1.xml': '<x/>' }))).toMatch(/ActiveX/);
    expect(aktiveInhalte(DOCX, docx({ 'word/embeddings/oleObject1.bin': 'MZ' }))).toMatch(/eingebettet/);
    expect(aktiveInhalte(DOCX, docx({ 'word/_rels/settings.xml.rels': rels(rel('attachedTemplate', 'https://boese.example/t.dotm', true)) }))).toMatch(/attachedTemplate/);
    expect(aktiveInhalte(DOCX, docx({ 'word/_rels/document.xml.rels': rels(rel('image', 'https://tracker.example/p.png', true)) }))).toMatch(/externer Verweis/);
  });
  it('Office: die Tabelle hinter einem Diagramm (eingebettetes .xlsx) geht — es sei denn, sie trägt selbst ein Makro', () => {
    const tabelle = Buffer.from(zip({ '[Content_Types].xml': CT, 'xl/workbook.xml': '<workbook/>' }));
    const boese = Buffer.from(zip({ '[Content_Types].xml': CT, 'xl/workbook.xml': '<workbook/>', 'xl/vbaProject.bin': 'x' }));
    expect(aktiveInhalte('application/vnd.openxmlformats-officedocument.presentationml.presentation', zip({ '[Content_Types].xml': CT, 'ppt/presentation.xml': '<p/>', 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx': tabelle }))).toBeNull();
    expect(aktiveInhalte(DOCX, docx({ 'word/embeddings/Tabelle.xlsx': boese }))).toMatch(/eingebettet: Makro/);
  });
  it('relsPruefen ist linear (viele offene Tags)', () => {
    expect(dauer(() => relsPruefen('<Relationship '.repeat(200_000)))).toBeLessThan(100);
  });
  it('PDF: sauber geht; JavaScript (auch getarnt und komprimiert), Launch, eingebettete Datei, OpenAction mit Aktion → abgelehnt', () => {
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /Type /Catalog /OpenAction [3 0 R /Fit] >> endobj\n%%EOF'))).toBeNull();
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction << /S /GoTo /D [3 0 R /Fit] >> >> endobj\n%%EOF'))).toBeNull();
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj'))).toMatch(/Skript/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /AA << /O << /S /J#61vaScript /J#53 (x) >> >> >> endobj'))).toMatch(/Skript/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction << /S /Launch /F (calc.exe) >> >> endobj'))).toMatch(/Programmstart/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction << /S /URI /URI (https://boese.example/) >> >> endobj'))).toMatch(/Aktion beim Öffnen/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction 9 0 R >> endobj\n9 0 obj << /S /SubmitForm /F (https://x.example/) >> endobj'))).toMatch(/Aktion beim Öffnen/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n1 0 obj << /OpenAction 9 0 R >> endobj\n9 0 obj [3 0 R /Fit] endobj'))).toBeNull();
    const js = deflateSync(Buffer.from('6 0 << /S /JavaScript /JS (app.alert(1)) >>'));
    expect(aktiveInhalte('application/pdf', pdf([Buffer.from(`%PDF-1.5\n5 0 obj << /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${js.length} >>\nstream\n`, 'latin1'), js, Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')]))).toMatch(/Skript/);
  });
  it('PDF: E-Rechnung (XML-Anhang) geht, andere Anhänge nicht; „/JS“ zufällig in Binärdaten eines Stroms zählt nicht', () => {
    const anhang = (sub: string) => pdf(`%PDF-1.7\n1 0 obj << /Names << /EmbeddedFiles 2 0 R >> >> endobj\n3 0 obj << /Type /EmbeddedFile /Subtype /${sub} /Length 6 >>\nstream\n<xml/>\nendstream\nendobj`);
    expect(aktiveInhalte('application/pdf', anhang('text#2Fxml'))).toBeNull();
    expect(aktiveInhalte('application/pdf', anhang('application#2Fx-msdownload'))).toMatch(/eingebettete Datei/);
    expect(aktiveInhalte('application/pdf', pdf('%PDF-1.4\n4 0 obj << /Length 20 >>\nstream\nab/JS (x)/Launch cd\nendstream\nendobj\n%%EOF'))).toBeNull();
    expect(ohneStroeme('a stream\nGEHEIM\nendstream b')).toBe('a   b');
  });
  it('dieselbe Regel gilt im Kunden-Upload (dateiPruefen → 415) und in der Aufgaben-Ablage (415, vor jedem Lesen)', async () => {
    const { dateiPruefen } = await import('@/lib/fulfillment/kunde/server');
    const makro = docx({ 'word/embeddings/oleObject1.bin': 'MZ' });
    expect(aufgabenTypErkennen('a.docx', makro)).toBe(DOCX); // der Typ allein ist noch „Office ohne Makro-Projekt“
    expect(dateiPruefen('a.docx', Buffer.from(makro))).toMatchObject({ ok: false, status: 415 });
    expect(dateiPruefen('a.pdf', Buffer.from(pdf('%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (x) >> >> endobj')))).toMatchObject({ ok: false, status: 415 });
    expect(dateiPruefen('a.docx', Buffer.from(docx()))).toMatchObject({ ok: true });
    const { aufgabenDateiAblegen } = await import('@/lib/dateien/aufgaben-ablage');
    await expect(aufgabenDateiAblegen('haus-x', 'pia', {}, { bytes: Buffer.from(makro), name: 'a.docx', typ: DOCX })).rejects.toMatchObject({ status: 415 });
  });
});

// ── 8 · höchstens EIN gültiger Kunden-Link ───────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 8: höchstens EIN nicht widerrufener Link je Mandat', () => {
  const HASH = 'a'.repeat(64), HASH2 = 'b'.repeat(64);
  const k = (heute: string): LinkKontext => ({ heute, jetzt: `${heute}T10:00:00.000Z`, person: 'pia', mandatEnde: null });
  it('ein neuer Link widerruft auch den abgelaufenen; „verlängern“ eines alten widerruft die anderen', () => {
    let d: KundeDatei = leerKunde();
    const a = linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: `kl-${'1'.repeat(24)}`, tokenHash: HASH, hinweisFassung: '1' }, k('2026-01-01'));
    d = (a as { datei: KundeDatei }).datei;
    // 100 Tage später ist er abgelaufen (Status „aktiv“ gespeichert, wirksam abgelaufen) — der neue widerruft ihn.
    const b = linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: `kl-${'2'.repeat(24)}`, tokenHash: HASH2, hinweisFassung: '1' }, k('2026-04-11'));
    d = (b as { datei: KundeDatei }).datei;
    expect(d.links.find(l => l.id.endsWith('1'.repeat(24)))!.status).toBe('widerrufen');
    // Den widerrufenen verlängern geht nicht.
    expect(linkAnwenden(d, { op: 'verlaengern', id: `kl-${'1'.repeat(24)}` }, k('2026-04-11'))).toMatchObject({ ok: false, status: 409 });
    // Altbestand: zwei nicht widerrufene (einer abgelaufen) — „verlängern“ des alten widerruft den jüngeren.
    const alt: KundenLink = { ...d.links[0], status: 'abgelaufen' };
    const zwei: KundeDatei = { ...d, links: [alt, d.links[1]] };
    const v = linkAnwenden(zwei, { op: 'verlaengern', id: alt.id }, k('2026-04-12'));
    expect(v.ok).toBe(true);
    const nach = (v as { datei: KundeDatei }).datei.links;
    expect(nach.filter(l => l.status !== 'widerrufen').map(l => l.id)).toEqual([alt.id]);
    expect(aktiverLink({ links: nach }, 'm-1', '2026-04-12')?.id).toBe(alt.id);
  });
});

// ── 9 · Token schwärzen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 9: Tokens aus Kunden-Links schwärzen', () => {
  it('#t= und #p=, URL-kodiert und Quoted-Printable — der Pfad bleibt erkennbar', () => {
    const tok = 'A'.repeat(43);
    const id = `kl-${'0a'.repeat(12)}`;
    const t = `Playbook: https://app.example/kunde/${id}#t=${tok} und Puls /kunde/${id}#p=${tok}. Kodiert /kunde/${id}%23t%3D${tok}, QP /kunde/${id}#t=3D${tok}`;
    const s = tokenSchwaerzen(t);
    expect(s).not.toContain(tok);
    expect(s).toContain(`/kunde/${id}#t=[geschwärzt]`);
    expect(s).toContain(`/kunde/${id}#p=[geschwärzt]`);
    expect(tokenSchwaerzen('ohne Link')).toBe('ohne Link');
    expect(dauer(() => tokenSchwaerzen(`/kunde/kl-${'a'.repeat(24)}#t=`.repeat(50_000)))).toBeLessThan(200);
  });
});

// ── 11 · nur geteilte Entscheidungen beim Kunden ─────────────────────────────────────────────────────────────────────────────────────

const fallMit = (extra: Partial<Fall> = {}): Fall => ({
  mandatId: 'm-1', vorlageId: 'fp-x', vorlageFassung: 1, gestartetAm: '2026-09-01T00:00:00Z', gestartetVon: 'pia', status: 'laeuft',
  knoten: [{ id: 'w', titel: 'Wurzel', rang: 1, status: 'offen' }, { id: 'p', elternId: 'w', titel: 'Phase', rang: 1, status: 'offen', kundeSichtbar: true }],
  freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {},
  geaendert: '', geaendertVon: '', ...extra,
});

describe('Fund 11: „Wartet auf euch“ nimmt nur geteilte Entscheidungen (Kunden-Sicht und Report)', () => {
  const f = fallMit({ entscheidungen: [
    { id: 'fe-1', am: '2026-10-01', titel: 'UNGETEILT-GEHEIM', status: 'offen', wer: 'kunde', geteilt: false, von: 'pia' },
    { id: 'fe-2', am: '2026-10-02', titel: 'Budget freigeben', status: 'offen', wer: 'kunde', geteilt: true, von: 'pia' },
  ] });
  it('Kunden-Sicht', () => {
    const s = kundenSicht({
      modus: 'voll', heute: '2026-10-10', mandat: { id: 'm-1', titel: 'M', kunde: 'Erfundene GmbH', ziele: [] }, fall: f, bausteine: [], marken: {}, rituale: [], kunde: leerKunde(),
      rechte: { formular: true, upload: false, puls: false }, standVon: () => 's', datenschutz: kundeHinweis({ verantwortlich: 'Erfundene Firma', seite: null, mandatsdatenMonate: 12, unterlagenTage: 90 }), uploadFrei: 0,
    });
    expect(JSON.stringify(s)).not.toContain('UNGETEILT-GEHEIM');
    expect(s.wartet.map(w => w.titel)).toEqual(['Budget freigeben']);
  });
  it('Report', () => {
    const r = reportZusatz(f, { id: 'm-1', ziele: [] }, leerKunde(), '2026-10-10', false)!;
    expect(r.wartetAufEuch.join(' ')).not.toContain('UNGETEILT-GEHEIM');
    expect(r.wartetAufEuch.join(' ')).toContain('Budget freigeben');
  });
});

// ── Funktions-Prüfung: Fortschritt und Playbook-Formular ─────────────────────────────────────────────────────────────────────────────

const ableitung = (alles: boolean): OnboardingAbleitung => ({
  ziele: [{ id: 'z1', text: 'Mehr Termine', ziel: '10' }], formularProzent: alles ? 100 : 0, kickoffRitualIds: ['fr-k'], unterschrift: '2026-10-01', willkommenStunden: 24, jetzt: '2026-10-05T10:00:00.000Z',
});
let zaehler = 0;
const neueId = (p: string) => `${p}-${++zaehler}`;
function gestartet(vorlage: typeof MUSTER_P1, fertig: boolean): Fall {
  const f = fallStarten({ mandatId: 'm-1', vorlage, person: 'pia', jetzt: '2026-10-01T08:00:00.000Z', start: '2026-10-01', playbookId: 'fb-pb', neueId });
  if (!fertig) return f;
  return {
    ...f, onboarding: { willkommenGesendetAm: '2026-10-01T12:00:00.000Z' }, rituale: [{ ritualId: 'fr-k', terminUids: ['u-1'], angelegtAm: '2026-10-02' }] as Fall['rituale'],
    vereinbarung: { bestaetigtAm: '2026-10-03' }, stakeholder: [{ id: 'fs-1', kontaktId: 'c-1', rolle: 'entscheider', einfluss: 3 }],
    wertKonto: { z1: { ausgangZahl: 2, zielZahl: 10, zielBis: '2026-12-31', festgelegtAm: '2026-10-03', messungen: [] } },
    entscheidungen: [{ id: 'fe-1', am: '2026-10-03', titel: 'Start', status: 'entschieden', wer: 'beide', geteilt: true, von: 'pia' }], freigaben: { F0: { am: '2026-10-03', von: 'pia' } },
  };
}

describe('Funktion 1: Fortschritt über alle Blätter, Playbook-Formular folgt seinem Schritt', () => {
  for (const [name, v] of [['P1', MUSTER_P1], ['P2', MUSTER_P2]] as const) {
    it(`${name}: vor dem Onboarding 0 %, danach weder 0 noch 89 % — und die Phase „Onboarding“ ist fertig`, () => {
      const vorher = fallWirksam(gestartet(v, false), ableitung(false));
      expect(fallFortschritt(vorher)).toBe(0);
      const w = fallWirksam(gestartet(v, true), ableitung(true));
      expect(w.knoten.find(k => k.id === OB_PLAYBOOK_FORMULAR_ID)?.status).toBe('erledigt');
      const p = fallFortschritt(w);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(60);
      expect(p).not.toBe(89);
      const ph = aktuellerKnoten(w).phase;
      expect(ph?.titel).not.toMatch(/Onboarding/);
      expect(w.status).toBe('laeuft');
    });
  }
  it('Playbook-Schritt entfällt → das Formular entfällt mit', () => {
    const f = gestartet(MUSTER_P2, false);
    const knoten = f.knoten.map(k => (k.id === 'fk-ob-playbook' ? { ...k, status: 'entfaellt' as const, grund: 'Kein Playbook' } : k));
    expect(fallWirksam({ ...f, knoten }, ableitung(false)).knoten.find(k => k.id === OB_PLAYBOOK_FORMULAR_ID)?.status).toBe('entfaellt');
  });
});

// ── Funktions-Prüfung: Bestandsmandate ohne Flut ─────────────────────────────────────────────────────────────────────────────────────

describe('Funktion 2: Bestandsmandate erscheinen ruhig (Regel)', () => {
  it('istBestand: nach dem Stichtag oder höchstens 14 Tage alt = neu, sonst Bestand; ohne Datum Bestand', () => {
    expect(istBestand('2026-09-01', undefined, '2026-10-11')).toBe(true);
    expect(istBestand('2026-10-01', undefined, '2026-10-11')).toBe(false);
    expect(istBestand('2026-09-01', '2026-08-15', '2026-10-11')).toBe(false);
    expect(istBestand('2026-09-01', '2026-10-11', '2026-10-11')).toBe(true);
    expect(istBestand(null, '2026-10-11', '2026-10-11')).toBe(true);
  });
  it('Kandidaten tragen `bestand`', () => {
    const m = (id: string, start: string) => ({ id, kunde: 'K', titel: 'T', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start, kontaktIds: [] });
    const k = onboardingKandidaten({ mandate: [m('m-alt', '2026-06-01'), m('m-neu', '2026-10-09')] as never, angebote: [], chancen: [] }, {}, { [MARKE_FULFILLMENT_SEIT]: '2026-10-11' }, '2026-10-12');
    expect(k.find(x => x.mandatId === 'm-alt')?.bestand).toBe(true);
    expect(k.find(x => x.mandatId === 'm-neu')?.bestand).toBeUndefined();
  });
});

// ── Funktions-Prüfung: Import idempotent, Rückgängig ─────────────────────────────────────────────────────────────────────────────────

describe('Funktion 5/12: Ablauf-Import idempotent, Rückgängig mit höherer Fassung, genutzte Bausteine bleiben', () => {
  const kx = { person: 'pia', jetzt: '2026-10-10T08:00:00.000Z', heute: '2026-10-10', datei: 'probe.json', laufId: 'fi-1' };
  it('dieselbe Ablauf-Datei nach dem Speichern (Säuberer, andere Feld-Reihenfolge) ist „gleich“', () => {
    const roh = { verkauf: { titel: 'Probe-Ablauf', stufen: [{ id: 'a', name: 'Erstkontakt', zweck: 'Kennenlernen', rolle: 'Vertrieb' }, { id: 'b', name: 'Angebot', art: 'ausstieg' }], uebergaenge: [{ von: 'a', nach: 'b' }] } };
    const r = importAnwenden(leerVorlagen(), roh, {}, kx, () => neueId('fk'));
    expect(r.ok).toBe(true);
    const gespeichert = vorlagenAus(JSON.parse(JSON.stringify((r as { datei: unknown }).datei)));
    expect(importVorschau(roh, gespeichert, 'probe.json').ablaeufe.map(a => a.status)).toEqual(['gleich']);
  });
  it('Rückgängig: zurückgeholte Fassung steigt, ein von einem Fall genutzter neuer Baustein bleibt', () => {
    const roh = { vorlagen: [{ id: 'q-1', art: 'aufgabe', titel: 'Probe-Baustein', zweck: 'Zweck' }] };
    const v0 = importVorschau(roh, leerVorlagen(), 'b.json');
    const bid = v0.bausteine[0].id;
    const r = importAnwenden(leerVorlagen(), roh, {}, kx, () => neueId('fk')) as { ok: true; datei: ReturnType<typeof leerVorlagen> };
    const genutzt = importRueckgaengig(r.datei, 'fi-1', '2026-10-11T08:00:00.000Z', new Set([bid])) as { ok: true; datei: ReturnType<typeof leerVorlagen>; bericht: { geblieben: number } };
    expect(genutzt.datei.bausteine.some(b => b.id === bid)).toBe(true);
    expect(genutzt.bericht.geblieben).toBe(1);
    // geändert: leeres Feld ergänzt → Rückgängig holt die alte Fassung mit HÖHERER Nummer
    const mitAlt = { ...leerVorlagen(), bausteine: [{ ...r.datei.bausteine[0], zweck: undefined, herkunft: undefined, fassung: 4 }] } as never as ReturnType<typeof leerVorlagen>;
    const r2 = importAnwenden(mitAlt, roh, {}, { ...kx, laufId: 'fi-2' }, () => neueId('fk')) as { ok: true; datei: ReturnType<typeof leerVorlagen> };
    expect(r2.datei.bausteine[0].fassung).toBe(5);
    const zurueck = importRueckgaengig(r2.datei, 'fi-2', '2026-10-11T08:00:00.000Z') as { ok: true; datei: ReturnType<typeof leerVorlagen> };
    expect(zurueck.datei.bausteine[0].zweck).toBeUndefined();
    expect(zurueck.datei.bausteine[0].fassung).toBe(6);
  });
});

// ── Funktions-Prüfung: Messe-Nachfasstakt ────────────────────────────────────────────────────────────────────────────────────────────

describe('Funktion 10: Nachfassen Tag 1/3/7/14/30 ab dem Messetag', () => {
  it('„Während der Messe“ erledigt → die Nachfass-Schritte bekommen ihre Fälligkeit; gesetzte bleiben', async () => {
    const { vorlagenAnwenden } = await import('@/lib/fulfillment/prozesse/vorlagen-anwenden');
    const v = vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster', welche: ['p3'] }], { person: 'pia', jetzt: '2026-10-01T08:00:00.000Z', heute: '2026-10-01', standVon: () => 's', neueId: (p: string) => neueId(p) } as never);
    expect(v.ok).toBe(true);
    const p3 = (v as { datei: ReturnType<typeof leerVorlagen> }).datei.prozesse.find(p => p.titel === MUSTER_P3.titel)!;
    let f = fallStarten({ mandatId: 'm-1', vorlage: p3, person: 'pia', jetzt: '2026-10-01T08:00:00.000Z', start: '2026-10-01', neueId });
    const waehrend = f.knoten.find(k => k.titel === 'Während der Messe')!;
    const nach = f.knoten.find(k => k.titel === 'Nach der Messe')!;
    const schritte = () => f.knoten.filter(k => k.elternId === nach.id);
    expect(schritte().map(k => k.dauerTage)).toEqual([...MESSE_NACHFASS_TAGE]);
    // einer ist schon von Hand terminiert
    f = { ...f, knoten: f.knoten.map(k => (k.id === schritte()[4].id ? { ...k, faelligAm: '2026-12-24' } : k)) };
    const ctx: FallKontext = { person: 'pia', jetzt: '2026-10-20T08:00:00.000Z', heute: '2026-10-20', standVon: () => 's', neueId: p => neueId(p), ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: [] };
    const r = fallAnwenden(f, [{ op: 'knoten-status', id: waehrend.id, status: 'erledigt' }], ctx);
    expect(r.ok).toBe(true);
    f = (r as { datei: Fall }).datei;
    expect(schritte().map(k => k.faelligAm)).toEqual(['2026-10-21', '2026-10-23', '2026-10-27', '2026-11-03', '2026-12-24']);
  });
});

// ── Funktions-Prüfung: Messlücken ohne Messung ───────────────────────────────────────────────────────────────────────────────────────

describe('Funktion 11: Säulen „nur mit Messung“ ohne Messung sind keine Messlücken (Index bit-gleich)', () => {
  it('Lücken nur aus gemessenen Säulen; der Index ändert sich nicht', () => {
    const k = (id: string, saeule: string) => ({ id, label: id, saeule, gruppe: 'g', einheit: 'prozent' as const, richtung: 'hoch' as const, gruen: 80, rot: 20, formel: '', quelle: '', luecke: 'fehlt' });
    const basis = { saeulen: [{ id: 'a', label: 'A', gewicht: 0.9, satz: '' }], kennzahlen: [k('a1', 'a'), k('a2', 'a'), k('a3', 'a')], messen: { a1: () => ({ wert: 60, anzeige: '60', quelle: 'q' }), a2: () => ({ wert: 50, anzeige: '50', quelle: 'q' }) }, bestand: {}, stand: '2026-10-11', scope: 'gesamt' };
    const ohne = berechneModell(basis);
    const mit = berechneModell({ ...basis, saeulen: [...basis.saeulen, { id: 'ff', label: 'F', gewicht: 0.1, satz: '', nurMitMessung: true }], kennzahlen: [...basis.kennzahlen, k('f1', 'ff'), k('f2', 'ff'), k('f3', 'ff'), k('f4', 'ff')] });
    expect(mit.index).toBe(ohne.index);
    expect(mit.luecken).toBe(ohne.luecken);
    expect(mit.luecken).toBe(1);
  });
});

// ── Funktions-Prüfung: Glocke je Kunden-Link ─────────────────────────────────────────────────────────────────────────────────────────

describe('Funktion 14: Uploads über denselben Link → EINE ungelesene Glocke', () => {
  it('Bezug „kunden-link“ wird angenommen, die neuere ersetzt die ältere', () => {
    const e = { an: 'pia', art: 'produkte' as const, titel: 'Neue Unterlagen eingegangen', link: '/os/fulfillment', bezug: { art: 'kunden-link' as const, id: `kl-${'1'.repeat(24)}` } };
    expect(pruefeEingabe(e)).toEqual({ ok: true });
    let b = leererBestand();
    b = einfuegen(b, eintragAus(e, 'a', '2026-10-11T08:00:00.000Z'));
    b = einfuegen(b, eintragAus(e, 'b', '2026-10-11T08:05:00.000Z'));
    b = einfuegen(b, eintragAus({ ...e, bezug: { art: 'kunden-link', id: `kl-${'2'.repeat(24)}` } }, 'c', '2026-10-11T08:06:00.000Z'));
    expect(b.eintraege.map(x => x.id).sort()).toEqual(['b', 'c']);
  });
});
