// ─── Markttraktion · Verbindungsprüfung: Bestände laden (Server, 28.09.) ─────
// Holt alles, was lib/crm/verbindungen.ts prüft, aus den Speichern — nur lesen.
// Die Dateiablage liefert nur Kennungen (Metadaten + welche .bin auf der Platte
// liegen), nie Inhalte. Fokus-Blöcke kommen je Person des Haushalts des Inhabers;
// geprüft werden ihre Verweise `aufgabeId` und (28.09.) `mandatId`/`firmaId`.
// Ziele (gemeinsam + je Person) und Meilensteine: nur Kennung und Mandats-/Firmen-Bezug.
// geprüft wird nur ihr Verweis `aufgabeId`.
// Zurückschreiben (28.09. spät): `aufgabenBezugZurueckschreiben` — die Reparatur „aufgabe-bezug-tot“ fasst im
// Speicher `tasks` nur das Feld `bezug` der betroffenen Aufgaben an (aktueller Stand, in der Sperre).

import { registerEinheitenNamen, type RegisterDatei } from '@/lib/gesellschaften/modell';
import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, loadJson, speicherStand, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import type { TasksState } from '@/types/tasks';
import type { ZeitDatei } from '@/lib/zeitmessung/modell';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { DATEI_ID } from '@/lib/dateien/regeln';
import { AUFGABEN_DATEI_PRAEFIX } from '@/lib/dateien/aufgaben-regeln';
import { ladeCrm, CRM_SPEICHER } from './speicher';
import { KONFLIKT_SPEICHER, type KonfliktStand } from './import-konflikte';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDerInhaber, hauptInhaber, kontenImHaushaltDerInhaber } from '@/lib/zugang/inhaber';
import { speicherFuer } from '@/lib/zoe/raum';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { AufgabeKurz, RechnungKurz, VerbindungsBestaende } from './verbindungen';
import { aufgabenBezugReparieren } from './verbindungen';
import type { PlanungBezug } from './verbindungen-planung';
import { ZIEL_HORIZONTE } from '@/lib/planung/typen';
import { verborgeneMeilensteineFuer } from '@/lib/planung/eigene-ziele-sicht-server';
import { HEADS } from '@/lib/heads/prompt';
import { standName } from '@/lib/heads/stand';
import { ladeStand, objekteKurz, holfenster, termineImZeitraum, SPEICHER as ICLOUD_SPEICHER } from '@/lib/kalender/icloud';
import { ladeBezuege, BEZUG_SPEICHER } from '@/lib/kalender/bezug-server';
import { kennungenVon } from '@/lib/kalender/bezug';
import type { KalenderPruefBestand } from './verbindungen-kalender';
import { HAUSHALT_ERSATZ } from './sperrliste';
import type { BuchungenStand } from '@/lib/kalender/buchung-verbindungen';
import type { SpiegelStand } from '@/lib/kalender/spiegel-verbindungen';
import type { TermineStand } from './verbindungen-termine';
import type { FamilieTageStand } from './verbindungen-familie';

interface Quellen { haushalt: string | null; personen: string[] }

/** Haushalt des Inhabers und seine Personen (für Fokus-Blöcke) — ohne Haushalt nur der Inhaber. */
async function quellen(): Promise<Quellen> {
  const st = await ladeKonten();
  const hh = haushaltDerInhaber(st);
  const h = hh && HAUSHALT_OK.test(hh) ? hh : null;
  // Ohne gültigen Haushalt nur der Haupt-Inhaber.
  const personen = h ? kontenImHaushaltDerInhaber(st).map(k => k.speicher) : [hauptInhaber(st)?.speicher].filter((x): x is string => !!x);
  return { haushalt: h, personen: Array.from(new Set(personen)) };
}

/** Die Speicher, deren Stand das ETag der Prüfung bestimmt. */
function speicherNamen(q: Quellen): string[] {
  return ['kontakte', CRM_SPEICHER, 'finanzplan', 'tasks', 'ordnung', KONFLIKT_SPEICHER, 'liquiplan', ICLOUD_SPEICHER, BEZUG_SPEICHER, ...HEADS.map(h => standName(h)),
    ...(q.haushalt ? [`planung-einheiten--${q.haushalt}`, `crm-dateien--${q.haushalt}`, `${AUFGABEN_DATEI_PRAEFIX}${q.haushalt}`, `familie--${q.haushalt}`] : []),
    ...q.personen.map(p => speicherFuer('zeit', p)), ...zieleSpeicher(q), `buchung--${q.haushalt ?? HAUSHALT_ERSATZ}`];
}

/** Die Ziele-Speicher (28.09., Mandat an Zielen): der gemeinsame und je Person der eigene — plus die Meilensteine. */
function zieleSpeicher(q: Quellen): string[] {
  return ['ziele', 'meilensteine', ...q.personen.map(p => speicherFuer('ziele-eigen', p))];
}

/** Nur Kennung und Bezug — nie Titel oder Inhalte. */
const bezugVon = (x: unknown): PlanungBezug | null => {
  const o = (x && typeof x === 'object' ? x : null) as { id?: unknown; mandatId?: unknown; firmaId?: unknown; zielId?: unknown; wartetAuf?: unknown } | null;
  if (!o || typeof o.id !== 'string') return null;
  const wartet = Array.isArray(o.wartetAuf) ? o.wartetAuf.filter((k): k is string => typeof k === 'string') : [];
  return {
    id: o.id,
    ...(typeof o.mandatId === 'string' && o.mandatId ? { mandatId: o.mandatId } : {}),
    ...(typeof o.firmaId === 'string' && o.firmaId ? { firmaId: o.firmaId } : {}),
    // Kette (01.10.): nur Kennungen — Ziel-Bezug und Vorgänger der Meilensteine.
    ...(typeof o.zielId === 'string' && o.zielId ? { zielId: o.zielId } : {}),
    ...(wartet.length ? { wartetAuf: wartet } : {}),
  };
};
const bezuege = (l: unknown): PlanungBezug[] => (Array.isArray(l) ? l.map(bezugVon).filter((x): x is PlanungBezug => !!x) : []);

/**
 * Ziele und Meilensteine für die Verbindungsprüfung laden (nur lesen). Mit `betrachter` (08.10., Kevin: eigene Ziele nur geteilt
 * lesbar, schreiben nie): gemeldet und repariert werden nur der gemeinsame Bestand und die EIGENEN Ziele dieser Person — die eigenen
 * Ziele der anderen zählen nur als Kennung (`weitereZiele`, damit Meilensteine daran nicht als tot gelten). Ohne `betrachter`
 * (Systemlauf: Durchsicht, nur Zähler) wie bisher alle Bestände.
 */
async function ladePlanung(q: Quellen, betrachter?: string | null): Promise<NonNullable<VerbindungsBestaende['planung']>> {
  const namen = ['ziele', ...q.personen.map(p => speicherFuer('ziele-eigen', p))];
  const [ziele, ms] = await Promise.all([
    Promise.all(Array.from(new Set(namen)).map(async n => ({ speicher: n, datei: await loadJson<Record<string, unknown>>(n) }))),
    loadJson<{ meilensteine?: unknown }>('meilensteine'),
  ]);
  const geladen = ziele.filter(z => z.datei).map(z => ({ speicher: z.speicher, ziele: ZIEL_HORIZONTE.flatMap(h => bezuege(z.datei![h])) }));
  const alleMs = bezuege(ms?.meilensteine);
  if (betrachter === undefined) return { ziele: geladen, meilensteine: alleMs };
  const eigene = new Set(['ziele', ...(betrachter ? [speicherFuer('ziele-eigen', betrachter)] : [])]);
  // Meilensteine an einem nicht geteilten eigenen Ziel einer anderen Person (Altbestand, Gegenprüfung 08.10.): weder gemeldet noch repariert.
  const roh = (Array.isArray(ms?.meilensteine) ? ms!.meilensteine : []).filter((m): m is { id: string; zielId?: string; abgeleitetVon?: string } => !!m && typeof m === 'object' && typeof (m as { id?: unknown }).id === 'string');
  const verborgen = await verborgeneMeilensteineFuer(betrachter, roh);
  return {
    ziele: geladen.filter(z => eigene.has(z.speicher)),
    meilensteine: alleMs.filter(m => !verborgen.has(m.id)),
    weitereZiele: geladen.filter(z => !eigene.has(z.speicher)).flatMap(z => z.ziele.map(x => x.id)),
    ...(verborgen.size ? { weitereMeilensteine: [...verborgen] } : {}),
  };
}

/**
 * Kalender (29.09., K1): UIDs aller iCloud-Objekte (+ ob X-MAKE-ART im Text steht), das Holfenster des Stands und die
 * Einträge in `kalender-bezug` — nur Kennungen, UIDs und Tage, nie Titel.
 */
export async function ladeKalenderPruefung(): Promise<KalenderPruefBestand> {
  const [s, b] = await Promise.all([ladeStand(), ladeBezuege()]);
  return {
    fenster: holfenster(s),
    objekte: objekteKurz(s).map(o => ({ uid: o.uid, schluessel: o.schluessel, mitArt: !!o.zusatz?.art })),
    bezuege: Object.entries(b.bezuege).map(([schluessel, x]) => ({ schluessel, ...(x.tag ? { tag: x.tag } : {}), ...(x.art ? { art: x.art } : {}), kennungen: kennungenVon(x) })),
  };
}

/**
 * K6a (29.09.): lebende Termine im Holfenster (Schlüssel, Starttag, Titel — der Titel nur zum Vergleichen für die
 * Waisen-Neuzuordnung, er verlässt die Prüfung nie) und je bestätigter Buchung das Follow-up „Termin vorbereiten“.
 * Ohne gelungenen iCloud-Stand: keine Termine (die Prüfungen schweigen dann).
 */
async function ladeTermineStand(): Promise<TermineStand> {
  const [s, b] = await Promise.all([ladeStand(), import('@/lib/kalender/buchung-speicher').then(m => m.ladeBuchungBestand()).catch(() => null)]);
  const f = holfenster(s);
  return {
    termine: f ? termineImZeitraum(s, f.von, f.bis).map(t => ({ id: t.id, tag: t.start.slice(0, 10), titel: t.titel, mitTeilnehmern: t.mitTeilnehmern })) : [],
    buchungFollowups: (b?.buchungen ?? []).filter(x => x.status === 'bestaetigt' && x.terminUid && x.vorbereitenId).map(x => ({ buchungId: x.id, terminUid: x.terminUid!, followUpId: x.vorbereitenId! })),
  };
}

/**
 * Terminbuchungen (29.09., K4): nur Kennungen und Status der Buchungen und die Kennungen der Seiten. Ob der Termin in
 * iCloud noch da ist, prüft die Prüfung gegen dieselben UIDs wie K1 (`kalender` oben) — kein zweites Laden.
 */
async function ladeBuchungen(): Promise<BuchungenStand> {
  const { ladeBuchungBestand } = await import('@/lib/kalender/buchung-speicher');
  const b = await ladeBuchungBestand();
  return {
    buchungen: b.buchungen.map(x => ({ id: x.id, seiteId: x.seiteId, status: x.status, start: x.start, ...(x.kontaktId ? { kontaktId: x.kontaktId } : {}), ...(x.terminUid ? { terminUid: x.terminUid } : {}) })),
    seiten: b.seiten.map(s => s.id),
  };
}

/** Spiegel (29.09., K5): Familie des Inhabers — nur Kennungen, Tage, UIDs (keine Titel). */
async function ladeFamilieSpiegel(): Promise<SpiegelStand['familie']> {
  const h = (await quellen()).haushalt;
  if (!h) return null;
  const f = await loadJson<{ dates?: { id: string; datum: string; kalenderUid?: string }[]; einstellungen?: { kalenderTermine?: Record<string, string> } }>(`familie--${h}`);
  if (!f) return null;
  return {
    dates: (Array.isArray(f.dates) ? f.dates : []).filter(d => d.kalenderUid).map(d => ({ id: d.id, datum: d.datum, kalenderUid: d.kalenderUid })),
    gespraeche: Object.entries(f.einstellungen?.kalenderTermine ?? {}).map(([datum, uid]) => ({ datum, uid })),
  };
}

/** Familie des Inhabers (F2 N4): nur Kennungen der Menschen und der Wichtigen Tage mit Verweis — keine Namen, keine Daten. */
async function ladeFamilieTage(): Promise<FamilieTageStand | null> {
  const h = (await quellen()).haushalt;
  if (!h) return null;
  const f = await loadJson<{ menschen?: { id: string }[]; tage?: { id: string; menschId?: string; datum?: string }[] }>(`familie--${h}`);
  if (!f) return null;
  return {
    menschen: (Array.isArray(f.menschen) ? f.menschen : []).map(m => m.id),
    tage: (Array.isArray(f.tage) ? f.tage : []).filter(t => t.menschId).map(t => ({ id: t.id, menschId: t.menschId })),
  };
}

const dateiOrdner = (h: string) => path.join(datenOrdner(), 'dateien', h);

/** Stand aller beteiligten Speicher plus Ordner der Ablage — Grundlage für das ETag (304 ohne Rechnen). */
export async function verbindungsStand(): Promise<string> {
  const q = await quellen();
  const ordner = q.haushalt ? await fs.stat(dateiOrdner(q.haushalt)).then(s => Math.round(s.mtimeMs).toString(36)).catch(() => '0') : '0';
  return `${await speicherStand(speicherNamen(q))}-${ordner}`;
}

/** Kennungen der Dateien, die im Ordner des Haushalts liegen (ohne .tmp). */
async function aufPlatte(h: string): Promise<string[]> {
  try {
    return (await fs.readdir(dateiOrdner(h))).filter(n => n.endsWith('.bin')).map(n => n.slice(0, -4)).filter(id => DATEI_ID.test(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw e;
  }
}

/**
 * Alles, was die Verbindungsprüfung braucht — nur lesen. `betrachter` = die fragende Person (Route, ZOE): eigene Ziele anderer
 * Personen nur als Kennung (siehe `ladePlanung`); ohne Angabe (Systemlauf) wie bisher.
 */
export async function ladeVerbindungsBestaende(heute: string, betrachter?: string | null): Promise<VerbindungsBestaende & { haushalt: string | null }> {
  const q = await quellen();
  // Seit 28.09. abends: Planposten-Kennungen (Mandat → Liquiditätsplan) und Head-Vorschläge (nur Kennung, Person, Status).
  const [liquiplan, heads, planung, kalender, buchungen, familieSpiegel, termine, familieTage] = await Promise.all([
    loadJson<{ posten?: { id: string }[] }>('liquiplan'),
    Promise.all(HEADS.map(async h => ({ head: h, stand: await loadJson<{ vorschlaege?: { id: string; kontakt_id?: string | null; status?: string }[] }>(standName(h)) }))),
    ladePlanung(q, betrachter),
    ladeKalenderPruefung().catch(() => null),
    ladeBuchungen().catch(() => null),
    ladeFamilieSpiegel().catch(() => null),
    ladeTermineStand().catch(() => null),
    ladeFamilieTage().catch(() => null),
  ]);
  const [kontakte, crm, finanz, tasks, ordnung, einheiten, konflikte, ablage, dateien, zeiten, aufgabenAblage] = await Promise.all([
    loadJson<{ kontakte?: Kontakt[] }>('kontakte'),
    ladeCrm(),
    loadJson<{ rechnungen?: RechnungKurz[]; firmen?: { id: string }[] }>('finanzplan'),
    loadJson<TasksState>('tasks'),
    loadJson<{ orgs?: Record<string, string> }>('ordnung'),
    q.haushalt ? loadJson<{ eigene?: string[] }>(`planung-einheiten--${q.haushalt}`) : Promise.resolve(null),
    loadJson<KonfliktStand>(KONFLIKT_SPEICHER),
    q.haushalt ? loadJson<{ eintraege?: DateiEintrag[] }>(`crm-dateien--${q.haushalt}`) : Promise.resolve(null),
    q.haushalt ? aufPlatte(q.haushalt) : Promise.resolve([] as string[]),
    Promise.all(q.personen.map(async p => ({ person: p, datei: await loadJson<ZeitDatei>(speicherFuer('zeit', p)) }))),
    q.haushalt ? loadJson<{ eintraege?: DateiEintrag[] }>(`${AUFGABEN_DATEI_PRAEFIX}${q.haushalt}`) : Promise.resolve(null),
  ]);
  const registerEinheiten = q.haushalt ? registerEinheitenNamen(await loadJson<RegisterDatei>(`gesellschaften--${q.haushalt}`)) : [];
  const aufgaben: AufgabeKurz[] = (Array.isArray(tasks?.tasks) ? tasks!.tasks : []).map(t => ({ id: t.id, title: t.title, ...(t.description ? { description: t.description } : {}), projectId: t.projectId, status: t.status, ...(t.space ? { space: t.space } : {}), ...(t.einheit ? { einheit: t.einheit } : {}), ...(t.spaceId ? { spaceId: t.spaceId } : {}), ...(t.bezug ? { bezug: t.bezug } : {}), ...(t.parentId ? { parentId: t.parentId } : {}) }));
  return {
    heute,
    haushalt: q.haushalt,
    kontakte: Array.isArray(kontakte?.kontakte) ? kontakte!.kontakte : [],
    crm,
    finanzplan: finanz ? { rechnungen: Array.isArray(finanz.rechnungen) ? finanz.rechnungen : [], firmen: (Array.isArray(finanz.firmen) ? finanz.firmen : []).map(f => f.id) } : null,
    // Einheiten der Planung = Standard + Register-Gesellschaften (04.10.) + eigene — dieselbe Liste wie GET /api/planung/einheiten.
    aufgaben: tasks ? { liste: aufgaben, orte: ordnung?.orgs && typeof ordnung.orgs === 'object' ? ordnung.orgs : {}, eigeneEinheiten: [...registerEinheiten, ...(Array.isArray(einheiten?.eigene) ? einheiten!.eigene : [])] } : null,
    fokus: zeiten.map(z => ({ person: z.person, bloecke: Object.values(z.datei?.tage ?? {}).flatMap(t => (Array.isArray(t?.bloecke) ? t.bloecke : [])) })),
    dateien: q.haushalt ? { eintraege: Array.isArray(ablage?.eintraege) ? ablage!.eintraege : [], aufPlatte: dateien } : null,
    // Projekt-/Aufgaben-Dateien (C2): nur Kennungen und Bezüge werden geprüft, nie Inhalte.
    aufgabenDateien: q.haushalt ? { eintraege: Array.isArray(aufgabenAblage?.eintraege) ? aufgabenAblage!.eintraege : [], projekte: (Array.isArray(tasks?.projects) ? tasks!.projects : []).map(p => p.id) } : null,
    konflikte: konflikte ?? null,
    liquiplan: liquiplan ? { posten: (Array.isArray(liquiplan.posten) ? liquiplan.posten : []).map(p => p.id) } : null,
    planung,
    kalender,
    buchungen,
    familieSpiegel,
    termine,
    familieTage,
    heads: heads.map(h => ({ head: h.head, vorschlaege: (Array.isArray(h.stand?.vorschlaege) ? h.stand!.vorschlaege : []).map(v => ({ id: v.id, ...(v.kontakt_id ? { kontakt_id: v.kontakt_id } : {}), ...(v.status ? { status: v.status } : {}) })) })),
  };
}

/**
 * Reparatur „aufgabe-bezug-tot“ zurückschreiben: in EINER Sperre auf dem AKTUELLEN Aufgaben-Stand gerechnet,
 * gegen die Kennungen aus `stand` (Kartei + CRM, nach deren Reparatur). Angefasst wird nur das Feld `bezug`
 * der Aufgaben mit toten Verweisen — nie die ganze Liste aus einem alten Stand, keine Zeitstempel.
 * Protokoll ohne Werte (Kennung + Feldname). Liefert die Zahl der geänderten Aufgaben.
 */
export async function aufgabenBezugZurueckschreiben(stand: Pick<VerbindungsBestaende, 'kontakte' | 'crm'>, wer?: Wer): Promise<number> {
  let geaendert: string[] = [];
  await updateJson<TasksState>('tasks', cur => {
    if (!cur || !Array.isArray(cur.tasks)) return cur as TasksState;
    const r = aufgabenBezugReparieren(cur.tasks, stand);
    if (!r.n) return cur;
    geaendert = r.tasks.filter((t, i) => t !== cur.tasks[i]).map(t => t.id);
    return { ...cur, tasks: r.tasks };
  });
  if (geaendert.length) await protokolliere('tasks', geaendert.map(id => ({ liste: 'tasks', op: 'geaendert' as const, id, felder: ['bezug'] })), wer);
  return geaendert.length;
}
