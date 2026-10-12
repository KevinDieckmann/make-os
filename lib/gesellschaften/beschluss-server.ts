// ─── Unternehmen › Beschlüsse & Satzung: Server — Folgen in den Stapel, Freigabe, Dokument → Vorschlag, Buch als PDF (10.10.) ─────────────
// Liest und schreibt NUR über die vorhandenen Wege: Gesellschafts-Register (`ladeRegister`, Schreibstelle `registerAendern` + `eintragSchreiben`),
// Unternehmen › Schild (`ladeSchild`, Schreibstelle `schildAendern`, Erinnerungen `schildErinnerungen`), Aufgaben (`systemAufgabenAendern`),
// verschlüsselte Ablage (`lesen`), Freigabe-Stapel (`lege`, Art „recht“ — die Freigabe läuft über lib/recht/server.ts `RECHT_STAPEL_ART`).
// Zugang wie das Register bzw. der Head of Recht: Haushalt des Inhabers mit vollem Haushaltszugang (`rechtZugangFuer`) — Konto „nur Business“,
// Testkunde, fremder Haushalt bekommen nichts. Nichts geschieht automatisch: Folgen eines gefassten Beschlusses liegen als Vorschlag im Stapel,
// erst der Klick wirkt. Hinweis, keine Rechtsberatung.

import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { WEG } from '@/lib/wege';
import { istGesellschaft, gehoertZuPrivat, istGesellschaftId, type GesellschaftId } from '@/lib/einheiten';
import { aktiveEintraege, anzeigeName, gesellschaftVon, type Beschluss, type RegisterDatei, type RegisterGesellschaft } from './modell';
import { AELTER_HINWEIS, beschlussFolgen, beschlussNummern, buchDokument, fassungAb, folgenFaellig, nummerText, type BeschlussFolge } from './beschluesse';
import { beschlussAusText, type ImportVorschlag } from './beschluss-import';
import type { Vorschlag } from '@/lib/zoe/stapel';

export class BeschlussFehler extends Error { constructor(msg: string, readonly status: 400 | 403 | 404 | 409 | 413) { super(msg); } }

/** Die Werkzeuge im Stapel (Art „recht“) — nur Etiketten; die Freigabe rechnet alles neu aus dem Bestand. */
export const BESCHLUSS_WERKZEUGE = { ereignis: 'recht_beschluss_ereignis', fassung: 'recht_beschluss_fassung', 'cap-table': 'recht_beschluss_captable' } as const;
export type BeschlussWerkzeug = (typeof BESCHLUSS_WERKZEUGE)[keyof typeof BESCHLUSS_WERKZEUGE];
export const istBeschlussWerkzeug = (w: string): w is BeschlussWerkzeug => (Object.values(BESCHLUSS_WERKZEUGE) as string[]).includes(w);
/** Marke im Bestand des Head of Recht (gegen Wiederholung): je Beschluss und Folge. */
export const folgeMarke = (schluessel: string) => `bf:${schluessel}`;

async function lade(haushalt: string, gid: string, beschlussId: string): Promise<{ register: RegisterDatei | null; g: RegisterGesellschaft; b: Beschluss }> {
  const { ladeRegister } = await import('./server');
  const register = await ladeRegister(haushalt);
  const g = gesellschaftVon(register, gid);
  if (!g || g.geloeschtAm) throw new BeschlussFehler('Gesellschaft nicht gefunden.', 404);
  const b = aktiveEintraege(g.beschluesse).find(x => x.id === beschlussId);
  if (!b) throw new BeschlussFehler('Beschluss nicht gefunden.', 404);
  return { register, g, b };
}

/** Die Folgen JETZT (mit Schild-Kontext, falls die Gesellschaft im Schild steht) — dieselbe Rechnung für Stapel, Freigabe und Oberfläche. */
export async function folgenJetzt(haushalt: string, register: RegisterDatei | null, g: RegisterGesellschaft, b: Beschluss): Promise<{ folgen: BeschlussFolge[]; hinweise: string[] }> {
  const [{ ladeSchild, schildZiel }, { eintragVon }, { kontextVon }] = await Promise.all([import('./schild-server'), import('./schild/ampel'), import('./schild/kontext')]);
  const imSchild = !!schildZiel(register, g.id).g;
  const s = imSchild ? eintragVon(await ladeSchild(haushalt), g.id) : undefined;
  return beschlussFolgen(g, b, { kontext: imSchild ? kontextVon(g, s) : null, ereignisseDa: aktiveEintraege(s?.ereignisse) });
}

/**
 * Nach „gefasst“ (Register-Route): die Folgen des Beschlusses als Vorschläge in den Stapel — für die Person, die ihn gefasst gestellt hat (nur mit
 * Zugang zur Firmen-Akte). Von selbst nur für junge Beschlüsse (`folgenFaellig`, ≤ 90 Tage) — nachgetragene ältere nur mit `ausdruecklich` (Knopf
 * „Folgen vorschlagen“, POST /api/gesellschaften/beschluesse). Je Beschluss und Folge höchstens einmal (Marke im Bestand des Head of Recht; der Stapel
 * legt offene Doppelte ohnehin nicht zweimal). Wirft nie.
 */
export async function beschlussFolgenLegen(haushalt: string, person: string, gid: string, beschlussId: string, o: { ausdruecklich?: boolean; heute?: string } = {}): Promise<{ gelegt: number; hinweise: string[]; aelter?: true }> {
  const heute = o.heute ?? localDay();
  try {
    const r = await import('@/lib/recht/server');
    const z = await r.rechtZugangFuer(person);
    if (!z || z.haushalt !== haushalt) return { gelegt: 0, hinweise: [] };
    const { register, g, b } = await lade(haushalt, gid, beschlussId);
    if (b.status === 'entwurf' || b.status === 'aufgehoben') return { gelegt: 0, hinweise: [] };
    if (!o.ausdruecklich && !folgenFaellig(b, heute)) return { gelegt: 0, hinweise: [AELTER_HINWEIS], aelter: true };
    const { folgen, hinweise } = await folgenJetzt(haushalt, register, g, b);
    const stand = await r.ladeRechtStand(haushalt);
    const neu = folgen.filter(f => !stand.marken?.[folgeMarke(f.schluessel)]);
    if (!neu.length) return { gelegt: 0, hinweise };
    const [{ lege }, { rechtHash }, { headDef }] = await Promise.all([import('@/lib/zoe/stapel'), import('@/lib/recht/check'), import('@/lib/agenten/katalog')]);
    const head = headDef('recht')?.name ?? 'Recht';
    const name = anzeigeName(g);
    const nr = nummerText(beschlussNummern(g.beschluesse).get(b.id));
    for (const f of neu) {
      await lege({
        werkzeug: BESCHLUSS_WERKZEUGE[f.art], gruppe: 'business', titel: `${f.titel} — ${name}`.slice(0, 200), nachher: f.text.slice(0, 600),
        eingabe: { gesellschaftId: g.id, beschlussId: b.id, folge: f.schluessel },
        anlass: `${head}: Beschluss ${nr} „${b.titel}“ ist gefasst`.slice(0, 200), quelle: 'lauf', person, bezug: { art: 'recht', id: `beschluss-${rechtHash(f.schluessel)}` },
      });
    }
    await r.rechtMarkenSetzen(haushalt, neu.map(f => folgeMarke(f.schluessel)), heute);
    const { melde } = await import('@/lib/meldungen/melden');
    await melde({ an: person, art: 'vertrag', titel: `${head}: ${neu.length} Folge${neu.length === 1 ? '' : 'n'} des Beschlusses ${nr} liegen im Stapel`, link: WEG.freigaben(undefined, 'business'), bezug: { art: 'aufgabe', id: `rck-b-${rechtHash(b.id)}` } });
    return { gelegt: neu.length, hinweise };
  } catch (e) {
    console.error('[beschluesse] Folgen nicht gelegt:', e instanceof Error ? e.message : e);
    return { gelegt: 0, hinweise: [] };
  }
}

const text = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : '');

/**
 * Freigabe einer Folge (aus lib/recht/server.ts `RECHT_STAPEL_ART`, Zugang dort geprüft): die Folge wird aus dem JETZIGEN Bestand neu gerechnet —
 * ist sie inzwischen erledigt oder nicht mehr nötig, passiert nichts (Satz zurück). Ereignis → Schild (Pflichten-Kalender, Erinnerungen sofort),
 * Fassung → Register (Historie, Steckbrief zieht nach), Cap-Table → Aufgabe (feste Kennung, idempotent).
 */
export async function beschlussFolgeFreigeben(v: Vorschlag, haushalt: string, person: string): Promise<string> {
  const gid = text(v.eingabe.gesellschaftId, 80), beschlussId = text(v.eingabe.beschlussId, 80), schluessel = text(v.eingabe.folge, 200);
  if (!istGesellschaftId(gid) || !beschlussId || !schluessel) throw new BeschlussFehler('Vorschlag unvollständig.', 400);
  const { register, g, b } = await lade(haushalt, gid, beschlussId);
  const nr = nummerText(beschlussNummern(g.beschluesse).get(b.id));
  if (v.werkzeug === BESCHLUSS_WERKZEUGE['cap-table']) return capTableAufgabe(g, b, nr, person);
  const f = (await folgenJetzt(haushalt, register, g, b)).folgen.find(x => x.schluessel === schluessel);
  if (!f) return 'Nichts mehr zu tun — die Folge ist inzwischen erledigt oder nicht mehr nötig (Status bzw. Fassung des Beschlusses geändert).';
  if (f.art === 'ereignis') return ereignisAnlegen(haushalt, person, g, b, f, nr);
  if (f.art === 'fassung') return fassungAnlegen(haushalt, person, g.id, b, f);
  return capTableAufgabe(g, b, nr, person);
}

async function ereignisAnlegen(haushalt: string, person: string, g: RegisterGesellschaft, b: Beschluss, f: BeschlussFolge, nr: string): Promise<string> {
  const [{ schildAendern, ladeSchild, schildEintrag, schildStand, schildErinnerungen }, { SCHILD_GRENZEN }, { ereignisDef }] = await Promise.all([
    import('./schild-server'), import('./schild/typen'), import('./schild/pflichten'),
  ]);
  const def = ereignisDef(f.ereignis ?? '');
  if (!def) throw new BeschlussFehler('Unbekanntes Ereignis.', 400);
  for (let versuch = 0; versuch < 2; versuch++) {
    const stand = schildStand(schildEintrag(await ladeSchild(haushalt), g.id));
    let schonDa = false;
    const r = await schildAendern(haushalt, person, g.id, stand, { art: 'person', person }, alt => {
      const l = alt.ereignisse ?? [];
      if (l.some(e => !e.geloeschtAm && e.art === def.id && e.beschlussId === b.id)) { schonDa = true; return { fehler: [{ feld: 'ereignisse', text: 'schon da' }], status: 409 }; }
      if (l.length >= SCHILD_GRENZEN.ereignisse) return { fehler: [{ feld: 'ereignisse', text: `Höchstens ${SCHILD_GRENZEN.ereignisse} Ereignisse — erst eines im Papierkorb ablegen.` }], status: 413 };
      return { s: { ...alt, ereignisse: [...l, { id: neueKennung('ev'), art: def.id, datum: b.datum, notiz: `Aus Beschluss ${nr} „${b.titel}“`.slice(0, 1000), beschlussId: b.id, angelegt: new Date().toISOString() }] } };
    });
    if (schonDa) return `Das Ereignis „${def.label}“ steht schon im Pflichten-Kalender — nichts doppelt angelegt.`;
    if (r.konflikt) continue;
    if (r.fehler?.length) throw new BeschlussFehler(r.fehler.map(x => x.text).join(' · '), r.status === 413 ? 413 : r.status === 404 ? 404 : 400);
    await schildErinnerungen(haushalt).catch(() => ({ neu: 0, geschlossen: 0 }));
    return `Ereignis „${def.label}“ am ${b.datum.slice(8, 10)}.${b.datum.slice(5, 7)}.${b.datum.slice(0, 4)} im Pflichten-Kalender angelegt — die Pflichten (${def.pflichten.length}) stehen mit Frist unter Unternehmen › Pflichten & Fristen.`;
  }
  throw new BeschlussFehler('Das Schild wurde gerade geändert — bitte noch einmal freigeben.', 409);
}

async function fassungAnlegen(haushalt: string, person: string, gid: GesellschaftId, b: Beschluss, f: BeschlussFolge): Promise<string> {
  const { ladeRegister, registerAendern, standVon, eintragSchreiben } = await import('./server');
  const a = (b.aenderungen ?? []).find(x => x.merkmal === f.merkmal);
  if (!a) throw new BeschlussFehler('Die Änderung steht nicht mehr am Beschluss.', 409);
  for (let versuch = 0; versuch < 2; versuch++) {
    const g = gesellschaftVon(await ladeRegister(haushalt), gid);
    if (!g) throw new BeschlussFehler('Gesellschaft nicht gefunden.', 404);
    if (aktiveEintraege(g.fassungen).some(x => x.beschlussId === b.id && x.merkmal === a.merkmal)) return 'Diese Fassung steht schon in der Historie — nichts doppelt angelegt.';
    const ab = fassungAb(b, a.merkmal);
    const r = await registerAendern(haushalt, person, gid, standVon(g), { art: 'person', person }, eintragSchreiben('fassungen', {
      merkmal: a.merkmal, ab, ...(a.text ? { text: a.text } : {}), ...(a.cent !== undefined ? { cent: a.cent } : {}), beschlussId: b.id,
      ...(a.merkmal === 'satzung' && b.dateiIds?.length ? { dateiIds: b.dateiIds } : {}),
    }, undefined, person));
    if (r.konflikt) continue;
    if (r.fehler?.length) throw new BeschlussFehler(r.fehler.map(x => x.text).join(' · '), r.status === 413 ? 413 : r.status === 404 ? 404 : 400);
    return `Neue Fassung „${f.merkmal ? (await import('./beschluesse')).merkmalLabel(f.merkmal) : 'Satzung'}“ ab ${ab.slice(8, 10)}.${ab.slice(5, 7)}.${ab.slice(0, 4)} festgehalten — die bisherige bleibt in der Historie.`;
  }
  throw new BeschlussFehler('Das Register wurde gerade geändert — bitte noch einmal freigeben.', 409);
}

async function capTableAufgabe(g: RegisterGesellschaft, b: Beschluss, nr: string, person: string): Promise<string> {
  const [{ systemAufgabenAendern }, { rechtHash }] = await Promise.all([import('@/lib/aufgaben/system-schreiben'), import('@/lib/recht/check')]);
  const id = `bfc-${rechtHash(`${g.id}|${b.id}`)}`;
  const jetzt = new Date().toISOString();
  let schonDa = false;
  await systemAufgabenAendern(stand => {
    schonDa = stand.tasks.some(t => t.id === id);
    if (schonDa) return { neu: [], teile: [] };
    return {
      neu: [{
        id, title: `Cap-Table an Beschluss ${nr} anpassen — ${anzeigeName(g)}`.slice(0, 280),
        description: `Aus dem Beschluss-Buch: „${b.titel}“ (${b.datum.slice(8, 10)}.${b.datum.slice(5, 7)}.${b.datum.slice(0, 4)}). Gesellschafter-Einträge (Nennbeträge, Einlagen, Ein- und Austritte) anpassen, sobald die Maßnahme wirksam ist — die Cap-Table rechnet daraus die Anteile. Hinweis, keine Rechtsberatung.`,
        status: 'todo', priority: 'medium', assignee: person, notiz: `[Gesellschafter öffnen](${WEG.unternehmen(g.id, 'gesellschafter')}) · [Beschluss öffnen](${WEG.beschluss(g.id, b.id)})`,
        tags: ['unternehmen', 'beschluss'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, space: 'business',
        ...(istGesellschaft(g.id) ? { spaceId: g.id } : {}),
      }],
      teile: [],
    };
  }, { person, jetzt });
  return schonDa ? 'Die Aufgabe gibt es schon — nichts doppelt angelegt.' : 'Aufgabe „Cap-Table anpassen“ angelegt (Business) — sie steht unter Aufgaben.';
}

// ── Dokument → Vorschlag (Regelwerk, kein Modell) ─────────────────────────────────────────────────────────────────

/**
 * Den Vorschlag aus einer Unterlage der Gesellschaft (Datei der Ablage mit Bezug auf diese Gesellschaft): Text lesen, Regelwerk anwenden. Die Datei
 * muss zur Gesellschaft gehören (sonst 404); die Privat-Einheit nie (400). Der Text verlässt den Server nicht — zurück kommen Felder und Zitate.
 */
export async function importVorschlag(haushalt: string, gid: string, dateiId: string, heute = localDay()): Promise<{ vorschlag: ImportVorschlag; datei: { id: string; name: string }; umfang?: string }> {
  if (!istGesellschaftId(gid)) throw new BeschlussFehler('id: Kennung einer Gesellschaft.', 400);
  if (istGesellschaft(gid) && gehoertZuPrivat(gid)) throw new BeschlussFehler('Diese Einheit gehört zu Privat — das Beschluss-Buch führt nur Gesellschaften.', 400);
  if (!/^d-[a-z0-9-]{4,60}$/.test(dateiId)) throw new BeschlussFehler('datei: Kennung d-….', 400);
  const [{ lesen, AblageFehler }, { textAuslesen, NichtLesbar }] = await Promise.all([import('@/lib/dateien/ablage'), import('@/lib/dateien/text-auslesen')]);
  let d: Awaited<ReturnType<typeof lesen>>;
  try { d = await lesen(haushalt, dateiId); } catch (e) { if (e instanceof AblageFehler) throw new BeschlussFehler(e.message, 400); throw e; }
  if (!d?.eintrag.datei || d.eintrag.gesellschaft !== gid) throw new BeschlussFehler('Diese Unterlage gibt es in der Ablage dieser Gesellschaft nicht.', 404);
  let textInhalt = '', hinweis: string | undefined, umfang: string | undefined;
  try {
    const a = await textAuslesen(d.bytes, d.eintrag.datei.typ);
    if (a) { textInhalt = a.text; umfang = a.umfang; hinweis = a.hinweis; } else hinweis = 'Bild — kein lesbarer Text. Bitte die Felder selbst eintragen.';
  } catch (e) {
    if (!(e instanceof NichtLesbar)) throw e;
    hinweis = `Text nicht lesbar: ${e.message}`;
  }
  const v = beschlussAusText(textInhalt, heute);
  return { vorschlag: { ...v, ...(hinweis ? { hinweis: [hinweis, v.hinweis].filter(Boolean).join(' ') } : {}) }, datei: { id: d.eintrag.id, name: d.eintrag.titel || d.eintrag.datei.name }, ...(umfang ? { umfang } : {}) };
}

// ── Das Buch als PDF ──────────────────────────────────────────────────────────────────────────────────────────────

/** Das Beschluss-Buch einer Gesellschaft als PDF (Download) — Namen wie in der Anwalts-Mappe (eingeschränkte Kontakte nie mit Namen, Art. 18). */
export async function buchPdfErstellen(haushalt: string, gid: string, o: { jahr?: number; jetzt?: Date } = {}): Promise<{ bytes: Uint8Array; name: string }> {
  if (!istGesellschaftId(gid)) throw new BeschlussFehler('id: Kennung einer Gesellschaft.', 400);
  if (istGesellschaft(gid) && gehoertZuPrivat(gid)) throw new BeschlussFehler('Diese Einheit gehört zu Privat — das Beschluss-Buch führt nur Gesellschaften.', 400);
  const [{ ladeRegister }, { rechtNamen }, { beschlussBuchPdf, buchDateiname }] = await Promise.all([import('./server'), import('@/lib/recht/server'), import('./beschluss-pdf')]);
  const register = await ladeRegister(haushalt);
  const g = gesellschaftVon(register, gid);
  if (!g || g.geloeschtAm) throw new BeschlussFehler('Gesellschaft nicht gefunden.', 404);
  const jetzt = o.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const dok = buchDokument(g, await rechtNamen(register, haushalt), { heute, ...(o.jahr !== undefined ? { jahr: o.jahr } : {}) });
  return { bytes: await beschlussBuchPdf(dok, { erstellt: jetzt }), name: buchDateiname(anzeigeName(g), heute, o.jahr) };
}
