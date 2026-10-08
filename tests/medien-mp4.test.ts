// ─── Medien: Ort und Ton aus MOV/MP4 entfernen, ohne Neukodierung (09.10., Paket 5) ─────────────────────────────────────
// Eine erfundene QuickTime-Datei (ftyp · mdat · moov mit udta/©xyz, meta mit ISO6709, Bildspur, Tonspur, Metadaten-Spur): nach den Patches
// fehlen Ort und Ton, die Bilddaten sind Byte für Byte gleich, die Größe ändert sich nicht. Dazu: Exif lesen/säubern/Drehung behalten.
import { describe, it, expect } from 'vitest';
import { ortUndTonEntfernen, patchesAnwenden } from '@/lib/medien/mp4-ort';
import { exifLesen, jpegMitDrehung, jpegMetadatenUebrig } from '@/lib/medien/exif';
import { jpegOhneMetadaten } from '@/lib/netzwerken/bild-bereinigen';

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const atom = (typ: string, ...inhalt: Buffer[]) => { const k = Buffer.concat(inhalt); return Buffer.concat([u32(8 + k.length), Buffer.from(typ, 'latin1'), k]); };
const voll = (typ: string, ...inhalt: Buffer[]) => atom(typ, Buffer.alloc(4), ...inhalt);
const hdlr = (h: string) => voll('hdlr', Buffer.alloc(4), Buffer.from(h, 'latin1'), Buffer.alloc(12), Buffer.from('x\0'));
function spur(h: string, groessen: number[], jeChunk: number[], offsets: number[]) {
  const stsz = voll('stsz', u32(0), u32(groessen.length), ...groessen.map(u32));
  const stsc = voll('stsc', u32(jeChunk.length), ...jeChunk.flatMap((n, i) => [u32(i + 1), u32(n), u32(1)]));
  const stco = voll('stco', u32(offsets.length), ...offsets.map(u32));
  return atom('trak', voll('tkhd', Buffer.alloc(80)), atom('udta', atom('name', Buffer.from('Spur'))), atom('mdia', voll('mdhd', Buffer.alloc(20)), hdlr(h), atom('minf', atom('stbl', voll('stsd', u32(0)), stsz, stsc, stco))));
}

const ORT = '+52.5200+013.4050+034.000/';
function film(o: { fragmentiert?: boolean } = {}) {
  const ftyp = atom('ftyp', Buffer.from('qt  ', 'latin1'), u32(0), Buffer.from('qt  ', 'latin1'));
  const bild = Buffer.alloc(300, 0x56), ton1 = Buffer.alloc(40, 0x41), ton2 = Buffer.alloc(60, 0x41), meta = Buffer.alloc(20, 0x4d);
  const mdatInhalt = Buffer.concat([bild, ton1, ton2, meta]);
  const mdatStart = ftyp.length + 8;
  const oBild = mdatStart, oTon1 = oBild + 300, oTon2 = oTon1 + 40, oMeta = oTon2 + 60;
  const mdat = atom('mdat', mdatInhalt);
  const moov = atom('moov',
    voll('mvhd', Buffer.alloc(96)),
    atom('udta', atom('\xa9xyz', u32(0), Buffer.from(ORT))),
    atom('meta', voll('hdlr', Buffer.alloc(8)), atom('keys', Buffer.from('com.apple.quicktime.location.ISO6709')), atom('ilst', Buffer.from(ORT))),
    spur('vide', [100, 100, 100], [3], [oBild]),
    spur('soun', [20, 20, 30, 30], [2, 2], [oTon1, oTon2]),
    spur('meta', [20], [1], [oMeta]),
  );
  const teile = [ftyp, mdat, moov, ...(o.fragmentiert ? [atom('moof', Buffer.alloc(8))] : [])];
  return { datei: Buffer.concat(teile), bild: { von: oBild, b: bild } };
}
const leser = (d: Buffer) => async (von: number, laenge: number) => new Uint8Array(d.subarray(von, von + laenge));

describe('MOV/MP4: Ort und Ton ohne Neukodierung', () => {
  it('ohne Ton-Schalter: Ort und Ton weg, Bilddaten gleich, Größe gleich', async () => {
    const { datei, bild } = film();
    const r = await ortUndTonEntfernen(leser(datei), datei.length, false);
    expect(r).toMatchObject({ ortEntfernt: true, ton: 'entfernt' });
    const neu = Buffer.from(patchesAnwenden(new Uint8Array(datei), 0, r.patches));
    expect(neu.length).toBe(datei.length);
    expect(neu.includes(Buffer.from(ORT))).toBe(false);
    expect(neu.includes(Buffer.from('com.apple.quicktime.location'))).toBe(false);
    expect(neu.includes(Buffer.alloc(40, 0x41))).toBe(false);         // Tondaten genullt
    expect(neu.includes(Buffer.alloc(20, 0x4d))).toBe(false);         // Metadaten-Spur genullt
    expect(neu.subarray(bild.von, bild.von + 300).equals(bild.b)).toBe(true);
    // Stückweise angewandt (wie der Upload in 8-MiB-Stücken) = ganz angewandt.
    const stueckweise = Buffer.concat([0, 100, 333, 500].map((von, i, a) => Buffer.from(patchesAnwenden(new Uint8Array(datei.subarray(von, a[i + 1] ?? datei.length)), von, r.patches))));
    expect(stueckweise.equals(neu)).toBe(true);
    // Noch einmal gelesen: keine Tonspur mehr, nichts mehr zu tun.
    const zwei = await ortUndTonEntfernen(leser(neu), neu.length, false);
    expect(zwei.ton).toBe('keiner');
  });

  it('Ton-Schalter an (§ 201 bestätigt): Ton bleibt, Ort fällt trotzdem', async () => {
    const { datei } = film();
    const r = await ortUndTonEntfernen(leser(datei), datei.length, true);
    expect(r).toMatchObject({ ortEntfernt: true, ton: 'an' });
    const neu = Buffer.from(patchesAnwenden(new Uint8Array(datei), 0, r.patches));
    expect(neu.includes(Buffer.alloc(40, 0x41))).toBe(true);
    expect(neu.includes(Buffer.from(ORT))).toBe(false);
  });

  it('fragmentierte Datei: Ton lässt sich nicht sicher entfernen → „nicht freigegeben“; Unsinn → Ort nicht entfernt', async () => {
    const { datei } = film({ fragmentiert: true });
    expect((await ortUndTonEntfernen(leser(datei), datei.length, false)).ton).toBe('nicht-freigegeben');
    const muell = Buffer.alloc(200, 0xff);
    expect(await ortUndTonEntfernen(leser(muell), muell.length, false)).toMatchObject({ ortEntfernt: false, ton: 'nicht-freigegeben' });
  });
});

describe('Foto: Exif lesen, säubern, nur die Drehung behalten', () => {
  // JPEG mit Exif (MM): Orientation 6, DateTimeOriginal, OffsetTimeOriginal und ein „GPS“-Platzhalter dahinter.
  function mitExif(): Buffer {
    const tiff = Buffer.alloc(140);
    tiff.write('MM', 0, 'latin1'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
    tiff.writeUInt16BE(2, 8); // IFD0: 2 Einträge
    tiff.writeUInt16BE(0x0112, 10); tiff.writeUInt16BE(3, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt16BE(6, 18);
    tiff.writeUInt16BE(0x8769, 22); tiff.writeUInt16BE(4, 24); tiff.writeUInt32BE(1, 26); tiff.writeUInt32BE(38, 30);
    tiff.writeUInt16BE(2, 38); // Exif-IFD: 2 Einträge
    tiff.writeUInt16BE(0x9003, 40); tiff.writeUInt16BE(2, 42); tiff.writeUInt32BE(20, 44); tiff.writeUInt32BE(70, 48);
    tiff.writeUInt16BE(0x9011, 52); tiff.writeUInt16BE(2, 54); tiff.writeUInt32BE(7, 56); tiff.writeUInt32BE(92, 60); tiff.write('+02:00\0', 92, 'latin1');
    tiff.write('2026:10:08 19:30:05\0', 70, 'latin1');
    tiff.write('GPS-ORT-GEHEIM', 110, 'latin1');
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, 0]), Buffer.from('Exif\0\0', 'latin1'), tiff]);
    app1.writeUInt16BE(app1.length - 2, 2);
    return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02]), Buffer.alloc(50, 9), Buffer.from([0xff, 0xd9])]);
  }
  it('liest Drehung und Aufnahmezeit, entfernt alles andere, setzt nur die Drehung wieder ein', () => {
    const roh = mitExif();
    expect(exifLesen(roh)).toEqual({ drehung: 6, aufgenommen: '2026-10-08T19:30:05+02:00' });
    expect(jpegMetadatenUebrig(roh)).toBe(true);
    const sauber = jpegOhneMetadaten(roh)!;
    const mitDrehung = Buffer.from(jpegMitDrehung(sauber, 6));
    expect(mitDrehung.includes(Buffer.from('GPS-ORT-GEHEIM'))).toBe(false);
    expect(mitDrehung.includes(Buffer.from('2026:10:08'))).toBe(false);
    expect(exifLesen(mitDrehung)).toEqual({ drehung: 6 });
    expect(jpegMetadatenUebrig(mitDrehung)).toBe(false);
    expect(jpegMitDrehung(sauber, 1)).toBe(sauber);
  });
});
