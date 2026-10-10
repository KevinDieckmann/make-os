// ─── Unternehmen › Schild: Vorlagen-Bibliothek → Entwurf je Gesellschaft (rein, client-sicher, 10.10.) ──────────────────
// Research › 6 A5/A7 und Grenze 6a: regelbasierte Mustertexte („Formularbuch“) mit Platzhaltern — KEIN Modell, keine Einzelfallprüfung,
// nichts verlässt das System (Entwurf liegt verschlüsselt im Business-Bestand des Haushalts; kopieren/drucken macht der Mensch).
// Gefüllt wird nur, was im Gesellschafts-Register steht (Firmierung, Sitz, Register, Geschäftsführung, Stammkapital, Geschäftsjahr);
// alles andere bleibt „[…]“ zum Ausfüllen. Keine Namen, keine Beträge im Code.

import { anzeigeName, euroText, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { tagText } from './zeit';

export const VORLAGE_HINWEIS = 'Mustertext zum Ausfüllen — keine Rechtsberatung. Passt ihn an euren Fall an und lasst wesentliche Verträge und Beschlüsse anwaltlich prüfen.';
export const LUECKE = '[…]';

export interface Vorlage {
  id: string;
  titel: string;
  /** Wofür — ein Satz. */
  wofuer: string;
  /** Nur für Gesellschaften mit Gesellschafterversammlung (GmbH/UG). */
  nurKapital?: true;
  norm: string;
  text: string;
}

export const VORLAGEN: readonly Vorlage[] = [
  {
    id: 'gesellschafterbeschluss', titel: 'Gesellschafterbeschluss (allgemein)', nurKapital: true, norm: '§§ 46–48 GmbHG',
    wofuer: 'Ein Beschluss außerhalb einer Versammlung bzw. mit Verzicht auf Form und Frist.',
    text: `GESELLSCHAFTERBESCHLUSS
der {{firma}}, Sitz: {{sitz}}, eingetragen im Handelsregister {{register}}

Die Gesellschafter der Gesellschaft halten zusammen sämtliche Geschäftsanteile (Stammkapital {{stammkapital}}). Unter Verzicht auf alle Form- und Fristvorschriften für die Einberufung und Abhaltung einer Gesellschafterversammlung beschließen sie einstimmig:

1. ${LUECKE} (Gegenstand des Beschlusses)
2. ${LUECKE}

Abstimmung: ${LUECKE} Ja-Stimmen, ${LUECKE} Nein-Stimmen, ${LUECKE} Enthaltungen.

{{ort}}, den {{datum}}

______________________________   ______________________________
(Gesellschafter/in)               (Gesellschafter/in)`,
  },
  {
    id: 'niederschrift-einpersonen', titel: 'Niederschrift Einpersonen-Gesellschaft', nurKapital: true, norm: '§ 48 Abs. 3 GmbHG',
    wofuer: 'Pflicht, wenn alle Anteile in einer Hand liegen: jeden Beschluss unverzüglich niederschreiben und unterschreiben.',
    text: `NIEDERSCHRIFT ÜBER EINEN GESELLSCHAFTERBESCHLUSS (§ 48 Abs. 3 GmbHG)
{{firma}}, Sitz: {{sitz}}, Handelsregister {{register}}

Der alleinige Gesellschafter / die alleinige Gesellschafterin hält sämtliche Geschäftsanteile (Stammkapital {{stammkapital}}) und fasst unter Verzicht auf alle Form- und Fristvorschriften folgenden Beschluss:

${LUECKE}

Der Beschluss wurde am {{datum}} gefasst und unverzüglich niedergeschrieben.

{{ort}}, den {{datum}}

______________________________
(alleinige/r Gesellschafter/in)`,
  },
  {
    id: 'feststellung-ja', titel: 'Feststellung Jahresabschluss und Gewinnverwendung', nurKapital: true, norm: '§ 42a, § 46 Nr. 1 und 5 GmbHG; § 5a Abs. 3 GmbHG (UG)',
    wofuer: 'Jahreszyklus: Feststellung des Abschlusses, Verwendung des Ergebnisses, Entlastung der Geschäftsführung.',
    text: `GESELLSCHAFTERBESCHLUSS ZUM JAHRESABSCHLUSS
{{firma}}, Sitz: {{sitz}}, Handelsregister {{register}}

Die Gesellschafter beschließen unter Verzicht auf alle Form- und Fristvorschriften:

1. Der Jahresabschluss für das Geschäftsjahr {{geschaeftsjahr}} wird in der vorgelegten Fassung festgestellt (Bilanzsumme ${LUECKE}, Jahresergebnis ${LUECKE}).
2. Verwendung des Ergebnisses: ${LUECKE} (Ausschüttung / Vortrag auf neue Rechnung / Einstellung in Rücklagen).
   Nur UG (haftungsbeschränkt): Ein Viertel des um einen Verlustvortrag geminderten Jahresüberschusses wird in die gesetzliche Rücklage eingestellt (§ 5a Abs. 3 GmbHG).
3. Der Geschäftsführung ({{geschaeftsfuehrung}}) wird für das Geschäftsjahr {{geschaeftsjahr}} Entlastung erteilt.

{{ort}}, den {{datum}}

______________________________
(Gesellschafter/in)`,
  },
  {
    id: 'einladung-gv', titel: 'Einladung zur Gesellschafterversammlung', nurKapital: true, norm: '§ 51 GmbHG',
    wofuer: 'Einladung mit Tagesordnung — Zugang mindestens eine Woche vor dem Termin, per Einschreiben (sofern die Satzung nichts anderes sagt).',
    text: `EINLADUNG ZUR GESELLSCHAFTERVERSAMMLUNG
{{firma}}, Sitz: {{sitz}}

Sehr geehrte Gesellschafterinnen und Gesellschafter,

hiermit lädt die Geschäftsführung zur ordentlichen Gesellschafterversammlung ein:

Termin: ${LUECKE}, ${LUECKE} Uhr
Ort: ${LUECKE}

Tagesordnung
1. Feststellung des Jahresabschlusses für das Geschäftsjahr {{geschaeftsjahr}}
2. Verwendung des Ergebnisses
3. Entlastung der Geschäftsführung
4. ${LUECKE}

Die Unterlagen zu den Tagesordnungspunkten liegen bei bzw. werden bis ${LUECKE} übersandt.

{{ort}}, den {{datum}}

______________________________
Geschäftsführung ({{geschaeftsfuehrung}})`,
  },
  {
    id: 'insichgeschaeft', titel: 'Niederschrift Insichgeschäft', nurKapital: true, norm: '§ 35 Abs. 3 GmbHG, § 181 BGB',
    wofuer: 'Einpersonen-Gesellschaft: ein Rechtsgeschäft der Geschäftsführung mit sich selbst unverzüglich niederschreiben.',
    text: `NIEDERSCHRIFT ÜBER EIN RECHTSGESCHÄFT ZWISCHEN DER GESELLSCHAFT UND IHREM ALLEINIGEN GESELLSCHAFTER-GESCHÄFTSFÜHRER (§ 35 Abs. 3 GmbHG)
{{firma}}, Sitz: {{sitz}}, Handelsregister {{register}}

Befreiung von den Beschränkungen des § 181 BGB: ${LUECKE} (Satzung bzw. Beschluss vom ${LUECKE}, eingetragen am ${LUECKE})

Gegenstand des Rechtsgeschäfts: ${LUECKE}
Vereinbarte Bedingungen (fremdüblich): ${LUECKE}
Wirksam ab: ${LUECKE}

{{ort}}, den {{datum}} — unverzüglich nach Vornahme niedergeschrieben.

______________________________
für die Gesellschaft (Geschäftsführung)       ______________________________
                                               persönlich`,
  },
  {
    id: 'entscheidungsprotokoll', titel: 'Entscheidungsprotokoll (Business Judgement Rule)', norm: '§ 93 Abs. 1 S. 2 AktG (für die GmbH entsprechend), § 43 GmbHG',
    wofuer: 'Vor einer wesentlichen Entscheidung festhalten, auf welcher Grundlage entschieden wurde — das Schild der Geschäftsleitung.',
    text: `ENTSCHEIDUNGSPROTOKOLL
{{firma}} — {{datum}}

1. Entscheidung (was genau): ${LUECKE}
2. Anlass und Ziel (Wohl der Gesellschaft): ${LUECKE}
3. Informationsgrundlage (Quellen, Zahlen, Gutachten, Datum): ${LUECKE}
4. Geprüfte Alternativen: ${LUECKE}
5. Risiken und Gegenmaßnahmen (Bezug zum Risiko-Register): ${LUECKE}
6. Interessenkonflikte: keine / ${LUECKE}
7. Beschluss bzw. Entscheidung und Begründung: ${LUECKE}
8. Wer entschieden hat: Geschäftsführung ({{geschaeftsfuehrung}})

{{ort}}, den {{datum}}`,
  },
  {
    id: 'nda', titel: 'Vertraulichkeitsvereinbarung (gegenseitig)', norm: '§§ 2, 4 GeschGehG (angemessene Geheimhaltungsmaßnahmen)',
    wofuer: 'Bevor vertrauliche Informationen mit einem Partner ausgetauscht werden.',
    text: `VERTRAULICHKEITSVEREINBARUNG

zwischen
{{firma}}, {{sitz}}, vertreten durch die Geschäftsführung ({{geschaeftsfuehrung}})
und
${LUECKE} (Partei 2)

1. Zweck: Austausch von Informationen im Rahmen von ${LUECKE}.
2. Vertrauliche Informationen sind alle Informationen, die eine Partei der anderen im Rahmen des Zwecks offenlegt und die als vertraulich bezeichnet oder erkennbar vertraulich sind.
3. Die empfangende Partei nutzt sie nur für den Zweck, gibt sie nur an Mitarbeitende und Berater weiter, die sie kennen müssen und ebenfalls zur Vertraulichkeit verpflichtet sind, und schützt sie mindestens wie eigene vertrauliche Informationen.
4. Ausgenommen sind Informationen, die öffentlich bekannt sind, der empfangenden Partei bereits vorher bekannt waren, unabhängig entwickelt wurden oder aufgrund gesetzlicher Pflicht offengelegt werden müssen.
5. Auf Verlangen werden vertrauliche Informationen zurückgegeben oder gelöscht, soweit keine Aufbewahrungspflicht entgegensteht.
6. Laufzeit: ${LUECKE} Jahre ab Unterzeichnung; die Pflichten aus Ziff. 3 gelten ${LUECKE} Jahre über das Ende hinaus.
7. Es gilt deutsches Recht. Gerichtsstand: ${LUECKE}.

{{ort}}, den {{datum}}

______________________________   ______________________________
{{firma}}                          Partei 2`,
  },
  {
    id: 'avv', titel: 'Auftragsverarbeitungsvertrag (Gerüst)', norm: 'Art. 28 Abs. 3 DSGVO',
    wofuer: 'Gerüst mit den Pflichtinhalten nach Art. 28 Abs. 3 DSGVO — wenn ein Dienstleister personenbezogene Daten in eurem Auftrag verarbeitet.',
    text: `VERTRAG ÜBER DIE AUFTRAGSVERARBEITUNG (Art. 28 DSGVO)

Verantwortlicher: {{firma}}, {{sitz}}
Auftragsverarbeiter: ${LUECKE}

1. Gegenstand und Dauer: ${LUECKE}
2. Art und Zweck der Verarbeitung: ${LUECKE}
3. Art der personenbezogenen Daten: ${LUECKE}; Kategorien betroffener Personen: ${LUECKE}
4. Der Auftragsverarbeiter verarbeitet nur auf dokumentierte Weisung (Art. 28 Abs. 3 lit. a).
5. Vertraulichkeit der zur Verarbeitung befugten Personen (lit. b).
6. Technische und organisatorische Maßnahmen nach Art. 32 — Anlage TOM (lit. c).
7. Unterauftragsverarbeiter nur mit Genehmigung; Liste als Anlage (lit. d, Abs. 2 und 4).
8. Unterstützung bei Betroffenenrechten (lit. e) und bei Art. 32–36 (lit. f).
9. Nach Ende: Löschung oder Rückgabe aller Daten, soweit keine Speicherpflicht besteht (lit. g).
10. Nachweise und Überprüfungen einschließlich Inspektionen (lit. h).
11. Drittlandübermittlung: keine / nur mit Garantien nach Art. 44 ff.: ${LUECKE}

{{ort}}, den {{datum}}

______________________________   ______________________________
Verantwortlicher                   Auftragsverarbeiter`,
  },
  {
    id: 'vollmacht', titel: 'Einzelvollmacht', norm: '§§ 164 ff. BGB',
    wofuer: 'Eine Person für ein bestimmtes Geschäft bevollmächtigen — mit „gültig bis“ und im Vollmachten-Register vermerken.',
    text: `VOLLMACHT

Die {{firma}}, {{sitz}}, Handelsregister {{register}}, vertreten durch die Geschäftsführung ({{geschaeftsfuehrung}}),

bevollmächtigt hiermit
${LUECKE} (Name, Anschrift)

die Gesellschaft bei folgenden Rechtsgeschäften zu vertreten:
${LUECKE}

Die Vollmacht gilt bis ${LUECKE} und kann jederzeit widerrufen werden. Untervollmacht: nicht gestattet / gestattet. Befreiung von § 181 BGB: nicht erteilt.

{{ort}}, den {{datum}}

______________________________
für die {{firma}}`,
  },
];

export const vorlageVon = (id: string) => VORLAGEN.find(v => v.id === id);

/** Die Platzhalter, die MAKE OS aus dem Register füllt — leer bleibt „[…]“. */
export function platzhalter(g: RegisterGesellschaft, heute: string): Record<string, string> {
  const vorjahr = String(Number(heute.slice(0, 4)) - 1);
  return {
    firma: g.firmierung || anzeigeName(g),
    sitz: g.sitz || g.ort || '',
    ort: g.sitz || g.ort || '',
    register: g.register || '',
    geschaeftsfuehrung: g.geschaeftsfuehrung || '',
    stammkapital: typeof g.stammkapitalCent === 'number' ? euroText(g.stammkapitalCent) : '',
    geschaeftsjahr: vorjahr,
    datum: tagText(heute),
  };
}

/** Entwurf aus einer Vorlage (rein): Platzhalter gefüllt, Unbekanntes „[…]“, Hinweis vorne. */
export function entwurfAus(v: Vorlage, g: RegisterGesellschaft, heute: string): { titel: string; text: string } {
  const p = platzhalter(g, heute);
  const text = v.text.replace(/\{\{([a-z]+)\}\}/g, (_, k: string) => (p[k] ? p[k] : LUECKE));
  return { titel: `${v.titel} — ${p.firma}`, text: `${VORLAGE_HINWEIS}\n\n${text}\n` };
}
