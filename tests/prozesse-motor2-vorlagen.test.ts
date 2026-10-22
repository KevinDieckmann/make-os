// ─── Prozesse · Motor-Rest (22.10. spät) — alle 18 Vorlagen der Kundengewinnung im Probelauf (Beispiel-Fall) ─────────────────────────────────────────────
// Jede Vorlage (und jeder Teilprozess) wird übernommen wie über „Aus Vorlage anlegen“ (Eigner aus dem Team, veröffentlicht, Probelauf) und mit dem erfundenen
// Beispiel-Fall durch denselben Motor geschickt: kein Schritt hält an („nicht gebaut“, Rolle, Postfach, Gesellschaft, Liste …), der Lauf kommt ans Ende,
// geschrieben wird nichts. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-motor2-vorlagen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-motor2-vorlagen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-m2v';
const J = '2026-10-22T08:00:00.000Z';
let ids: { vorlage: string; prozessId: string; teil: boolean }[] = [];

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', leererBestand());
  // Ein Business-Postfach der Person des Laufs (Platzhalter „Postfach des Laufs“).
  await db.saveJson('postfaecher--pia', { v: 1, postfaecher: [{ id: 'pf-00000000-0000-4000-8000-000000000001', quelle: 'imap', bereich: 'ug', anzeigename: 'MAKE', adresse: 'pia@example.invalid' }] });
  const [{ ausVorlageAnwenden }, { prozessRechte }, { prozesseAendern }, { KUNDENGEWINNUNG_VORLAGEN }] = await Promise.all([
    import('@/lib/prozesse/kundengewinnung/uebernehmen'), import('@/lib/prozesse/rollen'), import('@/lib/prozesse/werkstatt-server'), import('@/lib/prozesse/kundengewinnung/bibliothek'),
  ]);
  let n = 0;
  const neu = (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const rechte = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false });
  for (const v of KUNDENGEWINNUNG_VORLAGEN) {
    await prozesseAendern<object>(d => {
      const r = ausVorlageAnwenden(d, v.id, { person: 'pia', jetzt: J, rechte, neueKennung: neu, eigner: 'konto-pia' });
      if (!r.ok) throw new Error(`Übernahme ${v.id}: ${JSON.stringify(r)}`);
      for (const p of r.datei.prozesse) if (!d.prozesse.some(x => x.id === p.id)) ids.push({ vorlage: p.entwurf.herkunft?.quelleIds?.[0] ?? v.id, prozessId: p.id, teil: (p.entwurf.herkunft?.quelleIds?.[0] ?? '') !== v.id });
      return { ok: true, datei: r.datei };
    }, { art: 'person', person: 'pia' }, H);
  }
  // Doppelte (eine Übergabe kann eine andere Vorlage mit übernehmen) — je Vorlage einmal.
  const gesehen = new Set<string>();
  ids = ids.filter(x => (gesehen.has(x.vorlage) ? false : (gesehen.add(x.vorlage), true)));
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Alle Vorlagen der Kundengewinnung laufen im Probelauf ganz durch', () => {
  it('18 Vorlagen und ihre Teilprozesse: kein Halt, ans Ende, nichts geschrieben', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const { KUNDENGEWINNUNG_VORLAGEN } = await import('@/lib/prozesse/kundengewinnung/bibliothek');
    expect(new Set(ids.filter(x => !x.teil).map(x => x.vorlage)).size).toBe(KUNDENGEWINNUNG_VORLAGEN.length);
    const vorher = JSON.stringify(await S.laeufeLesen(H));
    const halt: string[] = [];
    for (const x of ids) {
      const r = await S.probelauf({ prozessId: x.prozessId, quelle: 'version', fall: 'beispiel', person: 'pia' });
      if (!r.ok) { halt.push(`${x.vorlage}: ${r.fehler}`); continue; }
      for (const z of r.schritte.filter(y => y.status === 'fehler')) halt.push(`${x.vorlage}: ${z.text}`);
      const letzte = r.schritte.at(-1);
      if (!letzte || !/^endet|würde|startet|entscheidet/.test(letzte.text)) halt.push(`${x.vorlage}: endet nicht (${letzte?.text ?? 'leer'})`);
    }
    expect(halt).toEqual([]);
    expect(JSON.stringify(await S.laeufeLesen(H))).toBe(vorher);
  });
  it('V01 (Kevin 22.10. nachts, „Nur öffentliche Angaben“): der Teilprozess je Firma braucht keine Freigabe „weiter“ mehr hinter der Recherche', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const teil = ids.find(x => x.vorlage === 'kg-v01a')!;
    const r = await S.probelauf({ prozessId: teil.prozessId, quelle: 'version', fall: 'beispiel', person: 'pia' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const { schloesser } = await import('@/lib/prozesse/fluss');
    const def = (await prozesseLesen(H)).prozesse.find(p => p.id === teil.prozessId)!.versionen.at(-1)!.definition;
    const research = def.knoten.find(k => k.form === 'agent' && k.agent?.wer.art === 'fach')!;
    expect(research.agent).toMatchObject({ nurOeffentlich: true, gedaechtnis: { brain: false, akte: false }, ergebnis: 'vorschlag' });
    // Kein Schloss hinter der Recherche (die Mail-Entwürfe behalten ihres — sie wirken nach außen).
    expect(schloesser(def.knoten).has(research.id)).toBe(false);
    const i = r.schritte.findIndex(z => z.knotenId === research.id);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(r.schritte[i + 1]?.status).not.toBe('freigabe');
  });
});
