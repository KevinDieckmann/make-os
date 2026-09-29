// ─── CRM-Vorgänge mit Absichtsprotokoll: Import und Dubletten (29.09., Paket D-C #17/#33) ─
// Beide schreiben erst die Kartei und danach weitere Bestände. Vorher ohne Wiederaufnahme:
//   Import       Kartei → Konflikte → Segment → Firmen-Abgleich → Lauf (Fingerabdrücke, neue Firmen)
//                Abbruch nach der Kartei: Konflikte der Liste verloren, Firmen nicht verknüpft, „Import rückgängig“ ohne
//                Fingerabdrücke (jeder Kontakt galt als „seitdem geändert“).
//   Dubletten    Kartei (zusammengeführt, `weg` gelöscht) → `personUmbiegen` über alle Speicher
//                Abbruch dazwischen: Deals, Ablage, Aufgaben zeigen auf die gelöschte Kennung (#33).
// Jetzt liegt vor dem Kartei-Schreiben eine Absicht (lib/store/absichten.ts); die Schritte danach laufen über
// `importNachlauf` bzw. `personUmbiegen` — live aus der Route und identisch aus der Wiederaufnahme.
//
// War der Kartei-Schritt beim Abbruch noch nicht abgehakt, prüft die Wiederaufnahme am Bestand, ob er wirkte:
//   Import      der Lauf liegt vor und einer seiner neuen Kontakte steht in der Kartei bzw. ein geänderter weicht vom
//               Vorher-Stand ab → gewirkt (die Konflikte der Liste sind dann verloren — Hinweis: Liste erneut
//               importieren, der Import ist idempotent); sonst → verworfen (der Import fand nicht statt).
//   Dubletten   `weg` ist aus der Kartei verschwunden und `behalten` da → gewirkt; sonst verworfen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { absichtAbschliessen, mitVorgang, schrittAbhaken, schrittErledigt, type Absicht, type Vorgang } from '@/lib/store/absichten';
import { aendereCrm, ladeCrm } from './speicher';
import { firmenAbgleichen } from './abgleich';
import { KONFLIKT_SPEICHER, konflikteZusammenfuehren, SEGMENT_VERNETZEN_ID, segmentVernetzen, type KonfliktStand } from './import-konflikte';
import { kontaktAbdruck, laeufeLaden, laufFirmenSetzen, laufNachherSetzen } from './import-lauf';
import type { Wer } from '@/lib/store/aenderungsprotokoll';

// ── Import ───────────────────────────────────────────────────────────────────

export const IMPORT_SCHRITTE = ['kartei', 'konflikte', 'segment', 'firmen', 'lauf'] as const;

/** Die Schritte NACH der Kartei — Route und Wiederaufnahme. Liefert das Ergebnis des Firmen-Abgleichs (falls hier gelaufen). */
export async function importNachlauf(v: Vorgang, alsImport: Wer): Promise<{ firmen?: Awaited<ReturnType<typeof firmenAbgleichen>>; nachher: Kontakt[] }> {
  const laufId = v.daten<string>('laufId')!;
  await v.schritt('konflikte', async () => {
    const st = v.daten<KonfliktStand | null>('konfliktStand');
    // Konflikte NICHT anwenden — ablegen, damit sie in Stammdaten › Austausch einzeln entschieden werden.
    // (a) Zusammenführen statt ersetzen: offene Konflikte früherer Listen bleiben; je Person und Feld gilt der jüngste Listenwert.
    if (st) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => konflikteZusammenfuehren(cur, st));
  });
  // Beim ersten Import das Marketing-Segment „Vernetzen“ anlegen — kalte Leads gehen dorthin, nicht in den Vertrieb.
  // Die Firmen VOR dem Abgleich wandern in die Absicht (W7: nur die neu angelegten gehören zum Lauf).
  await v.schritt('segment', async () => {
    const jetzt = new Date().toISOString();
    await aendereCrm(c => (c.segmente.some(s => s.id === SEGMENT_VERNETZEN_ID) ? c : { ...c, segmente: [...c.segmente, segmentVernetzen(jetzt)] }), alsImport);
    return (await ladeCrm()).firmen.map(f => f.id);
  }, firmenVorher => ({ firmenVorher }));
  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen (idempotent).
  const firmen = await v.schritt('firmen', () => firmenAbgleichen(alsImport));
  let nachher: Kontakt[] = [];
  await v.schritt('lauf', async () => {
    // Fingerabdrücke NACH dem Firmen-Abgleich — so, wie der Import die Kontakte hinterließ.
    nachher = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    if (!v.daten<boolean>('mitLauf')) return;
    await laufNachherSetzen(v.haushalt, laufId, nachher);
    // W7: neu angelegte Firmen, an denen Personen dieses Laufs hängen — mit Fingerabdruck, damit „rückgängig“ sie nur
    // unverändert zurücknimmt.
    const lauf = (await laeufeLaden(v.haushalt)).find(l => l.id === laufId);
    if (!lauf) return;
    const vorher = new Set(v.daten<string[]>('firmenVorher') ?? []);
    const laufPersonen = new Set([...lauf.neu, ...lauf.vorher.map(x => x.id)]);
    const ihreFirmen = new Set(nachher.filter(k => laufPersonen.has(k.id)).flatMap(k => [k.firmaId, ...(k.stationen ?? []).map(st => st.firmaId)]).filter((x): x is string => !!x));
    const neueFirmen = (await ladeCrm()).firmen.filter(f => !vorher.has(f.id) && ihreFirmen.has(f.id));
    await laufFirmenSetzen(v.haushalt, laufId, neueFirmen as unknown as ({ id: string } & Record<string, unknown>)[]);
  });
  return { ...(firmen ? { firmen } : {}), nachher };
}

/** Hat der Kartei-Schritt eines Imports gewirkt? (am Bestand geprüft, rein bis auf das Laden) */
export async function importHatGewirkt(haushalt: string, laufId: string): Promise<boolean> {
  const lauf = (await laeufeLaden(haushalt)).find(l => l.id === laufId);
  if (!lauf) return false; // der Lauf liegt VOR dem Schreiben — ohne Lauf wurde nichts (oder nichts Umkehrbares) geschrieben
  const kontakte = new Map(((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).map(k => [k.id, k]));
  if (lauf.neu.some(id => kontakte.has(id))) return true;
  return lauf.vorher.some(v => { const k = kontakte.get(v.id); return !!k && kontaktAbdruck(k) !== kontaktAbdruck(v); });
}

export async function importFortsetzen(haushalt: string, a: Absicht): Promise<void> {
  if (!schrittErledigt(a, 'kartei')) {
    if (!(await importHatGewirkt(haushalt, String(a.daten.laufId ?? '')))) { await absichtAbschliessen(haushalt, a.id, 'verworfen'); return; }
    // Gewirkt, aber die Konflikte der Liste sind verloren (sie lagen nur im Speicher des abgebrochenen Laufs).
    await schrittAbhaken(haushalt, a.id, 'kartei', { konfliktStand: null, mitLauf: true, konflikteVerloren: true });
    a = { ...a, schritte: a.schritte.map(s => (s.name === 'kartei' ? { ...s, erledigt: new Date().toISOString() } : s)), daten: { ...a.daten, konfliktStand: null, mitLauf: true } };
    console.error('[absichten] Import-Lauf nach Abbruch fortgesetzt — die Konflikte der Liste gingen verloren; die Liste erneut importieren (idempotent).');
  }
  await mitVorgang(haushalt, a, v => importNachlauf(v, { art: 'import', ...(a.person ? { person: a.person } : {}) }));
  await absichtAbschliessen(haushalt, a.id, 'fertig', ['laufId', 'konflikteVerloren']);
}

// ── Dubletten zusammenführen ─────────────────────────────────────────────────

export const ZUSAMMEN_SCHRITTE = ['kartei', 'verweise'] as const;

export async function zusammenfuehrenFortsetzen(haushalt: string, a: Absicht): Promise<void> {
  const behalten = String(a.daten.behalten ?? ''), weg = String(a.daten.weg ?? '');
  if (!schrittErledigt(a, 'kartei')) {
    const k = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    const gewirkt = k.some(x => x.id === behalten) && !k.some(x => x.id === weg);
    if (!gewirkt) { await absichtAbschliessen(haushalt, a.id, 'verworfen'); return; }
    await schrittAbhaken(haushalt, a.id, 'kartei');
    a = { ...a, schritte: a.schritte.map(s => (s.name === 'kartei' ? { ...s, erledigt: new Date().toISOString() } : s)) };
  }
  const { personUmbiegen } = await import('./person-bestaende');
  await mitVorgang(haushalt, a, async v => { await v.schritt('verweise', () => personUmbiegen(weg, behalten)); });
  await absichtAbschliessen(haushalt, a.id, 'fertig', ['laufId']);
}
