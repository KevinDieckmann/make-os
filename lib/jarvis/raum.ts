// ─── MAKE OS — Die drei Räume ───────────────────────────────────────────────
// Kevin am 06.09.: „Ich habe meinen Bereich, sie aber auch gleichzeitig. Ich
// habe nachher meine Firmen und sie ihre Firmen. An sich sollte beides erstmal
// getrennt sein, sodass jeder seinen Space hat und einen klaren Space zusammen."
//
// Also drei Räume: kevin · malin · gemeinsam. Jede der vier Sachen (Finanzen,
// Aufgaben, Kontakte, Gesundheit) gibt es in allen dreien.
//
// ────────────────────────────────────────────────────────────────────────────
// WICHTIG, UND BEWUSST SO BENANNT: Das hier ist ZUSCHREIBUNG, KEIN SCHUTZ.
//
// Wer bin ich, steht heute in einem Cookie, den der Browser selbst setzt. Wer
// den Zugangsschlüssel hat, kann ihn umschreiben. Das ist in Ordnung, solange
// die Software auf einem Rechner läuft, den nur Kevin und Malin benutzen — und
// es ist die Vorbereitung, nicht der Ersatz: Kevins Entscheidung vom 06.09.
// war „Struktur jetzt, Zugang später". Sobald der Server mit echtem Login
// steht, ändert sich genau EINE Funktion hier — personAus() — und alles andere
// bleibt, wie es ist. Deshalb geht ab heute jede Zuschreibung durch diese
// Datei und nicht durch fünfzehn einzelne Stellen.
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// SEIT 23.09. IST ES SCHUTZ. Kevins Ansage: „dieses Kevin/Malin-Thema geht
// einfach raus" — echte Konten, echter Login. Die Person ist jetzt der
// Speichername des angemeldeten Kontos (lib/zugang/konten.ts). Die Middleware
// prüft die Sitzung und setzt den Kopf x-make-user; Köpfe, die ein Client
// selbst mitschickt, löscht sie vorher. Genau EINE Funktion hat sich dafür
// geändert — personAus() — so, wie es am 06.09. angekündigt war.
// ────────────────────────────────────────────────────────────────────────────

/** Der Speichername eines Kontos — „kevin", „malin", „joerg2" … */
export type Person = string;
export type Raum = string;

/** Anzeigenamen für die zwei gewachsenen Konten. Alle anderen kommen aus
 *  lib/zugang/konten.ts (namenVon); das hier ist der synchrone Rückfall. */
export const PERSON_LABEL: Record<string, string> = { kevin: 'Kevin', malin: 'Malin' };
export const RAUM_LABEL: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', gemeinsam: 'gemeinsam' };

/** Anzeigename, synchron: bekannt → Name, sonst der Speichername mit großem Anfang. */
export function nameVon(person: string): string {
  return PERSON_LABEL[person] ?? (person.charAt(0).toUpperCase() + person.slice(1));
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
  // die Systemläufe (Tageslauf, Selbstbild) haben keine Person.
  return 'kevin';
}

/**
 * Wessen Bestand angezeigt werden soll.
 *
 * Kevins Entscheidung vom 23.09. („Malin ist Gesundheits-Beauftragte — sieht
 * sie deine Gesundheitsdaten?" — „Ja, alles"): beide dürfen die persönlichen
 * Bestände der anderen Person LESEN, über ?fuer=kevin|malin. Geschrieben wird
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
 * anderen Person ist tabu — auch für Jarvis, wenn er für jemanden arbeitet.
 */
export function darfSehen(raum: Raum | undefined, person: Person): boolean {
  if (!raum) return true; // Altbestand ohne Raum: bleibt sichtbar, sonst verschwindet Gewachsenes
  return raum === 'gemeinsam' || raum === person;
}

/**
 * Der Speichername für persönliche Bestände.
 *
 * Kevin behält den bestehenden Namen, Malin bekommt einen eigenen mit Suffix.
 * Absichtlich SO herum: dadurch muss kein einziger gewachsener Datensatz
 * umgezogen werden, und wenn etwas an dieser Trennung schiefgeht, liest Malin
 * im schlimmsten Fall einen leeren Speicher — nicht Kevin einen falschen.
 *
 * Die Schreibweise mit doppeltem Bindestrich gibt es schon (lib/vitals.ts
 * kennt „vitals--malin"); sie steht jetzt hier, damit es EINE Regel ist.
 */
export function speicherFuer(basis: string, person: Person): string {
  return person === 'kevin' ? basis : `${basis}--${person.replace(/[^a-z0-9-]/g, '')}`;
}

/** Filter für Listen mit Raum-Feld. */
export function nurSichtbar<T extends { raum?: Raum }>(liste: T[], person: Person): T[] {
  return liste.filter(x => darfSehen(x.raum, person));
}
