// ─── Kalender — wohin kommt ein neuer Termin? EINE Zuordnung (03.10.2026) ────
// Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“
//   Business / MAKE   → der Google Kalender der Person („MAKE Kevin (Google)“), sobald sie verbunden ist
//   Privat            → bleibt wie heute: der iCloud-Kalender der Person (Kalender-Einstellungen)
//   Gemeinsam         → bleibt wie heute: iCloud „Gemeinsam“
// Jeder MAKE-OS-Kalender hat genau EIN externes Zuhause — kein Termin entsteht in zwei Quellen. Ist die Person NICHT mit
// Google verbunden (oder nur lesend), gilt für Business der bisherige Weg (iCloud) — der Rückfall ist der heutige Stand.
//
// Wer neue Termine schreibt, fragt NUR hier: `kalenderZiel(person, art)`. Wer ihn schon kennt (Browser-Dialog mit
// Kalendername), schickt `kalender` — dann gilt diese Wahl, nie eine stille Umleitung.

import { ladeEinstellungen, type KalenderEinstellungen } from '../einstellungen';
import { googleKalenderNamen } from './namen';
import type { KalenderBereich } from '../bereich';

export { googleKalenderNamen };

export { istBereich, type KalenderBereich } from '../bereich';
export interface KalenderZielErgebnis {
  quelle: 'google' | 'icloud';
  /** Name des Kalenders (wie im Stand) — undefined: für diese Person ist nichts hinterlegt. */
  kalender: string | undefined;
  /** Bei Google: wessen Konto. */
  person?: string;
}

/** Rein: aus den Einstellungen und den verbundenen Google-Kalendern (Person → Kalendername) das Ziel. */
export function zielRein(o: { person: string; art: KalenderBereich; icloud: Partial<Record<string, string>>; google: Readonly<Record<string, string>> }): KalenderZielErgebnis {
  if (o.art === 'gemeinsam') return { quelle: 'icloud', kalender: o.icloud.beide };
  if (o.art === 'business' && o.google[o.person]) return { quelle: 'google', kalender: o.google[o.person], person: o.person };
  return { quelle: 'icloud', kalender: o.icloud[o.person] };
}

export async function kalenderZiel(person: string, art: KalenderBereich, einst?: Pick<KalenderEinstellungen, 'kalender'>): Promise<KalenderZielErgebnis> {
  const e = einst ?? await ladeEinstellungen();
  const google = art === 'business' ? await googleKalenderNamen() : {};
  return zielRein({ person, art, icloud: e.kalender, google });
}

// ── Business „Für wen“ (01.11.) ─────────────────────────────────────────────
// Kevin 01.11.: „Jeder hat Zugang zu seinem Google-Kalender und jeder plant seine Woche.“ Im Business-Bereich:
//   · eine Person (Fach) → ihr Google-Hauptkalender (Fach → Person über die Konten, nie ein fester Name); ohne Google wie bisher ihr
//     iCloud-Kalender; fehlt beides, eine klare Meldung mit dem Weg zum Verbinden (statt eines iCloud-Fehlers).
//   · „Gemeinsam“ → der Google-Kalender der ANLEGENDEN Person, die anderen Personen des Haushalts als Gäste (ihre Google-Adresse). Die
//     Einladung geht nie still: `anlegen` verlangt die Bestätigung (`EinladungNoetig` → Rückfrage mit den Adressen).
//     Ist eine Person nicht mit Google verbunden → Meldung mit dem Weg zum Verbinden.

export const GOOGLE_VERBINDEN_WEG = 'Kalender › Einstellungen › Google Kalender verbinden';
export interface BusinessZiel { kalender: string; gaeste: { email: string; name?: string }[] }
export interface BusinessZielFehler { fehler: string; verbinden: 'google' }

/** Rein: aus Fach, Personen hinter den Fächern, Google-Kalendern (Person → Name) und Google-Adressen (Person → Adresse) das Ziel. */
export function businessZielRein(o: {
  wer: 'kevin' | 'malin' | 'beide'; anlegend: string;
  personen: Partial<Record<'kevin' | 'malin', { id: string; name: string }>>;
  google: Readonly<Record<string, string>>; adressen: Readonly<Record<string, string>>; icloud: Partial<Record<string, string>>;
}): BusinessZiel | BusinessZielFehler {
  const vorname = (p: { name: string } | undefined, ersatz: string) => (p?.name ?? '').trim().split(/\s+/)[0] || ersatz;
  if (o.wer !== 'beide') {
    const p = o.personen[o.wer];
    const id = p?.id ?? o.wer;
    if (o.google[id]) return { kalender: o.google[id], gaeste: [] };
    if (o.icloud[o.wer]) return { kalender: o.icloud[o.wer]!, gaeste: [] };
    return { fehler: `${vorname(p, 'Diese Person')} hat keinen Google-Kalender verbunden — ${GOOGLE_VERBINDEN_WEG} (angemeldet als diese Person).`, verbinden: 'google' };
  }
  const eigen = o.google[o.anlegend];
  if (!eigen) return { fehler: `„Gemeinsam“ im Business legt den Termin in deinem Google-Kalender an — bitte zuerst verbinden: ${GOOGLE_VERBINDEN_WEG}.`, verbinden: 'google' };
  const andere = (['kevin', 'malin'] as const).map(f => o.personen[f]).filter((p): p is { id: string; name: string } => !!p && p.id !== o.anlegend);
  const gaeste: BusinessZiel['gaeste'] = [];
  for (const p of andere) {
    const mail = o.adressen[p.id];
    if (!o.google[p.id] || !mail) return { fehler: `${vorname(p, 'Die andere Person')} hat keinen Google-Kalender verbunden — so kann MAKE OS nicht einladen. ${GOOGLE_VERBINDEN_WEG} (angemeldet als diese Person).`, verbinden: 'google' };
    const v = vorname(p, '');
    gaeste.push({ email: mail, ...(v ? { name: v } : {}) });
  }
  return { kalender: eigen, gaeste };
}

/** Das Ziel eines neuen Business-Termins ohne gewählten Kalender (Server). */
export async function businessZiel(anlegend: string, wer: 'kevin' | 'malin' | 'beide', einst?: Pick<KalenderEinstellungen, 'kalender'>): Promise<BusinessZiel | BusinessZielFehler> {
  const { fachKonten } = await import('../einstellungen');
  const { ladeGoogleStand } = await import('./stand');
  const [e, google, personen] = await Promise.all([einst ? Promise.resolve(einst) : ladeEinstellungen(), googleKalenderNamen(), fachKonten().catch(() => ({}))]);
  const adressen: Record<string, string> = {};
  for (const p of Object.keys(google)) { const s = await ladeGoogleStand(p).catch(() => null); if (s?.email) adressen[p] = s.email; }
  return businessZielRein({ wer, anlegend, personen, google, adressen, icloud: e.kalender });
}
