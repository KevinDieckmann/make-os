// ─── Erklärungen (10.10.) — Wächter ────────────────────────────────────────────────────────────────────────────────────────
// Kevin 10.10.: „Wenn man auf die einzelnen Sachen klickt, möchte ich, dass die Erklärung dahinter ist und was es bedeutet — mit Fallbeispiel.
// Das will ich überall.“ Der Test hält fest, dass das überall gilt: jeder Schalter trägt eine Erklärung (oder steht mit Grund auf der kurzen
// Ausnahmeliste), jeder Schlüssel in der Oberfläche hat einen Text, jede Register-Kennzahl hat „wie gerechnet“ und ein gerechnetes Beispiel, jeder
// Head und jeder Mitarbeiter im Katalog hat „tut / tut nie / Beispiel“, jeder Onboarding-Schritt ein Beispiel — und kein Text nennt Personen.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { EINSTELLUNGEN, abschnitteVon, erklaerungFuer } from '@/lib/erklaerungen';
import { einstellungAbschnitte } from '@/lib/erklaerungen/typen';
import { HEAD_TEXTE, MITARBEITER_BEISPIELE, headAbschnitte, mitarbeiterAbschnitte } from '@/lib/erklaerungen/agenten';
import { KENNZAHL_TEXTE, kennzahlAbschnitte, kennzahlBeispiel, kennzahlTextVon, kennzahlWieGerechnet } from '@/lib/erklaerungen/kennzahlen';
import { SCHRITT_BEISPIELE } from '@/lib/erklaerungen/schritte';
import { KATALOG } from '@/lib/agenten/katalog';
import { SCHRITTE } from '@/lib/make-one/onboarding-data';
import { KENNZAHLEN } from '@/lib/business/register';
import { PRIVAT_KENNZAHLEN } from '@/lib/privat/index';
import { GESUNDHEIT_KENNZAHLEN } from '@/lib/gesundheit/index';
import { TRAKTION_KENNZAHLEN } from '@/lib/crm/traktion-index';
import { fzKennzahlen } from '@/lib/zeitmessung/kennzahlen';
import { KP_KENNZAHLEN } from '@/lib/kapazitaet/kennzahlen';
import { KI_BEREICHE } from '@/lib/datenschutz/ki-einstellungen';
import { GESUNDHEIT_ZWECKE } from '@/lib/datenschutz/gesundheit-einwilligung';
import { GESUNDHEIT_MODULE } from '@/lib/gesundheit/module';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}
const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));

/** Alle Öffnungs-Tags `<Name … >` einer Datei (Klammern und Zeichenketten werden beachtet). */
function tags(src: string, name: string): { tag: string; zeile: number }[] {
  const aus: { tag: string; zeile: number }[] = [];
  let i = 0;
  while ((i = src.indexOf(`<${name}`, i)) !== -1) {
    if (!/[\s/>]/.test(src[i + name.length + 1] ?? '')) { i += name.length + 1; continue; }
    let tiefe = 0, j = i + name.length + 1, zeichen: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (zeichen) { if (c === '\\') j++; else if (c === zeichen) zeichen = null; continue; }
      if (c === '"' || c === "'" || c === '`') { zeichen = c; continue; }
      if (c === '{') tiefe++;
      else if (c === '}') tiefe--;
      else if (c === '>' && tiefe === 0 && src[j - 1] !== '=') break;
    }
    aus.push({ tag: src.slice(i, j + 1), zeile: src.slice(0, i).split('\n').length });
    i = j;
  }
  return aus;
}

const OBERFLAECHE = dateien('components').filter(f => f.endsWith('.tsx'));
/** Wörter, die in Erklärtexten nie vorkommen (Plattform-Regel: nichts Persönliches, keine festen Firmen, keine Gesundheitsdetails einer Person). */
const VERBOTEN = /kevin|malin\b|marlene|dieckmann|kemaris|kd ventures|poincap|hubspot|wittner|hyrox|psoriasis|bandscheibe|cannabis|make innovation gmbh|\balex\b/i;

describe('Schalter: jeder trägt eine Erklärung — oder steht mit Grund auf der kurzen Ausnahmeliste', () => {
  const alle = OBERFLAECHE.filter(f => !f.startsWith('components/os/ui/')).flatMap(f => tags(lies(f), 'Schalter').map(t => ({ ...t, datei: f })));

  it('es gibt Schalter, und keiner fehlt ohne `erklaerung` oder `erklaerungOhne`', () => {
    expect(alle.length).toBeGreaterThan(40);
    const ohne = alle.filter(t => !/\berklaerung=|\berklaerungOhne=/.test(t.tag)).map(t => `${t.datei}:${t.zeile}`);
    expect(ohne).toEqual([]);
  });

  it('die Ausnahmeliste bleibt kurz, jeder Grund ist ein ganzer Satz', () => {
    const ohne = alle.filter(t => /\berklaerungOhne=/.test(t.tag));
    expect(ohne.length).toBeLessThanOrEqual(14);
    for (const t of ohne) {
      const grund = /erklaerungOhne="([^"]+)"/.exec(t.tag)?.[1] ?? '';
      expect(grund.length, `${t.datei}:${t.zeile}`).toBeGreaterThanOrEqual(25);
    }
  });

  it('Erledigt-Haken und Tabellenzellen stehen auf der Ausnahmeliste, echte Einstellungen nicht', () => {
    const ohne = alle.filter(t => /\berklaerungOhne=/.test(t.tag)).map(t => t.datei);
    // Die wichtigen Einstellungsseiten tragen keine Ausnahme.
    for (const wichtig of ['components/os/datenschutz/KiGesundheit.tsx', 'components/os/BedienungView.tsx', 'components/os/ZugangEinstellungen.tsx', 'components/os/agenten/HeadMitte.tsx']) {
      expect(ohne, wichtig).not.toContain(wichtig);
    }
  });
});

describe('Schlüssel: jede Erklärung in der Oberfläche hat einen Text, jeder Text wird benutzt', () => {
  const VORLAGEN: Record<string, readonly string[]> = {
    'gesundheit.': GESUNDHEIT_ZWECKE,
    'ki.bereich.': KI_BEREICHE,
    'gesundheit.modul.': GESUNDHEIT_MODULE,
    'head.abschnitt.': ['auftrag', 'wissen', 'unterlagen', 'mitarbeiter', 'skills', 'gedaechtnis', 'leistung', 'einstellungen'],
  };
  const benutzt = new Set<string>();
  const unbekannt: string[] = [];
  for (const f of OBERFLAECHE) {
    const src = lies(f);
    for (const m of src.matchAll(/(?<![\w-])erklaerung="([^"]+)"/g)) benutzt.add(m[1]);
    for (const m of src.matchAll(/(?<![\w-])erklaerung=\{`([^`]+)`\}/g)) {
      const teile = /^([a-z.]+)\$\{[^}]+\}$/.exec(m[1]);
      const liste = teile && VORLAGEN[teile[1]];
      if (!liste) { unbekannt.push(`${f}: ${m[1]}`); continue; }
      for (const x of liste) benutzt.add(`${teile![1]}${x}`);
    }
    // Schlüssel, die eine Komponente selbst als Zeichenkette setzt (z. B. `erklaerung: 'konto.team'`).
    for (const m of src.matchAll(/(?<![\w-])erklaerung: '([a-z.]+)'/g)) benutzt.add(m[1]);
  }

  it('keine Vorlage ohne bekannte Schlüsselliste', () => { expect(unbekannt).toEqual([]); });

  it('jeder benutzte Schlüssel hat einen Text (Wortwahl, Beispiel)', () => {
    const fehlen = [...benutzt].filter(k => !(k in EINSTELLUNGEN));
    expect(fehlen).toEqual([]);
    for (const k of benutzt) {
      const t = erklaerungFuer(k)!;
      expect(t.was.length, `${k}.was`).toBeGreaterThanOrEqual(40);
      expect(t.beispiel.length, `${k}.beispiel`).toBeGreaterThanOrEqual(30);
    }
  });

  it('kein Text liegt ungenutzt herum — neuer Text ohne Stelle in der Oberfläche fällt auf', () => {
    const ungenutzt = Object.keys(EINSTELLUNGEN).filter(k => !benutzt.has(k));
    expect(ungenutzt).toEqual([]);
  });

  it('Texte sind kurz und stehen in ganzen Sätzen (Abschnitt ≤ 560 Zeichen, endet mit Satzzeichen)', () => {
    for (const [k, t] of Object.entries(EINSTELLUNGEN)) {
      for (const a of einstellungAbschnitte(t)) {
        expect(a.text.length, `${k} · ${a.kopf}`).toBeLessThanOrEqual(560);
        expect(/[.!?“)]$/.test(a.text), `${k} · ${a.kopf} endet ohne Satzzeichen`).toBe(true);
      }
    }
  });

  it('Ein/Aus-Schalter erklären beide Seiten (Wenn an · Wenn aus)', () => {
    const mitSchalter = new Set<string>();
    for (const f of OBERFLAECHE) for (const t of tags(lies(f), 'Schalter')) { const m = /erklaerung="([^"]+)"/.exec(t.tag); if (m) mitSchalter.add(m[1]); }
    for (const k of mitSchalter) {
      const t = erklaerungFuer(k)!;
      expect(t.an, `${k} fehlt „Wenn an“`).toBeTruthy();
      expect(t.aus, `${k} fehlt „Wenn aus“`).toBeTruthy();
    }
  });

  it('abschnitteVon: Schlüssel → Abschnitte, fertige Abschnitte unverändert, unbekannter Schlüssel → nichts', () => {
    const a = abschnitteVon('ki.hintergrund');
    expect(a.map(x => x.kopf)).toEqual(['Was es bedeutet', 'Beispiel', 'Wenn an', 'Wenn aus', 'Kosten und Datenweg']);
    expect(abschnitteVon([{ kopf: 'X', text: 'Y' }])).toEqual([{ kopf: 'X', text: 'Y' }]);
    expect(abschnitteVon('gibt.es.nicht' as never)).toEqual([]);
  });
});

describe('Kennzahlen: jede Register-Kennzahl hat „wie gerechnet“, ein gerechnetes Beispiel und „was ihr tun könnt“', () => {
  const register = [
    ['Business', KENNZAHLEN], ['Privat', PRIVAT_KENNZAHLEN], ['Gesundheit', GESUNDHEIT_KENNZAHLEN], ['Traktion', TRAKTION_KENNZAHLEN],
    ['Fokus & Zeit privat', fzKennzahlen('privat')], ['Fokus & Zeit business', fzKennzahlen('business')], ['Kapazität', KP_KENNZAHLEN],
  ] as const;

  for (const [name, liste] of register) {
    it(`${name}: ${liste.length} Kennzahlen`, () => {
      expect(liste.length).toBeGreaterThan(0);
      for (const k of liste) {
        expect(k.formel.trim().length, `${k.id}: Formel`).toBeGreaterThanOrEqual(10);
        const a = kennzahlAbschnitte({ label: k.label, einheit: k.einheit, richtung: k.richtung, gruen: k.gruen, rot: k.rot, formel: k.formel, pflegen: k.pflegen, luecke: k.luecke });
        expect(a.map(x => x.kopf), k.id).toEqual(['Wie gerechnet', 'Beispiel', 'Was ihr tun könnt']);
        for (const x of a) expect(x.text.length, `${k.id} · ${x.kopf}`).toBeGreaterThan(30);
        expect(a[1].text, k.id).toMatch(/von 100 Punkten/);
        expect(a[0].text, k.id).toContain('Punkte');
      }
    });
  }

  it('das Beispiel rechnet wie der Index: Mitte zwischen den Schwellen → gelb, 60 Punkte', () => {
    const b = kennzahlBeispiel({ label: 'Runway', einheit: 'monate', richtung: 'hoch', gruen: 6, rot: 3 });
    expect(b).toContain('4,5 Monate');
    expect(b).toContain('gelb');
    expect(b).toContain('60 von 100 Punkten');
    const n = kennzahlBeispiel({ label: 'Überfällig', einheit: 'prozent', richtung: 'niedrig', gruen: 5, rot: 20 });
    expect(n).toContain('12,5 %');
    expect(n).toContain('gelb');
    const direkt = kennzahlBeispiel({ label: 'Score', einheit: 'punkte', richtung: 'hoch', gruen: 80, rot: 40 });
    expect(direkt).toContain('60 Punkte');
    expect(kennzahlWieGerechnet({ einheit: 'punkte', richtung: 'hoch', gruen: 80, rot: 40, formel: 'Mittel der Faktoren' })).toContain('schon ein Score');
  });

  it('eine nicht gemessene Kennzahl nennt, was fehlt', () => {
    const a = kennzahlAbschnitte({ label: 'Runway', einheit: 'monate', richtung: 'hoch', gruen: 6, rot: 3, formel: 'Kasse ÷ Ausgaben', gemessen: false, luecke: 'Kein Kontostand erfasst' });
    expect(a[2].text).toContain('Noch nicht gemessen — es fehlt: Kein Kontostand erfasst.');
  });

  it('Zahlen ohne Register haben ihren eigenen Text — und jeder benutzte Schlüssel gibt es', () => {
    const benutzt = new Set<string>();
    for (const f of OBERFLAECHE) for (const m of lies(f).matchAll(/kennzahlTextVon\('([^']+)'\)/g)) benutzt.add(m[1]);
    expect(benutzt.size).toBeGreaterThan(5);
    for (const k of benutzt) {
      expect(KENNZAHL_TEXTE[k], k).toBeTruthy();
      expect(kennzahlTextVon(k).map(x => x.kopf), k).toEqual(['Wie gerechnet', 'Beispiel', 'Was ihr tun könnt']);
    }
    const ungenutzt = Object.keys(KENNZAHL_TEXTE).filter(k => !benutzt.has(k));
    expect(ungenutzt).toEqual([]);
  });
});

describe('Agenten: jeder Head und jeder Mitarbeiter im Katalog hat „tut / tut nie / Beispiel-Vorschlag“', () => {
  it('jeder Head', () => {
    for (const hd of KATALOG) {
      const t = HEAD_TEXTE[hd.id];
      expect(t, hd.id).toBeTruthy();
      expect(t.tut.length, `${hd.id}.tut`).toBeGreaterThanOrEqual(40);
      expect(t.nie.length, `${hd.id}.nie`).toBeGreaterThanOrEqual(40);
      expect(t.beispiel.length, `${hd.id}.beispiel`).toBeGreaterThanOrEqual(40);
      expect(headAbschnitte(hd.id).map(x => x.kopf)).toEqual(['Was er tut', 'Was er nie tut', 'Beispiel-Vorschlag']);
    }
  });

  it('jeder Mitarbeiter: Rolle als „tut“, die Grenzen seines Heads als „nie“, ein eigenes Beispiel', () => {
    for (const hd of KATALOG) {
      for (const m of hd.mitarbeiter) {
        expect(MITARBEITER_BEISPIELE[m.id], m.id).toBeTruthy();
        expect(MITARBEITER_BEISPIELE[m.id].length, m.id).toBeGreaterThanOrEqual(40);
        const a = mitarbeiterAbschnitte(m.id);
        expect(a.map(x => x.kopf), m.id).toEqual(['Was er tut', 'Was er nie tut', 'Beispiel-Vorschlag']);
        expect(a[0].text).toBe(m.rolle);
        expect(a[1].text).toContain(HEAD_TEXTE[hd.id].nie);
        expect(a[1].text).toContain('delegiert nie weiter');
      }
    }
  });

  it('keine Texte zu Heads oder Mitarbeitern, die der Katalog nicht kennt', () => {
    const heads = new Set(KATALOG.map(x => x.id));
    const ma = new Set(KATALOG.flatMap(x => x.mitarbeiter.map(m => m.id)));
    expect(Object.keys(HEAD_TEXTE).filter(k => !heads.has(k))).toEqual([]);
    expect(Object.keys(MITARBEITER_BEISPIELE).filter(k => !ma.has(k))).toEqual([]);
  });

  it('ein selbst angelegter Mitarbeiter (ohne Vorlage) hat keine Erklärung — und stört nicht', () => {
    expect(mitarbeiterAbschnitte('eigener-mitarbeiter')).toEqual([]);
    expect(headAbschnitte('gibt-es-nicht')).toEqual([]);
  });
});

describe('Onboarding: jeder Schritt hat ein Beispiel', () => {
  it('jeder Schritt trägt `beispiel`, und es steht kein Beispiel ohne Schritt da', () => {
    expect(SCHRITTE.length).toBeGreaterThan(80);
    const ohne = SCHRITTE.filter(s => !s.beispiel || s.beispiel.length < 40).map(s => s.id);
    expect(ohne).toEqual([]);
    const ids = new Set(SCHRITTE.map(s => s.id));
    expect(Object.keys(SCHRITT_BEISPIELE).filter(k => !ids.has(k))).toEqual([]);
  });

  it('die Beispiele gelten für jede Instanz: keine festen Daten, Wochentage und Monate (wie die neutrale Einrichtung, tests/rundgang-funde.test.ts)', () => {
    for (const [id, t] of Object.entries(SCHRITT_BEISPIELE)) expect(t, id).not.toMatch(/\b\d{1,2}\.\d{1,2}\.(\d{2,4})?|\b(Freitag|Samstag|Sonntag)\b|\b(Januar|September|Oktober|November)\b|Zulieferer|Upload/);
  });

  it('die Einrichtung zeigt das Beispiel unter dem „Warum“', () => {
    const src = lies('components/os/OnboardingView.tsx');
    expect(src).toContain('s.beispiel');
    expect(src.indexOf('s.warum')).toBeLessThan(src.indexOf('s.beispiel'));
  });
});

describe('Neutral: keine Personen, keine festen Firmen, keine Gesundheitsdetails in den Texten', () => {
  const quellen = readdirSync(path.join(wurzel, 'lib/erklaerungen')).map(n => `lib/erklaerungen/${n}`);

  /** Die Quelle ohne Kommentare (in Kommentaren darf stehen, wer etwas wollte — in den Texten nie). */
  const ohneKommentare = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');

  it('die Texte in den Quelldateien enthalten keines der verbotenen Wörter', () => {
    for (const f of quellen) expect(VERBOTEN.test(ohneKommentare(lies(f))), f).toBe(false);
  });

  it('auch die gebauten Texte nicht (Einstellungen, Heads, Mitarbeiter, Kennzahlen, Schritte)', () => {
    const alle: string[] = [
      ...Object.values(EINSTELLUNGEN).flatMap(t => einstellungAbschnitte(t).map(a => a.text)),
      ...Object.values(HEAD_TEXTE).flatMap(t => [t.tut, t.nie, t.beispiel]),
      ...Object.values(MITARBEITER_BEISPIELE),
      ...Object.values(KENNZAHL_TEXTE).flatMap(t => [t.wie, t.beispiel, t.tun ?? '']),
      ...Object.values(SCHRITT_BEISPIELE),
    ];
    expect(alle.length).toBeGreaterThan(300);
    for (const t of alle) expect(VERBOTEN.test(t), t.slice(0, 60)).toBe(false);
  });

  it('Beispiele nennen nur erfundene Namen („Beispiel GmbH“, „Mira“)', () => {
    const quelle = lies('lib/erklaerungen/agenten.ts') + lies('lib/erklaerungen/schritte.ts');
    expect(quelle).toContain('Beispiel GmbH');
    for (const m of ohneKommentare(quelle).matchAll(/([\p{L}-]+) (?:GmbH|AG)\b/gu)) expect(['Beispiel', 'Software'], m[0]).toContain(m[1]);
  });
});

describe('Baustein (components/os/ui/erklaerung.tsx)', () => {
  it('das „i“: 44 × 44, aria-expanded/-controls, Name im aria-label', async () => {
    const { ErklaerKnopf } = await import('@/components/os/ui/erklaerung');
    const m = renderToStaticMarkup(h(ErklaerKnopf, { offen: false, onClick: () => {}, id: 'erkl-x', name: 'Hintergrund-KI' }));
    expect(m).toContain('aria-expanded="false"');
    expect(m).toContain('aria-controls="erkl-x"');
    expect(m).toContain('aria-label="Erklärung zu Hintergrund-KI anzeigen"');
    expect(m).toContain('width:44px');
    expect(m).toContain('height:44px');
    const offen = renderToStaticMarkup(h(ErklaerKnopf, { offen: true, onClick: () => {}, id: 'erkl-x' }));
    expect(offen).toContain('aria-expanded="true"');
    expect(offen).toContain('ausblenden');
  });

  it('das Panel zeigt jeden Abschnitt mit Beschriftung und Text; das Beispiel trägt eine Kante', async () => {
    const { ErklaerPanel } = await import('@/components/os/ui/erklaerung');
    const m = renderToStaticMarkup(h(ErklaerPanel, { id: 'p', abschnitte: abschnitteVon('ki.hintergrund') }));
    expect(m).toContain('role="region"');
    expect(m).toContain('Was es bedeutet');
    expect(m).toContain('Beispiel');
    expect(m).toContain('Wenn an');
    expect(m).toContain('Wenn aus');
    expect(m).toContain('border-left');
    expect(renderToStaticMarkup(h(ErklaerPanel, { id: 'p', abschnitte: [] }))).toBe('');
  });

  it('Schalter: mit Erklärung steht das „i“ neben dem Schalter, ohne bleibt alles wie vorher', async () => {
    const { Schalter } = await import('@/components/os/ui');
    const mit = renderToStaticMarkup(h(Schalter, { an: true, onChange: () => {}, karte: true, erklaerung: 'ki.hintergrund' }, 'Hintergrund-KI'));
    expect(mit).toContain('role="switch"');
    expect(mit).toContain('data-erklaerung="knopf"');
    expect(mit).toContain('aria-label="Erklärung zu Hintergrund-KI anzeigen"');
    const ohne = renderToStaticMarkup(h(Schalter, { an: true, onChange: () => {}, erklaerungOhne: 'Testfall mit Grund' }, 'Hintergrund-KI'));
    expect(ohne).toContain('role="switch"');
    expect(ohne).not.toContain('data-erklaerung');
  });

  it('Zeile: der Titel klappt auf (role=button, aria-expanded); ohne Erklärung unverändert', async () => {
    const { Zeile } = await import('@/components/os/ui');
    const mit = renderToStaticMarkup(h(Zeile, { titel: 'Pausen im Arbeitstag', erklaerung: 'gesundheit.erholung.pausen' }));
    expect(mit).toContain('role="button"');
    expect(mit).toContain('aria-expanded="false"');
    expect(mit).toContain('tabindex="0"');
    const ohne = renderToStaticMarkup(h(Zeile, { titel: 'Pausen im Arbeitstag' }));
    expect(ohne).not.toContain('role="button"');
    expect(ohne).not.toContain('aria-expanded');
    // Ist die Zeile selbst ein Tippziel, steht das „i“ als eigener Knopf davor.
    const klick = renderToStaticMarkup(h(Zeile, { titel: 'Skill', erklaerung: 'agenten.freigabePflicht', onClick: () => {} }));
    expect(klick).toContain('data-erklaerung="knopf"');
    expect(klick).not.toContain('role="button"');
  });

  it('Überschrift, Beschriftung, Feldzeile, Kennzahl und Zahl nehmen eine Erklärung', async () => {
    const ui = await import('@/components/os/ui');
    const u = renderToStaticMarkup(h(ui.Ueberschrift, { erklaerung: 'ki.schalter' }, 'KI-Schalter'));
    expect(u).toContain('data-erklaerung="knopf"');
    const b = renderToStaticMarkup(h(ui.Beschriftung, { erklaerung: 'bedienung.dichte' }, 'Dichte'));
    expect(b).toContain('data-erklaerung="knopf"');
    const f = renderToStaticMarkup(h(ui.Feldzeile, { label: 'Budget', erklaerung: 'head.budget' }, h('input', {})));
    expect(f).toContain('data-erklaerung="knopf"');
    expect(f).toContain('<label');
    const k = renderToStaticMarkup(h(ui.Kennzahl, { wert: '75 %', label: 'Last', erklaerung: kennzahlTextVon('kapazitaet.last4') }));
    expect(k).toContain('aria-expanded="false"');
    expect(k).toContain('Last');
    const z = renderToStaticMarkup(h(ui.Zahl, { wert: '5', label: 'Puffer', erklaerung: kennzahlTextVon('kapazitaet.puffer') }));
    expect(z).toContain('aria-expanded="false"');
    const o = renderToStaticMarkup(h(ui.Kennzahl, { wert: '1', label: 'Ohne' }));
    expect(o).not.toContain('aria-expanded');
  });

  it('Klappbar nimmt eine Erklärung; sie steht auch bei zugeklapptem Abschnitt zur Verfügung', async () => {
    const { Klappbar } = await import('@/components/os/ui');
    const m = renderToStaticMarkup(h(Klappbar, { id: 'a', titel: 'Skills', offen: false, umschalten: () => {}, erklaerung: 'head.abschnitt.skills' }, 'Inhalt'));
    expect(m).toContain('data-erklaerung="knopf"');
    expect(m).not.toContain('Inhalt');
  });

  it('DESIGN_STANDARD.md nennt den Baustein', () => {
    const md = lies('DESIGN_STANDARD.md');
    for (const n of ['Erklaert', 'ErklaerKnopf', 'ErklaerPanel', 'erklaerung', 'erklaerungOhne', 'lib/erklaerungen']) expect(md, n).toContain(n);
  });
});
