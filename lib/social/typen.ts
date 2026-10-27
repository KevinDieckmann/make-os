// ─── MAKE OS — Social (Markttraktion › Social, 26.10.2026) — Typen ─────────────────────────────────────────────────────────────────
// Kevin 26.10.: „Ein Agent, der mein Social Media aufbaut und verwaltet — Faceless-Kanäle, Kommentare, Funnel … damit wir Reichweite aufbauen.“
// Grundlage SOCIAL_PLAN.md. Hier liegt NUR die Form der Daten; Regeln in daten.ts (Schreiben), pruefer.ts (vor jeder Veröffentlichung),
// autonomie.ts (Stufe 2: was der Agent selbst darf), analyse.ts (Lernschleife), csv.ts (Kennzahlen-Import aus den Plattform-Exporten).
// Nichts Persönliches fest im Code: Kanäle, Markenprofile, Personas und Leitplanken trägt die Instanz ein (Plattform-Regel).

export type SocialPlattform = 'tiktok' | 'instagram' | 'youtube';
export const SOCIAL_PLATTFORMEN: readonly SocialPlattform[] = ['tiktok', 'instagram', 'youtube'];
export const PLATTFORM_NAME: Record<SocialPlattform, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };

/** Autonomie-Stufe eines Kanals (SOCIAL_PLAN.md › 4): 0 Entwurf · 1 Freigabe per Klick · 2 selbstständig mit Leitplanken. */
export type AutonomieStufe = 0 | 1 | 2;

export interface Leitplanken {
  autonomie: AutonomieStufe;
  /** Tageslimits je Kanal — darüber geht alles in den Freigabe-Stapel. */
  postsProTag: number;
  antwortenProTag: number;
  dmsProTag: number;
  /** Not-Aus: Posten bzw. Antworten angehalten (setzt nur eine Person per Klick). */
  postenAus: boolean;
  antwortenAus: boolean;
  /** Anteil negativer Kommentare (%) in 24 h, ab dem der Agent selbst anhält. */
  negativSchwelle: number;
}

export interface Markenprofil {
  versprechen?: string;
  zielgruppe?: string;
  ton?: string;
  /** Wörter, die der Kanal nie sagt — der Prüfer stoppt sie. */
  nieSagen: string[];
  saeulen: string[];
  cta?: string;
  bio?: string;
}

export interface SocialKanal {
  id: string;
  name: string;
  /** Handle ohne @ (gleich auf allen Plattformen, wenn möglich). */
  handle?: string;
  sprache: 'de' | 'en';
  plattformen: SocialPlattform[];
  /** Offen KI-geführter Kanal (Persona in Ich-Form) — strengere Prüfung (nie „lebendig/bewusst“), immer KI-Hinweis. */
  kiKanal: boolean;
  persona?: { name: string; look?: string };
  marke: Markenprofil;
  leitplanken: Leitplanken;
  status: 'aktiv' | 'pausiert';
  archiviertAm?: string;
  geaendert: string;
  geaendertVon?: string;
}

/** Serienformat — einmal freigegeben, führt der Agent (Stufe 2) es selbst weiter. */
export interface SocialFormat {
  id: string;
  kanalId: string;
  name: string;
  beschreibung?: string;
  /** Ziel-Länge in Sekunden (Prüfer warnt bei grober Abweichung). */
  laengeSek?: number;
  /** Freigabe durch eine Person (Server-Zeit + Speichername) — ohne Freigabe nie selbstständig. */
  freigegebenAm?: string;
  freigegebenVon?: string;
  geaendert: string;
  geaendertVon?: string;
}

export interface Hook { id: string; text: string; bildschirm?: string }

export type FolgeStatus = 'idee' | 'entwurf' | 'freigegeben' | 'geplant' | 'veroeffentlicht' | 'verworfen';
export const FOLGE_STATUS: readonly FolgeStatus[] = ['idee', 'entwurf', 'freigegeben', 'geplant', 'veroeffentlicht', 'verworfen'];
export const FOLGE_STATUS_NAME: Record<FolgeStatus, string> = {
  idee: 'Idee', entwurf: 'Entwurf', freigegeben: 'Freigegeben', geplant: 'Geplant', veroeffentlicht: 'Veröffentlicht', verworfen: 'Verworfen',
};

/** Eine Messung aus den Plattform-Insights (von Hand, per CSV-Import oder später per API) — nie geschätzt. */
export interface Messung {
  id: string;
  plattform: SocialPlattform;
  /** Tag der Messung (Berliner Tag). */
  am: string;
  views: number;
  /** Anteil, der nach 3 Sekunden noch schaut (0–100). */
  halte3s?: number;
  /** Anteil, der bis zum Ende schaut (0–100). */
  durchsehen?: number;
  schnittSek?: number;
  likes?: number;
  kommentare?: number;
  shares?: number;
  saves?: number;
  follows?: number;
  /** Welche Hook-Variante lief (für den Hook-Vergleich). */
  hookId?: string;
  quelle: 'hand' | 'import' | 'api';
}

export interface Veroeffentlichung { plattform: SocialPlattform; am: string; link?: string }

export interface SocialFolge {
  id: string;
  kanalId: string;
  formatId?: string;
  titel: string;
  saeule?: string;
  skript: string;
  hooks: Hook[];
  hookId?: string;
  cta?: string;
  quellen: string[];
  /** Bild oder Stimme stammen von einer KI → Plattform-Label Pflicht (Art. 50 KI-VO, Plattformregeln). */
  kiInhalt: boolean;
  status: FolgeStatus;
  geplantAm?: string;
  veroeffentlicht: Veroeffentlichung[];
  messungen: Messung[];
  geaendert: string;
  geaendertVon?: string;
}

export interface SocialDatei {
  kanaele: SocialKanal[];
  formate: SocialFormat[];
  folgen: SocialFolge[];
}

export const leereSocial = (): SocialDatei => ({ kanaele: [], formate: [], folgen: [] });

/** Startwerte der Leitplanken (SOCIAL_PLAN.md › 4) — je Kanal änderbar, nie fest im Ablauf. */
export const LEITPLANKEN_VORGABE: Leitplanken = {
  autonomie: 1, postsProTag: 3, antwortenProTag: 100, dmsProTag: 50, postenAus: false, antwortenAus: false, negativSchwelle: 30,
};

/** Grenzen — darüber lehnt der Schreibweg ab (413), nie still gekürzt. */
export const SOCIAL_GRENZEN = {
  ops: 60, kanaele: 20, formate: 200, folgen: 5000, hooks: 8, quellen: 20, messungenJeFolge: 400, veroeffentlichungen: 12,
  skript: 12_000, text: 300, langtext: 2_000, woerterListe: 100,
} as const;

/** Business-Bereich: Social gehört zur Markttraktion, Privat bekommt hier nichts. */
export const NUR_BUSINESS = 'Social gehört zur Markttraktion (Business) — der Privat-Bereich bekommt hier nichts.';
