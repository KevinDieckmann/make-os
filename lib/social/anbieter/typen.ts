// ─── MAKE OS — Social: Anbieter-Schnittstelle (Veröffentlichen + Zahlen holen) — 27.10.2026 ──────────────────────────────────────────
// Jeder Weg auf eine Plattform (LinkedIn, Instagram, TikTok, YouTube, ein Scheduler) ist EIN Anbieter mit derselben Form. Der Veröffentlicher
// (lib/social/veroeffentlichen-server.ts) kennt nur diese Schnittstelle; ob gepostet werden DARF, entscheidet vorher allein `autonomieFuer`.
// Zugangsdaten (Token) liegen nur serverseitig im Bestand `social-verbindungen--<haushalt>` (verbindungen.ts) — ein Anbieter bekommt sie
// beim Aufruf und gibt sie nie zurück. Fakten zu den Plattformen nur aus offizieller Doku (research/social/FAKTEN_VEROEFFENTLICHEN.md).

import type { SocialFolge, SocialFormat, SocialKanal, SocialPlattform } from '../typen';
import type { SocialMedium } from '../medien';

export type AnbieterId = 'probe' | 'linkedin' | 'instagram';

export interface VerbindungGeheim {
  accessToken: string;
  /** Ablauf des Zugriffstokens (ms seit 1970). */
  ablauf?: number;
  refreshToken?: string;
  refreshAblauf?: number;
  /** Wer postet bei der Plattform (z. B. LinkedIn `urn:li:person:…`, Instagram die Kennung des Professional-Kontos). */
  autor?: string;
  /** Wann das Token ausgestellt bzw. zuletzt verlängert wurde (ms) — Instagram verlängert erst ab 24 h. */
  ausgestellt?: number;
  scopes?: string[];
}

export interface PostEingabe {
  kanal: SocialKanal;
  folge: SocialFolge;
  format: SocialFormat | null | undefined;
  /** Der fertige Text (postText) — Anbieter ändern ihn nicht. */
  text: string;
  /** Die angehängten Medien (frisch gelesen, vom Prüfer freigegeben), in Reihenfolge. */
  medien?: SocialMedium[];
  /** Öffentliche, kurzlebige Adresse eines Mediums für Plattformen, die selbst abholen (lib/social/medien-link.ts) — null ohne MAKE_OS_ADRESSE. */
  link?: (m: SocialMedium) => Promise<string | null>;
}

export type PostErgebnis =
  | { ok: true; externeId?: string; link?: string }
  /** Die Plattform verarbeitet noch (Instagram-Container) — `warten` = Zustand für `weiter` (nie ein Token). Der nächste Lauf setzt fort. */
  | { ok: 'warten'; warten: string }
  /** `unklar` = die Anfrage ging hinaus, die Antwort fehlt (Zeitüberschreitung) — nie automatisch wiederholen. `erneuern` = Zugang abgelehnt. */
  | { ok: false; text: string; unklar?: boolean; erneuern?: boolean };

export interface Zahlen { views?: number; likes?: number; kommentare?: number; shares?: number; saves?: number; follows?: number }

export interface SocialAnbieter {
  id: AnbieterId;
  plattform: SocialPlattform;
  name: string;
  /** Kann dieser Weg diese Folge selbst veröffentlichen? (Video braucht eine Datei, die MAKE OS heute nicht erzeugt.) */
  kann(f: SocialFolge, format: SocialFormat | null | undefined, medien?: ReadonlyMap<string, SocialMedium | null>): { ok: true } | { ok: false; grund: string };
  posten(g: VerbindungGeheim, e: PostEingabe): Promise<PostErgebnis>;
  /** Einen wartenden Versuch fortsetzen (nur Anbieter, die `warten` liefern). */
  weiter?(g: VerbindungGeheim, warten: string, e: PostEingabe): Promise<PostErgebnis>;
  /** Zugang verlängern, bevor er abläuft (Instagram: langlebiges Token ≥ 24 h alt) — null = nicht nötig/nicht möglich. */
  erneuern?(g: VerbindungGeheim, jetzt: number): Promise<VerbindungGeheim | null>;
  /** Zahlen eines eigenen Beitrags — null, wenn die Plattform sie (für diesen Zugang) nicht herausgibt. */
  messen?(g: VerbindungGeheim, externeId: string): Promise<Zahlen | null>;
}

/** Text eines Beitrags aus der Folge: Skript, dann der Aufruf (wenn er nicht schon drinsteht). Rein. */
export function postText(f: Pick<SocialFolge, 'skript' | 'cta' | 'beschriftung'>): string {
  // Beschriftung (28.10.) gewinnt: bei Bild/Karussell/Reel ist sie der Post-Text (das Skript ist gesprochen).
  if (f.beschriftung?.trim()) return f.beschriftung.trim();
  const s = f.skript.trim();
  const cta = f.cta?.trim();
  return cta && !s.toLowerCase().includes(cta.toLowerCase()) ? `${s}\n\n${cta}` : s;
}

/** Nur Text-Beiträge gehen ohne Datei — die EINE Regel für alle Anbieter ohne Medien-Upload. */
export function nurText(f: SocialFolge, format: SocialFormat | null | undefined): { ok: true } | { ok: false; grund: string } {
  const art = format?.art ?? 'video';
  if (art === 'text') return { ok: true };
  if (art === 'video') return { ok: false, grund: 'Video: die Datei produziert ihr (oder ein Video-Werkzeug) — dann von Hand hochladen und als veröffentlicht eintragen.' };
  return { ok: false, grund: `${art === 'karussell' ? 'Karussell' : 'Bild'}: braucht eine Bilddatei — dieser Weg postet nur Text.` };
}
