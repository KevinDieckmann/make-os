// ─── Markttraktion als Hub (22.10., Kevins Entscheidungen) — Menü, leuchtender Punkt, Auswertung mit Flow ─────────────────────────────────
// Kevin 22.10.: Markttraktion wird ein eigenes Werkzeug (HubSpot-Art) — Menü mit Gruppen statt Reiterzeile, Schnellknöpfen und Zahnrad;
// „Auswertung als eigener Punkt — an die Markttraktion-Kennzahlen anlegen, dann haben wir auch einen geilen Flow“; „+ Angebot“ in den Akten.
// Geprüft wird: das Menü als Daten (Gruppen, Ziele, Symbole), `punktVon`/`hubOrtFuer` (jede Adresse leuchtet genau einen Punkt), die Auswertung
// (jede Zahl = die vorhandene Rechnung, ohne Daten grau, nie eine erfundene Null) und die Seite (Hub statt Reiter, „+ Angebot“, das Menü ist die
// Werkzeug-Leiste — das Werkzeug selbst prüft tests/werkzeuge.test.ts).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Angebot, Chance, CrmBestand } from '@/lib/crm/typen';
import {
  HUB_MENUE, HUB_PUNKTE, punktVon, hubOrtFuer, hubGruppenAnzeige, aufloesen, markttraktion, angebotLink, qualifizierungLink, planungLink, auswertungLink,
  BEREICHE, NETZWERKEN_PFAD, PFAD, type HubSymbol,
} from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';
import { leads, trichter, passtLeadFilter, mqlErreicht } from '@/lib/crm/leads';
import { auswertungFlow, auswertungSpalten, flowZiel, flowLink, zahlText } from '@/lib/crm/auswertung-flow';
import { HUB_SYMBOLE } from '@/lib/crm/hub-symbole';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

describe('Hub-Menü — die Liste als Daten', () => {
  it('Kevins Gruppen und Punkte in seiner Reihenfolge; Fuß Stammdaten; „Automationen & Head“ unter Steuerung', () => {
    expect(HUB_MENUE.gruppen.map(g => [g.titel, g.punkte.map(p => p.name)])).toEqual([
      [null, ['Überblick']],
      ['CRM', ['Kontakte', 'Firmen']],
      ['Vertrieb', ['Leads & Qualifizierung', 'Deals', 'Angebote', 'Follow-up & Power Hour']],
      ['Marketing', ['Marketing', 'Events', 'Netzwerken']],
      ['Steuerung', ['Planung', 'Auswertung']],
    ]);
    // 25.10.: Formulare im Fuß (die Gruppen tragen schon zwölf Punkte) — vor Stammdaten.
    expect(HUB_MENUE.fuss.map(p => p.name)).toEqual(['Formulare', 'Stammdaten']);
    expect(HUB_MENUE.automation).toMatchObject({ name: 'Automationen & Head', gruppe: 'steuerung', prozessBereiche: ['marketing', 'sales', 'uebergabe'], heads: ['sales', 'marketing', 'event'] });
    // Zum Zeichnen steht „Automationen & Head“ am Ende seiner Gruppe — wie `alleUnterpunkte` im Werkzeug-Muster.
    expect(hubGruppenAnzeige().find(g => g.id === 'steuerung')!.punkte.map(p => p.id)).toEqual(['planung', 'auswertung', 'automationen']);
  });

  it('Ziele über die vorhandenen Link-Funktionen; jedes Ziel leuchtet seinen eigenen Punkt', () => {
    const ziel = (id: string) => HUB_PUNKTE.find(p => p.id === id)!.ziel;
    expect(ziel('ueberblick')).toBe(markttraktion());
    expect(ziel('kontakte')).toBe(WEG.kontakt());
    expect(ziel('firmen')).toBe(WEG.firma());
    expect(ziel('qualifizierung')).toBe(qualifizierungLink());
    expect(ziel('deals')).toBe(WEG.deals());
    expect(ziel('angebot')).toBe(angebotLink());
    expect(ziel('followup')).toBe(WEG.followup());
    expect(ziel('marketing')).toBe(WEG.marketing());
    expect(ziel('events')).toBe(WEG.besuch());
    expect(ziel('netzwerken')).toBe(WEG.netzwerken());
    expect(NETZWERKEN_PFAD).toBe(WEG.netzwerken());
    expect(ziel('planung')).toBe(planungLink());
    expect(ziel('auswertung')).toBe(auswertungLink());
    expect(WEG.auswertung()).toBe('/os/markttraktion?s=auswertung');
    expect(ziel('stammdaten')).toBe(WEG.stammdaten());
    expect(ziel('formulare')).toBe(WEG.formulare());
    expect(WEG.formulare()).toBe('/os/markttraktion?s=formulare');
    for (const p of [...HUB_PUNKTE, HUB_MENUE.automation]) {
      const [pfad, suche] = p.ziel.split('?');
      expect(hubOrtFuer(pfad, suche ?? ''), p.id).toBe(p.id);
    }
  });

  it('Kennungen und Namen einmalig; jedes Symbol hat ein lucide-Bild', () => {
    const alle = [...HUB_PUNKTE, HUB_MENUE.automation];
    expect(new Set(alle.map(p => p.id)).size).toBe(alle.length);
    expect(new Set(alle.map(p => p.name)).size).toBe(alle.length);
    for (const p of alle) expect(HUB_SYMBOLE[p.symbol as HubSymbol], p.symbol).toBeTruthy();
    for (const p of alle) expect(p.titel.length, p.id).toBeGreaterThan(5);
  });

  it('Netzwerken leuchtet auf seiner eigenen Seite, andere Seiten gehören nicht zum Hub', () => {
    expect(hubOrtFuer('/os/netzwerken')).toBe('netzwerken');
    expect(hubOrtFuer('/os/netzwerken/karte')).toBe('netzwerken');
    expect(hubOrtFuer('/os/netzwerkenx')).toBeNull();
    expect(hubOrtFuer('/os/mandate')).toBeNull(); // Produkte & Mandate bleibt ein eigenes Werkzeug
    expect(hubOrtFuer('/os/menschen')).toBeNull(); // Kontakte privat
    expect(hubOrtFuer(PFAD, '')).toBe('ueberblick');
  });
});

describe('punktVon — jede Adresse leuchtet genau einen Punkt', () => {
  it('Bereiche, alte Adressen und die Auswertung', () => {
    const fall: [string | undefined, string | undefined, string][] = [
      [undefined, undefined, 'ueberblick'], ['kontakte', 'akte', 'kontakte'], ['kontakte', 'runde-kreis', 'kontakte'], ['firmen', undefined, 'firmen'],
      ['qualifizierung', 'scoring-sales', 'qualifizierung'], ['firmen', 'leads', 'qualifizierung'], ['sales', 'leads', 'qualifizierung'],
      ['deals', 'liste', 'deals'], ['deals', 'akte', 'deals'], ['deals', 'auswertung', 'auswertung'], ['deals', 'kunden', 'auswertung'], ['sales', 'auswertung', 'auswertung'],
      ['kunden', undefined, 'auswertung'], ['auswertung', 'quatsch', 'auswertung'], ['angebot', undefined, 'angebot'], ['followup', 'powerhour', 'followup'],
      ['heute', undefined, 'followup'], ['marketing', 'kampagnen', 'marketing'], ['sales', 'kampagnen', 'marketing'], ['besuche', 'wirkung', 'events'],
      ['events', undefined, 'events'], ['event', undefined, 'events'], ['planung', 'challenges', 'planung'], ['stammdaten', 'datenschutz', 'stammdaten'],
      ['automationen', undefined, 'automationen'], ['formulare', 'egal', 'formulare'], ['quatsch', undefined, 'ueberblick'],
    ];
    for (const [s, a, p] of fall) expect(punktVon(aufloesen(s, a)), `${s}/${a}`).toBe(p);
  });
  it('jeder Bereich hat genau einen Ort; keine Space-Leisten-Einträge für Hub-Punkte (Zeitmessung bleibt business:markttraktion)', () => {
    for (const b of BEREICHE) expect([...HUB_PUNKTE, HUB_MENUE.automation].filter(p => p.bereiche.includes(b)).length, b).toBe(1);
    const spaces = lies('lib/make-one/spaces.ts');
    for (const p of HUB_PUNKTE.filter(x => x.id !== 'ueberblick')) expect(spaces, p.ziel).not.toContain(`href: '${p.ziel}'`);
  });
});

// ── Auswertung: der Flow vom Kontakt zum gewonnenen Deal ──────────────────────────────────────────────────────────────────────────────────
const HEUTE = '2026-10-22';
const J = `${HEUTE}T09:00:00.000Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] } as unknown as CrmBestand);
const ch = (id: string, stufe: Chance['stufe'], x: Partial<Chance> = {}): Chance => ({
  id, titel: id, kontaktIds: [], art: 'projekt', wert: { betrag: 10_000, basis: 'einmalig' }, stufe, historie: [{ stufe, am: J, von: 'kevin' }],
  qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'ug', besitzer: 'kevin', angelegt: J, geaendert: J, ...x,
} as Chance);
const ang = (id: string, status: Angebot['status'], gesellschaft = 'ug') => ({ id, status, gesellschaft, titel: id }) as unknown as Angebot;

describe('Auswertung — jede Zahl ist die vorhandene Rechnung, ohne Daten grau', () => {
  const kontakte = [
    // Frisch angelegt mit Aktivität: nicht kalt, also „In Arbeit“ (lib/crm/leads.ts `frischAngelegt`).
    k('c-a1', { stufe: 'gespraech', importiertAm: '2026-10-18', aktivitaeten: [{ am: '2026-10-20T10:00:00Z', art: 'anruf', von: 'kevin' }] }),
    k('c-a2', { stufe: 'angesprochen', importiertAm: '2026-10-18', aktivitaeten: [{ am: '2026-10-19T10:00:00Z', art: 'mail', von: 'kevin' }] }),
    k('c-a3'), k('c-a4', { lead: { status: 'sql' } as Kontakt['lead'] }),
  ];
  const crm = { ...leer(), chancen: [ch('ch-1', 'qualifiziert', { kontaktIds: ['c-a4'] }), ch('ch-2', 'angebot'), ch('ch-3', 'gewonnen'), ch('ch-4', 'gewonnen', { gesellschaft: 'kdc' })],
    angebote: [ang('ang-1', 'gestellt'), ang('ang-2', 'gestellt'), ang('ang-3', 'entwurf'), ang('ang-4', 'gestellt', 'kdc')] } as CrmBestand;
  const zeilen = leads(kontakte, crm, HEUTE);
  const t = trichter(zeilen, crm, HEUTE);
  const stufen = auswertungFlow({ kontakte: kontakte.length, zeilen, trichter: t, crm });
  const zahl = (id: string) => stufen.flatMap(s => s.zahlen).find(z => z.id === id)!.anzahl;

  it('sechs Stufen: Kontakte → Leads → MQL · SQL → Deals → Angebote → Gewonnen', () => {
    expect(stufen.map(s => s.label)).toEqual(['Kontakte', 'Leads', 'MQL · SQL', 'Deals', 'Angebote', 'Gewonnen']);
  });
  it('Zahlen = dieselben Zählregeln wie Leads-Liste, Trichter und Angebote (nur Business)', () => {
    expect(zahl('kontakte')).toBe(4);
    expect(zahl('leads')).toBe(zeilen.filter(z => passtLeadFilter(z, 'aktiv')).length);
    expect(zahl('mql')).toBe(zeilen.filter(z => passtLeadFilter(z, 'aktiv') && mqlErreicht(z)).length);
    expect(zahl('sql')).toBe(zeilen.filter(z => passtLeadFilter(z, 'sql')).length);
    expect(zahl('deals')).toBe(t.stufen.find(s => s.id === 'deals')!.anzahl);
    expect(zahl('gewonnen')).toBe(t.stufen.find(s => s.id === 'gewonnen')!.anzahl);
    expect(zahl('gewonnen')).toBe(1); // der Deal einer Privat-Einheit zählt nicht (nurBusinessGezaehlt im Trichter)
    expect(zahl('angebote')).toBe(2); // gestellt + Business; Entwurf und Privat-Einheit nicht
    // Der Fall ist nicht leer: es gibt Leads in Arbeit, einen SQL und zwei offene Deals.
    expect(zahl('leads')).toBeGreaterThan(0);
    expect(zahl('sql')).toBeGreaterThan(0);
    expect(zahl('deals')).toBe(2);
  });
  it('Sätze nur aus echten Werten (Wert offener Deals, Quoten aus dem Trichter)', () => {
    const deals = stufen.find(s => s.id === 'deals')!;
    expect(deals.saetze).toEqual([`Wert ${Math.round(t.stufen.find(s => s.id === 'deals')!.wert!).toLocaleString('de-DE')} €`]);
    const gewonnen = stufen.find(s => s.id === 'gewonnen')!;
    expect(gewonnen.saetze).toEqual(t.sqlZuGewonnen == null ? [] : [`SQL → gewonnen ${t.sqlZuGewonnen} %`]);
  });
  it('ohne Daten: jede Stufe grau mit „—“, kein Faden-Schmuck in Farbe', () => {
    const ohne = auswertungFlow({ kontakte: null, zeilen: null, trichter: null, crm: null });
    expect(ohne.flatMap(s => s.zahlen).every(z => z.anzahl === null)).toBe(true);
    const sp = auswertungSpalten(ohne, () => '#123456');
    expect(sp.every(s => s.zustand === 'offen' && !s.farbe)).toBe(true);
    expect(sp.flatMap(s => s.kaestchen.map(x => x.titel)).every(x => x.startsWith('— '))).toBe(true);
    expect(ohne.every(s => s.saetze.length === 0)).toBe(true);
  });
  it('eine echte Null heißt in Worten, nie „0 …“; Stufen mit Daten laufen in der Farbe ihrer Welt', () => {
    const leerFlow = auswertungFlow({ kontakte: 0, zeilen: [], trichter: trichter([], leer(), HEUTE), crm: leer() });
    const titel = auswertungSpalten(leerFlow, () => '#123456').flatMap(s => s.kaestchen.map(x => x.titel));
    expect(titel.some(x => /^0\b/.test(x))).toBe(false);
    expect(titel).toContain('Kartei noch leer');
    expect(titel).toContain('noch kein SQL');
    expect(zahlText({ anzahl: 3, wort: 'offen', leer: 'keiner offen' })).toBe('3 offen');
    const sp = auswertungSpalten(stufen, w => (w === 'sales' ? '#AAAAAA' : '#BBBBBB'));
    expect(sp.find(s => s.id === 'kontakte')).toMatchObject({ zustand: 'laeuft', farbe: '#BBBBBB' });
    expect(sp.find(s => s.id === 'deals')).toMatchObject({ zustand: 'laeuft', farbe: '#AAAAAA' });
    for (const s of sp) expect(s.kaestchen.length).toBeLessThanOrEqual(4);
  });
  it('Klick führt in die Liste dahinter — Leads mit der gezählten Pille, Gewonnen in die aufgeklappten Deals', () => {
    expect(flowZiel(stufen, 'leads')).toEqual({ s: 'qualifizierung', a: 'leads', filter: 'aktiv' });
    expect(flowZiel(stufen, 'quali', 'sql')).toEqual({ s: 'qualifizierung', a: 'leads', filter: 'sql' });
    expect(flowZiel(stufen, 'quali', 'quali-satz-0')).toEqual({ s: 'qualifizierung' });
    expect(flowLink(flowZiel(stufen, 'gewonnen')!)).toBe('/os/markttraktion?s=deals&zu=1');
    expect(flowLink(flowZiel(stufen, 'angebote')!)).toBe(angebotLink());
    expect(flowLink(flowZiel(stufen, 'kontakte')!)).toBe(WEG.kontakt());
    expect(flowZiel(stufen, 'quatsch')).toBeNull();
  });
});

describe('Die Seite — Hub statt Reiterzeile', () => {
  const v = lies('components/os/crm/Markttraktion.tsx');
  it('das Menü ist die Werkzeug-Leiste (Übergangs-Menü und Platzhalter sind weg); Auswertung und „Automationen & Head“ als eigene Orte', () => {
    expect(v).not.toContain('HubMenue');
    expect(v).not.toContain('mt-hub');
    expect(v).not.toContain('ÜBERGANG');
    expect(existsSync(path.join(wurzel, 'components/os/crm/HubMenue.tsx'))).toBe(false);
    expect(existsSync(path.join(wurzel, 'components/os/crm/AutomationenPlatz.tsx'))).toBe(false);
    expect(lies('app/globals.css')).not.toContain('.mt-hub');
    expect(v).toContain("hubOrt === 'auswertung' && <Auswertung");
    // „Automationen & Head“ = der Baustein des Werkzeug-Musters mit dem Markttraktion-Werkzeug (Prozesse Marketing/Sales/Übergabe, Heads Sales/Marketing/Event).
    expect(v).toContain("hubOrt === 'automationen' && <BereichAutomationen werkzeug={MARKTTRAKTION_WERKZEUG} />");
  });
  it('„+ Angebot“ im Kopf, solange Kontakt, Firma oder Deal offen sind — nimmt sie mit; nie in den Runden', () => {
    expect(v).toContain('angebotVonHier(bereich, ansicht, kParam)');
    expect(v).toMatch(/angebotBezug = !!kParam && !runde && \(bereich === 'kontakte' \|\| bereich === 'firmen' \|\| \(bereich === 'deals' && ansicht === 'akte'\)\)/);
    expect(v).toContain('{angebotBezug && <Knopf onClick={neuesAngebot}');
  });
  it('Events in EINER Reiterzeile (keine vierte Ebene), Deals ohne Auswertungs-Reiter, kein Puls mehr', () => {
    expect(v).toContain('EVENTS_REITER.map');
    expect(lies('components/os/crm/besuche/Besuche.tsx')).not.toContain('<Pillen');
    expect(v).toMatch(/const DEALS: \{ id: DealsAnsicht; label: string \}\[\] = \[\{ id: 'board', label: 'Board' \}, \{ id: 'liste', label: 'Liste' \}\];/);
    expect(lies('app/globals.css')).not.toContain('mtPuls');
  });
  it('die Auswertung nutzt den Lichtfaden-Baustein (ReiseBild) und den Traktions-Index aus dem Überblick (EIN Abruf)', () => {
    const a = lies('components/os/crm/Auswertung.tsx');
    expect(a).toContain('<ReiseBild');
    expect(a).toContain('<TraktionsIndex');
    expect(a).toContain('useTraktion()');
    const u = lies('components/os/crm/Ueberblick.tsx');
    // Der volle Index (Säulen, Kennzahlen, Verlauf) steht nur in der Auswertung; oben im Überblick (24.10.) nur die kompakte Kennzahl.
    expect(u).not.toMatch(/<Kachel id="traktion"/);
    expect(u).not.toContain('<TraktionsIndex');
    expect(u).toContain('<TraktionKurz');
    expect(u).toContain('export function useTraktion');
  });
});
