// ─── Prozesse — Ansprache einer Person: Kanal-Ampel, § 7 UWG, Werbesperre, Art. 18 (Etappe B1, 21.10.; Kevin 21.10.: Kundengewinnung) ─────────────
// Jeder Baustein, der eine Person anspricht (Katalog-Feld `ansprache`: Mail-/WhatsApp-Entwurf, Einladung, Angebot stellen, Outreach-Aufgabe), prüft VOR
// jeder Wirkung die Kanal-Ampel (lib/crm/recht.ts `kanalStatus` — dieselbe Regel wie Karteikarte, Power Hour und Heads): rot (Werbesperre,
// Einschränkung nach Art. 18, kein zulässiger Weg) heißt „nicht“, gelb heißt „mit Hinweis/Anlass“. EINE Stelle — der Motor (Etappe C) ruft sie je Fall,
// die Werkstatt zeigt, welche Bausteine sie tragen. Rein.

import { kanalStatus, anlassPflicht, type Kanal, type Kontext } from '@/lib/crm/recht';
import type { Kontakt } from '@/lib/make-one/crm';
import type { KatalogEintrag } from './baustein-katalog';
import type { MaskenWert } from './definition';

const KANAELE: readonly Kanal[] = ['mail', 'linkedin', 'telefon', 'newsletter', 'einladung', 'vernetzen', 'whatsapp'];

/** Der Kanal eines Bausteins (fest oder aus seinem Maskenfeld) — null, wenn er niemanden anspricht. */
export function anspracheKanal(e: Pick<KatalogEintrag, 'ansprache'>, werte?: Readonly<Record<string, MaskenWert>>): Kanal | null {
  if (!e.ansprache) return null;
  if (e.ansprache.kanal) return e.ansprache.kanal;
  const v = e.ansprache.kanalFeld ? werte?.[e.ansprache.kanalFeld] : undefined;
  return typeof v === 'string' && (KANAELE as readonly string[]).includes(v) ? v as Kanal : null;
}

export interface AnspracheUrteil { kanal: Kanal; farbe: 'gruen' | 'gelb' | 'rot'; grund: string; erlaubt: boolean; anlassPflicht: boolean }

/**
 * Darf dieser Baustein diese Person ansprechen? (rein) — ohne Kontakt (keine Person) bzw. ohne Kanal: null (nichts zu prüfen). Rot → `erlaubt: false`
 * (der Motor legt dann nichts an und vermerkt den Grund ohne Namen); gelb → erlaubt, beim Anruf mit Anlass-Pflicht.
 */
export function anspracheUrteil(e: Pick<KatalogEintrag, 'ansprache'>, werte: Readonly<Record<string, MaskenWert>> | undefined, k: Kontakt | null | undefined, ctx: Kontext = {}): AnspracheUrteil | null {
  const kanal = anspracheKanal(e, werte);
  if (!kanal || !k) return null;
  const s = kanalStatus(k, kanal, ctx);
  return { kanal, farbe: s.farbe, grund: s.grund, erlaubt: s.farbe !== 'rot', anlassPflicht: kanal === 'telefon' && s.farbe === 'gelb' && anlassPflicht(k, ctx) };
}
