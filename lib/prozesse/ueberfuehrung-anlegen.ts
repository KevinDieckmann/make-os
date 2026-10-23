// ─── Prozesse · Überführung — „In die Werkstatt überführen“: der neue Prozess aus der passenden Vorlage (rein, client-sicher; 22.10., Paket Ü) ─────────────
// Je Teil der festen Liste (`UEBERFUEHRBAR`) eine Vorlage: Auslöser wie der alte Einstiegspunkt (Mahnaufgaben und Report liefen im Morgenlauf — der neue Prozess
// startet „nach dem Morgen-Loop“, derselbe Tagesstart), der feste Schritt (`system.fest`), Ziel. Angelegt wird wie „Aus Vorlage“ (neue Kennungen über
// `mitNeuenKennungen`, Version 1, Probelauf) — dazu `ersetzt` und die Phase „Schatten“: der alte Weg arbeitet weiter, der neue rechnet nur mit.
// Stellschrauben: die Werte dieser Teile (Mahnstufen, Abstand der Reports) lesen auch andere Stellen (Rechnungen & Zahlungen zeigt die Mahnvorschläge, Hänger
// und Zeitachse den Report-Abstand) — sie bleiben EINE Wahrheit in ihrem Bestand, der feste Schritt liest sie dort (der Steckbrief sagt es). Nie eine Kopie.

import { PROZESS_GRENZEN, type Befund, type ProzessDefinition, type ProzessEintrag, type ProzesseDatei } from './definition';
import { definitionPruefen, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from './definition-pruefen';
import { veroeffentlichen } from './versionen';
import { mitNeuenKennungen } from './kundengewinnung/uebernehmen';
import { prozess, S } from './kundengewinnung/bau';
import type { ProzessRechte } from './rollen';
import { ersetzerVon, leererVergleich, ueberfuehrbarVon, type UeberfuehrbarDef } from './ueberfuehrung';

const zettel = (u: UeberfuehrbarDef): string =>
  `Überführt aus dem System-Prozess: der feste Schritt „${u.teil}“ nimmt dieselbe Regel und dieselben Kennungen wie der Code. Zuerst im Schatten — umgeschaltet wird per Klick, wenn beide Wege dasselbe tun. Angehalten arbeitet wieder der alte Weg. ${u.bleibt}`;

/** Die Vorlage eines Teils (rein) — Kennungen `ue-<schritt>:…`, „Übernehmen“ vergibt neue. */
export function ueberfuehrungsVorlage(u: UeberfuehrbarDef): ProzessDefinition {
  switch (u.schritt) {
    case 'mahnaufgaben':
      return prozess({
        id: 'ue-mahnaufgaben', titel: u.titel, bereich: 'unterstuetzung', fallArt: 'keiner', zettel: zettel(u),
        beschreibung: u.satz,
        startKriterium: 'Jeden Morgen nach dem Morgen-Loop (Tagesstart) — einmal am Tag, wie bisher der Morgenlauf.',
        endKriterium: 'Für jede fällige Mahnstufe einer Rechnung der Business-Gesellschaften steht eine Aufgabe.',
        phasen: [{ titel: 'Mahnen', schritte: [S.loop('t', 'Nach dem Morgen-Loop', 'morgen'), S.fest('f', 'Mahnaufgaben anlegen', 'mahnaufgaben'), S.ziel('e', 'Aufgaben stehen')] }],
      });
    case 'treppe-report':
      return prozess({
        id: 'ue-treppe-report', titel: u.titel, bereich: 'ausbau', fallArt: 'keiner', zettel: zettel(u),
        beschreibung: u.satz,
        startKriterium: 'Jeden Morgen nach dem Morgen-Loop (Tagesstart) — einmal am Tag, wie bisher der Morgenlauf.',
        endKriterium: 'Für jedes Mandat, dessen Report dran ist, liegt ein Vorschlag im Stapel (gesendet wird per Klick).',
        phasen: [{ titel: 'Report', schritte: [S.loop('t', 'Nach dem Morgen-Loop', 'morgen'), S.fest('f', 'Report-Vorschläge legen', 'treppe-report'), S.ziel('e', 'Vorschläge liegen im Stapel')] }],
      });
  }
}

export interface UeberfuehrenKontext {
  person: string; jetzt: string; rechte: ProzessRechte;
  neueKennung: (praefix: 'pz' | 'fk') => string;
  /** Eigner (Team-Kennung) — die Person, die überführt, sofern sie im Team steht; ohne bleibt er offen (umgeschaltet wird dann erst mit Eigner). */
  eigner?: string;
  pruef?: PruefKontext;
}
export type UeberfuehrenErgebnis =
  | { ok: true; datei: ProzesseDatei; eintrag: ProzessEintrag; befunde: Befund[]; hinweise: string[]; probelauf: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; prozessId?: string; befunde?: Befund[] };

/**
 * Überführen (rein, alles oder nichts): nur volle Mitglieder (403), nur ein Teil der festen Liste (404), höchstens EIN Prozess je `sp-…` (409 mit seiner Kennung),
 * Grenze (413). Neuer Prozess aus der Vorlage mit `ersetzt` + Phase „Schatten“; Version 1 und Probelauf, wenn nichts offen ist — der Schatten beginnt sofort.
 */
export function ueberfuehrungAnlegen(datei: ProzesseDatei, sp: unknown, kx: UeberfuehrenKontext): UeberfuehrenErgebnis {
  if (!kx.rechte.status || !kx.rechte.veroeffentlichen) return { ok: false, status: 403, fehler: 'In die Werkstatt überführen dürfen volle Mitglieder des Haushalts.' };
  const u = typeof sp === 'string' ? ueberfuehrbarVon(sp) : null;
  if (!u) return { ok: false, status: 404, fehler: 'Diesen System-Prozess gibt es nicht bzw. er lässt sich (noch) nicht überführen.' };
  const da = ersetzerVon(datei.prozesse, u.sp);
  if (da) return { ok: false, status: 409, fehler: `„${u.teil}“ ist schon überführt — der Prozess steht in der Werkstatt.`, prozessId: da.id };
  if (datei.prozesse.length >= PROZESS_GRENZEN.prozesse) return { ok: false, status: 413, fehler: `Höchstens ${PROZESS_GRENZEN.prozesse} Prozesse — nichts angelegt.` };
  const vorlage = ueberfuehrungsVorlage(u);
  const id = kx.neueKennung('pz');
  const { definition } = mitNeuenKennungen(vorlage, { id, neu: () => kx.neueKennung('fk'), teil: {}, uebergabe: () => null, eigner: kx.eigner, person: kx.person, jetzt: kx.jetzt, vorlage: vorlage.id });
  const befunde = definitionPruefen(definition, kx.pruef ?? {});
  if (sperrtSpeichern(befunde)) return { ok: false, status: 400, fehler: befunde.find(b => b.stufe === 'fehler')?.text ?? 'Die Vorlage ist nicht speicherbar.', befunde };
  let e: ProzessEintrag = {
    id, entwurf: definition, versionen: [], status: 'entwurf', angelegtAm: kx.jetzt, angelegtVon: kx.person, entwurfAm: kx.jetzt, entwurfVon: kx.person,
    ersetzt: u.sp, ueberfuehrung: { phase: 'schatten', seit: kx.jetzt, vergleich: leererVergleich() },
  };
  const hinweise: string[] = [];
  let probelauf = false;
  if (!sperrtVeroeffentlichen(befunde)) {
    const v = veroeffentlichen(e, { name: 'Überführt', notiz: `Überführt aus dem System-Prozess (${u.teil}) — zuerst im Schatten.`, von: kx.person, jetzt: kx.jetzt });
    if (v.ok) { e = { ...v.eintrag, status: 'probelauf', statusAm: kx.jetzt, statusVon: kx.person }; probelauf = true; }
  }
  if (!probelauf) hinweise.push('Noch offen — erst diese Punkte erledigen, dann veröffentlichen: der Schatten beginnt mit dem Probelauf.');
  if (!kx.eigner) hinweise.push('Noch ohne Eigner — im Steckbrief eine Person aus dem Team wählen (umgeschaltet wird erst mit Eigner).');
  return { ok: true, datei: { ...datei, prozesse: [...datei.prozesse, e] }, eintrag: e, befunde, hinweise, probelauf };
}
