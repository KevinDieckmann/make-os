import type { ID, Owner, Priority, Tag, Timestamps } from './common';

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'blocked' | 'done';

export type ProjectCategory = 'personal-malin' | 'personal-kevin' | 'joint' | 'business';

export interface SubTask extends Timestamps {
  id: ID;
  taskId: ID;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface Dependency {
  blockedByTaskId: ID;
  resolvedAt?: string;
}

export interface Task extends Timestamps {
  id: ID;
  projectId: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  assignee: Owner;
  tags: Tag[];
  dueDate?: string;
  subTasks: SubTask[];
  dependencies: Dependency[];
  sortOrder: number;
  completedAt?: string;
  /** Abweichung vom Ort (26.09.): Privat oder Business — ohne Angabe gibt der Ort den Space vor. */
  space?: 'privat' | 'business';
  /** Business-Einheit (27.09.): Selbstständigkeit · KD Ventures · MAKE OS UG oder eine eigene Einheit des Haushalts — nur im Business; Privat verwirft der Schreibweg. */
  einheit?: string;
  // ── Aufgaben-Modell wie Monday/ClickUp (28.09. abends, lib/aufgaben/struktur.ts) ──
  /** Aufgaben-Space: `privat` · `kdc` · `kdv` · `ug` · `m-<firmaId>` (Mandant). `space`/`einheit` werden daraus abgeleitet. */
  spaceId?: AufgabenSpaceId;
  /** Liste im Projekt (z. B. „Januar“) — fehlt = „Sonstige“ des Projekts. */
  listeId?: ID;
  /** Übergeordnete Aufgabe (eine Ebene): die Unteraufgabe erbt Space, Projekt und Liste. */
  parentId?: ID;
  /** Eigener Status des Space — `status` trägt dann dessen Grundstatus (`basis`). */
  statusId?: ID;
  /** Verknüpfung mit dem CRM: Kontakt, Firma, Mandat, Deal (Kennungen). */
  bezug?: AufgabeBezug;
  /** Kommentare mit @-Erwähnung (Speichernamen der Personen). */
  kommentare?: AufgabeKommentar[];
  /** Startdatum (YYYY-MM-DD). */
  startDate?: string;
  // ── Vertiefung (28.09. spät, AUFGABEN_PLAN.md „Vertiefung“) ──
  /** Notiz als sichere Markdown-Teilmenge (Überschriften, fett/kursiv, Listen, Checklisten `- [ ]`, Links) — lib/aufgaben/notiz.ts. */
  notiz?: string;
  /** Werte der eigenen Felder des Projekts (`Project.felder`), je Feld-Kennung typgerecht (Betrag in Cent). */
  felder?: Record<string, FeldWert>;
  /** „Wartet auf …“: Kennungen der Aufgaben, die vorher fertig sein müssen. Führend; `dependencies` wird daraus abgeleitet. Kreise lehnt der Server ab (409). */
  abhaengigVon?: ID[];
  /** Wiederkehrend (Datenfeld — die Logik baut Paket C3). */
  wiederholung?: Wiederholung;
  /** Aus welcher Vorlage die Aufgabe entstand (Paket C3). */
  vorlageId?: ID;
  /** Serie einer wiederkehrenden Aufgabe (Paket C3): Kennung der ersten Aufgabe (Anker). Früher als `vorlageId` „serie:…“ — die Übernahme übersetzt. */
  serieId?: ID;
  /** ZOE bereitet vor (Paket C4): Stand der Vorbereitung; `assignee` bleibt kevin/malin/both. */
  zoe?: ZoeAuftrag;
  /** Verlauf je Aufgabe — schreibt NUR der Server (lib/aufgaben/verlauf.ts); Werte nur für Kurzwerte (Status, Datum, Person). */
  verlauf?: VerlaufEintrag[];
}

/** Wert eines eigenen Feldes: Text/Datum/Auswahl/Link/Person als Text, Zahl als Zahl, Betrag als ganze Cent. */
export type FeldWert = string | number;
export type FeldTyp = 'text' | 'zahl' | 'betrag' | 'datum' | 'auswahl' | 'link' | 'person';
/** Ein eigenes Feld je Projekt (Definition). */
export interface EigenesFeld {
  id: ID;
  name: string;
  typ: FeldTyp;
  /** Nur `auswahl`: die möglichen Werte. */
  optionen?: string[];
}

export type WiederholungRegel = 'taeglich' | 'woechentlich' | 'monatlich' | 'jaehrlich' | 'werktage';
/** Wiederholung einer Aufgabe oder Liste (Datenfeld; Paket C3 rechnet damit). */
export interface Wiederholung {
  regel: WiederholungRegel;
  /** Alle n Tage/Wochen/Monate/Jahre (1 = jedes Mal). */
  intervall?: number;
  /** Wochentage 0 = Sonntag … 6 = Samstag (bei `woechentlich`). */
  wochentage?: number[];
  /** Tag im Monat 1–31 (bei `monatlich`). */
  monatstag?: number;
  /** Letzter Tag (YYYY-MM-DD). */
  bis?: string;
  /** Nächster Termin (YYYY-MM-DD). */
  naechste?: string;
}

export type ZoeStatus = 'offen' | 'in_arbeit' | 'wartet_freigabe' | 'freigegeben' | 'abgelehnt';
/** ZOE an einer Aufgabe (Paket C4): sie bereitet vor, legt ins Stapel, erst ein Klick übernimmt. */
export interface ZoeAuftrag {
  status: ZoeStatus;
  stapelId?: string;
  /** Auftraggeberin (Speichername) — wer die Aufgabe an ZOE gab; setzt der Server. Altbestand: aus dem Verlauf abgeleitet. */
  von?: string;
  /** Hinweis an ZOE (≤ 1.000 Zeichen, darüber 413). Altbestand: Kommentar „Hinweis an ZOE: …“. */
  hinweis?: string;
}

export type VerlaufArt =
  | 'angelegt' | 'status' | 'zustaendig' | 'prioritaet' | 'deadline' | 'start' | 'titel' | 'beschreibung' | 'notiz'
  | 'verschoben' | 'kommentar' | 'datei' | 'feld' | 'abhaengigkeit' | 'verknuepfung' | 'wiederholung' | 'zoe' | 'zusammengefasst';
/** Ein Eintrag im Verlauf einer Aufgabe: wer, wann, was — Werte nur als nicht-vertrauliche Kurzwerte. */
export interface VerlaufEintrag {
  /** ISO-Zeitpunkt (Server). */
  am: string;
  /** Speichername der Person (bei ZOE/Systemlauf die Person, in deren Auftrag, sonst „system“). */
  von: string;
  /** ZOE im Auftrag der Person bzw. Systemlauf. */
  durch?: 'zoe' | 'system';
  was: VerlaufArt;
  /** Nur bei `feld`: die Feld-Kennung; bei `kommentar`/`datei`: „neu“ oder „entfernt“. */
  feld?: string;
  /** Kurzwert vorher (Status-Name, Datum, Person) — nie Texte. */
  vorher?: string;
  /** Kurzwert nachher. */
  nachher?: string;
  /** Anzahl (Kommentare, Abhängigkeiten, zusammengefasste ältere Einträge). */
  anzahl?: number;
}

/** `privat` · `kdc` · `kdv` · `ug` · `m-<firmaId>`. */
export type AufgabenSpaceId = string;

export interface AufgabeBezug { kontaktId?: string; firmaId?: string; mandatId?: string; dealId?: string }

export interface AufgabeKommentar {
  id: ID;
  /** Speichername der Person (kevin, malin, …). */
  von: string;
  text: string;
  /** ISO-Zeitpunkt. */
  am: string;
  /** Erwähnte Personen (Speichernamen). */
  erwaehnt?: string[];
}

/** Eine Liste im Projekt (z. B. Januar, Februar, März). */
export interface AufgabenListe {
  id: ID;
  projektId: ID;
  titel: string;
  sortOrder: number;
  archiviert?: boolean;
  /** Gruppe im Projekt (Marketing, Sales …) — fehlt = direkt im Projekt. */
  gruppeId?: ID;
  /** Wiederkehrende Liste (z. B. jeden Monat „Monatsabschluss“) — Datenfeld für Paket C3. */
  wiederholung?: Wiederholung;
  /** Vorlage, aus der die Liste (neu) entsteht (Paket C3). */
  vorlageId?: ID;
  /** Titel-Muster der Serien-Liste, z. B. „Monatsabschluss {Monat} {Jahr}“ (Paket C3; Platzhalter lib/aufgaben/wiederholung.ts). */
  titelMuster?: string;
}

/** Gruppe im Projekt (28.09. spät): Projekt → Gruppe → Liste → Aufgabe → Unteraufgabe. */
export interface AufgabenGruppe {
  id: ID;
  projektId: ID;
  titel: string;
  /** #rrggbb */
  farbe: string;
  sortOrder: number;
  eingeklappt?: boolean;
}

/** Eine Aufgabe in einer Vorlage (Deadline als Versatz in Tagen ab Anlage). */
export interface VorlageAufgabe {
  titel: string;
  beschreibung?: string;
  prioritaet?: Priority;
  zustaendig?: Owner;
  versatzTage?: number;
  /** Notiz der Aufgabe (sichere Markdown-Teilmenge). */
  notiz?: string;
  /** Vorbelegte Werte eigener Felder (je Feld-Kennung, Betrag in Cent). */
  felder?: Record<string, FeldWert>;
  /** Unteraufgaben (eine Ebene). */
  unter?: VorlageAufgabe[];
}
/** Inhalt einer Vorlage: bei `projekt` Gruppen, Listen, Felder, Notiz; bei `liste` nur `aufgaben`. */
export interface VorlageInhalt {
  gruppen?: { titel: string; farbe?: string }[];
  listen?: { titel: string; gruppe?: string; aufgaben: VorlageAufgabe[] }[];
  aufgaben?: VorlageAufgabe[];
  felder?: EigenesFeld[];
  notiz?: string;
}
/** Vorlage für Projekte und Listen (Datenfeld — Paket C3 legt daraus an). */
export interface AufgabenVorlage {
  id: ID;
  art: 'projekt' | 'liste';
  titel: string;
  /** Nur in diesem Space anbieten (fehlt = überall). */
  spaceId?: AufgabenSpaceId;
  inhalt: VorlageInhalt;
  angelegt?: string;
}

/** Eigener Status je Space — `basis` sagt allen Lesern, was er bedeutet (erledigt = done). */
export interface AufgabenStatus {
  id: ID;
  spaceId: AufgabenSpaceId;
  label: string;
  /** #rrggbb */
  farbe: string;
  basis: TaskStatus;
  sortOrder: number;
}

export interface Project extends Timestamps {
  id: ID;
  title: string;
  description?: string;
  category: ProjectCategory;
  owner: Owner;
  color: string;
  tags: Tag[];
  archived: boolean;
  dueDate?: string;
  /** Aufgaben-Space des Projekts (28.09. abends) — fehlt im Altbestand, die Übernahme leitet ihn ab. */
  spaceId?: AufgabenSpaceId;
  // ── Projektseite (28.09. spät) ──
  /** Notiz des Projekts (sichere Markdown-Teilmenge, lib/aufgaben/notiz.ts). */
  notiz?: string;
  /** Kurzbeschreibung (Projektkopf) — `description` bleibt für alte Leser. */
  beschreibung?: string;
  status?: ProjektStatus;
  /** Zeitraum (YYYY-MM-DD). */
  start?: string;
  ende?: string;
  /** Mitglieder (Speichernamen). */
  mitglieder?: string[];
  /** Eigene Felder des Projekts (Definitionen); Werte an der Aufgabe (`Task.felder`). */
  felder?: EigenesFeld[];
  /** Aus welcher Vorlage das Projekt entstand (Paket C3). */
  vorlageId?: ID;
}

export type ProjektStatus = 'aktiv' | 'pausiert' | 'abgeschlossen';

export interface TasksState {
  projects: Project[];
  tasks: Task[];
  /** Listen je Projekt (28.09. abends). */
  listen?: AufgabenListe[];
  /** Eigene Status je Space (28.09. abends). */
  statusEigen?: AufgabenStatus[];
  /** Gruppen je Projekt (28.09. spät). */
  gruppen?: AufgabenGruppe[];
  /** Vorlagen für Projekte und Listen (28.09. spät, Paket C3). */
  vorlagen?: AufgabenVorlage[];
}

export type TasksAction =
  | { type: 'HYDRATE'; payload: TasksState }
  | { type: 'ADD_PROJECT'; payload: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> & { id: ID } }
  | { type: 'DELETE_PROJECT'; payload: { id: ID } }
  | { type: 'ADD_TASK'; payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: ID } }
  | { type: 'DELETE_TASK'; payload: { id: ID } }
  | { type: 'TOGGLE_TASK'; payload: { id: ID } }
  | { type: 'ADD_SUBTASK'; payload: Omit<SubTask, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'TOGGLE_SUBTASK'; payload: { taskId: ID; subTaskId: ID } }
  | { type: 'REORDER_TASKS'; payload: { projectId: ID; orderedIds: ID[] } };
