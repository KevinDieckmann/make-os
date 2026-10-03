// ─── Netzwerken — Abmelden (03.10.): warnen, senden, aufräumen; Zähler-Abzeichen ──────────
// Ohne Browser: Warteschlange im Arbeitsspeicher, Speicher und Fragen als Attrappen.
import { describe, it, expect } from 'vitest';
import { Warteschlange, ramSpeicher, offenFuer, type Sender } from '@/lib/netzwerken/warteschlange';
import { vorAbmelden, netzwerkenAufraeumen, DB_NAME, type Speicherzugang } from '@/lib/netzwerken/abmelden';

const anzeige = { name: 'Anna Beispiel', schritt: 'Follow-up', eventTitel: 'Stammtisch' };
const koerper = (id: string, von = 'kevin') => ({ erfassungId: id, erfasstVon: von });
const ok: Sender = async () => ({ status: 200, daten: { ok: true } });
const netzweg: Sender = async () => { throw new TypeError('Failed to fetch'); };

function speicher(start: string[] = ['make-os-netzwerken-event', 'make-os-netzwerken-kontext', 'make-karten-cache', 'anderes']) {
  const keys = new Set(start); const geloescht: string[] = [];
  const z: Speicherzugang = { schluessel: () => Array.from(keys), entferne: k => { keys.delete(k); }, loescheDb: async n => { geloescht.push(n); } };
  return { z, keys, geloescht };
}
const fragen = (...antworten: boolean[]) => { const gestellt: string[] = []; return { ui: { bestaetigen: (t: string) => { gestellt.push(t); return antworten.shift() ?? false; } }, gestellt }; };

describe('vorAbmelden', () => {
  it('leere Warteschlange: keine Frage, IndexedDB und alle make-os-netzwerken-* weg, fremde Schlüssel bleiben', async () => {
    const q = new Warteschlange(ramSpeicher(), ok); const s = speicher(); const f = fragen();
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(true);
    expect(f.gestellt).toEqual([]);
    expect(s.geloescht).toEqual([DB_NAME]);
    expect(Array.from(s.keys)).toEqual(['make-karten-cache', 'anderes']); // die Karten räumt `karteCacheLeeren` (KontoView)
  });

  it('es warten Erfassungen: Warnung „Es warten noch n Erfassungen — erst senden?“; OK sendet und meldet ab, wenn alles raus ist', async () => {
    const q = new Warteschlange(ramSpeicher(), ok); const s = speicher(); const f = fragen(true);
    await q.ablegen(koerper('a'), anzeige, 1); await q.ablegen(koerper('b'), anzeige, 2);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(true);
    expect(f.gestellt).toEqual(['Es warten noch 2 Erfassungen — erst senden?']);
    expect(await q.alle()).toEqual([]);
    expect(s.geloescht).toEqual([DB_NAME]);
  });

  it('Singular: „Es wartet noch 1 Erfassung — erst senden?“', async () => {
    const q = new Warteschlange(ramSpeicher(), ok); const f = fragen(true);
    await q.ablegen(koerper('a'), anzeige, 1);
    await vorAbmelden('kevin', f.ui, q, speicher().z);
    expect(f.gestellt[0]).toBe('Es wartet noch 1 Erfassung — erst senden?');
  });

  it('Abbrechen bei der ersten Frage: nicht abgemeldet, nichts gelöscht, nichts gesendet', async () => {
    let aufrufe = 0;
    const q = new Warteschlange(ramSpeicher(), async () => { aufrufe++; return { status: 200, daten: { ok: true } }; }); const s = speicher(); const f = fragen(false);
    await q.ablegen(koerper('a'), anzeige, 1);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(false);
    expect(aufrufe).toBe(0);
    expect(s.geloescht).toEqual([]);
    expect((await q.alle())).toHaveLength(1);
  });

  it('Senden klappt nicht (kein Netz): zweite Frage mit klarer Warnung; „Trotzdem abmelden“ LÖSCHT die Erfassung vom Gerät samt Datenbank (03.10.)', async () => {
    const q = new Warteschlange(ramSpeicher(), netzweg); const s = speicher(); const f = fragen(true, true);
    await q.ablegen(koerper('a'), anzeige, 1);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(true);
    expect(f.gestellt[1]).toMatch(/1 Erfassung ließ sich nicht senden.*Trotzdem abmelden\? ACHTUNG: Sie wird dabei vom Gerät GELÖSCHT/);
    expect(await q.alle()).toEqual([]);                   // weg — kein Vorrat von Daten Dritter auf dem Gerät
    expect(s.geloescht).toEqual([DB_NAME]);               // Datenbank samt Schlüssel
    expect(s.keys.has('make-os-netzwerken-kontext')).toBe(false);
    expect(s.keys.has('make-os-netzwerken-event')).toBe(false);
  });

  it('… die Erfassung einer ANDEREN Person auf dem Gerät bleibt dabei liegen (Datenbank und Schlüssel bleiben für sie)', async () => {
    const q = new Warteschlange(ramSpeicher(), netzweg); const s = speicher(); const f = fragen(true, true);
    await q.ablegen(koerper('a'), anzeige, 1); await q.ablegen(koerper('m', 'malin'), anzeige, 2);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(true);
    expect((await q.alle()).map(e => e.id)).toEqual(['m']);
    expect(s.geloescht).toEqual([]);
    expect(s.keys.has('make-os-netzwerken-kontext')).toBe(false);
  });

  it('… und „Nein“ auf die zweite Frage: bleibt angemeldet', async () => {
    const q = new Warteschlange(ramSpeicher(), netzweg); const f = fragen(true, false); const s = speicher();
    await q.ablegen(koerper('a'), anzeige, 1);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(false);
    expect(s.geloescht).toEqual([]);
  });

  it('nur die eigenen Erfassungen zählen: liegt nur etwas von Malin auf dem Gerät, wird Kevin nicht gewarnt — und es bleibt liegen', async () => {
    const q = new Warteschlange(ramSpeicher(), ok); const s = speicher(); const f = fragen();
    await q.ablegen(koerper('m1', 'malin'), anzeige, 1);
    expect(offenFuer(await q.alle(), 'kevin')).toBe(0);
    expect(await vorAbmelden('kevin', f.ui, q, s.z)).toBe(true);
    expect(f.gestellt).toEqual([]);
    expect(s.geloescht).toEqual([]);
    expect(await q.alle()).toHaveLength(1);
  });

  it('ein Fehler-Eintrag zählt als „noch nicht gespeichert“ (nicht nur Wartende)', async () => {
    const q = new Warteschlange(ramSpeicher(), async () => ({ status: 400, daten: { ok: false, fehler: 'Nachname fehlt' } })); const f = fragen(true, false);
    await q.ablegen(koerper('f1'), anzeige, 1);
    await q.senden();
    expect(offenFuer(await q.alle(), 'kevin')).toBe(1);
    expect(await vorAbmelden('kevin', f.ui, q, speicher().z)).toBe(false);
    expect(f.gestellt[0]).toMatch(/noch 1 Erfassung/);
  });

  it('netzwerkenAufraeumen: nicht lesbare Warteschlange → lieber nichts löschen', async () => {
    const kaputt = new Warteschlange({ alle: async () => { throw new Error('IndexedDB weg'); }, setze: async () => {}, entferne: async () => {} }, ok); const s = speicher();
    expect((await netzwerkenAufraeumen(kaputt, s.z)).komplett).toBe(false);
    expect(s.geloescht).toEqual([]);
  });
});

describe('Zähler-Abzeichen', () => {
  it('Text: „2 warten“, sonst „1 Fehler“, sonst nichts; der Speicher meldet nur Änderungen', async () => {
    const { wartezahlText, wartezahlSetzen } = await import('@/lib/netzwerken/zaehler');
    expect(wartezahlText({ wartend: 2, fehler: 1 })).toBe('2 warten');
    expect(wartezahlText({ wartend: 0, fehler: 1 })).toBe('1 Fehler');
    expect(wartezahlText({ wartend: 0, fehler: 0 })).toBeNull();
    expect(() => wartezahlSetzen({ wartend: 0, fehler: 0 })).not.toThrow();
  });
  it('die Warteschlange meldet jede Änderung an Hörer (Sender → Abzeichen)', async () => {
    const q = new Warteschlange(ramSpeicher(), ok); let n = 0;
    const weg = q.beiAenderung(() => { n++; });
    await q.ablegen(koerper('a'), anzeige, 1);
    expect(n).toBeGreaterThan(0);
    const vorher = n; await q.senden();
    expect(n).toBeGreaterThan(vorher);
    weg(); const nach = n; await q.ablegen(koerper('b'), anzeige, 2);
    expect(n).toBe(nach);
  });
});
