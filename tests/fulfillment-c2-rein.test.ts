// ─── Fulfillment C2 — reine Regeln (10.10.; FULFILLMENT_KONZEPT.md 5.2, 5.4, 5.5, 8.1, 11 „C2 Wächter“) ────────────────────────────────────────────
// Kunden-Link (Schalter, Ablauf, ein neuer widerruft den alten), Formular-Antworten (Stand 409, Grenzen 413, Auswahl), Puls (eine Antwort je Anfrage,
// neue Anfrage schließt die offene), Upload (Typ am INHALT, falsche Endung/SVG/ZIP/CSV abgelehnt, Office mit Makro abgelehnt, Exif/XMP weg in JPEG, WEBP,
// HEIC), Fristen (Mandatsdaten, Unterlagen außer Beleg, verwaist — nie bei leerem CRM), Baustein-Marken („nur intern“, „vor Verkauf prüfen“), Report:
// ohne Fall Byte für Byte wie vorher (Schnappschuss aus dem Stand vor C2), mit Fall die neuen Abschnitte. Erfundene Daten, kein Netz, keine Platte.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { crc32, deflateRawSync } from 'node:zlib';
import { schalterStand, linkAnwenden, linkAblauf, linkStatus, aktiverLink, abgelaufeneMarkieren, RECHTE_VORGABE, type LinkKontext } from '@/lib/fulfillment/kunde/link';
import { antwortenAnwenden, formulareDesFalls, formularProzent, abschnitteVon, antwortenCsv, formularSchluessel } from '@/lib/fulfillment/kunde/formular';
import { anfrageAnlegen, pulsAnnehmen, pulsHand, offeneAnfrage, pulsPruefen, letzterPuls } from '@/lib/fulfillment/kunde/puls';
import { kundeFristenAnwenden, verwaisteDateien, monatPlus, alleTexte } from '@/lib/fulfillment/kunde/fristen';
import { kundeTypErkennen, ohneMetadaten, webpOhneMetadaten, heicOhneMetadaten, uploadFrei, UPLOAD_GRENZEN } from '@/lib/fulfillment/kunde/upload';
import { kundeTauglich } from '@/lib/fulfillment/kunde/sicht';
import { reportZusatz } from '@/lib/fulfillment/kunde/report-zusatz';
import { leerKunde } from '@/lib/fulfillment/lesen';
import { reportPdf } from '@/lib/crm/treppe-pdf';
import { mailVorlage, mitZusatz, hatZusatz, PULS_PLATZHALTER, type ReportDokument } from '@/lib/crm/treppe-report';
import type { Baustein, Fall, FormularStand, KundeDatei } from '@/lib/fulfillment/typen';

const H = (n: number) => n.toString(16).padStart(64, '0');
const K = (heute = '2026-10-10', mandatEnde: string | null = null): LinkKontext => ({ heute, jetzt: `${heute}T10:00:00.000Z`, person: 'pia', mandatEnde });
const LINK_A = 'kl-0123456789abcdef01234567', LINK_B = 'kl-89abcdef0123456789abcdef';

describe('Kunden-Link: Schalter, Ablauf, Änderungen', () => {
  it('zwei Schlüssel: Umgebung UND Instanz — sonst aus, mit Grund (Betrieb zuerst)', () => {
    expect(schalterStand({ kundenLink: { an: true } }, true)).toEqual({ umgebung: true, instanz: true, an: true });
    expect(schalterStand({ kundenLink: { an: true } }, false)).toMatchObject({ an: false, grund: 'betrieb' });
    expect(schalterStand({ kundenLink: { an: false } }, true)).toMatchObject({ an: false, grund: 'instanz' });
  });
  it('Ablauf 90 Tage, nie über Mandatsende + 30 Tage; danach „abgelaufen“', () => {
    expect(linkAblauf('2026-10-10', null)).toBe('2027-01-08');
    expect(linkAblauf('2026-10-10', '2026-10-20')).toBe('2026-11-19');
    expect(linkStatus({ status: 'aktiv', ablaufAm: '2026-10-09' }, '2026-10-10')).toBe('abgelaufen');
    expect(linkStatus({ status: 'aktiv', ablaufAm: '2027-01-01' }, '2026-12-01', '2026-10-01')).toBe('abgelaufen');
    expect(linkStatus({ status: 'aktiv', ablaufAm: '2027-01-01' }, '2026-10-10', null)).toBe('aktiv');
  });
  it('ein neuer Link widerruft den alten desselben Mandats; Rechte, Verlängern, Widerrufen; unbekannt 404', () => {
    let d = leerKunde();
    const a = linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: LINK_A, tokenHash: H(1), hinweisFassung: 'k1' }, K());
    expect(a.ok).toBe(true); d = (a as { datei: KundeDatei }).datei;
    expect(d.links[0]).toMatchObject({ id: LINK_A, status: 'aktiv', rechte: RECHTE_VORGABE, ablaufAm: '2027-01-08', erstelltVon: 'pia' });
    const b = linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: LINK_B, tokenHash: H(2), rechte: { upload: false }, hinweisFassung: 'k1' }, K());
    d = (b as { datei: KundeDatei }).datei;
    expect(d.links.map(l => [l.id, l.status])).toEqual([[LINK_A, 'widerrufen'], [LINK_B, 'aktiv']]);
    expect(d.links[1].rechte).toEqual({ formular: true, upload: false, puls: true });
    expect(aktiverLink(d, 'm-1', '2026-10-10')?.id).toBe(LINK_B);
    expect(linkAnwenden(d, { op: 'rechte', id: LINK_B, rechte: { puls: 'ja' as never } }, K())).toMatchObject({ ok: false, status: 400 });
    expect(linkAnwenden(d, { op: 'rechte', id: LINK_A, rechte: { puls: false } }, K())).toMatchObject({ ok: false, status: 409 });
    expect(linkAnwenden(d, { op: 'verlaengern', id: LINK_A }, K())).toMatchObject({ ok: false, status: 409 });
    expect(linkAnwenden(d, { op: 'widerrufen', id: 'kl-ffffffffffffffffffffffff' }, K())).toMatchObject({ ok: false, status: 404 });
    const v = linkAnwenden(d, { op: 'verlaengern', id: LINK_B, tage: 30 }, K('2026-12-01'));
    expect((v as { datei: KundeDatei }).datei.links[1].ablaufAm).toBe('2026-12-31');
    expect(linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: 'kl-1', tokenHash: H(3), hinweisFassung: '' }, K())).toMatchObject({ ok: false, status: 400 });
    expect(linkAnwenden(d, { op: 'anlegen', mandatId: 'm-1', id: 'kl-abcdefabcdefabcdefabcdef', tokenHash: H(3), hinweisFassung: '' }, K('2027-01-01', '2026-11-01'))).toMatchObject({ ok: false, status: 409 });
  });
  it('Morgenlauf markiert abgelaufene Links (nur „aktiv“, nach Ablauf)', () => {
    const d: KundeDatei = { ...leerKunde(), links: [{ id: LINK_A, mandatId: 'm-1', tokenHash: H(1), erstelltAm: '2026-01-01T00:00:00Z', erstelltVon: 'p', ablaufAm: '2026-04-01', status: 'aktiv', rechte: RECHTE_VORGABE, hinweisFassung: '' }] };
    const r = abgelaufeneMarkieren(d, '2026-10-10', () => null);
    expect(r.n).toBe(1);
    expect(r.datei.links[0].status).toBe('abgelaufen');
    expect(abgelaufeneMarkieren(r.datei, '2026-10-10', () => null).n).toBe(0);
  });
});

const PLAYBOOK: Baustein = {
  id: 'fb-playbook', art: 'formular', titel: 'Playbook', gliederung: [], platzhalter: [], tags: [], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true, fassung: 3, geaendert: '', geaendertVon: '',
  fragen: [
    { id: 'q1', abschnitt: 'Ziele', frage: 'Was soll sich ändern?', art: 'langtext' },
    { id: 'q2', abschnitt: 'Ziele', frage: 'Wie viele Verkäufer?', art: 'zahl' },
    { id: 'q3', abschnitt: 'Tools', frage: 'Gibt es ein CRM?', art: 'ja-nein' },
    { id: 'q4', abschnitt: 'Tools', frage: 'Welches?', art: 'auswahl', optionen: ['A', 'B'] },
  ],
};
const stand = (f: FormularStand) => JSON.stringify(f).length.toString(36) + f.geaendertAm;

describe('Formulare', () => {
  it('Formulare des Falls: nur Bausteine Formular/Workbook mit Fragen an nicht entfallenen Knoten, je Baustein einmal', () => {
    const fall = { knoten: [
      { id: 'k1', titel: 'A', rang: 1, status: 'offen', bausteinId: 'fb-playbook' }, { id: 'k2', titel: 'B', rang: 2, status: 'offen', bausteinId: 'fb-playbook' },
      { id: 'k3', titel: 'C', rang: 3, status: 'entfaellt', bausteinId: 'fb-wb' }, { id: 'k4', titel: 'D', rang: 4, status: 'offen', bausteinId: 'fb-skript' },
    ] } as unknown as Fall;
    const wb = { ...PLAYBOOK, id: 'fb-wb', art: 'workbook' as const };
    const skript = { ...PLAYBOOK, id: 'fb-skript', art: 'skript' as const };
    expect(formulareDesFalls(fall, [PLAYBOOK, wb, skript]).map(b => b.id)).toEqual(['fb-playbook']);
    expect(formulareDesFalls(null, [PLAYBOOK])).toEqual([]);
    expect(abschnitteVon(PLAYBOOK).map(a => [a.titel, a.fragen.length])).toEqual([['Ziele', 2], ['Tools', 2]]);
    expect(formularSchluessel('m-1', 'fb-playbook')).toMatch(/^fo-[0-9a-f]{16}$/);
    expect(formularSchluessel('m-1', 'fb-playbook')).not.toContain('fb-');
  });
  it('Antworten: Prüfung je Art, 4.000 Zeichen → 413, unbekannte Frage 400, Stand 409, fertig je Abschnitt, Prozent', () => {
    const e = { mandatId: 'm-1', baustein: PLAYBOOK, quelle: 'kunde' as const, jetzt: '2026-10-10T10:00:00.000Z' };
    let d = leerKunde();
    const r1 = antwortenAnwenden(d, { ...e, antworten: { q1: '  Mehr Termine  ', q2: '4', q3: 'ja', q4: 'B' }, stand: 'neu', abschnitt: abschnitteVon(PLAYBOOK)[0].schluessel, fertig: true }, stand);
    expect(r1.ok).toBe(true); d = (r1 as { datei: KundeDatei }).datei;
    expect(d.formulare[0]).toMatchObject({ mandatId: 'm-1', bausteinId: 'fb-playbook', fassung: 3, quelle: 'kunde', antworten: { q1: '  Mehr Termine  ', q2: '4', q3: 'ja', q4: 'B' } });
    expect(d.formulare[0].fertig).toEqual([abschnitteVon(PLAYBOOK)[0].schluessel]);
    expect(formularProzent(PLAYBOOK, d.formulare[0])).toBe(100);
    expect(antwortenAnwenden(d, { ...e, antworten: { q1: 'x' }, stand: 'veraltet' }, stand)).toMatchObject({ ok: false, status: 409 });
    expect(antwortenAnwenden(d, { ...e, antworten: { q9: 'x' } }, stand)).toMatchObject({ ok: false, status: 400 });
    expect(antwortenAnwenden(d, { ...e, antworten: { q1: 'x'.repeat(4001) } }, stand)).toMatchObject({ ok: false, status: 413 });
    expect(antwortenAnwenden(d, { ...e, antworten: { q4: 'C' } }, stand)).toMatchObject({ ok: false, status: 400 });
    expect(antwortenAnwenden(d, { ...e, antworten: { q3: 'vielleicht' } }, stand)).toMatchObject({ ok: false, status: 400 });
    expect(antwortenAnwenden(d, { ...e, antworten: { q2: 'zwölf' } }, stand)).toMatchObject({ ok: false, status: 400 });
    const leer = antwortenAnwenden(d, { ...e, antworten: { q4: '' }, stand: stand(d.formulare[0]) }, stand);
    expect((leer as { datei: KundeDatei }).datei.formulare[0].antworten.q4).toBeUndefined();
    expect(formularProzent(PLAYBOOK, (leer as { datei: KundeDatei }).datei.formulare[0])).toBe(75);
    expect(antwortenAnwenden(d, { ...e, antworten: {}, abschnitt: 'ab-gibtsnicht', fertig: true }, stand)).toMatchObject({ ok: false, status: 400 });
  });
  it('CSV: Semikolon, BOM, Formel-Anfänge neutralisiert', () => {
    const csv = antwortenCsv([{ titel: 'Playbook', fragen: PLAYBOOK.fragen!, antworten: { q1: '=SUMME(A1)', q2: 'a;b' } }]);
    expect(csv.startsWith('﻿Formular;Abschnitt;Frage;Antwort')).toBe(true);
    expect(csv).toContain(";'=SUMME(A1)");
    expect(csv).toContain(';"a;b"');
  });
});

describe('Puls', () => {
  const k = { jetzt: '2026-10-10T10:00:00.000Z', heute: '2026-10-10' };
  it('neue Anfrage schließt die offene; eine Antwort je Anfrage; abgelaufen 404', () => {
    let d = leerKunde();
    d = (anfrageAnlegen(d, { id: 'pa-1', mandatId: 'm-1', tokenHash: H(1), ...k }) as { datei: KundeDatei }).datei;
    expect(offeneAnfrage(d, 'm-1', '2026-10-10')?.id).toBe('pa-1');
    expect(d.pulsAnfragen[0].offenBis).toBe('2026-10-24');
    d = (anfrageAnlegen(d, { id: 'pa-2', mandatId: 'm-1', tokenHash: H(2), ...k, jetzt: '2026-10-10T11:00:00.000Z' }) as { datei: KundeDatei }).datei;
    expect(d.pulsAnfragen.find(a => a.id === 'pa-1')!.offenBis).toBe('2026-10-09');
    expect(offeneAnfrage(d, 'm-1', '2026-10-10')?.id).toBe('pa-2');
    expect(pulsAnnehmen(d, { anfrageId: 'pa-1', id: 'pu-x', wert: 5, ...k })).toMatchObject({ ok: false, status: 404 });
    const r = pulsAnnehmen(d, { anfrageId: 'pa-2', id: 'pu-1', wert: 4, satz: ' Zu langsam ', ...k });
    expect(r.ok).toBe(true);
    d = (r as { datei: KundeDatei }).datei;
    expect(d.puls[0]).toMatchObject({ id: 'pu-1', wert: 4, satz: 'Zu langsam', quelle: 'link', anfrageId: 'pa-2' });
    expect(pulsAnnehmen(d, { anfrageId: 'pa-2', id: 'pu-2', wert: 9, ...k })).toMatchObject({ ok: false, status: 409 });
    expect(offeneAnfrage(d, 'm-1', '2026-10-10')).toBeNull();
    d = (pulsHand(d, { mandatId: 'm-1', id: 'pu-3', wert: 7, am: '2026-10-11T08:00:00.000Z' }) as { datei: KundeDatei }).datei;
    expect(letzterPuls(d, 'm-1')?.id).toBe('pu-3');
  });
  it('Wert ganzzahlig 0–10, Satz ≤ 500 Zeichen (413)', () => {
    expect(pulsPruefen(11, '')).toMatchObject({ ok: false, status: 400 });
    expect(pulsPruefen(5.5, '')).toMatchObject({ ok: false, status: 400 });
    expect(pulsPruefen('7', '')).toMatchObject({ ok: false, status: 400 });
    expect(pulsPruefen(0, 'x'.repeat(501))).toMatchObject({ ok: false, status: 413 });
    expect(pulsPruefen(10, undefined)).toEqual({ ok: true, wert: 10 });
  });
});

// ── Upload: Typ am Inhalt, Metadaten weg ─────────────────────────────────────────────────────────────────────────────────────────────

function zip(eintraege: Record<string, string>): Uint8Array {
  const lokal: Buffer[] = [], zentral: Buffer[] = [];
  let versatz = 0;
  for (const [name, inhalt] of Object.entries(eintraege)) {
    const roh = Buffer.from(inhalt, 'utf8'), gepackt = deflateRawSync(roh), n = Buffer.from(name, 'utf8'), crc = crc32(roh);
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
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
/** JPEG mit Exif (APP1) — Bilddaten ab SOS. */
const JPEG_EXIF = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0c, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53, 0x21, 0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0x03, 0xff, 0xd9]);
const riff = (teile: Uint8Array[]) => {
  const inhalt = Buffer.concat([Buffer.from('WEBP'), ...teile.map(t => Buffer.from(t))]);
  const kopf = Buffer.alloc(8); kopf.write('RIFF', 0); kopf.writeUInt32LE(inhalt.length, 4);
  return new Uint8Array(Buffer.concat([kopf, inhalt]));
};
const teil = (art: string, daten: number[]) => { const b = Buffer.alloc(8 + daten.length + (daten.length & 1)); b.write(art, 0); b.writeUInt32LE(daten.length, 4); Buffer.from(daten).copy(b, 8); return new Uint8Array(b); };
const box = (art: string, inhalt: Buffer) => { const b = Buffer.alloc(8); b.writeUInt32BE(8 + inhalt.length, 0); b.write(art, 4); return Buffer.concat([b, inhalt]); };
/** Minimales HEIC: ftyp, meta (iinf mit einem Exif-Element, iloc mit einem Abschnitt), mdat mit „Exif + GPS“. */
function heic(): { bytes: Uint8Array; start: number; laenge: number } {
  const ftyp = box('ftyp', Buffer.concat([Buffer.from('heic'), Buffer.alloc(4), Buffer.from('mif1')]));
  const infe = box('infe', Buffer.concat([Buffer.from([2, 0, 0, 0]), Buffer.from([0, 1]), Buffer.from([0, 0]), Buffer.from('Exif'), Buffer.from([0])]));
  const iinf = box('iinf', Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from([0, 1]), infe]));
  const nutz = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('Exif\0\0GPS-51.2N-6.7E')]);
  const ilocBau = (offset: number) => box('iloc', Buffer.concat([Buffer.from([1, 0, 0, 0]), Buffer.from([0x44, 0x00]), Buffer.from([0, 1]), Buffer.from([0, 1]), Buffer.from([0, 0]), Buffer.from([0, 0]), Buffer.from([0, 1]), (() => { const b = Buffer.alloc(8); b.writeUInt32BE(offset, 0); b.writeUInt32BE(nutz.length, 4); return b; })()]));
  const metaBau = (offset: number) => box('meta', Buffer.concat([Buffer.from([0, 0, 0, 0]), iinf, ilocBau(offset)]));
  const start = ftyp.length + metaBau(0).length + 8;
  const bytes = Buffer.concat([ftyp, metaBau(start), box('mdat', nutz)]);
  return { bytes: new Uint8Array(bytes), start, laenge: nutz.length };
}

describe('Upload: nur sichere Typen am Inhalt, Metadaten weg', () => {
  it('erlaubt: PDF, JPG, PNG, WEBP, HEIC, DOCX/XLSX/PPTX — Endung muss zum Inhalt passen', () => {
    expect(kundeTypErkennen('bericht.pdf', PDF_BYTES)).toBe('application/pdf');
    expect(kundeTypErkennen('foto.jpg', JPEG_EXIF)).toBe('image/jpeg');
    expect(kundeTypErkennen('foto.png', JPEG_EXIF)).toBeNull();
    expect(kundeTypErkennen('bericht.docx', PDF_BYTES)).toBeNull();
    expect(kundeTypErkennen('a.docx', zip({ '[Content_Types].xml': CT, 'word/document.xml': '<w:document/>' }))).toMatch(/wordprocessingml/);
    expect(kundeTypErkennen('a.xlsx', zip({ '[Content_Types].xml': CT, 'xl/workbook.xml': '<workbook/>' }))).toMatch(/spreadsheetml/);
    expect(kundeTypErkennen('a.heic', heic().bytes)).toBe('image/heic');
  });
  it('nie: SVG, ZIP, CSV/TXT, ausführbare Dateien, Office mit Makro-Projekt', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(kundeTypErkennen('bild.svg', svg)).toBeNull();
    expect(kundeTypErkennen('paket.zip', zip({ 'a.txt': 'x' }))).toBeNull();
    expect(kundeTypErkennen('liste.csv', new TextEncoder().encode('a;b\n1;2'))).toBeNull();
    expect(kundeTypErkennen('notiz.txt', new TextEncoder().encode('Hallo'))).toBeNull();
    expect(kundeTypErkennen('setup.exe', new Uint8Array([0x4d, 0x5a, 0x90, 0]))).toBeNull();
    expect(kundeTypErkennen('makro.docx', zip({ '[Content_Types].xml': CT, 'word/document.xml': '<w:document/>', 'word/vbaProject.bin': 'x' }))).toBeNull();
  });
  it('JPEG: Exif (APP1) fällt weg, Bilddaten bleiben', () => {
    const r = ohneMetadaten('image/jpeg', JPEG_EXIF)!;
    expect(Buffer.from(r).includes(Buffer.from('Exif'))).toBe(false);
    expect(Array.from(r.slice(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xda]);
  });
  it('WEBP: EXIF- und XMP-Teil raus, Merker gelöscht, Größe stimmt; ohne Metadaten dieselben Bytes', () => {
    const roh = riff([teil('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]), teil('VP8L', [1, 2, 3, 4, 5]), teil('EXIF', [0x45, 0x78, 0x69, 0x66, 0x47, 0x50]), teil('XMP ', [1, 2, 3])]);
    expect(kundeTypErkennen('a.webp', roh)).toBe('image/webp');
    const r = webpOhneMetadaten(roh)!;
    const b = Buffer.from(r);
    expect(b.includes(Buffer.from('EXIF'))).toBe(false);
    expect(b.includes(Buffer.from('XMP '))).toBe(false);
    expect(b.readUInt32LE(4)).toBe(b.length - 8);
    expect(b[20]).toBe(0);
    const ohne = riff([teil('VP8L', [1, 2, 3])]);
    expect(webpOhneMetadaten(ohne)).toBe(ohne);
    expect(webpOhneMetadaten(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('HEIC: der Inhalt des Exif-Elements wird laut iloc genullt, alles andere bleibt; kaputter Aufbau → null', () => {
    const { bytes, start, laenge } = heic();
    const r = heicOhneMetadaten(bytes)!;
    expect(r.length).toBe(bytes.length);
    expect(Array.from(r.slice(start, start + laenge)).every(x => x === 0)).toBe(true);
    expect(Buffer.from(r.slice(0, start))).toEqual(Buffer.from(bytes.slice(0, start)));
    expect(Buffer.from(r).includes(Buffer.from('GPS'))).toBe(false);
    expect(heicOhneMetadaten(bytes.slice(0, bytes.length - 10))).toBeNull();
  });
  it('Kontingent je Link: 20 Dateien, 200 MB', () => {
    expect(uploadFrei([])).toEqual({ dateien: UPLOAD_GRENZEN.dateienJeLink, bytes: UPLOAD_GRENZEN.bytesJeLink });
    expect(uploadFrei(Array.from({ length: 20 }, () => ({ groesse: 1 }))).dateien).toBe(0);
    expect(uploadFrei([{ groesse: UPLOAD_GRENZEN.bytesJeLink }]).bytes).toBe(0);
  });
});

describe('Bausteine für Kunden: nie „nur intern“, nie „vor Verkauf/Einsatz prüfen“ ohne Vermerk', () => {
  it('kundeTauglich liest die Marken optional', () => {
    expect(kundeTauglich(PLAYBOOK)).toBe(true);
    expect(kundeTauglich({ ...PLAYBOOK, nur_intern: true } as Baustein)).toBe(false);
    expect(kundeTauglich({ ...PLAYBOOK, pruefen_vor_verkauf: true } as Baustein)).toBe(false);
    expect(kundeTauglich({ ...PLAYBOOK, pruefen_vor_verkauf: true, vorVerkaufGeprueft: { am: '2026-10-10', von: 'p' } } as Baustein)).toBe(true);
    expect(kundeTauglich({ ...PLAYBOOK, urheberPruefen: { seit: '2026-10-10', grund: 'Material Dritter' } })).toBe(false);
    expect(kundeTauglich({ ...PLAYBOOK, rechtPruefen: { seit: '2026-10-10', grund: 'UWG' } })).toBe(false);
    expect(kundeTauglich({ ...PLAYBOOK, rechtPruefen: { seit: '2026-10-10', grund: 'UWG' }, rechtGeprueft: { am: '2026-10-11', von: 'p', notiz: 'ok' } })).toBe(true);
  });
});

describe('Fristen (8.1)', () => {
  const d: KundeDatei = {
    ...leerKunde(),
    formulare: [{ mandatId: 'm-alt', bausteinId: 'fb-1', fassung: 1, antworten: { q: 'x' }, fertig: [], geaendertAm: '2025-01-01', quelle: 'kunde' }, { mandatId: 'm-neu', bausteinId: 'fb-1', fassung: 1, antworten: { q: 'y' }, fertig: [], geaendertAm: '2026-10-01', quelle: 'kunde' }],
    puls: [{ id: 'pu-1', mandatId: 'm-alt', am: '2025-01-01T00:00:00Z', wert: 3, satz: 'nennt vielleicht jemanden', quelle: 'link' }, { id: 'pu-2', mandatId: 'm-weg', am: '2025-01-01T00:00:00Z', wert: 9, quelle: 'hand' }],
    unterlagen: [
      { id: 'ud-a', mandatId: 'm-ende', name: 'a.pdf', typ: 'application/pdf', groesse: 1, am: '2026-01-01', herkunft: 'kunde', zweck: 'sonstig', status: 'freigegeben' },
      { id: 'ud-b', mandatId: 'm-ende', name: 'b.pdf', typ: 'application/pdf', groesse: 1, am: '2026-01-01', herkunft: 'kunde', zweck: 'sonstig', status: 'freigegeben', beleg: true },
      { id: 'ud-c', mandatId: 'm-neu', name: 'c.pdf', typ: 'application/pdf', groesse: 1, am: '2026-01-01', herkunft: 'kunde', zweck: 'sonstig', status: 'ungeprueft' },
    ],
  };
  const ende = (id: string) => ({ 'm-alt': { bekannt: true, ende: '2025-06-30' }, 'm-ende': { bekannt: true, ende: '2026-06-30' }, 'm-neu': { bekannt: true, ende: null } } as Record<string, { bekannt: boolean; ende: string | null }>)[id] ?? { bekannt: false, ende: null };
  it('Mandatsdaten nach 12 Monaten (Satz weg, Wert bleibt), Unterlagen nach 90 Tagen außer Beleg, verwaistes Mandat ganz', () => {
    const r = kundeFristenAnwenden(d, ende, { heute: '2026-10-10', mandatsdatenMonate: 12, unterlagenTage: 90 });
    expect(r.datei.formulare.map(f => f.mandatId)).toEqual(['m-neu']);
    expect(r.datei.puls).toEqual([{ id: 'pu-1', mandatId: 'm-alt', am: '2025-01-01T00:00:00Z', wert: 3, quelle: 'link' }]);
    expect(r.datei.unterlagen.map(u => u.id)).toEqual(['ud-b', 'ud-c']);
    expect(r.dateienWeg).toEqual(['ud-a.bin']);
    expect(r.zaehler).toMatchObject({ 'fulfillment-antworten': 1, 'fulfillment-puls-saetze': 1, 'fulfillment-unterlagen': 1, 'fulfillment-kunde-verwaist': 1 });
    // Nichts fällig → dieselbe Datei (kein Schreiben)
    expect(kundeFristenAnwenden(r.datei, ende, { heute: '2026-10-10', mandatsdatenMonate: 12, unterlagenTage: 90 }).datei).toBe(r.datei);
  });
  it('Monatsrechnung klemmt am Monatsende; verwaiste Dateien nur alt und nirgends genannt', () => {
    expect(monatPlus('2026-01-31', 1)).toBe('2026-02-28');
    expect(monatPlus('2025-10-10', 12)).toBe('2026-10-10');
    const bekannt = alleTexte({ unterlagen: [{ id: 'ud-da' }], faelle: { x: { wirkung: { dateiName: 'wirkung-1.bin' } } } });
    expect(verwaisteDateien([{ name: 'ud-da.bin', alt: true }, { name: 'wirkung-1.bin', alt: true }, { name: 'ud-weg.bin', alt: true }, { name: 'ud-neu.bin', alt: false }], bekannt)).toEqual(['ud-weg.bin']);
  });
});

// ── Report: ohne Fall Byte für Byte wie vorher, mit Fall die neuen Abschnitte ─────────────────────────────────────────────────────────

const DOK: ReportDokument = { titel: 'Fortschrittsbericht', kunde: 'Beispiel GmbH', mandat: 'Vertrieb aufbauen', paket: 'Stufe Zwei', stand: '10.10.2026', absender: 'Muster Firma', schritt: 'Analyse (Schritt 2 von 5)', erreicht: ['Kick-off (01.10.2026)', 'Schritt 2 von 5 erreicht: Analyse'], naechste: ['Diagnose vorstellen — bis 20.10.2026', 'Pipeline-Definition'], kennzahlen: [{ name: 'Woran wir es messen', wert: 'Abschlussquote' }, { name: 'Neue Termine', wert: 'Ist: 4 · Ziel: 10' }], hinweis: 'Dieser Bericht fasst den Stand aus unserer Projektarbeit zusammen. Fragen oder Ergänzungen gern direkt als Antwort auf die Mail.' };
/** Schnappschuss aus dem Stand VOR C2 (update-0910b, 75e5be3d) — gleiche Eingabe, gleiche Bytes. */
const PDF_VORHER = '4c004b252d9cd05f6513f42406b9e22c8474e46d028242abbd6673bed8f58d3a';
const MAIL_DU_VORHER = 'Hey Erika,\n\nich wollte dich gerade updaten — das ist der Stand:\n\nErreicht:\n- Kick-off (01.10.2026)\n- Schritt 2 von 5 erreicht: Analyse\n\nAls Nächstes:\n- Diagnose vorstellen — bis 20.10.2026\n- Pipeline-Definition\n\nDen ausführlichen Bericht findest du im Anhang. Melde dich gern, wenn du Fragen hast.\n\nViele Grüße\nMax Probe';
const MAIL_SIE_VORHER = 'Guten Tag Erika Beispiel,\n\nich möchte Sie kurz auf den aktuellen Stand bringen:\n\nErreicht:\n- Kick-off (01.10.2026)\n- Schritt 2 von 5 erreicht: Analyse\n\nAls Nächstes:\n- Diagnose vorstellen — bis 20.10.2026\n- Pipeline-Definition\n\nDen ausführlichen Bericht finden Sie im Anhang. Melden Sie sich gern, wenn Sie Fragen haben.\n\nFreundliche Grüße\nMax Probe';

describe('2-Wochen-Report (5.2)', () => {
  it('ohne Fall: Report-Zusatz null, Dokument dasselbe Objekt, PDF und Mail Byte für Byte wie vorher', async () => {
    expect(reportZusatz(null, { id: 'm-1', ziele: [] }, leerKunde(), '2026-10-10', true)).toBeNull();
    expect(mitZusatz(DOK, null)).toBe(DOK);
    expect(hatZusatz(DOK)).toBe(false);
    const pdf = await reportPdf(mitZusatz(DOK, null), { erstellt: new Date('2026-10-10T08:00:00Z') });
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(PDF_VORHER);
    expect(mailVorlage({ anrede: 'Du', vorname: 'Erika', nachname: 'Beispiel', doc: DOK, absender: 'Max Probe' })).toEqual({ betreff: 'Fortschritt Stufe Zwei — Stand 10.10.2026', text: MAIL_DU_VORHER });
    expect(mailVorlage({ anrede: 'Sie', vorname: 'Erika', nachname: 'Beispiel', doc: DOK, absender: 'Max Probe' }).text).toBe(MAIL_SIE_VORHER);
  });
  it('mit Fall: Wartet auf euch, Wert-Konto, Puls; Puls-Frage nur mit aktivem Link — als Platzhalter (der Link entsteht beim Senden)', async () => {
    const fall = {
      knoten: [{ id: 'w', titel: 'Wurzel', rang: 1, status: 'offen' }, { id: 'k1', elternId: 'w', titel: 'Preisliste freigeben', rang: 1, status: 'wartet_kunde', seit: '2026-10-01' }],
      entscheidungen: [{ id: 'fe-1', am: '2026-10-05', titel: 'Budget freigeben', status: 'offen', wer: 'kunde', geteilt: true, von: 'p' }], freigaben: {},
      wertKonto: { z1: { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine', festgelegtAm: '2026-10-01', messungen: [{ am: '2026-10-08', wert: 7, quelle: 'hand' }] } },
    } as unknown as Fall;
    const kunde = { puls: [{ id: 'pu-1', mandatId: 'm-1', am: '2026-10-09T10:00:00.000Z', wert: 8, quelle: 'link' as const }] };
    const z = reportZusatz(fall, { id: 'm-1', ziele: [{ id: 'z1', text: 'Neue Termine', ziel: '12', ist: '4' }] }, kunde, '2026-10-10', true)!;
    expect(z.wartetAufEuch).toEqual(['Preisliste freigeben (seit 9 Tagen)', 'Budget freigeben (seit 5 Tagen)']);
    expect(z.wertKonto[0]).toMatchObject({ name: 'Neue Termine', vorher: '4 Termine', jetzt: '7 Termine', ziel: '12 Termine' });
    expect(z.puls).toEqual({ wert: 8, am: '2026-10-09' });
    expect(z.pulsFrage).toBe(true);
    expect(reportZusatz(fall, { id: 'm-1', ziele: [] }, kunde, '2026-10-10', false)!.pulsFrage).toBeUndefined();
    const dok = mitZusatz({ ...DOK, kennzahlen: [...DOK.kennzahlen, { name: 'Neue Termine', wert: 'Ist: 4' }] }, z);
    expect(hatZusatz(dok)).toBe(true);
    expect(dok.kennzahlen.map(k => k.name)).toEqual(['Woran wir es messen']);
    const mail = mailVorlage({ anrede: 'Du', vorname: 'Erika', doc: dok, absender: 'Max Probe' }).text;
    expect(mail).toContain('Erledigt:\n- Kick-off');
    expect(mail).toContain('Wartet auf euch:\n- Preisliste freigeben (seit 9 Tagen)');
    expect(mail).toContain('- Neue Termine: 4 Termine → 7 Termine → 12 Termine');
    expect(mail).toContain(PULS_PLATZHALTER);
    expect(mailVorlage({ anrede: 'Sie', nachname: 'Beispiel', doc: { ...dok, pulsFrage: false }, absender: 'Max Probe' }).text).not.toContain(PULS_PLATZHALTER);
    const pdf = Buffer.from(await reportPdf(dok, { erstellt: new Date('2026-10-10T08:00:00Z') }));
    expect(createHash('sha256').update(pdf).digest('hex')).not.toBe(PDF_VORHER);
    expect(pdf.length).toBeGreaterThan(2000);
  });
});
