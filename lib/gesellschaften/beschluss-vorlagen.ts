// ─── Unternehmen › Beschlüsse & Satzung: Startvorlagen für typische Beschlüsse (rein, client-sicher, 10.10.) ───────────────────────────
// Neutral, mit Platzhaltern — gefüllt wird nur, was im Register steht (Firmierung, Sitz, Register, Geschäftsführung, Stammkapital, Geschäftsjahr:
// dieselbe Füllung wie die Vorlagen-Bibliothek des Schilds, lib/gesellschaften/schild/vorlagen.ts `platzhalter`), alles andere bleibt „[…]“.
// Keine Namen, keine Firmen, keine Beträge im Code. Hinweis vorne: keine Rechtsberatung, vor Verwendung prüfen. Was das Schild schon als Mustertext
// führt (allgemeiner Gesellschafterbeschluss, Feststellung des Jahresabschlusses), wird von dort übernommen — nichts doppelt.

import { LUECKE, VORLAGE_HINWEIS, platzhalter, vorlageVon } from './schild/vorlagen';
import type { BeschlussArt, BeschlussAenderung, Gremium, RegisterGesellschaft, SatzungMerkmal } from './modell';

export const BESCHLUSS_VORLAGE_HINWEIS = `${VORLAGE_HINWEIS} Vor Verwendung prüfen.`;

export interface BeschlussVorlage {
  id: string;
  titel: string;
  art: BeschlussArt;
  gremium?: Gremium;
  /** Ein Satz: wofür. */
  wofuer: string;
  norm: string;
  /** Was der Beschluss strukturiert ändert — die Änderung startet leer bzw. mit dem Wert aus dem Register (zum Überschreiben). */
  aenderung?: SatzungMerkmal;
  /** Eigener Text — oder `aus` = Kennung einer Vorlage des Schilds (eine Quelle). */
  text?: string;
  aus?: string;
}

const KOPF = `GESELLSCHAFTERBESCHLUSS
der {{firma}}, Sitz: {{sitz}}, eingetragen im Handelsregister {{register}}

Die Gesellschafter halten zusammen sämtliche Geschäftsanteile (Stammkapital {{stammkapital}}). Unter Verzicht auf alle Form- und Fristvorschriften für die Einberufung und Abhaltung einer Gesellschafterversammlung beschließen sie:`;
const FUSS = `Abstimmung: ${LUECKE} Ja-Stimmen, ${LUECKE} Nein-Stimmen, ${LUECKE} Enthaltungen.

{{ort}}, den {{datum}}

______________________________   ______________________________
(Gesellschafter/in)               (Gesellschafter/in)`;

/** Die Startvorlagen. Kennungen nie ändern (der Beschluss merkt sich, aus welcher Vorlage er kommt). */
export const BESCHLUSS_VORLAGEN: readonly BeschlussVorlage[] = [
  { id: 'allgemein', titel: 'Gesellschafterbeschluss (allgemein)', art: 'gesellschafterbeschluss', gremium: 'gesellschafterversammlung', norm: '§§ 46–48 GmbHG', wofuer: 'Ein Beschluss ohne Versammlung bzw. mit Verzicht auf Form und Frist.', aus: 'gesellschafterbeschluss' },
  { id: 'einpersonen', titel: 'Niederschrift Einpersonen-Gesellschaft', art: 'gesellschafterbeschluss', gremium: 'alleingesellschafter', norm: '§ 48 Abs. 3 GmbHG', wofuer: 'Alle Anteile in einer Hand: jeden Beschluss unverzüglich niederschreiben und unterschreiben.', aus: 'niederschrift-einpersonen' },
  { id: 'umlauf', titel: 'Umlaufbeschluss (schriftlich)', art: 'umlaufbeschluss', gremium: 'gesellschafterversammlung', norm: '§ 48 Abs. 2 GmbHG', wofuer: 'Beschluss im schriftlichen Verfahren — alle Gesellschafter müssen mit dieser Form einverstanden sein.',
    text: `UMLAUFBESCHLUSS
der {{firma}}, Sitz: {{sitz}}, Handelsregister {{register}}

Die Gesellschafter fassen im schriftlichen Verfahren (§ 48 Abs. 2 GmbHG) folgenden Beschluss; sie sind mit der Stimmabgabe in Textform einverstanden:

1. ${LUECKE}

Die Stimmabgabe ist bis ${LUECKE} an die Geschäftsführung ({{geschaeftsfuehrung}}) zurückzusenden. Der Beschluss gilt mit Eingang der letzten erforderlichen Stimme als gefasst.

{{ort}}, den {{datum}}` },
  { id: 'gegenstand', titel: 'Satzungsänderung: Gegenstand des Unternehmens', art: 'satzungsaenderung', gremium: 'gesellschafterversammlung', norm: '§§ 53, 54 GmbHG', aenderung: 'gegenstand', wofuer: 'Neuer Unternehmensgegenstand — notariell beurkunden, zum Handelsregister anmelden; wirksam erst mit Eintragung.',
    text: `${KOPF}

1. § ${LUECKE} des Gesellschaftsvertrags (Gegenstand des Unternehmens) wird wie folgt neu gefasst:
   „Gegenstand des Unternehmens ist ${LUECKE}.“
2. Die Geschäftsführung wird beauftragt, die Änderung zur Eintragung in das Handelsregister anzumelden.

Hinweis: Die Satzungsänderung bedarf der notariellen Beurkundung (§ 53 Abs. 2 GmbHG) und wird erst mit der Eintragung wirksam (§ 54 Abs. 3 GmbHG).

${FUSS}` },
  { id: 'sitz', titel: 'Satzungsänderung: Sitzverlegung', art: 'satzungsaenderung', gremium: 'gesellschafterversammlung', norm: '§§ 4a, 53, 54 GmbHG', aenderung: 'sitz', wofuer: 'Neuer satzungsmäßiger Sitz — notariell beurkunden, anmelden, Gewerbe und Finanzamt ummelden.',
    text: `${KOPF}

1. Der Sitz der Gesellschaft wird von {{sitz}} nach ${LUECKE} verlegt. § ${LUECKE} des Gesellschaftsvertrags wird entsprechend geändert.
2. Die Geschäftsführung wird beauftragt, die Änderung zur Eintragung anzumelden und Gewerbeamt sowie Finanzamt zu informieren.

${FUSS}` },
  { id: 'kapitalerhoehung', titel: 'Kapitalerhöhung', art: 'kapitalmassnahme', gremium: 'gesellschafterversammlung', norm: '§§ 53, 55, 57 GmbHG', aenderung: 'stammkapital', wofuer: 'Stammkapital erhöhen — Übernahme der neuen Anteile, Einlage, notarielle Beurkundung und Anmeldung.',
    text: `${KOPF}

1. Das Stammkapital der Gesellschaft wird von {{stammkapital}} um ${LUECKE} auf ${LUECKE} erhöht.
2. Es werden ${LUECKE} neue Geschäftsanteile im Nennbetrag von je ${LUECKE} gebildet. Zur Übernahme zugelassen wird ${LUECKE}.
3. Die Einlagen sind ${LUECKE} (in bar / als Sacheinlage) zu leisten, fällig ${LUECKE}.
4. § ${LUECKE} des Gesellschaftsvertrags (Stammkapital) wird entsprechend geändert.
5. Die Geschäftsführung meldet die Kapitalerhöhung nach Leistung der Einlagen zur Eintragung an und reicht eine neue Gesellschafterliste ein (§ 40 GmbHG).

${FUSS}` },
  { id: 'gf-bestellung', titel: 'Bestellung einer Geschäftsführung', art: 'gf-bestellung', gremium: 'gesellschafterversammlung', norm: '§ 46 Nr. 5, § 39 GmbHG', aenderung: 'geschaeftsfuehrung', wofuer: 'Neue Geschäftsführerin oder neuer Geschäftsführer — Bestellung, Vertretung, Anmeldung zum Handelsregister.',
    text: `${KOPF}

1. Zur Geschäftsführerin / zum Geschäftsführer wird mit Wirkung ab ${LUECKE} bestellt: ${LUECKE} (Name, Geburtsdatum, Wohnort).
2. Vertretung: ${LUECKE} (einzeln / gemeinsam mit einer weiteren Geschäftsführung bzw. einem Prokuristen). Befreiung von § 181 BGB: ${LUECKE} (erteilt / nicht erteilt).
3. Die Geschäftsführung wird beauftragt, die Bestellung zur Eintragung in das Handelsregister anzumelden.

${FUSS}` },
  { id: 'gf-abberufung', titel: 'Abberufung einer Geschäftsführung', art: 'gf-bestellung', gremium: 'gesellschafterversammlung', norm: '§ 38, § 46 Nr. 5, § 39 GmbHG', aenderung: 'geschaeftsfuehrung', wofuer: 'Eine Geschäftsführung abberufen — Anmeldung, Vollmachten und Zugänge prüfen; der Anstellungsvertrag ist davon getrennt.',
    text: `${KOPF}

1. ${LUECKE} wird mit Wirkung zum ${LUECKE} als Geschäftsführerin / Geschäftsführer abberufen.
2. ${LUECKE} (Entlastung für den Zeitraum bis ${LUECKE} / keine Entlastung).
3. Die Geschäftsführung wird beauftragt, die Änderung zur Eintragung anzumelden. Über den Anstellungsvertrag wird gesondert entschieden.

${FUSS}` },
  { id: 'jahresabschluss', titel: 'Feststellung Jahresabschluss, Gewinnverwendung, Entlastung', art: 'jahresabschluss', gremium: 'gesellschafterversammlung', norm: '§ 42a, § 46 Nr. 1 und 5 GmbHG', wofuer: 'Jahreszyklus: Abschluss feststellen, Ergebnis verwenden, Geschäftsführung entlasten.', aus: 'feststellung-ja' },
  { id: 'gewinnverwendung', titel: 'Gewinnverwendung (Ausschüttung)', art: 'gewinnverwendung', gremium: 'gesellschafterversammlung', norm: '§ 29, § 46 Nr. 1 GmbHG; § 5a Abs. 3 GmbHG (UG)', wofuer: 'Über die Verwendung eines festgestellten Ergebnisses entscheiden — Ausschüttung, Vortrag oder Rücklage.',
    text: `${KOPF}

1. Vom Jahresergebnis des Geschäftsjahres {{geschaeftsjahr}} (festgestellt am ${LUECKE}) werden ${LUECKE} an die Gesellschafter im Verhältnis ihrer Geschäftsanteile ausgeschüttet, fällig ${LUECKE}.
2. Der verbleibende Betrag von ${LUECKE} wird ${LUECKE} (auf neue Rechnung vorgetragen / in die Rücklagen eingestellt).
   Nur UG (haftungsbeschränkt): Ein Viertel des um einen Verlustvortrag geminderten Jahresüberschusses wird in die gesetzliche Rücklage eingestellt (§ 5a Abs. 3 GmbHG).

Hinweis: Auszahlungen nur, soweit das zur Erhaltung des Stammkapitals erforderliche Vermögen nicht angegriffen wird (§ 30 GmbHG); Kapitalertragsteuer beachten.

${FUSS}` },
  { id: 'gf-beschluss', titel: 'Beschluss der Geschäftsführung', art: 'gf-beschluss', gremium: 'geschaeftsfuehrung', norm: '§ 37 GmbHG; Geschäftsordnung', wofuer: 'Eine Entscheidung der Geschäftsführung festhalten — mit Grundlage, Alternativen und Begründung.',
    text: `BESCHLUSS DER GESCHÄFTSFÜHRUNG
{{firma}} — {{datum}}

Die Geschäftsführung ({{geschaeftsfuehrung}}) beschließt:

1. ${LUECKE}

Grundlage der Entscheidung: ${LUECKE}
Geprüfte Alternativen: ${LUECKE}
Zustimmung der Gesellschafterversammlung erforderlich: ja / nein (${LUECKE})

{{ort}}, den {{datum}}

______________________________
Geschäftsführung` },
];

export const beschlussVorlageVon = (id: string) => BESCHLUSS_VORLAGEN.find(v => v.id === id);

/**
 * Ein Beschluss-Entwurf aus einer Vorlage (rein): Art, Gremium, Titel, Inhalt (Platzhalter gefüllt, Unbekanntes „[…]“, Hinweis vorne) und — bei
 * Vorlagen mit Änderung — eine leere Änderung (bzw. der heutige Wert als Ausgangspunkt beim Kapital). Status bleibt „Entwurf“.
 */
export function beschlussAusVorlage(v: BeschlussVorlage, g: RegisterGesellschaft, heute: string): { art: BeschlussArt; gremium?: Gremium; titel: string; inhalt: string; aenderungen: BeschlussAenderung[]; vorlage: string } {
  const p = platzhalter(g, heute);
  const roh = v.aus ? vorlageVon(v.aus)?.text ?? '' : v.text ?? '';
  const text = roh.replace(/\{\{([a-z]+)\}\}/g, (_, k: string) => (p[k] ? p[k] : LUECKE));
  const aenderungen: BeschlussAenderung[] = v.aenderung ? [{ merkmal: v.aenderung, ...(v.aenderung === 'stammkapital' && typeof g.stammkapitalCent === 'number' ? { cent: g.stammkapitalCent } : {}) }] : [];
  return { art: v.art, ...(v.gremium ? { gremium: v.gremium } : {}), titel: v.titel, inhalt: `${BESCHLUSS_VORLAGE_HINWEIS}\n\n${text}\n`, aenderungen, vorlage: v.id };
}
