// ─── Wächter: Funde aus dem Live-Rundgang mit dem Prüfmodell (09.10., „Agenten live durchgeklickt“) ─────────────────────────
// Kevin 09.10.: „Das muss perfekt laufen. Schau, dass alles verbunden ist und die Agents sauber laufen.“ Jeder Fund aus dem Klick-Rundgang
// (scripts/ki-pruefmodell.mjs + headless Chrome) bekommt hier einen Wächter:
//   (1) Vorschläge eines Werkzeugs (create_task …) tragen ihre Stapel-Kennung bis in den Thread — die Karte im Chat hatte sonst keine Knöpfe.
//   (2) ZOEs Antworten tragen ihre Kosten (Euro an der Antwort wie bei Heads).
//   (3) Ein nur eingereihter Lauf ist keine Rückfrage („⚑ … fragt“ unter „Wartet auf dich“).
//   (4) Ein fertig gewordener Lauf lädt die Seite neu (Bericht im offenen Thread ohne Neuladen).
//   (5) Freigaben nennen, was sie tun (nicht nur „Aufgabe anlegen“); deutsche Anführung, Priorität und Daten in der Vorschau.
//   (6) „2 Freigaben offen (2)“ → ohne doppelte Zahl.
//   (7) Thread löschen ist in der Oberfläche erreichbar (Head, Mitarbeiter, ZOE).
//   (8) Selbstbild ohne Doku-Wurzel ist „übersprungen“, kein Fehler (füllte sonst täglich Agenten › Fehler).
//   (9) Handy: die Plakette „… ist auch hier“ liegt nicht mehr auf dem Reiter „Gespräch“; das Feld ist unten deckend.
// Eigener Datenordner, erfundene Konten (`@example.invalid`), Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-live-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-live', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_PRUEFENDPUNKT;
  return o;
});
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import type { FadenKern } from '@/lib/agenten/faeden';
import { kontenSaeen, modellFake, rufe, sitzung, dienst, text, werkzeug, type ModellFake } from './fixtures/agenten-kern';
import { laufEingereiht, type FadenKurz } from '@/lib/agenten/typen';
import { kurz } from '@/lib/agenten/faeden';
import { fadenStatusName, laufBeendet, naechstesTitel, vorschlagDetail, wartendeFaeden } from '@/components/os/agenten/regeln';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let faden: { GET: H; POST: H };
let stapel: { GET: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');
const WURZEL = path.resolve(__dirname, '..');
const quelle = (p: string) => readFileSync(path.join(WURZEL, p), 'utf8');
const bestand = async (p: string) => (await db.loadJson<{ faeden: FadenKern[] }>(`agenten-faeden--${p}`))?.faeden ?? [];

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  stapel = (await import('@/app/api/zoe/stapel/route')) as unknown as typeof stapel;
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

describe('(1) Vorschlag im Chat findet seinen Stapel-Eintrag', () => {
  it('Head-Chat: create_task → Nachricht trägt vorschlagId = Kennung im Stapel der Person', async () => {
    m.antworten.push(werkzeug(['create_task', { title: 'Angebot Nordlicht nachfassen', priority: 'high' }]), text('Liegt als Vorschlag im Stapel.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Lege eine Aufgabe an: Angebot Nordlicht nachfassen' });
    expect(r.status).toBe(200);
    const f = (await bestand('person-a')).find(x => x.id === (r.d.faden as FadenKern).id)!;
    const w = f.nachrichten.at(-1)!.werkzeuge!.find(x => x.name === 'create_task')!;
    expect(w).toMatchObject({ ok: true, gestapelt: true, vorschlagId: expect.stringMatching(/^v-/) });
    const s = await rufe(stapel.GET, '/api/zoe/stapel', sitzung('person-a'));
    const v = (s.d.vorschlaege as { id: string; titel: string; nachher: string }[]).find(x => x.id === w.vorschlagId)!;
    expect(v).toBeDefined();
    // (5) Vorschau deutsch: Anführung „…“ und Priorität in Worten
    expect(v.nachher).toBe('„Angebot Nordlicht nachfassen“ (hoch)');
  });
  it('ZOE-Chat: create_task (Freigabe) → ZOE-Thread trägt vorschlagId; (2) die Antwort trägt ihre Kosten', async () => {
    m.antworten.push(werkzeug(['create_task', { title: 'Steuer-Unterlagen sortieren', wer: 'person-b' }]), text('Liegt im Stapel.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Gib person-b die Aufgabe: Steuer-Unterlagen sortieren.', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    const f = (await bestand('person-a')).find(x => x.id === r.d.fadenId)!;
    const antwort = f.nachrichten.at(-1)!;
    expect(antwort.kosten?.cent).toBeGreaterThan(0);
    const w = antwort.werkzeuge?.find(x => x.name === 'create_task');
    expect(w).toMatchObject({ gestapelt: true, vorschlagId: expect.stringMatching(/^v-/) });
  });
});

describe('(3) eingereiht ≠ wartet auf dich', () => {
  const basis = { id: 'fd-x', besitzer: 'p', agent: { art: 'mitarbeiter' as const, headId: 'sales', mitarbeiterId: 'sales-nachfassen' }, bereich: 'business' as const, titel: 'T', erstellt: 'a', aktualisiert: 'a', nachrichten: [], fremdGelesen: false, vertraulich: false, kette: [] } as unknown as FadenKern;
  it('nur eingereiht (kein Grund, keine Schritte, kein „wartet auf“) → eingereiht; sonst nicht', () => {
    const eingereiht = { ...basis, status: 'wartet', lauf: { status: 'wartet', schritte: [], start: 'a', kostenCent: 0, auftragId: 'a-1' } } as FadenKern;
    expect(laufEingereiht(eingereiht)).toBe(true);
    expect(kurz(eingereiht, 'p')).toMatchObject({ status: 'wartet', eingereiht: true });
    expect(laufEingereiht({ ...eingereiht, lauf: { ...eingereiht.lauf!, wartetAuf: 'plan' } })).toBe(false);
    expect(laufEingereiht({ ...eingereiht, lauf: { ...eingereiht.lauf!, fehler: 'wartet auf Antwort des Heads' } })).toBe(false);
    expect(laufEingereiht({ ...eingereiht, lauf: { ...eingereiht.lauf!, schritte: [{ runde: 1, werkzeuge: [], text: '' } as never] } })).toBe(false);
    expect(laufEingereiht({ ...eingereiht, status: 'laeuft', lauf: { ...eingereiht.lauf!, status: 'laeuft' } })).toBe(false);
    expect('eingereiht' in kurz({ ...eingereiht, lauf: { ...eingereiht.lauf!, wartetAuf: 'plan' } }, 'p')).toBe(false);
  });
  it('„Wartet auf dich“ zeigt eingereihte Läufe nicht; der Status heißt „eingereiht“', () => {
    const f = (id: string, extra: Partial<FadenKurz>): FadenKurz => ({ id, titel: id, agent: { art: 'head', headId: 'sales' }, status: 'wartet', aktualisiert: 'a', ...extra });
    expect(wartendeFaeden([f('a', { eingereiht: true }), f('b', {}), f('c', { status: 'fertig' })]).map(x => x.id)).toEqual(['b']);
    expect(fadenStatusName({ status: 'wartet', eingereiht: true })).toBe('eingereiht');
    expect(fadenStatusName({ status: 'wartet' })).toBe('wartet auf dich');
  });
  it('Route: ein frisch beauftragter Mitarbeiter-Thread kommt als „eingereiht“ in die Liste', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: { ziel: 'Angebote prüfen', format: 'kurz', grenzen: 'nichts senden', quellen: 'Pipeline' } }]), text('Ist beauftragt.'));
    await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Lass die Angebote prüfen.' });
    const liste = (await rufe(faden.GET, '/api/agenten/faden', sitzung('person-a'))).d.faeden as FadenKurz[];
    const kind = liste.find(x => x.agent.art === 'mitarbeiter' && x.agent.mitarbeiterId === 'sales-angebote')!;
    expect(kind).toMatchObject({ status: 'wartet', eingereiht: true });
    expect(wartendeFaeden(liste).map(x => x.id)).not.toContain(kind.id);
  });
});

describe('(4)(5)(6) reine Regeln der Seite', () => {
  it('laufBeendet: nur, wenn ein vorher laufender Lauf fehlt (nie beim ersten Abruf)', () => {
    expect(laufBeendet(null, [])).toBe(false);
    expect(laufBeendet([], ['a'])).toBe(false);
    expect(laufBeendet(['a'], ['a', 'b'])).toBe(false);
    expect(laufBeendet(['a', 'b'], ['b'])).toBe(true);
  });
  it('vorschlagDetail: nennt, was der Vorschlag tut — nichts Doppeltes, lange Texte gekürzt mit …', () => {
    expect(vorschlagDetail({ titel: 'Aufgabe anlegen', nachher: '„Angebot X nachfassen“ (hoch)' })).toBe('„Angebot X nachfassen“ (hoch)');
    expect(vorschlagDetail({ titel: 'Aufgabe anlegen' })).toBeNull();
    expect(vorschlagDetail({ titel: 'Gleich', nachher: ' Gleich ' })).toBeNull();
    expect(vorschlagDetail({ titel: 't', nachher: 'x'.repeat(300) })!.length).toBe(160);
  });
  it('naechstesTitel: keine doppelte Zahl', () => {
    expect(naechstesTitel({ titel: '2 Freigaben offen', anzahl: 2 })).toBe('2 Freigaben offen');
    expect(naechstesTitel({ titel: 'Leads prüfen', anzahl: 3 })).toBe('Leads prüfen (3)');
    expect(naechstesTitel({ titel: 'Wochenreview' })).toBe('Wochenreview');
  });
  it('Vorschau der Register-Werkzeuge: Daten deutsch, Anführung „…“ überall geschlossen', async () => {
    const { vorschauVon, tagDe, PRIO_NAME } = await import('@/lib/zoe/register');
    expect(tagDe('2026-10-10')).toBe('10.10.2026');
    expect(tagDe('morgen')).toBe('morgen');
    expect(PRIO_NAME.critical).toBe('kritisch');
    const v = await vorschauVon('create_task', { title: 'X', priority: 'critical' });
    expect(v.nachher).toBe('„X“ (kritisch)');
    // Keine Vorlage „„${…}"“ mit ASCII-Zeichen am Ende mehr im Register (Rundgang: halb deutsch, halb englisch angeführt).
    for (const d of ['lib/zoe/register.ts', 'lib/zoe/werkzeuge.ts']) expect(quelle(d), d).not.toMatch(/„\$\{[^`"\n]*?\}"/);
  });
});

describe('(4)(7)(9) Oberfläche verdrahtet', () => {
  it('AgentenSeite lädt neu, wenn ein Lauf fertig wird; Hintergrund zeigt Detail und Titel ohne doppelte Zahl', () => {
    const seite = quelle('components/os/agenten/AgentenSeite.tsx');
    expect(seite).toMatch(/laufBeendet\(laufendVorher\.current, jetzt\)\) meldeNeu\(\)/);
    const hg = quelle('components/os/agenten/Hintergrund.tsx');
    expect(hg).toContain('{naechstesTitel(n)}');
    expect(hg).toMatch(/const detail = vorschlagDetail\(v\)/);
    expect(hg).toMatch(/\{h \? h\.kurz : 'ZOE'\}/); // Freigaben ohne Head = ZOE-Stapel, beschriftet
  });
  it('Thread löschen: Head-Chat, Mitarbeiter-Thread und ZOE-Gespräch bieten es an — über EINEN Weg (daten.ts fadenLoeschen)', () => {
    expect(quelle('components/os/agenten/daten.ts')).toMatch(/aktion: 'loeschen', fadenId, stand/);
    for (const d of ['HeadMitte.tsx', 'FadenMitte.tsx', 'ZoeMitte.tsx']) expect(quelle(`components/os/agenten/${d}`), d).toMatch(/fadenLoeschen\(/);
  });
  it('ueberstand: misst am echten Feld (Handy: Feld höher) — > 0 heißt verdeckt', async () => {
    const { ueberstand } = await import('@/components/os/agenten/Chat');
    expect(ueberstand(470, 430, 844, 12)).toBe(52); // Handy-Fund aus dem Rundgang: Antwort 40 px unter der Feld-Oberkante
    expect(ueberstand(400, 430, 844, 12)).toBeLessThanOrEqual(0);
    expect(ueberstand(900, null, 844, 12)).toBe(68); // ohne Feld: Fensterrand
  });
  it('Chat: rückt die neue Nachricht in Sicht; das Feld ist unten deckend; Karte ohne Werkzeug-Namen als Text', () => {
    const chat = quelle('components/os/agenten/Chat.tsx');
    expect(chat).toMatch(/useZurNeuesten\(!!unten\)/);
    expect(chat).toMatch(/linear-gradient\(to top, \$\{C\.grund\} calc\(100% - /);
    expect(chat).not.toMatch(/Ein Vorschlag \(\$\{werkzeug\}\)/);
  });
  it('Handy: „… ist auch hier“ verdeckt den Reiter „Gespräch“ nicht', () => {
    expect(quelle('app/globals.css')).toMatch(/body:has\(\.agenten-reiter-handy\) \.os-mitarbeit \{ display: none !important; \}/);
  });
});

describe('(10) Geplant ohne Hintergrund-KI', () => {
  it('GET /api/agenten/laeufe sagt, ob die Hintergrund-KI an ist; die Oberfläche warnt bei „aus“', async () => {
    const laeufe = (await import('@/app/api/agenten/laeufe/route')) as unknown as { GET: H };
    const ke = await import('@/lib/datenschutz/ki-einstellungen');
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), hintergrund: true } }));
    expect((await rufe(laeufe.GET, '/api/agenten/laeufe', sitzung('person-a'))).d.hintergrundKi).toBe(true);
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), hintergrund: false } }));
    expect((await rufe(laeufe.GET, '/api/agenten/laeufe', sitzung('person-a'))).d.hintergrundKi).toBe(false);
    const dlg = quelle('components/os/agenten/Dialoge.tsx');
    expect(dlg).toMatch(/function HintergrundKiAus/);
    expect((dlg.match(/<HintergrundKiAus an=/g) ?? []).length).toBe(2); // Fenster „Geplant“ und „Neue Hintergrundaufgabe“ (geplant)
    expect(dlg).not.toMatch(/zuletzt \$\{p\.letzterLauf\.slice\(0, 10\)\}/); // kein ISO-Datum mehr
  });
});

describe('(8) Selbstbild ohne Doku-Wurzel', () => {
  it('POST antwortet ok + „übersprungen“ (kein Fehler, nichts geschrieben); der Lauf meldet „übersprungen“', async () => {
    const route = (await import('@/app/api/zoe/selbstbild/route')) as unknown as { POST: H };
    const r = await rufe(route.POST, '/api/zoe/selbstbild', dienst(), {});
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, geschrieben: 0, uebersprungen: expect.stringContaining('Doku-Wurzel') });
    expect(quelle('lib/zoe/agenten.ts')).toMatch(/if \(d\.uebersprungen\) return gut\(/);
  });
});
