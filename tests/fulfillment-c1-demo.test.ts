// ─── Fulfillment C1 — Demo-Saat (10.10.; FULFILLMENT_KONZEPT.md 12.7) ─────────────────────────────────────────────────────────────────
// Die Demo zeigt einen laufenden Fall mit Landkarte, Wert-Konto (drei Messungen) und Ritualen, einen Fall im Onboarding mit überfälliger
// Willkommensmail, rund 25 Bausteine (zwei „rechtlich prüfen“, einer „nur intern“) und drei Abläufe (Trichter, Fluss, Zeitachse) — über die
// Routen gesät, erfunden. Eigener Datenordner (vi.hoisted), wie tests/demo.test.ts.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-demo-ff-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo-ff', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return { wurzel };
});

import { localDay } from '@/lib/zeit';

type H = (r: Request) => Promise<Response>;
const lese = async (pfad: string, suche = '') => {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  return await (await m.GET(new Request(`http://test/api/${pfad}${suche}`, { headers: { 'x-make-user': 'lena' } }))).json() as Record<string, unknown>;
};

let schritte: Record<string, number> = {};
beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  const b = await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: localDay() });
  schritte = Object.fromEntries(b.schritte.map(s => [s.name, s.anzahl]));
}, 120_000);
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('Demo: Fulfillment', () => {
  it('Muster, Bausteine, Abläufe, zwei Fälle', async () => {
    expect(schritte['Fulfillment: Vorlagen aus dem Muster']).toBe(3);
    expect(schritte['Fulfillment: Bausteine']).toBeGreaterThanOrEqual(25);
    expect(schritte['Fulfillment: Abläufe']).toBe(4);
    expect(schritte['Fulfillment: Fälle']).toBe(2);
    const ue = await lese('fulfillment');
    const prozesse = ue.prozesse as { art: string; form?: string }[];
    expect(prozesse.filter(p => p.art === 'ablauf').map(p => p.form).sort()).toEqual(['fluss', 'kreis', 'trichter', 'zeitachse']);
    const bausteine = ue.bausteine as { rechtOffen: boolean; nurIntern: boolean; vorVerkaufOffen: boolean }[];
    expect(bausteine.filter(b => b.rechtOffen)).toHaveLength(2);
    expect(bausteine.filter(b => b.nurIntern)).toHaveLength(1);
    expect(bausteine.filter(b => b.vorVerkaufOffen)).toHaveLength(1);
    expect(Object.keys(ue.zuordnung as object).sort()).toEqual(['l-demo-retainer', 'l-demo-software']);
  });

  it('Nordwerk läuft: Onboarding fertig, Wert-Konto mit drei Messungen, Ritual, Stakeholder, Entscheidungen', async () => {
    const f = await lese('fulfillment/fall', '?m=m-demo-nordwerk');
    const fall = f.fall as { status: string; stakeholder: unknown[]; entscheidungen: unknown[]; rituale: unknown[]; mitschriften: unknown[]; wertKonto: Record<string, { messungen: unknown[] }> };
    const offen = (f.onboarding as { schritte: { schluessel: string; zaehlt: boolean; erfuellt: boolean; entfaellt: boolean; text: string }[] }).schritte.filter(s => s.zaehlt && !s.erfuellt && !s.entfaellt);
    expect(offen.map(s => `${s.schluessel}: ${s.text}`)).toEqual([]);
    expect(fall.status).toBe('laeuft');
    expect(Object.values(fall.wertKonto).some(e => e.messungen.length === 3)).toBe(true);
    expect(fall.stakeholder).toHaveLength(1);
    expect(fall.entscheidungen).toHaveLength(3);
    expect(fall.rituale).toHaveLength(2); // Kick-off + Wochen-Check (im Kalender, Bezug zum Mandat)
    expect(fall.mitschriften).toHaveLength(2);
    expect(f.fortschritt as number).toBeGreaterThan(0);
    // Zusammengeführt 11.10.: der Demo-Fall trägt das Kunden-Playbook als Formular — die Saat von C2 füllt es (Kunden-Link bleibt aus).
    expect(schritte['Fulfillment · Playbook-Antworten (Kunden-Link aus)']).toBeGreaterThan(0);
    const k = await lese('fulfillment/kunde', '?m=m-demo-nordwerk');
    expect((k.formulare as { titel: string; prozent: number }[]).map(x => [x.titel, x.prozent])).toEqual([['Kunden-Playbook', 100]]);
    expect((f.onboarding as { schritte: { schluessel: string; erfuellt: boolean }[] }).schritte.find(s => s.schluessel === 'playbook')!.erfuellt).toBe(true);
  });

  it('Geschichte ohne Widersprüche (12.10.): Start vor 45 Tagen, Diagnose läuft, Quick Wins/Fragen/Maßnahmen aus der Analyse, zwei Reports, Puls 7 → 8', async () => {
    const f = await lese('fulfillment/fall', '?m=m-demo-nordwerk');
    const fall = f.fall as { startAm?: string; gestartetAm: string; quickWins: { text: string; quelle: string; erledigtAm?: string }[]; kickoffFragen: { erledigt?: boolean }[]; knoten: { id: string; titel: string; extra?: boolean; elternId?: string; status: string; erledigtAm?: string }[]; entscheidungen: { am: string }[]; freigaben: Record<string, { am: string }> };
    const heute = localDay();
    const minus = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
    expect(fall.startAm).toBe(minus(45));
    expect(fall.freigaben.F0.am).toBe(minus(42));
    expect((f.aktuell as { phase: { titel: string } | null }).phase?.titel).toBe('Diagnose');
    // Quick Wins aus der Analyse, einer erledigt innerhalb der ersten 30 Tage; die Fragen gestellt
    expect(fall.quickWins.map(q => q.quelle)).toEqual(['analyse', 'analyse', 'analyse']);
    expect(fall.quickWins.filter(q => q.erledigtAm).map(q => q.erledigtAm)).toEqual([minus(18)]);
    expect(fall.kickoffFragen.length).toBeGreaterThan(0);
    expect(fall.kickoffFragen.every(q => q.erledigt)).toBe(true);
    // Maßnahmen der Diagnose als Zusatz-Schritte in „Aufbau“
    const aufbau = fall.knoten.find(k => k.titel === 'Aufbau')!;
    expect(fall.knoten.filter(k => k.extra && k.elternId === aufbau.id)).toHaveLength(3);
    expect((f.analyse as { massnahmen: string[]; quickWins: string[] }).massnahmen).toEqual([]);
    expect((f.analyse as { quickWins: string[] }).quickWins).toEqual([]);
    // Entscheidungen auf dem Zeitstrahl (nachgetragen), zwei Reports, Puls 7 → 8, Nachsorge wartet aufs Mandatsende
    expect(fall.entscheidungen.map(e => e.am).sort()).toEqual([minus(40), minus(21), minus(4)].sort());
    expect((f.reports as { am: string }[]).map(r => r.am.slice(0, 10))).toEqual([minus(28), minus(14)]);
    const k = await lese('fulfillment/kunde', '?m=m-demo-nordwerk');
    expect((k.puls as { liste: { wert: number }[]; health: number }).liste.map(p => p.wert)).toEqual([8, 7]);
    expect((k.puls as { health: number }).health).toBe(70);
    expect((f.nachsorge as { ende: string | null }).ende).toBeNull();
    expect(Object.values((f.termine as Record<string, string | null>)).some(Boolean)).toBe(true); // der nächste Wochen-Check steht im Kalender
  });

  it('Lumen im Onboarding: Willkommensmail überfällig, im Cockpit rot oben', async () => {
    const f = await lese('fulfillment/fall', '?m=m-demo-lumen');
    expect((f.fall as { status: string }).status).toBe('onboarding');
    expect((f.onboarding as { willkommen: { ueberfaellig: boolean } }).willkommen.ueberfaellig).toBe(true);
    const c = await lese('fulfillment/cockpit');
    expect((c.haengt as { art: string; mandatId: string }[])[0]).toMatchObject({ art: 'willkommen', mandatId: 'm-demo-lumen' });
    // Kein Puls vor dem Onboarding (vorher: 5 „Datenanbindung hakt“ drei Tage nach der Unterschrift — ein Widerspruch).
    const k = await lese('fulfillment/kunde', '?m=m-demo-lumen');
    expect((k.puls as { liste: unknown[] }).liste).toEqual([]);
  });
});
