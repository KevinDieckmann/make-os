// ─── Fulfillment C1 — reine Regeln (10.10.; FULFILLMENT_KONZEPT.md 2, 3, 5.1, 5.3, 6.2, 6.3, 7, 8) ─────────────────────────────────────
// Vorlagen-Ops (Muster idempotent, Struktur-Regeln, Zuordnung nur Paket, Kunden-Link nur Inhaber), Import (Formate, unbekannte Felder,
// nur intern / vor Verkauf prüfen, nie Links/Preise, nur leere Felder ergänzen, idempotent, Rückgängig), Fall (Kopie + Onboarding,
// abgeleitete Schritte, Freigaben, Wert-Konto, Diff ohne Entfernen), Zeichnungen deterministisch, Cockpit, Wirkungsbericht ohne Internes.
// Erfundene Daten, kein Netz, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen } from '@/lib/fulfillment/lesen';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import { vorlagenAnwenden, type VorlagenKontext } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { importLesen, importVorschau, importAnwenden, importRueckgaengig } from '@/lib/fulfillment/prozesse/import';
import { nurIntern, fuerKundenFrei, TAG_NUR_INTERN, TAG_VOR_VERKAUF, MESSE_NACHFASS_TAGE } from '@/lib/fulfillment/prozesse/bausteine';
import { fallStarten, fallAnwenden, vorlagenDiff, vorlageUebernehmen, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { onboardingStand, fallWirksam, willkommenMail, willkommenVorlage, WILLKOMMEN_GERUEST, OB_PRAEFIX, type OnboardingAbleitung } from '@/lib/fulfillment/prozesse/onboarding';
import { zielErreichung, wertReihe } from '@/lib/fulfillment/prozesse/wert';
import { landkarteLage } from '@/lib/fulfillment/prozesse/landkarte';
import { ablaufLage, ablaufListe } from '@/lib/fulfillment/prozesse/ablauf-bild';
import { wasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import { wirkungsDokument } from '@/lib/fulfillment/prozesse/wirkung';
import { ritualVorgabe, mitschriftAlsAufgabe } from '@/lib/fulfillment/prozesse/rituale';
import { ffKennzahlenRechnen } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { Fall, VorlagenDatei, ProzessVorlage } from '@/lib/fulfillment/typen';

const JETZT = '2026-10-10T09:00:00.000Z';
const HEUTE = '2026-10-10';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
/** Kennungen wie im Betrieb eindeutig (dort `neueKennung`) — ein Zähler für alle Aufrufe. */
function zaehler() { return (p: string) => `${p}-t${++N}`; }
const vk = (x: Partial<VorlagenKontext> = {}): VorlagenKontext => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: stand, neueId: zaehler(), inhaber: true, ...x });
function ok<D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D {
  if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
  return r.datei;
}
const mitMuster = () => ok(vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], vk()));
const paketVon = (d: VorlagenDatei) => d.prozesse.find(p => p.art === 'paket' && p.titel === MUSTER_P1.titel)!;

// ── Vorlagen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Vorlagen: Muster, Struktur, Zuordnung', () => {
  it('„Aus Muster anlegen“ legt Landkarte, drei Pakete, Rituale und Playbook an — ein zweites Mal ändert nichts', () => {
    const d = mitMuster();
    expect(d.prozesse.filter(p => p.art === 'paket')).toHaveLength(3);
    expect(d.prozesse.filter(p => p.art === 'landkarte')).toHaveLength(1);
    expect(d.rituale.length).toBeGreaterThanOrEqual(4);
    expect(d.bausteine.some(b => b.art === 'formular')).toBe(true);
    const r = vorlagenAnwenden(d, [{ op: 'aus-muster' }], vk());
    expect(r.ok && r.geaendert).toEqual([]);
    // Jede Vorlage hat genau eine Wurzel.
    for (const p of d.prozesse) expect(p.knoten.filter(k => !k.elternId)).toHaveLength(1);
  });

  it('Knoten anlegen und verschieben — ein Kreis wird abgelehnt, nichts gespeichert', () => {
    const d = mitMuster();
    const p = paketVon(d);
    const wurzel = p.knoten.find(k => !k.elternId)!;
    const phase = p.knoten.find(k => k.elternId === wurzel.id)!;
    const d2 = ok(vorlagenAnwenden(d, [{ op: 'knoten', vorlageId: p.id, eintrag: { elternId: phase.id, titel: 'Zusatzschritt' } }], vk()));
    const neu = paketVon(d2).knoten.find(k => k.titel === 'Zusatzschritt')!;
    expect(neu.elternId).toBe(phase.id);
    expect(paketVon(d2).fassung).toBe(p.fassung + 1);
    const kreis = vorlagenAnwenden(d2, [{ op: 'knoten', vorlageId: p.id, eintrag: { id: phase.id, elternId: neu.id }, stand: stand(paketVon(d2).knoten.find(k => k.id === phase.id)!) }], vk());
    expect(kreis.ok).toBe(false);
  });

  it('Produkt ↔ Vorlage: nur Paket-Vorlagen, nur bekannte Produkte; Kunden-Link-Schalter nur Inhaber (403)', () => {
    const d = mitMuster();
    const landkarte = d.prozesse.find(p => p.art === 'landkarte')!;
    expect(vorlagenAnwenden(d, [{ op: 'zuordnung', leistungId: 'l-1', vorlageId: landkarte.id }], vk()).ok).toBe(false);
    const fremd = vorlagenAnwenden(d, [{ op: 'zuordnung', leistungId: 'l-unbekannt', vorlageId: paketVon(d).id }], vk({ leistungen: ['l-1'] }));
    expect(fremd).toMatchObject({ ok: false, status: 404 });
    const d2 = ok(vorlagenAnwenden(d, [{ op: 'zuordnung', leistungId: 'l-1', vorlageId: paketVon(d).id }], vk({ leistungen: ['l-1'] })));
    expect(d2.zuordnung['l-1']).toEqual({ vorlageId: paketVon(d).id });
    expect(vorlagenAnwenden(d, [{ op: 'einstellungen', felder: { kundenLink: { an: true } } }], vk({ inhaber: false }))).toMatchObject({ ok: false, status: 403 });
  });

  it('Baustein „nur intern“ geht nie an Kunden; „vor Verkauf prüfen“ fragt bis zur Prüfung zurück', () => {
    const d = ok(vorlagenAnwenden(leerVorlagen(), [
      { op: 'baustein', eintrag: { art: 'dokument', titel: 'Interne Vorbereitung', nurIntern: true, kundeSichtbar: true } },
      { op: 'baustein', eintrag: { art: 'workbook', titel: 'Fremdes Raster', tags: [TAG_VOR_VERKAUF], kundeSichtbar: true } },
    ], vk()));
    const [intern, fremd] = d.bausteine;
    expect(nurIntern(intern)).toBe(true);
    expect(intern.kundeSichtbar).toBe(false);
    expect(fuerKundenFrei(intern, d).frei).toBe(false);
    expect(fuerKundenFrei(fremd, d)).toMatchObject({ frei: true, rueckfrage: true });
    const d2 = ok(vorlagenAnwenden(d, [{ op: 'urheber-geprueft', id: fremd.id }], vk()));
    expect(fuerKundenFrei(fremd, d2)).toMatchObject({ frei: true, rueckfrage: false });
  });
});

// ── Import ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const BAUSTEINE = {
  vorlagen: [
    { id: 'probe-skript', art: 'skript', titel: 'Leitfaden', zweck: 'Bedarf verstehen.', unterphase: 'skripte', pakete: ['sales-systematik'], quelle: ['D4', 'https://example.invalid/x'], link: 'https://example.invalid/y', instanzwerte: { preis: 1234 }, unbekanntesFeld: { egal: true } },
    { id: 'probe-intern', art: 'dokument', titel: 'Interne Notiz', nur_intern: true, pakete: ['hos-cso', 'sales-systematik'] },
    { id: 'probe-fremd', art: 'workbook', titel: 'Gekauftes Raster', pruefen_vor_verkauf: true },
    { id: 'probe-mail', art: 'mail', titel: 'Danke-Mail', text: 'Betreff: Danke\n\nHallo.' },
    { id: 'kaputt', art: 'erfunden', titel: 'Unbekannte Art' },
  ],
};
const ABLAUF = {
  egal: {
    titel: 'Probe-Ablauf', form: 'trichter',
    stufen: [{ id: 'a', name: 'Start', art: 'einstieg' }, { id: 'b', name: 'Mitte' }, { id: 'c', name: 'Ergänzt', herkunft: 'ergaenzung' }, { id: 'd', name: 'Ende', art: 'ausstieg' }],
    uebergaenge: [{ von: 'a', nach: 'b', art: 'vorwaerts' }, { von: 'b', nach: 'c', art: 'vorwaerts', herkunft: 'ergaenzung' }, { von: 'c', nach: 'd', art: 'vorwaerts' }, { von: 'c', nach: 'b', art: 'rueckweg', bedingung: 'Einwand' }],
  },
};
const ik = (laufId = 'fi-1') => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, datei: 'probe.json', laufId });
/** Knoten-Kennungen beim Import (dort `neueKennung('fk')`). */
const kid = () => `fk-i${++N}`;

describe('Import: Bausteine und Abläufe', () => {
  it('liest das Format tolerant: unbekannte Felder egal, Fehler je Eintrag, Marken als Schlagworte, nie Links oder Preise', () => {
    const g = importLesen(BAUSTEINE);
    expect(g.format).toBe('bausteine');
    expect(g.bausteine.map(b => b.b.id)).toEqual(['fb-imp-probe-skript', 'fb-imp-probe-intern', 'fb-imp-probe-fremd', 'fb-imp-probe-mail']);
    expect(g.fehler.join(' ')).toMatch(/kaputt/);
    const skript = g.bausteine[0];
    expect(skript.quelleIds).toEqual(['D4']);
    expect(skript.recht).toMatch(/rechtlich prüfen/);
    expect(JSON.stringify(skript.b)).not.toMatch(/https|1234|unbekannt/);
    expect(g.bausteine[1].b.tags).toContain(TAG_NUR_INTERN);
    expect(g.bausteine[2].b.tags).toContain(TAG_VOR_VERKAUF);
    expect(g.bausteine[2].urheber).toMatch(/vor Verkauf prüfen/);
    expect(g.bausteine[3].recht).toMatch(/UWG/);
  });

  it('übernimmt idempotent: zweiter Lauf ändert nichts; eine Datei füllt nur leere Felder, Abweichendes nur mit Haken', () => {
    const d1 = ok(importAnwenden(leerVorlagen(), BAUSTEINE, {}, ik(), kid));
    expect(d1.bausteine).toHaveLength(4);
    expect(d1.bausteine.find(b => b.id === 'fb-imp-probe-skript')!.rechtPruefen).toBeTruthy();
    const v = importVorschau(BAUSTEINE, d1, 'probe.json');
    expect(v.zaehler.gleich).toBe(4);
    const d2 = ok(importAnwenden(d1, BAUSTEINE, {}, ik('fi-2'), kid));
    expect(d2.bausteine).toEqual(d1.bausteine);
    const geaendert = { vorlagen: [{ id: 'probe-intern', art: 'dokument', titel: 'Anderer Titel', zweck: 'Neu ergänzt.' }] };
    const d3 = ok(importAnwenden(d1, geaendert, {}, ik('fi-3'), kid));
    const b3 = d3.bausteine.find(b => b.id === 'fb-imp-probe-intern')!;
    expect(b3.titel).toBe('Interne Notiz');
    expect(b3.zweck).toBe('Neu ergänzt.');
    const d4 = ok(importAnwenden(d1, geaendert, { nehmen: { 'fb-imp-probe-intern': true } }, ik('fi-4'), kid));
    expect(d4.bausteine.find(b => b.id === 'fb-imp-probe-intern')!.titel).toBe('Anderer Titel');
  });

  it('Rückgängig nimmt nur heraus, was der Lauf neu angelegt hat', () => {
    const d1 = ok(importAnwenden(leerVorlagen(), BAUSTEINE, {}, ik('fi-r'), kid));
    const r = importRueckgaengig(d1, 'fi-r', JETZT);
    expect(r.ok).toBe(true);
    expect(r.ok && r.datei.bausteine).toEqual([]);
    expect(r.bericht?.entfernt).toBe(4);
  });

  it('ein Ablauf wird eine Vorlage „ablauf“: eine Wurzel, Stufen als Knoten, Übergänge, Ergänzung gestrichelt — Zeichnung deterministisch', () => {
    const d = ok(importAnwenden(leerVorlagen(), ABLAUF, {}, ik(), kid));
    const v = d.prozesse[0];
    expect(v).toMatchObject({ art: 'ablauf', titel: 'Probe-Ablauf', form: 'trichter' });
    expect(v.knoten.filter(k => !k.elternId)).toHaveLength(1);
    expect(v.knoten.filter(k => k.elternId)).toHaveLength(4);
    expect(v.knoten.find(k => k.titel === 'Ergänzt')!.beleg).toBe('ergaenzung');
    expect(v.uebergaenge.map(u => u.art).sort()).toEqual(['rueckweg', 'weiter', 'weiter', 'weiter']);
    expect(JSON.stringify(v)).not.toMatch(/egal/);   // der Datei-Schlüssel wird nie übernommen
    const a = ablaufLage(v, 900), b = ablaufLage(v, 900);
    expect(a).toEqual(b);
    expect(a.kanten.filter(k => k.gestrichelt).length).toBeGreaterThan(0);
    expect(ablaufListe(v).map(s => s.titel)).toEqual(['Start', 'Mitte', 'Ergänzt', 'Ende']);
    // derselbe Ablauf noch einmal: gleich, keine zweite Vorlage
    const d2 = ok(importAnwenden(d, ABLAUF, {}, ik('fi-2'), kid));
    expect(d2.prozesse).toHaveLength(1);
  });

  it('Messe-Nachfasstakt ist Tag 1, 3, 7, 14, 30', () => {
    expect(MESSE_NACHFASS_TAGE).toEqual([1, 3, 7, 14, 30]);
  });
});

// ── Fall ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ZIELE = [{ id: 'z-1', text: 'Mehr Termine' }];
const fk = (x: Partial<FallKontext> = {}): FallKontext => ({
  person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: stand, neueId: zaehler(), ziele: ZIELE, kontaktErlaubt: id => id !== 'c-gesperrt',
  ritualIds: ['fr-kickoff', 'fr-woche'], freigaben: ['F0', 'F1', 'F2', 'F3'], ...x,
});
const abl = (x: Partial<OnboardingAbleitung> = {}): OnboardingAbleitung => ({ ziele: ZIELE, formularProzent: null, kickoffRitualIds: ['fr-kickoff'], willkommenStunden: 24, jetzt: JETZT, ...x });
function neuerFall(v: ProzessVorlage = MUSTER_P1): Fall {
  return fallStarten({ mandatId: 'm-probe', vorlage: v, person: 'pia', jetzt: JETZT, start: '2026-10-01', neueId: zaehler() });
}

describe('Fall: Kopie der Vorlage, Onboarding abgeleitet, Freigaben, Wert-Konto', () => {
  it('Start kopiert die Struktur und legt die acht Onboarding-Schritte und vier Befähigungs-Kriterien an', () => {
    const f = neuerFall();
    expect(f.vorlageFassung).toBe(MUSTER_P1.fassung);
    expect(f.knoten.filter(k => k.id.startsWith(OB_PRAEFIX) && k.elternId).length).toBeGreaterThanOrEqual(8);
    expect(f.befaehigung).toHaveLength(4);
    expect(f.status).toBe('onboarding');
  });

  it('Onboarding-Schritte und Freigabe-Schritte sind nie von Hand „erledigt“; „entfällt“ nur mit Grund', () => {
    const f = neuerFall();
    expect(fallAnwenden(f, [{ op: 'knoten-status', id: `${OB_PRAEFIX}willkommen`, status: 'erledigt' }], fk()).ok).toBe(false);
    expect(fallAnwenden(f, [{ op: 'knoten-status', id: `${OB_PRAEFIX}playbook`, status: 'entfaellt' }], fk()).ok).toBe(false);
    expect(fallAnwenden(f, [{ op: 'knoten-status', id: `${OB_PRAEFIX}playbook`, status: 'entfaellt', grund: 'Kein Playbook nötig' }], fk()).ok).toBe(true);
    const mitFreigabe = f.knoten.find(k => k.freigabe);
    if (mitFreigabe) expect(fallAnwenden(f, [{ op: 'knoten-status', id: mitFreigabe.id, status: 'erledigt' }], fk()).ok).toBe(false);
  });

  it('Stakeholder nur aus der Kartei (eingeschränkte Personen nie); alles oder nichts', () => {
    const f = neuerFall();
    const r = fallAnwenden(f, [{ op: 'willkommen-gesendet' }, { op: 'stakeholder', eintrag: { kontaktId: 'c-gesperrt', rolle: 'entscheider', einfluss: 3 } }], fk());
    expect(r.ok).toBe(false);
  });

  it('das Onboarding ist fertig, wenn alle Bedingungen erfüllt sind — danach „läuft“ der Fall (abgeleitet, nicht gespeichert)', () => {
    const f = ok(fallAnwenden(neuerFall(), [
      { op: 'willkommen-gesendet' },
      { op: 'stakeholder', eintrag: { kontaktId: 'c-1', rolle: 'entscheider', einfluss: 3 } },
      { op: 'vereinbarung', felder: { rollen: 'Klar', bestaetigtAm: HEUTE, bestaetigtWie: 'kickoff' } },
      { op: 'wert-ziel', zielId: 'z-1', felder: { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine', zielBis: '2026-12-31', festlegen: true } },
      { op: 'entscheidung', eintrag: { titel: 'Zielgruppe', status: 'entschieden', wer: 'beide', geteilt: true } },
      { op: 'ritual-merken', ritualId: 'fr-kickoff', terminUid: 'uid-kickoff' },
      { op: 'freigabe', id: 'F0', kunde: { wie: 'kickoff', am: HEUTE } },
      { op: 'knoten-status', id: `${OB_PRAEFIX}playbook`, status: 'entfaellt', grund: 'Im Kick-off besprochen' },
    ], fk()));
    expect(f.status).toBe('onboarding');
    const st = onboardingStand(f, abl());
    expect(st.offen).toBe(0);
    expect(st.fertig).toBe(true);
    const w = fallWirksam(f, abl());
    expect(w.status).toBe('laeuft');
    expect(w.knoten.find(k => k.id === `${OB_PRAEFIX}willkommen`)!.status).toBe('erledigt');
    expect(f.knoten.find(k => k.id === `${OB_PRAEFIX}willkommen`)!.status).not.toBe('erledigt');
  });

  it('Willkommensmail: 24 Stunden nach der Unterschrift überfällig, Platzhalter gefüllt, ohne Playbook-Link fällt der Absatz weg', () => {
    const st = onboardingStand(neuerFall(), abl({ unterschrift: '2026-10-08' }));
    expect(st.willkommen.ueberfaellig).toBe(true);
    const vorlage = willkommenVorlage([{ id: 'fb-w', art: 'mail', titel: 'Willkommen', text: WILLKOMMEN_GERUEST.Sie, tags: ['willkommen', 'sie'], gliederung: [], platzhalter: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: JETZT, geaendertVon: 'pia' }], 'Sie');
    expect(vorlage).not.toBeNull();
    const m = willkommenMail(vorlage!.text!, { anrede: 'Sie', nachname: 'Probe', kickoffVorschlaege: ['Mo., 12.10., 10:00'] });
    expect(m.betreff).toMatch(/Willkommen/);
    expect(m.text).toMatch(/12\.10\./);
    expect(m.text).not.toMatch(/\{\{|Playbook auszufüllen/);
  });

  it('Freigabe vermerken hakt die Schritte mit dieser Freigabe ab; Messungen ergeben die Zielerreichung', () => {
    const f0 = neuerFall();
    const mitF1 = f0.knoten.find(k => k.freigabe === 'F1');
    const f = ok(fallAnwenden(f0, [
      { op: 'freigabe', id: 'F1', kunde: { wie: 'mail', am: HEUTE } },
      { op: 'wert-ziel', zielId: 'z-1', felder: { ausgangZahl: 4, zielZahl: 12, einheit: 'Termine', zielBis: '2026-12-31' } },
      { op: 'wert-messung', zielId: 'z-1', wert: 8, am: '2026-10-05' },
    ], fk()));
    if (mitF1) expect(f.knoten.find(k => k.id === mitF1.id)!.status).toBe('erledigt');
    expect(f.freigaben.F1).toMatchObject({ von: 'pia', kunde: { wie: 'mail' } });
    expect(zielErreichung(f.wertKonto['z-1'])).toBe(50);
    expect(wertReihe(f.wertKonto['z-1']).punkte.at(-1)).toMatchObject({ wert: 8, am: '2026-10-05' });
    expect(fallAnwenden(f, [{ op: 'wert-ziel', zielId: 'z-fremd', felder: { zielZahl: 1 } }], fk()).ok).toBe(false);
    expect(fallAnwenden(f, [{ op: 'wert-messung', zielId: 'z-1', wert: 9, am: '2027-01-01' }], fk()).ok).toBe(false);
  });

  it('eine neue Fassung der Vorlage: Diff nennt Neues, Übernehmen entfernt nie etwas', () => {
    const f = neuerFall();
    const wurzel = MUSTER_P1.knoten.find(k => !k.elternId)!;
    const v2: ProzessVorlage = { ...MUSTER_P1, fassung: MUSTER_P1.fassung + 1, knoten: [...MUSTER_P1.knoten.filter(k => k.id !== MUSTER_P1.knoten[MUSTER_P1.knoten.length - 1].id), { id: 'fk-neu', elternId: wurzel.id, titel: 'Neue Phase', rang: 99 }] };
    const diff = vorlagenDiff(f, v2)!;
    expect(diff.neu.map(n => n.titel)).toEqual(['Neue Phase']);
    expect(diff.entfernt).toHaveLength(1);
    const f2 = vorlageUebernehmen(f, v2, JETZT, 'pia');
    expect(f2.knoten.some(k => k.titel === 'Neue Phase')).toBe(true);
    expect(f2.knoten.length).toBe(f.knoten.length + 1);
    expect(f2.vorlageFassung).toBe(v2.fassung);
  });
});

// ── Zeichnung, Cockpit, Wirkung, Takt ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('Landkarte, Cockpit, Wirkungsbericht, Rituale', () => {
  it('Landkarte: gleiche Eingabe → gleiche Lage; jeder Kasten führt irgendwohin', () => {
    const d = mitMuster();
    const lk = d.prozesse.find(p => p.art === 'landkarte')!;
    const a = landkarteLage(lk, {}, 960), b = landkarteLage(lk, {}, 960);
    expect(a).toEqual(b);
    expect(a.kaesten.length).toBeGreaterThan(3);
    for (const k of a.kaesten) expect(k.href).toMatch(/^\/os\//);
  });

  it('Cockpit: überfällige Willkommensmail steht rot ganz oben', () => {
    const f = neuerFall();
    const h = wasHaengt({ fall: f, kunde: 'Probe AG', titel: 'Probe', onboarding: onboardingStand(f, abl({ unterschrift: '2026-10-08' })), health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE });
    expect(h[0]).toMatchObject({ art: 'willkommen', schwere: 'rot' });
  });

  it('Wirkungsbericht: nie interne Bausteine, nie Onboarding-Schritte; ein Zitat nur mit Einwilligung', () => {
    const f0 = neuerFall();
    const blatt = f0.knoten.find(k => k.elternId && !k.id.startsWith(OB_PRAEFIX) && !k.freigabe && !f0.knoten.some(x => x.elternId === k.id))!;
    const f: Fall = { ...f0, knoten: f0.knoten.map(k => (k.id === blatt.id ? { ...k, status: 'erledigt' as const, kundeSichtbar: true, bausteinId: 'fb-intern' } : k.id === `${OB_PRAEFIX}willkommen` ? { ...k, status: 'erledigt' as const, kundeSichtbar: true } : k)) };
    const mandat = { kunde: 'Probe AG', titel: 'Probe', ziele: ZIELE, start: '2026-10-01' };
    const intern = wirkungsDokument({ fall: f, mandat, heute: HEUTE, bausteine: [{ id: 'fb-intern', tags: [TAG_NUR_INTERN] }] });
    expect(intern.lieferobjekte).toEqual([]);
    const sichtbar = wirkungsDokument({ fall: f, mandat, heute: HEUTE, bausteine: [{ id: 'fb-intern', tags: [] }], zitat: { text: 'Hilfreich', einwilligungAm: '', wie: '' } });
    expect(sichtbar.lieferobjekte).toHaveLength(1);
    expect(sichtbar.zitat).toBeUndefined();
    expect(sichtbar.hinweis).toMatch(/keine Garantie/);
  });

  it('Ritual-Termin: Vorbelegung für den vorhandenen Kalender-Dialog; Mitschrift als Aufgabe mit Mandats-Bezug', () => {
    const v = ritualVorgabe({ titel: 'Wochen-Check', dauerMin: 15, rhythmus: 'woche' }, { mandatId: 'm-probe', kunde: 'Probe AG', heute: '2026-10-09', gaeste: [] });
    expect(v.vorgabe).toMatchObject({ tag: '2026-10-12', von: '10:00', bis: '10:15', titel: 'Wochen-Check · Probe AG', crm: { mandatId: 'm-probe' } });
    expect(v.wiederholung).toBe('wöchentlich');
    expect(mitschriftAlsAufgabe({ anlass: 'A', ergebnis: 'E', naechster: 'N', frist: '2026-10-20' }, 'm-probe')).toMatchObject({ title: 'N', dueDate: '2026-10-20', bezug: { mandatId: 'm-probe' } });
  });

  it('Erfolgsmaße ohne Fälle: nur Lücken, nie eine erfundene Zahl', () => {
    for (const k of ffKennzahlenRechnen([], { heute: HEUTE, jetzt: JETZT, willkommenStunden: 24 })) {
      expect(k.wert).toBeNull();
      expect(k.erklaerung).toMatch(/^fulfillment\.kennzahl\./);
    }
  });
});
