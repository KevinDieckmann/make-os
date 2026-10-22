// Wächter (22.10., Sichtprüfung Werkstatt): `{{kontakt.anrede}}` ist Sie/Du — nie Frau/Herr. Eine Grußzeile kommt aus `{{kontakt.gruss}}`
// (lib/fulfillment/kunde/bild.ts `kundenGruss`), sonst schreibt die Mail „Guten Tag Sie Beispiel,“.
import { describe, it, expect } from 'vitest';
import { ALLE_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { PLATZHALTER_JE_FALL, textvorlageFuellen } from '@/lib/prozesse/baustein-katalog';
import { BEISPIEL_PLATZHALTER } from '@/lib/prozesse/testdaten';

describe('Grußzeile in Vorlagen', () => {
  it('keine Vorlage setzt die Anrede (Sie/Du) vor einen Namen', () => {
    for (const v of ALLE_VORLAGEN) expect(JSON.stringify(v), v.id).not.toMatch(/\{\{\s*kontakt\.anrede\s*\}\}\s*\{\{\s*kontakt\.(vor|nach)name/);
  });
  it('kontakt.gruss gibt es für jede Fall-Art mit Kontakt und im Beispiel', () => {
    for (const f of ['lead', 'deal', 'mandat', 'event'] as const) expect(PLATZHALTER_JE_FALL[f]).toContain('kontakt.gruss');
    expect(textvorlageFuellen('{{kontakt.gruss}},', BEISPIEL_PLATZHALTER).text).toBe('Guten Tag Erika Beispiel,');
  });
});
