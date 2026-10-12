// ─── MAKE OS — Demo-Instanz: Fulfillment · Analyse (C3, 10.10.; FULFILLMENT_KONZEPT.md 12.7) ─────────────────────────────────────────────────
// Ein erfundenes Dossier mit ALLEN Abschnitten für das erste Demo-Mandat — ohne KI-Schlüssel vollständig: über die ROUTEN (anlegen, Start-Prüfer A0,
// Interessenabwägung, F1, übernehmen, prüfen, überstimmen, F2). Ausnahme (hier begründet, wie in saat-agenten.ts): die gespeicherten Läufe der
// Agenten („ohne Modell, mit Kosten“) und die eine Personenkarte schreibt die Saat direkt über die EINE Schreibstelle (`fulfillmentAendern`) — ein
// Lauf über die Route würde ein Modell rufen. Kein Leseteil (Tiefenbericht): die Oberfläche zeigt stattdessen den Hinweis.
// Alles erfunden: Firmen und Personen sind die der Demo-Saat, Adressen enden auf `.example`, Kosten sind Beispielwerte in Cent.
// 12.10. (Geschichte ohne Widersprüche): die Analyse lief vor vier Wochen (nach dem Kick-off, der F1 bestätigte), der Art.-14-Hinweis ging zwei Tage
// später per Mail raus, die Karte ist geprüft — danach F2 und die Diagnose (lib/demo/fulfillment-prozesse.ts `geschichteSaeen`).

import { neueKennung } from '@/lib/kennung';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import type { AbschnittId, AnalyseAgentId, AnalyseLauf, Aussage, Quelle } from '@/lib/fulfillment/typen';
import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';

type Entwurf = { abschnitte: Partial<Record<AbschnittId, Aussage[]>>; quellen: Quelle[]; diagnose?: unknown; befunde?: unknown[]; steckbrief?: unknown; zaehler: Record<string, number>; ausgelassen: string[] };

export async function analyseSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const m = k.mandate[0];
  if (!m) return [];
  const { inhaber: p, heute, rufe, routen } = k;
  const dossierPfad = '/api/fulfillment/dossier';
  // 1) Dossier anlegen (Vorschlag aus der Firmenakte) und Start-Prüfer A0 (ohne Kosten) — beides über die Routen.
  let r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'anlegen', mandatId: m.id });
  await rufe(routen.analyse(), 'POST', '/api/fulfillment/analyse', p, { aktion: 'starten', mandatId: m.id, agent: 'a0', bestaetigtCent: 0 });
  r = await rufe(routen.dossier(), 'GET', `${dossierPfad}?m=${m.id}`, p);
  const { LIA_MUSTER } = await import('@/lib/fulfillment/analyse/dsgvo');
  r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'lia', mandatId: m.id, stand: r.stand, ...LIA_MUSTER });
  r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'f1', mandatId: m.id, stand: r.stand, umfang: ['a1', 'a2', 'a4', 'a6', 'a7', 'a11', 'a12', 'a13'], funktionen: ['Geschäftsführung'], kundeBestaetigtAm: tagPlus(heute, -42), wie: 'kickoff' });

  // 2) Gespeicherte Läufe (ohne Modell, mit Kosten) — erfundene Entwürfe mit Quellen und Datum.
  const q = (url: string, titel: string): Quelle => ({ id: neueKennung('dq'), url, titel, domain: new URL(url).hostname, abgerufenAm: tagPlus(heute, -28) });
  const start = q('https://nordwerk.example/', 'Startseite');
  const leistung = q('https://nordwerk.example/leistungen', 'Leistungen');
  const karriere = q('https://nordwerk.example/karriere', 'Karriere');
  const presse = q('https://fachpresse.example/maschinenbau-markt', 'Marktbericht Fachpresse');
  const a = (agent: AnalyseAgentId, text: string, art: Aussage['art'], quellen: Quelle[]): Aussage => ({ id: neueKennung('da'), text, art, quellen: quellen.map(x => x.id), stand: tagPlus(heute, -28), agent });
  const z = { verworfen: 0, ohneQuelle: 0, gesperrt: 0, gekuerzt: 0, negativ: 0, namen: 0 };
  const laeufe: { agent: AnalyseAgentId; kosten: number; e: Entwurf; abschnitte: (AbschnittId | 'diagnose')[] }[] = [
    { agent: 'a1', kosten: 24, abschnitte: ['unternehmen', 'fragen'], e: { quellen: [start, leistung], zaehler: { ...z, ohneQuelle: 1 }, ausgelassen: [], steckbrief: { branche: { wert: 'Maschinenbau', quelle: leistung.id } }, abschnitte: {
      unternehmen: [a('a1', 'Sondermaschinen für die Lebensmittelindustrie, Service und Ersatzteile aus einer Hand.', 'fakt', [leistung]), a('a1', 'Größe in der Bandbreite 150–250 Mitarbeitende.', 'schaetzung', [start])],
      fragen: [a('a1', 'Ohne Beleg: Exportanteil — im Kick-off erfragen.', 'hypothese', [])],
    } } },
    { agent: 'a6', kosten: 41, abschnitte: ['markt'], e: { quellen: [presse], zaehler: z, ausgelassen: [], abschnitte: {
      markt: [a('a6', 'Drei Wettbewerber bieten Wartungsverträge mit festen Reaktionszeiten an.', 'fakt', [presse]), a('a6', 'Der Mandant gewinnt vermutlich über die Nähe zum Kunden, verliert bei Standardanlagen über den Preis.', 'hypothese', [presse])],
    } } },
    { agent: 'a7', kosten: 19, abschnitte: ['aussen', 'vertrieb'], e: { quellen: [start, karriere], zaehler: z, ausgelassen: [], abschnitte: {
      aussen: [a('a7', 'Die Startseite nennt keinen klaren nächsten Schritt für Interessenten.', 'fakt', [start])],
      vertrieb: [a('a7', 'Zwei offene Stellen im Vertriebsinnendienst.', 'fakt', [karriere])],
    } } },
    { agent: 'a12', kosten: 63, abschnitte: ['fazit', 'good_bad', 'hypothesen', 'diagnose'], e: { quellen: [start, presse], zaehler: z, ausgelassen: [], abschnitte: {
      fazit: [a('a12', 'Solide Marktposition im Sondermaschinenbau; der Vertrieb hängt an wenigen Personen und hat keinen festen Ablauf für Erstgespräche.', 'hypothese', [start, presse])],
      good_bad: [a('a12', 'Good News: Wartungsgeschäft wächst. Bad News: Website führt Interessenten nicht zum Gespräch.', 'fakt', [start])],
      hypothesen: [a('a12', 'Ein fester Ablauf für Erstgespräche erhöht die Umwandlung zum Angebot.', 'hypothese', [])],
    }, diagnose: {
      top5: [
        { id: 'm1', text: 'Erstgespräche mit fester Agenda und Bedarfsfragen führen.', hebel: 'umwandlung', wirkung: 'mehr Angebote je Gespräch', aufwand: 'klein', evidenz: 'B' },
        { id: 'm2', text: 'Wartungsverträge aktiv in jedes Neukundenangebot aufnehmen.', hebel: 'dealwert', wirkung: 'höherer Auftragswert', aufwand: 'mittel', evidenz: 'B' },
        { id: 'm3', text: 'Startseite um eine klare Handlungsaufforderung ergänzen.', hebel: 'zufluss', wirkung: 'mehr Anfragen', aufwand: 'klein', evidenz: 'C' },
      ],
      quickWins: ['Agenda für Erstgespräche einführen', 'Kontakt-Knopf auf der Startseite', 'Wöchentliche Pipeline-Runde mit Zahlen'],
      fragen: [{ frage: 'Wer führt heute die Erstgespräche?', an: 'vertrieb', warum: 'Abhängigkeit von Einzelnen klären' }, { frage: 'Welches Umsatzziel gilt für das Wartungsgeschäft?', an: 'gruender', warum: 'Wert-Konto festlegen' }],
    } } },
    { agent: 'a13', kosten: 22, abschnitte: [], e: { quellen: [], zaehler: z, ausgelassen: [], abschnitte: {}, befunde: [{ art: 'qualitaet', text: 'Mitarbeiterzahl nur als Bandbreite belegt — im Kick-off bestätigen lassen.' }] } },
  ];
  const sp = await import('@/lib/fulfillment/speicher');
  const neu: AnalyseLauf[] = laeufe.map((l, i) => ({
    id: neueKennung('al'), agent: l.agent, status: 'fertig', schaetzungCent: l.kosten, bestaetigtCent: l.kosten, grenzeCent: Math.ceil(l.kosten * 1.5), kostenCent: l.kosten,
    gestartetAm: `${tagPlus(heute, -28)}T09:${String(10 + i).padStart(2, '0')}:00.000Z`, gestartetVon: p, fertigAm: `${tagPlus(heute, -28)}T09:${String(14 + i).padStart(2, '0')}:00.000Z`, versuch: 1, ergebnis: l.e,
  }));
  // Eine erfundene berufliche Personenkarte (Funktion aus F1) mit Art.-14-Uhr — und der A4-Lauf, der sie angelegt hat (nur Zähler).
  const kartenId = neueKennung('pp');
  const pq = q('https://nordwerk.example/team', 'Team');
  neu.push({ id: neueKennung('al'), agent: 'a4', status: 'fertig', schaetzungCent: 38, bestaetigtCent: 38, grenzeCent: 57, kostenCent: 35, gestartetAm: `${tagPlus(heute, -28)}T10:00:00.000Z`, gestartetVon: p, fertigAm: `${tagPlus(heute, -28)}T10:03:00.000Z`, versuch: 1, ergebnis: { funktion: 'Geschäftsführung', karten: [kartenId], zaehler: z, ausgelassen: ['Familie'] } });
  await sp.fulfillmentAendern('dossiers', d => {
    const x = d.dossiers[m.id];
    return x ? { ok: true, datei: { ...d, dossiers: { ...d.dossiers, [m.id]: { ...x, laeufe: [...x.laeufe, ...neu] } } }, geaendert: [m.id] } : { ok: false, status: 404, fehler: 'Dossier fehlt' };
  }, { art: 'system' });
  const { art14FaelligAm } = await import('@/lib/fulfillment/analyse/dsgvo');
  const { personenAnwenden } = await import('@/lib/fulfillment/analyse/personen-anwenden');
  const erfasst = tagPlus(heute, -28);
  await sp.fulfillmentAendern('personen', d => personenAnwenden(d, { op: 'karte-neu', karte: {
    id: kartenId, mandatId: m.id, funktion: 'Geschäftsführung', name: 'Sophie Brandt', kontaktId: m.kontaktIds[0], rolleSeit: '01/2019',
    werdegang: [{ id: neueKennung('da'), text: 'Seit 2019 Geschäftsführung, vorher Leitung Service.', art: 'fakt', quellen: [pq.id], stand: erfasst, agent: 'a4' }],
    themen: [{ id: neueKennung('da'), text: 'Spricht auf Fachtagungen über Wartungsmodelle.', art: 'fakt', quellen: [pq.id], stand: erfasst, agent: 'a4' }],
    auftritte: [], aufhaenger: [{ id: neueKennung('da'), text: 'Erfahrungen mit festen Reaktionszeiten im Service.', art: 'hypothese', quellen: [pq.id], stand: erfasst, agent: 'a4' }],
    identitaet: 'hoch', ausgelassen: ['Familie'], quellen: [pq], art14: { faelligAm: art14FaelligAm(erfasst), gegebenAm: tagPlus(heute, -26), wie: 'mail', von: p }, erfasstAm: erfasst, status: 'geprueft',
  } }, { person: p, heute, standVon: () => '' }), { art: 'system' });

  // 3) Übernehmen (je Lauf die Abschnitte), prüfen, Qualitäts-Hinweis mit Grund überstimmen, F2 — über die Route.
  r = await rufe(routen.dossier(), 'GET', `${dossierPfad}?m=${m.id}`, p);
  for (let i = 0; i < laeufe.length; i++) {
    r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'uebernehmen', mandatId: m.id, stand: r.stand, laufId: neu[i].id, abschnitte: laeufe[i].abschnitte });
  }
  r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'pruefen', mandatId: m.id });
  const befunde = ((r.dossier as { pruefung?: { befunde: { art: string; ueberstimmt?: unknown }[] } }).pruefung?.befunde ?? []);
  for (let i = 0; i < befunde.length; i++) {
    if (befunde[i].art !== 'qualitaet' || befunde[i].ueberstimmt) continue;
    r = await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'ueberstimmen', mandatId: m.id, stand: r.stand, index: i, grund: 'Die Zahl bestätigt der Kunde im Kick-off (Demo).' });
  }
  const bestanden = !!(r.dossier as { pruefung?: { bestanden?: boolean } }).pruefung?.bestanden;
  if (bestanden) await rufe(routen.dossier(), 'POST', dossierPfad, p, { aktion: 'f2', mandatId: m.id, stand: r.stand });
  return [{ name: 'Fulfillment · Dossier', anzahl: 1 }, { name: 'Fulfillment · Analyse-Läufe', anzahl: neu.length + 1 }, { name: 'Fulfillment · Personenkarten', anzahl: 1 }];
}
