// ─── MAKE OS — Social: Fotos und Videos eines Beitrags (28.10.2026, Malin-Paket) ──────────────────────────────────────────────────────
// Kevin 28.10.: „Malin muss grundsätzlich alles machen können … Reels schneiden, erstellen lassen, planen.“ Ein Beitrag trägt nur KENNUNGEN
// aus der EINEN Medien-Ablage (lib/medien, Bereich Business — Social gehört zur Markttraktion). Ob ein Medium raus darf, entscheidet die
// Ablage: Freigabe fürs Marketing mit Kanal „Social Media“ durch einen Menschen, Einwilligungen der abgebildeten Personen, Widerruf, Ablauf
// (`wirksamerStatus`) — das hier liest es nur und übersetzt es in Befunde für den Prüfer und in „kann“ der Anbieter.
//   · rein: `SocialMedium` (die Lese-Form), `medienBefunde` (Prüfer), `instagramMedien` (was Instagram aus diesen Medien posten kann)
//   · Server: `socialMedienLesen` (Business-Katalog des Haushalts, nur Kennungen der Folgen; nie Schlüssel, nie Objekt-Namen)
// Videos gehen nur als Ergebnis der Reel-Werkstatt raus (`abgeleitetVon.art === 'schnitt'`): nur dort ist garantiert, was Instagram verlangt
// (H.264/AAC, 9:16, Länge) — ein iPhone-Original (HEVC/MOV) würde sonst erst bei Meta scheitern.

import type { FreigabeStatus } from '@/lib/medien/typen';
import type { InhaltArt, SocialFolge, SocialFormat } from './typen';
import type { Befund } from './pruefer';

export interface SocialMedium {
  id: string;
  art: 'bild' | 'video';
  typ: string;
  breite?: number; hoehe?: number; dauerSek?: number;
  /** Ton eines Videos (Ablage: „Ton standardmäßig aus“). */
  ton?: 'keiner' | 'entfernt' | 'an' | 'nicht-freigegeben';
  name?: string;
  /** Von einer KI erzeugt (Herkunft der Ablage, nie änderbar). */
  ki: boolean;
  /** Fertig aus der Reel-Werkstatt (für Instagram geprüftes Format). */
  schnitt: boolean;
  /** Status, der JETZT gilt (Sperren durch Personen sofort). */
  status: FreigabeStatus;
  /** Für den Kanal „Social Media“ freigegeben? */
  social: boolean;
  bis?: string;
  geloescht: boolean;
}

const SPERRE_TEXT: Partial<Record<FreigabeStatus, string>> = {
  intern: 'ist noch nicht fürs Marketing freigegeben',
  angefragt: 'wartet noch auf die Freigabe',
  gesperrt: 'ist gesperrt (Einwilligung, Widerruf oder von Hand)',
  abgelaufen: 'ist abgelaufen (Freigabe „bis“ vorbei)',
};

/** Befunde zu den Medien einer Folge (rein, für den Prüfer). `medien` = gelesen über `socialMedienLesen`; fehlt eine Kennung = weg. */
export function medienBefunde(f: Pick<SocialFolge, 'medien' | 'kiInhalt'>, medien: ReadonlyMap<string, SocialMedium | null> | undefined): Befund[] {
  const ids = f.medien ?? [];
  if (!ids.length || !medien) return [];
  const b: Befund[] = [];
  ids.forEach((id, i) => {
    const m = medien.get(id);
    const nr = ids.length > 1 ? ` ${i + 1}` : '';
    if (!m || m.geloescht) { b.push({ stufe: 'stopp', code: 'medium-weg', text: `Medium${nr} gibt es nicht mehr (gelöscht oder nicht sichtbar) — aus dem Beitrag nehmen.` }); return; }
    if (m.status !== 'freigegeben') { b.push({ stufe: 'stopp', code: 'medium-freigabe', text: `Medium${nr} ${SPERRE_TEXT[m.status] ?? 'ist nicht freigegeben'} — in der Medien-Ablage freigeben (Kanal „Social Media“).` }); return; }
    if (!m.social) b.push({ stufe: 'stopp', code: 'medium-kanal', text: `Medium${nr} ist freigegeben, aber nicht für „Social Media“ — Freigabe in der Medien-Ablage erweitern.` });
    if (m.art === 'video' && m.ton === 'nicht-freigegeben') b.push({ stufe: 'stopp', code: 'medium-ton', text: `Video${nr}: der Ton ist nicht freigegeben — so geht es nie raus.` });
    if (m.ki && !f.kiInhalt) b.push({ stufe: 'stopp', code: 'medium-ki', text: `Medium${nr} ist von einer KI erzeugt — den Beitrag als KI-Inhalt kennzeichnen (Art. 50 KI-VO, Plattform-Label).` });
  });
  return b;
}

/** Instagram nimmt Bilder nur als JPEG (Doku Content Publishing) und Videos nur aus der Werkstatt (s. Kopf). */
const igBild = (m: SocialMedium) => m.art === 'bild' && m.typ === 'image/jpeg';
const igVideo = (m: SocialMedium) => m.art === 'video' && m.schnitt;

export type IgPlan =
  | { ok: true; art: 'bild' | 'reel' | 'karussell'; medien: SocialMedium[] }
  | { ok: false; grund: string };

/**
 * Was Instagram aus diesen Medien posten kann (rein): Bild = genau ein JPEG · Reel = genau ein Werkstatt-Video · Karussell = 2–20 Elemente
 * (JPEG oder Werkstatt-Video). Textposts gibt es auf Instagram nicht. Die Freigabe prüft der Prüfer (medienBefunde) — hier nur die Form.
 */
export function instagramMedien(f: Pick<SocialFolge, 'medien'>, format: Pick<SocialFormat, 'art'> | null | undefined, medien: ReadonlyMap<string, SocialMedium | null> | undefined): IgPlan {
  const art: InhaltArt = format?.art ?? 'video';
  const l = (f.medien ?? []).map(id => medien?.get(id) ?? null);
  if (art === 'text') return { ok: false, grund: 'Instagram kennt keine reinen Textposts — ein Bild, Karussell oder Reel anhängen.' };
  if (!l.length) return { ok: false, grund: art === 'video' ? 'Noch kein Video — in der Reel-Werkstatt aus euren Clips schneiden und anhängen.' : 'Noch kein Bild angehängt — aus der Medien-Ablage wählen.' };
  if (l.some(m => !m)) return { ok: false, grund: 'Ein angehängtes Medium fehlt.' };
  const ms = l as SocialMedium[];
  const unpassend = ms.find(m => !(igBild(m) || igVideo(m)));
  if (unpassend) {
    return { ok: false, grund: unpassend.art === 'bild'
      ? 'Instagram nimmt nur JPEG — das Bild in der Reel-Werkstatt als JPEG speichern (oder ein JPEG wählen).'
      : 'Videos gehen nur aus der Reel-Werkstatt raus (dort wird das Format geprüft: H.264, 9:16) — das Video dort einmal durchlaufen lassen.' };
  }
  if (art === 'karussell') {
    if (ms.length < 2) return { ok: false, grund: 'Ein Karussell braucht mindestens 2 Bilder oder Videos.' };
    if (ms.length > 20) return { ok: false, grund: 'Ein Karussell hat höchstens 20 Elemente.' };
    return { ok: true, art: 'karussell', medien: ms };
  }
  if (art === 'video') {
    if (ms.length !== 1 || ms[0].art !== 'video') return { ok: false, grund: 'Ein Reel ist genau ein Video.' };
    return { ok: true, art: 'reel', medien: ms };
  }
  if (ms.length === 1 && ms[0].art === 'bild') return { ok: true, art: 'bild', medien: ms };
  return { ok: ms.length >= 2, ...(ms.length >= 2 ? { art: 'karussell', medien: ms } : { grund: 'Ein Bildpost ist genau ein Bild.' }) } as IgPlan;
}

// ── Server ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Medien der angegebenen Kennungen aus dem Business-Katalog des Haushalts lesen (nur Kennungen aus Folgen, nie Listen roh). Fehlt die
 * Medien-Ablage oder ein Medium, steht `null` da. Nie Schlüssel, Objekt-Namen oder Salze.
 */
export async function socialMedienLesen(ids: readonly string[]): Promise<Map<string, SocialMedium | null>> {
  const raus = new Map<string, SocialMedium | null>();
  const eindeutig = Array.from(new Set(ids));
  if (!eindeutig.length) return raus;
  try {
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const { katalogName, ladeKatalog, lageFuer } = await import('@/lib/medien/server');
    const { wirksamerStatus } = await import('@/lib/medien/regeln');
    const kat = await ladeKatalog(katalogName('business', await karteiHaushalt()));
    const lage = await lageFuer(kat);
    for (const id of eindeutig) {
      const m = kat.medien.find(x => x.id === id);
      if (!m) { raus.set(id, null); continue; }
      const w = wirksamerStatus(m, lage);
      raus.set(id, {
        id: m.id, art: m.art, typ: m.typ, breite: m.breite, hoehe: m.hoehe, dauerSek: m.dauerSek, ton: m.ton, name: m.name,
        ki: m.urheber.art === 'ki', schnitt: m.abgeleitetVon?.art === 'schnitt',
        status: w.status, social: (m.marketing.kanaele ?? []).includes('social'), bis: m.marketing.bis, geloescht: !!m.geloeschtAm,
      });
    }
  } catch {
    for (const id of eindeutig) if (!raus.has(id)) raus.set(id, null);
  }
  return raus;
}
