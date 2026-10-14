// ─── Fulfillment — Stimmigkeit: EINE Rechnung je Größe (14.10., unabhängige Abnahme A3/B6/B7/B8/B19/B20) ─────────────────────────────────────
// Die Abnahme fand dieselbe Größe mit verschiedenen Werten je Ort: „1 in der Umsetzung“ (Lage) gegen „Phase 3: Diagnose“ (Fall), „Zugeordnete Bausteine“
// (Cockpit) gegen „Diagnosebericht“ (Fall-Kopf), „23.10.“ (Health „Termine“) gegen „20.10.“ (Takt), „Von Ihnen brauchen wir gerade nichts“ neben „1 offen“,
// „Wir liegen im Plan“ neben internem Rot, Willkommen 0 % trotz ✓, Report-Takt 100 % trotz rotem Soll-Termin. Dieser Wächter sät die Demo (über die
// Routen, eigener Datenordner) und vergleicht für BEIDE Demo-Fälle: Lage, Landkarte, Cockpit, Fall-Kopf, Kunden-Ansicht und Report liefern dieselbe Phase,
// denselben Fortschritt, dasselbe „Als Nächstes“ (nie ein Sammel-Schritt) und denselben nächsten Termin; die Kunden-Ansicht sagt nie zugleich „nichts
// nötig“ und „offen“, und ihre Ampel folgt dem, was intern hängt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

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
import { lageVerteilung, kundenAmpel } from '@/lib/fulfillment/prozesse/darstellung';
import { reportAchse } from '@/lib/fulfillment/prozesse/ansichten';
import { fallStartTag } from '@/lib/fulfillment/prozesse/fall';
import { brauchtAnzahl, formularOffen, kundenText } from '@/lib/fulfillment/kunde/bild';
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
const faelle: Record<string, { fall: Fall; freigaben: Freigabepunkt[]; termine: Record<string, string | null>; reports: { am: string }[] }> = {};
const sichten: Record<string, KundenSicht> = {};
const reports: Record<string, Awaited<ReturnType<typeof import('@/lib/fulfillment/kunde/server')['reportZusatzFuer']>>> = {};

beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: HEUTE });
  cockpit = (await lese('fulfillment/cockpit')).zeilen as CockpitZeile[];
  uebersicht = await lese('fulfillment') as never;
  const { reportZusatzFuer } = await import('@/lib/fulfillment/kunde/server');
  for (const m of MANDATE) {
    const f = await lese('fulfillment/fall', `?m=${m}`);
    faelle[m] = { fall: f.fall as Fall, freigaben: (f.vorlage as { freigaben: Freigabepunkt[] }).freigaben, termine: f.termine as Record<string, string | null>, reports: f.reports as { am: string }[] };
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
    expect(pakete).toEqual(['Cockpit-Einführung', 'Strategie-Begleitung']);
  });
});
