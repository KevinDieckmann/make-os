// ─── Netzwerken — Nachbesserung nach der Prüfung (03.10., Branch netz-fix2), rein ──────────────
// Speicher-Ausfall der Warteschlange, Magic Bytes, Kontakt-Kennung, Art. 18 bei Dublette, Netzwerken-Events in den Heads.
// Keine Platte, kein Netz, erfundene Personen (@example.invalid).
import { describe, it, expect } from 'vitest';
import { Warteschlange, ausfallsicher, ramSpeicher, NUR_RAM_HINWEIS, type WarteSpeicher, type WarteEintrag, type Sender } from '@/lib/netzwerken/warteschlange';
import { erfassungPruefen, bildInhaltsTyp, kopfBytes, trifftEingeschraenkte } from '@/lib/crm/netzwerken';
import { istKontaktKennung, istAlteKontaktKennung, neueKontaktKennung } from '@/lib/kennung';
import { faelligeModi } from '@/lib/heads/takt';
import { datenpaket } from '@/lib/heads/daten';
import { leererStand } from '@/lib/heads/stand';
import { leererBestand } from '@/lib/crm/speicher';
import type { Kontakt } from '@/lib/make-one/crm';

const ID = '3f2b9c1e-1a2b-4c3d-8e4f-0123456789ab';
// Ein strukturell gültiges Mini-JPEG (JFIF + Scan + Ende) — der Server säubert Metadaten (netz-recht) und lehnt kaputte Aufbauten ab.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]).toString('base64');
const jetzt = new Date('2026-10-02T09:00:00+02:00');
const roh = (x: Record<string, unknown> = {}) => ({ erfassungId: ID, erfasstAm: jetzt.toISOString(), eventId: 'ev-test-1', kontakt: { vorname: 'Anna', nachname: 'Beispiel' }, bilder: [], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x });
const pruefen = (x?: Record<string, unknown>) => erfassungPruefen(roh(x), { jetzt, heute: '2026-10-02' });
const anzeige = { name: 'Anna Beispiel', schritt: 'Nur Kontakt', eventTitel: 'Stammtisch' };
const kopf = (n: number) => ({ erfassungId: `3f2b9c1e-1a2b-4c3d-8e4f-0123456789a${n}`, erfasstVon: 'kevin' });
const ok: Sender = async () => ({ status: 200, daten: { ok: true } });

/** Ein Speicher, der wie ein kaputtes IndexedDB reagiert (privates Fenster, Platte voll, Safari-Fehler). */
const kaputt = (was: { alle?: boolean; setze?: boolean; entferne?: boolean }): WarteSpeicher => ({
  alle: async () => { if (was.alle) throw new Error('IndexedDB weg'); return []; },
  setze: async () => { if (was.setze) throw new Error('QuotaExceededError'); },
  entferne: async () => { if (was.entferne) throw new Error('IndexedDB weg'); },
});

describe('IndexedDB fällt aus: Rückfall auf den Arbeitsspeicher und trotzdem senden', () => {
  it('Schreiben scheitert: die Erfassung wird abgelegt (kein Wurf), gesendet, und die Oberfläche weiß, dass nur der Arbeitsspeicher hält', async () => {
    const gesendet: unknown[] = [];
    const q = new Warteschlange(ausfallsicher(kaputt({ alle: true, setze: true, entferne: true })), async k => { gesendet.push(k); return ok(k); });
    expect(q.nurImArbeitsspeicher()).toBe(false);
    const e = await q.ablegen({ ...kopf(1) }, anzeige);   // ohne Rückfall: wirft QuotaExceededError → „Speichern hat nicht geklappt“
    expect(e.id).toBe(kopf(1).erfassungId);
    expect(q.nurImArbeitsspeicher()).toBe(true);
    expect((await q.alle()).map(x => x.id)).toEqual([kopf(1).erfassungId]);
    const r = await q.senden();
    expect(gesendet).toHaveLength(1);
    expect(r.gesendet).toHaveLength(1);
    expect(await q.alle()).toEqual([]);
    expect(q.nurImArbeitsspeicher()).toBe(false);   // nichts mehr, das nur im Arbeitsspeicher liegt
  });

  it('ohne Netz bleibt sie im Arbeitsspeicher liegen (mit Hinweis) und geht beim Wiederkehren des Netzes raus — nie doppelt', async () => {
    let netz = false; const n: unknown[] = [];
    const q = new Warteschlange(ausfallsicher(kaputt({ setze: true })), async k => { n.push(k); return netz ? ok(k) : { status: 0, daten: null }; });
    await q.ablegen({ ...kopf(2) }, anzeige);
    await q.senden();
    const l = await q.alle();
    expect(l).toHaveLength(1);
    expect(l[0].status).toBe('wartet');
    expect(q.nurImArbeitsspeicher()).toBe(true);
    expect(NUR_RAM_HINWEIS).toMatch(/Bitte Seite offen lassen, bis gesendet/);
    netz = true;
    await q.senden();
    expect(await q.alle()).toEqual([]);
    expect(n).toHaveLength(2);   // ein Fehlversuch + ein Erfolg
  });

  it('Lesen scheitert (IndexedDB.open wirft): alle() liefert, was im Arbeitsspeicher liegt, statt zu werfen', async () => {
    const s = ausfallsicher(kaputt({ alle: true, setze: true }));
    expect(await s.alle()).toEqual([]);   // wirft nicht
    expect(s.imArbeitsspeicher?.()).toBe(false);   // nichts liegt nur im Arbeitsspeicher
    await s.setze({ id: 'x', angelegt: 1, versuche: 0, status: 'wartet', koerper: {}, anzeige } as WarteEintrag);
    expect((await s.alle()).map(e => e.id)).toEqual(['x']);
    expect(s.imArbeitsspeicher?.()).toBe(true);
  });

  it('Browser ohne IndexedDB (primär = null): alles läuft im Arbeitsspeicher, Hinweis gilt sofort', async () => {
    const q = new Warteschlange(ausfallsicher(null), async () => ({ status: 0, daten: null }));
    expect(q.nurImArbeitsspeicher()).toBe(false);   // noch nichts abgelegt
    await q.ablegen({ ...kopf(3) }, anzeige);
    expect(q.nurImArbeitsspeicher()).toBe(true);
    await q.senden();
    expect(q.nurImArbeitsspeicher()).toBe(true);   // liegt noch (kein Netz)
    expect((await q.alle())).toHaveLength(1);
  });

  it('gesunder Speicher: kein Hinweis, Einträge liegen im primären Speicher; Statuswechsel (Fehler) bleiben erhalten', async () => {
    const prim = ramSpeicher();
    const q = new Warteschlange(ausfallsicher(prim), async () => ({ status: 400, daten: { ok: false, fehler: 'Nein.' } }));
    await q.ablegen({ ...kopf(4) }, anzeige);
    expect(q.nurImArbeitsspeicher()).toBe(false);
    expect(await prim.alle()).toHaveLength(1);
    await q.senden();
    expect((await q.alle())[0]).toMatchObject({ status: 'fehler', hinweis: 'Nein.' });
    expect(q.nurImArbeitsspeicher()).toBe(false);
  });

  it('Speicher fällt NACH dem Ablegen aus (Statuswechsel scheitert): der neuere Stand im Arbeitsspeicher gewinnt, nichts geht verloren', async () => {
    let kaputtAb = false;
    const prim = ramSpeicher();
    const wackelig: WarteSpeicher = { alle: () => prim.alle(), entferne: id => prim.entferne(id), setze: async e => { if (kaputtAb) throw new Error('voll'); await prim.setze(e); } };
    const q = new Warteschlange(ausfallsicher(wackelig), async () => ({ status: 0, daten: null }));
    await q.ablegen({ ...kopf(5) }, anzeige);
    kaputtAb = true;
    await q.senden();   // Netzfehler: der Eintrag bekommt versuche+1 — Schreiben scheitert, Rückfall
    const l = await q.alle();
    expect(l).toHaveLength(1);
    expect(l[0].versuche).toBe(1);
    expect(q.nurImArbeitsspeicher()).toBe(true);
  });
});

describe('Magic Bytes in der Eingabeprüfung', () => {
  const b64 = (b: number[]) => Buffer.from(b).toString('base64');
  it('erkennt JPEG, PNG, WebP, HEIC am Inhalt; alles andere null', () => {
    expect(bildInhaltsTyp(kopfBytes(JPEG))).toBe('jpeg');
    expect(bildInhaltsTyp(kopfBytes(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])))).toBe('png');
    expect(bildInhaltsTyp(kopfBytes(Buffer.from('RIFF\0\0\0\0WEBPVP8 ').toString('base64')))).toBe('webp');
    expect(bildInhaltsTyp(kopfBytes(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(4)]).toString('base64')))).toBe('heic');
    expect(bildInhaltsTyp(kopfBytes(Buffer.from('GIF89a').toString('base64')))).toBeNull();
    expect(bildInhaltsTyp(kopfBytes(''))).toBeNull();
    expect(bildInhaltsTyp(kopfBytes('@@@@'))).toBeNull();
  });
  it('Foto: Typangabe allein genügt nicht → 415 mit Klartext; echtes JPEG/PNG geht', () => {
    const falsch = pruefen({ bilder: [{ name: 'x.jpg', typ: 'image/jpeg', daten: Buffer.from('<svg onload=alert(1)>').toString('base64') }] });
    expect(falsch).toMatchObject({ ok: false, status: 415 });
    const heic = pruefen({ bilder: [{ name: 'x.jpg', typ: 'image/jpeg', daten: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(8)]).toString('base64') }] });
    expect(heic).toMatchObject({ ok: false, status: 415 });
    if (!heic.ok) expect(heic.fehler).toMatch(/HEIC.*JPEG/);
    expect(pruefen({ bilder: [{ name: 'a.jpg', typ: 'image/jpeg', daten: JPEG }] }).ok).toBe(true);
  });
  it('Sprachnotiz: Inhalt zählt (WebM, MP4, Ogg, WAV, MP3); „audio/webm“ mit HTML-Inhalt → 415', () => {
    const ok = (bytes: number[]) => pruefen({ sprachnotiz: { typ: 'audio/webm', daten: b64(bytes) } }).ok;
    expect(ok([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])).toBe(true);
    expect(ok([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])).toBe(true);
    expect(ok([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0])).toBe(true);
    expect(ok([0x49, 0x44, 0x33, 3, 0, 0, 0, 0])).toBe(true);
    expect(pruefen({ sprachnotiz: { typ: 'audio/webm', daten: Buffer.from('<html>nein</html>').toString('base64') } })).toMatchObject({ ok: false, status: 415 });
  });
});

describe('Kontakt-Kennung wie in der Kartei', () => {
  it('neu (c-<uuid>) und alt (c-<Mail-Slug>-<Hash>, bis 64 Zeichen) gelten; Großbuchstaben, Sonderzeichen, Überlänge nicht', () => {
    expect(istKontaktKennung(neueKontaktKennung())).toBe(true);
    const lang = `c-${'a'.repeat(62)}`;
    expect(lang).toHaveLength(64);
    expect(istAlteKontaktKennung(lang)).toBe(true);
    expect(istKontaktKennung(lang)).toBe(true);
    for (const falsch of [`c-${'a'.repeat(63)}`, 'c-ABC', 'c-a@b.de', 'x-123', 'c-', '', 'c-a b']) expect(istKontaktKennung(falsch), falsch).toBe(false);
  });
  it('erfassungPruefen nimmt eine lange Alt-Kennung als vorhandenKontaktId an (vorher: „Die gewählte Person ist ungültig“)', () => {
    const alt = `c-${'anna-beispiel-example-invalid-beispielwerk-nord-gmbh-0a1b2c3d4e5f'.slice(0, 62)}`;
    expect(pruefen({ vorhandenKontaktId: alt }).ok).toBe(true);
    expect(pruefen({ vorhandenKontaktId: `${alt}x` }).ok).toBe(false);
    expect(pruefen({ vorhandenKontaktId: neueKontaktKennung() }).ok).toBe(true);
  });
});

describe('Art. 18: trifft die Erfassung eine eingeschränkte Person?', () => {
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);
  const gesperrt = { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' };
  const e = { kontakt: { vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', telefon: '+49 30 1234567' } };
  it('Mail oder Nummer + Nachname trifft; Name allein, andere Mail, nicht eingeschränkt und die eigene Kennung nicht', () => {
    expect(trifftEingeschraenkte(e, [k('c-a', { email: 'anna@example.invalid', eingeschraenkt: gesperrt })], 'c-neu')).toBe(true);
    expect(trifftEingeschraenkte(e, [k('c-a', { telefon: '+49 30 1234567', eingeschraenkt: gesperrt })], 'c-neu')).toBe(true);
    expect(trifftEingeschraenkte(e, [k('c-a', { telefon: '+49 30 1234567', nachname: 'Zentrale', eingeschraenkt: gesperrt })], 'c-neu')).toBe(false);
    expect(trifftEingeschraenkte(e, [k('c-a', { eingeschraenkt: gesperrt })], 'c-neu')).toBe(false);   // nur Name: höchstens „vermutlich“, kein Treffer
    expect(trifftEingeschraenkte(e, [k('c-a', { email: 'andere@example.invalid', eingeschraenkt: gesperrt })], 'c-neu')).toBe(false);
    expect(trifftEingeschraenkte(e, [k('c-a', { email: 'anna@example.invalid' })], 'c-neu')).toBe(false);
    expect(trifftEingeschraenkte(e, [k('c-neu', { email: 'anna@example.invalid', eingeschraenkt: gesperrt })], 'c-neu')).toBe(false);
    expect(trifftEingeschraenkte(e, [], 'c-neu')).toBe(false);
  });
});

describe('Heads sehen keine Netzwerken-Events', () => {
  const HEUTE = '2026-09-24';
  const ev = (id: string, x: Record<string, unknown> = {}) => ({ id, titel: id, format: 'stammtisch', ziel: 'Gespräche', datum: '2026-09-23', status: 'durchgefuehrt', geaendert: '2026-09-01', ...x }) as unknown as import('@/lib/crm/typen').Event;
  it('Takt: ein gestriges Netzwerken-Event löst kein „Nachfassen“ und kein Countdown aus; ein Make.One-Event schon', () => {
    const donnerstag = new Date(2026, 8, 24, 9);
    expect(faelligeModi('event', donnerstag, leererStand(), [{ datum: '2026-09-23', status: 'durchgefuehrt', marke: 'Netzwerken' }])).toEqual([]);
    expect(faelligeModi('event', donnerstag, leererStand(), [{ datum: '2026-09-27', status: 'geplant', marke: 'Netzwerken' }])).toEqual([]);
    expect(faelligeModi('event', donnerstag, leererStand(), [{ datum: '2026-09-23', status: 'durchgefuehrt', marke: 'Make.One' }])[0].modus).toBe('nachfassen');
    expect(faelligeModi('event', donnerstag, leererStand(), [{ datum: '2026-09-23', status: 'durchgefuehrt' }])[0].modus).toBe('nachfassen');
  });
  it('Datenpaket Head Event: Events, nächstes Event und Gästevorschläge ohne Netzwerken-Events; Head Marketing: anstehende_events ebenso', () => {
    const crm = { ...leererBestand(), events: [ev('ev-fremd', { marke: 'Netzwerken', datum: '2026-09-25', status: 'geplant' }), ev('ev-eigen', { datum: '2026-10-05', status: 'geplant' })] };
    const d = datenpaket('event', 'planung', [], crm, HEUTE, 'kevin', []) as unknown as { events: { id: string }[]; naechstes_event: string | null };
    expect(d.events.map(x => x.id)).toEqual(['ev-eigen']);
    expect(d.naechstes_event).toBe('ev-eigen');
    expect(JSON.stringify(d)).not.toContain('ev-fremd');
    const m = datenpaket('marketing', 'wochenplan', [], crm, HEUTE, 'kevin', []) as unknown as { anstehende_events: { id: string }[] };
    expect(m.anstehende_events.map(x => x.id)).toEqual(['ev-eigen']);
  });
});
