// ─── Update-Probe: typische Schreib-Klicks mit der NEUEN Version (10.10.) ───────────────────────────────────────────────────
// Was Malin und Kevin am ersten Tag nach dem Update tun: eine Routine abhaken, eine Aufgabe ändern, den Kalender lesen, eine eigene
// Routine anpassen, ein eigenes Ziel fortschreiben, Vitalwerte eintragen, einen Fokus-Block festhalten. Immer so, wie der Browser es
// schickt (Stand aus der letzten Antwort, ganze Zeile bei Aufgaben). Jeder Klick einzeln — ein Fehler steht im Bericht.

const L = 'kevin', J = 'malin'; // wie live (scripts/update-probe/saat-zusatz.mjs)

/**
 * Was die Klicks selbst ändern — das ist gewollt und kein Verlust (der Vergleich nimmt diese Regeln dazu). Jede trifft genau die Stelle
 * des Klicks. Neuer Klick, der einen vorhandenen Wert ändert → hier eintragen.
 */
export const KLICK_ERLAUBT = [
  { bestand: /^tasks$/, pfad: /^tasks\[id=t-probe-haupt\]\.priority$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: Priorität der Aufgabe geändert.' },
  { bestand: /^routinen$/, pfad: /^routinen\[id=r-probe-trinken\]\.dauerMin$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: Dauer der eigenen Routine geändert.' },
  { bestand: /^ziele-eigen--malin$/, pfad: /^jahr\[id=z-probe-eigen-malin\]\.fortschritt$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: Fortschritt des eigenen Ziels geändert.' },
  { bestand: /^crm$/, pfad: /^firmen\[id=f-demo-atlas\]\.notiz$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: Notiz der Firma geändert.' },
  { bestand: /^crm$/, pfad: /^mandate\[id=m-demo-lumen\]\.health\.(stimmung|beteiligung|umsetzung|wirkung|zahlung)$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: Gesundheit des Mandats geändert (alle fünf Werte, PATCH crm mandate).' },
  { bestand: /^crm$/, pfad: /^(firmen\[id=f-demo-atlas\]|mandate\[id=m-demo-lumen\])\.geaendertVon$/, arten: ['wert-geaendert'], grund: 'Klick der Probe: der Server stempelt „zuletzt geändert von“ (lib/crm/speicher.ts).' },
];

export async function klicks({ rufe, versuch }) {
  const ok = (r, was) => {
    if (typeof r.status !== 'number' || r.status >= 400 || r.json?.ok === false) throw new Error(`${was} → ${r.status}: ${String(r.json?.error ?? r.json?.fehler ?? r.text).slice(0, 200)}`);
    return r.json ?? {};
  };
  const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

  await versuch('Klick: Routine abhaken (Kevin, PATCH health)', async () => {
    ok(await rufe('PATCH', '/api/state/health', { person: L, body: { routine: 'r-demo-plan', erledigt: true } }), 'PATCH health');
    const g = ok(await rufe('GET', '/api/state/health', { person: L }), 'GET health');
    return `Tage im Log: ${Object.keys(g.log ?? {}).length}`;
  });
  await versuch('Klick: Aufgabe ändern (Kevin, ganze Zeile mit Stand)', async () => {
    const g = ok(await rufe('GET', '/api/state/tasks', { person: L }), 'GET tasks');
    const t = (g.state?.tasks ?? []).find(x => x.id === 't-probe-haupt') ?? (g.state?.tasks ?? [])[0];
    if (!t) throw new Error('keine Aufgabe');
    const { stand, ...task } = t;
    ok(await rufe('PATCH', '/api/state/tasks', { person: L, body: { ops: [{ op: 'upsert', task: { ...task, priority: 'high' }, stand }] } }), 'PATCH tasks');
    return t.id;
  });
  await versuch('Klick: Kalender lesen (Kevin)', async () => {
    const r = ok(await rufe('GET', `/api/kalender?von=${heute}&bis=${heute}`, { person: L }), 'GET kalender');
    return `${(r.termine ?? r.events ?? []).length} Termine`;
  });
  await versuch('Klick: eigene Routine anpassen (Malin, teil mit Stand)', async () => {
    const g = ok(await rufe('GET', '/api/state/routinen', { person: J }), 'GET routinen');
    const r = (g.routinen ?? []).find(x => x.id === 'r-probe-trinken');
    if (!r) throw new Error('Routine r-probe-trinken fehlt');
    ok(await rufe('PATCH', '/api/state/routinen', { person: J, body: { ops: [{ op: 'teil', id: r.id, stand: r.stand, felder: { dauerMin: 6 } }] } }), 'PATCH routinen');
  });
  await versuch('Klick: eigenes Ziel fortschreiben (Malin)', async () => {
    const g = ok(await rufe('GET', '/api/state/ziele?fuer=ich', { person: J }), 'GET ziele');
    const z = (g.jahr ?? g.ziele?.jahr ?? []).find(x => x.id === 'z-probe-eigen-malin');
    if (!z) throw new Error('eigenes Ziel fehlt');
    ok(await rufe('PATCH', '/api/state/ziele', { person: J, body: { fuer: 'ich', horizont: 'jahr', ops: [{ op: 'teil', id: z.id, stand: z.stand, felder: { fortschritt: 15 } }] } }), 'PATCH ziele');
  });
  await versuch('Klick: Firma bearbeiten (Kevin, CRM teil)', async () => {
    ok(await rufe('PATCH', '/api/crm/bestand', { person: L, body: { ops: [{ liste: 'firmen', op: 'teil', id: 'f-demo-atlas', felder: { notiz: 'Nach dem Update bearbeitet (Probe).' } }] } }), 'PATCH crm firmen');
  });
  await versuch('Klick: Mandat bearbeiten (Kevin, CRM teil)', async () => {
    ok(await rufe('PATCH', '/api/crm/bestand', { person: L, body: { ops: [{ liste: 'mandate', op: 'teil', id: 'm-demo-lumen', felder: { health: { beteiligung: 3, umsetzung: 3, wirkung: 3, zahlung: 4, stimmung: 4 } } }] } }), 'PATCH crm mandate');
  });
  await versuch('Klick: Vitalwerte heute (Malin)', async () => {
    ok(await rufe('PUT', '/api/state/vitals', { person: J, body: { date: heute, vitals: { rec: 70, sleep: 7.5, hrv: 55, rhr: 54 } } }), 'PUT vitals');
  });
  await versuch('Klick: Fokus-Block festhalten (Kevin)', async () => {
    const von = new Date(Date.now() - 50 * 60_000), bis = new Date(Date.now() - 5 * 60_000);
    ok(await rufe('POST', '/api/state/zeit', { person: L, body: { aktion: 'fokus', von: von.toISOString(), bis: bis.toISOString(), schluessel: 'business:fokus', label: 'Nach dem Update' } }), 'POST zeit');
  });
  await versuch('Klick: Familie — Wertschätzung (Malin)', async () => {
    ok(await rufe('PATCH', '/api/familie', { person: J, body: { ops: [{ liste: 'wertschaetzungen', op: 'upsert', eintrag: { id: 'fw-probe-nach', von: J, am: new Date().toISOString(), an: L, text: 'Danke (nach dem Update)', datum: heute } }] } }), 'PATCH familie');
  });

  // ── Schreibweg-Runde: je Bestand EIN neuer Eintrag über den Schreibweg der neuen Version — so läuft der ganze Bestand einmal durch ihre
  //    Säuberung (dort gingen Felder der alten Form verloren, wenn die neue sie nicht mehr kennt). Nur hinzufügen, nichts Vorhandenes ändern.
  const neu = async (name, fn) => versuch(`Schreibweg: ${name}`, fn);
  await neu('gemeinsames Ziel + Meilenstein (Kevin)', async () => {
    ok(await rufe('PATCH', '/api/state/ziele', { person: L, body: { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-probe-nach', titel: 'Nach dem Update (Probe)', fortschritt: 0, space: 'business' } }] } }), 'PATCH ziele');
    ok(await rufe('PATCH', '/api/state/meilensteine', { person: L, body: { ops: [{ op: 'upsert', eintrag: { id: 'ms-probe-nach', titel: 'Nach dem Update (Probe)', zielId: 'z-probe-nach', faellig: heute, space: 'business', erledigt: false, fortschritt: 0 } }] } }), 'PATCH meilensteine');
  });
  await neu('Unteraufgabe an der Hauptaufgabe (Kevin)', async () => {
    ok(await rufe('POST', '/api/tasks/create', { person: L, body: { title: 'Nach dem Update (Probe)', parentId: 't-probe-haupt', description: 'Probe.' } }), 'POST tasks/create');
  });
  await neu('Ernährung — Einkauf (Malin)', async () => {
    ok(await rufe('PATCH', '/api/state/ernaehrung', { person: J, body: { ops: [{ liste: 'einkauf', op: 'upsert', eintrag: { id: 'e-probe-nach', text: 'Äpfel (Probe)', erledigt: false } }] } }), 'PATCH ernaehrung');
  });
  await neu('Journal — neuer Tag (Kevin, ganzer Bestand wie im Browser)', async () => {
    const g = ok(await rufe('GET', '/api/state/journal', { person: L }), 'GET journal');
    const j = g.journal ?? g.eintraege ?? g;
    ok(await rufe('PUT', '/api/state/journal', { person: L, body: { ...j, [heute]: { text: 'Nach dem Update (Probe)', mood: 4 } } }), 'PUT journal');
  });
  await neu('Gesellschaft — Beschluss (Kevin, Register)', async () => {
    const reg = ok(await rufe('GET', '/api/gesellschaften', { person: L }), 'GET gesellschaften');
    const st = (reg.gesellschaften ?? []).find(g => g.id === 'ug')?.stand;
    ok(await rufe('PATCH', '/api/gesellschaften', { person: L, body: { id: 'ug', stand: st, liste: 'beschluesse', eintrag: { datum: heute, art: 'gf-beschluss', titel: 'Nach dem Update (Probe)', status: 'entwurf' } } }), 'PATCH gesellschaften');
  });
  await neu('Rechnungen & Zahlungen — Zahlung (Kevin)', async () => {
    ok(await rufe('PATCH', '/api/state/finanzplan', { person: L, body: { ops: [{ liste: 'zahlungen', op: 'upsert', eintrag: { id: 'za-probe-nach', firmaId: 'ug', titel: 'Nach dem Update (Probe)', betrag: 99, faellig: heute, status: 'offen' } }] } }), 'PATCH finanzplan');
  });
  await neu('Finanzplanung — Posten (Kevin)', async () => {
    const fp = ok(await rufe('GET', '/api/finanzplan', { person: L }), 'GET finanzplan');
    ok(await rufe('PATCH', '/api/finanzplan', { person: L, body: { basisStand: fp.dokument?.stand, ops: [{ pfad: '/posten/-', neu: { id: 'po-probe-nach', art: 'konto', einheit: 'ug', name: 'Nach dem Update (Probe)', betrag: 1, status: 'ok' } }] } }), 'PATCH finanzplan');
  });
  await neu('Kapazität — Urlaub (Malin)', async () => {
    ok(await rufe('PATCH', '/api/kapazitaet', { person: J, body: { ops: [{ op: 'ausnahme', person: 'konto-malin', ausnahme: { id: 'ka-probe-nach', art: 'urlaub', von: heute, bis: heute, titel: 'Probe' } }] } }), 'PATCH kapazitaet');
  });
  await neu('Kontakt — Notiz (Malin)', async () => {
    const k = (ok(await rufe('GET', '/api/state/kontakte', { person: J }), 'GET kontakte').kontakte ?? [])[1];
    if (!k) throw new Error('kein Kontakt');
    ok(await rufe('POST', '/api/crm/aktivitaet', { person: J, body: { id: k.id, art: 'notiz', text: 'Nach dem Update (Probe)' } }), 'POST aktivitaet');
  });
  await neu('Sport — Lauf (Kevin)', async () => {
    ok(await rufe('PUT', '/api/sport', { person: L, body: { ops: [{ op: 'lauf', eintrag: { id: 'lauf-probe-nach', datum: heute, distanzKm: 5, dauerSek: 1800, art: 'locker', quelle: 'hand' } }] } }), 'PUT sport');
  });
  await neu('Körper-Profil — Hebel (Kevin)', async () => {
    const kp = ok(await rufe('GET', '/api/gesundheit/koerper', { person: L }), 'GET koerper');
    ok(await rufe('PATCH', '/api/gesundheit/koerper', { person: L, body: { stand: kp.stand, ops: [{ op: 'eintrag', liste: 'hebel', eintrag: { name: 'Nach dem Update (Probe)', notiz: 'Probe' } }] } }), 'PATCH koerper');
  });
  await neu('Team — freie Mitarbeit (Kevin)', async () => {
    ok(await rufe('PATCH', '/api/team', { person: L, body: { ops: [{ op: 'upsert', eintrag: { id: 't-probe-nach', name: 'Probe Person', kurz: 'Probe', rolle: 'Probe', aktiv: true, kreis: 'partner' } }] } }), 'PATCH team');
  });
  await neu('Inbox — gelesen (Kevin)', async () => {
    const s = ok(await rufe('GET', '/api/inbox', { person: L }), 'GET inbox');
    const g = (s.gespraeche ?? [])[3];
    if (!g) return 'kein viertes Gespräch';
    ok(await rufe('POST', '/api/inbox', { person: L, body: { aktion: 'gelesen', id: g.id } }), 'POST inbox');
  });
}
