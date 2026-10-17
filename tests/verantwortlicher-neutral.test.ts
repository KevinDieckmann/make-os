// ─── Gesamtprüfung 18.10. (L3 B8): der Verantwortliche nie fest im Text (Regel S3) ───────────────────────────────────────────────────
// „MAKE als Verantwortlicher“ stand im Verzeichnis-Startwert, im Speicher-Register, in einer Erklärung der Oberfläche, an einer Kennzahl und am
// Google-Kalender — eine Kunden-Instanz las dort einen fremden Verantwortlichen. Jetzt neutral bzw. aus der Einrichtung/lib/einheiten.ts; gespeicherte
// Verzeichnis-Einträge mit der alten Fassung werden gehoben (`ALTE_FASSUNGEN`). Rein, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const MAKE_ALLEIN = /\bMAKE\b(?![ _-]OS)/;

describe('L3 B8: Verantwortlicher neutral', () => {
  it('Verzeichnis: der Startwert nennt keine Firma; ein gespeicherter Eintrag mit der alten Fassung wird gehoben', async () => {
    const { verzeichnisVervollstaendigen, VV_FULFILLMENT_ANALYSE_ID, VV_FULFILLMENT_ANALYSE_RECHT } = await import('@/lib/crm/datenschutz');
    const neu = verzeichnisVervollstaendigen([], '2026-10-18T10:00:00.000Z').liste.find(v => v.id === VV_FULFILLMENT_ANALYSE_ID)!;
    expect(neu.rechtsgrundlage).toBe(VV_FULFILLMENT_ANALYSE_RECHT);
    expect(neu.rechtsgrundlage).not.toMatch(MAKE_ALLEIN);
    const alt = { ...neu, rechtsgrundlage: 'Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Vorbereitung des Mandats; Interessenabwägung je Dossier dokumentiert); Information der Personen nach Art. 14 durch MAKE als Verantwortlicher' };
    const r = verzeichnisVervollstaendigen([alt], '2026-10-18T10:00:00.000Z');
    expect(r.liste.find(v => v.id === VV_FULFILLMENT_ANALYSE_ID)!.rechtsgrundlage).toBe(VV_FULFILLMENT_ANALYSE_RECHT);
    // Von Hand geänderte Texte bleiben (nur die bekannte alte Fassung wird gehoben).
    const eigen = { ...neu, rechtsgrundlage: 'Eigener Text der Instanz' };
    expect(verzeichnisVervollstaendigen([eigen], '2026-10-18T10:00:00.000Z').liste.find(v => v.id === VV_FULFILLMENT_ANALYSE_ID)!.rechtsgrundlage).toBe('Eigener Text der Instanz');
  });
  it('Register, Erklärung, Kennzahl und Google-Kalender ohne feste Firma', async () => {
    const { SPEICHER_REGISTER } = await import('@/lib/crm/speicher-register');
    const ff = SPEICHER_REGISTER.filter(x => x.muster.startsWith('fulfillment'));
    expect(ff.length).toBeGreaterThan(3);
    for (const e of ff) expect(JSON.stringify(e), e.muster).not.toMatch(MAKE_ALLEIN);
    expect(lies('lib/crm/speicher-register.ts')).not.toContain('durch MAKE als Verantwortlicher');
    expect(lies('lib/erklaerungen/fulfillment-analyse.ts')).not.toMatch(/gibt MAKE/);
    expect(lies('lib/fulfillment/prozesse/kennzahlen.ts')).not.toContain('trägt nur MAKE ein');
    const g = lies('components/os/kalender/GoogleVerbindung.tsx');
    expect(g).not.toContain('Google Kalender (MAKE)');
    expect(g).toContain('Google Kalender ({firmaOhneRechtsform(UG_NAME)})');
  });
});
