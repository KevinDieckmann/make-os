// ─── MAKE OS — Demo-Instanz: Fulfillment · Kunde (C2, 10.10.; FULFILLMENT_KONZEPT.md 12.7) ─────────────────────────────────────────────────────────
// Kunden-Link-Schalter bleibt AUS (die Vorschau „So sieht der Kunde es“ ist trotzdem sichtbar), ein ausgefülltes Playbook (gemeinsam im Kick-off,
// `formular-intern`) und zwei Puls-Werte (8 und 5) — alles über die Routen, erfunden und neutral. Ohne Fall (Paket C1 nicht da) gibt es kein Formular:
// dann nur die Puls-Werte. Kein Link wird angelegt (der Schalter ist aus) — also auch kein Token.

import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';

/** Erfundene Antworten je Frage-Art — keine Namen, keine Beträge. */
const ANTWORT: Record<string, string> = {
  text: 'Wir verkaufen Wartungsverträge für Maschinen an mittelständische Betriebe.',
  langtext: 'Heute kommen die meisten Aufträge über Empfehlungen. Wir wollen planbar neue Termine gewinnen und den Weg vom Erstgespräch zum Auftrag verkürzen.',
  zahl: '12',
  'ja-nein': 'ja',
};

export async function kundeSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const pfad = '/api/fulfillment/kunde';
  let antworten = 0;
  const [erstes, zweites] = k.mandate;
  if (erstes) {
    const stand = await k.rufe(k.routen.kunde(), 'GET', `${pfad}?m=${encodeURIComponent(erstes.id)}`, k.inhaber);
    const formulare = (stand.formulare ?? []) as { bausteinId: string; stand: string; abschnitte: { schluessel: string; fragen: { id: string; art: string; optionen?: string[] }[] }[] }[];
    const f = formulare[0];
    if (f) {
      let aktuell = f.stand;
      for (const a of f.abschnitte) {
        const werte = Object.fromEntries(a.fragen.map(q => [q.id, q.art === 'auswahl' ? q.optionen?.[0] ?? '' : ANTWORT[q.art] ?? ANTWORT.text]));
        const r = await k.rufe(k.routen.kunde(), 'POST', pfad, k.inhaber, { aktion: 'formular-intern', mandatId: erstes.id, bausteinId: f.bausteinId, antworten: werte, stand: aktuell, abschnitt: a.schluessel, fertig: true });
        aktuell = String(r.stand ?? aktuell);
        antworten += a.fragen.length;
      }
    }
    await k.rufe(k.routen.kunde(), 'POST', pfad, k.inhaber, { aktion: 'puls-hand', mandatId: erstes.id, wert: 8, satz: 'Die Termine sind gut vorbereitet.' });
  }
  const zweiter = zweites ?? erstes;
  if (zweiter) await k.rufe(k.routen.kunde(), 'POST', pfad, k.mitglied, { aktion: 'puls-hand', mandatId: zweiter.id, wert: 5, satz: 'Die Datenanbindung hakt noch.' });
  return [{ name: 'Fulfillment · Playbook-Antworten (Kunden-Link aus)', anzahl: antworten }, { name: 'Fulfillment · Kunden-Puls', anzahl: zweiter ? 2 : 0 }];
}
