// ─── Lichtfäden-Quelle Planung: Ziele, Meilensteine, Aufgaben, Projekte → Knoten + Stränge (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { planungStraenge, type PlanungDaten } from '@/lib/lichtfaeden/quellen/planung';
import { BEIDE, GESAMT, knotenId } from '@/lib/lichtfaeden/modell';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import { FADEN_FARBEN } from '@/lib/make-one/design';

const HEUTE = '2026-10-03';
const D: PlanungDaten = {
  heute: HEUTE,
  ziele: [
    { id: 'z-mandate', titel: 'Zwölf Mandate', space: 'business', rang: 1, person: BEIDE, firmaId: 'f-a' },
    { id: 'z-netz', titel: 'Netzwerk wächst', space: 'business', rang: 2, person: BEIDE, termin: '2026-12-10' },
    { id: 'z-lauf', titel: 'Halbmarathon', space: 'privat', rang: 1, person: 'malin' },
    { id: 'z-q4', titel: 'Q4-Etappe', space: 'business', person: BEIDE, abgeleitetVon: 'z-mandate', termin: '2026-12-31' },
  ],
  meilensteine: [
    { id: 'm-1', titel: 'Neun Mandate', faellig: '2026-10-30', zielId: 'z-mandate', space: 'business' },
    { id: 'm-2', titel: '10 km', faellig: '2026-09-01', erledigt: true, zielId: 'z-lauf', bereich: 'gesundheit' },
    { id: 'm-3', titel: 'Steuer abgeben', faellig: '2026-11-20', space: 'business' },
    { id: 'm-4', titel: 'Etappe', faellig: '2026-12-31', abgeleitetVon: 'z-q4' },
  ],
  aufgaben: [
    { id: 't-1', title: 'Angebot', status: 'todo', priority: 'high', dueDate: '2026-10-20', assignee: 'kevin', listeId: meilensteinListeId('m-1'), spaceId: 'kdv' },
    { id: 't-2', title: 'Erledigt', status: 'done', dueDate: '2026-10-20', assignee: 'kevin' },
    { id: 't-3', title: 'Ohne Datum', status: 'todo', assignee: 'kevin' },
    { id: 't-4', title: 'Geheim', status: 'todo', dueDate: '2026-09-28', assignee: 'malin', sichtbarkeit: 'nur-ich', angelegtVon: 'malin', spaceId: 'privat' },
    { id: 't-5', title: 'Mandant', status: 'todo', dueDate: '2026-10-21', assignee: 'both', spaceId: 'm-f-a' },
  ],
  projekte: [
    { id: 'p-1', title: 'Umzug', ende: '2026-11-30', spaceId: 'privat', category: 'joint' },
    { id: 'p-2', title: 'Alt', ende: '2026-11-30', archived: true },
  ],
};

describe('Planung → Knoten und Stränge', () => {
  const e = planungStraenge(D);
  const st = (id: string) => e.straenge.find(x => x.id === id)!;
  const kn = (id: string) => e.knoten.find(x => x.id === id)!;

  it('Ziel-Knoten nur für Wurzel-Ziele, unter ihrem Thema, Farbe je Space in Rang-Reihenfolge', () => {
    expect(e.knoten.filter(k => k.art === 'ziel').map(k => k.id).sort()).toEqual(['ziel:z-lauf', 'ziel:z-mandate', 'ziel:z-netz']);
    expect(kn('ziel:z-mandate').eltern).toBe(knotenId.thema('business', 'mandate')); // Firma am Ziel → Mandate
    expect(kn('ziel:z-netz').eltern).toBe(knotenId.thema('business', 'planung'));
    expect(kn('ziel:z-lauf').eltern).toBe(knotenId.thema('privat', 'gesundheit')); // Gesundheits-Meilenstein → Gesundheit
    expect(kn('ziel:z-mandate').farbe).toBe(FADEN_FARBEN.business[0]);
    expect(kn('ziel:z-netz').farbe).toBe(FADEN_FARBEN.business[1]);
    expect(kn('ziel:z-lauf').farbe).toBe(FADEN_FARBEN.privat[0]);
  });

  it('Meilensteine hängen am Ziel (abgeleitete am Jahresziel), sonst am Thema', () => {
    expect(kn('ms:m-1').eltern).toBe('ziel:z-mandate');
    expect(kn('ms:m-4').eltern).toBe('ziel:z-mandate');
    expect(kn('ms:m-3').eltern).toBe(knotenId.thema('business', 'planung'));
    expect(st('ms:m-1').pfad).toEqual([GESAMT, 'space:business', 'thema:business:mandate', 'ziel:z-mandate', 'ms:m-1']);
    expect(st('ms:m-2')).toMatchObject({ status: 'erledigt', gewicht: 1 });
  });

  it('Aufgabe → Liste → Meilenstein → Ziel; ohne Meilenstein ans Thema; erledigte/undatierte zählen nicht', () => {
    expect(st('aufgabe:t-1').pfad.at(-1)).toBe('ms:m-1');
    expect(st('aufgabe:t-1')).toMatchObject({ gewicht: 1.5, person: 'kevin', status: 'offen' });
    expect(e.straenge.some(x => x.id === 'aufgabe:t-2' || x.id === 'aufgabe:t-3')).toBe(false);
    expect(st('aufgabe:t-5').pfad.at(-1)).toBe(knotenId.thema('business', 'mandate'));
    expect(st('aufgabe:t-5').person).toBe(BEIDE);
  });

  it('„nur ich“-Aufgaben sind privat und gehören der Anlegerin; überfällig wird erkannt', () => {
    expect(st('aufgabe:t-4')).toMatchObject({ privat: true, person: 'malin', status: 'ueberfaellig' });
  });

  it('Ziel-Frist nur ohne Kaskaden-Meilenstein; abgeleitete Ziele keine eigene Frist', () => {
    expect(st('ziel:z-netz')).toMatchObject({ quelle: 'ziel', gewicht: 3 });
    expect(e.straenge.some(x => x.id === 'ziel:z-q4')).toBe(false);
  });

  it('Projekt-Ende offener Projekte; archivierte nicht; gemeinsame gehören beiden', () => {
    expect(st('projekt:p-1')).toMatchObject({ person: BEIDE, gewicht: 2 });
    expect(st('projekt:p-1').pfad).toEqual([GESAMT, 'space:privat', 'thema:privat:planung']);
    expect(e.straenge.some(x => x.id === 'projekt:p-2')).toBe(false);
  });

  it('Bezüge für andere Quellen: Firma des Ziels → Pfad des Ziels', () => {
    expect(e.bezuege.firma.get('f-a')?.at(-1)).toBe('ziel:z-mandate');
  });

  it('deterministisch: gleiche Daten in anderer Reihenfolge = gleiches Ergebnis', () => {
    const r = planungStraenge({ ...D, ziele: [...D.ziele].reverse(), meilensteine: [...D.meilensteine].reverse() });
    const sortiert = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(JSON.stringify(sortiert(r.knoten))).toBe(JSON.stringify(sortiert(e.knoten)));
    expect(JSON.stringify(sortiert(r.straenge))).toBe(JSON.stringify(sortiert(e.straenge)));
  });
});
