// Ablaufprüfung K2 (28.09.): Kontakt-Schreibvorgänge im Browser laufen nacheinander und tragen den zuletzt vom
// Server gemeldeten Stand — zwei direkt aufeinanderfolgende Teiländerungen (zwei schnelle Klicks) dürfen nicht
// aneinander scheitern. Nachgestellter Server mit Stand-Prüfung wie PATCH /api/state/kontakte. Alle Daten erfunden.
import { describe, it, expect } from 'vitest';
import { KontaktStaende, kontaktSchreiben, kontaktOpMitStand, nacheinanderKette, type KontaktAntwort } from '@/lib/crm/kontakt-schreiben';

/** Nachgestellter Server: ein Kontakt, Stand zählt je Schreiben hoch; veralteter Stand → 409 mit dem aktuellen Eintrag. */
function server() {
  const k: Record<string, unknown> & { id: string; stand: string; labels: string[] } = { id: 'c-test', stand: 's1', labels: [] };
  let n = 1;
  const gesendet: Record<string, unknown>[] = [];
  const senden = async (op: Record<string, unknown>): Promise<KontaktAntwort> => {
    gesendet.push(op);
    await new Promise(r => setTimeout(r, 5)); // Netzlaufzeit — ohne Kette würden sich die Aufrufe überholen
    if (op.stand && op.stand !== k.stand) return { ok: false, error: 'Konflikt', konflikte: [{ id: k.id, grund: 'inzwischen geändert', aktuell: { ...k } }] };
    const felder = (op.felder ?? op.eintrag) as Record<string, unknown>;
    Object.assign(k, felder);
    k.stand = `s${++n}`;
    return { ok: true, zeilen: [{ id: k.id, stand: k.stand }] };
  };
  return { k, senden, gesendet, fremd: () => { k.labels = [...k.labels, 'fremd']; k.stand = `s${++n}`; } };
}

describe('Kontakt-Schreibvorgänge nacheinander mit Serverstand (K2)', () => {
  it('zwei direkt aufeinanderfolgende Teiländerungen: beide gespeichert, keine 409', async () => {
    const s = server();
    const staende = new KontaktStaende();
    staende.alle([{ id: 'c-test', stand: 's1' }]);
    const kette = nacheinanderKette();
    // Zwei Klicks in WahlMehrfach — beide sofort abgeschickt, ohne auf den ersten zu warten.
    const a = kette(() => kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['a'] } }, staende));
    const b = kette(() => kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['a', 'b'] } }, staende));
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(s.k.labels).toEqual(['a', 'b']);
    // Der zweite trug den Stand aus der Antwort des ersten — nicht den der Anzeige vor dem ersten Klick.
    expect(s.gesendet.map(o => o.stand)).toEqual(['s1', 's2']);
    expect(staende.get('c-test')).toBe('s3');
  });

  it('ohne Kette (Altfehler): der zweite Klick scheitert an der eigenen ersten Änderung', async () => {
    const s = server();
    const staende = new KontaktStaende();
    staende.alle([{ id: 'c-test', stand: 's1' }]);
    const [ra, rb] = await Promise.all([
      kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['a'] } }, staende),
      kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['a', 'b'] } }, staende),
    ]);
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(false);
  });

  it('409 durch fremde Änderung: der aktuelle Stand aus konflikte[].aktuell gilt danach — der nächste Versuch klappt', async () => {
    const s = server();
    const staende = new KontaktStaende();
    staende.alle([{ id: 'c-test', stand: 's1' }]);
    s.fremd();
    const kette = nacheinanderKette();
    const r = await kette(() => kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['x'] } }, staende));
    expect(r.ok).toBe(false);
    expect(r.konflikte?.[0].aktuell?.labels).toEqual(['fremd']);
    expect(staende.get('c-test')).toBe(s.k.stand);
    const nochmal = await kette(() => kontaktSchreiben(s.senden, { op: 'teil', id: 'c-test', felder: { labels: ['fremd', 'x'] } }, staende));
    expect(nochmal.ok).toBe(true);
    expect(s.k.labels).toEqual(['fremd', 'x']);
  });

  it('ganzer Eintrag: Stand am Op aus dem Serverstand, nie das Feld `stand` im Eintrag', () => {
    const staende = new KontaktStaende();
    staende.uebernehmen([{ id: 'c-test', stand: 'server' }]);
    const op = kontaktOpMitStand({ op: 'upsert', eintrag: { id: 'c-test', stand: 'anzeige-alt', vorname: 'Testa' } }, staende);
    expect(op).toEqual({ op: 'upsert', eintrag: { id: 'c-test', vorname: 'Testa' }, stand: 'server' });
    // Unbekannter (neuer) Kontakt: ohne Stand.
    expect(kontaktOpMitStand({ op: 'teil', id: 'c-neu', felder: {} }, staende)).toEqual({ op: 'teil', id: 'c-neu', felder: {} });
    staende.uebernehmen([], ['c-test']);
    expect(staende.get('c-test')).toBeUndefined();
  });

  it('die Kette läuft nach einem Fehler weiter', async () => {
    const kette = nacheinanderKette();
    const erster = kette(async () => { throw new Error('weg'); });
    const zweiter = kette(async () => 'ok');
    await expect(erster).rejects.toThrow('weg');
    expect(await zweiter).toBe('ok');
  });
});
