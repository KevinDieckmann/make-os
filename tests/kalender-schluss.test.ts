// ─── Schlussprüfung Kalender (29.09.) — kleine Funde aus dem Klicktest im Prüfbau ─────────────────────────────
// · NeuerTermin: nach verlorener Antwort stand „Dein Entwurf bleibt gemerkt.“ doppelt im Fehler.
// · Zeit-Auswertung / Planen: Einzahl („1 Termine“, „1 künftige Blöcke liegen“).
// · Buchungsseiten: eine alte Meldung der Leiste („Termin im Kalender entfernt.“) stand rot im Fenster „Neue Buchungsseite“.
// · Verbindungsprüfung: Buchungen mit Namen statt „bu-…“.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { speicherFehlerText } from '../lib/kalender/formular';
import { termineText, auswertungMarkdown } from '../lib/kalender/auswertung';
import { uebernahmeTexte } from '../lib/planung/wochenplan-uebernahme';
import { beispielNamen } from '../lib/crm/verbindungen-namen';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand } from '../lib/crm/typen';

describe('Schlussprüfung · NeuerTermin-Fehlertext', () => {
  it('„Keine Verbindung“ trägt den Entwurf-Hinweis genau einmal', () => {
    const t = speicherFehlerText('Keine Verbindung — dein Entwurf bleibt gemerkt.', 0);
    expect(t.match(/Entwurf bleibt gemerkt/gi)).toHaveLength(1);
  });
  it('409/5xx hängen den Hinweis an, 400 nicht; ohne Text der Standard', () => {
    expect(speicherFehlerText('iCloud antwortet nicht.', 502)).toBe('iCloud antwortet nicht. Dein Entwurf bleibt gemerkt.');
    expect(speicherFehlerText('Belegt.', 409)).toBe('Belegt. Dein Entwurf bleibt gemerkt.');
    expect(speicherFehlerText('Titel fehlt.', 400)).toBe('Titel fehlt.');
    expect(speicherFehlerText(undefined, 400)).toBe('Nicht angelegt.');
  });
  it('die Oberfläche nutzt die Hilfsfunktion', () => {
    const q = readFileSync(join(__dirname, '..', 'components', 'os', 'kalender', 'NeuerTermin.tsx'), 'utf8');
    expect(q).toContain('speicherFehlerText(r.d.fehler, r.status)');
  });
});

describe('Schlussprüfung · Einzahl/Mehrzahl', () => {
  it('Termine', () => {
    expect(termineText(1)).toBe('1 Termin');
    expect(termineText(0)).toBe('0 Termine');
    expect(termineText(3)).toBe('3 Termine');
  });
  it('Übernahme-Karte und Rückfrage', () => {
    expect(uebernahmeTexte(1).karte).toMatch(/^1 künftiger Block liegt noch im alten Wochenplan\. Übernehmen macht ihn zu einem Termin/);
    expect(uebernahmeTexte(1).frage).toMatch(/^1 Block aus dem alten Wochenplan jetzt als Termin in iCloud/);
    expect(uebernahmeTexte(4).karte).toMatch(/^4 künftige Blöcke liegen .* macht sie zu Terminen/);
    expect(uebernahmeTexte(4).frage).toMatch(/^4 Blöcke .* als Termine/);
  });
  it('Markdown der Auswertung: „1 Termin“', () => {
    const w = { von: '2026-09-28', bis: '2026-10-04', kw: 40, label: 'KW 40', laenge: 10080, anzahlMeetings: 1,
      minuten: { meetings: 30, fokus: 0, abwesend: 0, frei: 0, arbeitszeit: 0, belegt: 30, bloecke: 0 }, space: { privat: 30, business: 0 },
      jeEinheit: [], jeMandat: [], jeBlock: [], kontakte: [{ id: 'c-1', termine: 1, minuten: 30 }], tage: [] };
    const md = auswertungMarkdown({ woche: w, vorwochen: [], schnitt: w.minuten } as unknown as Parameters<typeof auswertungMarkdown>[0], { kontakt: () => 'Anna' });
    expect(md).toContain('Anna: 1 Termin,');
    expect(md).not.toMatch(/\b1 Termine\b/);
  });
});

describe('Schlussprüfung · Buchungsseite: keine alte Meldung im neuen Fenster', () => {
  it('„+ Seite“ und Bearbeiten öffnen über `oeffnen` (leert die Meldung)', () => {
    const q = readFileSync(join(__dirname, '..', 'components', 'os', 'kalender', 'Buchungsseiten.tsx'), 'utf8');
    expect(q).toMatch(/const oeffnen = \(s: Partial<SeiteSicht>\) => \{ setMeldung\(''\); setBearbeiten\(s\); \}/);
    expect(q).not.toMatch(/onClick=\{\(\) => setBearbeiten\(/);
  });
});

describe('Schlussprüfung · Verbindungsprüfung: Buchungen mit Namen', () => {
  it('Buchung mit Kontakt → „Buchung Name · T.M.“; ohne Kontakt bleibt die Kennung', () => {
    const kontakte = [{ id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel' }] as unknown as Kontakt[];
    const crm = {} as unknown as CrmBestand;
    const buchungen = { seiten: ['bs-1'], buchungen: [
      { id: 'bu-1', seiteId: 'bs-1', status: 'bestaetigt', kontaktId: 'c-anna1', start: '2026-10-01T10:00:00' },
      { id: 'bu-2', seiteId: 'bs-1', status: 'bestaetigt', start: '2026-10-02T10:00:00' },
    ] };
    const n = beispielNamen({ kontakte, crm, buchungen }, [{ beispiele: ['bu-1', 'bu-2'] }]);
    expect(n).toEqual({ 'bu-1': 'Buchung Anna Beispiel · 1.10.' });
  });
});
