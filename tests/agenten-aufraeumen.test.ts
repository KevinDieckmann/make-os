// ─── Wächter: Agenten-Seite aufgeräumt nach dem Muster der Claude-App (09.10. abends, Branch `agenten-aufraeumen`) ─────────────────────
// Auftrag 09.10.: „Das ganze Agent-System ist noch unübersichtlich … bei Claude sieht das aufgeräumter aus — gleiches Prinzip.“ — „Es reicht,
// wenn wir links und rechts beides zuklappen können, damit der Chat größer und übersichtlicher wird.“ Entschieden: „Zuklappen + aufräumen“.
// Was dieser Wächter verspricht:
//   1. Jede vorher erreichbare Aktion ist weiter erreichbar — nur an einem ruhigeren Ort (Neu-Einträge, Freigaben, Geplant/Zeitpläne, Budget,
//      Not-Aus, ⋯-Einträge, je Head Mitarbeiter · Skills · Gedächtnis · Leistung · Einstellungen, Thread wechseln/neu/löschen).
//   2. Die Liste links zeigt NUR Namen (keine Untertitel unter Namen), Zustand als Punkt.
//   3. Links und rechts klappen ein (Knöpfe, ⌘B bzw. ⌘.), der Zustand wird je Browser gemerkt; beide zu → das Gespräch mittig in Lesebreite.
//   4. Über dem Gespräch steht nur die Kopfzeile; ist der Hintergrund zu, zeigt sie, was wartet.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as FIX from './fixtures/agenten-api';
import type { AgentenWert, Felder } from '@/components/os/agenten/kontext';
import type { StapelAntwort } from '@/components/os/agenten/daten';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/agenten' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const JETZT = new Date('2026-10-08T08:00:00.000Z');
const STAPEL: StapelAntwort = {
  ok: true, offen: 2,
  vorschlaege: [
    { id: 'v-beispiel-1', titel: 'Entwurf für Kunde A ablegen', werkzeug: 'crm_vorschlag', gruppe: 'markttraktion', bezug: { art: 'crm', id: 'nachricht_entwurf:c-1' }, status: 'offen', zeit: '2026-10-08T07:40:00.000Z' },
    { id: 'v-beispiel-3', titel: 'Notiz und zwei Unteraufgaben ergänzen', werkzeug: 'aufgabe_vorschlag', gruppe: 'aufgaben', bezug: { art: 'aufgabe', id: 't-beispiel' }, status: 'offen', zeit: '2026-10-08T07:45:00.000Z' },
  ],
};
const felder = (links: boolean, rechts: boolean, art: Felder['art'] = { links: 'neben', rechts: 'neben' }): Felder => ({ links, rechts, art, umschalten: () => {} });

async function rendere(kind: unknown, teil: Partial<AgentenWert> = {}): Promise<string> {
  const { AgentenKontext } = await import('@/components/os/agenten/kontext');
  const wert: AgentenWert = {
    agenten: { zustand: 'da', daten: FIX.AGENTEN }, faeden: { zustand: 'da', daten: FIX.FADEN_LISTE }, laeufe: { zustand: 'da', daten: FIX.LAEUFE },
    stapel: { zustand: 'da', daten: STAPEL }, form: 'breit', auswahl: { art: 'zoe' }, entwurf: null, starteEntwurf: () => {}, jetzt: JETZT,
    space: 'business', bereich: 'alle', oeffne: () => {}, dialog: () => {}, bestaetigen: async () => true, melde: () => {},
    vorlage: { faeden: { [FIX.FADEN_HEAD_ID]: FIX.FADEN_ANTWORT, [FIX.FADEN_MITARBEITER_ID]: { ok: true, faden: FIX.FADEN_MITARBEITER, stand: 'stand-beispiel-4', kinder: [] } }, skills: { sales: FIX.SKILLS } },
    ...teil,
  };
  return renderToStaticMarkup(h(AgentenKontext, { wert }, kind));
}
/** Sichtbarer Text eines HTML-Ausschnitts. */
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
/** Der Inhalt des Knopfs mit diesem aria-label. */
function knopf(html: string, label: string): string {
  const m = new RegExp(`<button[^>]*aria-label="${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
  expect(m, label).not.toBeNull();
  return m![1];
}

describe('1. Nichts geht verloren — jede Aktion hat einen (ruhigeren) Ort', () => {
  it('„Neu ▾“ steht oben in der Liste und — ist die Liste zu — als „+“ in der Kopfzeile; es führt zu Thread, Auftrag, an mehrere Heads, Hintergrundaufgabe, Mitarbeiter, Skill', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const offen = await rendere(h(AgentenFlaeche, {}), { felder: felder(true, true) });
    const liste = offen.slice(offen.indexOf('aria-label="Team"'));
    expect(liste).toContain('aria-label="Neu anlegen"');
    const zu = await rendere(h(AgentenFlaeche, {}), { felder: felder(false, true) });
    const kopf = zu.slice(zu.indexOf('aria-label="Gespräch"'));
    expect(kopf.slice(0, kopf.indexOf('aria-label="Verlauf"') > 0 ? kopf.indexOf('aria-label="Verlauf"') : undefined)).toContain('aria-label="Neu anlegen"');
    const quelle = lies('components/os/agenten/Kopfleiste.tsx');
    expect(quelle).toMatch(/label: 'Thread'/);
    for (const art of ['auftrag', 'mehrere', 'hintergrund', 'mitarbeiter', 'skill']) expect(quelle).toContain(`art: '${art}'`);
    for (const l of ['Auftrag', 'An mehrere Heads', 'Hintergrundaufgabe', 'Mitarbeiter', 'Skill']) expect(quelle).toContain(`label: '${l}'`);
  });

  it('rechts: Freigaben (Alle ›), Läuft (Ansehen, Stopp), Geplant (Zeitpläne), Fertig/Fehler; unten Budget, Not-Aus und ⋯ (Leitplanken, Budget, Zeitpläne, bisherige Übersicht)', async () => {
    const { Hintergrund } = await import('@/components/os/agenten/Hintergrund');
    const html = await rendere(h(Hintergrund, { onZu: () => {} }));
    expect(html).toContain('aria-label="Alle Freigaben ansehen"');
    expect(html).toContain('href="/os/stapel"');
    expect(html).toContain('„Kampagnen: Herbst-Kampagne“ ansehen');
    expect(html).toContain('„Kampagnen: Herbst-Kampagne“ stoppen');
    expect(html).toMatch(/aria-label="Zeitpläne verwalten/);
    expect(html).toContain('Fertig / Fehler (3)');
    expect(html).toContain('Kosten diesen Monat');
    expect(html).toContain('aria-label="Not-Aus"');
    expect(html).toContain('aria-label="Mehr: Leitplanken, Budget, Zeitpläne, bisherige Übersicht"');
    expect(html).toMatch(/aria-label="Hintergrund schließen/);
    const quelle = lies('components/os/agenten/Kopfleiste.tsx');
    const mehr = quelle.slice(quelle.indexOf('export function MehrMenue'));
    for (const art of ['leitplanken', 'budget', 'geplant', 'uebersicht']) expect(mehr).toContain(`dialog({ art: '${art}' })`);
    expect(lies('components/os/agenten/Hintergrund.tsx')).toContain("dialog({ art: 'geplant' })");
    // Freigaben-Seite auch über die ZOE-Reiter (Freigaben · Agenten · Loops · Brain · Empfang).
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('<ZoeReiter />');
  });

  it('am Handy steht der Hintergrund samt Budget, Not-Aus und ⋯ unter dem Reiter „Läuft“', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const html = await rendere(h(AgentenFlaeche, { handyReiter: 'laeuft' }), { form: 'handy' });
    expect(html).toContain('aria-label="Not-Aus"');
    expect(html).toContain('Kosten diesen Monat');
    expect(html).toContain('aria-label="Mehr: Leitplanken, Budget, Zeitpläne, bisherige Übersicht"');
    expect(html).not.toMatch(/aria-label="Hintergrund schließen/); // am Handy kein ✕ — es ist ein Reiter
  });

  it('je Head: Chat · Aktivität · Info; Info bündelt Mitarbeiter (Thread starten, Duplizieren), Skills, Gedächtnis, Leistung, Einstellungen', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const auswahl = { art: 'head' as const, headId: 'sales' };
    const info = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'info' }), { auswahl });
    for (const a of ['Mitarbeiter', 'Skills', 'Gedächtnis', 'Leistung', 'Einstellungen']) expect(info).toContain(`<span>${a}</span>`);
    const erwartet: Record<string, string[]> = {
      mitarbeiter: ['Thread starten', 'Duplizieren'], skills: ['/power-hour', 'eingebaut'], gedaechtnis: ['Merken', 'System · fest'],
      leistung: ['Annahmequote'], einstellungen: ['Modell', 'Budget je Monat in Euro'],
    };
    for (const [abschnitt, worte] of Object.entries(erwartet)) {
      const html = await rendere(h(HeadMitte, { headId: 'sales', startReiter: abschnitt }), { auswahl });
      for (const w of worte) expect(html, `${abschnitt}: ${w}`).toContain(w);
    }
    const ak = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'aktivitaet' }), { auswahl });
    expect(ak).toContain('Pipeline diese Woche');
  });

  it('Thread wechseln (Liste), neu (Kopfzeile, ⋯, „Neu ▾ › Thread“), löschen (⋯ — über EINEN Weg `fadenLoeschen`) bei ZOE, Head und Mitarbeiter', async () => {
    const { Team } = await import('@/components/os/agenten/Team');
    const liste = await rendere(h(Team, {}), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(liste).toContain('Thread „Pipeline diese Woche“ öffnen');
    expect(liste).toContain('Thread „Nachfassen Kunde A“ öffnen');
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const head = await rendere(h(HeadMitte, { headId: 'sales', fadenId: FIX.FADEN_HEAD_ID }), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(head).toContain('aria-label="Neuer Thread"');
    expect(head).toContain('aria-label="Mehr zu diesem Gespräch"');
    for (const d of ['HeadMitte.tsx', 'FadenMitte.tsx', 'ZoeMitte.tsx']) {
      const q = lies(`components/os/agenten/${d}`);
      expect(q, d).toMatch(/label: '(Thread|Gespräch) löschen'/);
      expect(q, d).toMatch(/fadenLoeschen\(/);
    }
    expect(lies('components/os/agenten/ZoeMitte.tsx')).toMatch(/label: 'Neues Gespräch'/);
    expect(lies('components/os/agenten/HeadMitte.tsx')).toMatch(/label: 'Neuer Thread'/);
  });
});

describe('2. Die Liste zeigt nur Namen', () => {
  it('Heads: Kugel + Name, sonst nichts sichtbar; Zustand als Punkt mit Ansage (Freigaben pulsieren)', async () => {
    const { Team } = await import('@/components/os/agenten/Team');
    const { kuerzel } = await import('@/components/os/agenten/regeln');
    const html = await rendere(h(Team, {}));
    for (const k of FIX.HEADS) {
      const inhalt = knopf(html, html.includes(`aria-label="${k.name} öffnen"`) ? `${k.name} öffnen` : (new RegExp(`aria-label="(${k.name.replace(/[&]/g, '&amp;')} öffnen[^"]*)"`).exec(html)?.[1] ?? `${k.name} öffnen`));
      expect(text(inhalt), k.id).toBe(`${kuerzel(k.kurz)}${k.kurz}`);
    }
    expect(html).toContain('Head of Sales öffnen — 2 Freigaben offen');
    expect(knopf(html, 'Head of Sales öffnen — 2 Freigaben offen')).toContain('krit-puls');
    // Die früheren Untertitel („steuert die Heads“, „3 Threads · 1 läuft“, „neuer Thread“, „hilft hier aus“) stehen nirgends mehr sichtbar.
    const sichtbar = text(html);
    for (const alt of ['steuert die Heads', 'neuer Thread', 'hilft hier aus']) expect(sichtbar).not.toContain(alt);
    expect(sichtbar).not.toMatch(/\d+ Threads?\b/);
  });

  it('Threads: nur der Titel (wer und Zustand in Tooltip und Ansage); Suche filtert Heads und Threads nach Namen', async () => {
    const { Team } = await import('@/components/os/agenten/Team');
    const html = await rendere(h(Team, {}), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(text(knopf(html, 'Thread „Nachfassen Kunde A“ öffnen — Nachfassen & Power Hour, fertig'.replace('&', '&amp;')))).toBe('Nachfassen Kunde A');
    expect(html).toContain('aria-label="Heads und Threads suchen"');
    expect(lies('components/os/agenten/Team.tsx')).toMatch(/suchPasst\(\[h\.name, h\.kurz\], suche\)/);
  });
});

describe('3. Links und rechts einklappen — gemerkt je Browser, Tasten ⌘B und ⌘.', () => {
  it('Merker: Vorgabe offen; „zu“ bleibt zu; gesperrter Speicher → offen, kein Fehler', async () => {
    const { merkerLesen, merkerSchreiben, MERKER } = await import('@/components/os/agenten/klappen');
    expect(MERKER).toEqual({ links: 'make-agenten-links', rechts: 'make-agenten-rechts' });
    const speicher = new Map<string, string>();
    const s = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); } };
    expect(merkerLesen('links', s)).toBe(true);
    merkerSchreiben('links', false, s);
    expect(speicher.get('make-agenten-links')).toBe('zu');
    expect(merkerLesen('links', s)).toBe(false);
    expect(merkerLesen('rechts', s)).toBe(true);
    merkerSchreiben('links', true, s);
    expect(merkerLesen('links', s)).toBe(true);
    const kaputt = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); } };
    expect(merkerLesen('rechts', kaputt)).toBe(true);
    expect(() => merkerSchreiben('rechts', false, kaputt)).not.toThrow();
    expect(merkerLesen('links', null)).toBe(true);
  });

  it('Tasten: ⌘B/Strg+B Liste, ⌘./Strg+. Hintergrund — nie im Eingabefeld, nie mit Umschalt/Alt, nie bei Wiederholung', async () => {
    const { klappTaste } = await import('@/components/os/agenten/klappen');
    const t = (key: string, x: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean }> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...x });
    expect(klappTaste(t('b', { metaKey: true }), null)).toBe('links');
    expect(klappTaste(t('B', { ctrlKey: true }), { tagName: 'BUTTON' })).toBe('links');
    expect(klappTaste(t('.', { metaKey: true }), null)).toBe('rechts');
    expect(klappTaste(t('.', { ctrlKey: true }), { tagName: 'DIV' })).toBe('rechts');
    expect(klappTaste(t('b'), null)).toBeNull();
    expect(klappTaste(t('b', { metaKey: true, shiftKey: true }), null)).toBeNull();
    expect(klappTaste(t('b', { metaKey: true, altKey: true }), null)).toBeNull();
    expect(klappTaste(t('b', { metaKey: true, repeat: true }), null)).toBeNull();
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(klappTaste(t('b', { metaKey: true }), { tagName })).toBeNull();
    expect(klappTaste(t('.', { metaKey: true }), { isContentEditable: true })).toBeNull();
    expect(klappTaste(t('k', { metaKey: true }), null)).toBeNull(); // ⌘K bleibt der Schnellsuche
  });

  it('keine andere Stelle der App belegt ⌘B oder ⌘. (die Seite hört nur hier hin)', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const wurzel = path.resolve(__dirname, '..');
    const dateien = (dir: string): string[] => readdirSync(path.join(wurzel, dir)).flatMap(n => {
      const rel = `${dir}/${n}`;
      return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.tsx?$/.test(n) ? [rel] : [];
    });
    const fremd = [...dateien('components'), ...dateien('hooks')].filter(d => !d.startsWith('components/os/agenten/'))
      .filter(d => /(metaKey|ctrlKey)[^\n]{0,80}(key(\.toLowerCase\(\))? === '(b|B|\.)')/.test(lies(d)));
    expect(fremd).toEqual([]);
    const seite = lies('components/os/agenten/AgentenSeite.tsx');
    expect(seite).toMatch(/const s = klappTaste\(e, document\.activeElement/);
    expect(seite).toMatch(/merkerSchreiben\(s, n\)/);
    expect(seite).toMatch(/merkerLesen\('links'\)/);
  });

  it('Lage nach gemessenem Platz: drei Spalten · Liste daneben + Hintergrund als Schublade · beide als Schublade', async () => {
    const { lageAus } = await import('@/components/os/agenten/klappen');
    const { DREI_SPALTEN_AB, ZWEI_SPALTEN_AB } = await import('@/components/os/agenten/masse');
    expect(lageAus(null, true)).toEqual({ form: 'breit', links: 'neben', rechts: 'neben' });
    expect(lageAus(null, false)).toEqual({ form: 'mittel', links: 'neben', rechts: 'schublade' });
    expect(lageAus(DREI_SPALTEN_AB, false)).toEqual({ form: 'breit', links: 'neben', rechts: 'neben' });
    expect(lageAus(DREI_SPALTEN_AB - 1, true)).toEqual({ form: 'mittel', links: 'neben', rechts: 'schublade' });
    expect(lageAus(ZWEI_SPALTEN_AB - 1, true)).toEqual({ form: 'mittel', links: 'schublade', rechts: 'schublade' });
  });

  it('zu = Breite 0, unsichtbar, nicht im Tab-Weg (aria-hidden, data-zu); beide zu → Gespräch mittig in Lesebreite', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const { SPALTE } = await import('@/components/os/agenten/masse');
    const html = await rendere(h(AgentenFlaeche, {}), { felder: felder(false, false) });
    expect(html).toMatch(/id="agenten-liste"[^>]*data-zu=""[^>]*aria-hidden="true"[^>]*style="[^"]*width:0/);
    expect(html).toMatch(/id="agenten-hintergrund"[^>]*data-zu=""[^>]*aria-hidden="true"[^>]*style="[^"]*width:0/);
    expect(html).toContain(`max-width:${SPALTE.lese}px;margin:0 auto`);
    expect(html).toContain('Liste aufklappen');
    expect(html).toContain('Hintergrund öffnen');
    const css = lies('app/globals.css');
    expect(css).toMatch(/\.agenten-seitenfeld\[data-zu\] \{ visibility: hidden;/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.agenten-seitenfeld/);
  });

  it('mittlere Breite: der Hintergrund ist eine Schublade über dem Gespräch (zu bis zum Klick)', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const zu = await rendere(h(AgentenFlaeche, {}), { form: 'mittel', felder: felder(true, false, { links: 'neben', rechts: 'schublade' }) });
    expect(zu).toMatch(/id="agenten-hintergrund" role="dialog"[^>]*class="agenten-schublade" data-zu="" aria-hidden="true"/);
    expect(zu).not.toContain('agenten-schleier');
    const offen = await rendere(h(AgentenFlaeche, {}), { form: 'mittel', felder: felder(true, true, { links: 'neben', rechts: 'schublade' }) });
    expect(offen).toContain('class="agenten-schleier"');
    expect(offen).toMatch(/id="agenten-hintergrund" role="dialog"[^>]*aria-label="Hintergrund" class="agenten-schublade" style=/);
  });
});

describe('4. Über dem Gespräch nur die Kopfzeile', () => {
  it('ZOE: über dem LEEREN Gespräch Begrüßung (höchstens 3 Zeilen „Seit deinem letzten Besuch“), sonst nur der Verlauf; Info über ⓘ', async () => {
    const { ZoeMitte } = await import('@/components/os/agenten/ZoeMitte');
    const viele = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, text: `Ereignis ${i + 1}`, zeit: '2026-10-08T07:00:00.000Z' }));
    const agenten = { zustand: 'da' as const, daten: { ...FIX.AGENTEN, ueberblick: { ...FIX.AGENTEN.ueberblick, passiert: viele } } };
    const leer = await rendere(h(ZoeMitte, {}), { agenten });
    expect(leer).toContain('Ereignis 3');
    expect(leer).not.toContain('Ereignis 4');
    expect(leer).toContain('+ 2 weitere');
    expect(leer).toContain('Vorschläge für heute');
    expect(leer).toContain('aria-label="Info: Überblick und Jahresziele"');
    // Mit Verlauf: keine Begrüßung, keine Vorschläge — nur das Gespräch.
    const zoe = FIX.FADEN_LISTE.faeden.find(f => f.agent.art === 'zoe')!;
    const mitVerlauf = await rendere(h(ZoeMitte, {}), {
      agenten, vorlage: { faeden: { [zoe.id]: { ok: true, faden: { ...FIX.FADEN_HEAD, id: zoe.id, agent: { art: 'zoe' }, titel: 'Tages-Briefing' }, stand: 's', kinder: [] } } },
    });
    expect(mitVerlauf).toContain('aria-label="Verlauf"');
    expect(mitVerlauf).not.toContain('Vorschläge für heute');
    expect(mitVerlauf).not.toContain('Ereignis 1');
  });

  it('Head: kein Auftrag, keine Kennzahlen, keine Chips über dem Chat — und keine Reihe @-Chips über dem Feld (erst beim Tippen von „@“)', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const html = await rendere(h(HeadMitte, { headId: 'sales', fadenId: FIX.FADEN_HEAD_ID }), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    const vorDemVerlauf = html.slice(0, html.indexOf('aria-label="Verlauf"'));
    expect(vorDemVerlauf).not.toContain('Sieht:');
    expect(vorDemVerlauf).not.toContain('Echte Gespräche');
    expect(vorDemVerlauf).not.toContain('aria-label="Threads"');
    expect(html).not.toContain('aria-label="Ansprechen"');
    expect(lies('components/os/agenten/Chat.tsx')).toMatch(/\{vorschlag\.length > 0 && \(/);
  });

  it('Hintergrund zu → die Kopfzeile zeigt „⚑ n warten“ und öffnet ihn; offen → kein Zähler', async () => {
    const { ZoeMitte } = await import('@/components/os/agenten/ZoeMitte');
    const zu = await rendere(h(ZoeMitte, {}), { felder: felder(true, false) });
    expect(zu).toContain('⚑ 2 warten');
    expect(zu).toContain('2 warten auf dich — Hintergrund öffnen');
    const offen = await rendere(h(ZoeMitte, {}), { felder: felder(true, true) });
    expect(offen).not.toContain('⚑ 2 warten');
  });
});
