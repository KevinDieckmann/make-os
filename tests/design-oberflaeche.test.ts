// ─── Oberfläche: Übersichtlichkeit (11.10., Branch `design-oberflaeche`) ─────────────────────────────────────────────────────────
// Kevin 11.10.: „Bitte alles nochmal überarbeiten, das geht besser … es muss einfach zu verstehen sein, über die Visualisierungen; so ist es
// sehr unübersichtlich.“ Wächter für die Grundsätze: Antwort zuerst (Lage-Kacheln, höchstens fünf), Details eingeklappt (Messlücken der Indizes),
// jede Zahl trägt ihr Wort (Kreislauf), Rot nur für echte Dringlichkeit, Handy-Kopf ohne Buchstabenbruch. Reine Darstellung — Daten, Routen,
// Rechte und Schreibwege bleiben, wie sie sind.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BriefingZahlen } from '@/lib/heute/briefing';
import type { KennzahlStand } from '@/lib/kennzahlen/kern';

const lies = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf-8');

describe('Lage — „Antwort zuerst“ (components/os/ui/lage.tsx)', () => {
  it('höchstens fünf Kacheln: Zahl, Wort, Zusatz, Weg als Link', async () => {
    const { Lage, LAGE_MAX } = await import('@/components/os/ui');
    expect(LAGE_MAX).toBe(5);
    const mehr = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, wert: String(i), label: `Wort ${i}` }));
    const html = renderToStaticMarkup(createElement(Lage, { eintraege: [{ id: 'a', wert: '2', label: 'Überfällig', unter: '1 kritisch', bedeutung: 'kritisch' as const, href: '/os/aufgaben' }, ...mehr] }));
    expect(html).toContain('role="list"');
    expect((html.match(/role="listitem"/g) ?? []).length).toBe(5);
    expect(html).toContain('href="/os/aufgaben"');
    for (const t of ['Überfällig', '1 kritisch', 'Wort 3']) expect(html).toContain(t);
    expect(html).not.toContain('Wort 4'); // die sechste Kachel gehört einen Klick tiefer
  });
  it('ohne Einträge nichts; mit Balken eine Fortschrittsanzeige', async () => {
    const { Lage } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(createElement(Lage, { eintraege: [] }))).toBe('');
    const html = renderToStaticMarkup(createElement(Lage, { eintraege: [{ id: 't', wert: '1/3', label: 'Top 3', anteil: 1 / 3 }] }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="33"');
  });
  it('steht im Design-Standard und im Handy-Netz links bündig', () => {
    expect(lies('DESIGN_STANDARD.md')).toContain('`Lage`');
    expect(lies('app/globals.css')).toContain('.ui-lage [role=listitem] > .ui-lage-kachel { display: flex; align-items: stretch; }');
  });
});

describe('Heute: das Tages-Briefing zeigt die Lage als Bild über dem Text', () => {
  const basis: BriefingZahlen = {
    sicht: 'business', termine: { anzahl: 2, erster: { uhr: '09:00', titel: 'Wochenstart' } }, ueberfaellig: 2, heuteFaellig: 1, kritisch: 1, followups: 3, freigaben: 9,
    top3: { art: 'festgelegt', titel: ['A', 'B', 'C'], erledigt: 1 }, fokus: null,
  };
  it('Kacheln: Termine · Top 3 · Überfällig · Freigaben, im Business dazu Follow-ups — Rot nur mit Überfälligem', async () => {
    const { briefingLage } = await import('@/components/os/heute/Briefing');
    const l = briefingLage(basis, 'business');
    expect(l.map(x => x.id)).toEqual(['termine', 'top3', 'ueberfaellig', 'freigaben', 'followups']);
    expect(l.find(x => x.id === 'termine')).toMatchObject({ wert: '2', unter: 'zuerst 09:00' });
    expect(l.find(x => x.id === 'top3')).toMatchObject({ wert: '1/3', anteil: 1 / 3 });
    expect(l.find(x => x.id === 'ueberfaellig')).toMatchObject({ bedeutung: 'kritisch', unter: '1 kritisch · 1 heute fällig' });
    expect(l.find(x => x.id === 'freigaben')).toMatchObject({ bedeutung: 'achtung', href: '/os/stapel?space=business' });
    const ruhig = briefingLage({ ...basis, sicht: 'privat', ueberfaellig: 0, heuteFaellig: 0, kritisch: 0, freigaben: 0, followups: 0, top3: { art: 'keine', titel: [], erledigt: 0 } }, 'privat');
    expect(ruhig.map(x => x.id)).toEqual(['termine', 'top3', 'ueberfaellig', 'freigaben']);
    expect(ruhig.find(x => x.id === 'ueberfaellig')).toMatchObject({ bedeutung: 'gut', unter: 'nichts brennt' });
    expect(ruhig.some(x => x.bedeutung === 'kritisch' || x.bedeutung === 'achtung')).toBe(false);
  });
  it('die Karte zeichnet Kacheln UND den Text; ohne Zahlen bleibt es der Absatz', async () => {
    const { BriefingKarte } = await import('@/components/os/heute/Briefing');
    const mit = renderToStaticMarkup(createElement(BriefingKarte, { i: 0, sicht: 'business', vorgabe: ['Heute stehen 2 Termine an.'], vorgabeZahlen: basis }));
    expect(mit).toContain('aria-label="Lage heute · Business"');
    expect(mit).toContain('Heute stehen 2 Termine an.');
    const ohne = renderToStaticMarkup(createElement(BriefingKarte, { i: 0, sicht: 'business', vorgabe: ['Heute stehen 2 Termine an.'] }));
    expect(ohne).not.toContain('role="list"');
  });
  it('die Route liefert dieselben Zahlen mit (nichts Neues, nur als Bild)', () => {
    expect(lies('app/api/heute/briefing/route.ts')).toContain('zahlen: b.zahlen');
    expect(lies('lib/heute/briefing-server.ts')).toContain("text: saetze.join(' '), zahlen: r.zahlen");
  });
  it('Business-frei steht als Pille im Kopf, nicht als eigene Zeile über den Karten', () => {
    const h = lies('components/os/HeuteView.tsx');
    expect(h).toContain('rechts={<BusinessFreiStatus kompakt />}');
    expect(h.match(/<BusinessFreiStatus/g)?.length).toBe(1);
  });
  it('Index-Widget ohne Wert: kein „Noch keine Daten“ über Balken mit Werten — EIN Status (indexStatus) wie Cockpit und Fachseiten (14.10., B1)', () => {
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain('const status = d ? indexStatus(d) : null;');
    expect(w).not.toMatch(/Säulen mit Wert/);
  });
});

describe('Indizes: Gemessenes zuerst, Messlücken eingeklappt (components/os/kennzahlen/SaeuleKacheln.tsx)', () => {
  const k = (id: string, label: string, gemessen: boolean): KennzahlStand => ({
    id, label, gruppe: 'Liquidität', einheit: 'prozent', richtung: 'hoch', gruen: 1, rot: 0, formel: '', standard: { gruen: 1, rot: 0 }, angepasst: false,
    gemessen, wert: gemessen ? 1 : null, anzeige: gemessen ? '12 %' : null, quelle: gemessen ? 'aus den Rechnungen' : 'Quelle fehlt hier', punkte: null, ampel: gemessen ? 'gruen' : 'grau', details: [],
  } as KennzahlStand);
  it('gemessene als Kacheln, die Lücken als eine Zeile mit ihren Namen — aufklappbar', async () => {
    const { SaeuleKacheln, lueckenText } = await import('@/components/os/kennzahlen/SaeuleKacheln');
    const liste = [k('a', 'Quote A', true), k('b', 'Lücke B', false), k('c', 'Lücke C', false), k('d', 'Lücke D', false), k('e', 'Lücke E', false)];
    const html = renderToStaticMarkup(createElement(SaeuleKacheln, { kennzahlen: liste, onOeffnen: () => {} }));
    expect(html).toContain('Quote A');
    expect(html).toContain('4 Kennzahlen noch ohne Daten');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Quelle fehlt hier'); // die Kacheln der Lücken erst nach dem Aufklappen
    expect(lueckenText(liste.filter(x => !x.gemessen))).toBe('Lücke B · Lücke C · Lücke D + 1');
    const offen = renderToStaticMarkup(createElement(SaeuleKacheln, { kennzahlen: liste, onOeffnen: () => {}, offenStart: true }));
    expect(offen).toContain('Quelle fehlt hier');
  });
  it('eine Stelle für alle Indizes: IndexAnsicht und Business-Cockpit', () => {
    for (const f of ['components/os/kennzahlen/IndexAnsicht.tsx', 'components/os/business/BusinessCockpit.tsx']) {
      const q = lies(f);
      expect(q, f).toContain('<SaeuleKacheln kennzahlen={s.kennzahlen}');
      expect(q, f).not.toContain('<KennzahlKachel');
    }
  });
});

describe('Markttraktion › Planung: jede Zahl trägt ihr Wort, ein Filter statt dreier Pillenreihen', () => {
  it('Kreislauf: Wort je Stufe, Plan und Ist als zwei Kacheln, die Reise darüber (17.10. statt des Rings)', async () => {
    const { KREISLAUF_EINHEIT } = await import('@/components/os/crm/planung/Kreislauf');
    for (const id of ['kanaele', 'leads', 'deals', 'followup', 'fulfillment', 'nachher', 'wiederkauf'] as const) expect(KREISLAUF_EINHEIT[id], id).toBeTruthy();
    const q = lies('components/os/crm/planung/Kreislauf.tsx');
    expect(q).toContain("<PlanIst titel={s.annahme ? 'Plan (Annahme)' : 'Plan'}>");
    expect(q).toContain('<PlanIst titel="Ist">');
    // 17.10. (Reise überall): statt Ring + Stufe nebeneinander die Reise als Zeile (derselbe Baustein wie im Fulfillment), die Stufe darunter.
    expect(q).toContain("import { ReiseBild } from '../../ui/reise/ReiseBild'");
    expect(q).not.toContain('function Ring(');
  });
  it('der Kanal-Filter ist ein Auswahl-Chip im Kopf des Kreislaufs', () => {
    const p = lies('components/os/crm/planung/Planung.tsx');
    expect(p).toContain('<Wahl<string> label="Leadkanal"');
    expect(p).toContain('kanalWahl={kanalWahl}');
    expect(p.match(/<Pillen /g)?.length).toBe(1); // nur noch die Ansichten
  });
});

describe('Produkte & Mandate: Antwort zuerst, Rot nur für Dringendes', () => {
  it('Überblick und Liste vor dem Index-Streifen; Excel-Einfügen zugeklappt flach', () => {
    const q = lies('components/os/mandate/ProdukteMandate.tsx');
    expect(q.indexOf('<MandateUebersicht')).toBeGreaterThan(-1);
    expect(q.indexOf('<MandateUebersicht')).toBeLessThan(q.indexOf('<IndexStreifen'));
    expect(lies('components/os/mandate/MandateTabelle.tsx')).toContain('flach={!auf}');
  });
  it('„Als Nächstes“ und „Worauf achten“ als Hinweis-Karten, Kundenkonzentration gelb', () => {
    const q = lies('components/os/crm/Kunden.tsx');
    expect(q).toContain('<Hinweis art="info" titel="Als Nächstes">');
    expect(q).toContain('<Hinweis art="achtung" titel="Worauf achten">');
    expect(q).not.toMatch(/konzentration\.anteil > 50 \? LEUCHT\.kritisch/);
  });
  it('Leistungstreppe sichtbar, Kundenreise · Zielbild · Roadmap · Positionierung zum Aufklappen', () => {
    expect(lies('components/os/mandate/treppe/Treppe.tsx')).toContain('<Klappbar id="treppe-strategie"');
  });
  it('Markttraktion-Überblick: „Für dich“ vor dem Index-Streifen', () => {
    const q = lies('components/os/crm/Markttraktion.tsx');
    expect(q.indexOf("bereich === 'ueberblick' && <Ueberblick")).toBeLessThan(q.indexOf("bereich === 'ueberblick' && <IndexStreifen"));
  });
});

describe('Ruhe: Rot nur für echte Dringlichkeit, Felder erst bei Bedarf, Technik aufklappbar', () => {
  it('Tagesplanung: offene Planungs-Punkte gelb, nie rot', () => {
    const q = lies('components/os/TagesplanView.tsx');
    expect(q).toContain('const checkFarbe = okN === check.length ? LEUCHT.gut : LEUCHT.achtung;');
    expect(q).not.toContain("c.ok ? LEUCHT.gut : LEUCHT.kritisch");
  });
  it('Ziele & Meilensteine: Zusatzfelder erst, wenn ein Titel getippt ist', () => {
    const q = lies('components/os/planung/ZieleMeilensteine.tsx');
    expect(q).toContain('const zielMehr = neu.titel.trim().length > 0;');
    expect(q).toContain("{zielMehr && <Knopf onClick={zielAnlegen}>+ Ziel</Knopf>}");
    expect(q).toContain("{msMehr && <Knopf onClick={msAnlegen}>+ Meilenstein</Knopf>}");
  });
  it('Fokus: leere Horizonte als eine Zeile „Fokus eintragen“', () => {
    expect(lies('components/os/planung/FokusTafel.tsx')).toContain('>Fokus eintragen</Knopf>');
  });
  it('„Neu anfangen …“ leise statt rot; Google/WHOOP nicht eingerichtet: Technik nur aufklappbar', () => {
    expect(lies('components/os/aufgaben/NeuAnfangen.tsx')).not.toMatch(/border: `1px solid \$\{LEUCHT\.kritisch\}55`/);
    for (const f of ['components/os/kalender/VerbindenKarten.tsx', 'components/os/gesundheit/WhoopKarte.tsx']) expect(lies(f), f).toContain('Was fehlt (für den Inhaber)</summary>');
  });
  it('Agenten: rechts höchstens drei Freigaben sichtbar', () => {
    expect(lies('components/os/agenten/Hintergrund.tsx')).toContain('const SICHTBAR = 3;');
  });
});

describe('Handy-Kopf: breite Aktionen rutschen unter den Titel (kein Buchstabenbruch mehr)', () => {
  it('Flex mit Umbruch, der Titel misst sich an seiner ganzen Breite, der Satz steht zuletzt', () => {
    const css = lies('app/globals.css');
    expect(css).toContain('.ui-kopf { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-bottom: 10px; }');
    expect(css).toContain('.ui-kopf-titel { order: 1; flex: 1 1 auto; min-width: 0;');
    expect(css).toContain('.ui-kopf-unter { order: 3; flex: 1 0 100%;');
    expect(css).not.toContain('.ui-kopf-titel { grid-column: 1; grid-row: 1;');
  });
});
