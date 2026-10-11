// ─── Update-Probe: was die Demo-Saat nicht abdeckt, live aber genutzt wird (10.10.) ─────────────────────────────────────────
// Läuft mit der ALTEN (online) Version, über deren Routen (Kopf `x-make-user`) — so entstehen die Bestände in genau der Form, die live
// liegt. Alles erfunden. Jeder Schritt einzeln: scheitert einer (andere Form in der alten Version), steht es im Bericht und der Rest läuft.
// Rückgabe: Marken je Person — eindeutige Texte, die nachher in einer Antwort an IHRE Person wieder auftauchen müssen (Sichtprobe).
//
// `altformenSchreiben` (zuletzt, nach dem Grundlauf): Formen, die die Schreibwege heute nicht mehr erzeugen, die ein Bestand aber tragen
// kann (z. B. Mandats-Ziele als reine Texte) — direkt in den Bestand, über die Datenschicht der alten Version.

// Die Personen heißen wie live: `kevin` (Inhaber, Erstkonto — seine persönlichen Bestände liegen OHNE Suffix, lib/zoe/raum.ts `speicherFuer`)
// und `malin` (Mitglied). Die Demo-Personen (lena, jonas, ben) bleiben als weiterer Bestand des Haushalts liegen.
export const L = 'kevin', J = 'malin';

export async function zusatzSaen({ muss, lade, versuch }) {
  const { localDay } = lade('@/lib/zeit');
  const { tagPlus } = lade('@/lib/zeit/kalender-kern');
  const heute = localDay();
  const t = n => tagPlus(heute, n);
  const jetzt = new Date().toISOString();
  const marken = { [L]: [], [J]: [] };
  const merke = (p, m) => { marken[p].push(m); return m; };

  // Konten wie live: Kevin Haupt-Inhaber (ältestes Konto + `hauptInhaber`), Malin Mitglied, beide im Haushalt der Demo; Lena wird Mitglied.
  // Direkt über die Datenschicht der alten Version (wie die Demo-Saat — die Einrichtung im Browser bräuchte den Instanz-Schlüssel).
  const ok = await versuch('Zusatz: Konten kevin (Inhaber) + malin (Mitglied)', async () => {
    const { aendereKonten, passwortHashen } = lade('@/lib/zugang/konten');
    const zugang = await passwortHashen('update-probe-passwort-nur-test');
    await aendereKonten(st => ({
      ...st,
      konten: [
        { id: 'k-probe-kevin', speicher: L, email: 'kevin@example.invalid', name: 'Kevin (Probe)', rolle: 'inhaber', angelegt: '2026-10-09T06:00:00.000Z', haushalt: 'demo', teilt: { gesundheit: [] }, ...zugang },
        { id: 'k-probe-malin', speicher: J, email: 'malin@example.invalid', name: 'Malin (Probe)', rolle: 'mitglied', angelegt: '2026-10-09T06:05:00.000Z', haushalt: 'demo', teilt: { gesundheit: [] }, ...zugang },
        ...st.konten.map(k => (k.speicher === 'lena' ? { ...k, rolle: 'mitglied' } : k)),
      ],
      einstellungen: { ...(st.einstellungen ?? {}), hauptInhaber: L },
    }));
    await muss('PATCH', '/api/team', L, { ops: [
      { op: 'upsert', eintrag: { id: `konto-${L}`, name: 'Kevin (Probe)', kurz: 'Kevin', rolle: 'Geschäftsführung', aktiv: true, kreis: 'kern' } },
      { op: 'upsert', eintrag: { id: `konto-${J}`, name: 'Malin (Probe)', kurz: 'Malin', rolle: 'Marketing & Gesundheit', aktiv: true, kreis: 'kern' } },
    ] });
  });
  if (ok === undefined && !(await lade('@/lib/store/local-db').loadJson('konten'))?.konten?.some(k => k.speicher === L)) throw new Error('Konten kevin/malin fehlen — ohne sie keine Probe wie live.');

  // Gesundheit: Einwilligung (a) für beide, Routinen mit Haken, Vitalwerte, Journal.
  await versuch('Zusatz: Einwilligung Gesundheit (beide)', async () => {
    const { GESUNDHEIT_FASSUNG } = lade('@/lib/datenschutz/gesundheit-einwilligung');
    for (const p of [L, J]) await muss('POST', '/api/datenschutz/gesundheit', p, { zweck: 'verarbeiten', an: true, fassung: GESUNDHEIT_FASSUNG });
  });
  await versuch('Zusatz: Gesundheits-Routinen (beide)', async () => {
    await muss('PATCH', '/api/state/routinen', J, { ops: [
      { op: 'upsert', eintrag: { id: 'r-probe-trinken', label: merke(J, 'PROBE Wasser trinken'), wann: 'morgen', kategorie: 'gesundheit', dauerMin: 5, owner: J, space: 'privat' } },
      { op: 'upsert', eintrag: { id: 'r-probe-dehnen', label: merke(J, 'PROBE Dehnen am Abend'), wann: 'abend', kategorie: 'gesundheit', dauerMin: 10, owner: J, space: 'privat', rhythmus: 'woechentlich' } },
    ] });
    await muss('PATCH', '/api/state/routinen', L, { ops: [
      { op: 'upsert', eintrag: { id: 'r-probe-supps', label: merke(L, 'PROBE Vitamine nehmen'), wann: 'morgen', kategorie: 'gesundheit', dauerMin: 2, owner: L, space: 'privat' } },
    ] });
  });
  await versuch('Zusatz: Haken im Gesundheits-Log (14 Tage, beide)', async () => {
    const log = (ids) => Object.fromEntries(Array.from({ length: 14 }, (_, i) => [t(-i), ids.filter((_, j) => (i + j) % 3 !== 0)]));
    await muss('PUT', '/api/state/health', L, log(['r-demo-plan', 'r-demo-spaziergang', 'r-demo-lesen', 'r-probe-supps']));
    await muss('PUT', '/api/state/health', J, log(['r-probe-trinken', 'r-probe-dehnen', 'r-demo-abendessen']));
    merke(L, 'r-probe-supps'); merke(J, 'r-probe-trinken');
  });
  await versuch('Zusatz: Vitalwerte (beide)', async () => {
    for (let i = 1; i <= 5; i++) for (const p of [L, J]) await muss('PUT', '/api/state/vitals', p, { date: t(-i), vitals: { rec: 60 + i, sleep: 7.1 + i / 10, hrv: 50 + i, rhr: 55 } });
  });
  await versuch('Zusatz: Journal (beide)', async () => {
    await muss('PUT', '/api/state/journal', L, { [t(-1)]: { text: merke(L, 'PROBE Journal Kevin gestern'), gut: 'Ruhiger Tag', mood: 4, energy: 3, stress: 2, flags: ['bewegt'], at: jetzt }, [t(-2)]: { dankbar: 'Sonne', mood: 3 } });
    await muss('PUT', '/api/state/journal', J, { [t(-1)]: { text: merke(J, 'PROBE Journal Malin gestern'), hart: 'Zu viel auf einmal', mood: 3, energy: 4 } });
  });

  // Ziele: Unsere (gemeinsam, Demo) + Meine (je Person, eigener Bestand) mit Fokus-Sätzen; ein Privat-Meilenstein am gemeinsamen Ziel.
  await versuch('Zusatz: Eigene Ziele + Fokus (beide)', async () => {
    await muss('PATCH', '/api/state/ziele', L, { fuer: 'ich', horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-probe-eigen-kevin', titel: merke(L, 'PROBE Eigenes Jahresziel Kevin'), fortschritt: 30, space: 'privat', rang: 1 } }] });
    await muss('PATCH', '/api/state/ziele', J, { fuer: 'ich', horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-probe-eigen-malin', titel: merke(J, 'PROBE Eigenes Jahresziel Malin'), fortschritt: 10, space: 'privat', rang: 1 } }] });
    await muss('PATCH', '/api/state/ziele', J, { fuer: 'ich', horizont: 'quartal', ops: [{ op: 'upsert', eintrag: { id: 'z-probe-eigen-malin-q', titel: merke(J, 'PROBE Quartalsziel Malin'), fortschritt: 0, space: 'privat' } }] });
    await muss('PUT', '/api/state/ziele', J, { fuer: 'ich', horizont: 'woche', fokus: merke(J, 'PROBE Fokus der Woche Malin') });
    await muss('PUT', '/api/state/ziele', L, { horizont: 'privat:woche', fokus: merke(L, 'PROBE Gemeinsamer Fokus Woche') });
  });
  await versuch('Zusatz: Meilenstein im Privat-Bereich', async () => {
    await muss('PATCH', '/api/state/meilensteine', L, { ops: [{ op: 'upsert', eintrag: { id: 'ms-probe-privat', titel: merke(L, 'PROBE Privat-Meilenstein'), zielId: 'z-demo-ruhe', faellig: t(20), space: 'privat', erledigt: false, fortschritt: 0, rang: 40 } }] });
  });

  // Aufgaben: Unteraufgaben über drei Ebenen, „nur ich“, Serie, Kommentar, Notiz, Beteiligte, Abgebrochen, eigene Felder, Papierkorb.
  await versuch('Zusatz: Aufgaben mit Unteraufgaben, Serie, nur ich, Felder', async () => {
    const basis = (id, title, extra = {}) => ({ id, title, projectId: 'p-probe-umzug', spaceId: 'ug', status: 'todo', priority: 'medium', assignee: L, tags: [], subTasks: [], dependencies: [], sortOrder: 0, description: 'Probe-Aufgabe (erfunden).', ...extra });
    await muss('PATCH', '/api/state/tasks', L, {
      struktur: { projekte: [{ op: 'upsert', eintrag: { id: 'p-probe-umzug', title: merke(L, 'PROBE Projekt Büroumzug'), spaceId: 'ug', category: 'business', owner: 'both', color: '#21B5AA', tags: [], archived: false, notiz: 'Projektnotiz (Probe)', felder: [{ id: 'f-budget', name: 'Budget', typ: 'betrag' }, { id: 'f-ort', name: 'Ort', typ: 'text' }] } }] },
      ops: [
        { op: 'upsert', task: basis('t-probe-haupt', merke(L, 'PROBE Hauptaufgabe Umzug'), { notiz: '## Plan\n- [ ] Kisten\n- [x] Termin', felder: { 'f-budget': '1.500', 'f-ort': 'Neubau' }, beteiligte: [J], startDate: t(-2), dueDate: t(9), dueTime: '14:30' }) },
        { op: 'upsert', task: basis('t-probe-unter1', 'PROBE Unteraufgabe Ebene 2', { parentId: 't-probe-haupt', dueDate: t(5) }) },
        { op: 'upsert', task: basis('t-probe-unter2', 'PROBE Unteraufgabe Ebene 3', { parentId: 't-probe-unter1', status: 'in_progress' }) },
        { op: 'upsert', task: basis('t-probe-unter3', 'PROBE Unteraufgabe Ebene 4', { parentId: 't-probe-unter2', status: 'done' }) },
        { op: 'upsert', task: basis('t-probe-abgebrochen', 'PROBE Abgebrochene Aufgabe', { status: 'cancelled' }) },
        { op: 'upsert', task: basis('t-probe-serie', merke(L, 'PROBE Wöchentlicher Bericht'), { dueDate: t(3), wiederholung: { regel: 'woechentlich', intervall: 1, wochentage: [1] } }) },
        { op: 'upsert', task: basis('t-probe-nurich', merke(L, 'PROBE Nur-ich-Aufgabe Kevin'), { sichtbarkeit: 'nur-ich', spaceId: 'privat', projectId: 'sonstige-privat' }) },
        { op: 'upsert', task: basis('t-probe-papierkorb', 'PROBE Aufgabe im Papierkorb') },
      ],
    });
    await muss('PATCH', '/api/state/tasks', L, { ops: [{ op: 'delete', id: 't-probe-papierkorb' }] });
    // Kommentar wie in der Oberfläche: an die bestehende Zeile (mit Stand), der Server setzt Person und Zeit.
    const st = await muss('GET', '/api/state/tasks', L);
    const h = (st.state?.tasks ?? []).find(x => x.id === 't-probe-haupt');
    if (h) {
      const { stand, ...task } = h;
      await muss('PATCH', '/api/state/tasks', L, { ops: [{ op: 'upsert', task: { ...task, kommentare: [...(task.kommentare ?? []), { id: 'k-probe-1', text: merke(L, 'PROBE Kommentar zur Hauptaufgabe'), von: L, am: jetzt }] }, stand }] });
    }
    await muss('PATCH', '/api/state/tasks', J, { ops: [
      { op: 'upsert', task: { id: 't-probe-malin-privat', title: merke(J, 'PROBE Private Aufgabe Malin'), projectId: 'sonstige-privat', spaceId: 'privat', status: 'todo', priority: 'high', assignee: J, tags: [], subTasks: [], dependencies: [], sortOrder: 0, sichtbarkeit: 'nur-ich', dueDate: t(2) } },
    ] });
  });

  // Kalender-Bezug (Kontakt am Termin) — der Neben-Bestand `kalender-bezug` (sonst nur mit iCloud; hier über die Datenschicht der alten Version).
  await versuch('Zusatz: Kalender-Bezüge', async () => {
    const { bezugSetzen } = lade('@/lib/kalender/bezug-server');
    const cache = await lade('@/lib/store/local-db').loadJson('calendar-cache');
    const ev = (cache?.events ?? []).slice(0, 2);
    let n = 0;
    for (const e of ev) { await bezugSetzen(`arbeit|${e.id}`, { kontaktId: 'c-probe-kontakt', mandatId: 'm-demo-nordwerk', von: L, tag: String(e.startDate).slice(0, 10), art: 'termin' }, jetzt); n++; }
    return `${n} Bezüge`;
  });

  // Familie: Themen (eines „nur ich“), Vereinbarung, Date, Wertschätzung, Ritual, Idee, Wunsch.
  await versuch('Zusatz: Familie', async () => {
    const e = (id, felder, von = L) => ({ id, von, am: jetzt, ...felder });
    await muss('PATCH', '/api/familie', L, { ops: [
      { liste: 'themen', op: 'upsert', eintrag: e('ft-probe-1', { titel: merke(L, 'PROBE Thema Urlaubsplanung'), art: 'loesbar', status: 'offen', hut: 'privat' }) },
      { liste: 'themen', op: 'upsert', eintrag: e('ft-probe-2', { titel: merke(L, 'PROBE Nur-ich-Thema Kevin'), art: 'unklar', status: 'offen', hut: 'privat', sichtbarkeit: 'nur-ich' }) },
      { liste: 'vereinbarungen', op: 'upsert', eintrag: e('fv-probe-1', { text: merke(L, 'PROBE Vereinbarung Sonntag frei'), wer: 'beide', faellig: t(7), status: 'offen' }) },
      { liste: 'dates', op: 'upsert', eintrag: e('fd-probe-1', { titel: 'PROBE Kino', ideeId: null, datum: t(6), planer: L, status: 'geplant', neuesErlebnis: true, nachklang: [] }) },
      { liste: 'wertschaetzungen', op: 'upsert', eintrag: e('fw-probe-1', { an: J, text: 'PROBE Danke fürs Kochen', datum: t(-1) }) },
      { liste: 'rituale', op: 'upsert', eintrag: e('fr-probe-1', { titel: 'PROBE Sonntagsfrühstück', ebene: 'paar', rhythmus: 'woechentlich' }) },
      { liste: 'ideen', op: 'upsert', eintrag: e('fi-probe-1', { titel: 'PROBE Wanderung', tags: ['draussen'], aufwand: 2, kosten: 1, dauer: 'tag', neu: true }) },
    ] });
    await muss('PATCH', '/api/familie', J, { ops: [
      { liste: 'wuensche', op: 'upsert', eintrag: e('fu-probe-1', { text: merke(J, 'PROBE Wunsch mehr Zeit draußen'), kategorie: 'zeit', status: 'offen' }, J) },
    ] });
  });

  // Ernährung: eigenes Profil, Gericht, Einkauf, Plan.
  await versuch('Zusatz: Ernährung', async () => {
    await muss('PATCH', '/api/state/ernaehrung', L, { ops: [
      { liste: 'profile', op: 'upsert', eintrag: { person: L, name: 'Kevin', bedarf: merke(L, 'PROBE wenig Zucker'), unvertraeglich: ['Erdnuss'] } },
      { liste: 'gerichte', op: 'upsert', eintrag: { id: 'g-probe-1', name: merke(L, 'PROBE Linsensuppe'), zutaten: [{ name: 'Linsen', menge: '250 g' }], zubereitung: ['Kochen'], dauerMin: 30, portionen: 2, fuer: [L, J], tags: ['schnell'], quelle: 'hand', angelegt: jetzt, favorit: true, notiz: 'Mit Zitrone' } },
      { liste: 'einkauf', op: 'upsert', eintrag: { id: 'e-probe-1', text: 'PROBE Haferflocken', erledigt: false, menge: '1 kg', kategorie: 'trocken' } },
      { feld: 'plan', tag: 'mo', mahlzeit: 'mittag', wert: 'PROBE Linsensuppe', gerichtId: 'g-probe-1' },
    ] });
  });

  // Finanzen (Business-Bestand `finanzplan`): Rechnungen gestellt/bezahlt, Zahlung, Merkposten.
  await versuch('Zusatz: Rechnungen und Zahlungen', async () => {
    // Erst lesen wie die Seite (legt beim ersten Mal die Firmen an) — ohne Firmen ersetzte ein späteres GET den Bestand (Befund 10.10.).
    await muss('GET', '/api/state/finanzplan', L);
    await muss('PATCH', '/api/state/finanzplan', L, { ops: [
      { liste: 'rechnungen', op: 'upsert', eintrag: { id: 're-probe-1', firmaId: 'ug', mandatId: 'm-demo-nordwerk', kunde: 'Nordwerk Maschinenbau GmbH', titel: merke(L, 'PROBE Rechnung Oktober'), betrag: 4165, netto: 3500, ustSatz: 19, status: 'gestellt', nummer: 'PROBE-2026-001', datum: t(-5), faellig: t(9) } },
      { liste: 'rechnungen', op: 'upsert', eintrag: { id: 're-probe-2', firmaId: 'ug', mandatId: 'm-demo-lumen', kunde: 'Lumen Logistik AG', titel: 'PROBE Rechnung September', betrag: 2915.5, netto: 2450, ustSatz: 19, status: 'gestellt', nummer: 'PROBE-2026-002', datum: t(-35), faellig: t(-5) } },
      { liste: 'zahlungen', op: 'upsert', eintrag: { id: 'za-probe-1', firmaId: 'ug', titel: 'PROBE Miete Büro', betrag: 1200, faellig: t(4), status: 'offen' } },
      { liste: 'merkposten', op: 'upsert', eintrag: { id: 'mp-probe-1', firmaId: 'kdv', titel: 'PROBE Darlehen an Gesellschaft', betrag: 10000 } },
    ] });
    await muss('PATCH', '/api/state/finanzplan', L, { aktion: 'bezahlt', rechnungId: 're-probe-2', am: t(-3) });
  });

  // Gesellschafts-Register: Beschlüsse und Organe.
  await versuch('Zusatz: Gesellschaften (Beschlüsse, Organe)', async () => {
    const reg = await muss('GET', '/api/gesellschaften', L);
    let st = (reg.gesellschaften ?? []).find(g => g.id === 'ug')?.stand;
    const schreib = async (liste, eintrag) => { st = (await muss('PATCH', '/api/gesellschaften', L, { id: 'ug', stand: st, liste, eintrag })).gesellschaft.stand; };
    await schreib('beschluesse', { datum: t(-30), art: 'gesellschafterbeschluss', titel: merke(L, 'PROBE Beschluss Jahresabschluss'), inhalt: 'Feststellung des Jahresabschlusses (Probe).', status: 'gefasst' });
    await schreib('beschluesse', { datum: t(-2), art: 'umlaufbeschluss', titel: 'PROBE Umlaufbeschluss Entwurf', status: 'entwurf' });
    await schreib('organe', { funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: L }, seit: '2023-01-10' });
  });

  // Inbox: Demo-Postfach der alten Version, Abgleich, Zustand (später, erledigt, zuordnen).
  await versuch('Zusatz: Inbox (Demo-Postfach, Zustand)', async () => {
    await muss('POST', '/api/inbox/postfaecher', L, { aktion: 'hinzufuegen', anbieter: 'demo', adresse: 'kevin.post@example.invalid', passwort: 'demo-postfach-passwort', bereich: 'ug', anzeigename: 'Probe-Postfach' });
    await muss('POST', '/api/inbox', L, { aktion: 'abgleichen' });
    const strom = await muss('GET', '/api/inbox', L);
    const g = strom.gespraeche ?? [];
    if (g[0]) await muss('POST', '/api/inbox', L, { aktion: 'spaeter', id: g[0].id, bis: t(2) });
    if (g[1]) await muss('POST', '/api/inbox', L, { aktion: 'erledigt', id: g[1].id });
    if (g[2]) await muss('POST', '/api/inbox', L, { aktion: 'gelesen', id: g[2].id });
    return `${g.length} Gespräche`;
  });

  // Fokus & Zeit: laufender Fokus, ein Privat-Block, Zeit-Umbuchung.
  await versuch('Zusatz: Fokus laufend + Zeitblock privat', async () => {
    await muss('POST', '/api/state/fokus', J, { laufend: { von: new Date(Date.now() - 20 * 60_000).toISOString(), schluessel: 'business:fokus', label: merke(J, 'PROBE Laufender Fokus') } });
    const von = new Date(`${t(-1)}T17:00:00.000Z`), bis = new Date(von.getTime() + 45 * 60_000);
    await muss('POST', '/api/state/zeit', L, { aktion: 'fokus', von: von.toISOString(), bis: bis.toISOString(), schluessel: 'privat:gesundheit', label: 'PROBE Privat-Fokus' });
  });

  // Flächen, Onboarding-Häkchen, Bauplan-Karte, Kalender-Einstellungen.
  // Dateien: CRM-Ablage (Vertrag an der Firma) und Datei an einer Aufgabe — verschlüsselt in `dateien/<haushalt>/`, Metadaten im Bestand.
  await versuch('Zusatz: Dateien (CRM-Ablage, Aufgabe)', async () => {
    const pdf = (titel) => new Blob([`%PDF-1.4\n1 0 obj<<>>endobj\n% ${titel} (Probe, erfunden)\ntrailer<<>>\n%%EOF\n`], { type: 'application/pdf' });
    const crm = new FormData();
    crm.append('datei', pdf('Rahmenvertrag'), 'Rahmenvertrag-Probe.pdf');
    crm.append('meta', JSON.stringify({ art: 'vertrag', titel: merke(L, 'PROBE Rahmenvertrag Nordwerk'), firmaId: 'f-demo-nordwerk', vertrag: { vertragsart: 'rahmen', von: t(-100) } }));
    await muss('POST', '/api/crm/dateien', L, crm);
    const auf = new FormData();
    auf.append('datei', new Blob(['Packliste (Probe)\nKisten, Klebeband\n'], { type: 'text/plain' }), 'Packliste-Probe.txt');
    auf.append('meta', JSON.stringify({ projektId: 'p-probe-umzug', aufgabeId: 't-probe-haupt', bereich: 'business' }));
    await muss('POST', '/api/aufgaben/dateien', L, auf);
  });
  await versuch('Zusatz: Fläche „Heute“ gestaltet (Kevin)', async () => {
    await muss('PUT', '/api/state/flaeche', L, { seite: 'heute', layout: { reihenfolge: ['anstehend', 'fokus', 'termine'], breiten: { fokus: 'halb' }, aus: ['index'] } });
  });
  await versuch('Zusatz: Onboarding-Häkchen (Kevin)', async () => {
    const { SCHRITTE } = lade('@/lib/make-one/onboarding-data');
    const s = SCHRITTE.find(x => x.ebene === 'ich' && !x.pruefung) ?? SCHRITTE.find(x => x.ebene === 'ich');
    await muss('POST', '/api/onboarding', L, { id: s.id, an: true });
    return s.id;
  });
  await versuch('Zusatz: Bauplan-Karte', async () => {
    await muss('POST', '/api/bauplan', J, { aktion: 'anlegen', titel: merke(J, 'PROBE Idee für den Bauplan'), art: 'idee', text: 'Erfundene Idee (Probe).' });
  });
  await versuch('Zusatz: CRM-Aktivität + Follow-up', async () => {
    const k = (await muss('GET', '/api/state/kontakte', L)).kontakte?.[0];
    if (!k) return 'kein Kontakt';
    await muss('POST', '/api/crm/aktivitaet', L, { id: k.id, art: 'notiz', text: merke(L, 'PROBE Notiz zum Kontakt') });
    await muss('POST', '/api/crm/followup', L, { aktion: 'anlegen', kontaktId: k.id, text: 'PROBE Nachfassen', faellig: t(3) });
  });
  return marken;
}

/** Direkt in den Bestand (alte Datenschicht): Altformen, die heute kein Schreibweg mehr erzeugt — der Bestand kann sie trotzdem tragen. */
export async function altformenSchreiben({ lade, versuch }) {
  const db = lade('@/lib/store/local-db');
  await versuch('Altform: Mandats-Ziele als Texte, ohne Kennung, mit Soll/Ist', async () => {
    await db.updateJson('crm', cur => {
      const crm = cur ?? {};
      const mandate = Array.isArray(crm.mandate) ? crm.mandate : [];
      const mit = (id, ziele) => mandate.map(m => (m.id === id ? { ...m, ziele } : m));
      let neu = mit('m-demo-nordwerk', ['PROBE Ziel als reiner Text', 'PROBE Zweites Ziel als Text']);
      neu = neu.map(m => (m.id === 'm-demo-lumen' ? { ...m, ziele: [{ text: 'PROBE Ziel ohne Kennung' }, { id: 'z-probe-voll', text: 'PROBE Ziel mit Soll und Ist', ziel: '5 Standorte', ist: '2 Standorte' }, 'PROBE Gemischt: Text in Objektliste'] } : m));
      return { ...crm, mandate: neu };
    });
    return 'Nordwerk: 2 Texte · Lumen: ohne Kennung, voll, gemischt';
  });
  // Marken (Sichtprobe): die Mandatsakte zeigt die Ziele — als Texte, wie sie im Bestand stehen.
  return { [L]: ['PROBE Ziel als reiner Text', 'PROBE Ziel ohne Kennung', 'PROBE Ziel mit Soll und Ist', 'PROBE Gemischt: Text in Objektliste'] };
}
