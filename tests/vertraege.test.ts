// ─── Vertrieb › Verträge (01.11.) ────────────────────────────────────────────────────────────────────────────────────
// Rein: Platzhalter (vollständig, unbekannt, leer), Ampel, Abweichung, Import-Vorschau, Art. 17. Route: Nummer je Gesellschaft und Jahr,
// festgeschrieben nach Fertigstellen, neue Version, unterschrieben → Register-Eintrag mit Frist, Import speichert nichts, Dienstweg 403,
// fremder Haushalt bekommt nichts. Eigener Datenordner, erfundene Konten/Firmen (@example.invalid), keine echten Texte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import {
  vorlageSaeubern, vorlageAmpel, pruefungSetzen, vertragAusVorlage, fertigstellenFehlt, fertigstellenWarnungen, entwurfAendern, vertragFassung,
  vertraegePersonOhne, registerEintrag, platzhalterIn, STARTVORLAGEN, vorlageAusStart, type VertragVorlage, type Vertrag,
} from '@/lib/vertraege/modell';
import { vorlageAusText, wertAlsPlatzhalter, schluesselAus } from '@/lib/vertraege/import';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { sammelPruefen, sammelLesen, SAMMEL_FORMAT } from '@/lib/vertraege/sammel';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-vertraege-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-vertraege';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const J = '2026-11-01T10:00:00.000Z';
const vorlageRoh = {
  titel: 'Beispielvertrag', art: 'dienstleistung', felder: [{ schluessel: 'stundensatz', label: 'Stundensatz', typ: 'text', pflicht: true }],
  paragraphen: [
    { id: 'p-1', nr: '§ 1', titel: 'Gegenstand', text: '{{absender.firmierung}} erbringt für {{partner.name}} Leistungen.' },
    { id: 'p-2', nr: '§ 2', titel: 'Vergütung', text: 'Je Stunde {{stundensatz}}.' },
    { id: 'p-3', nr: '§ 3', titel: 'Option', text: 'Wahlweise.', optional: true },
  ],
};
const basis = { id: 'vv-test-0001', jetzt: J, person: 'person-a' };
const ABS = { absender: { firmierung: 'Beispiel UG', zeilen: ['Beispielweg 1', '12345 Musterstadt'] }, partner: { name: 'Muster GmbH', zeilen: ['Musterstadt'] } };

describe('Vorlage: Platzhalter fest oder eigenes Feld — sonst Fehler', () => {
  it('bekannte Platzhalter + eigenes Feld → gültig', () => {
    const r = vorlageSaeubern(vorlageRoh, null, basis);
    expect(r.fehler).toEqual([]);
    expect(r.v?.paragraphen).toHaveLength(3);
    expect(platzhalterIn(r.v!.paragraphen[0].text)).toEqual(['absender.firmierung', 'partner.name']);
  });
  it('unbekannter Platzhalter → Fehler mit Namen, nie gespeichert', () => {
    const r = vorlageSaeubern({ ...vorlageRoh, paragraphen: [{ nr: '§ 1', titel: 'x', text: 'Hallo {{gibtsnicht}}' }] }, null, basis);
    expect(r.v).toBeUndefined();
    expect(r.fehler.map(f => f.text).join(' ')).toMatch(/\{\{gibtsnicht\}\}/);
  });
  it('eigenes Feld darf keinen festen Namen tragen; Grenzen → Fehler statt Kürzen', () => {
    expect(vorlageSaeubern({ ...vorlageRoh, felder: [{ schluessel: 'beginn', label: 'x' }] }, null, basis).fehler[0].text).toMatch(/festen Platzhalter/);
    expect(vorlageSaeubern({ ...vorlageRoh, titel: 'x'.repeat(200) }, null, basis).fehler[0].text).toMatch(/höchstens/i);
  });
  it('Startgerüste haben nur Überschriften, keinen Wortlaut', () => {
    for (const s of STARTVORLAGEN) expect(s.paragraphen.every(p => p.text === '')).toBe(true);
    expect(vorlageSaeubern(vorlageAusStart('start-nda'), null, basis).fehler).toEqual([]);
  });
});

describe('Ampel: geprüft · ungeprüft · geändert seit Prüfung', () => {
  const v = vorlageSaeubern(vorlageRoh, null, basis).v!;
  it('ungeprüft → gelb', () => { expect(vorlageAmpel(v)).toMatchObject({ ampel: 'gelb', stufe: 'ungeprueft' }); });
  it('geprüft → grün; danach Paragraph geändert → gelb „geändert“', () => {
    const g = pruefungSetzen(v, { am: '2026-10-30', von: 'person-a' }) as VertragVorlage;
    expect(vorlageAmpel(g)).toMatchObject({ ampel: 'gruen', stufe: 'geprueft' });
    const geaendert = { ...g, paragraphen: g.paragraphen.map((p, i) => (i === 0 ? { ...p, text: `${p.text} Zusatz.` } : p)) };
    expect(vorlageAmpel(geaendert)).toMatchObject({ ampel: 'gelb', stufe: 'geaendert' });
  });
});

describe('Vertrag: Füllen, Pflichtfelder, Abweichung', () => {
  const vorlage = vorlageSaeubern(vorlageRoh, null, basis).v!;
  const v0 = vertragAusVorlage(vorlage, { id: 'vtr-test-0001', gesellschaft: 'kdv', jetzt: J, person: 'person-a', heute: '2026-11-01', vorbelegung: { firmaId: 'f-muster' } });
  it('Pflichtfeld leer und leerer Platzhalter → Fertigstellen gesperrt mit Satz', () => {
    const f = fertigstellenFehlt(v0, ABS);
    expect(f.join(' ')).toMatch(/Pflichtfeld „Stundensatz“/);
    expect(f.join(' ')).toMatch(/\{\{stundensatz\}\}/);
  });
  it('vollständig → nichts fehlt, Fassung ohne Platzhalter, abgewählter optionaler Paragraph fehlt', () => {
    const r = entwurfAendern(v0, { werte: { stundensatz: '100 €' }, paragraphen: [{ id: 'p-3', aus: true }] }, { jetzt: J, person: 'person-a', istGesellschaft: istBusinessGesellschaft });
    expect(r.fehler).toEqual([]);
    expect(fertigstellenFehlt(r.v!, ABS)).toEqual([]);
    const f = vertragFassung(r.v!, ABS);
    expect(f.map(p => p.nr)).toEqual(['§ 1', '§ 2']);
    expect(f.map(p => p.text).join(' ')).not.toMatch(/\{\{/);
    expect(f[0].text).toBe('Beispiel UG erbringt für Muster GmbH Leistungen.');
  });
  it('Pflichtparagraph lässt sich nicht abwählen; geänderter Text = Abweichung (Warnung)', () => {
    expect(entwurfAendern(v0, { paragraphen: [{ id: 'p-1', aus: true }] }, { jetzt: J, person: 'p', istGesellschaft: istBusinessGesellschaft }).fehler[0].text).toMatch(/kein optionaler/);
    const r = entwurfAendern(v0, { paragraphen: [{ id: 'p-2', text: 'Pauschal {{stundensatz}}.' }] }, { jetzt: J, person: 'p', istGesellschaft: istBusinessGesellschaft });
    const w = fertigstellenWarnungen(r.v!, vorlage);
    expect(w.abweichend).toBe(1);
    expect(w.warnungen.join(' ')).toMatch(/nicht anwaltlich geprüft.*weicht von der Vorlage ab/);
  });
  it('unbekannter Platzhalter im angepassten Paragraphen → Fehler', () => {
    expect(entwurfAendern(v0, { paragraphen: [{ id: 'p-2', text: '{{erfunden}}' }] }, { jetzt: J, person: 'p', istGesellschaft: istBusinessGesellschaft }).fehler[0].text).toMatch(/erfunden/);
  });
  it('Register-Eintrag trägt Beginn, kündigen bis, Erinnerung', () => {
    const e = registerEintrag({ ...v0, nummer: 'KDV-V-2026-0001', werte: { ...v0.werte, beginn: '2026-12-01', kuendigen_bis: '2027-09-30', erinnerung_tage: '45' } });
    expect(e).toMatchObject({ status: 'unterschrieben', beginn: '2026-12-01', kuendigenBis: '2027-09-30', erinnerungTage: 45 });
  });
  it('Art. 17: Entwurf der Person fällt weg, fertiger Vertrag bleibt mit gelöstem Bezug', () => {
    const fertig: Vertrag = { ...v0, id: 'vtr-test-0002', firmaId: undefined, kontaktId: 'c-anna1', status: 'fertig', partner: { name: 'Anna Test', zeilen: ['Musterstadt'] } };
    const entwurf: Vertrag = { ...v0, id: 'vtr-test-0003', kontaktId: 'c-anna1' };
    const r = vertraegePersonOhne([fertig, entwurf], 'c-anna1', '2026-11-01');
    expect(r.liste.map(x => x.id)).toEqual(['vtr-test-0002']);
    expect(r.liste[0].kontaktId).toBeUndefined();
    expect(r.liste[0].partner?.name).toBe('[Person gelöst]');
  });
});

describe('Import: Paragraphen aus Text, Werte markieren', () => {
  const text = 'Mustervertrag\n\n§ 1 Gegenstand\nDer Auftragnehmer erbringt Leistungen.\n\n§ 2\nVergütung\nDie Vergütung beträgt 1.500,00 € monatlich, erstmals am 01.12.2026.\n\n§ 3 Laufzeit\nUnbefristet. [Ort]';
  it('erkennt §-Überschriften (auch Titel in der nächsten Zeile), Titel, Kandidaten', () => {
    const v = vorlageAusText(text);
    expect(v.titel).toBe('Mustervertrag');
    expect(v.paragraphen.map(p => [p.nr, p.titel])).toEqual([['§ 1', 'Gegenstand'], ['§ 2', 'Vergütung'], ['§ 3', 'Laufzeit']]);
    expect(v.kandidaten.map(k => k.art).sort()).toEqual(['betrag', 'datum', 'luecke']);
  });
  it('markierter Wert → Platzhalter; Schlüssel kollidiert nie mit festen', () => {
    const v = vorlageAusText(text);
    const r = wertAlsPlatzhalter(v.paragraphen, '1.500,00 €', 'monatsbetrag');
    expect(r.ersetzt).toBe(1);
    expect(r.paragraphen[1].text).toMatch(/\{\{monatsbetrag\}\}/);
    expect(schluesselAus('Beginn')).not.toBe('beginn');
  });
});

describe('Sammel-Import (Datei): Vorschau je Vorlage, nur neue, nie überschreiben, ungeprüft', () => {
  const datei = (vorlagen: unknown[], extra: Record<string, unknown> = {}) => ({ format: SAMMEL_FORMAT, version: 1, vorlagen, ...extra });
  const neueId = (i: number) => `vv-sammel-${String(i).padStart(4, '0')}`;
  const b = { jetzt: J, person: 'person-a', neueId };
  it('Prüfvermerk, Kennung und Archiv aus der Datei werden nie übernommen', () => {
    const r = sammelPruefen(datei([{ ...vorlageRoh, id: 'vv-fremd-0001', pruefung: { anwaltlichGeprueftAm: '2026-01-01' }, archiviert: true, stand: 'x' }]), { vorlagen: [] }, b);
    expect(r.vorschau.zeilen[0]).toMatchObject({ zustand: 'neu', paragraphen: 3, felder: 1, fehler: [] });
    expect(r.neu[0]).toMatchObject({ id: 'vv-sammel-0000', pruefung: {} });
    expect(r.neu[0].archiviert).toBeUndefined();
    expect(vorlageAmpel(r.neu[0]).stufe).toBe('ungeprueft');
  });
  it('unbekannter Platzhalter → Fehler je Vorlage; vorhandener Titel+Art → „gibt es schon“; doppelt in der Datei', () => {
    const vorhanden = vorlageSaeubern(vorlageRoh, null, basis).v!;
    const r = sammelPruefen(datei([
      { ...vorlageRoh, titel: '  beispielvertrag ' },
      { titel: 'Kaputt', art: 'nda', paragraphen: [{ nr: '§ 1', titel: 'x', text: '{{gibtsnicht}}' }] },
      { ...vorlageRoh, titel: 'Zweite', art: 'nda' }, { ...vorlageRoh, titel: 'Zweite', art: 'nda' },
      { ...vorlageRoh, titel: 'Eigene', art: 'x-kooperation' },
    ], { arten: [{ label: 'Kooperation' }] }), { vorlagen: [vorhanden] }, b);
    expect(r.vorschau.zeilen.map(z => z.zustand)).toEqual(['vorhanden', 'fehler', 'neu', 'doppelt', 'neu']);
    expect(r.vorschau.zeilen[1].fehler.join(' ')).toMatch(/\{\{gibtsnicht\}\}/);
    expect(r.arten.map(a => a.id)).toEqual(['x-kooperation']);
    expect(r.neu.map(v => v.titel)).toEqual(['Zweite', 'Eigene']);
  });
  it('falsches Format → Fehler; mehr als 200 Paragraphen → Fehler der Vorlage; Datei > 2 MB → 413', () => {
    expect(() => sammelPruefen({ format: 'anders', version: 1, vorlagen: [] }, { vorlagen: [] }, b)).toThrow(/Format/);
    const viele = Array.from({ length: 201 }, (_, i) => ({ nr: `§ ${i + 1}`, titel: 't', text: 'x' }));
    expect(sammelPruefen(datei([{ titel: 'Lang', art: 'nda', paragraphen: viele }]), { vorlagen: [] }, b).vorschau.zeilen[0].fehler.join(' ')).toMatch(/Höchstens 200 Paragraphen/);
    expect(() => sammelLesen('x'.repeat(2 * 1024 * 1024 + 1))).toThrow(expect.objectContaining({ status: 413 }));
  });
});

describe('Route: Nummer, festgeschrieben, Version, unterschrieben, Rechte', () => {
  type Route = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  let vertraege: Route, vorlagen: Route, importR: Pick<Route, 'POST'>, unterschrift: Pick<Route, 'POST'>;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async (r: Route | Pick<Route, 'POST'>, body: unknown, p = 'person-a', url = 'http://test/api/vertraege'): Promise<{ status: number; d: any }> => {
    const res = await r.POST(new Request(url, { method: 'POST', headers: kopf(p), body: JSON.stringify(body) }));
    return { status: res.status, d: await res.json() };
  };
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
  let vorlageId = '';

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    const speicher = await import('@/lib/crm/speicher');
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), { ...konto('k4', 'person-c', 'mitglied', 'haus'), finanzRecht: 'business' }], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [k('c-anna1', { firmaId: 'f-muster', firma: 'Muster GmbH' })] });
    await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', stadt: 'Musterstadt', geaendert: J }],
      mandate: [{ id: 'm-test-0001', kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Mandat', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: false, start: '2026-11-01', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J }] });
    await db.saveJson('gesellschaften--haus', { gesellschaften: [
      { id: 'kdv', firmierung: 'Beispiel Ventures UG (haftungsbeschränkt)', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', geschaeftsfuehrung: 'Erika Beispiel' },
      { id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Beispielweg 2', plz: '12345', ort: 'Musterstadt' },
    ] });
    vertraege = (await import('@/app/api/vertraege/route')) as unknown as Route;
    vorlagen = (await import('@/app/api/vertraege/vorlagen/route')) as unknown as Route;
    importR = (await import('@/app/api/vertraege/import/route')) as unknown as Route;
    unterschrift = (await import('@/app/api/vertraege/unterschrift/route')) as unknown as Route;
    const r = await post(vorlagen, { aktion: 'speichern', felder: { ...vorlageRoh, paragraphen: vorlageRoh.paragraphen.map(p => ({ ...p })), felder: [] } }, 'person-a', 'http://test/api/vertraege/vorlagen');
    // Ohne eigenes Feld ist {{stundensatz}} unbekannt → 400 (nichts gespeichert).
    expect(r.status).toBe(400);
    const ok = await post(vorlagen, { aktion: 'speichern', felder: vorlageRoh }, 'person-a', 'http://test/api/vertraege/vorlagen');
    expect(ok.status).toBe(200);
    vorlageId = ok.d.vorlage.id;
  });

  const anlegen = async (gesellschaft: string, extra: Record<string, unknown> = {}) => {
    const r = await post(vertraege, { aktion: 'anlegen', vorlageId, gesellschaft, vorbelegung: { firmaId: 'f-muster', kontaktId: 'c-anna1', ...extra } });
    expect(r.status).toBe(200);
    const s = await post(vertraege, { aktion: 'speichern', id: r.d.vertrag.id, stand: r.d.vertrag.stand, felder: { werte: { stundensatz: '100 €', kuendigen_bis: '2027-09-30', beginn: '2026-12-01' } } });
    expect(s.status).toBe(200);
    return s.d.vertrag as Vertrag & { stand: string };
  };
  const fertig = async (v: Vertrag & { stand: string }) => post(vertraege, { aktion: 'fertigstellen', id: v.id, stand: v.stand, trotzdem: true });

  it('Pflichtfeld leer → 400; ungeprüfte Vorlage → 409 Warnung bis „trotzdem“', async () => {
    const r = await post(vertraege, { aktion: 'anlegen', vorlageId, gesellschaft: 'kdv', vorbelegung: { firmaId: 'f-muster' } });
    const leer = await post(vertraege, { aktion: 'fertigstellen', id: r.d.vertrag.id, stand: r.d.vertrag.stand, trotzdem: true });
    expect(leer.status).toBe(400);
    expect(leer.d.fehlt.join(' ')).toMatch(/Stundensatz/);
    const v = await anlegen('kdv');
    const w = await post(vertraege, { aktion: 'fertigstellen', id: v.id, stand: v.stand });
    expect(w.status).toBe(409);
    expect(w.d.warnungen.join(' ')).toMatch(/nicht anwaltlich geprüft/);
  });

  it('Nummer je Gesellschaft und Jahr, lückenlos; danach festgeschrieben (Änderung → 409), Version = neuer Entwurf', async () => {
    const jahr = new Date().getFullYear();
    const a = await fertig(await anlegen('kdv'));
    const b = await fertig(await anlegen('kdv'));
    const c = await fertig(await anlegen('ug'));
    expect(a.status).toBe(200);
    expect(a.d.vertrag.nummer).toBe(`KDV-V-${jahr}-0001`);
    expect(b.d.vertrag.nummer).toBe(`KDV-V-${jahr}-0002`);
    expect(c.d.vertrag.nummer).toMatch(new RegExp(`-V-${jahr}-0001$`));
    expect(a.d.vertrag.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    expect(a.d.vertrag.fassung.map((p: { text: string }) => p.text).join(' ')).toMatch(/Beispiel Ventures UG .* Muster GmbH/);
    const aendern = await post(vertraege, { aktion: 'speichern', id: a.d.vertrag.id, stand: a.d.vertrag.stand, felder: { titel: 'Anders' } });
    expect(aendern.status).toBe(409);
    const ver = await post(vertraege, { aktion: 'version', id: a.d.vertrag.id });
    expect(ver.d.vertrag).toMatchObject({ status: 'entwurf', version: 2, vorgaengerId: a.d.vertrag.id });
    expect(ver.d.vertrag.nummer).toBeUndefined();
    // Das Vertrags-PDF ist ein Beleg in der Ablage — nicht löschbar.
    const { istBeleg } = await import('@/lib/dateien/regeln');
    const { ablageListe } = await import('@/lib/dateien/ablage');
    const e = (await ablageListe('haus')).find(x => x.id === a.d.vertrag.pdfDateiId)!;
    expect(e.vertragId).toBe(a.d.vertrag.id);
    expect(istBeleg(e)).toBe(true);
  });

  it('unterschrieben (PDF) → Status, Mandat, Eintrag in vertraege[] des Registers mit Frist im Kalender', async () => {
    const v = (await fertig(await anlegen('kdv', { mandatId: 'm-test-0001' }))).d.vertrag;
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]);
    const form = new FormData();
    form.set('id', v.id); form.set('stand', v.stand); form.set('datei', new File([pdf], 'unterschrieben.pdf', { type: 'application/pdf' }));
    const res = await unterschrift.POST(new Request('http://test/api/vertraege/unterschrift', { method: 'POST', headers: { 'x-make-user': 'person-a' }, body: form }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.vertrag.status).toBe('unterschrieben');
    expect(d.vertrag.registerVertragId).toMatch(/^vt-/);
    const reg = await db.loadJson<{ gesellschaften: { id: string; vertraege?: { id: string; kuendigenBis?: string; beginn?: string }[] }[] }>('gesellschaften--haus');
    const rv = reg!.gesellschaften.find(g => g.id === 'kdv')!.vertraege!.find(x => x.id === d.vertrag.registerVertragId)!;
    expect(rv).toMatchObject({ kuendigenBis: '2027-09-30', beginn: '2026-12-01' });
    const { vertragsStichtage } = await import('@/lib/gesellschaften/modell');
    expect(vertragsStichtage(reg!.gesellschaften as never).some(s => s.vertragId === rv.id && s.kuendigung)).toBe(true);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(crm.mandate.find(m => m.id === 'm-test-0001')?.vertragUnterschrieben).toBe(true);
    // R2-2 Fund 6 (02.11.): das Ereignis „Vertrag unterschrieben“ weckt die Übergabe (V12) — eine Kennung je Vertrag, Bezug Vertrag + Mandat, Business.
    const { ereignisseLaden } = await import('@/lib/ereignisse/server');
    const ev = (await ereignisseLaden()).eintraege.filter(x => x.art === 'vertrag-unterschrieben');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ id: `vertrag:${v.id}:unterschrieben`, bereich: 'business', bezug: { vertragId: v.id, mandatId: 'm-test-0001' } });
  });

  it('Import-Vorschau speichert nichts', async () => {
    const vorher = await db.loadJson<{ vorlagen: unknown[] }>('vertrag-vorlagen--haus');
    const r = await post(importR, { text: '§ 1 Gegenstand\nText.' }, 'person-a', 'http://test/api/vertraege/import');
    expect(r.status).toBe(200);
    expect(r.d.vorschau.paragraphen).toHaveLength(1);
    expect(await db.loadJson('vertrag-vorlagen--haus')).toEqual(vorher);
  });

  it('Sammel-Import: Vorschau speichert nichts, Übernahme nur neue (zweiter Lauf legt nichts doppelt an), nur Inhaber per Sitzung', async () => {
    const sammel = (await import('@/app/api/vertraege/vorlagen/sammel/route')) as unknown as Pick<Route, 'POST'>;
    const url = 'http://test/api/vertraege/vorlagen/sammel';
    const inhalt = JSON.stringify({ format: 'make-os-vertragsvorlagen', version: 1, vorlagen: [
      { ...vorlageRoh, titel: 'Sammel A', pruefung: { anwaltlichGeprueftAm: '2026-01-01' } },
      { titel: 'Sammel B', art: 'nda', paragraphen: [{ nr: '§ 1', titel: 'Zweck', text: 'Für {{partner.name}}.' }] },
      { titel: 'Sammel C', art: 'nda', paragraphen: [{ nr: '§ 1', titel: 'x', text: '{{erfunden}}' }] },
    ] });
    const vorher = await db.loadJson('vertrag-vorlagen--haus');
    const v = await post(sammel, { aktion: 'vorschau', inhalt }, 'person-a', url);
    expect(v.status).toBe(200);
    expect(v.d.zeilen.map((z: { zustand: string }) => z.zustand)).toEqual(['neu', 'neu', 'fehler']);
    expect(v.d.zeilen[2].fehler.join(' ')).toMatch(/erfunden/);
    expect(await db.loadJson('vertrag-vorlagen--haus')).toEqual(vorher);
    const u = await post(sammel, { aktion: 'uebernehmen', inhalt }, 'person-a', url);
    expect(u.status).toBe(200);
    expect(u.d.uebernommen).toHaveLength(2);
    const nach = await db.loadJson<{ vorlagen: VertragVorlage[] }>('vertrag-vorlagen--haus');
    const a = nach!.vorlagen.find(x => x.titel === 'Sammel A')!;
    expect(a.pruefung).toEqual({});
    expect(nach!.vorlagen.some(x => x.titel === 'Sammel C')).toBe(false);
    const zweit = await post(sammel, { aktion: 'uebernehmen', inhalt }, 'person-a', url);
    expect(zweit.d.uebernommen).toEqual([]);
    expect(zweit.d.zeilen.slice(0, 2).map((z: { zustand: string }) => z.zustand)).toEqual(['vorhanden', 'vorhanden']);
    expect(await db.loadJson('vertrag-vorlagen--haus')).toEqual(nach);
    // Rechte (02.11., Prüfung D): ein volles Mitglied steuert wie ein Inhaber — Konto „nur Business“ 403, Dienstweg 403 (auch mit Person), zu große Datei 413
    expect((await post(sammel, { aktion: 'vorschau', inhalt }, 'person-b', url)).status).toBe(200);
    expect((await post(sammel, { aktion: 'vorschau', inhalt }, 'person-c', url)).status).toBe(403);
    const dienst = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-vertraege', 'x-make-person': 'person-a' };
    expect((await sammel.POST(new Request(url, { method: 'POST', headers: dienst, body: JSON.stringify({ aktion: 'vorschau', inhalt }) }))).status).toBe(403);
    expect((await post(sammel, { aktion: 'vorschau', inhalt: 'x'.repeat(2 * 1024 * 1024 + 10) }, 'person-a', url)).status).toBe(413);
  });

  it('Dienstweg: fertigstellen, Status, Vorlagen schreiben, Unterschrift, Import → 403', async () => {
    const v = await anlegen('kdv');
    const dienst = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-vertraege', 'x-make-person': 'person-a' };
    const p = (r: Route | Pick<Route, 'POST'>, url: string, body: unknown) => r.POST(new Request(url, { method: 'POST', headers: dienst, body: JSON.stringify(body) }));
    expect((await p(vertraege, 'http://test/api/vertraege', { aktion: 'fertigstellen', id: v.id, stand: v.stand, trotzdem: true })).status).toBe(403);
    expect((await p(vertraege, 'http://test/api/vertraege', { aktion: 'status', id: v.id, stand: v.stand, status: 'versendet' })).status).toBe(403);
    expect((await p(vorlagen, 'http://test/api/vertraege/vorlagen', { aktion: 'geruest', start: 'start-nda' })).status).toBe(403);
    expect((await p(importR, 'http://test/api/vertraege/import', { text: 'x' })).status).toBe(403);
    expect((await p(unterschrift, 'http://test/api/vertraege/unterschrift', {})).status).toBe(403);
  });

  it('Sicht X bekommt nichts aus Y: fremder Haushalt → 403, eigener leerer Bestand sieht keine fremden Verträge', async () => {
    for (const r of [vertraege, vorlagen]) expect((await r.GET(new Request('http://test/api/vertraege', { headers: kopf('testkunde') }))).status).toBe(403);
    expect((await post(vertraege, { aktion: 'anlegen', vorlageId }, 'testkunde')).status).toBe(403);
    const eigen = await (await vertraege.GET(new Request('http://test/api/vertraege', { headers: kopf('person-b') }))).json();
    expect(eigen.vertraege.length).toBeGreaterThan(0); // gleicher Haushalt
    await db.saveJson('vertraege--kunde-haus', { vertraege: [] });
    expect((await db.loadJson<{ vertraege: unknown[] }>('vertraege--kunde-haus'))!.vertraege).toEqual([]);
  });
});
