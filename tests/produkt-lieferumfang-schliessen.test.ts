// ─── Produkt-Karte · Lieferumfang: ein getippter Punkt geht beim Schließen nicht verloren (21.10., Rundgang 19.10. B9) ──────────────────────────
// Fund: Text im Feld „+ Punkt“ ohne Enter/„Hinzufügen“ war nach „Fertig“ (bzw. Schließen der Karte, Zuklappen des Abschnitts) still weg — die Kehrseite
// des A6-Fixes (Verlassen hängt nicht mehr an). Jetzt: beim Schließen übernommen, mit der Regel des Anlege-Felds (`feldAbschluss`) — ein leeres Feld
// speichert nichts, ein Punkt der Liste kommt nie doppelt; passt er nicht (zu lang, Liste voll), bleibt er als Entwurf. Erfundene Inhalte.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lieferumfangBeimSchliessen, lieferumfangDazu, LIEFER_MAX } from '@/lib/crm/produkt-katalog';

// ── Lieferumfang beim Schließen (rein + Wächter) ──────────────────────────────────────────────────────────────────────────────────────

describe('B9neu · Lieferumfang: getippter Punkt geht beim Schließen nicht verloren', () => {
  it('leer → nichts; Text → genau einmal; schon in der Liste → nichts (nie doppelt); zu lang/voll → bleibt als Entwurf', () => {
    expect(lieferumfangBeimSchliessen(['A'], '   ')).toEqual({ art: 'nichts' });
    expect(lieferumfangBeimSchliessen(['A'], ' Kick-off ')).toEqual({ art: 'speichern', liste: ['A', 'Kick-off'] });
    expect(lieferumfangBeimSchliessen(['A', 'Kick-off'], 'kick-off')).toEqual({ art: 'nichts' });
    expect(lieferumfangBeimSchliessen([], 'x'.repeat(LIEFER_MAX.zeichen + 1))).toMatchObject({ art: 'behalten', fehler: expect.stringMatching(/Zu lang/) });
    expect(lieferumfangBeimSchliessen(Array.from({ length: LIEFER_MAX.anzahl }, (_, i) => `P${i}`), 'neu')).toMatchObject({ art: 'behalten' });
  });
  it('Folge „tippen, Enter, tippen, Schließen“ = zwei Punkte; „Enter, Schließen“ = einer', () => {
    let liste: string[] = [];
    const enter = (t: string) => { const r = lieferumfangDazu(liste, t); if (r.ok) liste = r.liste; return ''; };
    const schliessen = (t: string) => { const r = lieferumfangBeimSchliessen(liste, t); if (r.art === 'speichern') liste = r.liste; };
    schliessen(enter('Befund'));
    expect(liste).toEqual(['Befund']);
    enter('Fahrplan'); schliessen('Abschlussgespräch');
    expect(liste).toEqual(['Befund', 'Fahrplan', 'Abschlussgespräch']);
  });
  it('die Karte übernimmt beim Schließen (Aufräumen des Abschnitts) über dieselbe Regel', () => {
    const src = readFileSync('components/os/mandate/karte/Abschnitte.tsx', 'utf8');
    const teilSrc = src.slice(src.indexOf('export function LieferumfangTeil('), src.indexOf('// ── Aufwand & Kapazität'));
    expect(teilSrc).toContain('return () => {');
    expect(teilSrc).toContain('lieferumfangBeimSchliessen(jetzt, t)');
    expect(teilSrc).not.toMatch(/onBlur=/); // Verlassen hängt weiter nicht an (A6) — nur das Schließen
    // Je Produkt eine eigene Instanz: ein Wechsel des Produkts schließt den Abschnitt des alten (der Entwurf landet nie beim neuen).
    expect(readFileSync('components/os/mandate/karte/ProduktKarte.tsx', 'utf8')).toContain('<LieferumfangTeil key={l.id}');
  });
});
