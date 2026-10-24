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
import { prozess, S, B, EIGNER } from './kundengewinnung/bau';
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
    case 'fall-vorschlag':
      // Ausbau (24.10., Paket Ü 2): Fall-Art „Deal“ für den zweiten Auslöser (Deal gewonnen → der Rest der Übergabe aus kg-v12); der Kern startet weiter ohne Fall
      // nach dem Morgen-Loop. „Fall starten“ ist der Kern (nicht doppelt), Willkommen und Kick-off führt der Fall.
      return prozess({
        id: 'ue-fall-vorschlag', titel: u.titel, bereich: 'uebergabe', fallArt: 'deal', zettel: zettel(u),
        beschreibung: `${u.satz} ${u.zusatz?.satz ?? ''}`.trim(),
        startKriterium: 'Jeden Morgen nach dem Morgen-Loop (Tagesstart) — einmal am Tag, wie bisher der Morgenlauf des Fulfillments; dazu (neu) sobald ein Business-Deal gewonnen ist.',
        endKriterium: 'Für jeden neuen Kunden ohne Fall liegt ein Vorschlag „Fall starten“ im Stapel (gestartet wird per Klick); ein gewonnener Deal hat Mandat und Übergabe-Aufgabe.',
        // Zwei Auslöser in EINER Phase (Zweige bleiben in ihrer Phase); die Raute trennt die Wege: mit einem gewonnenen Deal der Hauptstrang der neuen Übergabe (wie
        // kg-v12), ohne Deal (Morgen-Loop, kein Fall) der Kern als Seitenzweig am Ende (springt in sein eigenes Ziel).
        phasen: [
          { titel: 'Onboarding und Übergabe', schritte: [
            S.loop('t', 'Nach dem Morgen-Loop', 'morgen'), S.ereignis('t2', 'Deal gewonnen (neu)', 'deal-stufe', [B.ist('ereignis.stufe', 'gewonnen')]),
            S.regel('r0', 'Ein gewonnener Deal?', [B.gesetzt('deal.stufe')], { zweige: { nein: 'f' } }),
            S.regel('a1', 'Mandat schon da?', [B.ist('deal.mandat-da', true)], { zweige: { nein: 'a2' } }),
            S.mandat('a2', 'Mandat anlegen (Vorschlag)', { schloss: { nein: 'a2g' } }),
            S.glocke('a2g', 'Mandat abgelehnt', 'Das Mandat zum gewonnenen Deal wurde nicht angelegt — bitte ansehen.', EIGNER, { zweige: { ja: 'e0' } }),
            S.aufgabe('a3', 'Übergabe vervollständigen', { titel: 'Übergabe vervollständigen (acht Blöcke)', fristTage: 2, prioritaet: 'high', beschreibung: 'Kunde · Umfang · Zeit · Geld · Personal · Risiken · Erwartungen · Kickoff.' }),
            S.regel('a4', 'Vertrag unterschrieben?', [B.ist('deal.vertrag-unterschrieben', true)], { zweige: { nein: 'a4v' } }),
            S.aufgabe('a4v', 'Vertrag unterschreiben lassen', { titel: 'Vertrag unterschreiben lassen', fristTage: 5, prioritaet: 'high' }),
            S.ziel('e2', 'Übergabe vorbereitet — der Fall startet über den Vorschlag'),
            S.abbruch('e0', 'Ohne Mandat beendet'),
            // Der Kern als Seitenzweig der Raute (ohne Deal): danach gleich ins eigene Ziel.
            S.fest('f', 'Onboarding-Vorschläge legen', 'fall-vorschlag', { zweige: { ja: 'e' } }),
            S.ziel('e', 'Vorschläge liegen im Stapel'),
          ] },
        ],
      });
    case 'power-hour':
      // 24.10. (Paket Ü 2): der Auslöser „je Person“ nimmt die Uhrzeit aus DERSELBEN Stellschraube wie der Takt der Heads (`head.sales.power_hour.stunde` — eine
      // Wahrheit), Mo–Fr wie der Takt (Feiertage zählen mit), bis 22 Uhr und erst nach dem Morgenlauf (wie alle Heads). An/aus prüft der feste Schritt.
      return prozess({
        id: 'ue-power-hour', titel: u.titel, bereich: 'sales', fallArt: 'keiner', zettel: zettel(u),
        beschreibung: u.satz,
        startKriterium: 'Je Person des Teams an Arbeitstagen ab der Uhrzeit der Power Hour (Stellschraube des Head of Sales), nach dem Morgenlauf — einmal am Tag; Business-frei kommt sie danach.',
        endKriterium: 'Für jede Person ist die Power Hour des Tages beim Head of Sales in Auftrag (bzw. schon vorbereitet).',
        phasen: [{ titel: 'Power Hour', schritte: [
          S.person('t', 'Je Person ab der Uhrzeit der Power Hour', { uhrzeit: '07:00', bis: '22:00', tage: 'mo-fr', nachMorgenlauf: true, stundeAus: 'head.sales.power_hour.stunde' }),
          S.fest('f', 'Power Hour vorbereiten', 'power-hour'), S.ziel('e', 'Power Hour in Auftrag'),
        ] }],
      });
    case 'nachfass-lage':
    case 'nachfass-followups':
      // 24.10. (Paket Ü 2, „Als neuen Ablauf bauen“): der Kern ist abgeleitet (Glocke, Quote) — der feste Schritt sieht dieselbe Lage und schreibt nichts; neu sind
      // die Follow-ups und die Frist-Glocke (nach kg-v04, ohne Danke-Entwurf im Stapel — die Danke-Mails bleiben in Netzwerken › Heute, sonst doppelt).
      return prozess({
        id: 'ue-nachfass-lage', titel: u.titel, bereich: 'marketing', fallArt: 'event', zettel: zettel(u),
        beschreibung: `${u.satz} ${u.zusatz?.satz ?? ''}`.trim(),
        startKriterium: 'Am Tag nach einem besuchten Event (Netzwerken), 08:00 — nicht bei abgesagten Events.',
        endKriterium: 'Jede Erfassung ist nachgefasst, hat ein Follow-up oder ist bewusst ohne Nachfassen; nach zwei Werktagen ist die Quote geprüft.',
        phasen: [
          { titel: 'Lage', schritte: [
            S.datum('t', 'Am Tag nach dem Event, 08:00', 'event.datum', 1, '08:00', false, [B.ist('event.besucht', true), B.nicht('event.status', 'abgesagt')]),
            S.fest('f', 'Nachfass-Lage (Danke-Glocke)', 'nachfass-lage'),
          ] },
          { titel: 'Nachfassen sichern (neu)', schritte: [
            S.fest('n1', 'Follow-ups sichern', 'nachfass-followups'),
            S.wartenDauer('n2', 'Zwei Werktage', 2, { arbeitszeit: true }),
            S.regel('n3', 'Quote erreicht?', [B.groesser('event.quote-48h', 79), B.leer('event.quote-48h')], { oder: true, zweige: { nein: 'n4' } }),
            S.glocke('n4', 'Quote unter dem Ziel', 'Beim Nachfassen eines Events ist die Quote unter dem Ziel.', EIGNER),
            S.ziel('e', 'Event nachgefasst'),
          ] },
        ],
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
