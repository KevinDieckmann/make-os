// ─── MAKE OS — Die Räume ────────────────────────────────────────────────────
// Vorgabe vom 06.09.: jede Person hat ihren eigenen Bereich, dazu einen klaren
// gemeinsamen — getrennt, sodass jeder seinen Space hat und einen Space zusammen.
//
// Also Räume: einer je Person (Speichername des Kontos) · gemeinsam. Jede der vier
// Sachen (Finanzen, Aufgaben, Kontakte, Gesundheit) gibt es in allen.
//
// ────────────────────────────────────────────────────────────────────────────
// WICHTIG, UND BEWUSST SO BENANNT: Das hier ist ZUSCHREIBUNG, KEIN SCHUTZ.
//
// Wer bin ich, steht heute in einem Cookie, den der Browser selbst setzt. Wer
// den Zugangsschlüssel hat, kann ihn umschreiben. Das ist in Ordnung, solange
// die Software auf einem Rechner läuft, den nur der eigene Haushalt benutzt — und
// es ist die Vorbereitung, nicht der Ersatz: Entscheidung vom 06.09.
// war „Struktur jetzt, Zugang später". Sobald der Server mit echtem Login
// steht, ändert sich genau EINE Funktion hier — personAus() — und alles andere
// bleibt, wie es ist. Deshalb geht ab heute jede Zuschreibung durch diese
// Datei und nicht durch fünfzehn einzelne Stellen.
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// SEIT 23.09. IST ES SCHUTZ. Vorgabe: feste Personen gehen raus — echte
// Konten, echter Login. Die Person ist jetzt der
// Speichername des angemeldeten Kontos (lib/zugang/konten.ts). Die Middleware
// prüft die Sitzung und setzt den Kopf x-make-user; Köpfe, die ein Client
// selbst mitschickt, löscht sie vorher. Genau EINE Funktion hat sich dafür
// geändert — personAus() — so, wie es am 06.09. angekündigt war.
// ────────────────────────────────────────────────────────────────────────────

/** Der Speichername eines Kontos — „pia", „olaf2" … */
export type Person = string;
export type Raum = string;

/**
 * Speichername des gewachsenen Erstkontos: seine persönlichen Bestände tragen KEIN Suffix (`speicherFuer`), und der Dienstweg ohne
 * Person handelt als dieses Konto (`personAus`). Die EINE Stelle, an der ein Speichername im Code steht — sie beschreibt, wie
 * die Daten der gewachsenen Instanz liegen, und wird nie als Anzeigename oder Rolle benutzt. Plattform-Schuld (UPDATES.md
 * „neutral-rest-2“): je Instanz aus der Einrichtung statt aus dem Code; eine neue Instanz ohne dieses Konto bekommt für jede
 * Person `<basis>--<person>`.
 */
const ERSTKONTO = 'kevin';

/** Anzeigename, synchron: der Speichername mit großem Anfang. Echte Namen kommen aus lib/zugang/konten.ts (`namenVon`). */
export function nameVon(person: string): string {
  return person.charAt(0).toUpperCase() + person.slice(1);
}

/** Wer stellt gerade die Anfrage. */
export function personAus(req: Request): Person {
  // Aus der Sitzung — von der Middleware gesetzt, von niemandem sonst.
  const ausSitzung = req.headers.get('x-make-user');
  if (ausSitzung && /^[a-z0-9-]{1,40}$/.test(ausSitzung)) return ausSitzung;
  // Der Dienstweg (Arbeiter, Bote, Takt) handelt im Auftrag einer Person und
  // nennt sie im Kopf — die Middleware lässt das nur mit Dienstschlüssel durch.
  const ausKopf = req.headers.get('x-make-person');
  if (ausKopf && /^[a-z0-9-]{1,40}$/.test(ausKopf)) return ausKopf;
  // Dienstweg ohne Person: das gewachsene Erstkonto. Bewusst kein Fehler —
  // die Systemläufe (Tageslauf, Selbstbild) haben keine Person. Schreibende und
  // persönliche Wege prüfen vorher `personStreng` (Regel 5).
  return ERSTKONTO;
}

/**
 * Wessen Bestand angezeigt werden soll.
 *
 * Entscheidung vom 23.09.: Personen dürfen persönliche Bestände einer anderen
 * Person LESEN, über ?fuer=<speichername> — Gesundheit nur, wenn sie geteilt ist
 * (`darfGesundheitSehen`). Geschrieben wird
 * weiterhin nur der eigene — dafür bleibt personAus() zuständig. Die Trennung
 * ist damit Zuordnung, nicht Geheimnis: jeder weiß, wessen Werte er sieht.
 */
export function ansichtPerson(req: Request): Person {
  const fuer = new URL(req.url).searchParams.get('fuer');
  if (fuer && /^[a-z0-9-]{1,40}$/.test(fuer)) return fuer;
  return personAus(req);
}

/**
 * Darf ich die Gesundheitsdaten dieser Person sehen? Die eigenen immer;
 * fremde nur, wenn die Person sie mit mir teilt (Konto → „teilt.gesundheit").
 * Seit 23.09. eine Einstellung je Person statt einer globalen Regel.
 */
export async function darfGesundheitSehen(req: Request, ziel: Person): Promise<boolean> {
  const ich = personAus(req);
  if (ziel === ich) return true;
  const { kontoFuerSpeicher } = await import('@/lib/zugang/konten');
  const k = await kontoFuerSpeicher(ziel);
  return !!k && k.teilt.gesundheit.includes(ich);
}

/** In welchen Raum gehört, was diese Person gerade anlegt. */
export function eigenerRaum(person: Person): Raum {
  return person;
}

/**
 * Darf diese Person das sehen?
 *
 * Gemeinsames sehen beide. Der eigene Raum gehört einem selbst. Der Raum der
 * anderen Person ist tabu — auch für ZOE, wenn er für jemanden arbeitet.
 */
export function darfSehen(raum: Raum | undefined, person: Person): boolean {
  if (!raum) return true; // Altbestand ohne Raum: bleibt sichtbar, sonst verschwindet Gewachsenes
  return raum === 'gemeinsam' || raum === person;
}

/**
 * Der Speichername für persönliche Bestände.
 *
 * Das Erstkonto behält den bestehenden Namen, jede weitere Person bekommt einen
 * eigenen mit Suffix. Absichtlich SO herum: dadurch muss kein einziger
 * gewachsener Datensatz umgezogen werden, und wenn etwas an dieser Trennung
 * schiefgeht, liest eine Person im schlimmsten Fall einen leeren Speicher —
 * nicht eine andere einen falschen.
 *
 * Die Schreibweise mit doppeltem Bindestrich („vitals--<person>") steht hier,
 * damit es EINE Regel ist.
 */
export function speicherFuer(basis: string, person: Person): string {
  return person === ERSTKONTO ? basis : `${basis}--${person.replace(/[^a-z0-9-]/g, '')}`;
}

/**
 * Wie `speicherFuer`, aber für Bestände, die BIS ZUM 08.10. geteilt (ohne Person) lagen und jetzt je Person liegen
 * (Tageslauf, Arbeits- und Gesundheits-Schalter — „Datenschutz vor dem Upload“): der Altbestand ohne Suffix gehört
 * nur dem Inhaber. Liefe `speicherFuer` für eine andere Person auf den Namen ohne Suffix hinaus, bekommt sie
 * `<basis>--<person>` — sie sieht den Altbestand nie (Konto-Daten kennen beide Namen, lib/datenschutz/konto-daten.ts).
 */
export function eigenerSpeicher(basis: string, person: Person, inhaber: string | null): string {
  const n = speicherFuer(basis, person);
  return n === basis && person !== inhaber ? `${basis}--${person.replace(/[^a-z0-9-]/g, '')}` : n;
}

/** Filter für Listen mit Raum-Feld. */
export function nurSichtbar<T extends { raum?: Raum }>(liste: T[], person: Person): T[] {
  return liste.filter(x => darfSehen(x.raum, person));
}
