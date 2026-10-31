// ─── MAKE OS — Demo-Instanz: Kreislauf Geld & Lieferung + große Firmenakte (Server, 30.10.) ───────────────────────────────────────────────────────────
// Kevin 30.10. nachts: „Demo-Instanz auf neuen Stand“ — die Demo zeigt den Kreislauf der letzten Tage (Abschnitte „Kreislauf Geld“ und „Keine Rechnung ohne
// Zuordnung“ in CLAUDE.md) und eine Firma, deren große Akte alles trägt. Teil der Saat (lib/demo/saat.ts ruft `kreislaufSaen` nach den Prozessen), über die
// ROUTEN in-process (`rufe`, Person im Kopf `x-make-user`) — dieselben Schreibwege wie die Oberfläche:
//   1. eine zweite Person bei Nordwerk (Kartei)
//   2. ein Angebot an Nordwerk: Entwurf → stellen (Deal entsteht über den EINEN Weg) → angenommen → Mandat + Liquiplan AUTOMATISCH (Mandat-Automatik)
//      2b. (31.10.) ein zweites angenommenes Angebot an Lumen OHNE Rechnung und ohne Fall — „Mandat + Liquiplan zurücknehmen“ bleibt vorführbar
//   3. Rechnungen: aus dem neuen Mandat gestellt UND bezahlt · ein Entwurf aus dem Retainer-Mandat (wie ihn der Morgenlauf vorbereitet) · eine gestellte
//      Monatsrechnung eines zweiten Kunden · eine gestellte Rechnung der Selbstständigkeit (Privat-Einheit) an einen Kunden der Markttraktion ·
//      eine alte, bezahlte Rechnung OHNE Zuordnung (Altbestand — zeigt den Filter „Ohne Zuordnung“ und „Zuordnung nachtragen“)
//   4. die große Akte: ein offener Folge-Deal, zwei Aufgaben mit Bezug, ein Rahmenvertrag (PDF) an der Firma, ein Termin mit Bezug
// Ausnahme (begründet wie in lib/demo/fulfillment-prozesse.ts `kundenTermineVerknuepfen`): der Termin geht in den Termin-Stand (`calendar-cache`) und sein
// Bezug über die EINE Schreibstelle `bezugSetzen` — die Demo hat keinen iCloud-/Google-Kalender, also keinen Anlegeweg über die Termin-Route.
// Alles erfunden: Namen, Firmen, Beträge (Wächter tests/demo.test.ts liest jede Datei der Demo). Gestellt wird in der Demo von Hand wie im Browser — nichts
// wird versendet. Kennungen fest bzw. aus dem Lauf, damit Zurücksetzen dasselbe Bild ergibt.

import { tagPlus } from '@/lib/zeit/kalender-kern';
import { finanzOrtName } from '@/lib/einheiten';
import { bauKennung, BAU_KOPF } from '@/lib/bau/kennung';
import type { DemoModul, DemoRufe, SaatSchritt } from './saat-fulfillment';

export const KREISLAUF_ROUTEN = {
  kontakte: () => import('@/app/api/state/kontakte/route') as Promise<DemoModul>,
  angebot: () => import('@/app/api/crm/angebot/route') as Promise<DemoModul>,
  deal: () => import('@/app/api/crm/deal/route') as Promise<DemoModul>,
  rechnung: () => import('@/app/api/rechnung/route') as Promise<DemoModul>,
  finanzplanBestand: () => import('@/app/api/state/finanzplan/route') as Promise<DemoModul>,
  absender: () => import('@/app/api/crm/gesellschaften/route') as Promise<DemoModul>,
  aufgabe: () => import('@/app/api/tasks/create/route') as Promise<DemoModul>,
  dateien: () => import('@/app/api/crm/dateien/route') as Promise<DemoModul>,
};

/** Die Firma mit der großen Akte und die zweite Person dort (fest — Links bleiben nach dem Zurücksetzen gleich). */
export const KREISLAUF_FIRMA = 'f-demo-nordwerk';
export const KREISLAUF_ANGEBOT = 'ang-demo-nordwerk-sued';
export const KREISLAUF_ALT_RECHNUNG = 're-demo-altbestand';
/** Zweites angenommenes Angebot (31.10.) — bewusst ohne Rechnung und ohne Fall, damit „Rückgängig“ der Mandat-Automatik vorführbar bleibt. */
export const KREISLAUF_ANGEBOT_RUECKGAENGIG = 'ang-demo-lumen-workshop';
const NORDWERK = 'Nordwerk Maschinenbau GmbH';

export interface KreislaufKontext {
  lena: string; jonas: string; heute: string; domain: string; iban: string;
  rufe: DemoRufe;
  kontaktId: (schluessel: string) => string;
  /** Die Diagnose aus dem Katalog der Saat (Kennung, Name, Text, Preis in Cent). */
  diagnose: { id: string; name: string; text: string; cent: number };
  /** Einheit der operativen Gesellschaft für Business-Aufgaben (wie in der Saat). */
  einheit: string;
}

type Rechnung = { id: string; fassung: string; status: string; nummer?: string };

/** Ein kleines PDF (erfunden) — wie eine hochgeladene Datei; die Ablage prüft den Inhalt am Dateikopf. */
async function beispielPdf(titel: string, zeilen: string[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const seite = doc.addPage([595, 842]);
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  seite.drawText(titel, { x: 56, y: 770, size: 18, font: schrift });
  zeilen.forEach((z, i) => seite.drawText(z, { x: 56, y: 730 - i * 20, size: 11, font: schrift }));
  doc.setTitle(titel);
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  return doc.save();
}

/** Upload wie im Browser (multipart `datei` + `meta`) — `rufe` kennt nur JSON. */
async function dateiAblegen(person: string, name: string, bytes: Uint8Array, meta: Record<string, unknown>): Promise<string> {
  const modul = (await KREISLAUF_ROUTEN.dateien()) as { POST?: (r: Request) => Promise<Response> };
  if (!modul.POST) throw new Error('Dateiablage: kein POST.');
  const form = new FormData();
  form.set('datei', new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }));
  form.set('meta', JSON.stringify(meta));
  const kopf: Record<string, string> = { 'x-make-user': person };
  const bau = bauKennung();
  if (bau) kopf[BAU_KOPF] = bau;
  const r = await modul.POST(new Request('http://demo.invalid/api/crm/dateien', { method: 'POST', headers: kopf, body: form }));
  const j = await r.json().catch(() => ({})) as { ok?: boolean; fehler?: string; eintrag?: { id: string } };
  if (!r.ok || !j.ok || !j.eintrag) throw new Error(`POST /api/crm/dateien → ${r.status}: ${j.fehler ?? ''}`);
  return j.eintrag.id;
}

export async function kreislaufSaen(k: KreislaufKontext): Promise<SaatSchritt[]> {
  const { lena: L, jonas: J, heute, rufe } = k;
  const R = KREISLAUF_ROUTEN;
  const jan = k.kontaktId('jan');

  // 1) Die zweite Person bei Nordwerk — Anlagetag heute, die Aktivität nicht davor (Regel `neuerLeadAm`, tests/zahlen-stimmigkeit.test.ts C8).
  await rufe(R.kontakte(), 'PATCH', '/api/state/kontakte', L, { ops: [{ op: 'upsert', eintrag: {
    id: jan, vorname: 'Jan', nachname: 'Kessler', email: `jan@${k.domain}`, position: 'Leitung Vertrieb', firma: NORDWERK, firmaId: KREISLAUF_FIRMA,
    stufe: 'gespraech', prio: 'A', eignung: 'ja', herkunft: 'Demo (erfunden)', besitzer: L,
    aktivitaeten: [{ am: new Date().toISOString(), art: 'gespraech', text: 'Gespräch (erfunden) — Diagnose für das zweite Werk besprochen.', von: L }],
  } }] });

  // 2) Angebot → gestellt → angenommen: die Mandat-Automatik legt Mandat + Liquiplan-Posten an (derselbe Weg wie der Knopf „Angenommen“).
  const d = k.diagnose;
  const entwurf = (await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'speichern', id: KREISLAUF_ANGEBOT, felder: {
    gesellschaft: 'ug', kontaktId: jan, firmaId: KREISLAUF_FIRMA, titel: 'Klarheits-Diagnose Werk Süd (Beispiel)',
    positionen: [{ id: 'p1', leistungId: d.id, titel: d.name, text: d.text, menge: 1, einheit: 'pauschal', einzelpreisCent: d.cent, ustSatz: 19, basis: 'einmalig' }],
    einleitung: 'wie besprochen die Diagnose für Ihr zweites Werk — zwei Wochen, zwei Workshops (Beispiel).',
    schluss: 'Wir freuen uns auf die Zusammenarbeit.', gueltigBis: tagPlus(heute, 21), zahlungszielTage: 14,
  } })).angebot as { id: string; stand: string };
  const gestellt = (await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'stellen', id: entwurf.id, stand: entwurf.stand, nachfassenAm: tagPlus(heute, 2) })).angebot as { id: string; stand: string };
  const an = await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'annehmen', id: gestellt.id, stand: gestellt.stand }) as { automatik?: { angelegt: boolean; mandatId?: string; grund?: string } };
  if (!an.automatik?.angelegt || !an.automatik.mandatId) throw new Error(`Mandat-Automatik hat kein Mandat angelegt: ${an.automatik?.grund ?? 'ohne Antwort'}`);
  const mandatSued = an.automatik.mandatId;
  //   2b) ein zweites angenommenes Angebot an Lumen — OHNE Rechnung und ohne Fall: an ihm lässt sich „Mandat + Liquiplan zurücknehmen“ zeigen.
  const paul = k.kontaktId('paul');
  const lumenEntwurf = (await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'speichern', id: KREISLAUF_ANGEBOT_RUECKGAENGIG, felder: {
    gesellschaft: 'ug', kontaktId: paul, firmaId: 'f-demo-lumen', titel: 'Klarheits-Diagnose Standort Ost (Beispiel)',
    positionen: [{ id: 'p1', leistungId: d.id, titel: d.name, text: d.text, menge: 1, einheit: 'pauschal', einzelpreisCent: d.cent, ustSatz: 19, basis: 'einmalig' }],
    einleitung: 'wie besprochen die Diagnose für Ihren Standort Ost (Beispiel).',
    schluss: 'Wir freuen uns auf die Zusammenarbeit.', gueltigBis: tagPlus(heute, 21), zahlungszielTage: 14,
  } })).angebot as { id: string; stand: string };
  const lumenGestellt = (await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'stellen', id: lumenEntwurf.id, stand: lumenEntwurf.stand, nachfassenAm: tagPlus(heute, 2) })).angebot as { id: string; stand: string };
  const lumenAn = await rufe(R.angebot(), 'POST', '/api/crm/angebot', L, { aktion: 'annehmen', id: lumenGestellt.id, stand: lumenGestellt.stand }) as { automatik?: { angelegt: boolean; grund?: string } };
  if (!lumenAn.automatik?.angelegt) throw new Error(`Mandat-Automatik (Lumen) hat kein Mandat angelegt: ${lumenAn.automatik?.grund ?? 'ohne Antwort'}`);

  // 3) Rechnungen — über die Rechnungs-Route (Nummer + PDF beim Stellen, Zahlungseingang mit Buchung in einer Sperre).
  const rechnung = (r: Record<string, unknown>) => r.rechnung as Rechnung;
  const neu = async (body: Record<string, unknown>) => rechnung(await rufe(R.rechnung(), 'POST', '/api/rechnung', L, { aktion: 'neu', ...body }));
  const stellen = async (r: Rechnung) => rechnung(await rufe(R.rechnung(), 'POST', '/api/rechnung', L, { aktion: 'stellen', id: r.id, stand: r.fassung }));
  //   a) aus dem neuen Mandat: gestellt und bezahlt (Vorkasse der Diagnose) — der ganze Weg Angebot → Mandat → Rechnung → Geld an EINEM Kunden.
  const sued = await stellen(await neu({ quelle: 'mandat', mandatId: mandatSued }));
  await rufe(R.rechnung(), 'POST', '/api/rechnung', L, { aktion: 'bezahlt', id: sued.id, stand: sued.fassung, am: heute });
  //   b) der Entwurf der Monatsrechnung des Retainers (so legt ihn der Morgenlauf „Rechnungen vorbereiten“ an) — Stellen bleibt ein Klick.
  await neu({ quelle: 'mandat', mandatId: 'm-demo-nordwerk' });
  //   c) eine gestellte, offene Monatsrechnung eines zweiten Kunden (Teilmonat anteilig — das Mandat begann vor wenigen Tagen).
  await stellen(await neu({ quelle: 'mandat', mandatId: 'm-demo-lumen' }));
  //   d) die Selbstständigkeit (Privat-Einheit): Absender gepflegt, eine frei geschriebene Rechnung an einen Kunden der Markttraktion.
  const abs = ((await rufe(R.absender(), 'GET', '/api/crm/gesellschaften', L)).gesellschaften as { id: string; stand?: string }[]).find(g => g.id === 'kdc');
  await rufe(R.absender(), 'PATCH', '/api/crm/gesellschaften', L, { id: 'kdc', ...(abs?.stand ? { stand: abs.stand } : {}), felder: {
    firmierung: `${finanzOrtName('kdc')} (Beispiel)`, strasse: 'Beispielgasse 5', plz: '33602', ort: 'Bielefeld', email: `beratung@${k.domain}`,
    steuernummer: '000/000/00001 (Beispiel)', bank: { inhaber: finanzOrtName('kdc'), bank: 'Beispielbank (Demo)', iban: k.iban },
  } });
  const frei = await neu({ quelle: 'frei', firmaId: 'kdc', kundeFirmaId: 'f-demo-kanzlei', vorlage: { titel: 'Moderation Strategietag (Beispiel)', bruttoCent: 95200 } });
  const freiTag = tagPlus(heute, -7);
  const freiFertig = rechnung(await rufe(R.rechnung(), 'POST', '/api/rechnung', L, { aktion: 'speichern', id: frei.id, stand: frei.fassung, felder: { leistungVon: freiTag, leistungBis: freiTag } }));
  await stellen(freiFertig);
  //   e) Altbestand ohne Zuordnung (eine frühere Rechnung, nur mit getipptem Kundennamen) — bezahlt, damit sie nichts mahnt; über den Bestand der
  //      Finanzplanung wie früher, „bezahlt“ über dessen Aktion (Status + Buchung in einer Sperre).
  const jahrStart = `${heute.slice(0, 4)}-01-01`;
  const altTag = tagPlus(heute, -120) < jahrStart ? jahrStart : tagPlus(heute, -120);
  await rufe(R.finanzplanBestand(), 'PATCH', '/api/state/finanzplan', L, { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: {
    id: KREISLAUF_ALT_RECHNUNG, kunde: 'Altkunde Beispiel KG', titel: 'Workshop (Altbestand, Beispiel)', betrag: 1190, netto: 1000, ustSatz: 19, status: 'gestellt',
    nummer: `ALT-${heute.slice(0, 4)}-017`, datum: altTag, faellig: tagPlus(altTag, 14), leistungVon: altTag, leistungBis: altTag, firmaId: 'ug',
  } }] });
  await rufe(R.finanzplanBestand(), 'PATCH', '/api/state/finanzplan', L, { aktion: 'bezahlt', rechnungId: KREISLAUF_ALT_RECHNUNG, am: tagPlus(altTag, 10) });

  // 4) Die große Akte: ein offener Folge-Deal (der vorige ist gewonnen), Aufgaben mit Bezug, ein Vertrag an der Firma, ein Termin mit Bezug.
  await rufe(R.deal(), 'POST', '/api/crm/deal', L, { aktion: 'anlegen', titel: 'Cockpit für Nordwerk (Beispiel)', firmaId: KREISLAUF_FIRMA, kontaktIds: [jan],
    art: 'software', wert: { betrag: 490, basis: 'monat', laufzeitMonate: 24 }, leistungId: 'l-demo-software', stufe: 'bedarf',
    schritt: { text: 'Cockpit-Demo für Werk Süd', datum: tagPlus(heute, 9) }, erwartetAm: tagPlus(heute, 50), gesellschaft: 'ug', quelle: 'netzwerk', besitzer: L });
  const aufgaben = [
    { title: 'Kick-off Diagnose Werk Süd vorbereiten', person: L, dueDate: tagPlus(heute, 3), priority: 'high', bezug: { firmaId: KREISLAUF_FIRMA, kontaktId: jan, mandatId: mandatSued } },
    { title: 'Rahmenvertrag Nordwerk gegenzeichnen lassen', person: J, dueDate: tagPlus(heute, 6), bezug: { firmaId: KREISLAUF_FIRMA, mandatId: 'm-demo-nordwerk' } },
  ];
  for (const { person, ...a } of aufgaben) await rufe(R.aufgabe(), 'POST', '/api/tasks/create', person, { ...a, space: 'business', einheit: k.einheit, description: 'Beispiel-Aufgabe (Demo).' });
  const pdf = await beispielPdf('Rahmenvertrag (Beispiel)', [NORDWERK, 'Erfundenes Beispiel-Dokument der Demo-Instanz.', 'Keine echten Vertragsinhalte.']);
  await dateiAblegen(L, 'Rahmenvertrag Nordwerk (Beispiel).pdf', pdf, {
    art: 'vertrag', titel: 'Rahmenvertrag (Beispiel)', firmaId: KREISLAUF_FIRMA, vertrag: { vertragsart: 'rahmen', von: tagPlus(heute, -46), kuendigungsfrist: '3 Monate zum Quartalsende' },
  });
  const [{ updateJson }, { bezugSetzen }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/kalender/bezug-server')]);
  const kickoff = tagPlus(heute, 4);
  const terminId = `demo-kreislauf-kickoff-sued`;
  await updateJson<{ events?: Record<string, unknown>[]; at?: string }>('calendar-cache', cur => ({ ...(cur ?? {}), events: [...(cur?.events ?? []).filter(e => e.id !== terminId),
    { id: terminId, title: 'Kick-off Diagnose Werk Süd', startDate: `${kickoff}T10:00:00`, endDate: `${kickoff}T11:30:00`, allDay: false, calendarName: 'Arbeit', location: 'Bielefeld' }] }));
  await bezugSetzen(terminId, { firmaId: KREISLAUF_FIRMA, kontaktId: jan, mandatId: mandatSued, tag: kickoff, art: 'termin', von: L });

  return [
    { name: 'Kreislauf: Angebot angenommen → Mandat + Liquiplan', anzahl: 2 },
    { name: 'Kreislauf: Rechnungen (Entwurf, gestellt, bezahlt, Selbstständigkeit, ohne Zuordnung)', anzahl: 5 },
    { name: 'Große Akte (Person, Deal, Aufgaben, Vertrag, Termin)', anzahl: 1 + 1 + aufgaben.length + 1 + 1 },
  ];
}
