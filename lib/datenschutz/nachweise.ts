// ─── Bereitschaft für das Schreibformat v2 (05.10., Paket „Verschlüsselung lückenlos“) — rein, getestet ──────────────
// MAKE_OS_FORMAT=v2 (Hüllen mit Schlüssel-ID + AAD, „MKOSDAT2“, `_v`) stellt Kevin selbst um (UPDATES.md 05.10.). Diese
// Liste sagt, was dafür steht und was noch fehlt — angezeigt unter System › Nachweise. Nur Zustände, keine Inhalte.

export interface V2Eingabe {
  modus: 'kompatibel' | 'v2';
  unbekannt: boolean;
  verschluesselt: boolean;
  schluesselQuelle: 'datei' | 'umgebung' | 'keiner';
  pepper: boolean;
  /** Liegt der Brain-Index (oder ein alter) noch im Klartext auf der Platte? */
  brainIndexKlartext: boolean;
  bilderKlartext: number;
  /** Aus der letzten Durchsicht: Hüllen im anderen Format / Klartext-Bestände (null = noch keine Durchsicht). */
  alteHuellen: number | null;
  klartextBestaende: number | null;
}
export type PunktStand = 'ok' | 'offen' | 'hinweis';
export interface V2Punkt { id: string; titel: string; stand: PunktStand; text: string }
export interface V2Bereitschaft { modus: 'kompatibel' | 'v2'; bereit: boolean; punkte: V2Punkt[] }

export function v2Bereitschaft(e: V2Eingabe): V2Bereitschaft {
  const p: V2Punkt[] = [];
  p.push({ id: 'modus', titel: 'Schreibformat', stand: e.modus === 'v2' ? 'ok' : 'hinweis',
    text: e.modus === 'v2' ? 'v2 aktiv — Schlüssel-ID und AAD (Bestandsname) in jeder Hülle; zurück nur per Sicherung'
      : `Kompatibilitätsmodus${e.unbekannt ? ' (MAKE_OS_FORMAT unbekannt → kompatibel)' : ''} — Rückweg zum alten Stand offen; Umstellung: UPDATES.md (05.10.) „Format v2“` });
  p.push({ id: 'schluessel', titel: 'Datenschlüssel', stand: !e.verschluesselt ? 'offen' : e.schluesselQuelle === 'datei' ? 'ok' : 'hinweis',
    text: !e.verschluesselt ? 'kein Datenschlüssel gesetzt — Bestände im Klartext' : e.schluesselQuelle === 'datei' ? 'als Datei (0400), nicht in der Umgebung' : 'aus der .env — empfohlen: als Datei (NOTFALL.md)' });
  p.push({ id: 'pepper', titel: 'Pepper (Fingerabdrücke v2)', stand: e.pepper ? 'ok' : 'offen',
    text: e.pepper ? 'gesetzt — nach der Umstellung rechnet der Löschfristen-Lauf Sperrliste und Protokoll-Kennungen einmal auf v2 um' : 'MAKE_OS_PEPPER fehlt — ohne ihn bleiben Sperrliste/Protokoll-Kennungen v1 (ungesalzen), auch in v2' });
  p.push({ id: 'bestaende', titel: 'Bestände, Archiv, Ablage', stand: e.klartextBestaende ? 'offen' : e.alteHuellen === null ? 'hinweis' : 'ok',
    text: e.klartextBestaende ? `${e.klartextBestaende} Bestand/Bestände im Klartext — scripts/daten-verschluesselung.mjs --verschluesseln`
      : e.alteHuellen === null ? 'noch keine Durchsicht — läuft nachts ab 4 Uhr'
      : `alle in der Hülle des Modus${e.alteHuellen ? ` (${e.alteHuellen} im anderen Format — stellt jede Schreibung bzw. --verschluesseln um)` : ''}` });
  p.push({ id: 'bilder', titel: 'Bilder (Gerichte, Bauplan)', stand: e.bilderKlartext ? 'offen' : 'ok',
    text: e.bilderKlartext ? `${e.bilderKlartext} altes Bild im Klartext — wird beim ersten Öffnen verschlüsselt, auf einmal mit --verschluesseln` : 'verschlüsselt in derselben Hülle wie die Dateiablage (AAD Ordner/Name)' });
  p.push({ id: 'brain-index', titel: 'Brain-Index', stand: e.brainIndexKlartext ? 'offen' : 'ok',
    text: e.brainIndexKlartext ? 'Klartext-Index auf der Platte — App neu starten (wird überschrieben und gelöscht) bzw. MAKE_OS_BRAIN_INDEX_PLATTE entfernen' : 'nur im tmpfs bzw. Arbeitsspeicher, nie auf der Platte' });
  p.push({ id: 'aussen', titel: 'Bewusst außerhalb der Hülle', stand: 'hinweis',
    text: 'Obsidian-Vault (eigenes Git-Repo), Grabsteine (nur HMAC), Lagebericht system/*.json (nur Zähler) — siehe datenschutz/TOM.md' });
  const bereit = e.verschluesselt && !e.klartextBestaende && !e.bilderKlartext && !e.brainIndexKlartext;
  return { modus: e.modus, bereit, punkte: p };
}
