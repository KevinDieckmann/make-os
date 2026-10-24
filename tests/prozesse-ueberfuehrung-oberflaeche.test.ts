// ─── Prozesse · Überführung (22.10., Paket Ü) — Oberfläche: Karte im Steckbrief, Band in der Werkstatt, Marke der Kachel ────────────────────────────────────
// Gerendert ohne Browser (renderToStaticMarkup). Geprüft: der System-Prozess zeigt „In die Werkstatt überführen“ nur mit Recht; danach den Stand und den Weg in die
// Werkstatt. Das Band nennt, wen der Prozess ersetzt, welcher Weg arbeitet, den Vergleich (nur Zahlen und Kennungen) und schaltet erst um, wenn es erlaubt ist.
// Die Kachel trägt „System · im Schatten“ bzw. „Werkstatt · überführt“. Wächter: kein Server-Code, keine Farb-Literale, Bausteine aus ../ui.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/prozesse' }));

import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { kachelTexte, ueberfuehrungMarke } from '@/lib/prozesse/modell';
import { UeberfuehrungKarte, UeberfuehrungBand } from '@/components/os/prozesse/Ueberfuehrung';
import { SteckbriefKarte } from '@/components/os/prozesse/Feld';
import { UEBERFUEHRBAR, UMSCHALT_VORGABE, type UeberfuehrungAnsicht } from '@/lib/prozesse/ueberfuehrung';
import type { ProzessDef } from '@/lib/prozesse/typen';

const PZ = 'pz-00000000-0000-4000-8000-000000000009';
const u = UEBERFUEHRBAR[0];
const sys = (stand: NonNullable<ProzessDef['ueberfuehrung']>['stand']): ProzessDef => ({
  ...SYSTEM_PROZESSE.find(p => p.id === u.sp)!, ueberfuehrung: { rolle: 'alt', teil: u.teil, satz: u.satz, stand, ...(stand !== 'moeglich' ? { prozessId: PZ, titel: u.titel } : {}) },
});
const karte = (p: ProzessDef, recht: boolean) => renderToStaticMarkup(h(UeberfuehrungKarte, { p, recht, onGeaendert: () => {} }));
const ansicht = (x: Partial<UeberfuehrungAnsicht> = {}): UeberfuehrungAnsicht => ({
  sp: u.sp, spTitel: 'Rechnung & Zahlung', teil: u.teil, satz: u.satz, kennung: u.kennung, bleibt: u.bleibt, phase: 'schatten', stand: 'schatten', seit: '2026-10-22T08:00:00.000Z',
  vergleich: { laeufe: 3, gleich: 2, abweichend: 1, gleichLaeufe: 2, gleichSeit: '2026-10-25', letzte: { tag: '2026-10-24', grund: 'nur-alt', kennungen: ['mahn-r-ug-1'] } },
  heute: { alt: true, neu: false },
  umschalten: { erlaubt: false, grund: 'Erst im Schatten vergleichen — noch 3 gleiche Läufe ohne Abweichung.', laeufe: 2, tage: 1, regel: UMSCHALT_VORGABE }, arbeitet: 'alt', ...x,
});
const band = (a: UeberfuehrungAnsicht, darf: boolean) => renderToStaticMarkup(h(UeberfuehrungBand, { prozessId: PZ, a, darf, stand: () => 's', onGeaendert: () => {} }));

describe('Karte im Steckbrief des System-Prozesses', () => {
  it('möglich + Recht: der Teil, der Satz, „In die Werkstatt überführen“', () => {
    const html = karte(sys('moeglich'), true);
    for (const t of ['In die Werkstatt', u.teil, 'Zuerst ein paar Tage im Schatten', 'In die Werkstatt überführen']) expect(html, t).toContain(t);
  });
  it('ohne Recht kein Knopf — nur der Satz, wer überführen darf', () => {
    const html = karte(sys('moeglich'), false);
    expect(html).not.toContain('In die Werkstatt überführen');
    expect(html).toContain('Überführen dürfen volle Mitglieder des Haushalts.');
  });
  it('im Schatten bzw. überführt: der Stand und der Weg in die Werkstatt — kein zweiter Knopf', () => {
    const html = karte(sys('schatten'), true);
    expect(html).toContain('im Schatten — der alte Weg arbeitet, der neue rechnet mit');
    expect(html).toContain(`„${u.titel}“ in der Werkstatt öffnen ›`);
    expect(html).not.toContain('In die Werkstatt überführen');
    expect(karte(sys('scharf'), true)).toContain('überführt — der neue Weg arbeitet');
  });
  it('ohne Überführung (andere System-Prozesse) zeigt die Karte nichts', () => {
    expect(karte(SYSTEM_PROZESSE.find(p => p.id === 'sp-bauplan')!, true)).toBe('');
  });
});

describe('Band in der Werkstatt', () => {
  it('Schatten: wen er ersetzt, welcher Weg arbeitet, Vergleich nur als Zahlen und Kennungen; Umschalten aus, solange es nicht geht', () => {
    const html = band(ansicht(), true);
    for (const t of ['Ersetzt „Rechnung &amp; Zahlung“ · Mahnaufgaben', 'im Schatten', '3 Läufe verglichen · 2 gleich · 1 abweichend', 'in Folge gleich: 2 seit 25.10.',
      'alter Weg ✓ · neuer Weg —', 'nur der alte Weg hat an diesem Tag gewirkt', 'mahn-r-ug-1', 'noch 3 gleiche Läufe', 'Dieselben Kennungen wie der Code', 'Umschalten']) expect(html, t).toContain(t);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Umschalten/);
  });
  it('erlaubt: Umschalten ist frei (mit Rückfrage im Klick); scharf: „Zurück in den Schatten“ statt Umschalten', () => {
    const frei = band(ansicht({ umschalten: { erlaubt: true, laeufe: 5, tage: 4, regel: UMSCHALT_VORGABE } }), true);
    expect(frei).toContain('Gleich seit 5 Läufen über 4 Tage — du kannst umschalten.');
    expect(frei).not.toMatch(/<button[^>]*disabled[^>]*>(?:(?!<\/button>).)*Umschalten/);
    const scharf = band(ansicht({ phase: 'scharf', stand: 'scharf', arbeitet: 'neu', umgeschaltetAm: '2026-10-29T08:00:00.000Z' }), true);
    expect(scharf).toContain('Zurück in den Schatten');
    expect(scharf).toContain('Hältst du den Prozess an, arbeitet wieder der alte Weg.');
    expect(scharf).not.toContain('>Umschalten<');
  });
  it('ohne Recht: keine Knöpfe, nur der Satz', () => {
    const html = band(ansicht({ umschalten: { erlaubt: true, laeufe: 5, tage: 4, regel: UMSCHALT_VORGABE } }), false);
    expect(html).not.toContain('Umschalten</span>');
    expect(html).toContain('Umschalten und zurückschalten dürfen volle Mitglieder des Haushalts.');
  });
  it('Ausbau (Paket Ü 2): „Neu gegenüber dem alten Weg“ mit dem Satz und — im Schatten — den gezählten Wirkungen je Art (nichts angelegt)', () => {
    const ev = UEBERFUEHRBAR.find(x => x.sp === 'sp-event-nachfassen')!;
    const html = band(ansicht({ zusatz: { satz: ev.zusatz!.satz, zaehler: { wirkungen: 3, arten: { followup: 2, meldung: 1 }, zuletzt: '2026-10-26' } } }), true);
    for (const t of ['Neu gegenüber dem alten Weg', 'Follow-up „Nachfassen nach der Begegnung“', 'Im Schatten bisher: 2 Follow-ups, 1 Glocken (zuletzt 26.10.) — nichts davon angelegt.']) expect(html, t).toContain(t);
    expect(band(ansicht({ zusatz: { satz: ev.zusatz!.satz } }), true)).toContain('Im Schatten noch nichts gezählt.');
    // Ohne Ausbau (Mahnaufgaben) gibt es den Abschnitt nicht.
    expect(band(ansicht(), true)).not.toContain('Neu gegenüber dem alten Weg');
  });
});

describe('Marke an Kachel und Steckbrief', () => {
  it('System · im Schatten / Werkstatt · überführt — solange nur möglich, die Marke wie bisher', () => {
    expect(ueberfuehrungMarke(sys('moeglich'))).toBeNull();
    expect(kachelTexte(sys('schatten'), undefined, 'nah').marke).toBe('System · im Schatten');
    expect(ueberfuehrungMarke({ quelle: 'werkstatt', ueberfuehrung: { rolle: 'neu', teil: u.teil, satz: u.satz, stand: 'scharf', prozessId: u.sp } })).toBe('Werkstatt · überführt');
    expect(kachelTexte(sys('moeglich'), undefined, 'nah').marke).toMatch(/^System · /);
    expect(renderToStaticMarkup(h(SteckbriefKarte, { p: sys('angehalten'), zahl: undefined }))).toContain('System · alter Weg');
  });
});

describe('Wächter', () => {
  const quelle = readFileSync(path.join(process.cwd(), 'components/os/prozesse/Ueberfuehrung.tsx'), 'utf8');
  it('kein Server-Code, keine Farb-Literale, Bausteine aus ../ui, Links nur über WEG', () => {
    expect(quelle).not.toMatch(/-server['"]/);
    expect(quelle).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(quelle).toContain("from '../ui'");
    expect(quelle).not.toMatch(/href=\{?['"`]\//);
  });
});
