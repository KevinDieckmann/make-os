// ─── Sichtprüfung 29.09., F5 — Gesellschaften: Schreibkette statt paralleler Speicherungen ──
// Verlust-Szenario nachgebaut: zwei schnelle Änderungen mit demselben Stand → die zweite 409, eine später eintreffende
// 200 der ersten löschte die Meldung. Jetzt: nacheinander, Stand aus der letzten Antwort, Meldung bleibt bis zum
// nächsten Schreiben. Server als kleiner Nachbau (Stand = Zähler), keine echten Daten.
import { describe, it, expect } from 'vitest';
import { gesellschaftKette, GESELLSCHAFT_KONFLIKT, KEINE_VERBINDUNG, type GesellschaftAntwort } from '@/lib/crm/gesellschaft-kette';

type G = { id: string; stand: string; felder: Record<string, unknown> };

/** Nachbau der Route: prüft den Stand, antwortet verzögert (die erste Antwort kommt als letzte an, wenn parallel). */
function server(start: Record<string, unknown> = {}) {
  let g: G = { id: 'kdv', stand: 's1', felder: { ...start } };
  let n = 1;
  const eingang: string[] = [];
  return {
    get: () => g,
    fremd: (felder: Record<string, unknown>) => { g = { ...g, stand: `s${++n}`, felder: { ...g.felder, ...felder } }; },
    patch: async (felder: Record<string, unknown>, stand: string, verzoegerung = 0): Promise<GesellschaftAntwort<G>> => {
      eingang.push(stand);
      await new Promise(r => setTimeout(r, verzoegerung));
      if (stand !== g.stand) return { ok: false, fehler: 'Wurde inzwischen geändert.', aktuell: g };
      g = { ...g, stand: `s${++n}`, felder: { ...g.felder, ...felder } };
      return { ok: true, gesellschaft: g };
    },
    eingang,
  };
}

function haken() {
  const meldungen: (string | null)[] = [];
  let zuletzt: G | null = null;
  return { h: { uebernehmen: (x: G) => { zuletzt = x; }, meldung: (t: string | null) => { meldungen.push(t); } }, meldungen, zuletzt: () => zuletzt };
}

describe('Gesellschaften-Schreibkette (F5)', () => {
  it('zwei schnelle Änderungen: nacheinander, die zweite mit dem Stand aus der ersten Antwort — beide gespeichert', async () => {
    const s = server();
    const { h, meldungen } = haken();
    const k = gesellschaftKette<G>('s1', h);
    const [a, b] = await Promise.all([
      k.schreibe(stand => s.patch({ strasse: 'Hauptstraße 1' }, stand, 30)),
      k.schreibe(stand => s.patch({ plz: '12345' }, stand, 0)),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(s.eingang).toEqual(['s1', 's2']);
    expect(s.get().felder).toEqual({ strasse: 'Hauptstraße 1', plz: '12345' });
    expect(meldungen.filter(Boolean)).toEqual([]);
    expect(k.stand()).toBe('s3');
  });

  it('ein Konflikt bleibt sichtbar — eine danach eintreffende 200 löscht die Meldung nicht', async () => {
    const s = server();
    const { h, meldungen } = haken();
    const k = gesellschaftKette<G>('s1', h);
    s.fremd({ ort: 'Köln' }); // jemand anders war schneller → unser Stand s1 ist alt
    const erst = k.schreibe(stand => s.patch({ strasse: 'Weg 2' }, stand, 20));
    const dann = k.schreibe(stand => s.patch({ plz: '50667' }, stand, 0));
    const [a, b] = await Promise.all([erst, dann]);
    expect(a).toEqual({ ok: false, fehler: GESELLSCHAFT_KONFLIKT });
    // Die zweite lief mit dem Stand aus der Konflikt-Antwort → gespeichert.
    expect(b.ok).toBe(true);
    // Letzte Meldung ist der Konflikt — nicht durch die spätere 200 gelöscht.
    expect(meldungen[meldungen.length - 1]).toBe(GESELLSCHAFT_KONFLIKT);
    // Erst ein neuer Schreibvorgang räumt sie weg.
    await k.schreibe(stand => s.patch({ strasse: 'Weg 2' }, stand));
    expect(meldungen[meldungen.length - 1]).toBeNull();
    expect(s.get().felder).toMatchObject({ strasse: 'Weg 2', plz: '50667', ort: 'Köln' });
  });

  it('keine Verbindung → Meldung, die Kette läuft weiter; Laden setzt den Stand nur, wenn nichts unterwegs ist', async () => {
    const s = server();
    const { h, meldungen } = haken();
    const k = gesellschaftKette<G>('s1', h);
    const weg = k.schreibe(() => Promise.reject(new Error('netz')));
    k.standSetzen('sX'); // läuft gerade etwas → ignoriert
    expect((await weg).fehler).toBe(KEINE_VERBINDUNG);
    expect(meldungen[meldungen.length - 1]).toBe(KEINE_VERBINDUNG);
    expect(k.stand()).toBe('s1');
    expect((await k.schreibe(stand => s.patch({ web: 'beispiel.test' }, stand))).ok).toBe(true);
    k.standSetzen('s9');
    expect(k.stand()).toBe('s9');
  });
});
