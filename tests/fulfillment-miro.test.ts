// ─── Fulfillment nach Kevins Miro-Standard (17.10.) — Wächter für Reise, Fluss, vier Reiter, Weiterleitungen, Kopf, Legende, Kunden-Reise ─────────────
// Kevin 17.10.: „So möchte ich das beim Fulfillment auch haben. Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar … es dupliziert sich.“
//   · Der Fall hat GENAU vier Reiter (Reise · Ziele & Wirkung · Menschen & Termine · Kunde); die acht früheren Reiter-Adressen leiten um.
//   · Der Kopf zeigt die Lage nicht doppelt (kein Strahl, keine Antwort-Kacheln — das steht in der Reise), EIN Knopf „Dem Kunden zeigen“.
//   · Reise: Phasen als EINE Zeile, je höchstens vier Kästchen (Rest „+n“), „hier“ an genau einer Stelle, Raute zwischen den Phasen, Band „Kunde“.
//   · Fluss: Start (Kreis) · Schritte · Raute mit ja/nein (Nein-Pfad = Erinnerung nur mit Kundenbeteiligung) · Gruppen nebeneinander · Abschluss am Ende.
//   · Hänger mit DENSELBEN Regeln wie das Cockpit (`wasHaengt`); die Formen-Legende steht genau einmal.
//   · Start: höchstens fünf Unter-Reiter, `u=visualisierung` leitet auf die Landkarte; die Lage ist EINE Zeile.
//   · Kunde: dieselbe Reise-Zeile (nur Daten der Positivliste), darunter höchstens „Das brauchen wir“, „Ziele“, „Nächster Termin“.
// Erfundene Daten, rein — keine Route, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));
const lese = vi.hoisted(() => ({ fall: null as unknown, cockpit: null as unknown }));
vi.mock('@/components/os/fulfillment/prozesse/daten', async orig => ({
  ...(await orig<typeof import('@/components/os/fulfillment/prozesse/daten')>()),
  useFall: () => ({ daten: lese.fall, fehler: null, laden: async () => {} }),
  useUebersichtKurz: () => ({ daten: null, fehler: null, laden: async () => {} }),
  useCockpit: () => ({ daten: lese.cockpit, fehler: null, laden: async () => {} }),
}));

import { FALL_REITER, FULFILLMENT_BEREICHE, ALTE_REITER, fallLink, fulfillmentLink, fulfillmentAusAdresse, neueAdresse, type AlterFallReiter } from '@/lib/fulfillment/adresse';
import { WEG } from '@/lib/wege';
import { reiseZeile, phasenFluss, flussKnoten, knotenHaengt, analysePhaseId, abschlussPhaseId, KAESTCHEN_MAX, type ReiseBildEingabe } from '@/lib/fulfillment/prozesse/reise-bild';
import { wasHaengt, cockpitZeile, allesWasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import { onboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { kundenReise } from '@/lib/fulfillment/kunde/bild';
import { FallKopf } from '@/components/os/fulfillment/reise/FallKopf';
import { FallReise } from '@/components/os/fulfillment/reise/FallReise';
import { ReiseBild } from '@/components/os/fulfillment/reise/ReiseBild';
import { LageStreifen } from '@/components/os/fulfillment/reise/LageStreifen';
import { KundenAnsicht } from '@/components/os/fulfillment/kunde/KundenAnsicht';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

const HEUTE = new Date().toISOString().slice(0, 10);
const JETZT = new Date().toISOString();
const vor = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const FREIGABEN = [{ id: 'F0', titel: 'Mandatsrahmen', wer: 'beide' as const }, { id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide' as const }, { id: 'F9', titel: 'Interne Prüfung', wer: 'intern' as const }];

/** Ein Fall: Vorlauf erledigt (F0 vermerkt), Analyse läuft (zwei Teilprozesse → Gruppen, ein Schritt wartet 9 Tage beim Kunden, einer überfällig, ein Mail-Baustein), Diagnose (F3), Übergabe. */
function fall(x: Partial<Fall> = {}): Fall {
  const knoten: FallKnoten[] = [
    k('w', undefined, 'Paket', 1),
    k('p1', 'w', 'Vorlauf / Onboarding', 1, { freigabe: 'F0', kundeSichtbar: true }), k('p1-a', 'p1', 'Kick-off', 1, { status: 'erledigt' }),
    k('p2', 'w', 'Analyse', 2, { kundeSichtbar: true, freigabe: 'F9' }),
    k('p2-t1', 'p2', 'Bestandsaufnahme', 1), k('p2-t1-a', 'p2-t1', 'Interviews führen', 1, { status: 'erledigt' }), k('p2-t1-b', 'p2-t1', 'Zahlen anfordern', 2, { status: 'wartet_kunde', seit: vor(9), zustaendig: 'kunde' }),
    k('p2-t1-c', 'p2-t1', 'Leitfaden schreiben', 3, { faelligAm: vor(2) }),
    k('p2-t2', 'p2', 'Dossier', 2), k('p2-t2-a', 'p2-t2', 'Dossier anlegen', 1), k('p2-t2-b', 'p2-t2', 'Begrüßung', 2), k('p2-t2-b-m', 'p2-t2-b', 'Begrüßung', 1, { bausteinId: 'fb-mail' }),
    k('p2-t2-c', 'p2-t2', 'Quellen prüfen', 3), k('p2-t2-d', 'p2-t2', 'Personenliste', 4),
    k('p3', 'w', 'Diagnose', 3, { freigabe: 'F3' }), k('p3-a', 'p3', 'Diagnosebericht', 1),
    k('p4', 'w', 'Follow-up / Übergabe', 4), k('p4-a', 'p4', 'Übergabe-Gespräch', 1),
  ];
  return {
    mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: JETZT, gestartetVon: 'pia', status: 'laeuft', knoten,
    freigaben: { F0: { am: HEUTE, von: 'pia' } }, onboarding: { willkommenGesendetAm: JETZT }, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [],
    quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: JETZT, geaendertVon: 'pia', ...x,
  };
}
const eingabe = (f: Fall = fall()): ReiseBildEingabe => ({ fall: f, freigaben: FREIGABEN, heute: HEUTE, bausteinArt: id => (id === 'fb-mail' ? 'mail' : undefined), nachsorge: { ende: null, plan: [] } });

describe('Adressen: genau vier Reiter, fünf Unter-Reiter, frühere Adressen leiten um', () => {
  it('der Fall hat genau vier Reiter, der Start höchstens fünf Unter-Reiter', () => {
    expect(FALL_REITER.map(r => r.id)).toEqual(['reise', 'ziele', 'menschen', 'kunde']);
    expect(FALL_REITER.map(r => r.label)).toEqual(['Reise', 'Ziele & Wirkung', 'Menschen & Termine', 'Kunde']);
    expect(FULFILLMENT_BEREICHE.length).toBeLessThanOrEqual(5);
    expect(FULFILLMENT_BEREICHE.map(b => b.id)).not.toContain('visualisierung');
  });
  it('alle acht früheren Reiter führen an einen der vier neuen Reiter (mit Sprung, wo es eine Stelle gibt)', () => {
    const alt: AlterFallReiter[] = ['ueberblick', 'ablauf', 'wert', 'takt', 'analyse', 'kreislauf'];
    expect(Object.keys(ALTE_REITER).sort()).toEqual([...alt].sort());
    const q = (s: string) => new URLSearchParams(s);
    for (const r of [...alt, 'menschen', 'kunde']) {
      const a = fulfillmentAusAdresse(q(`m=m-1&r=${r}`));
      expect(FALL_REITER.map(x => x.id), r).toContain(a.r);
      if ((alt as string[]).includes(r)) {
        expect(a.alt, r).toBe(true);
        const neu = neueAdresse(a)!;
        expect(neu, r).toMatch(/^\/os\/mandate\/fulfillment\?m=m-1/);
        expect(neu, r).not.toMatch(new RegExp(`r=${r}\\b`));
        expect(fulfillmentAusAdresse(q(neu.split('?')[1].split('#')[0])).alt, r).toBeUndefined();
      } else expect(a.alt, r).toBeUndefined();
    }
    expect(fallLink('m-1', 'wert')).toBe('/os/mandate/fulfillment?m=m-1&r=ziele');
    expect(fallLink('m-1', 'takt')).toBe('/os/mandate/fulfillment?m=m-1&r=menschen#stelle-takt-leiste');
    expect(fallLink('m-1', 'analyse')).toBe('/os/mandate/fulfillment?m=m-1#stelle-analyse');
    expect(fallLink('m-1', 'kreislauf')).toBe('/os/mandate/fulfillment?m=m-1#stelle-abschluss');
    expect(fallLink('m-1', 'ablauf')).toBe(fallLink('m-1'));
    expect(WEG.dossier('m-1')).toBe('/os/mandate/fulfillment?m=m-1#stelle-analyse');
    // Ein vorhandener Sprung gewinnt.
    expect(neueAdresse(fulfillmentAusAdresse(q('m=m-1&r=ablauf')), '#phase-p2')).toBe('/os/mandate/fulfillment?m=m-1#phase-p2');
    // Unsinn im Sprung fällt weg.
    expect(fallLink('m-1', 'reise', '<script>')).toBe('/os/mandate/fulfillment?m=m-1');
  });
  it('`u=visualisierung` zeigt die Landkarte und wird ersetzt; Links mit dem alten Namen führen dorthin', () => {
    const a = fulfillmentAusAdresse(new URLSearchParams('u=visualisierung'));
    expect(a.u).toBe('prozesse');
    expect(neueAdresse(a)).toBe('/os/mandate/fulfillment');
    expect(fulfillmentLink('visualisierung')).toBe('/os/mandate/fulfillment');
  });
  it('kein Link im Code nennt noch einen früheren Reiter (außer den Weiterleitungen selbst)', () => {
    const quellen = ['lib/fulfillment/prozesse/cockpit.ts', 'lib/fulfillment/prozesse/ansichten.ts', 'lib/fulfillment/prozesse/kennzahlen.ts', 'lib/fulfillment/prozesse/server.ts', 'lib/fulfillment/kunde/server.ts', 'components/os/mandate/treppe/Fortschritt.tsx', 'lib/make-one/seiten.ts'];
    for (const q of quellen) expect(readFileSync(path.join(process.cwd(), q), 'utf8'), q).not.toMatch(/WEG\.(fall\([^)]*'(ueberblick|ablauf|wert|takt|analyse|kreislauf)'|fulfillment\('visualisierung'\))/);
  });
});

describe('Reise-Zeile (Kundenjourney)', () => {
  const z = reiseZeile(eingabe());
  it('Phasen in einer Zeile, je höchstens vier Kästchen (Rest „+n“), „hier“ genau einmal', () => {
    expect(z.spalten.map(s => [s.titel, s.zustand])).toEqual([['Vorlauf / Onboarding', 'fertig'], ['Analyse', 'jetzt'], ['Diagnose', 'offen'], ['Follow-up / Übergabe', 'offen']]);
    for (const s of z.spalten) expect(s.kaestchen.length, s.titel).toBeLessThanOrEqual(KAESTCHEN_MAX);
    const analyse = z.spalten[1];
    expect(analyse.kaestchen.length + analyse.mehr).toBe(7);
    expect(analyse.mehr).toBe(3);
    const hier = z.spalten.flatMap(s => s.kaestchen).filter(x => x.zustand === 'hier');
    expect(hier).toHaveLength(1);
    expect(z.hier).toEqual({ phaseId: 'p2', id: hier[0].id });
  });
  it('Raute = Abstimmungspunkt am Ende der Phase; Band „Kunde“ zählt, was bei ihm liegt; die Phase, die er nicht sieht, ist „intern“', () => {
    expect(z.spalten[0].abstimmung).toMatchObject({ id: 'F0', gegeben: true });
    expect(z.spalten[2].abstimmung).toMatchObject({ id: 'F3', gegeben: false });
    expect(z.spalten[1].band.beimKunden).toBe(1);
    expect(z.spalten[2].band.sieht).toBe(false);
    expect(z.spalten[1].band.sieht).toBe(true);
  });
  it('Analyse hängt an der Phase „Analyse“, der Abschluss an der letzten Phase (Befähigung, Wirkungsbericht, Fall abschließen, Mandat beenden, Nachsorge)', () => {
    expect(analysePhaseId(fall())).toBe('p2');
    expect(abschlussPhaseId(fall())).toBe('p4');
    expect(z.spalten[1].analyse).toBe(true);
    expect(z.spalten[3].abschluss).toBe(true);
    const fl = phasenFluss(eingabe(), 'p4')!;
    expect(fl.abschluss.map(x => x.titel)).toEqual(['Befähigung', 'Wirkungsbericht', 'Fall abschließen', 'Mandat beenden', 'Nachsorge']);
    expect(fl.ende).toMatchObject({ titel: 'Zurück in den Kreislauf', stelle: 'kreislauf' });
  });
  it('Hänger: dieselben Regeln wie das Cockpit — jeder Knoten-Hänger im Cockpit ist ein markiertes Kästchen', () => {
    const f = fall();
    const ob = onboardingStand(f, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT });
    const h = wasHaengt({ fall: f, kunde: 'K', titel: 'T', onboarding: ob, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN });
    const knotenHaenger = h.filter(x => x.art === 'faellig' || x.art === 'freigabe' || x.art === 'wartet');
    const markiert = f.knoten.filter(x => knotenHaengt(x, f, HEUTE));
    expect(markiert.map(x => x.id).sort()).toEqual(['p2-t1-b', 'p2-t1-c']);
    expect(knotenHaenger).toHaveLength(markiert.length);
    const alle = [...z.spalten.flatMap(s => s.kaestchen), ...phasenFluss(eingabe(), 'p2')!.teile.flatMap(t => (t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten)))];
    expect(alle.find(x => x.id === 'p2-t1-b')?.haengt).toBe('gelb');
    expect(alle.find(x => x.id === 'p2-t1-c')?.haengt).toBe('gelb');
    expect(z.spalten[1].haengt).toBe('gelb');
  });
});

describe('Fluss einer Phase (F&F-Stil)', () => {
  const fl = phasenFluss(eingabe(), 'p2')!;
  it('Start als Kreis (nach dem Abstimmungspunkt davor), zwei Teilprozesse als Gruppen nebeneinander', () => {
    expect(fl.start.titel).toBe('Nach Abstimmungspunkt 1 · Mandatsrahmen');
    expect(fl.teile).toHaveLength(1);
    expect(fl.teile[0].art).toBe('gruppen');
    if (fl.teile[0].art === 'gruppen') expect(fl.teile[0].gruppen.map(g => g.titel)).toEqual(['Bestandsaufnahme', 'Dossier']);
  });
  it('Formen aus den Daten: Mail-Baustein = Nachricht; wartender Schritt mit Erinnerung (Regel „> 7 Tage = hängt“); interne Abstimmung ohne Nein-Pfad', () => {
    const alle = flussKnoten(fl);
    expect(alle.find(x => x.id === 'p2-t2-b')?.form).toBe('nachricht');
    expect(alle.find(x => x.id === 'p2-t1-b')?.erinnerung).toEqual({ titel: 'Beim Kunden nachfassen', unter: 'seit 9 Tagen — hängt' });
    expect(fl.abstimmung).toMatchObject({ form: 'entscheidung', ja: 'weiter zu Phase 3 · Diagnose' });
    expect(fl.abstimmung?.nein).toBeUndefined();
    const diagnose = phasenFluss(eingabe(), 'p3')!;
    expect(diagnose.abstimmung?.nein).toEqual({ titel: 'Beim Kunden nachfassen' });
    expect(diagnose.teile).toEqual([{ art: 'linie', knoten: [expect.objectContaining({ id: 'p3-a', titel: 'Diagnosebericht', stelle: 'analyse' })] }]);
  });
  it('die Reise und der Fluss zeigen dieselben Schritte (nie die Phase selbst)', () => {
    const z = reiseZeile(eingabe());
    for (const s of z.spalten) {
      const ids = flussKnoten(phasenFluss(eingabe(), s.id)!).map(x => x.id);
      for (const kk of s.kaestchen) expect(ids, s.titel).toContain(kk.id);
      expect(ids).not.toContain(s.id);
    }
  });
});

// ── Oberfläche ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const f0 = fall();
const ob0 = onboardingStand(f0, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT });
lese.fall = {
  inhaber: true, mandat: { id: 'm-1', titel: 'Begleitung', kunde: 'Beispiel GmbH', firmaId: null, kontaktIds: [], leistungId: null, ziele: [], gesellschaft: 'ug', status: 'aktiv', start: null, zustaendig: null, business: true },
  unterschrift: null, fall: { ...f0, knoten: f0.knoten.map(x => ({ ...x, stand: `st-${x.id}` })), stakeholder: [], entscheidungen: [] },
  onboarding: ob0, diff: null, vorlage: { id: 'v-1', titel: 'Paket', fassung: 1, freigaben: FREIGABEN, rollen: [] },
  wartet: [], wertKonto: [], fortschritt: 25, bausteine: [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail', kundeFuellt: false, nurIntern: false, rechtOffen: false, vorVerkaufOffen: false, lieferobjekt: null }],
  nachsorge: { ende: null, plan: [] },
};
const zeile = cockpitZeile({ fall: f0, kunde: 'Beispiel GmbH', titel: 'Begleitung', onboarding: ob0, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN });
lese.cockpit = { heute: HEUTE, zeilen: [zeile], haengt: allesWasHaengt([zeile]), kapa: null };

describe('Kopf und Reise rendern (ohne Browser)', () => {
  it('der Kopf zeigt die Lage NICHT doppelt: kein Strahl, keine Antwort-Kacheln — Ampel mit einem Satz, EIN Knopf „Dem Kunden zeigen“', () => {
    const html = renderToStaticMarkup(h(FallKopf, { mandatId: 'm-1' }));
    expect(html).not.toContain('Wo steht der Kunde?');
    expect(html).not.toContain('Als Nächstes');
    expect(html).not.toContain('Hängt etwas?');
    expect(html).not.toContain('Phasen des Falls');
    expect(html).toContain('2 Punkte hängen');
    expect((html.match(/>Dem Kunden zeigen</g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/ui-knopf-haupt/);
    // „Der Kunde sieht“ nur, wenn es abweicht (hier: interne Hänger → der Kunde liest „Wir sind dran“ bzw. „Wir warten …“ mit Grund).
    const ohne = renderToStaticMarkup(h(FallKopf, { mandatId: 'm-x' }));
    expect(ohne).not.toContain('Der Kunde sieht');
  });
  it('Reise: die Zeile mit „Hier“, der Fluss der laufenden Phase, das Detail des nächsten Schritts, die Formen-Legende genau einmal', () => {
    const html = renderToStaticMarkup(h(FallReise, { mandatId: 'm-1' }));
    expect(html).toContain('class="ff-reise"');
    expect(html).toContain('▾ Hier');
    expect(html).toContain('Ablauf der Phase 2: Analyse');
    expect((html.match(/data-formen-legende/g) ?? []).length).toBe(1);
    for (const t of ['Schritt', 'Nachricht', 'Abstimmung (ja / nein)', 'Erinnerung', 'Termin']) expect(html, t).toContain(t);
    expect(html).toContain('id="ff-detail"');
    expect(html).toContain('Beim Kunden nachfassen');
    expect(html).toContain('+3');
    expect(html).toContain('Analyse dieser Phase');
    expect((html.match(/ui-knopf-haupt/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it('ReiseBild: Raute zwischen den Phasen, Band „Kunde“ unten, am Handy als Liste (CSS)', () => {
    const html = renderToStaticMarkup(h(ReiseBild, { spalten: [{ id: 'a', nr: 1, titel: 'A', zustand: 'fertig', kaestchen: [], mehr: 0, raute: { titel: 'Abstimmungspunkt 1', gegeben: true } }, { id: 'b', nr: 2, titel: 'B', zustand: 'jetzt', kaestchen: [{ id: 'x', titel: 'X', zustand: 'hier' }], mehr: 2, band: { text: '1 beim Kunden', achtung: true } }] }));
    expect(html).toContain('ff-reise-zwischen');
    expect(html).toContain('Kunde');
    expect(html).toContain('1 beim Kunden');
    expect(html).toContain('+2');
    const css = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    const block = css.slice(css.indexOf('.ff-reise {'));
    expect(block).toContain('@media (max-width: 720px)');
    expect(block).toContain('.ff-reise { grid-template-columns: minmax(0, 1fr) !important; }');
    expect(block).toContain('.ff-reise-zwischen { display: none; }');
  });
  it('Start: die Lage ist EINE Zeile (keine Antwort-Kacheln)', () => {
    const html = renderToStaticMarkup(h(LageStreifen));
    expect(html).toContain('class="ff-lage"');
    expect(html).toContain('Kunden in Lieferung');
    expect(html).not.toContain('ui-karte');
  });
});

describe('Kunde: dieselbe Reise-Zeile — nur Daten der Positivliste', () => {
  const sicht = {
    modus: 'voll', anrede: 'sie', firma: 'Beispiel Werkzeugbau', mandat: 'Vertrieb', stand: '15.10.2026', fortschritt: 20,
    lage: { ampel: 'gruen', titel: 'Wir liegen im Plan', saetze: ['Satz.'] },
    zeitstrahl: [{ titel: 'Start', stand: 'erledigt', abstimmung: { titel: 'Rahmen', erledigt: true } }, { titel: 'Analyse', stand: 'aktuell', anteil: 0.4 }, { titel: 'Umsetzung', stand: 'kommt' }],
    erledigt: ['Interviews (12.10.2026)'], naechstes: ['Zahlen liefern — bis 20.10.2026', 'Leitfaden', 'Dossier', 'Quellen', 'Personen'], wartet: [{ titel: 'Zahlen liefern' }],
    wertKonto: [], quickWins: [], rituale: [], entscheidungen: [], formulare: [], upload: null, puls: null,
    datenschutz: { verantwortlich: 'Beispiel', fassung: '1', absaetze: ['Hinweis.'] },
  } as unknown as KundenSicht;
  it('das Modell nimmt nur Phasen, „als Nächstes“ und „wartet“ — höchstens vier Kästchen in der laufenden Phase', () => {
    const r = kundenReise(sicht.zeitstrahl, sicht.naechstes, sicht.wartet.length);
    expect(r.map(s => s.zustand)).toEqual(['fertig', 'jetzt', 'offen']);
    expect(r[1].kaestchen.length).toBeLessThanOrEqual(4);
    expect(r[1].kaestchen[0]).toMatchObject({ titel: 'Zahlen liefern — bis 20.10.2026', zustand: 'hier' });
    expect(r[1].mehr).toBe(1);
    expect(r[1].band?.text).toBe('1 Punkt offen');
    expect(r[0].raute).toEqual({ titel: 'Rahmen', gegeben: true });
  });
  it('die Kunden-Seite zeichnet die Reise-Zeile und darunter nur noch „Das brauchen wir“, „Ihr Ziel“, „Nächster Termin“', () => {
    const html = renderToStaticMarkup(h(KundenAnsicht, { sicht, vorschau: true }));
    expect(html).toContain('class="ff-reise');
    expect(html).toContain('hier stehen wir');
    for (const t of ['Das brauchen wir von Ihnen', 'Ihr Ziel', 'Unser Takt']) expect(html, t).toContain(t);
    expect(html).not.toContain('>Als Nächstes<');
    expect(html).not.toContain('kunde-strahl-balken');
  });
});
