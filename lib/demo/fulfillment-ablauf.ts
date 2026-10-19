// ─── MAKE OS — Demo-Instanz: ein Fall, dessen Ablauf sichtbar ausgeführt wird (17.10. abends; lib/fulfillment/prozesse/ausfuehrung.ts) ─────────────
// Auftrag 17.10.: „Ein Demo-Fall läuft sichtbar durch: offene Entscheidung, eine fällige Erinnerung, ein Mail-Entwurf zur Freigabe. Über die Routen säen.“
// Ein dritter, erfundener Kunde (Firma, Ansprechperson, Mandat, Liquiditätsplan über den Vorschlagsweg) bekommt einen Fall nach dem Beispiel-Ablauf des Editors
// (lib/demo/fulfillment-editor.ts). Vorher hängt an der Erinnerung „Nach einer Woche nachfassen“ ein Mail-Baustein (Editor-Route). Dann wie im Browser:
//   Onboarding (Willkommensmail, Entscheider, Vereinbarung, Ziel, Log, Kick-off, Abstimmungspunkt 1; das Playbook entfällt mit Grund) → „Bedarf aufnehmen“
//   erledigt → „Angebot senden“ gesendet → „Angebot angenommen?“ nein vor sieben Tagen → die Erinnerung ist heute fällig: ihre Aufgabe steht in Aufgaben,
//   ihr Mail-Entwurf als Vorschlag im Stapel (gesendet wird nichts), die Entscheidung bleibt offen (Ja/Nein im Fall). Heute fällig, nie überfällig — die Demo
//   hat keine überfällige Aufgabe (Abnahme B12).
// Alles über die ROUTEN (`rufe`), erfunden und neutral (Wächter tests/demo.test.ts liest jede Datei der Demo).

import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';
import { EDITOR_BEISPIEL_TITEL } from './fulfillment-editor';
import { DEMO_DOMAIN } from './schutz';
import { neueKennung } from '@/lib/kennung';
import { tagPlus } from '@/lib/kalender/zeit';

/** Das Mandat des Beispiel-Falls in Ausführung (auch für die Wächter). */
export const ABLAUF_DEMO_MANDAT = 'm-demo-hafen';
export const ABLAUF_DEMO_FIRMA = 'f-demo-hafen';

type J = Record<string, unknown>;
interface KnotenJ { id: string; elternId?: string; titel: string; form?: string; stand?: string }

export async function ablaufBeispielSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const L = k.inhaber;
  const kunde = 'Hafenkontor Beispiel GmbH';
  const kontakt = k.kontaktId('hafen-ansprechperson');
  const plus = (n: number) => tagPlus(k.heute, n);
  // 1) Der Kunde (erfunden) — über die Routen der Markttraktion; der Retainer kommt wie die anderen über den Vorschlag in den Liquiditätsplan.
  await k.rufe(k.routen.crm(), 'PATCH', '/api/crm/bestand', L, { ops: [{ liste: 'firmen', op: 'upsert', eintrag: { id: ABLAUF_DEMO_FIRMA, name: kunde, rolle: 'kunde', branche: 'Logistik', stadt: 'Bremen', mitarbeiter: '40', webseite: 'https://hafen.example', notiz: 'Erfundene Beispiel-Firma (Demo).',
    // Erfundene Rechnungsanschrift (19.10., Rundgang A7) — damit auch hier eine Rechnung bis „gestellt“ vorführbar ist.
    zahlung: { empfaenger: { anschrift: 'Musterkai 8, 28195 Bremen' } } } }] });
  await k.rufe(k.routen.kontakte(), 'PATCH', '/api/state/kontakte', L, { ops: [{ op: 'upsert', eintrag: {
    id: kontakt, vorname: 'Mara', nachname: 'Beispiel', email: `mara@${DEMO_DOMAIN}`, position: 'Geschäftsführerin', firma: kunde, firmaId: ABLAUF_DEMO_FIRMA,
    // Ohne Aktivitäten vor dem Anlagetag (Abnahme C8: keine Aktivität vor `importiertAm`).
    stufe: 'gewonnen', prio: 'B', eignung: 'ja', herkunft: 'Demo (erfunden)', besitzer: L, aktivitaeten: [],
  } }] });
  await k.rufe(k.routen.crm(), 'PATCH', '/api/crm/bestand', L, { ops: [{ liste: 'mandate', op: 'upsert', eintrag: {
    id: ABLAUF_DEMO_MANDAT, kunde, firmaId: ABLAUF_DEMO_FIRMA, kontaktIds: [kontakt], titel: 'Angebotsprozess Hafenkontor', art: 'retainer', gesellschaft: 'ug', status: 'aktiv',
    vertragUnterschrieben: true, start: plus(-17), verlaengerung: 'manuell', honorar: { betrag: 1800, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
    zahlungszielTage: 14, ziele: [], health: { beteiligung: 70, umsetzung: null, wirkung: null, zahlung: 90, stimmung: 75 }, leistungen: ['Angebotsprozess'], offen: [], zustaendig: L,
  } }] });
  const lp = await k.rufe(k.routen.mandatLiquiplan(), 'GET', '/api/crm/liquiplan', L);
  if ((lp.mandate as { id: string; lage: string }[] | undefined)?.some(x => x.id === ABLAUF_DEMO_MANDAT && x.lage === 'fehlt')) {
    await k.rufe(k.routen.mandatLiquiplan(), 'POST', '/api/crm/liquiplan', L, { mandatId: ABLAUF_DEMO_MANDAT, aktion: 'anlegen' });
  }

  // 2) Ein Mail-Baustein für die Erinnerung — Bibliothek, dann im Editor an die Erinnerung des Beispiel-Ablaufs gehängt (vor dem Start: der Fall kopiert ihn).
  await k.rufe(k.routen.fulfillment(), 'PATCH', '/api/fulfillment', L, { ops: [{ op: 'baustein', eintrag: {
    art: 'mail', titel: 'Angebot nachfassen (Beispiel)', zweck: 'Freundlich nachfragen, wenn ein Angebot noch ohne Antwort ist.', tags: ['nachfassen'],
    text: ['Betreff: Kurze Rückfrage zum Angebot — {{kunde}}', '', '{{anrede}},', '', 'ich wollte kurz nachhören, ob Sie unser Angebot schon prüfen konnten. Wenn es passt, sprechen wir den Start im nächsten Termin ab ({{termin}}).', '', 'Freundliche Grüße', '{{absender}}'].join('\n'),
  } }] });
  const ue = await k.rufe(k.routen.fulfillment(), 'GET', '/api/fulfillment', L);
  const vorlage = (ue.prozesse as { id: string; art: string; titel: string }[] | undefined)?.find(p => p.art === 'paket' && p.titel === EDITOR_BEISPIEL_TITEL);
  const mail = (ue.bausteine as { id: string; titel: string }[] | undefined)?.find(b => b.titel === 'Angebot nachfassen (Beispiel)');
  const kickoff = (ue.rituale as { id: string; rhythmus: string }[] | undefined)?.find(r => r.rhythmus === 'einmal')?.id;
  if (!vorlage || !mail) return [{ name: 'Fulfillment: Beispiel-Fall in Ausführung', anzahl: 0 }];
  const ed = await k.rufe(k.routen.editor(), 'GET', `/api/fulfillment/editor?v=${encodeURIComponent(vorlage.id)}`, L);
  const erinnerung = ((ed.vorlage as { knoten?: KnotenJ[] } | undefined)?.knoten ?? []).find(x => x.form === 'erinnerung');
  if (erinnerung) await k.rufe(k.routen.editor(), 'PATCH', '/api/fulfillment/editor', L, { vorlageId: vorlage.id, stand: ed.stand, ops: [
    // „Nach einer Woche nachfassen“ — Frist 7 Tage nach dem „nein“, und der Mail-Baustein dazu.
    { op: 'schritt', id: erinnerung.id, frist: 7 },
    { op: 'baustein-dazu', id: neueKennung('fk'), schrittId: erinnerung.id, bausteinId: mail.id },
  ] });

  // 3) Der Fall — Start vor 16 Tagen, das Onboarding wie im Browser (das Playbook entfällt mit Grund).
  await k.rufe(k.routen.fall(), 'POST', '/api/fulfillment/fall', L, { aktion: 'starten', mandatId: ABLAUF_DEMO_MANDAT, vorlageId: vorlage.id, start: plus(-16), anfrageId: 'ff-demo-start-hafen' });
  const fallOps = (ops: J[]) => k.rufe(k.routen.fall(), 'PATCH', '/api/fulfillment/fall', L, { mandatId: ABLAUF_DEMO_MANDAT, ops });
  const knoten = async (): Promise<KnotenJ[]> => (((await k.rufe(k.routen.fall(), 'GET', `/api/fulfillment/fall?m=${ABLAUF_DEMO_MANDAT}`, L)).fall as { knoten?: KnotenJ[] } | undefined)?.knoten ?? []);
  await fallOps([
    { op: 'willkommen-gesendet', am: plus(-16) },
    { op: 'stakeholder', eintrag: { kontaktId: kontakt, rolle: 'entscheider', einfluss: 3, haltung: 'positiv' } },
    { op: 'vereinbarung', felder: { rollen: 'Geschäftsführung entscheidet.', reaktionszeiten: 'Antwort binnen zwei Werktagen.', bestaetigtAm: plus(-14), bestaetigtWie: 'kickoff' } },
    { op: 'ziel-neu', text: 'Angebote in fünf Werktagen', felder: { ausgang: 'Angebote brauchen zwei Wochen', ausgangZahl: 10, zielZahl: 5, einheit: 'Tage', zielBis: plus(60), richtung: 'runter', festlegen: true, festgelegtAm: plus(-14) } },
    { op: 'entscheidung', eintrag: { titel: 'Start mit dem Angebotsprozess', status: 'entschieden', wer: 'beide', geteilt: true, am: plus(-14) } },
    ...(kickoff ? [{ op: 'ritual-merken', ritualId: kickoff, terminUid: 'makeos-demo-kickoff-hafen' }] : []),
    { op: 'knoten-status', id: 'fk-ob-playbook', status: 'entfaellt', grund: 'Im Kick-off gemeinsam besprochen (Beispiel)', am: plus(-14) },
    { op: 'freigabe', id: 'F0', kunde: { wie: 'kickoff', am: plus(-14) }, am: plus(-14) },
  ]);
  // 4) Der Ablauf — jeder Schritt wie ein Klick im Fall; die Ausführung legt nach jedem Schreiben Aufgabe, Vorschlag bzw. Erinnerung an.
  const titel = (t: string) => knoten().then(l => l.find(x => x.titel === t));
  const bedarf = await titel('Bedarf aufnehmen');
  if (bedarf) await fallOps([{ op: 'knoten-status', id: bedarf.id, status: 'erledigt', am: plus(-12) }]);
  const senden = await titel('Angebot senden');
  if (senden) await fallOps([{ op: 'knoten-status', id: senden.id, status: 'erledigt', am: plus(-10) }]);
  const frage = await titel('Angebot angenommen?');
  if (frage) await fallOps([{ op: 'antwort', id: frage.id, antwort: 'nein', am: plus(-7) }]);
  return [{ name: 'Fulfillment: Beispiel-Fall in Ausführung', anzahl: frage ? 1 : 0 }];
}
