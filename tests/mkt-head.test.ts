// ─── Marketing-Projekt M2 · Head of Marketing (02.11.) ─────────────────────────────────────────────────────────────────────────────────
// Wächter je Befund (MARKETING_PROJEKT.md › M2): K1 Beitrag/Newsletter → echter Entwurf (nie Aufgabe, nie selbst) · K2 Social/Website/Funde/
// Mail-Stapel/Firmen-Segmente im Datenpaket + Grundlauf-Regeln · K3 Kampagnen nach Zielen inkl. Firmen, laufende weiterverwenden, keine Dubletten
// über beide Heads · W2 Kundenstimme nicht doppelt · W3 Art. 14 nur Aufgabe · B1 Vorschläge an die Marketing-Verantwortung · B4 Social-Läufe als
// Marketing-Verantwortliche · Kanäle, Kosten, Team über den Haupt-Inhaber. Erfundene Daten, eigener Datenordner, kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-mkt-head-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-mkt-head', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_INTERN;
  delete process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM;
  return o;
});

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Kampagne } from '@/lib/crm/typen';
import type { Vorschlag } from '@/lib/heads/pruefer';
import type { HeadVorschlag } from '@/lib/heads/stand';
import { leererBestand } from '@/lib/crm/speicher';
import { kontenSaeen, sitzung } from './fixtures/agenten-kern';

const HEUTE = '2026-11-02';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Betrieb ${id}`, rolle: 'offen', geaendert: '2026-10-01T10:00:00.000Z', ...x } as Firma);
const vor = (x: Partial<Vorschlag> = {}): Vorschlag => ({ art: 'beitrag_entwurf', titel: 'Beitrag schreiben', begruendung: 'Zwei Gespräche nannten denselben Schmerz, eigene Einsicht dazu.', kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, frist: HEUTE, prioritaet: 'mittel', dedup_schluessel: 'b:1', quelle: ['stimme_der_kunden[0]'], entwurf: null, kampagne: null, ...x });
const hv = (x: Partial<HeadVorschlag> = {}): HeadVorschlag => ({ ...vor(), id: 'hs-test-0', status: 'offen', erstellt: '2026-11-01T10:00:00.000Z', aktualisiert: '2026-11-01T10:00:00.000Z', berichtId: 'hb-1', ...x });
const quelle = (d: string) => readFileSync(path.join(process.cwd(), d), 'utf8');

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('K1 · W3 — Autonomie: Beitrag/Newsletter nie selbst, Art. 14 nur Aufgabe', () => {
  it('Inhalts- und Hinweis-Arten bleiben zur Freigabe; Art. 14 an einer Person ohne nächsten Schritt wird Aufgabe, nie ein Schritt', async () => {
    const { automatisch, INHALT_ARTEN, HINWEIS_ARTEN } = await import('@/lib/heads/autonomie');
    for (const art of [...INHALT_ARTEN, ...HINWEIS_ARTEN]) expect(automatisch(hv({ art, entwurf: null }), undefined), art).toBeNull();
    expect(automatisch(hv({ art: 'info_art14_nachholen', kontakt_id: 'c-a', frist: HEUTE }), k('a'))).toBe('aufgabe');
    expect(automatisch(hv({ art: 'einwilligung_einholen', kontakt_id: 'c-a', frist: HEUTE }), k('a'))).toBe('schritt'); // unverändert
  });
});

describe('Prüfer — Inhalts-Kanäle (Beitrag/Newsletter)', () => {
  it('Inhalts-Entwurf ohne Person bleibt, an einer anderen Art fliegt er; keine Personen-Anrede; Säule wird gelesen', async () => {
    const { normalisiere, pruefe, qualitaet } = await import('@/lib/heads/pruefer');
    const roh = normalisiere({ zusammenfassung: 'x', vorschlaege: [
      { ...vor({ entwurf: { kanal: 'linkedin_beitrag', text: 'Liquidität sieht man oft erst, wenn es eng wird. Was hilft dir, früher hinzusehen?' } }), saeule: 'liquiditaet' },
      { ...vor({ art: 'einwilligung_einholen', titel: 'Einwilligung holen', dedup_schluessel: 'e:1', entwurf: { kanal: 'newsletter', text: 'Hallo' } }) },
    ] }, 'marketing');
    expect(roh.vorschlaege[0].entwurf?.kanal).toBe('linkedin_beitrag');
    expect(roh.vorschlaege[0].saeule).toBe('liquiditaet');
    const { antwort, pruefung } = pruefe(roh, {}, [], leererBestand(), HEUTE);
    expect(antwort.vorschlaege.map(v => v.art)).toEqual(['beitrag_entwurf']);
    expect(pruefung.gestrichen[0].grund).toMatch(/nur für Beitrag oder Newsletter/);
    expect(qualitaet(antwort.vorschlaege[0], undefined, HEUTE).maengel.join()).not.toMatch(/Anrede/);
  });
});

describe('K2 — Datenpaket kennt Social, Website, Funde, Mail-Stapel, Sequenzen und Firmen-Segmente', () => {
  it('reine Verdichtung: nur Zahlen und Kennungen — keine Namen von Absendern, keine Texte Dritter', async () => {
    const { socialLage, websiteLage, fundeLage, mailStapelLage } = await import('@/lib/heads/marketing-lage');
    const so = socialLage({ kanaele: [{ id: 'sk-1', name: 'Firmenkanal', status: 'aktiv', plattformen: ['instagram'], ziele: [], staende: [], sprache: 'de', kiKanal: false } as never], formate: [], folgen: [
      { id: 'f1', kanalId: 'sk-1', status: 'entwurf' }, { id: 'f2', kanalId: 'sk-1', status: 'geplant', geplantAm: '2026-11-04' }, { id: 'f3', kanalId: 'sk-1', status: 'geplant', geplantAm: '2026-11-20' },
    ] as never }, [{ kanalId: 'sk-1', art: 'kommentar', offen: true }, { kanalId: 'sk-1', art: 'dm', offen: true }, { kanalId: 'sk-1', art: 'dm', offen: false }], { 'sk-1': [{ platz: '2026-11-05T18:00' }, { platz: '2026-11-30T18:00' }] }, HEUTE, '2026-11-08');
    expect(so.kanaele[0]).toMatchObject({ geplant_7_tage: 1, luecken_7_tage: 1, wartet_freigabe: 1, offene_kommentare: 1, offene_dms: 1 });
    const web = websiteLage([{ art: 'anfrage', herkunft: 'Check: Innovation', wer: 'GEHEIM-NAME' } as never, { art: 'termin', herkunft: 'Erstgespräch' }], [{ label: 'Besuche', anzeige: '12', ampel: 'gruen' }], [{ name: 'Checks', zustand: 'an' }, { name: 'Newsletter', zustand: 'aus' }]);
    expect(web.eingaenge_30_tage).toEqual({ anfragen: 1, davon_checks: 1, termine: 1, bestellungen: 0, newsletter: 0 });
    expect(web.wege_aus).toEqual(['Newsletter: aus']);
    expect(JSON.stringify(web)).not.toContain('GEHEIM-NAME');
    expect(fundeLage([{ status: 'vorbereitet' }, { status: 'neu' }, { status: 'vorbereitet' }])).toEqual({ neu: 1, vorbereitet: 2, uebernommen: 0, gesendet: 0 });
    const st = mailStapelLage([
      { id: 'km-1', kampagneId: 'kp-1', kanal: 'mail', status: 'entwurf' }, { id: 'km-2', kampagneId: 'kp-1', kanal: 'mail', status: 'gesendet', gesendet: { am: '2026-10-31T09:00:00Z' }, rueckfluss: { art: 'antwort' } },
      { id: 'km-3', kampagneId: 'kp-1', kanal: 'mail', status: 'gesendet', gesendet: { am: '2026-10-01T09:00:00Z' }, rueckfluss: { art: 'antwort' } },
    ], [{ id: 'fu-km-2', status: 'offen' }, { id: 'fu-km-3', status: 'erledigt' }], [{ id: 'kp-1', name: 'Herbst' }], HEUTE, '2026-10-27', id => `fu-${id}`);
    expect(st).toMatchObject({ wartet_freigabe: 1, gesendet_7_tage: 1, antworten_offen: 1 });
    expect(st.je_kampagne[0]).toMatchObject({ kampagne_id: 'kp-1', name: 'Herbst', antworten_offen: 1 });
  });

  it('Marketing-Paket: Segmente mit Betrieben (`segmentZiele`), Stimme „schon übernommen“, Kundenprofil, Säulen mit Kennung, Blöcke ohne Lage = null', async () => {
    const { datenpaket } = await import('@/lib/heads/daten');
    const crm: CrmBestand = { ...leererBestand(), firmen: [firma('f-ohne', { branche: 'Bäckerei' }), firma('f-mit', { branche: 'Bäckerei' })],
      segmente: [{ id: 'seg-b', name: 'Bäckereien', kriterien: { branche: 'Bäckerei' }, geaendert: '2026-10-01T10:00:00.000Z' } as never],
      beitraege: [{ id: 'bt-x', titel: 'Liquidität zu spät', kanal: 'linkedin', status: 'idee', wirkung: [], quellen: ['c-stimme'], geaendert: '2026-10-01T10:00:00.000Z' }] };
    const kontakte = [k('mit', { firmaId: 'f-mit', firma: 'Betrieb f-mit' }), k('stimme', { aktivitaeten: [{ am: '2026-10-30T10:00:00.000Z', art: 'notiz', von: 'person-a', text: 'Gespräch', notiz: { bedarf: 'Liquidität zu spät' } } as never, { am: '2026-10-31T10:00:00.000Z', art: 'notiz', von: 'person-a', text: 'Gespräch', notiz: { bedarf: 'Fachkräfte fehlen' } } as never] })];
    const d = datenpaket('marketing', 'wochenplan', kontakte, crm, HEUTE, 'person-b', []) as unknown as Record<string, unknown>;
    const seg = (d.segmente as { name: string; personen: number; firmen: number; anzahl: number }[])[0];
    expect(seg).toMatchObject({ personen: 1, firmen: 1, anzahl: 2 });   // f-mit vertritt ihre Person, f-ohne zählt als Betrieb ohne Person
    const stimmen = d.stimme_der_kunden as { bedarf: string; uebernommen: boolean }[];
    expect(stimmen.find(s => s.bedarf === 'Liquidität zu spät')?.uebernommen).toBe(true);
    expect(stimmen.find(s => s.bedarf === 'Fachkräfte fehlen')?.uebernommen).toBe(false);
    expect(d).toHaveProperty('kundenprofil');
    expect(d).toMatchObject({ social: null, website: null, funde: null, mail_stapel: null, sequenzen: [] });
  });

  it('Grundlauf: Pflichten und Wartendes vor neuem Inhalt; Stimme im Plan kommt nicht wieder (W2); Idee trägt Titel, Text ohne Namen und Quelle', async () => {
    const { grundlauf } = await import('@/lib/heads/grundlauf');
    const daten = {
      meta: { heute: HEUTE },
      art14_faellig: [{ id: 'c-a14', name: 'Eva Beispiel', kanal_erlaubt: [], tage: 40 }],
      mail_stapel: { wartet_freigabe: 3, freigegeben: 0, fehler: 1, antworten_offen: 2, gesendet_7_tage: 4, je_kampagne: [{ kampagne_id: 'kp-1', name: 'Herbst', wartet_freigabe: 3, antworten_offen: 2 }] },
      social: { kanaele: [{ id: 'sk-1', name: 'Firmenkanal', aktiv: true, luecken_7_tage: 2, geplant_7_tage: 0, wartet_freigabe: 1, offene_kommentare: 1, offene_dms: 0 }] },
      funde: { neu: 4, vorbereitet: 2, uebernommen: 0, gesendet: 0 },
      website: { eingaenge_30_tage: { anfragen: 3, davon_checks: 2, termine: 1 }, wege_aus: ['Newsletter: aus'] },
      stimme_der_kunden: [{ kontakt_id: 'c-st', am: '2026-10-31', bedarf: 'Fachkräfte fehlen', idee_titel: 'Fachkräfte fehlen', uebernommen: false }, { kontakt_id: 'c-st', am: '2026-10-30', bedarf: 'Liquidität zu spät', idee_titel: 'Liquidität zu spät', uebernommen: true }],
    };
    const g = grundlauf('marketing', 'wochenplan', daten);
    const arten = g.antwort.vorschlaege.map(v => v.art);
    expect(arten.slice(0, 5)).toEqual(['info_art14_nachholen', 'antworten_bearbeiten', 'stapel_freigeben', 'community_beantworten', 'social_planen']);
    expect(g.antwort.befunde.map(b => b.titel).join()).toMatch(/Mail-Stapel: Fehler.*Website/);
    // Ohne Pflichten: die Idee aus der Stimme (nur die nicht übernommene)
    const g2 = grundlauf('marketing', 'wochenplan', { meta: { heute: HEUTE }, stimme_der_kunden: daten.stimme_der_kunden });
    expect(g2.antwort.vorschlaege).toHaveLength(1);
    expect(g2.antwort.vorschlaege[0].inhalt).toEqual({ titel: 'Fachkräfte fehlen', text: 'Aus einem Kundengespräch (2026-10-31): „Fachkräfte fehlen“', quellen: ['c-st'] });
    // Wiederkehrende Hinweise tragen Tag/Woche (sonst kämen sie nach einmal Annehmen nie wieder)
    expect(g.antwort.vorschlaege.find(v => v.art === 'stapel_freigeben')!.dedup_schluessel).toBe('stapel:2026-11-02');
  });

  it('Offline-Eval (lib/heads/eval.ts `bewerte`) des neuen Grundlaufs: alle neun Prüfungen bestanden', async () => {
    const { grundlauf } = await import('@/lib/heads/grundlauf');
    const { bewerte } = await import('@/lib/heads/eval');
    const kontakte = [k('a14')];
    const daten = { meta: { heute: HEUTE }, art14_faellig: [{ id: 'c-a14', name: 'a14 Beispiel', kanal_erlaubt: [], tage: 40 }],
      mail_stapel: { wartet_freigabe: 3, freigegeben: 0, fehler: 0, antworten_offen: 2, gesendet_7_tage: 0, je_kampagne: [] },
      social: { kanaele: [{ id: 'sk-1', name: 'Firmenkanal', aktiv: true, luecken_7_tage: 2, geplant_7_tage: 0, wartet_freigabe: 0, offene_kommentare: 0, offene_dms: 0 }] },
      stimme_der_kunden: [{ kontakt_id: 'c-a14', am: '2026-10-31', bedarf: 'Fachkräfte fehlen', idee_titel: 'Fachkräfte fehlen', uebernommen: false }] };
    const b = bewerte(grundlauf('marketing', 'wochenplan', daten).antwort, daten, kontakte, leererBestand(), HEUTE);
    expect(b.punkte.filter(p => !p.bestanden).map(p => `${p.id}: ${p.detail}`)).toEqual([]);
    expect(b.bestanden).toBe(9);
  });
});

describe('K3 — Kampagnen nach Zielen inkl. Betrieben, laufende weiterverwenden, keine Dublette über beide Heads', () => {
  it('Kampagnen-Paket zählt Betriebe ohne Person und kennt die laufende Kampagne je Playbook', async () => {
    const { datenpaket } = await import('@/lib/heads/daten');
    const crm: CrmBestand = { ...leererBestand(), firmen: [firma('f-1', { branche: 'Handwerk' })], kampagnen: [{ id: 'kp-l', name: 'Läuft', playbook: 'reaktivierung', ziel: '', zielgruppe: {}, kanal: 'mix', status: 'aktiv', schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: '2026-10-01T10:00:00.000Z' } as Kampagne] };
    const pb = { id: 'eigen-bau', name: 'Handwerk ansprechen', warum: 'Handwerk', kanal: 'mix', kennzahl: 'Gespräche', recht: '', fuer: ['head-marketing'], zielgruppe: { branche: 'Handwerk' }, schritte: [] };
    const pb2 = { ...pb, id: 'reaktivierung', name: 'Reaktivierung' };
    const d = datenpaket('marketing', 'kampagne', [], crm, HEUTE, 'person-b', [], { playbooks: [pb, pb2] as never }) as unknown as { playbooks: { id: string; ziele_anzahl: number; firmen_anzahl: number; laufend: { id: string } | null }[] };
    expect(d.playbooks.find(p => p.id === 'eigen-bau')).toMatchObject({ firmen_anzahl: 1, ziele_anzahl: 1, laufend: null });
    expect(d.playbooks.find(p => p.id === 'reaktivierung')?.laufend?.id).toBe('kp-l');
  });

  it('Grundlauf: bestes Playbook nach Zielen, ein laufendes wird nie ein zweites Mal vorgeschlagen (Befund)', async () => {
    const { grundlauf } = await import('@/lib/heads/grundlauf');
    const g = grundlauf('marketing', 'kampagne', { meta: { heute: HEUTE }, playbooks: [
      { id: 'a', name: 'A', warum: 'weil', zielgruppe_anzahl: 1, ziele_anzahl: 9, firmen_anzahl: 8, laufend: { id: 'kp-a', name: 'A läuft', status: 'aktiv' }, zielgruppe: [] },
      { id: 'b', name: 'B', warum: 'weil', zielgruppe_anzahl: 2, ziele_anzahl: 5, firmen_anzahl: 3, laufend: null, zielgruppe: [] },
      { id: 'c', name: 'C', warum: 'weil', zielgruppe_anzahl: 4, ziele_anzahl: 4, firmen_anzahl: 0, laufend: null, zielgruppe: [] },
    ] });
    expect(g.antwort.vorschlaege.map(v => v.kampagne?.playbook)).toEqual(['b']);
    expect(g.antwort.vorschlaege[0].begruendung).toMatch(/3 Betriebe ohne Person/);
    expect(g.antwort.befunde[0].titel).toMatch(/läuft schon/);
  });

  it('Dubletten über beide Heads: offen oder in 30 Tagen entschieden beim anderen Head → nicht noch einmal', async () => {
    const { kampagnenDerAnderen, ohneKampagnenDerAnderen } = await import('@/lib/heads/stand');
    const jetzt = '2026-11-02T10:00:00.000Z';
    const andere = [hv({ kampagne: { playbook: 'p-offen', name: '', ziel: '', kontakt_ids: [] } }), hv({ status: 'abgelehnt', entschieden: '2026-10-25T10:00:00.000Z', kampagne: { playbook: 'p-frisch', name: '', ziel: '', kontakt_ids: [] } }), hv({ status: 'abgelehnt', entschieden: '2026-08-01T10:00:00.000Z', kampagne: { playbook: 'p-alt', name: '', ziel: '', kontakt_ids: [] } })];
    const g = kampagnenDerAnderen(andere, jetzt);
    expect(Array.from(g).sort()).toEqual(['p-frisch', 'p-offen']);
    const vs = ['p-offen', 'p-frisch', 'p-alt'].map(p => vor({ kampagne: { playbook: p, name: '', ziel: '', kontakt_ids: [] } }));
    expect(ohneKampagnenDerAnderen([...vs, vor()], g).map(v => v.kampagne?.playbook ?? null)).toEqual(['p-alt', null]);
    expect(quelle('lib/heads/lauf.ts')).toMatch(/ohneKampagnenDerAnderen\(antwort\.vorschlaege, kampagnenDerAnderen\(andere\.vorschlaege, jetzt\)\)/);
  });
});

describe('Inhalt aus den Quellen (K1)', () => {
  it('quellen = Personen hinter stimme_der_kunden[i]; übernimmt das Modell einen Grundlauf-Vorschlag, bleibt dessen Titel', async () => {
    const { inhaltAusQuellen } = await import('@/lib/heads/lauf');
    const daten = { stimme_der_kunden: [{ kontakt_id: 'c-1' }, { kontakt_id: 'c-2' }] };
    expect(inhaltAusQuellen(vor({ quelle: ['stimme_der_kunden[1]', 'kennzahlen'] }), daten)).toEqual({ inhalt: { quellen: ['c-2'] } });
    expect(inhaltAusQuellen(vor({ quelle: ['stimme_der_kunden[0]'] }), daten, [{ dedup_schluessel: 'b:1', inhalt: { titel: 'Idee', text: 't' } }])).toEqual({ inhalt: { titel: 'Idee', text: 't', quellen: ['c-1'] } });
    expect(inhaltAusQuellen(vor({ art: 'kampagne_planen' }), daten)).toEqual({});
  });
});

describe('B1 — Vorschläge des Head of Marketing gehen an die Marketing-Verantwortung', () => {
  it('ohne eingetragene Beziehung → Marketing-Verantwortung; eingetragen → diese Person; Sales unverändert', async () => {
    const { teamSetzen } = await import('@/lib/crm/team-liste');
    teamSetzen([{ id: 'person-a', name: 'A', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'person-b', name: 'B', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
    const { fuerWen, kontaktFuerHead } = await import('@/lib/heads/paket');
    const kontakte = new Map([['c-o', k('o')], ['c-e', k('e', { besitzer: 'person-a' })]]);
    const crm = leererBestand();
    expect(fuerWen(vor({ kontakt_id: 'c-o' }), 'marketing', kontakte, crm, null)).toBe('person-b');
    expect(fuerWen(vor({ kontakt_id: 'c-e' }), 'marketing', kontakte, crm, null)).toBe('person-a');
    expect(fuerWen(vor({ kontakt_id: 'c-o' }), 'sales', kontakte, crm, null)).toBe('person-a');
    expect(kontaktFuerHead(k('x'), 'marketing')).toBe('person-b');
    expect(quelle('app/api/heads/[head]/route.ts')).toMatch(/t\.fuer \?\? \(k \? kontaktFuerHead\(k, h\) : verantwortlich\(h\)\)/);
  });
});

describe('Team über den Haupt-Inhaber; tote Zuordnung entfernt', () => {
  it('teamAusKonten nimmt die ausdrückliche Wahl des Haupt-Inhabers; ohne Einstellung wie vorher', async () => {
    const { teamAusKonten } = await import('@/lib/crm/team-liste');
    const konten = [{ speicher: 'person-a', name: 'A', rolle: 'inhaber', haushalt: 'h', angelegt: '2026-01-01' }, { speicher: 'person-b', name: 'B', rolle: 'inhaber', haushalt: 'h', angelegt: '2026-02-01' }];
    expect(teamAusKonten(konten)!.map(m => [m.id, m.verantwortet.join()])).toEqual([['person-a', 'sales'], ['person-b', 'marketing,event']]);
    expect(teamAusKonten(konten, { hauptInhaber: 'person-b' })!.map(m => [m.id, m.verantwortet.join()])).toEqual([['person-b', 'sales'], ['person-a', 'marketing,event']]);
    expect(quelle('lib/crm/team.ts')).not.toMatch(/export const WELT_DER_LISTE/);
  });
});

describe('Oberfläche, Schema, Kosten', () => {
  it('HeadPanel auch im Social-Reiter; Kosten mit social-*; Schema kennt Inhalts-Kanäle und Säule', async () => {
    expect(quelle('components/os/crm/Marketing.tsx')).toMatch(/\{unter !== 'kampagnen' && <HeadPanel head="marketing"/);
    expect(quelle('app/api/heads/[head]/route.ts')).toMatch(/h === 'marketing' && z\.zweck\.startsWith\('social-'\)/);
    const { SCHEMA } = await import('@/lib/heads/prompt');
    const item = (SCHEMA.properties.vorschlaege.items as unknown as { required: string[]; properties: { entwurf: { anyOf: { properties?: { kanal: { enum: string[] } } }[] } } });
    expect(item.required).toContain('saeule');
    expect(item.properties.entwurf.anyOf[1].properties!.kanal.enum).toEqual(expect.arrayContaining(['newsletter', 'instagram', 'linkedin_beitrag', 'mail']));
  });
});

// ── Über die echte Route und echte Bestände ────────────────────────────────────────────────────────────────────────────────────────────
describe('Route: Annehmen legt den echten Entwurf an (K1), Art. 14 wird Aufgabe (W3), laufende Kampagne wird weiterverwendet (K3)', () => {
  type H = (r: Request, p: { params: Promise<{ head: string }> }) => Promise<Response>;
  let route: { POST: H };
  let db: typeof import('@/lib/store/local-db');
  const post = async (person: string, body: Record<string, unknown>) => {
    const r = await route.POST(new Request('http://test/api/heads/marketing', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }), { params: Promise.resolve({ head: 'marketing' }) });
    return { status: r.status, d: (await r.json()) as Record<string, unknown> };
  };
  const stand = (vorschlaege: HeadVorschlag[]) => db.saveJson('head-marketing', { berichte: [], letzte: {}, versuche: {}, vorschlaege });

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await kontenSaeen();
    await (await import('@/lib/zugang/konten')).ladeKonten();   // zieht das Team nach: person-a Sales, person-b Marketing
    await db.saveJson('kontakte', { kontakte: [k('st'), k('a14'), k('gesperrt', { werbesperre: { seit: '2026-10-01', grund: 'Widerspruch' } })] });
    await db.saveJson('crm', { ...leererBestand(), kampagnen: [{ id: 'kp-entwurf', name: 'Reaktivierung Herbst', playbook: 'reaktivierung', ziel: '', zielgruppe: {}, kanal: 'mix', status: 'entwurf', schritte: [], kontaktIds: ['c-st'], ergebnisse: [], von: 'hand', geaendert: '2026-10-01T10:00:00.000Z' }] });
    route = (await import('@/app/api/heads/[head]/route')) as unknown as { POST: H };
  });

  it('Beitrag-Idee: angelegt im Redaktionsplan mit Quelle (gesperrte fallen weg), keine Aufgabe; zweiter Klick legt nichts doppelt an', async () => {
    await stand([hv({ id: 'hs-b-1', fuer: 'person-b', inhalt: { titel: 'Fachkräfte fehlen', text: 'Aus einem Kundengespräch (2026-10-31): „Fachkräfte fehlen“', quellen: ['c-st', 'c-gesperrt', 'c-gibtsnicht'] } })]);
    const r = await post('person-b', { aktion: 'entscheiden', id: 'hs-b-1', status: 'angenommen' });
    expect(r.status).toBe(200);
    expect(String(r.d.link)).toContain('redaktion');
    const crm = await db.loadJson<CrmBestand>('crm');
    const b = crm!.beitraege.find(x => x.id === 'bt-hs-b-1')!;
    expect(b).toMatchObject({ titel: 'Fachkräfte fehlen', status: 'idee', quellen: ['c-st'], zustaendig: 'person-b' });
    expect(((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))?.tasks ?? []).some(t => t.id === 'hd-hs-b-1')).toBe(false);
    const st = await db.loadJson<{ vorschlaege: HeadVorschlag[] }>('head-marketing');
    expect(st!.vorschlaege[0].status).toBe('angenommen');
    await post('person-b', { aktion: 'entscheiden', id: 'hs-b-1', status: 'angenommen' });
    expect((await db.loadJson<CrmBestand>('crm'))!.beitraege.filter(x => x.id === 'bt-hs-b-1')).toHaveLength(1);
    expect(((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))?.tasks ?? []).some(t => t.id === 'hd-hs-b-1')).toBe(false);
  });

  it('Beitrag mit bearbeitetem Inhalts-Entwurf → Status „entwurf“ mit dem übernommenen Text; Newsletter → Ausgabe als Entwurf', async () => {
    await stand([
      hv({ id: 'hs-b-2', saeule: 'gibt-es-nicht', entwurf: { kanal: 'linkedin_beitrag', text: 'Erster Text' } }),
      hv({ id: 'hs-n-1', art: 'newsletter_ausgabe', titel: 'Novemberausgabe', dedup_schluessel: 'nl:1', entwurf: { kanal: 'newsletter', text: 'Inhalt der Ausgabe' } }),
    ]);
    await post('person-b', { aktion: 'entscheiden', id: 'hs-b-2', status: 'angenommen', entwurf: 'Bearbeiteter Text' });
    await post('person-b', { aktion: 'entscheiden', id: 'hs-n-1', status: 'angenommen' });
    const crm = await db.loadJson<CrmBestand>('crm');
    const b = crm!.beitraege.find(x => x.id === 'bt-hs-b-2')!;
    expect(b).toMatchObject({ status: 'entwurf', text: 'Bearbeiteter Text', kanal: 'linkedin' });
    expect(b.saeule).toBeUndefined();   // unbekannte Säule wird nicht gesetzt
    expect(crm!.newsletter.find(x => x.id === 'nl-hs-n-1')).toMatchObject({ status: 'entwurf', inhalt: 'Inhalt der Ausgabe', titel: 'Novemberausgabe' });
  });

  it('Art. 14 mit Person und Frist → Aufgabe für die Marketing-Verantwortung, nie der nächste Schritt der Person', async () => {
    await stand([hv({ id: 'hs-a-1', art: 'info_art14_nachholen', titel: 'Art. 14 nachholen: a14 Beispiel', kontakt_id: 'c-a14', frist: HEUTE, dedup_schluessel: 'art14:c-a14' })]);
    const r = await post('person-a', { aktion: 'entscheiden', id: 'hs-a-1', status: 'angenommen' });
    expect(r.status).toBe(200);
    const kontakt = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-a14')!;
    expect(kontakt.naechsterSchritt).toBeUndefined();
    const t = ((await db.loadJson<{ tasks: { id: string; assignee: string }[] }>('tasks'))?.tasks ?? []).find(x => x.id === 'hd-hs-a-1');
    expect(t?.assignee).toBe('person-b');
  });

  it('Kampagne zu einem Playbook mit offenem Entwurf → der Entwurf wird weiterverwendet (Personen dazu), keine zweite Kampagne', async () => {
    await stand([hv({ id: 'hs-k-1', art: 'kampagne_planen', titel: 'Kampagne planen', dedup_schluessel: 'kampagne:reaktivierung', kampagne: { playbook: 'reaktivierung', name: 'Reaktivierung', ziel: 'x', kontakt_ids: ['c-st', 'c-a14', 'c-gesperrt'] } })]);
    const r = await post('person-b', { aktion: 'entscheiden', id: 'hs-k-1', status: 'angenommen' });
    expect(String(r.d.wohin)).toMatch(/weiterverwendet/);
    const crm = await db.loadJson<CrmBestand>('crm');
    expect(crm!.kampagnen.filter(x => x.playbook === 'reaktivierung')).toHaveLength(1);
    expect(crm!.kampagnen[0].kontaktIds).toEqual(['c-st', 'c-a14']);
  });
});

describe('B4 — Social-Läufe handeln als Marketing-Verantwortliche', () => {
  it('verantwortlichePerson: Konto der Marketing-Verantwortung, sonst Rückfall Inhaber; die Social-Läufe fragen nicht mehr fest den Inhaber', async () => {
    await kontenSaeen();
    const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
    expect(await verantwortlichePerson('marketing')).toBe('person-b');
    expect(await verantwortlichePerson('sales')).toBe('person-a');
    for (const d of ['lib/social/community-agent.ts', 'lib/social/agent-server.ts', 'lib/social/werkstatt/auto.ts']) {
      expect(quelle(d), d).not.toMatch(/inhaberSpeicher/);
      expect(quelle(d), d).toMatch(/verantwortlichePerson\('marketing'\)/);
    }
  });
});
