// ─── Prozesse · Werkstatt — Oberfläche der Reiter Läufe und Tests, Scharf-Dialog, Webhook, Heute (22.10.; Kevins Bild n8n „Executions“) ─────────────────────────
// Ohne Browser: die Reiter Bauen · Läufe · Tests (Adresse `w=`/`lauf=`), der Knoten im Lauf (Ring nach Stand, „wartet auf dich“ pulsiert mit Frist, nicht erreicht
// grau), die Fläche mit dem Lauf (Marken, gedämpfter Rest), der Log-Baum, der Scharf-Dialog (Kosten aufgeschlüsselt, Rückfrage „bestehende Fälle“ mit Vorgabe
// „nur neue“, Budget vorbelegt), die Webhook-Karte (Schlüssel nur aus der Antwort, nie gespeichert), die Tageszeile auf Heute (nur Business, ohne Lauf keine Karte).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/prozesse' }));

import { WERKSTATT_REITER } from '@/components/os/prozesse/Werkstatt';
import { KnotenZeichnung } from '@/components/os/prozesse/WerkstattKnoten';
import { WerkstattFlaeche } from '@/components/os/prozesse/WerkstattFlaeche';
import { LogBaum } from '@/components/os/prozesse/WerkstattLaeufe';
import { ScharfFenster } from '@/components/os/prozesse/WerkstattSteuerung';
import { WebhookKarte, beispielKoerper } from '@/components/os/prozesse/WerkstattWebhook';
import { ProzesseHeuteZeile } from '@/components/os/prozesse/HeuteProzesse';
import { testErgebnisse } from '@/components/os/prozesse/WerkstattTests';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { knotenUnterzeile } from '@/lib/prozesse/werkstatt-maske';
import { laufLog, laufMarken, laufWeg } from '@/lib/prozesse/laeufe-ansicht';
import { definition, fk, schritt, PZ, J } from './fixtures/prozess-bau';
import type { LaufSchritt } from '@/lib/prozesse/lauf-typen';

const wurzel = process.cwd();
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const nichts = () => undefined;
const d = definition([schritt(10, 'Anrufen', 1), schritt(12, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) } }), schritt(13, 'Fertig', 3, { form: 'ende' }), schritt(20, 'Abgesagt', 4, { form: 'ende' })]);
const l = werkstattLage(d);
const schritte: LaufSchritt[] = [
  { knoten: fk(3), status: 'erledigt', ab: J, bis: J, ausgang: 'weiter' },
  { knoten: fk(10), status: 'erledigt', ab: J, bis: J, ausgang: 'weiter' },
  { knoten: fk(12), status: 'wartet', ab: J },
];

describe('Reiter Bauen · Läufe · Tests (Adresse w=, ein Lauf lauf=)', () => {
  it('drei Reiter; die Werkstatt schaltet sie über die Adresse (router.push, WEG.prozesse mit w und lauf)', () => {
    expect(WERKSTATT_REITER.map(r => [r.id, r.titel])).toEqual([['bauen', 'Bauen'], ['laeufe', 'Läufe'], ['tests', 'Tests']]);
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain("router.push(WEG.prozesse({ p: prozessId, ansicht: 'werkstatt', w,");
    expect(w).toContain("reiter === 'laeufe' && (");
    expect(w).toContain("reiter === 'tests' && (");
    expect(w).toContain('<WerkstattSteuerung');
  });
});

describe('Lauf-Ansicht: derselbe Plan, nach dem echten Weg gefärbt (Punkt 29)', () => {
  const k = (id: string) => d.knoten.find(x => x.id === id)!;
  const svg = (kind: ReturnType<typeof h>) => renderToStaticMarkup(h('svg', null, kind));
  it('„wartet auf dich“: Ring pulsiert (krit-puls — still bei reduzierter Bewegung), Frist am Knoten; nicht erreicht = grau', () => {
    const m = laufMarken({ schritte, status: 'wartet', wartet: { knoten: fk(12), art: 'freigabe', wirkung: 'v-1', bis: '2026-10-29T12:00:00.000Z' } }, () => true);
    const warten = svg(h(KnotenZeichnung, { k: k(fk(12)), l: l.knoten.get(fk(12))!, unterzeile: '', belegt: new Set<string>(), marke: m.get(fk(12)), nurLesen: true }));
    expect(warten).toContain('krit-puls');
    expect(warten).toContain('wartet auf dich · bis 29.10.');
    expect(warten).toContain('data-ws-lauf="wartet"');
    const grau = svg(h(KnotenZeichnung, { k: k(fk(13)), l: l.knoten.get(fk(13))!, unterzeile: '', belegt: new Set<string>(), grau: true, nurLesen: true }));
    expect(grau).toContain('opacity="0.38"');
    expect(grau).toContain('data-ws-lauf="nicht-erreicht"');
    const fremd = svg(h(KnotenZeichnung, { k: k(fk(12)), l: l.knoten.get(fk(12))!, unterzeile: '', belegt: new Set<string>(), marke: laufMarken({ schritte, status: 'wartet', wartet: { knoten: fk(12), art: 'freigabe', wirkung: 'v-1' } }).get(fk(12)), nurLesen: true }));
    expect(fremd).not.toContain('krit-puls');
    expect(lies('app/globals.css')).toMatch(/prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important;/);
  });
  it('die Fläche mit Lauf: Marken an den besuchten Knoten, der Rest grau; kein „+“ (nur lesen)', () => {
    const html = renderToStaticMarkup(h(WerkstattFlaeche, {
      d, lage: l, szene: 's', auswahl: [], kanteWahl: null, rahmenWahl: null, andockWahl: null, probe: null, lauf: { marken: laufMarken({ schritte, status: 'wartet' }), weg: laufWeg(schritte) },
      befundJe: new Map<string, 'fehler' | 'offen'>(), unterzeile: x => knotenUnterzeile(x), mitSchloss: new Set<string>(), nurLesen: true, raster: true, label: 'Lauf',
      onAuswahl: nichts, onKante: nichts, onRahmen: nichts, onUnter: nichts, onZiehen: nichts, onVerbinden: nichts, onAnhaengen: nichts, onZuklappen: nichts, onTaste: () => false,
    }));
    expect((html.match(/data-ws-lauf="gelaufen"/g) ?? []).length).toBe(2);
    expect(html).toContain('data-ws-lauf="wartet"');
    expect((html.match(/data-ws-lauf="nicht-erreicht"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('data-ws-plus=');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('fadenImLauf');
  });
  it('der Log-Baum: Schritte in Reihenfolge, Stand als Wort (Farbe nie allein)', () => {
    const html = renderToStaticMarkup(h(LogBaum, { gruppen: laufLog(schritte, d, J), wahl: null, onWahl: nichts }));
    expect(html).toContain('aria-label="Log des Laufs"');
    expect(html.indexOf('Start')).toBeLessThan(html.indexOf('Anrufen'));
    expect(html).toContain('gelaufen');
    expect(html).toContain('wartet');
  });
  it('Inhalte nur live: die Läufe-Ansicht holt sie über ?inhalte=1 (Rechte der Person) — der Lauf-Bestand trägt keine', () => {
    const daten = lies('components/os/prozesse/laeufe-daten.ts');
    expect(daten).toContain('&inhalte=1');
    expect(lies('components/os/prozesse/WerkstattLaeufe.tsx')).toContain('inhalteHolen(p.laufId)');
    expect(lies('components/os/prozesse/WerkstattLaeufe.tsx')).toContain('Als Testfall übernehmen');
  });
});

describe('Scharf-Dialog: Kosten, Rückfrage, Budget je Prozess', () => {
  const vorschau = { version: 2, bestehende: 4, laeufeJeMonat: 30, agentenSchritte: 2, schaetzungCent: 240, befunde: [], jeLaufCent: 8, stufen: [{ stufe: 'schnell', schritte: 2, centJeSchritt: 4 }] };
  const props = { prozessId: PZ, def: d, status: 'probelauf' as const, hatVersion: true, laufStand: null, rechte: { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true }, nurAnsehen: false,
    stand: () => 'x', onStatus: async () => null, onGeaendert: async () => undefined, onMeldung: nichts, onZu: nichts };
  it('„Läufe × Agenten-Schritte × Modellstufe“, die Frage nach bestehenden Fällen (Vorgabe nur neue) und das Budget vorbelegt', () => {
    const html = renderToStaticMarkup(h(ScharfFenster, { ...props, vorschau }));
    expect(html).toContain('30 Läufe × 2 Agenten-Schritte × Stufe „schnell“');
    expect(html).toContain('Gilt das für 4 bestehende Fälle?');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Nur neue Fälle/);
    expect(html).toContain('value="4"'); // 1,5 × 2,40 € → 4 €
    expect(html).toContain('Scharf schalten');
  });
  it('offene Punkte sperren den Knopf; die Erklärungen hängen an Budget und Rückfrage', () => {
    const html = renderToStaticMarkup(h(ScharfFenster, { ...props, vorschau: { ...vorschau, befunde: [{ stufe: 'offen', text: '„Antwort einordnen“: Entscheidungen durch ein Modell laufen (noch) nicht.' }] } }));
    expect(html).toContain('kann noch nicht scharf laufen');
    const s = lies('components/os/prozesse/WerkstattSteuerung.tsx');
    for (const k of ['prozesse.budget', 'prozesse.bestehende', 'prozesse.zustand', 'prozesse.flutschutz', 'prozesse.notbremse', 'prozesse.wiedereintritt', 'prozesse.ziel-abbruch']) expect(s).toContain(`erklaerung="${k}"`);
  });
});

describe('Webhook am Auslöser: Schlüssel genau einmal sichtbar', () => {
  const webhook = { prozessId: PZ, adresse: '/api/prozesse/webhook/pw-0123456789abcdef01234567', scharf: false, angelegtAm: J, anzahl: 2, zuletztAm: J };
  const basis = { prozessId: PZ, webhook, eingaenge: [{ am: J, lauf: { id: 'pl-x', status: 'wartet' as const } }, { am: J }], felder: [{ id: 'thema', art: 'text' as const, pflicht: true }], darf: true, versionHatWebhook: true, onWebhook: nichts };
  it('ohne frischen Schlüssel: nur „gesetzt“; mit Schlüssel aus der Antwort: einmal sichtbar mit Kopieren', () => {
    const ohne = renderToStaticMarkup(h(WebhookKarte, basis));
    expect(ohne).toContain('gesetzt seit');
    expect(ohne).not.toContain('data-webhook-geheim');
    const mit = renderToStaticMarkup(h(WebhookKarte, { ...basis, geheimVorgabe: { adresse: webhook.adresse, schluessel: 'A'.repeat(43) } }));
    expect(mit).toContain('A'.repeat(43));
    expect(mit).toContain('wird nur jetzt gezeigt');
  });
  it('der Schlüssel landet nie im Speicher des Browsers; Schalter mit Erklärung; Eingänge nur Zeit und Status; Beispiel ohne echte Werte', () => {
    const src = lies('components/os/prozesse/WerkstattWebhook.tsx');
    expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(src).toContain('erklaerung="prozesse.webhook-scharf"');
    const html = renderToStaticMarkup(h(WebhookKarte, basis));
    expect(html).toContain('Lauf gestartet · wartet');
    expect(html).toContain('kein Lauf');
    expect(beispielKoerper([{ id: 'mail', art: 'email' }, { id: 'n', art: 'zahl' }])).toBe('{\n  "mail": "name@example.invalid",\n  "n": 1\n}');
  });
});

describe('Testfälle: Ergebnis gegen die Erwartung', () => {
  it('gleich → grün; Fehler des Servers → nicht prüfbar', () => {
    const t = [{ id: 't1', nr: 1, fall: 'beispiel' as const, erwartet: [{ knotenId: 'a', status: 'wuerde' as const }], am: J }];
    expect(testErgebnisse(t, [{ id: 't1', ok: true, ist: [{ knotenId: 'a', status: 'wuerde' }] }])[0].ok).toBe(true);
    expect(testErgebnisse(t, [{ id: 't1', ok: true, ist: [{ knotenId: 'a', status: 'fehler' }] }])[0].ok).toBe(false);
    expect(testErgebnisse(t, [{ id: 't1', ok: false, fehler: 'Diesen Fall gibt es nicht.', ist: [] }])[0]).toMatchObject({ ok: false, fehler: 'Diesen Fall gibt es nicht.' });
  });
});

describe('Heute: „Prozesse heute: n gelaufen, m warten auf dich“ — nur Business', () => {
  it('ohne Lauf keine Karte; mit Zahlen ein Link zu Prozesse', () => {
    expect(renderToStaticMarkup(h(ProzesseHeuteZeile, { vorgabe: { gelaufen: 0, warten: 0, aufDich: 0 } }))).toBe('');
    const html = renderToStaticMarkup(h(ProzesseHeuteZeile, { vorgabe: { gelaufen: 3, warten: 2, aufDich: 1 } }));
    expect(html).toContain('Prozesse heute: 3 gelaufen, 1 wartet auf dich');
    expect(html).toContain('href="/os/prozesse"');
    expect(lies('components/os/prozesse/HeuteProzesse.tsx')).toContain('?heute=1&space=business');
  });
  it('im Business-Standard von Heute, nie im Privat-Standard; das Widget passt nur auf Business-Flächen', async () => {
    const { HEUTE_STANDARD, HEUTE_FLAECHE } = await import('@/components/os/HeuteView');
    const { widgetPasst } = await import('@/lib/flaeche/sicht');
    expect(HEUTE_STANDARD.business.some(p => p.art === 'prozesse')).toBe(true);
    expect(HEUTE_STANDARD.privat.some(p => p.art === 'prozesse')).toBe(false);
    expect(widgetPasst(HEUTE_FLAECHE.privat, 'prozesse')).toBe(false);
    expect(widgetPasst(HEUTE_FLAECHE.business, 'prozesse')).toBe(true);
    expect(HEUTE_FLAECHE.business).toBe('uebersicht-business');
  });
});
