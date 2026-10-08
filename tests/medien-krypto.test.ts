// ─── Medien: Verschlüsselung je Segment, Schlüssel je Medium (09.10., Paket 5) ─────────────────────────────────────────
// Rundweg (ganze Datei in Stücken, Bereiche über Segment- und Stückgrenzen), Manipulation, Vertauschen (anderes Medium/Variante),
// Abschneiden, falscher Schlüssel wirft (nie still), Rotation = nur den Schlüssel neu wickeln, Prüfsumme wie im Browser.
import { describe, it, expect } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import {
  neuerSchluessel, schluesselOeffnen, schluesselNeuWickeln, schluesselAktuell, teilVerschluesseln, ganzVerschluesseln, ganzEntschluesseln,
  chiffratBereich, segmenteEntschluesseln, bereichSchneiden, objektGroesse, pruefsummeAusTeilen, neuesSalz, SEGMENT, KOPF,
  SchluesselFehlt, EntschluesselungFehlgeschlagen,
} from '@/lib/medien/krypto';
import { schluesselAus } from '@/lib/store/huelle.mjs';
import { GRENZEN, teileVon, teilLaenge } from '@/lib/medien/typen';

const ring = (...geheim: string[]) => { const alle = geheim.map(schluesselAus); return { aktiv: alle[0] ?? null, alle }; };
const ID = 'md-00000000-0000-4000-8000-00000000000a';

/** Eine Datei wie der Upload: Stücke einzeln verschlüsselt, hintereinander = das Objekt. */
function objektAus(dek: Buffer, klar: Buffer, id = ID) {
  const salze: string[] = [];
  const teile: Buffer[] = [];
  for (let nr = 0; nr < teileVon(klar.length); nr++) {
    const salz = neuesSalz();
    salze.push(salz);
    teile.push(teilVerschluesseln(dek, { mediumId: id, variante: 'original' }, nr, klar.subarray(nr * GRENZEN.teil, nr * GRENZEN.teil + teilLaenge(klar.length, nr)), klar.length, salz));
  }
  return { objekt: Buffer.concat(teile), salze };
}

describe('Medien-Verschlüsselung', () => {
  const klar = randomBytes(GRENZEN.teil * 2 + 70_001); // drei Stücke, letztes Segment kurz
  const { dek } = neuerSchluessel(ID, ring('pruef-schluessel-medien-a'));
  const { objekt, salze } = objektAus(dek, klar);

  it('Objekt hat genau die erwartete Länge (Kopf + Prüfwert je Segment) und trägt den Klartext nicht', () => {
    expect(objekt.length).toBe(objektGroesse(klar.length));
    expect(objekt.subarray(0, 8).toString('ascii')).toBe('MKOSMED1');
    expect(objekt.includes(klar.subarray(1000, 1064))).toBe(false);
  });

  it('Rundweg ganz und für beliebige Bereiche (über Segment- und Stückgrenzen)', () => {
    expect(ganzEntschluesseln(dek, { mediumId: ID, variante: 'original' }, salze, klar.length, objekt).equals(klar)).toBe(true);
    for (const [von, bis] of [[0, 0], [SEGMENT - 1, SEGMENT], [GRENZEN.teil - 5, GRENZEN.teil + 5], [klar.length - 10, klar.length - 1], [123_456, 2_345_678], [0, klar.length - 1]]) {
      const cb = chiffratBereich(von, bis, klar.length);
      const seg = segmenteEntschluesseln(dek, { mediumId: ID, variante: 'original' }, salze, klar.length, objekt.subarray(cb.von, cb.bis + 1), cb.ersterSeg);
      expect(bereichSchneiden(seg, von, bis, cb.ersterSeg).equals(klar.subarray(von, bis + 1)), `${von}-${bis}`).toBe(true);
    }
  });

  it('jede Veränderung wirft: ein Byte, Abschneiden, anderes Medium, andere Variante, falsches Salz', () => {
    const z = { mediumId: ID, variante: 'original' };
    const kaputt = Buffer.from(objekt); kaputt[KOPF + 10] ^= 1;
    expect(() => ganzEntschluesseln(dek, z, salze, klar.length, kaputt)).toThrow(EntschluesselungFehlgeschlagen);
    expect(() => ganzEntschluesseln(dek, z, salze, klar.length, objekt.subarray(0, objekt.length - 100))).toThrow(EntschluesselungFehlgeschlagen);
    // Abschneiden auf eine volle Segmentgrenze: das „letzte“ Segment trug keinen Letzt-Merker → fällt auf.
    const kurz = KOPF + 5 * (SEGMENT + 16);
    expect(() => segmenteEntschluesseln(dek, z, salze, 5 * SEGMENT, objekt.subarray(KOPF, kurz), 0)).toThrow(EntschluesselungFehlgeschlagen);
    expect(() => ganzEntschluesseln(dek, { mediumId: 'md-00000000-0000-4000-8000-00000000000b', variante: 'original' }, salze, klar.length, objekt)).toThrow(EntschluesselungFehlgeschlagen);
    expect(() => ganzEntschluesseln(dek, { mediumId: ID, variante: 'ansicht' }, salze, klar.length, objekt)).toThrow(EntschluesselungFehlgeschlagen);
    expect(() => ganzEntschluesseln(dek, z, [neuesSalz(), ...salze.slice(1)], klar.length, objekt)).toThrow(EntschluesselungFehlgeschlagen);
  });

  it('dasselbe Stück zweimal verschlüsselt (neuer Versuch) → anderes Chiffrat (Nonce nie doppelt)', () => {
    const a = teilVerschluesseln(dek, { mediumId: ID, variante: 'original' }, 1, klar.subarray(GRENZEN.teil, 2 * GRENZEN.teil), klar.length, neuesSalz());
    const b = teilVerschluesseln(dek, { mediumId: ID, variante: 'original' }, 1, klar.subarray(GRENZEN.teil, 2 * GRENZEN.teil), klar.length, neuesSalz());
    expect(a.equals(b)).toBe(false);
  });

  it('Schlüssel je Medium: gewickelt mit dem Datenschlüssel; falscher Datenschlüssel bzw. falsches Medium wirft', () => {
    const r = ring('pruef-schluessel-medien-a');
    const { dek: d, gewickelt } = neuerSchluessel(ID, r);
    expect(gewickelt.kid).toBe(r.aktiv!.kid);
    expect(Buffer.from(gewickelt.dek, 'base64').includes(d)).toBe(false);
    expect(schluesselOeffnen(gewickelt, ID, r).equals(d)).toBe(true);
    expect(() => schluesselOeffnen(gewickelt, ID, ring('ein-ganz-anderer-schluessel'))).toThrow(SchluesselFehlt);
    expect(() => schluesselOeffnen(gewickelt, 'md-00000000-0000-4000-8000-00000000000c', r)).toThrow(EntschluesselungFehlgeschlagen);
    // Mit falschem DEK lässt sich der Inhalt nicht öffnen.
    const k = ganzVerschluesseln(d, { mediumId: ID, variante: 'raster' }, Buffer.from('vorschau'));
    expect(() => ganzEntschluesseln(randomBytes(32), { mediumId: ID, variante: 'raster' }, [k.salz], 8, k.bytes)).toThrow(EntschluesselungFehlgeschlagen);
  });

  it('Rotation: nur der Schlüssel wird neu gewickelt — der Inhalt bleibt lesbar, ohne ihn neu zu schreiben', () => {
    const alt = ring('pruef-schluessel-alt');
    const { dek: d, gewickelt } = neuerSchluessel(ID, alt);
    const k = ganzVerschluesseln(d, { mediumId: ID, variante: 'raster' }, Buffer.from('bild'));
    const beide = { aktiv: schluesselAus('pruef-schluessel-neu'), alle: [schluesselAus('pruef-schluessel-neu'), schluesselAus('pruef-schluessel-alt')] };
    expect(schluesselAktuell(gewickelt, beide)).toBe(false);
    const neu = schluesselNeuWickeln(gewickelt, ID, beide)!;
    expect(neu.kid).toBe(beide.aktiv.kid);
    expect(schluesselNeuWickeln(neu, ID, beide)).toBeNull();
    const nurNeu = ring('pruef-schluessel-neu');
    expect(ganzEntschluesseln(schluesselOeffnen(neu, ID, nurNeu), { mediumId: ID, variante: 'raster' }, [k.salz], 4, k.bytes).toString()).toBe('bild');
  });

  it('ohne Datenschlüssel (lokal) steht der Schlüssel ungewickelt — der Inhalt ist trotzdem verschlüsselt', () => {
    const { dek: d, gewickelt } = neuerSchluessel(ID, { aktiv: null, alle: [] });
    expect(gewickelt.kid).toBeNull();
    expect(schluesselOeffnen(gewickelt, ID, { aktiv: null, alle: [] }).equals(d)).toBe(true);
  });

  it('Prüfsumme der Datei = SHA-256 über die Stück-Prüfsummen (wie der Browser)', () => {
    const h = [createHash('sha256').update('a').digest('hex'), createHash('sha256').update('b').digest('hex')];
    expect(pruefsummeAusTeilen(h)).toBe(createHash('sha256').update(Buffer.concat(h.map(x => Buffer.from(x, 'hex')))).digest('hex'));
  });

  it('falsche Stücklänge wird abgelehnt (der Server prüft vorher, die Krypto noch einmal)', () => {
    expect(() => teilVerschluesseln(dek, { mediumId: ID, variante: 'original' }, 0, Buffer.alloc(10), klar.length, neuesSalz())).toThrow(RangeError);
  });
});
