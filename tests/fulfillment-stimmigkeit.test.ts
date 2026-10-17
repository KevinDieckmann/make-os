// ─── Fulfillment — Stimmigkeit: EINE Rechnung je Größe (14.10., unabhängige Abnahme A3/B6/B7/B8/B19/B20) ─────────────────────────────────────
// Die Abnahme fand dieselbe Größe mit verschiedenen Werten je Ort: „1 in der Umsetzung“ (Lage) gegen „Phase 3: Diagnose“ (Fall), „Zugeordnete Bausteine“
// (Cockpit) gegen „Diagnosebericht“ (Fall-Kopf), „23.10.“ (Health „Termine“) gegen „20.10.“ (Takt), „Von Ihnen brauchen wir gerade nichts“ neben „1 offen“,
// „Wir liegen im Plan“ neben internem Rot, Willkommen 0 % trotz ✓, Report-Takt 100 % trotz rotem Soll-Termin. Dieser Wächter sät die Demo (über die
// Routen, eigener Datenordner) und vergleicht für BEIDE Demo-Fälle: Lage, Landkarte, Cockpit, Fall-Kopf, Kunden-Ansicht und Report liefern dieselbe Phase,
// denselben Fortschritt, dasselbe „Als Nächstes“ (nie ein Sammel-Schritt) und denselben nächsten Termin; die Kunden-Ansicht sagt nie zugleich „nichts
// nötig“ und „offen“, und ihre Ampel folgt dem, was intern hängt.
// 15.10. (zweite Abnahme B1/B3): die Kunden-Lage ist NUR die Übersetzung der internen Rechnung (Health zählt nicht, interne Punkte = „Wir sind dran“,
// intern steht „Der Kunde sieht: …“ mit Grund); „Als Nächstes“ ist derselbe Punkt in Fall, Kunden-Seite, Report UND Leistungstreppe; „Was hängt“ zählt
// in Lage und Fall gleich; Termine mit Bezug zum Mandat (auch ohne Ritual) stehen im Takt, machen „Kick-off terminiert“ wahr und sind der nächste Termin.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import path from 'node:path';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-demo-stimmig-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo-stimmig', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return { wurzel };
});

import { localDay, tagePlus } from '@/lib/zeit';
import { fallReise, naechsterPunkt, istSammelSchritt } from '@/lib/fulfillment/prozesse/reise';
import { lageVerteilung, kundenAmpel, kundenLageAus, KUNDEN_LAGE_TEXT } from '@/lib/fulfillment/prozesse/darstellung';
import { allesWasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import { taktLeiste, montagVon } from '@/lib/fulfillment/prozesse/ansichten';
import { reportAchse } from '@/lib/fulfillment/prozesse/ansichten';
import { fallStartTag } from '@/lib/fulfillment/prozesse/fall';
import { brauchtAnzahl, formularOffen, kundenText, kundenPunktTitel, kundenReise } from '@/lib/fulfillment/kunde/bild';
import { onboardingZaehlung, obKnotenId } from '@/lib/fulfillment/prozesse/onboarding';
import { MUSTER_PLAYBOOK } from '@/lib/fulfillment/muster';
import { tagVon } from '@/lib/zeit';
import { SAMMEL_SCHRITT } from '@/lib/fulfillment/prozesse/phasen';
import type { CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';
import type { Fall, FallKurz, Freigabepunkt, ProzessVorlage } from '@/lib/fulfillment/typen';

type H = (r: Request) => Promise<Response>;
const lese = async (pfad: string, suche = '') => {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m.GET(new Request(`http://test/api/${pfad}${suche}`, { headers: { 'x-make-user': 'lena' } }));
  return await r.json() as Record<string, unknown>;
};

const HEUTE = localDay();
const MANDATE = ['m-demo-nordwerk', 'm-demo-lumen'] as const;
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const mitWochentag = (t: string) => `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${t}T12:00:00Z`).getUTCDay()]}, ${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

let cockpit: CockpitZeile[] = [];
let uebersicht: { faelle: Record<string, FallKurz>; zaehler: Record<string, Record<string, string[]>>; prozesse: ProzessVorlage[]; kennzahlen: { id: string; wert: number | null; n: number }[] } | null = null;
const faelle: Record<string, { fall: Fall; freigaben: Freigabepunkt[]; termine: Record<string, string | null>; reports: { am: string }[]; kalender: { uid: string; tag: string; titel?: string; ritualId?: string }[]; onboarding: { schritte: { schluessel: string; erfuellt: boolean; text: string }[] }; rituale: { id: string; titel: string; rhythmus: string; dauerMin: number }[] }> = {};
let cockpitHaengt: { mandatId: string }[] = [];
let treppe: { mandatId: string; fall: { ampel: string; schritt?: string } | null }[] = [];
const sichten: Record<string, KundenSicht> = {};
const reports: Record<string, Awaited<ReturnType<typeof import('@/lib/fulfillment/kunde/server')['reportZusatzFuer']>>> = {};

beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: HEUTE });
  const c = await lese('fulfillment/cockpit');
  cockpit = c.zeilen as CockpitZeile[];
  cockpitHaengt = c.haengt as { mandatId: string }[];
  treppe = (await lese('crm/treppe')).kunden as typeof treppe;
  uebersicht = await lese('fulfillment') as never;
  const { reportZusatzFuer } = await import('@/lib/fulfillment/kunde/server');
  for (const m of MANDATE) {
    const f = await lese('fulfillment/fall', `?m=${m}`);
    faelle[m] = { fall: f.fall as Fall, freigaben: (f.vorlage as { freigaben: Freigabepunkt[] }).freigaben, termine: f.termine as Record<string, string | null>, reports: f.reports as { am: string }[],
      kalender: (f.kalender ?? []) as typeof faelle[string]['kalender'], onboarding: f.onboarding as typeof faelle[string]['onboarding'], rituale: f.rituale as typeof faelle[string]['rituale'] };
    sichten[m] = (await lese('fulfillment/kunde/vorschau', `?m=${m}`)).sicht as KundenSicht;
    reports[m] = await reportZusatzFuer(m, HEUTE);
  }
}, 180_000);
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('Stimmigkeit der Demo-Fälle', () => {
  it('dieselbe Phase und derselbe Fortschritt: Fall-Kopf = Cockpit = Lage-Kurzform = Kunden-Ansicht = Report', () => {
    for (const m of MANDATE) {
      const { fall, freigaben } = faelle[m];
      const reise = fallReise(fall, freigaben, HEUTE);
      const jetzt = reise.phasen[reise.jetzt];
      const z = cockpit.find(x => x.mandatId === m)!;
      expect(z, m).toBeTruthy();
      expect([z.phase, z.phaseNr, z.phasenAnzahl, z.fortschritt], m).toEqual([jetzt.titel, jetzt.nr, reise.phasen.length, reise.fortschritt]);
      expect([uebersicht!.faelle[m].phase, uebersicht!.faelle[m].fortschritt], m).toEqual([jetzt.titel, reise.fortschritt]);
      // Kunden-Ansicht und Report: die laufende Phase steht IMMER da (auch wenn sie nicht geteilt ist) — mit neutralem Titel.
      const s = sichten[m];
      expect(s.zeitstrahl.find(p => p.stand === 'aktuell')?.titel, m).toBe(kundenText(jetzt.titel));
      expect(s.fortschritt ?? 0, m).toBe(reise.fortschritt);
      // In der Demo sind alle Phasen geteilt — die Kunden-Seite sagt dieselbe Nummer („Phase 1 von 11“) wie der Fall-Kopf.
      expect(s.zeitstrahl.length, m).toBe(reise.phasen.length);
      expect(s.lage!.saetze[0], m).toContain(`Phase ${jetzt.nr} von ${reise.phasen.length}`);
      expect(reports[m]!.phasen!.find(p => p.stand === 'aktuell')?.titel, m).toBe(kundenText(jetzt.titel));
      expect(reports[m]!.fortschritt ?? 0, m).toBe(reise.fortschritt);
    }
  });

  it('Nordwerk steht in der Diagnose, Lumen im Onboarding — Lage und Landkarte sagen dasselbe', () => {
    expect(cockpit.find(z => z.mandatId === 'm-demo-nordwerk')!.phase).toBe('Diagnose');
    expect(cockpit.find(z => z.mandatId === 'm-demo-lumen')!.status).toBe('onboarding');
    const lage = lageVerteilung(cockpit);
    expect(lage).toContain('1 im Onboarding');
    expect(lage).toContain('1 in Diagnose');
    expect(lage).not.toContain('Umsetzung');
    // Landkarte: Lumen auf der Etage „Onboarding“, Nordwerk auf der Etage seines Pakets (Fulfillment) — nie beide auf „Fulfillment“.
    const lk = uebersicht!.prozesse.find(p => p.art === 'landkarte')!;
    const zaehler = uebersicht!.zaehler[lk.id];
    const etage = (ort: string) => lk.knoten.find(k => k.ort === ort && !k.verweis)!.id;
    expect(zaehler[etage('fulfillment.onboarding')]).toEqual(['m-demo-lumen']);
    expect(zaehler[etage('fulfillment.prozesse')]).toEqual(['m-demo-nordwerk']);
  });

  it('dasselbe „Als Nächstes“: Fall-Kopf = Cockpit (Lage, Kunden-Karte) = Kurzform — nie ein Sammel-Schritt', () => {
    for (const m of MANDATE) {
      const { fall, freigaben } = faelle[m];
      const p = naechsterPunkt(fall, freigaben, HEUTE)!;
      expect(p, m).toBeTruthy();
      expect(istSammelSchritt({ titel: p.titel }), m).toBe(false);
      expect(cockpit.find(z => z.mandatId === m)!.schritt, m).toBe(p.titel);
      expect(uebersicht!.faelle[m].naechster, m).toBe(p.titel);
      expect(JSON.stringify(sichten[m].naechstes) + JSON.stringify(reports[m]!.naechstes), m).not.toContain(SAMMEL_SCHRITT);
    }
    expect(naechsterPunkt(faelle['m-demo-nordwerk'].fall, faelle['m-demo-nordwerk'].freigaben, HEUTE)!.titel).toBe('Diagnosebericht');
    // Lumen: das Onboarding zuerst — die überfällige Willkommensmail, nicht „Zugeordnete Bausteine“.
    expect(naechsterPunkt(faelle['m-demo-lumen'].fall, faelle['m-demo-lumen'].freigaben, HEUTE)).toMatchObject({ art: 'onboarding', schluessel: 'willkommen' });
  });

  it('derselbe nächste Termin: Takt = Cockpit = Kunden-Ansicht = Report = Health „Termine“ der Leistungstreppe', async () => {
    const m = 'm-demo-nordwerk';
    const tag = Object.values(faelle[m].termine).filter((t): t is string => !!t).sort()[0];
    expect(tag).toBeTruthy();
    expect(cockpit.find(z => z.mandatId === m)!.naechsterRitual).toBe(tag);
    expect(sichten[m].naechsterTermin?.am).toBe(mitWochentag(tag));
    expect(reports[m]!.naechsterTermin?.am).toBe(mitWochentag(tag));
    const treppe = await lese('crm/treppe');
    const zeile = (treppe.kunden as { mandatId: string; ampel: { teile: { id: string; text: string }[] } }[]).find(k => k.mandatId === m)!;
    expect(zeile.ampel.teile.find(t => t.id === 'termine')!.text).toBe(`nächster am ${kurz(tag)}`);
  });

  it('Kunden-Ansicht: nie zugleich „nichts nötig“ und „offen“; die Ampel folgt dem, was intern hängt', () => {
    for (const m of MANDATE) {
      const s = sichten[m];
      const braucht = brauchtAnzahl(s.wartet, s.formulare.filter(formularOffen).map(f => f.schluessel));
      const satz = s.lage!.saetze[2];
      if (braucht > 0) expect(satz, m).not.toMatch(/gerade nichts/);
      else expect(satz, m).toMatch(/gerade nichts/);
      if (braucht === 1) expect(satz, m).toMatch(/eine Sache/);
      const intern = cockpit.find(z => z.mandatId === m)!;
      // Was intern hängt (ohne Health — unsere Einschätzung der Beziehung) → nie „im Plan“.
      if (intern.haengt.length) expect(s.lage!.titel, m).not.toBe('Wir liegen im Plan');
      else expect(s.lage!.titel, m).toBe('Wir liegen im Plan');
      expect(reports[m]!.lage!.titel, m).toBe(s.lage!.titel);
    }
    // Lumen: Willkommensmail intern überfällig (rot) → für den Kunden „Wir sind dran“; das Playbook wartet → „eine Sache“.
    expect(kundenAmpel(cockpit.find(z => z.mandatId === 'm-demo-lumen')!)).toBe('rot');
    expect(sichten['m-demo-lumen'].lage).toMatchObject({ titel: 'Wir sind dran', ampel: 'gelb' });
    expect(sichten['m-demo-lumen'].lage!.saetze[2]).toBe('Von Ihnen brauchen wir eine Sache.');
    // Leeres Ziel: kein „vorher — → jetzt — → Ziel —“ (die Zeile baut die Oberfläche aus `wertModell`, hier die Werte).
    expect(sichten['m-demo-lumen'].wertKonto.every(w => w.vorher === '—' && w.jetzt === '—' && w.ziel === '—')).toBe(true);
  });

  it('Erfolgsmaße aus denselben Daten wie der Fall: Willkommen 1 von 2 rechtzeitig, Report-Takt = Rauten der Report-Zeitachse', () => {
    const k = (id: string) => uebersicht!.kennzahlen.find(x => x.id === id)!;
    expect([k('ff_willkommen_24h').wert, k('ff_willkommen_24h').n]).toEqual([50, 2]);
    const soll = MANDATE.flatMap(m => reportAchse({ start: fallStartTag(faelle[m].fall), heute: HEUTE, reports: faelle[m].reports }).takt.filter(t => t.tag <= HEUTE));
    expect(k('ff_report_takt').n).toBe(soll.length);
    expect(k('ff_report_takt').wert).toBe(soll.length ? (soll.filter(t => t.erfuellt).length / soll.length) * 100 : null);
    expect(soll.some(t => !t.erfuellt)).toBe(true); // die Demo-Geschichte: der erste Report kam zu spät → nie 100 %
  });

  it('Fall Nordwerk: der Starttag ist der gewählte (vor 45 Tagen, einen Tag nach der Unterschrift) — nie der Tag der Saat', () => {
    expect(fallStartTag(faelle['m-demo-nordwerk'].fall)).toBe(tagePlus(HEUTE, -45));
  });

  it('Abstimmungspunkte lückenlos nummeriert, Titel ohne internen Zusatz; Demo-Pakete heißen wie ihre Produkte', () => {
    const { fall, freigaben } = faelle['m-demo-nordwerk'];
    const nr = fallReise(fall, freigaben, HEUTE).phasen.map(p => p.freigabe?.nr).filter((x): x is number => !!x);
    expect(nr).toEqual(Array.from({ length: nr.length }, (_, i) => i + 1));
    expect(JSON.stringify(fallReise(fall, freigaben, HEUTE).phasen.map(p => p.titel))).not.toMatch(/\(nur /);
    const pakete = uebersicht!.prozesse.filter(p => p.art === 'paket').map(p => p.titel).sort();
    // 15.10. (Abnahme B4): das Paket heißt, was es liefert — der Kunde sieht nur, was zu seinem Auftrag passt.
    expect(pakete).toEqual(['Cockpit-Einführung', 'Vertriebsaufbau']);
    expect(JSON.stringify(sichten['m-demo-nordwerk'])).not.toContain('Strategie-Begleitung');
  });
});

describe('Zweite Abnahme 15.10.: EINE Lage-Rechnung, EIN nächster Schritt, EIN „Was hängt“, Termine des Kunden', () => {
  it('Ampel: der Kunde sieht die Übersetzung der internen Rechnung — ohne Health, interne Punkte „Wir sind dran“; intern steht „Der Kunde sieht“ mit Grund', () => {
    for (const m of MANDATE) {
      const z = cockpit.find(x => x.mandatId === m)!;
      const s = sichten[m];
      const anrede = s.anrede === 'du' ? 'du' : 'sie';
      // Dieselbe Regel (`kundenLageAus`) aus denselben Hängern — der Kunde liest nur die Übersetzung.
      const erwartet = kundenLageAus(z.haengt);
      expect(s.lage!.ampel, m).toBe(erwartet.ampel);
      expect(s.lage!.titel, m).toBe(KUNDEN_LAGE_TEXT[erwartet.art][anrede]);
      expect(reports[m]!.lage, m).toMatchObject({ ampel: s.lage!.ampel, titel: s.lage!.titel });
      // Intern: „Der Kunde sieht“ = dieselbe Ampel; weicht sie von der internen ab, steht der Grund dabei.
      expect(z.kundeSieht, m).toMatchObject({ ampel: erwartet.ampel, art: erwartet.art });
      if (kundenAmpel(z) !== erwartet.ampel) expect(z.kundeSieht!.grund, m).toBeTruthy();
      // Health zählt beim Kunden nie: ohne Hänger ist der Kunde grün, egal wie die Health steht.
      if (!z.haengt.length) expect(s.lage!.ampel, m).toBe('gruen');
      // Ein Punkt ohne Kundenbezug macht den Kunden nie rot.
      if (z.haengt.every(h => h.art !== 'wartet')) expect(s.lage!.ampel, m).not.toBe('rot');
      // Die Leistungstreppe übernimmt die Ampel des Falls.
      expect(treppe.find(k => k.mandatId === m)!.fall?.ampel, m).toBe(kundenAmpel(z));
    }
    // Lumen: intern rot (Willkommensmail überfällig), der Kunde liest „Wir sind dran“ — mit Grund intern.
    const lumen = cockpit.find(z => z.mandatId === 'm-demo-lumen')!;
    expect(kundenAmpel(lumen)).toBe('rot');
    expect(lumen.kundeSieht).toMatchObject({ ampel: 'gelb', titel: 'Wir sind dran' });
    expect(lumen.kundeSieht!.grund).toMatch(/interne Punkte/);
  });

  it('„Als Nächstes“: derselbe Punkt in Fall-Kopf, Cockpit, Kunden-Seite, Report und Leistungstreppe — nie die aktuelle Phase selbst', () => {
    for (const m of MANDATE) {
      const { fall, freigaben } = faelle[m];
      const p = naechsterPunkt(fall, freigaben, HEUTE)!;
      const reise = fallReise(fall, freigaben, HEUTE);
      expect(p.id, m).not.toBe(reise.phasen[reise.jetzt]?.id);
      expect(cockpit.find(z => z.mandatId === m)!.schritt, m).toBe(p.titel);
      expect(treppe.find(k => k.mandatId === m)!.fall?.schritt, m).toBe(p.titel);
      const s = sichten[m];
      const ohneFrist = (t: string | undefined) => (t ?? '').replace(/ — bis \d{2}\.\d{2}\.\d{4}$/, '');
      if (p.zustand === 'wartet_kunde') expect(s.wartet.map(w => w.titel), m).toContain(kundenText(p.titel));
      // 17.10. (dritte Abnahme B4): derselbe Punkt in Kunden-Worten (`kundenPunktTitel` — z. B. nie „Willkommen in 24 Stunden“).
      else expect(ohneFrist(s.naechstes[0]), m).toBe(kundenPunktTitel(p));
      expect(reports[m]!.naechstes?.[0], m).toBe(s.naechstes[0]);
      // Keine Phase steht unter „Als Nächstes“.
      for (const ph of reise.phasen) expect(s.naechstes.map(ohneFrist), m).not.toContain(kundenText(ph.titel));
    }
    expect(sichten['m-demo-nordwerk'].naechstes[0]).toMatch(/^Diagnosebericht/);
    expect(sichten['m-demo-lumen'].naechstes[0]).toBe('Willkommensmail mit den ersten Schritten');
  });

  it('„Was hängt“: die Lage (alle Fälle) und der Fall-Kopf (je Fall) zählen aus derselben Liste', () => {
    expect(cockpitHaengt.length).toBe(allesWasHaengt(cockpit).length);
    for (const m of MANDATE) expect(cockpitHaengt.filter(h => h.mandatId === m).length, m).toBe(cockpit.find(z => z.mandatId === m)!.haengt.length);
    // Der Fall-Kopf liest die Hänger aus dem Cockpit (keine eigene Zählung mehr) — „wartet“ unter sieben Tagen ist „im Rahmen“, kein Hänger.
    const kopf = readFileSync(path.join(process.cwd(), 'components/os/fulfillment/reise/FallKopf.tsx'), 'utf8');
    expect(kopf).toContain('zeile?.haengt');
    expect(kopf).not.toContain('wartet auf den Kunden`, unter');
  });

  it('Termine des Kunden: „Cockpit-Abstimmung Lumen“ und „Wochen-Check Nordwerk“ stehen im Takt (diese Woche), sind der nächste Termin und machen „Kick-off terminiert“ wahr', () => {
    const montag = montagVon(HEUTE);
    // Lumen: der Termin hängt an keinem Ritual — er steht unter „Weitere Termine“, ist der nächste Termin, und das Kick-off gilt als terminiert.
    const lu = faelle['m-demo-lumen'];
    expect(lu.kalender.some(t => t.titel === 'Cockpit-Abstimmung Lumen' && !t.ritualId)).toBe(true);
    const lt = taktLeiste({ rituale: lu.rituale as never, fallRituale: lu.fall.rituale, termine: lu.termine, heute: HEUTE, kalender: lu.kalender });
    expect(lt.weitere.some(t => t.titel === 'Cockpit-Abstimmung Lumen' && t.tag >= montag && t.tag <= tagePlus(montag, 6))).toBe(true);
    expect(lt.naechster?.titel).toBe('Cockpit-Abstimmung Lumen');
    expect(lu.onboarding.schritte.find(x => x.schluessel === 'kickoff')).toMatchObject({ erfuellt: true });
    expect(sichten['m-demo-lumen'].naechsterTermin?.titel).toBe('Cockpit-Abstimmung Lumen');
    expect(cockpit.find(z => z.mandatId === 'm-demo-lumen')!.naechsterRitual).toBe(lt.naechster!.tag);
    // Nordwerk: der Wochen-Check dieser Woche (Dienstag) steht als echter Termin in der Zeile „Wochen-Check“ — auch wenn er schon gelaufen ist.
    const nw = faelle['m-demo-nordwerk'];
    const nt = taktLeiste({ rituale: nw.rituale as never, fallRituale: nw.fall.rituale, termine: nw.termine, heute: HEUTE, kalender: nw.kalender });
    const wc = nt.zeilen.find(z => z.titel === 'Wochen-Check')!;
    expect(wc.tage.some(t => t.tag === tagePlus(montag, 1) && !t.erwartet)).toBe(true);
    // Die letzte Mitschrift des Wochen-Checks steht am Tag eines Wochen-Checks.
    const tageCheck = nw.kalender.filter(t => t.ritualId === wc.ritualId).map(t => t.tag);
    const mitschrift = [...nw.fall.mitschriften].filter(x => x.anlass === 'Wochen-Check').sort((a, b) => (a.am < b.am ? 1 : -1))[0];
    if (tageCheck.some(t => t <= HEUTE)) expect(tageCheck).toContain(mitschrift.am);
  });

  it('Demo Nordwerk stimmig: Wert-Konto im Kick-off festgelegt, Quick Wins im 30-Tage-Fenster, neun verschiedene Playbook-Antworten, Report ohne spätere Daten', async () => {
    const { fall } = faelle['m-demo-nordwerk'];
    const start = fallStartTag(fall);
    for (const e of Object.values(fall.wertKonto)) expect(e.festgelegtAm! <= e.messungen.map(x => x.am).sort()[0]).toBe(true);
    const k = (id: string) => uebersicht!.kennzahlen.find(x => x.id === id)!;
    expect(k('ff_wertkonto').wert).toBe(100);
    for (const q of fall.quickWins) {
      expect(q.bis <= tagePlus(start, 30), q.text).toBe(true);
      if (q.erledigtAm) expect(q.erledigtAm.slice(0, 10) <= tagePlus(start, 30), q.text).toBe(true);
    }
    const formulare = (await lese('fulfillment/kunde', '?m=m-demo-nordwerk')).formulare as { antworten?: Record<string, string> }[] | undefined;
    const antworten = Object.values(formulare?.[0]?.antworten ?? {});
    expect(antworten.length).toBe(9);
    expect(new Set(antworten).size).toBe(9);
    // Ein Report „Stand vor 14 Tagen“ kennt den Puls von heute nicht.
    const { reportZusatzFuer } = await import('@/lib/fulfillment/kunde/server');
    const alt = await reportZusatzFuer('m-demo-nordwerk', tagePlus(HEUTE, -14));
    if (alt?.puls) expect(alt.puls.am <= tagePlus(HEUTE, -14)).toBe(true);
  });
});

// ─── Dritte Abnahme 17.10. (B3–B6, C6): EINE Ampel, EIN Tag, EINE Zählung, die Mandatsakte kennt den Fall ─────────────────────────────────────────
describe('Dritte Abnahme 17.10.: Ampel, Fristen, Zählungen, Mandatsakte, Feinschliff', () => {
  it('B3: „Lage der Fälle“ im Business-Index nimmt DIESELBE Ampel wie Landkarte, Lage und Fall-Kopf', async () => {
    const { ffKennzahlenFuerIndex } = await import('@/lib/fulfillment/prozesse/server');
    const d = await ffKennzahlenFuerIndex(HEUTE);
    for (const m of MANDATE) expect(d!.zeilen.find(z => z.mandatId === m)!.health, m).toBe(kundenAmpel(cockpit.find(z => z.mandatId === m)!));
    // Lumen: intern rot (Willkommensmail überfällig) — der Index sagt dasselbe, nicht „grün“.
    expect(d!.zeilen.find(z => z.mandatId === 'm-demo-lumen')!.health).toBe('rot');
  });

  it('B4: keine verstrichene Frist und keine interne Reaktionszeit beim Kunden; intern derselbe Berliner Tag wie die Frist', async () => {
    for (const m of MANDATE) {
      for (const t of [...sichten[m].naechstes, ...(reports[m]!.naechstes ?? [])]) {
        expect(t, m).not.toMatch(/24 Stunden/);
        const bis = / — bis (\d{2})\.(\d{2})\.(\d{4})$/.exec(t);
        if (bis) expect(`${bis[3]}-${bis[2]}-${bis[1]}` >= HEUTE, `${m}: ${t}`).toBe(true);
      }
    }
    // Intern: „überfällig seit …“ = der Berliner Tag der Frist (nicht der UTC-Tag) = die Frist am Knoten.
    const lu = cockpit.find(z => z.mandatId === 'm-demo-lumen')!;
    const w = lu.haengt.find(h => h.art === 'willkommen')!;
    const f = await lese('fulfillment/fall', '?m=m-demo-lumen');
    const faellig = (f.onboarding as { willkommen: { faellig?: string } }).willkommen.faellig!;
    expect(w.seit).toBe(tagVon(faellig));
    const knoten = faelle['m-demo-lumen'].fall.knoten.find(k => k.id === obKnotenId('willkommen'));
    if (knoten?.faelligAm) expect(knoten.faelligAm).toBe(w.seit);
  });

  it('B5: der Phasen-Anteil beim Kunden hat dieselbe Grundlage wie intern („1 von 3“ = 33 %); der Onboarding-Zähler zählt überall gleich', () => {
    for (const m of MANDATE) {
      const { fall, freigaben } = faelle[m];
      const reise = fallReise(fall, freigaben, HEUTE);
      const jetzt = reise.phasen[reise.jetzt];
      const kunde = sichten[m].zeitstrahl.find(p => p.stand === 'aktuell')!;
      if (jetzt.gesamt) expect(kunde.anteil, m).toBe(Math.round((jetzt.erledigt / jetzt.gesamt) * 100) / 100);
      expect(reports[m]!.phasen!.find(p => p.stand === 'aktuell')!.anteil, m).toBe(kunde.anteil);
      // Die Reise beim Kunden sagt denselben Anteil in Worten.
      const spalte = kundenReise(sichten[m].zeitstrahl, sichten[m].naechstes, 0).find(x => x.zustand === 'jetzt')!;
      if (kunde.anteil != null) expect(spalte.unter, m).toBe(`${Math.round(kunde.anteil * 100)}\u00A0% der Schritte`);
      // Onboarding: Fall (Zähler), Fulfillment › Onboarding (`onboardingErfuellt`) und die Haken zählen dasselbe — alle Schritte.
      const z = onboardingZaehlung(faelle[m].onboarding.schritte as never);
      expect(z.gesamt, m).toBe(faelle[m].onboarding.schritte.length);
      expect(uebersicht!.faelle[m].onboardingErfuellt ?? 0, m).toBe(z.erledigt);
    }
  });

  it('B6: die Mandatsakte kennt den Fall — Phase aus dem Fall (Nummer und Titel) mit Sprung in die Reise', () => {
    for (const m of MANDATE) {
      const z = cockpit.find(x => x.mandatId === m)!;
      expect(treppe.find(k => k.mandatId === m)!.fall, m).toMatchObject({ phase: z.phase, phaseNr: z.phaseNr, phasenAnzahl: z.phasenAnzahl });
    }
    const akte = readFileSync(path.join(process.cwd(), 'components/os/crm/Kunden.tsx'), 'utf8');
    expect(akte).toContain('<FallPhase mandatId={m.id}');
    const phase = readFileSync(path.join(process.cwd(), 'components/os/mandate/treppe/Fortschritt.tsx'), 'utf8');
    expect(phase).toContain('in der Reise ›');
    expect(phase).toContain('WEG.fall(mandatId)');
  });

  it('C6: EIN klarer nächster Schritt, danach mit Kontext; Takt passt zum Paket; Report nur bis zu seinem Stand; Befähigung erst am Ende; Playbook ohne Du', async () => {
    for (const m of MANDATE) {
      const n = sichten[m].naechstes;
      expect(n.length, m).toBeGreaterThan(0);
      for (const t of n.slice(1)) expect(t, m).toMatch(/^Danach( in „[^“]+“)?: /);
    }
    // Takt: das tägliche Huddle gehört zum Vertriebsaufbau (Nordwerk), nicht zur Cockpit-Einführung (Lumen).
    const takt = (m: typeof MANDATE[number]) => { const x = faelle[m]; return taktLeiste({ rituale: x.rituale as never, fallRituale: x.fall.rituale, termine: x.termine, heute: HEUTE, kalender: x.kalender, vorlageId: x.fall.vorlageId }); };
    expect(takt('m-demo-lumen').zeilen.some(z => z.rhythmus === 'werktags')).toBe(false);
    expect(takt('m-demo-nordwerk').zeilen.some(z => z.rhythmus === 'werktags')).toBe(true);
    // Ein Report „Stand vor 14 Tagen“ zeigt nur Messwerte bis dahin.
    const { reportZusatzFuer } = await import('@/lib/fulfillment/kunde/server');
    const stand = tagePlus(HEUTE, -14);
    const alt = await reportZusatzFuer('m-demo-nordwerk', stand);
    const nw = faelle['m-demo-nordwerk'].fall;
    for (const z of alt!.wertKonto) {
      const e = nw.wertKonto[z.zielId];
      const bis = (e?.messungen ?? []).filter(x => tagVon(x.am) <= stand).sort((a, b) => (a.am < b.am ? -1 : 1)).at(-1);
      if (bis) expect(z.jetzt.startsWith(String(bis.wert)), z.name).toBe(true);
    }
    // Befähigung „läuft ohne uns“: in Phase 3 von 8 noch nichts erfüllt.
    expect(nw.befaehigung.some(b => b.erfuellt)).toBe(false);
    // Das Playbook steht beim Kunden in der Anrede des Mandats — die Fragen tragen keine Anrede.
    for (const q of MUSTER_PLAYBOOK.fragen ?? []) expect(q.frage).not.toMatch(/\b(euer|eure|euren|eurem|ihr|habt|tretet|Ihr|Ihre|Sie)\b/);
    // Der Report-Zeitstrahl beginnt mit dem Fallstart.
    expect(readFileSync(path.join(process.cwd(), 'components/os/fulfillment/kunde/FallKunde.tsx'), 'utf8')).toContain('links={`Fallstart ${tagKurz(achse.von)}`}');
  });
});
