// ─── Prozesse · Wächter: jede Raute der 18 Vorlagen bekommt ihr Feld (22.10. spät) ───────────────────────────────────────────────────────────────────────
// Eine Raute nach Regel, die ein Feld des Falls liest, das der Motor nicht liefert, fällt STILL auf den Vorgabe-Ast (eine fehlende Angabe ist für „gleich“,
// „einer von“, „größer“ nie wahr). Dieser Wächter geht alle Rauten (und „nur wenn …“ an Auslöser und Warten) aller Vorlagen der Kundengewinnung samt Teilprozessen
// durch und fragt den echten Motor (lib/prozesse/lauf-server.ts `umfeldFuer`) mit einem erfundenen, vollständigen Fall:
//   · jedes Feld des Falls ist bekannt (FALL_FELDER der Fall-Art) und wird geliefert — außer es wird ausdrücklich mit „leer“/„gesetzt“ geprüft
//   · Felder aus dem Lauf haben ihre Quelle in derselben Definition: `agent.<x>` im Ausgabe-Vertrag eines Agenten-Schritts, `abfrage.*` an einer CRM-Abfrage,
//     `webhook.<x>` im Schema des Webhook-Auslösers
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz; der Inbox-Spiegel ist nachgebaut (ein Gespräch).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import type { LaufFall, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-bausteine2-felder-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-bausteine2-felder';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// Der Inbox-Spiegel der Person — nachgebaut: ein Gespräch eines Leads im Fach „Antworten“.
vi.mock('@/lib/inbox/strom-server', async () => ({
  ...await vi.importActual<object>('@/lib/inbox/strom-server'),
  stromRoh: async () => ({ gespraeche: [{ id: 'gm~t1', fach: 'antworten', zugeordnet: true, vonUns: false, am: '2026-10-21T09:00:00.000Z', gegenueber: { email: 'c-l@example.invalid' } }], postfaecher: [], google: null, namen: {}, team: [] }),
}));

const H = 'haus-b2f';
const TAG = '2026-10-22T08:00:00.000Z', FRUEHER = '2026-10-15T08:00:00.000Z';

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id, email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  const nl = { kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Double-Opt-in', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja, Newsletter.', wortlautVersion: 'v1', belegRef: 'DOI vom 01.09.' };
  await db.saveJson('kontakte', { kontakte: [
    // Lead (Person ohne Firma): Anfrage über die Website, Newsletter mit vollem Nachweis, eine Antwort nach dem Start, eine Begegnung, in einer Kampagne.
    k('c-l', { anrede: 'Sie', einwilligungen: [nl], aktivitaeten: [
      { am: '2026-10-10T09:00:00.000Z', art: 'antwort', von: 'system', text: 'Anfrage über Website: Bitte um ein Angebot.' },
      { am: '2026-10-21T09:00:00.000Z', art: 'antwort', von: 'system', text: 'Antwort per Mail' },
    ] }),
    k('c-f', { firmaId: 'f-l', firma: 'Probe Firma GmbH' }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-l', name: 'Probe Firma GmbH', rolle: 'interessent' }],
    chancen: [{ id: 'ch-v', titel: 'Probe Deal', kontaktIds: ['c-f'], firmaId: 'f-l', stufe: 'verloren', grund: 'Zeitpunkt', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-09-01', geaendert: '2026-10-01' }],
    mandate: [{ id: 'm-v', kunde: 'Probe Firma GmbH', firmaId: 'f-l', chanceId: 'ch-v', kontaktIds: ['c-f'], titel: 'Probe Mandat', art: 'projekt', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: '2026-01-01', ende: '2027-01-31', kuendigungsfristTage: 30, verlaengerung: 'manuell', honorar: { betrag: 100, basis: 'monat' }, ustSatz: 19, zahlungszielTage: 14, ziele: [], health: { beteiligung: 80, umsetzung: 80, wirkung: 80, zahlung: 80, stimmung: 80 }, leistungen: [], offen: [], geaendert: '2026-10-01' }],
    events: [
      { id: 'ev-o', titel: 'Probe-Abend', format: 'stammtisch', ziel: 'Kontakte', datum: '2026-10-15', status: 'durchgefuehrt', geaendert: '2026-10-15' },
      { id: 'ev-b', titel: 'Probe-Messe', format: 'netzwerken', ziel: 'Kontakte', datum: '2026-10-20', status: 'durchgefuehrt', marke: 'Netzwerken', geaendert: '2026-10-20' },
    ],
    teilnahmen: [
      { id: 'tn-o', eventId: 'ev-o', kontaktId: 'c-f', status: 'da', followUpAm: '2026-10-16', geaendert: '2026-10-16' },
      { id: 'tn-b', eventId: 'ev-b', kontaktId: 'c-l', status: 'da', geaendert: '2026-10-20', netzwerken: { erfassungId: 'e1', schritt: 'qualifizieren', zustaendig: 'pia', erfasstVon: 'pia', erfasstAm: '2026-10-20T17:00:00.000Z' } },
    ],
    kampagnen: [{ id: 'kp-v', name: 'Probe-Kampagne', playbook: 'reaktivierung', ziel: 'Gespräche', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-l'], ergebnisse: [], von: 'hand', geaendert: '2026-10-01' }],
  });
  await db.saveJson(`inbox-zustand--pia`, { v: 1, gespraeche: { 'gm~t1': { zuordnung: { kontaktId: 'c-l', am: '2026-10-21T10:00:00.000Z' } } }, absender: {} });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

/** Der erfundene Fall je Fall-Art — mit allen Bezügen, die eine Schleife bzw. ein Ereignis mitgibt. */
const FALL: Record<string, { fall: LaufFall; daten: Record<string, string> }> = {
  deal: { fall: { art: 'deal', id: 'ch-v' }, daten: { 'bezug.dealid': 'ch-v' } },
  mandat: { fall: { art: 'mandat', id: 'm-v' }, daten: { 'bezug.mandatid': 'm-v' } },
  lead: { fall: { art: 'lead', id: 'c-l' }, daten: { 'bezug.kontaktid': 'c-l', 'bezug.eventid': 'ev-b', 'bezug.kampagneid': 'kp-v', 'bezug.gespraech': 'gm~t1' } },
  firma: { fall: { art: 'firma', id: 'f-l' }, daten: {} },
  event: { fall: { art: 'event', id: 'ev-o' }, daten: {} },
  kampagne: { fall: { art: 'kampagne', id: 'kp-v' }, daten: {} },
  keiner: { fall: { art: 'keiner' }, daten: {} },
};

describe('Jede Raute der 18 Vorlagen bekommt ihr Feld', () => {
  it('alle Felder des Falls sind bekannt und werden geliefert; Lauf-Felder haben ihre Quelle in derselben Definition', async () => {
    const [S, { KUNDENGEWINNUNG_VORLAGEN }, { gelesenFelder, istLaufFeld }, { FALL_FELDER }, { fallArtVon }, { alleSchritte }] = await Promise.all([
      import('@/lib/prozesse/lauf-server'), import('@/lib/prozesse/kundengewinnung/bibliothek'), import('@/lib/prozesse/kundengewinnung/raute-felder'),
      import('@/lib/prozesse/ausloeser'), import('@/lib/prozesse/definition'), import('@/lib/prozesse/fluss'),
    ]);
    const kx = await S.kontextLaden(new Date(TAG), H);
    const funde: string[] = [];
    let geprueft = 0;
    const defs: ProzessDefinition[] = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]);
    expect(defs.length).toBe(24);
    for (const d of defs) {
      const art = fallArtVon(d);
      const f = FALL[art];
      const l: ProzessLauf = {
        id: 'pl-00000000-0000-4000-8000-000000000099', prozessId: 'pz-00000000-0000-4000-8000-000000000099', version: 1, fall: f.fall, bereich: d.bereich ?? 'sales', schluessel: 'x', durchgang: 1,
        modus: 'scharf', status: 'laeuft', person: 'pia', ausloeser: { art: 'hand' }, tiefe: 0, daten: f.daten, start: FRUEHER, geaendert: TAG, aktuell: null, schritte: [], kostenCent: 0,
      };
      const u = await S.umfeldFuer(l, d, kx);
      const schritte = alleSchritte(d).map(x => x.schritt);
      const bekannt = new Set(FALL_FELDER[art].map(x => x.id));
      const gelesen = gelesenFelder(d);
      // Prüft ein Knoten ein Feld auch mit „leer“/„gesetzt“, ist sein Fehlen dort bewusst (z. B. „noch nie gefragt“ — V14).
      const leerErlaubt = new Set(gelesen.filter(g => g.op === 'leer' || g.op === 'gesetzt').map(g => `${g.knotenId}|${g.feld}`));
      for (const g of gelesen) {
        geprueft++;
        const wo = `${d.id} ${g.knotenId.split(':')[1] ?? g.knotenId}: ${g.feld}`;
        if (istLaufFeld(g.feld)) {
          const [quelle, name] = [g.feld.split('.')[0], g.feld.slice(g.feld.indexOf('.') + 1)];
          if (quelle === 'agent' && !schritte.some(s => s.agent?.ausgabe.some(a => a.id.toLowerCase() === name))) funde.push(`${wo} — kein Agenten-Schritt liefert „${name}“`);
          if (quelle === 'abfrage' && !schritte.some(s => s.abfrage)) funde.push(`${wo} — keine CRM-Abfrage davor`);
          if (quelle === 'webhook' && !schritte.some(s => s.ausloeser?.art === 'webhook' && s.ausloeser.felder.some(x => x.id === name))) funde.push(`${wo} — kein Webhook-Feld „${name}“`);
          continue;
        }
        // Eine Score-Raute liest den Lead — auch den einer Firma (lib/prozesse/lauf-server.ts `fallInfo`, Fall „Firma“).
        if (!bekannt.has(g.feld) && !(g.op === 'score' && art === 'firma')) { funde.push(`${wo} — kein Feld der Fall-Art „${art}“`); continue; }
        if (leerErlaubt.has(`${g.knotenId}|${g.feld}`)) continue;
        if (u.daten[g.feld] === undefined) funde.push(`${wo} — fällt still auf den Vorgabe-Ast (Feld fehlt)`);
      }
    }
    expect(funde).toEqual([]);
    expect(geprueft).toBeGreaterThan(40);
  });
  it('die neuen Felder tragen die erwarteten Werte (erfundener Fall)', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const { KUNDENGEWINNUNG_VORLAGEN } = await import('@/lib/prozesse/kundengewinnung/bibliothek');
    const kx = await S.kontextLaden(new Date(TAG), H);
    const def = (id: string) => KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]).find(d => d.id === id)!;
    const lauf = (d: ProzessDefinition, art: string): ProzessLauf => ({
      id: 'pl-00000000-0000-4000-8000-000000000098', prozessId: 'pz-00000000-0000-4000-8000-000000000098', version: 1, fall: FALL[art].fall, bereich: 'sales', schluessel: 'x', durchgang: 1,
      modus: 'scharf', status: 'laeuft', person: 'pia', ausloeser: { art: 'hand' }, tiefe: 0, daten: FALL[art].daten, start: FRUEHER, geaendert: TAG, aktuell: null, schritte: [], kostenCent: 0,
    });
    const lead = (await S.umfeldFuer(lauf(def('kg-v03'), 'lead'), def('kg-v03'), kx)).daten;
    expect(lead).toMatchObject({ 'lead.mail-fach': 'antworten', 'lead.gespraech-zugeordnet': true, 'lead.anfrage-kanal': 'website', 'lead.kampagnen-ergebnis': 'offen', 'lead.netzwerken-schritt': 'qualifizieren' });
    const v16 = (await S.umfeldFuer(lauf(def('kg-v16'), 'lead'), def('kg-v16'), kx)).daten;
    expect(v16).toMatchObject({ 'lead.nachweis-vollstaendig': true, 'lead.neue-signale': true });
    expect((await S.umfeldFuer(lauf(def('kg-v17'), 'lead'), def('kg-v17'), kx)).daten['lead.buchung-folge']).toBe('qualifizierung');
    const deal = (await S.umfeldFuer(lauf(def('kg-v12'), 'deal'), def('kg-v12'), kx)).daten;
    expect(deal).toMatchObject({ 'deal.mandat-da': true, 'deal.vertrag-unterschrieben': true });
    const mandat = (await S.umfeldFuer(lauf(def('kg-v15'), 'mandat'), def('kg-v15'), kx)).daten;
    expect(mandat).toMatchObject({ 'mandat.verlaengert': false, 'mandat.verlaengerung': 'manuell', 'mandat.ampel-mail': expect.any(String) });
    // Nie gefragt: das Feld fehlt — die Vorlage prüft ausdrücklich „leer“.
    expect((await S.umfeldFuer(lauf(def('kg-v14'), 'mandat'), def('kg-v14'), kx)).daten['mandat.tage-seit-empfehlung']).toBeUndefined();
    const event = (await S.umfeldFuer(lauf(def('kg-v18'), 'event'), def('kg-v18'), kx)).daten;
    expect(event).toMatchObject({ 'event.quote-48h': 100, 'event.mix-erreicht': false });
  });
});
