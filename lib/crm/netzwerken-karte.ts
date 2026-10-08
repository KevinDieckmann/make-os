// ─── Netzwerken — Karte automatisch auslesen (02.10.; seit 08.10. eingeschaltet, Woche 1 · 5.13) ──
// Vorher war die Erkennung hier aus (`KARTE_AUSLESEN_AN = false`), in Kartei und Make.One-Abend aber an — ausgerechnet auf dem Event
// wurde getippt. Jetzt läuft sie über DIESELBE Route wie Kartei und Abend (`/api/crm/visitenkarte`: dieselben KI-Regeln — `askText` mit
// `ki`, KI-Tor, Modell-Schranke, das Foto wird dort nicht gespeichert). Die Oberfläche (components/os/netzwerken/Erfassen.tsx) ruft
// `karteAuslesen` beim ERSTEN Foto (Vorderseite) und übernimmt erkannte Felder nur in LEERE Eingabefelder. Ohne KI, gesperrt, offline
// oder unlesbar: kein Feld, nur der Hinweis „bitte tippen“. Das Foto der Erfassung selbst geht wie bisher verschlüsselt an den Kontakt.

import type { KontaktFelder } from './netzwerken';

/** Ein Foto der Karte: Base64 ohne Präfix und sein Medientyp. */
export interface KartenBild { daten: string; typ: string }
/** Ergebnis des Auslesens: erkannte Felder (oder null) und ggf. ein Hinweis für die Person. */
export interface KartenErkennung { erkannt: Partial<KontaktFelder> | null; hinweis?: string }
/** Text, wenn nichts erkannt werden konnte — die Person tippt die Felder. */
export const BITTE_TIPPEN = 'Karte nicht automatisch gelesen — bitte die Felder tippen.';
/** Die Felder der Visitenkarten-Route, die das Netzwerken kennt (der Titel bleibt weg). */
const FELDER: readonly (keyof KontaktFelder)[] = ['vorname', 'nachname', 'firma', 'position', 'email', 'telefon', 'mobil', 'webseite', 'linkedin'];

/**
 * Fotos der Karte → erkannte Felder über `/api/crm/visitenkarte` (die Vorderseite = das erste Foto). Nie erfinden: nur, was die Route
 * zurückgibt; ein Feld ersetzt nie etwas, das die Person schon getippt hat (`ausgelesenesUebernehmen`). `holen` nur für Tests.
 */
export async function karteAuslesen(bilder: readonly KartenBild[], holen: typeof fetch = (...a) => fetch(...a)): Promise<KartenErkennung> {
  const vorne = bilder[0];
  if (!vorne?.daten) return { erkannt: null };
  try {
    const r = await holen('/api/crm/visitenkarte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bild: vorne.daten, medientyp: vorne.typ }) });
    const d = await r.json().catch(() => null) as { ok?: boolean; daten?: Record<string, unknown>; fehler?: string } | null;
    if (!d?.ok || !d.daten) return { erkannt: null, hinweis: typeof d?.fehler === 'string' && d.fehler ? d.fehler : BITTE_TIPPEN };
    const erkannt: Partial<KontaktFelder> = {};
    for (const f of FELDER) { const v = d.daten[f]; if (typeof v === 'string' && v.trim()) (erkannt as Record<string, string>)[f] = v.trim(); }
    return Object.keys(erkannt).length ? { erkannt } : { erkannt: null, hinweis: BITTE_TIPPEN };
  } catch {
    // Offline (Funkloch auf dem Event): nichts gesendet, getippt wird wie immer.
    return { erkannt: null, hinweis: BITTE_TIPPEN };
  }
}

/** Erkannte Felder in die Eingabe übernehmen — nur dort, wo noch nichts steht. */
export function ausgelesenesUebernehmen(eingabe: KontaktFelder, erkannt: Partial<KontaktFelder> | null): KontaktFelder {
  if (!erkannt) return eingabe;
  const raus: KontaktFelder = { ...eingabe };
  for (const [k, v] of Object.entries(erkannt) as [keyof KontaktFelder, string | undefined][]) {
    if (typeof v === 'string' && v.trim() && !(raus[k] ?? '').toString().trim()) (raus as Record<string, string>)[k] = v;
  }
  return raus;
}

// ─── KI-Transkript der Sprachnotiz (vorbereitet, abgeschaltet; 03.10., netz-recht) ──
// Die Sprachnotiz ist heute nur Audio (verschlüsselt am Kontakt, 90 Tage). Ein Transkript würde die Stimme eines Menschen an einen
// KI-Anbieter schicken — das geht erst mit Auftragsverarbeitungsvertrag und Standardvertragsklauseln/DPF des Anbieters (Art. 28, 44 ff. DSGVO).
// Deshalb ein SERVER-Schalter, Standard AUS: `TRANSKRIPTION_AN=1` in der Umgebung des Servers (nie `NEXT_PUBLIC_`, nie im Browser). Läuft
// das Transkript einmal, ERSETZT es das Audio (Text als Notiz am Kontakt, die Audio-Datei fällt weg) — so liegt die Stimme nie länger als nötig.
// Nichts schaltet das ein: dieser Haken liefert heute immer `null`.

/** Server-Schalter: nur mit gesetzter Umgebungsvariable `TRANSKRIPTION_AN=1` — sonst aus. */
export const transkriptionAn = (): boolean => process.env.TRANSKRIPTION_AN === '1';
/** Regel für später: ein erfolgreiches Transkript ersetzt das Audio. */
export const TRANSKRIPT_ERSETZT_AUDIO = true;

/** Sprachnotiz → Text oder `null` (abgeschaltet, nicht erkannt). Heute: nie ein Aufruf nach außen. */
export async function sprachnotizTranskribieren(_bytes: Uint8Array, _typ: string): Promise<string | null> {
  if (!transkriptionAn()) return null;
  // Hier käme der Aufruf des Anbieters — erst nach AVV/SCC. Bis dahin auch bei gesetztem Schalter: nichts senden.
  return null;
}
