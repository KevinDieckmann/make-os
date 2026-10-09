// ─── Agenten-Bereich · Paket 2 „Oberfläche“ (09.10., AGENTEN_KONZEPT.md C2 + C11) ─────────────────────────────────────
// Was die Seite /os/agenten verspricht — gerendert serverseitig gegen das Fixture des Vertrags (tests/fixtures/agenten-api.ts):
//   • drei Spalten (Team · Mitte · Hintergrund), Handy-Reiter Gespräch · Team · Läuft;
//   • ZOE-Mitte: Briefing, Überblick (passiert, in Arbeit, nächste Tage, wartet auf dich, Jahresziele), Vorschläge, Chat mit @Head;
//   • Head-Mitte: Kopf (Auftrag, 3 Kennzahlen, Skills als Chips) und die sieben Reiter; Delegation und Bericht als Karten;
//   • Mitarbeiter-Thread: Brotkrumen, Auftrag (Ziel · Format · Grenzen · Quellen), Schritte, „Zweite Meinung“;
//   • rechts: Wartet auf dich (Risiko-Ampel), Läuft, Als Nächstes nach Eisenhower, Fertig/Fehler eingeklappt;
//   • 501 (Stub) = ruhiger Leerzustand je Bereich, nie ein Fehler;
//   • Design-Standard: keine Farb-, Schrift- oder Ecken-Literale, Tippziele über ZIEL, Eingaben 16 px (`eingabe`/`feld`).
// Reine Regeln (Auswahl, @, Eisenhower, Risiko, Delegation, Zeitplan, Skill-Prüfung, Geld) stehen unten.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import * as FIX from './fixtures/agenten-api';
import type { AgentenWert } from '@/components/os/agenten/kontext';
import type { StapelAntwort } from '@/components/os/agenten/daten';
import type { FadenListeAntwort } from '@/lib/agenten/typen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/agenten' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const WURZEL = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(WURZEL, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(WURZEL, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(WURZEL, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}
const DATEIEN = [...dateien('components/os/agenten'), 'app/os/agenten/page.tsx'];

/** Erfundene Freigaben (wie GET /api/zoe/stapel): eine interne CRM-Änderung, ein risikoarmer Aufgaben-Vorschlag. */
const STAPEL: StapelAntwort = {
  ok: true, offen: 2,
  vorschlaege: [
    { id: 'v-beispiel-1', titel: 'Entwurf für Kunde A ablegen', werkzeug: 'crm_vorschlag', gruppe: 'markttraktion', bezug: { art: 'crm', id: 'nachricht_entwurf:c-1' }, status: 'offen', zeit: '2026-10-08T07:40:00.000Z' },
    { id: 'v-beispiel-3', titel: 'Notiz und zwei Unteraufgaben ergänzen', werkzeug: 'aufgabe_vorschlag', gruppe: 'aufgaben', bezug: { art: 'aufgabe', id: 't-beispiel' }, status: 'offen', zeit: '2026-10-08T07:45:00.000Z' },
  ],
};
const JETZT = new Date('2026-10-08T08:00:00.000Z');

async function wertMit(teil: Partial<AgentenWert> = {}): Promise<AgentenWert> {
  return {
    agenten: { zustand: 'da', daten: FIX.AGENTEN }, faeden: { zustand: 'da', daten: FIX.FADEN_LISTE }, laeufe: { zustand: 'da', daten: FIX.LAEUFE },
    stapel: { zustand: 'da', daten: STAPEL }, form: 'breit', auswahl: { art: 'zoe' }, entwurf: null, starteEntwurf: () => {}, jetzt: JETZT,
    space: 'business', bereich: 'alle', oeffne: () => {}, dialog: () => {}, bestaetigen: async () => true, melde: () => {},
    vorlage: {
      faeden: { [FIX.FADEN_HEAD_ID]: FIX.FADEN_ANTWORT, [FIX.FADEN_MITARBEITER_ID]: { ok: true, faden: FIX.FADEN_MITARBEITER, stand: 'stand-beispiel-4', kinder: [] } },
      skills: { sales: FIX.SKILLS },
    },
    ...teil,
  };
}
async function rendere(kind: unknown, teil: Partial<AgentenWert> = {}): Promise<string> {
  const { AgentenKontext } = await import('@/components/os/agenten/kontext');
  return renderToStaticMarkup(h(AgentenKontext, { wert: await wertMit(teil) }, kind));
}
const kommt = { zustand: 'kommt' as const, text: 'Kommt mit Paket 1.' };

describe('Drei Spalten gegen das Fixture', () => {
  it('breit: Team (ZOE + Heads nach Bereich), ZOE-Mitte, Hintergrund', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const html = await rendere(h(AgentenFlaeche, {}));
    // Team: ZOE oben, Heads nach Bereich mit Zählern
    expect(html).toContain('aria-label="Team"');
    expect(html.indexOf('ZOE öffnen')).toBeLessThan(html.indexOf('Head of Sales öffnen'));
    expect(html).toContain('aria-label="Business"');
    expect(html).toContain('aria-label="Privat"');
    expect(html).toContain('⚑ 2');
    expect(html).toContain('2 Threads');
    // Mitte: Briefing, Überblick, Vorschläge, Chat
    expect(html).toContain(FIX.AGENTEN.ueberblick.briefing!);
    expect(html).toContain('aria-label="Überblick"');
    expect(html).toContain('Head of Sales hat zwei Entwürfe zur Freigabe vorgelegt.');
    expect(html).toContain('Kampagnen: Herbst-Kampagne wird geplant.');
    expect(html).toContain('Jahresziel Umsatz');
    expect(html).toContain('Vorschläge für heute');
    expect(html).toContain('2 Freigaben durchgehen');
    expect(html).toContain('Nachricht an ZOE');
    expect(html).toContain('@Sales');
    // Rechts: Wartet auf dich · Läuft · Als Nächstes · Fertig/Fehler eingeklappt
    for (const t of ['Wartet auf dich', 'Läuft', 'Als Nächstes']) expect(html).toContain(`aria-label="${t}"`);
    expect(html.indexOf('aria-label="Wartet auf dich"')).toBeLessThan(html.indexOf('aria-label="Läuft"'));
    expect(html.indexOf('aria-label="Läuft"')).toBeLessThan(html.indexOf('aria-label="Als Nächstes"'));
    expect(html).toContain('Kampagnen: Herbst-Kampagne');
    expect(html).toContain('Schritt 2/4 · Segment prüfen');
    expect(html).toContain('Fertig (2)');
    expect(html).toContain('Fehler (1)');
    expect(html).not.toContain('Nachfassen Kunde A</span><button'); // Fertig bleibt eingeklappt
  });

  it('Als Nächstes nach Eisenhower: wichtig & dringend → wichtig → dringend → später; kritisch pulsiert', async () => {
    const { AlsNaechstes } = await import('@/components/os/agenten/Hintergrund');
    const html = await rendere(h(AlsNaechstes, {}));
    const reihe = ['Freigaben offen', 'Monatsabschluss eintragen', 'Power Hour vorbereiten', 'angebot-nachfassen'].map(t => html.indexOf(t));
    expect(reihe.every(i => i >= 0)).toBe(true);
    expect([...reihe].sort((a, b) => a - b)).toEqual(reihe);
    expect(html).toContain('Wichtig &amp; dringend');
    expect(html).toContain('krit-puls');
  });

  it('Wartet auf dich: Freigaben mit Risiko-Ampel, Rückfrage eines Threads mit Antwort in der Zeile', async () => {
    const { WartetAufDich } = await import('@/components/os/agenten/Hintergrund');
    const liste: FadenListeAntwort = { ok: true, faeden: [...FIX.FADEN_LISTE.faeden, { ...FIX.FADEN_LISTE.faeden[2], id: 'fd-beispiel-wartet', status: 'wartet', titel: 'Du oder Sie?' }] };
    const html = await rendere(h(WartetAufDich, {}), { faeden: { zustand: 'da', daten: liste } });
    expect(html).toContain('Wartet auf dich (3)');
    expect(html).toContain('Ändert Daten');
    expect(html).toContain('Risikoarm');
    expect(html).toContain('„Du oder Sie?“');
    expect(html).toContain('aria-label="Antwort an Nachfassen &amp; Power Hour"');
    expect(html).toContain('href="/os/stapel"');
  });

  it('Handy: Reiter Gespräch · Team · Läuft unten, Abzeichen zählt nur, was wartet', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const html = await rendere(h(AgentenFlaeche, { handyReiter: 'team' }), { form: 'handy' });
    expect(html).toContain('role="tablist"');
    for (const t of ['Gespräch', 'Team', 'Läuft']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>${t}`));
    expect(html).toContain('⚑ 2');
    expect(html).toContain('aria-label="Team"');
    expect(html).not.toContain('aria-label="Überblick"');
    expect(html).toContain('--agenten-feld-unten');
  });

  it('Handy: ein Head öffnet ganzflächig mit „‹ Team“', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const html = await rendere(h(AgentenFlaeche, { handyReiter: 'gespraech' }), { form: 'handy', auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(html).toContain('‹ Team');
    expect(html).toContain('Head of Sales');
    expect(html).not.toContain('aria-label="Team"');
  });
});

describe('Head-Mitte', () => {
  it('Kopf: Auftrag, drei Kennzahlen, Sieht/Sieht nicht, Skills und Mitarbeiter als Chips; sieben Reiter', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const html = await rendere(h(HeadMitte, { headId: 'sales', fadenId: FIX.FADEN_HEAD_ID }), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(html).toContain('Head of Sales');
    expect(html).toContain(FIX.HEADS[0].auftrag);
    for (const k of FIX.HEADS[0].kennzahlen) expect(html).toContain(k.label);
    expect(html).toContain('Sieht:');
    expect(html).toContain('Sieht nicht:');
    expect(html).toMatch(/Gesundheit/);
    expect(html).toContain('/power-hour');
    expect(html).toContain('/angebot-nachfassen');
    expect(html).toContain('Nachfassen &amp; Power Hour');
    for (const r of ['Chat · ⚑ 2', 'Aktivität', 'Mitarbeiter', 'Skills', 'Gedächtnis', 'Leistung', 'Einstellungen']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>${r.replace(/[·⚑]/g, '.')}`));
  });

  it('Chat: Verlauf mit KI-Marke, Delegation als aufklappbare Karte, Bericht als Verweis, Daumen, „Als Skill speichern“', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const html = await rendere(h(HeadMitte, { headId: 'sales', fadenId: FIX.FADEN_HEAD_ID }), { auswahl: { art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID } });
    expect(html).toContain('Wie sieht die Pipeline diese Woche aus');
    expect(html).toContain('Drei Deals hängen seit über 30 Tagen');
    expect(html).toContain('KI-Antwort — bitte prüfen');
    expect(html).toMatch(/aria-expanded="false"[^>]*>[\s\S]*An „Nachfassen &amp; Power Hour“ gesendet · „Nachfassen Kunde A“/);
    expect(html).toContain('◂ Bericht aus Thread „Nachfassen Kunde A“');
    expect(html).toContain('zwei Entwürfe liegen zur Freigabe bereit.');
    expect(html).toContain('Daumen hoch');
    expect(html).toContain('Als Skill speichern');
    expect(html).toContain('+ Neuer Thread');
    expect(html).toContain('Nachricht an Sales');
  });

  it('Reiter Mitarbeiter, Skills, Gedächtnis, Leistung, Einstellungen zeigen das Fixture', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const auswahl = { art: 'head' as const, headId: 'sales' };
    const ma = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'mitarbeiter' }), { auswahl });
    expect(ma).toContain('Empfehlungen');
    expect(ma).toContain('Thread starten');
    expect(ma).toContain('Duplizieren');
    const sk = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'skills' }), { auswahl });
    expect(sk).toContain('eingebaut');
    expect(sk).toContain('82 % angenommen');
    const ge = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'gedaechtnis' }), { auswahl });
    expect(ge).toContain('System · fest');
    expect(ge).toContain('Haushalt · Merksätze');
    expect(ge).toContain('Deals unter Mindestwert nur in der Wochenrunde ansprechen.');
    expect(ge).toContain('Merksatz „Deals unter Mindestwert nur in der Wochenrunde ansprechen.“ löschen');
    const le = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'leistung' }), { auswahl });
    expect(le).toContain('Annahmequote');
    expect(le).toContain('Kosten je Ergebnis');
    expect(le).toContain('Gemessen werden Agenten, nie Menschen.');
    const ei = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'einstellungen' }), { auswahl });
    expect(ei).toContain('Modell');
    expect(ei).toContain('nur verschärfen');
    expect(ei).toContain('nur messen');
    const ak = await rendere(h(HeadMitte, { headId: 'sales', startReiter: 'aktivitaet' }), { auswahl });
    expect(ak).toContain('angebot-nachfassen');
    expect(ak).toContain('Pipeline diese Woche');
  });

  it('gesperrter Head: ruhiger Hinweis statt Fehler', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const html = await rendere(h(HeadMitte, { headId: 'gesundheit' }), { auswahl: { art: 'head', headId: 'gesundheit' } });
    expect(html).toContain('Gerade ruhig');
    expect(html).toContain('Erscheint mit der Einwilligung');
    expect(html).not.toContain('role="alert"');
  });
});

describe('Mitarbeiter-Thread', () => {
  it('Brotkrumen, Auftrag in vier Teilen, Schritte, fremder Text → nur Vorschlag, „Zweite Meinung“', async () => {
    const { FadenMitte } = await import('@/components/os/agenten/FadenMitte');
    const html = await rendere(h(FadenMitte, { fadenId: FIX.FADEN_MITARBEITER_ID }), { auswahl: { art: 'faden', fadenId: FIX.FADEN_MITARBEITER_ID, headId: 'sales' } });
    expect(html).toContain('aria-label="Brotkrumen"');
    expect(html).toMatch(/Sales<\/button>[\s\S]*›[\s\S]*Nachfassen &amp; Power Hour[\s\S]*›[\s\S]*„Nachfassen Kunde A“/);
    for (const t of ['Ziel', 'Format', 'Grenzen', 'Quellen']) expect(html).toContain(`>${t}<`);
    expect(html).toContain('Nachfassen bei Kunde A vorbereiten');
    expect(html).toContain('Schritt 3/3');
    expect(html).toContain('Deal und Verlauf lesen');
    expect(html).toContain('nur als Vorschlag');
    expect(html).toContain('Zweite Meinung');
    expect(html).toContain('Nachricht an Nachfassen &amp; Power Hour');
  });

  it('neuer Thread (Entwurf): Leerzustand mit dem Auftrag in vier Teilen', async () => {
    const { FadenMitte } = await import('@/components/os/agenten/FadenMitte');
    const html = await rendere(h(FadenMitte, {}), { entwurf: { headId: 'marketing', mitarbeiterId: 'marketing-kampagnen' } });
    expect(html).toContain('Neuer Thread mit Kampagnen');
    expect(html).toContain('Ziel, Format, Grenzen und Quellen');
  });
});

describe('501 (Stub): ruhiger Leerzustand je Bereich, nie ein Fehler', () => {
  it('ganze Fläche mit allen Routen auf 501', async () => {
    const { AgentenFlaeche } = await import('@/components/os/agenten/AgentenSeite');
    const html = await rendere(h(AgentenFlaeche, {}), { agenten: kommt, faeden: kommt, laeufe: kommt, stapel: kommt });
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/Fehler \(|Konnte nicht laden/);
    expect(html).toContain('ZOE öffnen'); // ZOE ist immer da
    expect(html).toContain('sobald der Agenten-Kern läuft');
    expect(html).toContain('Hintergrundaufgaben erscheinen hier');
    expect(html).toContain('stehen hier, sobald die Vorschau läuft');
    expect(html).toContain('Nachricht an ZOE'); // der ZOE-Chat läuft schon (über /api/kimmi)
  });

  it('Head und Thread mit 501', async () => {
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const { FadenMitte } = await import('@/components/os/agenten/FadenMitte');
    const kopf = await rendere(h(HeadMitte, { headId: 'marketing' }), { agenten: kommt });
    expect(kopf).toContain('Head of Marketing');
    expect(kopf).toContain('kommt mit dem Agenten-Kern');
    expect(kopf).not.toContain('role="alert"');
    const faden = await rendere(h(FadenMitte, { fadenId: 'fd-unbekannt' }), { agenten: kommt, vorlage: {} });
    expect(faden).not.toContain('role="alert"');
  });

  it('der Client macht aus 501 „kommt“, aus 403 „gesperrt“, aus Netzfehler einen Satz', async () => {
    const { holen, senden } = await import('@/components/os/agenten/daten');
    const antwort = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', antwort(501, { ok: false, fehler: 'Kommt mit Paket 1.' }));
    expect(await holen('/api/agenten')).toEqual({ zustand: 'kommt', text: 'Kommt mit Paket 1.' });
    expect(await senden('/api/agenten/faden', {})).toMatchObject({ ok: false, kommt: true, status: 501 });
    vi.stubGlobal('fetch', antwort(403, { ok: false, fehler: 'Nur die Person selbst.' }));
    expect(await holen('/api/agenten')).toEqual({ zustand: 'gesperrt', text: 'Nur die Person selbst.' });
    vi.stubGlobal('fetch', antwort(200, FIX.AGENTEN));
    expect(await holen('/api/agenten')).toMatchObject({ zustand: 'da' });
    vi.stubGlobal('fetch', antwort(409, { ok: false, error: 'Stand veraltet.' }));
    expect(await senden('/api/agenten/faden', {})).toMatchObject({ ok: false, kommt: false, status: 409, text: 'Stand veraltet.' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await holen('/api/agenten')).zustand).toBe('fehler');
  });
  afterEach(() => { vi.unstubAllGlobals(); });
});

describe('Design-Standard (DESIGN_STANDARD.md) für components/os/agenten', () => {
  it('keine Farb-Literale (Hex, rgb, hsl) — Farben nur aus design.ts', () => {
    const funde = DATEIEN.flatMap(f => lies(f).split('\n').map((z, i) => ({ f, i, z })))
      .filter(({ z }) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(z) && !z.trim().startsWith('//'))
      .map(({ f, i }) => `${f}:${i + 1}`);
    expect(funde).toEqual([]);
  });

  it('Schrift nur über TYP (keine Zahl an fontSize), 11 px nur als Beschriftung in Großbuchstaben', () => {
    const funde: string[] = [];
    for (const f of DATEIEN) lies(f).split('\n').forEach((z, i) => {
      if (/fontSize:\s*\d/.test(z)) funde.push(`${f}:${i + 1} Zahl`);
      if (/TYP\.mikro/.test(z) && !/uppercase/.test(z)) funde.push(`${f}:${i + 1} mikro ohne Großbuchstaben`);
    });
    expect(funde).toEqual([]);
  });

  it('Ecken über ECKE/RADIUS, Tippziele über ZIEL (keine Zahl an borderRadius/minHeight)', () => {
    const funde: string[] = [];
    for (const f of DATEIEN) lies(f).split('\n').forEach((z, i) => {
      if (/borderRadius:\s*\d/.test(z)) funde.push(`${f}:${i + 1} borderRadius`);
      if (/minHeight:\s*\d/.test(z)) funde.push(`${f}:${i + 1} minHeight`);
    });
    expect(funde).toEqual([]);
  });

  it('jedes Eingabefeld nutzt den Standard `eingabe` (48/16 px) oder `feld` (44 px; am Handy 16 px über .ui-seite/.os-fenster)', () => {
    const funde: string[] = [];
    for (const f of DATEIEN) {
      const t = lies(f);
      for (const m of t.matchAll(/<(input|textarea)\b[\s\S]*?\/>/g)) {
        if (/type="checkbox"/.test(m[0])) continue;
        if (!/style=\{\{?\s*(\.\.\.)?(eingabe|feld)\b/.test(m[0])) funde.push(`${f}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it('der Chat-Eingabe sind 16 px garantiert, Hauptaktion 48 px, Tippziele ≥ 44 px', async () => {
    const { eingabe } = await import('@/components/os/ui');
    const { ZIEL } = await import('@/lib/make-one/design');
    expect(eingabe.fontSize).toBe(16);
    expect(ZIEL.haupt).toBe(48);
    expect(ZIEL.handy).toBeGreaterThanOrEqual(44);
    const chat = lies('components/os/agenten/Chat.tsx');
    expect(chat).toMatch(/<textarea[\s\S]*?style=\{\{ \.\.\.eingabe[\s\S]*?\/>/);
    expect(chat).toContain('<Knopf haupt typ="submit"');
    // Eigene Zeilen-Knöpfe der Seite halten das Tippziel über ZIEL
    expect(lies('components/os/agenten/Team.tsx')).toContain('minHeight: ZIEL.handy');
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('minHeight: ZIEL.handy');
  });

  it('Bausteine nur aus ../ui (nie schlank.tsx), kein eigenes h1, Seitenkopf über `Seite`, KI-Marke an KI-Antworten', () => {
    for (const f of DATEIEN) {
      const t = lies(f);
      expect(t, f).not.toMatch(/from '(\.\.\/|\.\/)schlank'/);
      expect(t, f).not.toMatch(/<h1[ >]/);
    }
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('<Seite titel="Agenten"');
    expect(lies('components/os/agenten/Chat.tsx')).toContain('<KiMarke');
  });

  it('höchstens EINE Fokus-Karte je Ansicht (Überblick) und keine FadenLinie ohne Daten', () => {
    for (const f of DATEIEN) {
      const t = lies(f);
      expect((t.match(/ton="fokus"/g) ?? []).length, f).toBeLessThanOrEqual(1);
      expect(t, f).not.toContain('<FadenLinie');
    }
  });

  it('Anfragen nur über den einen Client daten.ts; Adressen nur über WEG', () => {
    for (const f of DATEIEN.filter(x => !x.endsWith('/daten.ts'))) {
      const t = lies(f);
      expect(t, f).not.toMatch(/\bfetch\(/);
      expect(t, f).not.toMatch(/['"`]\/os\//);
      expect(t, f).not.toMatch(/['"`]\/api\//);
    }
    const seite = lies('components/os/agenten/AgentenSeite.tsx');
    expect(seite).toContain('WEG.agenten(o)');
    expect(seite).toMatch(/router\.push\(ziel/);
  });

  it('die Seite ist in der Schnellsuche und bleibt unter /os/agenten (AgentenView unter „⋯“)', async () => {
    const { SEITEN_SUCHE } = await import('@/lib/make-one/seiten');
    expect(SEITEN_SUCHE.some(s => s.href === '/os/agenten')).toBe(true);
    expect(lies('app/os/agenten/page.tsx')).toContain('AgentenSeite');
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('<AgentenView />');
  });
});

describe('Regeln der Oberfläche (rein)', () => {
  it('Auswahl aus der Adresse: ohne → ZOE, h → Head, f eines Heads → Head mit Thread, f eines Mitarbeiters → Thread', async () => {
    const { auswahlAus } = await import('@/components/os/agenten/regeln');
    const f = FIX.FADEN_LISTE.faeden;
    expect(auswahlAus(null, null, f)).toEqual({ art: 'zoe' });
    expect(auswahlAus('sales', null, f)).toEqual({ art: 'head', headId: 'sales' });
    expect(auswahlAus(null, FIX.FADEN_HEAD_ID, f)).toEqual({ art: 'head', headId: 'sales', fadenId: FIX.FADEN_HEAD_ID });
    expect(auswahlAus(null, FIX.FADEN_MITARBEITER_ID, f)).toEqual({ art: 'faden', fadenId: FIX.FADEN_MITARBEITER_ID, headId: 'sales' });
    expect(auswahlAus('<script>', '../x', f)).toEqual({ art: 'zoe' });
  });

  it('@-Ansprache: am Anfang, längster Name gewinnt, Groß/klein egal, Rest ohne Satzzeichen', async () => {
    const { ansprache, ansprechbarFuer } = await import('@/components/os/agenten/regeln');
    const heads = ansprechbarFuer('zoe', FIX.HEADS);
    expect(heads.some(a => a.id === 'gesundheit')).toBe(false); // gesperrte Heads spricht man nicht an
    expect(ansprache('@sales: wie läuft die Pipeline?', heads)).toMatchObject({ ziel: { id: 'sales' }, rest: 'wie läuft die Pipeline?' });
    expect(ansprache('Hallo @Sales', heads)).toBeNull();
    expect(ansprache('@Salesforce prüfen', heads)).toBeNull();
    const ma = ansprechbarFuer('head', FIX.HEADS, 'sales');
    expect(ansprache('@Nachfassen & Power Hour bitte Liste', ma)).toMatchObject({ ziel: { id: 'sales-nachfassen', art: 'mitarbeiter' }, rest: 'bitte Liste' });
  });

  it('Risiko-Ampel: Aufgaben-Vorschlag risikoarm, Versand nach außen, sonst intern', async () => {
    const { risikoVon } = await import('@/components/os/agenten/regeln');
    expect(risikoVon(STAPEL.vorschlaege[1])).toBe('risikoarm');
    expect(risikoVon(STAPEL.vorschlaege[0])).toBe('intern');
    expect(risikoVon({ id: 'x', titel: 'Mail an Kunde', werkzeug: 'mail_senden' })).toBe('aussen');
    expect(risikoVon({ id: 'y', titel: 'Einladung', werkzeug: 'aufgabe_vorschlag', gruppe: 'einladung', bezug: { art: 'aufgabe', id: 't' } })).toBe('aussen');
  });

  it('Delegation: Ziel · Format · Grenzen · Quellen aus dem Auftrag — und zurück', async () => {
    const { delegationTeile, auftragText } = await import('@/components/os/agenten/regeln');
    const d = delegationTeile(FIX.FADEN_MITARBEITER.nachrichten[0].text);
    expect(d).toEqual({
      ziel: 'Nachfassen bei Kunde A vorbereiten', format: 'zwei kurze Entwürfe mit Anlass', grenzen: 'nichts senden, nur Vorschläge', quellen: 'Deal-Verlauf, letzte Aktivitäten',
    });
    expect(delegationTeile('Bitte einfach machen')).toBeNull();
    expect(delegationTeile(auftragText(d!))).toEqual(d);
    expect(auftragText({ ziel: 'Liste bauen', quellen: ' ' })).toBe('Ziel: Liste bauen.');
  });

  it('Gruppen der Läufe und Eisenhower; Geld des Monats in Euro', async () => {
    const { laufGruppen, nachEisenhower, kostenImMonat, euro, dauerText, quote } = await import('@/components/os/agenten/regeln');
    const g = laufGruppen(FIX.LAEUFE.laeufe);
    expect(g.laeuft.map(l => l.id)).toEqual(['l1']);
    expect(g.fertig.map(l => l.id)).toEqual(['l2', 'l4']);
    expect(g.fehler.map(l => l.id)).toEqual(['l3']);
    expect(nachEisenhower(FIX.LAEUFE.naechstes).map(n => n.quadrant)).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(kostenImMonat(FIX.LAEUFE.laeufe, JETZT)).toBe(6);
    expect(kostenImMonat(FIX.LAEUFE.laeufe, new Date('2026-11-02T08:00:00Z'))).toBe(0);
    expect(euro(6)).toMatch(/^0,06\s€$/);
    expect(euro(null)).toBe('—');
    expect(dauerText(102_000)).toBe('1 Min. 42 s');
    expect(dauerText(420_000)).toBe('7 Min.');
    expect(dauerText(9_000)).toBe('9 s');
    expect(dauerText(3_900_000)).toBe('1 h 05');
    expect(quote(9, 11)).toBe('82 %');
    expect(quote(0, 0)).toBe('—');
  });

  it('Zeit in Berliner Wandzeit: heute nur Uhrzeit, gestern, Wochentag, Datum', async () => {
    const { zeitKurz } = await import('@/components/os/agenten/regeln');
    expect(zeitKurz('2026-10-08T07:41:00.000Z', JETZT)).toBe('09:41');
    expect(zeitKurz('2026-10-07T16:00:00.000Z', JETZT)).toBe('gestern 18:00');
    expect(zeitKurz('2026-10-10', JETZT)).toBe('Sa 10.10.');
    expect(zeitKurz('2026-10-09', JETZT)).toBe('morgen');
    expect(zeitKurz('2026-09-01T10:00:00.000Z', JETZT)).toBe('01.09.');
  });

  it('Skill-Auslöser in Klartext mit nächstem Lauf (Berliner Zeit)', async () => {
    const { ausloeserText, naechsterLaufText } = await import('@/components/os/agenten/regeln');
    expect(ausloeserText({ art: 'hand' })).toBe('von Hand');
    expect(ausloeserText({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' })).toBe('werktags 08:00');
    expect(ausloeserText({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '15:00', tage: [5] })).toBe('wöchentlich Fr 15:00');
    expect(ausloeserText({ art: 'ereignis', ereignis: 'neuer-lead', filter: 'nur aus Events' })).toBe('bei: neuer Lead · nur aus Events');
    // Do 08.10. 10:00 Berlin: werktags 08:00 → Fr 09.10.; wöchentlich Mo → Mo 12.10.; täglich 23:00 → heute
    expect(naechsterLaufText({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' }, JETZT)).toBe('nächster Lauf Fr 09.10. 08:00');
    expect(naechsterLaufText({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '07:00', tage: [1] }, JETZT)).toBe('nächster Lauf Mo 12.10. 07:00');
    expect(naechsterLaufText({ art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '23:00' }, JETZT)).toBe('nächster Lauf Do 08.10. 23:00');
    expect(naechsterLaufText({ art: 'hand' }, JETZT)).toBeNull();
  });

  it('Skill-Entwurf prüfen wie der Server: Name, Längen, Werkzeuge des Heads, Uhrzeit, Tests; Einschalten erst mit Tests und Testlauf', async () => {
    const { skillPruefen, leererSkill, skillName, aktivierenFehlt } = await import('@/components/os/agenten/regeln');
    const { headDef } = await import('@/lib/agenten/katalog');
    const werkzeuge = headDef('sales')!.werkzeuge;
    const gut = leererSkill('sales', { name: 'angebot-nachfassen', beschreibung: 'Fasst Angebote nach.', anleitung: '1. Lesen 2. Entwurf', werkzeuge: ['crm_suche'] });
    expect(skillPruefen(gut, werkzeuge)).toEqual([]);
    expect(skillPruefen({ ...gut, name: 'Angebot Nachfassen' }, werkzeuge).join(' ')).toContain('Kleinbuchstaben');
    expect(skillPruefen({ ...gut, anleitung: 'x'.repeat(20_001) }, werkzeuge).join(' ')).toContain('20.000');
    expect(skillPruefen({ ...gut, werkzeuge: ['gesundheits_index'] }, werkzeuge).join(' ')).toContain('gesundheits_index');
    expect(skillPruefen({ ...gut, ausloeser: { art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '25:00' } }, werkzeuge).join(' ')).toContain('HH:MM');
    expect(skillPruefen({ ...gut, tests: [{ eingabe: '', erwartet: [''] }] }, werkzeuge).join(' ')).toContain('Test');
    expect(skillName('Angebot nachfassen — Ü!')).toBe('angebot-nachfassen-ue');
    expect(aktivierenFehlt(2, true)).toContain('mindestens 3');
    expect(aktivierenFehlt(3, false)).toContain('Testlauf');
    expect(aktivierenFehlt(3, true)).toBeNull();
  });

  it('Euro-Eingabe, Leistung je Head, der aktuelle ZOE-Thread (der jüngste — Paket 4a statt Gespräch als Kontext)', async () => {
    const { centAus, leistungVon, zoeFadenAktuell, vorschlaegeHeute } = await import('@/components/os/agenten/regeln');
    expect(centAus('0,50')).toBe(50);
    expect(centAus('2')).toBe(200);
    expect(centAus('1.250,00 €')).toBe(125_000);
    expect(centAus('')).toBeUndefined();
    expect(Number.isNaN(centAus('viel'))).toBe(true);
    const l = leistungVon('sales', FIX.SKILLS.skills, FIX.LAEUFE.laeufe);
    expect(l.annahme.text).toBe('82 %');
    expect(l.laeufe).toBe(2);
    expect(l.kostenJeErgebnis).toMatch(/^0,04\s€$/);
    const zoe = (id: string, aktualisiert: string) => ({ id, titel: id, agent: { art: 'zoe' as const }, status: 'offen' as const, aktualisiert });
    expect(zoeFadenAktuell([zoe('fd-alt-00000000', '2026-10-01T08:00:00Z'), zoe('fd-neu-00000000', '2026-10-09T08:00:00Z'), { ...zoe('fd-head-0000000', '2026-10-10T08:00:00Z'), agent: { art: 'head' as const, headId: 'sales' } }])).toBe('fd-neu-00000000');
    expect(zoeFadenAktuell([])).toBeUndefined();
    const v = vorschlaegeHeute({ freigaben: 2, naechstes: FIX.LAEUFE.naechstes, wartend: 0 });
    expect(v[0].text).toBe('2 Freigaben durchgehen');
    expect(v.length).toBeLessThanOrEqual(4);
  });
});
