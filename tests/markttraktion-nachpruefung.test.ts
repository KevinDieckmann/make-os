// Nachprüfung 18.10. (L1b, aus L1 offen): Markttraktion nach dem gewonnenen Deal. Erfundene Daten.
//   C1  am Kunden keine „Wiedervorlage“ aus dem Vertrieb mehr   C3  Deal-Akte folgt der Qualifizierung „Entscheider: ja“
//   C13 „1 Lead ist SQL-bereit und wartet …“
import { describe, it, expect } from 'vitest';
describe('C1/C3/C13 · Markttraktion nach dem gewonnenen Deal', () => {
  it('C1: wer Kunde wird, verliert die Wiedervorlage aus dem Vertrieb (der nächste Schritt bleibt)', async () => {
    const { alsKunde } = await import('../lib/crm/mandat-anlegen-server');
    const k = { id: 'c-1', vorname: 'Clara', nachname: 'Beispiel', stufe: 'gespraech', wiedervorlage: '2026-10-23', naechsterSchritt: { text: 'Kick-off', datum: '2026-10-25' }, aktivitaeten: [] } as unknown as Parameters<typeof alsKunde>[0];
    const neu = alsKunde(k, '2026-10-18T10:00:00Z');
    expect(neu.wiedervorlage).toBeUndefined();
    expect(neu).toMatchObject({ stufe: 'gewonnen', lebensphase: 'kunde', naechsterSchritt: { text: 'Kick-off', datum: '2026-10-25' } });
  });
  it('C3: Qualifizierung „Entscheider: ja“ — kein Warnton, die einzige Person wird vorgeschlagen', async () => {
    const { entscheiderHinweis, besterEntscheider } = await import('../lib/crm/vorschlaege');
    const ja = { personenRollen: {}, qualifizierung: { entscheider: 'ja' as const } };
    expect(entscheiderHinweis(ja)).toMatchObject({ ton: 'info' });
    expect(entscheiderHinweis({ personenRollen: {}, qualifizierung: { entscheider: 'unklar' as const } })).toMatchObject({ ton: 'achtung', text: 'Noch kein Entscheider markiert — ohne den wird aus dem Deal nichts.' });
    expect(entscheiderHinweis({ personenRollen: { 'c-1': 'entscheider' }, qualifizierung: { entscheider: 'ja' as const } })).toBeNull();
    const p = [{ id: 'c-1', position: 'Referentin', aktivitaeten: [] }] as unknown as Parameters<typeof besterEntscheider>[0];
    expect(besterEntscheider(p, ja, '2026-10-18')?.kontakt.id).toBe('c-1');
    expect(besterEntscheider(p, { personenRollen: {} }, '2026-10-18')).toBeNull();
  });
  it('C13: Einzahl und Mehrzahl stimmen', async () => {
    const { sqlOffenSatz } = await import('../lib/crm/leads');
    expect(sqlOffenSatz(1)).toBe('1 Lead ist SQL-bereit und wartet auf deine Entscheidung (Deal, weiter qualifizieren, parken oder raus) — er steht oben in der Runde.');
    expect(sqlOffenSatz(3)).toContain('3 Leads sind SQL-bereit und warten');
    expect(sqlOffenSatz(0)).toBe('');
  });
});
