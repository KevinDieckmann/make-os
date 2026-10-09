// ─── Wächter: Funde aus dem Demo-Rundgang 09.10. morgens (Branch rundgang-funde) ──────────────────────────────────────────────
// 1. Handy 390 px, Agenten › ZOE: die Überblick-Karte lief rechts über den Rand (ein langer Zieltitel als einzeiliger Knopf schob Prozent und
//    Balken hinaus; jedes Grid ohne Spaltenangabe wuchs mit). Jetzt: jedes Grid der Karte, der ZOE-Mitte und der Handy-Fläche hat EINE Spalte
//    `minmax(0, 1fr)`, der Zieltitel bricht um, Prozent und Zeit bleiben stehen.
// 3. „Als Nächstes“: je wiederkehrendem Lauf nur das nächste Vorkommen („täglich bis …“, „werktags bis …“, „+n weitere“); die Rechnung bleibt
//    die des Takts (`naechstesLesen` liefert jedes Vorkommen — Gold in tests/agenten-naechstes.test.ts).
// 4. Einrichtung einer neuen/fremden Instanz (ohne Altbestand): kein Upload-Fahrplan mit festen Tagen, kein Mac-Zulieferer, keine Daten und
//    Entscheidungen der gewachsenen Instanz — mit Altbestand bleibt alles wie vorher. Fertig-Regel und Prüfungen unverändert.
// (2. Finanzen › Privat ohne Altsystem → tests/neutral-rest.test.ts; 5. Head-Kennzahlen mit der Demo-Saat → tests/agenten-p4c-demo.test.ts.)
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as FIX from './fixtures/agenten-api';
import type { AgentenWert } from '@/components/os/agenten/kontext';
import type { Naechstes } from '@/lib/agenten/typen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const JETZT = new Date('2026-10-08T08:00:00.000Z'); // Do 10:00 Berlin

async function rendere(kind: unknown, teil: Partial<AgentenWert> = {}): Promise<string> {
  const { AgentenKontext } = await import('@/components/os/agenten/kontext');
  const wert: AgentenWert = {
    agenten: { zustand: 'da', daten: FIX.AGENTEN }, faeden: { zustand: 'da', daten: FIX.FADEN_LISTE }, laeufe: { zustand: 'da', daten: FIX.LAEUFE },
    stapel: { zustand: 'da', daten: { ok: true, offen: 0, vorschlaege: [] } }, form: 'handy', auswahl: { art: 'zoe' }, entwurf: null, starteEntwurf: () => {}, jetzt: JETZT,
    space: 'business', bereich: 'alle', oeffne: () => {}, dialog: () => {}, bestaetigen: async () => true, melde: () => {},
    vorlage: { faeden: { [FIX.FADEN_HEAD_ID]: FIX.FADEN_ANTWORT } },
    ...teil,
  };
  return renderToStaticMarkup(h(AgentenKontext, { wert }, kind));
}
/** Alle `style`-Angaben eines HTML-Ausschnitts. */
const stile = (html: string) => Array.from(html.matchAll(/style="([^"]*)"/g), m => m[1]);
const EINS = 'grid-template-columns:minmax(0, 1fr)';

describe('1. Handy: die Überblick-Karte bleibt in ihrer Breite', () => {
  const LANG = 'Ein sehr langer Zieltitel für das Jahr, der am Handy nie in eine einzige Zeile passt und früher über den Rand lief';
  const agenten = { zustand: 'da' as const, daten: { ...FIX.AGENTEN, ueberblick: { ...FIX.AGENTEN.ueberblick, ziele: [{ id: 'z-lang', titel: LANG, fortschritt: 33, link: '/os/planung/ziel/z-lang' }] } } };

  it('jedes Grid in der Karte hat genau eine Spalte minmax(0, 1fr)', async () => {
    const { Ueberblick } = await import('@/components/os/agenten/ZoeMitte');
    const html = await rendere(h(Ueberblick, {}), { agenten });
    expect(html).toContain('aria-label="Überblick"');
    const grids = stile(html).filter(s => /(^|;)display:grid/.test(s));
    expect(grids.length).toBeGreaterThanOrEqual(5);
    for (const s of grids) expect(s, s).toContain(EINS);
  });

  it('der lange Zieltitel bricht um, „33 %“ bleibt stehen, der Balken liegt in derselben Spalte', async () => {
    const { Ueberblick } = await import('@/components/os/agenten/ZoeMitte');
    const html = await rendere(h(Ueberblick, {}), { agenten });
    const knopf = new RegExp(`<a[^>]*style="([^"]*)"[^>]*>${LANG} ›</a>`).exec(html);
    expect(knopf, 'Zieltitel als Knopf').not.toBeNull();
    expect(knopf![1]).toContain('white-space:normal');
    expect(knopf![1]).toContain('min-width:0');
    const prozent = /<span style="([^"]*)">33 %<\/span>/.exec(html);
    expect(prozent).not.toBeNull();
    expect(prozent![1]).toContain('flex:0 0 auto');
    expect(prozent![1]).toContain('white-space:nowrap');
    expect(html).toContain('role="progressbar"');
  });

  it('Zeiten bei „Die nächsten Tage“ stehen fest, der Text bricht um', async () => {
    const { Ueberblick } = await import('@/components/os/agenten/ZoeMitte');
    const html = await rendere(h(Ueberblick, {}));
    expect(html).toContain('Die nächsten Tage');
    const zeiten = stile(html).filter(s => s.includes('white-space:nowrap') && s.includes('line-height:1.7'));
    expect(zeiten.length).toBeGreaterThan(0);
    for (const s of zeiten) expect(s).toContain('flex:0 0 auto');
    expect(stile(html).some(s => s.includes('flex:1') && s.includes('overflow-wrap:anywhere'))).toBe(true);
  });

  it('die ZOE-Mitte und die Handy-Fläche selbst wachsen nicht über ihren Platz', async () => {
    const { ZoeMitte } = await import('@/components/os/agenten/ZoeMitte');
    const mitte = await rendere(h(ZoeMitte, {}), { agenten });
    expect(stile(mitte)[0]).toContain(EINS);
    for (const s of stile(mitte.slice(0, mitte.indexOf('aria-label="Überblick"'))).filter(x => /(^|;)display:grid/.test(x))) expect(s).toContain(EINS);
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const flaeche = await rendere(h(AgentenFlaeche, { handyReiter: 'gespraech' }), { agenten });
    expect(stile(flaeche)[0]).toContain('--agenten-feld-unten');
    expect(stile(flaeche)[0]).toContain(EINS);
    // Die Maße stehen an EINER Stelle (masse.ts), nie verstreut in der ZOE-Mitte.
    expect(lies('components/os/agenten/ZoeMitte.tsx')).not.toMatch(/display: 'grid'/);
  });
});

describe('3. „Als Nächstes“: je wiederkehrendem Lauf nur das nächste Vorkommen', () => {
  const lauf = (wann: string, extra: Partial<Naechstes> = {}): Naechstes =>
    ({ id: `takt:sales:power_hour:${wann}`, serie: 'takt:sales:power_hour', art: 'zeitplan', titel: 'Power Hour vorbereiten', wann, headId: 'sales', link: '/os/agenten?h=sales', wichtig: false, dringend: false, quadrant: 'q4', ...extra });

  it('Power Hour Fr, Mo, Di, Mi → EIN Eintrag mit dem nächsten Vorkommen, „werktags bis Mi“', async () => {
    const { naechstesVerdichten } = await import('@/lib/agenten/naechstes');
    const { wiederholText } = await import('@/components/os/agenten/regeln');
    // Do 08.10. ist „jetzt“; Läufe Fr 09.10., Mo 12.10., Di 13.10., Mi 14.10. (das Wochenende fehlt — werktags).
    const liste = [lauf('2026-10-13T06:00:00.000Z'), lauf('2026-10-09T06:00:00.000Z', { dringend: true, quadrant: 'q3' }), lauf('2026-10-12T06:00:00.000Z'), lauf('2026-10-14T06:00:00.000Z')];
    const v = naechstesVerdichten(liste);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ wann: '2026-10-09T06:00:00.000Z', quadrant: 'q3', weitere: 3, bis: '2026-10-14T06:00:00.000Z', wiederholt: 'werktags' });
    expect(wiederholText(v[0], JETZT)).toBe('werktags bis Mi');
  });

  it('täglich, unregelmäßig, einmalig — und Einträge ohne Serie bleiben unberührt (Eisenhower, kritisch)', async () => {
    const { naechstesVerdichten, wiederholtVon, eintrag } = await import('@/lib/agenten/naechstes');
    const { wiederholText } = await import('@/components/os/agenten/regeln');
    expect(wiederholtVon(['2026-10-09T06:00:00.000Z', '2026-10-10T06:00:00.000Z', '2026-10-11T06:00:00.000Z'])).toBe('taeglich');
    expect(wiederholtVon(['2026-10-09T06:00:00.000Z', '2026-10-13T06:00:00.000Z'])).toBeUndefined();
    expect(wiederholtVon(['2026-10-09T06:00:00.000Z', '2026-10-09T09:00:00.000Z'])).toBeUndefined(); // zweimal am Tag = kein Tages-Takt
    const unregel = naechstesVerdichten([lauf('2026-10-09T06:00:00.000Z'), lauf('2026-10-13T06:00:00.000Z'), lauf('2026-10-27T06:00:00.000Z')]);
    expect(unregel[0].wiederholt).toBeUndefined();
    expect(wiederholText(unregel[0], JETZT)).toBe('+2 weitere bis 27.10.');
    expect(wiederholText({ weitere: 2, bis: '2026-10-10T06:00:00.000Z', wiederholt: 'taeglich' }, JETZT)).toBe('täglich bis Sa');
    const einzeln = naechstesVerdichten([lauf('2026-10-09T06:00:00.000Z')]);
    expect(einzeln[0].weitere).toBeUndefined();
    expect(wiederholText(einzeln[0], JETZT)).toBe('');
    const frist = eintrag({ id: 'frist:a', art: 'frist', titel: 'Zahlung A', wann: '2026-10-08', link: '/x', wichtig: true, dringend: true, kritisch: true });
    const frist2 = eintrag({ id: 'frist:b', art: 'frist', titel: 'Zahlung A', wann: '2026-10-09', link: '/x', wichtig: true, dringend: true });
    const freigabe = eintrag({ id: 'freigabe:sales', art: 'freigabe', titel: '2 Freigaben offen', wann: JETZT.toISOString(), link: '/os/stapel', wichtig: true, dringend: true, anzahl: 2 });
    const v = naechstesVerdichten([lauf('2026-10-12T06:00:00.000Z'), frist2, lauf('2026-10-09T06:00:00.000Z'), freigabe, frist]);
    expect(v.map(x => x.id)).toEqual(['frist:a', 'freigabe:sales', 'frist:b', 'takt:sales:power_hour:2026-10-09T06:00:00.000Z']);
    expect(v[0].kritisch).toBe(true);
  });

  it('Einträge der Läufe tragen ihre Serie; die Route verdichtet, die Rechnung (`naechstesLesen`) nicht', async () => {
    const { headEintraege, zeitplanEintraege } = await import('@/lib/agenten/naechstes');
    const t = headEintraege('sales', [{ modus: 'power_hour', wann: new Date('2026-10-09T06:00:00.000Z') }, { modus: 'power_hour', wann: new Date('2026-10-12T06:00:00.000Z') }], 'person-a', JETZT);
    expect(new Set(t.map(x => x.serie))).toEqual(new Set(['takt:sales:power_hour']));
    const z = zeitplanEintraege([{ art: 'skill', id: 'sk-1', titel: 'x', headId: 'assistenz', regel: { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '08:00' }, business: false, wichtig: false }],
      JETZT, new Date(JETZT.getTime() + 3 * 864e5), () => [], { auftraege: [], faeden: [] });
    expect(z.length).toBeGreaterThan(1);
    expect(new Set(z.map(x => x.serie))).toEqual(new Set(['zp:skill:sk-1']));
    const route = lies('app/api/agenten/laeufe/route.ts');
    expect(route).toMatch(/naechstes: naechstesVerdichten\(naechstes\)/);
    expect(lies('lib/agenten/naechstes.ts')).toMatch(/return naechstesSortieren\(raus\.filter\(x => zeitWert\(x\.wann\) < bis\.getTime\(\)\)\);/);
  });

  it('die Oberfläche zeigt den Takt hinter dem Titel (rechts und im Überblick)', async () => {
    const { AlsNaechstes } = await import('@/components/os/agenten/Hintergrund');
    const verdichtet = { ...FIX.LAEUFE, naechstes: [lauf('2026-10-09T06:00:00.000Z', { weitere: 3, bis: '2026-10-14T06:00:00.000Z', wiederholt: 'werktags' })] };
    const html = await rendere(h(AlsNaechstes, {}), { laeufe: { zustand: 'da', daten: verdichtet } });
    expect(html).toContain('Power Hour vorbereiten');
    expect(html).toContain('werktags bis Mi');
    const { Ueberblick } = await import('@/components/os/agenten/ZoeMitte');
    expect(await rendere(h(Ueberblick, {}), { laeufe: { zustand: 'da', daten: verdichtet } })).toContain('Power Hour vorbereiten · werktags bis Mi');
  });
});

describe('5. Head-Kopf: eine Kennzahl ohne Wert sagt, warum', () => {
  it('Lücke des Index → Satz unter der Kennzahl statt eines stummen „—“', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const heads = FIX.AGENTEN.heads.map(x => (x.id === 'sales' ? { ...x, kennzahlen: x.kennzahlen.map(k => (k.id === 'win_rate' ? { ...k, wert: null, ampel: 'grau' as const, hinweis: 'erst ab 10 Entscheidungen (0 gewonnen · 0 verloren)' } : k)) } : x));
    const html = await rendere(h(HeadMitte, { headId: 'sales', fadenId: FIX.FADEN_HEAD_ID }), { form: 'breit', agenten: { zustand: 'da', daten: { ...FIX.AGENTEN, heads } }, auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(html).toContain('erst ab 10 Entscheidungen (0 gewonnen · 0 verloren)');
    expect(html).toContain('Echte Gespräche · 7 Tage');
  });
  it('die Werte kommen aus dem Kern: ohne Messung trägt `quelle` den Satz der Lücke (lib/agenten/kontext.ts)', () => {
    const t = lies('lib/agenten/kontext.ts');
    expect(t).toMatch(/k\.gemessen === false && k\.quelle \? \{ luecke: k\.quelle \}/);
    expect(t).toMatch(/hinweis: w\.luecke/);
  });
});

describe('4. Einrichtung ohne Altbestand: kein festes Datum, kein Mac-Zulieferer', () => {
  const DATUM = /\b\d{1,2}\.\d{1,2}\.(\d{2,4})?/;
  const VERBOTEN = [DATUM, /Zulieferer/, /Upload-Tag|nach dem Upload|des Uploads/, /\b(Freitag|Samstag|Sonntag)\b/, /\b(Januar|September|Oktober|November)\b/, /Eure Entscheidung vom/];
  const NEU = { inhaber: true, haupt: true, personen: 2, privatFinanzen: true, altbestand: false };
  const ZWEITE = { inhaber: false, eingeladen: true, personen: 2, privatFinanzen: true, altbestand: false };

  it('Ablauf, Gruppen, Etappen, Datenkarte und jeder Schritt (Inhaber und zweite Person) — neutral', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    const texte: [string, string][] = [
      ...D.ablaufFuer(false).map(a => ['ablauf', `${a.wann} ${a.was}`] as [string, string]),
      ...Object.values(D.gruppenFuer(false)).map(g => ['gruppe', `${g.titel} ${g.satz}`] as [string, string]),
      ...D.etappenFuer(false).flatMap(e => [['etappe', `${e.titel} ${e.satz}`], ...(e.hinweise ?? []).map(x => ['hinweis', `${x.titel} ${x.wann} ${x.satz}`])] as [string, string][]),
      ...D.datenkarteFuer(false).map(d => ['datenkarte', `${d.fakt} ${d.hier} ${d.nicht}`] as [string, string]),
    ];
    for (const k of [NEU, ZWEITE]) {
      for (const s of D.schritteFuer(k).map(x => D.texteFuer(x, k))) texte.push([s.id, [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '', s.wartetAuf ?? '', s.wo?.label ?? ''].join(' | ')]);
    }
    for (const [wo, t] of texte) for (const re of VERBOTEN) expect(t, `${wo}: ${String(re)}`).not.toMatch(re);
    // Etappe 0 ohne den Hinweis der gewachsenen Instanz, die Hinweise zur Roadmap bleiben.
    expect(D.etappenFuer(false)[0].hinweise ?? []).toEqual([]);
    expect(D.etappenFuer(false).flatMap(e => e.hinweise ?? []).map(x => x.titel)).toContain('Bank-Anbindung');
  });

  it('mit Altbestand bleibt alles wie vorher (Fahrplan des Uploads, Stichtag, Mac-Zulieferer)', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    expect(D.ablaufFuer(true)).toBe(D.ABLAUF);
    expect(D.gruppenFuer(true)).toBe(D.GRUPPEN);
    expect(D.etappenFuer(true)).toBe(D.ETAPPEN);
    expect(D.datenkarteFuer(true)).toBe(D.DATENKARTE);
    expect(D.ABLAUF[0].wann).toMatch(DATUM);
    expect(D.etappenFuer(true)[0].hinweise?.map(x => x.titel)).toContain('Mac-Zulieferer wird abgeschaltet');
    const st = D.schrittMitId('stichtag')!;
    expect(D.texteFuer(st, { altbestand: true })).toBe(st);
    expect(D.texteFuer(st, { altbestand: false }).titel).toBe('Stichtag des 0-Punkts festlegen');
    expect(D.texteFuer(st, null).titel).toBe('Stichtag des 0-Punkts festlegen');
  });

  it('Fertig-Regel und Fortschritt hängen nicht an den Texten', async () => {
    const D = await import('@/lib/make-one/onboarding-data');
    const z = { erledigt: { stichtag: { at: '2026-10-09T08:00:00.000Z', von: 'x' } }, befunde: {} };
    const roh = D.schritteFuer(NEU);
    const neutral = roh.map(s => D.texteFuer(s, NEU));
    expect(neutral.map(s => D.istFertig(s, z))).toEqual(roh.map(s => D.istFertig(s, z)));
    expect(D.fortschrittVon(neutral, z).fertig).toBe(D.fortschrittVon(roh, z).fertig);
    expect(neutral.map(s => s.id)).toEqual(roh.map(s => s.id));
  });

  it('die Einrichtungs-Seite (vor dem Laden = ohne Altbestand) zeigt den neutralen Ablauf', async () => {
    const { OnboardingUebersicht } = await import('@/components/os/OnboardingView');
    const html = renderToStaticMarkup(h(OnboardingUebersicht, {}));
    expect(html).toContain('Zuerst · am Server');
    expect(html).toContain('Der Kern');
    for (const re of VERBOTEN) expect(html, String(re)).not.toMatch(re);
  });
});
