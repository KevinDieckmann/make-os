// ─── Markttraktion · Playbooks und Event-Vorlagen bearbeitbar (Restpunkte 24.10.) ───────────────────────────────────────────────────────────────────────────
// Kevin 22.10.: „alles muss anpassbar sein und es muss auch immer mal wieder zu bearbeiten sein.“ Rein: ohne Bestand sind es GENAU die Vorgaben (dieselben
// Objekte); Abweichungen wirken, „Zurück auf Standard“ nimmt sie heraus; Rechtshinweis, Filter, Zuständigkeit und der Kanal des Vernetzen-Playbooks sind nie
// bearbeitbar; eigene Kopien tragen ihre Basis (Recht, Welt). Route: Stand/409, ungültig 400, zu groß 413, Dienstweg 403, anderer Haushalt bekommt nichts;
// die Leser (Kampagnen planen, Heads-Paket, Stellschrauben) sehen die Anpassung. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { PLAYBOOKS, planen, zielgruppe } from '@/lib/crm/kampagnen';
import { VORLAGEN, vorlageAnwenden } from '@/lib/crm/eventplanung';
import { weltDerKampagne } from '@/lib/crm/kampagnen-welt';
import { playbooksAus, eventVorlagenAus, vorlagenAendern, bestandAus, type AendernKontext } from '@/lib/crm/vorlagen-anpassung';
import { leererBestand, playbookHinweise, basisVon, KANAL_RECHT, VORLAGEN_GRENZEN, type PlaybookBestand, type EventVorlagenBestand } from '@/lib/crm/vorlagen-regeln';
import { datenpaket } from '@/lib/heads/daten';
import { leererBestand as leererCrm } from '@/lib/crm/speicher';
import type { Event } from '@/lib/crm/typen';

// Datenordner VOR allen Imports (die Leser ziehen die Datenschicht mit).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-crm-vorlagen-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-crm-vorlagen', MAKE_OS_OHNE_APPLE: '1' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return o;
});

let n = 0;
const ctx: AendernKontext = { zufall: () => (++n).toString(16).padStart(8, 'a'), neueId: p => `${p}-neu${++n}` };
const pb = (id: string) => PLAYBOOKS.find(p => p.id === id)!;
const pbLeer = (): PlaybookBestand => leererBestand();
const evLeer = (): EventVorlagenBestand => leererBestand();
const ok = <B,>(r: { ok: boolean }) => { expect(r.ok, JSON.stringify(r)).toBe(true); return r as unknown as { ok: true; bestand: B; id: string; geaendert: boolean }; };

describe('Zusammensetzen (rein): ohne Bestand genau die Vorgaben', () => {
  it('bit-gleich: dieselben Objekte, auch nach dem Säubern eines leeren oder kaputten Bestands', () => {
    expect(playbooksAus(null)).toBe(PLAYBOOKS);
    expect(playbooksAus(pbLeer())).toBe(PLAYBOOKS);
    expect(playbooksAus(bestandAus('playbook', { geaendert: { gibtsnicht: { name: 'x' } }, eigene: [{ id: 'pb-x-00000000', basis: 'gibtsnicht' }] }))).toBe(PLAYBOOKS);
    expect(eventVorlagenAus(null)).toBe(VORLAGEN);
    expect(eventVorlagenAus(bestandAus('event', 'kaputt'))).toBe(VORLAGEN);
  });
});

describe('Playbooks ändern (rein)', () => {
  it('Abweichung wirkt, Recht bleibt fest; gleich der Vorgabe = keine Abweichung; Zurück auf Standard', () => {
    const r = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'reaktivierung', vorlage: { name: 'Wieder ins Gespräch', schritte: [{ text: 'Anlass notieren', tag: 0 }, { text: 'Anrufen', tag: 3 }] } }, ctx));
    expect(r.bestand.geaendert.reaktivierung).toEqual({ name: 'Wieder ins Gespräch', schritte: [{ text: 'Anlass notieren', tag: 0 }, { text: 'Anrufen', tag: 3 }] });
    const p = playbooksAus(r.bestand).find(x => x.id === 'reaktivierung')!;
    expect(p).toMatchObject({ name: 'Wieder ins Gespräch', angepasst: true, recht: pb('reaktivierung').recht, zielgruppe: pb('reaktivierung').zielgruppe, fuer: pb('reaktivierung').fuer });
    // Unverändert gespeichert (alle Felder wie die Vorgabe) → keine Abweichung.
    const v = pb('upsell');
    const gleich = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'upsell', vorlage: { name: v.name, kurz: v.kurz, warum: v.warum, kennzahl: v.kennzahl, kanal: v.kanal, segmentId: null, schritte: v.schritte } }, ctx));
    expect(gleich.geaendert).toBe(false);
    expect(gleich.bestand.geaendert).toEqual({});
    const zurueck = ok<PlaybookBestand>(vorlagenAendern('playbook', r.bestand, { op: 'standard', id: 'reaktivierung' }, ctx));
    expect(playbooksAus(zurueck.bestand)).toBe(PLAYBOOKS);
  });
  it('Gesetzlich Festes nie bearbeitbar: Recht/Filter/Zuständigkeit 400, Vernetzen-Kanal 400; anderer Kanal hängt den festen Satz an', () => {
    for (const feld of ['recht', 'zusatz', 'fuer', 'zielgruppe', 'id']) {
      const r = vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'empfehlung', vorlage: { [feld]: 'frei erfunden' } }, ctx);
      expect(r, feld).toMatchObject({ ok: false, status: 400 });
    }
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'vernetzen', vorlage: { kanal: 'mail' } }, ctx)).toMatchObject({ ok: false, status: 400 });
    const r = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'fallstudie', vorlage: { kanal: 'mail' } }, ctx));
    const p = playbooksAus(r.bestand).find(x => x.id === 'fallstudie')!;
    expect(p.recht.startsWith(pb('fallstudie').recht)).toBe(true);
    expect(p.recht).toContain(KANAL_RECHT.mail);
  });
  it('Grenzen: zu lang 413, zu viele Schritte 413, kaputte Schritte 400 — nie gekürzt', () => {
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'empfehlung', vorlage: { warum: 'x'.repeat(VORLAGEN_GRENZEN.warum + 1) } }, ctx)).toMatchObject({ ok: false, status: 413 });
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'empfehlung', vorlage: { schritte: Array.from({ length: 21 }, (_, i) => ({ text: 's', tag: i })) } }, ctx)).toMatchObject({ ok: false, status: 413 });
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'empfehlung', vorlage: { schritte: [{ text: 's', tag: -1 }] } }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'gibtsnicht', vorlage: {} }, ctx)).toMatchObject({ ok: false, status: 404 });
  });
  it('Kopieren: eigene Kennung ≤ 40 Zeichen mit Basis, Recht und Welt der Basis; Vernetzen nie kopierbar; eigene löschen, Vorgaben nicht', () => {
    const k = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'kopieren', id: 'reaktivierung' }, ctx));
    expect(k.id).toMatch(/^pb-reaktivierung-[0-9a-f]{8}$/);
    expect(k.id.length).toBeLessThanOrEqual(40);
    expect(basisVon('playbook', k.id)).toBe('reaktivierung');
    const eigen = playbooksAus(k.bestand).find(x => x.id === k.id)!;
    expect(eigen).toMatchObject({ eigen: true, basis: 'reaktivierung', name: `${pb('reaktivierung').name} (Kopie)`, recht: pb('reaktivierung').recht });
    expect(weltDerKampagne({ playbook: k.id })).toBe('sales');
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'kopieren', id: 'vernetzen' }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('playbook', k.bestand, { op: 'loeschen', id: 'reaktivierung' }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('playbook', k.bestand, { op: 'standard', id: k.id }, ctx)).toMatchObject({ ok: false, status: 400 });
    const weg = ok<PlaybookBestand>(vorlagenAendern('playbook', k.bestand, { op: 'loeschen', id: k.id }, ctx));
    expect(weg.bestand.eigene).toEqual([]);
    let voll = pbLeer();
    for (let i = 0; i < VORLAGEN_GRENZEN.eigene; i++) voll = ok<PlaybookBestand>(vorlagenAendern('playbook', voll, { op: 'kopieren', id: 'upsell' }, ctx)).bestand;
    expect(vorlagenAendern('playbook', voll, { op: 'kopieren', id: 'upsell' }, ctx)).toMatchObject({ ok: false, status: 413 });
  });
  it('Segment-Vorschlag: nur ein gespeichertes Segment; die Zielgruppe und die Kampagne nehmen es', () => {
    expect(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'reaktivierung', vorlage: { segmentId: 'seg-weg' } }, { ...ctx, segmente: new Set(['seg-a']) })).toMatchObject({ ok: false, status: 400 });
    const r = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'speichern', id: 'reaktivierung', vorlage: { segmentId: 'seg-a' } }, { ...ctx, segmente: new Set(['seg-a']) }));
    const p = playbooksAus(r.bestand).find(x => x.id === 'reaktivierung')!;
    expect(p.segmentId).toBe('seg-a');
    const crm = { ...leererCrm(), segmente: [{ id: 'seg-a', name: 'A', kriterien: { stadt: 'Musterstadt' }, geaendert: '2026-10-01' }] };
    const kontakte = [{ id: 'c-1', vorname: 'Ada', nachname: 'Probe', firmaStadt: 'Musterstadt', kreis: 'D' }, { id: 'c-2', vorname: 'Bo', nachname: 'Probe', firmaStadt: 'Anderswo', kreis: 'A' }] as unknown as Parameters<typeof zielgruppe>[0];
    expect(zielgruppe(kontakte, crm, p, '2026-10-24').map(k => k.id)).toEqual(['c-1']);
    expect(planen(p, kontakte, crm, '2026-10-24', 'kp-x')).toMatchObject({ segmentId: 'seg-a', zielgruppe: { stadt: 'Musterstadt' } });
    // Gelöschtes Segment gilt nicht — wieder die Vorgabe (ohne segmentId an der Kampagne).
    const ohne = planen(p, kontakte, { ...crm, segmente: [] }, '2026-10-24', 'kp-y');
    expect(ohne.segmentId).toBeUndefined();
    expect(ohne.zielgruppe).toEqual(pb('reaktivierung').zielgruppe);
  });
  it('UWG-Hinweis über eigene Texte: werbliche Wörter in Mail/LinkedIn deutlich, sonst leise; ohne Wörter keiner', () => {
    const p = pb('lookalike');
    expect(playbookHinweise(p)).toEqual([]);
    expect(playbookHinweise({ ...p, warum: 'Mit Rabatt und Einladung zum Webinar.' })[0]).toMatch(/LinkedIn.*§ 7 UWG/);
    expect(playbookHinweise({ ...p, kanal: 'persoenlich', warum: 'Ein Gutschein.' })[0]).toMatch(/§ 7 UWG/);
  });
  it('Heads-Paket: mit den Playbooks des Haushalts (eigene stehen drin), ohne Angabe die Vorgaben', () => {
    const k = ok<PlaybookBestand>(vorlagenAendern('playbook', pbLeer(), { op: 'kopieren', id: 'upsell', name: 'Upsell Probe' }, ctx));
    const mit = datenpaket('sales', 'kampagne', [], leererCrm(), '2026-10-24', 'pia', [], { playbooks: playbooksAus(k.bestand) }) as unknown as { playbooks: { id: string; name: string }[] };
    expect(mit.playbooks.find(x => x.id === k.id)?.name).toBe('Upsell Probe');
    const ohne = datenpaket('sales', 'kampagne', [], leererCrm(), '2026-10-24', 'pia', []) as unknown as { playbooks: { id: string }[] };
    expect(ohne.playbooks.map(x => x.id)).toEqual(PLAYBOOKS.filter(x => x.fuer.includes('head-sales')).map(x => x.id));
  });
});

describe('Event-Vorlagen ändern (rein)', () => {
  it('Checkliste bearbeiten: Kennungen bleiben, neue bekommen eine; die eigene Vorlage wirkt beim Anwenden', () => {
    const v = VORLAGEN.find(x => x.id === 'dinner')!;
    const neu = [...v.checkliste.map(c => (c.id === 'menue' ? { ...c, text: 'Menü und Weinbegleitung festlegen' } : c)), { text: 'Platzkarten drucken', tageVorher: 2 }];
    const r = ok<EventVorlagenBestand>(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'dinner', vorlage: { checkliste: neu } }, ctx));
    const d = eventVorlagenAus(r.bestand).find(x => x.id === 'dinner')!;
    expect(d.angepasst).toBe(true);
    expect(d.checkliste.find(c => c.id === 'menue')!.text).toBe('Menü und Weinbegleitung festlegen');
    expect(d.checkliste.find(c => c.text === 'Platzkarten drucken')!.id).toMatch(/^pk-/);
    expect(d.format).toBe('dinner');
    const k = ok<EventVorlagenBestand>(vorlagenAendern('event', r.bestand, { op: 'kopieren', id: 'dinner', name: 'Kleines Dinner' }, ctx));
    expect(k.id).toMatch(/^evv-dinner-[0-9a-f]{8}$/);
    const alle = eventVorlagenAus(k.bestand);
    const ev: Event = { id: 'ev-1', titel: 'Abend', format: 'sonstig', ziel: '', datum: '2026-12-01', status: 'idee', geaendert: '2026-10-24' } as Event;
    const angewandt = vorlageAnwenden(ev, k.id, alle);
    expect(angewandt).toMatchObject({ vorlage: k.id, format: 'dinner' });
    expect(angewandt.checkliste!.some(c => c.text === 'Platzkarten drucken')).toBe(true);
    // Ohne Liste wie bisher die Vorgaben: eine eigene Kennung kennt der Code nicht.
    expect(vorlageAnwenden(ev, k.id)).toBe(ev);
  });
  it('Prüfung: Mischung über 100 %, falsche Uhrzeit, doppelte Punkte 400; zu viele Punkte 413', () => {
    expect(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'webinar', vorlage: { mixZiel: { zielkunden: 80, kunden: 30 } } }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'webinar', vorlage: { uhrzeit: '25:00' } }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'webinar', vorlage: { budget: [{ id: 'b-x', posten: 'A' }, { id: 'b-x', posten: 'B' }] } }, ctx)).toMatchObject({ ok: false, status: 400 });
    expect(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'webinar', vorlage: { checkliste: Array.from({ length: 41 }, (_, i) => ({ text: `P${i}`, tageVorher: 1 })) } }, ctx)).toMatchObject({ ok: false, status: 413 });
    expect(vorlagenAendern('event', evLeer(), { op: 'speichern', id: 'webinar', vorlage: { format: 'dinner' } }, ctx)).toMatchObject({ ok: false, status: 400 });
  });
});

// ── Route ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json', ...(person ? { 'x-make-person': person } : {}) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
async function lesen(art: string, kopf: Record<string, string> = sitzung('pia')): Promise<{ status: number; j: J }> {
  const { GET } = await import('@/app/api/crm/vorlagen/route');
  const r = await GET(new Request(`http://test/api/crm/vorlagen?art=${art}`, { headers: kopf }));
  return { status: r.status, j: await r.json() };
}
async function schreiben(body: J, kopf: Record<string, string> = sitzung('pia')): Promise<{ status: number; j: J }> {
  const { POST } = await import('@/app/api/crm/vorlagen/route');
  const r = await POST(new Request('http://test/api/crm/vorlagen', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() };
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-vo' }),
    konto('k2', 'mira', 'mitglied', { haushalt: 'haus-vo', finanzRecht: 'business' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
  // Ein ANDERER Haushalt mit eigener Anpassung — darf nie in diesem Haushalt erscheinen.
  await db.saveJson('kampagnen-vorlagen--anderer-haus', { v: 1, geaendert: { empfehlung: { name: 'Fremde Fassung' } }, eigene: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route /api/crm/vorlagen', () => {
  it('ohne Bestand genau die Vorgaben; anderer Haushalt bekommt nichts; Dienstweg schreibt nie', async () => {
    const g = await lesen('playbook');
    expect(g.status).toBe(200);
    expect(JSON.stringify(g.j.vorlagen)).toBe(JSON.stringify(PLAYBOOKS));
    expect(g.j.vorlagen.some((p: J) => p.name === 'Fremde Fassung')).toBe(false);
    const { playbooksDesHaushalts, playbooksFuer } = await import('@/lib/crm/vorlagen-anpassung-server');
    expect((await playbooksDesHaushalts()).some(p => p.name === 'Fremde Fassung')).toBe(false);
    expect((await playbooksFuer('anderer-haus')).find(p => p.id === 'empfehlung')!.name).toBe('Fremde Fassung');
    expect((await lesen('playbook', sitzung('gast'))).status).toBe(403);
    expect((await lesen('nichts')).status).toBe(400);
    expect((await schreiben({ art: 'playbook', stand: g.j.stand, op: 'speichern', id: 'empfehlung', vorlage: { name: 'X' } }, dienst('pia'))).status).toBe(403);
    expect((await schreiben({ art: 'playbook', stand: g.j.stand, op: 'speichern', id: 'empfehlung', vorlage: { name: 'X' } }, sitzung('gast'))).status).toBe(403);
  });
  it('speichern wirkt bei allen Lesern (Kampagnen, Stellschraube); veralteter Stand 409; Recht nicht überschreibbar 400; zurück auf Standard', async () => {
    const g = await lesen('playbook');
    expect(g.j.aendern).toBe(true);
    // Rolle „nur Business“: liest nur (Kevin 13.10. „Nur lesen + Entwürfe“) — 403, nichts gespeichert.
    expect((await lesen('playbook', sitzung('mira'))).j.aendern).toBe(false);
    const nurLesen = await schreiben({ art: 'playbook', stand: g.j.stand, op: 'speichern', id: 'reaktivierung', vorlage: { name: 'X' } }, sitzung('mira'));
    expect(nurLesen.status).toBe(403);
    const r = await schreiben({ art: 'playbook', stand: g.j.stand, op: 'speichern', id: 'reaktivierung', vorlage: { name: 'Wieder ins Gespräch', warum: 'Mit Rabatt aus dem Newsletter.', kanal: 'mail' } });
    expect(r.status).toBe(200);
    const p = r.j.vorlagen.find((x: J) => x.id === 'reaktivierung');
    expect(p).toMatchObject({ name: 'Wieder ins Gespräch', angepasst: true, kanal: 'mail' });
    expect(r.j.hinweise.reaktivierung[0]).toMatch(/§ 7 UWG/);
    expect((await schreiben({ art: 'playbook', stand: g.j.stand, op: 'speichern', id: 'reaktivierung', vorlage: { name: 'Doppelt' } })).status).toBe(409);
    expect((await schreiben({ art: 'playbook', stand: r.j.stand, op: 'speichern', id: 'reaktivierung', vorlage: { recht: 'Alles erlaubt.' } })).status).toBe(400);
    // Leser: Kampagnen (GET + planen) und die Stellschraube im Steckbrief.
    const k = await import('@/app/api/crm/kampagnen/route');
    const kg = await (await k.GET(new Request('http://test/api/crm/kampagnen', { headers: sitzung('pia') }))).json();
    expect(kg.playbooks.find((x: J) => x.id === 'reaktivierung')).toMatchObject({ name: 'Wieder ins Gespräch', hinweise: [expect.stringMatching(/UWG/)] });
    const kopie = await schreiben({ art: 'playbook', stand: r.j.stand, op: 'kopieren', id: 'reaktivierung', name: 'Reaktivierung Probe' });
    expect(kopie.status).toBe(200);
    const plan = await (await k.POST(new Request('http://test/api/crm/kampagnen', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ aktion: 'planen', playbook: kopie.j.id }) }))).json();
    expect(plan.kampagne).toMatchObject({ playbook: kopie.j.id, name: 'Reaktivierung Probe', kanal: 'mail' });
    const { GET } = await import('@/app/api/prozesse/landkarte/route');
    const lk = await (await GET(new Request('http://test/api/prozesse/landkarte?space=business', { headers: sitzung('pia') }))).json();
    const schraube = lk.prozesse.find((x: J) => x.id === 'sp-kampagnen').stellschrauben.find((s: J) => s.id === 'playbooks');
    expect(schraube).toMatchObject({ wert: '2 angepasst', link: { text: 'Playbooks bearbeiten' } });
    // Zurück auf Standard + eigene löschen = wieder genau die Vorgaben.
    const st = await schreiben({ art: 'playbook', stand: kopie.j.stand, op: 'standard', id: 'reaktivierung' });
    const weg = await schreiben({ art: 'playbook', stand: st.j.stand, op: 'loeschen', id: kopie.j.id });
    expect(weg.status).toBe(200);
    expect(JSON.stringify(weg.j.vorlagen)).toBe(JSON.stringify(PLAYBOOKS));
  });
  it('Event-Vorlagen: speichern, kopieren, der feste UWG-Satz; zu große Anfrage 413', async () => {
    const g = await lesen('event');
    expect(JSON.stringify(g.j.vorlagen)).toBe(JSON.stringify(VORLAGEN));
    expect(g.j.recht).toMatch(/§ 7 UWG/);
    const r = await schreiben({ art: 'event', stand: g.j.stand, op: 'speichern', id: 'stammtisch', vorlage: { label: 'Stammtisch am Abend', kapazitaet: 16 } });
    expect(r.status).toBe(200);
    expect(r.j.vorlagen.find((v: J) => v.id === 'stammtisch')).toMatchObject({ label: 'Stammtisch am Abend', kapazitaet: 16, angepasst: true });
    const { eventVorlagenDesHaushalts } = await import('@/lib/crm/vorlagen-anpassung-server');
    expect((await eventVorlagenDesHaushalts()).find(v => v.id === 'stammtisch')!.label).toBe('Stammtisch am Abend');
    const gross = await schreiben({ art: 'event', stand: r.j.stand, op: 'speichern', id: 'stammtisch', vorlage: { beschreibung: 'x'.repeat(300_000) } });
    expect(gross.status).toBe(413);
  });
});
