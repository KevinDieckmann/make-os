// ─── Fulfillment — zweite unabhängige Abnahme (15.10.): die Wächter der reinen Regeln und der Oberfläche ────────────────────────────────────────────
// Was die Demo-Saat im Zusammenspiel prüft, steht in tests/fulfillment-stimmigkeit.test.ts. Hier, ohne Netz und ohne Platte (bis auf das Lesen von Quellen):
//   B1  EINE Lage-Rechnung: der Kunde liest die Übersetzung der Hänger (ohne Health; interne Punkte „Wir sind dran“), intern „Der Kunde sieht …“ mit Grund
//   B2  Ablauf am Handy: Kopfzeile, Chips und Aktionsspalte brechen um (Klassen + Regeln in globals.css)
//   B3  Termine des Kunden: jeder Termin mit Bezug zählt (nächster Termin, Takt „weitere Termine“, Kick-off terminiert)
//   B4  ein bewusst entferntes Muster gilt nicht als „fehlt“
//   B5  keine Freigabe-Kürzel (F0/F1/F7) und keine Agenten-Kürzel ohne Klartext
//   B7  Grafiken führen weiter (Kreislauf über EINE Tabelle `kreislaufWeg`, Wert-Konto, Puls, Takt)
//   C3/C8/C16/C19/C20  Beschriftungen ohne Überlappung, Bausteine im Onboarding, Zählungen gleich, keine Silbentrennung, Aufgaben beim Kunden
//   C6  Texte: kein „..“ nach einem Datum, keine englischen Fachwörter (Health/Steering/Coverage), Einzahl/Mehrzahl, Entscheidungen getrennt
// Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { kundenLageAus, kundeSiehtLage, ohneKuerzel, KUNDEN_LAGE_TEXT } from '@/lib/fulfillment/prozesse/darstellung';
import { naechsterFallTermin } from '@/lib/fulfillment/prozesse/rituale';
import { zuordnen, ersterTermin, bezugGehoertZu, terminTitelKurz } from '@/lib/fulfillment/prozesse/termine';
import { taktLeiste, taktLage, kreislaufWeg, KREISLAUF_REIHE } from '@/lib/fulfillment/prozesse/ansichten';
import { onboardingStand, imOnboarding, obKnotenId } from '@/lib/fulfillment/prozesse/onboarding';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { fallReise } from '@/lib/fulfillment/prozesse/reise';
import { vorlagenAnwenden, musterFehlt, MUSTER_ENTFERNT, markeMuster } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { leerVorlagen } from '@/lib/fulfillment/lesen';
import { MUSTER_P1, MUSTER_P3, MUSTER_PLAYBOOK } from '@/lib/fulfillment/muster';
import { fallAufgabeOrt } from '@/lib/fulfillment/regeln';
import { agentText } from '@/lib/fulfillment/analyse/agenten';
import { kuerzelAus } from '@/lib/crm/angebote';
import { Zeitachse } from '@/components/os/fulfillment/reise/teile';
import { KundenAnsicht } from '@/components/os/fulfillment/kunde/KundenAnsicht';
import { entscheidungenTeilen } from '@/lib/fulfillment/kunde/bild';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';
import type { Fall, FallKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';

const WURZEL = process.cwd();
const lies = (p: string) => readFileSync(path.join(WURZEL, p), 'utf8');
const HEUTE = '2026-10-15';
const JETZT = '2026-10-15T09:00:00.000Z';
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const fall = (knoten: FallKnoten[], x: Partial<Fall> = {}): Fall => ({
  mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: '2026-10-13T09:00:00.000Z', gestartetVon: 'pia', status: 'onboarding', knoten,
  freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [],
  marken: {}, geaendert: JETZT, geaendertVon: 'pia', ...x,
});

describe('B1 · EINE Lage-Rechnung — der Kunde liest nur die Übersetzung', () => {
  const h1 = (art: string, schwere: 'rot' | 'gelb', kundeSieht?: boolean) => ({ art, schwere, ...(kundeSieht !== undefined ? { kundeSieht } : {}) });
  it('wartet beim Kunden → gelb/rot; interne Punkte → „Wir sind dran“ (nie rot); ohne Hänger grün', () => {
    expect(kundenLageAus([])).toEqual({ ampel: 'gruen', art: 'plan' });
    expect(kundenLageAus([], true)).toEqual({ ampel: 'gruen', art: 'fertig' });
    expect(kundenLageAus([h1('wartet', 'gelb', true)])).toEqual({ ampel: 'gelb', art: 'warten' });
    expect(kundenLageAus([h1('wartet', 'rot', true)])).toEqual({ ampel: 'rot', art: 'nurMitEuch' });
    expect(kundenLageAus([h1('willkommen', 'rot')])).toEqual({ ampel: 'gelb', art: 'dran' });
    expect(kundenLageAus([h1('freigabe', 'rot'), h1('report', 'gelb')])).toEqual({ ampel: 'gelb', art: 'dran' });
    // Ein wartender Punkt, den der Kunde nicht sieht, ist für ihn kein „Wir warten …“.
    expect(kundenLageAus([h1('wartet', 'rot', false)])).toEqual({ ampel: 'gelb', art: 'dran' });
    expect(KUNDEN_LAGE_TEXT.warten).toEqual({ du: 'Wir warten auf euren Input', sie: 'Wir warten auf Ihren Input' });
  });
  it('intern: „Der Kunde sieht …“ mit Grund, wenn es abweicht — die Gesundheit des Mandats zählt beim Kunden nicht; interne Punkte heißen „Wir sind dran“', () => {
    expect(kundeSiehtLage({ health: 'gelb', haengt: [] })).toMatchObject({ ampel: 'gruen', titel: 'Wir liegen im Plan', grund: 'Die Gesundheit des Mandats zählt beim Kunden nicht' });
    const lumen = kundeSiehtLage({ health: null, haengt: [{ art: 'willkommen', mandatId: 'm', kunde: 'K', text: 't', schwere: 'rot', href: '/' }] });
    expect(lumen).toMatchObject({ ampel: 'gelb', titel: 'Wir sind dran' });
    expect(lumen.grund).toMatch(/interne Punkte/);
    expect(kundeSiehtLage({ health: 'gruen', haengt: [] })).toEqual({ ampel: 'gruen', art: 'plan', titel: 'Wir liegen im Plan' });
  });
  it('die Kunden-Seite rechnet keine eigenen Schwellen mehr (LAGE_GRENZEN ist weg)', () => {
    const bild = lies('lib/fulfillment/kunde/bild.ts');
    expect(bild).not.toContain('LAGE_GRENZEN');
    expect(bild).toContain('kundenLageAus(');
  });
});

describe('B2 · Ablauf am Handy bricht um statt quer zu laufen', () => {
  it('Klassen am Ablauf und die Regeln dazu in globals.css', () => {
    const a = lies('components/os/fulfillment/prozesse/FallAblauf.tsx');
    for (const x of ['className="ff-ablauf"', 'ff-ablauf-kopf', 'className="ff-ablauf-raute"', 'className="ff-ablauf-schritte"', 'className="ff-ablauf-aktion"']) expect(a, x).toContain(x);
    const css = lies('app/globals.css');
    const block = css.slice(css.indexOf('.ff-ablauf { min-width: 0; }'));
    expect(block).toContain('@media (max-width: 720px)');
    for (const x of ['.ff-ablauf .ff-ablauf-kopf { flex-wrap: wrap;', '.ff-ablauf .ff-ablauf-raute { order: 5; flex: 1 0 100%;', '.ff-ablauf .ui-zeile-rechts { flex: 1 0 100%; margin-left: 0;', '.ff-ablauf .ui-chip { white-space: normal !important;']) expect(block, x).toContain(x);
  });
});

describe('B3 · Termine des Kunden zählen — auch ohne Ritual', () => {
  const termine = [{ uid: 'u-ab', tag: '2026-10-15', von: '11:00', titel: 'Cockpit-Abstimmung' }, { uid: 'u-wc', tag: '2026-10-20', titel: 'Wochen-Check · Kunde' }, { uid: 'u-alt', tag: '2026-10-13' }];
  it('der nächste Termin ist der früheste ab heute — mit Ritual dessen Titel, sonst der Titel des Termins', () => {
    expect(naechsterFallTermin({ fallRituale: [], terminTage: termine, heute: HEUTE })).toEqual({ tag: '2026-10-15', titel: 'Cockpit-Abstimmung', von: '11:00' });
    expect(naechsterFallTermin({ fallRituale: [{ ritualId: 'r-w', terminUids: ['u-ab'] }], terminTage: termine, heute: HEUTE, rituale: [{ id: 'r-w', titel: 'Wochen-Check' }] }))
      .toEqual({ tag: '2026-10-15', ritualId: 'r-w', titel: 'Wochen-Check', von: '11:00' });
    expect(naechsterFallTermin({ fallRituale: [], terminTage: [], heute: HEUTE })).toBeNull();
  });
  it('Bezug: Mandat direkt, ohne Mandat die Firma des Mandats; Zuordnung zu Ritualen; erster Termin ab Start; Titel ohne Kunden', () => {
    expect(bezugGehoertZu({ mandatId: 'm-1' }, { id: 'm-1' })).toBe(true);
    expect(bezugGehoertZu({ mandatId: 'm-2', firmaId: 'f-1' }, { id: 'm-1', firmaId: 'f-1' })).toBe(false);
    expect(bezugGehoertZu({ firmaId: 'f-1' }, { id: 'm-1', firmaId: 'f-1' })).toBe(true);
    expect(zuordnen(termine, [{ ritualId: 'r-w', terminUids: ['u-wc'] }]).map(t => [t.uid, t.ritualId ?? null])).toEqual([['u-alt', null], ['u-ab', null], ['u-wc', 'r-w']]);
    expect(ersterTermin(termine, '2026-10-14')).toBe('2026-10-15');
    expect(terminTitelKurz('Wochen-Check · Kunde', 'Kunde')).toBe('Wochen-Check');
  });
  it('Onboarding: der erste Termin mit dem Kunden ab dem Start macht „Kick-off terminiert“ wahr', () => {
    const f = fall([k('w', undefined, 'Paket', 1)]);
    const abl = { ziele: [], formularProzent: null, kickoffRitualIds: ['r-k'], willkommenStunden: 24, jetzt: JETZT };
    expect(onboardingStand(f, abl).schritte.find(s => s.schluessel === 'kickoff')!.erfuellt).toBe(false);
    const mit = onboardingStand(f, { ...abl, kundenTermine: ['2026-10-12', '2026-10-15'] }).schritte.find(s => s.schluessel === 'kickoff')!;
    expect(mit.erfuellt).toBe(true);
    expect(mit.text).toContain('15.10.');
    // Ein Termin VOR dem Start zählt nicht.
    expect(onboardingStand(f, { ...abl, kundenTermine: ['2026-10-12'] }).schritte.find(s => s.schluessel === 'kickoff')!.erfuellt).toBe(false);
  });
  it('Takt: Termine eines Rituals stehen in seiner Zeile (auch die schon gelaufenen dieser Woche), die übrigen als „weitere Termine“', () => {
    const rituale = [{ id: 'r-w', titel: 'Wochen-Check', rhythmus: 'woche' as const, dauerMin: 15 }];
    const t = taktLeiste({ rituale, fallRituale: [{ ritualId: 'r-w', terminUids: ['u-alt'] }], termine: {}, heute: HEUTE, kalender: zuordnen(termine, [{ ritualId: 'r-w', terminUids: ['u-alt'] }]) });
    expect(t.zeilen[0].tage[0]).toEqual({ tag: '2026-10-13', erwartet: false });
    expect(t.weitere.map(x => x.titel)).toEqual(['Cockpit-Abstimmung', 'Wochen-Check · Kunde']);
    expect(t.naechster).toEqual({ titel: 'Cockpit-Abstimmung', tag: '2026-10-15' });
  });
});

describe('B4 · ein bewusst entferntes Muster fehlt nicht', () => {
  it('„vorlage-weg“ merkt das Muster als entfernt; „Fehlendes aus Muster anlegen“ legt es nicht neu an — ausdrücklich gewählt schon', () => {
    const ctx = { person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: () => 's', neueId: (() => { let n = 0; return (p: string) => `${p}-t${++n}`; })() };
    const a = vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], ctx);
    if (!a.ok) throw new Error('aus-muster');
    const p3 = a.datei.marken[markeMuster(MUSTER_P3.id)];
    const b = vorlagenAnwenden(a.datei, [{ op: 'vorlage-weg', id: p3 }], ctx);
    if (!b.ok) throw new Error('vorlage-weg');
    expect(b.datei.marken[markeMuster(MUSTER_P3.id)]).toBe(MUSTER_ENTFERNT);
    expect(musterFehlt(b.datei, MUSTER_P3.id)).toBe(false);
    const c = vorlagenAnwenden(b.datei, [{ op: 'aus-muster' }], ctx);
    if (!c.ok) throw new Error('aus-muster 2');
    expect(c.datei.prozesse.filter(p => p.art === 'paket')).toHaveLength(b.datei.prozesse.filter(p => p.art === 'paket').length);
    const d = vorlagenAnwenden(b.datei, [{ op: 'aus-muster', welche: ['p3'] }], ctx);
    if (!d.ok) throw new Error('aus-muster p3');
    expect(musterFehlt(d.datei, MUSTER_P3.id)).toBe(false);
    expect(d.datei.prozesse.some(p => p.id === d.datei.marken[markeMuster(MUSTER_P3.id)])).toBe(true);
  });
});

describe('B5 · keine Kürzel ohne Klartext', () => {
  it('Freigabe-Kürzel → „Abstimmungspunkt n („Titel“)“; ohne Nummer mit Titel; Onboarding sagt nie „F0“', () => {
    const nr = new Map([['F0', 1], ['F7', 7]]);
    const fg = [{ id: 'F1', titel: 'Analyse-Umfang & Personenliste' }, { id: 'F7', titel: 'Übergabe-Freigabe' }];
    expect(ohneKuerzel('Nicht im Umfang von F1.', nr, fg)).toBe('Nicht im Umfang von Bestätigung „Analyse-Umfang & Personenliste“.'); // 17.10. spät: „Bestätigung“ statt „Abstimmungspunkt“
    expect(ohneKuerzel('Übergabe (F7)', nr, fg)).toBe('Übergabe (Bestätigung 7 („Übergabe-Freigabe“))');
    expect(ohneKuerzel('Fahrplan 2026', nr, fg)).toBe('Fahrplan 2026');
    const f = fall([k('w', undefined, 'Paket', 1), k('p', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k(obKnotenId('f0'), 'p', 'F0 bestätigt', 1, { freigabe: 'F0' })]);
    const t = onboardingStand(f, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT }).schritte.find(s => s.schluessel === 'f0')!.text;
    expect(t).toBe('Bestätigung 1 noch nicht vermerkt.');
  });
  it('Agenten nie als Kürzel allein; Erklärungen und Kreislauf ohne F-Kürzel', () => {
    // 17.10. spät („Fachbegriffe raus“): nur noch der Name — das Kürzel bleibt Kennung, nie sichtbar.
    expect(agentText('a1')).toBe('Unternehmens-Steckbrief');
    expect(agentText('tb')).toBe('Tiefenbericht');
    expect(agentText('ap')).toBe('Playbook-Auswertung');
    for (const d of ['lib/erklaerungen/fulfillment-analyse.ts', 'lib/erklaerungen/fulfillment-prozesse.ts']) expect(lies(d), d).not.toMatch(/\bF\d\b/);
    expect(lies('components/os/fulfillment/prozesse/FallKreislauf.tsx')).not.toContain('(F7)');
    const marke = lies('components/os/fulfillment/reise/bilder.tsx');
    expect(marke).toContain('{name ?? agentText(id)}');
    for (const d of ['components/os/fulfillment/analyse/Laeufe.tsx', 'components/os/fulfillment/analyse/DossierAnsicht.tsx']) expect(lies(d), d).not.toMatch(/\.agent\.toUpperCase\(\)/);
  });
});

describe('B7 · Grafiken führen weiter', () => {
  it('Kreislauf: EINE Tabelle über WEG — jede Stufe hat ihre Ansicht (mit Fall: Fulfillment in den Fall, Wiederkauf zur Firma)', () => {
    for (const id of KREISLAUF_REIHE) expect(kreislaufWeg(id), id).toMatch(/^\/os\//);
    expect(kreislaufWeg('deals')).toContain('markttraktion');
    expect(kreislaufWeg('leads')).toContain('qualifizierung');
    expect(kreislaufWeg('fulfillment', { id: 'm-1' })).toContain('m-1');
    expect(kreislaufWeg('wiederkauf', { id: 'm-1', firmaId: 'f-1' })).toContain('f-1');
    expect(lies('components/os/fulfillment/prozesse/Kreislauf.tsx')).toContain('kreislaufWeg(s.id)');
    expect(lies('components/os/fulfillment/prozesse/FallKreislauf.tsx')).toContain('onMitte=');
  });
  it('Wert-Konto-Linie, Kunden-Puls und Takt-Termine sind Tippziele', () => {
    expect(lies('components/os/fulfillment/prozesse/FallWert.tsx')).toContain("onClick={() => insBild(`wert-messen-${zielId}`)}");
    expect(lies('components/os/fulfillment/kunde/FallKunde.tsx')).toContain('onClick={() => setAlle(true)}');
    expect(lies('components/os/fulfillment/prozesse/FallTakt.tsx')).toContain('href={WEG.kalender(echte[0].tag)}');
  });
});

describe('C · Beschriftungen, Bausteine, Zählungen, Silben, Aufgaben', () => {
  it('C3: „heute“ steht über der Achse — Start und Ende darunter überdecken es nie; ⓘ überdeckt keine Zahl', () => {
    const html = renderToStaticMarkup(h(Zeitachse, { punkte: [], heuteX: 0.86, links: 'Start 31.08.', rechts: '22.10.', beschreibung: 'x' }));
    expect(html.indexOf('heute')).toBeLessThan(html.indexOf('role="img"'));
    expect(html.indexOf('22.10.')).toBeGreaterThan(html.indexOf('role="img"'));
    expect(lies('app/globals.css')).toContain('.ui-kennzahl-erkl .ui-kennzahl-wert { padding-right: 24px; }');
  });
  it('C8: Playbook und Willkommensmail laufen im Onboarding jedes Falls; die Import-Liste nennt keine Dateinamen', () => {
    const d = { ...leerVorlagen(), bausteine: [{ ...MUSTER_PLAYBOOK, id: 'fb-1', tags: ['playbook'] }, { ...MUSTER_PLAYBOOK, id: 'fb-2', art: 'mail' as const, tags: ['willkommen'] }, { ...MUSTER_PLAYBOOK, id: 'fb-3', art: 'dokument' as const, tags: [] }] };
    expect(d.bausteine.map(b => imOnboarding(b, d))).toEqual([true, true, false]);
    expect(lies('components/os/fulfillment/prozesse/Bausteine.tsx')).toContain('im Onboarding jedes Falls');
    expect(lies('components/os/fulfillment/prozesse/Import.tsx')).not.toContain('{l.datei}');
  });
  it('C16: der Zähler einer Phase zählt die Zeilen des Ablaufs (ein Schritt mit drei Bausteinen = 1); das Onboarding zählt nur, was für „fertig“ zählt', () => {
    const f = fall([
      k('w', undefined, 'Paket', 1), k('p', 'w', 'Diagnose', 1),
      k('s1', 'p', 'Bericht', 1), k('t', 'p', 'Weitere Bausteine', 2), k('s2', 't', 'Zugeordnete Bausteine', 1),
      k('b1', 's2', 'A', 1, { bausteinId: 'x1' }), k('b2', 's2', 'B', 2, { bausteinId: 'x2' }), k('b3', 's2', 'C', 3, { bausteinId: 'x3' }),
    ]);
    expect(fallReise(f, [], HEUTE).phasen[0]).toMatchObject({ erledigt: 0, gesamt: 2 });
    // 17.10. (dritte Abnahme B5): der ZÄHLER zählt alle Onboarding-Schritte (EINE Zählung `onboardingZaehlung` — Fall, Onboarding-Liste, Haken), „fertig“ weiter nur die zählenden.
    expect(lies('components/os/fulfillment/prozesse/FallUeberblick.tsx')).toContain('onboardingZaehlung(schritte)');
  });
  it('C19: keine Silbentrennung in Phasen-Titeln; das Angebots-Kürzel schneidet nie mitten im Wort', () => {
    const dateien = (o: string): string[] => readdirSync(path.join(WURZEL, o), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? dateien(`${o}/${e.name}`) : e.name.endsWith('.tsx') ? [`${o}/${e.name}`] : []));
    for (const d of dateien('components/os/fulfillment')) expect(lies(d), d).not.toContain("hyphens: 'auto'");
    expect(kuerzelAus('Nordlicht Labs', 'X')).toBe('NORDLICHT');
  });
  it('C20: Aufgaben aus Fulfillment tragen den Kunden im Titel und liegen im Space des Mandanten', () => {
    const o = fallAufgabeOrt({ id: 'm-1', kunde: 'Beispiel GmbH', gesellschaft: 'ug', firmaId: 'f-1' });
    expect(o).toMatchObject({ space: 'business', spaceId: 'm-f-1', bezug: { mandatId: 'm-1', firmaId: 'f-1' } });
    expect(o.titel('Registerauszug ablegen')).toBe('Registerauszug ablegen — Beispiel GmbH');
    expect(fallAufgabeOrt({ id: 'm-2', kunde: 'K', gesellschaft: 'ug' }).spaceId).toBe('ug');
  });
  it('C16 (Onboarding-Zählung): sieben zählende Schritte — das Playbook darf noch laufen', () => {
    const v = { ...(MUSTER_P1 as ProzessVorlage), id: 'fp-1', fassung: 1, geaendert: JETZT, geaendertVon: 'pia' };
    const f = fallStarten({ mandatId: 'm-1', vorlage: v, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: (() => { let n = 0; return (p: string) => `${p}-${++n}`; })() });
    const st = onboardingStand(f, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT });
    expect(st.schritte.filter(s => s.zaehlt)).toHaveLength(st.offen);
  });
});

describe('C6 · Texte im Fulfillment: Satzende, deutsche Begriffe, Einzahl/Mehrzahl, Entscheidungen getrennt', () => {
  // Sichtbarer Quelltext: ohne Kommentarzeilen und ohne Kommentare am Zeilenende (Kennungen wie `vorschlagHealth` treffen \b nicht).
  const dateien = (dir: string): string[] => readdirSync(path.join(WURZEL, dir), { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? dateien(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const QUELLEN = [...dateien('components/os/fulfillment'), ...dateien('lib/fulfillment'),
    ...readdirSync(path.join(WURZEL, 'lib/erklaerungen')).filter(n => n.startsWith('fulfillment-')).map(n => `lib/erklaerungen/${n}`)];
  const sichtbar = (d: string) => lies(d).split('\n').filter(z => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z))
    .map(z => z.replace(/\{\/\*.*?\*\/\}/g, '').replace(/\s\/\/\s.*$/, '')).join('\n');

  it('kein „..“ nach einer Ziffer, kein Datums-Helfer direkt vor einem Schlusspunkt — Satzende über `satz()`', () => {
    expect(QUELLEN.length).toBeGreaterThan(50);
    for (const d of QUELLEN) {
      const t = sichtbar(d);
      expect(t, d).not.toMatch(/\d\.\.(?!\.)/);
      expect(t, d).not.toMatch(/\b(tagKurz|kurz)\([^()]*\)\}\.(?=[`<\s])/);
    }
    // Der Fund aus der Abnahme: „letzte Mitschrift 12.10..“ — jetzt mit genau einem Punkt, und „1 Ritual“ statt „1 Rituale“.
    const rituale = [{ id: 'r-w', titel: 'Wochen-Check', rhythmus: 'woche' as const, dauerMin: 15 }, { id: 'r-m', titel: 'Steuerungskreis', rhythmus: 'monat' as const, dauerMin: 60 }];
    const l = taktLeiste({ rituale, fallRituale: [{ ritualId: 'r-w', terminUids: ['u1'] }], termine: { 'r-w': '2026-10-16' }, heute: HEUTE });
    expect(taktLage(l, HEUTE, '2026-10-12').unter).toBe('1 Ritual ohne Termin · letzte Mitschrift 12.10.');
    expect(taktLage(l, HEUTE).unter).toBe('1 Ritual ohne Termin · noch keine Mitschrift.');
  });

  it('keine englischen Fachwörter in sichtbaren Texten: Gesundheit, Steuerungskreis, Abdeckung — „Huddle“ bleibt und ist erklärt', () => {
    for (const d of QUELLEN) expect(sichtbar(d), d).not.toMatch(/\b(Health|Steering|Coverage)\b/);
    expect(lies('lib/erklaerungen/fulfillment-prozesse.ts')).toContain('Huddle = kurze Abstimmungsrunde');
  });

  it('Einzahl/Mehrzahl über den Helfer — kein „Karte(n)“, „Aussage(n)“, „Befund(e)“ in der Oberfläche', () => {
    for (const d of dateien('components/os/fulfillment')) expect(sichtbar(d), d).not.toMatch(/(?<![\w$])(?!Number|String|Boolean|Math|Date|Array|Object|Set|Map)[A-ZÄÖÜ][a-zäöü]+\((n|e)\)/);
    expect(lies('components/os/fulfillment/reise/FallKopf.tsx')).toContain("anzahl(h.length, 'Punkt hängt', 'Punkte hängen')");
  });

  it('Entscheidungen: EINE Regel trennt „Entschieden“ und „Offen“ — unter „Gemeinsam entschieden“ steht nie ein offener Punkt', () => {
    const l = [{ titel: 'A', status: 'offen' as const }, { titel: 'B', status: 'entschieden' as const }, { titel: 'C', status: 'verworfen' as const }];
    expect(entscheidungenTeilen(l)).toEqual({ entschieden: [l[1], l[2]], offen: [l[0]] });
    const sicht = {
      modus: 'voll', anrede: 'sie', anbieter: { name: 'Beispiel GmbH' }, ansprechperson: 'Ansprechperson', firma: 'Beispiel Werkzeugbau', mandat: 'Vertrieb', stand: '15.10.2026', fortschritt: 20,
      lage: { ampel: 'gruen', titel: 'Wir liegen im Plan', saetze: ['Satz.'] }, zeitstrahl: [], erledigt: [], naechstes: [], wartet: [], wertKonto: [], quickWins: [], rituale: [],
      entscheidungen: [{ titel: 'Preisliste bis Freitag', am: '14.10.2026', status: 'offen' }, { titel: 'Zielgruppe zuerst Maschinenbau', am: '12.10.2026', status: 'entschieden' }],
      formulare: [], upload: null, puls: { offen: false }, datenschutz: { verantwortlich: 'Beispiel', fassung: '1', absaetze: ['Hinweis.'] },
    } as unknown as KundenSicht;
    const html = renderToStaticMarkup(h(KundenAnsicht, { sicht, vorschau: true }));
    const i = html.indexOf('Gemeinsam entschieden'); const j = html.indexOf('Noch offen');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(html.slice(i, j)).toContain('Zielgruppe zuerst Maschinenbau');
    expect(html.slice(i, j)).not.toContain('Preisliste bis Freitag');
    expect(html.slice(j)).toContain('Preisliste bis Freitag');
  });
});
