// ─── Von der KI erzeugte Medien: Ablage und Sicht (09.10.2026, Paket 6a) — Server ─────────────────────────────────────────────
// Kevin 08.10. (Antworten 21/22): Bilder (Nano Banana 2.1/Pro) frei bis zum Budget, Video nur mit Klick. Ablage wie die übrigen Bilder:
//   · Inhalt: Ordner `ki-medien` in BILD_ORDNER (lib/store/datei-huelle.mjs) über `bildAblegen` — verschlüsselt, atomar, Rotation/Skripte/
//     Sicherungsprüfung nehmen ihn mit. Name `km-<uuid>.bin`. Die Bytes des Anbieters gehen UNVERÄNDERT hinein: SynthID (Pixel) und C2PA
//     (Metadaten) bleiben — nie umkodieren, nie durch lib/netzwerken/bild-bereinigen.ts (Wächter tests/ki-medien.test.ts).
//   · Metadaten: Bestand `ki-medien--<haushalt>` — je Medium Art, Anbieter, Modell, eigener Auftragstext (≤ 4.000 Zeichen, darüber 413),
//     Kennzeichnung, Kosten, wer ausgelöst hat, Sichtbarkeit („haushalt“ oder „nur-ich“). Laufende Videos stehen mit `operation` darin,
//     bis der Takt sie abholt (lib/ki/aufruf.ts `kiAuftraegeAbholen`).
// Sicht serverseitig (Plattform-Regel „Trennung serverseitig“): nur der eigene Haushalt; „nur-ich“ nur die auslösende Person; Papierkorb 30
// Tage, danach endgültig (Datei + Eintrag). Keine Personendaten im Auftragstext vorgesehen (Kategorien des Zugangs: allgemein/web).
//
// SEIT PAKET 4c (09.10.) — EINE Medien-Ablage: neue KI-Bilder und fertige KI-Videos landen als Medien in `medien--<haushalt>` bzw.
// `medien-privat--<person>` (lib/medien/ki-ablage.ts, Herkunft `urheber.art = 'ki'`). Dieser Bestand ist nur noch
//   · das AUFTRAGSBUCH laufender Video-Aufträge (`status: 'laeuft'`, `operation`, `ziel`) — der Takt holt ab und legt das Ergebnis in die EINE
//     Ablage (`uebernommenAls` = Kennung des Mediums, keine Datei mehr hier), und
//   · der LESE-ÜBERGANG des Altbestands: fertige Einträge (mit Datei in `<daten>/ki-medien`) übernimmt `kiMedienUebernehmen` einmal; der Eintrag
//     bleibt mit der Marke `uebernommenAls` liegen (Rückweg), seine Datei ebenso (Papierkorb-Regel unten unverändert).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { bildAblegen, bildOeffnen, bildEntfernen } from '@/lib/store/bild-ablage';
import { neueKennung } from '@/lib/kennung';
import type { AnbieterId } from './anbieter';
import type { SichtbarAngabe } from './kennzeichnung';
import type { Einheit } from './modelle';

export const medienSpeicher = (haushalt: string): string => `ki-medien--${haushalt}`;
export const PROMPT_MAX = 4000;
export const PAPIERKORB_TAGE = 30;
const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const ID = /^km-[0-9a-f-]{36}$/;

export interface KiMedium {
  id: string;
  art: 'bild' | 'video';
  status: 'laeuft' | 'fertig' | 'fehler';
  mime?: string;
  bytes?: number;
  anbieter: AnbieterId;
  modell: string;
  erzeugtAm: string;
  fertigAm?: string;
  /** Wer ausgelöst hat (Speichername). */
  person: string;
  sichtbarkeit: 'haushalt' | 'nur-ich';
  /** Eigener Auftragstext der Person bzw. des Agenten (kein Text Dritter). */
  prompt: string;
  /** Kennzeichnung: was der Anbieter einbettet + unsere Herkunftsangabe (zweite Schicht). */
  kennzeichnung: { synthid: boolean; c2pa: boolean; eigeneMarke: true };
  /** Angabe beim Erzeugen (realistische Personen/Orte → sichtbares Zeichen beim Veröffentlichen). */
  sichtbar?: SichtbarAngabe;
  zeichenNoetig: boolean;
  kosten: { euroCent: number; geschaetzt: boolean };
  /** Abrechnungsmengen (Sekunden × Auflösung) — beim Abholen gebucht (lib/zoe/verbrauch.ts). */
  mengen?: Partial<Record<Einheit, number>>;
  /** Laufender Video-Auftrag beim Anbieter (bis abgeholt). */
  operation?: string;
  versuche?: number;
  fehler?: string;
  geloeschtAm?: string;
  /** Paket 4c: wohin das fertige Video in der EINEN Ablage geht (Bereich, Album, Name, vorschlagender Agent). */
  ziel?: { bereich: 'business' | 'privat'; album?: string; name?: string; agent?: string };
  /** Paket 4c: in die EINE Ablage übernommen als Medium `md-…` (Auftragsbuch bzw. Altbestand bleiben liegen). */
  uebernommenAls?: string;
}
interface MedienDatei { medien: KiMedium[] }

export class MedienFehler extends Error { constructor(message: string, public status: number) { super(message); } }

const dateiName = (id: string) => `${id}.bin`;
export const neueMedienKennung = (): string => neueKennung('km');

/** Ein Medium beschreiben und (wenn Bytes da sind) ablegen. */
export async function mediumAblegen(haushalt: string, m: Omit<KiMedium, 'id' | 'erzeugtAm'> & { id?: string }, bytes?: Buffer): Promise<KiMedium> {
  if (!HAUSHALT.test(haushalt)) throw new MedienFehler('Haushalt ungültig.', 400);
  if (!PERSON.test(m.person)) throw new MedienFehler('Person ungültig.', 400);
  if (m.prompt.length > PROMPT_MAX) throw new MedienFehler(`Auftragstext zu lang (höchstens ${PROMPT_MAX} Zeichen).`, 413);
  const id = m.id && ID.test(m.id) ? m.id : neueMedienKennung();
  if (bytes) await bildAblegen('ki-medien', dateiName(id), bytes);
  const eintrag: KiMedium = { ...m, id, erzeugtAm: new Date().toISOString(), ...(bytes ? { bytes: bytes.length, status: 'fertig' as const, fertigAm: new Date().toISOString() } : {}) };
  await updateJson<MedienDatei>(medienSpeicher(haushalt), cur => ({ medien: [...(cur?.medien ?? []).filter(x => x.id !== id), eintrag] }));
  return eintrag;
}

/** Ein laufendes Medium fertig machen bzw. als gescheitert markieren (Takt). */
export async function mediumAbschliessen(haushalt: string, id: string, e: { bytes?: Buffer; mime?: string; fehler?: string; versuch?: boolean; uebernommenAls?: string }): Promise<KiMedium | null> {
  if (!HAUSHALT.test(haushalt) || !ID.test(id)) return null;
  if (e.bytes) await bildAblegen('ki-medien', dateiName(id), e.bytes);
  let raus: KiMedium | null = null;
  await updateJson<MedienDatei>(medienSpeicher(haushalt), cur => ({
    medien: (cur?.medien ?? []).map(x => {
      if (x.id !== id) return x;
      const { operation: _op, ...rest } = x;
      // Paket 4c: in die EINE Ablage übernommen — fertig ohne eigene Datei (bzw. Altbestand mit Marke).
      if (e.uebernommenAls) return (raus = { ...rest, status: 'fertig', uebernommenAls: e.uebernommenAls, ...(x.fertigAm ? {} : { fertigAm: new Date().toISOString() }) });
      raus = e.bytes ? { ...rest, status: 'fertig', bytes: e.bytes.length, ...(e.mime ? { mime: e.mime } : {}), fertigAm: new Date().toISOString() }
        : e.fehler ? { ...rest, status: 'fehler', fehler: e.fehler.slice(0, 200), fertigAm: new Date().toISOString() }
        : e.versuch ? { ...x, versuche: (x.versuche ?? 0) + 1 } : x;
      return raus;
    }),
  }));
  return raus;
}

/** Sicht (rein): eigener Haushalt; „nur-ich“ nur die auslösende Person; ohne Papierkorb (außer `mitPapierkorb`). */
export function medienSicht(liste: readonly KiMedium[], person: string, mitPapierkorb = false): KiMedium[] {
  return liste.filter(m => (m.sichtbarkeit !== 'nur-ich' || m.person === person) && (mitPapierkorb || !m.geloeschtAm));
}

/** Die Medien, die `person` im Haushalt `haushalt` sehen darf. Der Haushalt kommt IMMER aus der Sitzung (haushaltVon), nie aus der Anfrage. */
export async function medienFuer(haushalt: string, person: string, opt: { mitPapierkorb?: boolean } = {}): Promise<KiMedium[]> {
  if (!HAUSHALT.test(haushalt) || !PERSON.test(person)) return [];
  const d = await loadJson<MedienDatei>(medienSpeicher(haushalt));
  return medienSicht(d?.medien ?? [], person, opt.mitPapierkorb);
}

/** Ein Medium öffnen (Bytes) — nur, wenn die Person es sehen darf und es fertig ist. */
export async function mediumOeffnen(haushalt: string, person: string, id: string): Promise<{ medium: KiMedium; bytes: Buffer } | null> {
  if (!ID.test(id)) return null;
  const m = (await medienFuer(haushalt, person)).find(x => x.id === id);
  if (!m || m.status !== 'fertig') return null;
  const bytes = await bildOeffnen('ki-medien', dateiName(id));
  return bytes ? { medium: m, bytes } : null;
}

/** In den Papierkorb (nur, wer es sehen darf; „nur-ich“ nur die Person selbst). */
export async function mediumLoeschen(haushalt: string, person: string, id: string, jetzt = new Date()): Promise<boolean> {
  if (!ID.test(id) || !(await medienFuer(haushalt, person)).some(x => x.id === id)) return false;
  await updateJson<MedienDatei>(medienSpeicher(haushalt), cur => ({ medien: (cur?.medien ?? []).map(x => (x.id === id ? { ...x, geloeschtAm: jetzt.toISOString() } : x)) }));
  return true;
}

/** Papierkorb älter als 30 Tage endgültig (Datei + Eintrag). Gibt die Zahl zurück. */
export async function medienAufraeumen(haushalt: string, jetzt = new Date()): Promise<number> {
  if (!HAUSHALT.test(haushalt)) return 0;
  const grenze = jetzt.getTime() - PAPIERKORB_TAGE * 86_400_000;
  const d = await loadJson<MedienDatei>(medienSpeicher(haushalt));
  const weg = (d?.medien ?? []).filter(m => m.geloeschtAm && Date.parse(m.geloeschtAm) < grenze);
  for (const m of weg) await bildEntfernen('ki-medien', dateiName(m.id)).catch(() => undefined);
  if (weg.length) await updateJson<MedienDatei>(medienSpeicher(haushalt), cur => ({ medien: (cur?.medien ?? []).filter(x => !weg.some(w => w.id === x.id)) }));
  return weg.length;
}

/** Laufende Video-Aufträge eines Haushalts (für den Takt). */
export async function laufendeMedien(haushalt: string): Promise<KiMedium[]> {
  if (!HAUSHALT.test(haushalt)) return [];
  return ((await loadJson<MedienDatei>(medienSpeicher(haushalt)))?.medien ?? []).filter(m => m.status === 'laeuft' && !!m.operation && !m.geloeschtAm);
}
