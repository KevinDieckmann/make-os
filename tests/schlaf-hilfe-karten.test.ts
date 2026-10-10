// ─── Karten Schlaf-Hilfe, Tages-Check, Essen & Trinken (09.10.) — zeichnen mit echten Daten der reinen Regeln ─────────
// Der Daten-Haken ist ersetzt (die Karten laden sonst im Browser); die Sicht kommt aus denselben reinen Funktionen wie auf dem Server.
// Geprüft: ohne Einwilligung null (bzw. Hinweis), mit Daten die großen Zahlen, Ja/Nein-Ziele ≥ 44 px, Hinweistexte, keine Mengenempfehlung.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { schlafLage } from '@/lib/gesundheit/schlaf';
import { aktiveFragen, checkAuswertung, ANSPANNUNG_HINWEIS, ANSPANNUNG_ID, CHECK_FRAGEN, CHECK_MAX } from '@/lib/gesundheit/tages-check';
import { essenOrientierung, ERGAENZUNG_VORLAGEN } from '@/lib/ernaehrung/orientierung';
import { leererAlltag, alltagEinstellungen } from '@/lib/gesundheit/alltag';
import { tagePlus } from '@/lib/zeit';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/gesundheit' }));

const HEUTE = '2026-10-09';
let antwort: unknown = null;
vi.mock('@/components/os/gesundheit/alltag-daten', () => ({
  useAlltag: () => ({ d: antwort, ladeFehler: false, laden: async () => {}, einstellen: async () => ({ ok: true }), antworten: async () => ({ ok: true }), abhaken: async () => ({ ok: true }), ergaenzungAnlegen: async () => ({ ok: true }) }),
  hm: (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; },
  datumKurz: (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`,
}));

const h = (c: unknown, props: unknown) => createElement(c as never, props as never);

function sicht() {
  const a = leererAlltag();
  a.schlaf = { ...a.schlaf, aufstehen: '07:30', aufstehenZiel: '06:45', ab: HEUTE, erinnerung: true };
  const naechte = [0, 1, 2, 3].map(i => ({ tag: tagePlus(HEUTE, -i), dauer: 6.5, bedarf: 8, wach: 0.5, einschlaf: 23 * 60, aufwach: 7 * 60 + 30 }));
  const log = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(i => [tagePlus(HEUTE, -i), { kcal: 2600, strain: 11, schritte: 8000 }]));
  const fragen = aktiveFragen(undefined);
  return {
    ok: true, ich: 'test', einwilligung: true, einstellung: alltagEinstellungen(a), stand: 's1',
    sicht: {
      heute: HEUTE,
      schlaf: schlafLage(naechte, a.schlaf, HEUTE),
      check: { fragen, katalog: CHECK_FRAGEN.map(f => ({ ...f, aktiv: fragen.some(x => x.id === f.id) })), max: CHECK_MAX, tag: tagePlus(HEUTE, -1), welcher: 'gestern', antworten: { alkohol: true }, befunde: [], fortschritt: [{ id: 'alkohol', kurz: 'Alkohol', ja: 1, nein: 0, fehlt: 5 }] },
      essen: { an: true, orientierung: essenOrientierung({ log, heute: HEUTE, plan: 'hart', lauftag: true }), ergaenzungen: [{ routine: 'r-1', label: 'Kreatin · eigene Menge', vorlage: 'kreatin', erledigt: false }], vorlagen: ERGAENZUNG_VORLAGEN },
    },
  };
}

beforeEach(() => { antwort = null; });

describe('Karten zeichnen', () => {
  it('ohne Antwort und ohne Einwilligung: null — mit `hinweis` der Weg zur Einwilligung', async () => {
    const { SchlafHilfeKarte } = await import('@/components/os/gesundheit/SchlafHilfeKarte');
    const { TagesCheckKarte } = await import('@/components/os/gesundheit/TagesCheckKarte');
    const { ErnaehrungHeuteKarte } = await import('@/components/os/gesundheit/ErnaehrungHeuteKarte');
    for (const K of [SchlafHilfeKarte, TagesCheckKarte, ErnaehrungHeuteKarte]) expect(renderToStaticMarkup(h(K, {}))).toBe('');
    antwort = { ...sicht(), einwilligung: false, sicht: null };
    for (const K of [SchlafHilfeKarte, TagesCheckKarte, ErnaehrungHeuteKarte]) {
      expect(renderToStaticMarkup(h(K, {}))).toBe('');
      expect(renderToStaticMarkup(h(K, { hinweis: true }))).toContain('/os/datenschutz#gesundheit');
    }
  });

  it('Schlaf-Hilfe: letzte Nacht zuerst, Schlafenszeit, Aufstehzeit der Stufe, ein Tipp, Erinnerung ohne Werte', async () => {
    antwort = sicht();
    const { SchlafHilfeKarte } = await import('@/components/os/gesundheit/SchlafHilfeKarte');
    const html = renderToStaticMarkup(h(SchlafHilfeKarte, {}));
    expect(html.indexOf('Letzte Nacht')).toBeLessThan(html.indexOf('Heute ins Bett'));
    expect(html).toContain('6:30 h');
    expect(html).toContain('23:00'); // 07:30 − 8 h − 30 Min. Puffer
    expect(html).toContain('07:30');
    expect(html).toContain('Ziel 06:45');
    expect(html).toContain('Erinnerung um 22:30');
    expect(html).toContain('keine ärztliche Beratung');
  });

  it('Tages-Check: Ja/Nein mit 44-px-Zielen, „Gestern“ vor 14 Uhr, gesetzte Antwort gedrückt', async () => {
    antwort = sicht();
    const { TagesCheckKarte } = await import('@/components/os/gesundheit/TagesCheckKarte');
    const html = renderToStaticMarkup(h(TagesCheckKarte, {}));
    expect(html).toContain('Gestern, 08.10.');
    expect(html).toContain('1/5');
    expect(html).toContain('min-height:44px');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toContain('kein Beweis');
    expect(html).not.toContain('Stressiger Tag');
    expect(html).not.toContain(ANSPANNUNG_HINWEIS); // kein Stress-Befund → kein Hinweis zur Quelle
  });

  it('Tages-Check: „Stress“ steht als Befund aus der Anspannung — mit der Quelle „Anspannung (Morgen-Check)“, nie als Frage', async () => {
    const journal: Record<string, { stress: number }> = {};
    const vitals: Record<string, { sleep: number }> = {};
    [5, 1, 4, 2, 4, 3].forEach((w, i) => { const d = tagePlus(HEUTE, -i - 1); journal[d] = { stress: w }; vitals[tagePlus(d, 1)] = { sleep: w >= 4 ? 6 : 7.5 }; });
    const aus = checkAuswertung(journal, vitals, [ANSPANNUNG_ID], HEUTE);
    const s = sicht();
    antwort = { ...s, sicht: { ...s.sicht, check: { ...s.sicht.check, befunde: aus.befunde, fortschritt: aus.fortschritt } } };
    const { TagesCheckKarte } = await import('@/components/os/gesundheit/TagesCheckKarte');
    const html = renderToStaticMarkup(h(TagesCheckKarte, {}));
    expect(html).toContain('An Tagen mit „Stress“ hattest du im Schnitt 90 Min. weniger Schlaf');
    expect(html).toContain(ANSPANNUNG_HINWEIS);
    expect(html).toContain('Anspannung (Morgen-Check)');
    expect(html).not.toContain('Stressiger Tag');
  });

  it('Essen & Trinken: ein Satz mit Gründen, Ø kcal als Orientierung, Trink-Hinweis, Haken — keine Mengenempfehlung', async () => {
    antwort = sicht();
    const { ErnaehrungHeuteKarte } = await import('@/components/os/gesundheit/ErnaehrungHeuteKarte');
    const html = renderToStaticMarkup(h(ErnaehrungHeuteKarte, {}));
    expect(html).toContain('eher mehr');
    expect(html).toContain('harter Trainingstag geplant');
    expect(html).toContain('2.600 kcal');
    expect(html).toContain('Lauftag');
    expect(html).toContain('Kreatin · eigene Menge');
    expect(html).toContain('empfiehlt keine Mengen');
  });
});
